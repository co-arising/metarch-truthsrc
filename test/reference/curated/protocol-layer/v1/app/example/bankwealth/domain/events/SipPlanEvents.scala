package example.bankwealth.domain.events

import example.bankwealth.domain.values._

object SipPlanEvents {
  sealed trait Command
  sealed trait Event
  final case class CreateSipPlan(planId: PlanId, config: SipRevisionConfig) extends Command
  final case class AppendSipDueSlot(position: Long, dueSlot: Long) extends Command
  final case class SealSipSchedule() extends Command
  final case class ReviseSipPlan(config: SipRevisionConfig) extends Command
  final case class AdvanceSipClock(tick: Long) extends Command
  final case class PauseSipPlan(tick: Long) extends Command
  final case class ResumeSipPlan(tick: Long) extends Command
  final case class ObserveSipDueSlot(position: Long, dueSlot: Long) extends Command
  final case class SkipPausedSipDueSlot(position: Long, dueSlot: Long) extends Command
  final case class AdvanceSkippedSipSlot(position: Long, dueSlot: Long) extends Command
  final case class TriggerSipInstallment(
    position: Long,
    dueSlot: Long,
    revision: RevisionId,
    config: SipRevisionConfig
  ) extends Command
  final case class RecordSipInstallmentPending(occurrence: SipOccurrence) extends Command
  final case class RecordSipInstallmentOutcomeUnknown(occurrence: SipOccurrence) extends Command
  final case class RecordSipInstallmentRecoveryRequired(occurrence: SipOccurrence) extends Command
  final case class RecordSipInstallmentRefundInProgress(occurrence: SipOccurrence) extends Command
  final case class RecordSipInstallmentSucceeded(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String
  ) extends Command
  final case class RecordSipInstallmentFailed(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String
  ) extends Command
  final case class RecordSipCreateIntent(
    intent: BankSipCreateIntent,
    source: Option[BankSipCreateIntent]
  ) extends Command
  final case class SipPlanCreated(planId: PlanId, config: SipRevisionConfig) extends Event
  final case class SipDueSlotAppended(position: Long, dueSlot: Long) extends Event
  final case class SipScheduleSealed(`sealed`: Boolean) extends Event
  final case class SipPlanRevised(config: SipRevisionConfig, previousRevision: RevisionId) extends Event
  final case class SipClockAdvanced(tick: Long) extends Event
  final case class SipPlanPaused(tick: Long) extends Event
  final case class SipPlanResumed(tick: Long, pauseTick: Long) extends Event
  final case class SipDueSlotObserved(position: Long, dueSlot: Long, disposition: String) extends Event
  final case class SipPausedDueSlotSkipped(position: Long, dueSlot: Long, disposition: String) extends Event
  final case class SipSkippedSlotAdvanced(position: Long, dueSlot: Long) extends Event
  final case class SipInstallmentTriggered(position: Long, occurrence: SipOccurrence) extends Event
  final case class SipInstallmentPending(occurrence: SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentOutcomeUnknown(occurrence: SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentRecoveryRequired(occurrence: SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentRefundInProgress(occurrence: SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentSucceeded(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String,
    outcome: String
  ) extends Event
  final case class SipInstallmentFailed(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String,
    outcome: String
  ) extends Event
  final case class SipCreateIntentRecorded(
    intent: BankSipCreateIntent,
    source: Option[BankSipCreateIntent]
  ) extends Event
}
