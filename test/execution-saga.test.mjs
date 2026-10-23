// SagaS7 contract-only closure. Synthetic in-memory pipelines augment the closed
// Saga fixtures; no tree edits, CLI, generation, runtime, or artifact certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileExecution, validateExecutionDeclarations } from '../lib/execution/compile.mjs';
import { compileSagas } from '../lib/saga/compile.mjs';
import { sagaContract, RESULT_KINDS } from './fixtures/saga-contract.mjs';

const clone = (value) => structuredClone(value);
const cp = '/pipelines/0';
const sp = `${cp}/steps/0/execution`;
const ip = `${sp}/invokeSaga`;
const ap = '/pipelines/0/invocations/0';
const sbp = '/sagaBindings/sagas/0';
const at = (value, pointer) => pointer.split('/').slice(1).reduce((node, key) => node[key], value);
const set = (value, pointer, entry) => {
  const end = pointer.lastIndexOf('/');
  at(value, pointer.slice(0, end))[pointer.slice(end + 1)] = entry;
};
const remove = (value, pointer) => {
  const end = pointer.lastIndexOf('/');
  delete at(value, pointer.slice(0, end))[pointer.slice(end + 1)];
};
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function fixture(domain = 'MoneyTransfer') {
  const { canonical, binding: sagaBindings } = sagaContract(domain);
  const saga = canonical.sagas[0];
  const technical = sagaBindings.sagas[0];
  const inputs = [
    { id: 'operation', type: 'OperationId', durability: 'start-record' },
    { id: 'occurrence', type: 'OperationId', durability: 'durable-reference' },
    ...saga.payload.args.map(({ slot, type }) => ({ id: slot, type, durability: 'start-record' })),
  ];
  const ref = { sagaId: saga.id, version: saga.version };
  const args = saga.payload.args.map(({ slot, type }) => ({ slot, ref: `input:${slot}`, type }));
  const kinds = ['success', 'business-rejection', 'business-rejection', 'infrastructure-failure', 'unknown-effect'];
  const codes = ['Succeeded', 'Rejected', 'Compensated', 'RecoveryRequired', 'Unknown'];
  const pipeline = {
    id: `${saga.id}-pipeline`, name: `${domain} synthetic invocation pipeline`,
    execution: {
      schemaVersion: 'truthsrc.execution/v1', inputs,
      outputs: [{ id: 'txid', ref: 'step:transfer:txid', type: 'TxId' }],
      recovery: {
        inputResponsibility: 'host', inputs: inputs.map(({ id }) => `input:${id}`),
        planVersion: 'plan-v1', planCompatibility: 'exact', checkpoint: 'confirmed-prefix',
        unknownEffect: 'reconcile-before-resume', ownership: 'single-writer',
      },
      admission: { maxConcurrentRuns: 2, maxInFlightSteps: 1, maxItemsPerChunk: 64, maxInFlightChunks: 2 },
    },
    steps: [{ id: 'transfer', name: 'Transfer via declared Saga', execution: {
      invokeSaga: {
        ref: clone(ref), args: clone(args),
        transactionIdentity: {
          type: 'TxId', derivation: 'durable-source-stage', source: { ref: 'input:operation', type: 'OperationId' },
          stageId: 'transfer', stageOccurrence: { ref: 'input:occurrence', type: 'OperationId' },
          scope: 'saga-version', conflict: 'reject-different-args',
        },
        start: 'durable-intent-before-start', completionMode: 'await-terminal',
        results: RESULT_KINDS.map((resultKind, index) => ({ resultKind, code: codes[index],
          outputs: index === 0 ? [{ slot: 'txid', ref: 'result:txid', type: 'TxId' }] : [] })),
      },
      reads: inputs.map(({ id, type }) => ({ slot: id, ref: `input:${id}`, type })),
      writes: [{ id: 'txid', slot: 'txid', type: 'TxId', durability: 'durable-reference' }],
      outcomes: codes.map((code, index) => ({ code, kind: kinds[index],
        action: index === 0 ? 'continue' : index < 3 ? 'stop' : 'manual-recovery' })),
    } }],
  };
  canonical.pipelines = [pipeline];
  const binding = {
    schemaVersion: 'truthsrc.execution-binding/v1', sagaBindings,
    pipelines: [{
      pipelineId: pipeline.id, engine: 'monarch-persistence/0.2.1', module: 'fixture.PipelineModule',
      codec: { id: 'PipelineCodec', version: 'pipeline-v1', compatibleVersions: ['pipeline-v1'] },
      types: technical.types.map(({ id, implementation }) => ({ id, implementation })), ports: [],
      invocations: [{ stepId: 'transfer', ref: clone(ref), adapter: 'fixture.StrictSagaAdapter',
        runtime: { artifact: technical.engine.artifact, apiMode: 'strict', entrypoint: technical.engine.entrypoint },
        argsCodec: { id: technical.codec.id, version: technical.codec.version, mapper: technical.codec.mapper },
        resultCodec: { id: 'SagaResultCodec', version: technical.codec.version, mapper: 'fixture.SagaResultCodec' },
        transactionIdentity: { mapper: 'fixture.DurableSourceStageIdentity', derivation: 'durable-source-stage', payloadCompatibility: 'exact' },
      }],
    }],
  };
  return { canonical, binding };
}
function success(data) {
  const result = compileExecution(data.canonical, data.binding);
  assert.deepEqual(result.diagnostics, []);
  assert.notEqual(result.ir, null);
  return result;
}
function failure(data, code, pointer, document = 'canonical') {
  const before = clone(data);
  freeze(data);
  const result = compileExecution(data.canonical, data.binding);
  assert.equal(result.ir, null, 'all errors discard the entire execution/Saga IR');
  const diagnostic = result.diagnostics.find((entry) => entry.code === code
    && entry.source.document === document && entry.source.pointer === pointer);
  assert.ok(diagnostic, `missing ${code} at ${document}${pointer}: ${JSON.stringify(result.diagnostics)}`);
  assert.deepEqual(data, before);
  assert.deepEqual(compileExecution(data.canonical, data.binding), result);
  return diagnostic;
}
function rejects(name, document, pointer, value, code = 'EXEC_SCHEMA') {
  test(name, () => {
    const data = fixture();
    set(data[document], pointer, clone(value));
    failure(data, code, pointer, document);
  });
}
function precedingPort(data) {
  const contract = data.canonical.pipelines[0].steps[0].execution;
  const port = { id: 'ReadArgs', implementation: 'fixture.ReadArgs', effect: 'pure', confirmation: 'checkpoint',
    idempotency: { mode: 'none' }, inputs: [{ slot: 'from', type: contract.invokeSaga.args[0].type }],
    outputs: [{ slot: 'from', type: contract.invokeSaga.args[0].type }, { slot: 'token', type: 'OperationId' }],
    outcomes: [{ code: 'Done', kind: 'success' }, { code: 'Failed', kind: 'infrastructure-failure' }],
  };
  data.binding.pipelines[0].ports.push(port);
  data.canonical.pipelines[0].steps.unshift({ id: 'read', name: 'Preceding pure contract', execution: {
    port: port.id, reads: [{ slot: 'from', ref: 'input:from', type: port.inputs[0].type }],
    writes: [
      { id: 'from', slot: 'from', type: port.inputs[0].type, durability: 'checkpoint' },
      { id: 'token', slot: 'token', type: 'OperationId', durability: 'durable-reference' },
    ],
    outcomes: port.outcomes.map(({ code, kind }) => ({ code, kind, action: kind === 'success' ? 'continue' : 'manual-recovery' })),
  } });
  return contract;
}
for (const domain of ['MoneyTransfer', 'Fab']) {
  test(`${domain}: closed canonical pipeline invokes independently compiled Saga, contract-only`, () => {
    const data = fixture(domain);
    const expectedSagas = compileSagas(data.canonical, data.binding.sagaBindings);
    assert.deepEqual(expectedSagas.diagnostics, []);
    const before = clone(data);
    freeze(data);
    const { ir } = success(data);
    assert.deepEqual(data, before);
    assert.deepEqual(ir.sagas, expectedSagas.ir.sagas);
    assert.deepEqual(ir.pipelines[0].steps[0], { id: 'transfer', name: data.canonical.pipelines[0].steps[0].name,
      ordinal: 0, ...data.canonical.pipelines[0].steps[0].execution });
    assert.deepEqual(ir.pipelines[0].binding.invocations, data.binding.pipelines[0].invocations);
    assert.equal(ir.pipelines[0].readiness, 'contract-only');
    assert.equal(ir.sagas[0].readiness, 'contract-only');
    assert.ok(!Object.hasOwn(ir.pipelines[0].steps[0], 'port'));
    assert.ok(!Object.hasOwn(ir.pipelines[0].binding, 'sagaBindings'));
    assert.ok(!Object.hasOwn(ir, 'digest'), 'no newly invented artifact certificate');
    assert.deepEqual(validateExecutionDeclarations(data.canonical.pipelines[0]), []);
    assert.deepEqual(compileExecution(clone(data.canonical), clone(data.binding)), { ir, diagnostics: [] });
  });
}
test('Saga args may use preceding step writes, exactly matching declared typed reads', () => {
  const data = fixture();
  const invocation = precedingPort(data);
  invocation.invokeSaga.args[0].ref = 'step:read:from';
  invocation.reads.find((read) => read.slot === 'from').ref = 'step:read:from';
  assert.equal(success(data).ir.pipelines[0].steps[0].port, 'ReadArgs');
});
test('optional iteration/chunk tokens are explicit stable durable initial references', () => {
  const data = fixture('Fab');
  const pipeline = data.canonical.pipelines[0];
  const technical = data.binding.sagaBindings.sagas[0];
  technical.types.push({ id: 'OccurrenceIndex', canonicalType: 'OccurrenceIndex', implementation: 'fixture.OccurrenceIndex',
    kind: 'integer', minimum: 0, maximum: 2147483647 });
  data.binding.pipelines[0].types.push({ id: 'OccurrenceIndex', implementation: 'fixture.OccurrenceIndex' });
  for (const [id, type] of [['iteration', 'OccurrenceIndex'], ['chunk', 'OperationId']]) {
    pipeline.execution.inputs.push({ id, type, durability: 'start-record' });
    pipeline.execution.recovery.inputs.push(`input:${id}`);
    pipeline.steps[0].execution.reads.push({ slot: id, ref: `input:${id}`, type });
    pipeline.steps[0].execution.invokeSaga.transactionIdentity[id] = { ref: `input:${id}`, type };
  }
  assert.deepEqual(success(data).ir.pipelines[0].steps[0].invokeSaga.transactionIdentity.iteration,
    { ref: 'input:iteration', type: 'OccurrenceIndex' });
});
test('explicit rejected/compensated manual outcomes are allowed, never implicit success', () => {
  const data = fixture();
  data.canonical.pipelines[0].steps[0].execution.outcomes[1].action = 'manual-recovery';
  data.canonical.pipelines[0].steps[0].execution.outcomes[2].action = 'manual-recovery';
  success(data);
});
test('standalone Saga products and pinned legacy narratives stay opaque without invocation opt-in', () => {
  const data = sagaContract();
  const narrative = JSON.parse(readFileSync(new URL('./fixtures/bank.canonical.json', import.meta.url), 'utf8'));
  data.canonical.pipelines = narrative.pipelines;
  const result = compileExecution(freeze(data.canonical));
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.pipelines, []);
  assert.equal(result.ir.documentOnly.length, narrative.pipelines.length);
  assert.ok(!Object.hasOwn(result.ir, 'sagas'));
});
test('explicit nested Saga document opts into full closure even without invoking pipelines', () => {
  const data = fixture();
  data.canonical.pipelines = [];
  data.binding.pipelines = [];
  assert.equal(success(data).ir.sagas.length, 1);
});
test('two invoking stages reuse one Saga definition, stable IDs not array ordinals', () => {
  const data = fixture();
  const pipeline = data.canonical.pipelines[0];
  const second = clone(pipeline.steps[0]);
  second.id = 'second-transfer';
  second.execution.invokeSaga.transactionIdentity.stageId = second.id;
  pipeline.steps.push(second);
  const adapter = clone(data.binding.pipelines[0].invocations[0]);
  adapter.stepId = second.id;
  data.binding.pipelines[0].invocations.push(adapter);
  const { ir } = success(data);
  assert.equal(ir.sagas.length, 1);
  assert.equal(ir.pipelines[0].binding.invocations.length, 2);
  assert.notEqual(ir.pipelines[0].steps[0].invokeSaga.transactionIdentity.stageId,
    ir.pipelines[0].steps[1].invokeSaga.transactionIdentity.stageId);
});

