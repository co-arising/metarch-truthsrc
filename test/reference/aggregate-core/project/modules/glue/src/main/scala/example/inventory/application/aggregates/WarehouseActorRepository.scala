package example.inventory.application.aggregates

import akka.actor.typed.ActorRef
import akka.persistence.typed.PersistenceId

trait WarehouseActorRepository[K] {
  def get(key: K): WarehouseActorRepository.Handle
  def close(): Unit
}

object WarehouseActorRepository {
  final case class Handle(
    persistenceId: PersistenceId,
    ref: ActorRef[WarehouseActorProtocol.Command]
  )
}
