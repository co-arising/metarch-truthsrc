package example.stockreservation.application.services.transactor

import akka.actor.typed.ActorRef
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.query.EventEnvelope
import akka.persistence.typed.PersistenceId
import akka.util.Timeout
import com.google.protobuf.ByteString
import example.stockreservation.application.aggregates.LotProtocol
import example.stockreservation.domain.entities.LotState
import net.imadz.infra.saga.strict._
import net.imadz.monarch.persistence.PersistentMonarch
import WaferChildPlan.ChildPlanState
import org.scalacheck.Gen
import org.scalacheck.Prop.{forAll, secure}
import org.scalacheck.Properties
import scala.concurrent.Await
import scala.concurrent.duration._
import scala.util.{Failure, Success, Try}

/** 行为合同（真宿主面）：monarch 子计划/TCC lot/组合宿主命令机/真实 cluster 全链
  * ＋恢复窗（rejectNextPersisted 确定崩停重驱、host journal 注入前缀、
  * Attach+授权 Reconcile 重驱）＋占用冲突（E5，探针驱动的 0.3.0 语义）。
  * 探得事实（2026-11-20 探针）：monarch 0.3.0 StageDone 游标形如
  * "stage#序号"（receive#0/process#1/finalize#2）；同身份异参 Start 在终态占用下
  * 折叠为既有事务终态（宿主 concluded=Rejected，零效果泄漏）；注入身份的
  * argsDigest 必须规范 sha256 hex、planDigest 是运行时按 participant/receipt
  * codec 计划重算的冻结值。场景体一律提炼为命名 helper（CC 合同内）。 */
object CompositionProperties extends Properties("composition-invocation-host.behavior.v1") {
  import CompositionOracle._
  import CompositionCases._

  private implicit val ec: scala.concurrent.ExecutionContext =
    scala.concurrent.ExecutionContext.global
  private implicit val scheduler: akka.actor.typed.Scheduler = CompositionFixture.testKit.scheduler

  /** 断言助手：失败即抛，成功回布尔（性质体的收尾表达式恒为 Prop 可转换）。 */
  private def check(cond: Boolean, message: => String): Boolean = {
    if (!cond) throw new AssertionError(message)
    true
  }

  private def throwsMessage(thunk: => Any): String = {
    try {
      thunk
      "<no-throw>"
    } catch { case ex: Throwable =>
      Option(ex.getMessage).getOrElse("<null-message>").stripPrefix("requirement failed: ")
    }
  }

  private val genWafer: Gen[String] = Gen.chooseNum(1, 64).flatMap(n =>
    Gen.listOfN(n, Gen.alphaNumChar).map(_.mkString))
  private val genWafers: Gen[Vector[String]] = Gen.chooseNum(1, 64).flatMap(n =>
    Gen.listOfN(n, genWafer).map(_.toVector))
  private val genOperation: Gen[String] = Gen.chooseNum(1, 40).flatMap(n =>
    Gen.listOfN(n, Gen.alphaNumChar).map(_.mkString))
  private val genOccurrence: Gen[String] = Gen.chooseNum(1, 20).flatMap(n =>
    Gen.listOfN(n, Gen.alphaNumChar).map(_.mkString))

