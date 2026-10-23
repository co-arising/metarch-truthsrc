// Pure compiler contract regressions only: no runtime, CLI, emitters or truth edits.
// Bank/Fab execution examples below are synthetic declarations, not runnable demos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileExecution } from '../lib/execution/compile.mjs';

const clone = (value) => structuredClone(value);
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
const cp = '/pipelines/0';
const ep = `${cp}/execution`;
const s0 = `${cp}/steps/0/execution`;
const s1 = `${cp}/steps/1/execution`;
const bp = '/pipelines/0';
const p0 = `${bp}/ports/0`;
const p1 = `${bp}/ports/1`;
const outcome = (code, kind) => ({
  code, kind,
  action: kind === 'success' || kind === 'resolved' ? 'continue'
    : kind === 'business-rejection' ? 'stop' : 'manual-recovery',
});
const port = (id, inputs, outputs, external = false) => ({
  id, implementation: `host.ports.${id}`, effect: external ? 'external' : 'pure',
  confirmation: external ? 'durable-ack' : 'checkpoint',
  idempotency: external ? { mode: 'keyed', key: 'key' } : { mode: 'none' },
  inputs: inputs.map(([slot, type]) => ({ slot, type })),
  outputs: outputs.map(([slot, type]) => ({ slot, type })),
  outcomes: [
    { code: 'Done', kind: 'success' },
    { code: 'AlreadyDone', kind: 'resolved' },
    { code: 'Rejected', kind: 'business-rejection' },
    { code: 'Failed', kind: 'infrastructure-failure' },
    ...(external ? [{ code: 'Uncertain', kind: 'unknown-effect' }] : []),
  ],
});
const step = (id, boundPort, reads, writes) => ({
  id, name: id,
  execution: {
    port: boundPort.id,
    reads: reads.map(([slot, ref, type]) => ({ slot, ref, type })),
    writes: writes.map(([id, slot, type, durability]) => ({ id, slot, type, durability })),
    outcomes: boundPort.outcomes.map(({ code, kind }) => outcome(code, kind)),
  },
});
function fixture(domain = 'Bank') {
  const fab = domain === 'Fab';
  const resultType = fab ? 'MeasurementRef' : 'BankClassification';
  const artifactType = fab ? 'OcapAckRef' : 'ChildArtifactRef';
  const first = port(fab ? 'Measure' : 'Classify', [
    ...(fab ? [['key', 'RunKey']] : []), ['source', 'SourceArtifactRef'],
  ], [['result', resultType]], fab);
  const second = port(fab ? 'ConfirmOcap' : 'WriteChildArtifact', [
    ['key', 'RunKey'], ['result', resultType],
  ], [['artifact', artifactType]], true);
  const id = fab ? 'fab-ocap' : 'bank-classification';
  return {
    canonical: {
      schemaVersion: 'truthsrc/v1', workshop: `${domain} compiler fixture`,
      pipelines: [{
        id, name: `${domain} declared contract`,
        description: 'Narrative content is not executable source code.',
        execution: {
          schemaVersion: 'truthsrc.execution/v1',
          inputs: [
            { id: 'runKey', type: 'RunKey', durability: 'start-record' },
            { id: 'source', type: 'SourceArtifactRef', durability: 'durable-reference' },
          ],
          outputs: [
            { id: 'result', ref: 'step:first:result', type: resultType },
            { id: 'artifact', ref: 'step:second:artifact', type: artifactType },
          ],
          recovery: {
            inputResponsibility: 'host', inputs: ['input:runKey', 'input:source'],
            planVersion: 'plan-v1', planCompatibility: 'exact', checkpoint: 'confirmed-prefix',
            unknownEffect: 'reconcile-before-resume', ownership: 'single-writer',
          },
          admission: { maxConcurrentRuns: 2, maxInFlightSteps: 1, maxItemsPerChunk: 128, maxInFlightChunks: 4 },
        },
        steps: [
          step('first', first, [
            ...(fab ? [['key', 'input:runKey', 'RunKey']] : []),
            ['source', 'input:source', 'SourceArtifactRef'],
          ], [['result', 'result', resultType, fab ? 'durable-reference' : 'checkpoint']]),
          step('second', second, [
            ['key', 'input:runKey', 'RunKey'], ['result', 'step:first:result', resultType],
          ], [['artifact', 'artifact', artifactType, 'durable-reference']]),
        ],
      }],
    },
    binding: {
      schemaVersion: 'truthsrc.execution-binding/v1',
      pipelines: [{
        pipelineId: id, engine: 'monarch-persistence/0.2.1', module: `host.${domain}Module`,
        codec: { id: `${domain}Codec`, version: 'v2', compatibleVersions: ['v1', 'v2'] },
        types: ['RunKey', 'SourceArtifactRef', resultType, artifactType].map((id) => ({ id, implementation: `host.types.${id}` })),
        ports: [first, second],
      }],
    },
  };
}
function success(canonical, binding) {
  const result = compileExecution(canonical, binding);
  assert.deepEqual(result.diagnostics, []);
  assert.notEqual(result.ir, null);
  assert.equal(result.ir.schemaVersion, 'truthsrc.execution/v1');
  for (const pipeline of result.ir.pipelines) assert.equal(pipeline.readiness, 'contract-only');
  return result;
}
function failure(canonical, binding, code, pointer, document = 'canonical') {
  const before = [JSON.stringify(canonical), JSON.stringify(binding)];
  freeze(canonical);
  freeze(binding);
  const result = compileExecution(canonical, binding);
  assert.equal(result.ir, null, 'any error must discard the entire IR, never return partial execution');
  assert.ok(result.diagnostics.length > 0);
  const diagnostic = result.diagnostics.find((entry) => entry.code === code
    && entry.source.document === document && entry.source.pointer === pointer);
  assert.ok(diagnostic, `missing ${code} at ${document}${pointer}: ${JSON.stringify(result.diagnostics)}`);
  assert.deepEqual([JSON.stringify(canonical), JSON.stringify(binding)], before, 'error paths must not mutate inputs');
  assert.deepEqual(compileExecution(canonical, binding), result, 'diagnostics must be deterministic');
  return diagnostic;
}
function rejects(name, document, pointer, value, code = 'EXEC_SCHEMA') {
  test(name, () => {
    const data = fixture();
    set(data[document], pointer, clone(value));
    failure(data.canonical, data.binding, code, pointer, document);
  });
}

