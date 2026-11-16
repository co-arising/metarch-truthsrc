export function repositoryTemplate(model) {
  if (model.lookup !== 'owned-local-actor-cache') throw new TypeError('unsupported aggregate repository lookup');
  const { name, package: pkg, protocol } = model.names;
  return `package ${pkg}.application.aggregates

import akka.actor.typed.{ActorRef, Behavior}
import ${protocol}.Command

object ${name}Repository {
  final case class Handle(persistenceId: String, ref: ActorRef[Command])
}
final class ${name}Repository[K](identity: K => String, behavior: (K, String) => Behavior[Command],
    spawn: (String, Behavior[Command]) => ActorRef[Command]) extends AutoCloseable {
  import ${name}Repository.Handle
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
`;
}
