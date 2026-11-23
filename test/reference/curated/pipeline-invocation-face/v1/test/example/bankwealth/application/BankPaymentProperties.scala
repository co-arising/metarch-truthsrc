package example.bankwealth.application

import scala.concurrent.{Await, ExecutionContext}
import scala.concurrent.duration._
import scala.util.Try

import org.scalacheck.Properties
import org.scalacheck.Prop.forAll
import org.scalacheck.Prop.secure

import com.google.protobuf.ByteString

import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.executionproto.bankcashpaymentv1ExecutionStatePB
import net.imadz.infra.saga.strict._

import akka.actor.typed.ActorRef

/** 行为性质（真实提交源面，Support 层）：全链真实 strict 协调器＋persistence-testkit
  * journal＋探针技术端口。成功轮证明 Invoke→admission→Start→三参与方 prepare/commit
  * →权威观察→两段式交付→回执的完整通路；abort/reconcile 轮证明补偿与恢复语义；
  * 其余判例钉幂等（R2）、身份围栏、回执 wire 集、退避有界（R1）、codec 失闭。 */
object BankPaymentProperties extends Properties("pipeline-invocation-face.behavior.v1") {
  import BankPaymentOracle._
  import BankPaymentProbe._
  import BankPaymentFixture._

  implicit private val ec: ExecutionContext = ExecutionContext.global

  private def throwsMessage(thunk: => Any): String = {
    try {
      thunk
      "<no-throw>"
    } catch { case ex: Throwable =>
      Option(ex.getMessage).getOrElse("<null-message>").stripPrefix("requirement failed: ")
    }
  }

  private def pidOf(state: BankCashPaymentExecution.State): String = BankPaymentHost.operationIdentity(state)

  private def withRound[A](body: (BankPaymentProbe, ActorRef[StrictSagaCoordinator.Command], ActorRef[BankPaymentHost.Request]) => A): A = {
    val probe = new BankPaymentProbe
    val coordinator = spawnCoordinator(probe)
    val host = spawnHost(probe, coordinator)
    try body(probe, coordinator, host)
    finally resetJournal()
  }

  // ---- identity -------------------------------------------------------------

  property("identity: the durable operation identity keys on the caller operation and occurrence") = forAll(genState) { state =>
    val once = BankPaymentHost.operationIdentity(state)
    once == BankPaymentOracle.operationIdentity(state) &&
      once == BankPaymentHost.operationIdentity(state.copy(paymentTxid = Some(TxId("x")))) &&
      once == BankPaymentHost.operationIdentity(
        state.copy(inputs = state.inputs.copy(amount = Money(state.inputs.amount.amount + 1, "CNY")))) &&
      once.startsWith("sha256:") && once.length == "sha256:".length + 64 &&
      once != BankPaymentHost.operationIdentity(
        state.copy(inputs = state.inputs.copy(occurrence = OperationId("other-occurrence")))) &&
      once != BankPaymentHost.operationIdentity(
        state.copy(inputs = state.inputs.copy(operation = OperationId("other"))))
  }

  // ---- full success round ---------------------------------------------------

  property("state: the payment completes through prepare, commit and receipt delivery") = secure {
    withRound { (probe, coordinator, host) =>
      val state = genState.sample.get
      val reply = settledReply(host, state)
      val stable = awaitTerminal(coordinator, 8.seconds)
      val expected = BankPaymentHost.Completed(BankCashPaymentExecution.PayCashPurchaseSucceeded(TxId(pidOf(state))))
      reply == expected && stable.status == StrictStatus.Succeeded &&
        askHost(host, state) == expected &&
        probe.authorityCalls.size == 1 && probe.deliveryCalls.size == 1 &&
        probe.phaseCalls.snapshot == Vector(
          "reserveInvestorFundsPrepare.execute", "creditFundCollectionPrepare.execute",
          "reserveCashFundOrderPrepare.execute", "reserveInvestorFundsCommit.execute",
          "creditFundCollectionCommit.execute", "reserveCashFundOrderCommit.execute")
    }
  }

  // ---- idempotency and conflict (R2) ----------------------------------------

  property("negative: a different input under the same operation is a Conflict; the same input re-answers from durable state") = secure {
    withRound { (probe, coordinator, host) =>
      probe.prepareUnknown = true
      val state = genState.sample.get
      val first = settledReply(host, state)
      val conflicting = askHost(host, state.copy(inputs = state.inputs.copy(amount = Money(state.inputs.amount.amount + 1, "CNY"))))
      probe.prepareUnknown = false
      val repeat = settledReply(host, state)
      (first == BankPaymentHost.Pending("outcome-unknown") ||
        first == BankPaymentHost.Pending("recovery-required")) &&
        conflicting.isInstanceOf[BankPaymentHost.Conflict] &&
        repeat == first
    }
  }

