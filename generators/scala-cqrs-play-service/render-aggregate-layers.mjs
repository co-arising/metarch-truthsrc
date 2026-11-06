import { entry, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { renderAggregate } from '../scala-cqrs-domain/render-domain.mjs';

export function renderAggregateLayers(context, footprint) {
  const { products, options } = context, layout = products['reference-layout'];
  const results = renderAggregate(context, footprint, true);
  for (const a of layout.declarations.filter(d => d.ref.kind === 'aggregate')) {
    const pkg = packageFor(a.ref.context, options), name = symbol(a.ref.id);
    const commands = layout.declarations.filter(d => d.ref.kind === 'command' && d.ref.context === a.ref.context && d.ref.owner[0] === a.ref.id);
    const external = products['domain-dependencies'].externalProducers.filter(p => p.event.context === a.ref.context && p.event.owner[0] === a.ref.id);
    const old = pkg + '.domain.' + name + 'Aggregate', protocol = name + 'Protocol', bootstrap = name + 'Bootstrap';
    const authority = external.length ? ', authority: ExternalAuthority' : '';
    const authorityArgument = external.length ? ', authority' : '';
    const paths = {
      legacy: pathFor(pkg, 'domain/' + a.ref.id + 'Aggregate.scala'),
      protocol: pathFor(pkg, 'application/aggregates/' + a.ref.id + 'Protocol.scala'),
      aggregate: pathFor(pkg, 'application/aggregates/' + a.ref.id + 'Aggregate.scala'),
      behaviors: pathFor(pkg, 'application/aggregates/behaviors/' + a.ref.id + 'Behaviors.scala'),
      factory: pathFor(pkg, 'application/aggregates/' + a.ref.id + 'AggregateFactory.scala'),
      repository: pathFor(pkg, 'application/aggregates/' + a.ref.id + 'Repository.scala'),
      bootstrap: pathFor(pkg, 'infrastructure/bootstrap/' + a.ref.id + 'Bootstrap.scala'),
      state: pathFor(pkg, 'domain/' + a.ref.id + 'State.scala'),
      domainProtocol: pathFor(pkg, 'domain/' + a.ref.id + 'Protocol.scala'),
      rules: pathFor(pkg, 'domain/' + a.ref.id + 'Rules.scala'),
      helpers: pathFor(pkg, 'domain/' + a.ref.id + 'CommandHelpers.scala'),
      entity: pathFor(pkg, 'domain/entities/' + a.ref.id + 'Entity.scala'),
      fold: pathFor(pkg, 'domain/entities/behaviors/' + a.ref.id + 'EventHandler.scala'),
      adapter: pathFor(pkg, 'infrastructure/serialization/' + a.ref.id + 'Adapters.scala')
    };
    const ingress = p => 'Ingest' + symbol(p.id.replaceAll('-', '_'));
    const messages = external.map(p => '  final case class ' + ingress(p) + '(output: ' + typeName(p.outputType, options) + ', authorization: String, replyTo: ActorRef[Reply]) extends Request\n').join('');
    const legacy = 'package ' + pkg + '.domain\n\nimport akka.actor.typed.{ActorRef, Behavior}\nimport ' + name + 'Protocol._\n\nobject ' + name + 'Aggregate {\n' +
      '  sealed trait Request\n  final case class Execute(command: Command, replyTo: ActorRef[Reply]) extends Request\n  final case class GetState(replyTo: ActorRef[' + name + 'State]) extends Request\n' +
      '  sealed trait Reply\n  final case class Accepted(events: Vector[Event]) extends Reply\n  final case class Refused(code: String) extends Reply\n' + messages +
      (external.length ? '  trait ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean }\n' : '') +
      '  def apply(persistenceId: String, initial: ' + name + 'State, hosts: ' + name + 'Computations' + authority + '): Behavior[Request] =\n' +
      '    ' + pkg + '.infrastructure.bootstrap.' + bootstrap + '.create(persistenceId, initial, hosts' + authorityArgument + ')\n}\n' +
      'object ' + name + 'AggregateFactory {\n' +
      '  def create(persistenceId: String, initial: ' + name + 'State, hosts: ' + name + 'Computations' + (external.length ? ', authority: ' + name + 'Aggregate.ExternalAuthority' : '') + '): Behavior[' + name + 'Aggregate.Request] = ' +
      name + 'Aggregate(persistenceId, initial, hosts' + authorityArgument + ')\n}\n';
    results.push(entry(paths.legacy, legacy, 'aggregate', [a.source, ...commands.map(c => c.source)], footprint, [paths.state, paths.domainProtocol, paths.helpers, paths.bootstrap]));
    let api = 'package ' + pkg + '.application.aggregates\n\nimport akka.persistence.typed.scaladsl.Effect\nimport ' + pkg + '.domain.entities.' + name + 'Entity.{State, Event}\n\nobject ' + protocol + ' {\n' +
      '  type Command = ' + old + '.Request\n  type Reply = ' + old + '.Reply\n  type CommandPayload = ' + pkg + '.domain.' + name + 'Protocol.Command\n' +
      '  type CommandHandler = (State, Command) => Effect[Event, State]\n';
    for (const id of ['Execute', 'GetState', 'Accepted', 'Refused', ...external.map(ingress)]) api += '  type ' + id + ' = ' + old + '.' + id + '\n  val ' + id + ': ' + old + '.' + id + '.type = ' + old + '.' + id + '\n';
    if (external.length) api += '  type ExternalAuthority = ' + old + '.ExternalAuthority\n';
    api += '}\n';
    results.push(entry(paths.protocol, api, 'application-protocol', [a.source, ...commands.map(c => c.source)], footprint, [paths.legacy, paths.entity]));
    let behavior = 'package ' + pkg + '.application.aggregates.behaviors\n\nimport akka.persistence.typed.scaladsl.Effect\nimport ' + pkg + '.domain._\nimport ' + pkg + '.domain.entities.' + name + 'Entity.{State, Event}\nimport ' + pkg + '.application.aggregates.' + protocol + '._\n\nobject ' + name + 'Behaviors {\n' +
      '  def apply(hosts: ' + name + 'Computations' + authority + '): CommandHandler = (state, request) => request match {\n';
    const mappings = [];
    for (const p of external) {
      const start = behavior.length, method = symbol(p.id.replaceAll('-', '_'));
      behavior += '    case ' + ingress(p) + '(output, authorization, reply) =>\n' +
        '      if (!authority.authorize(' + JSON.stringify(p.id) + ', authorization, ' + name + 'ExternalEvents.' + symbol(p.id.replaceAll('-', '_') + '_identity') + '(output))) Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))\n' +
        '      else Effect.persist(' + name + 'ExternalEvents.' + method + '(output)).thenRun((_: State) => reply ! Accepted(Vector(' + name + 'ExternalEvents.' + method + '(output))))\n';
      const span = { start, end: behavior.length }; mappings.push({ source: p.source, span, scope: span });
    }
    behavior += '    case GetState(reply) => Effect.none.thenRun((s: State) => reply ! s)\n' +
      '    case Execute(command, reply) =>\n      val decision = command match {\n';
    for (const c of commands) {
      const start = behavior.length;
      behavior += '        case p: ' + pkg + '.domain.' + name + 'Protocol.' + symbol(c.ref.id) + ' => ' + name + 'Rules.' + symbol(c.ref.id) + '(state, p, hosts)\n';
      const span = { start, end: behavior.length }; mappings.push({ source: c.source, span, scope: span });
    }
    behavior += '      }\n      decision match {\n' +
      '        case Left(code) => Effect.none.thenRun((_: State) => reply ! Refused(code))\n' +
      '        case Right(events) => Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))\n      }\n  }\n}\n';
    results.push(entry(paths.behaviors, behavior, 'aggregate-behavior', [a.source, ...commands.map(c => c.source), ...external.map(p => p.source)], footprint,
      [paths.protocol, paths.entity, paths.rules, paths.helpers, ...(external.length ? [pathFor(pkg, 'domain/' + a.ref.id + 'ExternalEvents.scala')] : [])], mappings));
    const aggregate = 'package ' + pkg + '.application.aggregates\n\nimport ' + pkg + '.domain.' + name + 'Computations\nimport ' + protocol + '._\n\nobject ' + name + 'Aggregate {\n' +
      '  def commandHandler(hosts: ' + name + 'Computations' + authority + '): CommandHandler =\n    behaviors.' + name + 'Behaviors(hosts' + authorityArgument + ')\n}\n';
    results.push(entry(paths.aggregate, aggregate, 'aggregate-behavior', [a.source], footprint, [paths.protocol, paths.behaviors, paths.helpers]));
    const factory = 'package ' + pkg + '.application.aggregates\n\nimport akka.actor.typed.Behavior\nimport ' + pkg + '.domain.' + name + 'Computations\nimport ' + pkg + '.domain.entities.' + name + 'Entity.State\nimport ' + protocol + '._\n\ntrait ' + name + 'AggregateFactory {\n' +
      '  def create(persistenceId: String, initial: State, hosts: ' + name + 'Computations' + authority + '): Behavior[Command]\n}\n';
    results.push(entry(paths.factory, factory, 'aggregate-factory', [a.source], footprint, [paths.protocol, paths.entity, paths.helpers]));
    const boot = 'package ' + pkg + '.infrastructure.bootstrap\n\nimport akka.actor.typed.Behavior\nimport akka.persistence.typed.PersistenceId\nimport akka.persistence.typed.scaladsl.EventSourcedBehavior\n' +
      'import ' + pkg + '.domain.' + name + 'Computations\nimport ' + pkg + '.domain.entities.' + name + 'Entity.{State, Event}\n' +
      'import ' + pkg + '.domain.entities.behaviors.' + name + 'EventHandler\nimport ' + pkg + '.application.aggregates.{' + name + 'Aggregate, ' + name + 'AggregateFactory}\n' +
      'import ' + pkg + '.application.aggregates.' + protocol + '._\nimport ' + pkg + '.infrastructure.serialization.{' + name + 'EventAdapter, ' + name + 'SnapshotAdapter}\n\nobject ' + bootstrap + ' extends ' + name + 'AggregateFactory {\n' +
      '  def create(persistenceId: String, initial: State, hosts: ' + name + 'Computations' + authority + '): Behavior[Command] = {\n' +
      '    require(persistenceId != null && persistenceId.nonEmpty && hosts != null' + (external.length ? ' && authority != null' : '') + ', "explicit persistence identity and implementations required")\n' +
      '    EventSourcedBehavior[Command, Event, State](PersistenceId.ofUniqueId(persistenceId), initial,\n' +
      '      ' + name + 'Aggregate.commandHandler(hosts' + authorityArgument + '), ' + name + 'EventHandler.apply)\n' +
      '      .eventAdapter(' + name + 'EventAdapter)\n      .snapshotAdapter(' + name + 'SnapshotAdapter)\n  }\n}\n';
    results.push(entry(paths.bootstrap, boot, 'aggregate-bootstrap', [a.source], footprint, [paths.factory, paths.aggregate, paths.entity, paths.fold, paths.adapter]));
    const repository = `package ${pkg}.application.aggregates

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
    results.push(entry(paths.repository, repository, 'aggregate-repository', [a.source], footprint, [paths.protocol]));
  }
  return results;
}
