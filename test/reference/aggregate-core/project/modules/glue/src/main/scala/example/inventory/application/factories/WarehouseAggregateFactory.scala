package example.inventory.application.factories

import akka.actor.typed.Behavior
import akka.persistence.typed.{EventAdapter, PersistenceId, SnapshotAdapter}
import example.inventory.application.aggregates.WarehouseActorProtocol
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseState
import example.inventory.domain.ports.WarehouseComputations

trait WarehouseAggregateFactory {
  def create[J](
    persistenceId: PersistenceId,
    initial: WarehouseState,
    hosts: WarehouseComputations,
    eventAdapter: EventAdapter[WarehouseProtocol.Event, J],
    snapshotAdapter: SnapshotAdapter[WarehouseState]
  ): Behavior[WarehouseActorProtocol.Command]
}