for (const domain of ['Bank', 'Fab']) {
  test(`${domain}: declared contracts compile with finite outcomes and durable artifacts, never runnable`, () => {
    const { canonical, binding } = fixture(domain);
    const before = clone({ canonical, binding });
    freeze(canonical);
    freeze(binding);
    const { ir } = success(canonical, binding);
    assert.deepEqual({ canonical, binding }, before);
    const pipeline = ir.pipelines[0];
    assert.deepEqual(pipeline.inputs, canonical.pipelines[0].execution.inputs);
    assert.deepEqual(pipeline.outputs, canonical.pipelines[0].execution.outputs);
    assert.deepEqual(pipeline.recovery, canonical.pipelines[0].execution.recovery);
    assert.deepEqual(pipeline.admission, canonical.pipelines[0].execution.admission);
    assert.deepEqual(pipeline.binding, Object.fromEntries(Object.entries(binding.pipelines[0]).filter(([key]) => key !== 'pipelineId')));
    assert.deepEqual(pipeline.steps.map(({ ordinal }) => ordinal), [0, 1]);
    canonical.pipelines[0].steps.forEach((original, ordinal) => {
      assert.deepEqual(pipeline.steps[ordinal], { id: original.id, name: original.name, ordinal, ...original.execution });
    });
    assert.equal(pipeline.steps[1].writes[0].durability, 'durable-reference');
    assert.equal(pipeline.binding.ports[1].confirmation, 'durable-ack');
    assert.deepEqual(pipeline.steps[0].outcomes.map(({ kind, action }) => [kind, action]), [
      ['success', 'continue'], ['resolved', 'continue'], ['business-rejection', 'stop'],
      ['infrastructure-failure', 'manual-recovery'],
      ...(domain === 'Fab' ? [['unknown-effect', 'manual-recovery']] : []),
    ]);
    assert.deepEqual(ir.documentOnly, []);
    assert.deepEqual(compileExecution(clone(canonical), clone(binding)), { ir, diagnostics: [] });
    assert.equal(JSON.stringify(compileExecution(canonical, binding)), JSON.stringify({ ir, diagnostics: [] }));
  });
}

for (const domain of ['bank', 'fab']) {
  test(`${domain}: pinned legacy narrative pipelines remain document-only and byte-preserved`, () => {
    const bytes = readFileSync(new URL(`./fixtures/${domain}.canonical.json`, import.meta.url), 'utf8');
    const canonical = freeze(JSON.parse(bytes));
    const before = JSON.stringify(canonical);
    assert.ok(canonical.pipelines.length > 0);
    assert.ok(canonical.pipelines.every((pipeline) => !Object.hasOwn(pipeline, 'execution')));
    const { ir } = success(canonical);
    assert.deepEqual(ir.pipelines, []);
    assert.deepEqual(ir.documentOnly.map(({ id, reason }) => ({ id, reason })), canonical.pipelines.map(({ id }) => ({ id, reason: 'execution-not-declared' })));
    ir.documentOnly.forEach(({ source }, ordinal) => {
      assert.deepEqual(source, { document: 'canonical', pointer: `/pipelines/${ordinal}`, file: null, atom: null, path: `/pipelines/${ordinal}`, location: null });
    });
    assert.equal(JSON.stringify(canonical), before);
    assert.equal(readFileSync(new URL(`./fixtures/${domain}.canonical.json`, import.meta.url), 'utf8'), bytes);
  });
}

