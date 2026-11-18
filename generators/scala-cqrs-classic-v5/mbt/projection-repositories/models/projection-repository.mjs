import { copyImmutableData } from '../../../../../lib/immutable-data.mjs';

/** Frozen application/ProjectionRepositoryModel.scala, including empty defaults. */
export function ClassicProjectionRepositoryModel({
  selfType, isImplementedBy, dtoModel, methods, dependencies,
  morphisms = [], noteIds = [],
}) {
  return copyImmutableData({
    selfType, isImplementedBy, dtoModel, methods, dependencies, morphisms, noteIds,
  });
}

export function StructModel(name, companionName, fields) {
  return copyImmutableData({ name, companionName, fields });
}

// RelationVocabulary.scala: rmOf has no registered propagation obligation.
export const RmOf = copyImmutableData({
  _type: 'RmOf', rel: 'rmOf',
  edgeKind: { _type: 'Derives', id: 'derives' },
  obligation: { _type: 'Unspecified', id: '' },
});
