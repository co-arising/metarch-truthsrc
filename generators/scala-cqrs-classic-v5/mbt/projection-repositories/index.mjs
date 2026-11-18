import { classicArtifact } from '../../../../lib/classic-architecture/paths.mjs';
import { collectDependencies } from '../../../../lib/classic-architecture/types.mjs';
import { buildClassicProjectionRepository } from './builders/projection-repository.mjs';
import { buildClassicProjectionRepositoryImpl } from './builders/projection-repository-impl.mjs';
import { renderClassicProjectionRepository } from './templates/projection-repository.mjs';
import { renderClassicProjectionRepositoryImpl } from './templates/projection-repository-impl.mjs';

export { buildClassicProjectionRepository, buildClassicProjectionRepositoryImpl,
  renderClassicProjectionRepository, renderClassicProjectionRepositoryImpl };

function dtoReferences(port, ctx) {
  return [ctx.typeResolver.projectionDtoType(
    port.dtoModel.name, port.dtoModel.companionName, port.selfType.packageName,
  ), ...port.dtoModel.fields.map(field => field.typeRef)];
}

function portReferences(port, ctx) {
  return collectDependencies([
    ...dtoReferences(port, ctx),
    ...(ctx.multiProject ? [] : [port.isImplementedBy]),
    ...port.methods.flatMap(method => [method.returnType, ...method.parameters.map(param => param.typeRef)]),
  ]);
}

function implReferences(impl, port, ctx) {
  // File association is not the import filter: include the containing port as
  // well as nested DTO and every method/container/field dependency. The raw
  // simple Impl DTO TypeRef alone cannot identify its companion's source file.
  return collectDependencies([
    port.selfType, impl.interfaceType, impl.dtoType, ...dtoReferences(port, ctx),
    ...impl.injectedConstructorParams.map(param => param.typeRef),
    ...impl.methods.flatMap(method => [method.returnType, ...method.params.map(param => param.typeRef)]),
  ]);
}

/** CQRSApplicationGenerator infrastructure.repositories dispatch builds BOTH
 * files for each ProjectionRepositoryMetadata, retaining original array indices.
 * Application repositories and projection handlers never trigger another pair. */
export function buildArtifacts(product, ctx) {
  return product.system.infrastructure.repositories.flatMap((meta, index) => {
    if (meta._type !== 'ProjectionRepositoryMetadata') return [];
    const source = { document: product.source.document,
      pointer: product.source.pointer + '/infrastructure/repositories/' + index };
    const port = buildClassicProjectionRepository(meta, ctx);
    const impl = buildClassicProjectionRepositoryImpl(meta, ctx);
    return [
      classicArtifact(port, model => renderClassicProjectionRepository(model, ctx.multiProject),
        'projection-repository-port', source, ctx, portReferences(port, ctx)),
      classicArtifact(impl, renderClassicProjectionRepositoryImpl,
        'projection-repository-implementation', source, ctx, implReferences(impl, port, ctx)),
    ];
  });
}