test('omitted/empty pipelines and omitted binding are valid narrative envelopes', () => {
  for (const canonical of [{ schemaVersion: 'truthsrc/v1', workshop: 'No pipelines' }, { schemaVersion: 'truthsrc/v1', workshop: 'Empty', pipelines: [] }]) {
    assert.deepEqual(success(canonical).ir.pipelines, []);
    assert.deepEqual(success(canonical, { schemaVersion: 'truthsrc.execution-binding/v1', pipelines: [] }).ir.documentOnly, []);
  }
});
test('legacy text IDs and unknown narrative fields stay opaque; only explicit execution opts in', () => {
  const canonical = {
    schemaVersion: 'truthsrc/v1', workshop: 'Opaque narrative', otherProduct: { execution: 'not a declaration' },
    pipelines: [{ id: 'Legacy / text id', name: 'Legacy', futureNarrative: { whatever: true }, steps: [{ id: 'Step / text id', name: 'Step', retry: 'narrative only' }] }],
  };
  assert.equal(success(freeze(canonical)).ir.documentOnly[0].id, 'Legacy / text id');
});
test('mixed narrative/execution pipelines preserve original ordinals in source maps', () => {
  const { canonical, binding } = fixture();
  canonical.pipelines.unshift({ id: 'Narrative / one', name: 'Narrative', steps: [{ id: 'one', name: 'one' }] });
  const { ir } = success(freeze(canonical), freeze(binding));
  assert.equal(ir.pipelines.length, 1);
  assert.equal(ir.documentOnly.length, 1);
  assert.equal(ir.sourceMap['/pipelines/0/id'].pointer, '/pipelines/1/id');
  assert.equal(ir.sourceMap['/pipelines/0/steps/1/ordinal'].pointer, '/pipelines/1/steps/1');
});
test('success results never retain input object/array or source-hint references', () => {
  const { canonical, binding } = fixture();
  binding.sourceMap = { canonical: { [cp]: { file: 'bank.pipeline.yaml', location: { line: 10, column: 2 } } } };
  const result = success(canonical, binding);
  const before = clone(result);
  const inputs = new Set();
  const visit = (value, fn) => {
    if (value && typeof value === 'object') { fn(value); Object.values(value).forEach((item) => visit(item, fn)); }
  };
  visit(canonical, (value) => inputs.add(value));
  visit(binding, (value) => inputs.add(value));
  visit(result, (value) => assert.ok(!inputs.has(value), 'no borrowed input container'));
  canonical.pipelines[0].execution.inputs[0].type = 'Mutated';
  binding.pipelines[0].ports[0].outcomes[0].code = 'Mutated';
  binding.sourceMap.canonical[cp].location.line = 999;
  assert.deepEqual(result, before);
});
test('durable-reference initial keys are also accepted, without certifying host durability', () => {
  const { canonical, binding } = fixture();
  canonical.pipelines[0].execution.inputs[0].durability = 'durable-reference';
  success(freeze(canonical), freeze(binding));
});
test('business rejection may explicitly request manual recovery', () => {
  const { canonical, binding } = fixture();
  canonical.pipelines[0].steps.forEach((step) => { step.execution.outcomes[2].action = 'manual-recovery'; });
  success(canonical, binding);
});
test('unused well-formed ports remain declarations, not invoked implementations', () => {
  const { canonical, binding } = fixture();
  binding.pipelines[0].ports.push(port('Unused', [], []));
  binding.pipelines[0].module = 'nonexistent.module';
  binding.pipelines[0].types[0].implementation = 'nonexistent.Type';
  assert.equal(success(canonical, binding).ir.pipelines[0].binding.ports.length, 3);
});
test('zero slot/write/output lists and initial-input final outputs are supported', () => {
  const { canonical, binding } = fixture();
  const noSlots = port('NoSlots', [], []);
  binding.pipelines[0].ports = [noSlots];
  canonical.pipelines[0].steps = [step('empty', noSlots, [], [])];
  canonical.pipelines[0].execution.outputs = [];
  success(canonical, binding);
  canonical.pipelines[0].execution.outputs = [{ id: 'sourceAgain', type: 'SourceArtifactRef', ref: 'input:source' }];
  success(canonical, binding);
});
test('identical step/slot/type IDs in separate pipelines are scoped, not global duplicates', () => {
  const bank = fixture();
  const fab = fixture('Fab');
  bank.canonical.pipelines.push(fab.canonical.pipelines[0]);
  bank.binding.pipelines.push(fab.binding.pipelines[0]);
  assert.equal(success(bank.canonical, bank.binding).ir.pipelines.length, 2);
});

for (const [document, pointer] of [
  ['canonical', ep], ['canonical', `${ep}/recovery`], ['canonical', `${ep}/admission`],
  ['canonical', `${ep}/inputs/0`], ['canonical', `${ep}/outputs/0`],
  ['canonical', s0], ['canonical', `${s0}/reads/0`], ['canonical', `${s0}/writes/0`], ['canonical', `${s0}/outcomes/0`],
  ['binding', ''], ['binding', bp], ['binding', `${bp}/codec`], ['binding', `${bp}/types/0`],
  ['binding', p0], ['binding', `${p0}/idempotency`], ['binding', `${p0}/inputs/0`],
  ['binding', `${p0}/outputs/0`], ['binding', `${p0}/outcomes/0`],
]) {
  rejects(`unknown execution/binding key rejected at ${document}${pointer}`, document, `${pointer}/unsupported`, { enabled: true });
}
for (const [document, pointer, value] of [
  ['canonical', '/schemaVersion', 'truthsrc/v2'],
  ['canonical', `${ep}/schemaVersion`, 'truthsrc.execution/v2'],
  ['binding', '/schemaVersion', 'truthsrc.execution-binding/v2'],
  ['binding', `${bp}/engine`, 'monarch-persistence/0.2'],
  ['canonical', `${ep}/recovery/planCompatibility`, 'compatible'],
  ['canonical', `${ep}/recovery/checkpoint`, 'all-writes'],
  ['canonical', `${ep}/recovery/unknownEffect`, 'resume-anyway'],
  ['canonical', `${ep}/recovery/ownership`, 'multi-writer'],
  ['canonical', `${ep}/recovery/inputResponsibility`, 'compiler'],
]) rejects(`unsupported version/constant ${document}${pointer}`, document, pointer, value);

