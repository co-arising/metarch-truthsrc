import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENVELOPE_VERSION, REQUIREMENTS_VERSION, admitProducts, validateDeclaredProducts } from '../src/core/products.mjs';
import { createSnapshot, compileSnapshot } from '../lib/compile-snapshot.mjs';
import { compileTree, loadTreeSnapshot } from '../lib/compile.mjs';
import { loadManifest } from '../src/core/manifest.mjs';
import { apply, plan } from '../src/core/generate.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const clone = value => JSON.parse(JSON.stringify(value));
const manifest = () => ({ name: 'admission-fixture', version: '1.0.0', inputSchema: 'truthsrc/v1.0',
  products: ['template'], artifactKinds: ['summary'], output: {},
  declaredProducts: { schemaVersion: REQUIREMENTS_VERSION, products: [{ id: 'canonical', version: '1', payloadSchemaVersion: 'truthsrc/v1', capabilities: [] }] } });
const canonical = () => compileSnapshot(createSnapshot([], { fallbackWorkshop: 'Product contract', inboxDirs: [], aggregateDirs: [] })).canonical;
const envelope = payload => ({ schemaVersion: ENVELOPE_VERSION, id: 'canonical', version: '1',
  payloadSchemaVersion: 'truthsrc/v1', capabilities: [], source: { document: 'canonical', pointer: '' }, payload });
const request = (value = canonical()) => ({ manifest: manifest(), canonical: clone(value), bindings: [], products: [envelope(clone(value))], options: {} });
function scratch(t) {
  const directory = mkdtempSync(join(tmpdir(), 'truthsrc-products-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
const reject = (input, code, document, pointer) => {
  const result = admitProducts(input);
  assert.equal(result.context, null);
  assert.ok(result.diagnostics.some(row => row.code === code && (document === undefined || row.source.document === document)
    && (pointer === undefined || row.source.pointer === pointer)), JSON.stringify(result.diagnostics));
  return result;
};
function frozen(value) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value));
    for (const entry of Object.values(value)) frozen(entry);
  }
}

test('explicit canonical product preserves separate versions and canonical root reference', () => {
  const input = request();
  input.canonical.sagas = [{ id: 'order', version: 'v27', payload: { untouched: true } }];
  input.products[0].payload = clone(input.canonical);
  const result = admitProducts(input);
  assert.deepEqual(result.diagnostics, []);
  const product = result.context.products['canonical@1'];
  assert.equal(Object.getPrototypeOf(result.context.products), null);
  assert.equal(product.schemaVersion, ENVELOPE_VERSION);
  assert.equal(product.version, '1');
  assert.equal(product.payloadSchemaVersion, 'truthsrc/v1');
  assert.equal(result.context.manifest.version, '1.0.0');
  assert.equal(result.context.manifest.declaredProducts.schemaVersion, REQUIREMENTS_VERSION);
  assert.deepEqual(product.source, { document: 'canonical', pointer: '' });
  assert.equal(product.payload.sagas[0].version, 'v27');
  assert.strictEqual(product.payload, result.context.canonical);
  assert.equal(Object.hasOwn(product, 'sourceVerified'), false);
  assert.deepEqual(result, admitProducts(input));
});

test('admitted context is detached and recursively frozen, not a freeze of caller input', () => {
  const input = request();
  input.options.nested = { values: [1, 2] };
  const before = JSON.stringify(input);
  const result = admitProducts(input);
  frozen(result);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(input.canonical), false);
  assert.equal(Object.isFrozen(input.manifest), false);
  assert.equal(Object.isFrozen(input.options.nested), false);
  input.canonical.workshop = 'later';
  input.products[0].payload.workshop = 'later payload';
  input.options.nested.values.push(3);
  assert.equal(result.context.canonical.workshop, 'Product contract');
  assert.deepEqual(result.context.options.nested.values, [1, 2]);
  assert.throws(() => result.context.canonical.aggregates.push({}), TypeError);
  assert.throws(() => { result.context.products['canonical@1'].version = '2'; }, TypeError);
  assert.throws(() => { result.context.products.extra = {}; }, TypeError);
});

