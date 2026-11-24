package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.{FundOrderComputations, FundOrderProtocol => Payload, FundOrderRules, FundOrderExternalEvents}

object FundOrderBehaviors {

  def apply(hosts: FundOrderComputations, authority: ExternalAuthority): CommandHandler = (state, command) =>
    externalBehavior(authority)
      .orElse(queryBehavior)
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def externalBehavior(authority: ExternalAuthority): PartialFunction[Command, Effect[Event, State]] = {
    case Ingestbank_payment_result_compensated(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-compensated", authorization, FundOrderExternalEvents.bank_payment_result_compensated_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_payment_result_compensated(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_payment_result_compensated(output))))
    case Ingestbank_payment_result_outcome_unknown(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-outcome-unknown", authorization, FundOrderExternalEvents.bank_payment_result_outcome_unknown_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_payment_result_outcome_unknown(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_payment_result_outcome_unknown(output))))
    case Ingestbank_payment_result_recovery_required(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-recovery-required", authorization, FundOrderExternalEvents.bank_payment_result_recovery_required_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_payment_result_recovery_required(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_payment_result_recovery_required(output))))
    case Ingestbank_payment_result_rejected_before_effects(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-rejected-before-effects", authorization, FundOrderExternalEvents.bank_payment_result_rejected_before_effects_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_payment_result_rejected_before_effects(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_payment_result_rejected_before_effects(output))))
    case Ingestbank_payment_result_succeeded(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-succeeded", authorization, FundOrderExternalEvents.bank_payment_result_succeeded_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_payment_result_succeeded(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_payment_result_succeeded(output))))
    case Ingestbank_refund_result_compensated(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-compensated", authorization, FundOrderExternalEvents.bank_refund_result_compensated_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_refund_result_compensated(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_refund_result_compensated(output))))
    case Ingestbank_refund_result_outcome_unknown(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-outcome-unknown", authorization, FundOrderExternalEvents.bank_refund_result_outcome_unknown_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_refund_result_outcome_unknown(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_refund_result_outcome_unknown(output))))
    case Ingestbank_refund_result_recovery_required(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-recovery-required", authorization, FundOrderExternalEvents.bank_refund_result_recovery_required_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_refund_result_recovery_required(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_refund_result_recovery_required(output))))
    case Ingestbank_refund_result_rejected_before_effects(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-rejected-before-effects", authorization, FundOrderExternalEvents.bank_refund_result_rejected_before_effects_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_refund_result_rejected_before_effects(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_refund_result_rejected_before_effects(output))))
    case Ingestbank_refund_result_succeeded(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-succeeded", authorization, FundOrderExternalEvents.bank_refund_result_succeeded_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_refund_result_succeeded(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_refund_result_succeeded(output))))
    case Ingestbank_ta_receipt_observation(output, authorization, reply) =>
      if (!authority.authorize("bank-ta-receipt-observation", authorization, FundOrderExternalEvents.bank_ta_receipt_observation_identity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(FundOrderExternalEvents.bank_ta_receipt_observation(output)).thenRun((_: State) => reply ! Accepted(Vector(FundOrderExternalEvents.bank_ta_receipt_observation(output))))
  }

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(reply) =>
      Effect.none.thenRun((s: State) => reply ! s)
  }

  private def executionBehavior(state: State, hosts: FundOrderComputations): PartialFunction[Command, Effect[Event, State]] = {
    case Execute(command, reply) =>
      val decision = command match {
        case p: Payload.RequestFundPurchaseSettlement =>
          FundOrderRules.RequestFundPurchaseSettlement(state, p, hosts)
        case p: Payload.ReserveFundSubscription =>
          FundOrderRules.ReserveFundSubscription(state, p, hosts)
        case p: Payload.ConfirmFundSubscriptionPayment =>
          FundOrderRules.ConfirmFundSubscriptionPayment(state, p, hosts)
        case p: Payload.CancelCashFundSubscription =>
          FundOrderRules.CancelCashFundSubscription(state, p, hosts)
        case p: Payload.RecordFundCashPaymentSucceeded =>
          FundOrderRules.RecordFundCashPaymentSucceeded(state, p, hosts)
        case p: Payload.RecordFundCashPaymentRejectedBeforeEffects =>
          FundOrderRules.RecordFundCashPaymentRejectedBeforeEffects(state, p, hosts)
        case p: Payload.RecordFundCashPaymentCompensated =>
          FundOrderRules.RecordFundCashPaymentCompensated(state, p, hosts)
        case p: Payload.RecordFundCashPaymentRecoveryRequired =>
          FundOrderRules.RecordFundCashPaymentRecoveryRequired(state, p, hosts)
        case p: Payload.RecordFundCashPaymentOutcomeUnknown =>
          FundOrderRules.RecordFundCashPaymentOutcomeUnknown(state, p, hosts)
        case p: Payload.RegisterFundTASubmission =>
          FundOrderRules.RegisterFundTASubmission(state, p, hosts)
        case p: Payload.RecordFundTAAccepted =>
          FundOrderRules.RecordFundTAAccepted(state, p, hosts)
        case p: Payload.RecordFundTAConfirmed =>
          FundOrderRules.RecordFundTAConfirmed(state, p, hosts)
        case p: Payload.RecordFundTARejected =>
          FundOrderRules.RecordFundTARejected(state, p, hosts)
        case p: Payload.RecordFundTAUnknown =>
          FundOrderRules.RecordFundTAUnknown(state, p, hosts)
        case p: Payload.RequestFundPurchaseRefund =>
          FundOrderRules.RequestFundPurchaseRefund(state, p, hosts)
        case p: Payload.RecordFundRefundSucceeded =>
          FundOrderRules.RecordFundRefundSucceeded(state, p, hosts)
        case p: Payload.RecordFundRefundRejectedBeforeEffects =>
          FundOrderRules.RecordFundRefundRejectedBeforeEffects(state, p, hosts)
        case p: Payload.RecordFundRefundCompensated =>
          FundOrderRules.RecordFundRefundCompensated(state, p, hosts)
        case p: Payload.RecordFundRefundRecoveryRequired =>
          FundOrderRules.RecordFundRefundRecoveryRequired(state, p, hosts)
        case p: Payload.RecordFundRefundOutcomeUnknown =>
          FundOrderRules.RecordFundRefundOutcomeUnknown(state, p, hosts)
        case p: Payload.RecordCashRequestSource =>
          FundOrderRules.RecordCashRequestSource(state, p, hosts)
      }

      decision match {
        case Left(code) =>
          Effect.none.thenRun((_: State) => reply ! Refused(code))
        case Right(events) =>
          Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))
      }
  }
}
