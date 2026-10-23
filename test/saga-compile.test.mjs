// Contract-only tests. No CLI/generation, runtime, full npm suite or truth writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileSagas } from '../lib/saga/compile.mjs';
import { compileTree } from '../lib/compile.mjs';
import { sagaContract, RESULT_KINDS } from './fixtures/saga-contract.mjs';

const clone = (value) => structuredClone(value);
const s = '/sagas/0';
const p = `${s}/payload`;
const phase = `${p}/steps/0/phases/prepare`;
const bphase = `${s}/steps/0/phases/prepare`;
const get = (value, path) => path.split('/').slice(1).reduce((node, key) => node[key], value);
function put(value, path, entry) {
  const end = path.lastIndexOf('/');
  get(value, path.slice(0, end))[path.slice(end + 1)] = entry;
}
function remove(value, path) {
  const end = path.lastIndexOf('/');
  delete get(value, path.slice(0, end))[path.slice(end + 1)];
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function success(canonical, binding) {
  const result = compileSagas(canonical, binding);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir);
  assert.deepEqual(Object.keys(result).sort(), ['diagnostics', 'ir']);
  assert.equal(result.ir.readiness, 'contract-only');
  return result.ir;
}
function failure(canonical, binding, code, pointer, document = 'canonical') {
  const before = clone({ canonical, binding });
  freeze(canonical); freeze(binding);
  const result = compileSagas(canonical, binding);
  assert.deepEqual(Object.keys(result).sort(), ['diagnostics', 'ir']);
  assert.equal(result.ir, null, 'no partial IR under any failure');
  assert.ok(result.diagnostics.length);
  if (code) assert.ok(result.diagnostics.some((entry) => entry.code === code
    && (!pointer || (entry.source.pointer === pointer && entry.source.document === document))), JSON.stringify(result.diagnostics));
  assert.deepEqual({ canonical, binding }, before);
  assert.deepEqual(compileSagas(canonical, binding), result);
  return result;
}
function rejects(name, document, pointer, value, code = 'SAGA_SCHEMA', domain = 'MoneyTransfer', expectedPointer = pointer) {
  test(name, () => {
    const data = sagaContract(domain);
    put(data[document], pointer, clone(value));
    failure(data.canonical, data.binding, code, expectedPointer, document);
  });
}
const reverseKeys = (value) => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)])) : value;
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;

