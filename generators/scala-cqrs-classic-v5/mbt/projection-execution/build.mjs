import { array, fail, object, text } from '../../../../lib/products/request.mjs';
import { collectDependencies, fqn, shouldImport } from '../../../../lib/classic-architecture/types.mjs';
import { ProjectionAggregateSource, ProjectionHandlerModel, ProjectionModel } from './models.mjs';

const location = Object.freeze({ document: 'classic-architecture', pointer: '/system/infrastructure/projections' });
const projectionFields = Object.freeze([
  '_type', 'name', 'sourceAggregate', 'repositoryRef', 'handlers', 'readModelSchema',
  'decisionSupport', 'sourceAggregates', 'noteId', 'updateOnlyEvents', 'identityScheme',
]);

// Java String.trim, used ONLY at the original Scala head-dispatch positions.
// The raw referenceCode itself is neither cleaned nor interpreted as executable JS.
const scalaTrim = value => value.replace(/^[\x00-\x20]+|[\x00-\x20]+$/gu, '');

function named(value) {
  text(value, location);
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value))
    fail('CLASSIC_NAME', 'projection symbols require the admitted ASCII identifier surface: ' + value, location);
}

function requireMetadata(ctx, kind, name) {
  const meta = ctx.metaRegistry.resolveByName(kind, name);
  if (meta === null)
    fail('CLASSIC_REFERENCE', `unresolved ${kind} reference: ${name}`, location);
  return meta;
}

function checkSchema(schema) {
  if (schema === null) return;
  object(schema, ['_type', 'fields', 'identityKeys'], location);
  if (schema._type !== 'ReadModelSchema') fail('CLASSIC_METADATA_TYPE', 'expected ReadModelSchema', location);
  array(schema.fields, location).forEach(field => {
    object(field, ['_type', 'name', 'dataType', 'derivation', 'isKey', 'nullable', 'noteId', 'description'], location);
    if (field._type !== 'ReadModelField') fail('CLASSIC_METADATA_TYPE', 'expected ReadModelField', location);
  });
  array(schema.identityKeys, location).forEach(key => {
    if (!schema.fields.some(field => field.name === key))
      fail('CLASSIC_PROJECTION_IDENTITY', 'identity key has no declared view column: ' + key, location);
  });
}

function checkProjection(meta, ctx) {
  object(meta, projectionFields, location);
  if (meta._type !== 'ProjectionMetadata') fail('CLASSIC_METADATA_TYPE', 'expected ProjectionMetadata', location);
  named(meta.name);
  named(meta.sourceAggregate);
  array(meta.sourceAggregates, location).forEach(named);
  array(meta.handlers, location);
  if (!meta.handlers.length)
    fail('CLASSIC_PROJECTION_EMPTY', 'the raw ProjectionTemplate requires handlers.head; empty projections are unsupported', location);
  if (meta.identityScheme !== null && meta.identityScheme !== 'persistenceId')
    fail('CLASSIC_PROJECTION_IDENTITY', 'unknown projection identityScheme would be silently ignored by Scala: ' + meta.identityScheme, location);
  array(meta.updateOnlyEvents, location).forEach(eventName => {
    if (!meta.handlers.some(handler => handler.eventName === eventName))
      fail('CLASSIC_PROJECTION_EVENT', 'updateOnly event has no projection handler: ' + eventName, location);
  });
  checkSchema(meta.readModelSchema);
  if (typeof ctx.multiProject !== 'boolean')
    fail('CLASSIC_CONTEXT_API', 'ctx.multiProject must be supplied by the shared v5 technical context', location);
  if (ctx.multiProject)
    fail('CLASSIC_PROJECTION_APPLY_EVENT_UNSEALED', 'nonempty multi-project ApplyEvent and its handler wiring require a separate sealed public oracle', location);
}

function repositoryOf(meta, ctx) {
  if (meta.repositoryRef === null)
    fail('CLASSIC_PROJECTION_REPOSITORY', `Projection ${meta.name} must specify a ProjectionRepositoryRef.`, location);
  object(meta.repositoryRef, ['_type', 'targetName'], location);
  if (meta.repositoryRef._type !== 'ProjectionRepositoryRef')
    fail('CLASSIC_PROJECTION_REPOSITORY', 'the raw MetaRef slot accepts wrong repository families; public projection requires ProjectionRepositoryRef', location);
  return ctx.typeResolver.resolve(meta.repositoryRef);
}

