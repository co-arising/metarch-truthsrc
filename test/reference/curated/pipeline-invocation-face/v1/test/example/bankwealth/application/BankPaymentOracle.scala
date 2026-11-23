package example.bankwealth.application

import java.security.MessageDigest
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger

import scala.concurrent.{Await, Future}
import scala.concurrent.duration._
import scala.jdk.CollectionConverters._

import akka.actor.typed.{ActorRef, Scheduler}
import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.util.Timeout
import com.google.protobuf.ByteString
import com.typesafe.config.ConfigFactory
import org.scalacheck.Gen

import example.bankwealth.domain.values._
import net.imadz.infra.saga.strict._
import akka.persistence.testkit.scaladsl.PersistenceTestKit

/** 判例与生成器（Support 层）：判定常数独立重抄（双记账——金样常数漂移即失败）、
  * 领域值生成器、探针技术端口（recording＋armed faces，经 BankPaymentPortBindings
  * 的精确身份校验合法拼装）与本地 typed ActorSystem 装置（persistence-testkit
  * journal，serialize=false：序列化正确性由 serializer 性质独立证明，journal
  * 断言只看事件事实本身）。 */
object BankPaymentOracle {

  // ---- 双记账常数：与金样独立重抄，漂移即性质失败 ----------------------------

  val SagaId: String = "bank-cash-payment-v1"
  val SagaVersion: String = "bank-v1-1"
  val DefinitionVersion: Int = 1
  val DefinitionDigest: String =
    "sha256:c13f703e76eaee9bfceeff701ecc5f41dd011d6db6890c6820a7faa944538f64"
  val InvocationScheme: String = "truthsrc-pipeline-invocation-v1"
  val PipelineStep: String = "pay-cash-purchase"
  val InvocationMarkers: Vector[String] = Vector("iteration", "absent", "chunk", "absent")
  val ArgsPin: CodecPin = CodecPin("BankPaymentArgs", 1)
  val ResultWires: Vector[String] =
    Vector("succeeded", "rejected-before-effects", "compensated", "recovery-required", "outcome-unknown")
  val TerminalWires: Set[String] = Set("succeeded", "rejected-before-effects", "compensated")

  /** 定义摘要带 scheme 前缀；逐 args 摘要是不带前缀的裸十六进制（协调器口径）。 */
  def hexSha256(bytes: Array[Byte]): String =
    MessageDigest.getInstance("SHA-256").digest(bytes).iterator.map(b => f"${b & 0xff}%02x").mkString

  /** 独立重抄的持久操作身份（长度前缀＋SHA-256，与协调器/金样双记账）。 */
  def operationIdentity(state: BankCashPaymentExecution.State): String = {
    val parts = Vector(InvocationScheme, "bankwealth", SagaId, SagaVersion, SagaId, SagaVersion,
      PipelineStep, state.inputs.operation.value, state.inputs.occurrence.value) ++ InvocationMarkers
    val buffer = new java.io.ByteArrayOutputStream
    val out = new java.io.DataOutputStream(buffer)
    parts.foreach { part =>
      val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      out.writeInt(bytes.length)
      out.write(bytes)
    }
    "sha256:" + hexSha256(buffer.toByteArray)
  }

  def argsBytes(state: BankCashPaymentExecution.State): ByteString =
    BankPaymentSagaDefinition.argsCodec.encode(BankPaymentHost.invocationArgs(state))

  /** 协调器口径的权威身份（host 纯函数性质用的双记账形；plan 摘要取定义摘要
    * 的 canonical 形——validStatus 不比对该槽，proto 转换器只验格式）。 */
  def identity(operation: String, args: ByteString): TransactionIdentity =
    TransactionIdentity(operation, SagaId, DefinitionVersion, hexSha256(args.toByteArray),
      DefinitionDigest, ArgsPin, DefinitionDigest)

