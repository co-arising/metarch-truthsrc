import { conventions } from '../../../../lib/classic-architecture/naming.mjs';
import { fqn, signature } from '../../../../lib/classic-architecture/types.mjs';
import { scalaSet, filterScalaSet, mapScalaSet } from './scala-set.mjs';

/** QueryServiceTemplate.renderStruct: companion DTO, NOT ValueObjectTemplate. */
export function renderClassicQueryStruct(model) {
  const fields = model.fields.map(field =>
    `${conventions.scalaIdentifier(field.name)}: ${signature(field.typeRef)}`).join(', ');
  const extendsClause = model.dependencies.some(dependency => dependency.name === 'ReadModel')
    ? ' extends ReadModel' : '';
  // Intentionally omit defaults, field docs, JSON formats and derived methods.
  // Those facts are retained in the shared ValueObject model, not emitted here.
  return `  case class ${model.selfType.name}(${fields})${extendsClause}`;
}

/** Frozen QueryServiceTemplate.generate, complete unstamped source. */
export function renderClassicQueryService(model) {
  const filteredImports = model.dependencies.map(fqn).sort()
    .filter(name => ![
      'javax.inject.Inject', 'scala.concurrent.ExecutionContext', 'akka.util.Timeout',
    ].includes(name))
    .filter(name => !name.startsWith('scala') && !name.startsWith('java.lang'));
  const baseImports = [...new Set(filteredImports)];
  const importDecl = [
    ...baseImports,
    'javax.inject.Inject',
    'scala.concurrent.ExecutionContext',
    'scala.concurrent.Future',
    'akka.util.Timeout',
  ].sort().map(name => `import ${name}`).join('\n');
  const structsCode = model.structs.map(renderClassicQueryStruct).join('\n\n');
  const companionCode = structsCode.length === 0 ? ''
    : `object ${model.selfType.name} {\n${structsCode}\n}`;

  let dependencies = scalaSet(model.dependencies, model.dependencyRepresentation);
  dependencies = filterScalaSet(dependencies, dependency => ![
    'Inject', 'Timeout', 'ExecutionContext', 'Singleton',
  ].includes(dependency.name));
  dependencies = filterScalaSet(dependencies, dependency =>
    !dependency.packageName.startsWith('scala') && !dependency.packageName.startsWith('java'));
  dependencies = filterScalaSet(dependencies, dependency =>
    ['Repository', 'Factory', 'Service', 'Query'].some(suffix => dependency.name.endsWith(suffix)));
  // Two independent Set.map operations: hashing a full declaration is NOT
  // hashing its lowercased name. Prompt order need not match constructor order.
  const constructorArgs = mapScalaSet(dependencies, dependency =>
    `${conventions.firstLower(dependency.name)}: ${dependency.name}`).values.join(',\n    ');
  const availableDeps = mapScalaSet(dependencies, dependency =>
    conventions.firstLower(dependency.name)).values.join(', ');
  const methodsCode = model.methods.map(method => {
    const params = method.parameters.map(parameter =>
      `${conventions.scalaIdentifier(parameter.name)}: ${signature(parameter.typeRef)}`).join(', ');
    const returnSig = signature(method.returnType);
    // The one original normalization site: String.replace LF + Java trim.
    // JS trim would additionally remove NBSP and other non-Java whitespace.
    const logicDesc = method.bodyLogic.replaceAll('\n', ' ')
      .replace(/^[\x00-\x20]+|[\x00-\x20]+$/gu, '');
    return `
  /**
   * ${method.name}
   */
  def ${method.name}(${params}): ${returnSig} = {
    /*
    >>> AI_PROMPT_START
    Context: Query Service (Read Side)
    Task: Implement query logic for '${method.name}'
    Description: ${logicDesc}
    Available Repos/Services: ${availableDeps}
    Input Params: ${params}
    Return: ${returnSig}
    <<< AI_PROMPT_END
    */
    ???
  }
`;
  }).join('\n');
  // QueryServiceBuilder removes every TypeRef named Timeout. Keep the template
  // branch (for original model semantics), but do not reintroduce it in build.
  const timeoutDefinition = model.dependencies.some(dependency => dependency.name === 'Timeout')
    ? '\n  implicit val askTimeout: Timeout = Timeout(30 seconds)\n  import scala.concurrent.duration.DurationInt\n  import scala.language.postfixOps'
    : '';
  const classDef = `/**
 * ${model.selfType.name}: Query Service
 */
class ${model.selfType.name} @Inject() (${constructorArgs}) (implicit val ec: ExecutionContext) {
${timeoutDefinition}

${methodsCode}
}
`;
  return `package ${model.selfType.packageName}

${importDecl}

${companionCode}

${classDef}
`;
}
