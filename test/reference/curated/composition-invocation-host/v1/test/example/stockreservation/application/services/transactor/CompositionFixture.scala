package example.stockreservation.application.services.transactor

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.{ActorRef, ActorSystem}
import akka.actor.typed.scaladsl.AskPattern._
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity}
import akka.persistence.query.{EventEnvelope, PersistenceQuery}
import akka.persistence.typed.PersistenceId
import akka.stream.{KillSwitches, Materializer, SystemMaterializer, UniqueKillSwitch}
import akka.stream.scaladsl.{Keep, Sink}
import com.typesafe.config.{Config, ConfigFactory}
import example.stockreservation.application.aggregates.LotProtocol
import example.stockreservation.domain.entities.LotState
import net.imadz.infra.saga.strict._
import net.imadz.monarch.persistence.PersistentMonarch
import scala.concurrent.{Await, ExecutionContext}
import scala.concurrent.duration._

/** 测试装置（Support 层）：单节点真实 cluster（self-join）＋真实 ClusterSharding
  * ＋真实 LotEntity（EventSourcedBehavior over persistence-testkit journal）＋
  * 真实两个 wafer 协调器＋真实 WaferTransferHost。子计划观察经
  * CompositionChildJournal 端口接 TestKitChildJournal（persistence-testkit read
  * journal 的实时流——D1 拆分的测试侧绑定）。冷启动预热一次性付清；
  * daemonic=on 保证 JVM 退出；持久化协调器与宿主停止会挂起（#41 实证）——
  * 恢复窗用 crashNextPersisted 令宿主确定崩停后重驱。 */
/** 独立初始化层：shard 实体工厂 lambda 不能落在 Fixture 类内（#41 实证的
  * 类初始化死锁），Kit/Sharding/Fixture 三层拆解沿用。 */
object CompositionKit {
  private val config: Config = ConfigFactory.parseString(
    """
      |akka.daemonic = on
      |akka.actor.provider = cluster
      |akka.remote.artery.canonical.hostname = "127.0.0.1"
      |akka.remote.artery.canonical.port = 25551
      |akka.cluster.seed-nodes = ["akka://composition-quality@127.0.0.1:25551"]
      |akka.cluster.sharding.number-of-shards = 16
      |akka.cluster.sharding.state-store-mode = persistence
      |akka.cluster.sharding.journal-plugin-id = "akka.persistence.testkit.journal"
      |akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
      |akka.persistence.testkit.journal.class = "akka.persistence.testkit.PersistenceTestKitPlugin"
      |akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshot"
      |akka.persistence.testkit.snapshot.class = "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin"
    """.stripMargin)

  val testKit: ActorTestKit = ActorTestKit("composition-quality", config)

  private final class KitShutdown extends Runnable {
    def run(): Unit = testKit.shutdownTestKit()
  }
  private val shutdownHook = new Thread(new KitShutdown)
  Runtime.getRuntime.addShutdownHook(shutdownHook)
}

object CompositionSharding {
  val sharding: ClusterSharding = ClusterSharding(CompositionKit.testKit.system)

  sharding.init(Entity(LotProtocol.entityKey)(ctx => LotProtocol.behavior(ctx.entityId)))
}

/** D1 拆分的测试侧绑定：CompositionChildJournal over the persistence-testkit
  * read journal（live 流）。事件映射与 Mongo 适配器逐项一致。 */
final class TestKitChildJournal(system: ActorSystem[_])(implicit mat: Materializer)
  extends CompositionChildJournal {

  def watch(pid: String)(observer: ChildJournalSignal => Unit): UniqueKillSwitch = {
    val readJournal = PersistenceQuery(system)
      .readJournalFor[akka.persistence.testkit.query.scaladsl.PersistenceTestKitReadJournal](
        "akka.persistence.testkit.query")
    readJournal.eventsByPersistenceId(pid, 0L, Long.MaxValue)
      .viaMat(KillSwitches.single)(Keep.right)
      .toMat(Sink.foreach { envelope =>
        envelope.event match {
          case _: PersistentMonarch.RunCompleted => observer(ChildJournalSignal.RunFinished)
          case failed: PersistentMonarch.RunFailedEvt =>
            observer(ChildJournalSignal.RunFailed(failed.reason))
          case stage: PersistentMonarch.StageDone =>
            observer(ChildJournalSignal.StageReached(stage.cursor))
          case _ => ()
        }
      })(Keep.left)
      .run()
  }
}

object CompositionFixture {

  def testKit: ActorTestKit = CompositionKit.testKit