  /** 协调器口径的参与方描述子（与定义的 codec pin 双记账，proto 可转换）。 */
  def participants(state: BankCashPaymentExecution.State): Vector[ParticipantDescriptor] = {
    val args = BankPaymentHost.invocationArgs(state)
    def pins(name: String): Vector[ReceiptCodecPin] = Vector(Phase.Prepare, Phase.Commit, Phase.Compensate)
      .map(phase => ReceiptCodecPin(phase, CodecPin("bank-payment-" + name + "-" +
        phase.toString.toLowerCase(java.util.Locale.ROOT), 1)))
    Vector(
      ParticipantDescriptor("reserve-investor-funds", "investorCreditBalance",
        args.investorAccountId.value, Vector(Phase.Prepare, Phase.Commit, Phase.Compensate),
        pins("reserve-investor-funds")),
      ParticipantDescriptor("credit-fund-collection", "collectionCreditBalance",
        args.fundCollectionAccountId.value, Vector(Phase.Prepare, Phase.Commit, Phase.Compensate),
        pins("credit-fund-collection")),
      ParticipantDescriptor("reserve-cash-fund-order", "orderFundOrderTCC",
        args.fundOrderId.value, Vector(Phase.Prepare, Phase.Commit, Phase.Compensate),
        pins("reserve-cash-fund-order")))
  }

  /** 协调器口径的权威状态（含真实参与方与可注入的证据面，proto 可转换）。 */
  def strictState(state: BankCashPaymentExecution.State, status: StrictStatus,
      evidence: Map[OperationIdentity, Evidence] = Map.empty): StrictState = {
    val args = argsBytes(state)
    StrictState(Some(identity(operationIdentity(state), args)), args,
      participants = participants(state), status = status, evidence = evidence)
  }

  // ---- 生成器 ---------------------------------------------------------------

  val genToken: Gen[String] = Gen.nonEmptyListOf(Gen.alphaNumChar).map(_.mkString)
  val genMoney: Gen[Money] =
    for { whole <- Gen.chooseNum(1L, 100000000L); cents <- Gen.chooseNum(0, 99) }
      yield Money(BigDecimal(s"$whole.$cents"), "CNY")
  val genOperationId: Gen[OperationId] = genToken.map(OperationId)
  val genAccountId: Gen[AccountId] = genToken.map(AccountId)
  val genFundOrderId: Gen[FundOrderId] = genToken.map(FundOrderId)
  val genTxId: Gen[TxId] = genToken.map(TxId)

  val genInputs: Gen[BankCashPaymentExecution.Inputs] =
    for {
      operation <- genOperationId
      occurrence <- genOperationId
      investorAccountId <- genAccountId
      fundCollectionAccountId <- genAccountId
      fundOrderId <- genFundOrderId
      amount <- genMoney
      fundCode <- genToken
      if investorAccountId != fundCollectionAccountId
    } yield BankCashPaymentExecution.Inputs(operation, occurrence, investorAccountId,
      fundOrderId, fundCollectionAccountId, amount, fundCode)

  val genState: Gen[BankCashPaymentExecution.State] = genInputs.map(BankCashPaymentExecution.State(_, None))
  val genSettledState: Gen[BankCashPaymentExecution.State] =
    for { state <- genState; txid <- genTxId } yield state.copy(paymentTxid = Some(txid))
  val genArgs: Gen[BankPaymentArgs] =
    for { investor <- genAccountId; order <- genFundOrderId; collection <- genAccountId; amount <- genMoney }
      yield BankPaymentArgs(investor, order, collection, amount)
  val genResultKind: Gen[BankPaymentHost.ResultKind] = Gen.oneOf(BankPaymentHost.ResultKind.all)

  /** 近邻采样：字母／数字／连字符拼出的任意 wire，过滤后即未知 wire 空间。 */
  val genForeignWire: Gen[String] =
    for {
      length <- Gen.chooseNum(0, 24)
      chars <- Gen.listOfN(length, Gen.oneOf(Gen.alphaLowerChar, Gen.numChar, Gen.const('-')))
      wire = chars.mkString
      if !ResultWires.contains(wire)
    } yield wire

