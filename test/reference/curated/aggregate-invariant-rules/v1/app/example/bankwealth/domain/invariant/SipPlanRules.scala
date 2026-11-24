package example.bankwealth.domain.invariant

import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.domain.events.SipPlanEvents._
import example.bankwealth.domain.invariant.params.SipPlanRuleParams._
import example.bankwealth.domain.services.{SipPlanCommandHelpers, SipPlanComputations}

object SipPlanRules {
  def CreateSipPlan(input: CreateSipPlanParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(((state.createIntent).isEmpty || (((state.sipCreateIntents).contains("original") && (p.planId == ((state.sipCreateIntents)("original")).planId)) && (p.config == ((state.sipCreateIntents)("original")).config))))) return Left("SIP_ADMITTED_CREATE_MATCH")
    if (!(((p.planId).value).nonEmpty)) return Left("SIP_PLAN_ID")
    if (!((!(state.initialized) || (((p.planId == state.id) && (state.revisions).contains((p.config).revision)) && ((state.revisions)((p.config).revision) == p.config))))) return Left("SIP_CREATE_CONFLICT")
    if ((state.initialized)) return Right(Vector.empty)
    if (!((((p.config).revision).value).nonEmpty)) return Left("SIP_REVISION_ID")
    if (!(((p.config).effectiveSlot >= 0L))) return Left("SIP_EFFECTIVE_SLOT")
    if (!((((((p.config).investorAccountId).value).nonEmpty && (((p.config).fundCollectionAccountId).value).nonEmpty) && ((p.config).investorAccountId != (p.config).fundCollectionAccountId)))) return Left("SIP_CONFIG_ACCOUNTS")
    if (!(((p.config).fundCode).nonEmpty)) return Left("SIP_CONFIG_FUND")
    if (!(((((p.config).amount).currency == "CNY") && (((p.config).amount).amount > BigDecimal("0.00"))))) return Left("SIP_CONFIG_AMOUNT")
    Right(SipPlanCommandHelpers.emitCreateSipPlan(state, p, hosts))
  }
  def AppendSipDueSlot(input: AppendSipDueSlotParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(((state.createIntent).isEmpty || (state.createIntentDueSlots).contains(p.dueSlot)))) return Left("SIP_ADMITTED_SLOT_MEMBER")
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((!((state.slots).contains(p.position)) || ((state.slots)(p.position) == p.dueSlot)))) return Left("SIP_SLOT_REPLAY_CONFLICT")
    if (((state.slots).contains(p.position))) return Right(Vector.empty)
    if ((state.scheduleSealed)) return Left("SIP_SCHEDULE_OPEN")
    if (!(((p.position == state.scheduleCount) && (p.position < 9223372036854775807L)))) return Left("SIP_SLOT_POSITION")
    if (!(((p.dueSlot > state.lastDueSlot) && (p.dueSlot >= state.latestEffectiveSlot)))) return Left("SIP_SLOT_ORDER")
    Right(SipPlanCommandHelpers.emitAppendSipDueSlot(state, p, hosts))
  }
  def SealSipSchedule(input: SealSipScheduleParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!((state.createIntentDueSlots).forall((state.intentAppendedDueSlots).contains))) return Left("SIP_ADMITTED_SCHEDULE_COVERED")
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if ((state.scheduleSealed)) return Right(Vector.empty)
    if (!((state.scheduleCount > 0L))) return Left("SIP_FINITE_SCHEDULE")
    Right(SipPlanCommandHelpers.emitSealSipSchedule(state, p, hosts))
  }
  def ReviseSipPlan(input: ReviseSipPlanParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((!((state.revisions).contains((p.config).revision)) || ((state.revisions)((p.config).revision) == p.config)))) return Left("SIP_REVISION_REPLAY_CONFLICT")
    if (((state.revisions).contains((p.config).revision))) return Right(Vector.empty)
    if (!((((p.config).revision).value).nonEmpty)) return Left("SIP_REVISION_ID")
    if (!(((p.config).effectiveSlot >= 0L))) return Left("SIP_EFFECTIVE_SLOT")
    if (!((((((p.config).investorAccountId).value).nonEmpty && (((p.config).fundCollectionAccountId).value).nonEmpty) && ((p.config).investorAccountId != (p.config).fundCollectionAccountId)))) return Left("SIP_CONFIG_ACCOUNTS")
    if (!(((p.config).fundCode).nonEmpty)) return Left("SIP_CONFIG_FUND")
    if (!(((((p.config).amount).currency == "CNY") && (((p.config).amount).amount > BigDecimal("0.00"))))) return Left("SIP_CONFIG_AMOUNT")
    if (!((((p.config).effectiveSlot > state.currentTick) && ((p.config).effectiveSlot > state.latestEffectiveSlot)))) return Left("SIP_REVISION_FUTURE")
    Right(SipPlanCommandHelpers.emitReviseSipPlan(state, p, hosts))
  }
  def AdvanceSipClock(input: AdvanceSipClockParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!(((p.tick >= state.currentTick) && (p.tick >= 0L)))) return Left("SIP_CLOCK_MONOTONE")
    if (!((p.tick != state.currentTick))) return Right(Vector.empty)
    Right(SipPlanCommandHelpers.emitAdvanceSipClock(state, p, hosts))
  }
  def PauseSipPlan(input: PauseSipPlanParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((!(state.paused) || (p.tick == state.pauseTick)))) return Left("SIP_PAUSE_REPLAY_CONFLICT")
    if ((state.paused)) return Right(Vector.empty)
    if (!(((p.tick == state.currentTick) && (p.tick >= 0L)))) return Left("SIP_PAUSE_CLOCK")
    if (((state.pauseIntervals).contains(p.tick))) return Left("SIP_PAUSE_INTERVAL_ONCE")
    Right(SipPlanCommandHelpers.emitPauseSipPlan(state, p, hosts))
  }
  def ResumeSipPlan(input: ResumeSipPlanParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((p.tick == state.currentTick))) return Left("SIP_RESUME_CLOCK")
    if (!(state.paused)) return Right(Vector.empty)
    if (!(((state.observedCount == state.scheduleCount) || ((state.slots).contains(state.observedCount) && ((state.slots)(state.observedCount) > state.currentTick))))) return Left("SIP_RESUME_CLASSIFIED")
    Right(SipPlanCommandHelpers.emitResumeSipPlan(state, p, hosts))
  }
  def ObserveSipDueSlot(input: ObserveSipDueSlotParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((state.slots).contains(p.position))) return Left("SIP_SLOT_DECLARED")
    if (!(((state.slots)(p.position) == p.dueSlot))) return Left("SIP_SLOT_MATCH")
    if (!((!((state.slotDisposition).contains(p.dueSlot)) || ((state.slotDisposition)(p.dueSlot) == "backlog")))) return Left("SIP_OBSERVATION_CONFLICT")
    if (((state.slotDisposition).contains(p.dueSlot))) return Right(Vector.empty)
    if (!((p.position == state.observedCount))) return Left("SIP_OBSERVATION_ORDER")
    if (!((p.dueSlot <= state.currentTick))) return Left("SIP_SLOT_DUE")
    if (!((!(state.paused) || (p.dueSlot < state.pauseTick)))) return Left("SIP_PAUSE_CLASSIFICATION")
    Right(SipPlanCommandHelpers.emitObserveSipDueSlot(state, p, hosts))
  }
  def SkipPausedSipDueSlot(input: SkipPausedSipDueSlotParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((state.slots).contains(p.position))) return Left("SIP_SLOT_DECLARED")
    if (!(((state.slots)(p.position) == p.dueSlot))) return Left("SIP_SLOT_MATCH")
    if (!((!((state.slotDisposition).contains(p.dueSlot)) || ((state.slotDisposition)(p.dueSlot) == "skipped")))) return Left("SIP_OBSERVATION_CONFLICT")
    if (((state.slotDisposition).contains(p.dueSlot))) return Right(Vector.empty)
    if (!((p.position == state.observedCount))) return Left("SIP_OBSERVATION_ORDER")
    if (!((p.dueSlot <= state.currentTick))) return Left("SIP_SLOT_DUE")
    if (!((state.paused && (p.dueSlot >= state.pauseTick)))) return Left("SIP_PAUSE_CLASSIFICATION")
    Right(SipPlanCommandHelpers.emitSkipPausedSipDueSlot(state, p, hosts))
  }
  def AdvanceSkippedSipSlot(input: AdvanceSkippedSipSlotParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!(state.scheduleSealed)) return Left("SIP_SCHEDULE_SEALED")
    if (!((state.slots).contains(p.position))) return Left("SIP_SLOT_DECLARED")
    if (!(((state.slots)(p.position) == p.dueSlot))) return Left("SIP_SLOT_MATCH")
    if (!(((state.slotDisposition).get(p.dueSlot)).contains("skipped"))) return Left("SIP_SKIP_RECORDED")
    if (!((p.position >= state.startCount))) return Right(Vector.empty)
    if (!((p.position == state.startCount))) return Left("SIP_SKIP_CURSOR_ORDER")
    Right(SipPlanCommandHelpers.emitAdvanceSkippedSipSlot(state, p, hosts))
  }
  def TriggerSipInstallment(input: TriggerSipInstallmentParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
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
    Right(SipPlanCommandHelpers.emitTriggerSipInstallment(state, p, hosts))
  }
  def RecordSipInstallmentPending(input: RecordSipInstallmentPendingParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("pending"))) return Right(Vector.empty)
    Right(SipPlanCommandHelpers.emitRecordSipInstallmentPending(state, p, hosts))
  }
  def RecordSipInstallmentOutcomeUnknown(input: RecordSipInstallmentOutcomeUnknownParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("outcome-unknown"))) return Right(Vector.empty)
    Right(SipPlanCommandHelpers.emitRecordSipInstallmentOutcomeUnknown(state, p, hosts))
  }
  def RecordSipInstallmentRecoveryRequired(input: RecordSipInstallmentRecoveryRequiredParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("recovery-required"))) return Right(Vector.empty)
    Right(SipPlanCommandHelpers.emitRecordSipInstallmentRecoveryRequired(state, p, hosts))
  }
  def RecordSipInstallmentRefundInProgress(input: RecordSipInstallmentRefundInProgressParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("refund-in-progress"))) return Right(Vector.empty)
    Right(SipPlanCommandHelpers.emitRecordSipInstallmentRefundInProgress(state, p, hosts))
  }
  def RecordSipInstallmentSucceeded(input: RecordSipInstallmentSucceededParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (!((p.evidence == "ta-confirmed"))) return Left("SIP_TERMINAL_EVIDENCE")
    if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left("SIP_TERMINAL_RECEIPT")
    if (!((!((state.terminalReceiptBodies).contains(p.receiptId)) || ((state.terminalReceiptBodies)(p.receiptId) == p.receiptBody)))) return Left("SIP_TERMINAL_RECEIPT_CONFLICT")
    if (!((!((state.firstTerminals).contains((p.occurrence).occurrenceId)) || ((state.firstTerminals)((p.occurrence).occurrenceId) == "succeeded")))) return Left("SIP_TERMINAL_CONFLICT")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if (!((state.successTotal < 9223372036854775807L))) return Left("SIP_TOTAL_CAPACITY")
    Right(SipPlanCommandHelpers.emitRecordSipInstallmentSucceeded(state, p, hosts))
  }
  def RecordSipInstallmentFailed(input: RecordSipInstallmentFailedParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!(state.initialized)) return Left("SIP_INITIALIZED")
    if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left("SIP_OCCURRENCE_KNOWN")
    if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left("SIP_ORIGINAL_ASSOCIATION")
    if (!((((p.evidence == "payment-rejected-before-effects") || (p.evidence == "payment-compensated")) || (p.evidence == "ta-rejected-refund-completed")))) return Left("SIP_TERMINAL_EVIDENCE")
    if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left("SIP_TERMINAL_RECEIPT")
    if (!((!((state.terminalReceiptBodies).contains(p.receiptId)) || ((state.terminalReceiptBodies)(p.receiptId) == p.receiptBody)))) return Left("SIP_TERMINAL_RECEIPT_CONFLICT")
    if (!((!((state.firstTerminals).contains((p.occurrence).occurrenceId)) || ((state.firstTerminals)((p.occurrence).occurrenceId) == "failed")))) return Left("SIP_TERMINAL_CONFLICT")
    if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Vector.empty)
    if (!((state.failureTotal < 9223372036854775807L))) return Left("SIP_TOTAL_CAPACITY")
    Right(SipPlanCommandHelpers.emitRecordSipInstallmentFailed(state, p, hosts))
  }
  def RecordSipCreateIntent(input: RecordSipCreateIntentParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!((p.source).contains(p.intent))) return Left("SIP_INTENT_OPTION")
    if (!(((p.intent).planId == state.id))) return Left("SIP_INTENT_RESOURCE")
    if (!((((((((((p.intent).principalId).nonEmpty && ((p.intent).clientRequestId).nonEmpty) && ((p.intent).authorityVersion).nonEmpty) && ((p.intent).clientRequestId == ((p.intent).request).clientRequestId)) && (((p.intent).request).fundCode == ((p.intent).config).fundCode)) && (((p.intent).request).effectiveSlot == ((p.intent).config).effectiveSlot)) && ((((p.intent).request).amount).currency == (((p.intent).config).amount).currency)) && (((p.intent).request).dueSlots).nonEmpty))) return Left("SIP_INTENT_BODY")
    if (!(((state.createIntent).isEmpty || (state.createIntent).contains(p.intent)))) return Left("SIP_INTENT_CONFLICT")
    if (!((!(state.initialized) || ((((p.intent).planId == state.id) && (state.revisions).contains(((p.intent).config).revision)) && ((state.revisions)(((p.intent).config).revision) == (p.intent).config))))) return Left("SIP_INTENT_EXISTING_CONFIG")
    if (!((state.createIntent).isEmpty)) return Right(Vector.empty)
    if (!(((!(state.initialized) && (state.scheduleCount == 0L)) && !(state.scheduleSealed)))) return Left("SIP_INTENT_BEFORE_CREATE")
    Right(SipPlanCommandHelpers.emitRecordSipCreateIntent(state, p, hosts))
  }
}
