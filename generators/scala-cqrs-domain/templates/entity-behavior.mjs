import { fqn, signature } from '../../../lib/classic-architecture/types.mjs';
import { fieldDoc } from '../../../lib/classic-architecture/knowledge.mjs';
import { conventions } from '../../../lib/classic-architecture/naming.mjs';

function renderMutation(mutation) {
  if (mutation.collectionFolds.length !== 0) {
    throw new TypeError('Classic EntityBehavior requires empty collectionFolds');
  }
  return `    case event: ${mutation.eventType.name} =>\n      ${mutation.logicCode}`;
}

function renderHelper(method) {
  const params = method.params
    .map(param => `${conventions.scalaIdentifier(param.name)}: ${signature(param.typeRef)}`)
    .join(', ');
  const doc = fieldDoc(method.params, '  ');
  // logicCode is prompt text, not an executable helper body. Keep raw method
  // names, the fixed indentation, and the unconditional private/??? skeleton.
  return `${doc}  private def ${method.name}(${params}): ${signature(method.returnType)} = {
    /*
    >>> AI_PROMPT_START
    Context: Domain Entity Helper Method
    Task: Implement logic for ${method.name}
    Description: ${method.logicCode}
    Input Params: ${params}
    Return: ${signature(method.returnType)}
    <<< AI_PROMPT_END
    */
    ???
  }`;
}

export function renderEntityBehavior(model) {
  const packageDecl = `package ${model.selfType.packageName}`;
  const names = model.dependencies
    .map(fqn)
    .sort()
    .filter(name => name !== '' && name !== model.selfType.packageName && !name.startsWith('java.lang'));
  // EntityBehaviorTemplate appends the alias even when dependencies contain it.
  // CodeGenerationDSL.ImportDeclaration then sorts again, without deduplicating.
  names.push(fqn(model.handlerTypeAlias));
  const importDecl = names.sort().map(name => `import ${name}`).join('\n');
  const mutationsCode = model.mutations.map(renderMutation).join('\n\n');
  const helpersCode = model.helperMethods.map(renderHelper).join('\n\n');
  const applyMethodCode = `  def apply: ${model.handlerTypeAlias.name} = (state, event) => event match {\n${mutationsCode}\n    case _ => state // 默认兜底，或者抛异常\n  }`;
  const behaviorObj = `object ${model.selfType.name} {\n${applyMethodCode}\n\n${helpersCode}\n}`;
  // SourceFile keeps empty slots and adds exactly its final newline. Stamping
  // and physical-path bookkeeping belong to the assembler/writer, not here.
  return [packageDecl, importDecl, behaviorObj].join('\n\n') + '\n';
}
