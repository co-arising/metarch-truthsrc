package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.invariants.FundOrderRules
import example.bankwealth.domain.services.FundOrderComputations
import net.imadz.common.CommonTypes.iMadzError
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy

object FundOrderBehaviors extends FundOrderCommandHelpers {

  def apply(hosts: FundOrderComputations, authority: ExternalAuthority): CommandHandler = (state, command) =>
    externalBehavior(authority)
      .orElse(queryBehavior(state))
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def externalBehavior(authority: ExternalAuthority): PartialFunction[Command, Effect[Event, State]] = {
    case IngestBankPaymentResultCompensated(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-compensated", authorization, FundOrderExternalEvents.bankPaymentResultCompensatedIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultCompensated(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankPaymentResultOutcomeUnknown(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-outcome-unknown", authorization, FundOrderExternalEvents.bankPaymentResultOutcomeUnknownIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultOutcomeUnknown(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankPaymentResultRecoveryRequired(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-recovery-required", authorization, FundOrderExternalEvents.bankPaymentResultRecoveryRequiredIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultRecoveryRequired(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankPaymentResultRejectedBeforeEffects(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-rejected-before-effects", authorization, FundOrderExternalEvents.bankPaymentResultRejectedBeforeEffectsIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultRejectedBeforeEffects(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankPaymentResultSucceeded(output, authorization, replyTo) =>
      if (!authority.authorize("bank-payment-result-succeeded", authorization, FundOrderExternalEvents.bankPaymentResultSucceededIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankPaymentResultSucceeded(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankRefundResultCompensated(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-compensated", authorization, FundOrderExternalEvents.bankRefundResultCompensatedIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankRefundResultCompensated(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankRefundResultOutcomeUnknown(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-outcome-unknown", authorization, FundOrderExternalEvents.bankRefundResultOutcomeUnknownIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankRefundResultOutcomeUnknown(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankRefundResultRecoveryRequired(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-recovery-required", authorization, FundOrderExternalEvents.bankRefundResultRecoveryRequiredIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankRefundResultRecoveryRequired(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankRefundResultRejectedBeforeEffects(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-rejected-before-effects", authorization, FundOrderExternalEvents.bankRefundResultRejectedBeforeEffectsIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankRefundResultRejectedBeforeEffects(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankRefundResultSucceeded(output, authorization, replyTo) =>
      if (!authority.authorize("bank-refund-result-succeeded", authorization, FundOrderExternalEvents.bankRefundResultSucceededIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankRefundResultSucceeded(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
    case IngestBankTaReceiptObservation(output, authorization, replyTo) =>
      if (!authority.authorize("bank-ta-receipt-observation", authorization, FundOrderExternalEvents.bankTaReceiptObservationIdentity(output)))
        Effect.reply(replyTo)(Refused(iMadzError("external-authority-denied", "外部授权校验未通过，拒绝写入外部事件")))
      else {
        val event = FundOrderExternalEvents.bankTaReceiptObservation(output)
        Effect.persist(event).thenReply(replyTo)((_: State) => Accepted(Vector(event)))
      }
  }

  private def queryBehavior(state: State): PartialFunction[Command, Effect[Event, State]] = {
    case GetState(replyTo) =>
      Effect.reply(replyTo)(state)
  }

  private def executionBehavior(state: State, hosts: FundOrderComputations): PartialFunction[Command, Effect[Event, State]] = {
    case cmd: RequestFundPurchaseSettlement =>
      runReplyingPolicy(new FundOrderRules.RequestFundPurchaseSettlementRule(hosts), RequestFundPurchaseSettlementHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: ReserveFundSubscription =>
      runReplyingPolicy(new FundOrderRules.ReserveFundSubscriptionRule(hosts), ReserveFundSubscriptionHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: ConfirmFundSubscriptionPayment =>
      runReplyingPolicy(new FundOrderRules.ConfirmFundSubscriptionPaymentRule(hosts), ConfirmFundSubscriptionPaymentHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: CancelCashFundSubscription =>
      runReplyingPolicy(new FundOrderRules.CancelCashFundSubscriptionRule(hosts), CancelCashFundSubscriptionHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundCashPaymentSucceeded =>
      runReplyingPolicy(new FundOrderRules.RecordFundCashPaymentSucceededRule(hosts), RecordFundCashPaymentSucceededHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundCashPaymentRejectedBeforeEffects =>
      runReplyingPolicy(new FundOrderRules.RecordFundCashPaymentRejectedBeforeEffectsRule(hosts), RecordFundCashPaymentRejectedBeforeEffectsHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundCashPaymentCompensated =>
      runReplyingPolicy(new FundOrderRules.RecordFundCashPaymentCompensatedRule(hosts), RecordFundCashPaymentCompensatedHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundCashPaymentRecoveryRequired =>
      runReplyingPolicy(new FundOrderRules.RecordFundCashPaymentRecoveryRequiredRule(hosts), RecordFundCashPaymentRecoveryRequiredHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundCashPaymentOutcomeUnknown =>
      runReplyingPolicy(new FundOrderRules.RecordFundCashPaymentOutcomeUnknownRule(hosts), RecordFundCashPaymentOutcomeUnknownHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RegisterFundTASubmission =>
      runReplyingPolicy(new FundOrderRules.RegisterFundTASubmissionRule(hosts), RegisterFundTASubmissionHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundTAAccepted =>
      runReplyingPolicy(new FundOrderRules.RecordFundTAAcceptedRule(hosts), RecordFundTAAcceptedHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundTAConfirmed =>
      runReplyingPolicy(new FundOrderRules.RecordFundTAConfirmedRule(hosts), RecordFundTAConfirmedHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundTARejected =>
      runReplyingPolicy(new FundOrderRules.RecordFundTARejectedRule(hosts), RecordFundTARejectedHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundTAUnknown =>
      runReplyingPolicy(new FundOrderRules.RecordFundTAUnknownRule(hosts), RecordFundTAUnknownHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RequestFundPurchaseRefund =>
      runReplyingPolicy(new FundOrderRules.RequestFundPurchaseRefundRule(hosts), RequestFundPurchaseRefundHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundRefundSucceeded =>
      runReplyingPolicy(new FundOrderRules.RecordFundRefundSucceededRule(hosts), RecordFundRefundSucceededHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundRefundRejectedBeforeEffects =>
      runReplyingPolicy(new FundOrderRules.RecordFundRefundRejectedBeforeEffectsRule(hosts), RecordFundRefundRejectedBeforeEffectsHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundRefundCompensated =>
      runReplyingPolicy(new FundOrderRules.RecordFundRefundCompensatedRule(hosts), RecordFundRefundCompensatedHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundRefundRecoveryRequired =>
      runReplyingPolicy(new FundOrderRules.RecordFundRefundRecoveryRequiredRule(hosts), RecordFundRefundRecoveryRequiredHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordFundRefundOutcomeUnknown =>
      runReplyingPolicy(new FundOrderRules.RecordFundRefundOutcomeUnknownRule(hosts), RecordFundRefundOutcomeUnknownHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordCashRequestSource =>
      runReplyingPolicy(new FundOrderRules.RecordCashRequestSourceRule(hosts), RecordCashRequestSourceHelper)(state, cmd)
        .withPost(FundOrderRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
  }
}
