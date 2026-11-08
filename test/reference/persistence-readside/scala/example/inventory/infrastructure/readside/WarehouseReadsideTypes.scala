package example.inventory.infrastructure.readside

import example.inventory.domain.WarehouseState
import example.inventory.domain.values.TxId
import scala.concurrent.Future

final case class ReceiptCursor(mapKey: String, pidKey: String) {
  require(mapKey != null && pidKey != null, "null receipt cursor")
}
final case class ReceiptRow(pidKey: String, pid: String, resource: String, txid: TxId, receipt: String) {
  require(pidKey != null && pid != null && resource != null && txid != null && receipt != null, "null receipt row")
}
final case class ReceiptPage(rows: Vector[ReceiptRow], next: Option[ReceiptCursor]) {
  require(rows != null && rows.forall(_ != null) && next != null && next.forall(_ != null), "null receipt page")
}
final case class WarehouseStoredState(resource: String, sequenceNr: Long, state: WarehouseState) {
  require(resource != null && state != null, "null stored state")
}
final case class ProjectResult(sequenceNr: Long, duplicate: Boolean)
final case class CatchUpResult(pid: String, lastSequenceNr: Long, observedFrontier: Long) {
  require(pid != null, "null catch-up PID")
}
final case class ShutdownResult(drained: Boolean, accepted: Long, completed: Long,
  failure: Option[Throwable], timedOut: Boolean) {
  require(failure != null && failure.forall(_ != null), "null shutdown failure")
}

/** Bounded pages. Ownership of upstream lifetime remains with the caller. */
trait WarehouseEventSource {
  def persistenceIds(after: Option[String], limit: Int): Future[Vector[String]]
  def currentEvents(pid: String, after: Long, limit: Int): Future[Vector[WarehouseEnvelope]]
}