  property("state: a completed payment answers identically from durable state with no new facts") = secure {
    withRound { (probe, coordinator, host) =>
      val state = genState.sample.get
      val done = settledReply(host, state)
      val expected = BankPaymentHost.Completed(BankCashPaymentExecution.PayCashPurchaseSucceeded(TxId(pidOf(state))))
      done == expected && askHost(host, state) == expected && askHost(host, state) == expected &&
        probe.authorityCalls.size == 1 && probe.deliveryCalls.size == 1
    }
  }

  // ---- authoritative identity fence -----------------------------------------

  property("negative: authoritative status checks are exact in every slot") = secure {
    val execution = genState.sample.get
    val state = BankPaymentHost.State(original = ByteString.copyFrom(BankCashPaymentExecution.codec.encode(execution)),
      args = argsBytes(execution), operation = pidOf(execution))
    // 正例基座由真实协调器亲授（真实身份槽与 planDigest）；每个槽的判别力由
    // 该槽的受控漂移证明——真状态回答 true、漂移一个槽即 false。
    val valid = authoritativeState(execution)
    val wrongArgs = valid.copy(argsBytes = ByteString.copyFromUtf8("tampered-args"))
    val wrongDefinition = valid.copy(identity = valid.identity.map(_.copy(definitionName = "other-saga")))
    val wrongVersion = valid.copy(identity = valid.identity.map(_.copy(definitionVersion = 9)))
    val wrongDigest = valid.copy(identity = valid.identity.map(_.copy(definitionDigest = "sha256:deadbeef")))
    val wrongPin = valid.copy(identity = valid.identity.map(_.copy(argsCodec = CodecPin("drift", 1))))
    val wrongArgsDigest = valid.copy(identity = valid.identity.map(_.copy(argsDigest = "cafebabe")))
    val wrongTransaction = valid.copy(identity = valid.identity.map(_.copy(transactionId = "other-operation")))
    BankPaymentHost.validStatus(state, valid) &&
      !BankPaymentHost.validStatus(state, wrongArgs) &&
      !BankPaymentHost.validStatus(state, wrongDefinition) &&
      !BankPaymentHost.validStatus(state, wrongVersion) &&
      !BankPaymentHost.validStatus(state, wrongDigest) &&
      !BankPaymentHost.validStatus(state, wrongPin) &&
      !BankPaymentHost.validStatus(state, wrongArgsDigest) &&
      !BankPaymentHost.validStatus(state, wrongTransaction)
  }

  // ---- result kinds ----------------------------------------------------------

  property("state: foreign result wires answer None") = forAll(genForeignWire) { wire =>
    BankPaymentHost.ResultKind.fromWire(wire).isEmpty
  }

  property("state: result kinds answer exactly the declared wire set") = forAll(genResultKind) { kind =>
    BankPaymentHost.ResultKind.fromWire(kind.wire) == Some(kind) &&
      BankPaymentHost.ResultKind.all.map(_.wire) == ResultWires &&
      BankPaymentHost.ResultKind.terminal.map(_.wire) == TerminalWires &&
      ResultWires.forall(wire => BankPaymentHost.ResultKind.fromWire(wire).isDefined)
  }

  property("state: classify folds authoritative statuses into the declared kinds") = secure {
    val state = genState.sample.get
    val prepareIdentity = OperationIdentity(BankPaymentOracle.identity(pidOf(state), argsBytes(state)),
      "investorCreditBalance", state.inputs.investorAccountId.value, "reserve-investor-funds", Phase.Prepare)
    val compensated = BankPaymentOracle.strictState(state, StrictStatus.Aborted,
      Map(prepareIdentity -> Evidence.Confirmed(prepareIdentity, ByteString.EMPTY)))
    val rejected = BankPaymentOracle.strictState(state, StrictStatus.Aborted)
    val uncertainIdentity = prepareIdentity.copy(phase = Phase.Commit)
    val outcomeUnknown = BankPaymentOracle.strictState(state, StrictStatus.RecoveryRequired,
      Map(uncertainIdentity -> Evidence.Uncertain(uncertainIdentity, "dispatched blind")))
    val recoveryRequired = BankPaymentOracle.strictState(state, StrictStatus.RecoveryRequired)
    BankPaymentHost.classify(BankPaymentOracle.strictState(state, StrictStatus.Succeeded)) == Some(BankPaymentHost.ResultKind.Succeeded) &&
      BankPaymentHost.classify(compensated) == Some(BankPaymentHost.ResultKind.Compensated) &&
      BankPaymentHost.classify(rejected) == Some(BankPaymentHost.ResultKind.RejectedBeforeEffects) &&
      BankPaymentHost.classify(outcomeUnknown) == Some(BankPaymentHost.ResultKind.OutcomeUnknown) &&
      BankPaymentHost.classify(recoveryRequired) == Some(BankPaymentHost.ResultKind.RecoveryRequired)
  }

