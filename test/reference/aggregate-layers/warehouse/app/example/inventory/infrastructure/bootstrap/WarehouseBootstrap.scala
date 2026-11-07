package example.inventory.infrastructure.bootstrap

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import example.inventory.application.aggregates.{WarehouseAggregate, WarehouseAggregateFactory}
import example.inventory.application.aggregates.WarehouseProtocol.Command
import example.inventory.domain.WarehouseComputations
import example.inventory.domain.entities.WarehouseEntity.{Event, State}
import example.inventory.domain.entities.behaviors.WarehouseEventHandler
import example.inventory.infrastructure.serialization.{WarehouseEventAdapter, WarehouseSnapshotAdapter}

object WarehouseBootstrap extends WarehouseAggregateFactory {

  override def create(persistenceId: String, initial: State, hosts: WarehouseComputations): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = WarehouseAggregate.commandHandler(hosts),
      eventHandler = WarehouseEventHandler.apply
    )
      .eventAdapter(WarehouseEventAdapter)
      .snapshotAdapter(WarehouseSnapshotAdapter)
  }
}