test('data key order, null prototypes and unknown authored canonical extras remain intact', () => {
  const value = clone(canonical());
  value.authored = Object.assign(Object.create(null), { z: 1, a: 2, nested: null });
  const input = request(value);
  input.canonical.authored = value.authored;
  input.products[0].payload.authored = Object.assign(Object.create(null), value.authored);
  const result = admitProducts(input);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(Object.getPrototypeOf(result.context.canonical.authored), null);
  assert.deepEqual(Object.keys(result.context.canonical.authored), ['z', 'a', 'nested']);
  assert.equal(JSON.stringify(result.context.canonical), JSON.stringify(value));
});

test('public example file snapshot and serialized-memory input admit identical products', () => {
  const tree = join(ROOT, 'example', 'tree');
  const snapshot = loadTreeSnapshot(tree);
  const fromFiles = compileSnapshot(snapshot);
  const fromMemory = compileSnapshot(clone(snapshot));
  assert.equal(fromFiles.text, compileTree(tree));
  assert.equal(fromFiles.text, fromMemory.text);
  const first = admitProducts(request(fromFiles.canonical));
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(first, admitProducts(request(fromMemory.canonical)));
});

const mutations = [
  ['missing requirements version', r => { delete r.manifest.declaredProducts.schemaVersion; }, 'PRODUCT_REQUIREMENTS_VERSION', 'manifest', '/declaredProducts/schemaVersion'],
  ['unknown requirements version', r => { r.manifest.declaredProducts.schemaVersion = 'truthsrc.product-requirements/v2'; }, 'PRODUCT_REQUIREMENTS_VERSION', 'manifest', '/declaredProducts/schemaVersion'],
  ['missing envelope version', r => { delete r.products[0].schemaVersion; }, 'PRODUCT_ENVELOPE_VERSION', 'products', '/0/schemaVersion'],
  ['unknown envelope version', r => { r.products[0].schemaVersion = 'truthsrc.product-envelope/v2'; }, 'PRODUCT_ENVELOPE_VERSION', 'products', '/0/schemaVersion'],
  ['unknown required product', r => { r.manifest.declaredProducts.products[0].id = 'template'; }, 'PRODUCT_UNKNOWN', 'manifest', '/declaredProducts/products/0/id'],
  ['required product object identity never coerces in missing diagnostics', r => { r.manifest.declaredProducts.products[0].id = { toString: null }; }, 'PRODUCT_UNKNOWN', 'manifest', '/declaredProducts/products/0/id'],
  ['required product array identity is refused without coercion', r => { r.manifest.declaredProducts.products[0].id = []; }, 'PRODUCT_UNKNOWN', 'manifest', '/declaredProducts/products/0/id'],
  ['unknown supplied product', r => { r.products[0].id = 'saga-ir'; }, 'PRODUCT_UNKNOWN', 'products', '/0/id'],
  ['non-string product identity cannot coerce', r => { r.products[0].id = { toString: null }; }, 'PRODUCT_UNKNOWN', 'products', '/0/id'],
  ['prototype property is not registered', r => { r.products[0].id = '__proto__'; }, 'PRODUCT_UNKNOWN', 'products', '/0/id'],
  ['missing required product', r => { r.products = []; }, 'PRODUCT_MISSING', 'products', ''],
  ['duplicate required product', r => { r.manifest.declaredProducts.products.push(clone(r.manifest.declaredProducts.products[0])); }, 'PRODUCT_DUPLICATE', 'manifest', '/declaredProducts/products/1/id'],
  ['duplicate supplied product', r => { r.products.push(clone(r.products[0])); }, 'PRODUCT_DUPLICATE', 'products', '/1/id'],
  ['undeclared supplied product', r => { r.products.push({ ...clone(r.products[0]), id: 'other' }); }, 'PRODUCT_UNDECLARED', 'products', '/1/id'],
  ['required product version has no upgrade', r => { r.manifest.declaredProducts.products[0].version = '1.0'; }, 'PRODUCT_VERSION', 'manifest', '/declaredProducts/products/0/version'],
  ['numeric product version rejected', r => { r.products[0].version = 1; }, 'PRODUCT_VERSION', 'products', '/0/version'],
  ['supplied version mismatch', r => { r.products[0].version = '2'; }, 'PRODUCT_REQUIREMENT_MISMATCH', 'products', '/0'],
  ['payload schema version mismatch', r => { r.products[0].payloadSchemaVersion = 'truthsrc/v2'; }, 'PRODUCT_PAYLOAD_SCHEMA', 'products', '/0/payloadSchemaVersion'],
  ['canonical schema mismatch', r => { r.canonical.schemaVersion = 'truthsrc/v2'; }, 'PRODUCT_CANONICAL_VERSION', 'canonical', '/schemaVersion'],
  ['missing explicit canonical arrays', r => { delete r.canonical.sessions; }, 'PRODUCT_CANONICAL_SHAPE', 'canonical', '/sessions'],
  ['optional collection wrong shape', r => { r.canonical.sagas = {}; }, 'PRODUCT_CANONICAL_SHAPE', 'canonical', '/sagas'],
  ['optional object surface wrong shape', r => { r.canonical.useCases = []; }, 'PRODUCT_CANONICAL_SHAPE', 'canonical', '/useCases'],
  ['workshop wrong shape', r => { r.canonical.workshop = null; }, 'PRODUCT_CANONICAL_SHAPE', 'canonical', '/workshop'],
  ['source document mismatch', r => { r.products[0].source.document = 'tree'; }, 'PRODUCT_SOURCE_MISMATCH', 'products', '/0/source'],
  ['source pointer mismatch', r => { r.products[0].source.pointer = '/aggregates'; }, 'PRODUCT_SOURCE_MISMATCH', 'products', '/0/source'],
  ['payload mismatch', r => { r.products[0].payload.workshop = 'forged'; }, 'PRODUCT_PAYLOAD_MISMATCH', 'products', '/0/payload'],
  ['payload key order is not silently normalized', r => { r.products[0].payload = Object.fromEntries(Object.entries(r.canonical).reverse()); }, 'PRODUCT_PAYLOAD_MISMATCH', 'products', '/0/payload'],
  ['forged digest not accepted', r => { r.products[0].digest = 'approved'; }, 'PRODUCT_FIELD_UNKNOWN', 'products', '/0/digest'],
  ['unknown request field has escaped pointer', r => { r['a/b~c'] = true; }, 'PRODUCT_FIELD_UNKNOWN', 'request', '/a~1b~0c'],
  ['null opt-in does not downgrade', r => { r.manifest.declaredProducts = null; }, 'PRODUCT_SHAPE', 'manifest', '/declaredProducts'],
  ['memory legacy manifest requires opt-in', r => { delete r.manifest.declaredProducts; }, 'PRODUCT_DECLARATION_REQUIRED', 'manifest', '/declaredProducts'],
  ['manifest plugin version required', r => { delete r.manifest.version; }, 'PRODUCT_MANIFEST_VERSION', 'manifest', '/version'],
  ['manifest plugin identity required', r => { r.manifest.name = ''; }, 'PRODUCT_MANIFEST_ID', 'manifest', '/name'],
  ['opt-in schema must be exact', r => { r.manifest.inputSchema = 'truthsrc/v0.3'; }, 'PRODUCT_INPUT_SCHEMA', 'manifest', '/inputSchema'],
  ['nonempty binding input explicitly unsupported', r => { r.bindings = [{ schemaVersion: 'truthsrc.saga-binding/v1' }]; }, 'PRODUCT_BINDINGS_UNSUPPORTED', 'bindings', ''],
  ['bindings not defaulted', r => { delete r.bindings; }, 'PRODUCT_FIELD_REQUIRED', 'request', '/bindings'],
  ['bindings wrong shape', r => { r.bindings = {}; }, 'PRODUCT_BINDINGS_SHAPE', 'bindings', ''],
  ['options not defaulted', r => { delete r.options; }, 'PRODUCT_FIELD_REQUIRED', 'request', '/options'],
  ['options wrong shape', r => { r.options = []; }, 'PRODUCT_OPTIONS_SHAPE', 'request', '/options'],
  ['required capabilities explicit', r => { delete r.manifest.declaredProducts.products[0].capabilities; }, 'PRODUCT_CAPABILITY_SHAPE', 'manifest', '/declaredProducts/products/0/capabilities'],
  ['supplied capabilities wrong shape', r => { r.products[0].capabilities = {}; }, 'PRODUCT_CAPABILITY_SHAPE', 'products', '/0/capabilities'],
  ['requested capability not self-certified', r => { r.manifest.declaredProducts.products[0].capabilities = [{ id: 'typed-fold', version: '1' }]; }, 'PRODUCT_CAPABILITY_UNSUPPORTED', 'manifest', '/declaredProducts/products/0/capabilities/0'],
  ['supplied capability not self-certified', r => { r.products[0].capabilities = [{ id: 'immutable-snapshot', version: '1' }]; }, 'PRODUCT_CAPABILITY_UNSUPPORTED', 'products', '/0/capabilities/0'],
  ['capability duplicate versions refused', r => { r.products[0].capabilities = [{ id: 'typed-fold', version: '1' }, { id: 'typed-fold', version: '2' }]; }, 'PRODUCT_CAPABILITY_DUPLICATE', 'products', '/0/capabilities/1/id'],
  ['capability unknown fields refused', r => { r.products[0].capabilities = [{ id: 'x', version: '1', verified: true }]; }, 'PRODUCT_FIELD_UNKNOWN', 'products', '/0/capabilities/0/verified'],
];
for (const [name, change, code, document, pointer] of mutations) test(name, () => {
  const input = request();
  change(input);
  const before = JSON.stringify(input);
  const first = reject(input, code, document, pointer);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(first, admitProducts(input));
  frozen(first);
});