function sourceOf(name, ctx) {
  // The raw string overload only names a type. Reject missing declarations, but
  // do not introduce an alias, inferred aggregate, or a local type resolver.
  requireMetadata(ctx, 'AggregateRootMetadata', name);
  return ctx.typeResolver.aggregateRoot(name);
}

function eventFamilyTypes(name, ctx) {
  // Frozen AggregateRootProtoBuilder.getProtoEventFamilyType/UnionType delegate
  // straight to these shared TypeResolverDSL operations, in this order.
  return {
    family: ctx.typeResolver.protoEventFamily(name),
    union: ctx.typeResolver.protoEvent(name),
  };
}

function projectionMetadata(projectionName, ctx) {
  const projection = ctx.metaRegistry.resolveAll('ProjectionMetadata')
    .find(candidate => candidate.name === projectionName);
  if (projection === undefined)
    fail('CLASSIC_REFERENCE', 'ctx.metaRegistry has no owning ProjectionMetadata: ' + projectionName, location);
  return projection;
}

function identityKeysFor(meta, projectionName, ctx) {
  const event = requireMetadata(ctx, 'SubordinateDomainEventMetadata', meta.eventName);
  const eventFields = new Set(event.fields.map(field => field.name));
  const projection = projectionMetadata(projectionName, ctx);
  const keys = projection.readModelSchema === null ? [] : projection.readModelSchema.identityKeys;
  // Missing EVENT payload keys remain false (raw empty-string identity slots),
  // not inferred fields or DTO defaults. Unknown view keys fail in checkSchema.
  return keys.map(key => [key, eventFields.has(key)]);
}

function applyFormFor(meta, projectionName, ctx) {
  const projection = projectionMetadata(projectionName, ctx);
  const head = meta.logic.referenceCode === null ? '' : scalaTrim(meta.logic.referenceCode);
  if (projection.identityScheme === 'persistenceId') return 'persistenceIdCreate';
  if (head.startsWith('view.delete(')) return 'delete';
  if (projection.updateOnlyEvents.includes(meta.eventName) || head.startsWith('updateOnly(')) return 'updateOnly';
  return 'create';
}

function buildHandler(meta, sourceIndex, projectionName, repository, familyTypes, ctx, sourceAggregate) {
  object(meta, ['_type', 'name', 'eventName', 'logic'], location);
  if (meta._type !== 'ProjectionEventHandlerMetadata') fail('CLASSIC_METADATA_TYPE', 'expected ProjectionEventHandlerMetadata', location);
  named(meta.name);
  named(meta.eventName);
  object(meta.logic, ['_type', 'intent', 'invariants', 'referenceCode'], location);
  if (meta.logic._type !== 'BusinessLogic') fail('CLASSIC_METADATA_TYPE', 'expected BusinessLogic', location);
  if (meta.logic.referenceCode !== null) text(meta.logic.referenceCode, location, true);
  const selfType = ctx.typeResolver.projectionHandler(meta.name);
  const entityEventType = ctx.typeResolver.resolve({ _type: 'EventRef', targetName: meta.eventName });
  const handlerPkg = ctx.layout.application.projection.handlers;
  const dependencies = collectDependencies([
    entityEventType, repository, familyTypes.union,
    ctx.knownFrameworkTypes.ExecutionContext, ctx.knownFrameworkTypes.Future,
  ]).filter(ref => shouldImport(ref, handlerPkg));
  const aggEntity = sourceAggregate.name.replaceAll('Aggregate', '') + 'Entity';
  return ProjectionHandlerModel({
    selfType, event: familyTypes.family, repository,
    logicCode: meta.logic.referenceCode === null ? '???' : meta.logic.referenceCode,
    dependencies,
    eventCaseName: scalaTrim(meta.eventName).length ? meta.eventName : entityEventType.name,
    routable: fqn(entityEventType).includes('.' + aggEntity + '.'),
    viewName: projectionName, concreteEventName: entityEventType.name,
    entityEventFqn: fqn(entityEventType), entityEventType,
    identityKeys: identityKeysFor(meta, projectionName, ctx),
    applyForm: applyFormFor(meta, projectionName, ctx),
    logic: meta.logic, sourceIndex, multiProject: ctx.multiProject,
  });
}

