package example.bankwealth.application

import scala.concurrent.duration._

import org.scalacheck.Properties
import org.scalacheck.Prop.forAll
import org.scalacheck.Prop.secure

import com.google.protobuf.ByteString

import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.effectproto.{banksipdispatchEffectHostEventPB, banktaeffectEffectHostEventPB}
import example.bankwealth.infrastructure.executionproto.{banksipdispatchv1ExecutionStatePB, banktasubmissionv1ExecutionStatePB}
import example.bankwealth.infrastructure.serialization.DomainConverters

import akka.actor.typed.ActorRef

/** 行为性质（真实提交源面，Support 层）：persistence-testkit journal＋探针回调。
  * 成功轮证明 Invoke→execute→观测→完成的通路；恢复轮证明授权重试清空观测（R3）、
  * Query 决策在 unknown 证据上重查询、崩溃恢复重查询；其余判例钉幂等（R2）、
  * 观测失闭校验、身份稳定、codec 与 serializer 失闭。 */
object BankEffectProperties extends Properties("effect-face.behavior.v1") {
  import BankEffectOracle._
  import BankEffectFixture._

  private def throwsMessage(thunk: => Any): String = {
    try {
      thunk
      "<no-throw>"
    } catch { case ex: Throwable =>
      Option(ex.getMessage).getOrElse("<null-message>").stripPrefix("requirement failed: ")
    }
  }

  private def withDispatch[A](body: (BankDispatchProbe, ActorRef[BankSipDispatchEffectHost.Request]) => A): A = {
    val probe = new BankDispatchProbe
    val host = spawnDispatch(probe, nextPid("dispatch-effect"))
    try body(probe, host)
    finally resetJournal()
  }

  private def withTa[A](body: (BankTaProbe, ActorRef[BankTaEffectHost.Request]) => A): A = {
    val probe = new BankTaProbe
    val host = spawnTa(probe, nextPid("ta-effect"))
    try body(probe, host)
    finally resetJournal()
  }

  // ---- dispatch：成功轮与幂等 -------------------------------------------------

  property("state: a fresh dispatch host executes once and completes on the confirmed observation") = secure {
    withDispatch { (probe, host) =>
      val state = genDispatchState.sample.get
      val op = BankSipDispatchEffectHost.operationIdentity(state)
      val request = BankSipDispatchEffectHost.request(state)
      val reply = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      val executed = probe.executeCalls.snapshot
      reply == BankSipDispatchEffectHost.Completed(
        BankSipDispatchExecution.DispatchCashDispatched(OperationId(op))) &&
        executed.size == 1 && executed.head == BankSipDispatchOperation(op, request) &&
        probe.queryCalls.snapshot.isEmpty
    }
  }

  property("negative: the same dispatch input re-answers from durable state; a different input conflicts") = secure {
    withDispatch { (probe, host) =>
      val state = genDispatchState.sample.get
      val done = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      val repeat = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      val conflicting = invoke(host, BankSipDispatchEffectHost.Invoke(
        state.copy(inputs = state.inputs.copy(occurrenceId = OccurrenceId("other"))), _))
      done.isInstanceOf[BankSipDispatchEffectHost.Completed] && done == repeat &&
        probe.executeCalls.size == 1 &&
        conflicting == BankSipDispatchEffectHost.Conflict("different complete original input under effect identity")
    }
  }

  property("negative: an unobserved dispatch effect answers Pending without implicit retry") = secure {
    withDispatch { (probe, host) =>
      probe.executeThrows = Some("dispatch offline")
      val state = genDispatchState.sample.get
      val op = BankSipDispatchEffectHost.operationIdentity(state)
      val reply = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      reply == BankSipDispatchEffectHost.Pending("effect outcome remains unknown or absent; no implicit retry") &&
        probe.executeCalls.size == 1 && probe.queryCalls.size == 1
    }
  }