for (const [document, pointer] of [
  ['binding', '/sagaBindings'], ['binding', '/pipelines/0/invocations'], ['binding', ap],
  ['binding', `${ap}/ref`], ['binding', `${ap}/runtime`], ['binding', `${ap}/argsCodec`],
  ['binding', `${ap}/resultCodec`], ['binding', `${ap}/transactionIdentity`],
  ['canonical', ip], ['canonical', `${ip}/ref`], ['canonical', `${ip}/args/0`],
  ['canonical', `${ip}/transactionIdentity`], ['canonical', `${ip}/transactionIdentity/source`],
  ['canonical', `${ip}/results/0`], ['canonical', `${ip}/results/0/outputs/0`],
]) {
  if (pointer.endsWith('/invocations')) continue;
  rejects(`unknown field is fail-closed at ${document}${pointer}`, document, `${pointer}/unsupported`, true);
}
for (const [document, pointer] of [
  ...['ref', 'args', 'transactionIdentity', 'start', 'completionMode', 'results'].map((key) => ['canonical', `${ip}/${key}`]),
  ...['sagaId', 'version'].map((key) => ['canonical', `${ip}/ref/${key}`]),
  ...['type', 'derivation', 'source', 'stageId', 'stageOccurrence', 'scope', 'conflict'].map((key) => ['canonical', `${ip}/transactionIdentity/${key}`]),
  ...['ref', 'type'].map((key) => ['canonical', `${ip}/transactionIdentity/source/${key}`]),
  ...['resultKind', 'code', 'outputs'].map((key) => ['canonical', `${ip}/results/0/${key}`]),
  ...['slot', 'ref', 'type'].map((key) => ['canonical', `${ip}/args/0/${key}`]),
  ...['slot', 'ref', 'type'].map((key) => ['canonical', `${ip}/results/0/outputs/0/${key}`]),
  ...['stepId', 'ref', 'adapter', 'runtime', 'argsCodec', 'resultCodec', 'transactionIdentity'].map((key) => ['binding', `${ap}/${key}`]),
  ...['artifact', 'apiMode', 'entrypoint'].map((key) => ['binding', `${ap}/runtime/${key}`]),
  ...['id', 'version', 'mapper'].flatMap((key) => ['argsCodec', 'resultCodec'].map((codec) => ['binding', `${ap}/${codec}/${key}`])),
  ...['mapper', 'derivation', 'payloadCompatibility'].map((key) => ['binding', `${ap}/transactionIdentity/${key}`]),
]) {
  test(`required Saga field ${document}${pointer} cannot be omitted`, () => {
    const data = fixture();
    remove(data[document], pointer);
    failure(data, 'EXEC_SCHEMA', pointer, document);
  });
}
for (const [document, pointer, value] of [
  ['binding', '/sagaBindings', null], ['binding', '/sagaBindings/schemaVersion', 'truthsrc.saga-binding/v2'],
  ['binding', '/pipelines/0/invocations', []], ['binding', `${ap}/adapter`, 'adapter()'],
  ['binding', `${ap}/runtime/apiMode`, 'legacy'], ['binding', `${ap}/runtime/artifact`, 'saga-core'],
  ['binding', `${ap}/transactionIdentity/derivation`, 'random'], ['binding', `${ap}/transactionIdentity/payloadCompatibility`, 'compatible'],
  ['canonical', ip, null], ['canonical', `${ip}/ref/sagaId`, 'unknown()'],
  ['canonical', `${ip}/start`, 'start-before-intent'], ['canonical', `${ip}/completionMode`, 'fire-and-forget'],
  ['canonical', `${ip}/args`, []], ['canonical', `${ip}/args/0/ref`, 'source:from'],
  ['canonical', `${ip}/args/0/ref`, 'input:from + expr()'], ['canonical', `${ip}/results`, []],
  ['canonical', `${ip}/results/0/resultKind`, 'new-result'], ['canonical', `${ip}/results/0/outputs/0/ref`, 'args:from'],
  ['canonical', `${ip}/transactionIdentity/derivation`, 'host.IdentityFQN'],
  ['canonical', `${ip}/transactionIdentity/source/ref`, 'Date.now()'],
  ['canonical', `${ip}/transactionIdentity/scope`, 'attempt'], ['canonical', `${ip}/transactionIdentity/conflict`, 'accept'],
  ['canonical', `${ip}/transactionIdentity/iteration`, null],
]) rejects(`unsupported Saga shape ${document}${pointer}: ${JSON.stringify(value)}`, document, pointer, value);

