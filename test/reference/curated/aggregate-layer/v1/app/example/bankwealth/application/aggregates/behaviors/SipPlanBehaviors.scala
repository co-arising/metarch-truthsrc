package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.SipPlanProtocol._
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.events.{SipPlanEvents => Payload}
import example.bankwealth.domain.invariant.SipPlanRules
import example.bankwealth.domain.invariant.params.SipPlanRuleParams._
import example.bankwealth.domain.services.SipPlanComputations

object SipPlanBehaviors {

  def apply(hosts: SipPlanComputations): CommandHandler = (state, command) =>
    queryBehavior
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(reply) =>
      Effect.none.thenRun((s: State) => reply ! s)
  }

  private def executionBehavior(state: State, hosts: SipPlanComputations): PartialFunction[Command, Effect[Event, State]] = {
    case Execute(command, reply) =>
      val decision = command match {
        case p: Payload.CreateSipPlan =>
          SipPlanRules.CreateSipPlan(CreateSipPlanParams(state, p, hosts))
        case p: Payload.AppendSipDueSlot =>
          SipPlanRules.AppendSipDueSlot(AppendSipDueSlotParams(state, p, hosts))
        case p: Payload.SealSipSchedule =>
          SipPlanRules.SealSipSchedule(SealSipScheduleParams(state, p, hosts))
        case p: Payload.ReviseSipPlan =>
          SipPlanRules.ReviseSipPlan(ReviseSipPlanParams(state, p, hosts))
        case p: Payload.AdvanceSipClock =>
          SipPlanRules.AdvanceSipClock(AdvanceSipClockParams(state, p, hosts))
        case p: Payload.PauseSipPlan =>
          SipPlanRules.PauseSipPlan(PauseSipPlanParams(state, p, hosts))
        case p: Payload.ResumeSipPlan =>
          SipPlanRules.ResumeSipPlan(ResumeSipPlanParams(state, p, hosts))
        case p: Payload.ObserveSipDueSlot =>
          SipPlanRules.ObserveSipDueSlot(ObserveSipDueSlotParams(state, p, hosts))
        case p: Payload.SkipPausedSipDueSlot =>
          SipPlanRules.SkipPausedSipDueSlot(SkipPausedSipDueSlotParams(state, p, hosts))
        case p: Payload.AdvanceSkippedSipSlot =>
          SipPlanRules.AdvanceSkippedSipSlot(AdvanceSkippedSipSlotParams(state, p, hosts))
        case p: Payload.TriggerSipInstallment =>
          SipPlanRules.TriggerSipInstallment(TriggerSipInstallmentParams(state, p, hosts))
        case p: Payload.RecordSipInstallmentPending =>
          SipPlanRules.RecordSipInstallmentPending(RecordSipInstallmentPendingParams(state, p, hosts))
        case p: Payload.RecordSipInstallmentOutcomeUnknown =>
          SipPlanRules.RecordSipInstallmentOutcomeUnknown(RecordSipInstallmentOutcomeUnknownParams(state, p, hosts))
        case p: Payload.RecordSipInstallmentRecoveryRequired =>
          SipPlanRules.RecordSipInstallmentRecoveryRequired(RecordSipInstallmentRecoveryRequiredParams(state, p, hosts))
        case p: Payload.RecordSipInstallmentRefundInProgress =>
          SipPlanRules.RecordSipInstallmentRefundInProgress(RecordSipInstallmentRefundInProgressParams(state, p, hosts))
        case p: Payload.RecordSipInstallmentSucceeded =>
          SipPlanRules.RecordSipInstallmentSucceeded(RecordSipInstallmentSucceededParams(state, p, hosts))
        case p: Payload.RecordSipInstallmentFailed =>
          SipPlanRules.RecordSipInstallmentFailed(RecordSipInstallmentFailedParams(state, p, hosts))
        case p: Payload.RecordSipCreateIntent =>
          SipPlanRules.RecordSipCreateIntent(RecordSipCreateIntentParams(state, p, hosts))
      }

      decision match {
        case Left(code) =>
          Effect.none.thenRun((_: State) => reply ! Refused(code))
        case Right(events) =>
          Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))
      }
  }
}