for (const [document, pointer, value] of [
  ['canonical', '', null], ['canonical', '', []], ['canonical', '/workshop', ''], ['canonical', '/workshop', ' \t\n'],
  ['canonical', '/workshop', 42], ['canonical', '/pipelines', {}], ['canonical', `${cp}/steps`, []],
  ['canonical', `${cp}/execution`, null], ['canonical', `${cp}/execution`, 'narrative'],
  ['canonical', `${s0}`, null], ['canonical', `${s0}/reads`, {}], ['canonical', `${s0}/writes/0`, null],
  ['canonical', `${s0}/outcomes`, []], ['canonical', `${ep}/inputs`, []],
  ['canonical', `${ep}/inputs/0/durability`, 'memory'], ['canonical', `${s0}/writes/0/durability`, 'memory'],
  ['binding', '', null], ['binding', '', []], ['binding', `${bp}/types`, []], ['binding', `${bp}/ports`, []],
  ['binding', `${bp}/module`, ''], ['binding', `${bp}/types/0/implementation`, '\t'],
  ['binding', `${p0}/inputs`, {}], ['binding', `${p0}/outcomes`, []],
  ['binding', `${p0}/effect`, 'transactional'], ['binding', `${p0}/confirmation`, 'ack'],
  ['binding', `${p0}/idempotency/mode`, 'automatic'], ['binding', '/sourceMap', null],
]) {
  test(`schema shape rejects ${document}${pointer || '/'} = ${JSON.stringify(value)}`, () => {
    const data = fixture();
    if (!pointer) data[document] = clone(value); else set(data[document], pointer, clone(value));
    failure(data.canonical, data.binding, 'EXEC_SCHEMA', pointer, document);
  });
}
for (const [document, pointer] of [
  ['canonical', '/schemaVersion'], ['canonical', '/workshop'], ['canonical', `${cp}/id`], ['canonical', `${cp}/name`], ['canonical', `${cp}/steps`],
  ['canonical', `${cp}/steps/0/id`], ['canonical', `${cp}/steps/0/name`],
  ...['schemaVersion', 'inputs', 'outputs', 'recovery', 'admission'].map((key) => ['canonical', `${ep}/${key}`]),
  ...['port', 'reads', 'writes', 'outcomes'].map((key) => ['canonical', `${s0}/${key}`]),
  ...['id', 'type', 'durability'].map((key) => ['canonical', `${ep}/inputs/0/${key}`]),
  ...['id', 'ref', 'type'].map((key) => ['canonical', `${ep}/outputs/0/${key}`]),
  ...['slot', 'ref', 'type'].map((key) => ['canonical', `${s0}/reads/0/${key}`]),
  ...['id', 'slot', 'type', 'durability'].map((key) => ['canonical', `${s0}/writes/0/${key}`]),
  ...['code', 'kind', 'action'].map((key) => ['canonical', `${s0}/outcomes/0/${key}`]),
  ...['inputResponsibility', 'inputs', 'planVersion', 'planCompatibility', 'checkpoint', 'unknownEffect', 'ownership'].map((key) => ['canonical', `${ep}/recovery/${key}`]),
  ...['maxConcurrentRuns', 'maxInFlightSteps', 'maxItemsPerChunk', 'maxInFlightChunks'].map((key) => ['canonical', `${ep}/admission/${key}`]),
  ['binding', '/schemaVersion'], ['binding', '/pipelines'],
  ...['pipelineId', 'engine', 'module', 'codec', 'types', 'ports'].map((key) => ['binding', `${bp}/${key}`]),
  ...['id', 'version', 'compatibleVersions'].map((key) => ['binding', `${bp}/codec/${key}`]),
  ...['id', 'implementation'].map((key) => ['binding', `${bp}/types/0/${key}`]),
  ...['id', 'implementation', 'effect', 'confirmation', 'idempotency', 'inputs', 'outputs', 'outcomes'].map((key) => ['binding', `${p0}/${key}`]),
  ['binding', `${p0}/idempotency/mode`],
  ...['slot', 'type'].map((key) => ['binding', `${p0}/inputs/0/${key}`]),
  ...['slot', 'type'].map((key) => ['binding', `${p0}/outputs/0/${key}`]),
  ...['code', 'kind'].map((key) => ['binding', `${p0}/outcomes/0/${key}`]),
]) {
  test(`required field ${document}${pointer} cannot be omitted`, () => {
    const data = fixture();
    remove(data[document], pointer);
    failure(data.canonical, data.binding, 'EXEC_SCHEMA', pointer, document);
  });
}

test('binding omitted for an execution pipeline is missing, not narrative fallback', () => {
  const { canonical } = fixture();
  failure(canonical, undefined, 'EXEC_BINDING_MISSING', ep);
});
test('empty binding list is missing, not partial success', () => {
  const { canonical, binding } = fixture();
  binding.pipelines = [];
  failure(canonical, binding, 'EXEC_BINDING_MISSING', ep);
});
test('a step execution without pipeline execution fails closed', () => {
  const { canonical } = fixture();
  delete canonical.pipelines[0].execution;
  failure(canonical, undefined, 'EXEC_ORPHAN_STEP', s0);
});
test('an execution pipeline cannot omit a step declaration', () => {
  const { canonical, binding } = fixture();
  delete canonical.pipelines[0].steps[0].execution;
  failure(canonical, binding, 'EXEC_SCHEMA', s0);
});
for (const narrative of [true, false]) {
  test(`binding cannot target ${narrative ? 'document-only' : 'missing'} pipeline`, () => {
    const { canonical, binding } = fixture();
    canonical.pipelines = narrative ? [{ id: binding.pipelines[0].pipelineId, name: 'Narrative', steps: [{ id: 'one', name: 'One' }] }] : [];
    failure(canonical, binding, 'EXEC_BINDING_ORPHAN', `${bp}/pipelineId`, 'binding');
  });
}

