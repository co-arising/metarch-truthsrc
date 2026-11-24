package example.bankwealth.domain.events

import example.bankwealth.domain.values._

object FundOrderEvents {
  sealed trait Command
  sealed trait Event
  final case class RequestFundPurchaseSettlement(
    operationId: OperationId,
    fundOrderId: FundOrderId,
    investorAccountId: AccountId,
    fundCollectionAccountId: AccountId,
    fundCode: String,
    amount: Money
  ) extends Command
  final case class ReserveFundSubscription(txid: TxId, resource: FundOrderId, amount: Money) extends Command
  final case class ConfirmFundSubscriptionPayment(
    txid: TxId,
    resource: FundOrderId,
    amount: Money
  ) extends Command
  final case class CancelCashFundSubscription(
    txid: TxId,
    resource: FundOrderId,
    amount: Money
  ) extends Command
  final case class RecordFundCashPaymentSucceeded(txid: TxId) extends Command
  final case class RecordFundCashPaymentRejectedBeforeEffects(txid: TxId) extends Command
  final case class RecordFundCashPaymentCompensated(txid: TxId) extends Command
  final case class RecordFundCashPaymentRecoveryRequired(txid: TxId) extends Command
  final case class RecordFundCashPaymentOutcomeUnknown(txid: TxId) extends Command
  final case class RegisterFundTASubmission(fundOrderId: FundOrderId, paymentTxId: TxId) extends Command
  final case class RecordFundTAAccepted(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String
  ) extends Command
  final case class RecordFundTAConfirmed(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    shares: FundShare
  ) extends Command
  final case class RecordFundTARejected(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    reason: String
  ) extends Command
  final case class RecordFundTAUnknown(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String
  ) extends Command
  final case class RequestFundPurchaseRefund(fundOrderId: FundOrderId, paymentTxId: TxId) extends Command
  final case class RecordFundRefundSucceeded(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  ) extends Command
  final case class RecordFundRefundRejectedBeforeEffects(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  ) extends Command
  final case class RecordFundRefundCompensated(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  ) extends Command
  final case class RecordFundRefundRecoveryRequired(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  ) extends Command
  final case class RecordFundRefundOutcomeUnknown(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  ) extends Command
  final case class RecordCashRequestSource(
    original: BankCashOriginal,
    source: Option[BankCashOriginal]
  ) extends Command
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
}
