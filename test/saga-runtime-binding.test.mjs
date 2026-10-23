import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileSagas } from '../lib/saga/compile.mjs';
import { compileTree } from '../lib/compile.mjs';
import { lowerSagaRuntimeBinding, validateSagaRuntimeBinding } from '../lib/saga/runtime-binding.mjs';
import { sagaContract, REQUIRED_CAPABILITIES } from './fixtures/saga-contract.mjs';

const PHASES = ['prepare', 'commit', 'compensate'];
const TARGET = {
  artifact: 'net.imadz:saga-core:strict-runtime-binding-v1-SNAPSHOT',
  artifactStatus: 'unpublished-candidate', apiMode: 'strict',
  definitionApi: 'net.imadz.infra.saga.strict.StrictSagaDefinition',
  coordinatorApi: 'net.imadz.infra.saga.strict.StrictSagaCoordinator',
  executionMode: 'static-serial-allTCC',
  capabilities: ['positive-int-definition-version', 'static-participants', 'serial-all-tcc',
    'fresh-canonical-args', 'pinned-args-codec', 'pinned-phase-receipt-codecs', 'minor-unit-string-money'],
};
const clone = (value) => structuredClone(value);
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const sha = (value) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const reverse = (value) => Array.isArray(value) ? value.map(reverse) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverse(item)])) : value;
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function runtimeDocument(canonical, binding, runtimeVersion = 17) {
  return {
    schemaVersion: 'truthsrc.saga-runtime-binding/v1', target: clone(TARGET),
    sagas: canonical.sagas.map((definition) => {
      const technical = binding.sagas.find((row) => row.sagaId === definition.id);
      return { sagaId: definition.id, definitionVersion: definition.version, runtimeVersion,
        argsCodec: { id: technical.codec.id, version: technical.codec.version, runtimeVersion: 23 },
        receiptCodecs: technical.steps.flatMap((step) => PHASES.filter((phase) => step.phases[phase].kind === 'command')
          .map((phase, ordinal) => ({ stepId: step.stepId, phase, id: `Explicit-${phase}-receipt`,
            version: step.phases[phase].receipt.version, runtimeVersion: 31 + ordinal }))) };
    }),
  };
}
// Independent single-resource synthetic contract, NOT a reduced money-transfer
// fixture or an end-to-end business example. No authored participant/slot is erased.
function minimal(version = 'v1') {
  const field = (name, dataType) => ({ name, dataType, origin: 'BUSINESS_INPUT' });
  const ref = (name) => ({ aggregate: 'Account', name });
  const resultKinds = ['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown'];
  const args = [{ slot: 'from', type: 'AccountId' }, { slot: 'amount', type: 'Money' }];
  const commands = [], events = [], phases = {}, technicalPhases = {};
  const receiptIdentity = ['txid', 'definition-version', 'args-digest', 'participant', 'resource', 'step', 'phase'];
  for (const phase of PHASES) {
    const name = `${phase}-source`;
    const bindings = [{ slot: 'txid', ref: 'txid', type: 'TxId' },
      { slot: 'resource', ref: 'args:from', type: 'AccountId' },
      ...(phase === 'prepare' ? [{ slot: 'amount', ref: 'args:amount', type: 'Money' }] : [])];
    const outputs = phase === 'prepare' ? [{ slot: 'reservation', type: 'ReservationId' }]
      : phase === 'commit' ? [{ slot: 'receiptId', type: 'TxId' }] : [];
    commands.push({ name, parameters: bindings.map(({ slot, type }) => field(slot, type)), produces: [`${name}-confirmed`] });
    events.push({ name: `${name}-confirmed`, payloads: outputs.map(({ slot, type }) => field(slot, type)) });
    phases[phase] = { kind: 'command', commandRef: ref(name), bindings, outputs };
    technicalPhases[phase] = { kind: 'command', port: 'fixture.PhasePort', commandMapper: 'fixture.CommandMapper',
      confirmation: { kind: 'durable-receipt', eventRef: ref(`${name}-confirmed`), mapper: 'fixture.ConfirmationMapper',
        outputs: outputs.map(({ slot, type }) => ({ slot, ref: `receipt:${slot}`, type })) },
      query: { mapper: 'fixture.QueryMapper', mode: 'read-only', identity: [...receiptIdentity], resultKinds: ['confirmed', 'not-executed', 'unknown'] },
      receipt: { mapper: 'fixture.ReceiptMapper', version: 'receipt-v1', durable: true, identity: [...receiptIdentity],
        payloadCompatibility: 'exact', evidence: 'reservation-decision-effect-reconciliation' },
      idempotency: { mapper: 'fixture.IdempotencyMapper', identity: ['txid', 'definition-version', 'participant', 'resource', 'step', 'phase'],
        payloadConflict: 'reject', attemptIdentity: 'excluded' } };
  }
  const sourceFields = [field('operationId', 'OperationId'), ...args.map(({ slot, type }) => field(slot, type))];
  commands.push({ name: 'StartSingleResource', parameters: sourceFields, produces: ['SingleResourceRequested'] });
  events.push({ name: 'SingleResourceRequested', payloads: sourceFields });
  for (const kind of resultKinds) events.push({ name: `result-${kind}`, payloads: [field('txid', 'TxId')] });
  const payload = { schemaVersion: 'truthsrc.saga/v1', purpose: 'Synthetic one-resource adapter shape only',
    invariants: ['Exact minor units retained; business invariant enforcement remains unverified'],
    transactionIdType: 'TxId', args,
    participants: [{ id: 'source', aggregate: 'Account', resourceRef: { ref: 'args:from', type: 'AccountId' } }],
    groups: [{ id: 1, dependsOn: [] }], steps: [{ id: 'reserve-source', participant: 'source', group: 1, phases }],
    resilience: { maxAttempts: 1, phaseTimeoutMs: 1000, queryTimeoutMs: 1000, backoffMs: 0, totalTimeoutMs: 5000 },
    safety: { commitDecision: 'durable-before-commit', abortDecision: 'durable-before-compensate', afterCommit: 'forward-recovery',
      unknown: 'reconcile-before-resume', compensation: 'confirmed-reservations', cancelBeforePrepare: 'empty-release-and-fence',
      retryIdentity: 'stable-operation', manualRecovery: 'authorized-reconciliation-evidence' },
    admission: { maxParticipants: 1, maxInFlight: 1, maxItemsPerChunk: 64, manifest: { mode: 'static', durable: true } },
    triggers: ['command', 'event'].map((kind) => ({ id: `from-${kind}`, kind,
      sourceRef: ref(kind === 'command' ? 'StartSingleResource' : 'SingleResourceRequested'),
      argsMapping: args.map(({ slot, type }) => ({ slot, ref: `source:${slot}`, type })),
      idempotency: { ref: 'source:operationId', type: 'OperationId', scope: 'saga-version', conflict: 'reject-different-args' } })),
    resultKinds, completions: resultKinds.map((kind) => ({ kind, eventRef: ref(`result-${kind}`), bindings: [{ slot: 'txid', ref: 'txid', type: 'TxId' }] })) };
  const canonical = { schemaVersion: 'truthsrc/v1', workshop: 'Independent one-resource synthetic contract', sessions: [],
    aggregates: [{ name: 'Account', identifier: field('id', 'AccountId'), commands, events }],
    sagas: [{ id: 'single-resource-contract', name: 'Synthetic one resource', seq: 0, version, payload }] };
  const binding = { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [{ sagaId: 'single-resource-contract', version,
    module: 'fixture.SagaModule', engine: { artifact: TARGET.artifact, apiMode: 'strict', entrypoint: 'fixture.StrictSagaEntry',
      capabilities: { required: [...REQUIRED_CAPABILITIES] } },
    codec: { id: 'ArgsCodec', version: 'codec-v1', compatibleVersions: ['codec-v1'], mapper: 'fixture.ArgsCodec' },
    types: ['TxId', 'OperationId', 'AccountId', 'ReservationId'].map((id) => ({ id, canonicalType: id,
      implementation: `fixture.types.${id}`, kind: 'id', minLength: 1, maxLength: 128 })).concat([
      { id: 'Money', canonicalType: 'Money', implementation: 'fixture.types.Money', kind: 'money', currency: 'ISO-4217',
        amountEncoding: 'minor-unit-string', scale: 2, precision: 38, codec: 'fixture.ExactMoneyCodec' }]),
    participants: [{ participantId: 'source', addressing: { resolver: 'fixture.sourceResolver', aggregate: 'Account', resourceType: 'AccountId', mode: 'exact-resource' } }],
    steps: [{ stepId: 'reserve-source', phases: technicalPhases }],
    triggerMappers: payload.triggers.map(({ id }) => ({ triggerId: id, argsMapper: 'fixture.TriggerArgsMapper', idempotencyMapper: 'fixture.TriggerIdempotencyMapper' })),
    completionMappers: resultKinds.map((kind) => ({ kind, mapper: 'fixture.CompletionMapper' })) }] };
  return { canonical, binding, runtimeBinding: runtimeDocument(canonical, binding) };
}
function success(context) {
  const result = lowerSagaRuntimeBinding(context);
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  assert.ok(result.ir); assert.equal(result.plan, result.ir);
  assert.equal(result.ir.runtimeBindingVerified, false);
  assert.equal(result.ir.runnable, false);
  return result.ir;
}
function failure(context, code, pointer) {
  const result = lowerSagaRuntimeBinding(context);
  assert.equal(result.ir, null, 'no partial IR');
  assert.equal(result.plan, null, 'no partial plan');
  assert.ok(result.diagnostics.some((entry) => entry.code === code && (!pointer || entry.pointer === pointer)), JSON.stringify(result.diagnostics));
  const validation = validateSagaRuntimeBinding(context);
  assert.equal(validation.valid, false);
  assert.equal(validation.ir, null); assert.equal(validation.plan, null);
  assert.equal(validation.runnable, false); assert.equal(validation.runtimeBindingVerified, false);
  assert.deepEqual(validation.diagnostics, result.diagnostics);
  return result;
}
function contract(context) { return success(context).sagas[0]; }

