// Unified co-arising 2.0 EARS-Native Compiler:
// Orthogonal structures (YAML/JSON) + unique behaviors (.ears) -> SMT/Z3 Hard Gate -> Canonical Model v2.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseEars } from '../ears/parser.mjs';
import { normalizeEars } from '../ears/normalize.mjs';
import { bindEarsSpec } from '../ears/binder.mjs';
import { verifyEarsWithSmt } from '../ears/clarification-card.mjs';
import { loadV2Structures } from './structure-loader.mjs';
import { synthesizeFirstHitWitnesses } from './first-hit-witness.mjs';
import { writeV2KnowledgeGraph } from './knowledge-db.mjs';

function toSlug(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

function collectEarsFiles(inputPath, { includeZh = false } = {}) {
  const abs = resolve(inputPath);
  const st = statSync(abs);
  if (st.isFile()) return [abs];
  const files = [];
  const walk = dir => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.ears')) {
        if (!includeZh && entry.name.endsWith('.zh.ears')) continue;
        files.push(full);
      }
    }
  };
  walk(abs);
  return files;
}

function formatOutcomeSummary(rule) {
  return rule.actions.map(a => {
    const prefix = a.modality === 'SHALL_NOT' ? 'forbid ' : '';
    switch (a.kind) {
      case 'reject': return `${prefix}reject ${a.code}`;
      case 'emit': return `${prefix}emit ${a.event}`;
      case 'transition': return `${prefix}transition -> ${a.value?.value ?? ''}`;
      case 'succeed-empty': return `${prefix}succeed-empty`;
      case 'keep': return `${prefix}keep invariant`;
      case 'pin': return `${prefix}pin ${a.artifact}`;
      case 'dispatch': return `${prefix}dispatch ${a.target}`;
      case 'respond': return `${prefix}respond ${a.response}`;
      case 'expose': return `${prefix}expose ${a.view}`;
      default: return a.kind;
    }
  }).join(' and ');
}

function extractRulePostAssignments(rule) {
  const assignments = [];
  for (const act of rule.actions) {
    if (act.kind === 'transition' && act.modality === 'SHALL' && act.path) {
      const segments = [];
      let cur = act.path;
      while (cur.kind === 'member') {
        segments.unshift(cur.field);
        cur = cur.object;
      }
      if (cur.kind === 'var') segments.unshift(cur.name);
      assignments.push({
        target: { segments, index: null },
        value: act.value,
        source: 'transition',
      });
    }
  }
  for (const p of rule.post) {
    assignments.push({
      target: p.canonicalTarget,
      value: p.canonicalValue,
      source: 'post',
    });
  }
  return assignments;
}

function buildEventPropagations(spec, aggregateStruct) {
  if (!aggregateStruct) return [];
  const cmdMap = new Map(aggregateStruct.commands.map(c => [c.name, c]));
  const evMap = new Map(aggregateStruct.events.map(e => [e.name, e]));
  const propagations = [];

  for (const rule of spec.rules) {
    const cmd = cmdMap.get(rule.command);
    if (!cmd) continue;
    const paramMap = new Map(cmd.parameters.map(p => [p.name, p]));
    for (const act of rule.actions) {
      if (act.kind !== 'emit' || act.modality !== 'SHALL') continue;
      const ev = evMap.get(act.event);
      const fields = ev?.fields?.length > 0 ? ev.fields : cmd.parameters;
      const bindings = fields.map(f => ({
        eventField: f.name,
        source: paramMap.has(f.name) ? '@PROPAGATED' : 'derived',
        paramName: paramMap.has(f.name) ? f.name : null,
        type: f.type,
      }));
      propagations.push({
        ruleId: rule.id,
        command: cmd.name,
        event: act.event,
        bindings,
      });
    }
  }
  return propagations;
}

