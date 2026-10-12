// scala.mjs — rules-face templates (V4-3). Model → byte-exact Scala text. Mirrors the string
// construction in rules_domain_gen.mjs (CommandHelpers block, lines 1922-1960); whitespace is
// load-bearing (golden byte identity).

export function renderHelpers(m) {
  const { agg, pkg, ctx } = m;
  const base = `${pkg}.${ctx}`;
  const body = m.helpers.map((h) => `  implicit object ${h.name}Helper extends CommandHelper[${h.name}, ${agg}State, ${h.paramsName}, ${h.replyType}] {
    override def toParam(state: ${agg}State, command: ${h.name}): ${h.paramsName} =
      ${h.paramsName}(${h.args.join(', ')})

    override def createFailureReply(param: ${h.paramsName})(error: iMadzError): ${h.replyType} =
      ${h.replyType}(Some(error))

    override def createSuccessReply(param: ${h.paramsName})(state: ${agg}State): ${h.replyType} =
      ${h.replyType}(None)
  }

`).join('');
  return `${m.header}package ${base}.application.aggregates.behaviors

import net.imadz.common.CommonTypes.iMadzError
import net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper
${m.commandNames.map((n) => `import ${base}.application.aggregates.${agg}Protocol.${n}`).join('\n')}
${m.commandNames.map((n) => `import ${base}.application.aggregates.${agg}Protocol.${n}Reply`).join('\n')}
import ${base}.domain.entities.${agg}Entity.${agg}State
import ${base}.domain.invariant.params.${agg}RuleParams._

/**
 * 胶水代码库：Command → 领域规则投影 VO（方案 A，2026-08-22，rules_domain_gen.mjs 生成）。
 * toParam 把命令参数转换为 domain 层规则可消费的 VO（规则不再依赖 application 命令类型）。
 */
trait ${agg}CommandHelpers {

${body}}
`;
}