  def sharding: ClusterSharding = CompositionSharding.sharding

  private implicit val ec: ExecutionContext = ExecutionContext.global
  private implicit val system: ActorSystem[_] = CompositionKit.testKit.system
  private implicit val mat: Materializer = SystemMaterializer(system).materializer

  val testJournal: CompositionChildJournal = new TestKitChildJournal(system)

  private val pidCounter = new java.util.concurrent.atomic.AtomicInteger(0)

  private def counter: Int = pidCounter.incrementAndGet()

  /** 冷启动预热（一次性）：cluster join、sharding 实体首 spawn、lot 首个真实
    * TCC 往返、两个 wafer 模块协调器首 ask 的成本在此付清（独立宽预算）。 */
  private val coldStartWarmup: Unit = {
    seedLot("warmup-lot", Vector("warm-wafer-1", "warm-wafer-2"))
    val warmSplit = spawnSplitCoordinator(CompositionCases.reconcileToken + "-warmup")
    val warmMerge = spawnMergeCoordinator(CompositionCases.reconcileToken + "-warmup")
    implicit val wideTimeout: akka.util.Timeout = akka.util.Timeout(30.seconds)
    require(Await.result(warmSplit.ask[StrictSagaCoordinator.Reply](
      StrictSagaCoordinator.GetStatus(_)), 40.seconds) ==
      StrictSagaCoordinator.Status(StrictState()), "warm split coordinator must start empty")
    require(Await.result(warmMerge.ask[StrictSagaCoordinator.Reply](
      StrictSagaCoordinator.GetStatus(_)), 40.seconds) ==
      StrictSagaCoordinator.Status(StrictState()), "warm merge coordinator must start empty")
  }

  def lotPid(lotId: String): String =
    PersistenceId(LotProtocol.entityKey.name, lotId).id

  def hostPid(operation: String, occurrence: String): String =
    WaferTransferHost.persistenceIdFor(operation, occurrence).id

  def childPid(operation: String, occurrence: String): String =
    WaferTransferHost.childPersistenceId(operation, occurrence)

  /** 在实体首 spawn 前注入蓄库事件（persistence-testkit 直写 recovery journal），
    * 与 #41 的 seedWarehouse 同款确定性播种。 */
  def seedLot(lotId: String, wafers: Vector[String]): Unit = {
    val txid = "seed-" + lotId
    akka.persistence.testkit.scaladsl.PersistenceTestKit(testKit.system)
      .persistForRecovery(lotPid(lotId), Vector(
        example.stockreservation.domain.events.WaferAdditionReserved(txid, wafers.toList),
        example.stockreservation.domain.events.WaferAdditionCommitted(txid, wafers.toList)))
  }

