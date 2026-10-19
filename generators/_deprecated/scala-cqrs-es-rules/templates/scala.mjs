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

// renderRuleParams — the <Agg>RuleParams.scala file (rules_domain_gen lines 2702-2712): projection
// VO case classes in a single object, preceded by the Id/Instant/values import block (each import
// line abuts the next and the doc comment — no blank lines in this header region).
export function renderRuleParams(m) {
  const { agg, pkg, ctx } = m;
  const base = `${pkg}.${ctx}`;
  const imports = `${m.needId ? 'import net.imadz.common.CommonTypes.Id\n' : ''}${m.needInstant ? 'import java.time.Instant\n' : ''}${m.needVO ? `import ${base}.domain.values._\n` : ''}`;
  const blocks = m.classes.flatMap((c) => [
    ...c.anchors,
    `  /** ${c.name} 规则投影：${c.ruleIds.join(' / ') || '（无命令级规则）'} */`,
    `  final case class ${c.name}Params(${c.fields.join(', ')})`,
  ]);
  return `${m.header}package ${base}.domain.invariant.params

${imports}/**
 * 命令 → 领域规则参数的投影 VO（方案 A，2026-08-22，rules_domain_gen.mjs 生成）。
 * 业务不变性（InvariantRule）是 domain 层资产——规则只依赖领域实体状态、事件与这些投影 VO，
 * 不依赖 application 层命令类型。字段 = 该命令被**规则或策略**引用的输入 + 操作人（triggeredBy）。
 */
object ${m.agg}RuleParams {
${blocks.join('\n')}
}
`;
}

// renderRules — the <Agg>Rules.scala file (rules_domain_gen lines 2713-2729): the domain invariant
// rules object. Imports: java.time.Instant always, CommonTypes{InvariantRule, iMadzError}, the
// entity wildcard, a sorted selected-event import list, values._ (when any used event payload or
// state field type is a domain VO), the params wildcard, then the port traits (sorted FQNs).
export function renderRules(m) {
  const { agg, pkg, ctx } = m;
  const base = `${pkg}.${ctx}`;
  const portImports = m.portTraits.length ? m.portTraits.map((t) => `import ${t}`).join('\n') + '\n' : '';
  return `${m.header}package ${base}.domain.invariant

import java.time.Instant
import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}
import ${base}.domain.entities.${agg}Entity
import ${base}.domain.entities.${agg}Entity.{${agg}Event, ${agg}State${m.evImportList ? ', ' + m.evImportList : ''}}
${m.valuesImport}import ${base}.domain.invariant.params.${agg}RuleParams._
${portImports}
/**
 * ${agg} 聚合规则实现（方案 A，2026-08-22：规则 = 纯 domain，不依赖 application/akka）。
 * rules_domain_gen.mjs 生成：聚合级校验（checkAggregate）先于命令级；
 * 查询类规则（refExists/unique/跨聚合引用）按 executable_cases 哨兵口径判定。
 */
object ${agg}Rules {
${m.body}
}
`;
}

// renderPolicies — the <Agg>Policies.scala file (rules_domain_gen lines 3189-3203, S2-44):
// the domain reaction-policy object. Imports: net.imadz.common.Id, sorted event imports (host
// Entity case classes) and the params wildcard. `objects` entries are pre-rendered blocks that
// each open with a newline (the source pushes them raw and joins with '\n').
export function renderPolicies(m) {
  const { agg, pkg, ctx } = m;
  const base = `${pkg}.${ctx}`;
  const evtImportDecl = m.evtImports.slice().sort().map((i) => `import ${i}`).join('\n');
  const paramsImportDecl = m.paramsImports.slice().sort().map((i) => `import ${i}`).join('\n');
  return `${m.header}package ${base}.domain.policy

import net.imadz.common.Id
${evtImportDecl}
${paramsImportDecl}

/**
 * ${agg} 聚合反应策略（S2-44·2026-09-05，rules_domain_gen.mjs 生成）。
 * Policy = event → command 的领域语义（独立于 usecase·usecase 仅为引用方）；
 * 纯 domain：零 akka / 零 application 依赖——Runner（application/projection）接线另批落地。
 * 与 domain/invariant 对偶：Rules 吃 (State, Params) 产 Events；Policy 吃 Event 产 Params。
 */
object ${agg}Policies {
${m.objects.join('\n')}
}
`;
}

