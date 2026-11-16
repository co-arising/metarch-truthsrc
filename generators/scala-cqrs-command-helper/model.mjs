/**
 * Fixed baseline/bc CommandHelperModel.scala data contract.
 * TypeRefs come from the shared classic-architecture context/types module.
 * Only the three original method RHS slots contain Scala source strings.
 * Artifact registration, paths, writer stamps and mappings belong to assembly.
 */

/**
 * @typedef {Readonly<{name: string, packageName: string, typeParams: readonly TypeRef[]}>} TypeRef
 *
 * @typedef {Readonly<{
 *   name: string,
 *   commandType: TypeRef,
 *   stateType: TypeRef,
 *   paramType: TypeRef,
 *   replyType: TypeRef,
 *   errorType: TypeRef,
 *   toParamLogic: string,
 *   failureReplyLogic: string,
 *   successReplyLogic: string
 * }>} CommandHelperModel
 *
 * @typedef {Readonly<{
 *   selfType: TypeRef,
 *   helpers: readonly CommandHelperModel[],
 *   dependencies: readonly TypeRef[],
 *   noteIds: readonly string[]
 * }>} CommandHelpersModel
 */

/** @returns {CommandHelperModel} */
export function commandHelperModel({
  name, commandType, stateType, paramType, replyType, errorType,
  toParamLogic, failureReplyLogic, successReplyLogic,
}) {
  return Object.freeze({
    name, commandType, stateType, paramType, replyType, errorType,
    toParamLogic, failureReplyLogic, successReplyLogic,
  });
}

// Scala Set[TypeRef] uses structural equality, including nested type parameters.
// Do not expand dependencies here: the builder deliberately expands only P/R.
function typeIdentity(ref) {
  return [ref.name, ref.packageName, ref.typeParams.map(typeIdentity)];
}

/** @returns {CommandHelpersModel} */
export function commandHelpersModel({ selfType, helpers, dependencies, noteIds = [] }) {
  const distinct = new Map(dependencies.map(ref => [JSON.stringify(typeIdentity(ref)), ref]));
  return Object.freeze({
    selfType,
    helpers: Object.freeze([...helpers]),
    dependencies: Object.freeze([...distinct.values()]),
    noteIds: Object.freeze([...noteIds]),
  });
}