  def stateOfLot(lotId: String): LotState = {
    implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)
    val state = sharding.entityRefFor(LotProtocol.entityKey, lotId)
      .ask[LotState](replyTo => LotProtocol.GetLotState(replyTo))
    Await.result(state, 10.seconds)
  }

  def splitFixtureHost: SplitFixtureHost =
    new SplitFixtureHost(CompositionKit.testKit.system, CompositionSharding.sharding)

  def mergeFixtureHost: MergeFixtureHost =
    new MergeFixtureHost(CompositionKit.testKit.system, CompositionSharding.sharding)

  /** Flow coordinators ride unique journal pids in the strict namespace（#41 同款：
    * entry 固定 pid 是单部署身份，共享 in-memory journal 会跨 flow 撞车）。 */
  /** 最近一次 flow 协调器的 journal pid（行为性质据此直读 saga journal）。 */
  @volatile var lastSplitFlowPid: String = ""
  @volatile var lastMergeFlowPid: String = ""

  /** 预留下一个 split flow journal pid（注入窗先于 spawn 落库——warm 协调器
    * 不读追加事件，注入必须发生在 spawn 之前，G1 同款纪律）。 */
  def reserveSplitFlowPid(): String =
    "strict-saga/wafer-transfer-split-flow-" + counter

  def spawnSplitCoordinator(reconcileToken: String): ActorRef[StrictSagaCoordinator.Command] =
    spawnSplitCoordinatorAt(reserveSplitFlowPid(), reconcileToken)

  def spawnSplitCoordinatorAt(pid: String,
      reconcileToken: String): ActorRef[StrictSagaCoordinator.Command] = {
    lastSplitFlowPid = pid
    testKit.spawn(WaferSplitSagaModule.behavior(
      PersistenceId.ofUniqueId(pid),
      splitFixtureHost, WaferReconcileAuthorizer(reconcileToken)),
      "split-flow-coordinator-" + pid.split('-').last)
  }

  def spawnMergeCoordinator(reconcileToken: String): ActorRef[StrictSagaCoordinator.Command] = {
    val n = counter
    val pid = "strict-saga/wafer-transfer-merge-flow-" + n
    lastMergeFlowPid = pid
    testKit.spawn(WaferMergeSagaModule.behavior(
      PersistenceId.ofUniqueId(pid),
      mergeFixtureHost, WaferReconcileAuthorizer(reconcileToken)),
      "merge-flow-coordinator-" + n)
  }

  def spawnHost(
      operation: String,
      occurrence: String,
      splitCoordinator: ActorRef[StrictSagaCoordinator.Command],
      mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],
      hooks: Option[WaferTransferHost.TestHooks] = None
  ): ActorRef[WaferTransferHost.Command] = hooks match {
    case Some(h) => WaferTransferHost.spawnClusterSingletonForTest(system, sharding,
      splitCoordinator, mergeCoordinator, testJournal, operation, occurrence, h)
    case None =>
      val behavior = WaferTransferHost.behavior(system, sharding, splitCoordinator,
        mergeCoordinator, testJournal, operation, occurrence)
      testKit.spawn(behavior, "composition-" + operation + "-" + occurrence + "-" + counter)
  }

  def begin(
      hostRef: ActorRef[WaferTransferHost.Command],
      operation: String,
      occurrence: String,
      wafers: Vector[String]
  ): WaferTransferHost.OperationReply = {
    val probe = testKit.createTestProbe[WaferTransferHost.OperationReply]()
    hostRef ! WaferTransferHost.BeginOperation(operation, occurrence, CompositionCases.fromLot,
      CompositionCases.toLot, wafers, CompositionCases.manifestSeed, probe.ref)
    probe.receiveMessage(15.seconds)
  }

  def progressOf(hostRef: ActorRef[WaferTransferHost.Command]): WaferTransferHost.ProgressReport = {
    val probe = testKit.createTestProbe[WaferTransferHost.ProgressReport]()
    hostRef ! WaferTransferHost.GetProgress(probe.ref)
    probe.receiveMessage(15.seconds)
  }

  def awaitConcluded(
      hostRef: ActorRef[WaferTransferHost.Command],
      atMost: FiniteDuration = 60.seconds
  ): WaferTransferHost.ProgressReport = {
    val deadline = System.nanoTime() + atMost.toNanos
    var report = progressOf(hostRef)
    while (report.concluded.isEmpty && System.nanoTime() < deadline) {
      Thread.sleep(150)
      report = progressOf(hostRef)
    }
    report
  }

  /** persistence-testkit read journal 的 currentEventsByPersistenceId 直读。 */
  def journalEvents(pid: String): Vector[EventEnvelope] = {
    val readJournal = PersistenceQuery(CompositionKit.testKit.system)
      .readJournalFor[akka.persistence.testkit.query.scaladsl.PersistenceTestKitReadJournal](
        "akka.persistence.testkit.query")
    val events = Await.result(
      readJournal.currentEventsByPersistenceId(pid, 1L, Long.MaxValue)
        .runWith(Sink.seq)(mat), 15.seconds).toVector
    events
  }

  def journalCount(pid: String): Int = journalEvents(pid).size

  /** 下一次持久化写拒绝 → EventSourcedBehavior 持久化失败 → 宿主确定崩停；
    * 同 PID 重驱即恢复窗（persistence-testkit 的 scaladsl 面）。
    * 恢复宿主：崩溃/停止后以同 operation/occurrence 再 spawn。 */
  def crashHostOnNextPersist(operation: String, occurrence: String): Unit =
    akka.persistence.testkit.scaladsl.PersistenceTestKit(testKit.system)
      .rejectNextPersisted(hostPid(operation, occurrence))

  def injectRecoveryPrefix(operation: String, occurrence: String,
      events: Vector[WaferTransferHost.Event]): Unit =
    akka.persistence.testkit.scaladsl.PersistenceTestKit(testKit.system)
      .persistForRecovery(hostPid(operation, occurrence), events)

  /** 恢复宿主：崩溃/停止后以同 operation/occurrence 再 spawn（同 PID 重驱）。 */
  def respawnHost(
      operation: String,
      occurrence: String,
      splitCoordinator: ActorRef[StrictSagaCoordinator.Command],
      mergeCoordinator: ActorRef[StrictSagaCoordinator.Command]
  ): ActorRef[WaferTransferHost.Command] =
    spawnHost(operation, occurrence, splitCoordinator, mergeCoordinator)
}
