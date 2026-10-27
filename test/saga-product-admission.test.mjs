import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { admitProducts, validateDeclaredProducts, ENVELOPE_VERSION, REQUIREMENTS_VERSION } from '../src/core/products.mjs';
import { compileSagas } from '../lib/saga/compile.mjs';
import { createSagaCompiler } from '../lib/saga/compile-pure.mjs';
import { createSnapshot, compileSnapshot } from '../lib/compile-snapshot.mjs';
import { compileTree, loadTreeSnapshot } from '../lib/compile.mjs';
import { emitDoc, slug } from '../lib/shared.mjs';
import { apply, plan } from '../src/core/generate.mjs';
import { loadManifest } from '../src/core/manifest.mjs';
import { sagaContract } from './fixtures/saga-contract.mjs';
import { inventorySagaContract } from './fixtures/inventory-saga-contract.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const clone = value => JSON.parse(JSON.stringify(value));
const complete = canonical => ({ valueObjects: [], readModels: [], stories: [], domainServices: [], ...clone(canonical) });
const identity = (id = 'saga-contract') => ({ id, version: '1', payloadSchemaVersion: id === 'canonical' ? 'truthsrc/v1' : 'truthsrc.saga-ir/v1',
  capabilities: id === 'canonical' ? [] : [{ id: 'saga-static-contract', version: '1' }] });
const manifest = (ids = ['saga-contract']) => ({ name: 'saga-product-fixture', version: '1.0.0', inputSchema: 'truthsrc/v1.0', products: ['template'], artifactKinds: ['summary'], output: {},
  declaredProducts: { schemaVersion: REQUIREMENTS_VERSION, products: ids.map(identity) } });
