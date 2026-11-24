package example.bankwealth.domain.entities.behaviors

import example.bankwealth.domain.entities.SipPlanEntity._

object SipPlanEventHandler extends EventHandler {
  override def apply(state: State, input: Event): State = input match {
    case event: SipPlanCreated =>
      state.copy(
        id = event.planId,
        initialized = true,
        revisions = state.revisions.updated((event.config).revision, event.config),
        latestRevision = (event.config).revision,
        latestEffectiveSlot = (event.config).effectiveSlot
      )
    case event: SipDueSlotAppended =>
      state.copy(
        slots = state.slots.updated(event.position, event.dueSlot),
        scheduleCount = java.lang.Math.addExact(state.scheduleCount, 1L),
        lastDueSlot = event.dueSlot,
        intentAppendedDueSlots = state.intentAppendedDueSlots.updated(event.dueSlot, event.position)
      )
    case event: SipScheduleSealed =>
      state.copy(scheduleSealed = event.`sealed`)
    case event: SipPlanRevised =>
      state.copy(
        revisions = state.revisions.updated((event.config).revision, event.config),
        revisionEnds = state.revisionEnds.updated(event.previousRevision, (event.config).effectiveSlot),
        latestRevision = (event.config).revision,
        latestEffectiveSlot = (event.config).effectiveSlot
      )
    case event: SipClockAdvanced =>
      state.copy(currentTick = event.tick)
    case event: SipPlanPaused =>
      state.copy(
        paused = true,
        pauseTick = event.tick
      )
    case event: SipPlanResumed =>
      state.copy(
        paused = false,
        pauseIntervals = state.pauseIntervals.updated(event.pauseTick, event.tick)
      )
    case event: SipDueSlotObserved =>
      state.copy(
        slotDisposition = state.slotDisposition.updated(event.dueSlot, event.disposition),
        observedCount = java.lang.Math.addExact(state.observedCount, 1L)
      )
    case event: SipPausedDueSlotSkipped =>
      state.copy(
        slotDisposition = state.slotDisposition.updated(event.dueSlot, event.disposition),
        observedCount = java.lang.Math.addExact(state.observedCount, 1L)
      )
    case event: SipSkippedSlotAdvanced =>
      state.copy(startCount = java.lang.Math.addExact(state.startCount, 1L))
    case event: SipInstallmentTriggered =>
      state.copy(
        occurrences = state.occurrences.updated((event.occurrence).dueSlot, event.occurrence),
        occurrenceProgress = state.occurrenceProgress.updated((event.occurrence).occurrenceId, "pending"),
        startCount = java.lang.Math.addExact(state.startCount, 1L)
      )
    case event: SipInstallmentPending =>
      state.copy(occurrenceProgress = state.occurrenceProgress.updated((event.occurrence).occurrenceId, event.outcome))
    case event: SipInstallmentOutcomeUnknown =>
      state.copy(occurrenceProgress = state.occurrenceProgress.updated((event.occurrence).occurrenceId, event.outcome))
    case event: SipInstallmentRecoveryRequired =>
      state.copy(occurrenceProgress = state.occurrenceProgress.updated((event.occurrence).occurrenceId, event.outcome))
    case event: SipInstallmentRefundInProgress =>
      state.copy(occurrenceProgress = state.occurrenceProgress.updated((event.occurrence).occurrenceId, event.outcome))
    case event: SipInstallmentSucceeded =>
      state.copy(
        firstTerminals = state.firstTerminals.updated((event.occurrence).occurrenceId, event.outcome),
        occurrenceProgress = state.occurrenceProgress.updated((event.occurrence).occurrenceId, event.outcome),
        terminalReceiptBodies = state.terminalReceiptBodies.updated(event.receiptId, event.receiptBody),
        successTotal = java.lang.Math.addExact(state.successTotal, 1L)
      )
    case event: SipInstallmentFailed =>
      state.copy(
        firstTerminals = state.firstTerminals.updated((event.occurrence).occurrenceId, event.outcome),
        occurrenceProgress = state.occurrenceProgress.updated((event.occurrence).occurrenceId, event.outcome),
        terminalReceiptBodies = state.terminalReceiptBodies.updated(event.receiptId, event.receiptBody),
        failureTotal = java.lang.Math.addExact(state.failureTotal, 1L)
      )
    case event: SipCreateIntentRecorded =>
      state.copy(
        createIntent = event.source,
        sipCreateIntents = state.sipCreateIntents.updated("original", event.intent),
        createIntentDueSlots = ((event.intent).request).dueSlots
      )
  }
}
