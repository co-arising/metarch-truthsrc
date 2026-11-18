import { FieldDef, assertUnhashedKnowledge } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { typeRef } from '../../../../lib/classic-architecture/types.mjs';
import { conventions as naming } from '../../../../lib/classic-architecture/naming.mjs';
import { copyImmutableData } from '../../../../lib/immutable-data.mjs';
import { ProtoFileModel, ProtoMessageModel, ProtoOneOfModel, NormalField } from './proto-model.mjs';
import { toProtoField } from './proto-type-mapper.mjs';
import { fieldComment, aggregateNoteIds } from './metadata.mjs';

export const getProtoEventName = name => naming.getProtoEventPOName(name);
export const getProtoStateName = name => naming.getProtoStatePOName(name);
export const getProtoEventUnionType = (name, ctx) => ctx.typeResolver.protoEvent(name);
export const getProtoEventFamilyType = (name, ctx) => ctx.typeResolver.protoEventFamily(name);

function structField(field, ctx) {
  return FieldDef(field.name, ctx.typeResolver.resolve(field.fieldType), null,
    fieldComment(field.introducedIn), field.noteId ?? null);
}

function eventField(field, ctx) {
  return FieldDef(field.name, ctx.typeResolver.resolveField(field.fieldType, field.optional), null,
    fieldComment(field.introducedIn), field.noteId ?? null);
}

function resolveStruct(ref, ctx) {
  const vo = ctx.metaRegistry.resolveByName('ValueObjectMetadata', ref.targetName);
  if (vo !== null && vo !== undefined) {
    return { name: vo.name, fields: vo.fields.filter(f => !ctx.isStateFieldExcluded(f)).map(f => structField(f, ctx)) };
  }
  const entity = ctx.metaRegistry.resolveByName('DomainEntityMetadata', ref.targetName);
  if (entity !== null && entity !== undefined) {
    return { name: entity.state.name,
      fields: entity.state.fields.filter(f => !ctx.isStateFieldExcluded(f)).map(f => structField(f, ctx)) };
  }
  return { name: ref.targetName, fields: [] }; // Original schema builder's empty-struct fallback.
}

function resolveEvents(ref, ctx) {
  const family = ctx.metaRegistry.resolveByName('EventFamilyMetadata', ref.targetName);
  return family === null || family === undefined ? []
    : family.events.map(event => ({ name: event.name, fields: event.fields.map(f => eventField(f, ctx)) }));
}

function isValueObject(t) {
  const primitives = ['String', 'Int', 'Long', 'Double', 'Boolean', 'BigDecimal',
    'Date', 'DateTime', 'UUID', 'Id', 'Currency'];
  return !primitives.includes(t.name) && !t.packageName.startsWith('java.') && !t.packageName.startsWith('scala.');
}

// This closure's membership follows the original builder, NOT the more general
// collectDeepDependencies. Structural equality includes packages/type arguments.
// Encounter order is an intermediate only; emitting a multi-member Scala Set
// requires the central ordering seam below, never JS Set insertion or sorting.
function referencedValueObjects(types, ctx, additions = null) {
  const found = new Map();
  function scan(t) {
    if (['List', 'Option', 'Seq', 'Vector', 'Map'].includes(t.name)) {
      t.typeParams.forEach(scan);
      return;
    }
    if (!isValueObject(t)) return;
    const value = typeRef(t.name, t.packageName, t.typeParams);
    const key = JSON.stringify(value);
    if (additions !== null) additions.push(value);
    if (found.has(key)) return;
    found.set(key, value);
    const meta = ctx.metaRegistry.resolveByName('ValueObjectMetadata', t.name);
    if (meta !== null && meta !== undefined) meta.fields.forEach(f => scan(ctx.typeResolver.resolve(f.fieldType)));
  }
  types.forEach(scan);
  return [...found.values()];
}

function referencedIteration(types, ctx) {
  const additions = [], values = referencedValueObjects(types, ctx, additions);
  if (values.length <= 1) return values;
  if (typeof ctx.scalaTypeRefSetIteration !== 'function') {
    throw new Error('Classic proto local VO order requires ctx.scalaTypeRefSetIteration(values, "mutable-set-to-immutable-set")');
  }
  return ctx.scalaTypeRefSetIteration(additions, 'mutable-set-to-immutable-set');
}

function aggregateFieldTypes(meta, ctx) {
  return [
    ...resolveStruct(meta.stateRef, ctx).fields.map(f => f.typeRef),
    ...resolveEvents(meta.eventFamilyRef, ctx).flatMap(event => event.fields.map(f => f.typeRef)),
  ];
}

function componentParents(vos, ctx) {
  const parent = new Map(vos.map(vo => [vo.name, vo.name]));
  function find(name) {
    let root = name;
    while (parent.get(root) !== root) root = parent.get(root);
    return root;
  }
  for (const vo of vos) {
    const refs = referencedValueObjects(vo.fields.map(f => ctx.typeResolver.resolve(f.fieldType)), ctx);
    for (const ref of refs) {
      if (!parent.has(ref.name)) continue;
      const a = find(vo.name), b = find(ref.name);
      if (a !== b) parent.set(a, b);
    }
  }
  return { parent, find };
}

/** AggregateRootProtoBuilder.voOwnerMap: connected-component ownership.
 * Return a detached immutable name -> host record (empty host means shared/cold).
 * State bodies are NOT automatically assigned to their aggregate; only fields
 * count as references in the original implementation.
 */
