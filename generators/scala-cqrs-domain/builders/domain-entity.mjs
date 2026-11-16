import { collectDependencies, fqn, shouldImport, typeRef } from '../../../lib/classic-architecture/types.mjs';
import {
  assertUnhashedKnowledge, ConceptEndpoint, Container, Derived, DomainEntityModel, EventFamilyModel,
  EventModel, FieldDef, MappingMorphism, PathEndpoint, StateModel, WrittenBy,
} from '../models/domain-entity.mjs';

const emptyDefaults = Object.freeze({
  Map: 'Map.empty',
  List: 'List.empty',
  Seq: 'Seq.empty',
  Set: 'Set.empty',
  Vector: 'Vector.empty',
  Option: 'None',
});

const neutralValues = Object.freeze({
  Id: 'net.imadz.common.Id.of("00000000-0000-0000-0000-000000000001")',
  String: '""',
  Int: '1',
  Integer: '1',
  Long: '1L',
  Boolean: 'false',
  Double: '1.0',
  Float: '1.0',
  BigDecimal: 'BigDecimal(1)',
  Instant: 'null',
  Map: 'Map.empty',
  List: 'Nil',
  Seq: 'Nil',
  Set: 'Nil',
  Vector: 'Nil',
  Option: 'None',
});

// Exact raw literals, including Set/Vector -> Nil and unknown types -> null.
// In particular this does not replace the resolved CommonTypes.Id reference.
export function neutralValueFor(ref) {
  return Object.hasOwn(neutralValues, ref.name) ? neutralValues[ref.name] : 'null';
}

function emptyDefaultFor(ref) {
  return Object.hasOwn(emptyDefaults, ref.name) ? emptyDefaults[ref.name] : null;
}

function emittedStateFields(meta, ctx) {
  return meta.state.fields.filter(field => {
    const excluded = ctx.isStateFieldExcluded(field);
    if (excluded !== false) {
      throw new Error(`Classic DomainEntity does not admit excluded state fields: ${meta.state.name}.${field.name}`);
    }
    return true;
  });
}

function buildStateModel(meta, fields, ctx) {
  const definitions = fields.map(field => {
    const resolved = ctx.typeResolver.resolve(field.fieldType);
    // The raw builder does NOT read State.optional, State.defaultValue or
    // introducedIn. FieldDef.comment stays None; only type-name empties apply.
    return FieldDef(field.name, resolved, emptyDefaultFor(resolved), null, field.noteId, field.description);
  });
  return StateModel(meta.state.name, definitions, ctx.typeResolver.entityState(meta.state.name));
}

function buildEventField(field, ctx) {
  const resolved = ctx.typeResolver.resolve(field.fieldType);
  const fieldType = field.optional ? typeRef('Option', '', [resolved]) : resolved;
  return FieldDef(field.name, fieldType, field.optional ? 'None' : null, null, field.noteId, field.description);
}

function buildEventFamilyModel(meta, ctx) {
  const familyName = meta.eventFamily.name;
  const familyType = ctx.typeResolver.eventFamily(familyName);
  // Product export contains constructor fields, not DomainEntityMetadata.events
  // (a def). Reproduce that def, then the builder's name-only pseudo-event filter.
  const events = [...meta.eventFamily.events, meta.eventFamily]
    .filter(event => event.name !== familyName)
    .map(event => EventModel(
      event.name,
      typeRef(event.name, fqn(familyType)),
      event.fields.map(field => buildEventField(field, ctx)),
      [familyType],
    ));
  return EventFamilyModel(familyName, familyType, events, [ctx.knownFrameworkTypes.CborSerializable]);
}

function morphismsOf(fields, stateName) {
  return fields
    .filter(field => !(field.name === 'status' && field.noteId === null))
    .flatMap(field => field.writtenBy.map(path => MappingMorphism(
      WrittenBy, Derived, PathEndpoint(path), field.name, stateName, field.noteId,
    )));
}

function containerStatusMorphisms(fields, meta, selfType) {
  const status = fields.find(field => field.name === 'status' && field.noteId === null);
  if (!status) return [];
  // All original family events, not the emitted-name filter or writtenBy subset.
  return meta.eventFamily.events.map(event => MappingMorphism(
    WrittenBy,
    Derived,
    ConceptEndpoint(`event.${event.name}`, event.name, 'event', event.noteId),
    'status',
    meta.state.name,
    null,
    Container,
    `${selfType.packageName}.${selfType.name}`,
  ));
}

function dependenciesOf(state, family, pkg) {
  const roots = [
    ...state.fields.map(field => field.typeRef),
    ...family.events.flatMap(event => event.fields.map(field => field.typeRef)),
    ...family.events.flatMap(event => event.superTypes),
    ...family.superTypes,
  ];
  // The fixed Scala implementation filters here despite its contrary comment.
  return collectDependencies(roots).filter(ref => shouldImport(ref, pkg));
}

export function buildDomainEntity(meta, ctx) {
  assertUnhashedKnowledge(meta);
  assertUnhashedKnowledge(ctx);
  if (meta._type !== 'DomainEntityMetadata') {
    throw new TypeError('buildDomainEntity requires raw DomainEntityMetadata');
  }
  if (ctx.formalSemantics != null) {
    throw new Error('Classic DomainEntity does not admit formal semantics attachments');
  }
  const selfType = ctx.typeResolver.entity(meta.name);
  const fields = emittedStateFields(meta, ctx);
  const state = buildStateModel(meta, fields, ctx);
  const eventFamily = buildEventFamilyModel(meta, ctx);
  return DomainEntityModel(
    selfType,
    state,
    eventFamily,
    dependenciesOf(state, eventFamily, ctx.layout.domain.entities.root),
    [...morphismsOf(fields, meta.state.name), ...containerStatusMorphisms(fields, meta, selfType)],
    meta.noteId,
  );
}
