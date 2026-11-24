package example.bankwealth.domain.invariant.params

import example.bankwealth.domain.entities.FundOrderEntity.State
import example.bankwealth.domain.events.FundOrderEvents
import example.bankwealth.domain.services.FundOrderComputations

object FundOrderRuleParams {
  final case class RequestFundPurchaseSettlementParams(state: State, command: FundOrderEvents.RequestFundPurchaseSettlement, hosts: FundOrderComputations)
  final case class ReserveFundSubscriptionParams(state: State, command: FundOrderEvents.ReserveFundSubscription, hosts: FundOrderComputations)
  final case class ConfirmFundSubscriptionPaymentParams(state: State, command: FundOrderEvents.ConfirmFundSubscriptionPayment, hosts: FundOrderComputations)
  final case class CancelCashFundSubscriptionParams(state: State, command: FundOrderEvents.CancelCashFundSubscription, hosts: FundOrderComputations)
  final case class RecordFundCashPaymentSucceededParams(state: State, command: FundOrderEvents.RecordFundCashPaymentSucceeded, hosts: FundOrderComputations)
  final case class RecordFundCashPaymentRejectedBeforeEffectsParams(state: State, command: FundOrderEvents.RecordFundCashPaymentRejectedBeforeEffects, hosts: FundOrderComputations)
  final case class RecordFundCashPaymentCompensatedParams(state: State, command: FundOrderEvents.RecordFundCashPaymentCompensated, hosts: FundOrderComputations)
  final case class RecordFundCashPaymentRecoveryRequiredParams(state: State, command: FundOrderEvents.RecordFundCashPaymentRecoveryRequired, hosts: FundOrderComputations)
  final case class RecordFundCashPaymentOutcomeUnknownParams(state: State, command: FundOrderEvents.RecordFundCashPaymentOutcomeUnknown, hosts: FundOrderComputations)
  final case class RegisterFundTASubmissionParams(state: State, command: FundOrderEvents.RegisterFundTASubmission, hosts: FundOrderComputations)
  final case class RecordFundTAAcceptedParams(state: State, command: FundOrderEvents.RecordFundTAAccepted, hosts: FundOrderComputations)
  final case class RecordFundTAConfirmedParams(state: State, command: FundOrderEvents.RecordFundTAConfirmed, hosts: FundOrderComputations)
  final case class RecordFundTARejectedParams(state: State, command: FundOrderEvents.RecordFundTARejected, hosts: FundOrderComputations)
  final case class RecordFundTAUnknownParams(state: State, command: FundOrderEvents.RecordFundTAUnknown, hosts: FundOrderComputations)
  final case class RequestFundPurchaseRefundParams(state: State, command: FundOrderEvents.RequestFundPurchaseRefund, hosts: FundOrderComputations)
  final case class RecordFundRefundSucceededParams(state: State, command: FundOrderEvents.RecordFundRefundSucceeded, hosts: FundOrderComputations)
  final case class RecordFundRefundRejectedBeforeEffectsParams(state: State, command: FundOrderEvents.RecordFundRefundRejectedBeforeEffects, hosts: FundOrderComputations)
  final case class RecordFundRefundCompensatedParams(state: State, command: FundOrderEvents.RecordFundRefundCompensated, hosts: FundOrderComputations)
  final case class RecordFundRefundRecoveryRequiredParams(state: State, command: FundOrderEvents.RecordFundRefundRecoveryRequired, hosts: FundOrderComputations)
  final case class RecordFundRefundOutcomeUnknownParams(state: State, command: FundOrderEvents.RecordFundRefundOutcomeUnknown, hosts: FundOrderComputations)
  final case class RecordCashRequestSourceParams(state: State, command: FundOrderEvents.RecordCashRequestSource, hosts: FundOrderComputations)
}
