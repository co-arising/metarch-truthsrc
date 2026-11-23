package example.bankwealth.application

import java.util.concurrent.atomic.AtomicInteger

import scala.concurrent.{Await, Future}
import scala.concurrent.duration._

import akka.actor.typed.{ActorRef, Scheduler}
import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.util.Timeout
import com.typesafe.config.ConfigFactory
import org.scalacheck.Gen

import example.bankwealth.domain.values._
import akka.persistence.testkit.scaladsl.PersistenceTestKit

/** 效果面判例与生成器（Support 层）：观测判例按 checked 契约逐 status 合法构造、
  * 探针回调三面（execute/query/reconcile，recording＋armed）、本地 typed
  * ActorSystem 装置（persistence-testkit journal，serialize=false——序列化正确性
  * 由 serializer 性质独立证明）。dispatch 与 ta 共享一个形状、两套判例常数。 */
object BankEffectOracle {

  val StatusWires: Vector[String] = Vector("confirmed", "rejected", "failed", "absent", "unknown")
  val DecisionWires: Vector[String] = Vector("query", "retry")
  val Version: String = "bank-v1-1"
  val ReconcileToken: String = "bank-effect-quality-token"

  val genToken: Gen[String] = Gen.nonEmptyListOf(Gen.alphaNumChar).map(_.mkString)
  val genMoney: Gen[Money] =
    for { whole <- Gen.chooseNum(1L, 100000000L); cents <- Gen.chooseNum(0, 99) }
      yield Money(BigDecimal(s"$whole.$cents"), "CNY")
  val genOperationId: Gen[OperationId] = genToken.map(OperationId)
  val genOccurrenceId: Gen[OccurrenceId] = genToken.map(OccurrenceId)
  val genAccountId: Gen[AccountId] = genToken.map(AccountId)
  val genFundOrderId: Gen[FundOrderId] = genToken.map(FundOrderId)
  val genTxId: Gen[TxId] = genToken.map(TxId)
  val genPlanId: Gen[PlanId] = genToken.map(PlanId)
  val genRevisionId: Gen[RevisionId] = genToken.map(RevisionId)

  val genSipOccurrence: Gen[SipOccurrence] =
    for {
      planId <- genPlanId
      revision <- genRevisionId
      dueSlot <- Gen.chooseNum(0L, 400L)
      occurrenceId <- genOccurrenceId
      operationId <- genOperationId
      fundOrderId <- genFundOrderId
      configRevision <- genRevisionId
      configSlot <- Gen.chooseNum(0L, 400L)
      investor <- genAccountId
      collection <- genAccountId
      fundCode <- genToken
      amount <- genMoney
      config = SipRevisionConfig(configRevision, configSlot, investor, collection, fundCode, amount)
    } yield SipOccurrence(planId, revision, dueSlot, occurrenceId, operationId, fundOrderId, config)

  val genDispatchState: Gen[BankSipDispatchExecution.State] =
    for { occurrenceId <- genOccurrenceId; occurrence <- genSipOccurrence }
      yield BankSipDispatchExecution.State(BankSipDispatchExecution.Inputs(occurrenceId, occurrence), None)
  val genSettledDispatch: Gen[BankSipDispatchExecution.State] =
    for { state <- genDispatchState; operationId <- genOperationId }
      yield state.copy(operationId = Some(operationId))

  val genTaState: Gen[BankTaSubmissionExecution.State] =
    for { taRequestId <- genToken.map(TaRequestId); fundOrderId <- genFundOrderId; paymentTxId <- genTxId }
      yield BankTaSubmissionExecution.State(BankTaSubmissionExecution.Inputs(taRequestId, fundOrderId, paymentTxId), None)

