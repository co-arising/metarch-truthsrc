package example.stockreservation.application.services.transactor

import akka.actor.typed.{ActorRef, ActorSystem, Behavior, Scheduler}
import akka.actor.typed.scaladsl.{ActorContext, Behaviors}
import akka.actor.typed.scaladsl.AskPattern._
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.typed.{ClusterSingleton, SingletonActor}
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import akka.stream.UniqueKillSwitch
import akka.util.Timeout
import example.stockreservation.application.aggregates.LotProtocol
import net.imadz.common.CborSerializable
import net.imadz.infra.saga.strict.{CodecPin, Evidence, Phase, StrictSagaCoordinator, StrictState,
  StrictStatus, TransactionIdentity}
import net.imadz.monarch.persistence.PersistentMonarch
import WaferChildPlan.ChildPlanState
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success, Try}

/** 有界组合宿主（组合面族工件，raw T H01–H32 全分支落地）：每个
  * (pipeline, operation, occurrence) 一个持久 actor，驱动
  * split-transfer → await-child-run → merge-transfer 有界 plan。Journal
  * （权威，confirmed-prefix 恢复）：OperationStarted → InvocationIntentPersisted
  * → IdentityObserved → StepCheckpointed → ChildProgressMirrored（仅派生）→
  * OperationConcluded。镜像子进度永不权威——子 run 自身 journal 才是。子失败
  * 使操作停止（child-failed），绝不自动补偿父流程（补偿不是 stage 恢复）。
  * 超时永不推断失败：未答的 poll 重试，不判死。D1 拆分：子 journal 观察经
  * CompositionChildJournal 端口注入（构造形状偏离 raw 记档）；D5/F10 记档：
  * H18 的恒真检查已简化为 isDefined。 */
object WaferTransferHost {
  val StepIds: Vector[String] = Vector("split-transfer", "await-child-run", "merge-transfer")
  val SplitStep: String = "split-transfer"
  val AwaitStep: String = "await-child-run"
  val MergeStep: String = "merge-transfer"

  sealed trait Command extends CborSerializable
  final case class BeginOperation(operation: String, occurrence: String, from: String,
                                  to: String, wafers: Vector[String], manifest: String,
                                  replyTo: ActorRef[OperationReply]) extends Command
  final case class GetProgress(replyTo: ActorRef[ProgressReport]) extends Command
  private[transactor] final case class SagaPolled(stepId: String,
                                                  reply: Try[StrictSagaCoordinator.Reply])
    extends Command
  private[transactor] final case class AdvanceAfterCheckpoint(stepId: String) extends Command
  private[transactor] final case class OpenStep(stepId: String) extends Command
  private[transactor] final case class ChildObserved(code: Option[(String, String)]) extends Command
  private[transactor] final case class ChildRefused(reason: String) extends Command
  private[transactor] final case class ChildProgressed(cursor: String) extends Command
  private[transactor] final case class PollTick(stepId: String) extends Command
  private[transactor] final case class ChildSignal(signal: ChildJournalSignal) extends Command

  sealed trait Event extends CborSerializable
  final case class OperationStarted(operation: String, occurrence: String, from: String,
                                    to: String, wafers: Vector[String], manifest: String)
    extends Event
  final case class InvocationIntentPersisted(stepId: String, key: String) extends Event
  /** The coordinator's authoritative transaction identity for an invoked step,
    * observed on the first poll and carried in THIS journal so recovery can
    * Attach without reconstructing saga digests. */
  final case class IdentityObserved(stepId: String, transactionId: String, definitionName: String,
                                    definitionVersion: Int, argsDigest: String,
                                    definitionDigest: String, argsCodecId: String,
                                    argsCodecVersion: Int, planDigest: String) extends Event {
    def toIdentity: TransactionIdentity = TransactionIdentity(transactionId, definitionName,
      definitionVersion, argsDigest, definitionDigest, CodecPin(argsCodecId, argsCodecVersion),
      planDigest)
  }
  final case class StepCheckpointed(stepId: String, code: String, outputs: Map[String, String])
    extends Event
  final case class ChildProgressMirrored(cursor: String) extends Event
  final case class OperationConcluded(code: String) extends Event

