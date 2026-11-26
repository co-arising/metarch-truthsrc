// Unified co-arising 2.0 EARS-Native Compiler:
// Orthogonal structures (YAML/JSON) + unique behaviors (.ears) -> SMT/Z3 Hard Gate -> Canonical Model v2.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseEars } from '../ears/parser.mjs';
import { normalizeEars } from '../ears/normalize.mjs';
import { bindEarsSpec } from '../ears/binder.mjs';
import { verifyEarsWithSmt } from '../ears/clarification-card.mjs';
import { checkSolverAvailable } from '../ears/smt-solver.mjs';
import { projectStyleE } from '../ears/project-ac.mjs';
import { projectStyleB } from '../ears/project-table.mjs';
import { loadV2Structures } from './structure-loader.mjs';
import { buildEventPropagations, verifyV2DataLineage } from './lineage.mjs';
import { loadAndValidateReadsideBindings } from './readside-binding.mjs';
import { loadAndValidateTestingBindings } from './testing-binding.mjs';
import { emitSignoffDocs } from './signoff.mjs';
import { synthesizeFirstHitWitnesses } from './first-hit-witness.mjs';
import { writeV2KnowledgeGraph } from './knowledge-db.mjs';
import { enrichDiagnostics } from './diagnostics.mjs';

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

const APPLICATION_ONLY_ACTIONS = new Set(['pin', 'dispatch', 'respond', 'expose']);
const DOMAIN_ONLY_ACTIONS = new Set(['emit', 'transition']);

function checkPathLayerConstraint(filePath, specsPath, spec) {
  const diagnostics = [];
  const absRoot = resolve(specsPath);
  let segments = [];
  try {
    if (statSync(absRoot).isDirectory()) {
      const relDir = dirname(relative(absRoot, filePath));
      if (relDir && relDir !== '.') {
        segments = relDir.split(/[\\/]+/u).filter(Boolean);
      }
    }
  } catch {
    segments = [];
  }

  const inDomainDir = segments.includes('domain');
  const inApplicationDir = segments.includes('application') || segments.includes('stories');

  if (inDomainDir && inApplicationDir) {
    diagnostics.push({
      severity: 'error',
      code: 'V2_PATH_LAYER_MISMATCH',
      file: filePath,
      span: spec.span,
      target: spec.target,
      message: `spec "${spec.target}" sits under ambiguous nested layer path "${segments.join('/')}"`,
    });
    return diagnostics;
  }

  if (inDomainDir && (spec.layer !== 'domain' || spec.kind === 'story')) {
    diagnostics.push({
      severity: 'error',
      code: 'V2_PATH_LAYER_MISMATCH',
      file: filePath,
      span: spec.span,
      target: spec.target,
      message: `spec "${spec.target}" (kind=${spec.kind}, layer=${spec.layer}) is placed under domain/ but domain/ only allows domain-layer aggregate behaviors`,
    });
  }

  if (inApplicationDir && (spec.layer !== 'application' || spec.kind !== 'story')) {
    diagnostics.push({
      severity: 'error',
      code: 'V2_PATH_LAYER_MISMATCH',
      file: filePath,
      span: spec.span,
      target: spec.target,
      message: `spec "${spec.target}" (kind=${spec.kind}, layer=${spec.layer}) is placed under ${segments.join('/')}/ but application/stories only allows "story ... layer application"`,
    });
  }

  for (const rule of spec.rules ?? []) {
    for (const act of rule.actions ?? []) {
      if (spec.layer === 'domain' && APPLICATION_ONLY_ACTIONS.has(act.kind)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_LAYER_ACTION_VIOLATION',
          file: filePath,
          span: rule.span,
          target: spec.target,
          message: `domain rule [${rule.id}] on "${spec.target}" must not use application action "${act.kind}"`,
        });
      }
      if (spec.layer === 'application' && DOMAIN_ONLY_ACTIONS.has(act.kind)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_LAYER_ACTION_VIOLATION',
          file: filePath,
          span: rule.span,
          target: spec.target,
          message: `application rule [${rule.id}] on "${spec.target}" must not mutate aggregate directly with "${act.kind}" (use dispatch instead)`,
        });
      }
    }
  }

  return diagnostics;
}