test('minimal compiler-closed static allTCC lowers actual resolved adapter data, never a runtime certificate', () => {
  const context = minimal();
  const compiled = compileSagas(context.canonical, context.binding);
  assert.deepEqual(compiled.diagnostics, []);
  const lowered = success({ ...context, ir: compiled.ir });
  const saga = lowered.sagas[0];
  assert.equal(lowered.schemaVersion, 'truthsrc.saga-runtime-contract/v1');
  assert.equal(saga.definitionVersion, 'v1');
  assert.deepEqual(saga.runtimeIdentity, { name: 'single-resource-contract', version: 17 });
  assert.deepEqual(saga.contract, { definition: context.canonical.sagas[0], binding: context.binding.sagas[0] });
  assert.equal(saga.definitionDigest, `sha256:${sha({ definition: context.canonical.sagas[0], binding: context.binding.sagas[0],
    runtimeBinding: { target: TARGET, saga: context.runtimeBinding.sagas[0] } })}`);
  assert.match(saga.definitionDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(saga.args.contractCodec, { id: 'ArgsCodec', version: 'codec-v1' });
  assert.deepEqual(saga.args.runtimeCodec, { id: 'ArgsCodec', version: 23 });
  assert.equal(lowered.target.artifactStatus, 'unpublished-candidate');
  assert.equal(saga.participants[0].resource.ref, 'args:from');
  assert.deepEqual(saga.participants[0].resource.addressing, context.binding.sagas[0].participants[0].addressing);
  for (const phase of PHASES) {
    const row = saga.participants[0].phases[phase];
    assert.equal(row.runtimePhase, phase[0].toUpperCase() + phase.slice(1));
    assert.equal(row.port, 'fixture.PhasePort');
    assert.deepEqual(row.contractCodec, { id: `Explicit-${phase}-receipt`, version: 'receipt-v1' });
    assert.deepEqual(row.runtimeCodec, { id: `Explicit-${phase}-receipt`, version: 31 + PHASES.indexOf(phase) });
    assert.notEqual(row.runtimeCodec.id, row.receipt.mapper);
    assert.deepEqual(row.inputs[0], { slot: 'txid', type: 'TxId', source: { kind: 'transaction-id' } });
    assert.deepEqual(row.inputs[1], { slot: 'resource', type: 'AccountId', source: { kind: 'args', slot: 'from' } });
  }
  assert.equal(saga.hostRequirements.totalDeadline.totalTimeoutMs, 5000);
  assert.ok(saga.hostRequirements.capabilities.every((row) => row.verified === false));
  assert.deepEqual(saga.schedule, { prepare: ['reserve-source'], commit: ['reserve-source'], compensate: ['reserve-source'] });
  assert.equal(saga.runnable, false); assert.equal(saga.runtimeBindingVerified, false);
  assert.ok(saga.blocked.includes('scala-ast-adapter-missing'));
  const validation = validateSagaRuntimeBinding(context);
  assert.equal(validation.valid, true); assert.equal(validation.plan, null);
});

test('JSON-serialized lowered output is consumable by a narrow adapter without rejoining input IR', () => {
  const lowered = JSON.parse(JSON.stringify(success(minimal())));
  const saga = lowered.sagas[0];
  const args = { from: 'account-a', to: 'account-b', amount: { currency: 'USD', minorUnits: '90071992547409931234567890123456789012' } };
  const request = { identity: { transactionId: 'transfer-42' }, args };
  const phase = saga.participants[0].phases.prepare;
  const command = Object.fromEntries(phase.inputs.map((input) => [input.slot,
    input.source.kind === 'transaction-id' ? request.identity.transactionId : request.args[input.source.slot]]));
  assert.deepEqual(command, { txid: 'transfer-42', resource: 'account-a', amount: args.amount });
  const money = saga.args.types.find((row) => row.id === 'Money');
  assert.equal(money.amountEncoding, 'minor-unit-string'); assert.equal(money.precision, 38);
  assert.equal(command.amount.minorUnits, args.amount.minorUnits);
  assert.equal(typeof command.amount.minorUnits, 'string');
  assert.equal(phase.runtimeCodec.id, 'Explicit-prepare-receipt');
  assert.equal(saga.completions.find((row) => row.kind === 'succeeded').inputs[0].source.kind, 'transaction-id');
  assert.equal(saga.triggers[0].binding.triggerId, saga.triggers[0].declaration.id);
});

for (const version of ['v1', 'release-2026_10', 'V01']) {
  test(`compiler-legal string business version ${JSON.stringify(version)} maps exactly, never parsed`, () => {
    const context = minimal(version); context.runtimeBinding.sagas[0].runtimeVersion = 93;
    const saga = contract(context);
    assert.equal(saga.definitionVersion, version);
    assert.equal(saga.contract.definition.version, version); assert.equal(saga.contract.binding.version, version);
    assert.equal(saga.runtimeIdentity.version, 93);
    assert.equal(saga.args.contractCodec.version, 'codec-v1'); assert.equal(saga.args.runtimeCodec.version, 23);
    assert.equal(saga.participants[0].phases.prepare.contractCodec.version, 'receipt-v1');
    assert.ok(compileSagas(context.canonical, context.binding).ir);
  });
}
for (const version of ['1', ' release/2026.10 ', '', '   ', 1, Number.MAX_SAFE_INTEGER, 0, -1, 1.5, true, null, {}]) {
  test(`live compiler rejects unsupported ${typeof version} business version ${JSON.stringify(version)} unchanged`, () => {
    const context = minimal(); context.canonical.sagas[0].version = version; context.binding.sagas[0].version = version;
    const before = clone(context); const compiled = compileSagas(context.canonical, context.binding);
    assert.equal(compiled.ir, null);
    const result = failure(context, 'SAGA_SCHEMA', '/canonical/sagas/0/version');
    for (const diagnostic of compiled.diagnostics) assert.ok(result.diagnostics.some((entry) =>
      entry.code === diagnostic.code && entry.pointer === `/${diagnostic.source.document}${diagnostic.source.pointer}`));
    assert.deepEqual(context, before);
  });
}
for (const version of ['v2', 'V1']) {
  test(`runtime mapping exact string mismatch ${version} is rejected`, () => {
    const context = minimal(); context.runtimeBinding.sagas[0].definitionVersion = version;
    failure(context, 'RUNTIME_VERSION_MISMATCH');
  });
  test(`technical business version mismatch ${version} stays rejected by compiler`, () => {
    const context = minimal(); context.binding.sagas[0].version = version;
    const compiled = compileSagas(context.canonical, context.binding); assert.equal(compiled.ir, null);
    const result = lowerSagaRuntimeBinding(context); assert.equal(result.plan, null);
    assert.ok(result.diagnostics.some((entry) => entry.code === compiled.diagnostics[0].code));
  });
}
for (const version of [1, ' v1 ', 'v1 ', '1', null]) {
  test(`runtime mapping does not strip or coerce ${JSON.stringify(version)}`, () => {
    const context = minimal(); context.runtimeBinding.sagas[0].definitionVersion = version;
    failure(context, 'RUNTIME_SCHEMA', '/runtimeBinding/sagas/0/definitionVersion');
  });
}
for (const version of ['1', 'v1', 0, -1, 1.2, 2147483648, Number.MAX_SAFE_INTEGER]) {
  test(`invalid runtime Int ${JSON.stringify(version)} is rejected, not coerced`, () => {
    const context = minimal(); context.runtimeBinding.sagas[0].runtimeVersion = version;
    failure(context, 'RUNTIME_VERSION');
  });
}
test('maximum positive Scala Int is explicitly independent of legal string business version', () => {
  const context = minimal('v2147483648'); context.runtimeBinding.sagas[0].runtimeVersion = 2147483647;
  assert.equal(contract(context).runtimeIdentity.version, 2147483647);
});

const CODEC_PINS = [
  { name: 'args', pointer: '/runtimeBinding/sagas/0/argsCodec', get: (c) => c.runtimeBinding.sagas[0].argsCodec },
  ...PHASES.map((phase, ordinal) => ({ name: `${phase} receipt`,
    pointer: `/runtimeBinding/sagas/0/receiptCodecs/${ordinal}`, get: (c) => c.runtimeBinding.sagas[0].receiptCodecs[ordinal] })),
];
for (const { name, pointer, get } of CODEC_PINS) {
  test(`${name} codec runtimeVersion is mandatory and cannot default to the definition or another codec`, () => {
    const context = minimal(); delete get(context).runtimeVersion;
    failure(context, 'RUNTIME_SCHEMA', `${pointer}/runtimeVersion`);
  });
  for (const version of ['1', 'codec-v1', 0, -1, 1.5, 2147483648, Number.MAX_SAFE_INTEGER, true, null]) {
    test(`${name} codec rejects non-positive-Int runtimeVersion ${JSON.stringify(version)} without coercion`, () => {
      const context = minimal(); get(context).runtimeVersion = version;
      failure(context, 'RUNTIME_VERSION', `${pointer}/runtimeVersion`);
    });
  }
}
test('definition, args and every phase codec have independent explicit positive Int pins and digest coverage', () => {
  const context = minimal(); context.runtimeBinding.sagas[0].runtimeVersion = 101;
  context.runtimeBinding.sagas[0].argsCodec.runtimeVersion = 1;
  context.runtimeBinding.sagas[0].receiptCodecs.forEach((codec, i) => { codec.runtimeVersion = [2147483647, 102, 103][i]; });
  const first = contract(context);
  assert.equal(first.runtimeIdentity.version, 101);
  assert.deepEqual(first.args.runtimeCodec, { id: 'ArgsCodec', version: 1 });
  assert.equal(first.args.contractCodec.version, 'codec-v1');
  for (const [i, phase] of PHASES.entries()) {
    assert.equal(first.participants[0].phases[phase].runtimeCodec.version, [2147483647, 102, 103][i]);
    assert.equal(first.participants[0].phases[phase].contractCodec.version, 'receipt-v1');
  }
  for (const { get } of CODEC_PINS) {
    const copy = clone(context); get(copy).runtimeVersion = get(copy).runtimeVersion === 2147483647 ? 2147483646 : 200;
    const changed = contract(copy);
    assert.notEqual(changed.definitionDigest, first.definitionDigest);
    assert.deepEqual(changed.contract, first.contract);
    assert.deepEqual(changed.runtimeIdentity, first.runtimeIdentity);
  }
});

test('same business version full definition and technical semantics produce different digests', () => {
  const context = minimal(); const first = contract(context).definitionDigest;
  for (const change of [
    (c) => { c.canonical.sagas[0].payload.purpose += ' revised'; },
    (c) => { c.canonical.sagas[0].payload.invariants.push('Different domain requirement'); },
    (c) => { c.binding.sagas[0].steps[0].phases.compensate.commandMapper = 'fixture.OtherMapper'; },
    (c) => { c.binding.sagas[0].participants[0].addressing.resolver = 'fixture.OtherResolver'; },
    (c) => { c.binding.sagas[0].types.find((row) => row.id === 'Money').precision = 37; },
    (c) => { c.canonical.sagas[0].payload.resilience.totalTimeoutMs = 6000; },
    (c) => { c.runtimeBinding.sagas[0].runtimeVersion = 18; },
  ]) {
    const copy = clone(context); change(copy);
    const saga = contract(copy);
    assert.equal(saga.definitionVersion, 'v1'); assert.notEqual(saga.definitionDigest, first);
  }
  assert.equal(contract(reverse(context)).definitionDigest, first);
  assert.notEqual(contract(minimal('v1')).definitionDigest, contract(minimal('V1')).definitionDigest);
});

test('anchors/sourceMap are provenance only; forged IR digest/readiness never passes the closure gate', () => {
  const context = minimal(); const first = contract(context).definitionDigest;
  context.canonical.anchors = [{ file: 'first.scala', symbol: 'First' }];
  context.binding.sourceMap = { canonical: { '/sagas/0': { file: 'first.saga.yaml', location: { line: 7, column: 2 } } } };
  assert.equal(contract(context).definitionDigest, first);
  context.canonical.anchors[0].symbol = 'Moved';
  context.binding.sourceMap.canonical['/sagas/0'].file = 'moved.saga.yaml';
  context.binding.sourceMap.canonical['/sagas/0'].location.line = 999;
  assert.equal(contract(context).definitionDigest, first);
  context.ir = compileSagas(context.canonical, context.binding).ir;
  success(context);
  success({ ...context, ir: reverse(clone(context.ir)) });
  for (const forge of [
    (ir) => { ir.digest = '0'.repeat(64); },
    (ir) => { delete ir.digest; },
    (ir) => { delete ir.sourceMap; },
    (ir) => { delete ir.sagas[0].definition.payload.invariants; },
    (ir) => { ir.sagas = []; },
    (ir) => { ir.readiness = 'runnable'; },
    (ir) => { ir.sagas[0].runtimeBindingVerified = true; },
    (ir) => { ir.sagas[0].definition.payload.purpose = 'forged'; },
    (ir) => { ir.sourceMap[''].file = 'forged'; },
    (ir) => { ir.unknown = true; },
  ]) {
    const copy = clone(context); forge(copy.ir); failure(copy, 'RUNTIME_IR_MISMATCH', '/ir');
  }
  const stale = clone(context);
  stale.binding.sourceMap.canonical['/sagas/0'].location.line += 1;
  assert.deepEqual(compileSagas(stale.canonical, stale.binding).diagnostics, []);
  failure(stale, 'RUNTIME_IR_MISMATCH', '/ir');
  failure({ ...context, ir: null }, 'RUNTIME_IR_MISMATCH', '/ir');
});

test('args and every receipt codec id/version independently enter semantic digest', () => {
  const context = minimal(); const first = contract(context).definitionDigest;
  for (const change of [
    (c) => { c.binding.sagas[0].codec.id = 'ArgsCodec2'; c.runtimeBinding.sagas[0].argsCodec.id = 'ArgsCodec2'; },
    (c) => { c.binding.sagas[0].codec.version = 'codec-v2'; c.binding.sagas[0].codec.compatibleVersions.push('codec-v2'); c.runtimeBinding.sagas[0].argsCodec.version = 'codec-v2'; },
    (c) => { c.runtimeBinding.sagas[0].receiptCodecs[2].id = 'CompensateReceipt2'; },
    (c) => { c.runtimeBinding.sagas[0].receiptCodecs[1].version = 'receipt-v2'; c.binding.sagas[0].steps[0].phases.commit.receipt.version = 'receipt-v2'; },
    (c) => { c.binding.sagas[0].codec.mapper = 'fixture.OtherArgsCodec'; },
  ]) {
    const copy = clone(context); change(copy); assert.notEqual(contract(copy).definitionDigest, first);
  }
  const copy = clone(context); copy.runtimeBinding.sagas[0].argsCodec.id = 'Other';
  failure(copy, 'RUNTIME_CODEC_MISMATCH');
  copy.runtimeBinding.sagas[0].argsCodec.id = 'ArgsCodec'; copy.runtimeBinding.sagas[0].argsCodec.version = 'codec-v2';
  failure(copy, 'RUNTIME_CODEC_MISMATCH');
});

for (const phase of PHASES) {
  test(`${phase} receipt codec must be explicit even for empty outputs; receipt.mapper cannot supply it`, () => {
    const context = minimal(); context.runtimeBinding.sagas[0].receiptCodecs = context.runtimeBinding.sagas[0].receiptCodecs.filter((row) => row.phase !== phase);
    failure(context, 'RUNTIME_CODEC_MISSING');
  });
}
for (const field of ['id', 'version']) {
  test(`missing receipt codec ${field} rejects the entire plan`, () => {
    const context = minimal(); delete context.runtimeBinding.sagas[0].receiptCodecs[0][field];
    failure(context, 'RUNTIME_SCHEMA');
  });
}
test('receipt pins reject unknown steps/phases, duplicate keys and mismatched versions', () => {
  for (const [change, code] of [
    [(c) => { c.runtimeBinding.sagas[0].receiptCodecs[0].stepId = 'NotDeclared'; }, 'RUNTIME_CODEC_ORPHAN'],
    [(c) => { c.runtimeBinding.sagas[0].receiptCodecs[0].phase = 'execute'; }, 'RUNTIME_SCHEMA'],
    [(c) => { c.runtimeBinding.sagas[0].receiptCodecs.push(clone(c.runtimeBinding.sagas[0].receiptCodecs[0])); }, 'RUNTIME_DUPLICATE'],
    [(c) => { c.runtimeBinding.sagas[0].receiptCodecs[0].version = 'receipt-v2'; }, 'RUNTIME_CODEC_MISMATCH'],
    [(c) => { c.runtimeBinding.sagas[0].receiptCodecs[0].mapper = 'fixture.ReceiptMapper'; }, 'RUNTIME_UNKNOWN'],
  ]) { const context = minimal(); change(context); failure(context, code); }
});

for (const key of Object.keys(TARGET).filter((key) => key !== 'capabilities')) {
  test(`unknown runtime target/API ${key} rejects all output`, () => {
    const context = minimal(); context.runtimeBinding.target[key] = 'unknown'; failure(context, 'RUNTIME_TARGET');
  });
}
test('technical artifact/API mismatch cannot be hidden by a claimed strict target', () => {
  const context = minimal(); context.binding.sagas[0].engine.artifact = 'net.imadz:saga-core:0.3';
  failure(context, 'RUNTIME_TARGET_MISMATCH');
});
test('released saga-core 0.2 is neither a strict target candidate nor a compatible technical pin', () => {
  const context = minimal(); context.binding.sagas[0].engine.artifact = 'net.imadz:saga-core:0.2';
  assert.deepEqual(compileSagas(context.canonical, context.binding).diagnostics, []);
  failure(context, 'RUNTIME_TARGET_MISMATCH', '/runtimeBinding/sagas/0/sagaId');
  context.runtimeBinding.target.artifact = 'net.imadz:saga-core:0.2';
  failure(context, 'RUNTIME_TARGET', '/runtimeBinding/target/artifact');
});
for (const capability of ['parallel', 'dynamic-manifest', 'result-slot-dataflow', 'strict-scala', 'durable-commit-decision']) {
  test(`unsupported lowering capability ${capability} cannot certify execution`, () => {
    const context = minimal(); context.runtimeBinding.target.capabilities.push(capability);
    failure(context, 'RUNTIME_CAPABILITY_UNSUPPORTED');
  });
}
test('missing or duplicate known capabilities return null IR and plan', () => {
  const context = minimal(); context.runtimeBinding.target.capabilities.pop(); failure(context, 'RUNTIME_CAPABILITY_MISSING');
  context.runtimeBinding.target = clone(TARGET); context.runtimeBinding.target.capabilities.push(TARGET.capabilities[0]);
  failure(context, 'RUNTIME_DUPLICATE');
});
test('mapping requires exact sagaId, no name fallback or partial/orphan mapping', () => {
  const context = minimal(); context.runtimeBinding.sagas = []; failure(context, 'RUNTIME_MAPPING_MISSING');
  context.runtimeBinding = runtimeDocument(context.canonical, context.binding);
  context.runtimeBinding.sagas[0].sagaId = 'MoneyTransfer'; failure(context, 'RUNTIME_MAPPING_ORPHAN');
  context.runtimeBinding = runtimeDocument(context.canonical, context.binding);
  context.runtimeBinding.sagas.push(clone(context.runtimeBinding.sagas[0])); failure(context, 'RUNTIME_DUPLICATE');
});

test('existing two-account fixture stays compiler-green but group, slots and resilience yield zero plan', () => {
  const { canonical, binding } = sagaContract();
  const { ir, diagnostics } = compileSagas(canonical, binding);
  assert.deepEqual(diagnostics, []); assert.ok(ir);
  const context = { canonical, binding, ir, runtimeBinding: runtimeDocument(canonical, binding) };
  const result = failure(context, 'RUNTIME_PARALLEL_UNSUPPORTED');
  assert.ok(result.diagnostics.some((row) => row.code === 'RUNTIME_DATAFLOW_UNSUPPORTED'));
  assert.ok(result.diagnostics.some((row) => row.code === 'RUNTIME_RESILIENCE_UNSUPPORTED'));
  assert.ok(result.diagnostics.some((row) => row.code === 'RUNTIME_TARGET_MISMATCH'));
  assert.equal(compileSagas(canonical, binding).ir.digest, ir.digest);
});

test('two actual transfer steps in compiler-valid serial barrier groups remain blocked without deleting resources or receipt flow', () => {
  const { canonical, binding } = sagaContract();
  const before = clone({ canonical, binding });
  const payload = canonical.sagas[0].payload;
  assert.equal(payload.steps.length, 2);
  payload.groups = [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [1] }];
  payload.steps.forEach((step, i) => { step.group = i + 1; });
  binding.sagas[0].engine.artifact = TARGET.artifact;
  const compiled = compileSagas(canonical, binding);
  assert.deepEqual(compiled.diagnostics, []); assert.ok(compiled.ir);
  const context = { canonical, binding, ir: compiled.ir, runtimeBinding: runtimeDocument(canonical, binding) };
  const staged = clone(context);
  const result = failure(context, 'RUNTIME_GROUP_UNSUPPORTED', '/ir/sagas/0/definition/payload/groups');
  assert.ok(result.diagnostics.some((row) => row.code === 'RUNTIME_DATAFLOW_UNSUPPORTED'));
  assert.ok(!result.diagnostics.some((row) => row.code === 'RUNTIME_TARGET_MISMATCH'));
  assert.deepEqual(context, staged);
  assert.deepEqual(payload.participants, before.canonical.sagas[0].payload.participants);
  assert.deepEqual(payload.args, before.canonical.sagas[0].payload.args);
  payload.steps.forEach((step, i) => assert.deepEqual(step.phases, before.canonical.sagas[0].payload.steps[i].phases));
  assert.deepEqual(binding.sagas[0].steps, before.binding.sagas[0].steps);
});

