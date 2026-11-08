package example.inventory.infrastructure.repositories

import akka.actor.typed.{ActorRef, Behavior}
import akka.persistence.typed.PersistenceId
import example.inventory.application.aggregates.{WarehouseActorProtocol, WarehouseActorRepository}
import example.inventory.application.aggregates.WarehouseActorRepository.Handle

final class LocalWarehouseActorRepository[K](
  identity: K => PersistenceId,
  behavior: (K, PersistenceId) => Behavior[WarehouseActorProtocol.Command],
  spawn: (K, PersistenceId, Behavior[WarehouseActorProtocol.Command]) => ActorRef[WarehouseActorProtocol.Command]
) extends WarehouseActorRepository[K] {
  require(identity != null, "identity must not be null")
  require(behavior != null, "behavior must not be null")
  require(spawn != null, "spawn must not be null")

  private var handles = Map.empty[K, Handle]
  private var pidOwners = Map.empty[String, K]
  private var closed = false
  private var inOperation = false

  // synchronized serializes get/close; the additional flag rejects monitor
  // reentry from identity/behavior/spawn instead of exposing partial ownership.
  private def serialized[A](body: => A): A = synchronized {
    if (inOperation) throw new IllegalStateException("repository callback reentry")
    inOperation = true
    try body
    finally inOperation = false
  }

  override def get(key: K): Handle = serialized {
    if (closed) throw new IllegalStateException("repository is closed")
    require(key != null, "key must not be null")
    handles.get(key) match {
      case Some(handle) => handle
      case None =>
        val pid = identity(key)
        require(pid != null && pid.id != null && pid.id.trim.nonEmpty,
          "identity must return a nonempty persistenceId")
        if (pidOwners.contains(pid.id))
          throw new IllegalArgumentException("persistenceId is already owned by a different key: " + pid.id)
        val nextBehavior = behavior(key, pid)
        require(nextBehavior != null, "behavior must not return null")
        val ref = spawn(key, pid, nextBehavior)
        require(ref != null, "spawn must not return null")
        val handle = Handle(pid, ref)
        // Nothing is reserved until every callback has returned successfully.
        handles = handles.updated(key, handle)
        pidOwners = pidOwners.updated(pid.id, key)
        handle
    }
  }

  override def close(): Unit = serialized {
    if (!closed) {
      closed = true
      handles = Map.empty
      pidOwners = Map.empty
    }
    // ActorSystem and delivered ActorRefs are owned by the caller, not us.
  }
}
