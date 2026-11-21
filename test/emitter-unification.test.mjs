// Emitter-unification tests (emitter-unification plan §4 Phase 1).
// The acceptance itself is `node emitter/parity.mjs`: for all eight curated
// families, the same fixture input must render byte-identically in the emitter
// module and in the tools/gen-*.mjs reference, must match the curated golden
// tree byte for byte, must double-run deterministically, and must pass its
// embedded negatives battery where one exists. Families without a battery are
// a registered debt and are asserted here to be exactly the four known ones —
// a fifth silent battery omission must turn this suite red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../emitter/families/index.mjs';
import { registerFamily, getFamily, listFamilyIds, renderFamily } from '../emitter/registry.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FAMILY_COUNT = 8;
const BATTERY_DEBT_FAMILIES = [
  'aggregate-rules-formal',
  'external-connector-port',
  'connector-implementation',
  'projection-apply-event',
].sort();

test('the unified emitter registers exactly the eight curated families', () => {
  assert.equal(listFamilyIds().length, FAMILY_COUNT);
  for (const id of ['aggregate-rules-formal', 'external-connector-port', 'connector-implementation',
    'projection-apply-event', 'aggregate-state-controller', 'strict-saga-module',
    'strict-fixture-host', 'composition-invocation-host']) {
    const family = getFamily(id);
    assert.equal(typeof family.checkInput, 'function', id + ' checkInput');
    assert.equal(typeof family.renderAll, 'function', id + ' renderAll');
  }
});

test('the registry is fail-closed on duplicate registration and unknown ids', () => {
  const known = getFamily('aggregate-state-controller');
  assert.throws(() => registerFamily({ ...known }), /already registered/);
  assert.throws(() => getFamily('no-such-family'), /unknown family .*registered families:/);
  assert.throws(() => registerFamily({ id: 'incomplete', familyNumber: 1 }), /missing contract member/);
});

test('a family whose renderAll returns a non-relative path is rejected before any byte is written', () => {
  const family = { ...getFamily('aggregate-state-controller') };
  family.renderAll = () => ({ '/absolute/path.scala': 'x' });
  const input = parseStrictJson(fs.readFileSync(path.join(ROOT, 'test/fixtures/aggregate-state-controller-v1/input.json'), 'utf8'));
  assert.throws(() => renderFamily(family, input), /must be a clean relative path/);
});

test('phase-1 acceptance: emitter parity against tools/gen-*.mjs and curated goldens is all green', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'emitter/parity.mjs')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(run.status, 0, 'parity harness exit code (stderr: ' + (run.stderr || '').slice(0, 400) + ')');
  const report = JSON.parse(run.stdout);
  assert.equal(report.allGreen, true);
  assert.equal(report.familiesChecked, FAMILY_COUNT);
  for (const family of report.families) {
    assert.equal(family.toolsParity, true, family.family + ' tools parity');
    assert.equal(family.goldenParity, true, family.family + ' golden parity');
    assert.equal(family.deterministic, true, family.family + ' double-run determinism');
    if (family.battery.kind === 'embedded') assert.equal(family.battery.clean, true, family.family + ' battery clean');
  }
  // The battery debt is exactly the four known pre-battery curated modules —
  // never silently larger.
  const debt = report.families.filter(f => f.battery.kind === 'none').map(f => f.family).sort();
  assert.deepEqual(debt, BATTERY_DEBT_FAMILIES);
});
