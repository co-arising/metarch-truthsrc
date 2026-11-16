import { copyImmutableData } from '../../lib/immutable-data.mjs';
import { aggregateNames, externalNames } from './aggregate-names.mjs';

export function buildAggregateModels({ products, options }) {
  const layout = products['reference-layout'];
  const aggregates = layout.declarations.filter(d => d.ref.kind === 'aggregate');
  const models = aggregates.flatMap(aggregate => {
    const owns = ref => ref.context === aggregate.ref.context && ref.owner[0] === aggregate.ref.id;
    const commands = layout.declarations.filter(d => d.ref.kind === 'command' && owns(d.ref));
    const external = products['domain-dependencies'].externalProducers.filter(p => owns(p.event));
    const names = aggregateNames(aggregate.ref, options), paths = names.paths;
    const commandSources = [aggregate.source, ...commands.map(c => c.source)];
    const shared = { aggregate, names, authority: external.length > 0 };
    const artifact = (kind, role, sources, dependencies) => ({ kind, path: paths[role], sources, dependencies });
    const groups = [
      ...(external.length ? [{ kind: 'external', producers: external.map(p => ({
        id: p.id, names: externalNames(p), outputType: p.outputType, source: p.source
      })) }] : []),
      { kind: 'query' },
      { kind: 'execution', commands: commands.map(c => ({ ref: c.ref, source: c.source })) }
    ];
    const aliases = ['Execute', 'GetState', 'Accepted', 'Refused', ...external.map(p => externalNames(p).ingress)];
    return [
      { ...shared, role: 'legacy', external: external.map(p => ({ names: externalNames(p), outputType: p.outputType })),
        artifact: artifact('aggregate', 'legacy', commandSources, [paths.state, paths.domainProtocol, paths.helpers, paths.bootstrap]) },
      { ...shared, role: 'protocol', carrierOwner: 'legacy', aliases,
        artifact: artifact('application-protocol', 'protocol', commandSources, [paths.legacy, paths.entity]) },
      { ...shared, role: 'behavior', groups,
        artifact: artifact('aggregate-behavior', 'behavior', [...commandSources, ...external.map(p => p.source)],
          [paths.protocol, paths.entity, paths.rules, paths.helpers, ...(external.length ? [paths.external] : [])]) },
      { ...shared, role: 'aggregate',
        artifact: artifact('aggregate-behavior', 'aggregate', [aggregate.source], [paths.protocol, paths.behavior, paths.helpers]) },
      { ...shared, role: 'factory',
        artifact: artifact('aggregate-factory', 'factory', [aggregate.source], [paths.protocol, paths.entity, paths.helpers]) },
      { ...shared, role: 'bootstrap', persistenceIdentity: 'unique-id',
        artifact: artifact('aggregate-bootstrap', 'bootstrap', [aggregate.source], [paths.factory, paths.aggregate, paths.entity, paths.fold, paths.adapter]) },
      { ...shared, role: 'repository', lookup: 'owned-local-actor-cache',
        artifact: artifact('aggregate-repository', 'repository', [aggregate.source], [paths.protocol]) }
    ];
  });
  return copyImmutableData(models);
}
