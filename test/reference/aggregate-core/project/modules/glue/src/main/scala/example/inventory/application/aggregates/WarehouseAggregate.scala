package example.inventory.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.inventory.application.aggregates.WarehouseActorProtocol._
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseState
import example.inventory.domain.invariant.WarehouseRules
import example.inventory.domain.ports.WarehouseComputations

object WarehouseAggregate {
  def commandHandler(hosts: WarehouseComputations):
      (WarehouseState, WarehouseActorProtocol.Command) => Effect[WarehouseProtocol.Event, WarehouseState] = {
    require(hosts != null, "hosts must not be null")
    (state, envelope) => envelope match {
      case GetState(replyTo) =>
        Effect.none[WarehouseProtocol.Event, WarehouseState].thenReply(replyTo)(_ => state)
      case Execute(command, replyTo) =>
        WarehouseRules.decide(state, command, hosts) match {
          case Left(code) =>
            Effect.none[WarehouseProtocol.Event, WarehouseState].thenReply(replyTo)(_ => Rejected(code))
          case Right(events) if events.isEmpty =>
            Effect.none[WarehouseProtocol.Event, WarehouseState].thenReply(replyTo)(_ => Accepted(events))
          case Right(events) =>
            Effect.persist[WarehouseProtocol.Event, WarehouseState](events).thenReply(replyTo)(_ => Accepted(events))
        }
    }
  }
}
