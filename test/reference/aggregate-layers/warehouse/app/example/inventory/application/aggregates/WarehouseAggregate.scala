package example.inventory.application.aggregates

import example.inventory.application.aggregates.WarehouseProtocol.CommandHandler
import example.inventory.domain.WarehouseComputations

object WarehouseAggregate {

  def commandHandler(hosts: WarehouseComputations): CommandHandler =
    behaviors.WarehouseBehaviors(hosts)
}
