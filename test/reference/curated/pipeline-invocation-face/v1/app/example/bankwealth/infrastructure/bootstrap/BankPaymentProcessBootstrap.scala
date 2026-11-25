package example.bankwealth.infrastructure.bootstrap

import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._

import akka.actor.typed.{ActorRef, Behavior, PostStop}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import com.google.protobuf.ByteString
import example.bankwealth.application.process.cash_payment._
import example.bankwealth.infrastructure.process.{BankPaymentHost, BankPaymentHostIO}
import example.bankwealth.application.process.protocol.BankPaymentMessages._
import example.bankwealth.infrastructure.persistence.{BankCashPaymentStateCodec, BankPaymentProcessCodecs}
import net.imadz.infra.saga.strict._
import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver}

/** Runtime persistence & actor assembly for `BankPaymentHost` and `BankCashPaymentExecution`. */
object BankPaymentProcessBootstrap {

  def install(payCashPurchaseHost: ActorRef[BankPaymentHost.Request]): Installed = {
    require(payCashPurchaseHost != null, "the exact invocation host actor is required")
    new Installed(payCashPurchaseHost)
  }

  final class Installed private[BankPaymentProcessBootstrap] (
    val payCashPurchaseHost: ActorRef[BankPaymentHost.Request],
  )

  def portsFromTechnical(technical: BankPaymentPorts)(implicit ec: ExecutionContext): BankPaymentSagaDefinition.Ports =
    BankPaymentSagaDefinition.fromTechnical(technical, BankPaymentProcessCodecs)

  def definition(ports: BankPaymentSagaDefinition.Ports)
      (implicit ec: ExecutionContext): StrictSagaDefinition[BankPaymentSagaDefinition.Args] =
    BankPaymentSagaDefinition.definition(ports, BankPaymentProcessCodecs.argsCodec)