  property("negative: an invalid dispatch observation never lands; the query face re-derives") = secure {
    withDispatch { (probe, host) =>
      val state = genDispatchState.sample.get
      val op = BankSipDispatchEffectHost.operationIdentity(state)
      val request = BankSipDispatchEffectHost.request(state)
      probe.executeObservation = Some(BankSipDispatchObservation(op, request, "sending", "", None))
      probe.queryObservation = Some(dispatchObservation(op, request, "confirmed", "query-receipt"))
      val reply = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      reply == BankSipDispatchEffectHost.Completed(
        BankSipDispatchExecution.DispatchCashDispatched(OperationId(op))) &&
        probe.executeCalls.size == 1 && probe.queryCalls.size == 1
    }
  }

  property("state: rejected and failed dispatch observations fold into their declared stage results") = secure {
    def one(status: String, expected: BankSipDispatchEffectHost.Completed): Boolean = {
      val probe = new BankDispatchProbe
      val host = spawnDispatch(probe, nextPid("dispatch-terminal"))
      val state = genDispatchState.sample.get
      val op = BankSipDispatchEffectHost.operationIdentity(state)
      val request = BankSipDispatchEffectHost.request(state)
      probe.executeObservation = Some(dispatchObservation(op, request, status, "policy"))
      val reply = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      resetJournal()
      reply == expected
    }
    one("rejected", BankSipDispatchEffectHost.Completed(BankSipDispatchExecution.DispatchCashRefused)) &&
      one("failed", BankSipDispatchEffectHost.Completed(BankSipDispatchExecution.DispatchCashUnavailable))
  }

  // ---- dispatch：授权重试（R3）与 Query 决策 -------------------------------------

  property("state: an authorized dispatch retry clears the observation and re-executes") = secure {
    withDispatch { (probe, host) =>
      val state = genDispatchState.sample.get
      val op = BankSipDispatchEffectHost.operationIdentity(state)
      val request = BankSipDispatchEffectHost.request(state)
      val absent = dispatchObservation(op, request, "absent", "no-dispatch-record")
      probe.executeObservation = Some(absent)
      val first = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      probe.executeObservation = None
      val retried = invoke(host, BankSipDispatchEffectHost.Reconcile(state, BankSipDispatchEffectHost.ReconcileDecision.Retry,
        ReconcileToken, _))
      first == BankSipDispatchEffectHost.Pending("effect outcome remains unknown or absent; no implicit retry") &&
        probe.reconcileCalls.snapshot == Vector(
          BankSipDispatchReconcile(op, request, "retry", Some(absent), ReconcileToken)) &&
        probe.executeCalls.size == 2 &&
        retried == BankSipDispatchEffectHost.Completed(
          BankSipDispatchExecution.DispatchCashDispatched(OperationId(op)))
    }
  }

  property("negative: dispatch reconcile demands authorization and durable evidence") = secure {
    withDispatch { (probe, host) =>
      probe.executeThrows = Some("dispatch offline")
      val state = genDispatchState.sample.get
      val first = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      val withoutEvidence = invoke(host, BankSipDispatchEffectHost.Reconcile(state,
        BankSipDispatchEffectHost.ReconcileDecision.Retry, ReconcileToken, _))
      val conflicting = invoke(host, BankSipDispatchEffectHost.Reconcile(
        state.copy(inputs = state.inputs.copy(occurrenceId = OccurrenceId("other"))),
        BankSipDispatchEffectHost.ReconcileDecision.Retry, ReconcileToken, _))
      first.isInstanceOf[BankSipDispatchEffectHost.Pending] &&
        withoutEvidence == BankSipDispatchEffectHost.Pending(
          "reconcile requires authority and durable absent or unknown evidence") &&
        conflicting == BankSipDispatchEffectHost.Conflict(
          "reconcile must retain exact durable original and operation") &&
        probe.reconcileCalls.snapshot.isEmpty
    }
  }

  property("negative: a denied dispatch retry keeps the observation and never re-executes") = secure {
    withDispatch { (probe, host) =>
      val state = genDispatchState.sample.get
      val op = BankSipDispatchEffectHost.operationIdentity(state)
      val request = BankSipDispatchEffectHost.request(state)
      probe.executeObservation = Some(dispatchObservation(op, request, "absent", "no-dispatch-record"))
      invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      probe.reconcileAllowed = false
      val denied = invoke(host, BankSipDispatchEffectHost.Reconcile(state,
        BankSipDispatchEffectHost.ReconcileDecision.Retry, ReconcileToken, _))
      denied == BankSipDispatchEffectHost.Pending("reconciliation not authorized") &&
        probe.executeCalls.size == 1
    }
  }

