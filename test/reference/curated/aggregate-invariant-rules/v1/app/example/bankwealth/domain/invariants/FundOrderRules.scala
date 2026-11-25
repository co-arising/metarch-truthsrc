package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.FundOrderEntity._
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._
import example.bankwealth.domain.services.FundOrderComputations
import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

object FundOrderRules {
  // @knowledge source:bank-v1#/aggregates/1/commands/0
  final class RequestFundPurchaseSettlementRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RequestFundPurchaseSettlementParams] {
    override def apply(state: State, p: RequestFundPurchaseSettlementParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/0/guards/0
      if (!(((state.cashRequestSource).isEmpty || (((((((state.cashRequestOriginals).contains("original") && (p.operationId == (((state.cashRequestOriginals)("original")).payment).operationId)) && (p.fundOrderId == (((state.cashRequestOriginals)("original")).payment).fundOrderId)) && (p.investorAccountId == (((state.cashRequestOriginals)("original")).payment).investorAccountId)) && (p.fundCollectionAccountId == (((state.cashRequestOriginals)("original")).payment).fundCollectionAccountId)) && (p.fundCode == (((state.cashRequestOriginals)("original")).payment).fundCode)) && (((p.amount).currency == ((((state.cashRequestOriginals)("original")).payment).amount).currency) && ((p.amount).amount == ((((state.cashRequestOriginals)("original")).payment).amount).amount)))))) Left(iMadzError("CASH_ADMITTED_PAYMENT_MATCH", "CASH_ADMITTED_PAYMENT_MATCH"))
      // @knowledge source:bank-v1#/aggregates/1/commands/0/guards/1
      else if (!((p.fundOrderId == state.id))) Left(iMadzError("ORDER_RESOURCE", "ORDER_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/0/guards/2
      else if (!(((state.status == "new") || (((((p.operationId == state.operationId) && (p.investorAccountId == state.investorAccountId)) && (p.fundCollectionAccountId == state.fundCollectionAccountId)) && (p.fundCode == state.fundCode)) && (((p.amount).currency == (state.amount).currency) && ((p.amount).amount == (state.amount).amount)))))) Left(iMadzError("ORDER_REPLAY_CONFLICT", "ORDER_REPLAY_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/0/guards/3
      else if (!((state.status == "new"))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/0/guards/4
      else if (!((p.investorAccountId != p.fundCollectionAccountId))) Left(iMadzError("ORDER_ACCOUNTS", "ORDER_ACCOUNTS"))
      // @knowledge source:bank-v1#/aggregates/1/commands/0/guards/5
      else if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) Left(iMadzError("ORDER_AMOUNT", "ORDER_AMOUNT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/0/guards/6
      else if (!((((p.operationId).value).nonEmpty && (p.fundCode).nonEmpty))) Left(iMadzError("ORDER_OPERATION", "ORDER_OPERATION"))
      else Right(List(FundPurchaseSettlementRequested(p.operationId, p.fundOrderId, p.investorAccountId, p.fundCollectionAccountId, p.fundCode, p.amount)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/1
  final class ReserveFundSubscriptionRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, ReserveFundSubscriptionParams] {
    override def apply(state: State, p: ReserveFundSubscriptionParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/0
      if (!((p.resource == state.id))) Left(iMadzError("ORDER_PHASE_RESOURCE", "ORDER_PHASE_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/1
      else if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) Left(iMadzError("ORDER_PHASE_POSITIVE", "ORDER_PHASE_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/2
      else if (!((!((state.committedSubscriptions).contains(p.txid)) || ((((state.committedSubscriptions)(p.txid)).currency == (p.amount).currency) && (((state.committedSubscriptions)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("ORDER_COMMITTEDSUBSCRIPTIONS_MATCH", "ORDER_COMMITTEDSUBSCRIPTIONS_MATCH"))
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/3
      else if (!((!((state.compensatedSubscriptions).contains(p.txid)) || ((((state.compensatedSubscriptions)(p.txid)).currency == (p.amount).currency) && (((state.compensatedSubscriptions)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH", "ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH"))
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/4
      else if (!((!((state.reservedSubscriptions).contains(p.txid)) || ((((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency) && (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("ORDER_RESERVEDSUBSCRIPTIONS_MATCH", "ORDER_RESERVEDSUBSCRIPTIONS_MATCH"))
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/5
      else if (((state.committedSubscriptions).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/6
      else if (((state.compensatedSubscriptions).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/7
      else if (((state.reservedSubscriptions).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/1/guards/8
      else if (!(((state.status == "payment-requested") && (((p.amount).currency == (state.amount).currency) && ((p.amount).amount == (state.amount).amount))))) Left(iMadzError("ORDER_REQUEST_AMOUNT", "ORDER_REQUEST_AMOUNT"))
      else Right(List(ReserveFundSubscriptionConfirmed(p.txid, p.resource, p.amount)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/2
  final class ConfirmFundSubscriptionPaymentRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, ConfirmFundSubscriptionPaymentParams] {
    override def apply(state: State, p: ConfirmFundSubscriptionPaymentParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/2/guards/0
      if (!((p.resource == state.id))) Left(iMadzError("ORDER_PHASE_RESOURCE", "ORDER_PHASE_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/2/guards/1
      else if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) Left(iMadzError("ORDER_PHASE_POSITIVE", "ORDER_PHASE_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/2/guards/2
      else if (!((!((state.committedSubscriptions).contains(p.txid)) || ((((state.committedSubscriptions)(p.txid)).currency == (p.amount).currency) && (((state.committedSubscriptions)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("ORDER_COMMITTEDSUBSCRIPTIONS_MATCH", "ORDER_COMMITTEDSUBSCRIPTIONS_MATCH"))
      // @knowledge source:bank-v1#/aggregates/1/commands/2/guards/3
      else if (((state.committedSubscriptions).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/2/guards/4
      else if (((state.compensatedSubscriptions).contains(p.txid))) Left(iMadzError("ORDER_NOT_CANCELED", "ORDER_NOT_CANCELED"))
      // @knowledge source:bank-v1#/aggregates/1/commands/2/guards/5
      else if (!((state.reservedSubscriptions).contains(p.txid))) Left(iMadzError("ORDER_PREPARED", "ORDER_PREPARED"))
      // @knowledge source:bank-v1#/aggregates/1/commands/2/guards/6
      else if (!((!((state.reservedSubscriptions).contains(p.txid)) || ((((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency) && (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("ORDER_RESERVEDSUBSCRIPTIONS_MATCH", "ORDER_RESERVEDSUBSCRIPTIONS_MATCH"))
      // @knowledge source:bank-v1#/aggregates/1/commands/2/guards/7
      else if (!((((p.amount).currency == (state.amount).currency) && ((p.amount).amount == (state.amount).amount)))) Left(iMadzError("ORDER_COMMIT_AMOUNT", "ORDER_COMMIT_AMOUNT"))
      else Right(List(FundSubscriptionPaymentConfirmed(p.txid, p.resource, p.amount)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/3
  final class CancelCashFundSubscriptionRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, CancelCashFundSubscriptionParams] {
    override def apply(state: State, p: CancelCashFundSubscriptionParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/3/guards/0
      if (!((p.resource == state.id))) Left(iMadzError("ORDER_PHASE_RESOURCE", "ORDER_PHASE_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/3/guards/1
      else if (!((((p.amount).currency == "CNY") && ((p.amount).amount > BigDecimal("0.00"))))) Left(iMadzError("ORDER_PHASE_POSITIVE", "ORDER_PHASE_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/3/guards/2
      else if (!((!((state.compensatedSubscriptions).contains(p.txid)) || ((((state.compensatedSubscriptions)(p.txid)).currency == (p.amount).currency) && (((state.compensatedSubscriptions)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH", "ORDER_COMPENSATEDSUBSCRIPTIONS_MATCH"))
      // @knowledge source:bank-v1#/aggregates/1/commands/3/guards/3
      else if (((state.compensatedSubscriptions).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/3/guards/4
      else if (((state.committedSubscriptions).contains(p.txid))) Left(iMadzError("ORDER_CANCEL_NOT_COMMITTED", "ORDER_CANCEL_NOT_COMMITTED"))
      // @knowledge source:bank-v1#/aggregates/1/commands/3/guards/5
      else if (!((!((state.reservedSubscriptions).contains(p.txid)) || ((((state.reservedSubscriptions)(p.txid)).currency == (p.amount).currency) && (((state.reservedSubscriptions)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("ORDER_RESERVEDSUBSCRIPTIONS_MATCH", "ORDER_RESERVEDSUBSCRIPTIONS_MATCH"))
      else Right(List(CashFundSubscriptionCanceled(p.txid, p.resource, p.amount)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/4
  final class RecordFundCashPaymentSucceededRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentSucceededParams] {
    override def apply(state: State, p: RecordFundCashPaymentSucceededParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/4/guards/0
      if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "succeeded")))) Left(iMadzError("PAYMENT_TERMINAL_CONFLICT", "PAYMENT_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/4/guards/1
      else if (((state.cashPaymentFinalResults).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/4/guards/2
      else if (!(((state.committedSubscriptions).contains(p.txid) && (p.txid == state.selectedPaymentTxId)))) Left(iMadzError("PAYMENT_COMMIT_PROOF", "PAYMENT_COMMIT_PROOF"))
      else Right(List(FundCashPaymentSucceeded(p.txid, "succeeded")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/5
  final class RecordFundCashPaymentRejectedBeforeEffectsRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentRejectedBeforeEffectsParams] {
    override def apply(state: State, p: RecordFundCashPaymentRejectedBeforeEffectsParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/5/guards/0
      if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "rejected-before-effects")))) Left(iMadzError("PAYMENT_TERMINAL_CONFLICT", "PAYMENT_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/5/guards/1
      else if (((state.cashPaymentFinalResults).contains(p.txid))) Right(Nil)
      else Right(List(FundCashPaymentRejectedBeforeEffects(p.txid, "rejected-before-effects")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/6
  final class RecordFundCashPaymentCompensatedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentCompensatedParams] {
    override def apply(state: State, p: RecordFundCashPaymentCompensatedParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/6/guards/0
      if (!((!((state.cashPaymentFinalResults).contains(p.txid)) || ((state.cashPaymentFinalResults)(p.txid) == "compensated")))) Left(iMadzError("PAYMENT_TERMINAL_CONFLICT", "PAYMENT_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/6/guards/1
      else if (((state.cashPaymentFinalResults).contains(p.txid))) Right(Nil)
      else Right(List(FundCashPaymentCompensated(p.txid, "compensated")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/7
  final class RecordFundCashPaymentRecoveryRequiredRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentRecoveryRequiredParams] {
    override def apply(state: State, p: RecordFundCashPaymentRecoveryRequiredParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/7/guards/0
      if (((state.cashPaymentFinalResults).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/7/guards/1
      else if ((((state.cashPaymentResults).get(p.txid)).contains("recovery-required"))) Right(Nil)
      else Right(List(FundCashPaymentRecoveryRequired(p.txid, "recovery-required")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/8
  final class RecordFundCashPaymentOutcomeUnknownRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundCashPaymentOutcomeUnknownParams] {
    override def apply(state: State, p: RecordFundCashPaymentOutcomeUnknownParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/8/guards/0
      if (((state.cashPaymentFinalResults).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/8/guards/1
      else if ((((state.cashPaymentResults).get(p.txid)).contains("outcome-unknown"))) Right(Nil)
      else Right(List(FundCashPaymentOutcomeUnknown(p.txid, "outcome-unknown")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/9
  final class RegisterFundTASubmissionRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RegisterFundTASubmissionParams] {
    override def apply(state: State, p: RegisterFundTASubmissionParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/9/guards/0
      if (!((p.fundOrderId == state.id))) Left(iMadzError("TA_SUBMIT_RESOURCE", "TA_SUBMIT_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/9/guards/1
      else if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) Left(iMadzError("TA_PAID", "TA_PAID"))
      // @knowledge source:bank-v1#/aggregates/1/commands/9/guards/2
      else if (!(((state.taRequestId).value).isEmpty)) Right(Nil)
      else for {
        stableTaRequestId <- hosts.stableTaRequestId(state, p)
      } yield List(FundTASubmissionRegistered(p.fundOrderId, p.paymentTxId, stableTaRequestId))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/10
  final class RecordFundTAAcceptedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundTAAcceptedParams] {
    override def apply(state: State, p: RecordFundTAAcceptedParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/0
      if (!((p.fundOrderId == state.id))) Left(iMadzError("TA_ORDER", "TA_ORDER"))
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/1
      else if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) Left(iMadzError("TA_PAYMENT", "TA_PAYMENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/2
      else if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) Left(iMadzError("TA_REQUEST", "TA_REQUEST"))
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/3
      else if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) Left(iMadzError("TA_REFERENCE", "TA_REFERENCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/4
      else if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) Left(iMadzError("TA_FUND", "TA_FUND"))
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/5
      else if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) Left(iMadzError("TA_RECEIPT_PRESENT", "TA_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/6
      else if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("accepted"))))) Left(iMadzError("TA_RECEIPT_CONFLICT", "TA_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/7
      else if (((state.taReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/10/guards/8
      else if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) Right(Nil)
      else Right(List(FundTAAccepted(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "accepted")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/11
  final class RecordFundTAConfirmedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundTAConfirmedParams] {
    override def apply(state: State, p: RecordFundTAConfirmedParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/0
      if (!((p.fundOrderId == state.id))) Left(iMadzError("TA_ORDER", "TA_ORDER"))
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/1
      else if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) Left(iMadzError("TA_PAYMENT", "TA_PAYMENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/2
      else if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) Left(iMadzError("TA_REQUEST", "TA_REQUEST"))
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/3
      else if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) Left(iMadzError("TA_REFERENCE", "TA_REFERENCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/4
      else if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) Left(iMadzError("TA_FUND", "TA_FUND"))
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/5
      else if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) Left(iMadzError("TA_RECEIPT_PRESENT", "TA_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/6
      else if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("confirmed"))))) Left(iMadzError("TA_RECEIPT_CONFLICT", "TA_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/7
      else if (((state.taReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/8
      else if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) Left(iMadzError("TA_TERMINAL_CONFLICT", "TA_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/11/guards/9
      else if (!(((((p.shares).fundCode == state.fundCode) && (((p.shares).shares).value).nonEmpty) && (((p.shares).nav).value).nonEmpty))) Left(iMadzError("TA_SHARE_FUND", "TA_SHARE_FUND"))
      else Right(List(FundTASharesConfirmed(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.shares, "confirmed")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/12
  final class RecordFundTARejectedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundTARejectedParams] {
    override def apply(state: State, p: RecordFundTARejectedParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/0
      if (!((p.fundOrderId == state.id))) Left(iMadzError("TA_ORDER", "TA_ORDER"))
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/1
      else if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) Left(iMadzError("TA_PAYMENT", "TA_PAYMENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/2
      else if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) Left(iMadzError("TA_REQUEST", "TA_REQUEST"))
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/3
      else if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) Left(iMadzError("TA_REFERENCE", "TA_REFERENCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/4
      else if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) Left(iMadzError("TA_FUND", "TA_FUND"))
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/5
      else if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) Left(iMadzError("TA_RECEIPT_PRESENT", "TA_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/6
      else if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("rejected"))))) Left(iMadzError("TA_RECEIPT_CONFLICT", "TA_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/7
      else if (((state.taReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/8
      else if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) Left(iMadzError("TA_TERMINAL_CONFLICT", "TA_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/12/guards/9
      else if (!((p.reason).nonEmpty)) Left(iMadzError("TA_REJECTION_REASON", "TA_REJECTION_REASON"))
      else Right(List(FundTARejected(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.reason, "rejected")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/13
  final class RecordFundTAUnknownRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundTAUnknownParams] {
    override def apply(state: State, p: RecordFundTAUnknownParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/0
      if (!((p.fundOrderId == state.id))) Left(iMadzError("TA_ORDER", "TA_ORDER"))
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/1
      else if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) Left(iMadzError("TA_PAYMENT", "TA_PAYMENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/2
      else if (!(((p.taRequestId == state.taRequestId) && ((p.taRequestId).value).nonEmpty))) Left(iMadzError("TA_REQUEST", "TA_REQUEST"))
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/3
      else if (!(((p.taReference).nonEmpty && ((state.taReference).isEmpty || (state.taReference == p.taReference))))) Left(iMadzError("TA_REFERENCE", "TA_REFERENCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/4
      else if (!(((p.fundCode == state.fundCode) && (p.currency == (state.amount).currency)))) Left(iMadzError("TA_FUND", "TA_FUND"))
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/5
      else if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) Left(iMadzError("TA_RECEIPT_PRESENT", "TA_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/6
      else if (!((!((state.taReceipts).contains(p.receiptId)) || (((state.taReceipts)(p.receiptId) == p.receiptBody) && ((state.taReceiptOutcomes).get(p.receiptId)).contains("unknown"))))) Left(iMadzError("TA_RECEIPT_CONFLICT", "TA_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/7
      else if (((state.taReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/13/guards/8
      else if (!(((state.taStatus != "confirmed") && (state.taStatus != "rejected")))) Right(Nil)
      else Right(List(FundTAUnknown(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "unknown")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/14
  final class RequestFundPurchaseRefundRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RequestFundPurchaseRefundParams] {
    override def apply(state: State, p: RequestFundPurchaseRefundParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/14/guards/0
      if (!((p.fundOrderId == state.id))) Left(iMadzError("REFUND_RESOURCE", "REFUND_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/14/guards/1
      else if (!(((p.paymentTxId == state.selectedPaymentTxId) && ((state.cashPaymentFinalResults).get(p.paymentTxId)).contains("succeeded")))) Left(iMadzError("REFUND_PAYMENT", "REFUND_PAYMENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/14/guards/2
      else if (!((state.taStatus == "rejected"))) Left(iMadzError("REFUND_TA_REJECTED", "REFUND_TA_REJECTED"))
      // @knowledge source:bank-v1#/aggregates/1/commands/14/guards/3
      else if (!(((state.refundOperationId).value).isEmpty)) Right(Nil)
      else for {
        stableRefundOperationId <- hosts.stableRefundOperationId(state, p)
      } yield List(FundPurchaseRefundRequested(p.fundOrderId, p.paymentTxId, state.investorAccountId, state.fundCollectionAccountId, state.amount, stableRefundOperationId))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/15
  final class RecordFundRefundSucceededRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundSucceededParams] {
    override def apply(state: State, p: RecordFundRefundSucceededParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/15/guards/0
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/1/commands/15/guards/1
      else if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/15/guards/2
      else if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/15/guards/3
      else if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "succeeded")))) Left(iMadzError("REFUND_TERMINAL_CONFLICT", "REFUND_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/15/guards/4
      else if (((state.refundResultReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/15/guards/5
      else if (((state.refundFinalResults).contains(p.refundTxId))) Right(Nil)
      else Right(List(FundRefundSucceeded(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "succeeded")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/16
  final class RecordFundRefundRejectedBeforeEffectsRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundRejectedBeforeEffectsParams] {
    override def apply(state: State, p: RecordFundRefundRejectedBeforeEffectsParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/16/guards/0
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/1/commands/16/guards/1
      else if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/16/guards/2
      else if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/16/guards/3
      else if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "rejected-before-effects")))) Left(iMadzError("REFUND_TERMINAL_CONFLICT", "REFUND_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/16/guards/4
      else if (((state.refundResultReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/16/guards/5
      else if (((state.refundFinalResults).contains(p.refundTxId))) Right(Nil)
      else Right(List(FundRefundRejectedBeforeEffects(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "rejected-before-effects")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/17
  final class RecordFundRefundCompensatedRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundCompensatedParams] {
    override def apply(state: State, p: RecordFundRefundCompensatedParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/17/guards/0
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/1/commands/17/guards/1
      else if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/17/guards/2
      else if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/17/guards/3
      else if (!((!((state.refundFinalResults).contains(p.refundTxId)) || ((state.refundFinalResults)(p.refundTxId) == "compensated")))) Left(iMadzError("REFUND_TERMINAL_CONFLICT", "REFUND_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/17/guards/4
      else if (((state.refundResultReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/17/guards/5
      else if (((state.refundFinalResults).contains(p.refundTxId))) Right(Nil)
      else Right(List(FundRefundCompensated(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "compensated")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/18
  final class RecordFundRefundRecoveryRequiredRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundRecoveryRequiredParams] {
    override def apply(state: State, p: RecordFundRefundRecoveryRequiredParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/18/guards/0
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/1/commands/18/guards/1
      else if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/18/guards/2
      else if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/18/guards/3
      else if (((state.refundResultReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/18/guards/4
      else if (((state.refundFinalResults).contains(p.refundTxId))) Right(Nil)
      else Right(List(FundRefundRecoveryRequired(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "recovery-required")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/19
  final class RecordFundRefundOutcomeUnknownRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordFundRefundOutcomeUnknownParams] {
    override def apply(state: State, p: RecordFundRefundOutcomeUnknownParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/19/guards/0
      if (!(((p.refundOperationId == state.refundOperationId) && ((p.refundOperationId).value).nonEmpty))) Left(iMadzError("REFUND_RESULT_ASSOCIATION", "REFUND_RESULT_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/1/commands/19/guards/1
      else if (!(((((p.refundTxId).value).nonEmpty && (p.receiptId).nonEmpty) && (p.receiptBody).nonEmpty))) Left(iMadzError("REFUND_RECEIPT_PRESENT", "REFUND_RECEIPT_PRESENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/19/guards/2
      else if (!((!((state.refundResultReceipts).contains(p.receiptId)) || ((state.refundResultReceipts)(p.receiptId) == p.receiptBody)))) Left(iMadzError("REFUND_RECEIPT_CONFLICT", "REFUND_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/19/guards/3
      else if (((state.refundResultReceipts).contains(p.receiptId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/19/guards/4
      else if (((state.refundFinalResults).contains(p.refundTxId))) Right(Nil)
      else Right(List(FundRefundOutcomeUnknown(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "outcome-unknown")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/1/commands/20
  final class RecordCashRequestSourceRule(hosts: FundOrderComputations)
      extends InvariantRule[Event, State, RecordCashRequestSourceParams] {
    override def apply(state: State, p: RecordCashRequestSourceParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/1/commands/20/guards/0
      if (!((p.source).contains(p.original))) Left(iMadzError("CASH_SOURCE_OPTION", "CASH_SOURCE_OPTION"))
      // @knowledge source:bank-v1#/aggregates/1/commands/20/guards/1
      else if (!((((p.original).payment).fundOrderId == state.id))) Left(iMadzError("CASH_SOURCE_RESOURCE", "CASH_SOURCE_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/1/commands/20/guards/2
      else if (!((((((((p.original).principalId).nonEmpty && ((p.original).clientRequestId).nonEmpty) && ((p.original).authorityVersion).nonEmpty) && ((p.original).clientRequestId == ((p.original).request).clientRequestId)) && (((p.original).request).fundCode == ((p.original).payment).fundCode)) && ((((p.original).request).amount).currency == (((p.original).payment).amount).currency)))) Left(iMadzError("CASH_SOURCE_BODY", "CASH_SOURCE_BODY"))
      // @knowledge source:bank-v1#/aggregates/1/commands/20/guards/3
      else if (!(((state.cashRequestSource).isEmpty || (state.cashRequestSource).contains(p.original)))) Left(iMadzError("CASH_SOURCE_CONFLICT", "CASH_SOURCE_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/20/guards/4
      else if (!(((state.status == "new") || (((((((p.original).payment).operationId == state.operationId) && (((p.original).payment).investorAccountId == state.investorAccountId)) && (((p.original).payment).fundCollectionAccountId == state.fundCollectionAccountId)) && (((p.original).payment).fundCode == state.fundCode)) && (((((p.original).payment).amount).currency == (state.amount).currency) && ((((p.original).payment).amount).amount == (state.amount).amount)))))) Left(iMadzError("CASH_SOURCE_PAYMENT", "CASH_SOURCE_PAYMENT"))
      // @knowledge source:bank-v1#/aggregates/1/commands/20/guards/5
      else if (!((state.cashRequestSource).isEmpty)) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/1/commands/20/guards/6
      else if (!((state.status == "new"))) Left(iMadzError("CASH_SOURCE_BEFORE_SETTLEMENT", "CASH_SOURCE_BEFORE_SETTLEMENT"))
      else Right(List(CashRequestSourceRecorded(p.original, p.source)))
    }
  }

  def checkEventPostconditions(events: List[Event]): Option[iMadzError] = None
}