test('owned test reads actual authored money-transfer compile output and preserves the contract gate', () => {
  const canonical = JSON.parse(compileTree(new URL('../example/saga-money-transfer/tree', import.meta.url).pathname));
  const binding = JSON.parse(readFileSync(new URL('../example/saga-money-transfer/bindings.json', import.meta.url), 'utf8'));
  const before = clone({ canonical, binding });
  const compiled = compileSagas(canonical, binding);
  assert.deepEqual(compiled.diagnostics, []); assert.ok(compiled.ir);
  const context = { canonical, binding, ir: compiled.ir, runtimeBinding: runtimeDocument(canonical, binding) };
  const result = failure(context, 'RUNTIME_PARALLEL_UNSUPPORTED');
  assert.ok(result.diagnostics.some((row) => row.pointer.endsWith('/bindings/2/ref') && row.code === 'RUNTIME_DATAFLOW_UNSUPPORTED'));
  assert.ok(result.diagnostics.some((row) => row.code === 'RUNTIME_RESILIENCE_UNSUPPORTED'));
  assert.deepEqual({ canonical, binding }, before);
});

test('legal dependent groups/durable manifest/result flow are rejected, not serialized after semantics vanish', () => {
  const { canonical, binding } = sagaContract('Fab');
  const compiled = compileSagas(canonical, binding);
  assert.deepEqual(compiled.diagnostics, []);
  const context = { canonical, binding, ir: compiled.ir, runtimeBinding: runtimeDocument(canonical, binding) };
  const result = failure(context, 'RUNTIME_GROUP_UNSUPPORTED');
  for (const code of ['RUNTIME_MANIFEST_UNSUPPORTED', 'RUNTIME_DATAFLOW_UNSUPPORTED', 'RUNTIME_TYPE_UNSUPPORTED']) assert.ok(result.diagnostics.some((row) => row.code === code));
});

