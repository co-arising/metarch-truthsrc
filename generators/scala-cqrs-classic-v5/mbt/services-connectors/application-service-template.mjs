import { conventions } from '../../../../lib/classic-architecture/naming.mjs';
import { fqn, signature } from '../../../../lib/classic-architecture/types.mjs';
import { scalaSet, filterScalaSet, mapScalaSet } from './scala-set.mjs';

/** Frozen ApplicationServiceTemplate.generate, complete unstamped source. */
export function renderClassicApplicationService(model) {
  const baseImports = [...new Set(model.dependencies.map(fqn).sort())]
    .filter(name => ![
      'javax.inject.Inject', 'javax.inject.Singleton', 'scala.concurrent.ExecutionContext',
    ].includes(name))
    .filter(name => !name.startsWith('scala') && !name.startsWith('java.lang'));
  // CodeGenerationDSL.ImportDeclaration sorts but does NOT globally distinct.
  const importDecl = [
    ...baseImports,
    'javax.inject.{Inject, Singleton}',
    'scala.concurrent.{ExecutionContext, Future}',
    'akka.actor.typed.scaladsl.adapter._',
  ].sort().map(name => `import ${name}`).join('\n');

  let dependencies = scalaSet(model.dependencies, model.dependencyRepresentation);
  dependencies = filterScalaSet(dependencies, dependency => ![
    'Inject', 'Singleton', 'ExecutionContext',
  ].includes(dependency.name));
  dependencies = filterScalaSet(dependencies, dependency =>
    !dependency.packageName.startsWith('scala') && !dependency.packageName.startsWith('java'));
  dependencies = filterScalaSet(dependencies, dependency =>
    ['Repository', 'Factory', 'Service', 'Query', 'Connector'].some(suffix => dependency.name.endsWith(suffix)) ||
    dependency.name === 'ActorSystem');
  // This map returns a Scala Set[String], not a Seq: the mapped strings are
  // rehashed, and duplicate constructor declarations are suppressed by Set.
  const constructorArgs = mapScalaSet(dependencies, dependency => {
    const parameterName = conventions.firstLower(dependency.name);
    return dependency.name === 'ActorSystem'
      ? 'classicSystem: akka.actor.ActorSystem'
      : `${parameterName}: ${dependency.name}`;
  }).values.join(',\n    ');

  const methodsCode = model.methods.map(method => {
    const params = method.parameters.map(parameter =>
      `${conventions.scalaIdentifier(parameter.name)}: ${signature(parameter.typeRef)}`).join(', ');
    return `  def ${method.name}(${params}): ${signature(method.returnType)} = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`;
  }).join('\n\n');
  const extraFields = model.dependencies.some(dependency => dependency.name === 'ActorSystem')
    ? '\n  private val system = classicSystem.toTyped\n' : '';
  const classDef = `@Singleton
class ${model.selfType.name} @Inject() (
    ${constructorArgs}
) (implicit ec: ExecutionContext) {

${extraFields}${methodsCode}

}
`;
  return `package ${model.selfType.packageName}

${importDecl}

${classDef}
`;
}
