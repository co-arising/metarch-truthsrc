import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inventorySagaContract } from './fixtures/inventory-saga-contract.mjs';
import { compileSagas, compileSagasV1, compileSagasV2 } from '../lib/saga/compile.mjs';
import { compileSagaProduct } from '../lib/saga/product.mjs';
import { lowerSagaRuntimeBindingV3, lowerSagaRuntimeBindingV4 } from '../lib/saga/runtime-binding.mjs';
import { STRICT_SAGA_TARGET } from '../lib/saga/runtime-targets.mjs';
import { sagaSchema, executionSchema } from '../lib/products/contract-schemas.mjs';
import { sagaSchemaV2, executionSchemaV2 } from '../lib/products/contract-schemas-v2.mjs';
import { createSagaCompiler } from '../lib/saga/compile-pure.mjs';
import { createExecutionCompiler } from '../lib/execution/compile-pure.mjs';

const kinds = ['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown'];
function typedFixture() {
  const { canonical, binding } = structuredClone(inventorySagaContract());
  const p = canonical.sagas[0].payload;
  p.schemaVersion = 'truthsrc.saga/v2';
  p.resilience = { mode: 'per-interaction', interactionTimeoutMs: 500, automaticPhaseAttempts: 1,
    recovery: 'explicit-authorized', maxReconcileInteractions: 16, totalDeadline: 'unsupported' };
  canonical.valueObjects = [{ name: 'ReservationResult', fields: [{ name: 'txid', dataType: 'TxId' }] }];
  canonical.ports = [{ schemaVersion: 'truthsrc.saga-result-port/v1', name: 'ReservationResults', version: 'v1',
    payloadType: 'ReservationResult', delivery: 'durable-keyed-terminal', query: 'read-only-original-identity' }];
  p.completions = kinds.map(kind => ({ kind, portRef: { name: 'ReservationResults', version: 'v1' },
    bindings: [{ slot: 'txid', ref: 'txid', type: 'TxId' }] }));
  binding.schemaVersion = 'truthsrc.saga-binding/v2';
  binding.sagas[0].engine.artifact = STRICT_SAGA_TARGET.artifact;
  return { canonical, binding };
}
const capabilities = ['positive-int-definition-version', 'static-participants', 'serial-all-tcc', 'fresh-canonical-args',
  'pinned-args-codec', 'pinned-phase-receipt-codecs', 'minor-unit-string-money', 'singleton-serial-barriers',
  'confirmed-receipt-context', 'fresh-receipt-decode', 'typed-result-port', 'explicit-authorized-recovery', 'per-interaction-timeout'];
function loweredFixture() {
  const input = typedFixture(), saga = input.canonical.sagas[0], binding = input.binding.sagas[0];
  return { ...input, runtimeBinding: { schemaVersion: 'truthsrc.saga-runtime-binding/v3',
    target: { ...STRICT_SAGA_TARGET, capabilities },
    sagas: [{ sagaId: saga.id, definitionVersion: saga.version, runtimeVersion: 1,
      argsCodec: { id: binding.codec.id, version: binding.codec.version, runtimeVersion: 1 },
      receiptCodecs: ['prepare', 'commit', 'compensate'].map(phase => ({ stepId: 'reserve-sku', phase,
        id: 'inventory-' + phase, version: 'receipt-v1', runtimeVersion: 1 })) }],
  } };
}
const ok = result => { assert.deepEqual(result.diagnostics, []); assert.ok(result.ir); return result.ir; };
const rejects = result => { assert.equal(result.ir, null); assert.ok(result.diagnostics.length); };

test('Saga v2 retains typed result closure and provenance without aggregate completion events', () => {
  const { canonical, binding } = typedFixture(), before = structuredClone({ canonical, binding });
  const ir = ok(compileSagas(canonical, binding));
  assert.equal(ir.schemaVersion, 'truthsrc.saga-ir/v2');
  assert.deepEqual(ir.sagas[0].resultPort.declaration, canonical.ports[0]);
  assert.deepEqual(ir.sagas[0].resultPort.payload, canonical.valueObjects[0]);
  assert.equal(ir.sourceMap['/sagas/0/resultPort/declaration'].pointer, '/ports/0');
  assert.equal(ir.sourceMap['/sagas/0/resultPort/payload/fields/0'].pointer, '/valueObjects/0/fields/0');
  assert.deepEqual({ canonical, binding }, before);
  assert.deepEqual(compileSagaProduct(canonical, binding).ir, ir);
});

