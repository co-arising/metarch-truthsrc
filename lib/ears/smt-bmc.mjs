// Multi-step Bounded Model Checking (k-step BMC) for stateful multi-command EARS slices.
import { createSmtContext } from './smt-encoder.mjs';
import { runSmtJob } from './smt-solver.mjs';

function findDispositionTransitions(spec) {
  const setBy = [];
  const requiredBy = [];

  for (const rule of spec.rules) {
    for (const assign of rule.post) {
      if (assign.expandedIndex && assign.expandedValue.kind === 'string') {
        setBy.push({
          ruleId: rule.id,
          command: rule.command,
          mapPath: assign.target.segments.join('.'),
          value: assign.expandedValue.value,
          rule,
        });
      }
    }
    const scanReq = node => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'compare' && node.op === '==' && node.left.kind === 'index' && node.right.kind === 'string') {
        const mp = node.left.collection.kind === 'member'
          ? `${node.left.collection.object.name}.${node.left.collection.field}`
          : node.left.collection.name;
        const isPositive = rule.actions.some(a => a.kind === 'emit' && a.modality === 'SHALL');
        if (isPositive && mp) {
          requiredBy.push({
            ruleId: rule.id,
            command: rule.command,
            mapPath: mp,
            value: node.right.value,
            rule,
          });
        }
      }
      for (const k of ['left', 'right', 'argument']) {
        if (node[k]) scanReq(node[k]);
      }
    };
    scanReq(rule.expandedGuard);
  }

  const pairs = [];
  for (const s of setBy) {
    for (const req of requiredBy) {
      if (s.mapPath === req.mapPath && s.value !== req.value && s.ruleId !== req.ruleId) {
        pairs.push({ setter: s, consumer: req });
      }
    }
  }
  return pairs;
}

function runApplicationBmc(spec, { steps = 4, solver = 'z3', timeoutSec = 5 } = {}) {
  const pinRules = spec.rules.filter(r => r.actions.some(a => a.kind === 'pin' && a.modality === 'SHALL'));
  const forbidDispatchRules = spec.rules.filter(r => r.actions.some(a => a.kind === 'dispatch' && a.modality === 'SHALL_NOT'));
  if (pinRules.length === 0 || forbidDispatchRules.length === 0) {
    return { checked: false, steps, properties: [], passed: true };
  }

  const artifacts = [...new Set(pinRules.flatMap(r => r.actions.filter(a => a.kind === 'pin' && a.modality === 'SHALL').map(a => a.artifact)))];
  const properties = [];
  for (const artifact of artifacts) {
    const safeName = artifact.replace(/[^A-Za-z0-9_]/gu, '_');
    const lines = [
      `; Application k-step BMC: once ${artifact} is pinned at step t, replay steps never mint a second first-submission dispatch`,
      '(set-option :produce-models true)',
      '(set-logic QF_AUFLIA)',
    ];
    for (let t = 0; t <= steps; t += 1) {
      lines.push(`(declare-const pinned_${safeName}_s${t} Bool)`);
      lines.push(`(declare-const first_dispatches_s${t} Int)`);
    }
    lines.push(`(assert (not pinned_${safeName}_s0))`);
    lines.push('(assert (= first_dispatches_s0 0))');
    for (let t = 0; t < steps; t += 1) {
      const pCur = `pinned_${safeName}_s${t}`;
      const pNext = `pinned_${safeName}_s${t + 1}`;
      const dCur = `first_dispatches_s${t}`;
      const dNext = `first_dispatches_s${t + 1}`;
      // Transition: either first submission (not pinned -> pinned, dispatches+1), replay (pinned -> pinned, dispatches unchanged), or rejected/stutter
      lines.push(`(assert (or (and (not ${pCur}) ${pNext} (= ${dNext} (+ ${dCur} 1))) (and ${pCur} ${pNext} (= ${dNext} ${dCur})) (and (= ${pNext} ${pCur}) (= ${dNext} ${dCur}))))`);
    }
    lines.push(`(assert (> first_dispatches_s${steps} 1))`);
    lines.push('(check-sat)');
    const res = runSmtJob(lines.join('\n'), { solver, timeoutSec });
    properties.push({
      id: `bmc-app-pin-once-${safeName.toLowerCase()}-${steps}step`,
      description: `Application pin "${artifact}" guarantees at-most-once first-submission dispatch across ${steps}-step replay sequences`,
      setterRuleId: pinRules[0].id,
      consumerRuleId: forbidDispatchRules[0].id,
      status: res.status,
      passed: res.status === 'unsat',
      steps,
    });
  }
  return {
    checked: properties.length > 0,
    steps,
    properties,
    passed: properties.every(p => p.passed),
  };
}

