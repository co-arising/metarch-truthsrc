import { entry, packageFor, pathFor, symbol, typeName } from './naming.mjs';

/** Real event-sourced actor: command rules produce events; state only evolves by event application. */
export function renderActors({ products, options }, footprint, externalIngress = false) {
  const layout = products['reference-layout'];
  return layout.declarations.filter(d => d.ref.kind === 'aggregate').map(a => {
    const pkg = packageFor(a.ref.context, options), name = symbol(a.ref.id);
    const commands = layout.declarations.filter(d => d.ref.kind === 'command' && d.ref.context === a.ref.context && d.ref.owner[0] === a.ref.id);
    const external = externalIngress ? products['domain-dependencies'].externalProducers.filter(p => p.event.context === a.ref.context && p.event.owner[0] === a.ref.id) : [];
    const ingressMessages = external.map(p => '  final case class Ingest' + symbol(p.id.replaceAll('-', '_')) + '(output: ' + typeName(p.outputType, options) + ', authorization: String, replyTo: ActorRef[Reply]) extends Request\n').join('');
    const ingressCases = external.map(p => '        case Ingest' + symbol(p.id.replaceAll('-', '_')) + '(output, authorization, reply) =>\n          if (!authority.authorize(' + JSON.stringify(p.id) + ', authorization, ' + name + 'ExternalEvents.' + symbol(p.id.replaceAll('-', '_') + '_identity') + '(output))) Effect.none.thenRun((_: ' + name + 'State) => reply ! Refused("external-authority-denied"))\n          else Effect.persist(' + name + 'ExternalEvents.' + symbol(p.id.replaceAll('-', '_')) + '(output)).thenRun((_: ' + name + 'State) => reply ! Accepted(Vector(' + name + 'ExternalEvents.' + symbol(p.id.replaceAll('-', '_')) + '(output))))\n').join('');
    const authority = external.length ? '  trait ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean }\n' : '';
    const authorityParam = external.length ? ', authority: ExternalAuthority' : '';
    const body = 'package ' + pkg + '.domain\n\nimport akka.actor.typed.{ActorRef, Behavior}\nimport akka.persistence.typed.PersistenceId\nimport akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}\nimport ' + name + 'Protocol._\n\nobject ' + name + 'Aggregate {\n' +
      '  sealed trait Request\n  final case class Execute(command: Command, replyTo: ActorRef[Reply]) extends Request\n  final case class GetState(replyTo: ActorRef[' + name + 'State]) extends Request\n' +
      '  sealed trait Reply\n  final case class Accepted(events: Vector[Event]) extends Reply\n  final case class Refused(code: String) extends Reply\n' + ingressMessages + authority +
      '  def apply(persistenceId: String, initial: ' + name + 'State, hosts: ' + name + 'Computations' + authorityParam + '): Behavior[Request] = {\n' +
      '    require(persistenceId != null && persistenceId.nonEmpty && hosts != null' + (external.length ? ' && authority != null' : '') + ', "explicit persistence identity and implementations required")\n' +
      '    EventSourcedBehavior[Request, Event, ' + name + 'State](PersistenceId.ofUniqueId(persistenceId), initial,\n' +
      '      (state, request) => request match {\n' + ingressCases + '        case GetState(reply) => Effect.none.thenRun((s: ' + name + 'State) => reply ! s)\n' +
      '        case Execute(command, reply) =>\n          val decision = command match {\n' +
      commands.map(c => '            case p: ' + symbol(c.ref.id) + ' => ' + name + 'Rules.' + symbol(c.ref.id) + '(state, p, hosts)\n').join('') +
      '          }\n          decision match {\n            case Left(code) => Effect.none.thenRun((_: ' + name + 'State) => reply ! Refused(code))\n' +
      '            case Right(events) => Effect.persist(events).thenRun((_: ' + name + 'State) => reply ! Accepted(events))\n          }\n      },\n' +
      '      (state, event) => ' + name + 'EventHandler(state, event))\n' +
      '      .eventAdapter(' + pkg + '.infrastructure.serialization.' + name + 'EventAdapter)\n' +
      '      .snapshotAdapter(' + pkg + '.infrastructure.serialization.' + name + 'SnapshotAdapter)\n  }\n}\nobject ' + name + 'AggregateFactory {\n' +
      '  def create(persistenceId: String, initial: ' + name + 'State, hosts: ' + name + 'Computations' + (external.length ? ', authority: ' + name + 'Aggregate.ExternalAuthority' : '') + '): Behavior[' + name + 'Aggregate.Request] = ' + name + 'Aggregate(persistenceId, initial, hosts' + (external.length ? ', authority' : '') + ')\n}\n';
    return entry(pathFor(pkg, 'domain/' + a.ref.id + 'Aggregate.scala'), body, 'aggregate', [a.source, ...commands.map(c => c.source)], footprint,
      ['State', 'Protocol', 'Rules', 'EventHandler', 'CommandHelpers'].map(s => pathFor(pkg, 'domain/' + a.ref.id + s + '.scala')));
  });
}
