package example.inventory.aggregatecore.reference.negative

import akka.persistence.typed.PersistenceId
import example.inventory.aggregatecore.reference.positive.ValidHost
import example.inventory.domain.WarehouseState
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap

// Expected compile failure: event and snapshot adapters are required, no defaults.
object MissingAdapters {
  def broken(pid: PersistenceId) = WarehouseBootstrap.create(pid, WarehouseState(), ValidHost)
}
