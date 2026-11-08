package example.inventory.infrastructure.bootstrap

import akka.actor.typed.Behavior
import akka.persistence.typed.{EventAdapter, PersistenceId, SnapshotAdapter}
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import example.inventory.application.aggregates.{WarehouseActorProtocol, WarehouseAggregate}
import example.inventory.application.factories.WarehouseAggregateFactory
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseState
import example.inventory.domain.entities.behaviors.WarehouseEventHandler
import example.inventory.domain.ports.WarehouseComputations

object WarehouseBootstrap extends WarehouseAggregateFactory {
  override def create[J](
    persistenceId: PersistenceId,
    initial: WarehouseState,
    hosts: WarehouseComputations,
    eventAdapter: EventAdapter[WarehouseProtocol.Event, J],
    snapshotAdapter: SnapshotAdapter[WarehouseState]
  ): Behavior[WarehouseActorProtocol.Command] = {
    require(persistenceId != null && persistenceId.id != null && persistenceId.id.trim.nonEmpty,
      "persistenceId must not be null or empty")
    require(initial != null, "initial state must not be null")
    require(hosts != null, "hosts must not be null")
    require(eventAdapter != null, "eventAdapter must not be null")
    require(snapshotAdapter != null, "snapshotAdapter must not be null")
    EventSourcedBehavior[WarehouseActorProtocol.Command, WarehouseProtocol.Event, WarehouseState](
      persistenceId = persistenceId,
      emptyState = initial,
      commandHandler = WarehouseAggregate.commandHandler(hosts),
      eventHandler = WarehouseEventHandler.apply
    ).eventAdapter(eventAdapter).snapshotAdapter(snapshotAdapter)
  }
}
