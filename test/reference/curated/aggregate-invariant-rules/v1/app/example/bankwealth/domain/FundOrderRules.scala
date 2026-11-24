package example.bankwealth.domain

import FundOrderProtocol._

object FundOrderRules {
  def RequestFundPurchaseSettlement(state: FundOrderState, p: RequestFundPurchaseSettlement, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RequestFundPurchaseSettlement(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RequestFundPurchaseSettlementParams(state, p, hosts))
  def ReserveFundSubscription(state: FundOrderState, p: ReserveFundSubscription, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.ReserveFundSubscription(example.bankwealth.domain.invariant.params.FundOrderRuleParams.ReserveFundSubscriptionParams(state, p, hosts))
  def ConfirmFundSubscriptionPayment(state: FundOrderState, p: ConfirmFundSubscriptionPayment, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.ConfirmFundSubscriptionPayment(example.bankwealth.domain.invariant.params.FundOrderRuleParams.ConfirmFundSubscriptionPaymentParams(state, p, hosts))
  def CancelCashFundSubscription(state: FundOrderState, p: CancelCashFundSubscription, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.CancelCashFundSubscription(example.bankwealth.domain.invariant.params.FundOrderRuleParams.CancelCashFundSubscriptionParams(state, p, hosts))
  def RecordFundCashPaymentSucceeded(state: FundOrderState, p: RecordFundCashPaymentSucceeded, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundCashPaymentSucceeded(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundCashPaymentSucceededParams(state, p, hosts))
  def RecordFundCashPaymentRejectedBeforeEffects(state: FundOrderState, p: RecordFundCashPaymentRejectedBeforeEffects, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundCashPaymentRejectedBeforeEffects(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundCashPaymentRejectedBeforeEffectsParams(state, p, hosts))
  def RecordFundCashPaymentCompensated(state: FundOrderState, p: RecordFundCashPaymentCompensated, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundCashPaymentCompensated(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundCashPaymentCompensatedParams(state, p, hosts))
  def RecordFundCashPaymentRecoveryRequired(state: FundOrderState, p: RecordFundCashPaymentRecoveryRequired, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundCashPaymentRecoveryRequired(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundCashPaymentRecoveryRequiredParams(state, p, hosts))
  def RecordFundCashPaymentOutcomeUnknown(state: FundOrderState, p: RecordFundCashPaymentOutcomeUnknown, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundCashPaymentOutcomeUnknown(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundCashPaymentOutcomeUnknownParams(state, p, hosts))
  def RegisterFundTASubmission(state: FundOrderState, p: RegisterFundTASubmission, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RegisterFundTASubmission(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RegisterFundTASubmissionParams(state, p, hosts))
  def RecordFundTAAccepted(state: FundOrderState, p: RecordFundTAAccepted, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundTAAccepted(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundTAAcceptedParams(state, p, hosts))
  def RecordFundTAConfirmed(state: FundOrderState, p: RecordFundTAConfirmed, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundTAConfirmed(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundTAConfirmedParams(state, p, hosts))
  def RecordFundTARejected(state: FundOrderState, p: RecordFundTARejected, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundTARejected(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundTARejectedParams(state, p, hosts))
  def RecordFundTAUnknown(state: FundOrderState, p: RecordFundTAUnknown, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundTAUnknown(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundTAUnknownParams(state, p, hosts))
  def RequestFundPurchaseRefund(state: FundOrderState, p: RequestFundPurchaseRefund, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RequestFundPurchaseRefund(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RequestFundPurchaseRefundParams(state, p, hosts))
  def RecordFundRefundSucceeded(state: FundOrderState, p: RecordFundRefundSucceeded, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundRefundSucceeded(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundRefundSucceededParams(state, p, hosts))
  def RecordFundRefundRejectedBeforeEffects(state: FundOrderState, p: RecordFundRefundRejectedBeforeEffects, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundRefundRejectedBeforeEffects(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundRefundRejectedBeforeEffectsParams(state, p, hosts))
  def RecordFundRefundCompensated(state: FundOrderState, p: RecordFundRefundCompensated, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundRefundCompensated(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundRefundCompensatedParams(state, p, hosts))
  def RecordFundRefundRecoveryRequired(state: FundOrderState, p: RecordFundRefundRecoveryRequired, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundRefundRecoveryRequired(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundRefundRecoveryRequiredParams(state, p, hosts))
  def RecordFundRefundOutcomeUnknown(state: FundOrderState, p: RecordFundRefundOutcomeUnknown, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordFundRefundOutcomeUnknown(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordFundRefundOutcomeUnknownParams(state, p, hosts))
  def RecordCashRequestSource(state: FundOrderState, p: RecordCashRequestSource, hosts: FundOrderComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.FundOrderRules.RecordCashRequestSource(example.bankwealth.domain.invariant.params.FundOrderRuleParams.RecordCashRequestSourceParams(state, p, hosts))
}
