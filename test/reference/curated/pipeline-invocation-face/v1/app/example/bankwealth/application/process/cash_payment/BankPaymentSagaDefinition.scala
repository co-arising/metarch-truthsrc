package example.bankwealth.application.process.cash_payment

import scala.concurrent.ExecutionContext

import example.bankwealth.domain.invariants.params.{CreditBalanceRuleParams, FundOrderRuleParams}
import example.bankwealth.domain.values._
import example.bankwealth.application.process.protocol.BankPaymentMessages._
import example.bankwealth.application.process.protocol.CreditFundCollectionStep._
import example.bankwealth.application.process.protocol.ReserveCashFundOrderStep._
import example.bankwealth.application.process.protocol.ReserveInvestorFundsStep._
import net.imadz.infra.saga.strict._

/** Strict-saga definition of the cash purchase payment: the args codec, the
  * three participants' phase ports and the coordinator assembly.
  *
  * The per-phase business content — which domain command each phase issues,
  * which receipt each phase accepts — is knowledge and stays explicit. The
  * mechanics (codec records, receipt-identity checks, port wrapping) are
  * written once as generic helpers below. Phase names compose from the
  * participant step ids of the saga payload
  * (reserve-investor-funds / credit-fund-collection / reserve-cash-fund-order). */
object BankPaymentSagaDefinition {

  type Args = BankPaymentArgs

  val ArgsCodecPin: CodecPin = CodecPin("BankPaymentArgs", 1)

  /** Persistence codec port supplied by the infrastructure persistence layer. */
  trait Codecs {
    def argsCodec: PayloadCodec[Args]
    def ReserveInvestorFundsPrepareCodec: PayloadCodec[ReserveInvestorFundsPrepareReceipt]
    def ReserveInvestorFundsCommitCodec: PayloadCodec[ReserveInvestorFundsCommitReceipt]
    def ReserveInvestorFundsCompensateCodec: PayloadCodec[ReserveInvestorFundsCompensateReceipt]
    def CreditFundCollectionPrepareCodec: PayloadCodec[CreditFundCollectionPrepareReceipt]
    def CreditFundCollectionCommitCodec: PayloadCodec[CreditFundCollectionCommitReceipt]
    def CreditFundCollectionCompensateCodec: PayloadCodec[CreditFundCollectionCompensateReceipt]
    def ReserveCashFundOrderPrepareCodec: PayloadCodec[ReserveCashFundOrderPrepareReceipt]
    def ReserveCashFundOrderCommitCodec: PayloadCodec[ReserveCashFundOrderCommitReceipt]
    def ReserveCashFundOrderCompensateCodec: PayloadCodec[ReserveCashFundOrderCompensateReceipt]
  }

  /** The port view the strict runtime consumes: the bound declarations
    * (evidence) plus one checked phase port per participant phase. */
  trait Ports {
    def declarations: Map[String, (String, String)]
    def reserveInvestorFundsPrepare: PhasePort[Args, ReserveInvestorFundsPrepareReceipt]
    def reserveInvestorFundsCommit: PhasePort[Args, ReserveInvestorFundsCommitReceipt]
    def reserveInvestorFundsCompensate: PhasePort[Args, ReserveInvestorFundsCompensateReceipt]
    def creditFundCollectionPrepare: PhasePort[Args, CreditFundCollectionPrepareReceipt]
    def creditFundCollectionCommit: PhasePort[Args, CreditFundCollectionCommitReceipt]
    def creditFundCollectionCompensate: PhasePort[Args, CreditFundCollectionCompensateReceipt]
    def reserveCashFundOrderPrepare: PhasePort[Args, ReserveCashFundOrderPrepareReceipt]
    def reserveCashFundOrderCommit: PhasePort[Args, ReserveCashFundOrderCommitReceipt]
    def reserveCashFundOrderCompensate: PhasePort[Args, ReserveCashFundOrderCompensateReceipt]
  }

  // ---------------------------------------------------------------- knowledge
  val SagaId = "bank-cash-payment-v1"
  val SagaDefinitionVersion = 1
  val SagaDefinitionDigest = "sha256:c13f703e76eaee9bfceeff701ecc5f41dd011d6db6890c6820a7faa944538f64"

  // Coordinator assembly slots (judged): the coordinator's ask window and its
  // in-flight participant capacity.
  val CoordinatorAskMillis = 1000L
  val CoordinatorCapacity = 32

