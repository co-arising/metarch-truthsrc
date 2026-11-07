package example.inventory.application.aggregates

import akka.actor.typed.Behavior
import example.inventory.application.aggregates.WarehouseProtocol.Command
import example.inventory.domain.WarehouseComputations
import example.inventory.domain.entities.WarehouseEntity.State

trait WarehouseAggregateFactory {

  def create(persistenceId: String, initial: State, hosts: WarehouseComputations): Behavior[Command]
}