export function voOwnerMap(ctx) {
  const vos = ctx.metaRegistry.resolveAll('ValueObjectMetadata');
  const aggregates = [...ctx.metaRegistry.resolveAll('AggregateRootMetadata')]
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const { parent, find } = componentParents(vos, ctx);
  const users = new Map();
  for (const aggregate of aggregates) {
    for (const ref of referencedValueObjects(aggregateFieldTypes(aggregate, ctx), ctx)) {
      if (!parent.has(ref.name)) continue;
      const component = find(ref.name);
      if (!users.has(component)) users.set(component, new Set());
      users.get(component).add(aggregate.name);
    }
  }
  const owners = Object.create(null);
  for (const vo of vos) {
    const refs = users.get(find(vo.name));
    owners[vo.name] = refs?.size === 1 ? [...refs][0] : '';
  }
  return copyImmutableData(owners);
}

function valueObjectMessage(vo, ctx) {
  assertUnhashedKnowledge(vo);
  const fields = vo.fields.map((field, i) => toProtoField(field.name,
    ctx.typeResolver.resolveField(field.fieldType, field.optional), i + 1, ctx,
    fieldComment(field.introducedIn), field.noteId ?? null));
  return ProtoMessageModel(naming.getProtoValueObjectPOName(vo.name), fields);
}

export function buildClassicSharedProto(ctx) {
  const owners = voOwnerMap(ctx);
  const states = new Set(ctx.metaRegistry.resolveAll('AggregateRootMetadata').map(a => a.stateRef.targetName));
  const vos = new Map(ctx.metaRegistry.resolveAll('ValueObjectMetadata').map(vo => [vo.name, vo]));
  const names = Object.keys(owners).filter(name => owners[name] === '' && !states.has(name)).sort();
  const messages = names.flatMap(name => vos.has(name) ? [valueObjectMessage(vos.get(name), ctx)] : []);
  if (messages.length === 0) return null;
  const fileName = 'shared_value_objects.proto', packageName = ctx.layout.infrastructure.proto.root;
  return ProtoFileModel({ fileName, packageName,
    selfType: ctx.typeResolver.protoFile(fileName, packageName), messages });
}

export function sharedMessageNames(ctx) {
  const shared = buildClassicSharedProto(ctx);
  return Object.freeze(shared === null ? [] : shared.messages.map(message => message.name));
}

function voImports(refs, locals, owners) {
  const localNames = new Set(locals), imports = [];
  for (const ref of refs) {
    if (localNames.has(ref.name) || !Object.hasOwn(owners, ref.name)) continue;
    const host = owners[ref.name];
    imports.push(host === '' ? 'shared_value_objects.proto' : naming.getProtoFileName(host));
  }
  return [...new Set(imports)].sort();
}

function stateMessage(aggregate, struct, ctx) {
  const seen = new Set();
  const fields = struct.fields.filter(field => {
    if (seen.has(field.name)) return false;
    seen.add(field.name);
    return true;
  });
  return ProtoMessageModel(getProtoStateName(aggregate.name), fields.map((f, i) =>
    toProtoField(f.name, f.typeRef, i + 1, ctx, f.comment, f.noteId)));
}

function eventMessage(aggregate, event, ctx) {
  const fields = event.fields.map((f, i) => toProtoField(f.name, f.typeRef, i + 1, ctx, f.comment, f.noteId));
  if (aggregate.name !== 'User' && !event.fields.some(f => f.name === 'tenantId')) {
    fields.push(NormalField('tenantId', 'string', fields.length + 1));
  }
  return ProtoMessageModel(naming.getProtoEventItemPOName(event.name), fields);
}

export function buildClassicAggregateProto(meta, ctx) {
  assertUnhashedKnowledge(meta);
  const state = resolveStruct(meta.stateRef, ctx), events = resolveEvents(meta.eventFamilyRef, ctx);
  const fields = [...state.fields, ...events.flatMap(event => event.fields)];
  const refs = referencedIteration(fields.map(field => field.typeRef), ctx);
  const owners = voOwnerMap(ctx);
  const sharedNames = new Set(sharedMessageNames(ctx).map(name => naming.removeSuffix(name, 'PO')));
  const voByName = new Map(ctx.metaRegistry.resolveAll('ValueObjectMetadata').map(vo => [vo.name, vo]));
  const localNames = refs.map(t => t.name).filter(name => owners[name] === meta.name && !sharedNames.has(name));
  const locals = localNames.flatMap(name => voByName.has(name) ? [valueObjectMessage(voByName.get(name), ctx)] : []);
  const eventMessages = events.map(event => eventMessage(meta, event, ctx));
  const union = ProtoMessageModel(getProtoEventName(meta.name), [], [], [], [ProtoOneOfModel('event',
    eventMessages.map((message, i) => NormalField(
      naming.firstLower(naming.removeSuffix(message.name, 'PO')), message.name, i + 1)))]);
  const fileName = naming.getProtoFileName(meta.name), packageName = ctx.layout.infrastructure.proto.root;
  return ProtoFileModel({ fileName, packageName,
    selfType: ctx.typeResolver.protoFile(fileName, packageName),
    imports: voImports(refs, localNames, owners),
    messages: [...locals, ...eventMessages, union, stateMessage(meta, state, ctx)],
    noteIds: aggregateNoteIds(meta) });
}