test('legacy Saga compiler output and dispatch remain equal', () => {
  const { canonical, binding } = inventorySagaContract();
  assert.deepEqual(compileSagas(canonical, binding), compileSagasV1(canonical, binding));
  assert.deepEqual(compileSagasV1(canonical, binding), createSagaCompiler(sagaSchema)(canonical, binding));
  rejects(compileSagasV2(canonical, binding));
  const current = typedFixture();
  rejects(compileSagasV1(current.canonical, current.binding));
});

for (const [name, mutate] of [
  ['total deadline', x => { x.canonical.sagas[0].payload.resilience.totalTimeoutMs = 1000; }],
  ['automatic retry', x => { x.canonical.sagas[0].payload.resilience.automaticPhaseAttempts = 2; }],
  ['backoff', x => { x.canonical.sagas[0].payload.resilience.backoffMs = 20; }],
  ['unbound result port', x => { x.canonical.ports = []; }],
  ['duplicate result port', x => { x.canonical.ports.push(structuredClone(x.canonical.ports[0])); }],
  ['port version drift', x => { x.canonical.ports[0].version = 'v2'; }],
  ['result field mismatch', x => { x.canonical.valueObjects[0].fields[0].dataType = 'WarehouseId'; }],
  ['missing payload record', x => { x.canonical.valueObjects = []; }],
  ['unknown result binding', x => { x.canonical.sagas[0].payload.completions[0].bindings[0].ref = 'args:missing'; }],
  ['unsafe nonterminal receipt read', x => { x.canonical.sagas[0].payload.completions[4].bindings[0].ref = 'step:reserve-sku:commit:txid'; }],
  ['mixed payload version', x => { x.canonical.sagas[0].payload.schemaVersion = 'truthsrc.saga/v1'; }],
  ['no compensation', x => { x.canonical.sagas[0].payload.steps[0].phases.compensate = { kind: 'none', reason: 'read-only' }; }],
  ['concurrent admission', x => { x.canonical.sagas[0].payload.admission.maxInFlight = 2; }],
]) test('Saga v2 rejects ' + name, () => { const x = typedFixture(); mutate(x); rejects(compileSagas(x.canonical, x.binding)); });

test('result port declaration and payload participate in semantic digest', () => {
  const x = typedFixture(), first = ok(compileSagas(x.canonical, x.binding));
  x.canonical.valueObjects[0].description = 'explicit new result contract';
  const second = ok(compileSagas(x.canonical, x.binding));
  assert.notEqual(first.digest, second.digest);
});

test('version selection and Saga JSON validation do not execute accessors or proxy traps', () => {
  let calls = 0;
  const x = typedFixture();
  Object.defineProperty(x.binding, 'schemaVersion', { get() { calls++; return 'truthsrc.saga-binding/v2'; }, enumerable: true });
  rejects(compileSagas(x.canonical, x.binding));
  const proxy = new Proxy({}, { getPrototypeOf() { calls++; throw Error('trap'); }, getOwnPropertyDescriptor() { calls++; throw Error('trap'); } });
  rejects(compileSagas(x.canonical, proxy));
  assert.equal(calls, 0);
});

test('Saga runtime v4 binds original v2 contract and real fixed artifact without total-deadline claims', () => {
  const input = loweredFixture(), result = lowerSagaRuntimeBindingV4(input), ir = ok(result), s = ir.sagas[0];
  assert.equal(ir.schemaVersion, 'truthsrc.saga-runtime-contract/v4');
  assert.equal(ir.target.artifact, STRICT_SAGA_TARGET.artifact);
  assert.equal(ir.runnable, false);
  assert.deepEqual(s.coordinatorSettings, { interactionTimeoutMs: 500, maxReconcileInteractions: 16 });
  assert.equal(Object.hasOwn(s.hostRequirements, 'totalDeadline'), false);
  assert.deepEqual(s.completions.map(c => c.terminal), [true, true, true, false, false]);
  assert.deepEqual(s.contract.resultPort, ok(compileSagas(input.canonical, input.binding)).sagas[0].resultPort);
  assert.ok(s.definitionDigest.startsWith('sha256:'));
  rejects(lowerSagaRuntimeBindingV3(input));
});