for (const domain of ['MoneyTransfer', 'Fab']) {
  test(`${domain}: closed two-resource TCC contracts, not runtime claims`, () => {
    const { canonical, binding } = sagaContract(domain);
    const before = clone({ canonical, binding });
    freeze(canonical); freeze(binding);
    const ir = success(canonical, binding);
    assert.equal(ir.schemaVersion, 'truthsrc.saga-ir/v1');
    assert.deepEqual(ir.sagas[0], { definition: canonical.sagas[0], binding: binding.sagas[0], readiness: 'contract-only' });
    assert.deepEqual(ir.sagas[0].definition.payload.resultKinds, RESULT_KINDS);
    assert.equal(ir.sagas[0].definition.payload.safety.afterCommit, 'forward-recovery');
    assert.deepEqual(ir.sagas[0].definition.payload.participants.map((participant) => participant.id), ['source', 'target']);
    assert.equal(ir.sagas[0].binding.engine.artifact, 'net.imadz:saga-core:0.2');
    assert.equal(ir.sagas[0].binding.engine.apiMode, 'strict');
    assert.deepEqual({ canonical, binding }, before);
    assert.deepEqual(compileSagas(canonical, binding), { ir, diagnostics: [] });
    assert.equal(JSON.stringify(success(reverseKeys(canonical), reverseKeys(binding))), JSON.stringify(ir));
    const semantic = Object.fromEntries(Object.entries(ir).filter(([key]) => !['digest', 'sourceMap'].includes(key)));
    assert.equal(ir.digest, createHash('sha256').update(JSON.stringify(stable(semantic))).digest('hex'));
  });
}
test('Fab carries a confirmed source Prepare output to a dependent target, frozen manifest preserved', () => {
  const { canonical, binding } = sagaContract('Fab');
  const ir = success(canonical, binding);
  const payload = ir.sagas[0].definition.payload;
  assert.equal(payload.steps[1].phases.prepare.bindings[2].ref, 'step:reserve-source:prepare:carried');
  assert.deepEqual(payload.groups, [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [1] }]);
  assert.equal(payload.admission.manifest.selection, 'frozen-before-prepare');
});
test('output containers and source locations never borrow input objects', () => {
  const { canonical, binding } = sagaContract();
  binding.sourceMap = { canonical: { [s]: { file: 'transfer.saga.yaml', location: { line: 5, column: 1 } } } };
  const ir = success(canonical, binding);
  const before = clone(ir);
  const inputObjects = new Set();
  const walk = (value, callback) => { if (value && typeof value === 'object') { callback(value); Object.values(value).forEach((item) => walk(item, callback)); } };
  walk(canonical, (value) => inputObjects.add(value)); walk(binding, (value) => inputObjects.add(value));
  walk(ir, (value) => assert.ok(!inputObjects.has(value)));
  canonical.sagas[0].payload.purpose = 'Changed'; binding.sourceMap.canonical[s].location.line = 100;
  assert.deepEqual(ir, before);
});
test('sourceMap maps every semantic IR container and scalar without imaginary locations', () => {
  const { canonical, binding } = sagaContract();
  const ir = success(canonical, binding);
  const walk = (value, path = '') => {
    assert.ok(Object.hasOwn(ir.sourceMap, path), `Unmapped ${path}`);
    if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (!path && key === 'sourceMap') continue;
      walk(item, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
    }
  };
  walk(ir);
  assert.deepEqual(ir.sourceMap['/sagas/0/definition/payload/steps/0/phases/prepare/commandRef/name'], {
    document: 'canonical', pointer: `${phase}/commandRef/name`, file: null, atom: null, path: `${phase}/commandRef/name`, location: null,
  });
});
test('anchor/source hint changes do not change digest; semantic changes do', () => {
  const data = sagaContract();
  const first = success(data.canonical, data.binding);
  data.canonical.anchors = [{ file: 'generated.scala', symbol: 'old' }];
  data.binding.sourceMap = { canonical: { [s]: { file: 'transfer.saga.yaml', atom: 'transfer', path: '/payload' } } };
  const hinted = success(data.canonical, data.binding);
  assert.equal(hinted.digest, first.digest);
  assert.equal(hinted.sourceMap['/sagas/0/definition/version'].location, null);
  assert.equal(hinted.sourceMap['/sagas/0/definition/version'].path, '/payload/version');
  data.binding.sourceMap.canonical[s].location = { line: 20, column: 2 };
  data.canonical.anchors[0].symbol = 'new';
  const relocated = success(data.canonical, data.binding);
  assert.equal(relocated.digest, first.digest);
  assert.deepEqual(relocated.sourceMap['/sagas/0/definition/version'].location, { line: 20, column: 2 });
  data.canonical.sagas[0].payload.purpose += ' revised';
  assert.notEqual(success(data.canonical, data.binding).digest, first.digest);
});
test('unknown hints fail and are not trusted for diagnostics', () => {
  const data = sagaContract();
  data.binding.sourceMap = { canonical: { [s]: { file: 'x', lineGuess: 9 } } };
  const result = failure(data.canonical, data.binding, 'SAGA_SCHEMA');
  assert.equal(result.diagnostics[0].source.file, null);
  assert.equal(result.diagnostics[0].source.location, null);
});
test('exact source hints override ancestors; no invented child line offsets', () => {
  const data = sagaContract();
  data.binding.sourceMap = { canonical: {
    [s]: { file: 'transfer.saga.yaml', atom: 'saga', path: '/payload', location: { line: 10, column: 1 } },
    [`${phase}/bindings/0/type`]: { file: 'transfer.saga.yaml', path: '/payload/txid/type', location: { line: 28, column: 4 } },
  } };
  data.canonical.sagas[0].payload.steps[0].phases.prepare.bindings[0].type = 'OperationId';
  const result = failure(data.canonical, data.binding, 'SAGA_TYPE_MISMATCH', `${phase}/bindings/0/type`);
  const diagnostic = result.diagnostics.find((entry) => entry.source.pointer === `${phase}/bindings/0/type`);
  assert.deepEqual(diagnostic.source.location, { line: 28, column: 4 });
  assert.equal(diagnostic.source.path, '/payload/txid/type');
});
test('public compile output and both pinned example versions are accepted without Saga invention', () => {
  const example = JSON.parse(compileTree(new URL('../example/tree', import.meta.url).pathname));
  assert.equal(example.schemaVersion, 'truthsrc/v1');
  assert.deepEqual(success(freeze(example)).sagas, []);
  for (const domain of ['bank', 'fab']) {
    const bytes = readFileSync(new URL(`./fixtures/${domain}.canonical.json`, import.meta.url), 'utf8');
    const canonical = freeze(JSON.parse(bytes));
    assert.equal(canonical.schemaVersion, example.schemaVersion);
    assert.deepEqual(success(canonical).sagas, []);
    assert.equal(readFileSync(new URL(`./fixtures/${domain}.canonical.json`, import.meta.url), 'utf8'), bytes);
  }
});
test('empty Saga family and omitted binding are safe only without declared contracts', () => {
  success({ schemaVersion: 'truthsrc/v1', workshop: 'No saga' });
  success({ schemaVersion: 'truthsrc/v1', workshop: 'Empty saga', sagas: [] });
  const data = sagaContract();
  failure(data.canonical, undefined, 'SAGA_BINDING_MISSING', s);
});
test('one invalid Saga discards all valid contracts, not a partial success', () => {
  const first = sagaContract(); const second = sagaContract('Fab');
  second.canonical.sagas[0].seq = 1;
  first.canonical.aggregates.push(...second.canonical.aggregates);
  first.canonical.sagas.push(...second.canonical.sagas);
  first.binding.sagas.push(...second.binding.sagas);
  first.canonical.sagas[1].payload.steps[0].participant = 'missing';
  failure(first.canonical, first.binding, 'SAGA_PARTICIPANT_UNKNOWN', '/sagas/1/payload/steps/0/participant');
});
test('sourceMap preserves original ordinals when IR sorts by seq', () => {
  const data = sagaContract(); const fab = sagaContract('Fab');
  data.canonical.sagas[0].seq = 2;
  data.canonical.aggregates.push(...fab.canonical.aggregates);
  data.canonical.sagas.push(...fab.canonical.sagas); data.binding.sagas.push(...fab.binding.sagas);
  const ir = success(data.canonical, data.binding);
  assert.equal(ir.sagas[0].definition.id, 'fab-double-lot');
  assert.equal(ir.sourceMap['/sagas/0/definition/id'].pointer, '/sagas/1/id');
});
test('strict capabilities are contracts, not runtime certificates or module existence checks', () => {
  const data = sagaContract();
  data.binding.sagas[0].module = 'nonexistent.Module';
  data.binding.sagas[0].engine.entrypoint = 'nonexistent.StrictEntry';
  assert.equal(success(data.canonical, data.binding).readiness, 'contract-only');
});
test('exact decimal-string Money is accepted without numeric coercion', () => {
  const data = sagaContract();
  data.binding.sagas[0].types.at(-1).amountEncoding = 'decimal-string';
  assert.equal(success(data.canonical, data.binding).sagas[0].binding.types.at(-1).amountEncoding, 'decimal-string');
});
test('explicit all-none read-only step is preserved, never inferred', () => {
  const data = sagaContract();
  for (const phase of ['prepare', 'commit', 'compensate']) {
    data.canonical.sagas[0].payload.steps[0].phases[phase] = { kind: 'none', reason: 'read-only' };
    data.binding.sagas[0].steps[0].phases[phase] = { kind: 'none', reason: 'read-only' };
  }
  success(data.canonical, data.binding);
});