  def coordinatorBehavior(
    persistenceId: String,
    ports: BankPaymentSagaDefinition.Ports,
    authorizer: ReconcileAuthorizer,
  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && authorizer != null,
        "explicit identity and reconciliation authorizer required")
    StrictSagaCoordinator(PersistenceId.ofUniqueId(persistenceId), definition(ports), authorizer,
      StrictSagaCoordinator.Settings(scala.concurrent.duration.Duration(BankPaymentSagaDefinition.CoordinatorAskMillis,
          "millis"), BankPaymentSagaDefinition.CoordinatorCapacity))
  }

  def hostBehavior(
    persistenceId: String,
    coordinator: ActorRef[StrictSagaCoordinator.Command],
    technical: BankPaymentPorts,
  ): Behavior[BankPaymentHost.Request] = Behaviors.setup { context =>
    import BankPaymentHost._
    require(persistenceId != null && persistenceId.nonEmpty && coordinator != null && technical != null,
      "explicit owned host identity, coordinator and installed technical ports required")
    implicit val ec: ExecutionContext = context.executionContext

    final case class Admission(pending: Boolean, waiters: Vector[ActorRef[Reply]])
    val admissionIdle = Admission(pending = false, waiters = Vector.empty)
    var admission = admissionIdle

    def broadcaster(waiters: Vector[ActorRef[Reply]]): ActorRef[Reply] =
      context.spawnAnonymous(Behaviors.receiveMessage[Reply] { reply =>
        waiters.foreach(_ ! reply); Behaviors.stopped
      })

    def deliver(state: State, kind: ResultKind, replyTo: ActorRef[Reply]): Unit = {
      val original = originalInput(parent(state))
      state.identity match {
        case None => context.log.error("delivery attempted without observed identity, operation {}", state.operation)
        case Some(identity) =>
          context.pipeToSelf(BankPaymentHostIO.deliver(kind,
              original, identity, technical))(ok => Delivered(kind, ok.getOrElse(false), replyTo))
      }
    }

    def parent(state: State): BankCashPaymentExecution.State =
      BankCashPaymentStateCodec.codec.decode(state.original.toByteArray)

    def observe(state: State, replyTo: ActorRef[Reply]): Unit =
      if (!state.admitted) {
        admission = admission.copy(waiters = admission.waiters :+ replyTo)
        if (!admission.pending) {
          admission = admission.copy(pending = true)
          val original = originalInput(parent(state))
          val verdict: Future[Either[String, Unit]] =
            BankPaymentHostIO.admit(original, technical).transform {
              case scala.util.Success(true) => scala.util.Success(Right(()))
              case scala.util.Success(false) => scala.util.Success(Left("entry or association not admitted"))
              case scala.util.Failure(error) => scala.util.Success(Left("admission unavailable: " + error.getMessage))
            }
          context.pipeToSelf(verdict)(admitted => Admitted(state.operation,
              admitted.getOrElse(Left("admission unavailable"))))
        }
      } else {
        val adapter = context.spawnAnonymous(Behaviors.receiveMessage[StrictSagaCoordinator.Reply] { reply =>
          context.self ! Observed(reply, replyTo); Behaviors.stopped
        })
        state.identity match {
          case Some(identity) => coordinator ! StrictSagaCoordinator.Attach(identity, adapter)
          case None => coordinator ! StrictSagaCoordinator.Start(state.operation, state.args, adapter)
        }
      }

    EventSourcedBehavior[Request, Event, State](
      PersistenceId.ofUniqueId(persistenceId),
      State(),
      (state, request) => request match {
        case Invoke(input, replyTo) =>
          val original = ByteString.copyFrom(BankCashPaymentStateCodec.codec.encode(input))
          val args = BankPaymentProcessCodecs.argsCodec.encode(invocationArgs(input))
          val operation = operationIdentity(input)
          if (state.operation.nonEmpty &&
              (state.operation != operation || state.original != original || state.args != args)) {
            Effect.none.thenRun(_ =>
                replyTo ! Conflict("different complete parent input or args under existing invocation"))
          } else if (state.delivered && state.result.exists(ResultKind.terminal)) {
            Effect.none.thenRun(s => replyTo ! completed(s, s.result.getOrElse(ResultKind.OutcomeUnknown)))
          } else if (state.operation.nonEmpty) {
            Effect.none.thenRun(s => observe(s, replyTo))
          } else {
            context.log.debug("associating invocation {} to saga {}", operation, SagaId)
            Effect.persist(Associated(original, args, operation)).thenRun(s => observe(s, replyTo))
          }

        case Observed(StrictSagaCoordinator.Status(status), replyTo) if !validStatus(state, status) =>
          Effect.none.thenRun(_ => replyTo ! Conflict("authoritative identity conflict"))

        case Observed(StrictSagaCoordinator.Status(status), replyTo) =>
          val observed = classify(status)
          val observedEvents = (state.identity, status.identity) match {
            case (None, Some(identity)) => Vector[Event](IdentityObserved(identity))
            case _ => Vector.empty
          }
          val events = observedEvents ++ nextResult(state.result, observed).map(ResultIntent).toVector
          Effect.persist(events).thenRun { s: State =>
            s.result match {
              case Some(kind) if !s.delivered => deliver(s, kind, replyTo)
              case Some(kind) => replyTo ! completed(s, kind)
              case None => replyTo ! Pending("awaiting authoritative result")
            }
          }

        case Admitted(operation,
            Right(())) if state.operation.nonEmpty && state.operation == operation && !state.admitted =>
          Effect.persist(AdmissionGranted).thenRun { s: State =>
            val waiters = admission.waiters
            admission = admissionIdle
            observe(s, broadcaster(waiters))
          }

        case Admitted(operation, Left(reason)) if state.operation == operation && !state.admitted =>
          Effect.none.thenRun { _ =>
            val waiters = admission.waiters
            admission = admissionIdle
            waiters.foreach(_ ! Pending(reason))
          }

        case _: Admitted => Effect.none

        case Observed(StrictSagaCoordinator.Denied(reason), replyTo) =>
          Effect.none.thenRun(_ => replyTo ! Pending(reason))

        case Observed(StrictSagaCoordinator.ConflictingIdentity, replyTo) =>
          Effect.none.thenRun(_ => replyTo ! Conflict("coordinator identity conflict"))

        case Delivered(kind, true, replyTo) if state.result.contains(kind) =>
          context.log.debug("receipt delivered for operation {} kind {}", state.operation, kind.wire)
          Effect.persist(DeliveryAcknowledged(kind)).thenRun(s => replyTo ! completed(s, kind))

        case Delivered(_, _, replyTo) =>
          Effect.none.thenRun(_ => replyTo ! Pending("delivery unacknowledged"))
      },
      (state, event) => applyEvent(state, event),
    )
  }

  def executionBehavior(
    persistenceId: String,
    installed: Installed,
    observer: RunObserver[BankCashPaymentExecution.State],
  )(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[BankCashPaymentExecution.State]] =
    Behaviors.setup { context =>
      import BankCashPaymentExecution._
      require(persistenceId != null && persistenceId.nonEmpty && installed != null && observer != null,
        "explicit owned finite execution and installed objects required")

      final case class InvocationCall(state: State,
          attempt: Int, deadline: Deadline, promise: Promise[PayCashPurchaseResult])
      val invocationBridge = context.spawnAnonymous(Behaviors.setup[InvocationCall] { bridgeContext =>
        Behaviors.receiveMessage[InvocationCall] { call =>
          bridgeContext.spawnAnonymous(Behaviors.setup[BankPaymentHost.Reply] { replyContext =>
            installed.payCashPurchaseHost ! BankPaymentHost.Invoke(call.state, replyContext.self)
            Behaviors.receiveMessage[BankPaymentHost.Reply] {
              case BankPaymentHost.Completed(result) => call.promise.trySuccess(result); Behaviors.stopped
              case BankPaymentHost.Conflict(reason) =>
                  call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped
              case BankPaymentHost.Pending(_) if call.deadline.isOverdue() =>
                call.promise
              .tryFailure(new IllegalStateException("pay-cash-purchase stage deadline exceeded")); Behaviors.stopped
              case BankPaymentHost.Pending(_) =>
                replyContext.scheduleOnce(backoffMillis(call.attempt).millis, bridgeContext.self,
                  call.copy(attempt = call.attempt + 1))
                Behaviors.same
            }.receiveSignal { case (_, PostStop) =>
              call.promise.tryFailure(new IllegalStateException("owned invocation observer stopped")); Behaviors.same
            }
          })
          Behaviors.same
        }
      })

      def invokePayCashPurchase(state: State): Future[PayCashPurchaseResult] = {
        val promise = Promise[PayCashPurchaseResult]()
        invocationBridge ! InvocationCall(state, attempt = 0, deadline = Deadline.now + StageDeadline, promise)
        promise.future
      }

      val plan = Vector(StageId)
      PersistentMonarch.behavior[String, State](
        PersistenceId.ofUniqueId(persistenceId),
        plan,
        (step, state) => step match {
          case StageId => invokePayCashPurchase(state).map(foldResult(state, _))
          case _ => Future.failed(new IllegalArgumentException("unknown static step"))
        },
        BankCashPaymentStateCodec.codec,
        identity[String],
        None,
        observer,
      )
    }
}