test('legal completion result-slot dataflow is rejected separately from command slot flow', () => {
  const context = minimal();
  context.canonical.aggregates[0].events.find((row) => row.name === 'result-succeeded').payloads.push({ name: 'receiptId', dataType: 'TxId', origin: 'PROPAGATED' });
  context.canonical.sagas[0].payload.completions[0].bindings.push({ slot: 'receiptId', ref: 'step:reserve-source:commit:receiptId', type: 'TxId' });
  assert.deepEqual(compileSagas(context.canonical, context.binding).diagnostics, []);
  failure(context, 'RUNTIME_DATAFLOW_UNSUPPORTED', '/ir/sagas/0/definition/payload/completions/0/bindings/1/ref');
});

test('read-only none steps cannot masquerade as strict allTCC', () => {
  const context = minimal();
  for (const phase of PHASES) {
    context.canonical.sagas[0].payload.steps[0].phases[phase] = { kind: 'none', reason: 'read-only' };
    context.binding.sagas[0].steps[0].phases[phase] = { kind: 'none', reason: 'read-only' };
  }
  context.runtimeBinding = runtimeDocument(context.canonical, context.binding);
  assert.deepEqual(compileSagas(context.canonical, context.binding).diagnostics, []);
  failure(context, 'RUNTIME_ALL_TCC_REQUIRED');
});
test('decimal-string Money is compiler-valid but outside first minor-unit-string adapter contract', () => {
  const context = minimal(); context.binding.sagas[0].types.find((row) => row.id === 'Money').amountEncoding = 'decimal-string';
  assert.deepEqual(compileSagas(context.canonical, context.binding).diagnostics, []);
  failure(context, 'RUNTIME_MONEY_UNSUPPORTED');
});
test('one invalid Saga discards a second valid Saga plan', () => {
  const context = minimal(); const second = clone(context);
  second.canonical.sagas[0].id = 'other-transfer'; second.canonical.sagas[0].seq = 1;
  second.binding.sagas[0].sagaId = 'other-transfer';
  second.runtimeBinding.sagas[0].sagaId = 'other-transfer';
  context.canonical.sagas.push(second.canonical.sagas[0]); context.binding.sagas.push(second.binding.sagas[0]);
  context.runtimeBinding.sagas.push(second.runtimeBinding.sagas[0]);
  assert.equal(success(context).sagas.length, 2);
  context.runtimeBinding.sagas[1].receiptCodecs.pop(); failure(context, 'RUNTIME_CODEC_MISSING');
});

