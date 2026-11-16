import { fqn, signature } from '../../../lib/classic-architecture/types.mjs';

function renderImports(dependencies) {
  const importList = dependencies.map(fqn).sort().filter(name =>
    name !== '' && !name.startsWith('scala') && !name.startsWith('java.lang'));
  // The fixed template deduplicates FQNs; CodeGenerationDSL.imports sorts again.
  return [...new Set(importList)].sort().map(name => `import ${name}`).join('\n');
}

function renderHelper(helper) {
  const genericArgs = [helper.commandType, helper.stateType, helper.paramType, helper.replyType]
    .map(signature).join(', ');
  // Preserve the raw name/signature distinction and literal iMadzError, including
  // their generic-type limitations. The default RHS remains inside MANUAL.
  return `
  implicit object ${helper.name} extends CommandHelper[${genericArgs}] {
    override def toParam(state: ${helper.stateType.name}, command: ${helper.commandType.name}): ${signature(helper.paramType)} = {
      // ==== BEGIN MANUAL ====
      ${helper.toParamLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }

    override def createFailureReply(param: ${signature(helper.paramType)})(error: iMadzError): ${helper.replyType.name} = {
      // ==== BEGIN MANUAL ====
      ${helper.failureReplyLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }

    override def createSuccessReply(param: ${signature(helper.paramType)})(state: ${helper.stateType.name}): ${helper.replyType.name} = {
      // ==== BEGIN MANUAL ====
      ${helper.successReplyLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }
  }
`;
}

/**
 * Exact fixed CommandHelpersTemplate output, without the writer's stamp.
 * Leading/trailing newlines in each component are intentional, even when the
 * helper list is empty. Do not trim or normalize this template's whitespace.
 * @param {import('../model.mjs').CommandHelpersModel} model
 * @returns {string}
 */
export function renderCommandHelpers(model) {
  const pkgDecl = `package ${model.selfType.packageName}`;
  const importDecl = renderImports(model.dependencies);
  const helpersCode = model.helpers.map(renderHelper).join('\n');
  const traitComment = `/**
 * 胶水代码库：负责将 Command 转换为 Policy 参数，并将结果包装为 Reply。
 * 这里是 AI 填空的主要战场。
 */
`;
  const traitDef = `
${traitComment}
trait ${model.selfType.name} {

${helpersCode}

}
`;
  return `${pkgDecl}

${importDecl}

${traitDef}
`;
}
