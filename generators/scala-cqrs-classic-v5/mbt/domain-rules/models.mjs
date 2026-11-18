import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

// Frozen DomainServiceModel.scala value semantics: no visibility flag or
// whole-file payload. Detach and deeply freeze every TypeRef/FieldDef/sequence.
export function DomainServiceMethodModel(name, parameters, returnType, logicCode) {
  return copyImmutableData({ name, parameters, returnType, logicCode });
}

export function DomainServiceModel(selfType, superInterface, methods, dependencies) {
  return copyImmutableData({ selfType, superInterface, methods, dependencies });
}