const envelope = (id, payload) => ({ schemaVersion: ENVELOPE_VERSION, ...identity(id), source: { document: 'canonical', pointer: '' }, payload: clone(payload) });
function request(data = sagaContract(), ids = ['saga-contract']) {
  const canonical = complete(data.canonical), binding = clone(data.binding);
  const compiled = compileSagas(canonical, binding);
  assert.deepEqual(compiled.diagnostics, []);
  return { manifest: manifest(ids), canonical, bindings: [binding], products: ids.map(id => envelope(id, id === 'canonical' ? canonical : compiled.ir)), options: {} };
}
function frozen(value) {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function success(input) {
  const before = JSON.stringify(input);
  const result = admitProducts(input);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.context);
  assert.equal(typeof result.then, 'undefined', 'initialized admission remains synchronous');
  assert.equal(JSON.stringify(input), before);
  frozen(result);
  assert.deepEqual(admitProducts(input), result);
  return result;
}
function reject(input, code, document, pointer) {
  const result = admitProducts(input);
  assert.equal(result.context, null);
  assert.ok(result.diagnostics.some(row => row.code === code && row.source.document === document && row.source.pointer === pointer), JSON.stringify(result.diagnostics));
  frozen(result);
  assert.deepEqual(admitProducts(input), result);
  return result;
}
function scratch(t) {
  const directory = mkdtempSync(join(tmpdir(), 'truthsrc-saga-product-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

for (const [domain, fixture] of [['Money', sagaContract], ['Inventory', inventorySagaContract]]) {
  test(`${domain}: live complete static product admits detached frozen explicit inputs`, () => {
    const input = request(fixture(), ['saga-contract', 'canonical']);
    const expected = compileSagas(input.canonical, input.bindings[0]).ir;
    const { context } = success(input);
    assert.deepEqual(Object.keys(context.products), ['canonical@1', 'saga-contract@1']);
    assert.equal(Object.getPrototypeOf(context.products), null);
    const product = context.products['saga-contract@1'];
    assert.deepEqual(product.payload, expected);
    assert.deepEqual(product.capabilities, [{ id: 'saga-static-contract', version: '1' }]);
    assert.equal(product.payload.readiness, 'contract-only');
    assert.equal(Object.hasOwn(product.payload, 'runnable'), false);
    assert.equal(Object.isFrozen(input), false);
    assert.equal(Object.isFrozen(input.bindings[0]), false);
    const inputObjects = new Set();
    const walk = (value, fn) => { if (value && typeof value === 'object') { fn(value); Object.values(value).forEach(v => walk(v, fn)); } };
    walk(input, value => inputObjects.add(value));
    walk(context, value => assert.equal(inputObjects.has(value), false));
    const before = JSON.stringify(context);
    input.bindings[0].sagas[0].module = 'changed.Module';
    input.canonical.sagas[0].payload.purpose = 'changed';
    input.products[0].payload.digest = '0'.repeat(64);
    assert.equal(JSON.stringify(context), before);
  });
  test(`${domain}: authored definition and codec versions do not replace product/capability versions`, () => {
    const data = clone(fixture());
    data.canonical.sagas[0].version = 'business-v27';
    data.binding.sagas[0].version = 'business-v27';
    data.binding.sagas[0].codec.version = 'codec-v8';
    data.binding.sagas[0].codec.compatibleVersions.push('codec-v8');
    const { context } = success(request(data));
    const p = context.products['saga-contract@1'];
    assert.equal(p.version, '1');
    assert.equal(p.payload.sagas[0].definition.version, 'business-v27');
    assert.equal(p.payload.sagas[0].binding.codec.version, 'codec-v8');
  });
  test(`${domain}: file snapshot and serialized-memory snapshot admit identical products`, t => {
    const data = fixture();
    const atoms = data.atoms ?? [
      { file: 'workshop.yaml', doc: { name: data.canonical.workshop } },
      ...data.canonical.aggregates.flatMap(aggregate => [
        { file: `aggregates/${slug(aggregate.name)}/aggregate.yaml`, doc: { kind: 'aggregate', name: aggregate.name,
          payload: { name: aggregate.name, identifier: aggregate.identifier }, extraEvents: aggregate.events,
          order: { commands: aggregate.commands.map(row => row.name), events: aggregate.events.map(row => row.name) } } },
        ...aggregate.commands.map(command => ({ file: `aggregates/${slug(aggregate.name)}/slices/${slug(command.name)}.slice.yaml`, doc: { kind: 'slice', command: command.name, payload: command } })),
      ]),
      ...data.canonical.sagas.map(saga => ({ file: `sagas/${slug(saga.id)}.saga.yaml`, doc: { kind: 'saga', ...saga } })),
    ];
    const directory = scratch(t);
    for (const { file, doc } of atoms) {
      mkdirSync(dirname(join(directory, file)), { recursive: true });
      const scalars = Object.entries(doc).filter(([, value]) => value === null || typeof value !== 'object');
      const blocks = Object.fromEntries(Object.entries(doc).filter(([, value]) => value !== null && typeof value === 'object'));
      writeFileSync(join(directory, file), emitDoc({ scalars, blocks }));
    }
    const captured = loadTreeSnapshot(directory);
    const explicit = createSnapshot(atoms, { fallbackWorkshop: captured.metadata.fallbackWorkshop, inboxDirs: [], aggregateDirs: data.canonical.aggregates.map(row => slug(row.name)).sort() });
    const memory = compileSnapshot(JSON.parse(JSON.stringify(explicit)));
    const file = compileSnapshot(captured);
    assert.equal(memory.text, file.text);
    assert.equal(compileTree(directory), memory.text);
    assert.deepEqual(success(request({ canonical: memory.canonical, binding: data.binding })), success(request({ canonical: file.canonical, binding: data.binding })));
  });
}

test('inventory really maps warehouse, SKU and bounded integer quantity, not renamed Money', () => {
  const input = request(inventorySagaContract());
  const { context } = success(input);
  const { definition, binding } = context.products['saga-contract@1'].payload.sagas[0];
  assert.deepEqual(binding.types.find(row => row.id === 'Quantity'), { id: 'Quantity', canonicalType: 'Int', implementation: 'inventory.types.Quantity', kind: 'integer', minimum: 1, maximum: 10000 });
  assert.equal(binding.types.some(row => row.kind === 'money'), false);
  assert.deepEqual(definition.payload.steps[0].phases.prepare.bindings.map(row => row.slot), ['txid', 'warehouse', 'sku', 'quantity']);
  assert.equal(definition.payload.participants[0].resourceRef.type, 'WarehouseId');
  assert.ok(input.canonical.aggregates[0].commands.find(row => row.name === 'ReserveSkuQuantity').parameters.some(row => row.name === 'quantity' && row.dataType === 'Int'));
});

test('requirements support does not validate absent or malformed business semantics', () => {
  const checked = validateDeclaredProducts(manifest());
  assert.deepEqual(checked.diagnostics, []);
  frozen(checked);
  const input = request();
  input.canonical.sagas[0].payload.steps[0].participant = 'missing';
  reject(input, 'SAGA_PARTICIPANT_UNKNOWN', 'canonical', '/sagas/0/payload/steps/0/participant');
});

test('explicit empty Saga binding and family admit empty contract without invented input', () => {
  const input = request({ canonical: { schemaVersion: 'truthsrc/v1', workshop: 'Empty', sessions: [], aggregates: [] }, binding: { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [] } });
  const { context } = success(input);
  assert.deepEqual(context.products['saga-contract@1'].payload.sagas, []);
  assert.equal(Object.hasOwn(context.canonical, 'sagas'), false);
  input.bindings = [];
  reject(input, 'PRODUCT_BINDINGS_COUNT', 'bindings', '');
});

const cases = [
  ['missing binding', r => { r.bindings = []; }, 'PRODUCT_BINDINGS_COUNT', 'bindings', ''],
  ['multiple bindings are not merged', r => { r.bindings.push(clone(r.bindings[0])); }, 'PRODUCT_BINDINGS_COUNT', 'bindings', ''],
  ['missing definition binding', r => { r.bindings[0].sagas = []; }, 'SAGA_BINDING_MISSING', 'canonical', '/sagas/0'],
  ['orphan binding', r => { r.bindings[0].sagas[0].sagaId = 'other'; }, 'SAGA_BINDING_ORPHAN', 'bindings', '/0/sagas/0/sagaId'],
  ['definition version pinned exactly', r => { r.bindings[0].sagas[0].version = 'v8'; }, 'SAGA_VERSION', 'bindings', '/0/sagas/0/version'],
  ['execution schema unsupported', r => { r.bindings[0].schemaVersion = 'truthsrc.execution-binding/v1'; }, 'SAGA_SCHEMA', 'bindings', '/0/schemaVersion'],
  ['runtime schema unsupported', r => { r.bindings[0].schemaVersion = 'truthsrc.saga-runtime-binding/v2'; }, 'SAGA_SCHEMA', 'bindings', '/0/schemaVersion'],
  ['binding missing schema', r => { delete r.bindings[0].schemaVersion; }, 'SAGA_SCHEMA', 'bindings', '/0/schemaVersion'],
  ['binding unknown field', r => { r.bindings[0]['~alien/field'] = true; }, 'SAGA_SCHEMA', 'bindings', '/0/~0alien~1field'],
  ['unknown type', r => { r.canonical.sagas[0].payload.args[0].type = 'Missing'; }, 'SAGA_TYPE_UNKNOWN', 'canonical', '/sagas/0/payload/args/0/type'],
  ['wrong nominal mapping', r => { r.canonical.sagas[0].payload.steps[0].phases.prepare.bindings[0].type = 'OperationId'; }, 'SAGA_TYPE_MISMATCH', 'canonical', '/sagas/0/payload/steps/0/phases/prepare/bindings/0/type'],
  ['wrong resource', r => { r.bindings[0].sagas[0].participants[0].addressing.resourceType = 'OperationId'; }, 'SAGA_RESOURCE', 'bindings', '/0/sagas/0/participants/0/addressing'],
  ['incomplete TCC', r => { r.canonical.sagas[0].payload.steps[0].phases.commit = { kind: 'none', reason: 'read-only' }; }, 'SAGA_PHASE_INCOMPLETE', 'canonical', '/sagas/0/payload/steps/0/phases'],
  ['wrong confirmation', r => { r.bindings[0].sagas[0].steps[0].phases.prepare.confirmation.eventRef.name = 'missing'; }, 'SAGA_REFERENCE_UNKNOWN', 'bindings', '/0/sagas/0/steps/0/phases/prepare/confirmation/eventRef/name'],
  ['unknown source hint', r => { r.bindings[0].sourceMap = { binding: { '': { file: 'a.json', invented: true } } }; }, 'SAGA_SCHEMA', 'bindings', '/0/sourceMap/binding//invented'],
  ['missing required capability', r => { r.manifest.declaredProducts.products[0].capabilities = []; }, 'PRODUCT_CAPABILITY_MISSING', 'manifest', '/declaredProducts/products/0/capabilities'],
  ['missing supplied capability', r => { r.products[0].capabilities = []; }, 'PRODUCT_CAPABILITY_MISSING', 'products', '/0/capabilities'],
  ['capability version exact', r => { r.products[0].capabilities[0].version = '1.0'; }, 'PRODUCT_CAPABILITY_VERSION', 'products', '/0/capabilities/0/version'],
  ['capability repeated', r => { r.products[0].capabilities.push(clone(r.products[0].capabilities[0])); }, 'PRODUCT_CAPABILITY_DUPLICATE', 'products', '/0/capabilities/1/id'],
  ['runtime certificate not accepted', r => { r.products[0].capabilities.push({ id: 'runtime-verified', version: '1' }); }, 'PRODUCT_CAPABILITY_UNSUPPORTED', 'products', '/0/capabilities/1'],
  ['product version exact', r => { r.products[0].version = '2'; }, 'PRODUCT_VERSION', 'products', '/0/version'],
  ['payload schema exact', r => { r.products[0].payloadSchemaVersion = 'truthsrc.saga-runtime-contract/v3'; }, 'PRODUCT_PAYLOAD_SCHEMA', 'products', '/0/payloadSchemaVersion'],
  ['source not arbitrary binding path', r => { r.products[0].source = { document: 'bindings', pointer: '/0' }; }, 'PRODUCT_SOURCE_MISMATCH', 'products', '/0/source'],
  ['no injected compiler', r => { r.compiler = 'custom'; }, 'PRODUCT_FIELD_UNKNOWN', 'request', '/compiler'],
  ['no injected schema', r => { r.schema = {}; }, 'PRODUCT_FIELD_UNKNOWN', 'request', '/schema'],
  ['no injected registry', r => { r.registry = {}; }, 'PRODUCT_FIELD_UNKNOWN', 'request', '/registry'],
];
for (const [name, change, code, document, pointer] of cases) test(`refuse ${name}`, () => {
  const input = request(); change(input); reject(input, code, document, pointer);
});

for (const [name, change] of [
  ['forged readiness', p => { p.readiness = 'runtime-verified'; }],
  ['forged digest', p => { p.digest = '0'.repeat(64); }],
  ['changed business payload with original digest', p => { p.sagas[0].definition.payload.purpose = 'forged'; }],
  ['changed binding with original digest', p => { p.sagas[0].binding.module = 'forged.Module'; }],
  ['changed source map with original digest', p => { p.sourceMap[''].file = 'forged.yaml'; }],
  ['missing field', p => { delete p.sourceMap; }],
  ['extra field', p => { p.runtimeVerified = true; }],
  ['reordered keys', p => { const x = p.digest; delete p.digest; p.digest = x; }],
]) test(`whole live closure rejects ${name}`, () => {
  const input = request(); change(input.products[0].payload);
  reject(input, 'PRODUCT_PAYLOAD_MISMATCH', 'products', '/0/payload');
});

test('source hint changes require a new complete payload even when digest is unchanged', () => {
  const input = request();
  const digest = input.products[0].payload.digest;
  input.bindings[0].sourceMap = { binding: { '/sagas/0': { file: 'explicit.json', path: '/authored', location: { line: 3, column: 1 } } } };
  const current = compileSagas(input.canonical, input.bindings[0]).ir;
  assert.equal(current.digest, digest);
  reject(input, 'PRODUCT_PAYLOAD_MISMATCH', 'products', '/0/payload');
  input.products[0].payload = current;
  const { context } = success(input);
  assert.deepEqual(context.products['saga-contract@1'].payload.sourceMap['/sagas/0/binding/version'], {
    document: 'binding', pointer: '/sagas/0/version', file: 'explicit.json', atom: null, path: '/authored/version', location: { line: 3, column: 1 },
  });
});

test('binding diagnostic and related pointers translate, hint paths and locations do not', () => {
  const input = request();
  input.bindings[0].sourceMap = { binding: { '/sagas/0': { file: 'explicit.json', path: '/authored', location: { line: 6, column: 2 } } } };
  input.bindings[0].sagas.push(clone(input.bindings[0].sagas[0]));
  const result = reject(input, 'SAGA_DUPLICATE', 'bindings', '/0/sagas/1/sagaId');
  const duplicate = result.diagnostics.find(row => row.code === 'SAGA_DUPLICATE');
  assert.equal(duplicate.related[0].document, 'bindings');
  assert.equal(duplicate.related[0].pointer, '/0/sagas/0/sagaId');
  assert.equal(duplicate.related[0].path, '/authored/sagaId');
  assert.deepEqual(duplicate.related[0].location, { line: 6, column: 2 });
});

test('complete family validation preserves original ordinals and rejects partial success', () => {
  const input = request();
  const inventory = inventorySagaContract();
  input.canonical.aggregates.push(...clone(inventory.canonical.aggregates));
  input.canonical.sagas[0].seq = 20;
  input.canonical.sagas.push(clone(inventory.canonical.sagas[0]));
  input.bindings[0].sagas.push(clone(inventory.binding.sagas[0]));
  input.products[0].payload = compileSagas(input.canonical, input.bindings[0]).ir;
  const { context } = success(input);
  const ir = context.products['saga-contract@1'].payload;
  assert.equal(ir.sagas[0].definition.id, 'reserve-warehouse-sku');
  assert.equal(ir.sourceMap['/sagas/0/definition/id'].pointer, '/sagas/1/id');
  input.canonical.sagas[1].payload.steps[0].participant = 'missing';
  reject(input, 'SAGA_PARTICIPANT_UNKNOWN', 'canonical', '/sagas/1/payload/steps/0/participant');
});

test('unsupported business data remains opaque without a Saga product declaration', () => {
  const input = request();
  input.manifest = manifest(['canonical']); input.bindings = [];
  input.canonical.sagas[0].payload = { opaque: true };
  input.products = [envelope('canonical', input.canonical)];
  const { context } = success(input);
  assert.deepEqual(Object.keys(context.products), ['canonical@1']);
});

test('known capability cannot be borrowed by canonical or an invalid Saga declaration', () => {
  const input = request();
  input.manifest = manifest(['canonical']);
  input.manifest.declaredProducts.products[0].capabilities = identity().capabilities;
  reject(input, 'PRODUCT_CAPABILITY_UNSUPPORTED', 'manifest', '/declaredProducts/products/0/capabilities/0');
  input.manifest = manifest(); input.manifest.declaredProducts.products[0].version = '2';
  reject(input, 'PRODUCT_BINDINGS_UNSUPPORTED', 'bindings', '');
});

test('named host modules remain obligations, not imports or runtime certificates', () => {
  const data = sagaContract();
  data.binding.sagas[0].module = 'DoesNotExist.Module';
  data.binding.sagas[0].engine.entrypoint = 'DoesNotExist.Engine';
  assert.equal(success(request(data)).context.products['saga-contract@1'].payload.readiness, 'contract-only');
});

for (const [name, hostile] of [
  ['undefined', () => undefined], ['function', () => () => {}], ['infinite', () => Infinity],
  ['map', () => new Map()], ['set', () => new Set()], ['date', () => new Date(0)],
  ['sparse', () => Array(1)], ['cycle', () => { const value = {}; value.self = value; return value; }],
  ['hidden', () => Object.defineProperty({}, 'x', { value: 1 })],
  ['symbol', () => ({ [Symbol('x')]: 1 })],
  ['depth', () => { let value = {}; for (let i = 0; i < 130; i++) value = { child: value }; return value; }],
]) test(`binding transport rejects ${name} without partial result`, () => {
  const input = request(); input.bindings[0].hostile = hostile();
  const result = admitProducts(input);
  assert.equal(result.context, null);
  assert.equal(result.diagnostics[0].code, 'PRODUCT_DATA');
  assert.equal(result.diagnostics[0].source.document, 'bindings');
  assert.ok(result.diagnostics[0].source.pointer.startsWith('/0'));
});

test('binding getters and Proxy traps are never evaluated', () => {
  let touched = 0;
  const getter = request();
  Object.defineProperty(getter.bindings[0], 'schemaVersion', { enumerable: true, get() { touched++; throw new Error('getter'); } });
  reject(getter, 'PRODUCT_DATA', 'bindings', '/0');
  const proxy = request();
  proxy.bindings[0] = new Proxy({}, { ownKeys() { touched++; throw new Error('proxy'); }, getPrototypeOf() { touched++; throw new Error('proxy'); }, get() { touched++; throw new Error('proxy'); } });
  reject(proxy, 'PRODUCT_DATA', 'bindings', '/0');
  assert.equal(touched, 0);
});

test('internal compiler binds a detached deeply immutable schema and preserves keyword audit', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'schema/saga-ir-v1.schema.json'), 'utf8'));
  const compiler = createSagaCompiler(schema);
  assert.equal(Object.isFrozen(schema), false);
  const { canonical, binding } = sagaContract();
  const expected = compiler(canonical, binding);
  schema.$defs.resultKinds.const.length = 0;
  schema.$defs.bindingDocument.properties.schemaVersion.const = 'forged';
  assert.deepEqual(compiler(canonical, binding), expected);
  schema.unsupported = true;
  assert.throws(() => createSagaCompiler(schema), /Unknown schema keyword/);
});

