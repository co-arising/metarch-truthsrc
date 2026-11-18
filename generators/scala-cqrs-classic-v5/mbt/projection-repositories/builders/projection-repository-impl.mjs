import { typeRef, collectDependencies, shouldImport } from '../../../../../lib/classic-architecture/types.mjs';
import { ClassicProjectionRepositoryImplModel, JdbcMethodModel } from '../models/projection-repository-impl.mjs';
import { assertTableRepository, projectionRepositoryLineage, projectionRepositoryParameters } from './projection-repository.mjs';
import { renderClassicJdbcBody } from '../templates/jdbc-method.mjs';

const stringDataType = Object.freeze({ _type: 'StringType' });
const customIs = (field, name) => field.dataType._type === 'CustomType' && field.dataType.typeName === name;
const returnsOption = method => method.returnType._type === 'CustomType' && method.returnType.typeName === 'Option';

function jdbcReturnType(method, dtoType, ctx) {
  if (method._type === 'UpsertMethod') return ctx.typeResolver.unit;
  // Table intentionally differs from the port: ALL non-Option queries become
  // Future[List[DTO]], including Long, Future and scalar declarations.
  const container = returnsOption(method) ? typeRef('Option', '', [dtoType])
    : typeRef(ctx.knownFrameworkTypes.List.name, ctx.knownFrameworkTypes.List.packageName, [dtoType]);
  return typeRef(ctx.knownFrameworkTypes.Future.name, ctx.knownFrameworkTypes.Future.packageName, [container]);
}

function jdbcMethod(method, table, fields, keyColumns, dtoName, dtoType, ctx) {
  return JdbcMethodModel(
    method.name, projectionRepositoryParameters(method, ctx), jdbcReturnType(method, dtoType, ctx),
    method._type === 'QueryMethod',
    // This is the original named method-level source slot. Invariants and
    // referenceCode DO NOT override deterministic SQL or reactivate old slots.
    renderClassicJdbcBody(method, table, fields, keyColumns, dtoName, ctx),
  );
}

function implementationDependencies(fields, methods, interfaceType, ctx, pkg) {
  const listInnerTypes = fields.filter(field => customIs(field, 'List'))
    .flatMap(field => field.dataType.typeParameters).map(dataType => ctx.typeResolver.resolve(dataType));
  const roots = [
    ctx.knownFrameworkTypes.Future, ctx.knownFrameworkTypes.ExecutionContext, interfaceType,
    ...(fields.some(field => customIs(field, 'List')) ? [ctx.knownFrameworkTypes.Json] : []),
    ...(fields.some(field => customIs(field, 'Id')) ? [typeRef('Id', 'net.imadz.common')] : []),
    ...methods.flatMap(method => method.params.map(param => param.typeRef)),
    ...listInnerTypes,
  ];
  return collectDependencies(roots).filter(ref => shouldImport(ref, pkg));
}

/** Frozen infrastructure/repository/ProjectionRepositoryImplBuilder Table path. */
export function buildClassicProjectionRepositoryImpl(meta, ctx) {
  assertTableRepository(meta);
  const pkg = ctx.layout.infrastructure.persistence.repositories.projection;
  const selfType = ctx.typeResolver.projectionRepositoryImpl(meta, pkg);
  const interfacePkg = ctx.layout.application.projection.repository.root;
  const interfaceType = ctx.typeResolver.projectionRepositoryInterface(meta.name, interfacePkg);
  const { dtoName, schemaFields } = projectionRepositoryLineage(meta, ctx);
  const dtoType = ctx.typeResolver.projectionDto(dtoName, interfacePkg);
  // Unlike the port's VARCHAR/INT/DECIMAL mapping, EVERY fallback column here
  // is StringType. Preserve raw DTO reader mismatches rather than repair them.
  const fields = schemaFields.length !== 0
    ? schemaFields.map(field => ({ name: field.name, dataType: field.dataType }))
    : meta.storageConfig.columns.map(column => ({ name: column.name, dataType: stringDataType }));
  const keyColumns = meta.storageConfig.columns.filter(column => column.isPrimaryKey).map(column => column.name);
  const methods = meta.methods.map(method =>
    jdbcMethod(method, meta.storageConfig, fields, keyColumns, dtoName, dtoType, ctx));
  // Knowledge identity differs from the port's base-name lookup: first actual
  // projection whose repositoryRef targets this raw metadata name wins.
  const projection = ctx.metaRegistry.resolveAll('ProjectionMetadata')
    .find(candidate => candidate.repositoryRef?.targetName === meta.name);
  const noteId = projection?.noteId ?? null;
  return ClassicProjectionRepositoryImplModel({
    selfType, interfaceType, dtoType, methods,
    dependencies: implementationDependencies(fields, methods, interfaceType, ctx, pkg),
    noteIds: noteId === null ? [] : [noteId],
  });
}
