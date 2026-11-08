package example.inventory.aggregatecore.reference.negative

import akka.persistence.typed.{PersistenceId, SnapshotAdapter}
import example.inventory.aggregatecore.reference.positive.{ValidAdapters, ValidHost}
import example.inventory.domain.WarehouseState
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap

object WrongSnapshotAdapter {
  val strings: SnapshotAdapter[String] = new SnapshotAdapter[String] {
    def toJournal(value: String): Any = value
    def fromJournal(value: Any): String = value.toString
  }
  // Expected compile failure: SnapshotAdapter[String] is not SnapshotAdapter[WarehouseState].
  def broken(pid: PersistenceId) =
    WarehouseBootstrap.create[String](pid, WarehouseState(), ValidHost, ValidAdapters.events, strings)
}