  // ---- abort and recovery rounds ---------------------------------------------

  property("negative: a provably not-executed prepare aborts and compensates the payment") = secure {
    withRound { (probe, coordinator, host) =>
      probe.prepareNotExecuted = true
      val state = genState.sample.get
      val reply = settledReply(host, state)
      val stable = awaitTerminal(coordinator, 8.seconds)
      // Serial prepare: the provably-absent participant stops the plan, so
      // only the confirmed prepare carries evidence and gets compensated.
      reply == BankPaymentHost.Completed(BankCashPaymentExecution.PayCashPurchaseCompensated) &&
        stable.status == StrictStatus.Aborted &&
        probe.authorityCalls.snapshot == Vector("compensated") &&
        probe.phaseCalls.snapshot.contains("reserveInvestorFundsCompensate.execute") &&
        !probe.phaseCalls.snapshot.contains("creditFundCollectionCompensate.execute") &&
        !probe.phaseCalls.snapshot.contains("reserveCashFundOrderCompensate.execute")
    }
  }

  property("negative: an unknown prepare folds into recovery and reconciliation completes the payment") = secure {
    withRound { (probe, coordinator, host) =>
      probe.prepareUnknown = true
      val state = genState.sample.get
      val unstableReply = settledReply(host, state)
      val unstable = awaitTerminal(coordinator, 8.seconds)
      probe.prepareUnknown = false
      val verdict = reconcile(coordinator, unstable.identity.get)
      val stable = awaitTerminal(coordinator, 8.seconds)
      val resumed = askHost(host, state)
      (unstableReply == BankPaymentHost.Pending("recovery-required") ||
        unstableReply == BankPaymentHost.Pending("outcome-unknown")) &&
        unstable.status == StrictStatus.RecoveryRequired &&
        verdict.isInstanceOf[StrictSagaCoordinator.Status] &&
        stable.status == StrictStatus.Succeeded &&
        resumed == BankPaymentHost.Completed(BankCashPaymentExecution.PayCashPurchaseSucceeded(TxId(pidOf(state))))
    }
  }

  // ---- admission gate ---------------------------------------------------------

  property("negative: an entry denial answers Pending and never starts the saga") = secure {
    withRound { (probe, coordinator, host) =>
      probe.entryAllowed = false
      val state = genState.sample.get
      val reply = askHost(host, state)
      Thread.sleep(200)
      reply == BankPaymentHost.Pending("entry or association not admitted") &&
        coordinatorStatus(coordinator).status == StrictStatus.Empty &&
        probe.entryCalls.size == 1 && probe.associationCalls.snapshot.isEmpty
    }
  }

  property("negative: an admission implementation failure answers unavailable, never a denial") = secure {
    withRound { (probe, coordinator, host) =>
      probe.entryFailure = Some("entry gate offline")
      val state = genState.sample.get
      val reply = askHost(host, state)
      reply == BankPaymentHost.Pending("admission unavailable: entry gate offline") &&
        coordinatorStatus(coordinator).status == StrictStatus.Empty
    }
  }

  // ---- two-phase delivery ------------------------------------------------------

  property("negative: a delivery that fails the two-phase authority stays unacknowledged") = secure {
    withRound { (probe, coordinator, host) =>
      val state = genState.sample.get
      probe.authorityResult = Some(BankPaymentResult(TxId("tampered")))
      val reply = settledReply(host, state)
      val stable = awaitTerminal(coordinator, 8.seconds)
      val stillUnacknowledged = askHost(host, state).isInstanceOf[BankPaymentHost.Pending] &&
        probe.authorityCalls.size == 2 && probe.deliveryCalls.size == 0
      probe.authorityResult = None
      val afterUnarm = settledReply(host, state)
      reply == BankPaymentHost.Pending("delivery unacknowledged") &&
        stable.status == StrictStatus.Succeeded &&
        stillUnacknowledged &&
        afterUnarm == BankPaymentHost.Completed(BankCashPaymentExecution.PayCashPurchaseSucceeded(TxId(pidOf(state))))
    }
  }

