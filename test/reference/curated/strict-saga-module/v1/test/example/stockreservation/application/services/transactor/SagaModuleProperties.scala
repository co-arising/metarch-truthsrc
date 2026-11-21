package example.stockreservation.application.services.transactor

import akka.actor.typed.ActorRef
import example.stockreservation.application.aggregates.TransferStockCommand
import example.stockreservation.domain.events.StockTransferCompletedEvent
import example.stockreservation.application.services.transactor.StockTransferSagaModule
import net.imadz.infra.saga.strict._
import org.scalacheck.Properties
import org.scalacheck.Prop.{forAll, secure}
import scala.concurrent.Future
import scala.concurrent.duration._

/** 行为合同（B2 面）：合同护栏全链＋真实协调器往返（persistence-testkit journal，
  * 事件走真实 strict-saga protobuf 序列化）。无生成器场景性质 secure＝单次评估
  * Proved；随机面 forAll＝≥1000 次评估。 */
object SagaModuleProperties extends Properties("strict-saga-module.behavior.v1") {
  import SagaModuleOracle._
  import SagaModuleCases._
  import ProbeFixtures._
  private implicit val ec: scala.concurrent.ExecutionContext =
    scala.concurrent.ExecutionContext.global

  private def codec(): ProbeArgsCodec = new ProbeArgsCodec(CodecPin("stock-transfer-args", 1))

  private def settings(): StrictSagaCoordinator.Settings =
    StrictSagaCoordinator.Settings(1000.millis, 32)

  private def throwsMessage(thunk: => Any): String = {
    try {
      thunk
      "<no-throw>"
    } catch { case ex: Throwable =>
      Option(ex.getMessage).getOrElse("<null-message>").stripPrefix("requirement failed: ")
    }
  }

  private def replyTo(): ActorRef[StrictSagaCoordinator.Reply] =
    SagaModuleFixture.testKit.createTestProbe[StrictSagaCoordinator.Reply]().ref

  private def definitionOf(host: ProbeHost): StrictSagaDefinition[StockTransferSagaModule.Args] =
    StockTransferSagaModule.definition(host)

  private def coordinator(): (ProbeHost, ProbeAuthorizer, ActorRef[StrictSagaCoordinator.Command]) = {
    val host = new ProbeHost(codec(), settings())
    val authorizer = new ProbeAuthorizer
    val ref = SagaModuleFixture.spawnCoordinator(host, authorizer,
      SagaModuleFixture.nextPid("flow"))
    (host, authorizer, ref)
  }

  property("definition builds participants in prepare order with exact identities and phases") =
    forAll(genArgs) { args =>
      val host = new ProbeHost(codec(), settings())
      val plan = definitionOf(host).participants(args)
      plan.size == 2 &&
        participantMatches(plan.head, args.sourceWarehouseId, expectedStepIds.head,
          expectedParticipants.head, host.sourceWarehouseResource) &&
        participantMatches(plan.last, args.targetWarehouseId, expectedStepIds.last,
          expectedParticipants.last, host.targetWarehouseResource)
    }

  private def participantMatches(participant: StrictParticipant[StockTransferSagaModule.Args],
      slot: java.util.UUID, stepId: String, participantId: String,
      address: java.util.UUID => String): Boolean =
    participant.stepId == stepId && participant.participantId == participantId &&
      participant.resource == address(slot) &&
      participant.phases.keySet == expectedPhases

  property("definition installs the host canonical codec and the frozen definition identity") =
    forAll(genArgs) { args =>
      val host = new ProbeHost(codec(), settings())
      val definition = definitionOf(host)
      val plan = definition.participants(args)
      (definition.argsCodec eq host.argsCodec) &&
        definition.name == SagaModuleOracle.name && definition.version == SagaModuleOracle.version &&
        definition.definitionDigest == digest && plan.nonEmpty
    }

  property("negative: definition fails closed when the host rejects requireImplemented") =
    secure {
      val host = new ProbeHost(codec(), settings())
      host.failImplemented = true
      throwsMessage(definitionOf(host)) == "probe host implementation unavailable"
    }

  property("negative: definition fails closed on address contract drift") = secure {
    val host = new AddressDriftHost(codec(), settings())
    throwsMessage(definitionOf(host)) == "exact resource binding mismatch"
  }

