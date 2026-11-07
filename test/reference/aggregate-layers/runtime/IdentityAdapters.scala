package example.inventory.infrastructure.serialization

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.inventory.domain.{AllocationOrderProtocol, AllocationOrderState, WarehouseProtocol, WarehouseState}

// Identity adapters isolate actor orchestration; these tests do not certify protobuf serialization.
object WarehouseEventAdapter extends EventAdapter[WarehouseProtocol.Event, WarehouseProtocol.Event] {
  def manifest(event: WarehouseProtocol.Event): String = "reference"
  def toJournal(event: WarehouseProtocol.Event): WarehouseProtocol.Event = event
  def fromJournal(event: WarehouseProtocol.Event, manifest: String): EventSeq[WarehouseProtocol.Event] = EventSeq.single(event)
}

object WarehouseSnapshotAdapter extends SnapshotAdapter[WarehouseState] {
  def toJournal(state: WarehouseState): Any = state
  def fromJournal(value: Any): WarehouseState = value.asInstanceOf[WarehouseState]
}

object AllocationOrderEventAdapter extends EventAdapter[AllocationOrderProtocol.Event, AllocationOrderProtocol.Event] {
  def manifest(event: AllocationOrderProtocol.Event): String = "reference"
  def toJournal(event: AllocationOrderProtocol.Event): AllocationOrderProtocol.Event = event
  def fromJournal(event: AllocationOrderProtocol.Event, manifest: String): EventSeq[AllocationOrderProtocol.Event] = EventSeq.single(event)
}

object AllocationOrderSnapshotAdapter extends SnapshotAdapter[AllocationOrderState] {
  def toJournal(state: AllocationOrderState): Any = state
  def fromJournal(value: Any): AllocationOrderState = value.asInstanceOf[AllocationOrderState]
}
