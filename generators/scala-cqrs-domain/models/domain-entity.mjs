// Plain-data counterparts of the fixed classic DomainEntityModel and TypeSystem.
// Optional Scala values are null; sequences/sets are immutable arrays.
const sequence = values => Object.freeze([...values]);

// The shared classic API has no element-hash side attachment. Do not accept an
// explicit Scala hash table and silently render unhashed knowledge annotations.
export function assertUnhashedKnowledge(value) {
  for (const key of ['elementHashById', 'elementHashes']) {
    if (Object.hasOwn(value, key)) {
      throw new Error(`Classic DomainEntity does not admit ${key}; knowledge hash attachments require a shared annotation API`);
    }
  }
}

export function FieldDef(name, typeRef, defaultValue = null, comment = null, noteId = null, description = '') {
  return Object.freeze({ name, typeRef, defaultValue, comment, noteId, description });
}

export function StateModel(name, fields, selfType) {
  return Object.freeze({ name, fields: sequence(fields), selfType });
}

export function EventFamilyModel(name, selfType, events, superTypes = []) {
  return Object.freeze({ name, selfType, events: sequence(events), superTypes: sequence(superTypes) });
}

export function EventModel(name, selfType, fields, superTypes = []) {
  return Object.freeze({ name, selfType, fields: sequence(fields), superTypes: sequence(superTypes) });
}

export function DomainEntityModel(selfType, state, eventFamily, dependencies, morphisms = [], noteId = null) {
  return Object.freeze({
    selfType,
    state,
    eventFamily,
    dependencies: sequence(dependencies),
    morphisms: sequence(morphisms),
    noteId,
    noteIds: sequence(noteId === null ? [] : [noteId]),
    fqn: `${selfType.packageName}.${selfType.name}`,
  });
}

// The original registry relation is NOT the physical Scala nesting: event case
// classes render directly in Entity, although registerTo puts them under Family.
// Keep that raw distinction; the assembler owns any physical-path bookkeeping.
export function registerDomainEntity(model, registry) {
  let result = registry.register(model);
  result = result.registerNested(model.eventFamily.selfType, model.selfType);
  for (const event of model.eventFamily.events) {
    result = result.registerNested(event.selfType, model.eventFamily.selfType);
  }
  return result.registerNested(model.state.selfType, model.selfType);
}

// KnowledgeMorphism.scala / RelationVocabulary.scala value semantics. These are
// model facts, not ledger rows: the writer still supplies path and consumer.
export const WrittenBy = Object.freeze({
  _type: 'WrittenBy',
  rel: 'writtenBy',
  edgeKind: Object.freeze({ _type: 'Derives', id: 'derives' }),
  obligation: Object.freeze({ _type: 'Regen', id: 'REGEN' }),
});
export const Derived = Object.freeze({ _type: 'Derived', id: '派生' });
export const Member = Object.freeze({ _type: 'Member', id: 'member' });
export const Container = Object.freeze({ _type: 'Container', id: 'container' });

export function PathEndpoint(path) {
  if (typeof path !== 'string') throw new TypeError('DomainEntity writtenBy paths must be strings');
  const dot = path.indexOf('.');
  return Object.freeze({
    _type: 'PathEndpoint',
    path,
    event: dot === -1 ? path : path.slice(0, dot),
    fqn: `eventPath:${path}`,
    name: path,
    category: 'eventPath',
    noteId: null,
  });
}

export function ConceptEndpoint(fqn, name, category, noteId) {
  return Object.freeze({ _type: 'ConceptEndpoint', fqn, name, category, noteId });
}

export function MappingMorphism(
  relation, dimension, source, member,
  memberOwner = null, memberNoteId = null, landing = Member, containerFqn = null,
) {
  return Object.freeze({ relation, dimension, source, member, memberOwner, memberNoteId, landing, containerFqn });
}
