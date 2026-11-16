// Plain-data counterparts of the fixed Scala AggregateProtocolModel,
// AggregateRootModel command models, DomainEntityModel.StateModel and FieldDef.
// TypeRefs come from lib/classic-architecture/types.mjs; dependencies represent
// a Scala Set structurally, while all other sequences retain their input order.

/** @typedef {{name: string, packageName: string, typeParams: readonly TypeRef[]}} TypeRef */

/**
 * @param {{name: string, typeRef: TypeRef, defaultValue?: string|null,
 *   comment?: string|null, noteId?: string|null, description?: string}} fields
 */
export function FieldDef({
  name,
  typeRef,
  defaultValue = null,
  comment = null,
  noteId = null,
  description = ''
}) {
  return Object.freeze({ name, typeRef, defaultValue, comment, noteId, description });
}

/** @param {{name: string, commands: readonly object[], superTypes?: readonly TypeRef[]}} fields */
export function CommandFamilyModel({ name, commands, superTypes = [] }) {
  return Object.freeze({
    name,
    commands: Object.freeze([...commands]),
    superTypes: Object.freeze([...superTypes])
  });
}

/** @param {{name: string, fields: readonly object[], superTypes?: readonly TypeRef[]}} model */
export function CommandModel({ name, fields, superTypes = [] }) {
  return Object.freeze({
    name,
    fields: Object.freeze([...fields]),
    superTypes: Object.freeze([...superTypes])
  });
}

/** @param {{name: string, fields: readonly object[], superTypes?: readonly TypeRef[]}} model */
export function CommandReplyModel({ name, fields, superTypes = [] }) {
  return Object.freeze({
    name,
    fields: Object.freeze([...fields]),
    superTypes: Object.freeze([...superTypes])
  });
}

/** @param {{name: string, fields: readonly object[], selfType: TypeRef}} model */
export function StateModel({ name, fields, selfType }) {
  return Object.freeze({ name, fields: Object.freeze([...fields]), selfType });
}

/**
 * The builder always supplies state=null; the original template also admits a
 * manually supplied StateModel. No writer stamp, rendered content or context is
 * stored in the model. FieldDef.noteId and noteIds remain unannotated source IDs.
 *
 * @param {{selfType: TypeRef, commandFamily: object, replies: readonly object[],
 *   state?: object|null, stateType?: TypeRef|null, eventType?: TypeRef|null,
 *   dependencies: readonly TypeRef[], noteIds?: readonly string[]}} fields
 */
export function AggregateProtocolModel({
  selfType,
  commandFamily,
  replies,
  state = null,
  stateType = null,
  eventType = null,
  dependencies,
  noteIds = []
}) {
  return Object.freeze({
    selfType,
    commandFamily,
    replies: Object.freeze([...replies]),
    state,
    stateType,
    eventType,
    dependencies: Object.freeze([...dependencies]),
    noteIds: Object.freeze([...noteIds])
  });
}