for (const [document, path] of [
  ['canonical', s], ['canonical', p], ['canonical', `${p}/args/0`], ['canonical', `${p}/participants/0`],
  ['canonical', `${p}/participants/0/resourceRef`], ['canonical', `${p}/groups/0`], ['canonical', `${p}/steps/0`],
  ['canonical', `${p}/steps/0/phases`], ['canonical', phase], ['canonical', `${phase}/commandRef`],
  ['canonical', `${phase}/bindings/0`], ['canonical', `${phase}/outputs/0`], ['canonical', `${p}/safety`],
  ['canonical', `${p}/resilience`], ['canonical', `${p}/admission`], ['canonical', `${p}/admission/manifest`],
  ['canonical', `${p}/triggers/0`], ['canonical', `${p}/triggers/0/sourceRef`], ['canonical', `${p}/triggers/0/argsMapping/0`],
  ['canonical', `${p}/triggers/0/idempotency`], ['canonical', `${p}/completions/0`],
  ['binding', ''], ['binding', s], ['binding', `${s}/engine`], ['binding', `${s}/engine/capabilities`],
  ['binding', `${s}/codec`], ['binding', `${s}/types/0`], ['binding', `${s}/types/4`],
  ['binding', `${s}/participants/0`], ['binding', `${s}/participants/0/addressing`],
  ['binding', `${s}/steps/0`], ['binding', `${s}/steps/0/phases`], ['binding', bphase],
  ['binding', `${bphase}/confirmation`], ['binding', `${bphase}/confirmation/eventRef`], ['binding', `${bphase}/confirmation/outputs/0`],
  ['binding', `${bphase}/query`], ['binding', `${bphase}/receipt`], ['binding', `${bphase}/idempotency`],
  ['binding', `${s}/triggerMappers/0`], ['binding', `${s}/completionMappers/0`],
]) rejects(`strict keys at ${document}${path}`, document, `${path}/unsupported`, 'code()');

// Schema-driven omission coverage keeps all nested required fields synchronized,
// independently of the compiler's schema validation traversal.
const contractSchema = JSON.parse(readFileSync(new URL('../schema/saga-ir-v1.schema.json', import.meta.url), 'utf8'));
const resolveSchema = (contract) => contract.$ref ? resolveSchema(contractSchema.$defs[contract.$ref.slice(8)]) : contract;
const schemaMatches = (value, contract) => {
  contract = resolveSchema(contract);
  if (contract.const !== undefined) return JSON.stringify(value) === JSON.stringify(contract.const);
  if (contract.enum) return contract.enum.includes(value);
  if (contract.properties?.kind) return schemaMatches(value?.kind, contract.properties.kind);
  if (contract.properties?.mode) return schemaMatches(value?.mode, contract.properties.mode);
  return true;
};
function omissionCases(value, contract, document, path) {
  contract = resolveSchema(contract);
  if (contract.oneOf) contract = resolveSchema(contract.oneOf.find((branch) => schemaMatches(value, branch)));
  for (const key of contract.required ?? []) {
    const pointer = `${path}/${key}`;
    test(`required ${document}${pointer}`, () => {
      const data = sagaContract(); remove(data[document], pointer);
      failure(data.canonical, data.binding, 'SAGA_SCHEMA');
    });
  }
  if (Array.isArray(value) && contract.items) {
    // First representative per array is enough; required fields are per schema.
    if (value.length) omissionCases(value[0], contract.items, document, `${path}/0`);
  } else if (value && typeof value === 'object') for (const [key, childContract] of Object.entries(contract.properties ?? {})) {
    if (Object.hasOwn(value, key)) omissionCases(value[key], childContract, document, `${path}/${key}`);
  }
}
const example = sagaContract();
omissionCases(example.canonical, contractSchema.$defs.canonical, 'canonical', '');
omissionCases(example.binding, contractSchema.$defs.bindingDocument, 'binding', '');

