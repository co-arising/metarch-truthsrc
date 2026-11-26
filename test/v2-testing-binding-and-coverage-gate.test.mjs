// Batch D Tests:
//   - Layered Testing Strategy Binding (`bindings/*-testing.yaml`, `co-arising.testing-binding/v2`)
//   - Real Node `--experimental-test-coverage` behavioral coverage gate in `verify-v2`
//   - Scala & TS behavioral testability gate (no wall-clock/UUID/Await in pure domain/cloze)
//   - Scala `scoverage.xml` parser & threshold enforcement
//   - Parallel TDD git-worktree isolation (`workspace="share"`) in `coarising_cloze_pipeline.py`
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { typescriptCodegenPlugin } from '../lib/v2/codegen/typescript.mjs';
import { scalaCodegenPlugin } from '../lib/v2/codegen/scala.mjs';
import { emitV2ExecutableTests } from '../lib/v2/test-emitter/emit.mjs';
import { runCheckV2 } from '../lib/v2/check-v2.mjs';
import { generateDomainMutants, runDomainMutationGate } from '../lib/v2/mutation-gate.mjs';
import {
  checkBehavioralTestability,
  detectScalaToolchain,
  extractNodeCoverageMetrics,
  parseScoverageXml,
  resolveScalaTestClasspath,
  runV2VerifyGate,
} from '../lib/v2/verify-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CANARY_ROOT = resolve(__dirname, 'fixtures/canary/wealth_exam_canary');

