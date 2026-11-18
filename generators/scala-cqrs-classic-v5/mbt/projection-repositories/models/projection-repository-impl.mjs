import { copyImmutableData } from '../../../../../lib/immutable-data.mjs';

/** Frozen infrastructure/repository/ProjectionRepositoryImplModel.scala. */
export function ClassicProjectionRepositoryImplModel({
  selfType, interfaceType, dtoType, methods, dependencies,
  injectedConstructorParams = [], extraMembers = null, noteIds = [],
}) {
  return copyImmutableData({
    selfType, interfaceType, dtoType, methods, dependencies,
    injectedConstructorParams, extraMembers, noteIds,
  });
}

// bodyLogic is an explicit original Scala source slot, not whole-file content.
export function JdbcMethodModel(name, params, returnType, isFuture, bodyLogic) {
  return copyImmutableData({ name, params, returnType, isFuture, bodyLogic });
}
