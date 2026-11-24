package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.SipPlanEntity._
import example.bankwealth.domain.invariants.params.SipPlanRuleParams._
import example.bankwealth.domain.services.SipPlanComputations

object SipPlanRules {
  def CreateSipPlan(state: State, p: CreateSipPlanParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(((state.createIntent).isEmpty || (((state.sipCreateIntents).contains("original") && (p.planId == ((state.sipCreateIntents)("original")).planId)) && (p.config == ((state.sipCreateIntents)("original")).config))))) return Left("SIP_ADMITTED_CREATE_MATCH")
    if (!(((p.planId).value).nonEmpty)) return Left("SIP_PLAN_ID")
    if (!((!(state.initialized) || (((p.planId == state.id) && (state.revisions).contains((p.config).revision)) && ((state.revisions)((p.config).revision) == p.config))))) return Left("SIP_CREATE_CONFLICT")
    if ((state.initialized)) return Right(Vector.empty)
    if (!((((p.config).revision).value).nonEmpty)) return Left("SIP_REVISION_ID")
    if (!(((p.config).effectiveSlot >= 0L))) return Left("SIP_EFFECTIVE_SLOT")
    if (!((((((p.config).investorAccountId).value).nonEmpty && (((p.config).fundCollectionAccountId).value).nonEmpty) && ((p.config).investorAccountId != (p.config).fundCollectionAccountId)))) return Left("SIP_CONFIG_ACCOUNTS")
    if (!(((p.config).fundCode).nonEmpty)) return Left("SIP_CONFIG_FUND")
    if (!(((((p.config).amount).currency == "CNY") && (((p.config).amount).amount > BigDecimal("0.00"))))) return Left("SIP_CONFIG_AMOUNT")
    Right(Vector(SipPlanCreated(p.planId, p.config)))
  }
  def AppendSipDueSlot(state: State, p: AppendSipDueSlotParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(((state.createIntent).isEmpty || (state.createIntentDueSlots).contains(p.dueSlot)))) return Left("SIP_ADMITTED_SLOT_MEMBER")
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((!((state.slots).contains(p.position)) || ((state.slots)(p.position) == p.dueSlot)))) return Left("SIP_SLOT_REPLAY_CONFLICT")
    if (((state.slots).contains(p.position))) return Right(Vector.empty)
    if ((state.scheduleSealed)) return Left("SIP_SCHEDULE_OPEN")
    if (!(((p.position == state.scheduleCount) && (p.position < 9223372036854775807L)))) return Left("SIP_SLOT_POSITION")
    if (!(((p.dueSlot > state.lastDueSlot) && (p.dueSlot >= state.latestEffectiveSlot)))) return Left("SIP_SLOT_ORDER")
    Right(Vector(SipDueSlotAppended(p.position, p.dueSlot)))
  }
  def SealSipSchedule(state: State, p: SealSipScheduleParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!((state.createIntentDueSlots).forall((state.intentAppendedDueSlots).contains))) return Left("SIP_ADMITTED_SCHEDULE_COVERED")
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if ((state.scheduleSealed)) return Right(Vector.empty)
    if (!((state.scheduleCount > 0L))) return Left("SIP_FINITE_SCHEDULE")
    Right(Vector(SipScheduleSealed(true)))
  }
  def ReviseSipPlan(state: State, p: ReviseSipPlanParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((!((state.revisions).contains((p.config).revision)) || ((state.revisions)((p.config).revision) == p.config)))) return Left("SIP_REVISION_REPLAY_CONFLICT")
    if (((state.revisions).contains((p.config).revision))) return Right(Vector.empty)
    if (!((((p.config).revision).value).nonEmpty)) return Left("SIP_REVISION_ID")
    if (!(((p.config).effectiveSlot >= 0L))) return Left("SIP_EFFECTIVE_SLOT")
    if (!((((((p.config).investorAccountId).value).nonEmpty && (((p.config).fundCollectionAccountId).value).nonEmpty) && ((p.config).investorAccountId != (p.config).fundCollectionAccountId)))) return Left("SIP_CONFIG_ACCOUNTS")
    if (!(((p.config).fundCode).nonEmpty)) return Left("SIP_CONFIG_FUND")
    if (!(((((p.config).amount).currency == "CNY") && (((p.config).amount).amount > BigDecimal("0.00"))))) return Left("SIP_CONFIG_AMOUNT")
    if (!((((p.config).effectiveSlot > state.currentTick) && ((p.config).effectiveSlot > state.latestEffectiveSlot)))) return Left("SIP_REVISION_FUTURE")
    Right(Vector(SipPlanRevised(p.config, state.latestRevision)))
  }
  def AdvanceSipClock(state: State, p: AdvanceSipClockParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!(((p.tick >= state.currentTick) && (p.tick >= 0L)))) return Left("SIP_CLOCK_MONOTONE")
    if (!((p.tick != state.currentTick))) return Right(Vector.empty)
    Right(Vector(SipClockAdvanced(p.tick)))
  }
  def PauseSipPlan(state: State, p: PauseSipPlanParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((!(state.paused) || (p.tick == state.pauseTick)))) return Left("SIP_PAUSE_REPLAY_CONFLICT")
    if ((state.paused)) return Right(Vector.empty)
    if (!(((p.tick == state.currentTick) && (p.tick >= 0L)))) return Left("SIP_PAUSE_CLOCK")
    if (((state.pauseIntervals).contains(p.tick))) return Left("SIP_PAUSE_INTERVAL_ONCE")
    Right(Vector(SipPlanPaused(p.tick)))
  }
  def ResumeSipPlan(state: State, p: ResumeSipPlanParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((p.tick == state.currentTick))) return Left("SIP_RESUME_CLOCK")
    if (!(state.paused)) return Right(Vector.empty)
    if (!(((state.observedCount == state.scheduleCount) || ((state.slots).contains(state.observedCount) && ((state.slots)(state.observedCount) > state.currentTick))))) return Left("SIP_RESUME_CLASSIFIED")
    Right(Vector(SipPlanResumed(p.tick, state.pauseTick)))
  }
  def ObserveSipDueSlot(state: State, p: ObserveSipDueSlotParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((state.slots).contains(p.position))) return Left("SIP_SLOT_DECLARED")
    if (!(((state.slots)(p.position) == p.dueSlot))) return Left("SIP_SLOT_MATCH")
    if (!((!((state.slotDisposition).contains(p.dueSlot)) || ((state.slotDisposition)(p.dueSlot) == "backlog")))) return Left("SIP_OBSERVATION_CONFLICT")
    if (((state.slotDisposition).contains(p.dueSlot))) return Right(Vector.empty)
    if (!((p.position == state.observedCount))) return Left("SIP_OBSERVATION_ORDER")
    if (!((p.dueSlot <= state.currentTick))) return Left("SIP_SLOT_DUE")
    if (!((!(state.paused) || (p.dueSlot < state.pauseTick)))) return Left("SIP_PAUSE_CLASSIFICATION")
    Right(Vector(SipDueSlotObserved(p.position, p.dueSlot, "backlog")))
  }
  def SkipPausedSipDueSlot(state: State, p: SkipPausedSipDueSlotParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((state.slots).contains(p.position))) return Left("SIP_SLOT_DECLARED")
    if (!(((state.slots)(p.position) == p.dueSlot))) return Left("SIP_SLOT_MATCH")
    if (!((!((state.slotDisposition).contains(p.dueSlot)) || ((state.slotDisposition)(p.dueSlot) == "skipped")))) return Left("SIP_OBSERVATION_CONFLICT")
    if (((state.slotDisposition).contains(p.dueSlot))) return Right(Vector.empty)
    if (!((p.position == state.observedCount))) return Left("SIP_OBSERVATION_ORDER")
    if (!((p.dueSlot <= state.currentTick))) return Left("SIP_SLOT_DUE")
    if (!((state.paused && (p.dueSlot >= state.pauseTick)))) return Left("SIP_PAUSE_CLASSIFICATION")
    Right(Vector(SipPausedDueSlotSkipped(p.position, p.dueSlot, "skipped")))
  }
  def AdvanceSkippedSipSlot(state: State, p: AdvanceSkippedSipSlotParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((state.slots).contains(p.position))) return Left("SIP_SLOT_DECLARED")
    if (!(((state.slots)(p.position) == p.dueSlot))) return Left("SIP_SLOT_MATCH")
    if (!(((state.slotDisposition).get(p.dueSlot)).contains("skipped"))) return Left("SIP_SKIP_RECORDED")
    if (!((p.position >= state.startCount))) return Right(Vector.empty)
    if (!((p.position == state.startCount))) return Left("SIP_SKIP_CURSOR_ORDER")
    Right(Vector(SipSkippedSlotAdvanced(p.position, p.dueSlot)))
  }
  def TriggerSipInstallment(state: State, p: TriggerSipInstallmentParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((state.slots).contains(p.position))) return Left("SIP_SLOT_DECLARED")
    if (!(((state.slots)(p.position) == p.dueSlot))) return Left("SIP_SLOT_MATCH")
    if (!((!((state.occurrences).contains(p.dueSlot)) || ((((state.occurrences)(p.dueSlot)).revision == p.revision) && (((state.occurrences)(p.dueSlot)).config == p.config))))) return Left("SIP_OCCURRENCE_REPLAY_CONFLICT")
    if (((state.occurrences).contains(p.dueSlot))) return Right(Vector.empty)
    if ((state.paused)) return Left("SIP_ACTIVE_START")
    if (!((p.position == state.startCount))) return Left("SIP_START_ORDER")
    if (!(((state.slotDisposition).get(p.dueSlot)).contains("backlog"))) return Left("SIP_BACKLOG_REQUIRED")
    if (!((state.revisions).contains(p.revision))) return Left("SIP_REVISION_DECLARED")
    if (!((((state.revisions)(p.revision) == p.config) && ((p.config).revision == p.revision)))) return Left("SIP_RETAINED_CONFIG")
    if (!(((p.dueSlot >= (p.config).effectiveSlot) && (!((state.revisionEnds).contains(p.revision)) || (p.dueSlot < (state.revisionEnds)(p.revision)))))) return Left("SIP_REVISION_INTERVAL")
    Right(Vector(SipInstallmentTriggered(p.position, hosts.StableSipOccurrence(state, p))))
  }
  def RecordSipInstallmentPending(state: State, p: RecordSipInstallmentPendingParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("pending"))) return Right(Vector.empty)
    Right(Vector(SipInstallmentPending(p.occurrence, "pending")))
  }
  def RecordSipInstallmentOutcomeUnknown(state: State, p: RecordSipInstallmentOutcomeUnknownParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("outcome-unknown"))) return Right(Vector.empty)
    Right(Vector(SipInstallmentOutcomeUnknown(p.occurrence, "outcome-unknown")))
  }
  def RecordSipInstallmentRecoveryRequired(state: State, p: RecordSipInstallmentRecoveryRequiredParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("recovery-required"))) return Right(Vector.empty)
    Right(Vector(SipInstallmentRecoveryRequired(p.occurrence, "recovery-required")))
  }
  def RecordSipInstallmentRefundInProgress(state: State, p: RecordSipInstallmentRefundInProgressParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("refund-in-progress"))) return Right(Vector.empty)
    Right(Vector(SipInstallmentRefundInProgress(p.occurrence, "refund-in-progress")))
  }
  def RecordSipInstallmentSucceeded(state: State, p: RecordSipInstallmentSucceededParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (!((p.evidence == "ta-confirmed"))) return Left("SIP_TERMINAL_EVIDENCE")
    if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left("SIP_TERMINAL_RECEIPT")
    if (!((!((state.terminalReceiptBodies).contains(p.receiptId)) || ((state.terminalReceiptBodies)(p.receiptId) == p.receiptBody)))) return Left("SIP_TERMINAL_RECEIPT_CONFLICT")
    if (!((!((state.firstTerminals).contains((p.occurrence).occurrenceId)) || ((state.firstTerminals)((p.occurrence).occurrenceId) == "succeeded")))) return Left("SIP_TERMINAL_CONFLICT")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if (!((state.successTotal < 9223372036854775807L))) return Left("SIP_TOTAL_CAPACITY")
    Right(Vector(SipInstallmentSucceeded(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "succeeded")))
  }
  def RecordSipInstallmentFailed(state: State, p: RecordSipInstallmentFailedParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (!((((p.evidence == "payment-rejected-before-effects") || (p.evidence == "payment-compensated")) || (p.evidence == "ta-rejected-refund-completed")))) return Left("SIP_TERMINAL_EVIDENCE")
    if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left("SIP_TERMINAL_RECEIPT")
    if (!((!((state.terminalReceiptBodies).contains(p.receiptId)) || ((state.terminalReceiptBodies)(p.receiptId) == p.receiptBody)))) return Left("SIP_TERMINAL_RECEIPT_CONFLICT")
    if (!((!((state.firstTerminals).contains((p.occurrence).occurrenceId)) || ((state.firstTerminals)((p.occurrence).occurrenceId) == "failed")))) return Left("SIP_TERMINAL_CONFLICT")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if (!((state.failureTotal < 9223372036854775807L))) return Left("SIP_TOTAL_CAPACITY")
    Right(Vector(SipInstallmentFailed(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "failed")))
  }
  def RecordSipCreateIntent(state: State, p: RecordSipCreateIntentParams, hosts: SipPlanComputations): Either[String, Vector[Event]] = {
    if (!((p.source).contains(p.intent))) return Left("SIP_INTENT_OPTION")
    if (!(((p.intent).planId == state.id))) return Left("SIP_INTENT_RESOURCE")
    if (!((((((((((p.intent).principalId).nonEmpty && ((p.intent).clientRequestId).nonEmpty) && ((p.intent).authorityVersion).nonEmpty) && ((p.intent).clientRequestId == ((p.intent).request).clientRequestId)) && (((p.intent).request).fundCode == ((p.intent).config).fundCode)) && (((p.intent).request).effectiveSlot == ((p.intent).config).effectiveSlot)) && ((((p.intent).request).amount).currency == (((p.intent).config).amount).currency)) && (((p.intent).request).dueSlots).nonEmpty))) return Left("SIP_INTENT_BODY")
    if (!(((state.createIntent).isEmpty || (state.createIntent).contains(p.intent)))) return Left("SIP_INTENT_CONFLICT")
    if (!((!(state.initialized) || ((((p.intent).planId == state.id) && (state.revisions).contains(((p.intent).config).revision)) && ((state.revisions)(((p.intent).config).revision) == (p.intent).config))))) return Left("SIP_INTENT_EXISTING_CONFIG")
    if (!((state.createIntent).isEmpty)) return Right(Vector.empty)
    if (!(((!(state.initialized) && (state.scheduleCount == 0L)) && !(state.scheduleSealed)))) return Left("SIP_INTENT_BEFORE_CREATE")
    Right(Vector(SipCreateIntentRecorded(p.intent, p.source)))
  }
}