  property("negative: definition fails closed on args codec pin drift") = secure {
    val host = new ArgsPinDriftHost(settings())
    throwsMessage(definitionOf(host)) == "args codec pin mismatch"
  }

  property("negative: definition fails closed on a null host") = secure {
    throwsMessage(StockTransferSagaModule.definition(null)) == "host canonical args codec required"
  }

  property("command trigger start round-trips canonical args into the coordinator start") =
    forAll(genCommand) { command =>
      val host = new ProbeHost(codec(), settings())
      val start = StockTransferSagaModule.transferStockRequestedTriggerStart(command, host,
        replyTo())
      val decoded = host.argsCodec.decode(start.argsBytes).get
      start.transactionId == command.transferId.toString &&
        decoded == StockTransferSagaModule.Args(command.sourceWarehouseId,
          command.targetWarehouseId, command.sku, command.quantity, command.transferMode) &&
        host.transferStockRequestedTrigger.mapped.recorded == Vector(command)
    }

  property("negative: trigger start fails closed on trigger binding contract drift") = secure {
    val host = new ProbeHost(codec(), settings())
    host.transferStockRequestedTrigger.armedContract =
      StockTransferSagaModule.transferStockRequestedTriggerContract.copy(aggregate = "drifted")
    val command = TransferStockCommand(reservationOne, warehouseOne, warehouseTwo, "SKU-100",
      defaultQuantity, "STANDARD")
    throwsMessage(StockTransferSagaModule.transferStockRequestedTriggerStart(command, host,
      replyTo())) == "trigger binding mismatch"
  }

  property("negative: trigger start fails closed when the host rejects requireImplemented") =
    secure {
      val host = new ProbeHost(codec(), settings())
      host.failImplemented = true
      val command = TransferStockCommand(reservationOne, warehouseOne, warehouseTwo, "SKU-100",
        defaultQuantity, "STANDARD")
      throwsMessage(StockTransferSagaModule.transferStockRequestedTriggerStart(command, host,
        replyTo())) == "probe host implementation unavailable"
    }

  property("negative: trigger start fails closed on args codec pin drift") = secure {
    val host = new ArgsPinDriftHost(settings())
    val command = TransferStockCommand(reservationOne, warehouseOne, warehouseTwo, "SKU-100",
      defaultQuantity, "STANDARD")
    throwsMessage(StockTransferSagaModule.transferStockRequestedTriggerStart(command, host,
      replyTo())) == "args codec pin mismatch"
  }

  property("negative: trigger start fails closed on non-canonical args encoding") = secure {
    val host = new ProbeHost(new NonCanonicalArgsCodec(CodecPin("stock-transfer-args", 1)),
      settings())
    val command = TransferStockCommand(reservationOne, warehouseOne, warehouseTwo, "SKU-100",
      defaultQuantity, "STANDARD")
    throwsMessage(StockTransferSagaModule.transferStockRequestedTriggerStart(command, host,
      replyTo())) == "canonical trigger args required"
  }

  property("negative: trigger start requires a stable host idempotency transaction id") = secure {
    val host = new ProbeHost(codec(), settings())
    host.transferStockRequestedTrigger.armedStart = Some(StockTransferSagaModule.TriggerStart("",
      host.argsValue))
    val command = TransferStockCommand(reservationOne, warehouseOne, warehouseTwo, "SKU-100",
      defaultQuantity, "STANDARD")
    throwsMessage(StockTransferSagaModule.transferStockRequestedTriggerStart(command, host,
      replyTo())) == "stable host idempotency transaction id required"
  }

  property("event trigger start maps the whole typed event into the coordinator start") =
    forAll(genEvent) { event =>
      val host = new ProbeHost(codec(), settings())
      val start = StockTransferSagaModule.warehouseStockReceivedTriggerStart(event, host,
        replyTo())
      val decoded = host.argsCodec.decode(start.argsBytes).get
      start.transactionId == "received-" + event.receivedQuantity.toString &&
        decoded == StockTransferSagaModule.Args(event.warehouseId, event.warehouseId,
          event.sku, event.receivedQuantity, "STANDARD") &&
        host.warehouseStockReceivedTrigger.mapped.recorded == Vector(event)
    }