  final case class ComposedState(started: Option[OperationStarted], intents: Map[String, String],
                                 identities: Map[String, IdentityObserved],
                                 checkpoints: Map[String, StepCheckpointed],
                                 concluded: Option[OperationConcluded]) {
    def terminal: Boolean = concluded.isDefined
    /** First step with an intent but no checkpoint (resume face), else the first
      * step never started (advance face). */
    def activeStep: Option[String] =
      StepIds.find(id => intents.contains(id) && !checkpoints.contains(id))
        .orElse(StepIds.find(id => !intents.contains(id)))
  }

  final case class OperationReply(accepted: Boolean, reason: String) extends CborSerializable
  final case class ProgressReport(started: Boolean, checkpoints: Vector[(String, String)],
                                  concluded: Option[String], childRunKey: Option[String])
    extends CborSerializable

  /** durable-parent-step derivation: parent operation key + exact step id +
    * durable occurrence token. No clock, random, or attempt. */
  def txidFor(operation: String, occurrence: String, stepId: String): String =
    "op-" + operation + "-" + stepId + "-" + occurrence
  def childRunKey(operation: String, occurrence: String): String =
    "op-" + operation + "-" + AwaitStep + "-" + occurrence
  def childPersistenceId(operation: String, occurrence: String): String =
    "wafer-child/" + childRunKey(operation, occurrence)

  def persistenceIdFor(operation: String, occurrence: String): PersistenceId = {
    require(operation != null && operation.nonEmpty && occurrence != null && occurrence.nonEmpty,
      "explicit operation and occurrence required")
    PersistenceId.ofUniqueId("wafer-transfer/" + operation + "-" + occurrence)
  }

  private[transactor] final case class TestHooks(
    beforeEffect: (String, String) => Boolean = (_, _) => true,
    beforeChildCheckpoint: () => Boolean = () => true,
    recovered: (Long, ComposedState) => Unit = (_, _) => (),
    stopped: () => Unit = () => ())

  private[transactor] def singletonName(operation: String, occurrence: String): String =
    "composition-" + java.security.MessageDigest.getInstance("SHA-256")
      .digest(persistenceIdFor(operation, occurrence).id.getBytes(
        java.nio.charset.StandardCharsets.UTF_8))
      .map(b => "%02x".format(b & 0xff)).mkString

  /** A stable singleton for this operation; every node gets a proxy, not a second writer. */
  def spawnClusterSingleton(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      splitCoordinator: ActorRef[StrictSagaCoordinator.Command],
      mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],
      childJournal: CompositionChildJournal,
      operation: String,
      occurrence: String
  )(implicit ec: ExecutionContext): ActorRef[Command] =
    spawnClusterSingletonForTest(system, sharding, splitCoordinator, mergeCoordinator,
      childJournal, operation, occurrence, TestHooks())

  private[transactor] def spawnClusterSingletonForTest(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      splitCoordinator: ActorRef[StrictSagaCoordinator.Command],
      mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],
      childJournal: CompositionChildJournal,
      operation: String,
      occurrence: String,
      hooks: TestHooks
  )(implicit ec: ExecutionContext): ActorRef[Command] =
    ClusterSingleton(system).init(SingletonActor(
      build(system, sharding, splitCoordinator, mergeCoordinator, childJournal, operation,
        occurrence, hooks),
      singletonName(operation, occurrence)))

  def behavior(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      splitCoordinator: ActorRef[StrictSagaCoordinator.Command],
      mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],
      childJournal: CompositionChildJournal,
      operation: String,
      occurrence: String
  )(implicit ec: ExecutionContext): Behavior[Command] =
    build(system, sharding, splitCoordinator, mergeCoordinator, childJournal, operation,
      occurrence, TestHooks())

  private[transactor] def behaviorForTest(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      splitCoordinator: ActorRef[StrictSagaCoordinator.Command],
      mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],
      childJournal: CompositionChildJournal,
      operation: String,
      occurrence: String,
      beforeEffect: (String, String) => Boolean
  )(implicit ec: ExecutionContext): Behavior[Command] =
    build(system, sharding, splitCoordinator, mergeCoordinator, childJournal, operation,
      occurrence, TestHooks(beforeEffect = beforeEffect))

  private def build(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      splitCoordinator: ActorRef[StrictSagaCoordinator.Command],
      mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],
      childJournal: CompositionChildJournal,
      operation: String,
      occurrence: String,
      hooks: TestHooks
  )(implicit ec: ExecutionContext): Behavior[Command] =
    Behaviors.setup { ctx =>
      Behaviors.withTimers { timers =>
        // F11 修订（用户裁定 2026-11-21）：四槽可变资源全部算法消解——
        // 子计划 actor 与子 journal 观察流都绑定到本宿主的固定派生 pid，
        // 在 setup 一次性建立并作为不可变 val 持有；定时轮询走 withTimers
        // （同 key 自动替换、停止自动取消，ownerClosed 守卫被结构性取代）。
        val childPid = childPersistenceId(operation, occurrence)
        val childPlanRef = ctx.spawn(
          WaferChildPlan.behavior(PersistenceId.ofUniqueId(childPid)),
          childPid.replace('/', '-'))
        val childWatch = childJournal.watch(childPid)(signal => ctx.self ! ChildSignal(signal))
        new WaferTransferHost(ctx, timers, system, sharding, splitCoordinator,
          mergeCoordinator, childPlanRef, childWatch,
          persistenceIdFor(operation, occurrence), hooks).receive()
      }
    }
}