  property("negative: a delivery implementation failure folds into delivery unacknowledged") = secure {
    withRound { (probe, coordinator, host) =>
      probe.deliveryFailure = true
      val state = genState.sample.get
      val reply = settledReply(host, state)
      reply == BankPaymentHost.Pending("delivery unacknowledged") &&
        probe.deliveryCalls.snapshot == Vector("succeeded") &&
        probe.authorityCalls.snapshot == Vector("succeeded")
    }
  }

  // ---- hostio composition ------------------------------------------------------

  property("state: admission composes the entry and association gates exactly") = secure {
    val probe = new BankPaymentProbe
    val input = BankPaymentHost.originalInput(genState.sample.get)
    val passed = Await.result(BankPaymentHostIO.admit(input, probe.ports), 3.seconds) &&
      probe.entryCalls.size == 1 && probe.associationCalls.size == 1
    probe.associationAllowed = false
    val associationRefused = !Await.result(BankPaymentHostIO.admit(input, probe.ports), 3.seconds) &&
      probe.entryCalls.size == 2 && probe.associationCalls.size == 2
    probe.entryAllowed = false
    val entryShortCircuits = !Await.result(BankPaymentHostIO.admit(input, probe.ports), 3.seconds) &&
      probe.entryCalls.size == 3 && probe.associationCalls.size == 2
    passed && associationRefused && entryShortCircuits
  }

  property("state: delivery dispatches each kind through its own completion pair") = secure {
    val probe = new BankPaymentProbe
    val execution = genState.sample.get
    val identity = BankPaymentOracle.identity(pidOf(execution), argsBytes(execution))
    val original = BankPaymentHost.originalInput(execution)
    val kinds = Vector(BankPaymentHost.ResultKind.Succeeded, BankPaymentHost.ResultKind.RejectedBeforeEffects,
      BankPaymentHost.ResultKind.Compensated, BankPaymentHost.ResultKind.RecoveryRequired,
      BankPaymentHost.ResultKind.OutcomeUnknown)
    kinds.forall(kind =>
      Try(Await.result(BankPaymentHostIO.deliver(kind, original, identity, probe.ports), 3.seconds)).toOption.contains(true)) &&
      probe.authorityCalls.snapshot == Vector("succeeded", "rejected-before-effects",
        "compensated", "recovery-required", "outcome-unknown") &&
      probe.deliveryCalls.snapshot == Vector("succeeded", "rejected-before-effects",
        "compensated", "recovery-required", "outcome-unknown") &&
      (probe.authorityResult = Some(BankPaymentResult(TxId("mismatch"))),
        Try(Await.result(BankPaymentHostIO.deliver(BankPaymentHost.ResultKind.Succeeded, original,
          identity, probe.ports), 3.seconds)).isFailure)._2
  }

  // ---- bounded backoff (R1) ----------------------------------------------------

  property("negative: the pending poll backoff doubles and stays capped") = forAll(genAttempt) { attempt =>
    val delay = BankCashPaymentExecution.backoffMillis(attempt)
    delay == math.min(5000L, math.round(100L * math.pow(2, attempt.toDouble))) &&
      delay >= 100L && delay <= 5000L &&
      delay <= BankCashPaymentExecution.backoffMillis(attempt + 1) &&
      BankCashPaymentExecution.backoffMillis(60) == 5000L &&
      BankCashPaymentExecution.backoffMillis(0) == 100L
  }

  // ---- codec -------------------------------------------------------------------

  property("state: the plan codec is a fail-closed finite round trip") = forAll(genSettledState) { state =>
    BankCashPaymentExecution.codec.decode(BankCashPaymentExecution.codec.encode(state)) == state &&
      BankCashPaymentExecution.outputs(state) == BankCashPaymentExecution.Outputs(state.paymentTxid.get)
  }

  property("negative: the plan codec refuses foreign versions and missing slots") = secure {
    val state = genState.sample.get
    val parsed = bankcashpaymentv1ExecutionStatePB.parseFrom(BankCashPaymentExecution.codec.encode(state))
    val foreign = parsed.copy(planversion = "bank-v0-9").toByteArray
    val missing = parsed.copy(input2 = None).toByteArray
    throwsMessage(BankCashPaymentExecution.codec.decode(foreign)) == "exact finite plan version required" &&
      throwsMessage(BankCashPaymentExecution.codec.decode(missing)).contains("missing durable input input2") &&
      throwsMessage(BankCashPaymentExecution.outputs(state)) == "unconfirmed predecessor output"
  }
}
