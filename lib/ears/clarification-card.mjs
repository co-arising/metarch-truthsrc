// Orchestrates 5-check SMT verification, k-step BMC, and renders A/B Clarification Cards.
import { buildVerificationScripts } from './smt-encoder.mjs';
import { runSmtJob } from './smt-solver.mjs';
import { runBoundedModelCheck } from './smt-bmc.mjs';

function formatCounterexample(decodedModel) {
  const entries = Object.entries(decodedModel)
    .filter(([k]) => !k.startsWith('@host('))
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ');
}

function buildClarificationCard(finding, spec) {
  const ce = formatCounterexample(finding.counterexample ?? {});
  if (finding.kind === 'gap') {
    const falseBools = Object.entries(finding.counterexample ?? {})
      .filter(([, v]) => v === false)
      .map(([k]) => k);
    const suggestedCond = falseBools.length > 0 ? `not ${falseBools[0]}` : '<missing-condition>';
    const suggestedCode = `${finding.command.replace(/([a-z])([A-Z])/gu, '$1_$2').toUpperCase()}_PRECONDITION`;
    return {
      type: 'gap',
      title: `【需求缺口澄清】${spec.target}.${finding.command} 存在未覆盖输入分支`,
      command: finding.command,
      counterexample: finding.counterexample,
      optionA: `显式拒绝，新增 [${suggestedCode}] IF ${suggestedCond} WHEN ${finding.command} THEN SHALL reject request with ${suggestedCode}`,
      optionB: `放宽现有规则前置守卫，允许在该状态下继续执行 ${finding.command}`,
      markdown: [
        `> **【需求缺口澄清】\`${spec.target}.${finding.command}\` 存在未覆盖场景**`,
        '>',
        `> - **Z3 反例**：\`${ce || '(empty model)'}\``,
        '> - **请裁决**：',
        `>   - **选项 A**：显式拒绝，新增 \`[${suggestedCode}] IF ${suggestedCond} WHEN ${finding.command} THEN SHALL reject request with ${suggestedCode}\`。`,
        `>   - **选项 B**：放宽前置条件，允许该场景正常处理。`,
      ].join('\n'),
    };
  }
  if (finding.kind === 'conflict') {
    const [r1, r2] = finding.ruleIds;
    return {
      type: 'conflict',
      title: `【规则冲突澄清】${spec.target}.${finding.command} 中 [${r1}] 与 [${r2}] 互斥冲突`,
      command: finding.command,
      ruleIds: finding.ruleIds,
      counterexample: finding.counterexample,
      optionA: `收紧 [${r2}] 的守卫条件，使其与 [${r1}] 严格互斥`,
      optionB: `收紧 [${r1}] 的守卫条件，明确拒绝/放行优先级`,
      markdown: [
        `> **【规则冲突澄清】\`${spec.target}.${finding.command}\` 规则 \`[${r1}]\` 与 \`[${r2}]\` 可同时触发**`,
        '>',
        `> - **Z3 反例**：\`${ce || '(empty model)'}\``,
        '> - **请裁决**：',
        `>   - **选项 A**：收紧 \`[${r2}]\` 的前置条件以排除该冲突样本。`,
        `>   - **选项 B**：收紧 \`[${r1}]\` 的前置条件以排除该冲突样本。`,
      ].join('\n'),
    };
  }
  if (finding.kind === 'invariant') {
    return {
      type: 'invariant',
      title: `【不变式违约】${spec.target} 规则 [${finding.ruleIds[0]}] 的 post 变更可能破坏全局公理`,
      command: finding.command,
      ruleIds: finding.ruleIds,
      axiomIds: finding.axiomIds,
      counterexample: finding.counterexample,
      optionA: `在 [${finding.ruleIds[0]}] 的守卫中补充边界检查以保证 Inv(s') 成立`,
      optionB: `修正 [${finding.ruleIds[0]}] 的 post: 状态折叠表达式或重新审定公理 [${(finding.axiomIds ?? []).join(', ')}]`,
      markdown: [
        `> **【不变式归纳违约】\`${spec.target}\` 规则 \`[${finding.ruleIds[0]}]\` 可能破坏公理 \`[${(finding.axiomIds ?? []).join(', ')}]\`**`,
        '>',
        `> - **Z3 反例**：\`${ce || '(empty model)'}\``,
        '> - **请裁决**：',
        `>   - **选项 A**：在 \`[${finding.ruleIds[0]}]\` 守卫中补齐前置门限。`,
        `>   - **选项 B**：修正 \`post:\` 状态折叠或审定对应全局公理。`,
      ].join('\n'),
    };
  }
  return {
    type: 'dead-rule',
    title: `【死规则告警】${spec.target} 规则 [${finding.ruleIds[0]}] 永不可达`,
    command: finding.command,
    ruleIds: finding.ruleIds,
    unsatCore: finding.unsatCore ?? [],
    optionA: `删除或合并不可达规则 [${finding.ruleIds[0]}]`,
    optionB: `检查阻塞它的公理/条件：${(finding.unsatCore ?? []).join(', ')}`,
    markdown: [
      `> **【死规则告警】\`${spec.target}\` 规则 \`[${finding.ruleIds[0]}]\` 在当前公理下不可满足**`,
      '>',
      `> - **Unsat Core**：\`${(finding.unsatCore ?? []).join(', ') || '(none)'}\``,
    ].join('\n'),
  };
}