/** One host actor per (pipeline, operation, occurrence). All effects (saga Start,
  * child StartRun, journal observation) run only after the matching intent event
  * has been persisted (intent-before-start). */
final class WaferTransferHost(
    ctx: ActorContext[WaferTransferHost.Command],
    timers: akka.actor.typed.scaladsl.TimerScheduler[WaferTransferHost.Command],
    system: ActorSystem[_],
    sharding: ClusterSharding,
    splitCoordinator: ActorRef[StrictSagaCoordinator.Command],
    mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],
    childPlanRef: ActorRef[PersistentMonarch.Command[ChildPlanState]],
    childWatch: UniqueKillSwitch,
    val persistenceId: PersistenceId,
    hooks: WaferTransferHost.TestHooks
)(implicit ec: ExecutionContext) {
  import WaferTransferHost._

  private implicit val scheduler: Scheduler = system.scheduler
  private val splitHost = new SplitFixtureHost(system, sharding)
  private val mergeHost = new MergeFixtureHost(system, sharding)
  private val sagaReplySink: ActorRef[StrictSagaCoordinator.Reply] =
    ctx.spawnAnonymous(Behaviors.ignore[StrictSagaCoordinator.Reply])
  private val lotReplySink: ActorRef[LotProtocol.LotReply] =
    ctx.spawnAnonymous(Behaviors.ignore[LotProtocol.LotReply])
  private val beforeEffect = hooks.beforeEffect

  // F11 修订（用户裁定 2026-11-21）：应用树零可变槽。轮询资源 = withTimers
  // 键控定时器；子计划 actor 与观察流 = setup 一次性建立的不可变 val（上）；
  // 生命周期归 akka 结构（withTimers 停止自动取消、ctx.spawn 父子同停、
  // KillSwitch 归宿主在 PostStop 关闭）。

  def receive(): Behavior[Command] =
    EventSourcedBehavior[Command, Event, ComposedState](
      persistenceId,
      ComposedState(None, Map.empty, Map.empty, Map.empty, None),
      (state, command) => onCommand(state, command),
      (state, event) => onEvent(state, event))
      .receiveSignal {
        case (state, akka.persistence.typed.RecoveryCompleted) =>
          hooks.recovered(EventSourcedBehavior.lastSequenceNumber(ctx), state)
          onRecovered(state)
        case (_, akka.actor.typed.PostStop) =>
          childWatch.shutdown()
          hooks.stopped()
      }

  // ── commands（orchestration / observation 两个命名分派组，CC 合同内）──
  private def onCommand(state: ComposedState, command: Command): Effect[Event, ComposedState] =
    command match {
      case ChildSignal(signal) => onChildSignal(state, signal)
      case _ => onRoutedCommand(state, command)
    }

  private def onRoutedCommand(state: ComposedState,
      command: Command): Effect[Event, ComposedState] = command match {
    case PollTick(stepId) =>
      pollSaga(stepId, coordinatorFor(stepId))
      Effect.none
    case _ => onMember(state, command)
  }

  private def onMember(state: ComposedState,
      command: Command): Effect[Event, ComposedState] = command match {
    case _: SagaPolled | _: ChildRefused | _: ChildObserved | _: ChildProgressed =>
      onObservation(state, command)
    case _ => onOrchestration(state, command)
  }

  private def coordinatorFor(stepId: String): ActorRef[StrictSagaCoordinator.Command] =
    if (stepId == MergeStep) mergeCoordinator else splitCoordinator

  private def onOrchestration(state: ComposedState, command: Command): Effect[Event, ComposedState] =
    command match {
      case GetProgress(replyTo) =>
        replyTo ! ProgressReport(state.started.isDefined,
          StepIds.filter(state.checkpoints.contains).map(id =>
            (id, state.checkpoints(id).code)).toVector,
          state.concluded.map(_.code),
          state.intents.get(AwaitStep))
        Effect.none
      case BeginOperation(operation, occurrence, from, to, wafers, manifest, replyTo) =>
        beginOperation(state, operation, occurrence, from, to, wafers, manifest, replyTo)
      case OpenStep(stepId) =>
        openStep(state, stepId)
      case AdvanceAfterCheckpoint(stepId) =>
        advanceAfterCheckpoint(state, stepId)
      case _ => Effect.none
    }

  private def beginOperation(
      state: ComposedState,
      operation: String,
      occurrence: String,
      from: String,
      to: String,
      wafers: Vector[String],
      manifest: String,
      replyTo: ActorRef[OperationReply]
  ): Effect[Event, ComposedState] =
    if (persistenceIdFor(operation, occurrence) != persistenceId) {
      replyTo ! OperationReply(false, "operation does not match this persistence identity")
      Effect.none
    } else if (state.started.isDefined) {
      replyTo ! OperationReply(false, "operation already started (single-writer)")
      Effect.none
    } else {
      val started = OperationStarted(operation, occurrence, from, to, wafers, manifest)
      val intent = InvocationIntentPersisted(SplitStep, txidFor(operation, occurrence, SplitStep))
      Effect.persist(started, intent).thenRun { _: ComposedState =>
        replyTo ! OperationReply(true, "")
      }.thenRun { s: ComposedState =>
        startSagaStep(SplitStep, s)
      }
    }

  private def openStep(state: ComposedState, stepId: String): Effect[Event, ComposedState] =
    if (state.started.isEmpty || state.intents.contains(stepId) || state.terminal) Effect.none
    else if (stepId == AwaitStep) openAwaitStep(state)
    else openSagaStep(state, stepId)

  private def openAwaitStep(state: ComposedState): Effect[Event, ComposedState] = {
    val st = state.started.get
    Effect.persist(InvocationIntentPersisted(AwaitStep,
      childRunKey(st.operation, st.occurrence)))
      .thenRun { s: ComposedState => startChildStep(s) }
  }

  private def openSagaStep(state: ComposedState, sagaStep: String): Effect[Event, ComposedState] = {
    val st = state.started.get
    Effect.persist(InvocationIntentPersisted(sagaStep,
      txidFor(st.operation, st.occurrence, sagaStep)))
      .thenRun { s: ComposedState => startSagaStep(sagaStep, s) }
  }

  private def advanceAfterCheckpoint(state: ComposedState, stepId: String): Effect[Event, ComposedState] =
    if (state.checkpoints.contains(stepId) && !state.terminal) {
      val idx = StepIds.indexOf(stepId)
      if (idx + 1 < StepIds.size) ctx.self ! OpenStep(StepIds(idx + 1))
      Effect.none
    } else Effect.none

  private def onObservation(state: ComposedState, command: Command): Effect[Event, ComposedState] =
    command match {
      case SagaPolled(stepId, reply) => sagaPolled(state, stepId, reply)
      case ChildRefused(reason) => childRefused(state, reason)
      case ChildObserved(observed) => childObserved(state, observed)
      case ChildProgressed(cursor) => childProgressed(state, cursor)
      case _ => Effect.none
    }

  private def onChildSignal(
      state: ComposedState,
      signal: ChildJournalSignal): Effect[Event, ComposedState] = signal match {
    case ChildJournalSignal.RunFinished => onRunFinished(state)
    case ChildJournalSignal.RunFailed(reason) =>
      childObservedCode(state, "ChildFailed", reason)
    case ChildJournalSignal.StageReached(cursor) => childProgressed(state, cursor)
  }

  private def onRunFinished(state: ComposedState): Effect[Event, ComposedState] =
    state.started match {
      case Some(st) => childObservedCode(state, "ChildCompleted", csvOf(st.wafers))
      case None => Effect.none
    }

  private def csvOf(wafers: Vector[String]): String = wafers.mkString(",")

  private def childProgressed(state: ComposedState, cursor: String): Effect[Event, ComposedState] =
    // Derived mirror only — never authoritative for any decision.
    if (state.checkpoints.contains(AwaitStep)) Effect.none
    else Effect.persist(ChildProgressMirrored(cursor))

  private def sagaPolled(
      state: ComposedState,
      stepId: String,
      reply: Try[StrictSagaCoordinator.Reply]
  ): Effect[Event, ComposedState] =
    if (state.started.isEmpty || state.checkpoints.contains(stepId)) Effect.none
    else sagaPolledReply(state, stepId, reply)

  private def sagaPolledReply(
      state: ComposedState,
      stepId: String,
      reply: Try[StrictSagaCoordinator.Reply]
  ): Effect[Event, ComposedState] = reply match {
    case Success(StrictSagaCoordinator.Status(s)) => onPolledStatus(state, stepId, reply, s)
    case Success(StrictSagaCoordinator.ConflictingIdentity) =>
      // Same transaction identity, different payload: fail closed, never retry.
      ctx.log.error("conflicting identity on {}", stepId)
      Effect.persist(OperationConcluded("ConflictingIdentity"))
    case Success(other) =>
      ctx.log.warn("unexpected coordinator reply on {}: {}", stepId, other)
      scheduleNextPoll(stepId)
      Effect.none
    case Failure(t) =>
      // An unanswered poll is never a failure verdict — poll again.
      ctx.log.warn("status poll failed on {}: {}", stepId, t.getMessage)
      scheduleNextPoll(stepId)
      Effect.none
  }

  private def onPolledStatus(
      state: ComposedState,
      stepId: String,
      reply: Try[StrictSagaCoordinator.Reply],
      s: StrictState
  ): Effect[Event, ComposedState] =
    // F10 记档：raw 的 exists(_ => true) 恒真检查已并入 isDefined。
    if (s.identity.isDefined && !state.identities.contains(stepId)) {
      val ident = s.identity.get
      Effect.persist(IdentityObserved(stepId, ident.transactionId, ident.definitionName,
        ident.definitionVersion, ident.argsDigest, ident.definitionDigest,
        ident.argsCodec.id, ident.argsCodec.version, ident.planDigest))
        .thenRun { _: ComposedState => ctx.self ! SagaPolled(stepId, reply) }
    } else onSagaState(stepId, s)

  private def onSagaState(stepId: String, s: StrictState): Effect[Event, ComposedState] =
    if (!s.terminal) {
      scheduleNextPoll(stepId)
      Effect.none
    } else terminalSagaState(stepId, s)

  private def terminalSagaState(stepId: String, s: StrictState): Effect[Event, ComposedState] =
    concludeStep(stepId, s.status match {
      case StrictStatus.Succeeded => "Succeeded"
      case StrictStatus.Aborted => abortedCode(s)
      case StrictStatus.RecoveryRequired => "RecoveryRequired"
      case other => sys.error("unmapped coordinator terminal status: " + other)
    }, s)

  private def abortedCode(s: StrictState): String =
    if (prepareConfirmed(s)) "Compensated" else "Rejected"

  private def prepareConfirmed(s: StrictState): Boolean =
    s.evidence.values.exists {
      case Evidence.Confirmed(op, _) => op.phase == Phase.Prepare
      case _ => false
    }

  private def concludeStep(
      stepId: String,
      code: String,
      s: StrictState
  ): Effect[Event, ComposedState] =
    code match {
      case "Succeeded" if stepId == MergeStep =>
        Effect.persist(
          StepCheckpointed(MergeStep, "Succeeded",
            Map("txid" -> s.identity.map(_.transactionId).getOrElse(""))),
          OperationConcluded("AllStepsSucceeded"))
      case "Succeeded" =>
        Effect.persist(StepCheckpointed(stepId, "Succeeded",
          Map("txid" -> s.identity.map(_.transactionId).getOrElse(""))))
          .thenRun { _: ComposedState => ctx.self ! AdvanceAfterCheckpoint(stepId) }
      case stopCode =>
        Effect.persist(StepCheckpointed(stepId, stopCode, Map.empty),
          OperationConcluded(stopCode))
    }

  private def childRefused(state: ComposedState, reason: String): Effect[Event, ComposedState] =
    if (reason != null && reason.contains("already in state")) {
      // Re-attach: the run exists on the durable journal; keep observing.
      Effect.none
    } else {
      ctx.log.error("child start refused: {}", reason)
      Effect.persist(StepCheckpointed(AwaitStep, "ChildRejected", Map.empty),
        OperationConcluded("ChildRejected"))
    }

  private def childObserved(
      state: ComposedState,
      observed: Option[(String, String)]
  ): Effect[Event, ComposedState] =
    observed match {
      case Some((code, wafersCsv)) => childObservedCode(state, code, wafersCsv)
      case None => Effect.none
    }

  private def childObservedCode(
      state: ComposedState,
      code: String,
      wafersCsv: String
  ): Effect[Event, ComposedState] =
    if (state.checkpoints.contains(AwaitStep) || state.terminal) Effect.none
    else if (!hooks.beforeChildCheckpoint()) Effect.none
    else if (code == "ChildCompleted") {
      val runKey = state.intents.getOrElse(AwaitStep, "")
      Effect.persist(StepCheckpointed(AwaitStep, "ChildCompleted",
        Map("wafers" -> wafersCsv, "childRun" -> runKey)))
        .thenRun { _: ComposedState => ctx.self ! OpenStep(MergeStep) }
    } else {
      Effect.persist(StepCheckpointed(AwaitStep, code, Map.empty), OperationConcluded(code))
    }

  // ── effects（intent 已持久化才运行；启动即发送）──
  private def startSagaStep(stepId: String, state: ComposedState): Unit = {
    require(state.started.isDefined, "step start without a started operation")
    val st = state.started.get
    val txid = state.intents(stepId)
    if (beforeEffect(stepId, txid)) dispatchSagaStart(stepId, state, st, txid)
  }

  private def dispatchSagaStart(
      stepId: String,
      state: ComposedState,
      st: OperationStarted,
      txid: String
  ): Unit = {
    val merge = stepId == MergeStep
    val source = if (merge) mergeSource(state, st, txid) else splitSource(st, txid)
    val start = if (merge)
      WaferMergeSagaModule.waferTransferRequestedTriggerStart(source, mergeHost, sagaReplySink)
    else
      WaferSplitSagaModule.waferTransferRequestedTriggerStart(source, splitHost, sagaReplySink)
    coordinatorFor(stepId) ! start
    pollSaga(stepId, coordinatorFor(stepId))
  }

  private def splitSource(st: OperationStarted, txid: String): LotProtocol.StartTransfer =
    LotProtocol.StartTransfer(txid, st.from, st.to, st.wafers.toList, st.manifest, lotReplySink)

  private def mergeSource(
      state: ComposedState,
      st: OperationStarted,
      txid: String
  ): LotProtocol.StartTransfer =
    // merge consumes the durable completed-child manifest, never a mirror.
    LotProtocol.StartTransfer(txid, st.to, st.from,
      state.checkpoints(AwaitStep).outputs("wafers").split(",").toVector.toList,
      st.manifest, lotReplySink)

  private def pollSaga(
      stepId: String,
      coordinator: ActorRef[StrictSagaCoordinator.Command]
  ): Unit = {
    // GetStatus is read-only and idempotent; overlapping polls are harmless.
    implicit val timeout: Timeout = Timeout(2.seconds)
    coordinator.ask(replyTo => StrictSagaCoordinator.GetStatus(replyTo))
      .onComplete(tried =>
        ctx.self ! SagaPolled(stepId, tried.map(r => r: StrictSagaCoordinator.Reply)))
    ()
  }

  private def scheduleNextPoll(stepId: String): Unit =
    // withTimers 键控单发定时器：同 key 自动替换上一发（raw 的 cancel-and-
    // re-schedule 语义），停止自动取消（raw 的 ownerClosed 守卫被结构性取代）。
    timers.startSingleTimer(stepId, PollTick(stepId), 200.millis)

  private def startChildStep(state: ComposedState): Unit = {
    require(state.started.isDefined, "child start without a started operation")
    val st = state.started.get
    val runKey = state.intents(AwaitStep)
    if (beforeEffect(AwaitStep, runKey)) startChildRun(st, runKey)
  }

  private def startChildRun(st: OperationStarted, runKey: String): Unit = {
    val initial = ChildPlanState(st.wafers, 0)
    askChildRun(childPlanRef, runKey, initial)
  }

  private def askChildRun(
      ref: ActorRef[PersistentMonarch.Command[ChildPlanState]],
      runKey: String,
      initial: ChildPlanState
  ): Unit = {
    implicit val timeout: Timeout = Timeout(5.seconds)
    ref.ask((replyTo: ActorRef[PersistentMonarch.RunReply]) =>
      PersistentMonarch.StartRun(runKey, initial, replyTo)).onComplete {
      case Success(PersistentMonarch.Accepted(_)) => ()
      case Success(PersistentMonarch.Rejected(_, reason)) => ctx.self ! ChildRefused(reason)
      case Success(other) => ctx.log.warn("unexpected child reply: {}", other)
      case Failure(t) =>
        // An unanswered StartRun is unknown, not absent — the durable journal
        // remains the reconciliation face; observation decides, never a timeout.
        ctx.log.warn("child StartRun unanswered: {}", t.getMessage)
    }
  }

  /** 子 journal 观察流在 setup 一次性启动（本宿主的派生 child pid 恒定）：
    * live 从 offset 0 回放历史进同一决策；这是子 run 的唯一权威终态源。
    * D1 拆分：journal 细节在端口实现内，宿主只消费信号；观察者只投递
    * ChildSignal，wafers CSV 在处理时从事件溯源状态读取（started 后恒定，
    * 与 raw 的 watch 时捕获语义等价）。 */

  // ── events（纯；镜像事件先路出，其余五类命名折叠，CC 合同内）──
  private def onEvent(state: ComposedState, event: Event): ComposedState = event match {
    case ChildProgressMirrored(_) => state
    case other => applyDerivedEvent(state, other)
  }

  private def applyDerivedEvent(state: ComposedState, event: Event): ComposedState = event match {
    case started: OperationStarted => state.copy(started = Some(started))
    case intent: InvocationIntentPersisted => state.copy(intents = state.intents +
      (intent.stepId -> intent.key))
    case other => applyLateEvent(state, other)
  }

  private def applyLateEvent(state: ComposedState, event: Event): ComposedState = event match {
    case observed: IdentityObserved => state.copy(identities = state.identities +
      (observed.stepId -> observed))
    case checkpoint: StepCheckpointed => state.copy(checkpoints = state.checkpoints +
      (checkpoint.stepId -> checkpoint))
    case concluded: OperationConcluded => state.copy(concluded = Some(concluded))
    case _ => state
  }

  // ── recovery: confirmed-prefix replay, then reattach every unfinished step ──
  private def onRecovered(state: ComposedState): Unit = {
    if (!state.terminal) state.activeStep match {
      case None => () // every step checkpointed; the conclusion replay follows the same prefix
      case Some(stepId) => resumeStep(state, stepId)
    }
  }

  private def resumeStep(state: ComposedState, stepId: String): Unit = {
    if (state.started.isEmpty) () // fresh actor, empty journal: BeginOperation starts the chain
    else if (!state.intents.contains(stepId)) reopenStep(state, stepId)
    else resumeOpenedStep(state, stepId)
  }

  private def reopenStep(state: ComposedState, stepId: String): Unit = {
    // The step never opened: open it now from the durable start-record
    // (the very first step also needs its OperationStarted, which a
    // confirmed-prefix replay already carries).
    if (stepId == SplitStep) reissueBegin(state) else ctx.self ! OpenStep(stepId)
  }

  private def reissueBegin(state: ComposedState): Unit = {
    val st = state.started.get
    ctx.self ! BeginOperation(st.operation, st.occurrence, st.from, st.to, st.wafers, st.manifest,
      ctx.spawnAnonymous(Behaviors.ignore[OperationReply]))
  }

  private def resumeOpenedStep(state: ComposedState, stepId: String): Unit = stepId match {
    case AwaitStep =>
      // Re-issue StartRun with the same identity: already-in-state means
      // attached (the refusal is swallowed; the setup-live observation
      // continues).
      startChildStep(state)
    case sagaStep => resumeSagaStep(state, sagaStep)
  }

  private def resumeSagaStep(state: ComposedState, sagaStep: String): Unit = {
    // Attach with the carried authoritative identity (zero new saga
    // journal events); without one (Start was never answered), re-issue
    // the idempotent Start with the same transaction id.
    state.identities.get(sagaStep) match {
      case Some(observed) =>
        val coordinator = if (sagaStep == MergeStep) mergeCoordinator else splitCoordinator
        coordinator ! StrictSagaCoordinator.Attach(observed.toIdentity, sagaReplySink)
        scheduleNextPoll(sagaStep)
      case None =>
        startSagaStep(sagaStep, state)
    }
  }
}