  property("state: an authorized dispatch query re-derives an unknown observation without re-executing") = secure {
    withDispatch { (probe, host) =>
      val state = genDispatchState.sample.get
      val op = BankSipDispatchEffectHost.operationIdentity(state)
      val request = BankSipDispatchEffectHost.request(state)
      val unknown = dispatchObservation(op, request, "unknown", "ambiguous-tail")
      probe.executeObservation = Some(unknown)
      val first = invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
      probe.queryObservation = Some(dispatchObservation(op, request, "confirmed", "query-receipt"))
      val queried = invoke(host, BankSipDispatchEffectHost.Reconcile(state,
        BankSipDispatchEffectHost.ReconcileDecision.Query, ReconcileToken, _))
      first == BankSipDispatchEffectHost.Pending("effect outcome remains unknown or absent; no implicit retry") &&
        probe.reconcileCalls.snapshot == Vector(
          BankSipDispatchReconcile(op, request, "query", Some(unknown), ReconcileToken)) &&
        probe.executeCalls.size == 1 && probe.queryCalls.size == 2 &&
        queried == BankSipDispatchEffectHost.Completed(
          BankSipDispatchExecution.DispatchCashDispatched(OperationId(op)))
    }
  }

  // ---- dispatch：崩溃恢复重查询 ---------------------------------------------------

  property("state: recovery re-queries an unobserved dispatch effect") = secure {
    val probe = new BankDispatchProbe
    val pid = nextPid("dispatch-recovery")
    val host = spawnDispatch(probe, pid)
    probe.executeThrows = Some("dispatch offline")
    val state = genDispatchState.sample.get
    invoke(host, BankSipDispatchEffectHost.Invoke(state, _))
    val firstQueries = probe.queryCalls.size
    testKit.stop(host)
    val revived = spawnDispatch(probe, pid)
    val recovered = awaitProbe(probe.queryCalls, firstQueries + 1, 8.seconds) &&
      probe.queryCalls.size == firstQueries + 1 && probe.executeCalls.size == 1
    resetJournal()
    firstQueries == 1 && recovered
  }

  // ---- ta：同一形状的两判例 ------------------------------------------------------

  property("state: the ta effect host completes on the confirmed observation") = secure {
    withTa { (probe, host) =>
      val state = genTaState.sample.get
      val op = BankTaEffectHost.operationIdentity(state)
      val reply = invoke(host, BankTaEffectHost.Invoke(state, _))
      probe.executeCalls.snapshot.head == BankTaEffectOperation(op, BankTaEffectHost.request(state)) &&
        reply == BankTaEffectHost.Completed(BankTaSubmissionExecution.SubmitTaObserved(TaRequestId(op))) &&
        probe.queryCalls.snapshot.isEmpty
    }
  }

  property("state: an authorized ta retry re-executes from durable absent evidence") = secure {
    withTa { (probe, host) =>
      val state = genTaState.sample.get
      val op = BankTaEffectHost.operationIdentity(state)
      val request = BankTaEffectHost.request(state)
      val absent = taObservation(op, request, "absent", "no-ta-record")
      probe.executeObservation = Some(absent)
      invoke(host, BankTaEffectHost.Invoke(state, _))
      probe.executeObservation = None
      val retried = invoke(host, BankTaEffectHost.Reconcile(state,
        BankTaEffectHost.ReconcileDecision.Retry, ReconcileToken, _))
      probe.reconcileCalls.snapshot == Vector(
        BankTaEffectReconcile(op, request, "retry", Some(absent), ReconcileToken)) &&
        probe.executeCalls.size == 2 &&
        retried == BankTaEffectHost.Completed(BankTaSubmissionExecution.SubmitTaObserved(TaRequestId(op)))
    }
  }

  // ---- 纯函数面 ----------------------------------------------------------------