function collectAndVerifyEventFolds(behaviors, structures) {
  const foldMap = new Map(); // "Aggregate.Event" -> { aggregate, event, assignments, foldSha256, sourceRuleIds }
  const diagnostics = [];
  const aggMap = new Map(structures.aggregates.map(a => [a.name, a]));

  for (const beh of behaviors) {
    if (beh.kind !== 'slice') continue;
    const aggName = beh.target.split('.')[0];
    const agg = aggMap.get(aggName);
    const aliases = new Set(agg?.aliases ?? ['state']);

    for (const rule of beh.rules) {
      const emitted = rule.actions.filter(a => a.kind === 'emit' && a.modality === 'SHALL');
      if (emitted.length === 0) continue;
      const rawAssignments = rule.post ?? [];
      // Canonicalize receiver alias to "state" so two rules using different aliases compare cleanly
      const canonicalAssignments = rawAssignments.map(a => {
        const segs = [...a.target.segments];
        if (segs.length > 1 && aliases.has(segs[0])) segs[0] = 'state';
        return { target: { segments: segs, index: a.target.index }, value: a.value, source: a.source };
      });
      const foldSha256 = createHash('sha256').update(JSON.stringify(canonicalAssignments)).digest('hex');

      for (const act of emitted) {
        const key = `${aggName}.${act.event}`;
        if (!foldMap.has(key)) {
          foldMap.set(key, {
            aggregate: aggName,
            event: act.event,
            assignments: canonicalAssignments,
            foldSha256,
            sourceRuleIds: [rule.id],
          });
        } else {
          const existing = foldMap.get(key);
          if (existing.foldSha256 !== foldSha256) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_INCONSISTENT_EVENT_FOLD',
              target: beh.target,
              message: `event "${key}" has conflicting post:/transition folds across rules [${existing.sourceRuleIds.join(', ')}] and [${rule.id}]`,
            });
          } else {
            existing.sourceRuleIds.push(rule.id);
          }
        }
      }
    }
  }

  return { eventFolds: [...foldMap.values()], diagnostics };
}

function buildTestIrV2(spec, smt, firstHit, { sourceFile, sourceText }) {
  const sourceSha256 = createHash('sha256').update(sourceText).digest('hex');
  const [aggregateOrStory, ...sliceParts] = spec.target.split('.');
  const sliceName = sliceParts.join('.') || null;

  const commandGroups = new Map();
  for (const rule of spec.rules) {
    const cmd = rule.command ?? spec.target;
    if (!commandGroups.has(cmd)) commandGroups.set(cmd, []);
    commandGroups.get(cmd).push(rule);
  }

  const scenarios = [];
  for (const [command, rules] of commandGroups) {
    const ruleIds = rules.map(r => r.id);
    const examples = rules.map((rule, orderIdx) => {
      const fh = firstHit.byRuleId.get(rule.id);
      return {
        ruleId: rule.id,
        firstHitOrder: orderIdx,
        pattern: rule.pattern,
        witness: fh?.primary ?? { scalars: {}, mapEntries: {}, externs: {} },
        secondaryWitness: fh?.secondary ?? null,
        boundaryWitnesses: fh?.boundaries ?? [],
        outcome: formatOutcomeSummary(rule),
        actions: rule.canonicalActions,
        post: extractRulePostAssignments(rule),
      };
    });

    scenarios.push({
      id: `${toSlug(command)}-oracle`,
      kind: spec.layer === 'application' ? 'application' : 'outline',
      command,
      title: `${spec.target} — ${command} First-Hit executable oracle`,
      ruleIds,
      tags: [
        ...ruleIds.map(id => `@spec:${id}`),
        smt.logic === 'QF_NIA' ? '@z3-witness:QF_NIA' : '@z3-witness',
      ],
      examples,
    });
  }

  for (const prop of smt.bmc?.properties ?? []) {
    scenarios.push({
      id: prop.id,
      kind: 'bmc',
      command: spec.target,
      title: prop.description,
      ruleIds: [prop.setterRuleId, prop.consumerRuleId].filter(Boolean),
      tags: [
        ...[prop.setterRuleId, prop.consumerRuleId].filter(Boolean).map(id => `@spec:${id}`),
        `@bmc:${prop.steps}-step`,
      ],
      bmc: { steps: prop.steps, status: prop.status, passed: prop.passed },
      examples: [],
    });
  }

  const testIr = {
    schemaVersion: 'co-arising.test-ir/v2',
    meta: {
      sourceFile,
      sourceSha256,
      canonicalSha256: spec.canonicalSha256,
      kind: spec.kind,
      layer: spec.layer,
      target: spec.target,
      aggregate: spec.kind === 'slice' ? aggregateOrStory : null,
      slice: sliceName,
      story: spec.kind === 'story' ? toSlug(spec.target) : null,
      solver: smt.solver,
      logic: smt.logic,
      verified: true,
    },
    scenarios,
  };
  testIr.sha256 = createHash('sha256').update(JSON.stringify(testIr)).digest('hex');
  return testIr;
}

