import { classicArtifact } from '../../../../lib/classic-architecture/paths.mjs';
import { buildClassicDomainService } from './build.mjs';
import { renderClassicDomainService } from './template.mjs';

export { DomainServiceMethodModel, DomainServiceModel } from './models.mjs';
export { buildClassicDomainService, renderClassicDomainService };

/** Available domain services only. Formal rules await a new independent seal. */
export function buildArtifacts(product, ctx) {
  const { system, source } = product;
  return system.domain.services.map((meta, i) => {
    const model = buildClassicDomainService(meta, ctx);
    const location = {
      document: source.document,
      pointer: source.pointer + '/domain/services/' + i,
    };
    // Unfiltered typed roots preserve local file association even for types the
    // original builder rightly excludes from its import dependency set.
    const references = [model.superInterface, ...model.methods.flatMap(method => [
      method.returnType,
      ...method.parameters.map(parameter => parameter.typeRef),
    ])];
    return classicArtifact(model, renderClassicDomainService, 'domain-service', location, ctx, references);
  });
}
