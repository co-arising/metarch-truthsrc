import { FieldDef } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { shouldImport } from '../../../../lib/classic-architecture/types.mjs';
import { ApplicationServiceMethodModel, ApplicationServiceModel } from './models.mjs';
import {
  scalaSet, concatScalaSet, unionScalaSet, filterScalaSet,
  scalaDependencySet, scalaDependencySequence,
} from './scala-set.mjs';

/** Frozen ApplicationServiceBuilder.build(ApplicationServiceMetadata, ctx). */
export function buildClassicApplicationService(meta, ctx) {
  if (meta._type !== 'ApplicationServiceMetadata') {
    throw new TypeError('buildClassicApplicationService requires raw ApplicationServiceMetadata');
  }
  const pkg = ctx.layout.application.services.root;
  const selfType = ctx.typeResolver.applicationService(meta.name);
  // Explicit service dependencies are direct refs, not recursively expanded.
  const resolvedDeps = meta.dependencies.map(dependency => ctx.typeResolver.resolve(dependency));
  const methods = meta.methods.map(method => {
    const parameters = method.parameters.map(parameter => FieldDef(
      parameter.name,
      ctx.typeResolver.parameterType(parameter.parameterType),
      null, null, parameter.noteId, parameter.description,
    ));
    const returnType = ctx.typeResolver.resolve(method.returnType);
    const invokedCommands = method.invokes.map(command => ctx.typeResolver.resolve(command));
    // Some("") is real reference code. Only None becomes a TODO; the template
    // still emits ???, rather than using this retained logic as a method RHS.
    const bodyLogic = method.logic.referenceCode === null
      ? `// TODO: ${method.logic.intent}` : method.logic.referenceCode;
    return ApplicationServiceMethodModel(
      method.name, parameters, returnType, bodyLogic, invokedCommands,
      method.logic, method.parameters,
    );
  });

  // methods.flatMap starts with a Set ++ Seq ++ Seq for EACH method, not one
  // globally flattened DFS. Its iteration becomes the input to methodDeps.toSet.
  const methodDeps = methods.flatMap(method => {
    let deps = scalaDependencySet(method.returnType);
    deps = concatScalaSet(deps, scalaDependencySequence(method.parameters.map(parameter => parameter.typeRef)));
    deps = concatScalaSet(deps, scalaDependencySequence(method.invokesCommands));
    return deps.values;
  });
  const frameworkDeps = scalaSet([
    ctx.knownFrameworkTypes.Inject,
    ctx.knownFrameworkTypes.Singleton,
  ]);
  const allDeps = unionScalaSet(
    unionScalaSet(scalaSet(resolvedDeps), scalaSet(methodDeps)), frameworkDeps,
  );
  const filtered = filterScalaSet(allDeps, dependency => shouldImport(dependency, pkg));
  // filter(...).toList.distinct followed by dependencies.toSet rebuilds the
  // small-set factory when <=4; keeping the upstream HashSet would change bytes.
  const dependencies = scalaSet(filtered.values);
  return ApplicationServiceModel(selfType, methods, dependencies, meta.description, meta.dependencies);
}