for (const [document, pointer, value] of [
  ['canonical', '/schemaVersion', 'truthsrc/v2'], ['canonical', `${p}/schemaVersion`, 'truthsrc.saga/v2'],
  ['binding', '/schemaVersion', 'truthsrc.saga-binding/v2'], ['binding', `${s}/engine/apiMode`, 'legacy'],
  ['canonical', `${p}/safety/commitDecision`, 'after-commit'], ['canonical', `${p}/safety/afterCommit`, 'rollback'],
  ['canonical', `${p}/safety/unknown`, 'compensate'], ['canonical', `${p}/safety/compensation`, 'all-participants'],
  ['canonical', `${p}/safety/abortDecision`, 'volatile'], ['canonical', `${p}/safety/retryIdentity`, 'new-attempt'],
  ['canonical', `${p}/safety/cancelBeforePrepare`, 'ignore'], ['canonical', `${p}/safety/manualRecovery`, 'mark-success'],
  ['binding', `${bphase}/confirmation/kind`, 'ask-success'], ['binding', `${bphase}/query/mode`, 'start-if-missing'],
  ['binding', `${bphase}/query/identity`, ['txid']], ['binding', `${bphase}/query/resultKinds`, ['confirmed', 'failed']],
  ['binding', `${bphase}/receipt/durable`, false], ['binding', `${bphase}/receipt/payloadCompatibility`, 'ignore'],
  ['binding', `${bphase}/receipt/identity`, ['txid']], ['binding', `${bphase}/receipt/evidence`, 'last-status'],
  ['binding', `${bphase}/idempotency/payloadConflict`, 'overwrite'], ['binding', `${bphase}/idempotency/attemptIdentity`, 'included'],
  ['binding', `${bphase}/idempotency/identity`, ['txid', 'attempt']],
  ['canonical', `${p}/admission/manifest/durable`, false],
  ['canonical', `${p}/resultKinds`, ['success']], ['canonical', `${p}/triggers/0/kind`, 'join'],
  ['canonical', `${p}/triggers/0/idempotency/conflict`, 'reuse'],
  ['binding', `${s}/types/4/amountEncoding`, 'number'], ['binding', `${s}/types/4/currency`, 'implicit'],
]) rejects(`unsafe/unknown constant ${document}${pointer}`, document, pointer, value);

