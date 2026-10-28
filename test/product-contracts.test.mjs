import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileTree } from '../lib/compile.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { PROFILES } from '../lib/products/registry.mjs';
import { sagaSchema, executionSchema } from '../lib/products/contract-schemas.mjs';
import { compileSagas } from '../lib/saga/compile.mjs';
import { compileExecution } from '../lib/execution/compile.mjs';
import { lowerSagaRuntimeBindingV3 } from '../lib/saga/runtime-binding.mjs';

const example = new URL('../example/saga-money-transfer-serial/', import.meta.url);
const json = name => JSON.parse(readFileSync(new URL(name, example), 'utf8'));
const domain = JSON.parse(compileTree(fileURLToPath(new URL('tree/', example))));
const sagas = json('bindings.json'), runtime = json('runtime-binding.json');
const clone = value => structuredClone(value);
function requirement(id, inputRoles) {
  const p = PROFILES[id];
  return { id, version: p.version, payloadSchemaVersion: p.payloadSchemaVersion,
    capabilities: clone(p.capabilities), inputRoles, requires: clone(p.requires) };
}
function invocation(canonical, binding) {
  const saga = canonical.sagas[0], technical = binding.sagas[0];
  const inputs = [{ id: 'operation', type: saga.payload.transactionIdType, durability: 'start-record' },
    { id: 'occurrence', type: saga.payload.transactionIdType, durability: 'start-record' },
    ...saga.payload.args.map(({ slot, type }) => ({ id: slot, type, durability: 'start-record' }))];
  const resultKinds = saga.payload.resultKinds;
  const kinds = ['success', 'business-rejection', 'business-rejection', 'infrastructure-failure', 'unknown-effect'];
  const codes = ['Succeeded', 'Rejected', 'Compensated', 'RecoveryRequired', 'Unknown'];
  const ref = { sagaId: saga.id, version: saga.version };
  const pipeline = { id: 'formal-source-plan', name: 'Explicit independent invocation contract test',
    execution: { schemaVersion: 'truthsrc.execution/v1', inputs, outputs: [],
      recovery: { inputResponsibility: 'host', inputs: inputs.map(x => 'input:' + x.id), planVersion: 'test-plan-v1',
        planCompatibility: 'exact', checkpoint: 'confirmed-prefix', unknownEffect: 'reconcile-before-resume', ownership: 'single-writer' },
      admission: { maxConcurrentRuns: 1, maxInFlightSteps: 1, maxItemsPerChunk: 64, maxInFlightChunks: 1 } },
    steps: [{ id: 'invoke', name: 'Invoke the exact declared Saga', execution: {
      invokeSaga: { ref, args: saga.payload.args.map(({ slot, type }) => ({ slot, type, ref: 'input:' + slot })),
        transactionIdentity: { type: saga.payload.transactionIdType, derivation: 'durable-source-stage',
          source: { ref: 'input:operation', type: saga.payload.transactionIdType }, stageId: 'invoke',
          stageOccurrence: { ref: 'input:occurrence', type: saga.payload.transactionIdType },
          scope: 'saga-version', conflict: 'reject-different-args' }, start: 'durable-intent-before-start', completionMode: 'await-terminal',
        results: resultKinds.map((resultKind, i) => ({ resultKind, code: codes[i], outputs: [] })) },
      reads: inputs.map(({ id, type }) => ({ slot: id, type, ref: 'input:' + id })), writes: [],
      outcomes: codes.map((code, i) => ({ code, kind: kinds[i], action: i === 0 ? 'continue' : i < 3 ? 'stop' : 'manual-recovery' })) } }] };
  canonical.pipelines = [pipeline];
  return { schemaVersion: 'truthsrc.execution-binding/v1', sagaBindings: clone(binding), pipelines: [{
    pipelineId: pipeline.id, engine: 'monarch-persistence/0.2.1', module: 'fixture.FormalPipeline',
    codec: { id: 'FormalPipelineCodec', version: 'plan-v1', compatibleVersions: ['plan-v1'] },
    types: technical.types.map(({ id, implementation }) => ({ id, implementation })), ports: [],
    invocations: [{ stepId: 'invoke', ref: clone(ref), adapter: 'fixture.FormalAdapter',
      runtime: { artifact: technical.engine.artifact, apiMode: technical.engine.apiMode, entrypoint: technical.engine.entrypoint },
      argsCodec: { id: technical.codec.id, version: technical.codec.version, mapper: technical.codec.mapper },
      resultCodec: { id: 'FormalResultCodec', version: technical.codec.version, mapper: 'fixture.FormalResultCodec' },
      transactionIdentity: { mapper: 'fixture.FormalIdentity', derivation: 'durable-source-stage', payloadCompatibility: 'exact' } }] }] };
}
function fixture() {
  const canonical = clone(domain), binding = clone(sagas), execution = invocation(canonical, binding);
  return { schemaVersion: 'truthsrc.product-compilation/v1', options: {}, assemblies: [],
    documents: [{ id: 'domain', schemaVersion: canonical.schemaVersion, value: canonical },
      { id: 'sagas', schemaVersion: binding.schemaVersion, value: binding },
      { id: 'runtime', schemaVersion: runtime.schemaVersion, value: clone(runtime) },
      { id: 'execution', schemaVersion: execution.schemaVersion, value: execution }],
    requirements: [requirement('execution-contract', { canonical: 'domain', sagaBinding: 'sagas', executionBinding: 'execution' }),
      requirement('saga-runtime-contract', { canonical: 'domain', sagaBinding: 'sagas', runtimeBinding: 'runtime' }),
      requirement('saga-contract', { canonical: 'domain', sagaBinding: 'sagas' })] };
}
const document = (r, id) => r.documents.find(d => d.id === id).value;
const product = (r, id) => r.products.find(p => p.id === id).payload;
function success(request) {
  const result = compileProductSet(request);
  assert.deepEqual(result.diagnostics, []); assert.ok(result.result);
  assert.ok(Object.isFrozen(result.result)); return result.result;
}
function rejects(request, code) {
  const before = clone(request), result = compileProductSet(request);
  assert.equal(result.result, null); assert.ok(result.diagnostics.some(d => d.code === code), JSON.stringify(result.diagnostics));
  assert.deepEqual(request, before); assert.deepEqual(compileProductSet(request), result); return result;
}