test('port and invokeSaga are strict mutually exclusive discriminator properties', () => {
  const data = fixture();
  set(data.canonical, `${sp}/port`, 'PretendPurePort');
  const errors = validateExecutionDeclarations(data.canonical.pipelines[0]);
  assert.ok(errors.some((entry) => entry.pointer === '/steps/0/execution/invokeSaga'));
  failure(data, 'EXEC_SCHEMA', ip);
});
test('neither step variant is not silently documentation', () => {
  const data = fixture();
  remove(data.canonical, ip);
  failure(data, 'EXEC_SCHEMA', `${sp}/port`);
});
rejects('an invocation cannot claim pure effect', 'canonical', `${sp}/effect`, 'pure');
rejects('an adapter is not a pure port either', 'binding', `${ap}/effect`, 'pure');
test('binding omitted for invoking pipeline is fail-closed', () => {
  const data = fixture();
  delete data.binding;
  failure(data, 'EXEC_BINDING_MISSING', '/pipelines/0/execution');
});
test('no nested Saga binding is not an implicit trigger binding fallback', () => {
  const data = fixture();
  delete data.binding.sagaBindings;
  failure(data, 'EXEC_SAGA_BINDING_MISSING', '/sagaBindings', 'binding');
});
test('nested Saga binding list cannot omit the invoked definition', () => {
  const data = fixture();
  data.binding.sagaBindings.sagas = [];
  failure(data, 'SAGA_BINDING_MISSING', '/sagas/0');
});
test('missing adapter binding does not fall back to an ordinary port', () => {
  const data = fixture();
  precedingPort(data);
  delete data.binding.pipelines[0].invocations;
  failure(data, 'EXEC_SAGA_INVOCATION_MISSING', '/pipelines/0/steps/1/execution/invokeSaga');
});
rejects('adapter for nonexistent stage is orphaned', 'binding', `${ap}/stepId`, 'missing', 'EXEC_SAGA_INVOCATION_ORPHAN');
test('adapter cannot target ordinary port stage', () => {
  const data = fixture();
  precedingPort(data);
  data.binding.pipelines[0].invocations[0].stepId = 'read';
  failure(data, 'EXEC_SAGA_INVOCATION_ORPHAN', `${ap}/stepId`, 'binding');
});
rejects('nested Saga binding cannot be orphaned', 'binding', `${sbp}/sagaId`, 'missing', 'SAGA_BINDING_ORPHAN');
rejects('nested binding version must match definition', 'binding', `${sbp}/version`, 'v2', 'SAGA_VERSION');
rejects('invoke ref must resolve a known Saga', 'canonical', `${ip}/ref/sagaId`, 'missing', 'EXEC_SAGA_UNKNOWN');
rejects('invoke ref version must exactly match definition', 'canonical', `${ip}/ref/version`, 'v2', 'EXEC_SAGA_VERSION');
for (const [key, value] of [['sagaId', 'missing'], ['version', 'v2']]) {
  rejects(`adapter ref ${key} must match invoke ref`, 'binding', `${ap}/ref/${key}`, value, 'EXEC_SAGA_ADAPTER_REF');
}
for (const [key, value] of [['artifact', 'net.imadz:saga-core:unknown'], ['entrypoint', 'fixture.OtherEntry']]) {
  rejects(`adapter runtime ${key} exactly pins independently compiled Saga`, 'binding', `${ap}/runtime/${key}`, value, 'EXEC_SAGA_RUNTIME');
}
for (const [key, value] of [['id', 'OtherCodec'], ['version', 'codec-v2'], ['mapper', 'fixture.OtherCodec']]) {
  rejects(`args codec ${key} mismatch is rejected`, 'binding', `${ap}/argsCodec/${key}`, value, 'EXEC_SAGA_CODEC');
}
rejects('compatible is not exact result codec version', 'binding', `${ap}/resultCodec/version`, 'codec-v2', 'EXEC_SAGA_CODEC');
rejects('nested pinned codec must include current version', 'binding', `${sbp}/codec/compatibleVersions`, ['old-version'], 'SAGA_CODEC_VERSION');
rejects('shared nominal types cannot use different implementations', 'binding', '/pipelines/0/types/1/implementation', 'fixture.OtherOperationId', 'EXEC_SAGA_TYPE_IMPLEMENTATION');
rejects('arg mapping type must exactly match its source and Saga declaration', 'canonical', `${ip}/args/0/type`, 'OperationId', 'EXEC_TYPE_MISMATCH');
rejects('identity transaction type must equal Saga transaction type', 'canonical', `${ip}/transactionIdentity/type`, 'OperationId', 'EXEC_TYPE_MISMATCH');
rejects('identity stable type does not mean any bound type', 'canonical', `${ip}/transactionIdentity/stageOccurrence/type`, 'Money', 'EXEC_SAGA_IDENTITY_TYPE');
rejects('identity source token may not be Money', 'canonical', `${ip}/transactionIdentity/source/type`, 'Money', 'EXEC_SAGA_IDENTITY_TYPE');
rejects('stage identity must be stable declared stage ID', 'canonical', `${ip}/transactionIdentity/stageId`, 'other', 'EXEC_SAGA_STAGE_ID');
test('a string-bound ID-shaped token still is not a stable identity type', () => {
  const data = fixture();
  const type = { id: 'StringToken', canonicalType: 'StringToken', implementation: 'fixture.StringToken',
    kind: 'string', minLength: 1, maxLength: 128 };
  data.binding.sagaBindings.sagas[0].types.push(type);
  data.binding.pipelines[0].types.push({ id: type.id, implementation: type.implementation });
  data.canonical.pipelines[0].execution.inputs[1].type = type.id;
  data.canonical.pipelines[0].steps[0].execution.reads[1].type = type.id;
  data.canonical.pipelines[0].steps[0].execution.invokeSaga.transactionIdentity.stageOccurrence.type = type.id;
  failure(data, 'EXEC_SAGA_IDENTITY_TYPE', `${ip}/transactionIdentity/stageOccurrence/type`);
});
test('negative integer occurrence tokens cannot declare stable identity', () => {
  const data = fixture();
  const type = { id: 'OccurrenceIndex', canonicalType: 'OccurrenceIndex', implementation: 'fixture.OccurrenceIndex',
    kind: 'integer', minimum: -1, maximum: 100 };
  data.binding.sagaBindings.sagas[0].types.push(type);
  data.binding.pipelines[0].types.push({ id: type.id, implementation: type.implementation });
  data.canonical.pipelines[0].execution.inputs[1].type = type.id;
  data.canonical.pipelines[0].steps[0].execution.reads[1].type = type.id;
  data.canonical.pipelines[0].steps[0].execution.invokeSaga.transactionIdentity.stageOccurrence.type = type.id;
  failure(data, 'EXEC_SAGA_IDENTITY_TYPE', `${ip}/transactionIdentity/stageOccurrence/type`);
});
for (const key of ['source', 'stageOccurrence', 'iteration', 'chunk']) {
  test(`identity ${key} cannot reference even a durable preceding write`, () => {
    const data = fixture();
    const contract = precedingPort(data);
    const identity = contract.invokeSaga.transactionIdentity;
    identity[key] = { ref: 'step:read:token', type: 'OperationId' };
    const slot = key === 'source' ? 'operation' : key === 'stageOccurrence' ? 'occurrence' : key;
    const read = contract.reads.find((entry) => entry.slot === slot);
    if (read) read.ref = 'step:read:token';
    else contract.reads.push({ slot, ...identity[key] });
    failure(data, 'EXEC_SAGA_IDENTITY_SOURCE', `/pipelines/0/steps/1/execution/invokeSaga/transactionIdentity/${key}/ref`);
  });
}
rejects('identity input ref must exist', 'canonical', `${ip}/transactionIdentity/source/ref`, 'input:missing', 'EXEC_REF_UNKNOWN');
rejects('args cannot forward-reference this stage writes', 'canonical', `${ip}/args/0/ref`, 'step:transfer:txid', 'EXEC_REF_FORWARD');
rejects('args unknown ref fails closed', 'canonical', `${ip}/args/0/ref`, 'input:missing', 'EXEC_REF_UNKNOWN');
test('args cannot forward-reference a later stage', () => {
  const data = fixture();
  const contract = precedingPort(data);
  data.canonical.pipelines[0].steps.reverse();
  contract.invokeSaga.args[0].ref = 'step:read:from';
  contract.reads.find((entry) => entry.slot === 'from').ref = 'step:read:from';
  failure(data, 'EXEC_REF_FORWARD', `${ip}/args/0/ref`);
});
test('arg mappings cannot leave unconsumed step reads', () => {
  const data = fixture();
  set(data.canonical, `${ip}/args/0/ref`, 'input:to');
  failure(data, 'EXEC_SAGA_READ_UNUSED', `${sp}/reads/2/slot`);
});
test('valid source but absent read is rejected', () => {
  const data = fixture();
  data.canonical.pipelines[0].steps[0].execution.reads = data.canonical.pipelines[0].steps[0].execution.reads.filter((read) => read.slot !== 'from');
  failure(data, 'EXEC_SAGA_READ_MAPPING', `${ip}/args/0/ref`);
});
test('all Saga args require explicit mappings', () => {
  const data = fixture();
  data.canonical.pipelines[0].steps[0].execution.invokeSaga.args.pop();
  failure(data, 'EXEC_SAGA_ARG_COVERAGE', `${ip}/args`);
});
rejects('undeclared Saga arg is not extra adapter data', 'canonical', `${ip}/args/0/slot`, 'extra', 'EXEC_SAGA_ARG_COVERAGE');
for (const [document, pointer, key] of [
  ['binding', '/pipelines/0/invocations', 'stepId'], ['canonical', `${ip}/args`, 'slot'],
  ['canonical', `${ip}/results`, 'resultKind'], ['canonical', `${ip}/results`, 'code'],
  ['canonical', `${ip}/results/0/outputs`, 'slot'],
]) {
  test(`duplicate Saga ${key} at ${document}${pointer} fails closed`, () => {
    const data = fixture();
    const rows = at(data[document], pointer);
    const duplicate = clone(rows[0]);
    if (pointer.endsWith('/results')) {
      const changed = clone(rows[1]);
      changed[key] = duplicate[key];
      rows[1] = changed;
      failure(data, 'EXEC_DUPLICATE', `${pointer}/1/${key}`, document);
    } else {
      rows.push(duplicate);
      failure(data, 'EXEC_DUPLICATE', `${pointer}/${rows.length - 1}/${key}`, document);
    }
  });
}
for (const [index, kind] of RESULT_KINDS.entries()) {
  if (index === 0) continue;
  rejects(`${kind} cannot continue`, 'canonical', `${sp}/outcomes/${index}/action`, 'continue', 'EXEC_OUTCOME_ACTION');
  rejects(`${kind} cannot be success`, 'canonical', `${sp}/outcomes/${index}/kind`, 'success', 'EXEC_SAGA_RESULT_KIND');
  rejects(`${kind} cannot be resolved without an implemented explicit policy`, 'canonical', `${sp}/outcomes/${index}/kind`, 'resolved', 'EXEC_SAGA_RESULT_KIND');
}
for (const index of [3, 4]) rejects(`${RESULT_KINDS[index]} cannot stop as terminal rejection`, 'canonical', `${sp}/outcomes/${index}/action`, 'stop', 'EXEC_OUTCOME_ACTION');
rejects('compensated resolvedPolicyRef is unsupported v1, not a fake resolved-success', 'canonical', `${ip}/results/2/resolvedPolicyRef`, 'policy-id');
rejects('rejected policy action is unsupported', 'canonical', `${sp}/outcomes/1/action`, 'resolved-policy');
rejects('result output ref must resolve typed completion field', 'canonical', `${ip}/results/0/outputs/0/ref`, 'result:missing', 'EXEC_SAGA_RESULT_REF');
rejects('result output type must exactly match completion and write', 'canonical', `${ip}/results/0/outputs/0/type`, 'OperationId', 'EXEC_TYPE_MISMATCH');
rejects('result output cannot invent a write', 'canonical', `${ip}/results/0/outputs/0/slot`, 'extra', 'EXEC_SAGA_RESULT_OUTPUT');
rejects('successful completion cannot omit a required write', 'canonical', `${ip}/results/0/outputs`, [], 'EXEC_SAGA_RESULT_OUTPUT');
rejects('noncontinuing Saga result cannot publish success writes', 'canonical', `${ip}/results/2/outputs`, [{ slot: 'txid', ref: 'result:txid', type: 'TxId' }], 'EXEC_SAGA_RESULT_OUTPUT');
rejects('result code must map to an explicit outcome', 'canonical', `${ip}/results/0/code`, 'missing', 'EXEC_SAGA_RESULT_COVERAGE');
test('every step outcome must be consumed by result mapping', () => {
  const data = fixture();
  data.canonical.pipelines[0].steps[0].execution.outcomes.push({ code: 'extra', kind: 'business-rejection', action: 'stop' });
  failure(data, 'EXEC_SAGA_RESULT_COVERAGE', `${sp}/outcomes/5/code`);
});
test('five mappings cannot hide a missing result behind a duplicate', () => {
  const data = fixture();
  data.canonical.pipelines[0].steps[0].execution.invokeSaga.results[4].resultKind = 'compensated';
  failure(data, 'EXEC_SAGA_RESULT_COVERAGE', `${ip}/results`);
});
test('unknown Saga still checks bad args, identity and unknown outcome actions', () => {
  const data = fixture();
  set(data.canonical, `${ip}/ref/sagaId`, 'missing');
  set(data.canonical, `${ip}/args/0/ref`, 'input:missing');
  set(data.canonical, `${ip}/transactionIdentity/source/ref`, 'step:transfer:txid');
  set(data.canonical, `${sp}/outcomes/4/action`, 'continue');
  const result = compileExecution(freeze(data.canonical), freeze(data.binding));
  assert.equal(result.ir, null);
  for (const code of ['EXEC_SAGA_UNKNOWN', 'EXEC_REF_UNKNOWN', 'EXEC_SAGA_IDENTITY_SOURCE', 'EXEC_OUTCOME_ACTION']) {
    assert.ok(result.diagnostics.some((entry) => entry.code === code), code);
  }
});
test('Saga semantics are actually compiled, not merely ref-checked', () => {
  const data = fixture();
  data.canonical.sagas[0].payload.steps[0].phases.commit.commandRef.name = 'missing';
  failure(data, 'SAGA_REFERENCE_UNKNOWN', '/sagas/0/payload/steps/0/phases/commit/commandRef/name');
});
test('an unused invalid definition also discards all pipelines and narrative IR', () => {
  const data = fixture();
  const other = sagaContract('Fab');
  other.canonical.sagas[0].seq = 1;
  data.canonical.aggregates.push(...other.canonical.aggregates);
  data.canonical.sagas.push(...other.canonical.sagas);
  data.binding.sagaBindings.sagas.push(...other.binding.sagas);
  data.canonical.sagas[1].payload.safety.unknown = 'continue';
  data.canonical.pipelines.push({ id: 'narrative', name: 'Narrative', steps: [{ id: 'one', name: 'One' }] });
  failure(data, 'SAGA_SCHEMA', '/sagas/1/payload/safety/unknown');
});

