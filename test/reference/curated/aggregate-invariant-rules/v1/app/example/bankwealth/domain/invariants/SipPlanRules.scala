package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.SipPlanEntity._
import example.bankwealth.domain.invariants.params.SipPlanRuleParams._
import example.bankwealth.domain.services.SipPlanComputations
import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

object SipPlanRules {
  // @knowledge source:bank-v1#/aggregates/2/commands/0
  final class CreateSipPlanRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, CreateSipPlanParams] {
    override def apply(state: State, p: CreateSipPlanParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/0
      if (!(((state.createIntent).isEmpty || (((state.sipCreateIntents).contains("original") && (p.planId == ((state.sipCreateIntents)("original")).planId)) && (p.config == ((state.sipCreateIntents)("original")).config))))) Left(iMadzError("SIP_ADMITTED_CREATE_MATCH", "SIP_ADMITTED_CREATE_MATCH"))
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/1
      else if (!(((p.planId).value).nonEmpty)) Left(iMadzError("SIP_PLAN_ID", "SIP_PLAN_ID"))
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/2
      else if (!((!(state.initialized) || (((p.planId == state.id) && (state.revisions).contains((p.config).revision)) && ((state.revisions)((p.config).revision) == p.config))))) Left(iMadzError("SIP_CREATE_CONFLICT", "SIP_CREATE_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/3
      else if ((state.initialized)) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/4
      else if (!((((p.config).revision).value).nonEmpty)) Left(iMadzError("SIP_REVISION_ID", "SIP_REVISION_ID"))
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/5
      else if (!(((p.config).effectiveSlot >= 0L))) Left(iMadzError("SIP_EFFECTIVE_SLOT", "SIP_EFFECTIVE_SLOT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/6
      else if (!((((((p.config).investorAccountId).value).nonEmpty && (((p.config).fundCollectionAccountId).value).nonEmpty) && ((p.config).investorAccountId != (p.config).fundCollectionAccountId)))) Left(iMadzError("SIP_CONFIG_ACCOUNTS", "SIP_CONFIG_ACCOUNTS"))
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/7
      else if (!(((p.config).fundCode).nonEmpty)) Left(iMadzError("SIP_CONFIG_FUND", "SIP_CONFIG_FUND"))
      // @knowledge source:bank-v1#/aggregates/2/commands/0/guards/8
      else if (!(((((p.config).amount).currency == "CNY") && (((p.config).amount).amount > BigDecimal("0.00"))))) Left(iMadzError("SIP_CONFIG_AMOUNT", "SIP_CONFIG_AMOUNT"))
      else Right(List(SipPlanCreated(p.planId, p.config)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/1
  final class AppendSipDueSlotRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, AppendSipDueSlotParams] {
    override def apply(state: State, p: AppendSipDueSlotParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/1/guards/0
      if (!(((state.createIntent).isEmpty || (state.createIntentDueSlots).contains(p.dueSlot)))) Left(iMadzError("SIP_ADMITTED_SLOT_MEMBER", "SIP_ADMITTED_SLOT_MEMBER"))
      // @knowledge source:bank-v1#/aggregates/2/commands/1/guards/1
      else if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/1/guards/2
      else if (!((!((state.slots).contains(p.position)) || ((state.slots)(p.position) == p.dueSlot)))) Left(iMadzError("SIP_SLOT_REPLAY_CONFLICT", "SIP_SLOT_REPLAY_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/1/guards/3
      else if (((state.slots).contains(p.position))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/1/guards/4
      else if ((state.scheduleSealed)) Left(iMadzError("SIP_SCHEDULE_OPEN", "SIP_SCHEDULE_OPEN"))
      // @knowledge source:bank-v1#/aggregates/2/commands/1/guards/5
      else if (!(((p.position == state.scheduleCount) && (p.position < 9223372036854775807L)))) Left(iMadzError("SIP_SLOT_POSITION", "SIP_SLOT_POSITION"))
      // @knowledge source:bank-v1#/aggregates/2/commands/1/guards/6
      else if (!(((p.dueSlot > state.lastDueSlot) && (p.dueSlot >= state.latestEffectiveSlot)))) Left(iMadzError("SIP_SLOT_ORDER", "SIP_SLOT_ORDER"))
      else Right(List(SipDueSlotAppended(p.position, p.dueSlot)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/2
  final class SealSipScheduleRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, SealSipScheduleParams] {
    override def apply(state: State, p: SealSipScheduleParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/2/guards/0
      if (!((state.createIntentDueSlots).forall((state.intentAppendedDueSlots).contains))) Left(iMadzError("SIP_ADMITTED_SCHEDULE_COVERED", "SIP_ADMITTED_SCHEDULE_COVERED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/2/guards/1
      else if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/2/guards/2
      else if ((state.scheduleSealed)) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/2/guards/3
      else if (!((state.scheduleCount > 0L))) Left(iMadzError("SIP_FINITE_SCHEDULE", "SIP_FINITE_SCHEDULE"))
      else Right(List(SipScheduleSealed(true)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/3
  final class ReviseSipPlanRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, ReviseSipPlanParams] {
    override def apply(state: State, p: ReviseSipPlanParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/1
      else if (!((!((state.revisions).contains((p.config).revision)) || ((state.revisions)((p.config).revision) == p.config)))) Left(iMadzError("SIP_REVISION_REPLAY_CONFLICT", "SIP_REVISION_REPLAY_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/2
      else if (((state.revisions).contains((p.config).revision))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/3
      else if (!((((p.config).revision).value).nonEmpty)) Left(iMadzError("SIP_REVISION_ID", "SIP_REVISION_ID"))
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/4
      else if (!(((p.config).effectiveSlot >= 0L))) Left(iMadzError("SIP_EFFECTIVE_SLOT", "SIP_EFFECTIVE_SLOT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/5
      else if (!((((((p.config).investorAccountId).value).nonEmpty && (((p.config).fundCollectionAccountId).value).nonEmpty) && ((p.config).investorAccountId != (p.config).fundCollectionAccountId)))) Left(iMadzError("SIP_CONFIG_ACCOUNTS", "SIP_CONFIG_ACCOUNTS"))
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/6
      else if (!(((p.config).fundCode).nonEmpty)) Left(iMadzError("SIP_CONFIG_FUND", "SIP_CONFIG_FUND"))
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/7
      else if (!(((((p.config).amount).currency == "CNY") && (((p.config).amount).amount > BigDecimal("0.00"))))) Left(iMadzError("SIP_CONFIG_AMOUNT", "SIP_CONFIG_AMOUNT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/3/guards/8
      else if (!((((p.config).effectiveSlot > state.currentTick) && ((p.config).effectiveSlot > state.latestEffectiveSlot)))) Left(iMadzError("SIP_REVISION_FUTURE", "SIP_REVISION_FUTURE"))
      else Right(List(SipPlanRevised(p.config, state.latestRevision)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/4
  final class AdvanceSipClockRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, AdvanceSipClockParams] {
    override def apply(state: State, p: AdvanceSipClockParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/4/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/4/guards/1
      else if (!(state.scheduleSealed)) Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/4/guards/2
      else if (!(((p.tick >= state.currentTick) && (p.tick >= 0L)))) Left(iMadzError("SIP_CLOCK_MONOTONE", "SIP_CLOCK_MONOTONE"))
      // @knowledge source:bank-v1#/aggregates/2/commands/4/guards/3
      else if (!((p.tick != state.currentTick))) Right(Nil)
      else Right(List(SipClockAdvanced(p.tick)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/5
  final class PauseSipPlanRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, PauseSipPlanParams] {
    override def apply(state: State, p: PauseSipPlanParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/5/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/5/guards/1
      else if (!(state.scheduleSealed)) Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/5/guards/2
      else if (!((!(state.paused) || (p.tick == state.pauseTick)))) Left(iMadzError("SIP_PAUSE_REPLAY_CONFLICT", "SIP_PAUSE_REPLAY_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/5/guards/3
      else if ((state.paused)) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/5/guards/4
      else if (!(((p.tick == state.currentTick) && (p.tick >= 0L)))) Left(iMadzError("SIP_PAUSE_CLOCK", "SIP_PAUSE_CLOCK"))
      // @knowledge source:bank-v1#/aggregates/2/commands/5/guards/5
      else if (((state.pauseIntervals).contains(p.tick))) Left(iMadzError("SIP_PAUSE_INTERVAL_ONCE", "SIP_PAUSE_INTERVAL_ONCE"))
      else Right(List(SipPlanPaused(p.tick)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/6
  final class ResumeSipPlanRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, ResumeSipPlanParams] {
    override def apply(state: State, p: ResumeSipPlanParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/6/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/6/guards/1
      else if (!(state.scheduleSealed)) Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/6/guards/2
      else if (!((p.tick == state.currentTick))) Left(iMadzError("SIP_RESUME_CLOCK", "SIP_RESUME_CLOCK"))
      // @knowledge source:bank-v1#/aggregates/2/commands/6/guards/3
      else if (!(state.paused)) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/6/guards/4
      else if (!(((state.observedCount == state.scheduleCount) || ((state.slots).contains(state.observedCount) && ((state.slots)(state.observedCount) > state.currentTick))))) Left(iMadzError("SIP_RESUME_CLASSIFIED", "SIP_RESUME_CLASSIFIED"))
      else Right(List(SipPlanResumed(p.tick, state.pauseTick)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/7
  final class ObserveSipDueSlotRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, ObserveSipDueSlotParams] {
    override def apply(state: State, p: ObserveSipDueSlotParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/1
      else if (!(state.scheduleSealed)) Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/2
      else if (!((state.slots).contains(p.position))) Left(iMadzError("SIP_SLOT_DECLARED", "SIP_SLOT_DECLARED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/3
      else if (!(((state.slots)(p.position) == p.dueSlot))) Left(iMadzError("SIP_SLOT_MATCH", "SIP_SLOT_MATCH"))
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/4
      else if (!((!((state.slotDisposition).contains(p.dueSlot)) || ((state.slotDisposition)(p.dueSlot) == "backlog")))) Left(iMadzError("SIP_OBSERVATION_CONFLICT", "SIP_OBSERVATION_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/5
      else if (((state.slotDisposition).contains(p.dueSlot))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/6
      else if (!((p.position == state.observedCount))) Left(iMadzError("SIP_OBSERVATION_ORDER", "SIP_OBSERVATION_ORDER"))
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/7
      else if (!((p.dueSlot <= state.currentTick))) Left(iMadzError("SIP_SLOT_DUE", "SIP_SLOT_DUE"))
      // @knowledge source:bank-v1#/aggregates/2/commands/7/guards/8
      else if (!((!(state.paused) || (p.dueSlot < state.pauseTick)))) Left(iMadzError("SIP_PAUSE_CLASSIFICATION", "SIP_PAUSE_CLASSIFICATION"))
      else Right(List(SipDueSlotObserved(p.position, p.dueSlot, "backlog")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/8
  final class SkipPausedSipDueSlotRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, SkipPausedSipDueSlotParams] {
    override def apply(state: State, p: SkipPausedSipDueSlotParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/1
      else if (!(state.scheduleSealed)) Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/2
      else if (!((state.slots).contains(p.position))) Left(iMadzError("SIP_SLOT_DECLARED", "SIP_SLOT_DECLARED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/3
      else if (!(((state.slots)(p.position) == p.dueSlot))) Left(iMadzError("SIP_SLOT_MATCH", "SIP_SLOT_MATCH"))
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/4
      else if (!((!((state.slotDisposition).contains(p.dueSlot)) || ((state.slotDisposition)(p.dueSlot) == "skipped")))) Left(iMadzError("SIP_OBSERVATION_CONFLICT", "SIP_OBSERVATION_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/5
      else if (((state.slotDisposition).contains(p.dueSlot))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/6
      else if (!((p.position == state.observedCount))) Left(iMadzError("SIP_OBSERVATION_ORDER", "SIP_OBSERVATION_ORDER"))
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/7
      else if (!((p.dueSlot <= state.currentTick))) Left(iMadzError("SIP_SLOT_DUE", "SIP_SLOT_DUE"))
      // @knowledge source:bank-v1#/aggregates/2/commands/8/guards/8
      else if (!((state.paused && (p.dueSlot >= state.pauseTick)))) Left(iMadzError("SIP_PAUSE_CLASSIFICATION", "SIP_PAUSE_CLASSIFICATION"))
      else Right(List(SipPausedDueSlotSkipped(p.position, p.dueSlot, "skipped")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/9
  final class AdvanceSkippedSipSlotRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, AdvanceSkippedSipSlotParams] {
    override def apply(state: State, p: AdvanceSkippedSipSlotParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/9/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/9/guards/1
      else if (!(state.scheduleSealed)) Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/9/guards/2
      else if (!((state.slots).contains(p.position))) Left(iMadzError("SIP_SLOT_DECLARED", "SIP_SLOT_DECLARED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/9/guards/3
      else if (!(((state.slots)(p.position) == p.dueSlot))) Left(iMadzError("SIP_SLOT_MATCH", "SIP_SLOT_MATCH"))
      // @knowledge source:bank-v1#/aggregates/2/commands/9/guards/4
      else if (!(((state.slotDisposition).get(p.dueSlot)).contains("skipped"))) Left(iMadzError("SIP_SKIP_RECORDED", "SIP_SKIP_RECORDED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/9/guards/5
      else if (!((p.position >= state.startCount))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/9/guards/6
      else if (!((p.position == state.startCount))) Left(iMadzError("SIP_SKIP_CURSOR_ORDER", "SIP_SKIP_CURSOR_ORDER"))
      else Right(List(SipSkippedSlotAdvanced(p.position, p.dueSlot)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/10
  final class TriggerSipInstallmentRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, TriggerSipInstallmentParams] {
    override def apply(state: State, p: TriggerSipInstallmentParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/1
      else if (!(state.scheduleSealed)) Left(iMadzError("SIP_SCHEDULE_SEALED", "SIP_SCHEDULE_SEALED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/2
      else if (!((state.slots).contains(p.position))) Left(iMadzError("SIP_SLOT_DECLARED", "SIP_SLOT_DECLARED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/3
      else if (!(((state.slots)(p.position) == p.dueSlot))) Left(iMadzError("SIP_SLOT_MATCH", "SIP_SLOT_MATCH"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/4
      else if (!((!((state.occurrences).contains(p.dueSlot)) || ((((state.occurrences)(p.dueSlot)).revision == p.revision) && (((state.occurrences)(p.dueSlot)).config == p.config))))) Left(iMadzError("SIP_OCCURRENCE_REPLAY_CONFLICT", "SIP_OCCURRENCE_REPLAY_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/5
      else if (((state.occurrences).contains(p.dueSlot))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/6
      else if ((state.paused)) Left(iMadzError("SIP_ACTIVE_START", "SIP_ACTIVE_START"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/7
      else if (!((p.position == state.startCount))) Left(iMadzError("SIP_START_ORDER", "SIP_START_ORDER"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/8
      else if (!(((state.slotDisposition).get(p.dueSlot)).contains("backlog"))) Left(iMadzError("SIP_BACKLOG_REQUIRED", "SIP_BACKLOG_REQUIRED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/9
      else if (!((state.revisions).contains(p.revision))) Left(iMadzError("SIP_REVISION_DECLARED", "SIP_REVISION_DECLARED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/10
      else if (!((((state.revisions)(p.revision) == p.config) && ((p.config).revision == p.revision)))) Left(iMadzError("SIP_RETAINED_CONFIG", "SIP_RETAINED_CONFIG"))
      // @knowledge source:bank-v1#/aggregates/2/commands/10/guards/11
      else if (!(((p.dueSlot >= (p.config).effectiveSlot) && (!((state.revisionEnds).contains(p.revision)) || (p.dueSlot < (state.revisionEnds)(p.revision)))))) Left(iMadzError("SIP_REVISION_INTERVAL", "SIP_REVISION_INTERVAL"))
      else for {
        stableSipOccurrence <- hosts.stableSipOccurrence(state, p)
      } yield List(SipInstallmentTriggered(p.position, stableSipOccurrence))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/11
  final class RecordSipInstallmentPendingRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentPendingParams] {
    override def apply(state: State, p: RecordSipInstallmentPendingParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/11/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/11/guards/1
      else if (!((state.occurrences).contains((p.occurrence).dueSlot))) Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      // @knowledge source:bank-v1#/aggregates/2/commands/11/guards/2
      else if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/2/commands/11/guards/3
      else if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/11/guards/4
      else if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("pending"))) Right(Nil)
      else Right(List(SipInstallmentPending(p.occurrence, "pending")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/12
  final class RecordSipInstallmentOutcomeUnknownRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentOutcomeUnknownParams] {
    override def apply(state: State, p: RecordSipInstallmentOutcomeUnknownParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/12/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/12/guards/1
      else if (!((state.occurrences).contains((p.occurrence).dueSlot))) Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      // @knowledge source:bank-v1#/aggregates/2/commands/12/guards/2
      else if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/2/commands/12/guards/3
      else if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/12/guards/4
      else if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("outcome-unknown"))) Right(Nil)
      else Right(List(SipInstallmentOutcomeUnknown(p.occurrence, "outcome-unknown")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/13
  final class RecordSipInstallmentRecoveryRequiredRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentRecoveryRequiredParams] {
    override def apply(state: State, p: RecordSipInstallmentRecoveryRequiredParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/13/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/13/guards/1
      else if (!((state.occurrences).contains((p.occurrence).dueSlot))) Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      // @knowledge source:bank-v1#/aggregates/2/commands/13/guards/2
      else if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/2/commands/13/guards/3
      else if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/13/guards/4
      else if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("recovery-required"))) Right(Nil)
      else Right(List(SipInstallmentRecoveryRequired(p.occurrence, "recovery-required")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/14
  final class RecordSipInstallmentRefundInProgressRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentRefundInProgressParams] {
    override def apply(state: State, p: RecordSipInstallmentRefundInProgressParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/14/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/14/guards/1
      else if (!((state.occurrences).contains((p.occurrence).dueSlot))) Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      // @knowledge source:bank-v1#/aggregates/2/commands/14/guards/2
      else if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/2/commands/14/guards/3
      else if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/14/guards/4
      else if ((((state.occurrenceProgress).get((p.occurrence).occurrenceId)).contains("refund-in-progress"))) Right(Nil)
      else Right(List(SipInstallmentRefundInProgress(p.occurrence, "refund-in-progress")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/15
  final class RecordSipInstallmentSucceededRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentSucceededParams] {
    override def apply(state: State, p: RecordSipInstallmentSucceededParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/1
      else if (!((state.occurrences).contains((p.occurrence).dueSlot))) Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/2
      else if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/3
      else if (!((p.evidence == "ta-confirmed"))) Left(iMadzError("SIP_TERMINAL_EVIDENCE", "SIP_TERMINAL_EVIDENCE"))
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/4
      else if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) Left(iMadzError("SIP_TERMINAL_RECEIPT", "SIP_TERMINAL_RECEIPT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/5
      else if (!((!((state.terminalReceiptBodies).contains(p.receiptId)) || ((state.terminalReceiptBodies)(p.receiptId) == p.receiptBody)))) Left(iMadzError("SIP_TERMINAL_RECEIPT_CONFLICT", "SIP_TERMINAL_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/6
      else if (!((!((state.firstTerminals).contains((p.occurrence).occurrenceId)) || ((state.firstTerminals)((p.occurrence).occurrenceId) == "succeeded")))) Left(iMadzError("SIP_TERMINAL_CONFLICT", "SIP_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/7
      else if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/15/guards/8
      else if (!((state.successTotal < 9223372036854775807L))) Left(iMadzError("SIP_TOTAL_CAPACITY", "SIP_TOTAL_CAPACITY"))
      else Right(List(SipInstallmentSucceeded(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "succeeded")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/16
  final class RecordSipInstallmentFailedRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipInstallmentFailedParams] {
    override def apply(state: State, p: RecordSipInstallmentFailedParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/0
      if (!(state.initialized)) Left(iMadzError("SIP_INITIALIZED", "SIP_INITIALIZED"))
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/1
      else if (!((state.occurrences).contains((p.occurrence).dueSlot))) Left(iMadzError("SIP_OCCURRENCE_KNOWN", "SIP_OCCURRENCE_KNOWN"))
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/2
      else if (!((((state.occurrences)((p.occurrence).dueSlot) == p.occurrence) && ((p.occurrence).planId == state.id)))) Left(iMadzError("SIP_ORIGINAL_ASSOCIATION", "SIP_ORIGINAL_ASSOCIATION"))
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/3
      else if (!((((p.evidence == "payment-rejected-before-effects") || (p.evidence == "payment-compensated")) || (p.evidence == "ta-rejected-refund-completed")))) Left(iMadzError("SIP_TERMINAL_EVIDENCE", "SIP_TERMINAL_EVIDENCE"))
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/4
      else if (!(((p.receiptId).nonEmpty && (p.receiptBody).nonEmpty))) Left(iMadzError("SIP_TERMINAL_RECEIPT", "SIP_TERMINAL_RECEIPT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/5
      else if (!((!((state.terminalReceiptBodies).contains(p.receiptId)) || ((state.terminalReceiptBodies)(p.receiptId) == p.receiptBody)))) Left(iMadzError("SIP_TERMINAL_RECEIPT_CONFLICT", "SIP_TERMINAL_RECEIPT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/6
      else if (!((!((state.firstTerminals).contains((p.occurrence).occurrenceId)) || ((state.firstTerminals)((p.occurrence).occurrenceId) == "failed")))) Left(iMadzError("SIP_TERMINAL_CONFLICT", "SIP_TERMINAL_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/7
      else if (((state.firstTerminals).contains((p.occurrence).occurrenceId))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/16/guards/8
      else if (!((state.failureTotal < 9223372036854775807L))) Left(iMadzError("SIP_TOTAL_CAPACITY", "SIP_TOTAL_CAPACITY"))
      else Right(List(SipInstallmentFailed(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "failed")))
    }
  }
  // @knowledge source:bank-v1#/aggregates/2/commands/17
  final class RecordSipCreateIntentRule(hosts: SipPlanComputations)
      extends InvariantRule[Event, State, RecordSipCreateIntentParams] {
    override def apply(state: State, p: RecordSipCreateIntentParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/2/commands/17/guards/0
      if (!((p.source).contains(p.intent))) Left(iMadzError("SIP_INTENT_OPTION", "SIP_INTENT_OPTION"))
      // @knowledge source:bank-v1#/aggregates/2/commands/17/guards/1
      else if (!(((p.intent).planId == state.id))) Left(iMadzError("SIP_INTENT_RESOURCE", "SIP_INTENT_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/2/commands/17/guards/2
      else if (!((((((((((p.intent).principalId).nonEmpty && ((p.intent).clientRequestId).nonEmpty) && ((p.intent).authorityVersion).nonEmpty) && ((p.intent).clientRequestId == ((p.intent).request).clientRequestId)) && (((p.intent).request).fundCode == ((p.intent).config).fundCode)) && (((p.intent).request).effectiveSlot == ((p.intent).config).effectiveSlot)) && ((((p.intent).request).amount).currency == (((p.intent).config).amount).currency)) && (((p.intent).request).dueSlots).nonEmpty))) Left(iMadzError("SIP_INTENT_BODY", "SIP_INTENT_BODY"))
      // @knowledge source:bank-v1#/aggregates/2/commands/17/guards/3
      else if (!(((state.createIntent).isEmpty || (state.createIntent).contains(p.intent)))) Left(iMadzError("SIP_INTENT_CONFLICT", "SIP_INTENT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/2/commands/17/guards/4
      else if (!((!(state.initialized) || ((((p.intent).planId == state.id) && (state.revisions).contains(((p.intent).config).revision)) && ((state.revisions)(((p.intent).config).revision) == (p.intent).config))))) Left(iMadzError("SIP_INTENT_EXISTING_CONFIG", "SIP_INTENT_EXISTING_CONFIG"))
      // @knowledge source:bank-v1#/aggregates/2/commands/17/guards/5
      else if (!((state.createIntent).isEmpty)) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/2/commands/17/guards/6
      else if (!(((!(state.initialized) && (state.scheduleCount == 0L)) && !(state.scheduleSealed)))) Left(iMadzError("SIP_INTENT_BEFORE_CREATE", "SIP_INTENT_BEFORE_CREATE"))
      else Right(List(SipCreateIntentRecorded(p.intent, p.source)))
    }
  }
}
