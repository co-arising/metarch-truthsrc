package example.stockreservation.application.services.transactor

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.ActorRef
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity}
import akka.persistence.typed.PersistenceId
import com.typesafe.config.{Config, ConfigFactory}
import example.stockreservation.application.aggregates.{TransferStockCommand, WarehouseProtocol}
import example.stockreservation.domain.entities.WarehouseState
import example.stockreservation.domain.events.StockRestocked
import java.util.UUID
import net.imadz.infra.saga.strict._
import scala.concurrent.Await
import scala.concurrent.duration._

/** 测试装置（Support 层）：单节点真实 cluster（self-join）＋真实 ClusterSharding
  * ＋真实 WarehouseEntity（EventSourcedBehavior over persistence-testkit journal，
  * 协调器 journal 事件仍走 saga-core 绑定的真实 strict-saga protobuf 序列化链）。
  * FixtureHost 经 ClusterSharding 的 ask 全部真实。冷启动预热一次性付清
  * （cluster join＋sharding 首 ask＋实体首 spawn），per-ask 预算 5 秒紧口径。
  * daemonic=on 保证 JVM 退出。 */
/** 测试装置的独立初始化层（Support 层）：把 testKit 与 sharding.init 各自拆进
  * 独立 object——shard 实体工厂 lambda 不能落在 SagaEntryFixture 类内，否则
  * warmup 的首个 sharding ask 会在实体 spawn 时反向等待 Fixture 自身的
  * clinit，形成类初始化死锁（实证：30s ask 超时＋实体工厂栈挂起）。 */
object SagaEntryKit {
  private val config: Config = ConfigFactory.parseString(
    """
      |akka.daemonic = on
      |akka.actor.provider = cluster
      |akka.remote.artery.canonical.hostname = "127.0.0.1"
      |akka.remote.artery.canonical.port = 25551
      |akka.cluster.seed-nodes = ["akka://fixture-host-quality@127.0.0.1:25551"]
      |akka.cluster.sharding.number-of-shards = 16
      |akka.cluster.sharding.state-store-mode = persistence
      |akka.cluster.sharding.journal-plugin-id = "akka.persistence.testkit.journal"
      |akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
      |akka.persistence.testkit.journal.class = "akka.persistence.testkit.PersistenceTestKitPlugin"
      |akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshot"
      |akka.persistence.testkit.snapshot.class = "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin"
    """.stripMargin)

  val testKit: ActorTestKit = ActorTestKit("fixture-host-quality", config)

  private final class KitShutdown extends Runnable {
    def run(): Unit = testKit.shutdownTestKit()
  }
  private val shutdownHook = new Thread(new KitShutdown)
  Runtime.getRuntime.addShutdownHook(shutdownHook)
}

object SagaEntrySharding {
  val sharding: ClusterSharding = ClusterSharding(SagaEntryKit.testKit.system)

  sharding.init(Entity(WarehouseProtocol.entityKey)(ctx =>
    WarehouseProtocol.behavior(ctx.entityId)))
}

object SagaEntryFixture {

  def testKit: ActorTestKit = SagaEntryKit.testKit

  def sharding: ClusterSharding = SagaEntrySharding.sharding

  private implicit val ec: scala.concurrent.ExecutionContext =
    scala.concurrent.ExecutionContext.global

  val host: FixtureHost = new FixtureHost(SagaEntryKit.testKit.system, SagaEntrySharding.sharding)

  private val pidCounter = new java.util.concurrent.atomic.AtomicInteger(0)