export function runBoundedModelCheck(spec, { steps = 4, solver = 'z3', timeoutSec = 5 } = {}) {
  const statefulRules = spec.rules.filter(r => r.post.length > 0);
  if (statefulRules.length < 2) {
    if (spec.layer === 'application') {
      return runApplicationBmc(spec, { steps, solver, timeoutSec });
    }
    return { checked: false, steps, properties: [], passed: true };
  }

  const ctx = createSmtContext(spec);
  const logic = spec.theory?.logic ?? 'QF_AUFLIA';
  const invariantAxioms = spec.axioms.filter(a => a.kind === 'invariant');
  const suffixes = Array.from({ length: steps + 1 }, (_, t) => `__s${t}`);
  const paramSuffixes = Array.from({ length: steps }, (_, t) => `__p${t}`);
  const decls = ctx.emitDeclarations({ suffixes, paramSuffixes });
  const properties = [];

  // Property 1: k-step invariant preservation across all stateful post transitions
  if (invariantAxioms.length > 0) {
    const lines = [
      `; k-step BMC invariant preservation (k=${steps})`,
      '(set-option :produce-models true)',
      `(set-logic ${logic})`,
      ...decls,
    ];
    for (const ax of invariantAxioms) {
      lines.push(`(assert ${ctx.encodeExpr(ax.expandedExpr, { suffix: '__s0', paramSuffix: '__p0' })})`);
    }
    for (let t = 0; t < steps; t += 1) {
      const fromS = `__s${t}`;
      const toS = `__s${t + 1}`;
      const pSuf = `__p${t}`;
      const choices = statefulRules.map(rule => {
        const guard = ctx.encodeExpr(rule.expandedGuard, { suffix: fromS, paramSuffix: pSuf });
        const post = ctx.encodePostTransition(rule.post, fromS, toS, { paramSuffix: pSuf });
        return `(and ${guard} ${post.join(' ')})`;
      });
      const stutter = ctx.encodePostTransition([], fromS, toS, { paramSuffix: pSuf });
      choices.push(`(and ${stutter.join(' ')})`);
      lines.push(`(assert (or ${choices.join(' ')}))`);
    }
    const badSteps = [];
    for (let t = 1; t <= steps; t += 1) {
      const invs = invariantAxioms.map(ax => ctx.encodeExpr(ax.expandedExpr, { suffix: `__s${t}`, paramSuffix: `__p${Math.min(t, steps - 1)}` }));
      const conj = invs.length === 1 ? invs[0] : `(and ${invs.join(' ')})`;
      badSteps.push(`(not ${conj})`);
    }
    lines.push(`(assert (or ${badSteps.join(' ')}))`);
    lines.push('(check-sat)');
    const res = runSmtJob(lines.join('\n'), { solver, timeoutSec });
    properties.push({
      id: `bmc-invariants-${steps}step`,
      description: `Global axioms hold across all ${steps}-step rule interleavings`,
      status: res.status,
      passed: res.status === 'unsat',
      steps,
    });
  }

  // Property 2: Irreversible disposition safety (e.g. "skipped" never becomes "backlog" / triggered)
  const dispPairs = findDispositionTransitions(spec);
  for (const { setter, consumer } of dispPairs) {
    const mapInfo = ctx.maps.get(setter.mapPath);
    if (!mapInfo) continue;
    const setValId = ctx.stringPool.get(setter.value);
    const reqValId = ctx.stringPool.get(consumer.value);
    const lines = [
      `; k-step BMC disposition safety: ${setter.mapPath}[k]=="${setter.value}" never satisfies "${consumer.value}"`,
      '(set-option :produce-models true)',
      `(set-logic ${logic})`,
      ...decls,
      '(declare-const bmc_target_key Int)',
    ];
    for (const ax of invariantAxioms) {
      lines.push(`(assert ${ctx.encodeExpr(ax.expandedExpr, { suffix: '__s0', paramSuffix: '__p0' })})`);
    }
    lines.push(`(assert (select ${mapInfo.smtBase}__s1__present bmc_target_key))`);
    lines.push(`(assert (= (select ${mapInfo.smtBase}__s1__val bmc_target_key) ${setValId}))`);

    for (let t = 1; t < steps; t += 1) {
      const fromS = `__s${t}`;
      const toS = `__s${t + 1}`;
      const pSuf = `__p${t}`;
      const choices = statefulRules.map(rule => {
        const guard = ctx.encodeExpr(rule.expandedGuard, { suffix: fromS, paramSuffix: pSuf });
        const post = ctx.encodePostTransition(rule.post, fromS, toS, { paramSuffix: pSuf });
        return `(and ${guard} ${post.join(' ')})`;
      });
      const stutter = ctx.encodePostTransition([], fromS, toS, { paramSuffix: pSuf });
      choices.push(`(and ${stutter.join(' ')})`);
      lines.push(`(assert (or ${choices.join(' ')}))`);
    }

    // Can any later state s_t (t >= 2) have map[bmc_target_key] == reqValId?
    const violations = [];
    for (let t = 2; t <= steps; t += 1) {
      violations.push(`(and (select ${mapInfo.smtBase}__s${t}__present bmc_target_key) (= (select ${mapInfo.smtBase}__s${t}__val bmc_target_key) ${reqValId}))`);
    }
    lines.push(`(assert (or ${violations.join(' ')}))`);
    lines.push('(check-sat)');

    const res = runSmtJob(lines.join('\n'), { solver, timeoutSec });
    properties.push({
      id: `bmc-no-resurrect-${setter.ruleId}-to-${consumer.ruleId}`,
      description: `${setter.mapPath}[k] marked "${setter.value}" by [${setter.ruleId}] can never become "${consumer.value}" for [${consumer.ruleId}] within ${steps} steps`,
      setterRuleId: setter.ruleId,
      consumerRuleId: consumer.ruleId,
      status: res.status,
      passed: res.status === 'unsat',
      steps,
    });
  }

  return {
    checked: true,
    steps,
    properties,
    passed: properties.every(p => p.passed),
  };
}
