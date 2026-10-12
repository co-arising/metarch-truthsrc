// scala.mjs — rules-face templates (V4-3). Model → byte-exact Scala text. Mirrors the string
// construction in rules_domain_gen.mjs (CommandHelpers block lines 1922-1960, Behaviors block
// lines 1962-2029); whitespace is load-bearing (golden byte identity).

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

export function renderBehaviors(m) {
  const { agg, pkg, ctx } = m;
  const base = `${pkg}.${ctx}`;
  const body = m.cases.map((c) => {
    if (c.kind === 'query-getstate') {
      return `    case cmd: ${c.name} =>
      // S1 聚合面：写侧状态强一致查询（技术合成读命令——不产事件，直接回当前状态）
      Effect.reply(cmd.replyTo)(${c.replyType}(state))`;
    }
    if (c.kind === 'query-skip') {
      return `    case cmd: ${c.name} =>
      // [GEN-SKIP] 查询碎片：无产生事件/无规则（手写补丁接管）
      throw new RuntimeException("${c.name} 查询命令未生成规则接线")`;
    }
    const ruleRef = c.usePort
      ? `new ${agg}Rules.${c.name}Rule(${m.portParams.map((p) => p.member).join(', ')})`
      : `${agg}Rules.${c.name}Rule`;
    const lines = [`${c.anchor}    case cmd: ${c.name} =>`];
    if (c.withPost) {
      lines.push(`      runReplyingPolicy(${ruleRef}, ${c.name}Helper)(state, cmd)`);
      lines.push(`        .withPost(${agg}Rules.checkEventPostconditions)`);
      lines.push(`        .replyWith(cmd.replyTo)`);
    } else {
      lines.push(`      runReplyingPolicy(${ruleRef}, ${c.name}Helper)(state, cmd).replyWith(cmd.replyTo)`);
    }
    return lines.join('\n');
  }).join('\n\n');
  const portImports = m.portTraits.length ? m.portTraits.slice().sort().map((t) => `import ${t}`).join('\n') + '\n' : '';
  const apply = m.portParams.length
    ? `  // 债④（2026-10-04·闭包形）：port 注入重载——装配点（Bootstrap）传手写实现，闭包捕获不可变。
  def apply(${m.portParams.map((p) => `${p.member}: ${p.trait}`).join(', ')}): ${agg}AggregateCommandHandler = {${m.portParams.map((p) => ` require(${p.member} != null, "${p.member} 未绑定");`).join('')}
    (state, command) => command match {
${body}
  }
  }`
    : `  def apply: ${agg}AggregateCommandHandler = (state, command) => command match {
${body}
  }
`;
  return `${m.header}package ${base}.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy
import ${base}.application.aggregates.${agg}Protocol._
import ${base}.domain.entities.${agg}Entity.${agg}Event
import ${base}.domain.entities.${agg}Entity.${agg}State
import ${base}.domain.invariant.${agg}Rules
${portImports}
/**
 * ${agg} 命令流接线（rules_domain_gen.mjs 生成，2026-08-22）：
 * 每个命令 → runReplyingPolicy(规则, Helper)(state, cmd).replyWith(replyTo)；
 * 事件后置校验（EVENT_POSTCONDITION）经 withPost 挂点（persist 前校验事件载荷，失败 → 失败 reply）。
 */
object ${agg}Behaviors extends ${agg}CommandHelpers {

  type ${agg}AggregateCommandHandler = (${agg}State, ${agg}CommandFamily) => Effect[${agg}Event, ${agg}State]
${apply}

}
`;
}
