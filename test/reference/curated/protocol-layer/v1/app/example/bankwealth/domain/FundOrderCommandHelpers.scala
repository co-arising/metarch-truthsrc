package example.bankwealth.domain

import example.bankwealth.domain.values._
import FundOrderProtocol._

trait FundOrderComputations {
  def StableRefundOperationId(state: FundOrderState, p: RequestFundPurchaseRefund): OperationId
  def StableTaRequestId(state: FundOrderState, p: RegisterFundTASubmission): TaRequestId
}
object FundOrderComputations {
}
object FundOrderCommandHelpers {
  def emitRequestFundPurchaseSettlement(state: FundOrderState, p: RequestFundPurchaseSettlement, hosts: FundOrderComputations): Vector[Event] = Vector(FundPurchaseSettlementRequested(p.operationId, p.fundOrderId, p.investorAccountId, p.fundCollectionAccountId, p.fundCode, p.amount))
  def emitReserveFundSubscription(state: FundOrderState, p: ReserveFundSubscription, hosts: FundOrderComputations): Vector[Event] = Vector(ReserveFundSubscriptionConfirmed(p.txid, p.resource, p.amount))
  def emitConfirmFundSubscriptionPayment(state: FundOrderState, p: ConfirmFundSubscriptionPayment, hosts: FundOrderComputations): Vector[Event] = Vector(FundSubscriptionPaymentConfirmed(p.txid, p.resource, p.amount))
  def emitCancelCashFundSubscription(state: FundOrderState, p: CancelCashFundSubscription, hosts: FundOrderComputations): Vector[Event] = Vector(CashFundSubscriptionCanceled(p.txid, p.resource, p.amount))
  def emitRecordFundCashPaymentSucceeded(state: FundOrderState, p: RecordFundCashPaymentSucceeded, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentSucceeded(p.txid, "succeeded"))
  def emitRecordFundCashPaymentRejectedBeforeEffects(state: FundOrderState, p: RecordFundCashPaymentRejectedBeforeEffects, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentRejectedBeforeEffects(p.txid, "rejected-before-effects"))
  def emitRecordFundCashPaymentCompensated(state: FundOrderState, p: RecordFundCashPaymentCompensated, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentCompensated(p.txid, "compensated"))
  def emitRecordFundCashPaymentRecoveryRequired(state: FundOrderState, p: RecordFundCashPaymentRecoveryRequired, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentRecoveryRequired(p.txid, "recovery-required"))
  def emitRecordFundCashPaymentOutcomeUnknown(state: FundOrderState, p: RecordFundCashPaymentOutcomeUnknown, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentOutcomeUnknown(p.txid, "outcome-unknown"))
  def emitRegisterFundTASubmission(state: FundOrderState, p: RegisterFundTASubmission, hosts: FundOrderComputations): Vector[Event] = Vector(FundTASubmissionRegistered(p.fundOrderId, p.paymentTxId, hosts.StableTaRequestId(state, p)))
  def emitRecordFundTAAccepted(state: FundOrderState, p: RecordFundTAAccepted, hosts: FundOrderComputations): Vector[Event] = Vector(FundTAAccepted(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "accepted"))
  def emitRecordFundTAConfirmed(state: FundOrderState, p: RecordFundTAConfirmed, hosts: FundOrderComputations): Vector[Event] = Vector(FundTASharesConfirmed(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.shares, "confirmed"))
  def emitRecordFundTARejected(state: FundOrderState, p: RecordFundTARejected, hosts: FundOrderComputations): Vector[Event] = Vector(FundTARejected(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.reason, "rejected"))
  def emitRecordFundTAUnknown(state: FundOrderState, p: RecordFundTAUnknown, hosts: FundOrderComputations): Vector[Event] = Vector(FundTAUnknown(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "unknown"))
  def emitRequestFundPurchaseRefund(state: FundOrderState, p: RequestFundPurchaseRefund, hosts: FundOrderComputations): Vector[Event] = Vector(FundPurchaseRefundRequested(p.fundOrderId, p.paymentTxId, state.investorAccountId, state.fundCollectionAccountId, state.amount, hosts.StableRefundOperationId(state, p)))
  def emitRecordFundRefundSucceeded(state: FundOrderState, p: RecordFundRefundSucceeded, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundSucceeded(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "succeeded"))
  def emitRecordFundRefundRejectedBeforeEffects(state: FundOrderState, p: RecordFundRefundRejectedBeforeEffects, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundRejectedBeforeEffects(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "rejected-before-effects"))
  def emitRecordFundRefundCompensated(state: FundOrderState, p: RecordFundRefundCompensated, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundCompensated(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "compensated"))
  def emitRecordFundRefundRecoveryRequired(state: FundOrderState, p: RecordFundRefundRecoveryRequired, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundRecoveryRequired(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "recovery-required"))
  def emitRecordFundRefundOutcomeUnknown(state: FundOrderState, p: RecordFundRefundOutcomeUnknown, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundOutcomeUnknown(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "outcome-unknown"))
  def emitRecordCashRequestSource(state: FundOrderState, p: RecordCashRequestSource, hosts: FundOrderComputations): Vector[Event] = Vector(CashRequestSourceRecorded(p.original, p.source))
}