for (const [document, pointer, key] of [
  ['canonical', '/pipelines', 'id'], ['canonical', `${cp}/steps`, 'id'],
  ['canonical', `${ep}/inputs`, 'id'], ['canonical', `${ep}/outputs`, 'id'],
  ['canonical', `${s0}/writes`, 'id'], ['canonical', `${s0}/reads`, 'slot'],
  ['canonical', `${s0}/writes`, 'slot'], ['canonical', `${s0}/outcomes`, 'code'],
  ['binding', '/pipelines', 'pipelineId'], ['binding', `${bp}/types`, 'id'], ['binding', `${bp}/ports`, 'id'],
  ['binding', `${p0}/inputs`, 'slot'], ['binding', `${p0}/outputs`, 'slot'], ['binding', `${p0}/outcomes`, 'code'],
]) {
  test(`duplicate ${key} rejected in ${document}${pointer}, with original declaration source`, () => {
    const data = fixture();
    const rows = at(data[document], pointer);
    const duplicate = clone(rows[0]);
    // Isolate duplicate slots from duplicate write IDs (and vice versa).
    if (pointer === `${s0}/writes`) duplicate[key === 'id' ? 'slot' : 'id'] = 'Other';
    rows.push(duplicate);
    const diagnostic = failure(data.canonical, data.binding, 'EXEC_DUPLICATE', `${pointer}/${rows.length - 1}/${key}`, document);
    assert.equal(diagnostic.related[0].pointer, `${pointer}/0/${key}`);
    assert.equal(diagnostic.related[0].document, document);
  });
}
for (const [document, pointer] of [
  ['canonical', `${ep}/inputs/0/type`], ['canonical', `${s0}/reads/0/type`],
  ['canonical', `${s0}/writes/0/type`], ['canonical', `${ep}/outputs/0/type`],
  ['binding', `${p0}/inputs/0/type`], ['binding', `${p0}/outputs/0/type`],
]) rejects(`unbound nominal type ${document}${pointer}`, document, pointer, 'Unbound', 'EXEC_TYPE_UNKNOWN');
for (const pointer of [`${s0}/reads/0/type`, `${s0}/writes/0/type`, `${ep}/outputs/0/type`]) {
  rejects(`nominal mismatch ${pointer}`, 'canonical', pointer, 'RunKey', 'EXEC_TYPE_MISMATCH');
}
for (const direction of ['reads', 'writes']) {
  test(`missing port ${direction} slot is not an implicit default`, () => {
    const { canonical, binding } = fixture();
    canonical.pipelines[0].steps[0].execution[direction] = [];
    failure(canonical, binding, 'EXEC_PORT_SLOT_COVERAGE', `${s0}/${direction}`);
  });
  rejects(`undeclared port ${direction} slot`, 'canonical', `${s0}/${direction}/0/slot`, 'NotDeclared', 'EXEC_PORT_SLOT_COVERAGE');
}
for (const [pointer, ref, code] of [
  [`${s0}/reads/0/ref`, 'input:missing', 'EXEC_REF_UNKNOWN'],
  [`${s0}/reads/0/ref`, 'step:missing:write', 'EXEC_REF_UNKNOWN'],
  [`${s0}/reads/0/ref`, 'step:first:result', 'EXEC_REF_FORWARD'],
  [`${s0}/reads/0/ref`, 'step:second:artifact', 'EXEC_REF_FORWARD'],
  [`${ep}/outputs/0/ref`, 'step:second:missing', 'EXEC_REF_UNKNOWN'],
  [`${ep}/outputs/0/ref`, 'input:missing', 'EXEC_REF_UNKNOWN'],
]) rejects(`dataflow ${code}: ${ref} at ${pointer}`, 'canonical', pointer, ref, code);
rejects('unknown port binding', 'canonical', `${s0}/port`, 'UnboundPort', 'EXEC_PORT_UNKNOWN');
test('unknown port does not bypass reference and illegal-action checks', () => {
  const { canonical, binding } = fixture();
  canonical.pipelines[0].steps[0].execution.port = 'UnboundPort';
  canonical.pipelines[0].steps[0].execution.reads[0].ref = 'input:missing';
  canonical.pipelines[0].steps[0].execution.outcomes[3].action = 'continue';
  const result = compileExecution(freeze(canonical), freeze(binding));
  assert.equal(result.ir, null);
  for (const code of ['EXEC_PORT_UNKNOWN', 'EXEC_REF_UNKNOWN', 'EXEC_OUTCOME_ACTION']) assert.ok(result.diagnostics.some((d) => d.code === code));
});

