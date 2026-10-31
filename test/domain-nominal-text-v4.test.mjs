import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpression, infer } from '../lib/domain-products/expressions.mjs';
import { evaluateDecisions } from '../lib/domain-products/decision.mjs';
import { profileFor } from '../lib/products/registry.mjs';

const ref = (kind, id, owner = []) => ({ context: 'tickets', kind, owner, id });
const command = ref('command', 'Reserve', ['Booking']);
const nominal = ref('type', 'TicketId');
const parameter = ref('parameter', 'ticket', ['Booking', 'Reserve']);
const layout = { contexts: ['tickets'], declarations: [
  { ref: nominal, valueType: { form: 'primitive', name: 'string' } },
  { ref: parameter, valueType: { form: 'nominal', ref: nominal } },
] };

test('v4 alone admits explicit nominal text extraction without erasing the identity type', () => {
  const predicate = parseExpression('param.ticket.value.nonEmpty', command, layout, { types: [] }, '4');
  assert.equal(predicate.op, 'non-empty');
  assert.equal(predicate.argument.op, 'text-value');
  assert.deepEqual(infer(predicate.argument, command, layout, { types: [] }, '4'), { form: 'primitive', name: 'string' });
  assert.deepEqual(infer(predicate.argument.argument, command, layout, { types: [] }, '4'), { form: 'nominal', ref: nominal });
  for (const version of ['1', '2', '3']) assert.throws(() => parseExpression('param.ticket.value.nonEmpty', command, layout, { types: [] }, version));
  assert.throws(() => parseExpression('param.ticket.nonEmpty', command, layout, { types: [] }, '4'));
  const ordered = { command, decisions: [{ predicate, onFalse: { kind: 'reject', errCode: 'EMPTY_ID' } }] };
  assert.equal(evaluateDecisions(ordered, new Map([[parameter, 'T-1']]), layout, { types: [] }, '4').kind, 'continue');
  assert.equal(evaluateDecisions(ordered, new Map([[parameter, '']]), layout, { types: [] }, '4').errCode, 'EMPTY_ID');
});

test('explicit text extraction refuses numeric, record, foreign and unresolved nominal definitions', () => {
  for (const type of [{ form: 'primitive', name: 'integer' }, { form: 'primitive', name: 'decimal' }, { form: 'record', members: [] }]) {
    const changed = structuredClone(layout); changed.declarations[0].valueType = type;
    assert.throws(() => parseExpression('param.ticket.value.nonEmpty', command, changed, { types: [] }, '4'));
  }
  for (const change of [x => x.declarations.shift(), x => { x.declarations[0].ref.context = 'other'; }]) {
    const changed = structuredClone(layout); change(changed);
    assert.throws(() => parseExpression('param.ticket.value.nonEmpty', command, changed, { types: [] }, '4'));
  }
});

test('new dependency and fold versions pin the new decision version while old profiles remain exact', () => {
  assert.equal(profileFor('domain-decision', '4').roles.semanticBinding, 'truthsrc.domain-semantic-binding/v4');
  assert.ok(profileFor('domain-dependencies', '6').requires.some(r => r.id === 'domain-decision' && r.version === '4'));
  assert.ok(profileFor('domain-folds', '6').requires.some(r => r.id === 'domain-dependencies' && r.version === '6'));
  assert.ok(profileFor('domain-dependencies', '5').requires.some(r => r.id === 'domain-decision' && r.version === '3'));
  assert.equal(profileFor('domain-decision', '3').roles.semanticBinding, 'truthsrc.domain-semantic-binding/v3');
});
