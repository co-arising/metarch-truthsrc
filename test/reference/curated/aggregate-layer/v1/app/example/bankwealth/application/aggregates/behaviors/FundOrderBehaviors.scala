package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.application.integration.FundOrderExternalEvents
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.invariants.FundOrderRules
import example.bankwealth.domain.services.FundOrderComputations

object FundOrderBehaviors extends FundOrderCommandHelpers {

  def apply(hosts: FundOrderComputations, authority: ExternalAuthority): CommandHandler = (state, command) =>
    externalBehavior(authority)
      .orElse(queryBehavior)
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def externalBehavior(authority: ExternalAuthority): PartialFunction[Command, Effect[Event, State]] = {
    case IngestBankPaymentResultCompensated(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-compensated", authorization, FundOrderExternalEvents.bankPaymentResultCompensatedIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultCompensated(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankPaymentResultOutcomeUnknown(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-outcome-unknown", authorization, FundOrderExternalEvents.bankPaymentResultOutcomeUnknownIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultOutcomeUnknown(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankPaymentResultRecoveryRequired(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-recovery-required", authorization, FundOrderExternalEvents.bankPaymentResultRecoveryRequiredIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultRecoveryRequired(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankPaymentResultRejectedBeforeEffects(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-rejected-before-effects", authorization, FundOrderExternalEvents.bankPaymentResultRejectedBeforeEffectsIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultRejectedBeforeEffects(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankPaymentResultSucceeded(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-succeeded", authorization, FundOrderExternalEvents.bankPaymentResultSucceededIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultSucceeded(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultCompensated(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-compensated", authorization, FundOrderExternalEvents.bankRefundResultCompensatedIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultCompensated(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultOutcomeUnknown(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-outcome-unknown", authorization, FundOrderExternalEvents.bankRefundResultOutcomeUnknownIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultOutcomeUnknown(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultRecoveryRequired(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-recovery-required", authorization, FundOrderExternalEvents.bankRefundResultRecoveryRequiredIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultRecoveryRequired(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultRejectedBeforeEffects(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-rejected-before-effects", authorization, FundOrderExternalEvents.bankRefundResultRejectedBeforeEffectsIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultRejectedBeforeEffects(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankRefundResultSucceeded(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-succeeded", authorization, FundOrderExternalEvents.bankRefundResultSucceededIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankRefundResultSucceeded(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
    case IngestBankTaReceiptObservation(output, authorization, replyTo) =>
      if (!authority.authorize("bank-ta-receipt-observation", authorization, FundOrderExternalEvents.bankTaReceiptObservationIdentity(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = FundOrderExternalEvents.bankTaReceiptObservation(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
  }

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(replyTo) =>
      Effect.none.thenRun((s: State) => replyTo ! s)
  }

  private def executionBehavior(state: State, hosts: FundOrderComputations): PartialFunction[Command, Effect[Event, State]] = {
    case cmd: RequestFundPurchaseSettlement =>
      replyEffect(FundOrderRules.RequestFundPurchaseSettlement(state, toRequestFundPurchaseSettlementParams(cmd), hosts), cmd.replyTo)
    case cmd: ReserveFundSubscription =>
      replyEffect(FundOrderRules.ReserveFundSubscription(state, toReserveFundSubscriptionParams(cmd), hosts), cmd.replyTo)
    case cmd: ConfirmFundSubscriptionPayment =>
      replyEffect(FundOrderRules.ConfirmFundSubscriptionPayment(state, toConfirmFundSubscriptionPaymentParams(cmd), hosts), cmd.replyTo)
    case cmd: CancelCashFundSubscription =>
      replyEffect(FundOrderRules.CancelCashFundSubscription(state, toCancelCashFundSubscriptionParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundCashPaymentSucceeded =>
      replyEffect(FundOrderRules.RecordFundCashPaymentSucceeded(state, toRecordFundCashPaymentSucceededParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundCashPaymentRejectedBeforeEffects =>
      replyEffect(FundOrderRules.RecordFundCashPaymentRejectedBeforeEffects(state, toRecordFundCashPaymentRejectedBeforeEffectsParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundCashPaymentCompensated =>
      replyEffect(FundOrderRules.RecordFundCashPaymentCompensated(state, toRecordFundCashPaymentCompensatedParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundCashPaymentRecoveryRequired =>
      replyEffect(FundOrderRules.RecordFundCashPaymentRecoveryRequired(state, toRecordFundCashPaymentRecoveryRequiredParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundCashPaymentOutcomeUnknown =>
      replyEffect(FundOrderRules.RecordFundCashPaymentOutcomeUnknown(state, toRecordFundCashPaymentOutcomeUnknownParams(cmd), hosts), cmd.replyTo)
    case cmd: RegisterFundTASubmission =>
      replyEffect(FundOrderRules.RegisterFundTASubmission(state, toRegisterFundTASubmissionParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundTAAccepted =>
      replyEffect(FundOrderRules.RecordFundTAAccepted(state, toRecordFundTAAcceptedParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundTAConfirmed =>
      replyEffect(FundOrderRules.RecordFundTAConfirmed(state, toRecordFundTAConfirmedParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundTARejected =>
      replyEffect(FundOrderRules.RecordFundTARejected(state, toRecordFundTARejectedParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundTAUnknown =>
      replyEffect(FundOrderRules.RecordFundTAUnknown(state, toRecordFundTAUnknownParams(cmd), hosts), cmd.replyTo)
    case cmd: RequestFundPurchaseRefund =>
      replyEffect(FundOrderRules.RequestFundPurchaseRefund(state, toRequestFundPurchaseRefundParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundRefundSucceeded =>
      replyEffect(FundOrderRules.RecordFundRefundSucceeded(state, toRecordFundRefundSucceededParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundRefundRejectedBeforeEffects =>
      replyEffect(FundOrderRules.RecordFundRefundRejectedBeforeEffects(state, toRecordFundRefundRejectedBeforeEffectsParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundRefundCompensated =>
      replyEffect(FundOrderRules.RecordFundRefundCompensated(state, toRecordFundRefundCompensatedParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundRefundRecoveryRequired =>
      replyEffect(FundOrderRules.RecordFundRefundRecoveryRequired(state, toRecordFundRefundRecoveryRequiredParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordFundRefundOutcomeUnknown =>
      replyEffect(FundOrderRules.RecordFundRefundOutcomeUnknown(state, toRecordFundRefundOutcomeUnknownParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordCashRequestSource =>
      replyEffect(FundOrderRules.RecordCashRequestSource(state, toRecordCashRequestSourceParams(cmd), hosts), cmd.replyTo)
  }
}