const invalidData = [
  ['undefined', undefined], ['function', () => {}], ['nonfinite', Infinity], ['map', new Map()], ['set', new Set()],
  ['date', new Date(0)], ['proxy', new Proxy({}, {})], ['sparse', new Array(2)], ['cycle', (() => { const v = {}; v.self = v; return v; })()],
  ['symbol', (() => { const v = {}; v[Symbol('x')] = 1; return v; })()],
  ['hidden', Object.defineProperty({}, 'x', { value: 1 })],
];
for (const [name, value] of invalidData) test(`hostile ${name} data is refused without partial context`, () => {
  const input = request();
  input.options.value = value;
  reject(input, 'PRODUCT_DATA', 'request');
});

test('raw request and nested getters are never evaluated before admission', () => {
  let reads = 0;
  const input = request();
  Object.defineProperty(input, 'manifest', { enumerable: true, get() { reads++; throw new Error('getter executed'); } });
  reject(input, 'PRODUCT_DATA', 'request', '');
  const nested = request();
  Object.defineProperty(nested.products[0], 'payload', { enumerable: true, get() { reads++; throw new Error('getter executed'); } });
  reject(nested, 'PRODUCT_DATA', 'products', '/0');
  const checked = validateDeclaredProducts(Object.defineProperty({}, 'declaredProducts', { enumerable: true, get() { reads++; throw new Error('getter executed'); } }));
  assert.equal(checked.requirements, null);
  assert.equal(checked.diagnostics[0].code, 'PRODUCT_DATA');
  assert.equal(reads, 0);
});