for (const [name, mutate] of [
  ['artifact bytes', x => { x.runtimeBinding.target.artifactSha256 = '0'.repeat(64); }],
  ['artifact version', x => { x.runtimeBinding.target.artifact = 'net.imadz:saga-core_2.13:0.2'; }],
  ['codec version', x => { x.runtimeBinding.sagas[0].receiptCodecs[0].version = 'other'; }],
  ['codec omission', x => { x.runtimeBinding.sagas[0].receiptCodecs.pop(); }],
  ['capability omission', x => { x.runtimeBinding.target.capabilities = capabilities.slice(1); }],
]) test('Saga runtime v4 rejects ' + name, () => { const x = loweredFixture(); mutate(x); rejects(lowerSagaRuntimeBindingV4(x)); });

test('versioned JSON schema mirrors equal the live complete compiler schemas', () => {
  for (const [name, schema] of [['saga', sagaSchemaV2], ['execution', executionSchemaV2]])
    assert.deepEqual(JSON.parse(readFileSync(new URL('../schema/' + name + '-ir-v2.schema.json', import.meta.url), 'utf8')), schema);
});

test('v2 and runtime v4 preserve dotted codec identity without relaxing other identifiers', () => {
  const input = loweredFixture();
  input.binding.sagas[0].codec.id = 'inventory.request';
  input.runtimeBinding.sagas[0].argsCodec.id = 'inventory.request';
  for (const codec of input.runtimeBinding.sagas[0].receiptCodecs) codec.id = 'inventory.' + codec.phase;
  const ir = ok(lowerSagaRuntimeBindingV4(input));
  assert.equal(ir.sagas[0].args.runtimeCodec.id, 'inventory.request');
  for (const phase of ['prepare', 'commit', 'compensate'])
    assert.equal(ir.sagas[0].participants[0].phases[phase].runtimeCodec.id, 'inventory.' + phase);
  const old = structuredClone(inventorySagaContract());
  old.binding.sagas[0].codec.id = 'inventory.request';
  rejects(compileSagasV1(old.canonical, old.binding));
  const badVersion = structuredClone(input); badVersion.binding.sagas[0].codec.version = 'args.v1';
  rejects(compileSagas(badVersion.canonical, badVersion.binding));
  const badStep = structuredClone(input); badStep.runtimeBinding.sagas[0].receiptCodecs[0].stepId = 'reserve.sku';
  rejects(lowerSagaRuntimeBindingV4(badStep));
  const badType = typedFixture(); badType.binding.sagas[0].types[0].id = 'bad.type';
  rejects(compileSagas(badType.canonical, badType.binding));
  assert.equal(executionSchemaV2.$defs.invocationCodec.properties.id.$ref, 'saga-ir-v2.schema.json#/$defs/codecId');
  assert.equal(executionSchema.$defs.invocationCodec.properties.id.$ref, 'saga-ir-v1.schema.json#/$defs/id');
});

for (const id of ['inventory..request', '.inventory', 'inventory.', 'inventory/receipt', 'inventory.request\n', 'x'.repeat(129)])
  test('v2 rejects invalid codec identity ' + JSON.stringify(id), () => {
    const input = loweredFixture(); input.binding.sagas[0].codec.id = id;
    rejects(compileSagas(input.canonical, input.binding));
    const runtime = loweredFixture(); runtime.runtimeBinding.sagas[0].receiptCodecs[0].id = id;
    rejects(lowerSagaRuntimeBindingV4(runtime));
  });

test('execution v2 has fixed R2 mode and v2 Saga references while the old schema stays unchanged', () => {
  assert.equal(executionSchema.$defs.pipelineBinding.properties.engine.const, 'monarch-persistence/0.2.1');
  assert.equal(executionSchemaV2.$defs.pipelineBinding.properties.engine.const, 'monarch-persistence/0.3.0-dev.r2-20261106-dc168f96fa62');
  const compiler = createExecutionCompiler(executionSchemaV2, sagaSchemaV2, compileSagasV2);
  const ir = ok(compiler.compileExecution({ schemaVersion: 'truthsrc/v1', workshop: 'no executable pipelines' },
    { schemaVersion: 'truthsrc.execution-binding/v2', pipelines: [] }));
  assert.equal(ir.schemaVersion, 'truthsrc.execution/v2');
  assert.deepEqual(ir.pipelines, []);
});
