import { collectDependencies, shouldImport } from '../../lib/classic-architecture/types.mjs';
import { ClassicAggregateRootModel, ShardingModel } from './models/classic-aggregate-root.mjs';

function requireProduct(value, expected) {
  if (!value || value._type !== expected) {
    throw new TypeError(`Classic aggregate root requires ${expected}, got '${value?._type}'`);
  }
  return value;
}

function requireOrdinaryMetadata(meta) {
  requireProduct(meta, 'AggregateRootMetadata');
  if (meta.inlineEvents != null && (!Array.isArray(meta.inlineEvents) || meta.inlineEvents.length !== 0)) {
    throw new TypeError('Unsupported classic aggregate root branch: inlineEvents');
  }
  for (const field of ['inlineState', 'stepsFactory', 'contextType']) {
    if (meta[field] != null) {
      throw new TypeError(`Unsupported classic aggregate root branch: ${field}`);
    }
  }
  requireProduct(meta.stateRef, 'EntityStateRef');
  requireProduct(meta.eventFamilyRef, 'EventFamilyRef');
  requireProduct(meta.behaviorRef, 'AggregateBehaviorRef');
  requireProduct(meta.commandFamily, 'CommandFamilyMetadata');
  requireProduct(meta.persistenceConfig, 'PersistenceConfig');
}

function frameworkType(ctx, name) {
  const ref = ctx.knownFrameworkTypes[name];
  if (ref == null) throw new TypeError(`Missing classic framework type '${name}'`);
  return ref;
}

function structuralTypeKey(ref) {
  return JSON.stringify([ref.name, ref.packageName, ref.typeParams.map(structuralTypeKey)]);
}

/** Ordinary AggregateRootMetadata only; all naming/ref lowering belongs to ctx. */
export function buildClassicAggregateRoot(meta, ctx) {
  requireOrdinaryMetadata(meta);
  const pkg = ctx.layout.application.aggregates.root;
  const selfType = ctx.typeResolver.aggregateRoot(meta.name);
  const stateType = ctx.typeResolver.entityState(meta.stateRef);
  const eventType = ctx.typeResolver.eventFamily(meta.eventFamilyRef);
  // Version 3 resolves this strict AggregateBehaviorRef to application behavior,
  // not to a domain EntityBehaviorRef and not by replacing a type-name suffix.
  const behaviorObject = ctx.typeResolver.entityBehavior(meta.behaviorRef);
  const commandFamilyType = ctx.typeResolver.commandFamily(meta.commandFamily.name);

  const tagging = meta.persistenceConfig.tagging;
  if (tagging?._type !== 'ShardedTags' || typeof tagging.baseName !== 'string') {
    throw new TypeError('Unsupported tagging strategy or missing baseName');
  }
  const sharding = ShardingModel(
    meta.persistenceConfig.entityTypeKey,
    tagging.baseName,
    tagging.numberOfShards,
  );

  // Only state/event/behavior recurse. Protocol and framework types are direct
  // Set members, with their type parameters retained but not separately added.
  const refs = [
    ...collectDependencies([stateType, eventType, behaviorObject, behaviorObject]),
    commandFamilyType,
    frameworkType(ctx, 'Effect'),
    frameworkType(ctx, 'EntityTypeKey'),
  ];
  const dependencies = [...new Map(refs.map(ref => [structuralTypeKey(ref), ref])).values()]
    .filter(ref => shouldImport(ref, pkg));

  return ClassicAggregateRootModel({
    selfType,
    commandFamilyType,
    stateType,
    eventType,
    behaviorObject,
    sharding,
    inlineEvents: [],
    inlineState: null,
    stepsFactory: null,
    contextType: null,
    dependencies,
    noteIds: meta.noteId == null ? [] : [meta.noteId],
  });
}