function classifyCodegenChannel(spec) {
  if (spec.layer === 'application') {
    return { tier: spec.theory.externCount > 0 ? 'L3' : spec.theory.tier, codegenChannel: 'cloze-tdd' };
  }
  if (spec.theory.tier === 'L1' && spec.theory.externCount === 0) {
    return { tier: 'L1', codegenChannel: 'deterministic' };
  }
  return {
    tier: spec.theory.externCount > 0 ? 'L3' : 'L2',
    codegenChannel: 'cloze-tdd',
  };
}

export function compileCanonicalV2({
  structuresDir,
  specsPath,
  outFile = null,
  dbFile = null,
  solver = 'z3',
  bmcSteps = 4,
  checkGaps = true,
  includeZh = false,
} = {}) {
  const loaded = loadV2Structures(structuresDir);
  const allDiagnostics = [...loaded.diagnostics];
  const clarificationCards = [];

  const specFiles = collectEarsFiles(specsPath, { includeZh });
  if (specFiles.length === 0) {
    allDiagnostics.push({
      severity: 'error',
      code: 'V2_NO_SPECS',
      message: `no *.ears specification files found at "${specsPath}"`,
    });
  }

  const aggByName = new Map(loaded.structures.aggregates.map(a => [a.name, a]));
  const behaviors = [];
  const clozeSlots = [];

  for (const filePath of specFiles) {
    const sourceText = readFileSync(filePath, 'utf8');
    const ast = parseEars(sourceText, { file: filePath });
    const normalized = normalizeEars(ast);
    const bound = bindEarsSpec(normalized, loaded.symbolTable);

    for (const d of bound.diagnostics) {
      allDiagnostics.push({ ...d, file: filePath, target: bound.target });
    }
    const hardErrors = bound.diagnostics.filter(d => d.severity === 'error');
    if (hardErrors.length > 0) continue;

    // Hard SMT/Z3 Gate
    const smt = verifyEarsWithSmt(bound, { solver, bmcSteps, checkGaps });
    if (!smt.passed) {
      for (const card of smt.clarificationCards) clarificationCards.push(card);
      allDiagnostics.push({
        severity: 'error',
        code: 'V2_SMT_GATE_FAILED',
        file: filePath,
        target: bound.target,
        message: `SMT verification failed for "${bound.target}" (${smt.findings.length} finding(s)); Canonical Model v2 emission blocked`,
      });
      continue;
    }

    // DMN First-Hit exact witness & shadowing check
    const firstHit = synthesizeFirstHitWitnesses(bound, { solver });
    for (const sh of firstHit.shadowedRules) {
      allDiagnostics.push({
        severity: 'error',
        code: 'V2_FIRST_HIT_SHADOWED_RULE',
        file: filePath,
        target: bound.target,
        message: `rule [${sh.ruleId}] on "${bound.target}.${sh.command}" is unreachable under DMN First-Hit priority (shadowed by earlier rules)`,
      });
    }
    if (firstHit.shadowedRules.length > 0) continue;

    const channel = classifyCodegenChannel(bound);
    const aggName = bound.kind === 'slice' ? bound.target.split('.')[0] : null;
    const aggStruct = aggName ? aggByName.get(aggName) ?? null : null;
    const testIr = buildTestIrV2(bound, smt, firstHit, { sourceFile: basename(filePath), sourceText });

    const behavior = {
      schemaVersion: 'co-arising.ears-ir/v2',
      kind: bound.kind,
      layer: bound.layer,
      target: bound.target,
      sourceFile: basename(filePath),
      hitPolicy: 'FIRST',
      theory: {
        tier: channel.tier,
        logic: smt.logic,
        codegenChannel: channel.codegenChannel,
        hasNonlinearMul: bound.theory.hasNonlinearMul,
        hasMultiStepBmc: bound.theory.hasMultiStepBmc,
        externCount: bound.theory.externCount,
      },
      verification: {
        solver: smt.solver,
        passed: true,
        bmcSteps: smt.bmc?.steps ?? 0,
        canonicalSha256: bound.canonicalSha256,
      },
      axioms: bound.axioms.map(ax => (
        ax.kind === 'invariant'
          ? { id: ax.id, kind: ax.kind, expr: ax.canonicalExpr }
          : { id: ax.id, kind: ax.kind, actions: ax.canonicalActions }
      )),
      externs: bound.externs.map((ext, index) => ({
        index,
        name: ext.name,
        params: ext.params ?? [],
        gloss: ext.gloss ?? null,
      })),
      where: bound.where.map(w => ({
        name: w.name,
        gloss: w.gloss ?? null,
      })),
      rules: bound.rules.map((r, idx) => ({
        id: r.id,
        firstHitOrder: idx,
        pattern: r.pattern,
        command: r.command,
        guard: r.canonicalGuard,
        actions: r.canonicalActions,
        post: extractRulePostAssignments(r),
      })),
      eventPropagations: buildEventPropagations(bound, aggStruct),
      testIr,
    };

    behaviors.push(behavior);

    if (channel.codegenChannel === 'cloze-tdd') {
      clozeSlots.push({
        slotId: toSlug(bound.target),
        target: bound.target,
        kind: bound.kind,
        layer: bound.layer,
        tier: channel.tier,
        ruleIds: bound.rules.map(r => r.id),
      });
    }
  }

  // Contract 3: Event Sourcing post: fold consistency
  const foldResult = collectAndVerifyEventFolds(behaviors, loaded.structures);
  allDiagnostics.push(...foldResult.diagnostics);

  const hardFailures = allDiagnostics.filter(d => d.severity === 'error');
  if (hardFailures.length > 0) {
    return {
      schemaVersion: 'co-arising.compile-v2-result/v1',
      passed: false,
      blocked: true,
      outFile: null,
      dbInfo: null,
      canonical: null,
      diagnostics: allDiagnostics,
      clarificationCards,
    };
  }

  const deterministicCount = behaviors.filter(b => b.theory.codegenChannel === 'deterministic').length;
  const clozeCount = behaviors.length - deterministicCount;

  const corePayload = {
    schemaVersion: 'co-arising.canonical/v2',
    system: loaded.system,
    context: loaded.context,
    structures: loaded.structures,
    behaviors,
    eventFolds: foldResult.eventFolds,
    clozeSlots,
    verificationSummary: {
      solver,
      passed: true,
      behaviorCount: behaviors.length,
      deterministicCount,
      clozeCount,
    },
  };

  const canonicalSha256 = createHash('sha256').update(JSON.stringify(corePayload)).digest('hex');
  const canonical = {
    schemaVersion: corePayload.schemaVersion,
    system: corePayload.system,
    context: corePayload.context,
    canonicalSha256,
    structures: corePayload.structures,
    behaviors: corePayload.behaviors,
    eventFolds: corePayload.eventFolds,
    clozeSlots: corePayload.clozeSlots,
    verificationSummary: corePayload.verificationSummary,
  };

  let writtenOut = null;
  if (outFile) {
    const absOut = resolve(outFile);
    mkdirSync(dirname(absOut), { recursive: true });
    writeFileSync(absOut, JSON.stringify(canonical, null, 2) + '\n', 'utf8');
    writtenOut = absOut;
  }

  let dbInfo = null;
  if (dbFile) {
    dbInfo = writeV2KnowledgeGraph(dbFile === ':memory:' ? ':memory:' : resolve(dbFile), canonical);
  }

  return {
    schemaVersion: 'co-arising.compile-v2-result/v1',
    passed: true,
    blocked: false,
    outFile: writtenOut,
    dbInfo,
    canonical,
    diagnostics: allDiagnostics,
    clarificationCards: [],
  };
}
