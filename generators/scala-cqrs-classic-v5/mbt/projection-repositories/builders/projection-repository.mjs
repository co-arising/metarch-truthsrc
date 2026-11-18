import { ProductError, equal } from '../../../../../lib/products/request.mjs';
import { typeRef, collectDependencies, shouldImport } from '../../../../../lib/classic-architecture/types.mjs';
import { FieldDef, MappingMorphism, WrittenBy, Derived } from '../../../../scala-cqrs-domain/models/domain-entity.mjs';
import { RepositoryMethodModel } from '../../../../scala-cqrs-play-service/models/classic-aggregate-repository.mjs';
import { ClassicProjectionRepositoryModel, StructModel, RmOf } from '../models/projection-repository.mjs';

/** This initial implementation admits only the real Table branch, never the
 * original empty-table fallback for ES/Redis or unimplemented graph/Mongo/vector. */
export function assertTableRepository(meta) {
  if (meta?._type !== 'ProjectionRepositoryMetadata')
    throw new ProductError('CLASSIC_PROJECTION_REPOSITORY_METADATA', 'expected ProjectionRepositoryMetadata');
  if (meta.storageConfig?._type !== 'TableMetadata')
    throw new ProductError('CLASSIC_PROJECTION_REPOSITORY_STORAGE_UNSUPPORTED',
      `${meta.name}: storage ${meta.storageConfig?._type ?? '<missing>'} is not implemented; only TableMetadata is admitted`);
  for (const method of meta.methods) {
    if (!['UpsertMethod', 'QueryMethod'].includes(method._type))
      throw new ProductError('CLASSIC_PROJECTION_REPOSITORY_METHOD', `${meta.name}: unsupported method ${method._type}`);
  }
}

/** The original lookup is by DTO base name, NOT repository or Projection suffix. */
export function projectionRepositoryLineage(meta, ctx) {
  const dtoName = ctx.conventions.getBaseName(meta.name);
  const projection = ctx.metaRegistry.resolveByName('ProjectionMetadata', dtoName);
  return { dtoName, projection, schemaFields: projection?.readModelSchema?.fields ?? [] };
}

export function projectionRepositoryParameters(method, ctx) {
  // optional/optionalWhen are ignored by the frozen builders. No inferred Option.
  return method.parameters.map(param => FieldDef(
    param.name, ctx.typeResolver.resolve(param.parameterType), null, null,
    param.noteId ?? null, param.description ?? '',
  ));
}

function schemaDtoFields(fields, ctx) {
  return fields.map(field => {
    const resolved = ctx.typeResolver.resolve(field.dataType);
    const ref = resolved.name === 'Instant' && (field.nullable ?? true)
      ? ctx.typeResolver.option(resolved) : resolved;
    return FieldDef(field.name, ref, null, null, field.noteId ?? null, field.description ?? '');
  });
}

function columnType(column, ctx) {
  const upper = column.dataType.toUpperCase();
  if (upper.startsWith('VARCHAR')) return ctx.typeResolver.string;
  if (upper === 'INT') return ctx.typeResolver.int;
  if (upper.startsWith('DECIMAL')) return ctx.typeResolver.resolve({ _type: 'BigDecimalType' });
  return ctx.typeResolver.customDataType(column.dataType);
}

function queryReturnType(query, dtoName, dtoType, ctx) {
  const resolved = ctx.typeResolver.resolve(query.returnType);
  if (['List', 'Future', 'Option'].includes(resolved.name)) {
    // Despite the original "recursive" comment, only DIRECT arguments change.
    const params = resolved.typeParams.map(param =>
      ['Summary', 'Any', dtoName].includes(param.name) ? dtoType : param);
    const fixed = typeRef(resolved.name, resolved.packageName, params);
    return resolved.name === 'Future' ? fixed
      : typeRef(ctx.knownFrameworkTypes.Future.name, ctx.knownFrameworkTypes.Future.packageName, [fixed]);
  }
  return equal(resolved, ctx.typeResolver.long)
    ? typeRef(ctx.knownFrameworkTypes.Future.name, ctx.knownFrameworkTypes.Future.packageName, [ctx.typeResolver.long])
    : resolved;
}