test('raw proxy request does not invoke traps', () => {
  let traps = 0;
  reject(new Proxy({}, { get() { traps++; }, ownKeys() { traps++; } }), 'PRODUCT_DATA', 'request', '');
  assert.equal(traps, 0);
});

test('excessive nesting is refused and diagnostics retain the explicit document', () => {
  const input = request();
  let at = input.canonical;
  for (let i = 0; i < 130; i++) at = at.deep = {};
  const result = reject(input, 'PRODUCT_DATA', 'canonical');
  assert.match(result.diagnostics[0].message, /nesting exceeds 128/);
  assert.match(result.diagnostics[0].source.pointer, /^\/deep/);
});

test('new declaration validation has no legacy defaults and is detached', () => {
  assert.deepEqual(validateDeclaredProducts({ name: 'legacy' }), { requirements: null, diagnostics: [] });
  const input = manifest();
  const result = validateDeclaredProducts(input);
  assert.deepEqual(result.diagnostics, []);
  frozen(result);
  input.declaredProducts.products[0].version = 'later';
  assert.equal(result.requirements.products[0].version, '1');
  assert.equal(Object.isFrozen(input), false);
});

test('multiple errors are stable, sorted and do not admit valid prefix products', () => {
  const input = request();
  input.bindings = [{}];
  input.canonical.schemaVersion = 'bad';
  input.manifest.version = '';
  input.products.push({ ...clone(input.products[0]), id: 'unknown' });
  const result = reject(input, 'PRODUCT_UNDECLARED');
  assert.ok(result.diagnostics.length >= 4);
  const keys = result.diagnostics.map(row => `${row.source.document}\0${row.source.pointer}\0${row.code}`);
  assert.deepEqual(keys, [...keys].sort());
});

