import { fqn, signature } from '../../../lib/classic-architecture/types.mjs';
import { scalaIdentifier } from '../../../lib/classic-architecture/naming.mjs';
import { conceptLine, commentBlock, fieldDoc } from '../../../lib/classic-architecture/knowledge.mjs';

function renderImports(model) {
  const dependencies = model.dependencies.map(ref => fqn(ref)).sort().filter(name =>
    name !== '' && name !== model.selfType.packageName && !name.startsWith('java.lang'));
  // CodeGenerationDSL.ImportDeclaration sorts the ENTIRE combined list, with
  // no distinct: preserve repeated EntityRef and ImplementedBy import lines.
  return [
    ...dependencies,
    `${fqn(model.aggregateType)}._`,
    'javax.inject._',
    'com.google.inject.ImplementedBy',
  ].sort().map(name => `import ${name}`).join('\n');
}

function renderMethods(model) {
  return model.methods.map(method => {
    // Parameter defaults and superInterface are retained model facts, not output.
    const params = method.parameters.map(param =>
      `${scalaIdentifier(param.name)}: ${signature(param.typeRef)}`).join(', ');
    const doc = fieldDoc(method.parameters, '  ');
    return `${doc}  def ${method.name}(${params}): ${signature(method.returnType)}\n  // Logic: ${method.logicIntent}`;
  }).join('\n\n');
}

/** Complete fixed-template Scala source, without a writer stamp or trimming. */
export function renderClassicAggregateRepository(model) {
  const imports = renderImports(model);
  const methods = renderMethods(model);
  const containerDoc = commentBlock(conceptLine(model.noteId));
  // The frozen inner trait string and outer source string each end in one LF.
  return `package ${model.selfType.packageName}

${imports}

/**
 * ${model.selfType.name}: Application Layer Repository Interface for ${model.aggregateType.name}
 * The abstraction for interacting with the Aggregate via sharding and persistence.
 */
${containerDoc}@ImplementedBy(classOf[${model.isImplementedBy.name}])
trait ${model.selfType.name} {

${methods}

}

`;
}
