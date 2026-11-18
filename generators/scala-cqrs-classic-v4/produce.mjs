import { artifact, emitClassicArtifacts } from '../../lib/classic-architecture/assembly.mjs';
import { buildAggregateSourceArtifacts } from '../scala-cqrs-classic-v3/produce.mjs';
import { buildClassicAggregateRepository } from '../scala-cqrs-play-service/build-classic-aggregate-repository-model.mjs';
import { renderClassicAggregateRepository } from '../scala-cqrs-play-service/templates/classic-aggregate-repository.mjs';
import { buildClassicAggregateRepositoryImpl } from '../scala-cqrs-play-service/build-classic-aggregate-repository-impl-model.mjs';
import { renderClassicAggregateRepositoryImpl } from '../scala-cqrs-play-service/templates/classic-aggregate-repository-impl.mjs';

export const version = '4';
export function buildRepositorySourceArtifacts(product, ctx) {
  const { system, source } = product;
  const selected = (layer, build, render, kind) => system[layer].repositories.flatMap((meta, i) => {
    if (meta._type !== 'AggregateRepositoryMetadata') return [];
    const location = { document: source.document, pointer: source.pointer + '/' + layer + '/repositories/' + i };
    return [artifact(build(meta, ctx), render, kind, location)];
  });
  return [...buildAggregateSourceArtifacts(product, ctx),
    ...selected('application', buildClassicAggregateRepository, renderClassicAggregateRepository, 'aggregate-repository-port'),
    ...selected('infrastructure', buildClassicAggregateRepositoryImpl, renderClassicAggregateRepositoryImpl, 'aggregate-repository-implementation')];
}

/** Eleven source families. Raw repository family defects are not runtime contracts. */
export function produce({ products, options }) {
  return emitClassicArtifacts(products['classic-architecture'], options, version, buildRepositorySourceArtifacts);
}
