package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.SipPlanProtocol._
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.invariants.SipPlanRules
import example.bankwealth.domain.services.SipPlanComputations
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy

object SipPlanBehaviors extends SipPlanCommandHelpers {

  def apply(hosts: SipPlanComputations): CommandHandler = (state, command) =>
    queryBehavior(state)
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior(state: State): PartialFunction[Command, Effect[Event, State]] = {
    case GetState(replyTo) =>
      Effect.reply(replyTo)(state)
  }

  private def executionBehavior(state: State, hosts: SipPlanComputations): PartialFunction[Command, Effect[Event, State]] = {
    case cmd: CreateSipPlan =>
      runReplyingPolicy(new SipPlanRules.CreateSipPlanRule(hosts), CreateSipPlanHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: AppendSipDueSlot =>
      runReplyingPolicy(new SipPlanRules.AppendSipDueSlotRule(hosts), AppendSipDueSlotHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: SealSipSchedule =>
      runReplyingPolicy(new SipPlanRules.SealSipScheduleRule(hosts), SealSipScheduleHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: ReviseSipPlan =>
      runReplyingPolicy(new SipPlanRules.ReviseSipPlanRule(hosts), ReviseSipPlanHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: AdvanceSipClock =>
      runReplyingPolicy(new SipPlanRules.AdvanceSipClockRule(hosts), AdvanceSipClockHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: PauseSipPlan =>
      runReplyingPolicy(new SipPlanRules.PauseSipPlanRule(hosts), PauseSipPlanHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: ResumeSipPlan =>
      runReplyingPolicy(new SipPlanRules.ResumeSipPlanRule(hosts), ResumeSipPlanHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: ObserveSipDueSlot =>
      runReplyingPolicy(new SipPlanRules.ObserveSipDueSlotRule(hosts), ObserveSipDueSlotHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: SkipPausedSipDueSlot =>
      runReplyingPolicy(new SipPlanRules.SkipPausedSipDueSlotRule(hosts), SkipPausedSipDueSlotHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: AdvanceSkippedSipSlot =>
      runReplyingPolicy(new SipPlanRules.AdvanceSkippedSipSlotRule(hosts), AdvanceSkippedSipSlotHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: TriggerSipInstallment =>
      runReplyingPolicy(new SipPlanRules.TriggerSipInstallmentRule(hosts), TriggerSipInstallmentHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordSipInstallmentPending =>
      runReplyingPolicy(new SipPlanRules.RecordSipInstallmentPendingRule(hosts), RecordSipInstallmentPendingHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordSipInstallmentOutcomeUnknown =>
      runReplyingPolicy(new SipPlanRules.RecordSipInstallmentOutcomeUnknownRule(hosts), RecordSipInstallmentOutcomeUnknownHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordSipInstallmentRecoveryRequired =>
      runReplyingPolicy(new SipPlanRules.RecordSipInstallmentRecoveryRequiredRule(hosts), RecordSipInstallmentRecoveryRequiredHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordSipInstallmentRefundInProgress =>
      runReplyingPolicy(new SipPlanRules.RecordSipInstallmentRefundInProgressRule(hosts), RecordSipInstallmentRefundInProgressHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordSipInstallmentSucceeded =>
      runReplyingPolicy(new SipPlanRules.RecordSipInstallmentSucceededRule(hosts), RecordSipInstallmentSucceededHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordSipInstallmentFailed =>
      runReplyingPolicy(new SipPlanRules.RecordSipInstallmentFailedRule(hosts), RecordSipInstallmentFailedHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
    case cmd: RecordSipCreateIntent =>
      runReplyingPolicy(new SipPlanRules.RecordSipCreateIntentRule(hosts), RecordSipCreateIntentHelper)(state, cmd)
        .withPost(SipPlanRules.checkEventPostconditions)
        .replyWith(cmd.replyTo)
  }
}
