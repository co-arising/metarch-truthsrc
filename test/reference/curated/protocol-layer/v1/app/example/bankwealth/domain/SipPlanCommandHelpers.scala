package example.bankwealth.domain

import example.bankwealth.domain.values._
import SipPlanProtocol._

trait SipPlanComputations {
  def StableSipOccurrence(state: SipPlanState, p: TriggerSipInstallment): SipOccurrence
}
object SipPlanComputations {
}
object SipPlanCommandHelpers {
  def emitCreateSipPlan(state: SipPlanState, p: CreateSipPlan, hosts: SipPlanComputations): Vector[Event] = Vector(SipPlanCreated(p.planId, p.config))
  def emitAppendSipDueSlot(state: SipPlanState, p: AppendSipDueSlot, hosts: SipPlanComputations): Vector[Event] = Vector(SipDueSlotAppended(p.position, p.dueSlot))
  def emitSealSipSchedule(state: SipPlanState, p: SealSipSchedule, hosts: SipPlanComputations): Vector[Event] = Vector(SipScheduleSealed(true))
  def emitReviseSipPlan(state: SipPlanState, p: ReviseSipPlan, hosts: SipPlanComputations): Vector[Event] = Vector(SipPlanRevised(p.config, state.latestRevision))
  def emitAdvanceSipClock(state: SipPlanState, p: AdvanceSipClock, hosts: SipPlanComputations): Vector[Event] = Vector(SipClockAdvanced(p.tick))
  def emitPauseSipPlan(state: SipPlanState, p: PauseSipPlan, hosts: SipPlanComputations): Vector[Event] = Vector(SipPlanPaused(p.tick))
  def emitResumeSipPlan(state: SipPlanState, p: ResumeSipPlan, hosts: SipPlanComputations): Vector[Event] = Vector(SipPlanResumed(p.tick, state.pauseTick))
  def emitObserveSipDueSlot(state: SipPlanState, p: ObserveSipDueSlot, hosts: SipPlanComputations): Vector[Event] = Vector(SipDueSlotObserved(p.position, p.dueSlot, "backlog"))
  def emitSkipPausedSipDueSlot(state: SipPlanState, p: SkipPausedSipDueSlot, hosts: SipPlanComputations): Vector[Event] = Vector(SipPausedDueSlotSkipped(p.position, p.dueSlot, "skipped"))
  def emitAdvanceSkippedSipSlot(state: SipPlanState, p: AdvanceSkippedSipSlot, hosts: SipPlanComputations): Vector[Event] = Vector(SipSkippedSlotAdvanced(p.position, p.dueSlot))
  def emitTriggerSipInstallment(state: SipPlanState, p: TriggerSipInstallment, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentTriggered(p.position, hosts.StableSipOccurrence(state, p)))
  def emitRecordSipInstallmentPending(state: SipPlanState, p: RecordSipInstallmentPending, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentPending(p.occurrence, "pending"))
  def emitRecordSipInstallmentOutcomeUnknown(state: SipPlanState, p: RecordSipInstallmentOutcomeUnknown, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentOutcomeUnknown(p.occurrence, "outcome-unknown"))
  def emitRecordSipInstallmentRecoveryRequired(state: SipPlanState, p: RecordSipInstallmentRecoveryRequired, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentRecoveryRequired(p.occurrence, "recovery-required"))
  def emitRecordSipInstallmentRefundInProgress(state: SipPlanState, p: RecordSipInstallmentRefundInProgress, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentRefundInProgress(p.occurrence, "refund-in-progress"))
  def emitRecordSipInstallmentSucceeded(state: SipPlanState, p: RecordSipInstallmentSucceeded, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentSucceeded(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "succeeded"))
  def emitRecordSipInstallmentFailed(state: SipPlanState, p: RecordSipInstallmentFailed, hosts: SipPlanComputations): Vector[Event] = Vector(SipInstallmentFailed(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "failed"))
  def emitRecordSipCreateIntent(state: SipPlanState, p: RecordSipCreateIntent, hosts: SipPlanComputations): Vector[Event] = Vector(SipCreateIntentRecorded(p.intent, p.source))
}
