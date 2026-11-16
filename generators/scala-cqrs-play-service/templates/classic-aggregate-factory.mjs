import { fqn, signature } from '../../../lib/classic-architecture/types.mjs';
import { scalaIdentifier } from '../../../lib/classic-architecture/naming.mjs';
import { fieldDoc } from '../../../lib/classic-architecture/knowledge.mjs';

function renderImports(model) {
  const dependencies = model.dependencies.map(ref => fqn(ref)).sort().filter(name =>
    name !== '' && name !== model.selfType.packageName && !name.startsWith('java.lang'));
  // CodeGenerationDSL.ImportDeclaration sorts the ENTIRE combined list and
  // does not dedupe, including repeated FQNs from distinct generic TypeRefs.
  return [
    ...dependencies,
    'javax.inject.Inject',
    'akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'akka.util.Timeout',
    'scala.concurrent.duration._',
    'scala.concurrent.ExecutionContext',
    fqn(model.aggregateType),
  ].sort().map(name => `import ${name}`).join('\n');
}

function renderMethods(model) {
  return model.factoryMethods.map(method => {
    // Optional defaults belong to the model; the fixed template omits them.
    const params = method.parameters.map(param =>
      `${scalaIdentifier(param.name)}: ${signature(param.typeRef)}`).join(', ');
    const doc = fieldDoc(method.parameters, '  ');
    const keyRef = `${model.aggregateType.name}.${model.entityTypeKey}`;
    // Scala String.replace replaces every literal occurrence, not a regex or
    // just the first key. Do not reinterpret or normalize the method body.
    const fixedLogic = method.bodyLogic.split(model.entityTypeKey).join(keyRef);
    return `${doc}  def ${method.name}(${params}): ${signature(method.returnType)} = {
    ${fixedLogic}
  }`;
  }).join('\n\n');
}

/** Complete fixed-template Scala source, without a writer stamp or trimming. */
export function renderClassicAggregateFactory(model) {
  const imports = renderImports(model);
  const methods = renderMethods(model);
  return `package ${model.selfType.packageName}

${imports}

/**
 * ${model.selfType.name}: Aggregate Factory for ${model.aggregateType.name}
 * Creates and manages aggregate instances via cluster sharding
 */
class ${model.selfType.name} @Inject() (clusterSharding: ClusterSharding)(implicit ec: ExecutionContext) {
  implicit val askTimeout: Timeout = Timeout(10.seconds)

${methods}

}
`;
}
