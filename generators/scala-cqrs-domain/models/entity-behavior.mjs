import { typeRef } from '../../../lib/classic-architecture/types.mjs';
import { FieldDef } from './domain-entity.mjs';

// Plain-data counterparts of the pinned EntityBehaviorModel.scala. Keep the
// structural TypeRef roots, not rendered source or import-only replacements.
const sequence = values => Object.freeze([...values]);
const copyType = ref => typeRef(ref.name, ref.packageName, ref.typeParams);

export function StateMutationModel(eventType, logicCode, collectionFolds = []) {
  // The classic@2 slice has no formal-semantics input. This reserved Scala slot
  // stays empty; do not silently discard supplied folds or infer their meaning.
  if (!Array.isArray(collectionFolds) || collectionFolds.length !== 0) {
    throw new TypeError('Classic EntityBehavior requires empty collectionFolds');
  }
  return Object.freeze({
    eventType: copyType(eventType),
    logicCode,
    collectionFolds: sequence(collectionFolds),
  });
}

export function MethodModel(name, params, returnType, logicCode) {
  return Object.freeze({
    name,
    params: sequence([...params].map(param => FieldDef(
      param.name,
      copyType(param.typeRef),
      param.defaultValue,
      param.comment,
      param.noteId,
      param.description,
    ))),
    returnType: copyType(returnType),
    logicCode,
  });
}

export function EntityBehaviorModel(
  selfType, handlerTypeAlias, stateType, eventFamilyType, mutations, helperMethods, dependencies,
) {
  return Object.freeze({
    selfType: copyType(selfType),
    handlerTypeAlias: copyType(handlerTypeAlias),
    stateType: copyType(stateType),
    eventFamilyType: copyType(eventFamilyType),
    mutations: sequence([...mutations].map(mutation => StateMutationModel(
      mutation.eventType, mutation.logicCode, mutation.collectionFolds,
    ))),
    helperMethods: sequence([...helperMethods].map(method => MethodModel(
      method.name, method.params, method.returnType, method.logicCode,
    ))),
    dependencies: sequence([...dependencies].map(copyType)),
  });
}