for (const preview of [false, true]) test(`Saga manifest CLI refuses before producer/canonical/output, plan=${preview}`, t => {
  const directory = scratch(t), generatorDir = join(directory, 'generator'), marker = join(directory, 'imported'), out = join(directory, 'out');
  mkdirSync(generatorDir);
  writeFileSync(join(generatorDir, 'generator.json'), JSON.stringify(manifest()));
  writeFileSync(join(generatorDir, 'generate.mjs'), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'bad'); export const generate = () => [];`);
  assert.deepEqual(loadManifest(generatorDir).declaredProducts, manifest().declaredProducts);
  assert.throws(() => plan({ generatorDir, canonicalFile: join(directory, 'missing.json') }), /PRODUCT_PLAN_UNSUPPORTED/);
  assert.throws(() => apply({ generatorDir, canonicalFile: join(directory, 'missing.json'), outDir: out }), /PRODUCT_PLAN_UNSUPPORTED/);
  const args = [join(ROOT, 'bin/truthsrc.js'), 'generate', '--in', join(directory, 'missing.json'), '--generator', generatorDir, '--out', out, ...(preview ? ['--plan'] : [])];
  const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout + run.stderr, /PRODUCT_PLAN_UNSUPPORTED/);
  assert.equal(existsSync(marker), false); assert.equal(existsSync(out), false);
});

test('complete source and JSON dependency initialize and admit Saga while effects are denied', () => {
  const dataURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const helper = dataURL(readFileSync(join(ROOT, 'lib/immutable-data.mjs'), 'utf8'));
  const compiler = dataURL(readFileSync(join(ROOT, 'lib/saga/compile-pure.mjs'), 'utf8').replace("'../immutable-data.mjs'", JSON.stringify(helper)));
  const schema = `data:application/json;base64,${readFileSync(join(ROOT, 'schema/saga-ir-v1.schema.json')).toString('base64')}`;
  const product = dataURL(readFileSync(join(ROOT, 'lib/saga/product.mjs'), 'utf8').replace("'./compile-pure.mjs'", JSON.stringify(compiler)).replace("'../../schema/saga-ir-v1.schema.json'", JSON.stringify(schema)));
  const declarations = dataURL(readFileSync(join(ROOT, 'src/core/product-declarations.mjs'), 'utf8').replace("'../../lib/immutable-data.mjs'", JSON.stringify(helper)));
  const source = dataURL(readFileSync(join(ROOT, 'src/core/products.mjs'), 'utf8').replaceAll("'./product-declarations.mjs'", JSON.stringify(declarations)).replace("'../../lib/saga/product.mjs'", JSON.stringify(product)));
  const input = request(inventorySagaContract());
  const script = `
    const fs = (await import('node:fs')).default, child = (await import('node:child_process')).default;
    const { syncBuiltinESMExports } = await import('node:module');
    const deny = () => { throw new Error('forbidden effect'); };
    for (const key of ['readFileSync','readdirSync','existsSync','writeFileSync','mkdirSync','rmSync','statSync','lstatSync']) fs[key] = deny;
    for (const key of ['readFile','writeFile','readdir','stat','open','access']) fs.promises[key] = deny;
    for (const key of ['execFileSync','execSync','spawn','spawnSync','exec','fork']) child[key] = deny;
    syncBuiltinESMExports();
    const finish = process.exit.bind(process);
    globalThis.process = new Proxy({}, { get: deny }); globalThis.Date = new Proxy(class {}, { get: deny, construct: deny });
    globalThis.fetch = deny; globalThis.setTimeout = deny; Math.random = deny;
    const { admitProducts } = await import(${JSON.stringify(source)});
    const input = ${JSON.stringify(input)};
    const good = admitProducts(input);
    if (!good.context || good.diagnostics.length || good.then) throw new Error('static product failed');
    input.bindings[0].sagas[0].version = 'bad';
    const bad = admitProducts(input);
    if (bad.context !== null || !bad.diagnostics.some(row => row.code === 'SAGA_VERSION')) throw new Error('bad contract admitted');
    finish(0);
  `;
  execFileSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
});
