import { ProductError } from '../../lib/products/request.mjs';
import { typeRef, collectDependencies, shouldImport } from '../../lib/classic-architecture/types.mjs';
import { FieldDef } from '../scala-cqrs-domain/models/domain-entity.mjs';
import { ClassicAggregateRepositoryModel, RepositoryMethodModel } from './models/classic-aggregate-repository.mjs';

function resolveAggregate(meta, ctx) {
  const aggregate = ctx.metaRegistry.resolveByName('AggregateRootMetadata', meta.aggregate.targetName);
  if (aggregate == null) {
    throw new ProductError(
      'CLASSIC_REFERENCE',
      `AggregateRootMetadata '${meta.aggregate.targetName}' not found.`,
    );
  }
  return aggregate;
}

function synthesizeEntityRefMethod(aggregateName, aggregateType) {
  // The frozen Port builder uses the RAW metadata name, unlike the Impl.
  // Preserve the resulting Protocol/CommandFamily defect, not an alias or fix.
  const commandFamily = typeRef(
    `${aggregateName}CommandFamily`,
    `${aggregateType.packageName}.${aggregateName}Protocol`,
  );
  return RepositoryMethodModel(
    'entityRef',
    [FieldDef('id', typeRef('String'))],
    typeRef('EntityRef', 'akka.cluster.sharding.typed.scaladsl', [commandFamily]),
    'sharding 实体引用（聚合隐式契约——对齐 gen_api_layer entityRef，2026-08-28 终局原则）',
  );
}

function buildQueryMethod(query, ctx) {
  const parameters = query.parameters.map(param => FieldDef(
    param.name,
    ctx.typeResolver.parameterType(param.parameterType),
    null,
    null,
    param.noteId ?? null,
    param.description ?? '',
  ));
  return RepositoryMethodModel(
    query.name,
    parameters,
    ctx.typeResolver.resolve(query.returnType),
    query.logic.intent,
  );
}

function buildRepositoryMethods(meta, ctx, aggregateName, aggregateType) {
  const entityRefMethod = synthesizeEntityRefMethod(aggregateName, aggregateType);
  // Parse every QueryMethod and all its parameters BEFORE replacing entityRef.
  // Other method constructors, including UpsertMethod, are not resolved.
  const declaredMethods = meta.methods
    .filter(method => method._type === 'QueryMethod')
    .map(query => buildQueryMethod(query, ctx))
    .filter(method => method.name !== 'entityRef');
  return [entityRefMethod, ...declaredMethods];
}

function collectRepositoryDependencies(methods, implementationType, aggregateType, ctx, pkg) {
  // Structural Set[TypeRef], not Set[FQN]: the two generic EntityRefs remain
  // distinct dependency values and consequently produce repeated import lines.
  return collectDependencies([
    ...methods.flatMap(method => [method.returnType, ...method.parameters.map(param => param.typeRef)]),
    implementationType,
    ctx.knownFrameworkTypes.Inject,
    ctx.knownFrameworkTypes.ImplementedBy,
    aggregateType,
  ]).filter(ref => shouldImport(ref, pkg));
}

/** Build the fixed classic repository Port model using the agreed context-v4 API. */
export function buildClassicAggregateRepository(meta, ctx) {
  const pkg = ctx.layout.application.aggregates.repository;
  const selfType = ctx.typeResolver.aggregateRepository(meta.name);
  const aggregate = resolveAggregate(meta, ctx);
  const aggregateType = ctx.typeResolver.aggregateRoot(aggregate.name);
  // The String overload receives the original interface name + Impl.
  const implementationType = ctx.typeResolver.aggregateRepositoryImpl(
    ctx.conventions.getRepositoryImplNameFromInterfaceName(meta.name),
  );
  const methods = buildRepositoryMethods(meta, ctx, aggregate.name, aggregateType);
  const dependencies = collectRepositoryDependencies(methods, implementationType, aggregateType, ctx, pkg);
  const noteId = aggregate.noteId ?? null;

  return ClassicAggregateRepositoryModel({
    selfType,
    superInterface: selfType,
    isImplementedBy: implementationType,
    aggregateType,
    methods,
    dependencies,
    noteIds: noteId === null ? [] : [noteId],
    noteId,
  });
}
