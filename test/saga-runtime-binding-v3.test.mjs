import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { compileTree } from '../lib/compile.mjs';
import { parseDoc } from '../lib/shared.mjs';
import { compileSagas } from '../lib/saga/compile.mjs';
import { lowerSagaRuntimeBinding, lowerSagaRuntimeBindingV2, lowerSagaRuntimeBindingV3 } from '../lib/saga/runtime-binding.mjs';

const PHASES = ['prepare', 'commit', 'compensate'];
const EXAMPLE = new URL('../example/saga-money-transfer-serial/', import.meta.url);
const ORIGINAL = new URL('../example/saga-money-transfer/', import.meta.url);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const bytesHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => structuredClone(value);
const json = url => JSON.parse(readFileSync(url, 'utf8'));
const exampleCanonical = JSON.parse(compileTree(fileURLToPath(new URL('tree/', EXAMPLE))));
const exampleBinding = json(new URL('bindings.json', EXAMPLE));
const exampleMapping = json(new URL('runtime-binding.json', EXAMPLE));
function real() {
  return { canonical: clone(exampleCanonical), binding: clone(exampleBinding), runtimeBinding: clone(exampleMapping) };
}
function success(input) {
  const compiled = compileSagas(input.canonical, input.binding);
  assert.deepEqual(compiled.diagnostics, []);
  assert.ok(compiled.ir);
  const result = lowerSagaRuntimeBindingV3({ ...input, ir: compiled.ir });
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir);
  assert.deepEqual(result.ir, result.plan);
  assert.notEqual(result.ir, result.plan);
  return result;
}
function failure(input, code) {
  const result = lowerSagaRuntimeBindingV3(input);
  assert.equal(result.ir, null);
  assert.equal(result.plan, null);
  assert.ok(result.diagnostics.length);
  if (code) assert.ok(result.diagnostics.some(row => row.code === code), JSON.stringify(result.diagnostics));
  return result;
}
// Independent synthetic engineering product: repeated generic token phases on
// one resource, NOT fictitious cross-account edges in the actual money transfer.
function synthetic(count = 2, receipts = true) {
  const field = (name, dataType) => ({ name, dataType, origin: 'BUSINESS_INPUT' });
  const args = [{ slot: 'resource', type: 'AccountId' }, { slot: 'token', type: 'ReservationId' }];
  const ref = name => ({ aggregate: 'SyntheticResource', name });
  const commands = PHASES.map(phase => ({ name: `${phase}-token`,
    parameters: [field('txid', 'TxId'), field('resource', 'AccountId'), field('token', 'ReservationId')],
    produces: [`${phase}-confirmed`] }));
  const events = PHASES.map(phase => ({ name: `${phase}-confirmed`, payloads: [field('token', 'ReservationId')] }));
  const sourceFields = [field('operationId', 'OperationId'), ...args.map(arg => field(arg.slot, arg.type))];
  commands.push({ name: 'StartSynthetic', parameters: sourceFields, produces: ['SyntheticRequested'] });
  events.push({ name: 'SyntheticRequested', payloads: sourceFields });
  const resultKinds = clone(exampleCanonical.sagas[0].payload.resultKinds);
  events.push(...resultKinds.map(kind => ({ name: `result-${kind}`, payloads: [field('txid', 'TxId')] })));
  const groups = Array.from({ length: count }, (_, i) => ({ id: i + 1, dependsOn: i === 0 ? [] : [i] }));
  const steps = groups.map((group, i) => ({ id: `step-${i}`, participant: 'resource', group: group.id,
    phases: Object.fromEntries(PHASES.map(phase => [phase, { kind: 'command', commandRef: ref(`${phase}-token`),
      bindings: [{ slot: 'txid', ref: 'txid', type: 'TxId' }, { slot: 'resource', ref: 'args:resource', type: 'AccountId' },
        { slot: 'token', ref: receipts && (phase !== 'prepare' || i > 0)
          ? `step:step-${phase === 'prepare' ? i - 1 : i}:prepare:token` : 'args:token', type: 'ReservationId' }],
      outputs: [{ slot: 'token', type: 'ReservationId' }] }])) }));
  const triggers = ['command', 'event'].map(kind => ({ id: `from-${kind}`, kind,
    sourceRef: ref(kind === 'command' ? 'StartSynthetic' : 'SyntheticRequested'),
    argsMapping: args.map(arg => ({ ...arg, ref: `source:${arg.slot}` })),
    idempotency: { ref: 'source:operationId', type: 'OperationId', scope: 'saga-version', conflict: 'reject-different-args' } }));
  const payload = { schemaVersion: 'truthsrc.saga/v1', purpose: 'New independent synthetic token dataflow engineering design; no observed business execution.',
    invariants: ['Token dataflow engineering only; enforcement remains unverified.'], transactionIdType: 'TxId', args,
    participants: [{ id: 'resource', aggregate: 'SyntheticResource', resourceRef: { ref: 'args:resource', type: 'AccountId' } }],
    groups, steps, resilience: clone(exampleCanonical.sagas[0].payload.resilience), safety: clone(exampleCanonical.sagas[0].payload.safety),
    admission: { maxParticipants: 1, maxInFlight: 1, maxItemsPerChunk: 64, manifest: { mode: 'static', durable: true } },
    triggers, resultKinds, completions: resultKinds.map(kind => ({ kind, eventRef: ref(`result-${kind}`),
      bindings: [{ slot: 'txid', ref: 'txid', type: 'TxId' }] })) };
  const canonical = { schemaVersion: 'truthsrc/v1', workshop: 'Independent synthetic receipt engineering', sessions: [],
    aggregates: [{ name: 'SyntheticResource', identifier: field('id', 'AccountId'), commands, events }],
    sagas: [{ id: 'synthetic-receipts', name: 'Synthetic receipt serial barriers', seq: 0, version: 'v2', payload }] };
  const technicalPhases = Object.fromEntries(PHASES.map(phase => {
    const technical = clone(exampleBinding.sagas[0].steps[0].phases[phase]);
    technical.confirmation.eventRef = ref(`${phase}-confirmed`);
    technical.confirmation.outputs = [{ slot: 'token', ref: 'receipt:token', type: 'ReservationId' }];
    return [phase, technical];
  }));
  const binding = { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [{ sagaId: 'synthetic-receipts', version: 'v2',
    module: 'fixture.SyntheticModule', engine: clone(exampleBinding.sagas[0].engine), codec: clone(exampleBinding.sagas[0].codec),
    // Independent type surface: the synthetic fixture owns the step-receipt
    // dataflow demo (participant-minted handle), so it declares its own
    // ReservationId instead of borrowing the real example's type list.
    types: [
      { id: 'TxId', canonicalType: 'TxId', implementation: 'fixture.types.TxId', kind: 'id', minLength: 1, maxLength: 128 },
      { id: 'OperationId', canonicalType: 'OperationId', implementation: 'fixture.types.OperationId', kind: 'id', minLength: 1, maxLength: 128 },
      { id: 'AccountId', canonicalType: 'AccountId', implementation: 'fixture.types.AccountId', kind: 'id', minLength: 1, maxLength: 128 },
      { id: 'ReservationId', canonicalType: 'ReservationId', implementation: 'fixture.types.ReservationId', kind: 'id', minLength: 1, maxLength: 128 },
      { id: 'Money', canonicalType: 'Money', implementation: 'fixture.types.Money', kind: 'money', currency: 'ISO-4217', amountEncoding: 'minor-unit-string', scale: 2, precision: 38, codec: 'fixture.ExactMoneyCodec' },
    ],
    participants: [{ participantId: 'resource', addressing: { resolver: 'fixture.SyntheticResolver', aggregate: 'SyntheticResource', resourceType: 'AccountId', mode: 'exact-resource' } }],
    steps: steps.map(step => ({ stepId: step.id, phases: clone(technicalPhases) })),
    triggerMappers: triggers.map(trigger => ({ triggerId: trigger.id, argsMapper: 'fixture.SyntheticArgsMapper', idempotencyMapper: 'fixture.SyntheticIdentityMapper' })),
    completionMappers: resultKinds.map(kind => ({ kind, mapper: 'fixture.SyntheticCompletionMapper' })) }] };
  const runtimeBinding = { schemaVersion: 'truthsrc.saga-runtime-binding/v2', target: clone(exampleMapping.target),
    sagas: [{ sagaId: 'synthetic-receipts', definitionVersion: 'v2', runtimeVersion: 2,
      argsCodec: clone(exampleMapping.sagas[0].argsCodec), receiptCodecs: steps.flatMap(step => PHASES.map(phase => ({
        stepId: step.id, phase, id: `${step.id}-${phase}-codec`, version: 'receipt-v1', runtimeVersion: 1,
      }))) }] };
  return { canonical, binding, runtimeBinding };
}
function token(input, stepIndex, phase) {
  return input.canonical.sagas[0].payload.steps[stepIndex].phases[phase].bindings.find(row => row.slot === 'token');
}
function files(root, relative = '') {
  return readdirSync(new URL(relative, root), { withFileTypes: true }).flatMap(entry => {
    const name = relative + entry.name;
    return entry.isDirectory() ? files(root, name + '/') : [name];
  }).sort();
}