for (const [name, change, code] of [
  ['context unknown field', (c) => { c.certified = true; }, 'RUNTIME_UNKNOWN'],
  ['runtime document unknown field', (c) => { c.runtimeBinding.anchors = []; }, 'RUNTIME_UNKNOWN'],
  ['target claimed certification', (c) => { c.runtimeBinding.target.verified = true; }, 'RUNTIME_UNKNOWN'],
  ['pin unknown field', (c) => { c.runtimeBinding.sagas[0].runnable = true; }, 'RUNTIME_UNKNOWN'],
  ['args codec unknown field', (c) => { c.runtimeBinding.sagas[0].argsCodec.mapper = 'fixture.ArgsCodec'; }, 'RUNTIME_UNKNOWN'],
  ['definition unknown field', (c) => { c.canonical.sagas[0].unknown = true; }, 'SAGA_SCHEMA'],
  ['payload unknown field', (c) => { c.canonical.sagas[0].payload.unknown = true; }, 'SAGA_SCHEMA'],
  ['technical unknown field', (c) => { c.binding.sagas[0].unknown = true; }, 'SAGA_SCHEMA'],
  ['technical capability unknown', (c) => { c.binding.sagas[0].engine.capabilities.required[0] = 'unknown'; }, 'SAGA_SCHEMA'],
  ['owned command wrong type', (c) => { c.canonical.aggregates[0].commands[0].parameters[0].dataType = 'OperationId'; }, 'SAGA_TYPE_MISMATCH'],
  ['resource addressing mismatch', (c) => { c.binding.sagas[0].participants[0].addressing.aggregate = 'Other'; }, 'SAGA_RESOURCE'],
  ['unknown command reference', (c) => { c.canonical.sagas[0].payload.steps[0].phases.prepare.commandRef.name = 'Missing'; }, 'SAGA_REFERENCE_UNKNOWN'],
  ['duplicate type', (c) => { c.binding.sagas[0].types.push(clone(c.binding.sagas[0].types[0])); }, 'SAGA_DUPLICATE'],
]) {
  test(`${name} is rejected using complete closure, not readiness/digest`, () => {
    const context = minimal(); change(context); failure(context, code);
  });
}

