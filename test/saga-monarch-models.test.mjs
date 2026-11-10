import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../generators/scala-cqrs-saga-monarch-v1/generator.json' with { type: 'json' };
import { buildModels, productFootprint, resolveSagaMonarchTarget } from '../generators/scala-cqrs-saga-monarch-v1/build-models.mjs';
import { render } from '../generators/scala-cqrs-saga-monarch-v1/render.mjs';
import { generate } from '../generators/scala-cqrs-saga-monarch-v1/generate.mjs';
import { profileFor } from '../lib/products/registry.mjs';
import { STRICT_SAGA_TARGET, MONARCH_R2_ARTIFACTS } from '../lib/saga/runtime-targets.mjs';
import { validateCodeMappings } from '../src/core/code-mappings.mjs';
import { createExecutionCompiler } from '../lib/execution/compile-pure.mjs';
import { createSagaCompiler } from '../lib/saga/compile-pure.mjs';
import { executionSchemaV2, sagaSchemaV2 } from '../lib/products/contract-schemas-v2.mjs';

// Deliberately NOT a compilation fixture or a successful generation receipt.
// These minimal structural payloads exercise pure lowering/rendering only. Main's
// public compiler/scaffold tests must supply genuine compilation and live capture.
function modelFixture() {
  const context = 'reservation', ref = (kind, id, owner = []) => ({ context, kind, id, owner });
  const source = pointer => ({ document: 'author', pointer });
  const declarations = [];
  function declaration(kind, id, valueType = null, owner = [], pointer = '/types/' + id) {
    const d = { ref: ref(kind, id, owner), source: source(pointer), valueType, dependencies: [] };
    declarations.push(d); return d;
  }
  const aliases = {};
  for (const [name, type] of [['RequestId', 'string'], ['Warehouse', 'string'], ['Sku', 'string'], ['Quantity', 'integer'], ['TransactionId', 'string']])
    aliases[name] = declaration('type', name, { form: 'primitive', name: type });
  const nominal = name => ({ form: 'nominal', ref: aliases[name].ref });
  const slots = { requestId: 'requestId', resourceA: 'warehouseA', resourceB: 'warehouseB', subject: 'sku', quantity: 'quantity' };
  const fieldTypes = ['RequestId', 'Warehouse', 'Warehouse', 'Sku', 'Quantity'];
  const fields = Object.values(slots).map((slot, i) => declaration('member', slot, nominal(fieldTypes[i]), ['ReservationRequest'], '/types/ReservationRequest/fields/' + i));
  const request = declaration('type', 'ReservationRequest', { form: 'record', members: fields.map(f => f.ref) });
  aliases.ReservationRequest = request;
  const resultFields = [declaration('member', 'transactionId', nominal('TransactionId'), ['ReservationResult']),
    declaration('member', 'originalRequest', nominal('ReservationRequest'), ['ReservationResult'])];
  const resultType = declaration('type', 'ReservationResult', { form: 'record', members: resultFields.map(f => f.ref) });
  const roles = { participant: 'WarehouseParticipant', association: 'AssociationPort', result: 'ReservationResultPort', evidence: 'EvidenceValidator', executionEvidence: 'ExecutionEvidencePort', recoveryAuthorization: 'RecoveryAuthorization' };
  const ports = Object.entries(roles).map(([role, name]) => ({ role, ...declaration('port', name), version: '1' }));
  const sagaRef = declaration('saga', 'reservation-saga', null, [], '/sagas/0');
  const types = Object.keys(aliases).filter(n => n !== 'ReservationRequest').map(name => ({ id: name, canonicalType: name, kind: name === 'Quantity' ? 'integer' : 'id', ...(name === 'Quantity' ? { minimum: 1, maximum: 2147483647 } : { minLength: 1, maxLength: 256 }) }));
  types.push({ id: 'receipt-handle', kind: 'id', canonicalType: 'String', minLength: 1, maxLength: 256 });
  const args = fields.map((f, i) => ({ slot: f.ref.id, type: fieldTypes[i] }));
  types.push({ id: request.ref.id, kind: 'value-object', canonicalType: request.ref.id, fields: args });
  const codecRoles = ['request', 'identity', 'phaseIdentity', 'item', 'association', 'prepare', 'commit', 'compensate', 'result', 'manifestResult'];
  const codecs = codecRoles.map(role => ({ role, id: 'reservation.' + role, version: 1 }));
  const phases = ['prepare', 'commit', 'compensate'];
  const kinds = ['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown'];
  const steps = ['first', 'second'];
  const participants = steps.map((stepId, index) => ({ stepId, participantId: 'resource-' + index,
    resource: { ref: 'args:' + (index ? 'warehouseB' : 'warehouseA') },
    phases: Object.fromEntries(phases.map(phase => {
      const from = phase === 'prepare' ? index ? [['first', 'prepare']] : [] : phase === 'commit'
        ? [['first', 'prepare'], ['second', 'prepare'], ...(index ? [['first', 'commit']] : [])] : [[stepId, 'prepare']];
      return [phase, { runtimeCodec: { id: 'reservation.' + phase, version: 1 },
        outputs: [{ slot: 'handle', type: 'receipt-handle' }],
        inputs: [
          { slot: 'transactionId', type: 'TransactionId', source: { kind: 'transaction-id' } },
          { slot: 'warehouse', type: 'Warehouse', source: { kind: 'args', slot: index ? 'warehouseB' : 'warehouseA' } },
          { slot: 'sku', type: 'Sku', source: { kind: 'args', slot: 'sku' } },
          ...(phase === 'prepare' ? [{ slot: 'quantity', type: 'Quantity', source: { kind: 'args', slot: 'quantity' } }] : []),
          ...from.map(([stepId, phase], i) => ({ slot: 'receipt' + i, type: 'receipt-handle', source: { kind: 'receipt-field', stepId, phase, slot: 'handle' } })),
        ] }];
    })) }));
  const definition = { id: 'reservation-saga', version: '1', payload: { transactionIdType: 'TransactionId', argsType: request.ref.id, steps: steps.map(id => ({ id })) } };
  const binding = { types };
  const resultPort = { declaration: { name: roles.result, payloadType: resultType.ref.id }, payload: { name: resultType.ref.id, fields: resultFields } };
  const saga = { sagaId: definition.id, definitionVersion: '1', runtimeIdentity: { name: definition.id, version: 7 },
    definitionDigest: 'sha256:' + 'b'.repeat(64), contract: { definition, binding, resultPort },
    args: { slots: args, types, runtimeCodec: { id: 'reservation.request', version: 1 } }, participants,
    schedule: { prepare: steps, commit: steps, compensate: [...steps].reverse() },
    coordinatorSettings: { interactionTimeoutMs: 2000, maxReconcileInteractions: 16 },
    completions: kinds.map(kind => ({ kind, inputs: [{ slot: 'transactionId', source: { kind: 'transaction-id' } }, { slot: 'originalRequest', source: { kind: 'args-record' } }] })) };
  const single = { kind: 'single', maxItems: 1, minItems: 1, maxWaitMillis: 0, allowPartialOnClose: true };
  const completion = (kind, target = null) => ({ terminal: { kind, target, compatibilityKey: target ? 'results' : null, delayMillis: 0 }, unknown: 'hold', resource: 'release', retainCarried: false });
  const workflow = { id: 'reservation-workflow', version: '1', context, source: source('/workflows/0'), sources: [source('/workflows/0')], inputKey: 'fixture-input',
    input: { type: request.ref }, capacities: [{ id: 'execution-permit', units: 2 }],
    settings: { maxAcceptedItems: 3, maxActiveItems: 3, maxActiveBytes: 12288, maxItemBytes: 4096, maxResultBytes: 4096,
      maxConcurrentBatches: 2, maxTransitions: 8, maxBatchCalls: 100, maxReconciliations: 3, pollIntervalMillis: 25, callTimeoutMillis: 2000 },
    technical: { stepId: 'execute', codecVersion: 'batch-codec-1', connectorPrefix: 'reservation/', connectorVersion: '1', ledgerEpoch: 'ledger-1', proofFormat: 'digest-proof-v1' },
    areas: [
      { id: 'reserve', version: '1', batch: { kind: 'count-or-wait', maxItems: 2, minItems: 1, maxWaitMillis: 100, allowPartialOnClose: true }, resources: [{ id: 'execution-permit', units: 1 }], parallelism: 1, maxExecutions: 1, action: { kind: 'invoke-saga', ref: { id: definition.id, version: '1' } }, completion: completion('route', 'publish'), verification: false },
      { id: 'publish', version: '1', batch: single, resources: [{ id: 'execution-permit', units: 1 }], parallelism: 1, maxExecutions: 1, action: { kind: 'publish-result', ref: { id: definition.id, version: '1' } }, completion: completion('complete'), verification: false },
    ] };
  const host = { id: 'reservation', version: '1', context, source: source('/sagaHosts/0'), saga: { id: definition.id, version: '1' }, workflow: { id: workflow.id, version: '1' }, requestType: request.ref, slots };
  const implementation = { id: 'provider', version: '1', module: 'ext', role: 'adapter', symbol: 'fixture.external.FilePorts', construction: 'class', implements: ports[0].ref,
    sourceRootKey: 'external', file: 'FilePorts.scala', provides: Object.keys(roles), constructor: [
      { implicit: false, parameters: ['directory', 'resourceA', 'resourceB', 'recoveryAuthorization'].map(input => ({ name: input, input })) },
      { implicit: true, parameters: [{ name: 'ec', input: 'executionContext' }] },
    ] };
  const technical = { id: 'reservation-deployment', version: '1', runtime: { saga: STRICT_SAGA_TARGET, monarch: MONARCH_R2_ARTIFACTS },
    identity: { strategy: 'sha256-item-frame-v1', transactionPrefix: 'reservation-tx/', resultPrefix: 'reservation-result/' },
    wire: { format: 'length-prefixed-v1', maxBytes: 65536, codecs, phaseTags: phases.map((phase, i) => ({ phase, tag: i + 1 })), resultTags: kinds.map((kind, i) => ({ kind, tag: i + 1 })) },
    settings: { maxTransactions: 32, maxJobs: 4, maxChildren: 128, systemOwnership: 'caller' }, implementations: [implementation],
    root: { id: 'ReservationApplication', bindings: Object.fromEntries(Object.keys(roles).map(role => [role, implementation.id])) } };
  const products = {
    'reference-layout': { contexts: [context], declarations }, 'exact-value-types': [], 'exact-value-codecs': [],
    'saga-contract': { sagas: [{ definition, binding, resultPort }] }, 'saga-runtime-contract': { sagas: [saga] },
    'execution-contract': { pipelines: [] }, 'workflow-contract': { workflows: [workflow] },
    'saga-host-contract': { schemaVersion: 'truthsrc.saga-host-contract/v2', host, technical, request: { ref: request.ref, fields }, ports, saga, workflow, runs: [], sources: [host.source, { document: 'deployment', pointer: '' }] },
  };
  return structuredClone({ products, options: { packages: [{ context, package: 'fixture.reservation' }], names: [
    { ref: sagaRef.ref, role: 'saga', name: 'ReservationSaga' }, { ref: sagaRef.ref, role: 'workflow', name: 'ReservationWorkflow' },
  ], sourceRoots: [{ id: 'external', module: 'ext', path: 'implementations' }] } });
}
// Genuine execution/v2 IR, compiled in memory from a complete finite port contract.
// The surrounding modelFixture remains a structural host fixture, not public generation evidence.
function addRun(input, mode = 'managed') {
  const host = input.products['saga-host-contract'];
  const ref = { context: host.host.context, kind: 'pipeline', owner: [], id: 'fulfillment' };
  const outcomes = [
    { code: 'done', kind: 'success', action: 'continue' },
    { code: 'resolved', kind: 'resolved', action: 'continue' },
    { code: 'declined', kind: 'business-rejection', action: 'stop' },
    { code: 'offline', kind: 'infrastructure-failure', action: 'manual-recovery' },
    { code: 'uncertain', kind: 'unknown-effect', action: 'manual-recovery' },
  ];
  const codecVersion = mode === 'managed' ? 'fulfillment-state-v2' : 'batch-codec-1', version = 'v9';
  const stepId = mode === 'managed' ? 'fulfill-request' : 'execute';
  const slots = [{ slot: 'request', type: 'Purchase' }, { slot: 'transactionId', type: 'Tx' },
    ...(mode === 'versioned' ? [{ slot: 'quantity', type: 'Count' }] : [])];
  const output = [{ slot: 'result', type: 'Receipt' }];
  const steps = [
    ...(mode === 'versioned' ? [{ id: 'check', name: 'Check quantity', execution: {
      port: 'check-quantity', reads: [{ slot: 'quantity', type: 'Count', ref: 'input:quantity' }],
      writes: [{ id: 'checked', slot: 'quantity', type: 'Count', durability: 'checkpoint' }], outcomes,
    } }] : []),
    { id: stepId, name: 'Fulfill request', execution: {
      port: 'fulfill', reads: slots.map(row => ({ ...row, ref: row.slot === 'quantity' && mode === 'versioned' ? 'step:check:checked' : 'input:' + row.slot })),
      writes: [{ id: 'receipt', slot: 'result', type: 'Receipt', durability: 'checkpoint' }], outcomes,
    } },
  ];
  const port = (id, inputs, outputs) => ({ id, implementation: 'fixture.external.' + (id === 'fulfill' ? 'Fulfill' : 'CheckQuantity'),
    effect: mode === 'managed' ? 'external' : 'pure', confirmation: mode === 'managed' ? 'durable-ack' : 'checkpoint',
    idempotency: mode === 'managed' ? { mode: 'keyed', key: 'transactionId' } : { mode: 'none' },
    inputs, outputs, outcomes: outcomes.map(({ code, kind }) => ({ code, kind })) });
  const pipeline = { id: ref.id, name: 'Fulfillment', steps, execution: {
    schemaVersion: 'truthsrc.execution/v2', inputs: slots.map(row => ({ id: row.slot, type: row.type, durability: 'start-record' })),
    outputs: [{ id: 'result', type: 'Receipt', ref: 'step:' + stepId + ':receipt' }],
    recovery: { inputResponsibility: 'host', inputs: slots.map(row => 'input:' + row.slot), planVersion: version,
      planCompatibility: 'exact', checkpoint: 'confirmed-prefix', unknownEffect: 'reconcile-before-resume', ownership: 'single-writer' },
    admission: { maxConcurrentRuns: 4, maxInFlightSteps: 1, maxItemsPerChunk: 1, maxInFlightChunks: 1 },
  } };
  const binding = { pipelineId: ref.id, engine: executionSchemaV2.$defs.bindingIr.properties.engine.const, module: 'glue',
    codec: { id: 'fulfillment.state', version: codecVersion, compatibleVersions: [codecVersion] },
    types: [['Purchase', 'ReservationRequest'], ['Tx', 'TransactionId'], ['Count', 'Quantity'], ['Receipt', 'ReservationResult']]
      .map(([id, name]) => ({ id, implementation: 'fixture.reservation.kernel.' + name })),
    ports: [...(mode === 'versioned' ? [port('check-quantity', [slots[2]], [{ slot: 'quantity', type: 'Count' }])] : []), port('fulfill', slots, output)],
    run: { definitionId: 'fulfillment-run', definitionVersion: version, codecVersion, mode, identity: 'caller-supplied-exact',
      operations: mode === 'versioned' ? [] : [{ stepId, connectorId: 'fulfillment/remote', connectorVersion: '2', ledgerEpoch: 'fulfillment-ledger-3',
        requestCodec: { id: 'fulfillment.request', version: 'request-v2', compatibleVersions: ['request-v2'] },
        identity: 'original-run-step', query: 'read-only-original-request' }] },
  };
  const compiler = createExecutionCompiler(executionSchemaV2, sagaSchemaV2, createSagaCompiler(sagaSchemaV2));
  const compiled = compiler.compileExecution({ schemaVersion: 'truthsrc/v1', workshop: 'structural-run', pipelines: [pipeline] },
    { schemaVersion: 'truthsrc.execution-binding/v2', pipelines: [binding] });
  assert.deepEqual(compiled.diagnostics, []);
  input.products['execution-contract'] = structuredClone(compiled.ir);
  // Mirror formal compileContract execution/v2 rebasing; raw compiler role labels
  // are not document IDs in this structural host fixture either.
  for (const source of Object.values(input.products['execution-contract'].sourceMap))
    source.document = source.document === 'canonical' ? 'author' : source.document === 'binding' ? 'run-binding' : source.document;
  const run = input.products['execution-contract'].pipelines[0];
  host.runs.push(run);
  input.products['reference-layout'].declarations.push({ ref, valueType: null, dependencies: [], source: { document: 'author', pointer: '/pipelines/0' } });
  host.technical.root.runs = [{ id: run.id, version, ports: run.binding.ports.map((port, i) => {
    const id = 'fulfillment-' + port.id + '-leaf';
    const implementsRef = { context: host.host.context, kind: 'port', owner: [], id: port.id + '-technical-port' };
    input.products['reference-layout'].declarations.push({ ref: implementsRef, valueType: null, dependencies: [],
      source: { document: 'author', pointer: '/technicalPorts/' + i } });
    host.technical.implementations.push({ id, version, module: 'ext', role: 'adapter', symbol: port.implementation,
      construction: 'object', implements: implementsRef, sourceRootKey: 'external', file: port.id + '-leaf.scala',
      provides: ['run:' + run.id + ':' + port.id], constructor: [] });
    return { id: port.id, implementation: id };
  }) }];
  input.options.names.push({ ref, role: 'run', name: 'FulfillmentRun' });
  return run;
}
function managedRunArea(input, areaIndex) {
  const run = addRun(input), area = input.products['saga-host-contract'].workflow.areas[areaIndex];
  area.action = { kind: 'run', ref: { id: run.id, version: run.binding.run.definitionVersion },
    inputs: [{ slot: 'request', source: 'request' }, { slot: 'transactionId', source: 'transaction-id' }],
    result: { slot: 'result', onStopped: 'original-item', outcomes: [
      { code: 'done', result: 'succeeded' }, { code: 'resolved', result: 'succeeded' },
      { code: 'declined', result: 'rejected-before-effects' }, { code: 'offline', result: 'recovery-required' },
      { code: 'uncertain', result: 'outcome-unknown' },
    ] } };
  return area;
}
function retryModelFixture() {
  const input = modelFixture(), area = managedRunArea(input, 0);
  area.maxExecutions = 2;
  area.action.retry = { semantics: 'reexecute-after-rejected-before-effects', identity: 'original-item-new-batch-operation',
    onExhausted: { kind: 'fail', reason: 'finite item retry budget exhausted' } };
  area.completion.terminal = { kind: 'by-result', cases: [
    { result: 'succeeded', disposition: { kind: 'route', target: 'publish', compatibilityKey: 'results', delayMillis: 0 } },
    { result: 'rejected-before-effects', disposition: { kind: 'retry', target: null, compatibilityKey: null, delayMillis: 250 } },
    { result: 'compensated', disposition: { kind: 'hold', target: null, compatibilityKey: null, delayMillis: 0 } },
  ] };
  return input;
}
const roots = [{ id: 'external', module: 'ext', absolutePath: '/tmp/captured-saga-model-test-implementations' }];
const bodies = input => { const model = buildModels(input); return { model, entries: render(model, roots) }; };

