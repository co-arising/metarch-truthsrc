import { FieldDef } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { buildValueObject } from '../../../scala-cqrs-domain/builders/value-object.mjs';
import { shouldImport } from '../../../../lib/classic-architecture/types.mjs';
import { copyImmutableData } from '../../../../lib/immutable-data.mjs';
import { QueryServiceMethodModel, QueryServiceModel } from './models.mjs';
import {
  scalaSet, concatScalaSet, unionScalaSet, filterScalaSet, flatMapScalaSet,
  scalaDependencySet, scalaDependencySequence,
} from './scala-set.mjs';

/** Frozen QueryServiceBuilder.build(QueryServiceMetadata, ctx). */
export function buildClassicQueryService(meta, ctx) {
  if (meta._type !== 'QueryServiceMetadata') {
    throw new TypeError('buildClassicQueryService requires raw QueryServiceMetadata');
  }
  const pkg = ctx.layout.application.queries.root;
  const selfType = ctx.typeResolver.queryService(meta.name);
  const structs = meta.structs.map(struct => {
    // Reuse the original ValueObject builder's naming/optional/default/knowledge
    // and derived-method structure. Only its Scala Set iteration is restored.
    const model = buildValueObject(struct, ctx);
    const dependencies = scalaSet(scalaDependencySequence(model.fields.map(field => field.typeRef)));
    return copyImmutableData({
      ...model,
      dependencies: dependencies.values,
      dependencyRepresentation: dependencies.representation,
    });
  });
  const resolvedDeps = meta.repositories.map(repository => ctx.typeResolver.resolve(repository));
  const methods = meta.methods.map(method => {
    // The original Query builder deliberately drops parameter noteId and
    // description, unlike ApplicationServiceBuilder. Retain their original
    // metadata separately, without adding annotations or optional wrappers.
    const parameters = method.parameters.map(parameter => FieldDef(
      parameter.name, ctx.typeResolver.parameterType(parameter.parameterType),
    ));
    const returnType = ctx.typeResolver.resolve(method.returnType);
    const invokedCommands = method.invokes.map(command => ctx.typeResolver.resolve(command));
    const bodyLogic = method.logic.referenceCode === null
      ? `// TODO: ${method.logic.intent}` : method.logic.referenceCode;
    return QueryServiceMethodModel(
      method.name, parameters, returnType, bodyLogic, invokedCommands,
      method.logic, method.parameters,
    );
  });
  const methodDeps = methods.flatMap(method => {
    let deps = scalaDependencySet(method.returnType);
    deps = concatScalaSet(deps, scalaDependencySequence(method.parameters.map(parameter => parameter.typeRef)));
    deps = concatScalaSet(deps, scalaDependencySequence(method.invokesCommands));
    return deps.values;
  });
  const structDeps = unionScalaSet(
    scalaSet(structs.flatMap(struct => struct.dependencies)),
    scalaSet(structs.flatMap(struct => scalaDependencySequence(struct.fields.map(field => field.typeRef)))),
  );
  const frameworkDeps = scalaSet([
    ctx.knownFrameworkTypes.Inject,
    ctx.knownFrameworkTypes.Timeout,
    ctx.knownFrameworkTypes.ExecutionContext,
    ctx.knownFrameworkTypes.Future,
    ctx.knownFrameworkTypes.ReadModel,
  ]);
  const allDeps = unionScalaSet(
    unionScalaSet(unionScalaSet(scalaSet(resolvedDeps), scalaSet(methodDeps)), structDeps),
    frameworkDeps,
  );
  // Set.flatMap keeps the input's factory; this is not Seq.flatMap(...).toSet.
  const expanded = flatMapScalaSet(allDeps, dependency => scalaDependencySet(dependency).values);
  const imported = filterScalaSet(expanded, dependency => shouldImport(dependency, pkg));
  const dependencies = filterScalaSet(imported, dependency => dependency.name !== 'Timeout');
  // The original dependencies.toSet is identity on a Set: do not shrink its
  // factory. Timeout stays absent from this model, but the template imports it.
  return QueryServiceModel(
    selfType, methods, structs, dependencies, meta.description, meta.repositories, meta.structs,
  );
}
