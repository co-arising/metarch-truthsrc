package example.inventory.aggregatecore.reference.negative

import akka.persistence.typed.{EventAdapter, EventSeq, PersistenceId}
import example.inventory.aggregatecore.reference.positive.{ValidAdapters, ValidHost}
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseState
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap

object WrongEventAdapter {
  val commands: EventAdapter[WarehouseProtocol.Command, String] = new EventAdapter[WarehouseProtocol.Command, String] {
    def manifest(command: WarehouseProtocol.Command): String = "wrong-command-journal"
    def toJournal(command: WarehouseProtocol.Command): String = "wrong"
    def fromJournal(value: String, manifest: String): EventSeq[WarehouseProtocol.Command] = EventSeq.empty
  }
  // Expected compile failure: an adapter for pure Command cannot adapt pure Event.
  def broken(pid: PersistenceId) =
    WarehouseBootstrap.create[String](pid, WarehouseState(), ValidHost, commands, ValidAdapters.snapshots)
}
