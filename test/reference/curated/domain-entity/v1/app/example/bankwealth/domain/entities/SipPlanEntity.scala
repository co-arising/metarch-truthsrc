package example.bankwealth.domain.entities

import example.bankwealth.domain.values._

object SipPlanEntity {
  type State = example.bankwealth.domain.SipPlanState
  val State: example.bankwealth.domain.SipPlanState.type = example.bankwealth.domain.SipPlanState

  type Event = example.bankwealth.domain.SipPlanProtocol.Event
  val Events: example.bankwealth.domain.SipPlanProtocol.type = example.bankwealth.domain.SipPlanProtocol

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