// Pure model/template checks cannot certify Scala compilation, actors, persistence, installed use, or B.
test('frozen producer manifest requires exactly the eight registry products', () => {
  assert.deepEqual(manifest.products.map(p => [p.id, p.version]), [
    ['reference-layout', '1'], ['exact-value-types', '1'], ['exact-value-codecs', '1'], ['saga-contract', '2'],
    ['saga-runtime-contract', '2'], ['execution-contract', '2'], ['workflow-contract', '1'], ['saga-host-contract', '3'],
  ]);
  for (const p of manifest.products) {
    const profile = profileFor(p.id, p.version);
    assert.equal(p.payloadSchemaVersion, profile.payloadSchemaVersion);
    assert.deepEqual(p.capabilities, profile.capabilities);
  }
});

test('pure models preserve nominal positive Int and expose exact capture-only keys', () => {
  const input = modelFixture(), before = structuredClone(input), model = buildModels(input);
  assert.deepEqual(input, before);
  assert.equal(model.field.quantity.type.storage, 'positive-int');
  assert.equal(model.field.quantity.type.name, 'Quantity');
  assert.deepEqual(Object.keys(model.lowered.handwritten[0]), ['id', 'version', 'module', 'role', 'symbol', 'construction', 'implements', 'sourceRootKey', 'file', 'source', 'sourceRoot']);
  assert.deepEqual(model.lowered.sourceRoots, input.options.sourceRoots);
  assert.equal(model.implementations[0].constructor[1].implicit, true);
  assert.deepEqual(resolveSagaMonarchTarget(input), model.lowered);
  assert.ok(Object.isFrozen(model));
  assert.doesNotMatch(JSON.stringify(model), /final case class|def execute|ByteString\.copyFrom/);
});

