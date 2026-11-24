package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.events.{FundOrderEvents => Payload}
import example.bankwealth.domain.invariant.FundOrderRules
import example.bankwealth.domain.invariant.params.FundOrderRuleParams._
import example.bankwealth.domain.services.FundOrderComputations

object FundOrderBehaviors {

  def apply(hosts: FundOrderComputations, authority: ExternalAuthority): CommandHandler = (state, command) =>
    externalBehavior(authority)
      .orElse(queryBehavior)
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def externalBehavior(authority: ExternalAuthority): PartialFunction[Command, Effect[Event, State]] = {
    case IngestBankPaymentResultCompensated(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-compensated", authorization, FundOrderExternalEvents.bankPaymentResultCompensatedIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultCompensated(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankPaymentResultOutcomeUnknown(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-outcome-unknown", authorization, FundOrderExternalEvents.bankPaymentResultOutcomeUnknownIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultOutcomeUnknown(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankPaymentResultRecoveryRequired(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-recovery-required", authorization, FundOrderExternalEvents.bankPaymentResultRecoveryRequiredIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultRecoveryRequired(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankPaymentResultRejectedBeforeEffects(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-rejected-before-effects", authorization, FundOrderExternalEvents.bankPaymentResultRejectedBeforeEffectsIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultRejectedBeforeEffects(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankPaymentResultSucceeded(output, authorization, reply) =>
      if (!authority.authorize("bank-payment-result-succeeded", authorization, FundOrderExternalEvents.bankPaymentResultSucceededIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultSucceeded(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultCompensated(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-compensated", authorization, FundOrderExternalEvents.bankRefundResultCompensatedIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultCompensated(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultOutcomeUnknown(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-outcome-unknown", authorization, FundOrderExternalEvents.bankRefundResultOutcomeUnknownIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultOutcomeUnknown(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultRecoveryRequired(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-recovery-required", authorization, FundOrderExternalEvents.bankRefundResultRecoveryRequiredIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultRecoveryRequired(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultRejectedBeforeEffects(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-rejected-before-effects", authorization, FundOrderExternalEvents.bankRefundResultRejectedBeforeEffectsIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultRejectedBeforeEffects(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultSucceeded(output, authorization, reply) =>
      if (!authority.authorize("bank-refund-result-succeeded", authorization, FundOrderExternalEvents.bankRefundResultSucceededIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultSucceeded(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
    case IngestBankTaReceiptObservation(output, authorization, reply) =>
      if (!authority.authorize("bank-ta-receipt-observation", authorization, FundOrderExternalEvents.bankTaReceiptObservationIdentity(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankTaReceiptObservation(output)
        Effect.persist(event).thenRun((_: State) => reply ! Accepted(Vector(event)))
      }
  }

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(reply) =>
      Effect.none.thenRun((s: State) => reply ! s)
  }

  private def executionBehavior(state: State, hosts: FundOrderComputations): PartialFunction[Command, Effect[Event, State]] = {
    case Execute(command, reply) =>
      val decision = command match {
        case p: Payload.RequestFundPurchaseSettlement =>
          FundOrderRules.RequestFundPurchaseSettlement(RequestFundPurchaseSettlementParams(state, p, hosts))
        case p: Payload.ReserveFundSubscription =>
          FundOrderRules.ReserveFundSubscription(ReserveFundSubscriptionParams(state, p, hosts))
        case p: Payload.ConfirmFundSubscriptionPayment =>
          FundOrderRules.ConfirmFundSubscriptionPayment(ConfirmFundSubscriptionPaymentParams(state, p, hosts))
        case p: Payload.CancelCashFundSubscription =>
          FundOrderRules.CancelCashFundSubscription(CancelCashFundSubscriptionParams(state, p, hosts))
        case p: Payload.RecordFundCashPaymentSucceeded =>
          FundOrderRules.RecordFundCashPaymentSucceeded(RecordFundCashPaymentSucceededParams(state, p, hosts))
        case p: Payload.RecordFundCashPaymentRejectedBeforeEffects =>
          FundOrderRules.RecordFundCashPaymentRejectedBeforeEffects(RecordFundCashPaymentRejectedBeforeEffectsParams(state, p, hosts))
        case p: Payload.RecordFundCashPaymentCompensated =>
          FundOrderRules.RecordFundCashPaymentCompensated(RecordFundCashPaymentCompensatedParams(state, p, hosts))
        case p: Payload.RecordFundCashPaymentRecoveryRequired =>
          FundOrderRules.RecordFundCashPaymentRecoveryRequired(RecordFundCashPaymentRecoveryRequiredParams(state, p, hosts))
        case p: Payload.RecordFundCashPaymentOutcomeUnknown =>
          FundOrderRules.RecordFundCashPaymentOutcomeUnknown(RecordFundCashPaymentOutcomeUnknownParams(state, p, hosts))
        case p: Payload.RegisterFundTASubmission =>
          FundOrderRules.RegisterFundTASubmission(RegisterFundTASubmissionParams(state, p, hosts))
        case p: Payload.RecordFundTAAccepted =>
          FundOrderRules.RecordFundTAAccepted(RecordFundTAAcceptedParams(state, p, hosts))
        case p: Payload.RecordFundTAConfirmed =>
          FundOrderRules.RecordFundTAConfirmed(RecordFundTAConfirmedParams(state, p, hosts))
        case p: Payload.RecordFundTARejected =>
          FundOrderRules.RecordFundTARejected(RecordFundTARejectedParams(state, p, hosts))
        case p: Payload.RecordFundTAUnknown =>
          FundOrderRules.RecordFundTAUnknown(RecordFundTAUnknownParams(state, p, hosts))
        case p: Payload.RequestFundPurchaseRefund =>
          FundOrderRules.RequestFundPurchaseRefund(RequestFundPurchaseRefundParams(state, p, hosts))
        case p: Payload.RecordFundRefundSucceeded =>
          FundOrderRules.RecordFundRefundSucceeded(RecordFundRefundSucceededParams(state, p, hosts))
        case p: Payload.RecordFundRefundRejectedBeforeEffects =>
          FundOrderRules.RecordFundRefundRejectedBeforeEffects(RecordFundRefundRejectedBeforeEffectsParams(state, p, hosts))
        case p: Payload.RecordFundRefundCompensated =>
          FundOrderRules.RecordFundRefundCompensated(RecordFundRefundCompensatedParams(state, p, hosts))
        case p: Payload.RecordFundRefundRecoveryRequired =>
          FundOrderRules.RecordFundRefundRecoveryRequired(RecordFundRefundRecoveryRequiredParams(state, p, hosts))
        case p: Payload.RecordFundRefundOutcomeUnknown =>
          FundOrderRules.RecordFundRefundOutcomeUnknown(RecordFundRefundOutcomeUnknownParams(state, p, hosts))
        case p: Payload.RecordCashRequestSource =>
          FundOrderRules.RecordCashRequestSource(RecordCashRequestSourceParams(state, p, hosts))
      }

      decision match {
        case Left(code) =>
          Effect.none.thenRun((_: State) => reply ! Refused(code))
        case Right(events) =>
          Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))
      }
  }
}
