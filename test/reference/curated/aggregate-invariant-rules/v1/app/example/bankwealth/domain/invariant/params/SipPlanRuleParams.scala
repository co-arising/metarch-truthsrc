package example.bankwealth.domain.invariant.params

import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.domain.events.SipPlanEvents
import example.bankwealth.domain.services.SipPlanComputations

object SipPlanRuleParams {
  final case class CreateSipPlanParams(state: State, command: SipPlanEvents.CreateSipPlan, hosts: SipPlanComputations)
  final case class AppendSipDueSlotParams(state: State, command: SipPlanEvents.AppendSipDueSlot, hosts: SipPlanComputations)
  final case class SealSipScheduleParams(state: State, command: SipPlanEvents.SealSipSchedule, hosts: SipPlanComputations)
  final case class ReviseSipPlanParams(state: State, command: SipPlanEvents.ReviseSipPlan, hosts: SipPlanComputations)
  final case class AdvanceSipClockParams(state: State, command: SipPlanEvents.AdvanceSipClock, hosts: SipPlanComputations)
  final case class PauseSipPlanParams(state: State, command: SipPlanEvents.PauseSipPlan, hosts: SipPlanComputations)
  final case class ResumeSipPlanParams(state: State, command: SipPlanEvents.ResumeSipPlan, hosts: SipPlanComputations)
  final case class ObserveSipDueSlotParams(state: State, command: SipPlanEvents.ObserveSipDueSlot, hosts: SipPlanComputations)
  final case class SkipPausedSipDueSlotParams(state: State, command: SipPlanEvents.SkipPausedSipDueSlot, hosts: SipPlanComputations)
  final case class AdvanceSkippedSipSlotParams(state: State, command: SipPlanEvents.AdvanceSkippedSipSlot, hosts: SipPlanComputations)
  final case class TriggerSipInstallmentParams(state: State, command: SipPlanEvents.TriggerSipInstallment, hosts: SipPlanComputations)
  final case class RecordSipInstallmentPendingParams(state: State, command: SipPlanEvents.RecordSipInstallmentPending, hosts: SipPlanComputations)
  final case class RecordSipInstallmentOutcomeUnknownParams(state: State, command: SipPlanEvents.RecordSipInstallmentOutcomeUnknown, hosts: SipPlanComputations)
  final case class RecordSipInstallmentRecoveryRequiredParams(state: State, command: SipPlanEvents.RecordSipInstallmentRecoveryRequired, hosts: SipPlanComputations)
  final case class RecordSipInstallmentRefundInProgressParams(state: State, command: SipPlanEvents.RecordSipInstallmentRefundInProgress, hosts: SipPlanComputations)
  final case class RecordSipInstallmentSucceededParams(state: State, command: SipPlanEvents.RecordSipInstallmentSucceeded, hosts: SipPlanComputations)
  final case class RecordSipInstallmentFailedParams(state: State, command: SipPlanEvents.RecordSipInstallmentFailed, hosts: SipPlanComputations)
  final case class RecordSipCreateIntentParams(state: State, command: SipPlanEvents.RecordSipCreateIntent, hosts: SipPlanComputations)
}