test('identity bounds are explicit and render unchanged with compiler code-point length semantics (structural only)', () => {
  for (const bounds of [{ minLength: 1, maxLength: 256 }, { minLength: 3, maxLength: 17 }, { minLength: 2147483647, maxLength: 2147483647 }]) {
    const input = modelFixture();
    Object.assign(input.products['saga-host-contract'].saga.args.types.find(t => t.id === 'RequestId'), bounds);
    const { model, entries } = bodies(input), kernel = entries.find(e => e.path === model.symbols.protocol.path).content;
    for (const value of model.values.filter(v => v.storage === 'identity-string')) {
      const expected = value.ref.id === 'RequestId' ? bounds : { minLength: 1, maxLength: 256 };
      assert.equal(value.minLength, expected.minLength);
      assert.equal(value.maxLength, expected.maxLength);
      assert.ok(!Object.hasOwn(value, 'minimum') && !Object.hasOwn(value, 'maximum'));
      assert.ok(kernel.includes(`final case class ${value.identifier}(value: String) { require(value != null && value.codePointCount(0, value.length) >= ${expected.minLength} && value.codePointCount(0, value.length) <= ${expected.maxLength}, "identity outside declared length bounds") }`));
    }
    assert.match(kernel, /Quantity\(value: Int\).*value >= 1 && value <= 2147483647/);
    assert.doesNotMatch(kernel, /value\.nonEmpty/);
  }
});

test('identity bounds reject omissions, non-positive, inverted, non-integer and above-schema limits', () => {
  const invalid = [
    ['missing minimum', type => { delete type.minLength; }],
    ['missing maximum', type => { delete type.maxLength; }],
    ['zero minimum', type => { type.minLength = 0; }],
    ['negative minimum', type => { type.minLength = -1; }],
    ['zero maximum', type => { type.maxLength = 0; }],
    ['negative maximum', type => { type.maxLength = -1; }],
    ['inverted', type => { type.minLength = 257; }],
    ['fractional minimum', type => { type.minLength = 1.5; }],
    ['fractional maximum', type => { type.maxLength = 2.5; }],
    ['string minimum', type => { type.minLength = '1'; }],
    ['string maximum', type => { type.maxLength = '256'; }],
    ['unsafe minimum', type => { type.minLength = Number.MAX_SAFE_INTEGER + 1; }],
    ['unsafe maximum', type => { type.maxLength = Number.MAX_SAFE_INTEGER + 1; }],
    ['above schema maximum', type => { type.maxLength = 2147483648; }],
  ];
  for (const id of ['RequestId', 'Warehouse', 'Sku', 'TransactionId']) for (const [name, change] of invalid) {
    const input = modelFixture();
    change(input.products['saga-host-contract'].saga.args.types.find(t => t.id === id));
    assert.throws(() => buildModels(input), /identity length bounds|safe integers/, id + '/' + name);
  }
});

test('one nominal identity cannot silently discard conflicting binding bounds', () => {
  const input = modelFixture(), saga = input.products['saga-host-contract'].saga;
  saga.args.types.push({ ...saga.args.types.find(t => t.id === 'RequestId'), id: 'NarrowRequestId', minLength: 3, maxLength: 17 });
  saga.args.slots[3].type = 'NarrowRequestId';
  input.products['saga-host-contract'].request.fields[3].valueType = structuredClone(input.products['saga-host-contract'].request.fields[0].valueType);
  assert.throws(() => buildModels(input), /inconsistent nominal identity length bounds/);
});

test('generated transactionId prefix plus 64 hex code points must fit its declared domain', () => {
  const fixture = (prefix, minLength, maxLength) => {
    const input = modelFixture(), host = input.products['saga-host-contract'];
    host.technical.identity.transactionPrefix = prefix;
    Object.assign(host.saga.args.types.find(t => t.id === 'TransactionId'), { minLength, maxLength });
    return input;
  };
  assert.throws(() => buildModels(fixture('tx/', 1, 32)), /generated transactionId length 67 outside declared transactionId length bounds/);
  assert.throws(() => buildModels(fixture('tx/', 1, 66)), /generated transactionId length 67/);
  assert.throws(() => buildModels(fixture('tx/', 68, 256)), /generated transactionId length 67/);
  const exact = buildModels(fixture('tx/', 67, 67));
  assert.equal(exact.transaction.minLength, 67);
  assert.equal(exact.transaction.maxLength, 67);
  // One supplementary code point plus slash: JS UTF-16 length would incorrectly reject this domain.
  const unicodePrefix = '\u{1F600}/';
  assert.equal([...unicodePrefix].length + 64, 66);
  assert.equal(unicodePrefix.length + 64, 67);
  assert.doesNotThrow(() => buildModels(fixture(unicodePrefix, 66, 66)));
  assert.throws(() => buildModels(fixture(unicodePrefix, 67, 67)), /generated transactionId length 66/);
  assert.throws(() => buildModels(fixture(null, 1, 256)), /transactionPrefix must be a string/);
});

