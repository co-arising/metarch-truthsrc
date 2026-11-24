package example.bankwealth.domain.entities

import example.bankwealth.domain.values._

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

  type Event = example.bankwealth.domain.events.SipPlanEvents.Event
  val Events: example.bankwealth.domain.events.SipPlanEvents.type = example.bankwealth.domain.events.SipPlanEvents

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
}
