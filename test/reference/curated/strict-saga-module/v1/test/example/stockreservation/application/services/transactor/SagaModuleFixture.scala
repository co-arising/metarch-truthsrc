package example.stockreservation.application.services.transactor

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.ActorRef
import akka.persistence.typed.PersistenceId
import com.typesafe.config.ConfigFactory
import example.stockreservation.application.services.transactor.StockTransferSagaModule
import net.imadz.infra.saga.strict._
import scala.concurrent.Await
import scala.concurrent.duration._

/** 测试装置（Support 层）：本地 typed ActorSystem＋persistence-testkit journal
  * （journal 事件经 saga-core reference.conf 绑定走真实 strict-saga protobuf
  * 序列化链）。daemonic=on 保证 JVM 退出；关闭钩子兜底等待终止。协调器经模块
  * behavior 装配；PID 每次评估唯一（共享 journal 按键隔离）。 */
object SagaModuleFixture {
  private val config = ConfigFactory.parseString(
    """
      |akka.daemonic = on
      |akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
      |akka.persistence.testkit.journal.class = "akka.persistence.testkit.PersistenceTestKitPlugin"
      |akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshot"
      |akka.persistence.testkit.snapshot.class = "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin"
    """.stripMargin)

  val testKit: ActorTestKit = ActorTestKit("saga-module-quality", config)

  private implicit val ec: scala.concurrent.ExecutionContext =
    scala.concurrent.ExecutionContext.global

  private final class KitShutdown extends Runnable {
    def run(): Unit = testKit.shutdownTestKit()
  }
  private val shutdownHook = new Thread(new KitShutdown)
  Runtime.getRuntime.addShutdownHook(shutdownHook)

  private val pidCounter = new java.util.concurrent.atomic.AtomicInteger(0)

  def nextPid(prefix: String): String = prefix + "-" + pidCounter.incrementAndGet()

  /** 冷启动预热（一次性）：ActorTestKit/序列化栈的类装载与系统初始化成本在此
    * 付清（独立宽预算，仅此一次），任何性质内的 ask 都不再承担冷启动——
    * per-ask 预算保持 5 秒紧口径。 */
  private val coldStartWarmup: StrictState = {
    import akka.actor.typed.scaladsl.AskPattern._
    val warmHost = new ProbeHost(new ProbeArgsCodec(
      net.imadz.infra.saga.strict.CodecPin("stock-transfer-args", 1)),
      StrictSagaCoordinator.Settings(1000.millis, 32))
    val warmRef = spawnCoordinator(warmHost, new ProbeAuthorizer, nextPid("warmup"))
    val warmReply = warmRef.ask[StrictSagaCoordinator.Reply](
      StrictSagaCoordinator.GetStatus(_))(30.seconds, testKit.scheduler)
    val warmState = Await.result(warmReply, 40.seconds) match {
      case StrictSagaCoordinator.Status(state) => state
      case other => throw new IllegalStateException("unexpected warmup reply: " + other)
    }
    testKit.stop(warmRef)
    warmState
  }
  require(coldStartWarmup.status == StrictStatus.Empty, "warm coordinator must start empty")

  def spawnCoordinator(host: ProbeHost, authorizer: ProbeAuthorizer, pid: String
  ): ActorRef[StrictSagaCoordinator.Command] =
    testKit.spawn(StockTransferSagaModule.behavior(PersistenceId.ofUniqueId(pid), host,
      authorizer), pid)

  def askReply(ref: ActorRef[StrictSagaCoordinator.Command])(
      build: ActorRef[StrictSagaCoordinator.Reply] => StrictSagaCoordinator.Command
  ): StrictSagaCoordinator.Reply = {
    import akka.actor.typed.scaladsl.AskPattern._
    val reply = ref.ask[StrictSagaCoordinator.Reply](replyTo => build(replyTo))(5.seconds,
      testKit.scheduler)
    Await.result(reply, 10.seconds)
  }

  def start(ref: ActorRef[StrictSagaCoordinator.Command], host: ProbeHost,
      transactionId: String): StrictSagaCoordinator.Reply =
    askReply(ref)(replyTo => StrictSagaCoordinator.Start(transactionId,
      host.argsCodec.encode(host.argsValue), replyTo))

  def stateOf(ref: ActorRef[StrictSagaCoordinator.Command]): StrictState =
    askReply(ref)(StrictSagaCoordinator.GetStatus(_)) match {
      case StrictSagaCoordinator.Status(state) => state
      case other => throw new IllegalStateException("unexpected reply: " + other)
    }

  /** 轮询直到终态或 RecoveryRequired（协调器异步推进；无活期定时器下快速收敛）。 */
  def awaitStable(ref: ActorRef[StrictSagaCoordinator.Command],
      atMost: FiniteDuration): StrictState = {
    val deadline = System.nanoTime() + atMost.toNanos
    var state = stateOf(ref)
    while (!state.terminal && state.status != StrictStatus.RecoveryRequired &&
        System.nanoTime() < deadline) {
      Thread.sleep(20)
      state = stateOf(ref)
    }
    state
  }
}
