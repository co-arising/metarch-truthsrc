package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.FundOrderEntity._
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._
import example.bankwealth.domain.services.FundOrderComputations
import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

object FundOrderRules {
  final class RequestFundPurchaseSettlementRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RequestFundPurchaseSettlementParams] {
    override def apply(state: State, p: RequestFundPurchaseSettlementParams): Either[iMadzError, List[Event]] = {
      if (!(((state.cashRequestSource).isEmpty || (((((((state.cashRequestOriginals).contains("original") && (p.operationId == (((state.cashRequestOriginals)("original")).payment).operationId)) && (p.fundOrderId == (((state.cashRequestOriginals)("original")).payment).fundOrderId)) && (p.investorAccountId == (((state.cashRequestOriginals)("original")).payment).investorAccountId)) && (p.fundCollectionAccountId == (((state.cashRequestOriginals)("original")).payment).fundCollectionAccountId)) && (p.fundCode == (((state.cashRequestOriginals)("original")).payment).fundCode)) && { require((p.amount).currency == ((((state.cashRequestOriginals)("original")).payment).amount).currency, "exact units differ"); ((p.amount).amount == ((((state.cashRequestOriginals)("original")).payment).amount).amount) })))) return Left(iMadzError("CASH_ADMITTED_PAYMENT_MATCH", "CASH_ADMITTED_PAYMENT_MATCH"))
      if (!((p.fundOrderId == state.id))) return Left(iMadzError("ORDER_RESOURCE", "ORDER_RESOURCE"))
      if (!(((state.status == "new") || (((((p.operationId == state.operationId) && (p.investorAccountId == state.investorAccountId)) && (p.fundCollectionAccountId == state.fundCollectionAccountId)) && (p.fundCode == state.fundCode)) && { require((p.amount).currency == (state.amount).currency, "exact units differ"); ((p.amount).amount == (state.amount).amount) })))) return Left(iMadzError("ORDER_REPLAY_CONFLICT", "ORDER_REPLAY_CONFLICT"))
      if (!((state.status == "new"))) return Right(Nil)
      if (!((p.investorAccountId != p.fundCollectionAccountId))) return Left(iMadzError("ORDER_ACCOUNTS", "ORDER_ACCOUNTS"))
      if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) return Left(iMadzError("ORDER_AMOUNT", "ORDER_AMOUNT"))
      if (!((((p.operationId).value).nonEmpty && (p.fundCode).nonEmpty))) return Left(iMadzError("ORDER_OPERATION", "ORDER_OPERATION"))
      Right(List(FundPurchaseSettlementRequested(p.operationId, p.fundOrderId, p.investorAccountId, p.fundCollectionAccountId, p.fundCode, p.amount)))
    }
  }
  final class ReserveFundSubscriptionRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, ReserveFundSubscriptionParams] {
    override def apply(state: State, p: ReserveFundSubscriptionParams): Either[iMadzError, List[Event]] = {
      if (!((p.resource == state.id))) return Left(iMadzError("ORDER_PHASE_RESOURCE", "ORDER_PHASE_RESOURCE"))
      if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) return Left(iMadzError("ORDER_PHASE_POSITIVE", "ORDER_PHASE_POSITIVE"))
      if (!((!((state.committedSubscriptions).contains(p.txid)) || { require(((state.committedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("ORDER_COMMITTEDSUBSCRIPTIONS_MATCH", "ORDER_COMMITTEDSUBSCRIPTIONS_MATCH"))
      if (!((!((state.compensatedSubscriptions).contains(p.txid)) || { require(((state.compensatedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH", "ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH"))
      if (!((!((state.reservedSubscriptions).contains(p.txid)) || { require(((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("ORDER_RESERVEDSUBSCRIPTIONS_MATCH", "ORDER_RESERVEDSUBSCRIPTIONS_MATCH"))
      if (((state.committedSubscriptions).contains(p.txid))) return Right(Nil)
      if (((state.compensatedSubscriptions).contains(p.txid))) return Right(Nil)
      if (((state.reservedSubscriptions).contains(p.txid))) return Right(Nil)
      if (!(((state.status == "payment-requested") && { require((p.amount).currency == (state.amount).currency, "exact units differ"); ((p.amount).amount == (state.amount).amount) }))) return Left(iMadzError("ORDER_REQUEST_AMOUNT", "ORDER_REQUEST_AMOUNT"))
      Right(List(ReserveFundSubscriptionConfirmed(p.txid, p.resource, p.amount)))
    }
  }
  final class ConfirmFundSubscriptionPaymentRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, ConfirmFundSubscriptionPaymentParams] {
    override def apply(state: State, p: ConfirmFundSubscriptionPaymentParams): Either[iMadzError, List[Event]] = {
      if (!((p.resource == state.id))) return Left(iMadzError("ORDER_PHASE_RESOURCE", "ORDER_PHASE_RESOURCE"))
      if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) return Left(iMadzError("ORDER_PHASE_POSITIVE", "ORDER_PHASE_POSITIVE"))
      if (!((!((state.committedSubscriptions).contains(p.txid)) || { require(((state.committedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("ORDER_COMMITTEDSUBSCRIPTIONS_MATCH", "ORDER_COMMITTEDSUBSCRIPTIONS_MATCH"))
      if (((state.committedSubscriptions).contains(p.txid))) return Right(Nil)
      if (((state.compensatedSubscriptions).contains(p.txid))) return Left(iMadzError("ORDER_NOT_CANCELED", "ORDER_NOT_CANCELED"))
      if (!((state.reservedSubscriptions).contains(p.txid))) return Left(iMadzError("ORDER_PREPARED", "ORDER_PREPARED"))
      if (!((!((state.reservedSubscriptions).contains(p.txid)) || { require(((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("ORDER_RESERVEDSUBSCRIPTIONS_MATCH", "ORDER_RESERVEDSUBSCRIPTIONS_MATCH"))
      if (!({ require((p.amount).currency == (state.amount).currency, "exact units differ"); ((p.amount).amount == (state.amount).amount) })) return Left(iMadzError("ORDER_COMMIT_AMOUNT", "ORDER_COMMIT_AMOUNT"))
      Right(List(FundSubscriptionPaymentConfirmed(p.txid, p.resource, p.amount)))
    }
  }
  final class CancelCashFundSubscriptionRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, CancelCashFundSubscriptionParams] {
    override def apply(state: State, p: CancelCashFundSubscriptionParams): Either[iMadzError, List[Event]] = {
      if (!((p.resource == state.id))) return Left(iMadzError("ORDER_PHASE_RESOURCE", "ORDER_PHASE_RESOURCE"))
      if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) return Left(iMadzError("ORDER_PHASE_POSITIVE", "ORDER_PHASE_POSITIVE"))
      if (!((!((state.compensatedSubscriptions).contains(p.txid)) || { require(((state.compensatedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH", "ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH"))
      if (((state.compensatedSubscriptions).contains(p.txid))) return Right(Nil)
      if (((state.committedSubscriptions).contains(p.txid))) return Left(iMadzError("ORDER_CANCEL_NOT_COMMITTED", "ORDER_CANCEL_NOT_COMMITTED"))
      if (!((!((state.reservedSubscriptions).contains(p.txid)) || { require(((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("ORDER_RESERVEDSUBSCRIPTIONS_MATCH", "ORDER_RESERVEDSUBSCRIPTIONS_MATCH"))
      Right(List(CashFundSubscriptionCanceled(p.txid, p.resource, p.amount)))
    }
  }
  final class RecordFundCashPaymentSucceededRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentSucceededParams] {
    override def apply(state: State, p: RecordFundCashPaymentSucceededParams): Either[iMadzError, List[Event]] = {
      if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "succeeded")))) return Left(iMadzError("PAYMENT_TERMINAL_CONFLICT", "PAYMENT_TERMINAL_CONFLICT"))
      if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Nil)
      if (!(((state.committedSubscriptions).contains(p.txid) && (p.txid == state.selectedPaymentTxId)))) return Left(iMadzError("PAYMENT_COMMIT_PROOF", "PAYMENT_COMMIT_PROOF"))
      Right(List(FundCashPaymentSucceeded(p.txid, "succeeded")))
    }
  }
  final class RecordFundCashPaymentRejectedBeforeEffectsRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentRejectedBeforeEffectsParams] {
    override def apply(state: State, p: RecordFundCashPaymentRejectedBeforeEffectsParams): Either[iMadzError, List[Event]] = {
      if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "rejected-before-effects")))) return Left(iMadzError("PAYMENT_TERMINAL_CONFLICT", "PAYMENT_TERMINAL_CONFLICT"))
      if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Nil)
      Right(List(FundCashPaymentRejectedBeforeEffects(p.txid, "rejected-before-effects")))
    }
  }
  final class RecordFundCashPaymentCompensatedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentCompensatedParams] {
    override def apply(state: State, p: RecordFundCashPaymentCompensatedParams): Either[iMadzError, List[Event]] = {
      if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "compensated")))) return Left(iMadzError("PAYMENT_TERMINAL_CONFLICT", "PAYMENT_TERMINAL_CONFLICT"))
      if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Nil)
      Right(List(FundCashPaymentCompensated(p.txid, "compensated")))
    }
  }
  final class RecordFundCashPaymentRecoveryRequiredRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentRecoveryRequiredParams] {
    override def apply(state: State, p: RecordFundCashPaymentRecoveryRequiredParams): Either[iMadzError, List[Event]] = {
      if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Nil)
      if ((((state.cashPaymentResults).get(p.txid)).contains("recovery-required"))) return Right(Nil)
      Right(List(FundCashPaymentRecoveryRequired(p.txid, "recovery-required")))
    }
  }
  final class RecordFundCashPaymentOutcomeUnknownRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentOutcomeUnknownParams] {
    override def apply(state: State, p: RecordFundCashPaymentOutcomeUnknownParams): Either[iMadzError, List[Event]] = {
      if (((state.cashPaymentFinalResults).contains(p.txid))) return Right(Nil)
      if ((((state.cashPaymentResults).get(p.txid)).contains("outcome-unknown"))) return Right(Nil)
      Right(List(FundCashPaymentOutcomeUnknown(p.txid, "outcome-unknown")))
    }
  }
  final class RegisterFundTASubmissionRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RegisterFundTASubmissionParams] {
    override def apply(state: State, p: RegisterFundTASubmissionParams): Either[iMadzError, List[Event]] = {
      if (!((p.fundOrderId == state.id))) return Left(iMadzError("TA_SUBMIT_RESOURCE", "TA_SUBMIT_RESOURCE"))
      if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left(iMadzError("TA_PAID", "TA_PAID"))
      if (!(((state.taRequestId).value).isEmpty)) return Right(Nil)
      for {
        stableTaRequestId <- hosts.stableTaRequestId(state, p)
      } yield List(FundTASubmissionRegistered(p.fundOrderId, p.paymentTxId, stableTaRequestId))
    }
  }
  final class RecordFundTAAcceptedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundTAAcceptedParams] {
    override def apply(state: State, p: RecordFundTAAcceptedParams): Either[iMadzError, List[Event]] = {
      if (!((p.fundOrderId == state.id))) return Left(iMadzError("TA_ORDER", "TA_ORDER"))
      if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left(iMadzError("TA_PAYMENT", "TA_PAYMENT"))
      if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) return Left(iMadzError("TA_REQUEST", "TA_REQUEST"))
      if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) return Left(iMadzError("TA_REFERENCE", "TA_REFERENCE"))
      if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) return Left(iMadzError("TA_FUND", "TA_FUND"))
      if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left(iMadzError("TA_RECEIPT_PRESENT", "TA_RECEIPT_PRESENT"))
      if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("accepted"))))) return Left(iMadzError("TA_RECEIPT_CONFLICT", "TA_RECEIPT_CONFLICT"))
      if (((state.taReceipts).contains(p.receiptId))) return Right(Nil)
      if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) return Right(Nil)
      Right(List(FundTAAccepted(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "accepted")))
    }
  }
  final class RecordFundTAConfirmedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundTAConfirmedParams] {
    override def apply(state: State, p: RecordFundTAConfirmedParams): Either[iMadzError, List[Event]] = {
      if (!((p.fundOrderId == state.id))) return Left(iMadzError("TA_ORDER", "TA_ORDER"))
      if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left(iMadzError("TA_PAYMENT", "TA_PAYMENT"))
      if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) return Left(iMadzError("TA_REQUEST", "TA_REQUEST"))
      if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) return Left(iMadzError("TA_REFERENCE", "TA_REFERENCE"))
      if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) return Left(iMadzError("TA_FUND", "TA_FUND"))
      if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left(iMadzError("TA_RECEIPT_PRESENT", "TA_RECEIPT_PRESENT"))
      if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("confirmed"))))) return Left(iMadzError("TA_RECEIPT_CONFLICT", "TA_RECEIPT_CONFLICT"))
      if (((state.taReceipts).contains(p.receiptId))) return Right(Nil)
      if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) return Left(iMadzError("TA_TERMINAL_CONFLICT", "TA_TERMINAL_CONFLICT"))
      if (!(((((p.shares).fundCode == state.fundCode) && (((p.shares).shares).value).nonEmpty) && (((p.shares).nav).value).nonEmpty))) return Left(iMadzError("TA_SHARE_FUND", "TA_SHARE_FUND"))
      Right(List(FundTASharesConfirmed(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.shares, "confirmed")))
    }
  }
  final class RecordFundTARejectedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundTARejectedParams] {
    override def apply(state: State, p: RecordFundTARejectedParams): Either[iMadzError, List[Event]] = {
      if (!((p.fundOrderId == state.id))) return Left(iMadzError("TA_ORDER", "TA_ORDER"))
      if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left(iMadzError("TA_PAYMENT", "TA_PAYMENT"))
      if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) return Left(iMadzError("TA_REQUEST", "TA_REQUEST"))
      if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) return Left(iMadzError("TA_REFERENCE", "TA_REFERENCE"))
      if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) return Left(iMadzError("TA_FUND", "TA_FUND"))
      if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left(iMadzError("TA_RECEIPT_PRESENT", "TA_RECEIPT_PRESENT"))
      if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("rejected"))))) return Left(iMadzError("TA_RECEIPT_CONFLICT", "TA_RECEIPT_CONFLICT"))
      if (((state.taReceipts).contains(p.receiptId))) return Right(Nil)
      if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) return Left(iMadzError("TA_TERMINAL_CONFLICT", "TA_TERMINAL_CONFLICT"))
      if (!((p.reason).nonEmpty)) return Left(iMadzError("TA_REJECTION_REASON", "TA_REJECTION_REASON"))
      Right(List(FundTARejected(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.reason, "rejected")))
    }
  }
  final class RecordFundTAUnknownRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundTAUnknownParams] {
    override def apply(state: State, p: RecordFundTAUnknownParams): Either[iMadzError, List[Event]] = {
      if (!((p.fundOrderId == state.id))) return Left(iMadzError("TA_ORDER", "TA_ORDER"))
      if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left(iMadzError("TA_PAYMENT", "TA_PAYMENT"))
      if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) return Left(iMadzError("TA_REQUEST", "TA_REQUEST"))
      if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) return Left(iMadzError("TA_REFERENCE", "TA_REFERENCE"))
      if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) return Left(iMadzError("TA_FUND", "TA_FUND"))
      if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left(iMadzError("TA_RECEIPT_PRESENT", "TA_RECEIPT_PRESENT"))
      if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("unknown"))))) return Left(iMadzError("TA_RECEIPT_CONFLICT", "TA_RECEIPT_CONFLICT"))
      if (((state.taReceipts).contains(p.receiptId))) return Right(Nil)
      if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) return Right(Nil)
      Right(List(FundTAUnknown(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "unknown")))
    }
  }
  final class RequestFundPurchaseRefundRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RequestFundPurchaseRefundParams] {
    override def apply(state: State, p: RequestFundPurchaseRefundParams): Either[iMadzError, List[Event]] = {
      if (!((p.fundOrderId == state.id))) return Left(iMadzError("REFUND_RESOURCE", "REFUND_RESOURCE"))
      if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) return Left(iMadzError("REFUND_PAYMENT", "REFUND_PAYMENT"))
      if (!((state.taStatus == "rejected"))) return Left(iMadzError("REFUND_TA_REJECTED", "REFUND_TA_REJECTED"))
      if (!(((state.refundOperationId).value).isEmpty)) return Right(Nil)
      for {
        stableRefundOperationId <- hosts.stableRefundOperationId(state, p)
      } yield List(FundPurchaseRefundRequested(p.fundOrderId, p.paymentTxId, state.investorAccountId, state.fundCollectionAccountId, state.amount, stableRefundOperationId))
    }
  }
  final class RecordFundRefundSucceededRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundSucceededParams] {
    override def apply(state: State, p: RecordFundRefundSucceededParams): Either[iMadzError, List[Event]] = {
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "succeeded")))) return Left(iMadzError("REFUND_TERMINAL_CONFLICT", "REFUND_TERMINAL_CONFLICT"))
      if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Nil)
      if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Nil)
      Right(List(FundRefundSucceeded(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "succeeded")))
    }
  }
  final class RecordFundRefundRejectedBeforeEffectsRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundRejectedBeforeEffectsParams] {
    override def apply(state: State, p: RecordFundRefundRejectedBeforeEffectsParams): Either[iMadzError, List[Event]] = {
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "rejected-before-effects")))) return Left(iMadzError("REFUND_TERMINAL_CONFLICT", "REFUND_TERMINAL_CONFLICT"))
      if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Nil)
      if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Nil)
      Right(List(FundRefundRejectedBeforeEffects(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "rejected-before-effects")))
    }
  }
  final class RecordFundRefundCompensatedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundCompensatedParams] {
    override def apply(state: State, p: RecordFundRefundCompensatedParams): Either[iMadzError, List[Event]] = {
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "compensated")))) return Left(iMadzError("REFUND_TERMINAL_CONFLICT", "REFUND_TERMINAL_CONFLICT"))
      if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Nil)
      if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Nil)
      Right(List(FundRefundCompensated(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "compensated")))
    }
  }
  final class RecordFundRefundRecoveryRequiredRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundRecoveryRequiredParams] {
    override def apply(state: State, p: RecordFundRefundRecoveryRequiredParams): Either[iMadzError, List[Event]] = {
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Nil)
      if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Nil)
      Right(List(FundRefundRecoveryRequired(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "recovery-required")))
    }
  }
  final class RecordFundRefundOutcomeUnknownRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundOutcomeUnknownParams] {
    override def apply(state: State, p: RecordFundRefundOutcomeUnknownParams): Either[iMadzError, List[Event]] = {
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) return Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) return Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) return Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      if (((state.refundResultReceipts).contains(p.receiptId))) return Right(Nil)
      if (((state.refundFinalResults).contains(p.refundTxId))) return Right(Nil)
      Right(List(FundRefundOutcomeUnknown(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "outcome-unknown")))
    }
  }
  final class RecordCashRequestSourceRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordCashRequestSourceParams] {
    override def apply(state: State, p: RecordCashRequestSourceParams): Either[iMadzError, List[Event]] = {
      if (!((p.source).contains(p.original))) return Left(iMadzError("CASH_SOURCE_OPTION", "CASH_SOURCE_OPTION"))
      if (!((((p.original).payment).fundOrderId == state.id))) return Left(iMadzError("CASH_SOURCE_RESOURCE", "CASH_SOURCE_RESOURCE"))
      if (!((((((((p.original).principalId).nonEmpty && ((p.original).clientRequestId).nonEmpty) && ((p.original).authorityVersion).nonEmpty) && ((p.original).clientRequestId == ((p.original).request).clientRequestId)) && (((p.original).request).fundCode == ((p.original).payment).fundCode)) && ((((p.original).request).amount).currency == (((p.original).payment).amount).currency)))) return Left(iMadzError("CASH_SOURCE_BODY", "CASH_SOURCE_BODY"))
      if (!(((state.cashRequestSource).isEmpty || (state.cashRequestSource).contains(p.original)))) return Left(iMadzError("CASH_SOURCE_CONFLICT", "CASH_SOURCE_CONFLICT"))
      if (!(((state.status == "new") || (((((((p.original).payment).operationId == state.operationId) && (((p.original).payment).investorAccountId == state.investorAccountId)) && (((p.original).payment).fundCollectionAccountId == state.fundCollectionAccountId)) && (((p.original).payment).fundCode == state.fundCode)) && { require((((p.original).payment).amount).currency == (state.amount).currency, "exact units differ"); ((((p.original).payment).amount).amount == (state.amount).amount) })))) return Left(iMadzError("CASH_SOURCE_PAYMENT", "CASH_SOURCE_PAYMENT"))
      if (!((state.cashRequestSource).isEmpty)) return Right(Nil)
      if (!((state.status == "new"))) return Left(iMadzError("CASH_SOURCE_BEFORE_SETTLEMENT", "CASH_SOURCE_BEFORE_SETTLEMENT"))
      Right(List(CashRequestSourceRecorded(p.original, p.source)))
    }
  }
}
