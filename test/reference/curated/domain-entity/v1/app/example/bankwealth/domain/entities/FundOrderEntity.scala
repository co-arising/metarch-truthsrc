package example.bankwealth.domain.entities

import example.bankwealth.domain.values._

object FundOrderEntity {
  final case class State(
    id: FundOrderId,
    status: String,
    operationId: OperationId,
    investorAccountId: AccountId,
    fundCollectionAccountId: AccountId,
    fundCode: String,
    amount: Money,
    reservedSubscriptions: Map[TxId, Money],
    committedSubscriptions: Map[TxId, Money],
    compensatedSubscriptions: Map[TxId, Money],
    selectedPaymentTxId: TxId,
    paymentOutcome: String,
    cashPaymentResults: Map[TxId, String],
    cashPaymentFinalResults: Map[TxId, String],
    taRequestId: TaRequestId,
    taReference: String,
    taStatus: String,
    taReceipts: Map[String, String],
    taReceiptOutcomes: Map[String, String],
    taConfirmedShares: FundShare,
    taRejectionReason: String,
    refundOperationId: OperationId,
    refundOutcome: String,
    refundResultReceipts: Map[String, String],
    refundFinalResults: Map[TxId, String],
    taObservedReceipts: Map[String, String],
    paymentObservedResults: Map[TxId, String],
    refundObservedResults: Map[TxId, String],
    cashRequestSource: Option[BankCashOriginal],
    cashRequestOriginals: Map[String, BankCashOriginal]
  )

  def empty: State = State(
    id = FundOrderId(""),
    status = "new",
    operationId = OperationId(""),
    investorAccountId = AccountId(""),
    fundCollectionAccountId = AccountId(""),
    fundCode = "",
    amount = Money(BigDecimal("0.00"), "CNY"),
    reservedSubscriptions = Map(),
    committedSubscriptions = Map(),
    compensatedSubscriptions = Map(),
    selectedPaymentTxId = TxId(""),
    paymentOutcome = "",
    cashPaymentResults = Map(),
    cashPaymentFinalResults = Map(),
    taRequestId = TaRequestId(""),
    taReference = "",
    taStatus = "",
    taReceipts = Map(),
    taReceiptOutcomes = Map(),
    taConfirmedShares = FundShare("", TaExactText(""), TaExactText("")),
    taRejectionReason = "",
    refundOperationId = OperationId(""),
    refundOutcome = "",
    refundResultReceipts = Map(),
    refundFinalResults = Map(),
    taObservedReceipts = Map(),
    paymentObservedResults = Map(),
    refundObservedResults = Map(),
    cashRequestSource = None,
    cashRequestOriginals = Map()
  )

  sealed trait Event
  final case class FundPurchaseSettlementRequested(
    operationId: OperationId,
    fundOrderId: FundOrderId,
    investorAccountId: AccountId,
    fundCollectionAccountId: AccountId,
    fundCode: String,
    amount: Money
  ) extends Event
  final case class ReserveFundSubscriptionConfirmed(
    txid: TxId,
    resource: FundOrderId,
    amount: Money
  ) extends Event
  final case class FundSubscriptionPaymentConfirmed(
    txid: TxId,
    resource: FundOrderId,
    amount: Money
  ) extends Event
  final case class CashFundSubscriptionCanceled(
    txid: TxId,
    resource: FundOrderId,
    amount: Money
  ) extends Event
  final case class FundCashPaymentSucceeded(txid: TxId, kind: String) extends Event
  final case class FundCashPaymentRejectedBeforeEffects(txid: TxId, kind: String) extends Event
  final case class FundCashPaymentCompensated(txid: TxId, kind: String) extends Event
  final case class FundCashPaymentRecoveryRequired(txid: TxId, kind: String) extends Event
  final case class FundCashPaymentOutcomeUnknown(txid: TxId, kind: String) extends Event
  final case class FundTASubmissionRegistered(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId
  ) extends Event
  final case class FundTAAccepted(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    outcome: String
  ) extends Event
  final case class FundTASharesConfirmed(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    shares: FundShare,
    outcome: String
  ) extends Event
  final case class FundTARejected(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    reason: String,
    outcome: String
  ) extends Event
  final case class FundTAUnknown(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    outcome: String
  ) extends Event
  final case class FundPurchaseRefundRequested(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    investorAccountId: AccountId,
    fundCollectionAccountId: AccountId,
    amount: Money,
    refundOperationId: OperationId
  ) extends Event
  final case class FundRefundSucceeded(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    kind: String
  ) extends Event
  final case class FundRefundRejectedBeforeEffects(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    kind: String
  ) extends Event
  final case class FundRefundCompensated(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    kind: String
  ) extends Event
  final case class FundRefundRecoveryRequired(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    kind: String
  ) extends Event
  final case class FundRefundOutcomeUnknown(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    kind: String
  ) extends Event
  final case class FundTAReceiptObserved(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    investorAccountId: AccountId,
    fundCollectionAccountId: AccountId,
    fundCode: String,
    amount: Money,
    principal: AmountDecimal,
    receiptId: String,
    receiptBody: String,
    taReference: String,
    status: String,
    shares: TaExactText,
    nav: TaExactText,
    reason: String
  ) extends Event
  final case class BankPaymentResultSucceeded(txid: TxId) extends Event
  final case class BankPaymentResultRejectedBeforeEffects(txid: TxId) extends Event
  final case class BankPaymentResultCompensated(txid: TxId) extends Event
  final case class BankPaymentResultRecoveryRequired(txid: TxId) extends Event
  final case class BankPaymentResultOutcomeUnknown(txid: TxId) extends Event
  final case class BankRefundResultSucceeded(txid: TxId) extends Event
  final case class BankRefundResultRejectedBeforeEffects(txid: TxId) extends Event
  final case class BankRefundResultCompensated(txid: TxId) extends Event
  final case class BankRefundResultRecoveryRequired(txid: TxId) extends Event
  final case class BankRefundResultOutcomeUnknown(txid: TxId) extends Event
  final case class CashRequestSourceRecorded(
    original: BankCashOriginal,
    source: Option[BankCashOriginal]
  ) extends Event

  type EventHandler = (State, Event) => State
}
