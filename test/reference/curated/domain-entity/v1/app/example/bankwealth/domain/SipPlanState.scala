package example.bankwealth.domain

import example.bankwealth.domain.values._

final case class SipPlanState(
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

object SipPlanState {
  def empty: SipPlanState = example.bankwealth.domain.entities.SipPlanEntity.empty
}
