import { fqn, signature } from '../../../lib/classic-architecture/types.mjs';

function renderImports(model) {
  const dependencies = model.dependencies.map(fqn).sort().filter(name =>
    name !== '' && name !== model.selfType.packageName && !name.startsWith('java.lang'));
  // Unlike the factory template, this fixed template dedupes combined import
  // strings before CodeGenerationDSL.ImportDeclaration sorts the ENTIRE list.
  return [...new Set([
    ...dependencies,
    'javax.inject.Inject',
    'javax.inject.Singleton',
    'akka.cluster.sharding.typed.scaladsl.ClusterSharding',
  ])].sort().map(name => `import ${name}`).join('\n');
}

function renderMethods(model) {
  return model.methods.map(method => {
    const typeKeyRef = `${model.aggregateType.name}.entityTypeKey`;
    // Keep raw identifiers and parameter .name; only the return uses signature.
    return `  override def ${method.name}(${method.paramName}: ${method.paramType.name}): ${signature(method.returnType)} =
    sharding.entityRefFor(${typeKeyRef}, ${method.paramName}.toString)`;
  }).join('\n\n');
}

/** Complete fixed-template Scala source, without a writer stamp or trimming. */
export function renderClassicAggregateRepositoryImpl(model) {
  const imports = renderImports(model);
  const methods = renderMethods(model);
  return `package ${model.selfType.packageName}

${imports}

/**
 * ${model.selfType.name}: Aggregate Repository Implementation
 * Implementation of ${model.interfaceType.name} interface
 */
@Singleton
class ${model.selfType.name} @Inject() (sharding: ClusterSharding) extends ${model.interfaceType.name} {

${methods}

}
`;
}