  /** 按 checked 契约合法构造的观测：confirmed 必带 result 与证据，rejected/failed/
    * absent 必无 result 且证据在场，unknown 必无 result。 */
  def dispatchObservation(operation: String, request: BankSipDispatchRequest, status: String,
      evidence: String): BankSipDispatchObservation = {
    val result = status match {
      case "confirmed" => Some(BankSipDispatchResult(OperationId(operation)))
      case _ => None
    }
    BankSipDispatchObservation(operation, request, status, evidence, result)
  }

  def taObservation(operation: String, request: BankTaEffectRequest, status: String,
      evidence: String): BankTaEffectObservation = {
    val result = status match {
      case "confirmed" => Some(BankTaEffectResult(TaRequestId(operation)))
      case _ => None
    }
    BankTaEffectObservation(operation, request, status, evidence, result)
  }

  val genForeignStatus: Gen[String] =
    for {
      length <- Gen.chooseNum(0, 24)
      chars <- Gen.listOfN(length, Gen.oneOf(Gen.alphaLowerChar, Gen.numChar, Gen.const('-')))
      wire = chars.mkString
      if !StatusWires.contains(wire)
    } yield wire

  val genForeignDecision: Gen[String] =
    for {
      length <- Gen.chooseNum(0, 12)
      chars <- Gen.listOfN(length, Gen.oneOf(Gen.alphaLowerChar, Gen.numChar))
      wire = chars.mkString
      if !DecisionWires.contains(wire)
    } yield wire
}

/** 效果回调探针（Support 层）：默认 execute 确认、query 无证据、reconcile 放行；
  * armed faces 逐场景注入失败/替代观测/拒绝。 */
final class BankDispatchProbe {
  import BankEffectOracle._

  val executeCalls = new Recorder[BankSipDispatchOperation]
  val queryCalls = new Recorder[BankSipDispatchOperation]
  val reconcileCalls = new Recorder[BankSipDispatchReconcile]

  var executeObservation: Option[BankSipDispatchObservation] = None
  var executeThrows: Option[String] = None
  var queryObservation: Option[BankSipDispatchObservation] = None
  var reconcileAllowed: Boolean = true

  private def binding[I, O](name: String)(f: I => Future[O]): BankSipDispatchEffectHost.EffectBinding[I, O] =
    BankSipDispatchEffectHost.EffectBinding[I, O]("bankwealth." + name, Version, f)

  private def confirmed(operation: BankSipDispatchOperation): BankSipDispatchObservation =
    dispatchObservation(operation.operation, operation.request, "confirmed", "dispatch-receipt")

  def bindings: BankSipDispatchEffectHost.Bindings = BankSipDispatchEffectHost.Bindings(
    execute = binding[BankSipDispatchOperation, BankSipDispatchObservation]("BankSipDispatchExecute") { input =>
      executeCalls.record(input)
      executeThrows match {
        case Some(reason) => Future.failed(new IllegalStateException(reason))
        case None => Future.successful(executeObservation.getOrElse(confirmed(input)))
      }
    },
    query = binding[BankSipDispatchOperation, Option[BankSipDispatchObservation]]("BankSipDispatchQuery") { input =>
      queryCalls.record(input)
      queryObservation match {
        case Some(observation) => Future.successful(Some(observation))
        case None => Future.successful(None)
      }
    },
    reconcile = binding[BankSipDispatchReconcile, Boolean]("BankSipDispatchReconcilePort") { input =>
      reconcileCalls.record(input)
      if (reconcileAllowed) Future.successful(true) else Future.successful(false)
    },
  )

  def installed: BankSipDispatchEffectHost.Installed = BankSipDispatchEffectHost.install(bindings)
}

final class BankTaProbe {
  import BankEffectOracle._

  val executeCalls = new Recorder[BankTaEffectOperation]
  val queryCalls = new Recorder[BankTaEffectOperation]
  val reconcileCalls = new Recorder[BankTaEffectReconcile]

  var executeObservation: Option[BankTaEffectObservation] = None
  var executeThrows: Option[String] = None
  var queryObservation: Option[BankTaEffectObservation] = None
  var reconcileAllowed: Boolean = true