  property("completion maps identity and args through the host binding only") =
    forAll(genTransactionId, genArgs) { (transactionId, args) =>
      val host = new ProbeHost(codec(), settings())
      val event = StockTransferSagaModule.succeededCompletionEvent(moduleIdentity(transactionId),
        args, host)
      event == StockTransferCompletedEvent(transactionId, args.sourceWarehouseId) &&
        host.succeededCompletion.mapped.recorded == Vector(StockTransferSagaModule
          .SucceededCompletionInput(transactionId, args.sourceWarehouseId))
    }

  property("negative: completion fails closed on definition name drift") = secure {
    val host = new ProbeHost(codec(), settings())
    val identity = completionIdentity("tx-drift", "other-saga", SagaModuleOracle.version, SagaModuleOracle.digest)
    throwsMessage(StockTransferSagaModule.succeededCompletionEvent(identity, host.argsValue,
      host)) == "completion identity mismatch"
  }

  property("negative: completion fails closed on definition version drift") = secure {
    val host = new ProbeHost(codec(), settings())
    val identity = completionIdentity("tx-drift", SagaModuleOracle.name, 9, SagaModuleOracle.digest)
    throwsMessage(StockTransferSagaModule.succeededCompletionEvent(identity, host.argsValue,
      host)) == "completion identity mismatch"
  }

  property("negative: completion fails closed on definition digest drift") = secure {
    val host = new ProbeHost(codec(), settings())
    val identity = completionIdentity("tx-drift", SagaModuleOracle.name, SagaModuleOracle.version, "sha256:deadbeef")
    throwsMessage(StockTransferSagaModule.succeededCompletionEvent(identity, host.argsValue,
      host)) == "completion identity mismatch"
  }

  property("negative: completion fails closed on completion binding contract drift") = secure {
    val host = new ProbeHost(codec(), settings())
    host.succeededCompletion.armedContract =
      StockTransferSagaModule.succeededCompletionContract.copy(aggregate = "drifted")
    val identity = moduleIdentity("tx-drift")
    throwsMessage(StockTransferSagaModule.succeededCompletionEvent(identity, host.argsValue,
      host)) == "completion binding mismatch"
  }

  property("behavior assembles a coordinator behavior for pinned settings") = secure {
    val host = new ProbeHost(codec(), settings())
    val behavior = StockTransferSagaModule.behavior(
      akka.persistence.typed.PersistenceId.ofUniqueId("behavior-probe"), host,
      new ProbeAuthorizer)(ec)
    behavior != null && host.namespaceChecks.recorded
      .contains("behavior-probe")
  }

  property("negative: behavior fails closed on coordinator timeout pin mismatch") = secure {
    val host = new ProbeHost(codec(), StrictSagaCoordinator.Settings(2.seconds, 32))
    throwsMessage(StockTransferSagaModule.behavior(
      akka.persistence.typed.PersistenceId.ofUniqueId("timeout-probe"), host,
      new ProbeAuthorizer)(ec)) == "coordinator timeout pin mismatch"
  }

  property("negative: behavior fails closed on null persistence id or authorizer") = secure {
    val host = new ProbeHost(codec(), settings())
    val authorizer = new ProbeAuthorizer
    val pid = akka.persistence.typed.PersistenceId.ofUniqueId("null-probe")
    throwsMessage(StockTransferSagaModule.behavior(null, host, authorizer)(ec)) ==
      "explicit persistence id and authorizer required" &&
      throwsMessage(StockTransferSagaModule.behavior(pid, host, null)(ec)) ==
      "explicit persistence id and authorizer required"
  }

  property("coordinator completes the serial transfer through both prepare receipts") = secure {
    val (host, _, ref) = coordinator()
    val opened = SagaModuleFixture.start(ref, host, "tx-success")
    val state = SagaModuleFixture.awaitStable(ref, 8.seconds)
    val prepareTwoInput = StockTransferSagaModule.CommitTargetStockPrepareInput("tx-success",
      warehouseTwo, "SKU-100", defaultQuantity, reservationOne)
    val identity = state.identity.get
    startOpenedAsPreparing(opened) &&
      successStateMatches(state) &&
      identityMatches(identity) &&
      descriptorPinsMatch(state) &&
      interactionLogMatches(host, prepareTwoInput)
  }

