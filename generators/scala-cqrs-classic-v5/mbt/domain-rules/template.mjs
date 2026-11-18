import { conventions } from '../../../../lib/classic-architecture/naming.mjs';
import { fqn, signature } from '../../../../lib/classic-architecture/types.mjs';

/** Frozen DomainServiceTemplate + CodeGenerationDSL, without the writer stamp. */
export function renderClassicDomainService(model) {
  const packageDecl = `package ${model.selfType.packageName}`;
  // Structural dependency equality is handled by the builder, not an FQN Set:
  // different parameterized refs can intentionally emit identical import lines.
  const importDecl = model.dependencies.map(fqn).sort()
    .filter(name => name !== '' && name !== model.selfType.packageName && !name.startsWith('java.lang'))
    .map(name => `import ${name}`).join('\n');
  const methodsCode = model.methods.map(method => {
    const params = method.parameters
      .map(parameter => `${conventions.scalaIdentifier(parameter.name)}: ${signature(parameter.typeRef)}`)
      .join(', ');
    // Only parameter identifiers are escaped. Logic is verbatim comment text;
    // its internal lines are not reindented, normalized or used as the RHS.
    return `  def ${method.name}(${params}): ${signature(method.returnType)} = {\n  /*\n    ${method.logicCode}\n    */\n    ???\n  }`;
  }).join('\n\n');
  const objectDef = `object ${model.selfType.name} extends ${signature(model.superInterface)} {\n${methodsCode}\n}`;
  // SourceFile keeps the empty import block too, and appends exactly one LF.
  return [packageDecl, importDecl, objectDef].join('\n\n') + '\n';
}