test('pure fixed schema constants equal both entire shipped schemas', () => {
  assert.deepEqual(sagaSchema, JSON.parse(readFileSync(new URL('../schema/saga-ir-v1.schema.json', import.meta.url), 'utf8')));
  assert.deepEqual(executionSchema, JSON.parse(readFileSync(new URL('../schema/execution-ir-v1.schema.json', import.meta.url), 'utf8')));
});
test('formal products dispatch all complete live checkers without caller payload or readiness', () => {
  const r = fixture(), before = clone(r), result = success(r);
  assert.deepEqual(r, before);
  assert.deepEqual(product(result, 'saga-contract'), compileSagas(document(r, 'domain'), document(r, 'sagas')).ir);
  assert.deepEqual(product(result, 'execution-contract'), compileExecution(document(r, 'domain'), document(r, 'execution')).ir);
  assert.deepEqual(product(result, 'saga-runtime-contract'), lowerSagaRuntimeBindingV3({ canonical: document(r, 'domain'),
    binding: document(r, 'sagas'), runtimeBinding: document(r, 'runtime') }).ir);
  assert.deepEqual(result.readiness, { level: 'static-contract-only', runnable: false, runtimeBindingVerified: false });
  assert.deepEqual(compileProductSet(clone(r)).result, result);
});
test('formal Saga product permits the old Saga-only complete role set', () => {
  const r = fixture(); r.documents = r.documents.filter(d => ['domain', 'sagas'].includes(d.id));
  r.requirements = r.requirements.filter(r => r.id === 'saga-contract');
  assert.equal(success(r).products.length, 1);
});
test('formal execution refuses mismatched nested binding rather than selecting a convenient role', () => {
  const r = fixture(); document(r, 'execution').sagaBindings.sagas[0].codec.mapper = 'fixture.DifferentMapper';
  rejects(r, 'PRODUCT_NESTED_BINDING');
});
test('formal runtime rechecks original version and receipt pins with diagnostics on actual documents', () => {
  const r = fixture(); document(r, 'runtime').sagas[0].argsCodec.version = 'wrong-version';
  const result = rejects(r, 'RUNTIME_CODEC_MISMATCH');
  assert.ok(result.diagnostics.some(d => d.source.document === 'runtime' && d.source.pointer.includes('argsCodec')));
});
test('formal execution preserves whole checker rejection, not just product/source references', () => {
  const r = fixture(); document(r, 'domain').pipelines[0].steps[0].execution.invokeSaga.args.pop();
  const result = rejects(r, 'EXEC_SAGA_ARG_COVERAGE'); assert.ok(result.diagnostics.every(d => ['domain', 'execution'].includes(d.source.document)));
});
test('missing product, wrong role, different canonical and unknown profile are rejected', () => {
  let r = fixture(); r.requirements.pop(); rejects(r, 'PRODUCT_DEPENDENCY');
  r = fixture(); r.requirements[0].inputRoles.sagaBinding = 'runtime'; rejects(r, 'PRODUCT_ROLE');
  r = fixture(); r.documents.push({ id: 'domain-copy', schemaVersion: 'truthsrc/v1', value: clone(document(r, 'domain')) });
  r.requirements[0].inputRoles.canonical = 'domain-copy'; rejects(r, 'PRODUCT_ROLE');
  r = fixture(); r.requirements[0].version = '2'; rejects(r, 'PRODUCT_UNSUPPORTED');
});
function unions() {
  const r = fixture();
  r.documents.push({ id: 'sagas-empty', schemaVersion: 'truthsrc.saga-binding/v1', value: { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [] } },
    { id: 'runtime-empty', schemaVersion: runtime.schemaVersion, value: { schemaVersion: runtime.schemaVersion, target: clone(runtime.target), sagas: [] } },
    { id: 'execution-empty', schemaVersion: 'truthsrc.execution-binding/v1', value: { schemaVersion: 'truthsrc.execution-binding/v1', pipelines: [] } });
  r.assemblies = [{ id: 'saga-union', kind: 'saga-bindings-union', sources: ['sagas', 'sagas-empty'] },
    { id: 'runtime-union', kind: 'runtime-bindings-union', sources: ['runtime', 'runtime-empty'] },
    { id: 'execution-union', kind: 'execution-bindings-union', sources: ['execution', 'execution-empty'], sagaBinding: 'saga-union' }];
  for (const requirement of r.requirements) {
    requirement.inputRoles.sagaBinding = 'saga-union';
    if (requirement.id === 'execution-contract') requirement.inputRoles.executionBinding = 'execution-union';
    if (requirement.id === 'saga-runtime-contract') requirement.inputRoles.runtimeBinding = 'runtime-union';
  }
  return r;
}
test('explicit complete assemblies preserve original documents and per-row provenance', () => {
  const r = unions(), before = clone(r), result = success(r);
  assert.deepEqual(r, before); assert.equal(result.documents.length, 10);
  for (const d of r.documents) assert.deepEqual(result.documents.find(x => x.id === d.id), d);
  assert.deepEqual(result.assemblies[0].provenance, [{ targetPointer: '/sagas/0', source: { document: 'sagas', pointer: '/sagas/0' } }]);
  assert.deepEqual(result.documents.find(d => d.id === 'execution-union').value.sagaBindings, document(r, 'sagas'));
});
test('assemblies refuse duplicate/forward/output/source identities and target conflicts', () => {
  let r = unions(); r.assemblies[0].sources = ['sagas', 'sagas']; rejects(r, 'PRODUCT_ASSEMBLY_DUPLICATE');
  r = unions(); r.assemblies[0].id = 'sagas'; rejects(r, 'PRODUCT_ASSEMBLY_DUPLICATE');
  r = unions(); r.assemblies[0].sources = ['saga-union']; rejects(r, 'PRODUCT_ASSEMBLY_SOURCE');
  r = unions(); document(r, 'sagas-empty').sagas = clone(document(r, 'sagas').sagas); rejects(r, 'PRODUCT_ASSEMBLY_DUPLICATE');
  r = unions(); document(r, 'runtime-empty').target.capabilities.reverse(); rejects(r, 'PRODUCT_ASSEMBLY_TARGET');
});
test('assemblies reject unrelated embedded Saga and unused outputs without hidden union fallback', () => {
  let r = unions(); document(r, 'execution').sagaBindings.sagas[0].codec.mapper = 'fixture.NotDeclared'; rejects(r, 'PRODUCT_ASSEMBLY_NESTED');
  r = unions(); r.assemblies.push({ id: 'unused', kind: 'saga-bindings-union', sources: ['sagas'] }); rejects(r, 'PRODUCT_DOCUMENT_UNUSED');
  r = fixture(); delete document(r, 'execution').sagaBindings; rejects(r, 'PRODUCT_NESTED_BINDING');
});
test('file capture remains an unassembled request and recompilation is stable', async () => {
  const { readProductRequest } = await import('../lib/products/cli.mjs');
  const r = readProductRequest(fileURLToPath(new URL('./fixtures/product-contracts/files.json', import.meta.url)));
  const result = success(r);
  assert.deepEqual(success(clone(r)), result);
  const assembled = unions();
  const { validateRequest } = await import('../lib/products/request.mjs');
  assert.deepEqual(validateRequest(assembled), assembled);
  assert.deepEqual(success(validateRequest(assembled)), success(assembled));
});
test('complete formal contracts initialize and compile with filesystem/process/clock effects denied', async () => {
  const { execFileSync } = await import('node:child_process');
  const modules = new Map();
  function bundle(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const source = readFileSync(url, 'utf8').replace(/from '(\.[^']+)'/gu, (_, relative) => `from ${JSON.stringify(bundle(new URL(relative, url)))}`);
    const output = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    modules.set(url.href, output); return output;
  }
  const module = bundle(new URL('../lib/products/compile.mjs', import.meta.url));
  const script = `
    const fs = (await import('node:fs')).default, child = (await import('node:child_process')).default;
    const { syncBuiltinESMExports } = await import('node:module');
    const deny = () => { throw Error('forbidden effect'); };
    for (const key of ['readFileSync','readdirSync','existsSync','writeFileSync','mkdirSync','rmSync','statSync','lstatSync','openSync']) fs[key] = deny;
    for (const key of ['readFile','writeFile','readdir','stat','open','access']) fs.promises[key] = deny;
    for (const key of ['execFileSync','execSync','spawn','spawnSync','exec','fork']) child[key] = deny;
    syncBuiltinESMExports(); const finish = process.exit.bind(process);
    globalThis.process = new Proxy({}, { get: deny }); globalThis.Date = new Proxy(class {}, { get: deny, construct: deny });
    globalThis.fetch = deny; globalThis.setTimeout = deny; Math.random = deny;
    const { compileProductSet } = await import(${JSON.stringify(module)});
    const input = ${JSON.stringify(unions())};
    const result = compileProductSet(input);
    if (!result.result || result.result.products.length !== 3) throw Error(JSON.stringify(result.diagnostics));
    input.documents.find(d => d.id === 'runtime').value.sagas[0].runtimeVersion = 0;
    if (compileProductSet(input).result !== null) throw Error('bad runtime source admitted');
    finish(0);
  `;
  execFileSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
});