for (const [document, pointer] of [
  ['canonical', `${p}/args`], ['canonical', `${p}/participants`], ['canonical', `${p}/steps`],
  ['canonical', `${p}/groups`], ['canonical', `${p}/triggers`], ['canonical', `${p}/invariants`],
  ['canonical', `${p}/completions`], ['binding', `${s}/types`], ['binding', `${s}/participants`],
  ['binding', `${s}/steps`], ['binding', `${s}/triggerMappers`], ['binding', `${s}/completionMappers`],
  ['binding', `${s}/engine/capabilities/required`], ['binding', `${s}/codec/compatibleVersions`],
]) rejects(`empty declared collection ${document}${pointer}`, document, pointer, []);
for (const [document, pointer, value] of [
  ['canonical', '/workshop', ' \t\n'], ['canonical', s, null], ['canonical', `${p}/args`, {}],
  ['canonical', `${p}/participants/0/resourceRef`, null], ['canonical', `${p}/steps/0/phases/prepare`, 'code()'],
  ['binding', `${s}/types/0/kind`, 'any'], ['binding', `${s}/engine/capabilities/required/0`, 'everything'],
  ['binding', `${s}/module`, ' \t'], ['binding', `${s}/engine/artifact`, 'saga-core/latest'],
]) rejects(`invalid shape ${document}${pointer}`, document, pointer, value);
for (const [document, pointer] of [
  ['canonical', `${s}/id`], ['canonical', `${s}/version`], ['canonical', `${p}/args/0/slot`],
  ['canonical', `${p}/participants/0/id`], ['canonical', `${p}/steps/0/id`],
  ['binding', `${s}/module`], ['binding', `${bphase}/port`], ['binding', `${bphase}/query/mapper`],
  ['binding', `${s}/types/0/implementation`], ['binding', `${s}/codec/mapper`],
]) for (const value of ['code()', 'x;process.exit()', 'x\n', 'x\r', 'x ', 'x ', '', '1x']) {
  rejects(`no injected code/invalid ID ${document}${pointer}: ${JSON.stringify(value)}`, document, pointer, value);
}
for (const value of ['args:', 'args:x + evil()', 'step:x:y', 'step:x:prepare:y:extra', 'args:from\n', 'random()', 'now', 'literal:1']) {
  rejects(`closed reference grammar ${value}`, 'canonical', `${phase}/bindings/0/ref`, value);
}
for (const field of ['maxAttempts', 'phaseTimeoutMs', 'queryTimeoutMs', 'totalTimeoutMs']) {
  for (const value of [0, -1, 1.2, '1', 2147483648]) rejects(`bounded resilience ${field}=${value}`, 'canonical', `${p}/resilience/${field}`, value);
}
for (const field of ['maxParticipants', 'maxInFlight', 'maxItemsPerChunk']) {
  for (const value of [0, -1, 0.5, '1', 2147483648]) rejects(`bounded admission ${field}=${value}`, 'canonical', `${p}/admission/${field}`, value);
}
for (const [document, pointer, key] of [
  ['canonical', '/sagas', 'id'], ['canonical', `${p}/args`, 'slot'], ['canonical', `${p}/participants`, 'id'],
  ['canonical', `${p}/steps`, 'id'], ['canonical', `${p}/groups`, 'id'], ['canonical', `${phase}/bindings`, 'slot'],
  ['canonical', `${phase}/outputs`, 'slot'], ['canonical', `${p}/triggers`, 'id'], ['canonical', `${p}/completions`, 'kind'],
  ['binding', '/sagas', 'sagaId'], ['binding', `${s}/types`, 'id'], ['binding', `${s}/participants`, 'participantId'],
  ['binding', `${s}/steps`, 'stepId'], ['binding', `${s}/triggerMappers`, 'triggerId'],
]) test(`duplicate ${document}${pointer}/${key}`, () => {
  const data = sagaContract(); const rows = get(data[document], pointer);
  rows.push(clone(rows[0]));
  failure(data.canonical, data.binding, pointer === `${p}/completions` ? 'SAGA_SCHEMA' : 'SAGA_DUPLICATE');
});
for (const [document, pointer, value, code] of [
  ['binding', `${s}/version`, 'v2', 'SAGA_VERSION'], ['binding', `${s}/sagaId`, 'missing', 'SAGA_BINDING_ORPHAN'],
  ['binding', `${s}/codec/compatibleVersions`, ['v2'], 'SAGA_CODEC_VERSION'],
  ['canonical', `${p}/args/0/type`, 'Unknown', 'SAGA_TYPE_UNKNOWN'],
  ['canonical', `${phase}/bindings/0/type`, 'OperationId', 'SAGA_TYPE_MISMATCH'],
  ['canonical', `${phase}/bindings/0/ref`, 'args:unknown', 'SAGA_REF_UNKNOWN'],
  ['canonical', `${phase}/bindings/0/ref`, 'step:unknown:prepare:x', 'SAGA_REF_UNKNOWN'],
  ['canonical', `${phase}/bindings/0/ref`, 'step:reserve-source:prepare:reservation', 'SAGA_REF_UNAVAILABLE'],
  ['canonical', `${phase}/bindings/0/ref`, 'step:reserve-target:commit:receiptId', 'SAGA_REF_UNAVAILABLE'],
  ['canonical', `${p}/steps/0/participant`, 'missing', 'SAGA_PARTICIPANT_UNKNOWN'],
  ['canonical', `${p}/steps/0/group`, 99, 'SAGA_GROUP_UNKNOWN'],
  ['canonical', `${p}/groups/0/dependsOn`, [99], 'SAGA_GROUP_UNKNOWN'],
  ['canonical', `${p}/groups/0/dependsOn`, [1], 'SAGA_GROUP_CYCLE'],
  ['canonical', `${phase}/commandRef/name`, 'missing', 'SAGA_REFERENCE_UNKNOWN'],
  ['canonical', `${p}/participants/0/aggregate`, 'missing', 'SAGA_AGGREGATE_UNKNOWN'],
  ['canonical', `${p}/participants/0/resourceRef/ref`, 'args:missing', 'SAGA_REF_UNKNOWN'],
  ['binding', `${s}/participants/0/addressing/aggregate`, 'wrong', 'SAGA_RESOURCE'],
  ['binding', `${s}/participants/0/addressing/resourceType`, 'TxId', 'SAGA_RESOURCE'],
  ['canonical', `${p}/admission/maxParticipants`, 1, 'SAGA_ADMISSION'],
  ['canonical', `${p}/resilience/totalTimeoutMs`, 1, 'SAGA_RESILIENCE'],
  ['binding', `${bphase}/confirmation/outputs/0/ref`, 'receipt:missing', 'SAGA_REF_UNKNOWN'],
  ['binding', `${s}/types/4/scale`, 18, 'SAGA_PRECISION'],
]) {
  // Scale=18 needs a precision smaller than scale to isolate the semantic gate.
  if (pointer === `${s}/types/4/scale`) continue;
    const expectedPointer = pointer === `${p}/groups/0/dependsOn`
      ? code === 'SAGA_GROUP_CYCLE' ? `${p}/groups/0` : `${pointer}/0`
      : pointer.includes('/addressing/') ? pointer.slice(0, pointer.lastIndexOf('/'))
        : pointer === `${p}/admission/maxParticipants` ? `${p}/admission` : pointer;
    rejects(`semantic ${code} ${document}${pointer}`, document, pointer, value, code, 'MoneyTransfer', expectedPointer);
}
test('Money precision cannot be smaller than scale', () => {
  const data = sagaContract(); data.binding.sagas[0].types.at(-1).precision = 1;
  failure(data.canonical, data.binding, 'SAGA_PRECISION');
});
test('Money cannot hide Number under a nominal string binding', () => {
  const data = sagaContract();
  data.binding.sagas[0].types.at(-1).canonicalType = 'Double';
  failure(data.canonical, data.binding, 'SAGA_PRECISION');
});
for (const [canonicalType, kind] of [['Double', 'integer'], ['Number', 'string'], ['Money', 'string']]) {
  test(`unsafe amount ${canonicalType}/${kind} fails before lowering`, () => {
    const data = sagaContract();
    data.binding.sagas[0].types[4] = { id: 'Money', canonicalType, implementation: 'fixture.Money', kind,
      ...(kind === 'integer' ? { minimum: 0, maximum: 100 } : { minLength: 1, maxLength: 100 }) };
    failure(data.canonical, data.binding, 'SAGA_UNSAFE_AMOUNT');
  });
}
test('phase omission or single explicit none cannot silently mean incomplete TCC', () => {
  const data = sagaContract();
  data.canonical.sagas[0].payload.steps[0].phases.compensate = { kind: 'none', reason: 'read-only' };
  failure(data.canonical, data.binding, 'SAGA_PHASE_INCOMPLETE');
});
test('confirmation belongs to the specific phase command, not any aggregate event', () => {
  const data = sagaContract();
  data.binding.sagas[0].steps[0].phases.prepare.confirmation.eventRef.name = 'TransferRequested';
  failure(data.canonical, data.binding, 'SAGA_CONFIRMATION');
});
test('typed field metadata may not be omitted or parsed from narrative prose', () => {
  const data = sagaContract(); delete data.canonical.aggregates[0].commands[0].parameters;
  failure(data.canonical, data.binding, 'SAGA_REFERENCE_INSUFFICIENT');
});
test('aggregate identifier is needed for exact resource resolution', () => {
  const data = sagaContract(); delete data.canonical.aggregates[0].identifier;
  failure(data.canonical, data.binding, 'SAGA_REFERENCE_INSUFFICIENT');
});
test('session-only command is an insufficient ownership carrier, no global fallback', () => {
  const data = sagaContract();
  data.canonical.aggregates[0].commands = data.canonical.aggregates[0].commands.filter((command) => command.name !== 'prepare-source');
  data.canonical.sessions = [{ session: 'cs', scopes: [{ scope: 'board1', notes: [{ type: 'command', name: 'prepare-source', info: { fields: [] } }] }] }];
  failure(data.canonical, data.binding, 'SAGA_REFERENCE_INSUFFICIENT');
});
test('foreign aggregate command/confirmation is rejected despite existence', () => {
  const data = sagaContract();
  data.canonical.aggregates.push({ ...clone(data.canonical.aggregates[0]), name: 'Other' });
  data.canonical.sagas[0].payload.steps[0].phases.prepare.commandRef.aggregate = 'Other';
  failure(data.canonical, data.binding, 'SAGA_PHASE_PARTICIPANT');
});
test('resource aliases are not additional participants', () => {
  const data = sagaContract(); data.canonical.sagas[0].payload.participants[1].resourceRef.ref = 'args:from';
  failure(data.canonical, data.binding, 'SAGA_RESOURCE');
});
for (const [document, pointer] of [
  ['binding', `${bphase}/confirmation/outputs`], ['binding', `${s}/participants`],
  ['binding', `${s}/steps`], ['binding', `${s}/triggerMappers`], ['canonical', `${phase}/bindings`],
  ['canonical', `${p}/triggers/0/argsMapping`],
]) test(`no implicit missing mappings ${document}${pointer}`, () => {
  const data = sagaContract(); get(data[document], pointer).pop();
  failure(data.canonical, data.binding, 'SAGA_COVERAGE');
});
for (const ordinal of [0, 1]) test(`all trigger mappings validated, including trigger ${ordinal}`, () => {
  const data = sagaContract(); data.canonical.sagas[0].payload.triggers[ordinal].argsMapping[0].ref = 'source:missing';
  failure(data.canonical, data.binding, 'SAGA_REF_UNKNOWN');
});
test('unknown/recovery-required completions cannot consume possibly absent Commit receipts', () => {
  for (const kind of ['outcome-unknown', 'recovery-required', 'rejected-before-effects', 'compensated']) {
    const data = sagaContract();
    data.canonical.sagas[0].payload.completions.find((completion) => completion.kind === kind).bindings[0].ref = 'step:reserve-source:commit:receiptId';
    failure(data.canonical, data.binding, 'SAGA_REF_UNAVAILABLE');
  }
});
test('only successful completion may read all confirmed Commit receipts', () => {
  const data = sagaContract();
  data.canonical.sagas[0].payload.completions[0].bindings[0].ref = 'step:reserve-source:commit:receiptId';
  success(data.canonical, data.binding);
});
test('compensation may read its own confirmed reservation, never another participant or Commit result', () => {
  const data = sagaContract();
  data.canonical.sagas[0].payload.steps[0].phases.compensate.bindings[2].ref = 'step:reserve-target:prepare:reservation';
  failure(data.canonical, data.binding, 'SAGA_REF_UNAVAILABLE');
});
test('Fab dependency cannot be dropped or cyclically reversed', () => {
  const data = sagaContract('Fab'); data.canonical.sagas[0].payload.groups[1].dependsOn = [];
  failure(data.canonical, data.binding, 'SAGA_REF_UNAVAILABLE');
});
test('collection args require readable version-pinned manifest, not hash-only/static claims', () => {
  const data = sagaContract('Fab');
  data.canonical.sagas[0].payload.admission.manifest = { mode: 'static', durable: true };
  failure(data.canonical, data.binding, 'SAGA_MANIFEST');
});
rejects('manifest version cannot drift', 'canonical', `${p}/admission/manifest/version`, 'manifest-v2', 'SAGA_MANIFEST', 'Fab', `${p}/admission/manifest`);
rejects('collections must have finite positive bounds', 'binding', `${s}/types/5/maxItems`, 0, 'SAGA_SCHEMA', 'Fab');
rejects('unreadable manifests are unsupported', 'binding', `${s}/types/6/readable`, false, 'SAGA_SCHEMA', 'Fab');
test('recursive collection types fail closed', () => {
  const data = sagaContract('Fab'); data.binding.sagas[0].types[5].elementType = 'WaferSet';
  failure(data.canonical, data.binding, 'SAGA_TYPE_CYCLE');
});
test('unknown collection element type fails even if unused', () => {
  const data = sagaContract('Fab'); data.binding.sagas[0].types[5].elementType = 'Unknown';
  failure(data.canonical, data.binding, 'SAGA_TYPE_UNKNOWN');
});
test('manifest selection/ref and join cannot inject algorithms', () => {
  const data = sagaContract('Fab'); data.canonical.sagas[0].payload.triggers[0].join = 'all';
  failure(data.canonical, data.binding, 'SAGA_SCHEMA');
});
test('unknown capability and purported runtime verification are not silently accepted', () => {
  const data = sagaContract(); data.binding.sagas[0].engine.capabilities.runtimeVerified = true;
  failure(data.canonical, data.binding, 'SAGA_SCHEMA');
});
test('generated/random identity fields cannot seed trigger idempotency', () => {
  const data = sagaContract(); data.canonical.aggregates[0].commands.at(-1).parameters[0].origin = 'SYSTEM_GENERATED';
  failure(data.canonical, data.binding, 'SAGA_IDEMPOTENCY');
});
test('unknown schema keyword throws rather than silently bypassing validation', async () => {
  // Static JSON module is shared by createRequire; restore immediately and never
  // write schema files. Fresh ESM instance runs the load-time keyword audit.
  const { createRequire } = await import('node:module');
  const mutableSchema = createRequire(import.meta.url)('../schema/saga-ir-v1.schema.json');
  mutableSchema.$defs.slot.unknownSchemaKeyword = true;
  try {
    await assert.rejects(import(`../lib/saga/compile.mjs?audit=${Date.now()}`), /Unknown schema keyword/);
  } finally { delete mutableSchema.$defs.slot.unknownSchemaKeyword; }
});
test('validator supports every shipped schema keyword, including variants and bounds', () => {
  const seen = new Set();
  const walk = (contract) => { for (const [key, value] of Object.entries(contract)) {
    seen.add(key);
    if (['$defs', 'properties'].includes(key)) Object.values(value).forEach(walk);
    if (key === 'oneOf') value.forEach(walk);
    if (['items', 'additionalProperties', 'propertyNames'].includes(key) && value && typeof value === 'object') walk(value);
  } };
  walk(contractSchema);
  assert.deepEqual([...seen].sort(), ['$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'const', 'enum',
    'oneOf', 'properties', 'required', 'additionalProperties', 'propertyNames', 'items', 'uniqueItems', 'minItems',
    'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum'].sort());
});
test('money cannot evade exact amount rules by claiming an ordinary ID', () => {
  const data = sagaContract();
  data.binding.sagas[0].types[4] = { id: 'Money', canonicalType: 'Money', implementation: 'fixture.Money', kind: 'id', minLength: 1, maxLength: 100 };
  failure(data.canonical, data.binding, 'SAGA_UNSAFE_AMOUNT');
});
test('huge sparse inputs reject without iterating declared length', () => {
  const data = sagaContract(); data.binding.sagas[0].types.length = 2147483647;
  assert.equal(compileSagas(data.canonical, data.binding).ir, null);
});
test('canonical floating-point Money evidence cannot be masked by an exact codec', () => {
  const data = sagaContract();
  data.canonical.valueObjects = [{ name: 'Money', fields: [{ name: 'amount', dataType: 'Double' }, { name: 'currency', dataType: 'String' }] }];
  failure(data.canonical, data.binding, 'SAGA_PRECISION');
});
test('bounded MoneyTransferId is an identity, not a monetary amount', () => {
  const data = sagaContract();
  data.binding.sagas[0].types[0].canonicalType = 'MoneyTransferId';
  for (const declaration of [...data.canonical.aggregates[0].commands, ...data.canonical.aggregates[0].events]) {
    for (const field of declaration.parameters ?? declaration.payloads) if (field.dataType === 'TxId') field.dataType = 'MoneyTransferId';
  }
  success(data.canonical, data.binding);
});
test('shared type DAG cardinality analysis is memoized, not exponential', { timeout: 5000 }, () => {
  const data = sagaContract('Fab');
  data.canonical.valueObjects = [];
  let preceding = 'WaferId';
  for (let depth = 1; depth <= 30; depth++) {
    const id = `Shared${depth}`;
    data.canonical.valueObjects.push({ name: id, fields: [{ name: 'left', dataType: preceding }, { name: 'right', dataType: preceding }] });
    data.binding.sagas[0].types.push({ id, canonicalType: id, implementation: `fixture.${id}`, kind: 'value-object', fields: [{ slot: 'left', type: preceding }, { slot: 'right', type: preceding }] });
    preceding = id;
  }
  data.binding.sagas[0].types[5].elementType = preceding;
  success(data.canonical, data.binding);
});
test('phase resource ref cannot silently target another participant', () => {
  const data = sagaContract();
  data.canonical.sagas[0].payload.steps[0].phases.prepare.bindings[1].ref = 'args:to';
  failure(data.canonical, data.binding, 'SAGA_RESOURCE', `${phase}/bindings/1/ref`);
});
test('malformed typed trigger metadata is diagnostic, not a compiler throw', () => {
  for (const parameters of [{}, 'fields', [null]]) {
    const data = sagaContract(); data.canonical.aggregates[0].commands.at(-1).parameters = parameters;
    failure(data.canonical, data.binding, 'SAGA_REFERENCE_INSUFFICIENT');
  }
});
test('capability duplicate cannot replace a missing safety requirement', () => {
  const data = sagaContract();
  data.binding.sagas[0].engine.capabilities.required[0] = 'durable-abort-decision';
  failure(data.canonical, data.binding, 'SAGA_SCHEMA', `${s}/engine/capabilities/required/1`, 'binding');
});
test('maxItemsPerChunk enforces actual collection type bound', () => {
  const data = sagaContract('Fab'); data.canonical.sagas[0].payload.admission.maxItemsPerChunk = 63;
  failure(data.canonical, data.binding, 'SAGA_ADMISSION', `${p}/args/2`);
});
test('independent groups cannot bypass a single in-flight frontier bound', () => {
  const data = sagaContract('Fab');
  data.canonical.sagas[0].payload.groups[1].dependsOn = [];
  data.canonical.sagas[0].payload.steps[1].phases.prepare.bindings[2].ref = 'args:wafers';
  failure(data.canonical, data.binding, 'SAGA_GROUP_ORDER');
});
for (const [kind, extension] of [
  ['string', { minLength: 1, maxLength: 20 }], ['boolean', {}],
  ['integer', { minimum: -10, maximum: 10 }], ['enum', { values: ['A', 'B'] }],
]) test(`typed ${kind} contract is supported, never code`, () => {
  const data = sagaContract();
  data.binding.sagas[0].types.push({ id: 'Extra', canonicalType: 'Extra', implementation: 'fixture.Extra', kind, ...extension });
  success(data.canonical, data.binding);
  data.binding.sagas[0].types.at(-1).unknown = true;
  failure(data.canonical, data.binding, 'SAGA_SCHEMA');
});
test('value objects require canonical exact field closure', () => {
  const data = sagaContract();
  data.canonical.valueObjects = [{ name: 'Metadata', fields: [{ name: 'key', dataType: 'TxId' }] }];
  data.binding.sagas[0].types.push({ id: 'Metadata', canonicalType: 'Metadata', implementation: 'fixture.Metadata', kind: 'value-object', fields: [{ slot: 'key', type: 'TxId' }] });
  success(data.canonical, data.binding);
  data.binding.sagas[0].types.at(-1).fields[0].type = 'OperationId';
  failure(data.canonical, data.binding, 'SAGA_TYPE_MISMATCH');
});
for (const [kind, extension] of [
  ['integer', { minimum: 11, maximum: 10 }], ['string', { minLength: 21, maxLength: 20 }],
  ['collection', { elementType: 'TxId', minItems: 21, maxItems: 20 }],
]) test(`inverted ${kind} bounds fail`, () => {
  const data = sagaContract();
  data.binding.sagas[0].types.push({ id: 'Extra', canonicalType: 'Extra', implementation: 'fixture.Extra', kind, ...extension });
  failure(data.canonical, data.binding, 'SAGA_TYPE_BOUNDS');
});
for (const [sourceMap, pointer] of [
  [{ other: {} }, '/sourceMap/other'],
  [{ canonical: { invalid: { file: 'x' } } }, '/sourceMap/canonical/invalid'],
  [{ canonical: { '/bad~2': { file: 'x' } } }, '/sourceMap/canonical/~1bad~02'],
  [{ canonical: { [s]: { file: 'x', location: null } } }, '/sourceMap/canonical/~1sagas~10/location'],
  [{ canonical: { [s]: { file: 'x', location: { line: 0, column: 1 } } } }, '/sourceMap/canonical/~1sagas~10/location/line'],
  [{ canonical: { [s]: { file: 'x', location: { line: 1 } } } }, '/sourceMap/canonical/~1sagas~10/location/column'],
]) test(`source hint strict ${pointer}`, () => {
  const data = sagaContract(); data.binding.sourceMap = sourceMap;
  failure(data.canonical, data.binding, 'SAGA_SCHEMA', pointer, 'binding');
});
test('non-JSON, cycle, sparse, getters and functions reject without execution or throw', () => {
  const data = sagaContract();
  for (const canonical of [null, [], new Date(), 'json', undefined]) assert.equal(compileSagas(canonical, data.binding).ir, null);
  for (const value of [Infinity, NaN, undefined, () => { throw new Error('must not execute'); }, 1n]) {
    const altered = sagaContract(); altered.canonical.injected = value;
    assert.equal(compileSagas(altered.canonical, altered.binding).ir, null);
  }
  let executed = false;
  Object.defineProperty(data.canonical, 'injected', { enumerable: true, get() { executed = true; throw new Error('must not execute'); } });
  assert.equal(compileSagas(data.canonical, data.binding).ir, null); assert.equal(executed, false);
  const cycle = sagaContract(); cycle.canonical.loop = cycle.canonical;
  assert.equal(compileSagas(cycle.canonical, cycle.binding).ir, null);
  const sparse = sagaContract(); delete sparse.binding.sagas[0].types[0];
  assert.equal(compileSagas(sparse.canonical, sparse.binding).ir, null);
});
