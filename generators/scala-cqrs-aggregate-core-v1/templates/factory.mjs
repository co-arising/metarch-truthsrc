import { importsFor, named, library } from './imports.mjs';

export function factoryTemplate(aggregate, model, out) {
  const a = aggregate, artifact = a.factory;
  const { names: n, text } = importsFor(artifact, [
    [library('behavior', 'akka.actor.typed.Behavior')],
    [library('eventAdapter', 'akka.persistence.typed.EventAdapter'), library('pid', 'akka.persistence.typed.PersistenceId'), library('snapshotAdapter', 'akka.persistence.typed.SnapshotAdapter')],
    [named('actor', a.actorProtocol)], [named('protocol', a.base.protocol)], [named('state', a.base.state)], [named('hosts', a.base.computations)],
  ], ['J']);
  out.append(`package ${artifact.package}\n\n${text}\n\ntrait ${artifact.identifier} {\n  def create[J](\n    persistenceId: ${n.pid},\n    initial: ${n.state},\n    hosts: ${n.hosts},\n    eventAdapter: ${n.eventAdapter}[${n.protocol}.Event, J],\n    snapshotAdapter: ${n.snapshotAdapter}[${n.state}]\n  ): ${n.behavior}[${n.actor}.Command]\n}\n`, [a.source]);
}
