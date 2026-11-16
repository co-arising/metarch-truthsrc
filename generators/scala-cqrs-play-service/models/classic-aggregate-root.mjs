import { copyImmutableData } from '../../../lib/immutable-data.mjs';

// Fixed Scala AggregateRootModel fields. Option is null; Seq/Set are arrays.
// Keep every field detached and immutable; no field carries a rendered file.
export function ClassicAggregateRootModel({
  selfType,
  commandFamilyType,
  stateType,
  eventType,
  behaviorObject,
  sharding,
  inlineEvents = [],
  inlineState = null,
  stepsFactory = null,
  contextType = null,
  dependencies,
  noteIds = [],
}) {
  return copyImmutableData({
    selfType,
    commandFamilyType,
    stateType,
    eventType,
    behaviorObject,
    sharding,
    inlineEvents,
    inlineState,
    stepsFactory,
    contextType,
    dependencies,
    noteIds,
  });
}

export function ShardingModel(typeKeyName, taggingBaseName, shardCount) {
  return copyImmutableData({ typeKeyName, taggingBaseName, shardCount });
}
