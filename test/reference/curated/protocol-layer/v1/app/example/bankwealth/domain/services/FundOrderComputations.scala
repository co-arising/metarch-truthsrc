package example.bankwealth.domain.services

import example.bankwealth.domain.entities.FundOrderEntity.State
import example.bankwealth.domain.events.FundOrderEvents._
import example.bankwealth.domain.values._

trait FundOrderComputations {
  def StableRefundOperationId(state: State, p: RequestFundPurchaseRefund): OperationId
  def StableTaRequestId(state: State, p: RegisterFundTASubmission): TaRequestId
}
object FundOrderComputations {
}
object FundOrderCommandHelpers {
  def emitRequestFundPurchaseSettlement(state: State, p: RequestFundPurchaseSettlement, hosts: FundOrderComputations): Vector[Event] = Vector(FundPurchaseSettlementRequested(p.operationId, p.fundOrderId, p.investorAccountId, p.fundCollectionAccountId, p.fundCode, p.amount))
  def emitReserveFundSubscription(state: State, p: ReserveFundSubscription, hosts: FundOrderComputations): Vector[Event] = Vector(ReserveFundSubscriptionConfirmed(p.txid, p.resource, p.amount))
  def emitConfirmFundSubscriptionPayment(state: State, p: ConfirmFundSubscriptionPayment, hosts: FundOrderComputations): Vector[Event] = Vector(FundSubscriptionPaymentConfirmed(p.txid, p.resource, p.amount))
  def emitCancelCashFundSubscription(state: State, p: CancelCashFundSubscription, hosts: FundOrderComputations): Vector[Event] = Vector(CashFundSubscriptionCanceled(p.txid, p.resource, p.amount))
  def emitRecordFundCashPaymentSucceeded(state: State, p: RecordFundCashPaymentSucceeded, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentSucceeded(p.txid, "succeeded"))
  def emitRecordFundCashPaymentRejectedBeforeEffects(state: State, p: RecordFundCashPaymentRejectedBeforeEffects, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentRejectedBeforeEffects(p.txid, "rejected-before-effects"))
  def emitRecordFundCashPaymentCompensated(state: State, p: RecordFundCashPaymentCompensated, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentCompensated(p.txid, "compensated"))
  def emitRecordFundCashPaymentRecoveryRequired(state: State, p: RecordFundCashPaymentRecoveryRequired, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentRecoveryRequired(p.txid, "recovery-required"))
  def emitRecordFundCashPaymentOutcomeUnknown(state: State, p: RecordFundCashPaymentOutcomeUnknown, hosts: FundOrderComputations): Vector[Event] = Vector(FundCashPaymentOutcomeUnknown(p.txid, "outcome-unknown"))
  def emitRegisterFundTASubmission(state: State, p: RegisterFundTASubmission, hosts: FundOrderComputations): Vector[Event] = Vector(FundTASubmissionRegistered(p.fundOrderId, p.paymentTxId, hosts.StableTaRequestId(state, p)))
  def emitRecordFundTAAccepted(state: State, p: RecordFundTAAccepted, hosts: FundOrderComputations): Vector[Event] = Vector(FundTAAccepted(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "accepted"))
  def emitRecordFundTAConfirmed(state: State, p: RecordFundTAConfirmed, hosts: FundOrderComputations): Vector[Event] = Vector(FundTASharesConfirmed(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.shares, "confirmed"))
  def emitRecordFundTARejected(state: State, p: RecordFundTARejected, hosts: FundOrderComputations): Vector[Event] = Vector(FundTARejected(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.reason, "rejected"))
  def emitRecordFundTAUnknown(state: State, p: RecordFundTAUnknown, hosts: FundOrderComputations): Vector[Event] = Vector(FundTAUnknown(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "unknown"))
  def emitRequestFundPurchaseRefund(state: State, p: RequestFundPurchaseRefund, hosts: FundOrderComputations): Vector[Event] = Vector(FundPurchaseRefundRequested(p.fundOrderId, p.paymentTxId, state.investorAccountId, state.fundCollectionAccountId, state.amount, hosts.StableRefundOperationId(state, p)))
  def emitRecordFundRefundSucceeded(state: State, p: RecordFundRefundSucceeded, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundSucceeded(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "succeeded"))
  def emitRecordFundRefundRejectedBeforeEffects(state: State, p: RecordFundRefundRejectedBeforeEffects, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundRejectedBeforeEffects(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "rejected-before-effects"))
  def emitRecordFundRefundCompensated(state: State, p: RecordFundRefundCompensated, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundCompensated(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "compensated"))
  def emitRecordFundRefundRecoveryRequired(state: State, p: RecordFundRefundRecoveryRequired, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundRecoveryRequired(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "recovery-required"))
  def emitRecordFundRefundOutcomeUnknown(state: State, p: RecordFundRefundOutcomeUnknown, hosts: FundOrderComputations): Vector[Event] = Vector(FundRefundOutcomeUnknown(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "outcome-unknown"))
  def emitRecordCashRequestSource(state: State, p: RecordCashRequestSource, hosts: FundOrderComputations): Vector[Event] = Vector(CashRequestSourceRecorded(p.original, p.source))
}
