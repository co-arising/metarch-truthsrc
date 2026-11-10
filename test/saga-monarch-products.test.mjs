import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { compileWorkflows, deriveWorkflows } from '../lib/products/workflows.mjs';
import { sagaMonarchAuthorFixture } from './fixtures/saga-monarch-author.mjs';

const tree = fileURLToPath(new URL('../scaffold/saga-monarch-project/truth/saga-monarch/', import.meta.url));
function fixture() {
  const { project, documents } = sagaMonarchAuthorFixture();
  return { canonical: structuredClone(compileTreeWithSources(tree, { context: project.context }).canonical), project, documents };
}
function compile(input) {
  return compileProductSet(deriveProjectRequest(input.canonical, input.project, input.documents));
}
function success(input) {
  const result = compile(input);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.result);
  return Object.fromEntries(result.result.products.map(p => [p.id, p.payload]));
}
function rejects(input, code) {
  const result = compile(input);
  assert.equal(result.result, null);
  assert.ok(result.diagnostics.some(d => d.code === code), JSON.stringify(result.diagnostics));
}
const composition = input => input.documents.find(d => d.id === 'composition').value;
const disposition = (kind, target = null) => ({ kind, target, compatibilityKey: target ? 'results' : null, delayMillis: kind === 'retry' ? 250 : 0 });
const byResult = () => ({ kind: 'by-result', cases: [
  { result: 'succeeded', disposition: disposition('route', 'publish-result') },
  { result: 'rejected-before-effects', disposition: disposition('hold') },
  { result: 'compensated', disposition: disposition('hold') },
] });

test('unique scaffold derives all eight versioned products with whole-request completion', () => {
  const input = fixture(), before = structuredClone(input), products = success(input);
  assert.deepEqual(Object.keys(products).sort(), ['reference-layout', 'exact-value-types', 'exact-value-codecs',
    'saga-contract', 'saga-runtime-contract', 'execution-contract', 'workflow-contract', 'saga-host-contract'].sort());
  const host = products['saga-host-contract'];
  assert.deepEqual(host.workflow.technical, composition(input).workflow);
  assert.equal(Object.hasOwn(input.canonical.workflows[0], 'technical'), false);
  assert.equal(Object.hasOwn(products['workflow-contract'].workflows[0], 'technical'), false);
  assert.deepEqual(host.sources[1], { document: 'composition', pointer: '' });
  for (const completion of host.saga.completions)
    assert.deepEqual(completion.inputs.find(i => i.slot === 'originalRequest').source, { kind: 'args-record' });
  assert.deepEqual(input, before);
});

for (const [name, mutate, code] of [
  ['internal step', t => { t.workflow.stepId = 'other'; }, 'SAGA_MONARCH_WORKFLOW_ABI'],
  ['internal codec', t => { t.workflow.codecVersion = 'other'; }, 'SAGA_MONARCH_WORKFLOW_ABI'],
  ['unknown proof', t => { t.workflow.proofFormat = 'guessed'; }, 'SAGA_MONARCH_PROOF'],
  ['unused carry', t => { t.workflow.carry = { reservationSuffix: '/claim', ownerSuffix: '/owner' }; }, 'SAGA_MONARCH_IDENTITY'],
  ['unknown technical key', t => { t.workflow.deadline = 100; }, 'PRODUCT_FIELD_UNKNOWN'],
]) test('host rejects invalid ' + name + ' without hidden defaults', () => {
  const input = fixture(); mutate(composition(input)); rejects(input, code);
});

test('derived transaction identity must fit the declared nominal bounds', () => {
  const input = fixture();
  const binding = input.documents.find(d => d.id === 'saga-binding').value;
  binding.sagas[0].types.find(t => t.id === 'TransactionId').maxLength = 32;
  input.documents.find(d => d.id === 'execution-binding').value.sagaBindings = structuredClone(binding);
  rejects(input, 'SAGA_MONARCH_IDENTITY');
});

test('by-result preserves all three terminal policies and unknown remains held', () => {
  const input = fixture(); input.canonical.workflows[0].areas[0].completion.terminal = byResult();
  const products = success(input), completion = products['workflow-contract'].workflows[0].areas[0].completion;
  assert.deepEqual(completion.terminal, byResult());
  assert.equal(completion.unknown, 'hold');
});

