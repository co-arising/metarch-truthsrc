import { importsFor, named, library } from './imports.mjs';

export function aggregateTemplate(aggregate, model, out) {
  const a = aggregate, artifact = a.aggregate;
  const { names: n, text } = importsFor(artifact, [
    [library('effect', 'akka.persistence.typed.scaladsl.Effect')],
    [named('protocol', a.base.protocol)], [named('state', a.base.state)],
    [named('rules', a.rules)], [named('hosts', a.base.computations)],
  ], ['Execute', 'GetState', 'Accepted', 'Rejected', a.actorProtocol.name]);
  const wildcard = `import ${a.actorProtocol.fqn}._`;
  const [first, ...rest] = text.split('\n');
  out.append(`package ${artifact.package}\n\n${first}\n${wildcard}\n${rest.join('\n')}\n\nobject ${artifact.identifier} {\n`, [a.source]);
  out.append(`  def commandHandler(hosts: ${n.hosts}):\n      (${n.state}, ${a.actorProtocol.identifier}.Command) => ${n.effect}[${n.protocol}.Event, ${n.state}] = {\n    require(hosts != null, "hosts must not be null")\n    (state, envelope) => envelope match {\n`, [a.source]);
  out.append(`      case GetState(replyTo) =>\n        ${n.effect}.none[${n.protocol}.Event, ${n.state}].thenReply(replyTo)(_ => state)\n`, a.base.state.sources);
  out.append(`      case Execute(command, replyTo) =>\n        ${n.rules}.decide(state, command, hosts) match {\n          case Left(code) =>\n            ${n.effect}.none[${n.protocol}.Event, ${n.state}].thenReply(replyTo)(_ => Rejected(code))\n          case Right(events) if events.isEmpty =>\n            ${n.effect}.none[${n.protocol}.Event, ${n.state}].thenReply(replyTo)(_ => Accepted(events))\n          case Right(events) =>\n            ${n.effect}.persist[${n.protocol}.Event, ${n.state}](events).thenReply(replyTo)(_ => Accepted(events))\n        }\n    }\n  }\n}\n`, a.base.protocol.commands.map(command => command.source));
}
