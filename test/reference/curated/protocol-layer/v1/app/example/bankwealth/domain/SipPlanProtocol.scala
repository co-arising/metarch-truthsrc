package example.bankwealth.domain

object SipPlanProtocol {
  sealed trait Command
  sealed trait Event
  final case class CreateSipPlan(planId: example.bankwealth.domain.values.PlanId, config: example.bankwealth.domain.values.SipRevisionConfig) extends Command
  final case class AppendSipDueSlot(position: Long, dueSlot: Long) extends Command
  final case class SealSipSchedule() extends Command
  final case class ReviseSipPlan(config: example.bankwealth.domain.values.SipRevisionConfig) extends Command
  final case class AdvanceSipClock(tick: Long) extends Command
  final case class PauseSipPlan(tick: Long) extends Command
  final case class ResumeSipPlan(tick: Long) extends Command
  final case class ObserveSipDueSlot(position: Long, dueSlot: Long) extends Command
  final case class SkipPausedSipDueSlot(position: Long, dueSlot: Long) extends Command
  final case class AdvanceSkippedSipSlot(position: Long, dueSlot: Long) extends Command
  final case class TriggerSipInstallment(position: Long, dueSlot: Long, revision: example.bankwealth.domain.values.RevisionId, config: example.bankwealth.domain.values.SipRevisionConfig) extends Command
  final case class RecordSipInstallmentPending(occurrence: example.bankwealth.domain.values.SipOccurrence) extends Command
  final case class RecordSipInstallmentOutcomeUnknown(occurrence: example.bankwealth.domain.values.SipOccurrence) extends Command
  final case class RecordSipInstallmentRecoveryRequired(occurrence: example.bankwealth.domain.values.SipOccurrence) extends Command
  final case class RecordSipInstallmentRefundInProgress(occurrence: example.bankwealth.domain.values.SipOccurrence) extends Command
  final case class RecordSipInstallmentSucceeded(occurrence: example.bankwealth.domain.values.SipOccurrence, evidence: String, receiptId: String, receiptBody: String) extends Command
  final case class RecordSipInstallmentFailed(occurrence: example.bankwealth.domain.values.SipOccurrence, evidence: String, receiptId: String, receiptBody: String) extends Command
  final case class RecordSipCreateIntent(intent: example.bankwealth.domain.values.BankSipCreateIntent, source: Option[example.bankwealth.domain.values.BankSipCreateIntent]) extends Command
  final case class SipPlanCreated(planId: example.bankwealth.domain.values.PlanId, config: example.bankwealth.domain.values.SipRevisionConfig) extends Event
  final case class SipDueSlotAppended(position: Long, dueSlot: Long) extends Event
  final case class SipScheduleSealed(`sealed`: Boolean) extends Event
  final case class SipPlanRevised(config: example.bankwealth.domain.values.SipRevisionConfig, previousRevision: example.bankwealth.domain.values.RevisionId) extends Event
  final case class SipClockAdvanced(tick: Long) extends Event
  final case class SipPlanPaused(tick: Long) extends Event
  final case class SipPlanResumed(tick: Long, pauseTick: Long) extends Event
  final case class SipDueSlotObserved(position: Long, dueSlot: Long, disposition: String) extends Event
  final case class SipPausedDueSlotSkipped(position: Long, dueSlot: Long, disposition: String) extends Event
  final case class SipSkippedSlotAdvanced(position: Long, dueSlot: Long) extends Event
  final case class SipInstallmentTriggered(position: Long, occurrence: example.bankwealth.domain.values.SipOccurrence) extends Event
  final case class SipInstallmentPending(occurrence: example.bankwealth.domain.values.SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentOutcomeUnknown(occurrence: example.bankwealth.domain.values.SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentRecoveryRequired(occurrence: example.bankwealth.domain.values.SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentRefundInProgress(occurrence: example.bankwealth.domain.values.SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentSucceeded(occurrence: example.bankwealth.domain.values.SipOccurrence, evidence: String, receiptId: String, receiptBody: String, outcome: String) extends Event
  final case class SipInstallmentFailed(occurrence: example.bankwealth.domain.values.SipOccurrence, evidence: String, receiptId: String, receiptBody: String, outcome: String) extends Event
  final case class SipCreateIntentRecorded(intent: example.bankwealth.domain.values.BankSipCreateIntent, source: Option[example.bankwealth.domain.values.BankSipCreateIntent]) extends Event
}