test('external keyed idempotency cannot use a preceding checkpoint write', () => {
  const { canonical, binding } = fixture();
  const write = { id: 'ephemeralKey', slot: 'newKey', type: 'RunKey', durability: 'checkpoint' };
  canonical.pipelines[0].steps[0].execution.writes.push(write);
  binding.pipelines[0].ports[0].outputs.push({ slot: 'newKey', type: 'RunKey' });
  canonical.pipelines[0].steps[1].execution.reads[0].ref = 'step:first:ephemeralKey';
  failure(canonical, binding, 'EXEC_EXTERNAL_KEY_SOURCE', `${s1}/reads/0/ref`);
});
test('even a durable-reference step write is not a durable initial idempotency key', () => {
  const { canonical, binding } = fixture();
  canonical.pipelines[0].steps[0].execution.writes.push({ id: 'newKey', slot: 'newKey', type: 'RunKey', durability: 'durable-reference' });
  binding.pipelines[0].ports[0].outputs.push({ slot: 'newKey', type: 'RunKey' });
  canonical.pipelines[0].steps[1].execution.reads[0].ref = 'step:first:newKey';
  failure(canonical, binding, 'EXEC_EXTERNAL_KEY_SOURCE', `${s1}/reads/0/ref`);
});
rejects('external effect cannot claim checkpoint-only confirmation', 'binding', `${p1}/confirmation`, 'checkpoint', 'EXEC_EXTERNAL_CONFIRMATION');
test('external effect cannot opt out of idempotency', () => {
  const { canonical, binding } = fixture();
  binding.pipelines[0].ports[1].idempotency = { mode: 'none' };
  failure(canonical, binding, 'EXEC_EXTERNAL_IDEMPOTENCY', `${p1}/idempotency/mode`, 'binding');
});
rejects('keyed idempotency requires a declared input slot', 'binding', `${p1}/idempotency/key`, 'missing', 'EXEC_IDEMPOTENCY_KEY');
test('keyed idempotency cannot omit key', () => {
  const { canonical, binding } = fixture();
  delete binding.pipelines[0].ports[1].idempotency.key;
  failure(canonical, binding, 'EXEC_IDEMPOTENCY_KEY', `${p1}/idempotency/key`, 'binding');
});
rejects('none idempotency cannot retain a key', 'binding', `${p0}/idempotency/key`, 'source', 'EXEC_IDEMPOTENCY_KEY');
test('external unknown-effect declaration is mandatory even when the step also omits it', () => {
  const { canonical, binding } = fixture();
  binding.pipelines[0].ports[1].outcomes.pop();
  canonical.pipelines[0].steps[1].execution.outcomes.pop();
  failure(canonical, binding, 'EXEC_EXTERNAL_UNKNOWN_EFFECT', `${p1}/outcomes`, 'binding');
});
test('unused external port still requires unknown-effect protection', () => {
  const { canonical, binding } = fixture();
  const unused = port('UnusedExternal', [['key', 'RunKey']], [], true);
  unused.outcomes.pop();
  binding.pipelines[0].ports.push(unused);
  failure(canonical, binding, 'EXEC_EXTERNAL_UNKNOWN_EFFECT', `${bp}/ports/2/outcomes`, 'binding');
});
for (const kind of ['success', 'infrastructure-failure']) {
  test(`every port, including pure ports, must declare ${kind}`, () => {
    const { canonical, binding } = fixture();
    binding.pipelines[0].ports[0].outcomes = binding.pipelines[0].ports[0].outcomes.filter((entry) => entry.kind !== kind);
    failure(canonical, binding, 'EXEC_PORT_OUTCOME_REQUIRED', `${p0}/outcomes`, 'binding');
  });
}
for (const [pointer, value, code] of [
  [`${s1}/outcomes/4/code`, 'Unexpected', 'EXEC_OUTCOME_COVERAGE'],
  [`${s1}/outcomes/4/kind`, 'success', 'EXEC_OUTCOME_KIND'],
]) rejects(`outcome equality ${pointer}`, 'canonical', pointer, value, code);
test('step must explicitly cover every port outcome, including unknown-effect', () => {
  const { canonical, binding } = fixture();
  canonical.pipelines[0].steps[1].execution.outcomes.pop();
  failure(canonical, binding, 'EXEC_OUTCOME_COVERAGE', `${s1}/outcomes`);
});
for (const [ordinal, kind] of ['success', 'resolved', 'business-rejection', 'infrastructure-failure', 'unknown-effect'].entries()) {
  const allowed = kind === 'success' || kind === 'resolved' ? ['continue'] : kind === 'business-rejection' ? ['stop', 'manual-recovery'] : ['manual-recovery'];
  for (const action of ['continue', 'stop', 'manual-recovery'].filter((entry) => !allowed.includes(entry))) {
    rejects(`${kind} cannot ${action}`, 'canonical', `${s1}/outcomes/${ordinal}/action`, action, 'EXEC_OUTCOME_ACTION');
  }
}
for (const action of ['retry', 'compensate', 'default', 'evalPolicy()']) {
  rejects(`v1 has no arbitrary action ${action}`, 'canonical', `${s0}/outcomes/0/action`, action);
}
rejects('unknown outcome kind is not a new policy surface', 'canonical', `${s0}/outcomes/0/kind`, 'retryable');

test('recovery must cover all initial inputs', () => {
  const { canonical, binding } = fixture();
  canonical.pipelines[0].execution.recovery.inputs = ['input:runKey'];
  failure(canonical, binding, 'EXEC_RECOVERY_COVERAGE', `${ep}/recovery/inputs`);
});
rejects('recovery cannot include an undeclared initial input', 'canonical', `${ep}/recovery/inputs/0`, 'input:missing', 'EXEC_RECOVERY_COVERAGE');
rejects('recovery cannot include later step outputs', 'canonical', `${ep}/recovery/inputs/0`, 'step:first:result');
rejects('recovery input list cannot be empty', 'canonical', `${ep}/recovery/inputs`, []);
rejects('recovery inputs must be unique', 'canonical', `${ep}/recovery/inputs/1`, 'input:runKey');
for (const key of ['maxConcurrentRuns', 'maxItemsPerChunk', 'maxInFlightChunks']) {
  for (const value of [0, -1, 1.5, 2147483648, Infinity, NaN, '1', null]) {
    rejects(`admission ${key} rejects ${String(value)}`, 'canonical', `${ep}/admission/${key}`, value);
  }
}
for (const value of [0, 2, '1', true, null]) rejects(`checkpoint window must be exactly one, not ${String(value)}`, 'canonical', `${ep}/admission/maxInFlightSteps`, value);
test('admission accepts the finite inclusive integer bounds', () => {
  const { canonical, binding } = fixture();
  Object.assign(canonical.pipelines[0].execution.admission, { maxConcurrentRuns: 1, maxItemsPerChunk: 2147483647, maxInFlightChunks: 2147483647 });
  success(canonical, binding);
});
rejects('codec compatible versions must contain current version', 'binding', `${bp}/codec/compatibleVersions`, ['v1'], 'EXEC_CODEC_VERSION');
rejects('codec compatible versions cannot be empty', 'binding', `${bp}/codec/compatibleVersions`, []);
rejects('codec compatible versions must be unique', 'binding', `${bp}/codec/compatibleVersions/1`, 'v1');
for (const pointer of [`${bp}/codec/id`, `${bp}/codec/version`, `${bp}/codec/compatibleVersions/0`]) {
  for (const value of ['', '1', 'v 1', 'host.codec()', null, 1]) rejects(`codec nominal ID ${pointer} rejects ${JSON.stringify(value)}`, 'binding', pointer, value);
}

