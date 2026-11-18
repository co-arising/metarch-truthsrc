import { fqn, signature } from '../../../../../lib/classic-architecture/types.mjs';
import { scalaIdentifier } from '../../../../../lib/classic-architecture/naming.mjs';
import { fieldDoc } from '../../../../../lib/classic-architecture/knowledge.mjs';

function renderMethod(method) {
  const params = method.params.map(param => `${scalaIdentifier(param.name)}: ${signature(param.typeRef)}`).join(', ');
  // Scala String.split discards trailing empty segments; never trim source lines.
  const lines = method.bodyLogic.split('\n');
  while (lines.length > 1 && lines.at(-1) === '') lines.pop();
  const body = lines.map(line => `    ${line}`).join('\n');
  return `${fieldDoc(method.params, '  ')}  override def ${method.name}(${params}): ${signature(method.returnType)} = {
    // ==== BEGIN MANUAL ====
${body}
    // ==== END MANUAL ====
  }`;
}

/** Frozen ProjectionRepositoryImplTemplate.scala, including unused imports. */
export function renderClassicProjectionRepositoryImpl(model) {
  const baseImports = model.dependencies.map(fqn).sort()
    .filter(value => value !== '' && value !== model.selfType.packageName && !value.startsWith('java.lang'));
  const tableName = model.dtoType.name.endsWith('Repository')
    ? model.dtoType.name.replaceAll('Repository', '') : model.dtoType.name;
  const injected = model.injectedConstructorParams.length !== 0;
  const ctor = injected
    ? '(' + model.injectedConstructorParams.map(param => `${param.name}: ${signature(param.typeRef)}`).join(', ') + ')' : '';
  const imports = [...new Set([...baseImports,
    `${model.interfaceType.packageName}.${tableName}Table._`,
    'scalikejdbc._', 'scala.concurrent.ExecutionContext.Implicits.global', 'javax.inject.Singleton',
    ...(injected ? ['javax.inject.Inject'] : []),
  ])].sort().map(value => `import ${value}`).join('\n');
  const methods = model.methods.map(renderMethod).join('\n\n');
  const extra = model.extraMembers === null ? '' : `\n${model.extraMembers}\n`;
  return `package ${model.selfType.packageName}

${imports}

/**
 * ${model.selfType.name}: Projection Repository Implementation
 */
@Singleton
class ${model.selfType.name}${injected ? ' @Inject() ' : ''}${ctor} extends ${model.interfaceType.name} {

${methods}
${extra}
}
`;
}