  private def startOpenedAsPreparing(reply: StrictSagaCoordinator.Reply): Boolean = reply match {
    case StrictSagaCoordinator.Status(initial) => initial.status == StrictStatus.Preparing
    case _ => false
  }

  private def successStateMatches(state: StrictState): Boolean =
    state.status == StrictStatus.Succeeded && state.commitDecision && state.evidence.size == 4

  private def identityMatches(identity: TransactionIdentity): Boolean =
    identity.definitionName == SagaModuleOracle.name &&
      identity.definitionVersion == SagaModuleOracle.version &&
      identity.definitionDigest == SagaModuleOracle.digest &&
      identity.argsCodec == SagaModuleOracle.argsPin

  private def descriptorPinsMatch(state: StrictState): Boolean =
    state.participants.head.receiptCodec(Phase.Prepare) == prepareOnePin &&
      state.participants.last.receiptCodec(Phase.Prepare) == prepareTwoPin

  private def interactionLogMatches(host: ProbeHost,
      prepareTwoInput: StockTransferSagaModule.CommitTargetStockPrepareInput): Boolean =
    Vector(host.reserveSourceStockPrepareBinding.executions.size,
      host.commitTargetStockPrepareBinding.executions.size,
      host.reserveSourceStockCommitBinding.executions.size,
      host.commitTargetStockCommitBinding.executions.size) == Vector(1, 1, 1, 1) &&
      host.commitTargetStockPrepareBinding.executions.recorded.head._2 == prepareTwoInput

  property("coordinator aborts and compensates the confirmed reservation") = secure {
    val (host, _, ref) = coordinator()
    host.commitTargetStockPrepareBinding.armedExecute = identity =>
      Future.successful(NotExecuted(identity, "absent-2", true))
    SagaModuleFixture.start(ref, host, "tx-abort")
    val state = SagaModuleFixture.awaitStable(ref, 8.seconds)
    state.status == StrictStatus.Aborted &&
      !state.commitDecision &&
      Vector(host.reserveSourceStockPrepareBinding.executions.size,
        host.commitTargetStockPrepareBinding.executions.size,
        host.reserveSourceStockCompensateBinding.executions.size) == Vector(1, 1, 1) &&
      host.reserveSourceStockCompensateBinding.executions.recorded.head._2 ==
        StockTransferSagaModule.ReserveSourceStockCompensateInput(reservationOne)
  }

  property("coordinator requires authorized reconciliation after an unknown outcome") = secure {
    val (host, authorizer, ref) = coordinator()
    host.commitTargetStockPrepareBinding.armedExecute = identity => Future.successful(Unknown(identity, "unknown-2"))
    SagaModuleFixture.start(ref, host, "tx-reconcile")
    val unstable = SagaModuleFixture.awaitStable(ref, 8.seconds)
    host.commitTargetStockPrepareBinding.armedQuery = identity =>
      Future.successful(ConfirmedReceipt(identity,
        StockTransferSagaModule.CommitTargetStockPrepareReceipt(orderTwo, defaultQuantity)))
    val authorized = SagaModuleFixture.askReply(ref)(
      StrictSagaCoordinator.Reconcile(unstable.identity.get, "reconcile-token", 10, _))
    val resumed = SagaModuleFixture.awaitStable(ref, 8.seconds)
    unstable.status == StrictStatus.RecoveryRequired &&
      authorized.isInstanceOf[StrictSagaCoordinator.Status] &&
      resumed.status == StrictStatus.Succeeded &&
      host.commitTargetStockPrepareBinding.queries.size == 1 &&
      authorizer.asked.recorded == Vector("reconcile-token")
  }