export function verifyEarsWithSmt(spec, { solver = 'z3', timeoutSec, bmcSteps = 4, checkGaps = true } = {}) {
  const effectiveTimeout = timeoutSec ?? spec.theory?.timeoutSec ?? 5;
  const { ctx, logic, jobs, combinedSmt2 } = buildVerificationScripts(spec);

  const checks = {
    conflicts: [],
    gaps: [],
    invariants: [],
    deadRules: [],
    witnesses: [],
  };
  const findings = [];
  const clarificationCards = [];

  for (const job of jobs) {
    if (job.kind === 'gap' && !checkGaps) continue;
    const res = runSmtJob(job.smt2, { solver, timeoutSec: effectiveTimeout });

    if (job.kind === 'conflict') {
      const passed = res.status === 'unsat';
      const entry = {
        command: job.command,
        ruleIds: job.ruleIds,
        status: res.status,
        passed,
        counterexample: passed ? null : ctx.decodeModel(res.model),
      };
      checks.conflicts.push(entry);
      if (!passed) {
        const finding = { kind: 'conflict', ...entry };
        findings.push(finding);
        clarificationCards.push(buildClarificationCard(finding, spec));
      }
    } else if (job.kind === 'gap') {
      const passed = res.status === 'unsat';
      const entry = {
        command: job.command,
        ruleIds: job.ruleIds,
        status: res.status,
        passed,
        counterexample: passed ? null : ctx.decodeModel(res.model),
      };
      checks.gaps.push(entry);
      if (!passed) {
        const finding = { kind: 'gap', ...entry };
        findings.push(finding);
        clarificationCards.push(buildClarificationCard(finding, spec));
      }
    } else if (job.kind === 'invariant') {
      const passed = res.status === 'unsat';
      const entry = {
        command: job.command,
        ruleIds: job.ruleIds,
        axiomIds: job.axiomIds,
        status: res.status,
        passed,
        counterexample: passed ? null : ctx.decodeModel(res.model),
      };
      checks.invariants.push(entry);
      if (!passed) {
        const finding = { kind: 'invariant', ...entry };
        findings.push(finding);
        clarificationCards.push(buildClarificationCard(finding, spec));
      }
    } else if (job.kind === 'reachability-and-witness') {
      const reachable = res.status === 'sat';
      if (!reachable) {
        const entry = {
          command: job.command,
          ruleIds: job.ruleIds,
          status: res.status,
          passed: false,
          unsatCore: res.unsatCore,
        };
        checks.deadRules.push(entry);
        const finding = { kind: 'dead-rule', ...entry };
        findings.push(finding);
        clarificationCards.push(buildClarificationCard(finding, spec));
      } else {
        checks.witnesses.push({
          command: job.command,
          ruleId: job.ruleIds[0],
          status: res.status,
          model: ctx.decodeModel(res.model),
        });
      }
    }
  }

  const bmc = bmcSteps > 0
    ? runBoundedModelCheck(spec, { steps: bmcSteps, solver, timeoutSec: effectiveTimeout })
    : { checked: false, steps: 0, properties: [], passed: true };

  const passed = findings.length === 0 && bmc.passed;

  return {
    schemaVersion: 'co-arising.check-spec/v1',
    target: spec.target,
    kind: spec.kind,
    layer: spec.layer,
    solver,
    logic,
    canonicalSha256: spec.canonicalSha256,
    passed,
    checks,
    bmc,
    findings,
    clarificationCards,
    combinedSmt2,
  };
}
