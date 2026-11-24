package example.bankwealth.infrastructure.persistence.converters

import example.bankwealth.domain.entities._
import example.bankwealth.application.api._
import example.bankwealth.application.projection._
import example.bankwealth.application.saga._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.persistence._
import example.bankwealth.infrastructure.{proto => pb}
trait DomainConvertersPart3 { self: DomainConverters.type =>
  def encodeSipPlanStatePO(value: SipPlanEntity.State): pb.SipPlanStatePO = pb.SipPlanStatePO(
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
  def decodeSipPlanStatePO(value: pb.SipPlanStatePO): SipPlanEntity.State = SipPlanEntity.State(
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
  def encodeSipPlanCreatedPO(value: SipPlanEntity.SipPlanCreated): pb.SipPlanCreatedPO = pb.SipPlanCreatedPO(planId = Some(encodePlanIdPO(value.planId)), config = Some(encodeSipRevisionConfigPO(value.config)))
  def decodeSipPlanCreatedPO(value: pb.SipPlanCreatedPO): SipPlanEntity.SipPlanCreated = SipPlanEntity.SipPlanCreated(planId = decodePlanIdPO(req(value.planId)), config = decodeSipRevisionConfigPO(req(value.config)))
  def encodeSipDueSlotAppendedPO(value: SipPlanEntity.SipDueSlotAppended): pb.SipDueSlotAppendedPO = pb.SipDueSlotAppendedPO(position = value.position, dueSlot = value.dueSlot)
  def decodeSipDueSlotAppendedPO(value: pb.SipDueSlotAppendedPO): SipPlanEntity.SipDueSlotAppended = SipPlanEntity.SipDueSlotAppended(position = value.position, dueSlot = value.dueSlot)
  def encodeSipScheduleSealedPO(value: SipPlanEntity.SipScheduleSealed): pb.SipScheduleSealedPO = pb.SipScheduleSealedPO(`sealed` = value.`sealed`)
  def decodeSipScheduleSealedPO(value: pb.SipScheduleSealedPO): SipPlanEntity.SipScheduleSealed = SipPlanEntity.SipScheduleSealed(`sealed` = value.`sealed`)
  def encodeSipPlanRevisedPO(value: SipPlanEntity.SipPlanRevised): pb.SipPlanRevisedPO = pb.SipPlanRevisedPO(config = Some(encodeSipRevisionConfigPO(value.config)), previousRevision = Some(encodeRevisionIdPO(value.previousRevision)))
  def decodeSipPlanRevisedPO(value: pb.SipPlanRevisedPO): SipPlanEntity.SipPlanRevised = SipPlanEntity.SipPlanRevised(config = decodeSipRevisionConfigPO(req(value.config)), previousRevision = decodeRevisionIdPO(req(value.previousRevision)))
  def encodeSipClockAdvancedPO(value: SipPlanEntity.SipClockAdvanced): pb.SipClockAdvancedPO = pb.SipClockAdvancedPO(tick = value.tick)
  def decodeSipClockAdvancedPO(value: pb.SipClockAdvancedPO): SipPlanEntity.SipClockAdvanced = SipPlanEntity.SipClockAdvanced(tick = value.tick)
  def encodeSipPlanPausedPO(value: SipPlanEntity.SipPlanPaused): pb.SipPlanPausedPO = pb.SipPlanPausedPO(tick = value.tick)
  def decodeSipPlanPausedPO(value: pb.SipPlanPausedPO): SipPlanEntity.SipPlanPaused = SipPlanEntity.SipPlanPaused(tick = value.tick)
  def encodeSipPlanResumedPO(value: SipPlanEntity.SipPlanResumed): pb.SipPlanResumedPO = pb.SipPlanResumedPO(tick = value.tick, pauseTick = value.pauseTick)
  def decodeSipPlanResumedPO(value: pb.SipPlanResumedPO): SipPlanEntity.SipPlanResumed = SipPlanEntity.SipPlanResumed(tick = value.tick, pauseTick = value.pauseTick)
  def encodeSipDueSlotObservedPO(value: SipPlanEntity.SipDueSlotObserved): pb.SipDueSlotObservedPO = pb.SipDueSlotObservedPO(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def decodeSipDueSlotObservedPO(value: pb.SipDueSlotObservedPO): SipPlanEntity.SipDueSlotObserved = SipPlanEntity.SipDueSlotObserved(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def encodeSipPausedDueSlotSkippedPO(value: SipPlanEntity.SipPausedDueSlotSkipped): pb.SipPausedDueSlotSkippedPO = pb.SipPausedDueSlotSkippedPO(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def decodeSipPausedDueSlotSkippedPO(value: pb.SipPausedDueSlotSkippedPO): SipPlanEntity.SipPausedDueSlotSkipped = SipPlanEntity.SipPausedDueSlotSkipped(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def encodeSipSkippedSlotAdvancedPO(value: SipPlanEntity.SipSkippedSlotAdvanced): pb.SipSkippedSlotAdvancedPO = pb.SipSkippedSlotAdvancedPO(position = value.position, dueSlot = value.dueSlot)
  def decodeSipSkippedSlotAdvancedPO(value: pb.SipSkippedSlotAdvancedPO): SipPlanEntity.SipSkippedSlotAdvanced = SipPlanEntity.SipSkippedSlotAdvanced(position = value.position, dueSlot = value.dueSlot)
  def encodeSipInstallmentTriggeredPO(value: SipPlanEntity.SipInstallmentTriggered): pb.SipInstallmentTriggeredPO = pb.SipInstallmentTriggeredPO(position = value.position, occurrence = Some(encodeSipOccurrencePO(value.occurrence)))
  def decodeSipInstallmentTriggeredPO(value: pb.SipInstallmentTriggeredPO): SipPlanEntity.SipInstallmentTriggered = SipPlanEntity.SipInstallmentTriggered(position = value.position, occurrence = decodeSipOccurrencePO(req(value.occurrence)))
  def encodeSipInstallmentPendingPO(value: SipPlanEntity.SipInstallmentPending): pb.SipInstallmentPendingPO = pb.SipInstallmentPendingPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentPendingPO(value: pb.SipInstallmentPendingPO): SipPlanEntity.SipInstallmentPending = SipPlanEntity.SipInstallmentPending(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentOutcomeUnknownPO(value: SipPlanEntity.SipInstallmentOutcomeUnknown): pb.SipInstallmentOutcomeUnknownPO = pb.SipInstallmentOutcomeUnknownPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentOutcomeUnknownPO(value: pb.SipInstallmentOutcomeUnknownPO): SipPlanEntity.SipInstallmentOutcomeUnknown = SipPlanEntity.SipInstallmentOutcomeUnknown(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentRecoveryRequiredPO(value: SipPlanEntity.SipInstallmentRecoveryRequired): pb.SipInstallmentRecoveryRequiredPO = pb.SipInstallmentRecoveryRequiredPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentRecoveryRequiredPO(value: pb.SipInstallmentRecoveryRequiredPO): SipPlanEntity.SipInstallmentRecoveryRequired = SipPlanEntity.SipInstallmentRecoveryRequired(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentRefundInProgressPO(value: SipPlanEntity.SipInstallmentRefundInProgress): pb.SipInstallmentRefundInProgressPO = pb.SipInstallmentRefundInProgressPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentRefundInProgressPO(value: pb.SipInstallmentRefundInProgressPO): SipPlanEntity.SipInstallmentRefundInProgress = SipPlanEntity.SipInstallmentRefundInProgress(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentSucceededPO(value: SipPlanEntity.SipInstallmentSucceeded): pb.SipInstallmentSucceededPO = pb.SipInstallmentSucceededPO(
    occurrence = Some(encodeSipOccurrencePO(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def decodeSipInstallmentSucceededPO(value: pb.SipInstallmentSucceededPO): SipPlanEntity.SipInstallmentSucceeded = SipPlanEntity.SipInstallmentSucceeded(
    occurrence = decodeSipOccurrencePO(req(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def encodeSipInstallmentFailedPO(value: SipPlanEntity.SipInstallmentFailed): pb.SipInstallmentFailedPO = pb.SipInstallmentFailedPO(
    occurrence = Some(encodeSipOccurrencePO(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def decodeSipInstallmentFailedPO(value: pb.SipInstallmentFailedPO): SipPlanEntity.SipInstallmentFailed = SipPlanEntity.SipInstallmentFailed(
    occurrence = decodeSipOccurrencePO(req(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def encodeSipCreateIntentRecordedPO(value: SipPlanEntity.SipCreateIntentRecorded): pb.SipCreateIntentRecordedPO = pb.SipCreateIntentRecordedPO(intent = Some(encodeBankSipCreateIntentPO(value.intent)), source = value.source.map(encodeBankSipCreateIntentPO))
  def decodeSipCreateIntentRecordedPO(value: pb.SipCreateIntentRecordedPO): SipPlanEntity.SipCreateIntentRecorded = SipPlanEntity.SipCreateIntentRecorded(intent = decodeBankSipCreateIntentPO(req(value.intent)), source = value.source.map(decodeBankSipCreateIntentPO))
  def encodeSipPlanEventPO(value: SipPlanEntity.Event): pb.SipPlanEventPO = value match {
    case e: SipPlanEntity.SipPlanCreated => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanCreated(encodeSipPlanCreatedPO(e)))
    case e: SipPlanEntity.SipDueSlotAppended => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipDueSlotAppended(encodeSipDueSlotAppendedPO(e)))
    case e: SipPlanEntity.SipScheduleSealed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipScheduleSealed(encodeSipScheduleSealedPO(e)))
    case e: SipPlanEntity.SipPlanRevised => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanRevised(encodeSipPlanRevisedPO(e)))
    case e: SipPlanEntity.SipClockAdvanced => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipClockAdvanced(encodeSipClockAdvancedPO(e)))
    case e: SipPlanEntity.SipPlanPaused => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanPaused(encodeSipPlanPausedPO(e)))
    case e: SipPlanEntity.SipPlanResumed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanResumed(encodeSipPlanResumedPO(e)))
    case e: SipPlanEntity.SipDueSlotObserved => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipDueSlotObserved(encodeSipDueSlotObservedPO(e)))
    case e: SipPlanEntity.SipPausedDueSlotSkipped => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPausedDueSlotSkipped(encodeSipPausedDueSlotSkippedPO(e)))
    case e: SipPlanEntity.SipSkippedSlotAdvanced => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipSkippedSlotAdvanced(encodeSipSkippedSlotAdvancedPO(e)))
    case e: SipPlanEntity.SipInstallmentTriggered => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentTriggered(encodeSipInstallmentTriggeredPO(e)))
    case e: SipPlanEntity.SipInstallmentPending => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentPending(encodeSipInstallmentPendingPO(e)))
    case e: SipPlanEntity.SipInstallmentOutcomeUnknown => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentOutcomeUnknown(encodeSipInstallmentOutcomeUnknownPO(e)))
    case e: SipPlanEntity.SipInstallmentRecoveryRequired => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentRecoveryRequired(encodeSipInstallmentRecoveryRequiredPO(e)))
    case e: SipPlanEntity.SipInstallmentRefundInProgress => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentRefundInProgress(encodeSipInstallmentRefundInProgressPO(e)))
    case e: SipPlanEntity.SipInstallmentSucceeded => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentSucceeded(encodeSipInstallmentSucceededPO(e)))
    case e: SipPlanEntity.SipInstallmentFailed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentFailed(encodeSipInstallmentFailedPO(e)))
    case e: SipPlanEntity.SipCreateIntentRecorded => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipCreateIntentRecorded(encodeSipCreateIntentRecordedPO(e)))
  }
  def decodeSipPlanEventPO(value: pb.SipPlanEventPO): SipPlanEntity.Event = value.event match {
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
