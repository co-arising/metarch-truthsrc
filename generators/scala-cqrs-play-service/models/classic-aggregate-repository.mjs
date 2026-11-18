import { copyImmutableData } from '../../../lib/immutable-data.mjs';

/**
 * Plain-data counterpart of the fixed Scala AggregateRepositoryModel.scala.
 * Copy and freeze all eight fields, including nested method FieldDefs and
 * TypeRefs; Scala Seq/Set are arrays with structural dependency identity.
 */
export function ClassicAggregateRepositoryModel({
  selfType,
  superInterface,
  isImplementedBy,
  aggregateType,
  methods,
  dependencies,
  noteIds = [],
  noteId = null,
}) {
  return copyImmutableData({
    selfType,
    superInterface,
    isImplementedBy,
    aggregateType,
    methods,
    dependencies,
    noteIds,
    noteId,
  });
}

export function RepositoryMethodModel(name, parameters, returnType, logicIntent) {
  return copyImmutableData({ name, parameters, returnType, logicIntent });
}
