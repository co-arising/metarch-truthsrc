import { FieldDef } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { collectDependencies, shouldImport } from '../../../../lib/classic-architecture/types.mjs';
import { DomainServiceMethodModel, DomainServiceModel } from './models.mjs';

/** Structural port of the frozen DomainServiceBuilder, not business execution. */
export function buildClassicDomainService(meta, ctx) {
  // The shared JS layout retains services as a string, unlike Scala's .root.
  const pkg = ctx.layout.domain.services;
  const selfType = ctx.typeResolver.domainService(meta.name);
  const superInterface = ctx.types.DomainService;
  const methods = meta.methods.map(method => {
    const parameters = method.parameters.map(parameter => FieldDef(
      parameter.name,
      // Shared parameterType is the original resolve(MetaType) alias.
      ctx.typeResolver.parameterType(parameter.parameterType),
      null,
      null,
      parameter.noteId,
      parameter.description,
    ));
    const returnType = ctx.typeResolver.resolve(method.returnType);
    let logicCode;
    if (method.logic._type === 'Left') {
      logicCode = `// Error: ${method.logic.value}`;
    } else if (method.logic._type === 'Right') {
      const logic = method.logic.value;
      // An empty Some("") is still reference code; only None becomes TODO.
      logicCode = logic.referenceCode === null ? `// TODO: ${logic.intent}` : logic.referenceCode;
    } else {
      throw new TypeError('DomainService MethodMetadata.logic requires the original Left/Right encoding');
    }
    // isPrivate/description and parameter optional/optionalWhen are intentionally
    // absent from the original model; parameter noteId/description remain data.
    return DomainServiceMethodModel(method.name, parameters, returnType, logicCode);
  });
  const roots = methods.flatMap(method => [
    method.returnType,
    ...method.parameters.map(parameter => parameter.typeRef),
  ]);
  const dependencies = collectDependencies([...roots, superInterface])
    .filter(ref => shouldImport(ref, pkg));
  return DomainServiceModel(selfType, superInterface, methods, dependencies);
}
