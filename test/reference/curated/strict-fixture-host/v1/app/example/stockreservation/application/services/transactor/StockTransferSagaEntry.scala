package example.stockreservation.application.services.transactor

import akka.actor.typed.{ActorRef, ActorSystem, Behavior, Scheduler}
import akka.actor.typed.scaladsl.AskPattern._
import akka.actor.typed.scaladsl.Behaviors
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.typed.{ClusterSingleton, SingletonActor}
import akka.contrib.persistence.mongodb.{MongoReadJournal, ScalaDslMongoReadJournal}
import akka.persistence.query.{EventEnvelope, PersistenceQuery}
import akka.persistence.typed.PersistenceId
import akka.stream.scaladsl.{Keep, Sink}
import akka.stream.{KillSwitches, Materializer, SystemMaterializer, UniqueKillSwitch}
import akka.util.Timeout
import example.stockreservation.application.aggregates.{TransferStockCommand, WarehouseProtocol}
import example.stockreservation.domain.events.{StockReceivedEvent, StockTransferCompletedEvent}
import net.imadz.infra.saga.strict._
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}

/** Generated fixture host family (strict-fixture-host): the deployment entry for
  * the stock-transfer fixture. The reconcile token is constant-time compared for
  * authorized reconciliation only; it is a fixture token, not a production
  * credential. installEventSource consumes the Mongo read journal — its
  * execution needs a reachable Mongo deployment and is compile-face only in this
  * fixture (F12 ruling); KillSwitch ownership stays with the caller. The
  * publication entity is the first step's resource (source warehouse) resolved
  * through the host's exact-resource addressing; the publication command
  * carries the transaction id and the aggregate acks idempotently. */
object StockTransferSagaEntry {

  val NamespacePrefix = "strict-saga"

  def persistenceId: PersistenceId =
    PersistenceId.ofUniqueId(s"$NamespacePrefix/${StockTransferSagaModule.name}")

  def spawn(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      reconcileToken: String
  )(implicit ec: ExecutionContext): ActorRef[StrictSagaCoordinator.Command] = {
    require(reconcileToken != null && reconcileToken.nonEmpty, "reconcile token required")
    system.systemActorOf(coordinatorBehavior(system, sharding, reconcileToken), coordinatorName)
  }

  def spawnClusterSingleton(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      reconcileToken: String
  )(implicit ec: ExecutionContext): ActorRef[StrictSagaCoordinator.Command] = {
    require(reconcileToken != null && reconcileToken.nonEmpty, "reconcile token required")
    ClusterSingleton(system).init(
      SingletonActor(coordinatorBehavior(system, sharding, reconcileToken), coordinatorName))
  }

  def start(
      coordinator: ActorRef[StrictSagaCoordinator.Command],
      host: StockTransferSagaModule.Host,
      source: TransferStockCommand,
      replyTo: ActorRef[StrictSagaCoordinator.Reply]
  ): StrictSagaCoordinator.Start =
    StockTransferSagaModule.transferStockRequestedTriggerStart(source, host, replyTo)

  def installEventSource(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      coordinator: ActorRef[StrictSagaCoordinator.Command]
  )(implicit ec: ExecutionContext): UniqueKillSwitch = {
    val host = new FixtureHost(system, sharding)
    implicit val materializer: Materializer = SystemMaterializer(system).materializer
    val replySink = system.systemActorOf(
      Behaviors.receiveMessage[StrictSagaCoordinator.Reply](_ => Behaviors.same),
      s"${StockTransferSagaModule.name}-completion-reply-sink")
    val journal = PersistenceQuery(system)
      .readJournalFor[ScalaDslMongoReadJournal](MongoReadJournal.Identifier)
    journal.allEvents()
      .viaMat(KillSwitches.single[EventEnvelope])(Keep.right)
      .toMat(Sink.foreach[EventEnvelope](envelope =>
        dispatchEnvelope(system, sharding, coordinator, host, replySink, envelope)))(Keep.left)
      .run()
  }

  def status(
      coordinator: ActorRef[StrictSagaCoordinator.Command]
  )(implicit timeout: Timeout, scheduler: Scheduler, ec: ExecutionContext): Future[StrictState] =
    coordinator.ask(StrictSagaCoordinator.GetStatus).flatMap {
      case StrictSagaCoordinator.Status(state) => Future.successful(state)
      case _ => Future.failed(new IllegalStateException("unexpected coordinator reply"))
    }

  def completionEvent(
      identity: TransactionIdentity,
      args: StockTransferSagaModule.Args,
      host: StockTransferSagaModule.Host,
      state: StrictState
  ): Option[StockTransferCompletedEvent] =
    state.status match {
      case StrictStatus.Succeeded =>
        Some(StockTransferSagaModule.succeededCompletionEvent(identity, args, host))
      case StrictStatus.Aborted =>
        None // no compensated / rejected-before-effects completion declared by the module
      case StrictStatus.RecoveryRequired =>
        None // no recovery-required completion declared by the module
      case _ => None
    }

