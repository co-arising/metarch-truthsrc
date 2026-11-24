package example.bankwealth.infrastructure.persistence.converters

import example.bankwealth.domain.entities._
import example.bankwealth.domain.events._
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
  def encodeSipPlanCreatedPO(value: SipPlanEvents.SipPlanCreated): pb.SipPlanCreatedPO = pb.SipPlanCreatedPO(planId = Some(encodePlanIdPO(value.planId)), config = Some(encodeSipRevisionConfigPO(value.config)))
  def decodeSipPlanCreatedPO(value: pb.SipPlanCreatedPO): SipPlanEvents.SipPlanCreated = SipPlanEvents.SipPlanCreated(planId = decodePlanIdPO(req(value.planId)), config = decodeSipRevisionConfigPO(req(value.config)))
  def encodeSipDueSlotAppendedPO(value: SipPlanEvents.SipDueSlotAppended): pb.SipDueSlotAppendedPO = pb.SipDueSlotAppendedPO(position = value.position, dueSlot = value.dueSlot)
  def decodeSipDueSlotAppendedPO(value: pb.SipDueSlotAppendedPO): SipPlanEvents.SipDueSlotAppended = SipPlanEvents.SipDueSlotAppended(position = value.position, dueSlot = value.dueSlot)
  def encodeSipScheduleSealedPO(value: SipPlanEvents.SipScheduleSealed): pb.SipScheduleSealedPO = pb.SipScheduleSealedPO(`sealed` = value.`sealed`)
  def decodeSipScheduleSealedPO(value: pb.SipScheduleSealedPO): SipPlanEvents.SipScheduleSealed = SipPlanEvents.SipScheduleSealed(`sealed` = value.`sealed`)
  def encodeSipPlanRevisedPO(value: SipPlanEvents.SipPlanRevised): pb.SipPlanRevisedPO = pb.SipPlanRevisedPO(config = Some(encodeSipRevisionConfigPO(value.config)), previousRevision = Some(encodeRevisionIdPO(value.previousRevision)))
  def decodeSipPlanRevisedPO(value: pb.SipPlanRevisedPO): SipPlanEvents.SipPlanRevised = SipPlanEvents.SipPlanRevised(config = decodeSipRevisionConfigPO(req(value.config)), previousRevision = decodeRevisionIdPO(req(value.previousRevision)))
  def encodeSipClockAdvancedPO(value: SipPlanEvents.SipClockAdvanced): pb.SipClockAdvancedPO = pb.SipClockAdvancedPO(tick = value.tick)
  def decodeSipClockAdvancedPO(value: pb.SipClockAdvancedPO): SipPlanEvents.SipClockAdvanced = SipPlanEvents.SipClockAdvanced(tick = value.tick)
  def encodeSipPlanPausedPO(value: SipPlanEvents.SipPlanPaused): pb.SipPlanPausedPO = pb.SipPlanPausedPO(tick = value.tick)
  def decodeSipPlanPausedPO(value: pb.SipPlanPausedPO): SipPlanEvents.SipPlanPaused = SipPlanEvents.SipPlanPaused(tick = value.tick)
  def encodeSipPlanResumedPO(value: SipPlanEvents.SipPlanResumed): pb.SipPlanResumedPO = pb.SipPlanResumedPO(tick = value.tick, pauseTick = value.pauseTick)
  def decodeSipPlanResumedPO(value: pb.SipPlanResumedPO): SipPlanEvents.SipPlanResumed = SipPlanEvents.SipPlanResumed(tick = value.tick, pauseTick = value.pauseTick)
  def encodeSipDueSlotObservedPO(value: SipPlanEvents.SipDueSlotObserved): pb.SipDueSlotObservedPO = pb.SipDueSlotObservedPO(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def decodeSipDueSlotObservedPO(value: pb.SipDueSlotObservedPO): SipPlanEvents.SipDueSlotObserved = SipPlanEvents.SipDueSlotObserved(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def encodeSipPausedDueSlotSkippedPO(value: SipPlanEvents.SipPausedDueSlotSkipped): pb.SipPausedDueSlotSkippedPO = pb.SipPausedDueSlotSkippedPO(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def decodeSipPausedDueSlotSkippedPO(value: pb.SipPausedDueSlotSkippedPO): SipPlanEvents.SipPausedDueSlotSkipped = SipPlanEvents.SipPausedDueSlotSkipped(position = value.position, dueSlot = value.dueSlot, disposition = value.disposition)
  def encodeSipSkippedSlotAdvancedPO(value: SipPlanEvents.SipSkippedSlotAdvanced): pb.SipSkippedSlotAdvancedPO = pb.SipSkippedSlotAdvancedPO(position = value.position, dueSlot = value.dueSlot)
  def decodeSipSkippedSlotAdvancedPO(value: pb.SipSkippedSlotAdvancedPO): SipPlanEvents.SipSkippedSlotAdvanced = SipPlanEvents.SipSkippedSlotAdvanced(position = value.position, dueSlot = value.dueSlot)
  def encodeSipInstallmentTriggeredPO(value: SipPlanEvents.SipInstallmentTriggered): pb.SipInstallmentTriggeredPO = pb.SipInstallmentTriggeredPO(position = value.position, occurrence = Some(encodeSipOccurrencePO(value.occurrence)))
  def decodeSipInstallmentTriggeredPO(value: pb.SipInstallmentTriggeredPO): SipPlanEvents.SipInstallmentTriggered = SipPlanEvents.SipInstallmentTriggered(position = value.position, occurrence = decodeSipOccurrencePO(req(value.occurrence)))
  def encodeSipInstallmentPendingPO(value: SipPlanEvents.SipInstallmentPending): pb.SipInstallmentPendingPO = pb.SipInstallmentPendingPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentPendingPO(value: pb.SipInstallmentPendingPO): SipPlanEvents.SipInstallmentPending = SipPlanEvents.SipInstallmentPending(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentOutcomeUnknownPO(value: SipPlanEvents.SipInstallmentOutcomeUnknown): pb.SipInstallmentOutcomeUnknownPO = pb.SipInstallmentOutcomeUnknownPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentOutcomeUnknownPO(value: pb.SipInstallmentOutcomeUnknownPO): SipPlanEvents.SipInstallmentOutcomeUnknown = SipPlanEvents.SipInstallmentOutcomeUnknown(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentRecoveryRequiredPO(value: SipPlanEvents.SipInstallmentRecoveryRequired): pb.SipInstallmentRecoveryRequiredPO = pb.SipInstallmentRecoveryRequiredPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentRecoveryRequiredPO(value: pb.SipInstallmentRecoveryRequiredPO): SipPlanEvents.SipInstallmentRecoveryRequired = SipPlanEvents.SipInstallmentRecoveryRequired(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentRefundInProgressPO(value: SipPlanEvents.SipInstallmentRefundInProgress): pb.SipInstallmentRefundInProgressPO = pb.SipInstallmentRefundInProgressPO(occurrence = Some(encodeSipOccurrencePO(value.occurrence)), outcome = value.outcome)
  def decodeSipInstallmentRefundInProgressPO(value: pb.SipInstallmentRefundInProgressPO): SipPlanEvents.SipInstallmentRefundInProgress = SipPlanEvents.SipInstallmentRefundInProgress(occurrence = decodeSipOccurrencePO(req(value.occurrence)), outcome = value.outcome)
  def encodeSipInstallmentSucceededPO(value: SipPlanEvents.SipInstallmentSucceeded): pb.SipInstallmentSucceededPO = pb.SipInstallmentSucceededPO(
    occurrence = Some(encodeSipOccurrencePO(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def decodeSipInstallmentSucceededPO(value: pb.SipInstallmentSucceededPO): SipPlanEvents.SipInstallmentSucceeded = SipPlanEvents.SipInstallmentSucceeded(
    occurrence = decodeSipOccurrencePO(req(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def encodeSipInstallmentFailedPO(value: SipPlanEvents.SipInstallmentFailed): pb.SipInstallmentFailedPO = pb.SipInstallmentFailedPO(
    occurrence = Some(encodeSipOccurrencePO(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def decodeSipInstallmentFailedPO(value: pb.SipInstallmentFailedPO): SipPlanEvents.SipInstallmentFailed = SipPlanEvents.SipInstallmentFailed(
    occurrence = decodeSipOccurrencePO(req(value.occurrence)),
    evidence = value.evidence,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    outcome = value.outcome
  )
  def encodeSipCreateIntentRecordedPO(value: SipPlanEvents.SipCreateIntentRecorded): pb.SipCreateIntentRecordedPO = pb.SipCreateIntentRecordedPO(intent = Some(encodeBankSipCreateIntentPO(value.intent)), source = value.source.map(encodeBankSipCreateIntentPO))
  def decodeSipCreateIntentRecordedPO(value: pb.SipCreateIntentRecordedPO): SipPlanEvents.SipCreateIntentRecorded = SipPlanEvents.SipCreateIntentRecorded(intent = decodeBankSipCreateIntentPO(req(value.intent)), source = value.source.map(decodeBankSipCreateIntentPO))
  def encodeSipPlanEventPO(value: SipPlanEvents.Event): pb.SipPlanEventPO = value match {
    case e: SipPlanEvents.SipPlanCreated => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanCreated(encodeSipPlanCreatedPO(e)))
    case e: SipPlanEvents.SipDueSlotAppended => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipDueSlotAppended(encodeSipDueSlotAppendedPO(e)))
    case e: SipPlanEvents.SipScheduleSealed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipScheduleSealed(encodeSipScheduleSealedPO(e)))
    case e: SipPlanEvents.SipPlanRevised => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanRevised(encodeSipPlanRevisedPO(e)))
    case e: SipPlanEvents.SipClockAdvanced => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipClockAdvanced(encodeSipClockAdvancedPO(e)))
    case e: SipPlanEvents.SipPlanPaused => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanPaused(encodeSipPlanPausedPO(e)))
    case e: SipPlanEvents.SipPlanResumed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPlanResumed(encodeSipPlanResumedPO(e)))
    case e: SipPlanEvents.SipDueSlotObserved => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipDueSlotObserved(encodeSipDueSlotObservedPO(e)))
    case e: SipPlanEvents.SipPausedDueSlotSkipped => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipPausedDueSlotSkipped(encodeSipPausedDueSlotSkippedPO(e)))
    case e: SipPlanEvents.SipSkippedSlotAdvanced => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipSkippedSlotAdvanced(encodeSipSkippedSlotAdvancedPO(e)))
    case e: SipPlanEvents.SipInstallmentTriggered => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentTriggered(encodeSipInstallmentTriggeredPO(e)))
    case e: SipPlanEvents.SipInstallmentPending => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentPending(encodeSipInstallmentPendingPO(e)))
    case e: SipPlanEvents.SipInstallmentOutcomeUnknown => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentOutcomeUnknown(encodeSipInstallmentOutcomeUnknownPO(e)))
    case e: SipPlanEvents.SipInstallmentRecoveryRequired => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentRecoveryRequired(encodeSipInstallmentRecoveryRequiredPO(e)))
    case e: SipPlanEvents.SipInstallmentRefundInProgress => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentRefundInProgress(encodeSipInstallmentRefundInProgressPO(e)))
    case e: SipPlanEvents.SipInstallmentSucceeded => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentSucceeded(encodeSipInstallmentSucceededPO(e)))
    case e: SipPlanEvents.SipInstallmentFailed => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipInstallmentFailed(encodeSipInstallmentFailedPO(e)))
    case e: SipPlanEvents.SipCreateIntentRecorded => pb.SipPlanEventPO(pb.SipPlanEventPO.Event.SipCreateIntentRecorded(encodeSipCreateIntentRecordedPO(e)))
  }
  def decodeSipPlanEventPO(value: pb.SipPlanEventPO): SipPlanEvents.Event = value.event match {
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
