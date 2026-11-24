package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.SipPlanProtocol._
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.invariants.SipPlanRules
import example.bankwealth.domain.services.SipPlanComputations

object SipPlanBehaviors extends SipPlanCommandHelpers {

  def apply(hosts: SipPlanComputations): CommandHandler = (state, command) =>
    queryBehavior
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(replyTo) =>
      Effect.none.thenRun((s: State) => replyTo ! s)
  }

  private def executionBehavior(state: State, hosts: SipPlanComputations): PartialFunction[Command, Effect[Event, State]] = {
    case cmd: CreateSipPlan =>
      replyEffect(SipPlanRules.CreateSipPlan(state, toCreateSipPlanParams(cmd), hosts), cmd.replyTo)
    case cmd: AppendSipDueSlot =>
      replyEffect(SipPlanRules.AppendSipDueSlot(state, toAppendSipDueSlotParams(cmd), hosts), cmd.replyTo)
    case cmd: SealSipSchedule =>
      replyEffect(SipPlanRules.SealSipSchedule(state, toSealSipScheduleParams(cmd), hosts), cmd.replyTo)
    case cmd: ReviseSipPlan =>
      replyEffect(SipPlanRules.ReviseSipPlan(state, toReviseSipPlanParams(cmd), hosts), cmd.replyTo)
    case cmd: AdvanceSipClock =>
      replyEffect(SipPlanRules.AdvanceSipClock(state, toAdvanceSipClockParams(cmd), hosts), cmd.replyTo)
    case cmd: PauseSipPlan =>
      replyEffect(SipPlanRules.PauseSipPlan(state, toPauseSipPlanParams(cmd), hosts), cmd.replyTo)
    case cmd: ResumeSipPlan =>
      replyEffect(SipPlanRules.ResumeSipPlan(state, toResumeSipPlanParams(cmd), hosts), cmd.replyTo)
    case cmd: ObserveSipDueSlot =>
      replyEffect(SipPlanRules.ObserveSipDueSlot(state, toObserveSipDueSlotParams(cmd), hosts), cmd.replyTo)
    case cmd: SkipPausedSipDueSlot =>
      replyEffect(SipPlanRules.SkipPausedSipDueSlot(state, toSkipPausedSipDueSlotParams(cmd), hosts), cmd.replyTo)
    case cmd: AdvanceSkippedSipSlot =>
      replyEffect(SipPlanRules.AdvanceSkippedSipSlot(state, toAdvanceSkippedSipSlotParams(cmd), hosts), cmd.replyTo)
    case cmd: TriggerSipInstallment =>
      replyEffect(SipPlanRules.TriggerSipInstallment(state, toTriggerSipInstallmentParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordSipInstallmentPending =>
      replyEffect(SipPlanRules.RecordSipInstallmentPending(state, toRecordSipInstallmentPendingParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordSipInstallmentOutcomeUnknown =>
      replyEffect(SipPlanRules.RecordSipInstallmentOutcomeUnknown(state, toRecordSipInstallmentOutcomeUnknownParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordSipInstallmentRecoveryRequired =>
      replyEffect(SipPlanRules.RecordSipInstallmentRecoveryRequired(state, toRecordSipInstallmentRecoveryRequiredParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordSipInstallmentRefundInProgress =>
      replyEffect(SipPlanRules.RecordSipInstallmentRefundInProgress(state, toRecordSipInstallmentRefundInProgressParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordSipInstallmentSucceeded =>
      replyEffect(SipPlanRules.RecordSipInstallmentSucceeded(state, toRecordSipInstallmentSucceededParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordSipInstallmentFailed =>
      replyEffect(SipPlanRules.RecordSipInstallmentFailed(state, toRecordSipInstallmentFailedParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordSipCreateIntent =>
      replyEffect(SipPlanRules.RecordSipCreateIntent(state, toRecordSipCreateIntentParams(cmd), hosts), cmd.replyTo)
  }
}