  val genAttempt: Gen[Int] = Gen.chooseNum(0, 40)
}

/** 录制器（Support 层）：跨 actor 线程的探测记录。 */
final class Recorder[A] {
  private val queue = new ConcurrentLinkedQueue[A]
  def record(value: A): Unit = { queue.add(value); () }
  def snapshot: Vector[A] = queue.iterator().asScala.toVector
  def size: Int = snapshot.size
}

/** 探针技术端口拼装（Support 层）：默认全通（正确回执），armed faces 逐场景
  * 注入拒绝／失败／漂移。回执经 checkedPhasePort 的身份围栏检验，因此回执身份
  * 七元组严格取自请求身份本身。 */
final class BankPaymentProbe {
  import BankPaymentProbe._
  import BankPaymentOracle._

  val entryCalls = new Recorder[BankPaymentOriginal]
  val associationCalls = new Recorder[BankPaymentOriginal]
  val phaseCalls = new Recorder[String]
  val authorityCalls = new Recorder[String]
  val deliveryCalls = new Recorder[String]

  var entryAllowed: Boolean = true
  var entryFailure: Option[String] = None
  var associationAllowed: Boolean = true
  var authorityResult: Option[BankPaymentResult] = None
  var authorityFailure: Option[String] = None
  var deliveryFailure: Boolean = false
  var armedOverrun: Option[String] = None
  var commitNotExecuted: Boolean = false
  var prepareNotExecuted: Boolean = false
  var prepareUnknown: Boolean = false

  def reset(): Unit = {
    entryAllowed = true; entryFailure = None; associationAllowed = true
    authorityResult = None; authorityFailure = None; deliveryFailure = false
    armedOverrun = None; commitNotExecuted = false
    prepareNotExecuted = false; prepareUnknown = false
  }

  private def participant(value: String): String = armedOverrun.getOrElse(value)
  private def lowerPhase(identity: OperationIdentity): String =
    identity.phase.toString.toLowerCase(java.util.Locale.ROOT)

  private def receiptIdentity(identity: OperationIdentity, resource: AccountId): (TxId, String, String, String, AccountId, String, String) =
    (TxId(identity.transaction.transactionId), identity.transaction.definitionVersion.toString,
      identity.transaction.argsDigest, participant(identity.participantId), resource,
      identity.stepId, lowerPhase(identity))

  private def receiptIdentityOrder(identity: OperationIdentity, resource: FundOrderId): (TxId, String, String, String, FundOrderId, String, String) =
    (TxId(identity.transaction.transactionId), identity.transaction.definitionVersion.toString,
      identity.transaction.argsDigest, participant(identity.participantId), resource,
      identity.stepId, lowerPhase(identity))