for (const [document, pointer] of [
  ['canonical', `${cp}/id`], ['canonical', `${cp}/steps/0/id`], ['canonical', `${ep}/inputs/0/id`],
  ['binding', `${bp}/codec/id`], ['binding', `${bp}/codec/version`], ['binding', `${bp}/codec/compatibleVersions/0`],
  ['binding', `${bp}/types/0/id`], ['binding', `${p0}/id`], ['binding', `${p0}/inputs/0/slot`],
]) {
  for (const ending of ['\n', '\r', ' ', ' ']) {
    test(`nominal IDs reject final ${JSON.stringify(ending)} at ${document}${pointer}`, () => {
      const data = fixture();
      set(data[document], pointer, at(data[document], pointer) + ending);
      failure(data.canonical, data.binding, 'EXEC_SCHEMA', pointer, document);
    });
  }
}
for (const pointer of [`${s0}/reads/0/ref`, `${ep}/outputs/0/ref`, `${ep}/recovery/inputs/0`]) {
  test(`reference grammar rejects final newline at ${pointer}`, () => {
    const { canonical, binding } = fixture();
    set(canonical, pointer, at(canonical, pointer) + '\n');
    failure(canonical, binding, 'EXEC_SCHEMA', pointer);
  });
}
for (const value of ['source', 'input:', 'input:source.extra:code', 'step:first', 'step:first:result:extra', 'input:source + expr()']) {
  rejects(`reference grammar rejects ${value}`, 'canonical', `${s0}/reads/0/ref`, value);
}

