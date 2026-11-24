// Emitter-unification tests (emitter-unification plan §4 Phase 1).
// The acceptance itself is `node emitter/parity.mjs`: for all twelve curated
// families, the same fixture input must render byte-identically from the
// emitter module on double runs and must match the curated golden tree byte
// for byte. The eight ported families must also match their tools/gen-*.mjs
// byte-parity reference; the handwritten-golden families (the two host faces
// #43/#44, ruling 2026-11-22, and the value-object family #1, ruling
// 2026-11-23) have no reference generator and carry golden parity alone,
// reported with toolsParity null — never silently green. Families without a
// battery are a registered debt and are asserted here to be exactly the four
// known ones — a fifth silent battery omission must turn this suite red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../emitter/families/index.mjs';
import { registerFamily, getFamily, listFamilyIds, renderFamily, requireFamilySpecPaths } from '../emitter/registry.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FAMILY_COUNT = 16;
const BATTERY_DEBT_FAMILIES = [
  'aggregate-rules-formal',
  'external-connector-port',
  'connector-implementation',
  'projection-apply-event',
].sort();
const HANDWRITTEN_GOLDEN_FAMILIES = ['pipeline-invocation-face', 'effect-face', 'value-object', 'domain-entity', 'aggregate-layer', 'protocol-layer', 'aggregate-repository'].sort();
const CLASSIC_REPRODUCTION_FAMILIES = ['aggregate-invariant-rules'].sort();

test('the unified emitter registers exactly the sixteen curated families', () => {
  assert.equal(listFamilyIds().length, FAMILY_COUNT);
  for (const id of ['aggregate-rules-formal', 'external-connector-port', 'connector-implementation',
    'projection-apply-event', 'aggregate-state-controller', 'strict-saga-module',
    'strict-fixture-host', 'composition-invocation-host', 'pipeline-invocation-face',
    'effect-face', 'aggregate-invariant-rules', 'value-object', 'domain-entity', 'aggregate-layer', 'protocol-layer', 'aggregate-repository']) {
    const family = getFamily(id);
    assert.equal(typeof family.checkInput, 'function', id + ' checkInput');
    assert.equal(typeof family.renderAll, 'function', id + ' renderAll');
  }
  // The handwritten-golden faces declare their provenance explicitly.
  for (const id of HANDWRITTEN_GOLDEN_FAMILIES) {
    const family = getFamily(id);
    assert.equal(family.toolsRef, null, id + ' toolsRef');
    assert.equal(family.provenance, 'handwritten-golden', id + ' provenance');
  }
  // The classic-reproduction rules family pins the bank rules cluster's classic
  // production bytes as its golden receipt (ruling 2026-11-23).
  for (const id of CLASSIC_REPRODUCTION_FAMILIES) {
    const family = getFamily(id);
    assert.equal(family.toolsRef, null, id + ' toolsRef');
    assert.equal(family.provenance, 'classic-reproduction', id + ' provenance');
  }
});

test('the registry is fail-closed on duplicate registration and unknown ids', () => {
  const known = getFamily('aggregate-state-controller');
  assert.throws(() => registerFamily({ ...known }), /already registered/);
  assert.throws(() => getFamily('no-such-family'), /unknown family .*registered families:/);
  assert.throws(() => registerFamily({ id: 'incomplete', familyNumber: 1 }), /missing contract member/);
});

test('a toolsRef null family without the handwritten-golden provenance is rejected', () => {
  const known = getFamily('pipeline-invocation-face');
  assert.throws(() => registerFamily({ ...known, id: 'unproven-face', provenance: 'ported' }),
    /handwritten-golden/);
});

test('spec-tree existence is enforced at spec-use time, not at registration', () => {
  // The installed npm package contractually excludes test/reference/ (offline
  // tarball suites), and the flip wiring makes classic generate load the family
  // index — registration must not require the spec trees. Generation never
  // reads them; the parity/diff/verify surfaces call requireFamilySpecPaths
  // first and stay fail-closed with the same diagnostics.
  const known = getFamily('aggregate-state-controller');
  assert.throws(() => requireFamilySpecPaths({ ...known, goldenRoot: 'test/reference/curated/no-such-family/v1' }),
    /does not exist in the repository/);
  assert.throws(() => requireFamilySpecPaths({ ...known, fixtureDir: 'test/fixtures/no-such-family-v1' }),
    /does not exist in the repository/);
  assert.throws(() => requireFamilySpecPaths({ ...known, toolsRef: 'tools/gen-no-such-reference.mjs' }),
    /does not exist in the repository/);
  requireFamilySpecPaths(known); // in-repo spec trees pass
});

test('a family whose renderAll returns a non-relative path is rejected before any byte is written', () => {
  const family = { ...getFamily('aggregate-state-controller') };
  family.renderAll = () => ({ '/absolute/path.scala': 'x' });
  const input = parseStrictJson(fs.readFileSync(path.join(ROOT, 'test/fixtures/aggregate-state-controller-v1/input.json'), 'utf8'));
  assert.throws(() => renderFamily(family, input), /must be a clean relative path/);
});

test('phase-1 acceptance: emitter parity against goldens (and tools references where they exist) is all green', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'emitter/parity.mjs')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(run.status, 0, 'parity harness exit code (stderr: ' + (run.stderr || '').slice(0, 400) + ')');
  const report = JSON.parse(run.stdout);
  assert.equal(report.allGreen, true);
  assert.equal(report.familiesChecked, FAMILY_COUNT);
  for (const family of report.families) {
    assert.equal(family.goldenParity, true, family.family + ' golden parity');
    assert.equal(family.deterministic, true, family.family + ' double-run determinism');
    if (family.battery.kind === 'embedded') assert.equal(family.battery.clean, true, family.family + ' battery clean');
    if (HANDWRITTEN_GOLDEN_FAMILIES.includes(family.family)) {
      assert.equal(family.provenance, 'handwritten-golden', family.family + ' provenance');
      assert.equal(family.toolsParity, null, family.family + ' tools parity is structurally inapplicable');
      assert.equal(family.toolsDeterministic, null, family.family + ' tools determinism is structurally inapplicable');
    } else if (CLASSIC_REPRODUCTION_FAMILIES.includes(family.family)) {
      assert.equal(family.provenance, 'classic-reproduction', family.family + ' provenance');
      assert.equal(family.toolsParity, null, family.family + ' tools parity is structurally inapplicable');
      assert.equal(family.toolsDeterministic, null, family.family + ' tools determinism is structurally inapplicable');
    } else {
      assert.equal(family.provenance, 'ported-tools-reference', family.family + ' provenance');
      assert.equal(family.toolsParity, true, family.family + ' tools parity');
      assert.equal(family.toolsDeterministic, true, family.family + ' tools determinism');
    }
  }
  // The battery debt is exactly the four known pre-battery curated modules —
  // never silently larger.
  const debt = report.families.filter(f => f.battery.kind === 'none').map(f => f.family).sort();
  assert.deepEqual(debt, BATTERY_DEBT_FAMILIES);
});