  property("identity: the dispatch effect identity is stable and occurrence-sensitive") = forAll(genDispatchState) { state =>
    val once = BankSipDispatchEffectHost.operationIdentity(state)
    once == BankSipDispatchEffectHost.operationIdentity(state.copy(operationId = Some(OperationId("x")))) &&
      once.length == 64 && once != BankSipDispatchEffectHost.operationIdentity(
        state.copy(inputs = state.inputs.copy(occurrenceId = OccurrenceId("other"))))
  }

  property("state: foreign status and decision wires answer None") = forAll(genForeignStatus) { wire =>
    BankSipDispatchEffectHost.ObservationStatus.fromWire(wire).isEmpty &&
      BankTaEffectHost.ObservationStatus.fromWire(wire).isEmpty
  }

  property("state: foreign reconcile decision wires answer None") = forAll(genForeignDecision) { wire =>
    BankSipDispatchEffectHost.ReconcileDecision.fromWire(wire).isEmpty &&
      BankTaEffectHost.ReconcileDecision.fromWire(wire).isEmpty
  }

  property("state: status and decision wire sets are the declared sets") = secure {
    StatusWires.forall { wire =>
      BankSipDispatchEffectHost.ObservationStatus.fromWire(wire).isDefined &&
        BankTaEffectHost.ObservationStatus.fromWire(wire).isDefined
    } && DecisionWires.forall { wire =>
      BankSipDispatchEffectHost.ReconcileDecision.fromWire(wire).isDefined &&
        BankTaEffectHost.ReconcileDecision.fromWire(wire).isDefined
    } && BankSipDispatchEffectHost.ObservationStatus.all.map(_.wire) == StatusWires &&
      BankTaEffectHost.ObservationStatus.all.map(_.wire) == StatusWires &&
      BankSipDispatchEffectHost.ReconcileDecision.fromWire("query").isDefined &&
      BankSipDispatchEffectHost.ReconcileDecision.fromWire("retry").isDefined &&
      BankTaEffectHost.ReconcileDecision.fromWire("query").isDefined &&
      BankTaEffectHost.ReconcileDecision.fromWire("retry").isDefined
  }

  property("state: both plan codecs are fail-closed finite round trips") = forAll(genSettledDispatch) { dispatch =>
    BankSipDispatchExecution.codec.decode(BankSipDispatchExecution.codec.encode(dispatch)) == dispatch &&
      BankSipDispatchExecution.outputs(dispatch) == BankSipDispatchExecution.Outputs(dispatch.operationId.get)
  }

  property("state: the ta plan codec is a fail-closed finite round trip") = forAll(genTaState) { ta =>
    val settled = ta.copy(taRequestId = Some(TaRequestId("ta-settled")))
    BankTaSubmissionExecution.codec.decode(BankTaSubmissionExecution.codec.encode(settled)) == settled &&
      BankTaSubmissionExecution.outputs(settled) == BankTaSubmissionExecution.Outputs(TaRequestId("ta-settled"))
  }

  property("negative: the plan codecs refuse foreign versions and missing slots") = secure {
    val dispatch = genDispatchState.sample.get
    val dispatchParsed = banksipdispatchv1ExecutionStatePB.parseFrom(BankSipDispatchExecution.codec.encode(dispatch))
    val ta = genTaState.sample.get
    val taParsed = banktasubmissionv1ExecutionStatePB.parseFrom(BankTaSubmissionExecution.codec.encode(ta))
    throwsMessage(BankSipDispatchExecution.codec.decode(dispatchParsed.copy(planversion = "x").toByteArray)) == "exact finite plan version required" &&
      throwsMessage(BankSipDispatchExecution.codec.decode(dispatchParsed.copy(input0 = None).toByteArray)).contains("missing durable input") &&
      throwsMessage(BankTaSubmissionExecution.codec.decode(taParsed.copy(input1 = None).toByteArray)).contains("missing durable input") &&
      throwsMessage(BankSipDispatchExecution.outputs(dispatch)) == "unconfirmed predecessor output" &&
      throwsMessage(BankTaSubmissionExecution.outputs(ta)) == "unconfirmed predecessor output"
  }

