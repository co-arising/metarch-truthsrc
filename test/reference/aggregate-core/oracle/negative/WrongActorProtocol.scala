package example.inventory.aggregatecore.reference.negative

import akka.actor.typed.ActorRef
import example.inventory.application.aggregates.WarehouseActorProtocol
import example.inventory.domain.WarehouseProtocol

// Expected compile failure: the pure protocol has no Execute Actor envelope.
object WrongActorProtocol {
  def broken(command: WarehouseProtocol.Command, replyTo: ActorRef[WarehouseActorProtocol.Reply]) =
    WarehouseProtocol.Execute(command, replyTo)
}
