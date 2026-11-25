package example.bankwealth.domain.entities

import example.bankwealth.domain.values._
import net.imadz.common.CborSerializable

object SipPlanEntity {
  final case class State(
    id: PlanId,
    initialized: Boolean,
    scheduleSealed: Boolean,
    scheduleCount: Long,
    lastDueSlot: Long,
    slots: Map[Long, Long],
    currentTick: Long,
    observedCount: Long,
    startCount: Long,
    paused: Boolean,
    pauseTick: Long,
    pauseIntervals: Map[Long, Long],
    revisions: Map[RevisionId, SipRevisionConfig],
    revisionEnds: Map[RevisionId, Long],
    latestRevision: RevisionId,
    latestEffectiveSlot: Long,
    slotDisposition: Map[Long, String],
    occurrences: Map[Long, SipOccurrence],
    occurrenceProgress: Map[OccurrenceId, String],
    firstTerminals: Map[OccurrenceId, String],
    terminalReceiptBodies: Map[String, String],
    successTotal: Long,
    failureTotal: Long,
    createIntent: Option[BankSipCreateIntent],
    sipCreateIntents: Map[String, BankSipCreateIntent],
    createIntentDueSlots: Vector[Long],
    intentAppendedDueSlots: Map[Long, Long]
  )

  def empty: State = State(
    id = PlanId(""),
    initialized = false,
    scheduleSealed = false,
    scheduleCount = 0L,
    lastDueSlot = -1L,
    slots = Map(),
    currentTick = -1L,
    observedCount = 0L,
    startCount = 0L,
    paused = false,
    pauseTick = -1L,
    pauseIntervals = Map(),
    revisions = Map(),
    revisionEnds = Map(),
    latestRevision = RevisionId(""),
    latestEffectiveSlot = -1L,
    slotDisposition = Map(),
    occurrences = Map(),
    occurrenceProgress = Map(),
    firstTerminals = Map(),
    terminalReceiptBodies = Map(),
    successTotal = 0L,
    failureTotal = 0L,
    createIntent = None,
    sipCreateIntents = Map(),
    createIntentDueSlots = Vector(),
    intentAppendedDueSlots = Map()
  )

  def empty(id: PlanId): State = empty.copy(id = id)

  sealed trait Event extends CborSerializable
  final case class SipPlanCreated(planId: PlanId, config: SipRevisionConfig) extends Event
  final case class SipDueSlotAppended(position: Long, dueSlot: Long) extends Event
  final case class SipScheduleSealed(`sealed`: Boolean) extends Event
  final case class SipPlanRevised(config: SipRevisionConfig, previousRevision: RevisionId) extends Event
  final case class SipClockAdvanced(tick: Long) extends Event
  final case class SipPlanPaused(tick: Long) extends Event
  final case class SipPlanResumed(tick: Long, pauseTick: Long) extends Event
  final case class SipDueSlotObserved(position: Long, dueSlot: Long, disposition: String) extends Event
  final case class SipPausedDueSlotSkipped(position: Long, dueSlot: Long, disposition: String) extends Event
  final case class SipSkippedSlotAdvanced(position: Long, dueSlot: Long) extends Event
  final case class SipInstallmentTriggered(position: Long, occurrence: SipOccurrence) extends Event
  final case class SipInstallmentPending(occurrence: SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentOutcomeUnknown(occurrence: SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentRecoveryRequired(occurrence: SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentRefundInProgress(occurrence: SipOccurrence, outcome: String) extends Event
  final case class SipInstallmentSucceeded(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String,
    outcome: String
  ) extends Event
  final case class SipInstallmentFailed(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String,
    outcome: String
  ) extends Event
  final case class SipCreateIntentRecorded(
    intent: BankSipCreateIntent,
    source: Option[BankSipCreateIntent]
  ) extends Event

  type EventHandler = (State, Event) => State
}