  def publishCompletion(
      sharding: ClusterSharding,
      host: StockTransferSagaModule.Host,
      state: StrictState
  )(implicit timeout: Timeout, scheduler: Scheduler,
      ec: ExecutionContext): Future[WarehouseProtocol.PhaseReply[
      WarehouseProtocol.CompletionAcknowledgement]] = {
    require(state.identity.nonEmpty, "transaction identity required")
    require(state.terminal, "terminal state required")
    val identity = state.identity.get
    val args = host.argsCodec.decode(state.argsBytes).get
    require(completionEvent(identity, args, host, state).nonEmpty,
      "no completion event for terminal state")
    completionEvent(identity, args, host, state).get match {
      case completed: StockTransferCompletedEvent =>
        val entityRef = sharding.entityRefFor(WarehouseProtocol.entityKey,
          host.sourceWarehouseResource(args.sourceWarehouseId))
        entityRef.ask(replyTo =>
          WarehouseProtocol.RecordTransferCompleted(completed.transactionId, replyTo))
      case _ => Future.failed(new IllegalStateException("unmapped completion event"))
    }
  }

  private def coordinatorBehavior(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      reconcileToken: String
  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] =
    StockTransferSagaModule.behavior(persistenceId, new FixtureHost(system, sharding),
      FixtureReconcileAuthorizer(reconcileToken))

  private def coordinatorName: String =
    s"${StockTransferSagaModule.name}-strict-saga-coordinator"

  private def dispatchEnvelope(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      coordinator: ActorRef[StrictSagaCoordinator.Command],
      host: FixtureHost,
      replySink: ActorRef[StrictSagaCoordinator.Reply],
      envelope: EventEnvelope
  )(implicit ec: ExecutionContext): Unit = {
    implicit val askTimeout: Timeout = Timeout(15.seconds)
    implicit val askScheduler: Scheduler = system.scheduler
    if (envelope.persistenceId == persistenceId.id)
      coordinatorEnvelope(sharding, coordinator, host, envelope)
    else triggerEnvelope(coordinator, host, replySink, envelope)
  }

  private def coordinatorEnvelope(
      sharding: ClusterSharding,
      coordinator: ActorRef[StrictSagaCoordinator.Command],
      host: FixtureHost,
      envelope: EventEnvelope
  )(implicit ec: ExecutionContext, timeout: Timeout, scheduler: Scheduler): Unit =
    envelope.event match {
      case StrictEvent.Succeeded => terminalPublication(sharding, coordinator, host)
      case StrictEvent.Aborted => terminalPublication(sharding, coordinator, host)
      case _ => ()
    }

  private def terminalPublication(
      sharding: ClusterSharding,
      coordinator: ActorRef[StrictSagaCoordinator.Command],
      host: FixtureHost
  )(implicit ec: ExecutionContext, timeout: Timeout, scheduler: Scheduler): Unit =
    coordinator.ask(StrictSagaCoordinator.GetStatus).map {
      case StrictSagaCoordinator.Status(state) => terminalState(sharding, host, state)
      case _ => ()
    }.failed.foreach(failure =>
      Console.err.println(s"coordinator status query failed: ${failure.getMessage}"))

  private def terminalState(
      sharding: ClusterSharding,
      host: FixtureHost,
      state: StrictState
  )(implicit ec: ExecutionContext, timeout: Timeout, scheduler: Scheduler): Unit =
    if (state.terminal)
      publishCompletion(sharding, host, state).failed.foreach(failure =>
        Console.err.println(s"completion publication failed: ${failure.getMessage}"))

  private def triggerEnvelope(
      coordinator: ActorRef[StrictSagaCoordinator.Command],
      host: FixtureHost,
      replySink: ActorRef[StrictSagaCoordinator.Reply],
      envelope: EventEnvelope
  ): Unit =
    envelope.event match {
      case event: StockReceivedEvent =>
        coordinator ! StockTransferSagaModule.warehouseStockReceivedTriggerStart(event, host,
          replySink)
      case _ => ()
    }
}

final case class FixtureReconcileAuthorizer(expected: String) extends ReconcileAuthorizer {
  def authorize(identity: TransactionIdentity, token: String): Either[String, String] = {
    val provided = Option(token).getOrElse("")
    val expectedToken = Option(expected).getOrElse("")
    if (expectedToken.isEmpty) Left("reconciliation token mismatch")
    else if (java.security.MessageDigest.isEqual(
      provided.getBytes(java.nio.charset.StandardCharsets.UTF_8),
      expectedToken.getBytes(java.nio.charset.StandardCharsets.UTF_8))) Right("fixture-reconciler")
    else Left("reconciliation token mismatch")
  }
}
