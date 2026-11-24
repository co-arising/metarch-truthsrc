package example.bankwealth.domain

object FundOrderProtocol {
  sealed trait Command
  sealed trait Event
  final case class RequestFundPurchaseSettlement(operationId: example.bankwealth.domain.values.OperationId, fundOrderId: example.bankwealth.domain.values.FundOrderId, investorAccountId: example.bankwealth.domain.values.AccountId, fundCollectionAccountId: example.bankwealth.domain.values.AccountId, fundCode: String, amount: example.bankwealth.domain.values.Money) extends Command
  final case class ReserveFundSubscription(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.FundOrderId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class ConfirmFundSubscriptionPayment(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.FundOrderId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class CancelCashFundSubscription(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.FundOrderId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class RecordFundCashPaymentSucceeded(txid: example.bankwealth.domain.values.TxId) extends Command
  final case class RecordFundCashPaymentRejectedBeforeEffects(txid: example.bankwealth.domain.values.TxId) extends Command
  final case class RecordFundCashPaymentCompensated(txid: example.bankwealth.domain.values.TxId) extends Command
  final case class RecordFundCashPaymentRecoveryRequired(txid: example.bankwealth.domain.values.TxId) extends Command
  final case class RecordFundCashPaymentOutcomeUnknown(txid: example.bankwealth.domain.values.TxId) extends Command
  final case class RegisterFundTASubmission(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId) extends Command
  final case class RecordFundTAAccepted(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, taReference: String, receiptId: String, receiptBody: String, fundCode: String, currency: String) extends Command
  final case class RecordFundTAConfirmed(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, taReference: String, receiptId: String, receiptBody: String, fundCode: String, currency: String, shares: example.bankwealth.domain.values.FundShare) extends Command
  final case class RecordFundTARejected(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, taReference: String, receiptId: String, receiptBody: String, fundCode: String, currency: String, reason: String) extends Command
  final case class RecordFundTAUnknown(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, taReference: String, receiptId: String, receiptBody: String, fundCode: String, currency: String) extends Command
  final case class RequestFundPurchaseRefund(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId) extends Command
  final case class RecordFundRefundSucceeded(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String) extends Command
  final case class RecordFundRefundRejectedBeforeEffects(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String) extends Command
  final case class RecordFundRefundCompensated(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String) extends Command
  final case class RecordFundRefundRecoveryRequired(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String) extends Command
  final case class RecordFundRefundOutcomeUnknown(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String) extends Command
  final case class RecordCashRequestSource(original: example.bankwealth.domain.values.BankCashOriginal, source: Option[example.bankwealth.domain.values.BankCashOriginal]) extends Command
  final case class FundPurchaseSettlementRequested(operationId: example.bankwealth.domain.values.OperationId, fundOrderId: example.bankwealth.domain.values.FundOrderId, investorAccountId: example.bankwealth.domain.values.AccountId, fundCollectionAccountId: example.bankwealth.domain.values.AccountId, fundCode: String, amount: example.bankwealth.domain.values.Money) extends Event
  final case class ReserveFundSubscriptionConfirmed(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.FundOrderId, amount: example.bankwealth.domain.values.Money) extends Event
  final case class FundSubscriptionPaymentConfirmed(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.FundOrderId, amount: example.bankwealth.domain.values.Money) extends Event
  final case class CashFundSubscriptionCanceled(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.FundOrderId, amount: example.bankwealth.domain.values.Money) extends Event
  final case class FundCashPaymentSucceeded(txid: example.bankwealth.domain.values.TxId, kind: String) extends Event
  final case class FundCashPaymentRejectedBeforeEffects(txid: example.bankwealth.domain.values.TxId, kind: String) extends Event
  final case class FundCashPaymentCompensated(txid: example.bankwealth.domain.values.TxId, kind: String) extends Event
  final case class FundCashPaymentRecoveryRequired(txid: example.bankwealth.domain.values.TxId, kind: String) extends Event
  final case class FundCashPaymentOutcomeUnknown(txid: example.bankwealth.domain.values.TxId, kind: String) extends Event
  final case class FundTASubmissionRegistered(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId) extends Event
  final case class FundTAAccepted(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, taReference: String, receiptId: String, receiptBody: String, fundCode: String, currency: String, outcome: String) extends Event
  final case class FundTASharesConfirmed(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, taReference: String, receiptId: String, receiptBody: String, fundCode: String, currency: String, shares: example.bankwealth.domain.values.FundShare, outcome: String) extends Event
  final case class FundTARejected(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, taReference: String, receiptId: String, receiptBody: String, fundCode: String, currency: String, reason: String, outcome: String) extends Event
  final case class FundTAUnknown(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, taReference: String, receiptId: String, receiptBody: String, fundCode: String, currency: String, outcome: String) extends Event
  final case class FundPurchaseRefundRequested(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, investorAccountId: example.bankwealth.domain.values.AccountId, fundCollectionAccountId: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money, refundOperationId: example.bankwealth.domain.values.OperationId) extends Event
  final case class FundRefundSucceeded(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String, kind: String) extends Event
  final case class FundRefundRejectedBeforeEffects(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String, kind: String) extends Event
  final case class FundRefundCompensated(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String, kind: String) extends Event
  final case class FundRefundRecoveryRequired(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String, kind: String) extends Event
  final case class FundRefundOutcomeUnknown(refundTxId: example.bankwealth.domain.values.TxId, refundOperationId: example.bankwealth.domain.values.OperationId, receiptId: String, receiptBody: String, kind: String) extends Event
  final case class FundTAReceiptObserved(fundOrderId: example.bankwealth.domain.values.FundOrderId, paymentTxId: example.bankwealth.domain.values.TxId, taRequestId: example.bankwealth.domain.values.TaRequestId, investorAccountId: example.bankwealth.domain.values.AccountId, fundCollectionAccountId: example.bankwealth.domain.values.AccountId, fundCode: String, amount: example.bankwealth.domain.values.Money, principal: example.bankwealth.domain.values.AmountDecimal, receiptId: String, receiptBody: String, taReference: String, status: String, shares: example.bankwealth.domain.values.TaExactText, nav: example.bankwealth.domain.values.TaExactText, reason: String) extends Event
  final case class BankPaymentResultSucceeded(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankPaymentResultRejectedBeforeEffects(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankPaymentResultCompensated(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankPaymentResultRecoveryRequired(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankPaymentResultOutcomeUnknown(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankRefundResultSucceeded(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankRefundResultRejectedBeforeEffects(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankRefundResultCompensated(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankRefundResultRecoveryRequired(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class BankRefundResultOutcomeUnknown(txid: example.bankwealth.domain.values.TxId) extends Event
  final case class CashRequestSourceRecorded(original: example.bankwealth.domain.values.BankCashOriginal, source: Option[example.bankwealth.domain.values.BankCashOriginal]) extends Event
}