test('real independent v2 transfer retains both exact resources, all six phases and own reservation/commit outputs', () => {
  const input = real(), before = clone(input), { ir } = success(input), saga = ir.sagas[0];
  assert.deepEqual(input, before);
  assert.equal(ir.schemaVersion, 'truthsrc.saga-runtime-contract/v3');
  assert.equal(saga.sagaId, 'money-transfer');
  assert.equal(saga.definitionVersion, 'v2');
  assert.deepEqual(saga.runtimeIdentity, { name: 'money-transfer', version: 2 });
  assert.deepEqual(saga.schedule, { prepare: ['reserve-source', 'reserve-target'], commit: ['reserve-source', 'reserve-target'], compensate: ['reserve-target', 'reserve-source'] });
  assert.deepEqual(saga.participants.map(row => [row.participantId, row.resource.ref]), [['source', 'args:from'], ['target', 'args:to']]);
  assert.deepEqual(saga.participants.map(row => row.resource.addressing), input.binding.sagas[0].participants.map(row => row.addressing));
  assert.equal(saga.participants.flatMap(row => Object.values(row.phases)).length, 6);
  for (const row of saga.participants) {
    assert.equal(row.resource.addressing.aggregate, 'CreditBalance');
    // P4 receipt re-cut (2026-10-23, user ruling): ReservationId retired — the
    // transaction identity addresses every phase and no step-receipt reads remain.
    for (const phase of ['prepare', 'commit', 'compensate']) {
      const inputs = row.phases[phase].inputs;
      assert.equal(inputs.find(mapping => mapping.slot === 'txid').source.kind, 'transaction-id');
      assert.equal(inputs.find(mapping => mapping.slot === 'reservation'), undefined);
    }
    // Confirmation facts: (txid, amount) for prepare; (txid) for commit/compensate.
    assert.deepEqual(row.phases.prepare.outputs, [
      { slot: 'txid', type: 'TxId' },
      { slot: 'amount', type: 'Money' },
    ]);
    assert.deepEqual(row.phases.commit.outputs, [{ slot: 'txid', type: 'TxId' }]);
    assert.deepEqual(row.phases.compensate.outputs, [{ slot: 'txid', type: 'TxId' }]);
  }
  assert.ok(saga.completions.every(row => row.inputs.length === 1 && row.inputs[0].source.kind === 'transaction-id'));
  assert.deepEqual(saga.runtimeBinding, { target: input.runtimeBinding.target, saga: input.runtimeBinding.sagas[0] });
  assert.equal(saga.definitionDigest, 'sha256:' + hash({ ...saga.contract, runtimeBinding: saga.runtimeBinding }));
  // P4 receipt re-cut (2026-10-23): ReservationId retired, txid-addressed
  // phases — definition material, so the digest advances from the P1 baseline
  // 16c3bf7a….
  assert.equal(saga.definitionDigest, 'sha256:3a586c81b1a9af9a2cadfdc66306bc06ce063c1b37989985b5568c88fed9971d');
  for (const row of [ir, saga]) { assert.equal(row.readiness, 'lowered-contract-only'); assert.equal(row.runtimeBindingVerified, false); assert.equal(row.runnable, false); }
  assert.ok(saga.blocked.includes('real-phase-ports-and-participant-receipts-unverified'));
});

