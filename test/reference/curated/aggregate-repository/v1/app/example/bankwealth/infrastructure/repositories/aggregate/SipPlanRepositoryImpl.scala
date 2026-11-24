package example.bankwealth.infrastructure.repositories.aggregate

import akka.actor.typed.{ActorRef, Behavior}
import example.bankwealth.application.aggregates.SipPlanProtocol.Command
import example.bankwealth.application.aggregates.repository.SipPlanRepository
import example.bankwealth.application.aggregates.repository.SipPlanRepository.Handle

final class SipPlanRepositoryImpl[K](
  identity: K => String,
  behavior: (K, String) => Behavior[Command],
  spawn: (String, Behavior[Command]) => ActorRef[Command]
) extends SipPlanRepository[K] {
  require(identity != null && behavior != null && spawn != null)
  private val handles = scala.collection.mutable.Map.empty[K, Handle]
  private val identities = scala.collection.mutable.Map.empty[String, K]
  private var closed = false

  override def get(id: K): Handle = synchronized {
    require(!closed, "repository is closed")
    handles.getOrElseUpdate(id, {
      val pid = identity(id)
      require(pid != null && pid.nonEmpty, "explicit persistence identity required")
      require(!identities.contains(pid) || identities(pid) == id, "conflicting repository persistence identity")
      val ref = spawn(pid, behavior(id, pid))
      require(ref != null, "actor spawn returned no reference")
      identities.put(pid, id)
      Handle(pid, ref)
    })
  }

  override def close(): Unit = synchronized { closed = true; handles.clear(); identities.clear() }
}
