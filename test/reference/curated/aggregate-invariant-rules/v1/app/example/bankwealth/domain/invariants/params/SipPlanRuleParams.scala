package example.bankwealth.domain.invariants.params

import example.bankwealth.domain.values._

object SipPlanRuleParams {
  final case class CreateSipPlanParams(planId: PlanId, config: SipRevisionConfig)
  final case class AppendSipDueSlotParams(position: Long, dueSlot: Long)
  final case class SealSipScheduleParams()
  final case class ReviseSipPlanParams(config: SipRevisionConfig)
  final case class AdvanceSipClockParams(tick: Long)
  final case class PauseSipPlanParams(tick: Long)
  final case class ResumeSipPlanParams(tick: Long)
  final case class ObserveSipDueSlotParams(position: Long, dueSlot: Long)
  final case class SkipPausedSipDueSlotParams(position: Long, dueSlot: Long)
  final case class AdvanceSkippedSipSlotParams(position: Long, dueSlot: Long)
  final case class TriggerSipInstallmentParams(
    position: Long,
    dueSlot: Long,
    revision: RevisionId,
    config: SipRevisionConfig
  )
  final case class RecordSipInstallmentPendingParams(occurrence: SipOccurrence)
  final case class RecordSipInstallmentOutcomeUnknownParams(occurrence: SipOccurrence)
  final case class RecordSipInstallmentRecoveryRequiredParams(occurrence: SipOccurrence)
  final case class RecordSipInstallmentRefundInProgressParams(occurrence: SipOccurrence)
  final case class RecordSipInstallmentSucceededParams(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String
  )
  final case class RecordSipInstallmentFailedParams(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String
  )
  final case class RecordSipCreateIntentParams(
    intent: BankSipCreateIntent,
    source: Option[BankSipCreateIntent]
  )
}
