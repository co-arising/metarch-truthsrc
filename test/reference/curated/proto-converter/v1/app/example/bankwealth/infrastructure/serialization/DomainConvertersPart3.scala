package example.bankwealth.infrastructure.serialization

import example.bankwealth.domain._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.{proto => pb}
trait DomainConvertersPart3 { self: DomainConverters.type =>
  def encodeSipPlanStatePO(value: SipPlanState): pb.SipPlanStatePO = pb.SipPlanStatePO(
    id = Some(encodePlanIdPO(value.id)),
    initialized = value.initialized,
    scheduleSealed = value.scheduleSealed,
    scheduleCount = value.scheduleCount,
    lastDueSlot = value.lastDueSlot,
    slots = value.slots,
    currentTick = value.currentTick,
    observedCount = value.observedCount,
    startCount = value.startCount,
    paused = value.paused,
    pauseTick = value.pauseTick,
    pauseIntervals = value.pauseIntervals,
    revisions = value.revisions.map { case (k, v) => k.value -> encodeSipRevisionConfigPO(v) },
    revisionEnds = value.revisionEnds.map { case (k, v) => k.value -> v },
    latestRevision = Some(encodeRevisionIdPO(value.latestRevision)),
    latestEffectiveSlot = value.latestEffectiveSlot,
    slotDisposition = value.slotDisposition,
    occurrences = value.occurrences.map { case (k, v) => k -> encodeSipOccurrencePO(v) },
    occurrenceProgress = value.occurrenceProgress.map { case (k, v) => k.value -> v },
    firstTerminals = value.firstTerminals.map { case (k, v) => k.value -> v },
    terminalReceiptBodies = value.terminalReceiptBodies,
    successTotal = value.successTotal,
    failureTotal = value.failureTotal,
    createIntent = value.createIntent.map(encodeBankSipCreateIntentPO),
    sipCreateIntents = value.sipCreateIntents.map { case (k, v) => k -> encodeBankSipCreateIntentPO(v) },
    createIntentDueSlots = value.createIntentDueSlots,
    intentAppendedDueSlots = value.intentAppendedDueSlots
  )
  def decodeSipPlanStatePO(value: pb.SipPlanStatePO): SipPlanState = SipPlanState(
    id = decodePlanIdPO(req(value.id)),
    initialized = value.initialized,
    scheduleSealed = value.scheduleSealed,
    scheduleCount = value.scheduleCount,
    lastDueSlot = value.lastDueSlot,
    slots = value.slots,
    currentTick = value.currentTick,
    observedCount = value.observedCount,
    startCount = value.startCount,
    paused = value.paused,
    pauseTick = value.pauseTick,
    pauseIntervals = value.pauseIntervals,
    revisions = value.revisions.map { case (k, v) => RevisionId(k) -> decodeSipRevisionConfigPO(v) },
    revisionEnds = value.revisionEnds.map { case (k, v) => RevisionId(k) -> v },
    latestRevision = decodeRevisionIdPO(req(value.latestRevision)),
    latestEffectiveSlot = value.latestEffectiveSlot,
    slotDisposition = value.slotDisposition,
    occurrences = value.occurrences.map { case (k, v) => k -> decodeSipOccurrencePO(v) },
    occurrenceProgress = value.occurrenceProgress.map { case (k, v) => OccurrenceId(k) -> v },
    firstTerminals = value.firstTerminals.map { case (k, v) => OccurrenceId(k) -> v },
    terminalReceiptBodies = value.terminalReceiptBodies,
    successTotal = value.successTotal,
    failureTotal = value.failureTotal,
    createIntent = value.createIntent.map(decodeBankSipCreateIntentPO),
    sipCreateIntents = value.sipCreateIntents.map { case (k, v) => k -> decodeBankSipCreateIntentPO(v) },
    createIntentDueSlots = value.createIntentDueSlots.toVector,
    intentAppendedDueSlots = value.intentAppendedDueSlots
  )
  def encodeSipPlanCreatedPO(value: SipPlanProtocol.SipPlanCreated): pb.SipPlanCreatedPO = pb.SipPlanCreatedPO(planId = Some(encodePlanIdPO(value.planId)), config = Some(encodeSipRevisionConfigPO(value.config)))
  def decodeSipPlanCreatedPO(value: pb.SipPlanCreatedPO): SipPlanProtocol.SipPlanCreated = SipPlanProtocol.SipPlanCreated(planId = decodePlanIdPO(req(value.planId)), config = decodeSipRevisionConfigPO(req(value.config)))
  def encodeSipDueSlotAppendedPO(value: SipPlanProtocol.SipDueSlotAppended): pb.SipDueSlotAppendedPO = pb.SipDueSlotAppendedPO(position = value.position, dueSlot = value.dueSlot)
  def decodeSipDueSlotAppendedPO(value: pb.SipDueSlotAppendedPO): SipPlanProtocol.SipDueSlotAppended = SipPlanProtocol.SipDueSlotAppended(position = value.position, dueSlot = value.dueSlot)
  def encodeSipScheduleSealedPO(value: SipPlanProtocol.SipScheduleSealed): pb.SipScheduleSealedPO = pb.SipScheduleSealedPO(`sealed` = value.`sealed`)
  def decodeSipScheduleSealedPO(value: pb.SipScheduleSealedPO): SipPlanProtocol.SipScheduleSealed = SipPlanProtocol.SipScheduleSealed(`sealed` = value.`sealed`)
  def encodeSipPlanRevisedPO(value: SipPlanProtocol.SipPlanRevised): pb.SipPlanRevisedPO = pb.SipPlanRevisedPO(config = Some(encodeSipRevisionConfigPO(value.config)), previousRevision = Some(encodeRevisionIdPO(value.previousRevision)))
  def decodeSipPlanRevisedPO(value: pb.SipPlanRevisedPO): SipPlanProtocol.SipPlanRevised = SipPlanProtocol.SipPlanRevised(config = decodeSipRevisionConfigPO(req(value.config)), previousRevision = decodeRevisionIdPO(req(value.previousRevision)))
  def encodeSipClockAdvancedPO(value: SipPlanProtocol.SipClockAdvanced): pb.SipClockAdvancedPO = pb.SipClockAdvancedPO(tick = value.tick)
  def decodeSipClockAdvancedPO(value: pb.SipClockAdvancedPO): SipPlanProtocol.SipClockAdvanced = SipPlanProtocol.SipClockAdvanced(tick = value.tick)
  def encodeSipPlanPausedPO(value: SipPlanProtocol.SipPlanPaused): pb.SipPlanPausedPO = pb.SipPlanPausedPO(tick = value.tick)
  def decodeSipPlanPausedPO(value: pb.SipPlanPausedPO): SipPlanProtocol.SipPlanPaused = SipPlanProtocol.SipPlanPaused(tick = value.tick)
  def encodeSipPlanResumedPO(value: SipPlanProtocol.SipPlanResumed): pb.SipPlanResumedPO = pb.SipPlanResumedPO(tick = value.tick, pauseTick = value.pauseTick)
  def decodeSipPlanResumedPO(value: pb.SipPlanResumedPO): SipPlanProtocol.SipPlanResumed = SipPlanProtocol.SipPlanResumed(tick = value.tick, pauseTick = value.pauseTick)
  def encodeSipDueSlotObservedPO(value: SipPlanProtocol.SipDueSlotObserved): pb.SipDueSlotObservedPO = pb.SipDueSlotObservedPO(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def decodeSipDueSlotObservedPO(value: pb.SipDueSlotObservedPO): SipPlanProtocol.SipDueSlotObserved = SipPlanProtocol.SipDueSlotObserved(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def encodeSipPausedDueSlotSkippedPO(value: SipPlanProtocol.SipPausedDueSlotSkipped): pb.SipPausedDueSlotSkippedPO = pb.SipPausedDueSlotSkippedPO(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def decodeSipPausedDueSlotSkippedPO(value: pb.SipPausedDueSlotSkippedPO): SipPlanProtocol.SipPausedDueSlotSkipped = SipPlanProtocol.SipPausedDueSlotSkipped(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def encodeSipSkippedSlotAdvancedPO(value: SipPlanProtocol.SipSkippedSlotAdvanced): pb.SipSkippedSlotAdvancedPO = pb.SipSkippedSlotAdvancedPO(position = value.position, dueSlot = value.dueSlot)
  def decodeSipSkippedSlotAdvancedPO(value: pb.SipSkippedSlotAdvancedPO): SipPlanProtocol.SipSkippedSlotAdvanced = SipPlanProtocol.SipSkippedSlotAdvanced(position = value.position, dueSlot = value.dueSlot)
  def encodeSipInstallmentTriggeredPO(value: SipPlanProtocol.SipInstallmentTriggered): pb.SipInstallmentTriggeredPO = pb.SipInstallmentTriggeredPO(position = value.position, occurrence = Some(encodeSipOccurrencePO(value.occurrence)))
  def decodeSipInstallmentTriggeredPO(value: pb.SipInstallmentTriggeredPO): SipPlanProtocol.SipInstallmentTriggered = SipPlanProtocol.SipInstallmentTriggered(position = value.position, occurrence = decodeSipOccurrencePO(req(value.occurrence)))
  def encodeSipInstallmentPendingPO(value: SipPlanProtocol.SipInstallmentPending): pb.SipInstallmentPendingPO = pb.SipInstallmentPendingPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentPendingPO(value: pb.SipInstallmentPendingPO): SipPlanProtocol.SipInstallmentPending = SipPlanProtocol.SipInstallmentPending(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentOutcomeUnknownPO(value: SipPlanProtocol.SipInstallmentOutcomeUnknown): pb.SipInstallmentOutcomeUnknownPO = pb.SipInstallmentOutcomeUnknownPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentOutcomeUnknownPO(value: pb.SipInstallmentOutcomeUnknownPO): SipPlanProtocol.SipInstallmentOutcomeUnknown = SipPlanProtocol.SipInstallmentOutcomeUnknown(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentRecoveryRequiredPO(value: SipPlanProtocol.SipInstallmentRecoveryRequired): pb.SipInstallmentRecoveryRequiredPO = pb.SipInstallmentRecoveryRequiredPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentRecoveryRequiredPO(value: pb.SipInstallmentRecoveryRequiredPO): SipPlanProtocol.SipInstallmentRecoveryRequired = SipPlanProtocol.SipInstallmentRecoveryRequired(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentRefundInProgressPO(value: SipPlanProtocol.SipInstallmentRefundInProgress): pb.SipInstallmentRefundInProgressPO = pb.SipInstallmentRefundInProgressPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentRefundInProgressPO(value: pb.SipInstallmentRefundInProgressPO): SipPlanProtocol.SipInstallmentRefundInProgress = SipPlanProtocol.SipInstallmentRefundInProgress(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentSucceededPO(value: SipPlanProtocol.SipInstallmentSucceeded): pb.SipInstallmentSucceededPO = pb.SipInstallmentSucceededPO(
    occurrence = Some(encodeSipOccurrencePO(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def decodeSipInstallmentSucceededPO(value: pb.SipInstallmentSucceededPO): SipPlanProtocol.SipInstallmentSucceeded = SipPlanProtocol.SipInstallmentSucceeded(
    occurrence = decodeSipOccurrencePO(req(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def encodeSipInstallmentFailedPO(value: SipPlanProtocol.SipInstallmentFailed): pb.SipInstallmentFailedPO = pb.SipInstallmentFailedPO(
    occurrence = Some(encodeSipOccurrencePO(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def decodeSipInstallmentFailedPO(value: pb.SipInstallmentFailedPO): SipPlanProtocol.SipInstallmentFailed = SipPlanProtocol.SipInstallmentFailed(
    occurrence = decodeSipOccurrencePO(req(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def encodeSipCreateIntentRecordedPO(value: SipPlanProtocol.SipCreateIntentRecorded): pb.SipCreateIntentRecordedPO = pb.SipCreateIntentRecordedPO(intent = Some(encodeBankSipCreateIntentPO(value.intent)), source = value.source.map(encodeBankSipCreateIntentPO))
  def decodeSipCreateIntentRecordedPO(value: pb.SipCreateIntentRecordedPO): SipPlanProtocol.SipCreateIntentRecorded = SipPlanProtocol.SipCreateIntentRecorded(intent = decodeBankSipCreateIntentPO(req(value.intent)), source = value.source.map(decodeBankSipCreateIntentPO))
  def encodeSipPlanEventPO(value: SipPlanProtocol.Event): pb.SipPlanEventPO = value match {
    case e: SipPlanProtocol.SipPlanCreated => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanCreated(encodeSipPlanCreatedPO(e)))
    case e: SipPlanProtocol.SipDueSlotAppended => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipDueSlotAppended(encodeSipDueSlotAppendedPO(e)))
    case e: SipPlanProtocol.SipScheduleSealed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipScheduleSealed(encodeSipScheduleSealedPO(e)))
    case e: SipPlanProtocol.SipPlanRevised => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanRevised(encodeSipPlanRevisedPO(e)))
    case e: SipPlanProtocol.SipClockAdvanced => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipClockAdvanced(encodeSipClockAdvancedPO(e)))
    case e: SipPlanProtocol.SipPlanPaused => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanPaused(encodeSipPlanPausedPO(e)))
    case e: SipPlanProtocol.SipPlanResumed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanResumed(encodeSipPlanResumedPO(e)))
    case e: SipPlanProtocol.SipDueSlotObserved => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipDueSlotObserved(encodeSipDueSlotObservedPO(e)))
    case e: SipPlanProtocol.SipPausedDueSlotSkipped => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPausedDueSlotSkipped(encodeSipPausedDueSlotSkippedPO(e)))
    case e: SipPlanProtocol.SipSkippedSlotAdvanced => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipSkippedSlotAdvanced(encodeSipSkippedSlotAdvancedPO(e)))
    case e: SipPlanProtocol.SipInstallmentTriggered => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentTriggered(encodeSipInstallmentTriggeredPO(e)))
    case e: SipPlanProtocol.SipInstallmentPending => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentPending(encodeSipInstallmentPendingPO(e)))
    case e: SipPlanProtocol.SipInstallmentOutcomeUnknown => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentOutcomeUnknown(encodeSipInstallmentOutcomeUnknownPO(e)))
    case e: SipPlanProtocol.SipInstallmentRecoveryRequired => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentRecoveryRequired(encodeSipInstallmentRecoveryRequiredPO(e)))
    case e: SipPlanProtocol.SipInstallmentRefundInProgress => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentRefundInProgress(encodeSipInstallmentRefundInProgressPO(e)))
    case e: SipPlanProtocol.SipInstallmentSucceeded => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentSucceeded(encodeSipInstallmentSucceededPO(e)))
    case e: SipPlanProtocol.SipInstallmentFailed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentFailed(encodeSipInstallmentFailedPO(e)))
    case e: SipPlanProtocol.SipCreateIntentRecorded => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipCreateIntentRecorded(encodeSipCreateIntentRecordedPO(e)))
  }
  def decodeSipPlanEventPO(value: pb.SipPlanEventPO): SipPlanProtocol.Event = value.event match {
    case pb.SipPlanEventPO.Event.SipPlanCreated(e) => decodeSipPlanCreatedPO(e)
    case pb.SipPlanEventPO.Event.SipDueSlotAppended(e) => decodeSipDueSlotAppendedPO(e)
    case pb.SipPlanEventPO.Event.SipScheduleSealed(e) => decodeSipScheduleSealedPO(e)
    case pb.SipPlanEventPO.Event.SipPlanRevised(e) => decodeSipPlanRevisedPO(e)
    case pb.SipPlanEventPO.Event.SipClockAdvanced(e) => decodeSipClockAdvancedPO(e)
    case pb.SipPlanEventPO.Event.SipPlanPaused(e) => decodeSipPlanPausedPO(e)
    case pb.SipPlanEventPO.Event.SipPlanResumed(e) => decodeSipPlanResumedPO(e)
    case pb.SipPlanEventPO.Event.SipDueSlotObserved(e) => decodeSipDueSlotObservedPO(e)
    case pb.SipPlanEventPO.Event.SipPausedDueSlotSkipped(e) => decodeSipPausedDueSlotSkippedPO(e)
    case pb.SipPlanEventPO.Event.SipSkippedSlotAdvanced(e) => decodeSipSkippedSlotAdvancedPO(e)
    case pb.SipPlanEventPO.Event.SipInstallmentTriggered(e) => decodeSipInstallmentTriggeredPO(e)
    case pb.SipPlanEventPO.Event.SipInstallmentPending(e) => decodeSipInstallmentPendingPO(e)
    case pb.SipPlanEventPO.Event.SipInstallmentOutcomeUnknown(e) => decodeSipInstallmentOutcomeUnknownPO(e)
    case pb.SipPlanEventPO.Event.SipInstallmentRecoveryRequired(e) => decodeSipInstallmentRecoveryRequiredPO(e)
    case pb.SipPlanEventPO.Event.SipInstallmentRefundInProgress(e) => decodeSipInstallmentRefundInProgressPO(e)
    case pb.SipPlanEventPO.Event.SipInstallmentSucceeded(e) => decodeSipInstallmentSucceededPO(e)
    case pb.SipPlanEventPO.Event.SipInstallmentFailed(e) => decodeSipInstallmentFailedPO(e)
    case pb.SipPlanEventPO.Event.SipCreateIntentRecorded(e) => decodeSipCreateIntentRecordedPO(e)
    case pb.SipPlanEventPO.Event.Empty => throw new IllegalArgumentException("empty SipPlanEventPO event")
  }

}