  /** Every receipt must re-state exactly the durable operation it answers. */
  private def verifyReceiptIdentity(
    request: OperationRequest[Args],
    txid: String,
    definitionVersion: String,
    argsDigest: String,
    participant: String,
    resource: String,
    step: String,
    phase: String,
  ): Either[String, Unit] =
    if (txid != request.identity.transaction.transactionId)
      Left("receipt txid differs from durable operation")
    else if (definitionVersion != request.identity.transaction.definitionVersion.toString)
      Left("receipt definition-version differs from durable operation")
    else if (argsDigest != request.identity.transaction.argsDigest)
      Left("receipt args-digest differs from durable operation")
    else if (participant != request.identity.participantId)
      Left("receipt participant differs from durable operation")
    else if (resource != request.identity.resource)
      Left("receipt resource differs from durable operation")
    else if (step != request.identity.stepId)
      Left("receipt step differs from durable operation")
    else if (phase != request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT))
      Left("receipt phase differs from durable operation")
    else Right(())

  // ---- reserve-investor-funds (investorCreditBalance, CreditBalance) --------

  def checkReserveInvestorFundsPrepare(request: OperationRequest[Args],
      receipt: ReserveInvestorFundsPrepareReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsPrepareCommand(request: OperationRequest[Args]): CreditBalanceRuleParams.ReserveFundsParams =
    CreditBalanceRuleParams.ReserveFundsParams(TxId(request.identity.transaction.transactionId),
        request.args.investorAccountId, request.args.amount)

  def checkReserveInvestorFundsCommit(request: OperationRequest[Args],
      receipt: ReserveInvestorFundsCommitReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsCommitCommand(request: OperationRequest[Args]): CreditBalanceRuleParams.DeductFundsParams =
    CreditBalanceRuleParams.DeductFundsParams(TxId(request.identity.transaction.transactionId),
        request.args.investorAccountId, request.args.amount)

  def checkReserveInvestorFundsCompensate(request: OperationRequest[Args],
      receipt: ReserveInvestorFundsCompensateReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsCompensateCommand(request: OperationRequest[Args]): CreditBalanceRuleParams
      .ReleaseReservedFundsParams =
    CreditBalanceRuleParams.ReleaseReservedFundsParams(TxId(request.identity.transaction.transactionId),
        request.args.investorAccountId, request.args.amount)

  // ---- credit-fund-collection (collectionCreditBalance, CreditBalance) ------

  def checkCreditFundCollectionPrepare(request: OperationRequest[Args],
      receipt: CreditFundCollectionPrepareReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionPrepareCommand(request: OperationRequest[Args]): CreditBalanceRuleParams
      .RecordIncomingCreditsParams =
    CreditBalanceRuleParams.RecordIncomingCreditsParams(TxId(request.identity.transaction.transactionId),
        request.args.fundCollectionAccountId, request.args.amount)

  def checkCreditFundCollectionCommit(request: OperationRequest[Args],
      receipt: CreditFundCollectionCommitReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionCommitCommand(request: OperationRequest[Args]): CreditBalanceRuleParams
      .CommitIncomingCreditsParams =
    CreditBalanceRuleParams.CommitIncomingCreditsParams(TxId(request.identity.transaction.transactionId),
        request.args.fundCollectionAccountId, request.args.amount)

  def checkCreditFundCollectionCompensate(request: OperationRequest[Args],
      receipt: CreditFundCollectionCompensateReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionCompensateCommand(request: OperationRequest[Args]): CreditBalanceRuleParams
      .CancelIncomingCreditParams =
    CreditBalanceRuleParams.CancelIncomingCreditParams(TxId(request.identity.transaction.transactionId),
        request.args.fundCollectionAccountId, request.args.amount)

  // ---- reserve-cash-fund-order (orderFundOrderTCC, FundOrder) ---------------

  def checkReserveCashFundOrderPrepare(request: OperationRequest[Args],
      receipt: ReserveCashFundOrderPrepareReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderPrepareCommand(request: OperationRequest[Args]): FundOrderRuleParams
      .ReserveFundSubscriptionParams =
    FundOrderRuleParams.ReserveFundSubscriptionParams(TxId(request.identity.transaction.transactionId),
        request.args.fundOrderId, request.args.amount)

  def checkReserveCashFundOrderCommit(request: OperationRequest[Args],
      receipt: ReserveCashFundOrderCommitReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderCommitCommand(request: OperationRequest[Args]): FundOrderRuleParams
      .ConfirmFundSubscriptionPaymentParams =
    FundOrderRuleParams.ConfirmFundSubscriptionPaymentParams(TxId(request.identity.transaction.transactionId),
        request.args.fundOrderId, request.args.amount)

  def checkReserveCashFundOrderCompensate(request: OperationRequest[Args],
      receipt: ReserveCashFundOrderCompensateReceipt): Either[String, Unit] =
    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderCompensateCommand(request: OperationRequest[Args]): FundOrderRuleParams
      .CancelCashFundSubscriptionParams =
    FundOrderRuleParams.CancelCashFundSubscriptionParams(TxId(request.identity.transaction.transactionId),
        request.args.fundOrderId, request.args.amount)

  // ------------------------------------------------------------------- wiring

  /** The runtime consumes binding-wrapped phase ports; the definition site is
    * the single place the checked ports become runtime bindings. */
  private def phaseBindings(
    prepare: PhasePort[Args, _],
    commit: PhasePort[Args, _],
    compensate: PhasePort[Args, _],
  ): Map[Phase, PhaseBinding[Args]] = Map(
    Phase.Prepare -> PhaseBinding(prepare),
    Phase.Commit -> PhaseBinding(commit),
    Phase.Compensate -> PhaseBinding(compensate),
  )

  def definition(ports: Ports, argsCodec: PayloadCodec[Args])
      (implicit ec: ExecutionContext): StrictSagaDefinition[Args] =
    StrictSagaDefinition(SagaId, SagaDefinitionVersion, SagaDefinitionDigest, argsCodec, args => Vector(
      StrictParticipant[Args]("reserve-investor-funds",
          "investorCreditBalance", args.investorAccountId.value, phaseBindings(ports.reserveInvestorFundsPrepare,
              ports.reserveInvestorFundsCommit, ports.reserveInvestorFundsCompensate)),
      StrictParticipant[Args]("credit-fund-collection",
          "collectionCreditBalance", args
              .fundCollectionAccountId.value, phaseBindings(ports.creditFundCollectionPrepare,
                  ports.creditFundCollectionCommit, ports.creditFundCollectionCompensate)),
      StrictParticipant[Args]("reserve-cash-fund-order",
          "orderFundOrderTCC", args.fundOrderId.value, phaseBindings(ports.reserveCashFundOrderPrepare,
              ports.reserveCashFundOrderCommit, ports.reserveCashFundOrderCompensate)),
    ))
}
