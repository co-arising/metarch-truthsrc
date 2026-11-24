package example.bankwealth.application.aggregates

import akka.actor.typed.{ActorRef, Behavior}
import CreditBalanceProtocol.Command

object CreditBalanceRepository {
  final case class Handle(persistenceId: String, ref: ActorRef[Command])
}
final class CreditBalanceRepository[K](identity: K => String, behavior: (K, String) => Behavior[Command],
    spawn: (String, Behavior[Command]) => ActorRef[Command]) extends AutoCloseable {
  import CreditBalanceRepository.Handle
  require(identity != null && behavior != null && spawn != null)
  private val handles = scala.collection.mutable.Map.empty[K, Handle]
  private val identities = scala.collection.mutable.Map.empty[String, K]
  private var closed = false
  def get(id: K): Handle = synchronized {
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
  def close(): Unit = synchronized { closed = true; handles.clear(); identities.clear() }
}
