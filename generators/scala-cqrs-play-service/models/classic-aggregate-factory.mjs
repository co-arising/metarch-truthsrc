import { copyImmutableData } from '../../../lib/immutable-data.mjs';

/**
 * Plain-data counterpart of the fixed Scala AggregateFactoryModel.scala.
 * TypeRefs and FieldDefs are shared records; Scala Seq/Set are arrays. Copy
 * and freeze detached data, including nested method parameters and TypeRefs.
 */
export function ClassicAggregateFactoryModel({
  selfType,
  aggregateType,
  entityTypeKey,
  commandFamily,
  factoryMethods,
  dependencies,
  noteIds = [],
}) {
  return copyImmutableData({
    selfType,
    aggregateType,
    entityTypeKey,
    commandFamily,
    factoryMethods,
    dependencies,
    noteIds,
  });
}

/** bodyLogic is the original model's method-expression source slot, not a file. */
export function FactoryMethodModel(name, parameters, returnType, bodyLogic, isInitialization = false) {
  return copyImmutableData({ name, parameters, returnType, bodyLogic, isInitialization });
}