function handlersFor(meta, repository, familyTypes, ctx, aggregate) {
  return meta.handlers.map((handler, index) =>
    buildHandler(handler, index, meta.name, repository, familyTypes, ctx, aggregate));
}

function aggregateSourcesFor(meta, repository, ctx) {
  const names = meta.sourceAggregates.length > 1 ? meta.sourceAggregates : [];
  return names.flatMap(name => {
    const familyTypes = eventFamilyTypes(name, ctx);
    const aggregate = sourceOf(name, ctx);
    // Intentionally RAW aggName (not the normalized aggregate TypeRef name):
    // the original filter's Aggregate-suffix defect is part of its limitations.
    const handlers = meta.handlers.flatMap((handler, index) => {
      const event = ctx.typeResolver.resolve({ _type: 'EventRef', targetName: handler.eventName });
      if (!fqn(event).includes('.' + name + 'Entity.')) return [];
      return [buildHandler(handler, index, meta.name, repository, familyTypes, ctx, aggregate)];
    });
    return handlers.length ? [ProjectionAggregateSource(aggregate, familyTypes.family, handlers)] : [];
  });
}

function projectionDependencies(aggregate, repository, handlers, familyImport, ctx, pkg) {
  const refs = [
    ...handlers.flatMap(handler => handler.dependencies), aggregate, repository,
    ...handlers.map(handler => handler.selfType),
    ctx.knownFrameworkTypes.Inject, ctx.knownFrameworkTypes.ExecutionContext,
    ctx.knownFrameworkTypes.Projection, ctx.knownFrameworkTypes.ActorSystem,
    ctx.typeResolver.scalikeJdbcSession, ctx.typeResolver.scalikeJdbcSetup,
    ctx.typeResolver.mongoReadJournal, familyImport,
  ];
  return collectDependencies(refs).filter(ref => shouldImport(ref, pkg));
}

/** Full ProjectionBuilder single-project model, including raw multi-source
 * filtering/fallback. The central public compiler owns closed metadata/data-type
 * validation; no business text, retired manual implementation or fixture is read.
 */
export function buildClassicProjection(meta, ctx) {
  checkProjection(meta, ctx);
  const selfType = ctx.typeResolver.projection(meta.name);
  const sourceAggregate = sourceOf(meta.sourceAggregate, ctx);
  const repository = repositoryOf(meta, ctx);
  const familyTypes = eventFamilyTypes(meta.sourceAggregate, ctx);
  const aggregateSources = aggregateSourcesFor(meta, repository, ctx);
  const handlers = aggregateSources.length
    ? aggregateSources.flatMap(source => source.handlers)
    : handlersFor(meta, repository, familyTypes, ctx, sourceAggregate);
  const baseDeps = projectionDependencies(sourceAggregate, repository, handlers, familyTypes.union, ctx, selfType.packageName);
  // The Scala union adds the per-source family TypeRef itself, not merely its
  // PO union import. Preserve that distinction and the final shouldImport pass.
  const extraDeps = aggregateSources.flatMap(source => [
    source.aggregate, source.protoEventType, ...source.handlers.flatMap(handler => handler.dependencies),
  ]);
  const dependencies = collectDependencies([...baseDeps, ...extraDeps])
    .filter(ref => shouldImport(ref, selfType.packageName));
  return ProjectionModel({
    selfType, sourceAggregate, sourceProtoEventType: familyTypes.family, repository,
    handlers, dependencies, aggregateSources,
    noteIds: meta.noteId === null ? [] : [meta.noteId],
    applyEvents: [], identityScheme: meta.identityScheme,
    sourceAggregateName: meta.sourceAggregate, sourceAggregates: meta.sourceAggregates,
    repositoryRef: meta.repositoryRef, readModelSchema: meta.readModelSchema,
    schemaFieldTypes: (meta.readModelSchema?.fields ?? []).map(field => ctx.typeResolver.resolve(field.dataType)),
    decisionSupport: meta.decisionSupport,
    decisionSupportTypes: meta.decisionSupport.map(ref => ctx.typeResolver.resolve(ref)),
    updateOnlyEvents: meta.updateOnlyEvents, multiProject: ctx.multiProject,
  });
}