test('without source hints diagnostics do not invent file/atom/line/column', () => {
  const { canonical, binding } = fixture();
  canonical.pipelines[0].steps[0].execution.reads[0].ref = 'input:missing';
  assert.deepEqual(failure(canonical, binding, 'EXEC_REF_UNKNOWN', `${s0}/reads/0/ref`).source, {
    document: 'canonical', pointer: `${s0}/reads/0/ref`, file: null, atom: null, path: `${s0}/reads/0/ref`, location: null,
  });
});
test('exact hints win over ancestors; related type diagnostics preserve their own source', () => {
  const { canonical, binding } = fixture();
  const pointer = `${s0}/reads/0/type`;
  binding.sourceMap = {
    canonical: {
      [cp]: { file: 'bank.pipeline.yaml', atom: 'bank-pipeline', path: '/payload', location: { line: 10, column: 1 } },
      [pointer]: { file: 'bank.pipeline.yaml', atom: 'bank-read', path: '/payload/read/type', location: { line: 31, column: 9 } },
    },
    binding: { [`${p0}/inputs/0/type`]: { file: 'bank.binding.json', path: '/ports/classify/source/type', location: { line: 4, column: 3 } } },
  };
  set(canonical, pointer, 'RunKey');
  const diagnostic = failure(canonical, binding, 'EXEC_TYPE_MISMATCH', pointer);
  assert.deepEqual(diagnostic.source, { document: 'canonical', pointer, file: 'bank.pipeline.yaml', atom: 'bank-read', path: '/payload/read/type', location: { line: 31, column: 9 } });
  const result = compileExecution(canonical, binding);
  const related = result.diagnostics.flatMap((entry) => entry.related ?? []).find((entry) => entry.document === 'binding');
  assert.deepEqual(related, { document: 'binding', pointer: `${p0}/inputs/0/type`, file: 'bank.binding.json', atom: null, path: '/ports/classify/source/type', location: { line: 4, column: 3 } });
});
test('ancestor hints retain the supplied anchor location, never fabricate child line offsets', () => {
  const { canonical, binding } = fixture();
  binding.sourceMap = { canonical: { [cp]: { file: 'bank.pipeline.yaml', atom: 'pipeline', path: '/payload', location: { line: 20, column: 2 } } } };
  const { ir } = success(freeze(canonical), freeze(binding));
  assert.deepEqual(ir.sourceMap['/pipelines/0/steps/0/reads/0/ref'], {
    document: 'canonical', pointer: `${s0}/reads/0/ref`, file: 'bank.pipeline.yaml', atom: 'pipeline', path: '/payload/steps/0/execution/reads/0/ref', location: { line: 20, column: 2 },
  });
  assert.equal(ir.sourceMap['/pipelines/0/steps/0/ordinal'].pointer, `${cp}/steps/0`);
  assert.equal(ir.sourceMap['/pipelines/0/readiness'].pointer, ep);
});
test('hints without locations keep location null, and root hints map child paths', () => {
  const { canonical, binding } = fixture();
  binding.sourceMap = { canonical: { '': { file: 'canonical.json', path: '/payload' } }, binding: { '': { file: 'binding.json' } } };
  const { ir } = success(canonical, binding);
  assert.equal(ir.sourceMap['/pipelines/0/inputs/0/id'].path, `/payload${ep}/inputs/0/id`);
  assert.equal(ir.sourceMap['/pipelines/0/inputs/0/id'].location, null);
  assert.equal(ir.sourceMap['/pipelines/0/binding/module'].file, 'binding.json');
});
test('every IR value has a source-map entry, including derived containers', () => {
  const { canonical, binding } = fixture();
  const { ir } = success(canonical, binding);
  const visit = (value, pointer = '') => {
    assert.ok(Object.hasOwn(ir.sourceMap, pointer), `unmapped IR pointer ${pointer}`);
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (!pointer && key === 'sourceMap') continue; // the provenance index does not recursively map itself
        visit(item, `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
      }
    }
  };
  visit(ir);
});
for (const [name, sourceMap, pointer] of [
  ['unknown document', { other: {} }, '/sourceMap/other'],
  ['invalid pointer', { canonical: { 'not/a/pointer': { file: 'x' } } }, '/sourceMap/canonical/not~1a~1pointer'],
  ['bare final newline pointer', { canonical: { '\n': { file: 'x' } } }, '/sourceMap/canonical/\n'],
  ['invalid pointer escape', { canonical: { '/bad~2': { file: 'x' } } }, '/sourceMap/canonical/~1bad~02'],
  ['missing file', { canonical: { [cp]: {} } }, `/sourceMap/canonical/~1pipelines~10/file`],
  ['blank file', { canonical: { [cp]: { file: ' ' } } }, `/sourceMap/canonical/~1pipelines~10/file`],
  ['unknown hint', { canonical: { [cp]: { file: 'x', guessedLine: 1 } } }, `/sourceMap/canonical/~1pipelines~10/guessedLine`],
  ['invalid path', { canonical: { [cp]: { file: 'x', path: 'payload' } } }, `/sourceMap/canonical/~1pipelines~10/path`],
  ['null location', { canonical: { [cp]: { file: 'x', location: null } } }, `/sourceMap/canonical/~1pipelines~10/location`],
  ['missing column', { canonical: { [cp]: { file: 'x', location: { line: 1 } } } }, `/sourceMap/canonical/~1pipelines~10/location/column`],
  ['zero line', { canonical: { [cp]: { file: 'x', location: { line: 0, column: 1 } } } }, `/sourceMap/canonical/~1pipelines~10/location/line`],
  ['fractional column', { canonical: { [cp]: { file: 'x', location: { line: 1, column: 1.5 } } } }, `/sourceMap/canonical/~1pipelines~10/location/column`],
  ['extra location key', { canonical: { [cp]: { file: 'x', location: { line: 1, column: 1, endLine: 2 } } } }, `/sourceMap/canonical/~1pipelines~10/location/endLine`],
]) {
  test(`invalid source hint: ${name} reports binding pointer and ignores untrusted hints`, () => {
    const { canonical, binding } = fixture();
    binding.sourceMap = sourceMap;
    const diagnostic = failure(canonical, binding, 'EXEC_SCHEMA', pointer, 'binding');
    assert.equal(diagnostic.source.file, null);
    assert.equal(diagnostic.source.location, null);
  });
}
test('valid escaped JSON pointers and null-prototype dictionaries are supported', () => {
  const { canonical, binding } = fixture();
  binding.sourceMap = Object.assign(Object.create(null), {
    canonical: Object.assign(Object.create(null), { '/a~0b~1c': { file: 'x' }, [cp]: { file: 'bank.yaml', path: '/payload/a~0b~1c' } }),
  });
  success(canonical, binding);
});
test('non-JSON object envelopes and sparse arrays fail as diagnostics, not crashes', () => {
  failure(new Date(), undefined, 'EXEC_SCHEMA', '');
  const { canonical, binding } = fixture();
  delete binding.pipelines[0].types[0];
  failure(canonical, binding, 'EXEC_SCHEMA', `${bp}/types/0`, 'binding');
});
test('one invalid pipeline discards all execution and narrative IR, not just that pipeline', () => {
  const data = fixture();
  const second = fixture('Fab');
  data.canonical.pipelines.push(second.canonical.pipelines[0], { id: 'narrative', name: 'narrative', steps: [{ id: 'one', name: 'one' }] });
  data.binding.pipelines.push(second.binding.pipelines[0]);
  data.canonical.pipelines[1].steps[0].execution.reads[0].ref = 'input:missing';
  failure(data.canonical, data.binding, 'EXEC_REF_UNKNOWN', '/pipelines/1/steps/0/execution/reads/0/ref');
});

test('handwritten validator keyword inventory stays limited to this shipped schema', () => {
  const schema = JSON.parse(readFileSync(new URL('../schema/execution-ir-v1.schema.json', import.meta.url), 'utf8'));
  const seen = new Set();
  const visit = (contract) => {
    for (const [key, entry] of Object.entries(contract)) {
      seen.add(key);
      if (key === '$defs' || key === 'properties') Object.values(entry).forEach(visit);
      else if (key === 'oneOf') entry.forEach(visit);
      else if (['items', 'additionalProperties', 'propertyNames'].includes(key) && typeof entry === 'object') visit(entry);
    }
  };
  visit(schema);
  assert.deepEqual([...seen].sort(), [
    '$schema', '$id', '$ref', '$defs', 'title', 'description',
    'type', 'const', 'enum', 'oneOf', 'minLength', 'pattern', 'minimum', 'maximum',
    'minItems', 'maxItems', 'uniqueItems', 'items', 'required', 'properties', 'propertyNames', 'additionalProperties',
  ].sort(), 'adding validation keywords requires updating the private validator and public regression cases');
});
