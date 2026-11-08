package example.inventory.application.aggregates

import akka.actor.typed.ActorRef
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseState

object WarehouseActorProtocol {
  sealed trait Command

  final case class Execute(
    command: WarehouseProtocol.Command,
    replyTo: ActorRef[Reply]
  ) extends Command

  final case class GetState(
    replyTo: ActorRef[WarehouseState]
  ) extends Command

  sealed trait Reply

  final case class Accepted(events: Vector[WarehouseProtocol.Event]) extends Reply
  final case class Rejected(code: String) extends Reply
}
