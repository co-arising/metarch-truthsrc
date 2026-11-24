package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.FundOrderEntity._
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._
import example.bankwealth.domain.services.FundOrderComputations

object FundOrderRules {
  def RequestFundPurchaseSettlement(state: State, p: RequestFundPurchaseSettlementParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!(((state.cashRequestSource).isEmpty || (((((((state.cashRequestOriginals).contains("original") && (p.operationId == (((state.cashRequestOriginals)("original")).payment).operationId)) && (p.fundOrderId == (((state.cashRequestOriginals)("original")).payment).fundOrderId)) && (p.investorAccountId == (((state.cashRequestOriginals)("original")).payment).investorAccountId)) && (p.fundCollectionAccountId == (((state.cashRequestOriginals)("original")).payment).fundCollectionAccountId)) && (p.fundCode == (((state.cashRequestOriginals)("original")).payment).fundCode)) && { require((p.amount).currency == ((((state.cashRequestOriginals)("original")).payment).amount).currency, "exact units differ"); ((p.amount).amount == ((((state.cashRequestOriginals)("original")).payment).amount).amount) })))) return Left("CASH_ADMITTED_PAYMENT_MATCH")
    if (!((p.fundOrderId == state.id))) return Left("ORDER_RESOURCE")
    if (!(((state.status == "new") || (((((p.operationId == state.operationId) && (p.investorAccountId == state.investorAccountId)) && (p.fundCollectionAccountId == state.fundCollectionAccountId)) && (p.fundCode == state.fundCode)) && { require((p.amount).currency == (state.amount).currency, "exact units differ"); ((p.amount).amount == (state.amount).amount) })))) return Left("ORDER_REPLAY_CONFLICT")
    if (!((state.status == "new"))) return Right(Vector.empty)
    if (!((p.investorAccountId != p.fundCollectionAccountId))) return Left("ORDER_ACCOUNTS")
    if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) return Left("ORDER_AMOUNT")
    if (!((((p.operationId).value).nonEmpty && (p.fundCode).nonEmpty))) return Left("ORDER_OPERATION")
    Right(Vector(FundPurchaseSettlementRequested(p.operationId, p.fundOrderId, p.investorAccountId, p.fundCollectionAccountId, p.fundCode, p.amount)))
  }
  def ReserveFundSubscription(state: State, p: ReserveFundSubscriptionParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.resource == state.id))) return Left("ORDER_PHASE_RESOURCE")
    if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) return Left("ORDER_PHASE_POSITIVE")
    if (!((!((state.committedSubscriptions).contains(p.txid)) || { require(((state.committedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left("ORDER_COMMITTEDSUBSCRIPTIONS_MATCH")
    if (!((!((state.compensatedSubscriptions).contains(p.txid)) || { require(((state.compensatedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left("ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH")
    if (!((!((state.reservedSubscriptions).contains(p.txid)) || { require(((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left("ORDER_RESERVEDSUBSCRIPTIONS_MATCH")
    if (((state.committedSubscriptions).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedSubscriptions).contains(p.txid))) return Right(Vector.empty)
    if (((state.reservedSubscriptions).contains(p.txid))) return Right(Vector.empty)
    if (!(((state.status == "payment-requested") && { require((p.amount).currency == (state.amount).currency, "exact units differ"); ((p.amount).amount == (state.amount).amount) }))) return Left("ORDER_REQUEST_AMOUNT")
    Right(Vector(ReserveFundSubscriptionConfirmed(p.txid, p.resource, p.amount)))
  }
  def ConfirmFundSubscriptionPayment(state: State, p: ConfirmFundSubscriptionPaymentParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.resource == state.id))) return Left("ORDER_PHASE_RESOURCE")
    if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) return Left("ORDER_PHASE_POSITIVE")
    if (!((!((state.committedSubscriptions).contains(p.txid)) || { require(((state.committedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left("ORDER_COMMITTEDSUBSCRIPTIONS_MATCH")
    if (((state.committedSubscriptions).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedSubscriptions).contains(p.txid))) return Left("ORDER_NOT_CANCELED")
    if (!((state.reservedSubscriptions).contains(p.txid))) return Left("ORDER_PREPARED")
    if (!((!((state.reservedSubscriptions).contains(p.txid)) || { require(((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left("ORDER_RESERVEDSUBSCRIPTIONS_MATCH")
    if (!({ require((p.amount).currency == (state.amount).currency, "exact units differ"); ((p.amount).amount == (state.amount).amount) })) return Left("ORDER_COMMIT_AMOUNT")
    Right(Vector(FundSubscriptionPaymentConfirmed(p.txid, p.resource, p.amount)))
  }
  def CancelCashFundSubscription(state: State, p: CancelCashFundSubscriptionParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.resource == state.id))) return Left("ORDER_PHASE_RESOURCE")
    if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) return Left("ORDER_PHASE_POSITIVE")
    if (!((!((state.compensatedSubscriptions).contains(p.txid)) || { require(((state.compensatedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left("ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH")
    if (((state.compensatedSubscriptions).contains(p.txid))) return Right(Vector.empty)
    if (((state.committedSubscriptions).contains(p.txid))) return Left("ORDER_CANCEL_NOT_COMMITTED")
    if (!((!((state.reservedSubscriptions).contains(p.txid)) || { require(((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left("ORDER_RESERVEDSUBSCRIPTIONS_MATCH")
    Right(Vector(CashFundSubscriptionCanceled(p.txid, p.resource, p.amount)))
  }
  def RecordFundCashPaymentSucceeded(state: State, p: RecordFundCashPaymentSucceededParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "succeeded")))) return Left("PAYMENT_TERMINAL_CONFLICT")
    if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Vector.empty)
    if (!(((state.committedSubscriptions).contains(p.txid) && (p.txid == state.selectedPaymentTxId)))) return Left("PAYMENT_COMMIT_PROOF")
    Right(Vector(FundCashPaymentSucceeded(p.txid, "succeeded")))
  }
  def RecordFundCashPaymentRejectedBeforeEffects(state: State, p: RecordFundCashPaymentRejectedBeforeEffectsParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "rejected-before-effects")))) return Left("PAYMENT_TERMINAL_CONFLICT")
    if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Vector.empty)
    Right(Vector(FundCashPaymentRejectedBeforeEffects(p.txid, "rejected-before-effects")))
  }
  def RecordFundCashPaymentCompensated(state: State, p: RecordFundCashPaymentCompensatedParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "compensated")))) return Left("PAYMENT_TERMINAL_CONFLICT")
    if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Vector.empty)
    Right(Vector(FundCashPaymentCompensated(p.txid, "compensated")))
  }
  def RecordFundCashPaymentRecoveryRequired(state: State, p: RecordFundCashPaymentRecoveryRequiredParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Vector.empty)
    if ((((state.cashPaymentResults).get(p.txid)).contains("recovery-required"))) return Right(Vector.empty)
    Right(Vector(FundCashPaymentRecoveryRequired(p.txid, "recovery-required")))
  }
  def RecordFundCashPaymentOutcomeUnknown(state: State, p: RecordFundCashPaymentOutcomeUnknownParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Vector.empty)
    if ((((state.cashPaymentResults).get(p.txid)).contains("outcome-unknown"))) return Right(Vector.empty)
    Right(Vector(FundCashPaymentOutcomeUnknown(p.txid, "outcome-unknown")))
  }
  def RegisterFundTASubmission(state: State, p: RegisterFundTASubmissionParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.fundOrderId == state.id))) return Left("TA_SUBMIT_RESOURCE")
    if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left("TA_PAID")
    if (!(((state.taRequestId).value).isEmpty)) return Right(Vector.empty)
    Right(Vector(FundTASubmissionRegistered(p.fundOrderId, p.paymentTxId, hosts.StableTaRequestId(state, p))))
  }
  def RecordFundTAAccepted(state: State, p: RecordFundTAAcceptedParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.fundOrderId == state.id))) return Left("TA_ORDER")
    if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left("TA_PAYMENT")
    if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) return Left("TA_REQUEST")
    if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) return Left("TA_REFERENCE")
    if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) return Left("TA_FUND")
    if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left("TA_RECEIPT_PRESENT")
    if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("accepted"))))) return Left("TA_RECEIPT_CONFLICT")
    if (((state.taReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) return Right(Vector.empty)
    Right(Vector(FundTAAccepted(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "accepted")))
  }
  def RecordFundTAConfirmed(state: State, p: RecordFundTAConfirmedParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.fundOrderId == state.id))) return Left("TA_ORDER")
    if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left("TA_PAYMENT")
    if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) return Left("TA_REQUEST")
    if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) return Left("TA_REFERENCE")
    if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) return Left("TA_FUND")
    if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left("TA_RECEIPT_PRESENT")
    if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("confirmed"))))) return Left("TA_RECEIPT_CONFLICT")
    if (((state.taReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) return Left("TA_TERMINAL_CONFLICT")
    if (!(((((p.shares).fundCode == state.fundCode) && (((p.shares).shares).value).nonEmpty) && (((p.shares).nav).value).nonEmpty))) return Left("TA_SHARE_FUND")
    Right(Vector(FundTASharesConfirmed(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.shares, "confirmed")))
  }
  def RecordFundTARejected(state: State, p: RecordFundTARejectedParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.fundOrderId == state.id))) return Left("TA_ORDER")
    if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left("TA_PAYMENT")
    if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) return Left("TA_REQUEST")
    if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) return Left("TA_REFERENCE")
    if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) return Left("TA_FUND")
    if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left("TA_RECEIPT_PRESENT")
    if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("rejected"))))) return Left("TA_RECEIPT_CONFLICT")
    if (((state.taReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) return Left("TA_TERMINAL_CONFLICT")
    if (!((p.reason).nonEmpty)) return Left("TA_REJECTION_REASON")
    Right(Vector(FundTARejected(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.reason, "rejected")))
  }
  def RecordFundTAUnknown(state: State, p: RecordFundTAUnknownParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.fundOrderId == state.id))) return Left("TA_ORDER")
    if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left("TA_PAYMENT")
    if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) return Left("TA_REQUEST")
    if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) return Left("TA_REFERENCE")
    if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) return Left("TA_FUND")
    if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left("TA_RECEIPT_PRESENT")
    if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("unknown"))))) return Left("TA_RECEIPT_CONFLICT")
    if (((state.taReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) return Right(Vector.empty)
    Right(Vector(FundTAUnknown(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "unknown")))
  }
  def RequestFundPurchaseRefund(state: State, p: RequestFundPurchaseRefundParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.fundOrderId == state.id))) return Left("REFUND_RESOURCE")
    if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left("REFUND_PAYMENT")
    if (!((state.taStatus == "rejected"))) return Left("REFUND_TA_REJECTED")
    if (!(((state.refundOperationId).value).isEmpty)) return Right(Vector.empty)
    Right(Vector(FundPurchaseRefundRequested(p.fundOrderId, p.paymentTxId, state.investorAccountId, state.fundCollectionAccountId, state.amount, hosts.StableRefundOperationId(state, p))))
  }
  def RecordFundRefundSucceeded(state: State, p: RecordFundRefundSucceededParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left("REFUND_RESULT_ASSOCIATION")
    if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left("REFUND_RECEIPT_PRESENT")
    if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left("REFUND_RECEIPT_CONFLICT")
    if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "succeeded")))) return Left("REFUND_TERMINAL_CONFLICT")
    if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Vector.empty)
    Right(Vector(FundRefundSucceeded(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "succeeded")))
  }
  def RecordFundRefundRejectedBeforeEffects(state: State, p: RecordFundRefundRejectedBeforeEffectsParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left("REFUND_RESULT_ASSOCIATION")
    if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left("REFUND_RECEIPT_PRESENT")
    if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left("REFUND_RECEIPT_CONFLICT")
    if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "rejected-before-effects")))) return Left("REFUND_TERMINAL_CONFLICT")
    if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Vector.empty)
    Right(Vector(FundRefundRejectedBeforeEffects(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "rejected-before-effects")))
  }
  def RecordFundRefundCompensated(state: State, p: RecordFundRefundCompensatedParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left("REFUND_RESULT_ASSOCIATION")
    if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left("REFUND_RECEIPT_PRESENT")
    if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left("REFUND_RECEIPT_CONFLICT")
    if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "compensated")))) return Left("REFUND_TERMINAL_CONFLICT")
    if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Vector.empty)
    Right(Vector(FundRefundCompensated(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "compensated")))
  }
  def RecordFundRefundRecoveryRequired(state: State, p: RecordFundRefundRecoveryRequiredParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left("REFUND_RESULT_ASSOCIATION")
    if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left("REFUND_RECEIPT_PRESENT")
    if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left("REFUND_RECEIPT_CONFLICT")
    if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Vector.empty)
    Right(Vector(FundRefundRecoveryRequired(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "recovery-required")))
  }
  def RecordFundRefundOutcomeUnknown(state: State, p: RecordFundRefundOutcomeUnknownParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left("REFUND_RESULT_ASSOCIATION")
    if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left("REFUND_RECEIPT_PRESENT")
    if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left("REFUND_RECEIPT_CONFLICT")
    if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Vector.empty)
    if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Vector.empty)
    Right(Vector(FundRefundOutcomeUnknown(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "outcome-unknown")))
  }
  def RecordCashRequestSource(state: State, p: RecordCashRequestSourceParams, hosts: FundOrderComputations): Either[String, Vector[Event]] = {
    if (!((p.source).contains(p.original))) return Left("CASH_SOURCE_OPTION")
    if (!((((p.original).payment).fundOrderId == state.id))) return Left("CASH_SOURCE_RESOURCE")
    if (!((((((((p.original).principalId).nonEmpty && ((p.original).clientRequestId).nonEmpty) && ((p.original).authorityVersion).nonEmpty) && ((p.original).clientRequestId == ((p.original).request).clientRequestId)) && (((p.original).request).fundCode == ((p.original).payment).fundCode)) && ((((p.original).request).amount).currency == (((p.original).payment).amount).currency)))) return Left("CASH_SOURCE_BODY")
    if (!(((state.cashRequestSource).isEmpty || (state.cashRequestSource).contains(p.original)))) return Left("CASH_SOURCE_CONFLICT")
    if (!(((state.status == "new") || (((((((p.original).payment).operationId == state.operationId) && (((p.original).payment).investorAccountId == state.investorAccountId)) && (((p.original).payment).fundCollectionAccountId == state.fundCollectionAccountId)) && (((p.original).payment).fundCode == state.fundCode)) && { require((((p.original).payment).amount).currency == (state.amount).currency, "exact units differ"); ((((p.original).payment).amount).amount == (state.amount).amount) })))) return Left("CASH_SOURCE_PAYMENT")
    if (!((state.cashRequestSource).isEmpty)) return Right(Vector.empty)
    if (!((state.status == "new"))) return Left("CASH_SOURCE_BEFORE_SETTLEMENT")
    Right(Vector(CashRequestSourceRecorded(p.original, p.source)))
  }
}