  property("negative: reconciliation without authorization or budget is denied") = secure {
    val (host, authorizer, ref) = coordinator()
    host.commitTargetStockPrepareBinding.armedExecute = identity => Future.successful(Unknown(identity, "unknown-2"))
    SagaModuleFixture.start(ref, host, "tx-denied")
    val unstable = SagaModuleFixture.awaitStable(ref, 8.seconds)
    authorizer.deniedReason = Some("not authorized")
    val denied = SagaModuleFixture.askReply(ref)(
      StrictSagaCoordinator.Reconcile(unstable.identity.get, "token", 10, _))
    val overBudget = SagaModuleFixture.askReply(ref)(
      StrictSagaCoordinator.Reconcile(unstable.identity.get, "token", 40, _))
    authorizer.deniedReason = None
    authorizer.throwOnAuthorize = true
    val unverified = SagaModuleFixture.askReply(ref)(
      StrictSagaCoordinator.Reconcile(unstable.identity.get, "token", 10, _))
    authorizer.throwOnAuthorize = false
    denied == StrictSagaCoordinator.Denied("not authorized") &&
      overBudget == StrictSagaCoordinator.Denied(
        "invalid reconciliation interaction budget") &&
      unverified == StrictSagaCoordinator.Denied("reconciliation authorization failed") &&
      SagaModuleFixture.stateOf(ref).status == StrictStatus.RecoveryRequired
  }

  property("negative: a hanging interaction folds into recovery after the pinned timeout") =
    secure {
      val (host, _, ref) = coordinator()
      host.commitTargetStockPrepareBinding.armedExecute = _ => Future.never
      SagaModuleFixture.start(ref, host, "tx-timeout")
      val state = SagaModuleFixture.awaitStable(ref, 8.seconds)
      state.status == StrictStatus.RecoveryRequired &&
        state.pending.isEmpty &&
        state.evidence.exists { case (_, proof) => proof.toString.contains("timed out") }
    }

  property("negative: a receipt codec swap is fenced during the interaction") = secure {
    val (host, _, ref) = coordinator()
    host.reserveSourceStockPrepareBinding.armedExecute = identity => {
      host.reserveSourceStockPrepareBinding.armedCodec = ProbeReceipts.reserveSourceStockPrepareAlt
      Future.successful(ConfirmedReceipt(identity,
        StockTransferSagaModule.ReserveSourceStockPrepareReceipt(reservationOne,
          defaultQuantity)))
    }
    SagaModuleFixture.start(ref, host, "tx-swap")
    val state = SagaModuleFixture.awaitStable(ref, 8.seconds)
    state.status == StrictStatus.RecoveryRequired &&
      state.evidence.exists { case (_, proof) =>
        proof.toString.contains("host receipt codec replacement")
      }
  }

  property("negative: a binding contract drift is fenced during the interaction") = secure {
    val (host, _, ref) = coordinator()
    host.reserveSourceStockPrepareBinding.armedExecute = identity => {
      host.reserveSourceStockPrepareBinding.armedContract =
        StockTransferSagaModule.reserveSourceStockPrepareBindingContract.copy(step = "drifted")
      Future.successful(ConfirmedReceipt(identity,
        StockTransferSagaModule.ReserveSourceStockPrepareReceipt(reservationOne,
          defaultQuantity)))
    }
    SagaModuleFixture.start(ref, host, "tx-contract")
    val state = SagaModuleFixture.awaitStable(ref, 8.seconds)
    state.status == StrictStatus.RecoveryRequired &&
      state.evidence.exists { case (_, proof) =>
        proof.toString.contains("technical phase binding drift")
      }
  }

  property("coordinator start is idempotent for identical input and conflicting otherwise") =
    secure {
      val (host, _, ref) = coordinator()
      val bytes = host.argsCodec.encode(host.argsValue)
      val first = SagaModuleFixture.askReply(ref)(
        StrictSagaCoordinator.Start("tx-idempotent", bytes, _))
      val same = SagaModuleFixture.askReply(ref)(
        StrictSagaCoordinator.Start("tx-idempotent", bytes, _))
      val conflicting = SagaModuleFixture.askReply(ref)(
        StrictSagaCoordinator.Start("tx-idempotent", host.argsCodec.encode(
          host.argsValue.copy(sku = "SKU-200")), _))
      first.isInstanceOf[StrictSagaCoordinator.Status] &&
        same.isInstanceOf[StrictSagaCoordinator.Status] &&
        conflicting == StrictSagaCoordinator.ConflictingIdentity
    }
}
