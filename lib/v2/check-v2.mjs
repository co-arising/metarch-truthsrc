// Aggregated single-command gate for co-arising 2.0: compile-v2 (+ optional sync) -> verify-v2 -> audit-coverage-v2.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { compileCanonicalV2 } from './compiler.mjs';
import { getCodegenPlugin } from './codegen/interface.mjs';
import './codegen/typescript.mjs';
import './codegen/scala.mjs';
import './bridge/v1-strict-scala.mjs';
import '../../generators/scala-cqrs-play-service-v2/generate.mjs';
import { emitV2ExecutableTests } from './test-emitter/emit.mjs';
import { runV2VerifyGate } from './verify-gate.mjs';
import { auditFullCoverageV2 } from './coverage-audit.mjs';
import { resolveEffectiveTargets } from './target-resolution.mjs';

function loadProjectConfig(rootDir, projectFile) {
  const candidate = projectFile ? resolve(projectFile) : join(resolve(rootDir), 'truthsrc.v2.json');
  if (!existsSync(candidate)) return { config: null, configDir: resolve(rootDir), configPath: null };
  return {
    config: JSON.parse(readFileSync(candidate, 'utf8')),
    configDir: dirname(candidate),
    configPath: candidate,
  };
}

function resolveConfigPath(explicit, configValue, absRoot) {
  if (explicit) return resolve(explicit);
  if (configValue) return resolve(absRoot, configValue);
  return null;
}

