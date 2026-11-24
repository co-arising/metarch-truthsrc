package example.bankwealth.domain.services

import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.domain.events.SipPlanEvents._
import example.bankwealth.domain.values._

trait SipPlanComputations {
  def StableSipOccurrence(state: State, p: TriggerSipInstallment): SipOccurrence
}
object SipPlanComputations {
}
object SipPlanCommandHelpers {
  def emitCreateSipPlan(state: State, p: CreateSipPlan, hosts: SipPlanComputations): Vector[Event] = Vector(SipPlanCreated(p.planId, p.config))
  def emitAppendSipDueSlot(state: State, p: AppendSipDueSlot, hosts: SipPlanComputations): Vector[Event] = Vector(SipDueSlotAppended(p.position, p.dueSlot))
  def emitSealSipSchedule(state: State, p: SealSipSchedule, hosts: SipPlanComputations): Vector[Event] = Vector(SipScheduleSealed(true))
  def emitReviseSipPlan(state: State, p: ReviseSipPlan, hosts: SipPlanComputations): Vector[Event] = Vector(SipPlanRevised(p.config, state.latestRevision))
  def emitAdvanceSipClock(state: State, p: AdvanceSipClock, hosts: SipPlanComputations): Vector[Event] = Vector(SipClockAdvanced(p.tick))
  def emitPauseSipPlan(state: State, p: PauseSipPlan, hosts: SipPlanComputations): Vector[Event] = Vector(SipPlanPaused(p.tick))
  def emitResumeSipPlan(state: State, p: ResumeSipPlan, hosts: SipPlanComputations): Vector[Event] = Vector(SipPlanResumed(p.tick, state.pauseTick))
  def emitObserveSipDueSlot(state: State, p: ObserveSipDueSlot, hosts: SipPlanComputations): Vector[Event] = Vector(SipDueSlotObserved(p.position, p.dueSlot, "backlog"))
  def emitSkipPausedSipDueSlot(state: State, p: SkipPausedSipDueSlot, hosts: SipPlanComputations): Vector[Event] = Vector(SipPausedDueSlotSkipped(p.position, p.dueSlot, "skipped"))
  def emitAdvanceSkippedSipSlot(state: State, p: AdvanceSkippedSipSlot, hosts: SipPlanComputations): Vector[Event] = Vector(SipSkippedSlotAdvanced(p.position, p.dueSlot))
  def emitTriggerSipInstallment(state: State, p: TriggerSipInstallment, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentTriggered(p.position, hosts.StableSipOccurrence(state, p)))
  def emitRecordSipInstallmentPending(state: State, p: RecordSipInstallmentPending, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentPending(p.occurrence, "pending"))
  def emitRecordSipInstallmentOutcomeUnknown(state: State, p: RecordSipInstallmentOutcomeUnknown, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentOutcomeUnknown(p.occurrence, "outcome-unknown"))
  def emitRecordSipInstallmentRecoveryRequired(state: State, p: RecordSipInstallmentRecoveryRequired, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentRecoveryRequired(p.occurrence, "recovery-required"))
  def emitRecordSipInstallmentRefundInProgress(state: State, p: RecordSipInstallmentRefundInProgress, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentRefundInProgress(p.occurrence, "refund-in-progress"))
  def emitRecordSipInstallmentSucceeded(state: State, p: RecordSipInstallmentSucceeded, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentSucceeded(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "succeeded"))
  def emitRecordSipInstallmentFailed(state: State, p: RecordSipInstallmentFailed, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentFailed(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "failed"))
  def emitRecordSipCreateIntent(state: State, p: RecordSipCreateIntent, hosts: SipPlanComputations): Vector[Event] = Vector(SipCreateIntentRecorded(p.intent, p.source))
}