test('immutable inputs, stable byte output and no output object borrowed from callers', () => {
  const context = minimal(); const before = clone(context); freeze(context);
  const lowered = success(context);
  assert.deepEqual(context, before);
  assert.equal(JSON.stringify(success(context)), JSON.stringify(lowered));
  assert.equal(JSON.stringify(success(reverse(context))), JSON.stringify(lowered));
  const objects = new Set();
  const walk = (value, visit) => { if (value && typeof value === 'object') { visit(value); Object.values(value).forEach((child) => walk(child, visit)); } };
  walk(context, (value) => objects.add(value)); walk(lowered, (value) => assert.ok(!objects.has(value)));
});

test('non-JSON inputs reject before getters, proxies, toJSON or other user code can execute', () => {
  let invoked = 0;
  const accessor = minimal(); Object.defineProperty(accessor.runtimeBinding, 'sagas', { enumerable: true, get() { invoked++; return []; } });
  failure(accessor, 'RUNTIME_JSON');
  const proxy = new Proxy({}, { ownKeys() { invoked++; throw new Error('must not inspect proxy'); }, getPrototypeOf() { invoked++; throw new Error('must not inspect proxy'); } });
  const proxied = minimal(); proxied.canonical.opaque = proxy; failure(proxied, 'RUNTIME_JSON');
  const callback = minimal(); callback.canonical.opaque = { toJSON() { invoked++; return {}; } }; failure(callback, 'RUNTIME_JSON');
  assert.equal(invoked, 0);
  for (const value of [undefined, () => {}, NaN, Infinity, 1n, new Date(), new Map(), Object.create({ inherited: true }), Symbol('x')]) {
    const context = minimal(); context.canonical.opaque = value; failure(context, 'RUNTIME_JSON');
  }
  const cyclic = minimal(); cyclic.canonical.opaque = cyclic.canonical; failure(cyclic, 'RUNTIME_JSON');
  const sparse = minimal(); sparse.runtimeBinding.sagas = new Array(2); failure(sparse, 'RUNTIME_JSON');
  const symbol = minimal(); symbol.runtimeBinding[Symbol('x')] = 'secret'; failure(symbol, 'RUNTIME_JSON');
  const hidden = minimal(); Object.defineProperty(hidden.runtimeBinding, 'hidden', { value: 1 }); failure(hidden, 'RUNTIME_JSON');
  const deep = minimal(); let end = deep.canonical;
  for (let i = 0; i < 132; i++) { end.opaque = {}; end = end.opaque; }
  failure(deep, 'RUNTIME_JSON');
});

test('explicit parsed object context/document only; no JSON text, implicit binding or plan from validation', () => {
  failure(JSON.stringify(minimal()), 'RUNTIME_SCHEMA');
  failure(undefined, 'RUNTIME_JSON'); failure(null, 'RUNTIME_SCHEMA');
  for (const field of ['canonical', 'binding', 'runtimeBinding']) { const context = minimal(); delete context[field]; failure(context, 'RUNTIME_SCHEMA'); }
  const context = minimal(); context.runtimeBinding = JSON.stringify(context.runtimeBinding); failure(context, 'RUNTIME_SCHEMA');
});
