import { copyImmutableData } from '../../../../lib/immutable-data.mjs';
import { collectDependencies } from '../../../../lib/classic-architecture/types.mjs';

export const AggregateBootstrapType = 'AggregateBootstrapType';
export const SagaCoordinatorBootstrapType = 'SagaCoordinatorBootstrapType';
export const ProjectionBootstrapType = 'ProjectionBootstrapType';
export const SagaTransactorBootstrapType = 'SagaTransactorBootstrapType';

// BootstrapBuilder uses Set[TypeRef], NOT collectAllDependencies. Use the
// central structural equality/copy machinery, retaining only each root value.
// Recursive references are collected separately for output-file association.
export function bootstrapTypeSet(refs) {
  const values = new Map();
  for (const ref of refs) {
    const root = collectDependencies([ref])[0];
    const key = JSON.stringify(root);
    if (!values.has(key)) values.set(key, root);
  }
  return Object.freeze([...values.values()]);
}

/** The frozen BootstrapModel's complete fields plus detached input/typed refs.
 * Strings are original name/expression slots, never a complete source payload.
 * Several legacy fields are retained even though the v3 templates ignore them.
 */
export function ClassicBootstrapModel({
  selfType,
  bootstrapType,
  targetName,
  commandName,
  entityName = null,
  eventHandlerType = null,
  entityTypeKey = null,
  tags = null,
  sagaRepositories = [],
  transactorRepo = null,
  transactorContext = null,
  transactorContextInit = null,
  projectionRepo = null,
  sourceAggregateType = null,
  projectionAggregateTags = [],
  shards = 5,
  dependencies,
  noteIds = [],
  emptyStateArg = null,
  references = [],
  retained = null,
}) {
  return copyImmutableData({
    selfType, bootstrapType, targetName, commandName,
    entityName, eventHandlerType, entityTypeKey, tags, sagaRepositories,
    transactorRepo, transactorContext, transactorContextInit,
    projectionRepo, sourceAggregateType, projectionAggregateTags,
    shards, dependencies, noteIds, emptyStateArg, references, retained,
  });
}
