package example.inventory.aggregatecore.reference.negative

import akka.persistence.typed.PersistenceId
import example.inventory.aggregatecore.reference.positive.{ValidAdapters, ValidHost}
import example.inventory.domain.WarehouseState
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap

// Expected compile failure: snapshotAdapter is mandatory even with a valid event adapter.
object MissingSnapshotAdapter {
  def broken(pid: PersistenceId) = WarehouseBootstrap.create[String](pid, WarehouseState(), ValidHost, ValidAdapters.events)
}
