import { importsFor, named, library } from './imports.mjs';

export function bootstrapTemplate(aggregate, model, out) {
  const a = aggregate, artifact = a.bootstrap;
  const { names: n, text } = importsFor(artifact, [
    [library('behavior', 'akka.actor.typed.Behavior')],
    [library('eventAdapter', 'akka.persistence.typed.EventAdapter'), library('pid', 'akka.persistence.typed.PersistenceId'), library('snapshotAdapter', 'akka.persistence.typed.SnapshotAdapter')],
    [library('eventSourced', 'akka.persistence.typed.scaladsl.EventSourcedBehavior')],
    [named('actor', a.actorProtocol), named('aggregate', a.aggregate)], [named('factory', a.factory)],
    [named('protocol', a.base.protocol)], [named('state', a.base.state)], [named('handler', a.eventHandler)], [named('hosts', a.base.computations)],
  ], ['J']);
  out.append(`package ${artifact.package}\n\n${text}\n\nobject ${artifact.identifier} extends ${n.factory} {\n  override def create[J](\n    persistenceId: ${n.pid},\n    initial: ${n.state},\n    hosts: ${n.hosts},\n    eventAdapter: ${n.eventAdapter}[${n.protocol}.Event, J],\n    snapshotAdapter: ${n.snapshotAdapter}[${n.state}]\n  ): ${n.behavior}[${n.actor}.Command] = {\n    require(persistenceId != null && persistenceId.id != null && persistenceId.id.trim.nonEmpty,\n      "persistenceId must not be null or empty")\n    require(initial != null, "initial state must not be null")\n    require(hosts != null, "hosts must not be null")\n    require(eventAdapter != null, "eventAdapter must not be null")\n    require(snapshotAdapter != null, "snapshotAdapter must not be null")\n    ${n.eventSourced}[${n.actor}.Command, ${n.protocol}.Event, ${n.state}](\n      persistenceId = persistenceId,\n      emptyState = initial,\n      commandHandler = ${n.aggregate}.commandHandler(hosts),\n      eventHandler = ${n.handler}.apply\n    ).eventAdapter(eventAdapter).snapshotAdapter(snapshotAdapter)\n  }\n}\n`, [a.source]);
}
