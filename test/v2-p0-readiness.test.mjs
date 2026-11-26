// Tests for co-arising 2.0 P0 GA blockers:
//   #1 Cross-platform CI preflight & --strict anti-silent-skip
//   #2 Scala layer:application codegen + live ScalaTest oracle parity
//   #3 First-class `truthsrc guard-write` & `truthsrc init-hooks`
//   #4 `truthsrc init-v2` -> `truthsrc check-v2` single-command onboarding DX
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { resolveScalaTestClasspath, runV2Preflight, runV2VerifyGate } from '../lib/v2/verify-gate.mjs';

const BIN = new URL('../bin/truthsrc.js', import.meta.url).pathname;

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('P0 #1: preflight detects missing SMT solver with guidance, and --strict refuses silent ScalaTest skip', () => {
  const dir = makeTempDir('coarising-p0-strict-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
    writeFileSync(join(dir, 'structures/s.yaml'), `
system: preflight-lab
context: core
aggregates:
  - name: Box
    stateFields:
      - count: Int = 0
    commands:
      - name: Tick
        parameters: []
        produces: [Ticked]
    events:
      - name: Ticked
        fields: []
`, 'utf8');
    writeFileSync(join(dir, 'behaviors/domain/box.ears'), `
slice Box.Tick
rules:
  [B1] WHEN Tick SHALL emit Ticked
       post:
         box.count' = box.count + 1
`, 'utf8');

    // Missing solver returns V2_SOLVER_MISSING with actionable install guidance
    const missingSolver = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      solver: 'nonexistent-smt-solver-bin',
    });
    assert.equal(missingSolver.passed, false);
    const diag = missingSolver.diagnostics.find(d => d.code === 'V2_SOLVER_MISSING');
    assert.ok(diag, JSON.stringify(missingSolver.diagnostics));
    assert.ok(diag.message.includes('z3') || diag.message.includes('Install'));

    // Cross-platform classpath resolver supports explicit missing path cleanly
    const badCp = resolveScalaTestClasspath({ scalaClasspath: '/nonexistent/scalatest.jar' });
    assert.equal(badCp.jars.length, 0);
    assert.equal(badCp.source, 'explicit-missing');

    // Preflight helper reports environment status
    const pf = runV2Preflight({ solver: 'z3', targets: ['typescript', 'scala'] });
    assert.equal(pf.smt.available, true);
    assert.ok(pf.scala !== null);

    // Build a minimal TS+Scala project and force missing ScalaTest jars via --scala-classpath
    const initDir = join(dir, 'proj');
    const initCli = spawnSync(process.execPath, [BIN, 'init-v2', initDir, '--target', 'typescript,scala'], { encoding: 'utf8' });
    assert.equal(initCli.status, 0, initCli.stderr + initCli.stdout);

    const strictFail = runV2VerifyGate({
      rootDir: initDir,
      targets: ['typescript', 'scala'],
      strict: true,
      scalaClasspath: '/nonexistent/missing-scalatest.jar',
    });
    assert.equal(strictFail.passed, false);
    assert.equal(strictFail.scalaCheck.skipped, false);
    assert.equal(strictFail.scalaCheck.passed, false);
    assert.equal(strictFail.scalaCheck.stage, 'preflight');
    assert.ok(strictFail.scalaCheck.guidance.includes('COARISING_SCALA_CP'));

    const nonStrictSkip = runV2VerifyGate({
      rootDir: initDir,
      targets: ['typescript', 'scala'],
      strict: false,
      scalaClasspath: '/nonexistent/missing-scalatest.jar',
    });
    assert.equal(nonStrictSkip.passed, true);
    assert.equal(nonStrictSkip.scalaCheck.skipped, true);
    assert.ok(nonStrictSkip.scalaCheck.reason);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P0 #2 + #4: init-v2 scaffolds TS+Scala (domain + application) and check-v2 --strict passes end-to-end', () => {
  const dir = makeTempDir('coarising-p0-init-check-');
  try {
    const projDir = join(dir, 'demo-starter');
    const initProc = spawnSync(process.execPath, [
      BIN, 'init-v2', projDir,
      '--system', 'starter-svc',
      '--context', 'quota',
      '--target', 'typescript,scala',
      '--package', 'example.starter',
    ], { encoding: 'utf8' });
    assert.equal(initProc.status, 0, initProc.stderr + initProc.stdout);
    const initJson = JSON.parse(initProc.stdout);
    assert.equal(initJson.compiled.passed, true);
    assert.ok(existsSync(join(projDir, 'truthsrc.v2.json')));
    assert.ok(existsSync(join(projDir, 'truth/quota/structures/quota.yaml')));
    assert.ok(existsSync(join(projDir, 'truth/quota/behaviors/domain/quota-bucket-reserve.ears')));
    assert.ok(existsSync(join(projDir, 'truth/quota/behaviors/application/quota-intake.story.ears')));
    assert.ok(existsSync(join(projDir, 'generated-scaffold/scala/example/starter/QuotaIntakePort.scala')));
    assert.ok(existsSync(join(projDir, 'handwritten/scala/example/starter/QuotaIntakeCloze.scala')));
    assert.ok(existsSync(join(projDir, 'generated-tests/scala/example/starter/QuotaIntakeEarsSpec.scala')));
    assert.ok(existsSync(join(projDir, '.claude/settings.json')));

    const checkProc = spawnSync(process.execPath, [
      BIN, 'check-v2',
      '--root', projDir,
      '--strict',
      '--format', 'json',
    ], { encoding: 'utf8' });
    assert.equal(checkProc.status, 0, checkProc.stderr + checkProc.stdout);
    const checkJson = JSON.parse(checkProc.stdout);
    assert.equal(checkJson.passed, true, JSON.stringify(checkJson, null, 2));
    assert.equal(checkJson.verify.tsCheck.passed, true);
    assert.equal(checkJson.verify.tsCheck.specFiles.length, 2);
    assert.equal(checkJson.verify.scalaCheck.passed, true);
    assert.equal(checkJson.verify.scalaCheck.suiteClasses.length, 2);
    assert.equal(checkJson.coverage.passed, true);
    assert.equal(checkJson.coverage.coverageRatio, 1);

    // Human output renders cleanly too
    const humanProc = spawnSync(process.execPath, [
      BIN, 'check-v2', '--root', projDir, '--format', 'human',
    ], { encoding: 'utf8' });
    assert.equal(humanProc.status, 0, humanProc.stderr + humanProc.stdout);
    assert.ok(humanProc.stdout.includes('[PASS] co-arising 2.0 check-v2'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P0 #3: truthsrc guard-write CLI and init-hooks enforce locked territories and @cloze boundaries', () => {
  const dir = makeTempDir('coarising-p0-hooks-');
  try {
    const initHooks = spawnSync(process.execPath, [
      BIN, 'init-hooks', '--root', dir, '--target', 'typescript,scala',
    ], { encoding: 'utf8' });
    assert.equal(initHooks.status, 0, initHooks.stderr + initHooks.stdout);
    const settings = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
    assert.ok(settings.hooks.PreToolUse[0].hooks[0].command.includes('guard-write'));
    assert.ok(settings.hooks.Stop[0].hooks[0].command.includes('verify-v2'));

    // Blocked write to generated-tests -> exit 2
    const blocked = spawnSync(process.execPath, [BIN, 'guard-write', '--root', dir], {
      input: JSON.stringify({ tool_input: { file_path: 'generated-tests/ts/foo.ears.spec.ts' } }),
      encoding: 'utf8',
    });
    assert.equal(blocked.status, 2);
    assert.ok(blocked.stderr.includes('TERRITORY_LOCKED'));

    // Blocked out-of-bounds edit on @cloze file -> exit 2
    mkdirSync(join(dir, 'handwritten'), { recursive: true });
    writeFileSync(join(dir, 'handwritten/sample.cloze.ts'), [
      'export const header = 1;',
      '// @cloze:start(sample-slot)',
      'export const body = 2;',
      '// @cloze:end(sample-slot)',
    ].join('\n'), 'utf8');

    const oob = spawnSync(process.execPath, [BIN, 'guard-write', '--root', dir, '--active-cloze', 'sample-slot'], {
      input: JSON.stringify({
        tool_input: {
          file_path: 'handwritten/sample.cloze.ts',
          old_string: 'export const header = 1;',
          new_string: 'export const header = 99;',
        },
      }),
      encoding: 'utf8',
    });
    assert.equal(oob.status, 2);
    assert.ok(oob.stderr.includes('CLOZE_OUT_OF_BOUNDS'));

    // Permitted edit inside @cloze -> exit 0
    const ok = spawnSync(process.execPath, [BIN, 'guard-write', '--root', dir, '--active-cloze', 'sample-slot'], {
      input: JSON.stringify({
        tool_input: {
          file_path: 'handwritten/sample.cloze.ts',
          old_string: 'export const body = 2;',
          new_string: 'export const body = 42;',
        },
      }),
      encoding: 'utf8',
    });
    assert.equal(ok.status, 0, ok.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
