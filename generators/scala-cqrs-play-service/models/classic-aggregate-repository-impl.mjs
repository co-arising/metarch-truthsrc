import { copyImmutableData } from '../../../lib/immutable-data.mjs';

/**
 * Plain-data counterpart of the fixed Scala AggregateRepositoryImplModel.scala.
 * TypeRefs are shared records; Scala Seq/Set are arrays. Copy and freeze
 * detached data, including nested method TypeRefs and dependencies.
 */
export function ClassicAggregateRepositoryImplModel({
  selfType,
  interfaceType,
  entityTypeKey,
  aggregateType,
  methods,
  dependencies,
  noteIds = [],
}) {
  return copyImmutableData({
    selfType,
    interfaceType,
    entityTypeKey,
    aggregateType,
    methods,
    dependencies,
    noteIds,
  });
}

export function ShardedMethodModel(name, paramName, paramType, returnType) {
  return copyImmutableData({ name, paramName, paramType, returnType });
}
