import { packageFor, pathFor, symbol } from '../scala-cqrs-domain/naming.mjs';

export function aggregateNames(ref, options) {
  const pkg = packageFor(ref.context, options);
  const name = symbol(ref.id);
  const paths = Object.fromEntries(Object.entries({
    legacy: 'domain/' + ref.id + 'Aggregate.scala',
    protocol: 'application/aggregates/' + ref.id + 'Protocol.scala',
    aggregate: 'application/aggregates/' + ref.id + 'Aggregate.scala',
    behavior: 'application/aggregates/behaviors/' + ref.id + 'Behaviors.scala',
    factory: 'application/aggregates/' + ref.id + 'AggregateFactory.scala',
    repository: 'application/aggregates/' + ref.id + 'Repository.scala',
    bootstrap: 'infrastructure/bootstrap/' + ref.id + 'Bootstrap.scala',
    state: 'domain/' + ref.id + 'State.scala',
    domainProtocol: 'domain/' + ref.id + 'Protocol.scala',
    rules: 'domain/' + ref.id + 'Rules.scala',
    helpers: 'domain/' + ref.id + 'CommandHelpers.scala',
    entity: 'domain/entities/' + ref.id + 'Entity.scala',
    fold: 'domain/entities/behaviors/' + ref.id + 'EventHandler.scala',
    adapter: 'infrastructure/serialization/' + ref.id + 'Adapters.scala',
    external: 'domain/' + ref.id + 'ExternalEvents.scala'
  }).map(([role, relative]) => [role, pathFor(pkg, relative)]));
  return { package: pkg, name, protocol: name + 'Protocol', bootstrap: name + 'Bootstrap',
    legacy: pkg + '.domain.' + name + 'Aggregate', paths };
}

export function externalNames(producer) {
  const id = producer.id.replaceAll('-', '_');
  return { ingress: 'Ingest' + symbol(id), method: symbol(id), identity: symbol(id + '_identity') };
}
