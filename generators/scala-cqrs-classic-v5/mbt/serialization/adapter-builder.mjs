import { collectDependencies } from '../../../../lib/classic-architecture/types.mjs';
import { conventions as naming } from '../../../../lib/classic-architecture/naming.mjs';
import { assertUnhashedKnowledge } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { AdapterModel, AdapterMapping } from './adapter-model.mjs';
import { absoluteDomainPackage, requireMetadata, aggregateNoteIds } from './metadata.mjs';

export function buildClassicEventAdapter(meta, ctx) {
  assertUnhashedKnowledge(meta);
  const family = requireMetadata(ctx, 'EventFamilyMetadata', meta.eventFamilyRef, 'EventFamily');
  // Preserve the raw EntityRef target, not a guessed Entity suffix/owner name.
  const domainPackage = ctx.typeResolver.entityObjectPath(meta.entityRef.targetName);
  const scalaRootType = ctx.typeResolver.scalaRootType(family.name, domainPackage);
  const protoRootType = ctx.typeResolver.protoEventFamily(meta.name);
  const outerProto = ctx.typeResolver.protoEvent(meta.name);
  const converterTrait = ctx.typeResolver.aggregateProtoConverter(meta);
  const mappings = family.events.map(event => AdapterMapping(
    event.name, naming.getProtoOneOfCaseName(event.name), `${event.name}PO`));
  const domainEvents = family.events.map(event => ctx.typeResolver.domainEvent(event.name, domainPackage));
  return AdapterModel({
    selfType: ctx.typeResolver.aggregateEventAdapter(meta), scalaRootType, protoRootType,
    mappings, converterTrait,
    dependencies: collectDependencies([ctx.typeResolver.eventAdapter, ctx.typeResolver.eventSeq,
      scalaRootType, protoRootType, outerProto, converterTrait, ...domainEvents]),
    noteIds: aggregateNoteIds(meta),
  });
}

export function buildClassicSnapshotAdapter(meta, ctx) {
  assertUnhashedKnowledge(meta);
  const state = requireMetadata(ctx, 'ValueObjectMetadata', meta.stateRef, 'State');
  const entity = ctx.metaRegistry.resolveByName('DomainEntityMetadata', meta.entityRef.targetName);
  const statePackage = entity !== null && entity !== undefined && entity.state.name === state.name
    ? ctx.typeResolver.entityObjectPath(meta.entityRef.targetName) : absoluteDomainPackage(state, ctx);
  const scalaRootType = ctx.typeResolver.scalaStateType(state.name, statePackage);
  const protoRootType = ctx.typeResolver.protoState(meta.name);
  const converterTrait = ctx.typeResolver.aggregateProtoConverter(meta);
  return AdapterModel({
    selfType: ctx.typeResolver.aggregateSnapshotAdapter(meta), scalaRootType, protoRootType,
    mappings: [AdapterMapping(state.name, null, `${state.name}PO`)], converterTrait, isSnapshot: true,
    dependencies: collectDependencies([ctx.typeResolver.snapshotAdapter, scalaRootType, protoRootType, converterTrait]),
    noteIds: aggregateNoteIds(meta),
  });
}
