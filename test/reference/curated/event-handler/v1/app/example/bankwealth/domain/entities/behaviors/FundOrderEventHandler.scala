package example.bankwealth.domain.entities.behaviors

import example.bankwealth.domain._
import example.bankwealth.domain.FundOrderProtocol._

object FundOrderEventHandler {
  def apply(state: FundOrderState, input: Event): FundOrderState = input match {
    case event: FundPurchaseSettlementRequested =>
      val next0: example.bankwealth.domain.values.OperationId = event.operationId
      val next1: example.bankwealth.domain.values.AccountId = event.investorAccountId
      val next2: example.bankwealth.domain.values.AccountId = event.fundCollectionAccountId
      val next3: String = event.fundCode
      val next4: example.bankwealth.domain.values.Money = event.amount
      val next5: String = "payment-requested"
      state.copy(operationId = next0, investorAccountId = next1, fundCollectionAccountId = next2, fundCode = next3, amount = next4, status = next5)
    case event: ReserveFundSubscriptionConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedSubscriptions.updated(event.txid, event.amount)
      state.copy(reservedSubscriptions = next0)
    case event: FundSubscriptionPaymentConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedSubscriptions - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.committedSubscriptions.updated(event.txid, event.amount)
      val next2: example.bankwealth.domain.values.TxId = event.txid
      val next3: String = "payment-committed"
      state.copy(reservedSubscriptions = next0, committedSubscriptions = next1, selectedPaymentTxId = next2, status = next3)
    case event: CashFundSubscriptionCanceled =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedSubscriptions - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.compensatedSubscriptions.updated(event.txid, event.amount)
      state.copy(reservedSubscriptions = next0, compensatedSubscriptions = next1)
    case event: FundCashPaymentSucceeded =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.cashPaymentResults.updated(event.txid, event.kind)
      val next1: String = event.kind
      val next2: Map[example.bankwealth.domain.values.TxId, String] = state.cashPaymentFinalResults.updated(event.txid, event.kind)
      state.copy(cashPaymentResults = next0, paymentOutcome = next1, cashPaymentFinalResults = next2)
    case event: FundCashPaymentRejectedBeforeEffects =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.cashPaymentResults.updated(event.txid, event.kind)
      val next1: String = event.kind
      val next2: Map[example.bankwealth.domain.values.TxId, String] = state.cashPaymentFinalResults.updated(event.txid, event.kind)
      state.copy(cashPaymentResults = next0, paymentOutcome = next1, cashPaymentFinalResults = next2)
    case event: FundCashPaymentCompensated =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.cashPaymentResults.updated(event.txid, event.kind)
      val next1: String = event.kind
      val next2: Map[example.bankwealth.domain.values.TxId, String] = state.cashPaymentFinalResults.updated(event.txid, event.kind)
      state.copy(cashPaymentResults = next0, paymentOutcome = next1, cashPaymentFinalResults = next2)
    case event: FundCashPaymentRecoveryRequired =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.cashPaymentResults.updated(event.txid, event.kind)
      val next1: String = event.kind
      state.copy(cashPaymentResults = next0, paymentOutcome = next1)
    case event: FundCashPaymentOutcomeUnknown =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.cashPaymentResults.updated(event.txid, event.kind)
      val next1: String = event.kind
      state.copy(cashPaymentResults = next0, paymentOutcome = next1)
    case event: FundTASubmissionRegistered =>
      val next0: example.bankwealth.domain.values.TaRequestId = event.taRequestId
      val next1: String = "submitted"
      state.copy(taRequestId = next0, taStatus = next1)
    case event: FundTAAccepted =>
      val next0: Map[String, String] = state.taReceipts.updated(event.receiptId, event.receiptBody)
      val next1: Map[String, String] = state.taReceiptOutcomes.updated(event.receiptId, event.outcome)
      val next2: String = event.taReference
      val next3: String = event.outcome
      state.copy(taReceipts = next0, taReceiptOutcomes = next1, taReference = next2, taStatus = next3)
    case event: FundTASharesConfirmed =>
      val next0: Map[String, String] = state.taReceipts.updated(event.receiptId, event.receiptBody)
      val next1: Map[String, String] = state.taReceiptOutcomes.updated(event.receiptId, event.outcome)
      val next2: String = event.taReference
      val next3: String = event.outcome
      val next4: example.bankwealth.domain.values.FundShare = event.shares
      state.copy(taReceipts = next0, taReceiptOutcomes = next1, taReference = next2, taStatus = next3, taConfirmedShares = next4)
    case event: FundTARejected =>
      val next0: Map[String, String] = state.taReceipts.updated(event.receiptId, event.receiptBody)
      val next1: Map[String, String] = state.taReceiptOutcomes.updated(event.receiptId, event.outcome)
      val next2: String = event.taReference
      val next3: String = event.outcome
      val next4: String = event.reason
      state.copy(taReceipts = next0, taReceiptOutcomes = next1, taReference = next2, taStatus = next3, taRejectionReason = next4)
    case event: FundTAUnknown =>
      val next0: Map[String, String] = state.taReceipts.updated(event.receiptId, event.receiptBody)
      val next1: Map[String, String] = state.taReceiptOutcomes.updated(event.receiptId, event.outcome)
      val next2: String = event.taReference
      val next3: String = event.outcome
      state.copy(taReceipts = next0, taReceiptOutcomes = next1, taReference = next2, taStatus = next3)
    case event: FundPurchaseRefundRequested =>
      val next0: example.bankwealth.domain.values.OperationId = event.refundOperationId
      val next1: String = "pending"
      state.copy(refundOperationId = next0, refundOutcome = next1)
    case event: FundRefundSucceeded =>
      val next0: Map[String, String] = state.refundResultReceipts.updated(event.receiptId, event.receiptBody)
      val next1: String = event.kind
      val next2: Map[example.bankwealth.domain.values.TxId, String] = state.refundFinalResults.updated(event.refundTxId, event.kind)
      state.copy(refundResultReceipts = next0, refundOutcome = next1, refundFinalResults = next2)
    case event: FundRefundRejectedBeforeEffects =>
      val next0: Map[String, String] = state.refundResultReceipts.updated(event.receiptId, event.receiptBody)
      val next1: String = event.kind
      val next2: Map[example.bankwealth.domain.values.TxId, String] = state.refundFinalResults.updated(event.refundTxId, event.kind)
      state.copy(refundResultReceipts = next0, refundOutcome = next1, refundFinalResults = next2)
    case event: FundRefundCompensated =>
      val next0: Map[String, String] = state.refundResultReceipts.updated(event.receiptId, event.receiptBody)
      val next1: String = event.kind
      val next2: Map[example.bankwealth.domain.values.TxId, String] = state.refundFinalResults.updated(event.refundTxId, event.kind)
      state.copy(refundResultReceipts = next0, refundOutcome = next1, refundFinalResults = next2)
    case event: FundRefundRecoveryRequired =>
      val next0: Map[String, String] = state.refundResultReceipts.updated(event.receiptId, event.receiptBody)
      val next1: String = event.kind
      state.copy(refundResultReceipts = next0, refundOutcome = next1)
    case event: FundRefundOutcomeUnknown =>
      val next0: Map[String, String] = state.refundResultReceipts.updated(event.receiptId, event.receiptBody)
      val next1: String = event.kind
      state.copy(refundResultReceipts = next0, refundOutcome = next1)
    case event: FundTAReceiptObserved =>
      val next0: Map[String, String] = state.taObservedReceipts.updated(event.receiptId, event.receiptBody)
      state.copy(taObservedReceipts = next0)
    case event: BankPaymentResultSucceeded =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.paymentObservedResults.updated(event.txid, "succeeded")
      state.copy(paymentObservedResults = next0)
    case event: BankPaymentResultRejectedBeforeEffects =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.paymentObservedResults.updated(event.txid, "rejected-before-effects")
      state.copy(paymentObservedResults = next0)
    case event: BankPaymentResultCompensated =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.paymentObservedResults.updated(event.txid, "compensated")
      state.copy(paymentObservedResults = next0)
    case event: BankPaymentResultRecoveryRequired =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.paymentObservedResults.updated(event.txid, "recovery-required")
      state.copy(paymentObservedResults = next0)
    case event: BankPaymentResultOutcomeUnknown =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.paymentObservedResults.updated(event.txid, "outcome-unknown")
      state.copy(paymentObservedResults = next0)
    case event: BankRefundResultSucceeded =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.refundObservedResults.updated(event.txid, "succeeded")
      state.copy(refundObservedResults = next0)
    case event: BankRefundResultRejectedBeforeEffects =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.refundObservedResults.updated(event.txid, "rejected-before-effects")
      state.copy(refundObservedResults = next0)
    case event: BankRefundResultCompensated =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.refundObservedResults.updated(event.txid, "compensated")
      state.copy(refundObservedResults = next0)
    case event: BankRefundResultRecoveryRequired =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.refundObservedResults.updated(event.txid, "recovery-required")
      state.copy(refundObservedResults = next0)
    case event: BankRefundResultOutcomeUnknown =>
      val next0: Map[example.bankwealth.domain.values.TxId, String] = state.refundObservedResults.updated(event.txid, "outcome-unknown")
      state.copy(refundObservedResults = next0)
    case event: CashRequestSourceRecorded =>
      val next0: Option[example.bankwealth.domain.values.BankCashOriginal] = event.source
      val next1: Map[String, example.bankwealth.domain.values.BankCashOriginal] = state.cashRequestOriginals.updated("original", event.original)
      state.copy(cashRequestSource = next0, cashRequestOriginals = next1)
  }
}
