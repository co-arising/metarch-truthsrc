import { importsFor, named, library } from './imports.mjs';

export function repositoryTemplate(aggregate, model, out) {
  const a = aggregate, artifact = a.repository;
  const { names: n, text } = importsFor(artifact, [
    [library('ref', 'akka.actor.typed.ActorRef')], [library('pid', 'akka.persistence.typed.PersistenceId')],
  ], ['K', 'Handle']);
  out.append(`package ${artifact.package}\n\n${text}\n\ntrait ${artifact.identifier}[K] {\n  def get(key: K): ${artifact.identifier}.Handle\n  def close(): Unit\n}\n\nobject ${artifact.identifier} {\n  final case class Handle(\n    persistenceId: ${n.pid},\n    ref: ${n.ref}[${a.actorProtocol.identifier}.Command]\n  )\n}\n`, [a.source]);
}

export function repositoryImplementationTemplate(aggregate, model, out) {
  const a = aggregate, artifact = a.repositoryImplementation;
  const { names: n, text } = importsFor(artifact, [
    [library('ref', 'akka.actor.typed.ActorRef'), library('behavior', 'akka.actor.typed.Behavior')],
    [library('pid', 'akka.persistence.typed.PersistenceId')],
    [named('actor', a.actorProtocol), named('repository', a.repository)],
    [library('handle', a.repository.fqn + '.Handle')],
  ], ['K', 'A']);
  out.append(`package ${artifact.package}\n\n${text}\n\nfinal class ${artifact.identifier}[K](\n  identity: K => ${n.pid},\n  behavior: (K, ${n.pid}) => ${n.behavior}[${n.actor}.Command],\n  spawn: (K, ${n.pid}, ${n.behavior}[${n.actor}.Command]) => ${n.ref}[${n.actor}.Command]\n) extends ${n.repository}[K] {\n  require(identity != null, "identity must not be null")\n  require(behavior != null, "behavior must not be null")\n  require(spawn != null, "spawn must not be null")\n\n  private var handles = Map.empty[K, ${n.handle}]\n  private var pidOwners = Map.empty[String, K]\n  private var closed = false\n  private var inOperation = false\n\n  // synchronized serializes get/close; the additional flag rejects monitor\n  // reentry from identity/behavior/spawn instead of exposing partial ownership.\n  private def serialized[A](body: => A): A = synchronized {\n    if (inOperation) throw new IllegalStateException("repository callback reentry")\n    inOperation = true\n    try body\n    finally inOperation = false\n  }\n\n  override def get(key: K): ${n.handle} = serialized {\n    if (closed) throw new IllegalStateException("repository is closed")\n    require(key != null, "key must not be null")\n    handles.get(key) match {\n      case Some(handle) => handle\n      case None =>\n        val pid = identity(key)\n        require(pid != null && pid.id != null && pid.id.trim.nonEmpty,\n          "identity must return a nonempty persistenceId")\n        if (pidOwners.contains(pid.id))\n          throw new IllegalArgumentException("persistenceId is already owned by a different key: " + pid.id)\n        val nextBehavior = behavior(key, pid)\n        require(nextBehavior != null, "behavior must not return null")\n        val ref = spawn(key, pid, nextBehavior)\n        require(ref != null, "spawn must not return null")\n        val handle = ${n.handle}(pid, ref)\n        // Nothing is reserved until every callback has returned successfully.\n        handles = handles.updated(key, handle)\n        pidOwners = pidOwners.updated(pid.id, key)\n        handle\n    }\n  }\n\n  override def close(): Unit = serialized {\n    if (!closed) {\n      closed = true\n      handles = Map.empty\n      pidOwners = Map.empty\n    }\n    // ActorSystem and delivered ActorRefs are owned by the caller, not us.\n  }\n}\n`, [a.source]);
}
