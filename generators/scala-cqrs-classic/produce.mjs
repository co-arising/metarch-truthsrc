import { artifact, emitClassicArtifacts } from '../../lib/classic-architecture/assembly.mjs';
import { buildAggregateProtocol } from '../scala-cqrs-application-protocol/build-model.mjs';
import { renderAggregateProtocol } from '../scala-cqrs-application-protocol/template.mjs';
import { buildCommandHelpers } from '../scala-cqrs-command-helper/build-models.mjs';
import { renderCommandHelpers } from '../scala-cqrs-command-helper/templates/command-helpers.mjs';
import { buildAggregateBehavior } from '../scala-cqrs-play-service/build-aggregate-behavior-model.mjs';
import { renderAggregateBehavior } from '../scala-cqrs-play-service/templates/classic-aggregate-behavior.mjs';
import { buildDomainEntity } from '../scala-cqrs-domain/builders/domain-entity.mjs';
import { renderDomainEntity } from '../scala-cqrs-domain/templates/domain-entity.mjs';

export const version = '1';
export function buildAggregateArtifacts(product, ctx) {
  const { system, source } = product;
  const entities = system.domain.entities.map((meta, i) => artifact(buildDomainEntity(meta, ctx), renderDomainEntity, 'domain-entity',
    { document: source.document, pointer: source.pointer + '/domain/entities/' + i }));
  const aggregates = system.application.aggregates.flatMap((meta, i) => {
    const location = { document: source.document, pointer: source.pointer + '/application/aggregates/' + i };
    return [artifact(buildAggregateProtocol(meta, ctx), renderAggregateProtocol, 'application-protocol', location),
      artifact(buildCommandHelpers(meta, ctx), renderCommandHelpers, 'command-helper', location),
      artifact(buildAggregateBehavior(meta, ctx), renderAggregateBehavior, 'aggregate-behavior', location)];
  });
  return [...entities, ...aggregates];
}

/** The original four-family target retains its exact versioned source plan. */
export function produce({ products, options }) {
  return emitClassicArtifacts(products['classic-architecture'], options, version, buildAggregateArtifacts);
}