  property("negative: effect bindings fail closed at construction and at install") = secure {
    val dispatch = new BankDispatchProbe
    val ta = new BankTaProbe
    val nullRun = throwsMessage(BankSipDispatchEffectHost.EffectBinding[String, Int]("bankwealth.X", Version, null))
    val wrongId = throwsMessage(BankSipDispatchEffectHost.install(
      dispatch.bindings.copy(execute = dispatch.bindings.execute.copy(id = "bankwealth.Drift"))))
    val wrongVersion = throwsMessage(BankTaEffectHost.install(
      ta.bindings.copy(query = ta.bindings.query.copy(version = "bank-v9-9"))))
    nullRun.contains("carries no run face") &&
      wrongId.contains("effect implementation identity mismatch") &&
      wrongVersion.contains("effect implementation version mismatch") &&
      BankSipDispatchEffectHost.bindingOwnership(dispatch.bindings) == Vector(
        ("bankwealth.BankSipDispatchExecute", "execute", "BankSipTechnical", Version, "handwritten-composition-root"),
        ("bankwealth.BankSipDispatchQuery", "query", "BankSipTechnical", Version, "handwritten-composition-root"),
        ("bankwealth.BankSipDispatchReconcilePort", "reconcile", "BankSipTechnical", Version, "handwritten-composition-root")) &&
      BankTaEffectHost.bindingOwnership(ta.bindings) == Vector(
        ("bankwealth.BankTaEffectExecute", "execute", "BankTaTechnical", Version, "handwritten-composition-root"),
        ("bankwealth.BankTaEffectQuery", "query", "BankTaTechnical", Version, "handwritten-composition-root"),
        ("bankwealth.BankTaEffectReconcilePort", "reconcile", "BankTaTechnical", Version, "handwritten-composition-root"))
  }

  // ---- serializer 双面 ----------------------------------------------------------

  property("negative: the dispatch serializer refuses foreign kinds and manifests") = secure {
    val serializer = new BankSipDispatchEffectHostSerializer
    val original = ByteString.copyFromUtf8("original-bytes")
    val intent = BankSipDispatchEffectHost.Intent(original, "op-1")
    val observation = BankSipDispatchEffectHost.ObservationStored(original)
    val retry = BankSipDispatchEffectHost.RetryAuthorized("token", original)
    val foreign = banksipdispatchEffectHostEventPB(version = "effect-event-v1", kind = "nope").toByteArray
    serializer.identifier == 744000 &&
      serializer.manifest(intent) == "effect-event-v1" &&
      serializer.fromBinary(serializer.toBinary(intent), "effect-event-v1") == intent &&
      serializer.fromBinary(serializer.toBinary(observation), "effect-event-v1") == observation &&
      serializer.fromBinary(serializer.toBinary(retry), "effect-event-v1") == retry &&
      throwsMessage(serializer.fromBinary(foreign, "effect-event-v1")).contains("unknown effect event kind") &&
      throwsMessage(serializer.fromBinary(serializer.toBinary(intent), "effect-event-v0")).nonEmpty &&
      throwsMessage(serializer.toBinary("not-an-event")).contains("effect host event required")
  }

  property("negative: the ta serializer refuses foreign kinds and manifests") = secure {
    val serializer = new BankTaEffectHostSerializer
    val original = ByteString.copyFromUtf8("ta-original")
    val intent = BankTaEffectHost.Intent(original, "ta-op")
    val observation = BankTaEffectHost.ObservationStored(original)
    val retry = BankTaEffectHost.RetryAuthorized("token", original)
    val foreign = banktaeffectEffectHostEventPB(version = "effect-event-v1", kind = "nope").toByteArray
    serializer.identifier == 744001 &&
      serializer.manifest(intent) == "effect-event-v1" &&
      serializer.fromBinary(serializer.toBinary(intent), "effect-event-v1") == intent &&
      serializer.fromBinary(serializer.toBinary(observation), "effect-event-v1") == observation &&
      serializer.fromBinary(serializer.toBinary(retry), "effect-event-v1") == retry &&
      throwsMessage(serializer.fromBinary(foreign, "effect-event-v1")).contains("unknown effect event kind") &&
      throwsMessage(serializer.fromBinary(serializer.toBinary(intent), "event-v1")).nonEmpty &&
      throwsMessage(serializer.toBinary(Integer.valueOf(42))).contains("effect host event required")
  }
}
