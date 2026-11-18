import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

// Frozen ApplicationServiceModel / QueryServiceModel with detached immutable
// TypeRef and FieldDef data. Extra retained metadata is NOT rendered code: it
// records original logic, parameter flags/anchors and descriptions the Scala
// builder/template deliberately ignores. No whole-file payload slot exists.
export function ApplicationServiceMethodModel(
  name, parameters, returnType, bodyLogic, invokesCommands, logic, parameterMetadata,
) {
  return copyImmutableData({
    name, parameters, returnType, bodyLogic, invokesCommands, logic, parameterMetadata,
  });
}

export function ApplicationServiceModel(
  selfType, methods, dependencySet, description, declaredDependencies,
) {
  return copyImmutableData({
    selfType, methods, dependencies: dependencySet.values,
    dependencyRepresentation: dependencySet.representation,
    description, declaredDependencies,
  });
}

export function QueryServiceMethodModel(
  name, parameters, returnType, bodyLogic, invokesCommands, logic, parameterMetadata,
) {
  return copyImmutableData({
    name, parameters, returnType, bodyLogic, invokesCommands, logic, parameterMetadata,
  });
}

export function QueryServiceModel(
  selfType, methods, structs, dependencySet, description, declaredRepositories, structMetadata,
) {
  return copyImmutableData({
    selfType, methods, structs, dependencies: dependencySet.values,
    dependencyRepresentation: dependencySet.representation,
    description, declaredRepositories, structMetadata,
  });
}