function plugin(t, value = manifest()) {
  const directory = scratch(t);
  const generator = join(directory, 'generator');
  const marker = join(directory, 'imported');
  mkdirSync(generator);
  writeFileSync(join(generator, 'generator.json'), JSON.stringify(value));
  writeFileSync(join(generator, 'generate.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'imported'); export const generate = () => [];`);
  return { directory, generator, marker };
}

test('legacy loader retains all four old product names and old manifest return shape', t => {
  const value = manifest();
  delete value.declaredProducts;
  delete value.version;
  value.inputSchema = 'truthsrc/v0.3';
  value.products = ['template', 'readmodels', 'stories', 'useCases'];
  const { generator } = plugin(t, value);
  assert.deepEqual(loadManifest(generator), { ...value, __dir: generator });
  writeFileSync(join(generator, 'generator.json'), JSON.stringify({ ...value, products: ['canonical'] }));
  assert.throws(() => loadManifest(generator), /products required, subset of/);
});

test('manifest loader uses strict opt-in diagnostics while valid declarations remain metadata', t => {
  const { generator } = plugin(t);
  assert.deepEqual(loadManifest(generator).declaredProducts, manifest().declaredProducts);
  const value = manifest();
  value.declaredProducts = null;
  writeFileSync(join(generator, 'generator.json'), JSON.stringify(value));
  assert.throws(() => loadManifest(generator), /PRODUCT_SHAPE \/declaredProducts/);
});

test('valid opt-in plan/apply refuses before canonical loading, import and target writes', t => {
  const { directory, generator, marker } = plugin(t);
  const canonicalFile = join(directory, 'missing-canonical.json');
  const outDir = join(directory, 'target');
  assert.throws(() => plan({ canonicalFile, generatorDir: generator }), /PRODUCT_PLAN_UNSUPPORTED/);
  assert.throws(() => apply({ canonicalFile, generatorDir: generator, outDir }), /PRODUCT_PLAN_UNSUPPORTED/);
  assert.equal(existsSync(marker), false);
  assert.equal(existsSync(outDir), false);
  assert.equal(existsSync(join(outDir, 'truthsrc.ledger.json')), false);
  assert.equal(existsSync(join(outDir, 'anchors.json')), false);
});

for (const preview of [false, true]) test(`CLI opt-in refusal precedes producer import and writes, plan=${preview}`, t => {
  const { directory, generator, marker } = plugin(t);
  const target = join(directory, 'target');
  const args = [join(ROOT, 'bin/truthsrc.js'), 'generate', '--in', join(directory, 'missing.json'), '--generator', generator, '--out', target];
  if (preview) args.push('--plan');
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /PRODUCT_PLAN_UNSUPPORTED/);
  assert.doesNotMatch(result.stderr, /canonical malformed|ENOENT/);
  assert.equal(existsSync(marker), false);
  assert.equal(existsSync(target), false);
});

test('legacy sparse synthetic canonical still generates identical template golden bytes', async t => {
  const directory = scratch(t);
  const canonicalFile = join(directory, 'canonical.json');
  writeFileSync(canonicalFile, JSON.stringify({ schemaVersion: 'truthsrc/v1', workshop: 'template-contract',
    aggregates: [{ name: 'Wallet', commands: [{ name: 'TopUp' }], events: [{ name: 'ToppedUp' }] }] }));
  const generatorDir = join(ROOT, 'generators', '_template');
  const { entries } = await plan({ canonicalFile, generatorDir });
  assert.equal(entries[0].content, readFileSync(join(ROOT, 'golden/_template/expected/aggregates/Wallet.md'), 'utf8'));
});

test('pure product graph uses fixed declarations, schema and deterministic compiler dependencies', () => {
  const graph = {
    'src/core/products.mjs': ['../../lib/saga/product.mjs', './product-declarations.mjs', './product-declarations.mjs'],
    'src/core/product-declarations.mjs': ['../../lib/immutable-data.mjs'],
    'lib/saga/product.mjs': ['./compile-pure.mjs', '../products/contract-schemas-v2.mjs', './version-dispatch.mjs'],
    'lib/products/contract-schemas-v2.mjs': ['../immutable-data.mjs', './contract-schemas.mjs'],
    'lib/products/contract-schemas.mjs': ['../immutable-data.mjs'],
    'lib/saga/version-dispatch.mjs': ['node:util'],
    'lib/saga/compile-pure.mjs': ['node:crypto', 'node:util', '../immutable-data.mjs'],
    'lib/immutable-data.mjs': ['node:util'],
  };
  const imports = source => [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  for (const [file, dependencies] of Object.entries(graph)) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    assert.deepEqual(imports(source), dependencies, file);
    assert.equal(/\b(?:process|Date|fetch|readFileSync|readdirSync|writeFileSync|existsSync|setTimeout)\b|\brequire\s*\(/.test(source.replace(/\/\/[^\n]*/g, '')), false, file);
  }
  const product = readFileSync(join(ROOT, 'lib/saga/product.mjs'), 'utf8');
  assert.deepEqual([...product.matchAll(/import\('([^']+)'/g)].map(m => m[1]), ['../../schema/saga-ir-v1.schema.json']);
  assert.equal(readFileSync(join(ROOT, 'src/core/manifest.mjs'), 'utf8').includes("from './product-declarations.mjs'"), true);
});

test('preloaded product initialization and calls work while effects are denied', () => {
  const dataURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const helper = dataURL(readFileSync(join(ROOT, 'lib/immutable-data.mjs'), 'utf8'));
  const declarations = dataURL(readFileSync(join(ROOT, 'src/core/product-declarations.mjs'), 'utf8').replace("'../../lib/immutable-data.mjs'", JSON.stringify(helper)));
  const compiler = dataURL(readFileSync(join(ROOT, 'lib/saga/compile-pure.mjs'), 'utf8').replace("'../immutable-data.mjs'", JSON.stringify(helper)));
  const schema = `data:application/json;base64,${readFileSync(join(ROOT, 'schema/saga-ir-v1.schema.json')).toString('base64')}`;
  const schemas = dataURL(readFileSync(join(ROOT, 'lib/products/contract-schemas.mjs'), 'utf8')
    .replace("'../immutable-data.mjs'", JSON.stringify(helper)));
  const schemasV2 = dataURL(readFileSync(join(ROOT, 'lib/products/contract-schemas-v2.mjs'), 'utf8')
    .replace("'../immutable-data.mjs'", JSON.stringify(helper)).replace("'./contract-schemas.mjs'", JSON.stringify(schemas)));
  const dispatch = dataURL(readFileSync(join(ROOT, 'lib/saga/version-dispatch.mjs'), 'utf8'));
  const product = dataURL(readFileSync(join(ROOT, 'lib/saga/product.mjs'), 'utf8')
    .replace("'./compile-pure.mjs'", JSON.stringify(compiler)).replace("'../../schema/saga-ir-v1.schema.json'", JSON.stringify(schema))
    .replace("'../products/contract-schemas-v2.mjs'", JSON.stringify(schemasV2)).replace("'./version-dispatch.mjs'", JSON.stringify(dispatch)));
  const source = dataURL(readFileSync(join(ROOT, 'src/core/products.mjs'), 'utf8')
    .replaceAll("'./product-declarations.mjs'", JSON.stringify(declarations)).replace("'../../lib/saga/product.mjs'", JSON.stringify(product)));
  const input = request();
  const script = `
    const fs = (await import('node:fs')).default;
    const child = (await import('node:child_process')).default;
    const { syncBuiltinESMExports } = await import('node:module');
    const deny = () => { throw new Error('forbidden effect'); };
    for (const key of ['readFileSync','readdirSync','existsSync','writeFileSync','mkdirSync','rmSync','statSync','lstatSync']) fs[key] = deny;
    for (const key of ['execFileSync','execSync','spawn','spawnSync','exec','fork']) child[key] = deny;
    syncBuiltinESMExports();
    const finish = process.exit.bind(process);
    globalThis.process = new Proxy({}, { get: deny });
    globalThis.Date = new Proxy(class {}, { get: deny, construct: deny });
    globalThis.fetch = deny;
    Math.random = deny;
    const { admitProducts, validateDeclaredProducts } = await import(${JSON.stringify(source)});
    const input = ${JSON.stringify(input)};
    if (validateDeclaredProducts(input.manifest).diagnostics.length) throw new Error('wrong declaration');
    const result = admitProducts(input);
    if (result.diagnostics.length || result.context.products['canonical@1'].payload.workshop !== 'Product contract') throw new Error('wrong admission');
    input.bindings = [{}];
    if (admitProducts(input).context !== null) throw new Error('binding unexpectedly admitted');
    finish(0);
  `;
  execFileSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', timeout: 15000 });
});
