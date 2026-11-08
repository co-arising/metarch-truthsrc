import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProject } from '../lib/project/cli.mjs';
import { queryProject, statusProject } from '../lib/project/query.mjs';
import { projectRoot } from './module-seams-fixture.mjs';

function fixture(t, legacy = false, prior = 'missing') {
  const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'module-seams-query-review-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const author = join(root, 'author');
  fs.cpSync(legacy ? fileURLToPath(new URL('../scaffold/unified-project/', import.meta.url)) : projectRoot, author, { recursive: true });
  const f = { project: join(author, 'truthsrc.project.json'), out: join(root, 'generated'), author };
  if (prior === 'invalid') {
    fs.mkdirSync(f.out); fs.writeFileSync(join(f.out, 'truthsrc.ledger.json'), '{"entries":null}\n');
  }
  const captured = captureProject(f.project);
  assert.deepEqual(captured.validation.hard, []); assert.equal(captured.validation.roundtrip.ok, true);
  return f;
}
function duringPrior(t, f, source, action) {
  const exists = fs.existsSync, before = fs.readFileSync(source), after = Buffer.concat([before, Buffer.from('\n# saved during current lookup\n')]);
  let saves = 0;
  const mocked = t.mock.method(fs, 'existsSync', function(path) {
    if (String(path) === join(f.out, 'truthsrc.ledger.json') && saves++ === 0) fs.writeFileSync(source, after);
    return exists(path);
  });
  syncBuiltinESMExports();
  let result;
  try { result = action(); }
  finally { mocked.mock.restore(); syncBuiltinESMExports(); }
  assert.ok(saves >= 1, 'save must occur after current capture at prior ledger check');
  assert.deepEqual(fs.readFileSync(source), after, 'real author bytes changed; no fabricated capture');
  const checked = captureProject(f.project);
  assert.deepEqual(checked.validation.hard, []); assert.equal(checked.validation.roundtrip.ok, true);
  return result;
}
for (const prior of ['missing', 'invalid']) {
  test('S1 query closes current capture before ' + prior + ' prior early return', t => {
    const f = fixture(t, false, prior), source = join(f.author, 'truth/module-seams/contexts/parcel/value-objects/route.vo.yaml');
    const result = duringPrior(t, f, source, () => queryProject({ ...f, knowledge: 'Route' }));
    assert.equal(result.status.evidence.state, prior);
    assert.equal(result.status.inputs.state, 'invalid'); assert.ok(result.status.inputs.error);
    assert.deepEqual(result.currentSelection, []); assert.deepEqual(result.result, []);
    assert.equal(result.state, 'source-evidence-unavailable');
  });
  test('S1 status positive control closes capture with ' + prior + ' prior', t => {
    const f = fixture(t, false, prior), source = join(f.author, 'truth/module-seams/contexts/parcel/value-objects/route.vo.yaml');
    const result = duringPrior(t, f, source, () => statusProject(f));
    assert.equal(result.evidence.state, prior); assert.equal(result.inputs.state, 'invalid'); assert.ok(result.inputs.error);
  });
  test('S1 unchanged current author remains queryable without ' + prior + ' generation evidence', t => {
    const f = fixture(t, false, prior), result = queryProject({ ...f, knowledge: 'Route' });
    assert.equal(result.status.evidence.state, prior); assert.equal(result.status.inputs.state, 'unknown');
    assert.equal(result.status.inputs.error, null); assert.ok(result.currentSelection.length);
    assert.ok(result.currentSelection.every(r => r.interpretation === 'current-author-not-generation-evidence'));
    assert.deepEqual(result.result, []);
    const hand = queryProject({ ...f, implementation: 'repository' });
    assert.equal(hand.status.inputs.state, 'unknown'); assert.equal(hand.result.length, 1); assert.equal(hand.precision, 'file');
  });
}
test('S1 legacy author without generation keeps existing unknown/current-selection semantics', t => {
  const f = fixture(t, true), result = queryProject({ ...f, knowledge: 'SetCount' });
  assert.equal(result.status.evidence.state, 'missing'); assert.equal(result.status.inputs.state, 'unknown');
  assert.equal(result.status.inputs.error, null); assert.ok(result.currentSelection.length); assert.deepEqual(result.result, []);
});
