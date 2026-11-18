import { classicArtifact } from '../../../../lib/classic-architecture/paths.mjs';
import { buildClassicApplicationService } from './build-application-service.mjs';
import { buildClassicQueryService } from './build-query-service.mjs';
import { renderClassicApplicationService } from './application-service-template.mjs';
import { renderClassicQueryService } from './query-service-template.mjs';

export { ApplicationServiceModel, ApplicationServiceMethodModel, QueryServiceModel, QueryServiceMethodModel } from './models.mjs';
export { buildClassicApplicationService } from './build-application-service.mjs';
export { buildClassicQueryService } from './build-query-service.mjs';
export { renderClassicApplicationService } from './application-service-template.mjs';
export { renderClassicQueryService, renderClassicQueryStruct } from './query-service-template.mjs';

function methodReferences(methods) {
  return methods.flatMap(method => [
    method.returnType,
    ...method.parameters.map(parameter => parameter.typeRef),
    ...method.invokesCommands,
  ]);
}
function sourceAt(product, layer, field, index) {
  return Object.freeze({
    document: product.source.document,
    pointer: `${product.source.pointer}/${layer}/${field}/${index}`,
  });
}

/** Unstamped descriptors only. Main owns collection, paths, stamps and writes.
 * Connector port/implementation are deliberately NOT registered or emulated:
 * both remain ORACLE_NOT_READY and require a separately sealed nonempty oracle.
 */
export function buildArtifacts(product, ctx) {
  const services = product.system.application.services.map((meta, index) => {
    const model = buildClassicApplicationService(meta, ctx);
    const references = Object.freeze([
      ...meta.dependencies.map(dependency => ctx.typeResolver.resolve(dependency)),
      ...methodReferences(model.methods),
    ]);
    return Object.freeze(classicArtifact(
      model, renderClassicApplicationService, 'application-service',
      sourceAt(product, 'application', 'services', index), ctx, references,
    ));
  });
  const queries = product.system.application.queries.map((meta, index) => {
    const model = buildClassicQueryService(meta, ctx);
    const references = Object.freeze([
      ...meta.repositories.map(repository => ctx.typeResolver.resolve(repository)),
      ...methodReferences(model.methods),
      ...model.structs.flatMap(struct => [
        ...struct.dependencies, ...struct.fields.map(field => field.typeRef),
      ]),
    ]);
    return Object.freeze(classicArtifact(
      model, renderClassicQueryService, 'query-service',
      sourceAt(product, 'application', 'queries', index), ctx, references,
    ));
  });
  return Object.freeze([...services, ...queries]);
}