export function runCheckV2({
  rootDir = process.cwd(),
  projectFile = null,
  structuresDir = null,
  behaviorsPath = null,
  bindingsPath = null,
  coverageManifest = null,
  effectBindingFile = null,
  targets = null,
  packageName = null,
  solver = 'z3',
  bmcSteps = 4,
  checkGaps = true,
  strict = Boolean(process.env.CI),
  scalaClasspath = null,
  minCoverage = null,
  minBranchCoverage = null,
  scoverageFile = null,
  requireScoverage = null,
  sbtCoverage = false,
  mutationGate = null,
  sync = false,
  skipCoverage = false,
} = {}) {
  const { config, configDir, configPath } = loadProjectConfig(rootDir, projectFile);
  const absRoot = configPath ? configDir : resolve(rootDir);

  const effStructures = resolveConfigPath(structuresDir, config?.structures, absRoot);
  const effBehaviors = resolveConfigPath(behaviorsPath, config?.behaviors, absRoot);
  const effTargets = resolveEffectiveTargets({ explicitTargets: targets, configTargets: config?.targets, rootDir: absRoot });
  const effPackage = packageName ?? config?.packageName ?? 'example.v2';
  const effCanonical = config?.canonicalOut ? resolve(absRoot, config.canonicalOut) : join(absRoot, '.truthsrc/canonical-v2.json');
  const effDb = config?.dbOut ? resolve(absRoot, config.dbOut) : join(absRoot, '.truthsrc/knowledge.sqlite');
  const effManifest = resolveConfigPath(coverageManifest, config?.coverageManifest, absRoot);
  const effBinding = resolveConfigPath(effectBindingFile, config?.effectBinding, absRoot);
  const effBindingsDir = resolveConfigPath(bindingsPath, config?.bindings, absRoot)
    ?? (effBinding ? dirname(effBinding) : null);

  // A4-11 fix: support verifying merged multi-subdomain BC projects directly from their merged canonical-v2.json
  let preMergedBcCanonical = null;
  if ((!effStructures || !effBehaviors) && existsSync(effCanonical)) {
    try {
      const parsed = JSON.parse(readFileSync(effCanonical, 'utf8'));
      if (Array.isArray(parsed?.packagedSubdomains) && parsed.packagedSubdomains.length > 0) {
        preMergedBcCanonical = parsed;
      }
    } catch { /* fall through to standard error */ }
  }
  if (!preMergedBcCanonical && (!effStructures || !effBehaviors)) {
    throw new Error('check-v2 requires truthsrc.v2.json, explicit --structures/--behaviors, or a merged BC .truthsrc/canonical-v2.json');
  }

  // Stage 1: Compile & SMT Hard Gate (or reuse verified merged BC canonical)
  const compile = preMergedBcCanonical
    ? {
        passed: preMergedBcCanonical.verificationSummary?.passed !== false,
        canonical: preMergedBcCanonical,
        diagnostics: [],
      }
    : compileCanonicalV2({
        structuresDir: effStructures,
        specsPath: effBehaviors,
        bindingsPath: effBindingsDir,
        outFile: effCanonical,
        dbFile: effDb,
        solver,
        bmcSteps,
        checkGaps,
      });

  if (!compile.passed) {
    return {
      schemaVersion: 'co-arising.check-v2/v1',
      passed: false,
      failedStage: 'compile',
      rootDir: absRoot,
      targets: effTargets,
      strict,
      compile,
      sync: null,
      verify: null,
      coverage: null,
    };
  }

  // Optional Stage 1b: Sync generated scaffolds & locked BDD oracles (non-destructive on @cloze)
  let syncSummary = null;
  if (sync) {
    const genResults = [];
    for (const t of effTargets) {
      const plugin = getCodegenPlugin(t);
      if (!plugin) throw new Error(`unknown v2 codegen target: ${t}`);
      genResults.push(plugin.generate(compile.canonical, { outDir: absRoot, packageName: effPackage, overwriteCloze: false }));
    }
    const emitRes = emitV2ExecutableTests(compile.canonical, { outDir: absRoot, targets: effTargets, packageName: effPackage });
    const syncedHandwrittenMethods = genResults.flatMap(r => r?.syncedHandwrittenMethods ?? []);
    const prunedHandwrittenFiles = genResults.flatMap(r => r?.prunedHandwrittenFiles ?? []);
    const staleHandwrittenFiles = genResults.flatMap(r => r?.staleHandwrittenFiles ?? []);
    const handwrittenDrift = genResults.flatMap(r => r?.handwrittenDrift ?? []);
    syncSummary = {
      generatedTargets: effTargets,
      emittedTestFiles: emitRes.manifestCount,
      syncedHandwrittenMethods,
      prunedHandwrittenFiles,
      staleHandwrittenFiles,
      handwrittenDrift,
    };
  }

  // Stage 2: Stop Hook Triple Verification Gate
  const verify = runV2VerifyGate({
    rootDir: absRoot,
    targets: effTargets,
    canonicalFile: effCanonical,
    dbFile: effDb,
    strict,
    scalaClasspath,
    minCoverage,
    minBranchCoverage,
    scoverageFile,
    requireScoverage,
    sbtCoverage,
    mutationGate,
  });

  // Stage 3: Full-Coverage Governance Audit (when manifest is present and not skipped)
  let coverage = null;
  if (!skipCoverage && effManifest && existsSync(effManifest)) {
    coverage = auditFullCoverageV2({
      rootDir: absRoot,
      manifestFile: effManifest,
      effectBindingFile: effBinding,
      dbFile: effDb,
    });
  }

  const coverageOk = coverage ? coverage.passed : true;
  const passed = compile.passed && verify.passed && coverageOk;
  let failedStage = null;
  if (!verify.passed) failedStage = 'verify';
  else if (!coverageOk) failedStage = 'coverage';

  return {
    schemaVersion: 'co-arising.check-v2/v1',
    passed,
    failedStage,
    rootDir: absRoot,
    targets: effTargets,
    strict,
    compile: {
      passed: compile.passed,
      canonicalSha256: compile.canonical.canonicalSha256,
      verificationSummary: compile.canonical.verificationSummary,
      diagnostics: compile.diagnostics,
    },
    sync: syncSummary,
    verify,
    coverage,
  };
}

function appendSyncSummaryLines(lines, sync) {
  if (!sync) return;
  const synced = sync.syncedHandwrittenMethods?.length ?? 0;
  const pruned = sync.prunedHandwrittenFiles?.length ?? 0;
  const stale = sync.staleHandwrittenFiles ?? [];
  const drift = sync.handwrittenDrift ?? [];
  lines.push(`  sync          : targets=${(sync.generatedTargets ?? []).join(', ')}, tests=${sync.emittedTestFiles ?? 0}, syncedMethods=${synced}, prunedFiles=${pruned}, staleFiles=${stale.length}, drift=${drift.length}`);
  for (const s of stale) {
    lines.push(`    [WARN] ${s.code ?? 'STALE_HANDWRITTEN_FILE'}: ${s.path} — ${s.message}`);
  }
  for (const d of drift) {
    lines.push(`    [WARN] ${d.code ?? 'HANDWRITTEN_DRIFT'}: ${d.path} — ${d.message}`);
  }
}

