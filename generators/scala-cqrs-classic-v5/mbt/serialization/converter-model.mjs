import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

export function AggregateConverterModel({
  selfType, parentType, valueObjects, events, state, dependencies, noteIds = [],
}) {
  return copyImmutableData({
    selfType, parentType, valueObjects, events, state, dependencies, noteIds,
  });
}

export function ConverterDef(objectName, participantType, poType, fields, repository = null) {
  return copyImmutableData({ objectName, participantType, poType, fields, repository });
}
