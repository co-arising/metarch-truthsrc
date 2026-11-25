package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.SipPlanEntity._
import example.bankwealth.domain.invariants.params.SipPlanRuleParams._
import example.bankwealth.domain.services.SipPlanComputations
import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

object SipPlanRules {
  final class CreateSipPlanRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, CreateSipPlanParams] {
    override def apply(state: State, p: CreateSipPlanParams): Either[iMadzError, List[Event]] = {
      if (!(((state.createIntent).isEmpty || (((state.sipCreateIntents).contains("original") && (p.planId == ((state.sipCreateIntents)("original")).planId)) && (p.config == ((state.sipCreateIntents)("original")).config))))) return Left(iMadzError("SIP_ADMITTED_CREATE_MATCH", "SIP_ADMITTED_CREATE_MATCH"))
      if (!(((p.planId).value).nonEmpty)) return Left(iMadzError("SIP_PLAN_ID", "SIP_PLAN_ID"))
      if (!((!(state.initialized) || (((p.planId == state.id) && (state.revisions).contains((p.config).revision)) && ((state.revisions)((p.config).revision) == p.config))))) return Left(iMadzError("SIP_CREATE_CONFLICT", "SIP_CREATE_CONFLICT"))
      if ((state.initialized)) return Right(Nil)
      if (!((((p.config).revision).value).nonEmpty)) return Left(iMadzError("SIP_REVISION_ID", "SIP_REVISION_ID"))
      if (!(((p.config).effectiveSlot >= 0L))) return Left(iMadzError("SIP_EFFECTIVE_SLOT", "SIP_EFFECTIVE_SLOT"))
      if (!((((((p.config).investorAccountId).value).nonEmpty && (((p.config).fundCollectionAccountId).value).nonEmpty) && ((p.config).investorAccountId != (p.config).fundCollectionAccountId)))) return Left(iMadzError("SIP_CONFIG_ACCOUNTS", "SIP_CONFIG_ACCOUNTS"))
      if (!(((p.config).fundCode).nonEmpty)) return Left(iMadzError("SIP_CONFIG_FUND", "SIP_CONFIG_FUND"))
      if (!(((((p.config).amount).currency == "CNY") && (((p.config).amount).amount > BigDecimal("0.00"))))) return Left(iMadzError("SIP_CONFIG_AMOUNT", "SIP_CONFIG_AMOUNT"))
      Right(List(SipPlanCreated(p.planId, p.config)))
    }
  }
  final class AppendSipDueSlotRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, AppendSipDueSlotParams] {
    override def apply(state: State, p: AppendSipDueSlotParams): Either[iMadzError, List[Event]] = {
      if (!(((state.createIntent).isEmpty || (state.createIntentDueSlots).contains(p.dueSlot)))) return Left(iMadzError("SIP_ADMITTED_SLOT_MEMBER", "SIP_ADMITTED_SLOT_MEMBER"))
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!((!((state.slots).contains(p.position)) || ((state.slots)(p.position) == p.dueSlot)))) return Left(iMadzError("SIP_SLOT_REPLAY_CONFLICT", "SIP_SLOT_REPLAY_CONFLICT"))
      if (((state.slots).contains(p.position))) return Right(Nil)
      if ((state.scheduleSealed)) return Left(iMadzError("SIP_SCHEDULE_OPEN", "SIP_SCHEDULE_OPEN"))
      if (!(((p.position == state.scheduleCount) && (p.position < 9223372036854775807L)))) return Left(iMadzError("SIP_SLOT_POSITION", "SIP_SLOT_POSITION"))
      if (!(((p.dueSlot > state.lastDueSlot) && (p.dueSlot >= state.latestEffectiveSlot)))) return Left(iMadzError("SIP_SLOT_ORDER", "SIP_SLOT_ORDER"))
      Right(List(SipDueSlotAppended(p.position, p.dueSlot)))
    }
  }
  final class SealSipScheduleRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, SealSipScheduleParams] {
    override def apply(state: State, p: SealSipScheduleParams): Either[iMadzError, List[Event]] = {
      if (!((state.createIntentDueSlots).forall((state.intentAppendedDueSlots).contains))) return Left(iMadzError("SIP_ADMITTED_SCHEDULE_COVERED", "SIP_ADMITTED_SCHEDULE_COVERED"))
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if ((state.scheduleSealed)) return Right(Nil)
      if (!((state.scheduleCount > 0L))) return Left(iMadzError("SIP_FINITE_SCHEDULE", "SIP_FINITE_SCHEDULE"))
      Right(List(SipScheduleSealed(true)))
    }
  }
  final class ReviseSipPlanRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, ReviseSipPlanParams] {
    override def apply(state: State, p: ReviseSipPlanParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!((!((state.revisions).contains((p.config).revision)) || ((state.revisions)((p.config).revision) == p.config)))) return Left(iMadzError("SIP_REVISION_REPLAY_CONFLICT", "SIP_REVISION_REPLAY_CONFLICT"))
      if (((state.revisions).contains((p.config).revision))) return Right(Nil)
      if (!((((p.config).revision).value).nonEmpty)) return Left(iMadzError("SIP_REVISION_ID", "SIP_REVISION_ID"))
      if (!(((p.config).effectiveSlot >= 0L))) return Left(iMadzError("SIP_EFFECTIVE_SLOT", "SIP_EFFECTIVE_SLOT"))
      if (!((((((p.config).investorAccountId).value).nonEmpty && (((p.config).fundCollectionAccountId).value).nonEmpty) && ((p.config).investorAccountId != (p.config).fundCollectionAccountId)))) return Left(iMadzError("SIP_CONFIG_ACCOUNTS", "SIP_CONFIG_ACCOUNTS"))
      if (!(((p.config).fundCode).nonEmpty)) return Left(iMadzError("SIP_CONFIG_FUND", "SIP_CONFIG_FUND"))
      if (!(((((p.config).amount).currency == "CNY") && (((p.config).amount).amount > BigDecimal("0.00"))))) return Left(iMadzError("SIP_CONFIG_AMOUNT", "SIP_CONFIG_AMOUNT"))
      if (!((((p.config).effectiveSlot > state.currentTick) && ((p.config).effectiveSlot > state.latestEffectiveSlot)))) return Left(iMadzError("SIP_REVISION_FUTURE", "SIP_REVISION_FUTURE"))
      Right(List(SipPlanRevised(p.config, state.latestRevision)))
    }
  }
  final class AdvanceSipClockRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, AdvanceSipClockParams] {
    override def apply(state: State, p: AdvanceSipClockParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!(state.scheduleSealed)) return Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      if (!(((p.tick >= state.currentTick) && (p.tick >= 0L)))) return Left(iMadzError("SIP_CLOCK_MONOTONE", "SIP_CLOCK_MONOTONE"))
      if (!((p.tick != state.currentTick))) return Right(Nil)
      Right(List(SipClockAdvanced(p.tick)))
    }
  }
  final class PauseSipPlanRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, PauseSipPlanParams] {
    override def apply(state: State, p: PauseSipPlanParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!(state.scheduleSealed)) return Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      if (!((!(state.paused) || (p.tick == state.pauseTick)))) return Left(iMadzError("SIP_PAUSE_REPLAY_CONFLICT", "SIP_PAUSE_REPLAY_CONFLICT"))
      if ((state.paused)) return Right(Nil)
      if (!(((p.tick == state.currentTick) && (p.tick >= 0L)))) return Left(iMadzError("SIP_PAUSE_CLOCK", "SIP_PAUSE_CLOCK"))
      if (((state.pauseIntervals).contains(p.tick))) return Left(iMadzError("SIP_PAUSE_INTERVAL_ONCE", "SIP_PAUSE_INTERVAL_ONCE"))
      Right(List(SipPlanPaused(p.tick)))
    }
  }
  final class ResumeSipPlanRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, ResumeSipPlanParams] {
    override def apply(state: State, p: ResumeSipPlanParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!(state.scheduleSealed)) return Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      if (!((p.tick == state.currentTick))) return Left(iMadzError("SIP_RESUME_CLOCK", "SIP_RESUME_CLOCK"))
      if (!(state.paused)) return Right(Nil)
      if (!(((state.observedCount == state.scheduleCount) || ((state.slots).contains(state.observedCount) && ((state.slots)(state.observedCount) > state.currentTick))))) return Left(iMadzError("SIP_RESUME_CLASSIFIED", "SIP_RESUME_CLASSIFIED"))
      Right(List(SipPlanResumed(p.tick, state.pauseTick)))
    }
  }
  final class ObserveSipDueSlotRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, ObserveSipDueSlotParams] {
    override def apply(state: State, p: ObserveSipDueSlotParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!(state.scheduleSealed)) return Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      if (!((state.slots).contains(p.position))) return Left(iMadzError("SIP_SLOT_DECLARED", "SIP_SLOT_DECLARED"))
      if (!(((state.slots)(p.position) == p.dueSlot))) return Left(iMadzError("SIP_SLOT_MATCH", "SIP_SLOT_MATCH"))
      if (!((!((state.slotDisposition).contains(p.dueSlot)) || ((state.slotDisposition)(p.dueSlot) == "backlog")))) return Left(iMadzError("SIP_OBSERVATION_CONFLICT", "SIP_OBSERVATION_CONFLICT"))
      if (((state.slotDisposition).contains(p.dueSlot))) return Right(Nil)
      if (!((p.position == state.observedCount))) return Left(iMadzError("SIP_OBSERVATION_ORDER", "SIP_OBSERVATION_ORDER"))
      if (!((p.dueSlot <= state.currentTick))) return Left(iMadzError("SIP_SLOT_DUE", "SIP_SLOT_DUE"))
      if (!((!(state.paused) || (p.dueSlot < state.pauseTick)))) return Left(iMadzError("SIP_PAUSE_CLASSIFICATION", "SIP_PAUSE_CLASSIFICATION"))
      Right(List(SipDueSlotObserved(p.position, p.dueSlot, "backlog")))
    }
  }
  final class SkipPausedSipDueSlotRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, SkipPausedSipDueSlotParams] {
    override def apply(state: State, p: SkipPausedSipDueSlotParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!(state.scheduleSealed)) return Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      if (!((state.slots).contains(p.position))) return Left(iMadzError("SIP_SLOT_DECLARED", "SIP_SLOT_DECLARED"))
      if (!(((state.slots)(p.position) == p.dueSlot))) return Left(iMadzError("SIP_SLOT_MATCH", "SIP_SLOT_MATCH"))
      if (!((!((state.slotDisposition).contains(p.dueSlot)) || ((state.slotDisposition)(p.dueSlot) == "skipped")))) return Left(iMadzError("SIP_OBSERVATION_CONFLICT", "SIP_OBSERVATION_CONFLICT"))
      if (((state.slotDisposition).contains(p.dueSlot))) return Right(Nil)
      if (!((p.position == state.observedCount))) return Left(iMadzError("SIP_OBSERVATION_ORDER", "SIP_OBSERVATION_ORDER"))
      if (!((p.dueSlot <= state.currentTick))) return Left(iMadzError("SIP_SLOT_DUE", "SIP_SLOT_DUE"))
      if (!((state.paused && (p.dueSlot >= state.pauseTick)))) return Left(iMadzError("SIP_PAUSE_CLASSIFICATION", "SIP_PAUSE_CLASSIFICATION"))
      Right(List(SipPausedDueSlotSkipped(p.position, p.dueSlot, "skipped")))
    }
  }
  final class AdvanceSkippedSipSlotRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, AdvanceSkippedSipSlotParams] {
    override def apply(state: State, p: AdvanceSkippedSipSlotParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!(state.scheduleSealed)) return Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      if (!((state.slots).contains(p.position))) return Left(iMadzError("SIP_SLOT_DECLARED", "SIP_SLOT_DECLARED"))
      if (!(((state.slots)(p.position) == p.dueSlot))) return Left(iMadzError("SIP_SLOT_MATCH", "SIP_SLOT_MATCH"))
      if (!(((state.slotDisposition).get(p.dueSlot)).contains("skipped"))) return Left(iMadzError("SIP_SKIP_RECORDED", "SIP_SKIP_RECORDED"))
      if (!((p.position >= state.startCount))) return Right(Nil)
      if (!((p.position == state.startCount))) return Left(iMadzError("SIP_SKIP_CURSOR_ORDER", "SIP_SKIP_CURSOR_ORDER"))
      Right(List(SipSkippedSlotAdvanced(p.position, p.dueSlot)))
    }
  }
  final class TriggerSipInstallmentRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, TriggerSipInstallmentParams] {
    override def apply(state: State, p: TriggerSipInstallmentParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!(state.scheduleSealed)) return Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      if (!((state.slots).contains(p.position))) return Left(iMadzError("SIP_SLOT_DECLARED", "SIP_SLOT_DECLARED"))
      if (!(((state.slots)(p.position) == p.dueSlot))) return Left(iMadzError("SIP_SLOT_MATCH", "SIP_SLOT_MATCH"))
      if (!((!((state.occurrences).contains(p.dueSlot)) || ((((state.occurrences)(p.dueSlot)).revision == p.revision) && (((state.occurrences)(p.dueSlot)).config == p.config))))) return Left(iMadzError("SIP_OCCURRENCE_REPLAY_CONFLICT", "SIP_OCCURRENCE_REPLAY_CONFLICT"))
      if (((state.occurrences).contains(p.dueSlot))) return Right(Nil)
      if ((state.paused)) return Left(iMadzError("SIP_ACTIVE_START", "SIP_ACTIVE_START"))
      if (!((p.position == state.startCount))) return Left(iMadzError("SIP_START_ORDER", "SIP_START_ORDER"))
      if (!(((state.slotDisposition).get(p.dueSlot)).contains("backlog"))) return Left(iMadzError("SIP_BACKLOG_REQUIRED", "SIP_BACKLOG_REQUIRED"))
      if (!((state.revisions).contains(p.revision))) return Left(iMadzError("SIP_REVISION_DECLARED", "SIP_REVISION_DECLARED"))
      if (!((((state.revisions)(p.revision) == p.config) && ((p.config).revision == p.revision)))) return Left(iMadzError("SIP_RETAINED_CONFIG", "SIP_RETAINED_CONFIG"))
      if (!(((p.dueSlot >= (p.config).effectiveSlot) && (!((state.revisionEnds).contains(p.revision)) || (p.dueSlot < (state.revisionEnds)(p.revision)))))) return Left(iMadzError("SIP_REVISION_INTERVAL", "SIP_REVISION_INTERVAL"))
      Right(List(SipInstallmentTriggered(p.position, hosts.stableSipOccurrence(state, p))))
    }
  }
  final class RecordSipInstallmentPendingRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentPendingParams] {
    override def apply(state: State, p: RecordSipInstallmentPendingParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Nil)
      if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("pending"))) return Right(Nil)
      Right(List(SipInstallmentPending(p.occurrence, "pending")))
    }
  }
  final class RecordSipInstallmentOutcomeUnknownRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentOutcomeUnknownParams] {
    override def apply(state: State, p: RecordSipInstallmentOutcomeUnknownParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Nil)
      if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("outcome-unknown"))) return Right(Nil)
      Right(List(SipInstallmentOutcomeUnknown(p.occurrence, "outcome-unknown")))
    }
  }
  final class RecordSipInstallmentRecoveryRequiredRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentRecoveryRequiredParams] {
    override def apply(state: State, p: RecordSipInstallmentRecoveryRequiredParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Nil)
      if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("recovery-required"))) return Right(Nil)
      Right(List(SipInstallmentRecoveryRequired(p.occurrence, "recovery-required")))
    }
  }
  final class RecordSipInstallmentRefundInProgressRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentRefundInProgressParams] {
    override def apply(state: State, p: RecordSipInstallmentRefundInProgressParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Nil)
      if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("refund-in-progress"))) return Right(Nil)
      Right(List(SipInstallmentRefundInProgress(p.occurrence, "refund-in-progress")))
    }
  }
  final class RecordSipInstallmentSucceededRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentSucceededParams] {
    override def apply(state: State, p: RecordSipInstallmentSucceededParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      if (!((p.evidence == "ta-confirmed"))) return Left(iMadzError("SIP_TERMINAL_EVIDENCE", "SIP_TERMINAL_EVIDENCE"))
      if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left(iMadzError("SIP_TERMINAL_RECEIPT", "SIP_TERMINAL_RECEIPT"))
      if (!((!((state.terminalReceiptBodies).contains(p.receiptId)) || ((state.terminalReceiptBodies)(p.receiptId) == p.receiptBody)))) return Left(iMadzError("SIP_TERMINAL_RECEIPT_CONFLICT", "SIP_TERMINAL_RECEIPT_CONFLICT"))
      if (!((!((state.firstTerminals).contains((p.occurrence).occurrenceId)) || ((state.firstTerminals)((p.occurrence).occurrenceId) == "succeeded")))) return Left(iMadzError("SIP_TERMINAL_CONFLICT", "SIP_TERMINAL_CONFLICT"))
      if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Nil)
      if (!((state.successTotal < 9223372036854775807L))) return Left(iMadzError("SIP_TOTAL_CAPACITY", "SIP_TOTAL_CAPACITY"))
      Right(List(SipInstallmentSucceeded(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "succeeded")))
    }
  }
  final class RecordSipInstallmentFailedRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentFailedParams] {
    override def apply(state: State, p: RecordSipInstallmentFailedParams): Either[iMadzError, List[Event]] = {
      if (!(state.initialized)) return Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      if (!((state.occurrences).contains((p.occurrence).dueSlot))) return Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) return Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      if (!((((p.evidence == "payment-rejected-before-effects") || (p.evidence == "payment-compensated")) || (p.evidence == "ta-rejected-refund-completed")))) return Left(iMadzError("SIP_TERMINAL_EVIDENCE", "SIP_TERMINAL_EVIDENCE"))
      if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) return Left(iMadzError("SIP_TERMINAL_RECEIPT", "SIP_TERMINAL_RECEIPT"))
      if (!((!((state.terminalReceiptBodies).contains(p.receiptId)) || ((state.terminalReceiptBodies)(p.receiptId) == p.receiptBody)))) return Left(iMadzError("SIP_TERMINAL_RECEIPT_CONFLICT", "SIP_TERMINAL_RECEIPT_CONFLICT"))
      if (!((!((state.firstTerminals).contains((p.occurrence).occurrenceId)) || ((state.firstTerminals)((p.occurrence).occurrenceId) == "failed")))) return Left(iMadzError("SIP_TERMINAL_CONFLICT", "SIP_TERMINAL_CONFLICT"))
      if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) return Right(Nil)
      if (!((state.failureTotal < 9223372036854775807L))) return Left(iMadzError("SIP_TOTAL_CAPACITY", "SIP_TOTAL_CAPACITY"))
      Right(List(SipInstallmentFailed(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "failed")))
    }
  }
  final class RecordSipCreateIntentRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipCreateIntentParams] {
    override def apply(state: State, p: RecordSipCreateIntentParams): Either[iMadzError, List[Event]] = {
      if (!((p.source).contains(p.intent))) return Left(iMadzError("SIP_INTENT_OPTION", "SIP_INTENT_OPTION"))
      if (!(((p.intent).planId == state.id))) return Left(iMadzError("SIP_INTENT_RESOURCE", "SIP_INTENT_RESOURCE"))
      if (!((((((((((p.intent).principalId).nonEmpty && ((p.intent).clientRequestId).nonEmpty) && ((p.intent).authorityVersion).nonEmpty) && ((p.intent).clientRequestId == ((p.intent).request).clientRequestId)) && (((p.intent).request).fundCode == ((p.intent).config).fundCode)) && (((p.intent).request).effectiveSlot == ((p.intent).config).effectiveSlot)) && ((((p.intent).request).amount).currency == (((p.intent).config).amount).currency)) && (((p.intent).request).dueSlots).nonEmpty))) return Left(iMadzError("SIP_INTENT_BODY", "SIP_INTENT_BODY"))
      if (!(((state.createIntent).isEmpty || (state.createIntent).contains(p.intent)))) return Left(iMadzError("SIP_INTENT_CONFLICT", "SIP_INTENT_CONFLICT"))
      if (!((!(state.initialized) || ((((p.intent).planId == state.id) && (state.revisions).contains(((p.intent).config).revision)) && ((state.revisions)(((p.intent).config).revision) == (p.intent).config))))) return Left(iMadzError("SIP_INTENT_EXISTING_CONFIG", "SIP_INTENT_EXISTING_CONFIG"))
      if (!((state.createIntent).isEmpty)) return Right(Nil)
      if (!(((!(state.initialized) && (state.scheduleCount == 0L)) && !(state.scheduleSealed)))) return Left(iMadzError("SIP_INTENT_BEFORE_CREATE", "SIP_INTENT_BEFORE_CREATE"))
      Right(List(SipCreateIntentRecorded(p.intent, p.source)))
    }
  }
}