test('copy leaves all base domain bytes intact, modifies only new products via parse/emit and records current design', () => {
  const originalTree = new URL('tree/', ORIGINAL), newTree = new URL('tree/', EXAMPLE);
  // P4 Slice 2 (2026-10-23): the forked credit-balance aggregate also carries the
  // read-only evidence query command (get-balance.slice.yaml) that the v1
  // pre-deepening reference does not — file-list identity therefore covers
  // everything outside the forked aggregate directory, whose inventory is pinned.
  assert.deepEqual(files(newTree).filter(n => !n.startsWith('aggregates/credit-balance/')),
    files(originalTree).filter(n => !n.startsWith('aggregates/credit-balance/')));
  assert.deepEqual(files(newTree).filter(n => n.startsWith('aggregates/credit-balance/')),
    ['aggregates/credit-balance/aggregate.yaml',
     'aggregates/credit-balance/slices/cancel-incoming-credit.slice.yaml',
     'aggregates/credit-balance/slices/commit-incoming-credits.slice.yaml',
     'aggregates/credit-balance/slices/deduct-funds.slice.yaml',
     'aggregates/credit-balance/slices/get-balance.slice.yaml',
     'aggregates/credit-balance/slices/record-incoming-credits.slice.yaml',
     'aggregates/credit-balance/slices/release-reserved-funds.slice.yaml',
     'aggregates/credit-balance/slices/reserve-funds.slice.yaml',
     'aggregates/credit-balance/slices/start-transfer.slice.yaml']);
  // P4 state deepening (2026-10-23): the serial tree's credit-balance aggregate
  // is deliberately AHEAD of the v1 twin (four-field golden-master state,
  // structured fold/guard forms, receipt value origins). The v1 tree remains
  // the pre-deepening reference; byte identity now covers everything outside
  // the forked aggregate and the saga/pipeline headers.
  const forkedOrHeader = (name) => name.startsWith('aggregates/credit-balance/')
    || ['sagas/money-transfer.saga.yaml', 'pipelines/money-transfer-invoke.pipeline.yaml'].includes(name);
  for (const name of files(originalTree)) if (!forkedOrHeader(name)) {
    assert.deepEqual(readFileSync(new URL(name, originalTree)), readFileSync(new URL(name, newTree)), name);
  }
  const original = parseDoc(readFileSync(new URL('sagas/money-transfer.saga.yaml', originalTree), 'utf8'));
  const added = parseDoc(readFileSync(new URL('sagas/money-transfer.saga.yaml', newTree), 'utf8'));
  assert.equal(original.version, 'v1'); assert.equal(original.payload.admission.maxInFlight, 2);
  assert.deepEqual(original.payload.resilience, { maxAttempts: 3, phaseTimeoutMs: 1000, queryTimeoutMs: 500, backoffMs: 100, totalTimeoutMs: 10000 });
  // P4 receipt re-cut (serial only): the phases diverge beyond slot shapes —
  // the serial steps carry no step-receipt reads and txid-addressed facts.
  // Compare the stable #197 spine (phase commands in order) and pin the re-cut shape.
  assert.deepEqual(added.payload.steps.map(row => Object.values(row.phases).map(p => p.commandRef.name)),
    original.payload.steps.map(row => Object.values(row.phases).map(p => p.commandRef.name)));
  for (const step of added.payload.steps) {
    for (const [phase, ph] of Object.entries(step.phases)) {
      assert.ok(!JSON.stringify(ph).includes('reservation'), `${step.id}/${phase} must be txid-addressed`);
      assert.deepEqual(ph.outputs.map(o => o.slot),
        phase === 'prepare' ? ['txid', 'amount'] : ['txid']);
    }
  }
  assert.equal(added.seq, original.seq); assert.equal(Object.hasOwn(added, 'origin'), false);
  assert.match(added.payload.purpose, /Designed 2026-10-22 under approved #197/);
  assert.match(added.payload.purpose, /not a historical note or observed runtime payload/);
  const binding = json(new URL('bindings.json', ORIGINAL));
  binding.sagas[0].version = 'v2'; binding.sagas[0].engine.artifact = exampleMapping.target.artifact;
  // P4 receipt re-cut (serial tree only, 2026-10-23): ReservationId retired, the
  // transaction identity addresses every phase, prepare receipts carry the
  // reserved amount. Transformed here so the v1 twin remains the pre-re-cut bytes.
  binding.sagas[0].types = binding.sagas[0].types.filter(t => t.id !== 'ReservationId');
  for (const step of binding.sagas[0].steps) {
    const ph = step.phases;
    ph.prepare.confirmation.outputs = [
      { slot: 'txid', ref: 'receipt:txid', type: 'TxId' },
      { slot: 'amount', ref: 'receipt:amount', type: 'Money' }];
    ph.commit.confirmation.outputs = [{ slot: 'txid', ref: 'receipt:txid', type: 'TxId' }];
    ph.compensate.confirmation.outputs = [{ slot: 'txid', ref: 'receipt:txid', type: 'TxId' }];
  }
  assert.deepEqual(exampleBinding, binding);
  const pipeline = parseDoc(readFileSync(new URL('pipelines/money-transfer-invoke.pipeline.yaml', newTree), 'utf8'));
  assert.equal(pipeline.steps[0].execution.invokeSaga.ref.version, 'v2');
  assert.equal(pipeline.execution.recovery.planVersion, 'plan-v2');
});

test('numeric singleton barriers, not steps/groups/binding array order, determine actual prepare/commit/reverse compensation plan', () => {
  const input = synthetic(3), payload = input.canonical.sagas[0].payload;
  payload.groups = [{ id: 100, dependsOn: [10] }, { id: 2, dependsOn: [] }, { id: 10, dependsOn: [2] }];
  payload.steps.forEach((step, i) => { step.group = [2, 10, 100][i]; });
  payload.steps.reverse(); input.binding.sagas[0].steps.reverse();
  const saga = success(input).ir.sagas[0];
  assert.deepEqual(saga.schedule, { prepare: ['step-0', 'step-1', 'step-2'], commit: ['step-0', 'step-1', 'step-2'], compensate: ['step-2', 'step-1', 'step-0'] });
  assert.deepEqual(saga.participants.map(row => row.stepId), saga.schedule.prepare);
  assert.deepEqual(saga.contract.definition.payload.steps, payload.steps);
});

test('v3 supports one singleton group', () => { assert.equal(success(synthetic(1)).ir.sagas[0].participants.length, 1); });
test('v3 supports 1024 singleton groups with all 3072 exact ordered receipt pins', () => {
  const input = synthetic(1024), result = success(input).ir.sagas[0];
  assert.equal(result.participants.length, 1024);
  assert.equal(result.runtimeBinding.saga.receiptCodecs.length, 3072);
  assert.deepEqual(result.runtimeBinding.saga.receiptCodecs, input.runtimeBinding.sagas[0].receiptCodecs);
  assert.equal(result.schedule.prepare[1023], 'step-1023');
  assert.equal(result.schedule.compensate[0], 'step-1023');
});

test('independent synthetic permits confirmed ancestor Prepare, all Prepare after commit decision and ancestor Commit', () => {
  const input = synthetic(3);
  token(input, 2, 'prepare').ref = 'step:step-0:prepare:token';
  token(input, 0, 'commit').ref = 'step:step-2:prepare:token';
  token(input, 2, 'commit').ref = 'step:step-0:commit:token';
  const saga = success(input).ir.sagas[0];
  for (const [i, phase, stepId, producerPhase] of [[2, 'prepare', 'step-0', 'prepare'], [0, 'commit', 'step-2', 'prepare'], [2, 'commit', 'step-0', 'commit']]) {
    assert.deepEqual(saga.participants[i].phases[phase].inputs.find(row => row.slot === 'token').source,
      { kind: 'receipt-field', stepId, phase: producerPhase, slot: 'token' });
  }
});

for (const [name, mutate] of [
  ['Prepare self', input => { token(input, 0, 'prepare').ref = 'step:step-0:prepare:token'; }],
  ['Prepare forward', input => { token(input, 0, 'prepare').ref = 'step:step-1:prepare:token'; }],
  ['Prepare ancestor Commit', input => { token(input, 1, 'prepare').ref = 'step:step-0:commit:token'; }],
  ['Commit self Commit', input => { token(input, 0, 'commit').ref = 'step:step-0:commit:token'; }],
  ['Commit forward Commit', input => { token(input, 0, 'commit').ref = 'step:step-1:commit:token'; }],
  ['Commit Compensate', input => { token(input, 1, 'commit').ref = 'step:step-0:compensate:token'; }],
  ['Compensate cross-step Prepare', input => { token(input, 1, 'compensate').ref = 'step:step-0:prepare:token'; }],
  ['Compensate own Commit', input => { token(input, 0, 'compensate').ref = 'step:step-0:commit:token'; }],
  ['unknown producer', input => { token(input, 1, 'prepare').ref = 'step:missing:prepare:token'; }],
  ['unknown slot', input => { token(input, 1, 'prepare').ref = 'step:step-0:prepare:missing'; }],
  ['receipt type mismatch', input => { token(input, 1, 'prepare').type = 'TxId'; }],
]) test('synthetic full compiler closure rejects ' + name, () => { const input = synthetic(); mutate(input); failure(input); });

test('compiler-valid completion Commit receipt refs are explicitly still v3 blocked', () => {
  const input = synthetic();
  input.canonical.aggregates[0].events.find(row => row.name === 'result-succeeded').payloads.push({ name: 'token', dataType: 'ReservationId', origin: 'PROPAGATED' });
  input.canonical.sagas[0].payload.completions.find(row => row.kind === 'succeeded').bindings.push({ slot: 'token', ref: 'step:step-1:commit:token', type: 'ReservationId' });
  assert.deepEqual(compileSagas(input.canonical, input.binding).diagnostics, []);
  failure(input, 'RUNTIME_DATAFLOW_UNSUPPORTED');
});

test('digest hashes exact target/mapping once, preserves all receipt and capability array orders without sorting/permutation fallback', () => {
  const inputs = [real(), real(), real(), real()];
  inputs[1].runtimeBinding.sagas[0].receiptCodecs.reverse();
  inputs[2].runtimeBinding.sagas[0].receiptCodecs.push(inputs[2].runtimeBinding.sagas[0].receiptCodecs.shift());
  inputs[3].runtimeBinding.target.capabilities.reverse();
  const results = inputs.map(input => success(input).ir.sagas[0]);
  assert.equal(new Set(results.map(row => row.definitionDigest)).size, 4);
  results.forEach((row, i) => {
    assert.deepEqual(row.runtimeBinding, { target: inputs[i].runtimeBinding.target, saga: inputs[i].runtimeBinding.sagas[0] });
    assert.equal(row.definitionDigest, 'sha256:' + hash({ ...row.contract, runtimeBinding: row.runtimeBinding }));
    assert.deepEqual(row.participants, results[0].participants);
  });
});

test('every independent runtime/codec pin changes exact digest and projections without coercion', () => {
  const input = real(), original = success(input).ir.sagas[0], pin = input.runtimeBinding.sagas[0];
  pin.runtimeVersion = 2147483647; pin.argsCodec.runtimeVersion = 19;
  pin.receiptCodecs.forEach((row, i) => { row.id = `independent-${i}-receipt`; row.runtimeVersion = i + 23; });
  const changed = success(input).ir.sagas[0];
  assert.notEqual(changed.definitionDigest, original.definitionDigest);
  assert.deepEqual(changed.runtimeBinding.saga, pin);
  assert.equal(changed.runtimeIdentity.version, 2147483647);
  assert.equal(changed.args.runtimeCodec.version, 19);
  assert.deepEqual(changed.participants.flatMap(row => PHASES.map(phase => row.phases[phase].runtimeCodec.version)), [23, 24, 25, 26, 27, 28]);
});

test('v3 outputs are detached JSON, including ir/plan and duplicated projection fields', () => {
  const input = real(), { ir, plan } = success(input), snapshot = clone(ir), planSnapshot = clone(plan);
  input.runtimeBinding.target.capabilities.reverse(); input.binding.sagas[0].codec.mapper = 'changed';
  input.canonical.sagas[0].payload.steps.reverse();
  assert.deepEqual(ir, snapshot);
  ir.sagas[0].runtimeBinding.saga.receiptCodecs[0].id = 'changed';
  ir.sagas[0].runtimeBinding.target.capabilities.reverse();
  ir.sagas[0].contract.definition.payload.steps[0].phases.commit.bindings[0].slot = 'changed';
  ir.sagas[0].contract.binding.codec.mapper = 'changed';
  assert.deepEqual(plan, planSnapshot); assert.deepEqual(ir.target, snapshot.target);
  assert.deepEqual(ir.sagas[0].participants, snapshot.sagas[0].participants);
  assert.deepEqual(ir.sagas[0].args, snapshot.sagas[0].args);
});

for (const [name, mutate, code] of [
  ['old mapping version', input => { input.runtimeBinding.schemaVersion = 'truthsrc.saga-runtime-binding/v1'; }, 'RUNTIME_SCHEMA'],
  ['unknown context', input => { input.extra = true; }, 'RUNTIME_UNKNOWN'],
  ['missing explicit canonical', input => { delete input.canonical; }, 'RUNTIME_SCHEMA'],
  ['unknown target field', input => { input.runtimeBinding.target.extra = true; }, 'RUNTIME_UNKNOWN'],
  ['released artifact spoof', input => { input.runtimeBinding.target.artifact = 'net.imadz:saga-core:0.2'; }, 'RUNTIME_TARGET'],
  ['missing new capability', input => { input.runtimeBinding.target.capabilities.pop(); }, 'RUNTIME_CAPABILITY_MISSING'],
  ['duplicate capability', input => { input.runtimeBinding.target.capabilities.push(input.runtimeBinding.target.capabilities[0]); }, 'RUNTIME_DUPLICATE'],
  ['unknown capability', input => { input.runtimeBinding.target.capabilities.push('certified-runtime'); }, 'RUNTIME_CAPABILITY_UNSUPPORTED'],
  ['unknown mapping field', input => { input.runtimeBinding.sagas[0].extra = true; }, 'RUNTIME_UNKNOWN'],
  ['no mappings', input => { input.runtimeBinding.sagas = []; }, 'RUNTIME_MAPPING_MISSING'],
  ['duplicate Saga mapping', input => { input.runtimeBinding.sagas.push(clone(input.runtimeBinding.sagas[0])); }, 'RUNTIME_DUPLICATE'],
  ['orphan Saga mapping', input => { input.runtimeBinding.sagas[0].sagaId = 'Missing'; }, 'RUNTIME_MAPPING_ORPHAN'],
  ['business version drift', input => { input.runtimeBinding.sagas[0].definitionVersion = 'v1'; }, 'RUNTIME_VERSION_MISMATCH'],
  ['runtime string', input => { input.runtimeBinding.sagas[0].runtimeVersion = '2'; }, 'RUNTIME_VERSION'],
  ['runtime zero', input => { input.runtimeBinding.sagas[0].runtimeVersion = 0; }, 'RUNTIME_VERSION'],
  ['runtime negative', input => { input.runtimeBinding.sagas[0].runtimeVersion = -1; }, 'RUNTIME_VERSION'],
  ['runtime fraction', input => { input.runtimeBinding.sagas[0].runtimeVersion = 2.5; }, 'RUNTIME_VERSION'],
  ['runtime overflow', input => { input.runtimeBinding.sagas[0].runtimeVersion = 2147483648; }, 'RUNTIME_VERSION'],
  ['args ID mismatch', input => { input.runtimeBinding.sagas[0].argsCodec.id = 'Other'; }, 'RUNTIME_CODEC_MISMATCH'],
  ['args version mismatch', input => { input.runtimeBinding.sagas[0].argsCodec.version = 'Other'; }, 'RUNTIME_CODEC_MISMATCH'],
  ['args runtime coerced', input => { input.runtimeBinding.sagas[0].argsCodec.runtimeVersion = '1'; }, 'RUNTIME_VERSION'],
  ['missing phase receipt pin', input => { input.runtimeBinding.sagas[0].receiptCodecs.pop(); }, 'RUNTIME_CODEC_MISSING'],
  ['duplicate phase receipt pin', input => { input.runtimeBinding.sagas[0].receiptCodecs.push(clone(input.runtimeBinding.sagas[0].receiptCodecs[0])); }, 'RUNTIME_DUPLICATE'],
  ['orphan receipt pin', input => { input.runtimeBinding.sagas[0].receiptCodecs[0].stepId = 'Other'; }, 'RUNTIME_CODEC_ORPHAN'],
  ['receipt unknown phase', input => { input.runtimeBinding.sagas[0].receiptCodecs[0].phase = 'other'; }, 'RUNTIME_SCHEMA'],
  ['receipt version mismatch', input => { input.runtimeBinding.sagas[0].receiptCodecs[0].version = 'Other'; }, 'RUNTIME_CODEC_MISMATCH'],
  ['receipt runtime coerced', input => { input.runtimeBinding.sagas[0].receiptCodecs[0].runtimeVersion = '1'; }, 'RUNTIME_VERSION'],
  ['unknown canonical execution field', input => { input.canonical.sagas[0].payload.extra = true; }, 'SAGA_SCHEMA'],
  ['unknown technical binding field', input => { input.binding.sagas[0].extra = true; }, 'SAGA_SCHEMA'],
  ['two attempts', input => { input.canonical.sagas[0].payload.resilience.maxAttempts = 2; }, 'RUNTIME_RESILIENCE_UNSUPPORTED'],
  ['nonzero backoff', input => { input.canonical.sagas[0].payload.resilience.backoffMs = 1; }, 'RUNTIME_RESILIENCE_UNSUPPORTED'],
  ['separate query timeout', input => { input.canonical.sagas[0].payload.resilience.queryTimeoutMs = 500; }, 'RUNTIME_RESILIENCE_UNSUPPORTED'],
  ['concurrent admission', input => { input.canonical.sagas[0].payload.admission.maxInFlight = 2; }, 'RUNTIME_PARALLEL_UNSUPPORTED'],
  ['same-group concurrency', input => { const p = input.canonical.sagas[0].payload; p.groups.pop(); p.steps[1].group = 1; p.admission.maxInFlight = 2; }, 'RUNTIME_PARALLEL_UNSUPPORTED'],
  ['missing predecessor barrier', input => { input.canonical.sagas[0].payload.groups[1].dependsOn = []; }, 'SAGA_GROUP_ORDER'],
  ['unknown barrier', input => { input.canonical.sagas[0].payload.groups[1].dependsOn = [9]; }, 'SAGA_GROUP_UNKNOWN'],
  ['barrier cycle', input => { input.canonical.sagas[0].payload.groups[0].dependsOn = [2]; }, 'SAGA_GROUP_CYCLE'],
  ['source uses target address', input => { input.canonical.sagas[0].payload.steps[0].phases.prepare.bindings[1].ref = 'args:to'; }, 'SAGA_RESOURCE'],
  ['address type mismatch', input => { input.binding.sagas[0].participants[0].addressing.resourceType = 'TxId'; }, 'SAGA_RESOURCE'],
  ['all-none phase', input => { input.canonical.sagas[0].payload.steps[0].phases.prepare = { kind: 'none', reason: 'synthetic-read-only' }; }, undefined],
]) test('v3 failclosed ' + name, () => { const input = real(); mutate(input); failure(input, code); });

test('more than 1024 singleton groups and more than 3072 receipt rows are failclosed', () => {
  failure(synthetic(1025));
  const input = real(), pin = input.runtimeBinding.sagas[0];
  pin.receiptCodecs = Array.from({ length: 3073 }, () => clone(pin.receiptCodecs[0]));
  failure(input, 'RUNTIME_SCHEMA');
});

for (const [name, mutate] of [
  ['digest', input => { input.ir.digest = '0'.repeat(64); }],
  ['sourceMap', input => { input.ir.sourceMap = {}; }],
  ['capability flags', input => { input.ir.runnable = true; }],
  ['definition', input => { input.ir.sagas[0].definition.payload.groups.reverse(); }],
  ['binding', input => { input.ir.sagas[0].binding.codec.mapper = 'tampered'; }],
]) test('v3 full optional compiler closure rejects forged ' + name, () => {
  const input = real(); input.ir = compileSagas(input.canonical, input.binding).ir; mutate(input); failure(input, 'RUNTIME_IR_MISMATCH');
});

for (const [name, mutate] of [
  ['accessor', (input, callback) => { Object.defineProperty(input, 'extra', { enumerable: true, get: callback }); }],
  ['nested proxy', (input, callback) => { input.canonical = new Proxy(input.canonical, { get: callback, ownKeys: callback }); }],
  ['cycle', input => { input.extra = input; }],
  ['toJSON', (input, callback) => { input.extra = { toJSON: callback }; }],
  ['sparse array', input => { delete input.runtimeBinding.sagas[0].receiptCodecs[0]; }],
  ['symbol field', input => { input[Symbol('extra')] = 1; }],
  ['hidden field', input => { Object.defineProperty(input, 'extra', { value: 1 }); }],
  ['undefined', input => { input.extra = undefined; }],
  ['NaN', input => { input.extra = NaN; }],
]) test('v3 rejects hostile JSON without executing callbacks ' + name, () => {
  const input = real(); let calls = 0; mutate(input, () => { calls++; throw Error('must not execute'); });
  failure(input, 'RUNTIME_JSON'); assert.equal(calls, 0);
});

// White-box independent admission recheck: use the actual private v3 feature
// function in isolation so compiler diagnostics/flags cannot mask its checks.
const runtimeSource = readFileSync(new URL('../lib/saga/runtime-binding.mjs', import.meta.url), 'utf8');
const featureSource = runtimeSource.slice(runtimeSource.indexOf('function featureCheckV3('), runtimeSource.indexOf('\nfunction receiptInput('));
const independentFeature = runInNewContext('(' + featureSource + ')', { PHASES });
function recheck(input, mutate, expected) {
  const compiled = compileSagas(input.canonical, input.binding); assert.deepEqual(compiled.diagnostics, []);
  const saga = compiled.ir.sagas[0]; mutate(saga);
  const diagnostics = [];
  independentFeature(saga, 0, (code, message, pointer) => diagnostics.push({ code, message, pointer }));
  assert.ok(diagnostics.some(row => row.code === expected), JSON.stringify(diagnostics));
}
for (const [name, mutate, code] of [
  ['same-group concurrency', saga => { saga.definition.payload.steps[1].group = 1; }, 'RUNTIME_PARALLEL_UNSUPPORTED'],
  ['maxInFlight', saga => { saga.definition.payload.admission.maxInFlight = 2; }, 'RUNTIME_PARALLEL_UNSUPPORTED'],
  ['dynamic manifest', saga => { saga.definition.payload.admission.manifest.mode = 'durable-reference'; }, 'RUNTIME_MANIFEST_UNSUPPORTED'],
  ['collection', saga => { saga.binding.types[0].kind = 'collection'; }, 'RUNTIME_TYPE_UNSUPPORTED'],
  ['manifest type', saga => { saga.binding.types[0].kind = 'manifest-reference'; }, 'RUNTIME_TYPE_UNSUPPORTED'],
  ['Money encoding', saga => { saga.binding.types.find(row => row.kind === 'money').amountEncoding = 'number'; }, 'RUNTIME_MONEY_UNSUPPORTED'],
  ['resilience', saga => { saga.definition.payload.resilience.maxAttempts = 2; }, 'RUNTIME_RESILIENCE_UNSUPPORTED'],
  ['none phase', saga => { saga.definition.payload.steps[0].phases.prepare.kind = 'none'; }, 'RUNTIME_ALL_TCC_REQUIRED'],
  ['barrier missing', saga => { saga.definition.payload.groups[1].dependsOn = []; }, 'RUNTIME_GROUP_UNSUPPORTED'],
  ['barrier forward', saga => { saga.definition.payload.groups[0].dependsOn = [2]; }, 'RUNTIME_GROUP_UNSUPPORTED'],
  ['barrier unknown', saga => { saga.definition.payload.groups[1].dependsOn = [9]; }, 'RUNTIME_GROUP_UNSUPPORTED'],
  ['step missing group', saga => { saga.definition.payload.steps[1].group = 9; }, 'RUNTIME_GROUP_UNSUPPORTED'],
  ['zero groups', saga => { saga.definition.payload.groups = []; }, 'RUNTIME_GROUP_UNSUPPORTED'],
  ['duplicate groups', saga => { saga.definition.payload.groups.push(clone(saga.definition.payload.groups[0])); }, 'RUNTIME_GROUP_UNSUPPORTED'],
  ['too many groups', saga => { saga.definition.payload.groups = Array.from({ length: 1025 }, (_, i) => ({ id: i + 1, dependsOn: i ? [i] : [] })); }, 'RUNTIME_GROUP_UNSUPPORTED'],
  ['Prepare self', saga => { saga.definition.payload.steps[0].phases.prepare.bindings[2].ref = 'step:step-0:prepare:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['Prepare forward', saga => { saga.definition.payload.steps[0].phases.prepare.bindings[2].ref = 'step:step-1:prepare:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['Prepare ancestor Commit', saga => { saga.definition.payload.steps[1].phases.prepare.bindings[2].ref = 'step:step-0:commit:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['Commit self Commit', saga => { saga.definition.payload.steps[0].phases.commit.bindings[2].ref = 'step:step-0:commit:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['Commit forward Commit', saga => { saga.definition.payload.steps[0].phases.commit.bindings[2].ref = 'step:step-1:commit:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['Commit Compensate', saga => { saga.definition.payload.steps[1].phases.commit.bindings[2].ref = 'step:step-0:compensate:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['Compensate cross-step', saga => { saga.definition.payload.steps[1].phases.compensate.bindings[2].ref = 'step:step-0:prepare:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['Compensate own Commit', saga => { saga.definition.payload.steps[0].phases.compensate.bindings[2].ref = 'step:step-0:commit:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['unknown receipt producer', saga => { saga.definition.payload.steps[1].phases.prepare.bindings[2].ref = 'step:missing:prepare:token'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['unknown receipt slot', saga => { saga.definition.payload.steps[1].phases.prepare.bindings[2].ref = 'step:step-0:prepare:missing'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['malformed receipt ref', saga => { saga.definition.payload.steps[1].phases.prepare.bindings[2].ref = 'step:step-0:prepare:token:extra'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['completion receipt adapter missing', saga => { saga.definition.payload.completions[0].bindings.push({ slot: 'token', type: 'ReservationId', ref: 'step:step-1:commit:token' }); }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['receipt type mismatch', saga => { saga.definition.payload.steps[1].phases.prepare.bindings[2].type = 'TxId'; }, 'RUNTIME_DATAFLOW_UNSUPPORTED'],
  ['resource slot', saga => { saga.definition.payload.steps[0].phases.prepare.bindings[1].ref = 'args:token'; }, 'RUNTIME_RESOURCE_MISMATCH'],
]) test('v3 independently rechecks admitted payload ' + name, () => { recheck(synthetic(), mutate, code); });

test('v1/v2 explicitly reject new document/capabilities and do not inherit v3 barrier/receipt support', () => {
  for (const lower of [lowerSagaRuntimeBinding, lowerSagaRuntimeBindingV2]) {
    const input = real(); assert.ok(lower(input).diagnostics.some(row => row.code === 'RUNTIME_SCHEMA'));
    input.runtimeBinding.schemaVersion = 'truthsrc.saga-runtime-binding/v1';
    assert.ok(lower(input).diagnostics.some(row => row.code === 'RUNTIME_CAPABILITY_UNSUPPORTED'));
    // P4 receipt re-cut: the real serial example carries no step-receipt reads
    // anymore, so the barrier/dataflow rejections are exercised on the synthetic
    // fixture — the step-receipt dataflow carrier.
    const legacyInput = synthetic(2);
    legacyInput.runtimeBinding.schemaVersion = 'truthsrc.saga-runtime-binding/v1';
    legacyInput.runtimeBinding.target.capabilities = legacyInput.runtimeBinding.target.capabilities.slice(0, 7);
    const result = lower(legacyInput); assert.equal(result.ir, null); assert.equal(result.plan, null);
    assert.ok(result.diagnostics.some(row => row.code === 'RUNTIME_GROUP_UNSUPPORTED'));
    assert.ok(result.diagnostics.some(row => row.code === 'RUNTIME_DATAFLOW_UNSUPPORTED'));
  }
});

test('legacy v1/v2 full JSON byte-shape and digests match SHA-verified pre-v3 implementation', () => {
  const input = synthetic(1, false);
  input.runtimeBinding.schemaVersion = 'truthsrc.saga-runtime-binding/v1';
  input.runtimeBinding.target.capabilities = input.runtimeBinding.target.capabilities.slice(0, 7);
  const v1 = lowerSagaRuntimeBinding(input), v2 = lowerSagaRuntimeBindingV2(input);
  assert.deepEqual(v1.diagnostics, []); assert.deepEqual(v2.diagnostics, []);
  assert.equal(v1.ir, v1.plan); assert.notEqual(v2.ir, v2.plan);
  assert.equal(bytesHash(v1), '76688ce4bc07f0a79c1248ecdd5358d5f0d8468ecdc7098635747f7040ac0431');
  assert.equal(bytesHash(v2), '08c27fd057604a8d0de9666e232c9ef18ebff8cbbc3f7628c1e28db990b50912');
  assert.equal(v1.ir.sagas[0].definitionDigest, 'sha256:5b7f8754f78228ecb5ba47c37c6b2d8a360c645d46768c973a8b5306a5f666c7');
  assert.equal(v2.ir.sagas[0].definitionDigest, v1.ir.sagas[0].definitionDigest);
});