test('receipt handle bounds lower from the shared type and guard both codec directions and phase bridges (structural only)', () => {
  for (const kind of ['id', 'string']) {
    const input = modelFixture(), saga = input.products['saga-host-contract'].saga;
    Object.assign(saga.args.types.find(t => t.id === 'receipt-handle'), { kind, minLength: 4, maxLength: 8 });
    const before = structuredClone(input), { model, entries } = bodies(input);
    assert.deepEqual(input, before);
    const codecs = entries.find(e => e.path === model.symbols.codecs.path).content;
    const bridge = entries.find(e => e.path === model.symbols.saga.path).content;
    assert.ok(codecs.includes('value != null && value.codePointCount(0, value.length) >= minLength && value.codePointCount(0, value.length) <= maxLength'));
    assert.match(codecs, /else Left\("receipt handle outside declared length bounds"\)/);
    for (const phase of ['prepare', 'commit', 'compensate']) {
      const title = phase[0].toUpperCase() + phase.slice(1);
      for (const p of model.saga.participants) {
        assert.deepEqual(p.phases[phase].receiptHandle, { type: 'receipt-handle', minLength: 4, maxLength: 8 });
        assert.ok(codecs.includes(`case ("${p.stepId}", "${p.participantId}", ReservationPhase.${title}) => handleLength(value, 4, 8)`));
      }
      assert.ok(codecs.includes(`def validate${title}Handle(id: PhaseIdentity, value: String): Either[String, Unit] =\n    if (id == null) Left("unknown receipt phase identity")\n    else (id.stepId, id.participantId, id.phase) match {`));
      assert.ok(codecs.includes(`validate${title}Handle(v.identity, v.reservationId).fold(e => throw new IllegalArgumentException(e), _ => ())\n    phaseOut(o, v.identity); o.text(v.reservationId); o.text(v.proof)`));
      assert.ok(codecs.includes(`val value = ${title}Receipt(phaseIn(i), i.text(), i.text())\n    validate${title}Handle(value.identity, value.reservationId).fold(e => throw new IllegalArgumentException(e), _ => ())\n    value`));
      assert.ok(bridge.includes(`if (receipt == null || receipt.identity != id) Left("receipt identity mismatch")\n            else BinaryCodecs.validate${title}Handle(receipt.identity, receipt.reservationId)\n              .flatMap(_ => ports.evidence.${phase}(id, receipt))`));
    }
    assert.equal(codecs.match(/case _ => Left\("unknown receipt phase identity"\)/g)?.length, 3);
    assert.doesNotMatch(codecs, /handleLength\(value, 1, 256\)/);
  }
});

test('receipt handle bounds reject missing, non-positive, inverted, non-integer and above-schema limits', () => {
  const invalid = [
    ['missing minimum', t => { delete t.minLength; }],
    ['missing maximum', t => { delete t.maxLength; }],
    ['null minimum', t => { t.minLength = null; }],
    ['null maximum', t => { t.maxLength = null; }],
    ['zero minimum', t => { t.minLength = 0; }],
    ['negative minimum', t => { t.minLength = -1; }],
    ['zero maximum', t => { t.maxLength = 0; }],
    ['negative maximum', t => { t.maxLength = -1; }],
    ['inverted', t => { t.minLength = 9; t.maxLength = 8; }],
    ['fractional minimum', t => { t.minLength = 1.5; }],
    ['fractional maximum', t => { t.maxLength = 8.5; }],
    ['string minimum', t => { t.minLength = '4'; }],
    ['string maximum', t => { t.maxLength = '8'; }],
    ['unsafe minimum', t => { t.minLength = Number.MAX_SAFE_INTEGER + 1; }],
    ['unsafe maximum', t => { t.maxLength = Number.MAX_SAFE_INTEGER + 1; }],
    ['above schema maximum', t => { t.maxLength = 2147483648; }],
  ];
  for (const kind of ['id', 'string']) for (const [name, change] of invalid) {
    const input = modelFixture(), type = input.products['saga-host-contract'].saga.args.types.find(t => t.id === 'receipt-handle');
    type.kind = kind; change(type);
    const nonExactNumber = [type.minLength, type.maxLength].some(value => typeof value === 'number' && !Number.isSafeInteger(value));
    assert.throws(() => buildModels(input), error => nonExactNumber
      ? error.diagnostic?.code === 'PRODUCT_EXACT_NUMBER'
      : /receipt handle length bounds/.test(error.message), kind + '/' + name);
  }
  const upper = modelFixture();
  Object.assign(upper.products['saga-host-contract'].saga.args.types.find(t => t.id === 'receipt-handle'), { minLength: 2147483647, maxLength: 2147483647 });
  const { model, entries } = bodies(upper);
  assert.ok(entries.find(e => e.path === model.symbols.codecs.path).content.includes('handleLength(value, 2147483647, 2147483647)'));
});

test('shared receipt codec range conflicts retain each producer phase domain, never a union or intersection', () => {
  const input = modelFixture(), saga = input.products['saga-host-contract'].saga;
  Object.assign(saga.args.types.find(t => t.id === 'receipt-handle'), { minLength: 4, maxLength: 8 });
  const ranges = { prepare: [6, 10], commit: [12, 14], compensate: [16, 20] };
  for (const [phase, [minLength, maxLength]] of Object.entries(ranges)) {
    const id = 'second-' + phase + '-handle';
    saga.args.types.push({ id, kind: 'string', canonicalType: 'String', minLength, maxLength });
    saga.participants[1].phases[phase].outputs[0].type = id;
  }
  for (const p of saga.participants) for (const phase of Object.values(p.phases)) {
    for (const input of phase.inputs.filter(i => i.source.kind === 'receipt-field')) {
      input.type = saga.participants.find(p => p.stepId === input.source.stepId).phases[input.source.phase].outputs[0].type;
    }
  }
  const { model, entries } = bodies(input), codecs = entries.find(e => e.path === model.symbols.codecs.path).content;
  for (const [phase, [minLength, maxLength]] of Object.entries(ranges)) {
    const title = phase[0].toUpperCase() + phase.slice(1), [first, second] = model.saga.participants;
    assert.deepEqual(first.phases[phase].runtimeCodec, second.phases[phase].runtimeCodec);
    assert.deepEqual(first.phases[phase].receiptHandle, { type: 'receipt-handle', minLength: 4, maxLength: 8 });
    assert.deepEqual(second.phases[phase].receiptHandle, { type: 'second-' + phase + '-handle', minLength, maxLength });
    assert.ok(codecs.includes(`case ("first", "resource-0", ReservationPhase.${title}) => handleLength(value, 4, 8)`));
    assert.ok(codecs.includes(`case ("second", "resource-1", ReservationPhase.${title}) => handleLength(value, ${minLength}, ${maxLength})`));
  }
  assert.equal(codecs.match(/case _ => Left\("unknown receipt phase identity"\)/g)?.length, 3);
  // Sharing bounds must not weaken the existing exact codec-pin contract either.
  saga.participants[1].phases.prepare.runtimeCodec = { id: 'different.prepare', version: 1 };
  assert.throws(() => buildModels(input), /phase codec pin mismatch/);
});