test('Batch D: Canary compiles testing-binding/v2 (pure-unit + mockito/akka doubles + play-test + share worktree) and renders signoff', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-testing-binding-'));
  try {
    const signoffDir = join(workDir, 'signoff');
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors'),
      bindingsPath: join(CANARY_ROOT, 'bindings'),
      outSignoffDir: signoffDir,
      strictLineage: true,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));
    assert.equal(compiled.canonical.testing.schemaVersion, 'co-arising.testing-binding/v2');
    assert.equal(compiled.canonical.testing.layers.domain.harness, 'pure-unit');
    assert.equal(compiled.canonical.testing.layers.domain.minLineCoverage, 80);
    assert.equal(compiled.canonical.testing.layers.application.harness, 'hybrid');
    assert.equal(compiled.canonical.testing.layers.application.doubles.length, 2);
    assert.equal(compiled.canonical.testing.layers.interfaces.harness, 'play-test');
    assert.equal(compiled.canonical.testing.parallelTdd.workspaceMode, 'share');

    const linMd = readFileSync(join(signoffDir, 'lineage.md'), 'utf8');
    assert.ok(linMd.includes('Layered Test Strategy & Parallel TDD Isolation'));
    assert.ok(linMd.includes('BatchAdminPort:mockito'));
    assert.ok(linMd.includes('workspaceMode=share'));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('Batch D Fail-Closed: testing-binding rejects mockito in pure domain, unknown ports, invalid harnesses, and bad coverage %', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coarising-testing-neg-'));
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
    mkdirSync(join(dir, 'bindings'), { recursive: true });
    writeFileSync(join(dir, 'structures/s.yaml'), `
system: t-neg
context: tn
aggregates:
  - name: Box
    aliases: [box, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
    commands:
      - name: Close
        parameters: []
        produces: [Closed]
    events:
      - name: Closed
        fields: []
ports:
  - name: BoxPort
    operations:
      - name: close
        parameters: []
        returns: Unit
`, 'utf8');
    writeFileSync(join(dir, 'behaviors/domain/close.ears'), `
slice Box.Close
rules:
  [BAD] IF box.status != "open" THEN SHALL reject request with CLOSED
  [OK]  WHILE box.status == "open" WHEN Close SHALL transition box.status -> "closed" AND emit Closed
`, 'utf8');
    writeFileSync(join(dir, 'bindings/bad-testing.yaml'), `
schemaVersion: co-arising.testing-binding/v2
layers:
  domain:
    harness: mockito
    minLineCoverage: 150
  application:
    harness: bogus-harness
    doubles:
      - port: GhostGatewayPort
        strategy: bogus-double
  interfaces:
    harness: unknown-http
  infrastructure:
    harness: unknown-infra
parallelTdd:
  workspaceMode: unsafe-mode
  mergeStrategy: magic-merge
`, 'utf8');

    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      bindingsPath: join(dir, 'bindings'),
    });
    assert.equal(res.passed, false);
    const errs = res.diagnostics.filter(d => d.severity === 'error').map(d => d.code);
    for (const code of [
      'V2_TESTING_FORBIDDEN_DOMAIN_HARNESS',
      'V2_TESTING_INVALID_COVERAGE',
      'V2_TESTING_INVALID_HARNESS',
      'V2_TESTING_UNKNOWN_PORT',
    ]) {
      assert.ok(errs.includes(code), `expected ${code} in ${JSON.stringify(errs)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Batch D Verify Gate: live TS behavioral coverage threshold + Scala scoverage.xml + Scala/TS testability audit', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-verify-cov-'));
  try {
    const canonicalFile = join(workDir, '.truthsrc/canonical-v2.json');
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors/domain'),
      bindingsPath: join(CANARY_ROOT, 'bindings'),
      outFile: canonicalFile,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'cov.canary' });
    emitV2ExecutableTests(compiled.canonical, { outDir: workDir, targets: ['typescript'], packageName: 'cov.canary' });

    // 1. Passing coverage threshold (80% from canary-testing.yaml)
    const passGate = runV2VerifyGate({
      rootDir: workDir,
      targets: ['typescript'],
      canonicalFile,
      strict: true,
    });
    assert.equal(passGate.passed, true, JSON.stringify(passGate, null, 2));
    assert.equal(passGate.testabilityCheck.passed, true);
    assert.equal(passGate.coverageCheck.passed, true);
    assert.ok(passGate.coverageCheck.tsLinePct >= 80, `expected >= 80% TS line coverage, got ${passGate.coverageCheck.tsLinePct}`);

    // 2. Unreachable coverage threshold (100% when default switch branch is uncovered) -> MUST FAIL
    const strictCovFail = runV2VerifyGate({
      rootDir: workDir,
      targets: ['typescript'],
      canonicalFile,
      minCoverage: 99.9,
      strict: true,
    });
    assert.equal(strictCovFail.coverageCheck.passed, false);
    assert.equal(strictCovFail.passed, false);
    assert.ok(strictCovFail.coverageCheck.errors[0].includes('below required threshold 99.9%'));

    // 3. Scala scoverage.xml parsing & threshold check
    const scovDir = join(workDir, 'target/scala-2.13/scoverage-report');
    mkdirSync(scovDir, { recursive: true });
    writeFileSync(
      join(scovDir, 'scoverage.xml'),
      '<scoverage statement-count="100" statements-invoked="72" statement-rate="72.00" branch-rate="65.50"></scoverage>',
      'utf8',
    );
    const parsedScov = parseScoverageXml(readFileSync(join(scovDir, 'scoverage.xml'), 'utf8'));
    assert.deepEqual(parsedScov, { statementPct: 72, branchPct: 65.5 });

    const scovFail = runV2VerifyGate({
      rootDir: workDir,
      targets: ['typescript'],
      canonicalFile,
      minCoverage: 80,
      strict: true,
    });
    assert.equal(scovFail.coverageCheck.scalaStatementPct, 72);
    assert.equal(scovFail.coverageCheck.passed, false);
    assert.ok(scovFail.coverageCheck.errors.some(e => e.includes('Scala scoverage statement coverage 72%')));

    // 4. Behavioral testability gate catches non-deterministic Scala & TS APIs
    mkdirSync(join(workDir, 'handwritten/scala/cov'), { recursive: true });
    writeFileSync(
      join(workDir, 'handwritten/scala/cov/BadCloze.scala'),
      'object BadCloze { val t = System.currentTimeMillis(); val id = UUID.randomUUID(); val x = Await.result(f, d) }\n',
      'utf8',
    );
    mkdirSync(join(workDir, 'handwritten/ts'), { recursive: true });
    writeFileSync(
      join(workDir, 'handwritten/ts/bad.cloze.ts'),
      'export const now = () => Date.now() + Math.random();\n',
      'utf8',
    );
    const testability = checkBehavioralTestability(workDir);
    assert.equal(testability.passed, false);
    const rules = testability.violations.map(v => v.rule);
    assert.ok(rules.includes('TESTABILITY_WALL_CLOCK_SCALA'));
    assert.ok(rules.includes('TESTABILITY_RANDOM_SCALA'));
    assert.ok(rules.includes('TESTABILITY_BLOCKING_AWAIT_SCALA'));
    assert.ok(rules.includes('TESTABILITY_WALL_CLOCK_TS'));
    assert.ok(rules.includes('TESTABILITY_RANDOM_TS'));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('Batch D: extractNodeCoverageMetrics unit check and coarising_cloze_pipeline.py uses worktree share isolation', () => {
  const sample = [
    '# file                    | line % | branch % | funcs % | uncovered lines',
    '# exam-batch.behavior.ts  |  92.50 |    85.00 |  100.00 | 42',
    '# exact.ts                |  60.00 |    50.00 |   60.00 | 10-20',
    '# all files               |  76.25 |    67.50 |   80.00 |',
  ].join('\n');
  const metrics = extractNodeCoverageMetrics(sample);
  assert.equal(metrics.behaviorFiles.length, 1);
  assert.equal(metrics.avgLinePct, 92.5);
  assert.equal(metrics.avgBranchPct, 85);

  const pyText = readFileSync(join(REPO_ROOT, 'workflows/coarising_cloze_pipeline.py'), 'utf8');
  assert.ok(pyText.includes('workspace=workspace_mode'));
  assert.ok(pyText.includes('"share"'));
  assert.ok(pyText.includes('merge_cloze_slot_from_worktree'));
  assert.ok(pyText.includes('--min-coverage'));
});

test('Quality Gate Closure 1: branch coverage enforcement, strict missing scoverage fail-closed, check-v2 bindings wiring, and sbt-scoverage scaffold', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-gate-closure1-'));
  try {
    const canonicalFile = join(workDir, '.truthsrc/canonical-v2.json');
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors/domain'),
      bindingsPath: join(CANARY_ROOT, 'bindings'),
      outFile: canonicalFile,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'gate.canary' });
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'gate.canary', withScaffold: true });
    emitV2ExecutableTests(compiled.canonical, { outDir: workDir, targets: ['typescript', 'scala'], packageName: 'gate.canary' });

    // 1. Play sbt scaffold includes sbt-scoverage plugin & minLineCoverage threshold from testing-binding
    const pluginsSbt = readFileSync(join(workDir, 'play-scaffold/project/plugins.sbt'), 'utf8');
    const buildSbt = readFileSync(join(workDir, 'play-scaffold/build.sbt'), 'utf8');
    assert.ok(pluginsSbt.includes('sbt-scoverage'));
    assert.ok(buildSbt.includes('coverageMinimumStmtTotal := 80'));
    assert.ok(buildSbt.includes('coverageFailOnMinimum := true'));

    // 2. TS branch coverage threshold fail-closed
    const branchFail = runV2VerifyGate({
      rootDir: workDir,
      targets: ['typescript'],
      canonicalFile,
      minBranchCoverage: 99.9,
      mutationGate: false,
      strict: true,
    });
    assert.equal(branchFail.coverageCheck.passed, false);
    assert.ok(branchFail.coverageCheck.errors.some(e => e.includes('branch coverage')));

    // 3. Scala strict mode FAILS CLOSED when minLineCoverage is configured but scoverage.xml is missing
    const tc = detectScalaToolchain();
    const cp = resolveScalaTestClasspath({ scalaBinaryVersion: tc.binaryVersion });
    if (tc.available && cp.jars.length > 0) {
      const missingScov = runV2VerifyGate({
        rootDir: workDir,
        targets: ['scala'],
        canonicalFile,
        mutationGate: false,
        strict: true,
      });
      assert.equal(missingScov.scalaCheck.passed, true, JSON.stringify(missingScov.scalaCheck, null, 2));
      assert.equal(missingScov.coverageCheck.passed, false);
      assert.ok(missingScov.coverageCheck.errors.some(e => e.includes('scoverage.xml report is missing')));

      // 4. Scala scoverage branch-rate below minBranchCoverage (70%) -> FAIL
      const scovDir = join(workDir, 'play-scaffold/target/scala-2.13/scoverage-report');
      mkdirSync(scovDir, { recursive: true });
      writeFileSync(
        join(scovDir, 'scoverage.xml'),
        '<scoverage statement-count="100" statements-invoked="90" statement-rate="90.00" branch-rate="60.00"></scoverage>',
        'utf8',
      );
      const lowBranchScov = runV2VerifyGate({
        rootDir: workDir,
        targets: ['scala'],
        canonicalFile,
        mutationGate: false,
        strict: true,
      });
      assert.equal(lowBranchScov.coverageCheck.passed, false);
      assert.ok(lowBranchScov.coverageCheck.errors.some(e => e.includes('Scala scoverage branch coverage 60%')));

      // 5. Scala scoverage meeting both statement >= 80% and branch >= 70% -> PASS via check-v2 with bindingsPath!
      writeFileSync(
        join(scovDir, 'scoverage.xml'),
        '<scoverage statement-count="100" statements-invoked="92" statement-rate="92.00" branch-rate="85.00"></scoverage>',
        'utf8',
      );
      const checkRes = runCheckV2({
        rootDir: workDir,
        structuresDir: join(CANARY_ROOT, 'structures'),
        behaviorsPath: join(CANARY_ROOT, 'behaviors/domain'),
        bindingsPath: join(CANARY_ROOT, 'bindings'),
        targets: ['typescript', 'scala'],
        packageName: 'gate.canary',
        strict: true,
        mutationGate: false,
        skipCoverage: true,
      });
      assert.equal(checkRes.passed, true, JSON.stringify(checkRes, null, 2));
      assert.equal(checkRes.verify.coverageCheck.minLineCoverage, 80);
      assert.equal(checkRes.verify.coverageCheck.minBranchCoverage, 70);
      assert.equal(checkRes.verify.coverageCheck.scalaStatementPct, 92);
      assert.equal(checkRes.verify.coverageCheck.scalaBranchPct, 85);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('Quality Gate Closure 2: full per-route RoleBasedAuthority Authz Matrix specs execute live on both TS and Scala', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-authz-matrix-'));
  try {
    const canonicalFile = join(workDir, '.truthsrc/canonical-v2.json');
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors'),
      bindingsPath: join(CANARY_ROOT, 'bindings'),
      outFile: canonicalFile,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'authz.canary' });
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'authz.canary' });
    emitV2ExecutableTests(compiled.canonical, { outDir: workDir, targets: ['typescript', 'scala'], packageName: 'authz.canary' });

    const tsSpec = readFileSync(join(workDir, 'generated-tests/ts/interfaces-http.ears.spec.ts'), 'utf8');
    const scalaSpec = readFileSync(join(workDir, 'generated-tests/scala/authz/canary/InterfacesHttpSpec.scala'), 'utf8');

    for (const specId of [
      'AUTHZ_BATCH_ADMIN_PORT_PUBLISH_401',
      'AUTHZ_BATCH_ADMIN_PORT_PUBLISH_403_ROLE',
      'AUTHZ_BATCH_ADMIN_PORT_PUBLISH_ALLOW_ROLE',
      'AUTHZ_BATCH_ADMIN_PORT_PUBLISH_403_CSRF',
      'AUTHZ_BATCH_ADMIN_PORT_APPROVE_WITHDRAW_401',
      'AUTHZ_BATCH_ADMIN_PORT_APPROVE_WITHDRAW_403_PDP_DENY',
      'AUTHZ_BATCH_ADMIN_PORT_APPROVE_WITHDRAW_ALLOW_PDP',
      'AUTHZ_BATCH_ADMIN_PORT_APPROVE_WITHDRAW_403_CSRF',
    ]) {
      assert.ok(tsSpec.includes(specId), `TS interfaces spec missing ${specId}`);
      assert.ok(scalaSpec.includes(specId), `Scala interfaces spec missing ${specId}`);
    }

    // Fill minimal @cloze for BatchLifecycle so full TS & Scala suites execute end-to-end
    const tsClozeFile = join(workDir, 'handwritten/batch-lifecycle.cloze.ts');
    const tsClozeOrig = readFileSync(tsClozeFile, 'utf8');
    writeFileSync(
      tsClozeFile,
      tsClozeOrig.replace(
        /throw new Error\("CLOZE_NOT_IMPLEMENTED:[^"]+"\);/u,
        `if (!externs.sessionValid(req.payload.actor)) return { ok: false, code: "UNAUTHORIZED", ruleId: "BL-01" };
    if (req.operation === "BatchAdminPort.publish") {
      effects.dispatch("ExamBatch.PublishBatch", req.payload);
      return { ok: true, ruleId: "BL-02", responseType: "BatchAck", response: { accepted: true, replayed: false } };
    }
    effects.dispatch("ExamBatch.WithdrawBatch", req.payload);
    return { ok: true, ruleId: "BL-03", responseType: "BatchAck", response: { accepted: true, replayed: false } };`,
      ),
      'utf8',
    );

    const scClozeFile = join(workDir, 'handwritten/scala/authz/canary/BatchLifecycleCloze.scala');
    const scClozeOrig = readFileSync(scClozeFile, 'utf8');
    writeFileSync(
      scClozeFile,
      scClozeOrig.replace(
        /throw new UnsupportedOperationException\("CLOZE_NOT_IMPLEMENTED:[^"]+"\)/u,
        `if (!externs.sessionValid(req.payload.getOrElse("actor", ""))) Left(DomainRejection("UNAUTHORIZED", "BL-01"))
    else if (req.operation == "BatchAdminPort.publish") {
      effects.dispatch("ExamBatch.PublishBatch", req.payload)
      Right(BatchLifecycleSuccessResponse(ruleId = "BL-02", responseType = Some("BatchAck"), response = Map("accepted" -> true, "replayed" -> false)))
    } else {
      effects.dispatch("ExamBatch.WithdrawBatch", req.payload)
      Right(BatchLifecycleSuccessResponse(ruleId = "BL-03", responseType = Some("BatchAck"), response = Map("accepted" -> true, "replayed" -> false)))
    }`,
      ),
      'utf8',
    );

    const tc = detectScalaToolchain();
    const cp = resolveScalaTestClasspath({ scalaBinaryVersion: tc.binaryVersion });
    const targets = tc.available && cp.jars.length > 0 ? ['typescript', 'scala'] : ['typescript'];

    const gate = runV2VerifyGate({
      rootDir: workDir,
      targets,
      canonicalFile,
      requireScoverage: false,
      mutationGate: false,
      strict: true,
    });
    assert.equal(gate.passed, true, JSON.stringify(gate, null, 2));
    assert.equal(gate.tsCheck.passed, true);
    if (targets.includes('scala')) {
      assert.equal(gate.scalaCheck.passed, true);
      assert.ok(gate.scalaCheck.suiteClasses.includes('authz.canary.InterfacesHttpSpec'));
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('Quality Gate Closure 3: built-in deterministic Domain Mutation Gate kills 100% mutants on TS & Scala and catches surviving mutants', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-mut-gate-test-'));
  try {
    const canonicalFile = join(workDir, '.truthsrc/canonical-v2.json');
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors/domain'),
      bindingsPath: join(CANARY_ROOT, 'bindings'),
      outFile: canonicalFile,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'mut.canary' });
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'mut.canary' });
    emitV2ExecutableTests(compiled.canonical, { outDir: workDir, targets: ['typescript', 'scala'], packageName: 'mut.canary' });

    const tsBehPath = join(workDir, 'generated-scaffold/ts/exam-batch.behavior.ts');
    const tsBehBefore = readFileSync(tsBehPath, 'utf8');
    const tsMutants = generateDomainMutants(tsBehBefore, 'ts');
    assert.ok(tsMutants.length >= 4, `expected >= 4 TS mutants, got ${tsMutants.length}`);

    const tc = detectScalaToolchain();
    const cp = resolveScalaTestClasspath({ scalaBinaryVersion: tc.binaryVersion });
    const targets = tc.available && cp.jars.length > 0 ? ['typescript', 'scala'] : ['typescript'];

    // 1. Live mutation gate via runV2VerifyGate (automatically enabled by canary-testing.yaml mutationGate: true)
    const gate = runV2VerifyGate({
      rootDir: workDir,
      targets,
      canonicalFile,
      requireScoverage: false,
      strict: true,
    });
    assert.equal(gate.passed, true, JSON.stringify(gate, null, 2));
    assert.equal(gate.mutationCheck.enabled, true);
    assert.equal(gate.mutationCheck.passed, true);
    assert.equal(gate.mutationCheck.ts.killRate, 100);
    assert.ok(gate.mutationCheck.ts.killed >= 4);
    if (targets.includes('scala')) {
      assert.equal(gate.mutationCheck.scala.killRate, 100);
      assert.ok(gate.mutationCheck.scala.killed >= 4);
    }
    // Original workspace file must remain completely untouched
    assert.equal(readFileSync(tsBehPath, 'utf8'), tsBehBefore);

    // 2. Negative fail-closed: weaken TS test suite so mutants survive -> mutation gate MUST FAIL
    const specFile = join(workDir, 'generated-tests/ts/exam-batch-publish-batch.ears.spec.ts');
    writeFileSync(specFile, 'import { test } from "node:test";\ntest("vacuous", () => {});\n', 'utf8');
    const weakMut = runDomainMutationGate({
      rootDir: workDir,
      targets: ['typescript'],
      maxMutants: 4,
    });
    assert.equal(weakMut.passed, false);
    assert.ok(weakMut.ts.survived.length > 0);
    assert.ok(weakMut.errors.some(e => e.includes('Mutant survived')));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
