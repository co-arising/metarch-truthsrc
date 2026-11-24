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