export function compileCanonicalV2({
  structuresDir,
  specsPath,
  bindingsPath = null,
  outFile = null,
  dbFile = null,
  solver = 'z3',
  bmcSteps = 4,
  checkGaps = true,
  includeZh = false,
  checkBilingual = true,
  outAcDir = null,
  outTablesDir = null,
  outSignoffDir = null,
  projectionLang = 'zh',
  strictLineage = false,
} = {}) {
  const effectiveAcDir = outAcDir ?? (outSignoffDir ? join(resolve(outSignoffDir), 'ac') : null);
  const effectiveTablesDir = outTablesDir ?? (outSignoffDir ? join(resolve(outSignoffDir), 'tables') : null);
  const loaded = loadV2Structures(structuresDir);
  const allDiagnostics = [...loaded.diagnostics];
  const readsideResult = loadAndValidateReadsideBindings(bindingsPath, loaded.structures);
  allDiagnostics.push(...readsideResult.diagnostics);
  const testingResult = loadAndValidateTestingBindings(bindingsPath, loaded.structures);
  allDiagnostics.push(...testingResult.diagnostics);
  const clarificationCards = [];
  const sourceCache = new Map();
  const projections = [];
  const bilingualChecks = [];

  const specFiles = collectEarsFiles(specsPath, { includeZh });
  if (specFiles.length === 0) {
    allDiagnostics.push({
      severity: 'error',
      code: 'V2_NO_SPECS',
      message: `no *.ears specification files found at "${specsPath}"`,
    });
  }

  let solverChecked = null;
  const ensureSolver = () => {
    if (solverChecked === null) {
      solverChecked = checkSolverAvailable(solver);
    }
    return solverChecked;
  };

  const aggByName = new Map(loaded.structures.aggregates.map(a => [a.name, a]));
  const behaviors = [];
  const clozeSlots = [];
  const ruleLocMap = new Map();

  for (const filePath of specFiles) {
    const sourceText = readFileSync(filePath, 'utf8');
    sourceCache.set(filePath, sourceText);
    const ast = parseEars(sourceText, { file: filePath });
    const normalized = normalizeEars(ast);
    const bound = bindEarsSpec(normalized, loaded.symbolTable, { strictDomainBoundary: true });
    const layerDiagnostics = checkPathLayerConstraint(filePath, specsPath, bound);

    // Optional bilingual sibling equivalence gate: <name>.ears <-> <name>.zh.ears
    if (checkBilingual && !filePath.endsWith('.zh.ears')) {
      const zhSibling = filePath.replace(/\.ears$/u, '.zh.ears');
      if (existsSync(zhSibling)) {
        const zhSource = readFileSync(zhSibling, 'utf8');
        sourceCache.set(zhSibling, zhSource);
        const zhNorm = normalizeEars(parseEars(zhSource, { file: zhSibling }));
        const equivalent = zhNorm.canonicalSha256 === normalized.canonicalSha256;
        bilingualChecks.push({
          enFile: basename(filePath),
          zhFile: basename(zhSibling),
          equivalent,
          enSha256: normalized.canonicalSha256,
          zhSha256: zhNorm.canonicalSha256,
        });
        if (!equivalent) {
          allDiagnostics.push({
            severity: 'error',
            code: 'V2_BILINGUAL_DRIFT',
            file: zhSibling,
            span: zhNorm.span,
            target: bound.target,
            message: `bilingual drift detected between "${basename(filePath)}" (${normalized.canonicalSha256.slice(0, 12)}) and "${basename(zhSibling)}" (${zhNorm.canonicalSha256.slice(0, 12)})`,
          });
        }
      }
    }

    for (const d of bound.diagnostics) {
      allDiagnostics.push({ ...d, file: filePath, target: bound.target });
    }
    for (const d of layerDiagnostics) {
      allDiagnostics.push(d);
    }
    const hardErrors = [...bound.diagnostics, ...layerDiagnostics].filter(d => d.severity === 'error');
    if (hardErrors.length > 0) continue;

    // Hard SMT/Z3 Gate (preflight solver availability once)
    const solverStatus = ensureSolver();
    if (!solverStatus.available) {
      allDiagnostics.push({
        severity: 'error',
        code: 'V2_SOLVER_MISSING',
        file: filePath,
        span: bound.span,
        target: bound.target,
        message: `SMT solver "${solver}" is unavailable: ${solverStatus.guidance}`,
      });
      break;
    }
    const smt = verifyEarsWithSmt(bound, { solver, bmcSteps, checkGaps });
    if (!smt.passed) {
      for (const card of smt.clarificationCards) clarificationCards.push(card);
      allDiagnostics.push({
        severity: 'error',
        code: 'V2_SMT_GATE_FAILED',
        file: filePath,
        span: bound.span,
        target: bound.target,
        message: `SMT verification failed for "${bound.target}" (${smt.findings.length} finding(s)); Canonical Model v2 emission blocked`,
      });
      continue;
    }

    // DMN First-Hit exact witness & shadowing check
    const firstHit = synthesizeFirstHitWitnesses(bound, { solver });
    for (const sh of firstHit.shadowedRules) {
      const shRule = bound.rules.find(r => r.id === sh.ruleId);
      allDiagnostics.push({
        severity: 'error',
        code: 'V2_FIRST_HIT_SHADOWED_RULE',
        file: filePath,
        span: shRule?.span ?? bound.span,
        target: bound.target,
        message: `rule [${sh.ruleId}] on "${bound.target}.${sh.command}" is unreachable under DMN First-Hit priority (shadowed by earlier rules)`,
      });
    }
    if (firstHit.shadowedRules.length > 0) continue;

    const channel = classifyCodegenChannel(bound);
    const aggName = bound.kind === 'slice' ? bound.target.split('.')[0] : null;
    const aggStruct = aggName ? aggByName.get(aggName) ?? null : null;
    const testIr = buildTestIrV2(bound, smt, firstHit, { sourceFile: basename(filePath), sourceText });

    // Optional deterministic read-only business signoff docs (Style E AC + Style B DMN table)
    const specSlug = basename(filePath).replace(/\.zh\.ears$/u, '').replace(/\.ears$/u, '');
    if (effectiveAcDir) {
      const ac = projectStyleE(bound, { sourceFile: basename(filePath), sourceText, lang: projectionLang });
      const dest = join(resolve(effectiveAcDir), `${specSlug}.md`);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, ac.content, 'utf8');
      projections.push({ kind: 'style-e-ac', target: bound.target, file: dest, sourceSha256: ac.sourceSha256 });
    }
    if (effectiveTablesDir) {
      const tbl = projectStyleB(bound, { sourceFile: basename(filePath), sourceText });
      const dest = join(resolve(effectiveTablesDir), `${specSlug}.md`);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, tbl.content, 'utf8');
      projections.push({ kind: 'style-b-dmn-table', target: bound.target, file: dest, sourceSha256: tbl.sourceSha256 });
    }

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
        ...(r.triggerKind === 'event' ? { triggerKind: 'event' } : {}),
        guard: r.canonicalGuard,
        actions: r.canonicalActions,
        post: extractRulePostAssignments(r),
      })),
      eventPropagations: buildEventPropagations(bound, aggStruct),
      testIr,
    };

    for (const r of bound.rules) {
      ruleLocMap.set(`${bound.target}#${r.id}`, { file: filePath, span: r.span });
    }
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

  // Contract 3: Full-chain Data Lineage, Event Sourcing post: fold, and propagation consistency
  const foldResult = verifyV2DataLineage(behaviors, loaded.structures, ruleLocMap, { strictLineage });
  allDiagnostics.push(...foldResult.diagnostics);

  const enrichedDiagnostics = enrichDiagnostics(allDiagnostics, sourceCache);
  const hardFailures = enrichedDiagnostics.filter(d => d.severity === 'error');
  if (hardFailures.length > 0) {
    return {
      schemaVersion: 'co-arising.compile-v2-result/v1',
      passed: false,
      blocked: true,
      outFile: null,
      dbInfo: null,
      canonical: null,
      bilingualChecks,
      projections,
      diagnostics: enrichedDiagnostics,
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
    lineage: foldResult.lineage,
    ...(readsideResult.readside ? { readside: readsideResult.readside } : {}),
    ...(testingResult.testing ? { testing: testingResult.testing } : {}),
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
    lineage: corePayload.lineage,
    ...(corePayload.readside ? { readside: corePayload.readside } : {}),
    ...(corePayload.testing ? { testing: corePayload.testing } : {}),
    clozeSlots: corePayload.clozeSlots,
    verificationSummary: corePayload.verificationSummary,
  };

  const signoffDocs = outSignoffDir ? emitSignoffDocs(canonical, outSignoffDir) : [];
  for (const doc of signoffDocs) projections.push(doc);

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
    bilingualChecks,
    projections,
    diagnostics: enrichedDiagnostics,
    clarificationCards: [],
  };
}