export function renderCheckV2Human(res) {
  const lines = [];
  if (res.passed) {
    lines.push(`[PASS] co-arising 2.0 check-v2 (${res.targets.join(', ')}, strict=${res.strict})`);
    const s = res.compile.verificationSummary;
    lines.push(`  1. compile-v2 : PASS (${s.behaviorCount} behaviors: ${s.deterministicCount} L1 deterministic, ${s.clozeCount} @cloze, sha=${res.compile.canonicalSha256.slice(0, 12)})`);
    lines.push(`  2. verify-v2  : PASS (manifest=${res.verify.manifestCheck.verifiedFiles} locked, ts=${res.verify.tsCheck.specFiles.length} suites, scala=${res.verify.scalaCheck.suiteClasses.length} suites)`);
    if (res.coverage) {
      lines.push(`  3. coverage   : PASS (${res.coverage.classifiedFiles}/${res.coverage.totalGovernedFiles} = 100%, archViolations=${res.coverage.effectBindingSummary?.importViolations ?? 0})`);
    } else {
      lines.push('  3. coverage   : SKIPPED (no coverage manifest configured)');
    }
    appendSyncSummaryLines(lines, res.sync);
    return lines.join('\n');
  }

  lines.push(`[FAIL] co-arising 2.0 check-v2 failed at stage: ${res.failedStage}`);
  appendSyncSummaryLines(lines, res.sync);
  if (res.failedStage === 'compile') {
    for (const d of res.compile?.diagnostics ?? []) {
      lines.push(`  - [${d.severity.toUpperCase()}] ${d.code}: ${d.message}`);
    }
  } else if (res.failedStage === 'verify') {
    if (!res.verify.manifestCheck.passed) {
      for (const e of res.verify.manifestCheck.errors) lines.push(`  - [MANIFEST] ${e}`);
    }
    if (!res.verify.tsCheck.passed) {
      lines.push(`  - [TS] failed specs: ${res.verify.tsCheck.failedSpecIds.join(', ') || `exit ${res.verify.tsCheck.exitCode}`}`);
    }
    if (!res.verify.scalaCheck.passed) {
      lines.push(`  - [SCALA] stage=${res.verify.scalaCheck.stage} ${res.verify.scalaCheck.reason ?? res.verify.scalaCheck.failedSpecIds.join(', ')}`);
      if (res.verify.scalaCheck.guidance) lines.push(`    guidance: ${res.verify.scalaCheck.guidance}`);
    }
    if (!res.verify.provenanceCheck.passed) {
      for (const e of res.verify.provenanceCheck.errors) lines.push(`  - [PROVENANCE] ${e}`);
    }
    if (res.verify.onionCheck && !res.verify.onionCheck.passed) {
      for (const v of res.verify.onionCheck.violations) lines.push(`  - [ONION] ${v.message}`);
    }
    if (res.verify.testabilityCheck && !res.verify.testabilityCheck.passed) {
      for (const v of res.verify.testabilityCheck.violations) lines.push(`  - [TESTABILITY] ${v.message}`);
    }
    if (res.verify.coverageCheck && !res.verify.coverageCheck.passed) {
      for (const e of res.verify.coverageCheck.errors) lines.push(`  - [COVERAGE] ${e}`);
    }
    if (res.verify.mutationCheck && !res.verify.mutationCheck.passed) {
      for (const e of res.verify.mutationCheck.errors ?? []) lines.push(`  - [MUTATION] ${e}`);
    }
  } else if (res.failedStage === 'coverage') {
    for (const d of res.coverage?.diagnostics ?? []) {
      lines.push(`  - [${d.code}] ${d.file ?? ''}: ${d.message}`);
    }
  }
  return lines.join('\n');
}