for (const [name, mutate, code] of [
  ['duplicate result', t => { t.cases[2].result = 'succeeded'; }, 'WORKFLOW_COMPLETION'],
  ['missing result', t => { t.cases.pop(); }, 'WORKFLOW_COMPLETION'],
  ['nonterminal policy', t => { t.cases[2].result = 'outcome-unknown'; }, 'WORKFLOW_COMPLETION'],
  ['successful retry', t => { t.cases[0].disposition = disposition('retry'); }, 'WORKFLOW_RETRY'],
  ['terminal Saga retry', t => { t.cases[1].disposition = disposition('retry'); }, 'WORKFLOW_RETRY'],
]) test('workflow rejects ' + name, () => {
  const input = fixture(), terminal = byResult(); mutate(terminal);
  input.canonical.workflows[0].areas[0].completion.terminal = terminal; rejects(input, code);
});

test('whole-group Carry rejects 2-to-1 and divergent per-result destinations', () => {
  const input = fixture(), workflow = input.canonical.workflows[0];
  workflow.areas[0].completion.resource = 'carry';
  rejects(input, 'WORKFLOW_CARRY');
  workflow.areas[1].batch = { kind: 'count-or-wait', maxItems: 2, minItems: 1, maxWaitMillis: 100, allowPartialOnClose: true };
  composition(input).workflow.proofFormat = 'owner-certificates-v1';
  composition(input).workflow.carry = { reservationSuffix: '/occupancy', ownerSuffix: '/owner' };
  success(input);
  workflow.areas[0].completion.terminal = byResult();
  rejects(input, 'WORKFLOW_CARRY');
});

test('whole-group Carry rejects a partial source that cannot meet downstream hard minimum', () => {
  const input = fixture(), workflow = input.canonical.workflows[0];
  workflow.areas[0].completion.resource = 'carry';
  workflow.areas[1].batch = { kind: 'by-compatibility-key', maxItems: 2, minItems: 2, maxWaitMillis: 100, allowPartialOnClose: false };
  rejects(input, 'WORKFLOW_CARRY');
});

test('fixed R2 active-item bound is enforced at public product compilation', () => {
  const input = fixture(); input.canonical.workflows[0].settings.maxAcceptedItems = 101;
  input.canonical.workflows[0].settings.maxActiveItems = 101;
  rejects(input, 'WORKFLOW_BOUND');
});

test('finite workflow checker requires explicit original-item/new-operation retry identity', () => {
  const input = fixture(), products = success(input), canonical = { id: 'inventory-domain', value: input.canonical };
  const area = input.canonical.workflows[0].areas[0];
  const outcomes = [{ code: 'Done', kind: 'success', action: 'continue' },
    { code: 'Rejected', kind: 'business-rejection', action: 'stop' },
    { code: 'Failed', kind: 'infrastructure-failure', action: 'manual-recovery' },
    { code: 'Uncertain', kind: 'unknown-effect', action: 'manual-recovery' }];
  area.action = { kind: 'run', ref: { id: 'repeatable-reservation', version: 'v1' },
    inputs: [{ slot: 'request', source: 'request' }, { slot: 'transactionId', source: 'transaction-id' }],
    result: { slot: 'result', onStopped: 'original-item', outcomes: [
      { code: 'Done', result: 'succeeded' }, { code: 'Rejected', result: 'rejected-before-effects' },
      { code: 'Failed', result: 'recovery-required' }, { code: 'Uncertain', result: 'outcome-unknown' },
    ] },
    retry: { semantics: 'reexecute-after-rejected-before-effects', identity: 'original-item-new-batch-operation',
      onExhausted: { kind: 'fail', reason: 'finite item retry budget exhausted' } } };
  area.completion.terminal = byResult(); area.completion.terminal.cases[1].disposition = disposition('retry');
  // Unit-level dependency contract only; this is not a full Run compilation or runtime receipt.
  const execution = { pipelines: [{ id: 'repeatable-reservation', steps: [{ id: 'execute', port: 'Check', outcomes }],
    inputs: [{ id: 'request', type: 'ReservationRequest' }, { id: 'transactionId', type: 'TransactionId' }],
    outputs: [{ id: 'result', type: 'ReservationResult' }],
    binding: { run: { definitionVersion: 'v1', mode: 'managed', codecVersion: 'managed-codec-v1' } } }] };
  const check = () => compileWorkflows({ id: 'workflows', value: { schemaVersion: 'truthsrc.workflow-binding/v1',
    workflows: deriveWorkflows(canonical) } }, canonical, products['reference-layout'], products['saga-contract'], execution);
  assert.equal(check().workflows[0].areas[0].completion.terminal.cases[1].disposition.delayMillis, 250);
  area.action.retry.identity = 'same-terminal-saga';
  assert.throws(check, error => error.diagnostic?.code === 'WORKFLOW_RETRY');
});
