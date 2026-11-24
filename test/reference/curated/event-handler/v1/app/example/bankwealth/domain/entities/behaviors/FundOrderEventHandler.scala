package example.bankwealth.domain.entities.behaviors

import example.bankwealth.domain._
import example.bankwealth.domain.FundOrderProtocol._

object FundOrderEventHandler {
  def apply(state: FundOrderState, input: Event): FundOrderState = input match {
    case event: FundPurchaseSettlementRequested =>
      state.copy(
        operationId = event.operationId,
        investorAccountId = event.investorAccountId,
        fundCollectionAccountId = event.fundCollectionAccountId,
        fundCode = event.fundCode,
        amount = event.amount,
        status = "payment-requested"
      )
    case event: ReserveFundSubscriptionConfirmed =>
      state.copy(reservedSubscriptions = state.reservedSubscriptions.updated(event.txid, event.amount))
    case event: FundSubscriptionPaymentConfirmed =>
      state.copy(
        reservedSubscriptions = state.reservedSubscriptions - event.txid,
        committedSubscriptions = state.committedSubscriptions.updated(event.txid, event.amount),
        selectedPaymentTxId = event.txid,
        status = "payment-committed"
      )
    case event: CashFundSubscriptionCanceled =>
      state.copy(
        reservedSubscriptions = state.reservedSubscriptions - event.txid,
        compensatedSubscriptions = state.compensatedSubscriptions.updated(event.txid, event.amount)
      )
    case event: FundCashPaymentSucceeded =>
      state.copy(
        cashPaymentResults = state.cashPaymentResults.updated(event.txid, event.kind),
        paymentOutcome = event.kind,
        cashPaymentFinalResults = state.cashPaymentFinalResults.updated(event.txid, event.kind)
      )
    case event: FundCashPaymentRejectedBeforeEffects =>
      state.copy(
        cashPaymentResults = state.cashPaymentResults.updated(event.txid, event.kind),
        paymentOutcome = event.kind,
        cashPaymentFinalResults = state.cashPaymentFinalResults.updated(event.txid, event.kind)
      )
    case event: FundCashPaymentCompensated =>
      state.copy(
        cashPaymentResults = state.cashPaymentResults.updated(event.txid, event.kind),
        paymentOutcome = event.kind,
        cashPaymentFinalResults = state.cashPaymentFinalResults.updated(event.txid, event.kind)
      )
    case event: FundCashPaymentRecoveryRequired =>
      state.copy(
        cashPaymentResults = state.cashPaymentResults.updated(event.txid, event.kind),
        paymentOutcome = event.kind
      )
    case event: FundCashPaymentOutcomeUnknown =>
      state.copy(
        cashPaymentResults = state.cashPaymentResults.updated(event.txid, event.kind),
        paymentOutcome = event.kind
      )
    case event: FundTASubmissionRegistered =>
      state.copy(
        taRequestId = event.taRequestId,
        taStatus = "submitted"
      )
    case event: FundTAAccepted =>
      state.copy(
        taReceipts = state.taReceipts.updated(event.receiptId, event.receiptBody),
        taReceiptOutcomes = state.taReceiptOutcomes.updated(event.receiptId, event.outcome),
        taReference = event.taReference,
        taStatus = event.outcome
      )
    case event: FundTASharesConfirmed =>
      state.copy(
        taReceipts = state.taReceipts.updated(event.receiptId, event.receiptBody),
        taReceiptOutcomes = state.taReceiptOutcomes.updated(event.receiptId, event.outcome),
        taReference = event.taReference,
        taStatus = event.outcome,
        taConfirmedShares = event.shares
      )
    case event: FundTARejected =>
      state.copy(
        taReceipts = state.taReceipts.updated(event.receiptId, event.receiptBody),
        taReceiptOutcomes = state.taReceiptOutcomes.updated(event.receiptId, event.outcome),
        taReference = event.taReference,
        taStatus = event.outcome,
        taRejectionReason = event.reason
      )
    case event: FundTAUnknown =>
      state.copy(
        taReceipts = state.taReceipts.updated(event.receiptId, event.receiptBody),
        taReceiptOutcomes = state.taReceiptOutcomes.updated(event.receiptId, event.outcome),
        taReference = event.taReference,
        taStatus = event.outcome
      )
    case event: FundPurchaseRefundRequested =>
      state.copy(
        refundOperationId = event.refundOperationId,
        refundOutcome = "pending"
      )
    case event: FundRefundSucceeded =>
      state.copy(
        refundResultReceipts = state.refundResultReceipts.updated(event.receiptId, event.receiptBody),
        refundOutcome = event.kind,
        refundFinalResults = state.refundFinalResults.updated(event.refundTxId, event.kind)
      )
    case event: FundRefundRejectedBeforeEffects =>
      state.copy(
        refundResultReceipts = state.refundResultReceipts.updated(event.receiptId, event.receiptBody),
        refundOutcome = event.kind,
        refundFinalResults = state.refundFinalResults.updated(event.refundTxId, event.kind)
      )
    case event: FundRefundCompensated =>
      state.copy(
        refundResultReceipts = state.refundResultReceipts.updated(event.receiptId, event.receiptBody),
        refundOutcome = event.kind,
        refundFinalResults = state.refundFinalResults.updated(event.refundTxId, event.kind)
      )
    case event: FundRefundRecoveryRequired =>
      state.copy(
        refundResultReceipts = state.refundResultReceipts.updated(event.receiptId, event.receiptBody),
        refundOutcome = event.kind
      )
    case event: FundRefundOutcomeUnknown =>
      state.copy(
        refundResultReceipts = state.refundResultReceipts.updated(event.receiptId, event.receiptBody),
        refundOutcome = event.kind
      )
    case event: FundTAReceiptObserved =>
      state.copy(taObservedReceipts = state.taObservedReceipts.updated(event.receiptId, event.receiptBody))
    case event: BankPaymentResultSucceeded =>
      state.copy(paymentObservedResults = state.paymentObservedResults.updated(event.txid, "succeeded"))
    case event: BankPaymentResultRejectedBeforeEffects =>
      state.copy(paymentObservedResults = state.paymentObservedResults.updated(event.txid, "rejected-before-effects"))
    case event: BankPaymentResultCompensated =>
      state.copy(paymentObservedResults = state.paymentObservedResults.updated(event.txid, "compensated"))
    case event: BankPaymentResultRecoveryRequired =>
      state.copy(paymentObservedResults = state.paymentObservedResults.updated(event.txid, "recovery-required"))
    case event: BankPaymentResultOutcomeUnknown =>
      state.copy(paymentObservedResults = state.paymentObservedResults.updated(event.txid, "outcome-unknown"))
    case event: BankRefundResultSucceeded =>
      state.copy(refundObservedResults = state.refundObservedResults.updated(event.txid, "succeeded"))
    case event: BankRefundResultRejectedBeforeEffects =>
      state.copy(refundObservedResults = state.refundObservedResults.updated(event.txid, "rejected-before-effects"))
    case event: BankRefundResultCompensated =>
      state.copy(refundObservedResults = state.refundObservedResults.updated(event.txid, "compensated"))
    case event: BankRefundResultRecoveryRequired =>
      state.copy(refundObservedResults = state.refundObservedResults.updated(event.txid, "recovery-required"))
    case event: BankRefundResultOutcomeUnknown =>
      state.copy(refundObservedResults = state.refundObservedResults.updated(event.txid, "outcome-unknown"))
    case event: CashRequestSourceRecorded =>
      state.copy(
        cashRequestSource = event.source,
        cashRequestOriginals = state.cashRequestOriginals.updated("original", event.original)
      )
  }
}