test('every execution/Saga IR value has precise original provenance, including sorted definitions', () => {
  const data = fixture();
  const other = sagaContract('Fab');
  data.canonical.sagas[0].seq = 9;
  data.canonical.aggregates.push(...other.canonical.aggregates);
  data.canonical.sagas.push(...other.canonical.sagas);
  data.binding.sagaBindings.sagas.push(...other.binding.sagas);
  data.canonical.pipelines.unshift({ id: 'narrative', name: 'Narrative', steps: [{ id: 'one', name: 'One' }] });
  const { ir } = success(data);
  assert.equal(ir.sourceMap['/pipelines/0/steps/0/invokeSaga/ref/version'].pointer,
    '/pipelines/1/steps/0/execution/invokeSaga/ref/version');
  assert.equal(ir.sourceMap['/sagas/0/definition/id'].pointer, '/sagas/1/id');
  assert.equal(ir.sourceMap['/sagas/1/binding/engine/artifact'].pointer, `${sbp}/engine/artifact`);
  assert.equal(ir.sourceMap['/pipelines/0/binding/invocations/0/argsCodec/version'].document, 'binding');
  const visit = (value, pointer = '') => {
    assert.ok(Object.hasOwn(ir.sourceMap, pointer), `unmapped ${pointer}`);
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (!pointer && key === 'sourceMap') continue;
        visit(item, `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
      }
    }
  };
  visit(ir);
});
test('nested hints, related diagnostics and outer exact overrides rebase actual binding paths', () => {
  const data = fixture();
  data.binding.sagaBindings.sourceMap = {
    binding: { '/sagas/0/codec': { file: 'saga.binding.json', path: '/technical/codec', location: { line: 12, column: 2 } } },
    canonical: { '/sagas/0': { file: 'money-transfer.saga.yaml', path: '/payload', atom: 'money-transfer' } },
  };
  data.binding.sourceMap = { binding: {
    [`${ap}/argsCodec/version`]: { file: 'execution.binding.json', path: '/adapter/args/version', location: { line: 7, column: 3 } },
  } };
  set(data.binding, `${ap}/argsCodec/version`, 'codec-v2');
  const diagnostic = failure(data, 'EXEC_SAGA_CODEC', `${ap}/argsCodec/version`, 'binding');
  assert.deepEqual(diagnostic.source, { document: 'binding', pointer: `${ap}/argsCodec/version`,
    file: 'execution.binding.json', atom: null, path: '/adapter/args/version', location: { line: 7, column: 3 } });
  assert.deepEqual(diagnostic.related[0], { document: 'binding', pointer: `${sbp}/codec/version`,
    file: 'saga.binding.json', atom: null, path: '/technical/codec/version', location: { line: 12, column: 2 } });
});
test('compileSagas diagnostics and related sources point to nested document, not fabricated top-level binding', () => {
  const data = fixture();
  data.binding.sagaBindings.sourceMap = { binding: {
    '/sagas/0': { file: 'saga.json', path: '/technical', location: { line: 8, column: 1 } },
  } };
  set(data.binding, `${sbp}/version`, 'v2');
  const diagnostic = failure(data, 'SAGA_VERSION', `${sbp}/version`, 'binding');
  assert.equal(diagnostic.source.path, '/technical/version');
  assert.equal(diagnostic.source.file, 'saga.json');
  assert.equal(diagnostic.related[0].pointer, '/sagas/0/version');
});
test('invalid nested hints are rejected and never trusted', () => {
  const data = fixture();
  data.binding.sagaBindings.sourceMap = { binding: { '/sagas/0': { file: 'saga.json', location: { line: 0, column: 1 } } } };
  const diagnostic = failure(data, 'EXEC_SCHEMA', '/sagaBindings/sourceMap/binding/~1sagas~10/location/line', 'binding');
  assert.equal(diagnostic.source.file, null);
});
test('success never borrows definition, binding, invocation or hint containers', () => {
  const data = fixture();
  data.binding.sagaBindings.sourceMap = { binding: { '/sagas/0': { file: 'saga.json', location: { line: 8, column: 1 } } } };
  const result = success(data);
  const expected = clone(result);
  const inputs = new Set();
  const visit = (value, fn) => {
    if (value && typeof value === 'object') { fn(value); Object.values(value).forEach((item) => visit(item, fn)); }
  };
  visit(data, (value) => inputs.add(value));
  visit(result, (value) => assert.ok(!inputs.has(value)));
  data.canonical.sagas[0].payload.purpose = 'mutated';
  data.binding.sagaBindings.sagas[0].codec.version = 'mutated';
  data.binding.pipelines[0].invocations[0].argsCodec.mapper = 'mutated';
  data.binding.sagaBindings.sourceMap.binding['/sagas/0'].location.line = 999;
  assert.deepEqual(result, expected);
});
test('empty closure anchors derived sagas to the real nested binding collection', () => {
  const data = { canonical: { schemaVersion: 'truthsrc/v1', workshop: 'Empty closure' },
    binding: { schemaVersion: 'truthsrc.execution-binding/v1', pipelines: [],
      sagaBindings: { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [] } } };
  const { ir } = success(data);
  assert.deepEqual(ir.sagas, []);
  assert.equal(ir.sourceMap['/sagas'].document, 'binding');
  assert.equal(ir.sourceMap['/sagas'].pointer, '/sagaBindings/sagas');
});
test('malformed explicit invokeSaga reports that variant, not an unsupported port declaration', () => {
  const data = fixture();
  set(data.canonical, ip, {});
  failure(data, 'EXEC_SCHEMA', `${ip}/ref`);
  const diagnostics = validateExecutionDeclarations(data.canonical.pipelines[0]);
  assert.ok(diagnostics.some((entry) => entry.pointer === '/steps/0/execution/invokeSaga/transactionIdentity'));
  assert.ok(diagnostics.every((entry) => entry.pointer !== '/steps/0/execution/port'));
});
test('args substitution preserves static participant resource non-aliasing', () => {
  const data = fixture();
  set(data.canonical, `${ip}/args/1/ref`, 'input:from');
  data.canonical.pipelines[0].steps[0].execution.reads = data.canonical.pipelines[0].steps[0].execution.reads.filter((read) => read.slot !== 'to');
  failure(data, 'EXEC_SAGA_RESOURCE_ALIAS', `${ip}/args/1/ref`);
});
for (const [domain, typeId] of [['MoneyTransfer', 'OperationId'], ['Fab', 'WaferId']]) {
  test(`${domain}: independently valid Saga bindings cannot conflict on shared root or transitive element types`, () => {
    const data = fixture(domain);
    const other = clone(data.canonical.sagas[0]);
    other.id = 'second-saga';
    other.seq = 1;
    data.canonical.sagas.push(other);
    const technical = clone(data.binding.sagaBindings.sagas[0]);
    technical.sagaId = other.id;
    const typeOrdinal = technical.types.findIndex((type) => type.id === typeId);
    technical.types[typeOrdinal].maxLength = 64;
    data.binding.sagaBindings.sagas.push(technical);
    assert.deepEqual(compileSagas(data.canonical, data.binding.sagaBindings).diagnostics, []);
    const second = clone(data.canonical.pipelines[0].steps[0]);
    second.id = 'second-transfer';
    second.execution.invokeSaga.ref.sagaId = other.id;
    second.execution.invokeSaga.transactionIdentity.stageId = second.id;
    data.canonical.pipelines[0].steps.push(second);
    const adapter = clone(data.binding.pipelines[0].invocations[0]);
    adapter.stepId = second.id;
    adapter.ref.sagaId = other.id;
    data.binding.pipelines[0].invocations.push(adapter);
    const diagnostic = failure(data, 'EXEC_SAGA_TYPE_CONTRACT', `/sagaBindings/sagas/1/types/${typeOrdinal}`, 'binding');
    assert.equal(diagnostic.related[0].pointer, `${sbp}/types/${typeOrdinal}`);
  });
}
test('two pipelines with local stage IDs retain a declared pipeline identity namespace', () => {
  const data = fixture();
  const second = clone(data.canonical.pipelines[0]);
  second.id = 'second-pipeline';
  data.canonical.pipelines.push(second);
  const binding = clone(data.binding.pipelines[0]);
  binding.pipelineId = second.id;
  data.binding.pipelines.push(binding);
  const { ir } = success(data);
  assert.equal(ir.sagas.length, 1);
  assert.equal(ir.pipelines[0].steps[0].id, ir.pipelines[1].steps[0].id);
  assert.notEqual(ir.pipelines[0].id, ir.pipelines[1].id);
  const schema = JSON.parse(readFileSync(new URL('../schema/execution-ir-v1.schema.json', import.meta.url), 'utf8'));
  assert.match(schema.$defs.transactionIdentity.description, /pipeline ID \(the enclosing pipeline\.id\)/);
});
test('Saga-invalid nested hint bounds never control execution diagnostics', () => {
  const data = fixture();
  data.binding.sagaBindings.sourceMap = { binding: {
    '': { file: 'untrusted.json', location: { line: 2147483648, column: 1 } },
  } };
  const diagnostic = failure(data, 'EXEC_SCHEMA', '/sagaBindings/sourceMap/binding//location/line', 'binding');
  assert.equal(diagnostic.source.file, null);
  assert.equal(diagnostic.source.location, null);
});
test('new external refs/keyword inventory includes only implemented strict Saga schema features', () => {
  const schemas = ['execution', 'saga'].map((name) => JSON.parse(readFileSync(new URL(`../schema/${name}-ir-v1.schema.json`, import.meta.url), 'utf8')));
  const seen = new Set();
  const visit = (contract) => {
    for (const [key, entry] of Object.entries(contract)) {
      seen.add(key);
      if (key === '$defs' || key === 'properties') Object.values(entry).forEach(visit);
      else if (key === 'oneOf') entry.forEach(visit);
      else if (['items', 'additionalProperties', 'propertyNames'].includes(key) && entry && typeof entry === 'object') visit(entry);
      if (key === '$ref') {
        const prefix = 'saga-ir-v1.schema.json#/$defs/';
        const root = entry.startsWith(prefix) ? schemas[1] : schemas.find((schema) => schema.$defs[entry.slice(8)]);
        assert.ok(root?.$defs[entry.startsWith(prefix) ? entry.slice(prefix.length) : entry.slice(8)]);
      }
    }
  };
  schemas.forEach(visit);
  assert.deepEqual([...seen].sort(), [
    '$schema', '$id', '$ref', '$defs', 'title', 'description', 'type', 'const', 'enum', 'oneOf',
    'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'minItems', 'maxItems', 'uniqueItems',
    'items', 'required', 'properties', 'propertyNames', 'additionalProperties',
  ].sort());
});