  private def binding[I, O](name: String)(f: I => Future[O]): BankTaEffectHost.EffectBinding[I, O] =
    BankTaEffectHost.EffectBinding[I, O]("bankwealth." + name, Version, f)

  private def confirmed(operation: BankTaEffectOperation): BankTaEffectObservation =
    taObservation(operation.operation, operation.request, "confirmed", "ta-receipt")

  def bindings: BankTaEffectHost.Bindings = BankTaEffectHost.Bindings(
    execute = binding[BankTaEffectOperation, BankTaEffectObservation]("BankTaEffectExecute") { input =>
      executeCalls.record(input)
      executeThrows match {
        case Some(reason) => Future.failed(new IllegalStateException(reason))
        case None => Future.successful(executeObservation.getOrElse(confirmed(input)))
      }
    },
    query = binding[BankTaEffectOperation, Option[BankTaEffectObservation]]("BankTaEffectQuery") { input =>
      queryCalls.record(input)
      queryObservation match {
        case Some(observation) => Future.successful(Some(observation))
        case None => Future.successful(None)
      }
    },
    reconcile = binding[BankTaEffectReconcile, Boolean]("BankTaEffectReconcilePort") { input =>
      reconcileCalls.record(input)
      if (reconcileAllowed) Future.successful(true) else Future.successful(false)
    },
  )

  def installed: BankTaEffectHost.Installed = BankTaEffectHost.install(bindings)
}

/** 本地 typed ActorSystem 装置（Support 层）：persistence-testkit journal；
  * PID 每次评估唯一；关闭钩子兜底终止。 */
object BankEffectFixture {
  private val config = ConfigFactory.parseString(
    """
      |akka.daemonic = on
      |akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
      |akka.persistence.testkit.journal.class = "akka.persistence.testkit.PersistenceTestKitPlugin"
      |akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshot"
      |akka.persistence.testkit.snapshot.class = "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin"
      |akka.persistence.testkit.events.serialize = false
    """.stripMargin)

  val testKit: ActorTestKit = ActorTestKit("effect-face-quality", config)
  val journal: PersistenceTestKit = PersistenceTestKit(testKit.system)

  implicit private val ec: scala.concurrent.ExecutionContext = scala.concurrent.ExecutionContext.global
  implicit private val timeout: Timeout = Timeout(10.seconds)
  implicit private val scheduler: Scheduler = testKit.scheduler

  private val shutdownHook = new Thread(() => testKit.shutdownTestKit())
  Runtime.getRuntime.addShutdownHook(shutdownHook)

  private val pidCounter = new AtomicInteger(0)
  def nextPid(prefix: String): String = prefix + "-" + pidCounter.incrementAndGet()

  def spawnDispatch(probe: BankDispatchProbe, pid: String): ActorRef[BankSipDispatchEffectHost.Request] =
    testKit.spawn(BankSipDispatchEffectHost(pid, probe.installed))

  def spawnTa(probe: BankTaProbe, pid: String): ActorRef[BankTaEffectHost.Request] =
    testKit.spawn(BankTaEffectHost(pid, probe.installed))

  def invoke[Request, Reply](ref: ActorRef[Request], build: ActorRef[Reply] => Request): Reply = {
    import akka.actor.typed.scaladsl.AskPattern._
    Await.result(ref.ask[Reply](build), 10.seconds)
  }

  /** 轮询探针记录直至满足宽限到期（回调经 actor 异步落账；有界忙等）。 */
  def awaitProbe[A](recorder: Recorder[A], expected: Int, atMost: FiniteDuration): Boolean = {
    val deadline = System.nanoTime() + atMost.toNanos
    while (recorder.size < expected && System.nanoTime() < deadline) Thread.sleep(10)
    recorder.size >= expected
  }

  def events(pid: String): Vector[Any] = journal.persistedInStorage(pid).toVector
  def resetJournal(): Unit = journal.clearAll()
}
