package example.inventory.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.inventory.domain.entities.WarehouseEntity.{Event, State}

object WarehouseProtocol {

  type Command = example.inventory.domain.WarehouseAggregate.Request
  type Reply = example.inventory.domain.WarehouseAggregate.Reply
  type CommandPayload = example.inventory.domain.WarehouseProtocol.Command
  type CommandHandler = (State, Command) => Effect[Event, State]

  type Execute = example.inventory.domain.WarehouseAggregate.Execute
  val Execute: example.inventory.domain.WarehouseAggregate.Execute.type =
    example.inventory.domain.WarehouseAggregate.Execute

  type GetState = example.inventory.domain.WarehouseAggregate.GetState
  val GetState: example.inventory.domain.WarehouseAggregate.GetState.type =
    example.inventory.domain.WarehouseAggregate.GetState

  type Accepted = example.inventory.domain.WarehouseAggregate.Accepted
  val Accepted: example.inventory.domain.WarehouseAggregate.Accepted.type =
    example.inventory.domain.WarehouseAggregate.Accepted

  type Refused = example.inventory.domain.WarehouseAggregate.Refused
  val Refused: example.inventory.domain.WarehouseAggregate.Refused.type =
    example.inventory.domain.WarehouseAggregate.Refused
}