test('pure renderer returns mapped generated entries only, with a complete dependency graph', () => {
  const { model, entries } = bodies(modelFixture());
  assert.equal(entries.length, 9);
  assert.ok(entries.every(e => !e.path.startsWith('modules/ext/src/')));
  assert.ok(!entries.some(e => e.path.includes('FilePorts.scala')));
  const byPath = new Map(entries.map(e => [e.path, e]));
  for (const e of entries) {
    assert.deepEqual(e.productFootprint, productFootprint);
    assert.ok(e.knowledgeIds.length && validateCodeMappings(e).length);
    for (const mapping of e.codeMappings) assert.equal(Buffer.from(e.content).subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
    for (const id of e.knowledgeIds) assert.ok(e.codeMappings.some(c => c.knowledgeKey === id));
    for (const path of e.deps) { assert.ok(byPath.has(path)); for (const transitive of byPath.get(path).deps) assert.ok(e.deps.includes(transitive)); }
  }
  const kernel = byPath.get(model.symbols.protocol.path).content;
  assert.match(kernel, /Quantity\(value: Int\)/);
  assert.doesNotMatch(kernel, /akka\.|protobuf/);
  assert.match(byPath.get(model.symbols.saga.path).content, /ByteString\.copyFrom/);
  const runtime = byPath.get(model.symbols.runtime.path).content;
  assert.match(runtime, /interactionTimeout <= 2000\.millis && maxReconcileInteractions <= 16/);
  assert.match(runtime, /interactionTimeout > Duration.Zero && maxReconcileInteractions > 0/);
  assert.match(runtime, /maxTransactions <= 32 && maxJobs <= 4 && maxChildren <= 128/);
  assert.ok(byPath.get(model.symbols.saga.path).content.includes(model.saga.definitionDigest));
  assert.match(byPath.get(model.symbols.workflow.path).content, /ByteString\.fromArray/);
  const root = byPath.get(model.symbols.root.path).content;
  assert.match(root, /new _root_\.fixture\.external\.FilePorts\(directory, resourceA, resourceB, recoveryAuthorization\)\(ec\)/);
  assert.doesNotMatch(root, /executeBusiness/);
  assert.match(byPath.get('build.sbt').content, /truthsrc\.repositories/);
  assert.match(byPath.get('build.sbt').content, /ext.*project in file\("modules\/ext"\).*dependsOn\(kernel\)/);
});

test('names/packages alter symbols but never semantic digests, codec pins, or operation prefixes', () => {
  const input = modelFixture(), before = bodies(input);
  input.options.packages[0].package = 'renamed.reservation';
  const request = input.products['saga-host-contract'].request.ref;
  input.options.names.push({ ref: request, role: 'value', name: 'PurchaseRequest' });
  const after = bodies(input);
  assert.equal(after.model.request.name, 'PurchaseRequest');
  assert.deepEqual(after.model.serialization, before.model.serialization);
  assert.equal(after.model.saga.definitionDigest, before.model.saga.definitionDigest);
  assert.equal(after.model.workflow.areas[0].operation.connectorId, 'reservation/reserve');
  const text = after.entries.map(e => e.content).join('\n');
  assert.match(text, /class PurchaseRequest/);
  assert.doesNotMatch(text, /class ReservationRequest/);
  assert.match(text, /reservation-tx\//);
});

test('missing technical identity or completion fields fail instead of inventory fallbacks', () => {
  const input = modelFixture(); delete input.products['saga-host-contract'].workflow.technical;
  assert.throws(() => buildModels(input), /workflow\.technical/);
  const completion = modelFixture(); completion.products['saga-host-contract'].saga.completions[0].inputs.pop();
  assert.throws(() => buildModels(completion), /whole-request/);
  const mismatch = modelFixture(); mismatch.products['saga-host-contract'].request.fields[4].valueType = { form: 'primitive', name: 'integer' };
  assert.throws(() => buildModels(mismatch), /nominal type mismatch/);
});

test('whole-request argsType and args-record completions cannot regress to legacy fixture shapes', () => {
  const missing = modelFixture(), missingSaga = missing.products['saga-host-contract'].saga;
  delete missingSaga.contract.definition.payload.argsType;
  assert.throws(() => buildModels(missing), /whole-request argsType/);
  const partial = modelFixture(), partialSaga = partial.products['saga-host-contract'].saga;
  partialSaga.args.types.find(t => t.id === partialSaga.contract.definition.payload.argsType).fields = partialSaga.args.slots.slice(0, 4);
  assert.throws(() => buildModels(partial), /whole-request argsType/);
  const legacy = modelFixture();
  legacy.products['saga-host-contract'].saga.completions[0].inputs[1].source = { kind: 'request' };
  assert.throws(() => buildModels(legacy), /whole-request args-record sources/);
});

test('every participant phase requires its direct request roles, not just receipt dependencies', () => {
  for (const index of [0, 1]) for (const phase of ['prepare', 'commit', 'compensate']) {
    const input = modelFixture(), lowered = input.products['saga-host-contract'].saga.participants[index].phases[phase];
    lowered.inputs = lowered.inputs.filter(i => i.source.kind === 'receipt-field');
    assert.throws(() => buildModels(input), /phase input roles differ/, index + '/' + phase);
  }
});

test('extra products, unknown selectors, collisions and mismatched roots are rejected', () => {
  const extra = modelFixture(); extra.products['domain-decision'] = [];
  assert.throws(() => buildModels(extra));
  const selector = modelFixture(); selector.options.names.push({ ref: selector.products['saga-host-contract'].request.ref, role: 'unknown', name: 'Unused' });
  assert.throws(() => buildModels(selector), /unused\/unknown/);
  const collision = modelFixture(); collision.options.names.push({ ref: collision.products['saga-host-contract'].request.ref, role: 'value', name: 'Quantity' });
  assert.throws(() => buildModels(collision));
  const root = modelFixture(); root.options.sourceRoots[0].module = 'glue';
  assert.throws(() => buildModels(root), /ext/);
  assert.throws(() => render(buildModels(modelFixture()), [{ ...roots[0], absolutePath: 'relative/path' }]));
});

test('query-only verification and whole-group Carry render independently of retry', () => {
  const input = modelFixture(), workflow = input.products['saga-host-contract'].workflow;
  workflow.technical.proofFormat = 'owner-certificates-v1';
  workflow.technical.carry = { reservationSuffix: '/occupancy', ownerSuffix: '/owner' };
  workflow.areas[0].completion.resource = 'carry';
  workflow.areas[0].batch.minItems = 2;
  workflow.areas[0].batch.allowPartialOnClose = false;
  workflow.areas[1].batch = { kind: 'by-compatibility-key', maxItems: 2, minItems: 2, maxWaitMillis: 100, allowPartialOnClose: false };
  workflow.areas[1].action.kind = 'query-saga'; workflow.areas[1].verification = true;
  const { model, entries } = bodies(input), text = entries.find(e => e.path === model.symbols.workflow.path).content;
  assert.match(text, /BatchPolicy\.CountOrWait\(2, 100L, 2, false\)/);
  assert.match(text, /ItemDisposition\.Completed/);
  assert.doesNotMatch(text, /ItemDisposition\.Retry/);
  assert.match(text, /ResourceDisposition\.Carry\(m\.reservationId \+ "\/occupancy"/);
  assert.match(text, /rows\.keySet == owners\(m\)\.toSet/);
  assert.match(text, /case "publish" => "query-saga"/);
  assert.match(text, /case "publish" => BinaryCodecs\.request\.decode/);
});

test('managed Run renders explicit rejected-before-effects retry and original item decisions (structural only)', () => {
  const input = retryModelFixture();
  const { model, entries } = bodies(input);
  assert.equal(model.workflow.areas[0].action.kind, 'run');
  assert.deepEqual(model.workflow.areas[0].action.retry, {
    semantics: 'reexecute-after-rejected-before-effects', identity: 'original-item-new-batch-operation',
    onExhausted: { kind: 'fail', reason: 'finite item retry budget exhausted' },
  });
  const text = entries.find(e => e.path === model.symbols.workflow.path).content;
  assert.match(text, /case _: SagaResult\.RejectedBeforeEffects => if \(/);
  assert.match(text, /i.execution \+ 1 >= 2 \|\| i.lineage.size \+ 1 >= definition.settings.maxTransitions/);
  assert.match(text, /ItemDisposition.Failed\("finite item retry budget exhausted"\) else ItemDisposition.Retry\(250L\)/);
  assert.match(text, /case _: SagaResult\.Succeeded => ItemDisposition\.Route\("publish", "results", 0L\)/);
  assert.match(text, /case _: SagaResult\.Compensated => ItemDisposition\.Hold/);
  assert.match(text, /ItemDecision\(entry.item.itemId, disposition\)/);
  assert.match(text, /BatchConservation.validate/);
});

test('all-terminal Retry is rejected for every finite action', () => {
  for (const kind of ['run', 'invoke-saga', 'query-saga', 'publish-result']) {
    const input = retryModelFixture(), host = input.products['saga-host-contract'], area = host.workflow.areas[0];
    if (kind !== 'run') area.action = { kind, ref: { ...host.host.saga } };
    area.completion.terminal = { kind: 'retry', target: null, compatibilityKey: null, delayMillis: 200 };
    assert.throws(() => buildModels(input), /all-terminal Retry is unsafe/, kind);
  }
});

test('invoke-saga, query-saga and publish-result cannot turn terminal rejection into business Retry', () => {
  for (const kind of ['invoke-saga', 'query-saga', 'publish-result']) {
    const input = retryModelFixture(), host = input.products['saga-host-contract'], area = host.workflow.areas[0];
    area.action = { kind, ref: { ...host.host.saga }, retry: area.action.retry };
    area.verification = kind === 'query-saga';
    assert.throws(() => buildModels(input), /terminal Retry requires a managed run action/, kind);
  }
});

test('by-result never admits succeeded or compensated Retry, even for explicitly retryable Run', () => {
  for (const result of ['succeeded', 'compensated']) {
    const input = retryModelFixture(), cases = input.products['saga-host-contract'].workflow.areas[0].completion.terminal.cases;
    cases.find(c => c.result === result).disposition = { kind: 'retry', target: null, compatibilityKey: null, delayMillis: 200 };
    assert.throws(() => buildModels(input), /succeeded and compensated Retry are forbidden/, result);
  }
});

test('Run Retry requires the exact author contract, with no defaults, aliases or extra fields', () => {
  const invalid = [
    ['missing block', action => { delete action.retry; }],
    ['null block', action => { action.retry = null; }],
    ['missing semantics', action => { delete action.retry.semantics; }],
    ['missing identity', action => { delete action.retry.identity; }],
    ['semantics alias', action => { action.retry.semantics = 'retry-rejected'; }],
    ['identity alias', action => { action.retry.identity = 'original-item'; }],
    ['extra field', action => { action.retry.delayMillis = 250; }],
    ['missing exhaustion', action => { delete action.retry.onExhausted; }],
    ['successful exhaustion', action => { action.retry.onExhausted.kind = 'complete'; }],
    ['empty exhaustion reason', action => { action.retry.onExhausted.reason = ''; }],
  ];
  for (const [name, change] of invalid) {
    const input = retryModelFixture();
    change(input.products['saga-host-contract'].workflow.areas[0].action);
    assert.throws(() => buildModels(input), /exact explicit action\.retry/, name);
  }
});

test('an action.retry block without any Retry disposition is rejected, including null', () => {
  for (const kind of ['run', 'invoke-saga', 'query-saga', 'publish-result']) {
    for (const byResult of [false, true]) {
      const input = retryModelFixture(), host = input.products['saga-host-contract'], area = host.workflow.areas[0];
      if (kind !== 'run') area.action = { kind, ref: { ...host.host.saga }, retry: area.action.retry };
      const hold = { kind: 'hold', target: null, compatibilityKey: null, delayMillis: 0 };
      if (byResult) area.completion.terminal.cases[1].disposition = hold;
      else area.completion.terminal = hold;
      assert.throws(() => buildModels(input), /unused action\.retry/, kind + '/' + byResult);
    }
  }
  const input = modelFixture();
  input.products['saga-host-contract'].workflow.areas[0].action.retry = null;
  assert.throws(() => buildModels(input), /unused action\.retry/);
});

test('retry still requires execution budget and exactly one case per terminal result', () => {
  const budget = retryModelFixture();
  budget.products['saga-host-contract'].workflow.areas[0].maxExecutions = 1;
  assert.throws(() => buildModels(budget), /authored execution budget/);
  const duplicate = retryModelFixture(), cases = duplicate.products['saga-host-contract'].workflow.areas[0].completion.terminal.cases;
  cases[2].result = 'succeeded';
  assert.throws(() => buildModels(duplicate), /all three terminal result cases exactly once/);
});

test('managed Run area keeps explicit pins and versioned identity checks in generated facades', () => {
  const input = modelFixture();
  managedRunArea(input, 1);
  const { model, entries } = bodies(input);
  const runtime = entries.find(e => e.path === model.symbols.runtime.path).content;
  const workflow = entries.find(e => e.path === model.symbols.workflow.path).content;
  assert.match(runtime, /object FulfillmentRun/);
  assert.match(runtime, /RunProtocol\.Identity\(submission.runId, definition.id, definition.version, definition.codecVersion/);
  assert.match(runtime, /definition.planDigest/);
  assert.match(runtime, /view.status == RunProtocol.Status.Completed/);
  assert.match(workflow, /fulfillmentRunHost: FulfillmentRun.Host/);
  assert.match(workflow, /if \(submit\) fulfillmentRunHost.ensure\(runId, input\) else fulfillmentRunHost.query\(runId, input\)/);
  assert.match(workflow, /case "publish" => \("execute", "reservation\/publish", "1", "ledger-1"\)/);
  assert.doesNotMatch(workflow, /fulfillment\/remote|runConnectors|Map\[String, ExternalOperationPort\]|executeBusiness/);
  assert.equal(model.runs[0].steps[0].id, 'fulfill-request');
  assert.equal(model.runs[0].binding.run.codecVersion, 'fulfillment-state-v2');
  assert.equal(model.workflow.areas[1].operation.stepId, 'execute');
  assert.match(runtime, /"fulfillment\/remote", "2", "fulfillment-ledger-3"/);
  assert.match(workflow, /Input\(request = request, transactionId = association.saga.transactionId\)/);
  assert.match(workflow, /BinaryCodecs.item.encode\(itemId\), outerOperationKey.getBytes\("UTF-8"\).toVector/);
  assert.match(workflow, /value.originalRequest == request && value.transactionId == association.saga.transactionId/);
  assert.match(workflow, /onStopped=original-item/);
  assert.match(workflow, /case "declined" => SagaResult.RejectedBeforeEffects\(value\)/);
  assert.match(workflow, /case "offline" => SagaResult.RecoveryRequired\(value\)/);
  assert.match(workflow, /case "uncertain" => SagaResult.OutcomeUnknown\(value\)/);
});

test('root explicitly constructs captured typed Leaves and Hosts without a raw business connector (structural only)', () => {
  for (const mode of ['versioned', 'managed']) {
    const input = modelFixture(); addRun(input, mode);
    const { model, entries } = bodies(input), run = model.runs[0];
    const root = entries.find(e => e.path === model.symbols.root.path);
    assert.match(root.content, /fulfillmentRunLeaves: FulfillmentRun.Leaves/);
    assert.match(root.content, /val fulfillmentRunHost: FulfillmentRun.Host = new FulfillmentRun.Host\(system, namespace, fulfillmentRunLeaves\)/);
    assert.match(root.content, /new ReservationWorkflow\(reservations, ports, fulfillmentRunHost\)/);
    assert.match(root.content, /new ReservationApplication\(system, namespace, ports, settings, ownership, fulfillmentRunLeaves\)/);
    assert.doesNotMatch(root.content, /Map\[String, ExternalOperationPort\]|runConnectors|executeBusiness/);
    for (const leaf of run.leaves) {
      assert.ok(root.content.includes(`val ${leaf.local}: _root_.${run.protocol.fqn}.${leaf.port.identifier}.Leaf = ${leaf.implementation.local}`));
      assert.ok(root.content.includes(`${leaf.identifier} = ${leaf.local}`));
      assert.ok(!root.content.includes(leaf.implementation.local + '.ports'));
      const capture = model.lowered.handwritten.find(row => row.id === leaf.implementation.id);
      assert.deepEqual(capture.implements, leaf.implementation.implements);
      assert.ok(root.codeMappings.some(row => row.knowledgeKey === 'source:author#' + leaf.source.pointer));
    }
    for (const entry of entries) {
      assert.ok(!entry.knowledgeIds.some(key => key.startsWith('source:canonical#') || key.startsWith('source:binding#')));
    }
  }
});

test('typed Run bridge rejects incomplete input/result mappings and loose root leaf providers', () => {
  const cases = [
    [input => { input.products['saga-host-contract'].workflow.areas[0].action.inputs.pop(); }, /complete typed Run input mapping/],
    [input => { input.products['saga-host-contract'].workflow.areas[0].action.inputs[0].source = 'transaction-id'; }, /exact original request or transaction-id/],
    [input => { input.products['saga-host-contract'].workflow.areas[0].action.result.onStopped = 'output'; }, /explicit original-item/],
    [input => { input.products['saga-host-contract'].workflow.areas[0].action.result.slot = 'absent'; }, /exact nominal original-item output/],
    [input => { input.products['saga-host-contract'].workflow.areas[0].action.result.outcomes.pop(); }, /complete Run outcome mapping/],
    [input => { input.products['saga-host-contract'].workflow.areas[0].action.result.outcomes[3].result = 'succeeded'; }, /terminal\/uncertain semantics/],
    [input => { input.products['saga-host-contract'].technical.root.runs[0].ports = []; }, /complete typed leaf coverage/],
    [input => { input.products['saga-host-contract'].technical.implementations[1].provides.push('result'); }, /one exact run:id:port/],
    [input => { input.products['saga-host-contract'].technical.implementations[1].symbol = 'fixture.external.Wrong'; }, /one exact run:id:port/],
  ];
  for (const [change, expected] of cases) {
    const input = modelFixture(); managedRunArea(input, 0); change(input);
    assert.throws(() => buildModels(input), expected);
  }
});

test('complete pure multi-step IR retains every typed read/write/outcome and original source', () => {
  const input = modelFixture(), original = addRun(input, 'versioned'), before = structuredClone(input);
  const { model, entries } = bodies(input), run = model.runs[0];
  assert.deepEqual(input, before);
  assert.equal(run.protocol.name, 'FulfillmentRunProtocol');
  assert.equal(run.protocol.path, model.symbols.protocol.path);
  assert.deepEqual(run.steps.map(s => s.id), ['check', 'execute']);
  assert.equal(run.steps[1].reads[2].from.kind, 'write');
  assert.equal(run.steps[1].reads[2].from.stepId, 'check');
  assert.equal(run.steps[1].reads[0].from.kind, 'input');
  assert.equal(run.outputs[0].from.id, 'receipt');
  assert.equal(run.types.find(t => t.id === 'Purchase').model.fqn, model.request.fqn);
  assert.equal(run.types.find(t => t.id === 'Receipt').model.fqn, model.result.fqn);
  assert.equal(run.types.find(t => t.id === 'Tx').model.fqn, model.transaction.fqn);
  for (let i = 0; i < run.steps.length; i++) {
    for (const key of ['reads', 'writes', 'outcomes']) {
      assert.equal(run.steps[i][key].length, original.steps[i][key].length);
      original.steps[i][key].forEach((row, j) => {
        for (const [field, value] of Object.entries(row)) assert.deepEqual(run.steps[i][key][j][field], value);
        assert.deepEqual(run.steps[i][key][j].provenance, input.products['execution-contract'].sourceMap[`/pipelines/0/steps/${i}/${key}/${j}`]);
      });
    }
  }
  assert.equal(run.steps[0].outcomes.find(o => o.code === 'declined').stateEffect, 'stop');
  assert.equal(run.steps[0].outcomes.find(o => o.code === 'offline').stateEffect, 'block');
  assert.equal(run.steps[0].outcomes.find(o => o.code === 'resolved').stateEffect, 'write');
  const kernel = entries.find(e => e.path === model.symbols.protocol.path);
  assert.match(kernel.content, /object FulfillmentRunProtocol/);
  assert.match(kernel.content, /writeCheckChecked: Option\[_root_\.fixture\.reservation\.kernel\.Quantity\]/);
  assert.match(kernel.content, /writeExecuteReceipt: Option\[_root_\.fixture\.reservation\.kernel\.ReservationResult\]/);
  assert.match(kernel.content, /code: Option\[String\]/);
  assert.match(kernel.content, /case object Partial extends Status/);
  assert.match(kernel.content, /case class Done\(values: Values\) extends Continuing/);
  assert.match(kernel.content, /case class Resolved\(values: Values\) extends Continuing/);
  assert.match(kernel.content, /case class Declined\(reason: String\) extends BusinessRejection/);
  assert.match(kernel.content, /case class Offline\(reason: String\) extends NonSuccessObservation/);
  assert.match(kernel.content, /def apply\(args: Args\): Future\[Outcome\]/);
  assert.doesNotMatch(kernel.content, /akka\.|net\.imadz\.|Map\[String,\s*Any\]|executeBusiness/);
  for (const step of run.steps) for (const row of [step, ...step.reads, ...step.writes, ...step.outcomes]) {
    const key = 'source:' + row.source.document + '#' + row.source.pointer;
    assert.ok(kernel.codeMappings.some(mapping => mapping.knowledgeKey === key));
  }
  for (const mapping of validateCodeMappings(kernel)) assert.ok(mapping);
});

test('managed typed leaf retains original request/evidence ABI, exact string codec pins and key source', () => {
  const input = modelFixture(); addRun(input);
  const { model, entries } = bodies(input), run = model.runs[0];
  assert.equal(run.steps[0].idempotency.slot, 'transactionId');
  assert.equal(run.steps[0].idempotency.from.kind, 'input');
  assert.equal(run.steps[0].idempotency.typeModel.fqn, model.transaction.fqn);
  assert.equal(run.operations[0].requestCodec.version, 'request-v2');
  const kernel = entries.find(e => e.path === model.symbols.protocol.path).content;
  assert.match(kernel, /def submit\(request: Request\): Future\[Observation\]/);
  assert.match(kernel, /def query\(request: Request\): Future\[Observation\]/);
  assert.match(kernel, /def validateEvidence\(expected: Request, evidence: Evidence\): Either\[String, Unit\]/);
  assert.match(kernel, /Evidence\(request: Request, outcome: TerminalOutcome, bytes: Vector\[Byte\], proof: Vector\[Byte\]\)/);
  assert.match(kernel, /case object NotFound extends Observation/);
  assert.doesNotMatch(kernel, /SafeToSubmit|OperationProtocol|akka\./);
});

test('Run lowering rejects unsupported types, incomplete coverage and unsafe dataflow rather than falling back', () => {
  const cases = [
    ['raw string', r => { r.binding.types[0].implementation = 'String'; }, /declared nominal FQN/],
    ['unknown nominal', r => { r.binding.types[0].implementation = 'fixture.reservation.kernel.Unemitted'; }, /declared nominal FQN/],
    ['unknown binding', r => { r.steps[0].reads[0].type = 'Missing'; }, /unknown Run type/],
    ['forward read', r => { r.steps[0].reads[0].ref = 'step:execute:receipt'; }, /input or earlier write/],
    ['missing read', r => { r.steps[1].reads.pop(); }, /read\/input coverage/],
    ['missing write', r => { r.steps[1].writes.pop(); }, /write\/output coverage/],
    ['missing outcome', r => { r.steps[1].outcomes.pop(); }, /outcome coverage/],
    ['false success', r => { r.steps[0].outcomes[3].action = 'continue'; }, /non-success observation/],
    ['wrong output', r => { r.outputs[0].ref = 'step:absent:receipt'; }, /input or earlier write/],
    ['wrong mode', r => { r.binding.run.mode = 'managed'; }, /mode must agree/],
    ['chunks', r => { r.admission.maxItemsPerChunk = 2; }, /singleton/],
  ];
  for (const [label, change, expected] of cases) {
    const input = modelFixture(), run = addRun(input, 'versioned'); change(run);
    assert.throws(() => buildModels(input), expected, label);
  }
  const unused = modelFixture(), run = addRun(unused, 'versioned');
  run.steps[1].port = 'check-quantity';
  run.steps[1].reads = structuredClone(run.steps[0].reads);
  run.steps[1].writes = structuredClone(run.steps[0].writes);
  assert.throws(() => buildModels(unused), /unused port bindings/);
  const missingSource = modelFixture(); addRun(missingSource);
  delete missingSource.products['execution-contract'].sourceMap['/pipelines/0/steps/0/reads/0'];
  assert.throws(() => buildModels(missingSource), /complete execution sourceMap/);
});

test('typed Run codecs retain literal pins, original input, optional writes and semantic frames (structural only)', () => {
  const input = modelFixture(); addRun(input, 'versioned');
  const { model, entries } = bodies(input);
  const codec = entries.find(e => e.path === model.symbols.codecs.path).content;
  assert.match(model.runs[0].semanticDigest, /^sha256:[0-9a-f]{64}$/);
  assert.ok(codec.includes(model.runs[0].semanticDigest));
  assert.match(codec, /framed\[State\]\("fulfillment.state", "batch-codec-1", "state"\)/);
  assert.match(codec, /o\.text\(version\); o\.text\(semanticDigest\)/);
  assert.match(codec, /val value = read\(i\); i\.done\(\); require\(encode\(value\) == bytes/);
  assert.match(codec, /validateState\(v\); o\.text\(v.runId\); inputOut\(o, v.input\)/);
  assert.match(codec, /optionOut\(o, v.writeCheckChecked\)/);
  assert.match(codec, /optionOut\(o, v.writeExecuteReceipt\)/);
  assert.match(codec, /optionOut\(o, v.code\)\(o.text\); optionOut\(o, v.stoppedStep\)\(o.text\); optionOut\(o, v.reason\)\(o.text\)/);
  assert.match(codec, /non-prefix Run writes/);
  const renamed = structuredClone(input); renamed.options.packages[0].package = 'renamed.reservation';
  for (const type of renamed.products['saga-host-contract'].runs[0].binding.types)
    type.implementation = type.implementation.replace('fixture.reservation.', 'renamed.reservation.');
  renamed.products['execution-contract'].pipelines = structuredClone(renamed.products['saga-host-contract'].runs);
  assert.equal(buildModels(renamed).runs[0].semanticDigest, model.runs[0].semanticDigest);
  // Mutation of an admitted semantic field changes the pin, while render naming does not.
  const semantic = structuredClone(input);
  semantic.products['saga-host-contract'].runs[0].admission.maxConcurrentRuns = 3;
  // The execution/host closure must be the same complete IR, not two independently edited inputs.
  semantic.products['execution-contract'].pipelines = structuredClone(semantic.products['saga-host-contract'].runs);
  assert.notEqual(buildModels(semantic).runs[0].semanticDigest, model.runs[0].semanticDigest);
});

test('declared pure Run consumes all fixed steps and outcomes without caller interpreter (structural only)', () => {
  const input = modelFixture(); addRun(input, 'versioned');
  const { model, entries } = bodies(input);
  const runtime = entries.find(e => e.path === model.symbols.runtime.path).content;
  const declared = runtime.slice(runtime.indexOf('object FulfillmentRun {'));
  assert.match(runtime, /object RunFactories/); // Legacy low-level oracle remains available.
  assert.match(declared, /case "check" =>/);
  assert.match(declared, /case "execute" =>/);
  assert.match(declared, /leaves.leaf0.apply/);
  assert.match(declared, /leaves.leaf1.apply/);
  assert.doesNotMatch(declared, /leaf-1/);
  assert.match(declared, /state.writeCheckChecked.getOrElse/);
  assert.match(declared, /writeExecuteReceipt = Some\(value.values.result\)/);
  assert.match(declared, /case value: CheckQuantity.Outcome.Offline => throw new IllegalStateException/);
  assert.match(declared, /case value: Fulfill.Outcome.Uncertain => throw new IllegalStateException/);
  assert.match(declared, /case Status.Stopped => Stopped\(state, state.stoppedStep.get, state.code.get, state.reason.get\)/);
  assert.match(declared, /def behavior\(id: PersistenceId, leaves: Leaves\)/);
  assert.doesNotMatch(declared, /interpret: \(String, ByteString\)|executeBusiness|request: OperationProtocol.Request,\s*resolve:/);
});

test('managed typed adapter and bounded Host preserve exact request and read-only query (structural only)', () => {
  const input = modelFixture(); addRun(input);
  const { model, entries } = bodies(input);
  const codec = entries.find(e => e.path === model.symbols.codecs.path).content;
  const runtime = entries.find(e => e.path === model.symbols.runtime.path).content;
  const declared = runtime.slice(runtime.indexOf('object FulfillmentRun {'));
  assert.match(codec, /framed\[State\]\("fulfillment.request", "request-v2", "request"\)/);
  assert.match(declared, /def buildRequest\(state: State\): Fulfill.Request/);
  assert.match(declared, /state.input.transactionId/);
  assert.match(declared, /val effectKey = BinaryCodecs.identityDigest\(Vector\(definition.id.getBytes\("UTF-8"\).toVector, state.runId.getBytes\("UTF-8"\).toVector, "fulfill-request".getBytes\("UTF-8"\).toVector,/);
  assert.match(declared, /codecs.idempotencyKey.encode\(state.input.transactionId\)/);
  assert.doesNotMatch(declared, /ProtocolDigest/);
  assert.doesNotMatch(declared, /val effectKey = BinaryCodecs.digest/);
  assert.match(declared, /require\(request == operation\(state\), "managed operation pins\/bytes mismatch"\)/);
  assert.match(declared, /value.request == expected/);
  assert.match(declared, /value.bytes == codecs.outcome.encode\(value.outcome\)/);
  assert.match(declared, /leaf.validateEvidence\(expected, value\)/);
  assert.match(declared, /Observation.NotFound => OperationProtocol.Unknown/);
  assert.doesNotMatch(declared, /SafeToSubmit/);
  assert.match(declared, /OperationSettings.fromConfig\(system.settings.config\)/);
  assert.match(declared, /PersistentOperation.behavior/);
  assert.match(declared, /new ManagedOperations\(resolve, settings\)/);
  assert.match(declared, /private val activePort = RunSubmissionPort\(resolve _, queryTimeout\)/);
  assert.match(declared, /val submissionPort: RunSubmissionPort = new RunSubmissionPort/);
  assert.match(declared, /runs.get\(value.runId\)/);
  assert.match(declared, /case Some\(\(prior, _\)\) if prior == value => activePort.query\(value\)/);
  assert.match(declared, /case None => Future.successful\(RunProtocol.Unavailable/);
  assert.match(declared, /view.identity.contains\(wanted\) && view.runId.contains\(submission.runId\)/);
  assert.match(declared, /state.forall\(s => s.runId == original.runId && s.input == original.input\)/);
  const query = declared.slice(declared.indexOf('    def query(runId: String'));
  assert.match(query, /submissionPort.query\(value\)/);
  assert.doesNotMatch(query, /\.ensure\(/);
});

test('explicit Run recovery is bounded and gates activation on durable identity, authority and original grant (structural only)', () => {
  const input = modelFixture(); managedRunArea(input, 0);
  const { model, entries } = bodies(input);
  const text = symbol => entries.find(e => e.path === model.symbols[symbol].path).content;
  const workflow = text('workflow'), root = text('root'), runtime = text('runtime');
  const preflight = workflow.slice(workflow.indexOf('  def authorizeRunRecovery'), workflow.indexOf('  private def recoveryProgress'));
  assert.match(preflight, /BatchCodec.manifestFromBytes\(BatchCodec.manifestToBytes\(m\)\) == m/);
  assert.match(preflight, /ports.associations.query\(association.item\)/);
  assert.match(preflight, /saved.contains\(association\)/);
  assert.match(preflight, /ports.recoveryAuthorization.authorize\(association.saga, authorization\)/);
  assert.doesNotMatch(preflight, /\.ensure\(|\.reconcile\(|\.operation\(/);
  assert.match(workflow, /if \(submit\) ports.associations.ensure\(association\)/);
  assert.match(workflow, /else ports.associations.query\(itemId\)/);
  assert.ok(workflow.indexOf('require(confirmed == association') < workflow.indexOf('fulfillmentRunHost.ensure'));
  assert.match(workflow, /def reactivate\(m: BatchManifest, authorization: String\): Future\[Either\[String, Boolean\]\]/);
  assert.match(workflow, /items.forall\(_\.result.terminal\)/);
  assert.match(root, /def resumeRuns\(/);
  assert.match(root, /case Right\(true\) => workflow.reconcile/);
  assert.match(root, /case Right\(false\) => Future.successful\(BatchProtocol.Current\(view\)\)/);
  const recovery = root.slice(root.indexOf('  def recoverRuns'), root.indexOf('  def close'));
  for (const check of ['program.authorizeRunRecovery', 'workflow.job', 'batch.phase == "Blocked"', 'workflow.resourceDomain', 'program.reactivate', 'workflow.reconcile'])
    assert.ok(recovery.includes(check), check);
  assert.ok(recovery.indexOf('program.authorizeRunRecovery') < recovery.indexOf('workflow.job'));
  assert.ok(recovery.indexOf('workflow.resourceDomain') < recovery.indexOf('program.reactivate'));
  assert.match(recovery, /batch.itemIds == manifest.items.map\(_\.itemId\)/);
  assert.match(recovery, /batch.reservationId.contains\(manifest.reservationId\) && batch.deliveryId.contains\(manifest.deliveryId\)/);
  assert.match(recovery, /grant.ownerOperationKey == manifest.operationKey && grant.units == program.definition.byId\(manifest.area\).resources/);
  assert.match(recovery, /item.sequence == original.sequence && item.itemId == original.itemId/);
  assert.doesNotMatch(recovery, /\.operation\(|\.ensure\(|sealedAt|Thread.sleep|scheduleOnce|scheduleAtFixedRate|while\s*\(/);
  const host = runtime.slice(runtime.indexOf('  final class Host'));
  assert.match(host, /def reconcile\(runId: String, input: Input\): Future\[Either\[String, Option\[Completion\]\]\]/);
  assert.match(host, /case terminal @ Right\(Some\(_\)\) => Future.successful\(terminal\)/);
  assert.match(host, /case failed @ Left\(_\) => Future.successful\(failed\)/);
  assert.match(host, /val request = operation\(initial\(runId, input\)\)/);
  assert.match(host, /current.requestDigest.contains\(request.fingerprint\)/);
  assert.match(host, /if \(current.phase == OperationProtocol.Phase.Blocked\)/);
  assert.equal((host.match(/OperationProtocol.Reconcile\(/g) ?? []).length, 1);
  assert.doesNotMatch(host, /ProtocolDigest|Thread.sleep|scheduleOnce|scheduleAtFixedRate|while\s*\(/);
  const noRun = bodies(modelFixture());
  assert.ok(!noRun.entries.some(e => /def recoverRuns|def reactivate|def authorizeRunRecovery/.test(e.content)));
});

test('public producer rejects unverified compilation and capture contexts without executing accessors', () => {
  let called = 0;
  const raw = { compilation: { result: null, diagnostics: [] }, manifest, options: modelFixture().options };
  const context = Object.defineProperty({}, 'implementations', { enumerable: true, get() { called++; return {}; } });
  assert.equal(generate(raw, context).plan, null);
  assert.equal(called, 0);
  assert.equal(generate(raw, Object.create({ implementations: {}, outDir: '/tmp/out' })).plan, null);
  assert.equal(generate(raw, { implementations: {}, outDir: '/tmp/out' }).plan, null);
  assert.equal(generate(raw).plan, null);
});
