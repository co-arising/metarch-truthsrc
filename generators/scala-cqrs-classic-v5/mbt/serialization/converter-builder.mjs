import { FieldDef, assertUnhashedKnowledge } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { collectDependencies } from '../../../../lib/classic-architecture/types.mjs';
import { conventions as naming } from '../../../../lib/classic-architecture/naming.mjs';
import { AggregateConverterModel, ConverterDef } from './converter-model.mjs';
import { voOwnerMap, sharedMessageNames } from './proto-builder.mjs';
import { absoluteDomainPackage, requireMetadata, aggregateNoteIds } from './metadata.mjs';

function valueObjectPackage(vo, ctx) {
  const entity = ctx.metaRegistry.resolveAll('DomainEntityMetadata').find(e => e.state.name === vo.name);
  return entity === undefined ? absoluteDomainPackage(vo, ctx) : ctx.typeResolver.entityObjectPath(entity.name);
}

function buildConverter(name, fields, domainPackage, protoPackage, ctx) {
  const domainType = ctx.typeResolver.domainType(name, domainPackage);
  const poType = ctx.typeResolver.poType(naming.getProtoValueObjectPOName(name), protoPackage);
  const definitions = fields.map(field => FieldDef(field.name,
    ctx.typeResolver.resolveField(field.fieldType, field.optional), null, null, field.noteId ?? null));
  return ConverterDef(naming.getConverterObjectName(name), domainType, poType, definitions);
}

function valueObjectConverters(vos, protoPackage, ctx) {
  const owners = voOwnerMap(ctx);
  const shared = new Set(sharedMessageNames(ctx).map(name => naming.removeSuffix(name, 'PO')));
  return [...vos].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map(vo => {
    const host = owners[vo.name];
    const packageName = shared.has(vo.name) ? `${ctx.layout.infrastructure.proto.root}.shared_value_objects`
      : host ? ctx.layout.infrastructure.proto.eventPackage(host) : protoPackage;
    return buildConverter(vo.name, vo.fields, valueObjectPackage(vo, ctx), packageName, ctx);
  });
}

function converterDependencies(converters, primitiveConverter) {
  const refs = collectDependencies([
    ...converters.flatMap(c => c.fields.map(f => f.typeRef)),
    ...converters.map(c => c.participantType), ...converters.map(c => c.poType), primitiveConverter,
  ]);
  const primitiveNames = ['String', 'Long', 'Int', 'Double', 'Boolean', 'Unit', 'Any'];
  return refs.filter(ref => ref.packageName !== 'java.lang' && ref.packageName !== 'scala'
    && ref.packageName !== '' && !primitiveNames.includes(ref.name));
}

export function buildClassicAggregateConverter(meta, ctx) {
  assertUnhashedKnowledge(meta);
  const state = requireMetadata(ctx, 'ValueObjectMetadata', meta.stateRef, 'State');
  const family = requireMetadata(ctx, 'EventFamilyMetadata', meta.eventFamilyRef, 'EventFamily');
  const entity = ctx.metaRegistry.resolveByName('DomainEntityMetadata', meta.entityRef.targetName);
  const protoPackage = ctx.layout.infrastructure.proto.eventPackage(meta.name);
  const roots = [...state.fields.map(f => f.fieldType), ...family.events.flatMap(e => e.fields.map(f => f.fieldType))];
  // The original collector returns a metadata Set; this caller explicitly
  // sorts it by name. Its membership/extraction algorithm remains centralized.
  const vos = ctx.collectDeepDependencies('ValueObjectMetadata', roots)
    .filter(vo => vo.name !== state.name && !['Id', 'Currency'].includes(vo.name));
  const values = valueObjectConverters(vos, protoPackage, ctx);
  const eventPackage = entity === null || entity === undefined
    ? ctx.layout.domain.events.root : ctx.typeResolver.entityObjectPath(entity.name);
  const events = family.events.map(event => buildConverter(event.name, event.fields, eventPackage, protoPackage, ctx));
  const statePackage = entity !== null && entity !== undefined && entity.state.name === state.name
    ? ctx.typeResolver.entityObjectPath(entity.name) : absoluteDomainPackage(state, ctx);
  const stateConverter = buildConverter(state.name, state.fields.filter(f => !ctx.isStateFieldExcluded(f)),
    statePackage, protoPackage, ctx);
  const parentType = ctx.typeResolver.primitiveConverter;
  return AggregateConverterModel({
    selfType: ctx.typeResolver.aggregateProtoConverter(meta), parentType,
    valueObjects: values, events, state: stateConverter,
    dependencies: converterDependencies([...values, ...events, stateConverter], parentType),
    noteIds: aggregateNoteIds(meta),
  });
}