  private def reserveInvestorFundsPrepareReceipt(input: ReserveInvestorFundsPrepareInput, identity: OperationIdentity): ReserveInvestorFundsPrepareReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentity(identity, AccountId(identity.resource))
    ReserveInvestorFundsPrepareReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount, input.amount.currency,
      Money(input.amount.amount + 1000000, input.amount.currency))
  }

  private def reserveInvestorFundsCommitReceipt(input: ReserveInvestorFundsCommitInput, identity: OperationIdentity): ReserveInvestorFundsCommitReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentity(identity, AccountId(identity.resource))
    ReserveInvestorFundsCommitReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount)
  }

  private def reserveInvestorFundsCompensateReceipt(input: ReserveInvestorFundsCompensateInput, identity: OperationIdentity): ReserveInvestorFundsCompensateReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentity(identity, AccountId(identity.resource))
    ReserveInvestorFundsCompensateReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount, input.amount.currency,
      Money(input.amount.amount + 2000000, input.amount.currency))
  }

  private def creditFundCollectionPrepareReceipt(input: CreditFundCollectionPrepareInput, identity: OperationIdentity): CreditFundCollectionPrepareReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentity(identity, AccountId(identity.resource))
    CreditFundCollectionPrepareReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount)
  }

  private def creditFundCollectionCommitReceipt(input: CreditFundCollectionCommitInput, identity: OperationIdentity): CreditFundCollectionCommitReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentity(identity, AccountId(identity.resource))
    CreditFundCollectionCommitReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount, input.amount.currency,
      Money(input.amount.amount + 1000000, input.amount.currency))
  }

  private def creditFundCollectionCompensateReceipt(input: CreditFundCollectionCompensateInput, identity: OperationIdentity): CreditFundCollectionCompensateReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentity(identity, AccountId(identity.resource))
    CreditFundCollectionCompensateReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount)
  }

  private def reserveCashFundOrderPrepareReceipt(input: ReserveCashFundOrderPrepareInput, identity: OperationIdentity): ReserveCashFundOrderPrepareReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentityOrder(identity, FundOrderId(identity.resource))
    ReserveCashFundOrderPrepareReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount)
  }

  private def reserveCashFundOrderCommitReceipt(input: ReserveCashFundOrderCommitInput, identity: OperationIdentity): ReserveCashFundOrderCommitReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentityOrder(identity, FundOrderId(identity.resource))
    ReserveCashFundOrderCommitReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount)
  }

  private def reserveCashFundOrderCompensateReceipt(input: ReserveCashFundOrderCompensateInput, identity: OperationIdentity): ReserveCashFundOrderCompensateReceipt = {
    val (tx, version, digest, participantId, resource, step, phase) = receiptIdentityOrder(identity, FundOrderId(identity.resource))
    ReserveCashFundOrderCompensateReceipt(tx, version, digest, participantId, resource, step, phase,
      input.txid, input.resource, input.amount)
  }

  private def authorityReply(context: CompletionContext): Future[BankPaymentResult] =
    authorityFailure match {
      case Some(reason) => Future.failed(new IllegalStateException(reason))
      case None => Future.successful(authorityResult.getOrElse(BankPaymentResult(TxId(context.identity.transactionId))))
    }

  private def deliveryReply: Future[Boolean] =
    if (deliveryFailure) Future.failed(new IllegalStateException("delivery unavailable")) else Future.successful(true)

  private val version = "bank-v1-1"

  private def run[I, O](name: String)(f: I => Future[O]): BankPaymentPortBindings.RunBinding[I, O] =
    BankPaymentPortBindings.RunBinding[I, O]("bankwealth." + name, version, f)
  private def op[I, O](name: String)(f: (I, OperationIdentity) => Future[O]): BankPaymentPortBindings.OperationBinding[I, O] =
    BankPaymentPortBindings.OperationBinding[I, O]("bankwealth." + name, version, f)
  private def completion[I, O](name: String)(f: (I, CompletionContext) => Future[O]): BankPaymentPortBindings.CompletionBinding[I, O] =
    BankPaymentPortBindings.CompletionBinding[I, O]("bankwealth." + name, version, f)

  def bindings: BankPaymentPortBindings.Bindings = BankPaymentPortBindings.Bindings(
    entry = run[BankPaymentOriginal, Boolean]("BankPaymentEntry") { original =>
      entryCalls.record(original)
      entryFailure match {
        case Some(reason) => Future.failed(new IllegalStateException(reason))
        case None => Future.successful(entryAllowed)
      }
    },
    association = run[BankPaymentOriginal, Boolean]("BankPaymentAssociation") { original =>
      associationCalls.record(original); Future.successful(associationAllowed)
    },
    reserveInvestorFundsPrepareExecute = op[ReserveInvestorFundsPrepareInput, ReserveInvestorFundsPrepareReceipt]("ReserveInvestorFundsPrepareExecute") { (input, identity) =>
      phaseCalls.record("reserveInvestorFundsPrepare.execute")
      Future.successful(reserveInvestorFundsPrepareReceipt(input, identity))
    },
    reserveInvestorFundsPrepareQuery = op[ReserveInvestorFundsPrepareQuery, Option[ReserveInvestorFundsPrepareReceipt]]("ReserveInvestorFundsPrepareQueryPort") { (input, identity) =>
      phaseCalls.record("reserveInvestorFundsPrepare.query")
      Future.successful(Some(reserveInvestorFundsPrepareReceipt(
        ReserveInvestorFundsPrepareInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    reserveInvestorFundsCommitExecute = op[ReserveInvestorFundsCommitInput, ReserveInvestorFundsCommitReceipt]("ReserveInvestorFundsCommitExecute") { (input, identity) =>
      phaseCalls.record("reserveInvestorFundsCommit.execute")
      // The definition layer folds a provably-not-executed refusal into the
      // NotExecuted outcome — the binding face refuses by a typed failure.
      if (commitNotExecuted) Future.failed(new OperationNotExecuted(identity, "absent-fence", true))
      else Future.successful(reserveInvestorFundsCommitReceipt(input, identity))
    },
    reserveInvestorFundsCommitQuery = op[ReserveInvestorFundsCommitQuery, Option[ReserveInvestorFundsCommitReceipt]]("ReserveInvestorFundsCommitQueryPort") { (input, identity) =>
      phaseCalls.record("reserveInvestorFundsCommit.query")
      Future.successful(Some(reserveInvestorFundsCommitReceipt(
        ReserveInvestorFundsCommitInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    reserveInvestorFundsCompensateExecute = op[ReserveInvestorFundsCompensateInput, ReserveInvestorFundsCompensateReceipt]("ReserveInvestorFundsCompensateExecute") { (input, identity) =>
      phaseCalls.record("reserveInvestorFundsCompensate.execute")
      Future.successful(reserveInvestorFundsCompensateReceipt(input, identity))
    },
    reserveInvestorFundsCompensateQuery = op[ReserveInvestorFundsCompensateQuery, Option[ReserveInvestorFundsCompensateReceipt]]("ReserveInvestorFundsCompensateQueryPort") { (input, identity) =>
      phaseCalls.record("reserveInvestorFundsCompensate.query")
      Future.successful(Some(reserveInvestorFundsCompensateReceipt(
        ReserveInvestorFundsCompensateInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    creditFundCollectionPrepareExecute = op[CreditFundCollectionPrepareInput, CreditFundCollectionPrepareReceipt]("CreditFundCollectionPrepareExecute") { (input, identity) =>
      phaseCalls.record("creditFundCollectionPrepare.execute")
      // The definition layer folds a provably-not-executed prepare into the
      // NotExecuted outcome — the coordinator aborts and compensates the
      // confirmed prepares; a plain technical failure folds into Unknown.
      if (prepareNotExecuted) Future.failed(new OperationNotExecuted(identity, "absent-fence", true))
      else if (prepareUnknown) Future.failed(new IllegalStateException("dispatched-unknown"))
      else Future.successful(creditFundCollectionPrepareReceipt(input, identity))
    },
    creditFundCollectionPrepareQuery = op[CreditFundCollectionPrepareQuery, Option[CreditFundCollectionPrepareReceipt]]("CreditFundCollectionPrepareQueryPort") { (input, identity) =>
      phaseCalls.record("creditFundCollectionPrepare.query")
      Future.successful(Some(creditFundCollectionPrepareReceipt(
        CreditFundCollectionPrepareInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    creditFundCollectionCommitExecute = op[CreditFundCollectionCommitInput, CreditFundCollectionCommitReceipt]("CreditFundCollectionCommitExecute") { (input, identity) =>
      phaseCalls.record("creditFundCollectionCommit.execute")
      Future.successful(creditFundCollectionCommitReceipt(input, identity))
    },
    creditFundCollectionCommitQuery = op[CreditFundCollectionCommitQuery, Option[CreditFundCollectionCommitReceipt]]("CreditFundCollectionCommitQueryPort") { (input, identity) =>
      phaseCalls.record("creditFundCollectionCommit.query")
      Future.successful(Some(creditFundCollectionCommitReceipt(
        CreditFundCollectionCommitInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    creditFundCollectionCompensateExecute = op[CreditFundCollectionCompensateInput, CreditFundCollectionCompensateReceipt]("CreditFundCollectionCompensateExecute") { (input, identity) =>
      phaseCalls.record("creditFundCollectionCompensate.execute")
      Future.successful(creditFundCollectionCompensateReceipt(input, identity))
    },
    creditFundCollectionCompensateQuery = op[CreditFundCollectionCompensateQuery, Option[CreditFundCollectionCompensateReceipt]]("CreditFundCollectionCompensateQueryPort") { (input, identity) =>
      phaseCalls.record("creditFundCollectionCompensate.query")
      Future.successful(Some(creditFundCollectionCompensateReceipt(
        CreditFundCollectionCompensateInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    reserveCashFundOrderPrepareExecute = op[ReserveCashFundOrderPrepareInput, ReserveCashFundOrderPrepareReceipt]("ReserveCashFundOrderPrepareExecute") { (input, identity) =>
      phaseCalls.record("reserveCashFundOrderPrepare.execute")
      Future.successful(reserveCashFundOrderPrepareReceipt(input, identity))
    },
    reserveCashFundOrderPrepareQuery = op[ReserveCashFundOrderPrepareQuery, Option[ReserveCashFundOrderPrepareReceipt]]("ReserveCashFundOrderPrepareQueryPort") { (input, identity) =>
      phaseCalls.record("reserveCashFundOrderPrepare.query")
      Future.successful(Some(reserveCashFundOrderPrepareReceipt(
        ReserveCashFundOrderPrepareInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    reserveCashFundOrderCommitExecute = op[ReserveCashFundOrderCommitInput, ReserveCashFundOrderCommitReceipt]("ReserveCashFundOrderCommitExecute") { (input, identity) =>
      phaseCalls.record("reserveCashFundOrderCommit.execute")
      Future.successful(reserveCashFundOrderCommitReceipt(input, identity))
    },
    reserveCashFundOrderCommitQuery = op[ReserveCashFundOrderCommitQuery, Option[ReserveCashFundOrderCommitReceipt]]("ReserveCashFundOrderCommitQueryPort") { (input, identity) =>
      phaseCalls.record("reserveCashFundOrderCommit.query")
      Future.successful(Some(reserveCashFundOrderCommitReceipt(
        ReserveCashFundOrderCommitInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    reserveCashFundOrderCompensateExecute = op[ReserveCashFundOrderCompensateInput, ReserveCashFundOrderCompensateReceipt]("ReserveCashFundOrderCompensateExecute") { (input, identity) =>
      phaseCalls.record("reserveCashFundOrderCompensate.execute")
      Future.successful(reserveCashFundOrderCompensateReceipt(input, identity))
    },
    reserveCashFundOrderCompensateQuery = op[ReserveCashFundOrderCompensateQuery, Option[ReserveCashFundOrderCompensateReceipt]]("ReserveCashFundOrderCompensateQueryPort") { (input, identity) =>
      phaseCalls.record("reserveCashFundOrderCompensate.query")
      Future.successful(Some(reserveCashFundOrderCompensateReceipt(
        ReserveCashFundOrderCompensateInput(input.transaction, input.resource, Money(1, "CNY")), identity)))
    },
    succeededAuthority = completion[BankPaymentOriginal, BankPaymentResult]("BankPaymentSucceededAuthority") { (input, context) =>
      authorityCalls.record("succeeded"); authorityReply(context)
    },
    succeededDelivery = completion[BankPaymentResult, Boolean]("BankPaymentSucceededDelivery") { (result, context) =>
      deliveryCalls.record("succeeded"); deliveryReply
    },
    rejectedBeforeEffectsAuthority = completion[BankPaymentOriginal, BankPaymentResult]("BankPaymentRejectedBeforeEffectsAuthority") { (input, context) =>
      authorityCalls.record("rejected-before-effects"); authorityReply(context)
    },
    rejectedBeforeEffectsDelivery = completion[BankPaymentResult, Boolean]("BankPaymentRejectedBeforeEffectsDelivery") { (result, context) =>
      deliveryCalls.record("rejected-before-effects"); deliveryReply
    },
    compensatedAuthority = completion[BankPaymentOriginal, BankPaymentResult]("BankPaymentCompensatedAuthority") { (input, context) =>
      authorityCalls.record("compensated"); authorityReply(context)
    },
    compensatedDelivery = completion[BankPaymentResult, Boolean]("BankPaymentCompensatedDelivery") { (result, context) =>
      deliveryCalls.record("compensated"); deliveryReply
    },
    recoveryRequiredAuthority = completion[BankPaymentOriginal, BankPaymentResult]("BankPaymentRecoveryRequiredAuthority") { (input, context) =>
      authorityCalls.record("recovery-required"); authorityReply(context)
    },
    recoveryRequiredDelivery = completion[BankPaymentResult, Boolean]("BankPaymentRecoveryRequiredDelivery") { (result, context) =>
      deliveryCalls.record("recovery-required"); deliveryReply
    },
    outcomeUnknownAuthority = completion[BankPaymentOriginal, BankPaymentResult]("BankPaymentOutcomeUnknownAuthority") { (input, context) =>
      authorityCalls.record("outcome-unknown"); authorityReply(context)
    },
    outcomeUnknownDelivery = completion[BankPaymentResult, Boolean]("BankPaymentOutcomeUnknownDelivery") { (result, context) =>
      deliveryCalls.record("outcome-unknown"); deliveryReply
    },
  )

  def ports: BankPaymentPorts = BankPaymentPortBindings.install(bindings)
}

object BankPaymentProbe {
  val ReconcileToken = "bank-quality-token"
}

/** 授权探针：唯一令牌放行，其余拒绝。 */
final class BankPaymentAuthorizer extends ReconcileAuthorizer {
  def authorize(identity: TransactionIdentity, token: String): Either[String, String] =
    if (token == BankPaymentProbe.ReconcileToken) Right(token) else Left("not authorized")
}

/** 本地 typed ActorSystem 装置（Support 层）：persistence-testkit journal
  * （serialize=false，见文件头注）；PID 每次评估唯一；关闭钩子兜底终止。 */
object BankPaymentFixture {
  private val config = ConfigFactory.parseString(
    """
      |akka.daemonic = on
      |akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
      |akka.persistence.testkit.journal.class = "akka.persistence.testkit.PersistenceTestKitPlugin"
      |akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshot"
      |akka.persistence.testkit.snapshot.class = "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin"
      |akka.persistence.testkit.events.serialize = false
    """.stripMargin)

  val testKit: ActorTestKit = ActorTestKit("pipeline-invocation-face-quality", config)
  val journal: PersistenceTestKit = PersistenceTestKit(testKit.system)

  implicit private val ec: scala.concurrent.ExecutionContext = scala.concurrent.ExecutionContext.global
  implicit private val timeout: Timeout = Timeout(12.seconds)
  implicit private val scheduler: Scheduler = testKit.scheduler

  private val shutdownHook = new Thread(() => testKit.shutdownTestKit())
  Runtime.getRuntime.addShutdownHook(shutdownHook)

  private val pidCounter = new AtomicInteger(0)
  def nextPid(prefix: String): String = prefix + "-" + pidCounter.incrementAndGet()

  def spawnCoordinator(probe: BankPaymentProbe): ActorRef[StrictSagaCoordinator.Command] = {
    val ports = BankPaymentSagaDefinition.fromTechnical(probe.ports)
    testKit.spawn(BankPaymentSagaDefinition.coordinator(nextPid("coordinator"), ports, new BankPaymentAuthorizer))
  }

  def spawnHost(probe: BankPaymentProbe, coordinator: ActorRef[StrictSagaCoordinator.Command]): ActorRef[BankPaymentHost.Request] =
    testKit.spawn(BankPaymentHost(nextPid("payment-host"), coordinator, probe.ports))

  def askHost(ref: ActorRef[BankPaymentHost.Request], state: BankCashPaymentExecution.State): BankPaymentHost.Reply = {
    import akka.actor.typed.scaladsl.AskPattern._
    Await.result(ref.ask[BankPaymentHost.Reply](BankPaymentHost.Invoke(state, _)), 15.seconds)
  }

  /** The caller-side contract (R1/R2): a single ask may answer the transient
    * "awaiting authoritative result" while the saga runs; the caller re-asks.
    * Every re-invoke is idempotent and re-derives the answer from durable
    * state, so bounded polling converges. */
  def settledReply(ref: ActorRef[BankPaymentHost.Request], state: BankCashPaymentExecution.State): BankPaymentHost.Reply = {
    val transient = BankPaymentHost.Pending("awaiting authoritative result")
    var reply = askHost(ref, state)
    var attempts = 0
    while (reply == transient && attempts < 40) {
      Thread.sleep(100)
      reply = askHost(ref, state)
      attempts += 1
    }
    reply
  }

  def coordinatorStatus(ref: ActorRef[StrictSagaCoordinator.Command]): StrictState = {
    import akka.actor.typed.scaladsl.AskPattern._
    Await.result(ref.ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.GetStatus(_)), 8.seconds) match {
      case StrictSagaCoordinator.Status(state) => state
      case other => throw new IllegalStateException("unexpected coordinator reply: " + other)
    }
  }

  def reconcile(ref: ActorRef[StrictSagaCoordinator.Command], identity: TransactionIdentity): StrictSagaCoordinator.Reply = {
    import akka.actor.typed.scaladsl.AskPattern._
    Await.result(ref.ask[StrictSagaCoordinator.Reply](
      StrictSagaCoordinator.Reconcile(identity, BankPaymentProbe.ReconcileToken, 16, _)), 8.seconds)
  }

  /** 轮询协调器直至终态或宽限到期（支持层允许忙等；有界）。 */
  def awaitTerminal(ref: ActorRef[StrictSagaCoordinator.Command], atMost: FiniteDuration): StrictState = {
    val deadline = System.nanoTime() + atMost.toNanos
    var state = coordinatorStatus(ref)
    while (!state.terminal && System.nanoTime() < deadline) {
      Thread.sleep(20)
      state = coordinatorStatus(ref)
    }
    state
  }

  /** 协调器亲授的权威状态：真实协调器 Start 回答的 Preparing 态（真实身份槽、
    * 真实 planDigest 与参与方描述子，proto 可转换）——槽位精确性性质的正例基座，
    * 逐槽漂移由其 copy 注入。 */
  def authoritativeState(state: BankCashPaymentExecution.State): StrictState = {
    import akka.actor.typed.scaladsl.AskPattern._
    val probe = new BankPaymentProbe
    val coordinator = spawnCoordinator(probe)
    val reply = Await.result(
      coordinator.ask[StrictSagaCoordinator.Reply](
        StrictSagaCoordinator.Start(BankPaymentOracle.operationIdentity(state),
          BankPaymentOracle.argsBytes(state), _))(timeout, scheduler),
      12.seconds)
    reply match {
      case StrictSagaCoordinator.Status(authoritative) => authoritative
      case other => throw new IllegalStateException("unexpected authoritative reply: " + other)
    }
  }

  def events(pid: String): Vector[Any] = journal.persistedInStorage(pid).toVector
  def resetJournal(): Unit = journal.clearAll()
}