function repositoryMethod(method, dtoName, dtoType, ctx) {
  const returnType = method._type === 'QueryMethod'
    ? queryReturnType(method, dtoName, dtoType, ctx) : ctx.typeResolver.unit;
  return RepositoryMethodModel(method.name, projectionRepositoryParameters(method, ctx), returnType, method.logic.intent);
}

function lineageEndpoint(derivation, projection, ctx) {
  if (['ComputedField', 'ConstantField', 'UnresolvedField'].includes(derivation._type)) return null;
  if (!['DirectField', 'AggregateIdentity'].includes(derivation._type))
    throw new ProductError('CLASSIC_PROJECTION_DERIVATION', `unsupported read-model derivation ${derivation._type}`);
  // Main owns metadata FQNs/category maps and endpoint identity. Do not duplicate
  // MorphismEndpoints.scala here or silently erase active schema lineage.
  const operation = derivation._type === 'DirectField' ? 'fieldOf' : 'byName';
  if (typeof ctx.morphismEndpoints?.[operation] !== 'function')
    throw new ProductError('CLASSIC_CONTEXT_API', `projection lineage requires ctx.morphismEndpoints.${operation}`);
  return derivation._type === 'DirectField'
    ? ctx.morphismEndpoints.fieldOf(derivation.eventName, derivation.sourceField)
    : ctx.morphismEndpoints.byName(projection?.sourceAggregate ?? '');
}

function repositoryMorphisms(projection, fields, dtoName, ctx) {
  return fields.flatMap(field => {
    const endpoint = lineageEndpoint(field.derivation, projection, ctx);
    if (endpoint === null) return [];
    if (endpoint === undefined)
      throw new ProductError('CLASSIC_CONTEXT_API', 'MorphismEndpoints must return an endpoint or null');
    const relation = field.derivation._type === 'AggregateIdentity' ? RmOf : WrittenBy;
    return [MappingMorphism(relation, Derived, endpoint, field.name, dtoName, field.noteId ?? null)];
  });
}

function repositoryDependencies(dtoModel, methods, implementation, ctx, pkg) {
  const roots = [
    ...methods.flatMap(method => [method.returnType, ...method.parameters.map(param => param.typeRef)]),
    ...dtoModel.fields.map(field => field.typeRef),
    ...(ctx.multiProject ? [] : [implementation, ctx.knownFrameworkTypes.ImplementedBy]),
    ctx.knownFrameworkTypes.Inject, ctx.knownFrameworkTypes.Future, ctx.knownFrameworkTypes.List,
  ];
  return collectDependencies(roots).filter(ref => shouldImport(ref, pkg));
}

/** Frozen application/ProjectionRepositoryBuilder Table path; source text is
 * rendered separately. No external manualBlocks/implOverrides are consumed. */
export function buildClassicProjectionRepository(meta, ctx) {
  assertTableRepository(meta);
  const pkg = ctx.layout.application.projection.repository.root;
  const selfType = ctx.typeResolver.projectionRepository(meta.name);
  const isImplementedBy = ctx.typeResolver.projectionRepositoryImpl(
    ctx.conventions.getRepositoryImplNameFromInterfaceName(meta.name),
  );
  const { dtoName, projection, schemaFields } = projectionRepositoryLineage(meta, ctx);
  const companionName = `${dtoName}Table`;
  const fields = schemaFields.length !== 0 ? schemaDtoFields(schemaFields, ctx)
    : meta.storageConfig.columns.map(column => FieldDef(column.name, columnType(column, ctx)));
  const dtoModel = StructModel(dtoName, companionName, fields);
  const dtoType = ctx.typeResolver.projectionDtoType(dtoName, companionName, pkg);
  const methods = meta.methods.map(method => repositoryMethod(method, dtoName, dtoType, ctx));
  const noteId = projection?.noteId ?? null;
  return ClassicProjectionRepositoryModel({
    selfType, isImplementedBy, dtoModel, methods,
    dependencies: repositoryDependencies(dtoModel, methods, isImplementedBy, ctx, pkg),
    morphisms: repositoryMorphisms(projection, schemaFields, dtoName, ctx),
    noteIds: noteId === null ? [] : [noteId],
  });
}
