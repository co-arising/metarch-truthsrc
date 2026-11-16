import { importsFor, named, library } from './imports.mjs';

export function actorProtocolTemplate(aggregate, model, out) {
  const a = aggregate, artifact = a.actorProtocol;
  const { names: n, text } = importsFor(artifact, [
    [library('ref', 'akka.actor.typed.ActorRef')], [named('protocol', a.base.protocol)], [named('state', a.base.state)],
  ], ['Command', 'Event', 'Reply', 'Execute', 'GetState', 'Accepted', 'Rejected']);
  out.append(`package ${artifact.package}\n\n${text}\n\nobject ${artifact.identifier} {\n  sealed trait Command\n\n`, [a.source]);
  out.append(`  final case class Execute(\n    command: ${n.protocol}.Command,\n    replyTo: ${n.ref}[Reply]\n  ) extends Command\n\n`, a.base.protocol.commands.map(command => command.source));
  out.append(`  final case class GetState(\n    replyTo: ${n.ref}[${n.state}]\n  ) extends Command\n\n`, a.base.state.sources);
  out.append(`  sealed trait Reply\n\n  final case class Accepted(events: Vector[${n.protocol}.Event]) extends Reply\n  final case class Rejected(code: String) extends Reply\n}\n`, [a.source]);
}