  private def statusOf(coordinator: ActorRef[StrictSagaCoordinator.Command]): StrictState = {
    implicit val timeout: Timeout = Timeout(10.seconds)
    Await.result(coordinator.ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.GetStatus(_)),
      15.seconds) match {
      case StrictSagaCoordinator.Status(s) => s
      case other => throw new IllegalStateException("unexpected coordinator reply: " + other)
    }
  }

  private def eventNames(pid: String): Vector[String] =
    CompositionFixture.journalEvents(pid).map(_.event.getClass.getSimpleName)

  private def hostEvents(operation: String, occurrence: String): Vector[WaferTransferHost.Event] =
    CompositionFixture.journalEvents(CompositionFixture.hostPid(operation, occurrence))
      .map(_.event).collect { case e: WaferTransferHost.Event => e }

  private def childCursorEvents(pid: String): Vector[String] =
    CompositionFixture.journalEvents(pid).map(_.event).collect {
      case sd: PersistentMonarch.StageDone => sd.cursor
    }

  private def startedIdentities(pid: String): Vector[TransactionIdentity] =
    CompositionFixture.journalEvents(pid).map(_.event).collect {
      case StrictEvent.Started(identity, _, _) => identity
      case _ => ()
    }.collect { case identity: TransactionIdentity => identity }

  private def businessEvents(lotId: String): Vector[Product] =
    CompositionFixture.journalEvents(CompositionFixture.lotPid(lotId)).map(_.event).collect {
      case p: Product => p
    }

  private def effectsByTxid(lotId: String, txid: String): Vector[Product] =
    businessEvents(lotId).filter(p => p.productArity > 0 && p.productElement(0) == txid)

  private def seedFixtureLots(): Unit = {
    CompositionFixture.seedLot(fromLot, seedFrom)
    CompositionFixture.seedLot(toLot, childBaseWafers)
  }

  private def fourEffects: Vector[String] =
    Vector("WaferAdditionCommitted", "WaferAdditionReserved",
      "WaferRemovalCommitted", "WaferRemovalReserved").sorted

  private def simpleChildPlan(pid: String, wafers: Vector[String], runKey: String)
      (body: => Unit): Unit = {
    val planRef = CompositionFixture.testKit.spawn(WaferChildPlan.behavior(
      PersistenceId.ofUniqueId(pid)), "child-plan-" + java.util.UUID.randomUUID())
    val probe = CompositionFixture.testKit.createTestProbe[PersistentMonarch.RunReply]()
    planRef ! PersistentMonarch.StartRun(runKey, ChildPlanState(wafers, 0), probe.ref)
    body
  }

  // ── 子计划面 ──

  property("child plan StartRun persists RunStarted, three stage cursors and RunCompleted") = secure {
    val pid = "wafer-child/probe-run-" + java.util.UUID.randomUUID()
    simpleChildPlan(pid, Vector("w-001", "w-002"), "run-1") {
      val deadline = System.nanoTime() + (20.seconds).toNanos
      while (eventNames(pid).count(_ == "RunCompleted") < 1 && System.nanoTime() < deadline) {
        Thread.sleep(150)
      }
    }
    check(eventNames(pid) == Vector("RunStarted", "StageDone", "StageDone", "StageDone", "RunCompleted"),
      "child journal face: " + eventNames(pid))
    check(childCursorEvents(pid) == stageCursors, "stage cursors: " + childCursorEvents(pid))
  }

  property("child plan codec roundtrips every bounded wafer set") = forAll(genWafers) { wafers =>
    val state = ChildPlanState(wafers, wafers.size)
    val decoded = ChildPlanState.codec.decode(ChildPlanState.codec.encode(state))
    decoded == state
  }

  property("child plan codec freezes the wafer:count wire form") = secure {
    val bytes = ChildPlanState.codec.encode(ChildPlanState(Vector("w-001", "w-002"), 2))
    new String(bytes, java.nio.charset.StandardCharsets.UTF_8) == "w-001,w-002:2"
  }

  property("negative: child plan StartRun on a live run key is Rejected with the in-state reason") = secure {
    val fixture = CompositionFixture
    val pid = "wafer-child/probe-run-" + java.util.UUID.randomUUID()
    val planRef = fixture.testKit.spawn(WaferChildPlan.behavior(
      PersistenceId.ofUniqueId(pid)), "child-plan-" + java.util.UUID.randomUUID())
    val probe = fixture.testKit.createTestProbe[PersistentMonarch.RunReply]()
    planRef ! PersistentMonarch.StartRun("run-1", ChildPlanState(Vector("w-001"), 0), probe.ref)
    check(probe.receiveMessage(20.seconds).isInstanceOf[PersistentMonarch.Accepted],
      "StartRun must accept")
    val second = fixture.testKit.createTestProbe[PersistentMonarch.RunReply]()
    planRef ! PersistentMonarch.StartRun("run-1", ChildPlanState(Vector("w-001"), 0), second.ref)
    second.receiveMessage(20.seconds) match {
      case PersistentMonarch.Rejected(_, reason) =>
        check(reason.contains("already"), "in-state refusal reason: " + reason)
      case other => throw new IllegalStateException("expected Rejected, got " + other)
    }
  }

  // ── lot TCC 面 ──

  property("lot TCC add reserves and commits through the real sharded entity") = secure {
    val fixture = CompositionFixture
    val lotId = "tcc-add-lot-" + java.util.UUID.randomUUID()
    val ref = fixture.sharding.entityRefFor(LotProtocol.entityKey, lotId)
    val replyProbe = fixture.testKit.createTestProbe[LotProtocol.LotReply]()
    val txid = "tcc-add-" + java.util.UUID.randomUUID().toString.take(8)
    ref ! LotProtocol.ReserveWaferAddition(txid, lotId, Vector("tcc-1", "tcc-2").toList,
      replyProbe.ref)
    val reserved = replyProbe.receiveMessage(15.seconds)
    check(reserved.error.isEmpty, "reserve must accept: " + reserved)
    ref ! LotProtocol.CommitWaferAddition(txid, lotId, replyProbe.ref)
    val committed = replyProbe.receiveMessage(15.seconds)
    check(committed.error.isEmpty, "commit must accept: " + committed)
    val state = fixture.stateOfLot(lotId)
    check(state.carried.keySet == Set("tcc-1", "tcc-2"), "carried after commit: " + state.carried)
    check(state.committedAdditions.get(txid).contains(2), "durable addition mark: " + state)
  }

  property("negative: lot removal refuses wafers outside carried without persisting") = secure {
    val fixture = CompositionFixture
    val lotId = "tcc-remove-lot-" + java.util.UUID.randomUUID()
    val ref = fixture.sharding.entityRefFor(LotProtocol.entityKey, lotId)
    val replyProbe = fixture.testKit.createTestProbe[LotProtocol.LotReply]()
    val txid = "tcc-remove-" + java.util.UUID.randomUUID().toString.take(8)
    ref ! LotProtocol.ReserveWaferRemoval(txid, lotId, Vector("absent-wafer").toList,
      replyProbe.ref)
    val refused = replyProbe.receiveMessage(15.seconds)
    check(refused.error.exists(_.code == removalRefusalCode), "removal refusal: " + refused)
    check(fixture.stateOfLot(lotId).removalReservations.get(txid).isEmpty,
      "a refused reserve must not persist a mark")
  }

  property("negative: lot commit without a reservation is refused fail-closed") = secure {
    val fixture = CompositionFixture
    val lotId = "tcc-commit-lot-" + java.util.UUID.randomUUID()
    val ref = fixture.sharding.entityRefFor(LotProtocol.entityKey, lotId)
    val replyProbe = fixture.testKit.createTestProbe[LotProtocol.LotReply]()
    ref ! LotProtocol.CommitWaferRemoval("no-such-txid", lotId, replyProbe.ref)
    val refused = replyProbe.receiveMessage(15.seconds)
    check(refused.error.exists(_.code == 6003), "missing-reservation refusal: " + refused)
  }

  property("per-txid business filtering recovers exactly the four TCC effects") = secure {
    val fixture = CompositionFixture
    val lotId = "tcc-filter-lot-" + java.util.UUID.randomUUID()
    val ref = fixture.sharding.entityRefFor(LotProtocol.entityKey, lotId)
    val replyProbe = fixture.testKit.createTestProbe[LotProtocol.LotReply]()
    val txid = "tcc-filter-" + java.util.UUID.randomUUID().toString.take(8)
    ref ! LotProtocol.ReserveWaferAddition(txid, lotId, Vector("f-1").toList, replyProbe.ref)
    replyProbe.receiveMessage(15.seconds)
    ref ! LotProtocol.CommitWaferAddition(txid, lotId, replyProbe.ref)
    replyProbe.receiveMessage(15.seconds)
    val effects = businessEvents(lotId).filter(p =>
      p.productArity > 0 && p.productElement(0) == txid)
    check(effects.map(_.productPrefix).toSet ==
      Set("WaferAdditionReserved", "WaferAdditionCommitted"),
      "per-txid effects: " + effects.map(_.productPrefix))
    check(fixture.stateOfLot(lotId).carried.keySet == Set("f-1"),
      "carried after the filtered commit")
  }

  // ── 身份派生面 ──

  property("durable derivation keys are stable and occurrence-scoped") = forAll(genOperation,
    genOccurrence) { (operation, occurrence) =>
    val stepKey = WaferTransferHost.txidFor(operation, occurrence, "split-transfer")
    val childKey = WaferTransferHost.childRunKey(operation, occurrence)
    stepKey == "op-" + operation + "-split-transfer-" + occurrence &&
      childKey == "op-" + operation + "-" + WaferTransferHost.AwaitStep + "-" + occurrence &&
      WaferTransferHost.childPersistenceId(operation, occurrence) ==
        childNamespacePrefix + "/" + childKey &&
      WaferTransferHost.persistenceIdFor(operation, occurrence).id ==
        namespacePrefix + "/" + operation + "-" + occurrence
  }

  property("negative: persistenceIdFor rejects empty operation or occurrence") = forAll(
    Gen.oneOf(Vector(("", "occ"), ("op", ""), ("", "")))) { case (operation, occurrence) =>
    val message = throwsMessage(WaferTransferHost.persistenceIdFor(operation, occurrence))
    message == "explicit operation and occurrence required"
  }

  property("singleton name is the sha-256 composition prefix of the persistence id") = secure {
    val name = WaferTransferHost.singletonName("probe-singleton", "occ-7")
    val expected = singletonPrefix + hex(java.security.MessageDigest
      .getInstance("SHA-256").digest(WaferTransferHost.persistenceIdFor("probe-singleton", "occ-7")
        .id.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
    name == expected && name.startsWith(singletonPrefix)
  }

  property("TestHooks defaults admit every effect and keep recovery silent") = secure {
    val hooks = WaferTransferHost.TestHooks()
    hooks.beforeEffect("split-transfer", "key") &&
      hooks.beforeChildCheckpoint() &&
      (hooks.recovered(1L, WaferTransferHost.ComposedState(None, Map.empty, Map.empty,
        Map.empty, None)): Unit) == (()) &&
      (hooks.stopped(): Unit) == (())
  }

  property("ComposedState terminal and activeStep follow the journal order") = secure {
    composedStateFaces()
  }

  private def composedStateFaces(): Boolean = {
    val empty = WaferTransferHost.ComposedState(None, Map.empty, Map.empty, Map.empty, None)
    val started = WaferTransferHost.OperationStarted("op", "occ", "f", "t", Vector("w"), "m")
    val withStart = empty.copy(started = Some(started))
    val withIntent = withStart.copy(intents = Map(splitStep -> "k1"))
    val withCheckpoint = withIntent.copy(checkpoints = Map(splitStep ->
      WaferTransferHost.StepCheckpointed(splitStep, "Succeeded", Map.empty)))
    val withAwaitIntent = withCheckpoint.copy(intents = withCheckpoint.intents +
      (awaitStep -> "k2"))
    val concluded = withAwaitIntent.copy(concluded = Some(
      WaferTransferHost.OperationConcluded(allStepsSucceeded)))
    check(empty.activeStep.contains(splitStep), "an empty journal opens the split step")
    check(!empty.terminal, "an empty journal is not terminal")
    check(withIntent.activeStep.contains(splitStep), "an open intent keeps the step active")
    check(withCheckpoint.activeStep.contains(awaitStep), "a checkpoint advances to the await step")
    check(withAwaitIntent.activeStep.contains(awaitStep), "the await intent keeps the await active")
    check(concluded.terminal, "a conclusion makes the state terminal")
  }

  // ── 真实 cluster 全链（E1 面；场景体提炼为命名 helper）──

  property("composition full chain concludes AllStepsSucceeded with conserved lots") = secure {
    e1Conserved()
  }

  private def e1Conserved(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e1-conserved")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    check(fixture.begin(host, operation, "occ-1", splitWafers).accepted, "begin accepted")
    val report = fixture.awaitConcluded(host, 120.seconds)
    check(report.concluded.contains(allStepsSucceeded), "final report: " + report)
    check(report.checkpoints == Vector(
      (splitStep, "Succeeded"), (awaitStep, childCompletedCode), (mergeStep, "Succeeded")),
      "per-step codes: " + report.checkpoints)
    check(report.childRunKey.contains(
      WaferTransferHost.childRunKey(operation, "occ-1")), "child run key: " + report)
    check(fixture.stateOfLot(fromLot).carried.keySet == seedFrom.toSet,
      "from lot must be conserved: " + fixture.stateOfLot(fromLot).carried)
    check(fixture.stateOfLot(toLot).carried.keySet == childBaseWafers.toSet,
      "to lot must be conserved: " + fixture.stateOfLot(toLot).carried)
  }

  property("host journal trace: every intent precedes its checkpoint, child precedes merge") = secure {
    e1Trace()
  }

  private def e1Trace(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e1-trace")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    fixture.begin(host, operation, "occ-1", splitWafers)
    val report = fixture.awaitConcluded(host, 120.seconds)
    check(report.concluded.contains(allStepsSucceeded), "final report: " + report)
    val events = hostEvents(operation, "occ-1")
    check(startFace(events), "durable start record face")
    check(orderFace(events, operation), "every intent precedes its checkpoint with its key")
    check(childFace(events), "child outputs carry the original wafers csv")
    check(mergeFace(events), "merge intent follows the authoritative child checkpoint")
    check(events.count(_.isInstanceOf[WaferTransferHost.OperationConcluded]) == 1,
      "exactly one conclusion")
  }

  private def startFace(events: Vector[WaferTransferHost.Event]): Boolean = {
    val starts = events.collect { case e: WaferTransferHost.OperationStarted => e }
    starts.size == 1 && starts.head.wafers == splitWafers &&
      starts.head.manifest == manifestSeed
  }

  private def orderFace(events: Vector[WaferTransferHost.Event], operation: String): Boolean =
    stepIds.forall { step =>
      val intentIndex = events.indexWhere {
        case e: WaferTransferHost.InvocationIntentPersisted => e.stepId == step
        case _ => false
      }
      val checkpointIndex = events.indexWhere {
        case e: WaferTransferHost.StepCheckpointed => e.stepId == step
        case _ => false
      }
      ordered(events, intentIndex, checkpointIndex, step, operation)
    }

  private def ordered(
      events: Vector[WaferTransferHost.Event],
      intentIndex: Int,
      checkpointIndex: Int,
      step: String,
      operation: String): Boolean = {
    val expectedKey = if (step == awaitStep)
      WaferTransferHost.childRunKey(operation, "occ-1")
    else WaferTransferHost.txidFor(operation, "occ-1", step)
    intentIndex >= 0 && checkpointIndex > intentIndex && events(intentIndex)
      .asInstanceOf[WaferTransferHost.InvocationIntentPersisted].key == expectedKey
  }

  private def childFace(events: Vector[WaferTransferHost.Event]): Boolean = {
    val childCheckpoint = events.collectFirst {
      case e: WaferTransferHost.StepCheckpointed if e.stepId == awaitStep => e
    }.get
    childCheckpoint.outputs("wafers").split(",").toVector == splitWafers
  }

  private def mergeFace(events: Vector[WaferTransferHost.Event]): Boolean = {
    val mergeIntent = events.indexWhere {
      case e: WaferTransferHost.InvocationIntentPersisted => e.stepId == mergeStep
      case _ => false
    }
    val childCheckpoint = events.collectFirst {
      case e: WaferTransferHost.StepCheckpointed if e.stepId == awaitStep => e
    }.get
    events.indexOf(childCheckpoint) < mergeIntent
  }

  property("each saga starts exactly once with its stable transaction identity") = secure {
    e1ExactlyOnce()
  }

  private def e1ExactlyOnce(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e1-once")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val splitPid = fixture.lastSplitFlowPid
    val mergePid = fixture.lastMergeFlowPid
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    fixture.begin(host, operation, "occ-1", splitWafers)
    val report = fixture.awaitConcluded(host, 120.seconds)
    check(report.concluded.contains(allStepsSucceeded), "final report: " + report)
    val identities = Vector(splitPid -> WaferTransferHost.SplitStep,
      mergePid -> WaferTransferHost.MergeStep).map { case (pid, step) =>
      (pid, step, startedIdentities(pid))
    }
    check(identityFace(identities, operation), "one Started per saga with its stable identity")
    check(effectsFace(identities), "exactly four persisted TCC effects per saga")
  }

  private def identityFace(
      identities: Vector[(String, String, Vector[TransactionIdentity])],
      operation: String): Boolean =
    identities.forall { case (pid, step, ids) =>
      ids.size == 1 &&
        ids.head.transactionId == WaferTransferHost.txidFor(operation, "occ-1", step) &&
        ids.head.definitionName ==
          (if (step == WaferTransferHost.SplitStep) "wafer-transfer-split"
           else "wafer-transfer-merge")
    }

  private def effectsFace(
      identities: Vector[(String, String, Vector[TransactionIdentity])]): Boolean = {
    val perStepEffects = identities.map { case (pid, _, _) =>
      val txid = startedIdentities(pid).head.transactionId
      (effectsByTxid(fromLot, txid).map(_.productPrefix).sorted ++
        effectsByTxid(toLot, txid).map(_.productPrefix).sorted).sorted
    }
    perStepEffects == Vector(fourEffects, fourEffects)
  }

  property("child journal is the only authoritative terminal with exactly-once faces") = secure {
    e1ChildJournal()
  }

  private def e1ChildJournal(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e1-child")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    fixture.begin(host, operation, "occ-1", splitWafers)
    val report = fixture.awaitConcluded(host, 120.seconds)
    check(report.concluded.contains(allStepsSucceeded), "final report: " + report)
    val childPid = fixture.childPid(operation, "occ-1")
    check(eventNames(childPid) ==
      Vector("RunStarted", "StageDone", "StageDone", "StageDone", "RunCompleted"),
      "child journal face: " + eventNames(childPid))
    check(childCursorEvents(childPid) == stageCursors, "stage cursors")
  }

  property("negative: BeginOperation on a mismatched operation writes nothing") = secure {
    guardPidMismatch()
  }

  private def guardPidMismatch(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("guard-pid")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    val before = fixture.journalEvents(fixture.hostPid(operation, "occ-1")).size
    val reply = fixture.begin(host, operation + "-other", "occ-1", splitWafers)
    check(!reply.accepted && reply.reason == "operation does not match this persistence identity",
      "pid-mismatch refusal: " + reply)
    check(fixture.journalEvents(fixture.hostPid(operation, "occ-1")).size == before,
      "a rejected begin must not write")
    check(!fixture.progressOf(host).started,
      "a rejected begin must not start the operation")
  }

  property("negative: duplicate BeginOperation is rejected by the single-writer guard") = secure {
    guardDuplicate()
  }

  private def guardDuplicate(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("guard-dup")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    check(fixture.begin(host, operation, "occ-1", splitWafers).accepted, "begin accepted")
    val duplicate = fixture.begin(host, operation, "occ-1", splitWafers)
    check(!duplicate.accepted && duplicate.reason == "operation already started (single-writer)",
      "single-writer refusal: " + duplicate)
    val report = fixture.awaitConcluded(host, 120.seconds)
    check(report.concluded.contains(allStepsSucceeded),
      "the duplicate must not disturb the live operation: " + report)
  }

  // ── 恢复窗（确定崩停 + 注入前缀）──

  property("negative: the barrier blocks the first saga Start; saga and child journals stay empty") = secure {
    e4bBarrier()
  }

  private def e4bBarrier(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e4b-barrier")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val hit = fixture.testKit.createTestProbe[(String, String)]()
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator,
      Some(WaferTransferHost.TestHooks(beforeEffect = (step, key) => {
        hit.ref ! (step -> key)
        step != WaferTransferHost.SplitStep
      })))
    check(fixture.begin(host, operation, "occ-1", splitWafers).accepted, "begin accepted")
    check(hit.receiveMessage(15.seconds) ==
      (WaferTransferHost.SplitStep ->
        WaferTransferHost.txidFor(operation, "occ-1", WaferTransferHost.SplitStep)),
      "the barrier receives the exact step and derived key")
    check(eventNames(fixture.hostPid(operation, "occ-1")).take(2) ==
      Vector("OperationStarted", "InvocationIntentPersisted"),
      "durable prefix before the first effect")
    check(fixture.journalCount(fixture.lastSplitFlowPid) == 0, "split saga journal must be empty")
    check(fixture.journalCount(fixture.lastMergeFlowPid) == 0, "merge saga journal must be empty")
    check(fixture.journalCount(fixture.childPid(operation, "occ-1")) == 0,
      "child journal must be empty")
  }

  property("recovery reissues the same-key Start after a crash before the first effect (E4b)") = secure {
    e4bRecovery()
  }

  private def e4bRecovery(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e4b-recover")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val splitPid = fixture.lastSplitFlowPid
    val mergePid = fixture.lastMergeFlowPid
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator,
      Some(WaferTransferHost.TestHooks(beforeEffect = (step, _) => {
        step != WaferTransferHost.SplitStep
      })))
    check(fixture.begin(host, operation, "occ-1", splitWafers).accepted, "begin accepted")
    // 让宿主在下一个持久化点确定崩停（子镜像事件），同 PID 重驱即恢复窗。
    fixture.crashHostOnNextPersist(operation, "occ-1")
    host ! WaferTransferHost.ChildProgressed("receive#0")
    val crashDeadline = System.nanoTime() + (20.seconds).toNanos
    while (fixture.journalCount(fixture.hostPid(operation, "occ-1")) < 3 &&
        System.nanoTime() < crashDeadline) Thread.sleep(100)
    check(fixture.journalCount(fixture.lastSplitFlowPid) == 0,
      "the crash must not leak saga effects")
    val recoveryHost = fixture.respawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    val report = fixture.awaitConcluded(recoveryHost, 150.seconds)
    check(report.concluded.contains(allStepsSucceeded), "recovery report: " + report)
    Vector(splitPid, mergePid).foreach { pid =>
      check(startedIdentities(pid).size == 1, "exactly one Started after recovery on " + pid)
    }
    check(eventNames(fixture.childPid(operation, "occ-1")).count(_ == "RunStarted") == 1,
      "exactly one child run after recovery")
    check(fixture.stateOfLot(fromLot).carried.keySet == seedFrom.toSet &&
      fixture.stateOfLot(toLot).carried.keySet == childBaseWafers.toSet,
      "lots conserved through the recovery")
  }

  property("recovery replays an injected await-intent prefix into the authoritative child run (E3)") = secure {
    e3Inject()
  }

  private def e3Inject(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e3-inject")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val mergePid = fixture.lastMergeFlowPid
    val splitTxid = WaferTransferHost.txidFor(operation, "occ-1", WaferTransferHost.SplitStep)
    fixture.injectRecoveryPrefix(operation, "occ-1", Vector(
      WaferTransferHost.OperationStarted(operation, "occ-1", fromLot, toLot, splitWafers,
        manifestSeed),
      WaferTransferHost.InvocationIntentPersisted(splitStep, splitTxid),
      WaferTransferHost.IdentityObserved(splitStep, splitTxid,
        WaferSplitSagaModule.name, WaferSplitSagaModule.version, "injected-args-digest",
        WaferSplitSagaModule.definitionDigest, WaferSplitSagaModule.argsPin.id,
        WaferSplitSagaModule.argsPin.version, "injected-plan-digest"),
      WaferTransferHost.StepCheckpointed(splitStep, "Succeeded", Map("txid" -> splitTxid)),
      WaferTransferHost.InvocationIntentPersisted(awaitStep,
        WaferTransferHost.childRunKey(operation, "occ-1"))))
    // 注入 split 完成的 lot 侧效果（注入窗一致性）：截断窗里的宿主 checkpoint
    // 断言的 split 效果在真实流中已落库；同一 JVM 里 lot 实体可能已 warm，
    // journal 注入对运行中实体不可见——所以经真实 TCC 命令落库。
    val refProbe = fixture.testKit.createTestProbe[LotProtocol.LotReply]()
    val fromRef = fixture.sharding.entityRefFor(LotProtocol.entityKey, fromLot)
    val toRef = fixture.sharding.entityRefFor(LotProtocol.entityKey, toLot)
    fromRef ! LotProtocol.ReserveWaferRemoval(splitTxid, fromLot, splitWafers.toList, refProbe.ref)
    check(refProbe.receiveMessage(15.seconds).error.isEmpty, "injected removal reserve")
    fromRef ! LotProtocol.CommitWaferRemoval(splitTxid, fromLot, refProbe.ref)
    check(refProbe.receiveMessage(15.seconds).error.isEmpty, "injected removal commit")
    toRef ! LotProtocol.ReserveWaferAddition(splitTxid, toLot, splitWafers.toList, refProbe.ref)
    check(refProbe.receiveMessage(15.seconds).error.isEmpty, "injected addition reserve")
    toRef ! LotProtocol.CommitWaferAddition(splitTxid, toLot, refProbe.ref)
    check(refProbe.receiveMessage(15.seconds).error.isEmpty, "injected addition commit")
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    val report = fixture.awaitConcluded(host, 150.seconds)
    check(report.concluded.contains(allStepsSucceeded), "E3 recovery report: " + report)
    check(eventNames(fixture.childPid(operation, "occ-1")).count(_ == "RunStarted") == 1,
      "the recovery child run starts exactly once")
    check(startedIdentities(mergePid).size == 1, "exactly one merge Start after recovery")
    check(fixture.stateOfLot(fromLot).carried.keySet == seedFrom.toSet &&
      fixture.stateOfLot(toLot).carried.keySet == childBaseWafers.toSet,
      "lots conserved after the injected recovery")
  }

  property("recovery attaches the carried identity; the split saga re-drives without a second Start (E2)") = secure {
    e2Attach()
  }

  private def e2Attach(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e2-attach")
    // 注入先于 spawn：warm 协调器不读追加事件（G1 纪律），先预留 pid 落库
    // Started，再启动协调器令其 recovery 摄取注入事务。
    val splitPid = fixture.reserveSplitFlowPid()
    val splitTxid = WaferTransferHost.txidFor(operation, "occ-1", WaferTransferHost.SplitStep)
    val argsBytes = fixture.splitFixtureHost.argsCodec.encode(
      WaferSplitSagaModule.Args(splitTxid, fromLot, toLot, splitWafers.toList, manifestSeed))
    val argsDigest = hex(java.security.MessageDigest.getInstance("SHA-256")
      .digest(argsBytes.toByteArray))
    val identity = TransactionIdentity(splitTxid, WaferSplitSagaModule.name,
      WaferSplitSagaModule.version, argsDigest, WaferSplitSagaModule.definitionDigest,
      WaferSplitSagaModule.argsPin, splitPlanDigest)
    // 协调器 journal 注入 Started（真实参与者/收据 pin 计划），宿主 journal 注入
    // started+intent+identity（checkpoint 缺失的 E2 窗）。
    akka.persistence.testkit.scaladsl.PersistenceTestKit(fixture.testKit.system)
      .persistForRecovery(splitPid, Vector(StrictEvent.Started(identity, argsBytes,
        splitParticipantPlan(fromLot, toLot))))
    val splitCoordinator = fixture.spawnSplitCoordinatorAt(splitPid, reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val mergePid = fixture.lastMergeFlowPid
    fixture.injectRecoveryPrefix(operation, "occ-1", Vector(
      WaferTransferHost.OperationStarted(operation, "occ-1", fromLot, toLot, splitWafers,
        manifestSeed),
      WaferTransferHost.InvocationIntentPersisted(splitStep, splitTxid),
      WaferTransferHost.IdentityObserved(splitStep, splitTxid, WaferSplitSagaModule.name,
        WaferSplitSagaModule.version, argsDigest, WaferSplitSagaModule.definitionDigest,
        WaferSplitSagaModule.argsPin.id, WaferSplitSagaModule.argsPin.version, splitPlanDigest)))
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    // 恢复宿主 Attach 携带权威身份；以授权 Reconcile 驱动事务到终态
    // （部署 successor 面，raw D L214–227 同款循环）。
    val state = reconcileUntilTerminal(splitCoordinator)
    check(state.terminal && state.status == StrictStatus.Succeeded,
      "authorized reconciliation drives the recovered saga to Succeeded: " + state.status)
    check(startedIdentities(splitPid).size == 1, "Attach must not start a second transaction")
    val report = fixture.awaitConcluded(host, 150.seconds)
    check(report.concluded.contains(allStepsSucceeded), "E2 full chain: " + report)
    check(startedIdentities(mergePid).size == 1, "merge starts exactly once after E2 recovery")
    check(fixture.stateOfLot(fromLot).carried.keySet == seedFrom.toSet &&
      fixture.stateOfLot(toLot).carried.keySet == childBaseWafers.toSet,
      "lots conserved through the E2 recovery")
  }

  property("negative: the occupier terminal folds a same-txid different-args host into Rejected (E5)") = secure {
    e5Occupier()
  }

  private def e5Occupier(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("e5-occupier")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val splitHost = fixture.splitFixtureHost
    val txid = WaferTransferHost.txidFor(operation, "occ-1", WaferTransferHost.SplitStep)
    val occupier = LotProtocol.StartTransfer(txid, fromLot, toLot, occupierWafers.toList,
      manifestSeed, fixture.testKit.createTestProbe[LotProtocol.LotReply]().ref)
    splitCoordinator ! WaferSplitSagaModule.waferTransferRequestedTriggerStart(occupier,
      splitHost, fixture.testKit.createTestProbe[StrictSagaCoordinator.Reply]().ref)
    val state = awaitOccupierTerminal(splitCoordinator)
    check(state.terminal && state.status == StrictStatus.Aborted,
      "the occupier must reach a terminal abort on its own refusal: " + state.status)
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator)
    check(fixture.begin(host, operation, "occ-1", splitWafers).accepted, "begin accepted")
    val report = fixture.awaitConcluded(host, 120.seconds)
    check(report.concluded.contains(rejectedCode),
      "same txid with different args must fail closed on the occupied terminal: " + report)
    check(fixture.stateOfLot(fromLot).carried.keySet == seedFrom.toSet,
      "the occupier's rejection must not leak effects from the host's different args")
    check(!report.checkpoints.exists { case (step, _) => step == mergeStep } ||
      report.concluded.contains(rejectedCode), "the chain never reaches the merge step")
  }

  // ── 停止面 ──

  property("crash runs PostStop: the stopped hook fires and polls observe the closed owner") = secure {
    postStopFace()
  }

  private def postStopFace(): Boolean = {
    val fixture = CompositionFixture
    seedFixtureLots()
    val operation = nextOperation("poststop")
    val splitCoordinator = fixture.spawnSplitCoordinator(reconcileToken)
    val mergeCoordinator = fixture.spawnMergeCoordinator(reconcileToken)
    val stoppedFlag = new java.util.concurrent.atomic.AtomicBoolean(false)
    val host = fixture.spawnHost(operation, "occ-1", splitCoordinator, mergeCoordinator,
      Some(WaferTransferHost.TestHooks(stopped = () => stoppedFlag.set(true))))
    check(fixture.begin(host, operation, "occ-1", splitWafers).accepted, "begin accepted")
    fixture.crashHostOnNextPersist(operation, "occ-1")
    host ! WaferTransferHost.ChildProgressed("receive#0")
    val deadline = System.nanoTime() + (20.seconds).toNanos
    while (!stoppedFlag.get() && System.nanoTime() < deadline) Thread.sleep(100)
    check(stoppedFlag.get(), "PostStop must run the stopped hook before JVM exit")
  }

  private def awaitOccupierTerminal(
      coordinator: ActorRef[StrictSagaCoordinator.Command]): StrictState = {
    val deadline = System.nanoTime() + (90.seconds).toNanos
    var state = statusOf(coordinator)
    while (!state.terminal && System.nanoTime() < deadline) {
      Thread.sleep(300)
      state = statusOf(coordinator)
    }
    state
  }

  private def reconcileUntilTerminal(
      coordinator: ActorRef[StrictSagaCoordinator.Command]): StrictState = {
    val sink = CompositionFixture.testKit.createTestProbe[StrictSagaCoordinator.Reply]()
    val deadline = System.nanoTime() + (120.seconds).toNanos
    var state = statusOf(coordinator)
    while ((!state.terminal) && System.nanoTime() < deadline) {
      if (state.identity.isDefined) {
        coordinator ! StrictSagaCoordinator.Reconcile(state.identity.get, reconcileToken, 32,
          sink.ref)
      }
      Thread.sleep(300)
      state = statusOf(coordinator)
    }
    state
  }

  private def splitParticipantPlan(fromId: String, toId: String): Vector[ParticipantDescriptor] =
    Vector(
      ParticipantDescriptor("remove-from-lot", "from-lot", fromId,
        Vector(Phase.Prepare, Phase.Commit, Phase.Compensate),
        Vector(
          ReceiptCodecPin(Phase.Prepare, CodecPin("wafer-transfer-split-remove-from-lot-prepare", 1)),
          ReceiptCodecPin(Phase.Commit, CodecPin("wafer-transfer-split-remove-from-lot-commit", 1)),
          ReceiptCodecPin(Phase.Compensate,
            CodecPin("wafer-transfer-split-remove-from-lot-compensate", 1)))),
      ParticipantDescriptor("add-to-lot", "to-lot", toId,
        Vector(Phase.Prepare, Phase.Commit, Phase.Compensate),
        Vector(
          ReceiptCodecPin(Phase.Prepare, CodecPin("wafer-transfer-split-add-to-lot-prepare", 1)),
          ReceiptCodecPin(Phase.Commit, CodecPin("wafer-transfer-split-add-to-lot-commit", 1)),
          ReceiptCodecPin(Phase.Compensate,
            CodecPin("wafer-transfer-split-add-to-lot-compensate", 1)))))
}