  /** 冷启动预热（一次性）：cluster join、sharding 实体首 spawn、host 首个真实
    * 相位 ask、entry 首个协调器 ask 的成本在此付清（独立宽预算，仅此一次）。 */
  private val coldStartWarmup: Unit = {
    import akka.actor.typed.scaladsl.AskPattern._
    val warmCoordinator = spawnCoordinator(SagaEntryOracle.reconcileToken + "-warmup")
    val warmStatus = Await.result(
      warmCoordinator.ask[StrictSagaCoordinator.Reply](
        StrictSagaCoordinator.GetStatus(_))(30.seconds, testKit.scheduler), 40.seconds)
    require(warmStatus == StrictSagaCoordinator.Status(StrictState()),
      "warm coordinator must start empty")
    // the warm coordinator idles for the JVM lifetime (stopping a persistence
    // coordinator hangs in the testkit; daemonic JVM exit reclaims it)
    val warmWarehouse = SagaEntryCases.nextWarehouseId
    seedWarehouse(warmWarehouse, SagaEntryCases.skuAlpha, 100)
    // wide-budget direct state ask first: pays the shard region + entity spawn
    // cost that would exceed the host's pinned 1s interaction timeout
    stateOfWarehouseWide(warmWarehouse)
    val warmIdentity = SagaEntryCases.hostIdentity(
      "warmup-" + warmWarehouse.toString.take(8), warmWarehouse.toString)
    val warmOutcome = Await.result(
      host.reserveSourceStockPrepareBinding.execute(warmIdentity,
        StockTransferSagaModule.ReserveSourceStockPrepareInput(
          warmIdentity.transaction.transactionId, warmWarehouse,
          SagaEntryCases.skuAlpha, 10)),
      40.seconds)
    require(warmOutcome.isInstanceOf[ConfirmedReceipt[_]],
      "warm reserve interaction must confirm: " + warmOutcome)
  }

  def warehousePid(id: UUID): String =
    PersistenceId(WarehouseProtocol.entityKey.name, id.toString).id

  /** 在实体首 spawn 前注入蓄库事件（persistence-testkit 直写 recovery journal）。 */
  def seedWarehouse(id: UUID, sku: String, quantity: Int): Unit =
    akka.persistence.testkit.scaladsl.PersistenceTestKit(testKit.system)
      .persistForRecovery(warehousePid(id), Vector(StockRestocked(sku, quantity)))

  private def stateOfWarehouseWide(id: UUID): WarehouseState = {
    import akka.actor.typed.scaladsl.AskPattern._
    implicit val timeout: akka.util.Timeout = akka.util.Timeout(30.seconds)
    val state = sharding.entityRefFor(WarehouseProtocol.entityKey, id.toString)
      .ask[WarehouseState](replyTo => WarehouseProtocol.GetWarehouseState(replyTo))
    Await.result(state, 40.seconds)
  }

  def stateOfWarehouse(id: UUID): WarehouseState = {
    import akka.actor.typed.scaladsl.AskPattern._
    implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)
    val state = sharding.entityRefFor(WarehouseProtocol.entityKey, id.toString)
      .ask[WarehouseState](replyTo => WarehouseProtocol.GetWarehouseState(replyTo))
    Await.result(state, 10.seconds)
  }

  /** Flow coordinators ride unique journal pids in the strict namespace: the
    * entry's fixed module pid is a single-deployment identity and the shared
    * in-memory journal would collide across flow properties in one JVM. */
  def spawnCoordinator(reconcileToken: String): ActorRef[StrictSagaCoordinator.Command] =
    testKit.spawn(StockTransferSagaModule.behavior(
      PersistenceId.ofUniqueId("strict-saga/stock-transfer-flow-" +
        pidCounter.incrementAndGet()), host, FixtureReconcileAuthorizer(reconcileToken)),
      "flow-coordinator-" + pidCounter.incrementAndGet())

  def coordinatorStatus(ref: ActorRef[StrictSagaCoordinator.Command]): StrictState =
    Await.result(StockTransferSagaEntry.status(ref)(akka.util.Timeout(5.seconds),
      testKit.scheduler, ec), 10.seconds)

  def startCommand(ref: ActorRef[StrictSagaCoordinator.Command],
      command: TransferStockCommand): StrictSagaCoordinator.Reply = {
    val probe = testKit.createTestProbe[StrictSagaCoordinator.Reply]()
    ref ! StockTransferSagaEntry.start(ref, host, command, probe.ref)
    probe.receiveMessage(10.seconds)
  }

  def awaitStable(ref: ActorRef[StrictSagaCoordinator.Command],
      atMost: FiniteDuration): StrictState = {
    val deadline = System.nanoTime() + atMost.toNanos
    var state = coordinatorStatus(ref)
    while (!state.terminal && state.status != StrictStatus.RecoveryRequired &&
        System.nanoTime() < deadline) {
      Thread.sleep(200)
      state = coordinatorStatus(ref)
    }
    state
  }
}
