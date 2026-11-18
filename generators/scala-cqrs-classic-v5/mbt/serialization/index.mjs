import { classicArtifact, classicProtoArtifact } from '../../../../lib/classic-architecture/paths.mjs';
import { buildClassicAggregateProto, buildClassicSharedProto } from './proto-builder.mjs';
import { buildClassicAggregateConverter } from './converter-builder.mjs';
import { buildClassicEventAdapter, buildClassicSnapshotAdapter } from './adapter-builder.mjs';
import { renderClassicProto } from './proto-template.mjs';
import { renderClassicAggregateConverter } from './converter-template.mjs';
import { renderClassicEventAdapter } from './event-adapter-template.mjs';
import { renderClassicSnapshotAdapter } from './snapshot-adapter-template.mjs';

export {
  ProtoFileModel, ProtoEnumModel, ProtoMessageModel, NormalField, MapField, ProtoOneOfModel,
} from './proto-model.mjs';
export { AggregateConverterModel, ConverterDef } from './converter-model.mjs';
export {
  AdapterModel, AdapterMapping, FieldMapping, ConverterMethodModel,
  Direct, CustomConversion, EnumMapping, OptionWrap,
} from './adapter-model.mjs';
export {
  getProtoEventName, getProtoStateName, getProtoEventUnionType, getProtoEventFamilyType,
  voOwnerMap, sharedMessageNames,
} from './proto-builder.mjs';
export { toProtoTypeString, toProtoField } from './proto-type-mapper.mjs';
export {
  buildClassicAggregateProto, buildClassicSharedProto, buildClassicAggregateConverter,
  buildClassicEventAdapter, buildClassicSnapshotAdapter,
  renderClassicProto, renderClassicAggregateConverter, renderClassicEventAdapter, renderClassicSnapshotAdapter,
};

function converterReferences(model) {
  const converters = [...model.valueObjects, ...model.events, ...(model.state === null ? [] : [model.state])];
  return [model.parentType, ...converters.flatMap(converter => [
    converter.participantType, converter.poType, ...converter.fields.map(field => field.typeRef),
  ])];
}

function aggregateArtifacts(meta, location, ctx) {
  const proto = buildClassicAggregateProto(meta, ctx);
  const converter = buildClassicAggregateConverter(meta, ctx);
  const event = buildClassicEventAdapter(meta, ctx);
  const snapshot = buildClassicSnapshotAdapter(meta, ctx);
  return [
    classicProtoArtifact(proto, renderClassicProto, location, ctx),
    classicArtifact(converter, renderClassicAggregateConverter, 'proto-converter', location, ctx,
      converterReferences(converter)),
    classicArtifact(event, renderClassicEventAdapter, 'event-adapter', location, ctx,
      [event.scalaRootType, event.protoRootType, event.converterTrait]),
    classicArtifact(snapshot, renderClassicSnapshotAdapter, 'snapshot-adapter', location, ctx,
      [snapshot.scalaRootType, snapshot.protoRootType, snapshot.converterTrait]),
  ];
}

/** CQRSApplicationGenerator 3.1/3.1b, in original output order. Pure descriptors
 * only; Main owns collection ordering, proto member file associations, stamping
 * and final write/apply. Classic Sagas do NOT receive additional serializers.
 */
export function buildArtifacts(product, ctx) {
  const { system, source } = product;
  const artifacts = system.application.aggregates.flatMap((meta, i) => aggregateArtifacts(meta, {
    document: source.document, pointer: source.pointer + '/application/aggregates/' + i,
  }, ctx));
  const shared = buildClassicSharedProto(ctx);
  if (shared !== null) {
    // A shared graph-derived file has no single originating VO/aggregate; keep
    // the real system source container rather than inventing one query/VO owner.
    artifacts.push(classicProtoArtifact(shared, renderClassicProto, {
      document: source.document, pointer: source.pointer,
    }, ctx));
  }
  return artifacts;
}
