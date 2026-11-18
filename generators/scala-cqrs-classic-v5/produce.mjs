import { buildRepositorySourceArtifacts } from '../scala-cqrs-classic-v4/produce.mjs';
import { emitClassicArtifacts } from '../../lib/classic-architecture/assembly.mjs';
import { buildArtifacts as buildDomainServices } from './mbt/domain-rules/index.mjs';
import { buildArtifacts as buildServices } from './mbt/services-connectors/index.mjs';
import { buildArtifacts as buildProjectionRepositories } from './mbt/projection-repositories/index.mjs';
import { buildArtifacts as buildBootstraps } from './mbt/bootstrap/index.mjs';
import { buildArtifacts as buildClassicTriggers } from './mbt/classic-trigger/index.mjs';
import { buildArtifacts as buildClassicSagas } from './mbt/classic-saga/index.mjs';
import { buildArtifacts as buildProjections } from './mbt/projection-execution/index.mjs';
import { buildArtifacts as buildSerialization } from './mbt/serialization/index.mjs';
import { buildArtifacts as buildApi } from './mbt/api/index.mjs';

export const version = '5';

// Family collectors are integrated only after independent source/input asset seals.
export function buildClassicSourceArtifacts(product, ctx) {
  return [...buildRepositorySourceArtifacts(product, ctx), ...buildDomainServices(product, ctx), ...buildServices(product, ctx),
    ...buildProjectionRepositories(product, ctx), ...buildClassicSagas(product, ctx), ...buildClassicTriggers(product, ctx),
    ...buildProjections(product, ctx), ...buildSerialization(product, ctx), ...buildApi(product, ctx), ...buildBootstraps(product, ctx)];
}
export function produce({ products, options }) {
  return emitClassicArtifacts(products['classic-architecture'], options, version, buildClassicSourceArtifacts);
}
