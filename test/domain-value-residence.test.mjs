import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { compileTree } from '../lib/compile.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';

function source() {
  return { schemaVersion: 'truthsrc/v1', workshop: 'counted-parcels',
    sessions: [{ session: 'refining', scopes: [] }],
    aggregates: [{ name: 'Parcel', context: 'logistics', entity: 'ParcelEntity', identifier: { name: 'id', dataType: 'String' },
      valueExpressionProfile: 'truthsrc.domain-values/v2',
      stateFields: [{ name: 'id', dataType: 'String', default: '' }, { name: 'count', dataType: 'Long', default: '0' }],
      commands: [{ name: 'Receive', parameters: [{ name: 'receipt', dataType: 'ParcelReceipt' }], produces: ['Received'] }],
      events: [{ name: 'Received', payloads: [{ name: 'receipt', dataType: 'ParcelReceipt' }],
        bindings: [{ slot: 'receipt', expr: 'param.receipt' }],
        foldAssignments: [{ slot: 'id', expr: 'event.receipt.id' }, { slot: 'count', op: 'integer-apply', delta: 'literal:1', sign: 1 }] }] }],
    valueObjects: [{ name: 'ParcelReceipt', context: 'logistics', fields: [{ name: 'id', dataType: 'String' }] }], readModels: [], stories: [], domainServices: [] };
}
function tree(value) {
  const root = mkdtempSync(join(tmpdir(), 'domain-value-residence-'));
  decomposeCanonical(JSON.stringify(value), root);
  return root;
}
test('explicit domain-values v2 preserves member paths and integer folds without claiming full typed admission', () => {
  const root = tree(source()), result = validateTree(root);
  assert.deepEqual(result.hard, []);
  assert.ok(result.notices.some(n => n.startsWith('[V13V]')));
  const before = compileTree(root);
  assert.equal(roundtrip(root).ok, true);
  assert.equal(compileTree(root), before);
});
test('old unmarked source grammar and unknown explicit versions remain fail closed', () => {
  const old = source(); delete old.aggregates[0].valueExpressionProfile;
  const errors = validateTree(tree(old)).hard;
  assert.ok(errors.some(e => e.includes('unknown expression form')));
  assert.ok(errors.some(e => e.includes('unknown op')));
  const unknown = source(); unknown.aggregates[0].valueExpressionProfile = 'truthsrc.domain-values/v99';
  assert.ok(validateTree(tree(unknown)).hard.some(e => e.startsWith('[V13V]')));
});
test('explicit value residence rejects missing roots, expression calls, bad fold rows and noninteger targets', () => {
  for (const change of [
    a => { a.events[0].foldAssignments[0].expr = 'event.absent.id'; },
    a => { a.events[0].foldAssignments[0].expr = 'event.receipt.id()'; },
    a => { a.events[0].foldAssignments[0].expr = 'event.receipt..id'; },
    a => { a.events[0].bindings[0].expr = 'event.receipt.id'; },
    a => { a.events[0].foldAssignments[1].sign = 0; },
    a => { a.events[0].foldAssignments[1].extra = 'unhandled'; },
    a => { a.events[0].foldAssignments[1].slot = 'absent'; },
    a => { a.events[0].foldAssignments[1].slot = 'id'; },
    a => { delete a.events[0].foldAssignments[1].delta; },
    a => { a.events[0].foldAssignments[1].delta = { form: 'host', id: {}, version: '1' }; },
  ]) {
    const value = source(); change(value.aggregates[0]);
    assert.ok(validateTree(tree(value)).hard.length, JSON.stringify(value));
  }
});