// renderPoliciesSpec — the test/…/<Agg>PoliciesSpec.scala file (rules_domain_gen lines 3205-3219):
// the pure-domain policy suite. Same import face plus the values imports for any VO the spec
// sentinels default-construct (voImports, sorted, with the source's conditional trailing newline).
export function renderPoliciesSpec(m) {
  const { agg, pkg, ctx } = m;
  const base = `${pkg}.${ctx}`;
  const evtImportDecl = m.evtImports.slice().sort().map((i) => `import ${i}`).join('\n');
  const paramsImportDecl = m.paramsImports.slice().sort().map((i) => `import ${i}`).join('\n');
  return `${m.header}package ${base}.domain.policy

import net.imadz.common.Id
${evtImportDecl}
${paramsImportDecl}
${m.voImports.slice().sort().map((v) => `import ${base}.domain.values.${v}`).join('\n')}${m.voImports.length ? '\n' : ''}import org.scalatest.wordspec.AnyWordSpecLike
import org.scalatest.matchers.should.Matchers

/**
 * ${agg} Policies 领域层纯测试（S2-44·无 akka）。
 */
class ${agg}PoliciesSpec extends AnyWordSpecLike with Matchers {
${m.tests.join('\n')}
}
`;
}

// renderRulesSpec — the test/…/<Agg>RulesSpec.scala file (rules_domain_gen lines 2730-2761):
// the pure-domain ScalaTest suite. Header = the three-way rule-note anchor union (sorted); the
// port Impl vals (债④ closure form) precede the state() helper; every executable case renders a
// `"<cmd> <type> <ruleId>" in { … }` block (case-completeness-patched state/params expressions).
export function renderRulesSpec(m) {
  const { agg, pkg, ctx } = m;
  const base = `${pkg}.${ctx}`;
  const portBlock = m.portVals.length ? `  // 债④（2026-10-04·闭包形）：port 注入纯单测——直接构造传参（无全局绑定时序·测试可换 stub）。
  // 实现 FQN＝functions.yaml scalaImpl（ext 手写区真源声明）。
${m.portVals.map((mem) => m.portImplVal(mem)).join('\n')}

` : '';
  return `${m.header}${m.anchors.length ? m.anchors.join('\n') + '\n' : ''}package ${base}.domain.invariant

import java.time.Instant
import net.imadz.common.CommonTypes.Id
import net.imadz.common.Id
import ${base}.domain.entities.${agg}Entity.{${agg}State}
${m.valuesImport}import ${base}.domain.invariant.params.${agg}RuleParams._
import org.scalatest.wordspec.AnyWordSpecLike
import org.scalatest.matchers.should.Matchers

/**
 * ${agg} 规则领域层纯测试（方案 A，2026-08-22，rules_domain_gen.mjs 生成）。
 * 直测 ${agg}Rules.XxxRule(state, params) → Either，**无 akka**。
 * 用例对齐 executable_cases.json（given.state / when.params / then.errorCode）；
 * 命令级用例的 given.state 已补丁到聚合级规则全部通过。
 */
class ${agg}RulesSpec extends AnyWordSpecLike with Matchers {
${portBlock}  private def state(
${m.stateDefaults.join(',\n')}
  ): ${agg}State = ${agg}State(
${m.stateCtorArgs.join(',\n')}
  )

  "${agg} rules" should {
${m.tests.join('\n')}
  }
}
`;
}

// V4-10 — the event-handler state-projection rewrite. Two apply forms mirror the source: with
// fold-face ports a parametrized overload (bare-trait params — the import face carries the FQs;
// require-guarded closure capture), without them the zero-arg form. `case _ => state` sits at
// closure depth (6) in the ported form, match depth (4) in the plain form.
export function renderEventHandlerRules(m) {
  const ported = m.portParams.length > 0;
  const applySig = ported
    ? `  def apply(${m.portParams.join(', ')}): ${m.agg}EventHandler = {`
    : `  def apply: ${m.agg}EventHandler = (state, event) => event match {`;
  const requires = ported ? `${m.requireLines.join('\n')}\n    (state, event) => event match {\n` : '';
  const fallback = ported ? '      case _ => state // 默认兜底\n    }\n  }' : '    case _ => state // 默认兜底\n  }';
  return `${m.header}package net.imadz.metarch.domain.entities.behaviors

${m.ehImports}
import net.imadz.metarch.domain.entities.${m.agg}Entity.${m.agg}Event
import net.imadz.metarch.domain.entities.${m.agg}Entity.${m.agg}EventHandler
import net.imadz.metarch.domain.entities.${m.agg}Entity.${m.agg}State
${m.portTraitFqs.length ? m.portTraitFqs.map((t) => `import ${t}`).join('\n') + '\n' : ''}${m.voImports ? m.voImports + '\n' : ''}
/**
 * ${m.agg} 状态投影（rules_domain_gen.mjs 生成，2026-08-22）：
 * writtenBy 血缘为权威映射（metarch.fields.template.json）；审计字段按同名载荷/创建更新类事件规则；
 * status 按事件名词干匹配枚举（STATE_TRANSITION）；待确认项标 TODO + 审校清单（story/eventhandler_review.md）。
 */
object ${m.agg}EventHandler {
${ported ? '  // 债④（2026-10-04·闭包形）：port 折叠点带参重载——装配点传实现，闭包捕获不可变。\n' : ''}${applySig}
${requires}${m.body.join('\n')}${fallback}
}
`;
}
