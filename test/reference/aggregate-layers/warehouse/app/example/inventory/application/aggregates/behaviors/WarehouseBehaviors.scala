package example.inventory.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.inventory.application.aggregates.WarehouseProtocol._
import example.inventory.domain.entities.WarehouseEntity.{Event, State}
import example.inventory.domain.{WarehouseComputations, WarehouseProtocol => Payload, WarehouseRules}

object WarehouseBehaviors {

  def apply(hosts: WarehouseComputations): CommandHandler = (state, command) =>
    queryBehavior
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(reply) =>
      Effect.none.thenRun((s: State) => reply ! s)
  }

  private def executionBehavior(state: State, hosts: WarehouseComputations): PartialFunction[Command, Effect[Event, State]] = {
    case Execute(command, reply) =>
      val decision = command match {
        case p: Payload.ReserveSkuQuantity =>
          WarehouseRules.ReserveSkuQuantity(state, p, hosts)
        case p: Payload.CommitSkuReservation =>
          WarehouseRules.CommitSkuReservation(state, p, hosts)
        case p: Payload.ReleaseSkuReservation =>
          WarehouseRules.ReleaseSkuReservation(state, p, hosts)
        case p: Payload.RequestSkuReservation =>
          WarehouseRules.RequestSkuReservation(state, p, hosts)
      }

      decision match {
        case Left(code) =>
          Effect.none.thenRun((_: State) => reply ! Refused(code))
        case Right(events) =>
          Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))
      }
  }
}
