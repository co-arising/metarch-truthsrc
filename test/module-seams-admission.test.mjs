import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { compileAuthorEntries, emitAuthorDoc } from '../lib/author-surface.mjs';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { slug } from '../lib/shared.mjs';
import { compactAuthorStructures } from '../lib/author-compact.mjs';
import { resolveSourcePointer, knowledgeIdentity } from '../lib/source-index.mjs';
import { deriveModuleSeamsContract, compileModuleSeamsContract } from '../lib/products/module-seams-contract.mjs';
import { compileModuleSeamsComposition } from '../lib/products/module-seams-composition.mjs';
import { lowerModuleSeamsTarget } from '../lib/products/module-seams-target.mjs';
import { ProductError } from '../lib/products/request.mjs';
import { moduleSeamsFixture, projectRoot, ref } from './module-seams-fixture.mjs';
const rejects = fn => assert.throws(fn, ProductError);
const lower = (f, options) => lowerModuleSeamsTarget(f.canonical, { id: 'contract', schemaVersion: 'truthsrc.module-seams-contract-binding/v1', value: { schemaVersion: 'truthsrc.module-seams-contract-binding/v1', contract: deriveModuleSeamsContract(f.canonical) } }, f.composition, options);

for (const [name, edit] of [
  ['same root path under different keys', o => { o.sourceRoots[1].path = o.sourceRoots[0].path; }],
  ['nested source roots', o => { o.sourceRoots[1].path = o.sourceRoots[0].path + '/nested'; }],
  ['portable case alias roots', o => { o.sourceRoots[1].path = o.sourceRoots[0].path.toUpperCase(); }],
]) test('root selection rejects ' + name, () => { const f = moduleSeamsFixture(), o = structuredClone(f.config.options); edit(o); rejects(() => lower(f, o)); });

for (const [name, edit] of [
  ['nonportable source segment', b => { b.implementations[0].source.file = 'nested/Capacity:Rule.scala'; }],
  ['keyword FQN package', b => { b.implementations[0].symbol = 'example.type.domain.CapacityRule'; }],
]) test('technical ABI rejects ' + name, () => { const f = moduleSeamsFixture(), b = structuredClone(f.composition); edit(b.value); rejects(() => compileModuleSeamsComposition(b, f.canonical, deriveModuleSeamsContract(f.canonical))); });

test('single context compiler rejects a second-context legacy nominal, not silently ignoring it', () => {
  const f = moduleSeamsFixture(), c = structuredClone(f.canonical); c.value.types = [{ name: 'Foreign', context: 'other', fields: [] }]; rejects(() => deriveModuleSeamsContract(c));
});

test('method, parameter and variant source identities stay precise after compact representation', () => {
  const f = moduleSeamsFixture(), prefix = 'contexts/parcel/';
  const index = f.tree.sourceIndex;
  for (const [pointer, kind, owner, id] of [
    ['/moduleSeamsContracts/0/ports/0/methods/0', 'port-method', ['CapacityPolicy'], 'assess'],
    ['/moduleSeamsContracts/0/ports/0/methods/0/parameters/1', 'port-parameter', ['CapacityPolicy', 'assess'], 'parcels'],
    ['/valueObjects/7/variants/1', 'signature-variant', ['QuoteError'], 'InvalidCapacity'],
    ['/valueObjects/7/variants/1/fields/0', 'signature-field', ['QuoteError', 'InvalidCapacity'], 'routeId'],
  ]) {
    const s = resolveSourcePointer(index, pointer)[0]; assert.equal(s.pointer, pointer); assert.equal(s.identity, knowledgeIdentity('module-seams', 'parcel', kind, owner, id));
  }
  const entries = [
    { file: 'system.yaml', content: readFileSync(projectRoot + f.config.tree + '/system.yaml', 'utf8') },
    { file: prefix + 'context.yaml', content: readFileSync(projectRoot + f.config.tree + '/' + prefix + 'context.yaml', 'utf8') },
    ...f.canonical.value.valueObjects.map((v, i) => ({ file: prefix + 'value-objects/' + slug(v.name) + '.vo.yaml', content: emitAuthorDoc({ kind: 'value-object', name: v.name, seq: v.seq, payload: Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'seq')) }) })),
    { file: prefix + 'formal-products/module-seams-contract/parcel-seams.formal.yaml', content: emitAuthorDoc({ kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'module-seams-contract', id: 'parcel-seams', version: '1', payload: f.canonical.value.moduleSeamsContracts[0] }) },
  ];
  const compressed = compactAuthorStructures(entries, { groups: [{ id: 'signatures', files: entries.filter(e => e.file.includes('/value-objects/')).map(e => e.file) }] });
  const compiled = compileAuthorEntries(compressed.files);
  assert.deepEqual(compiled.canonical.valueObjects, f.canonical.value.valueObjects);
  const parent = mkdtempSync(join(tmpdir(), 'module-seams-source-'));
  try {
    const tree = join(parent, 'module-seams');
    for (const e of compressed.files) { mkdirSync(dirname(join(tree, e.file)), { recursive: true }); writeFileSync(join(tree, e.file), e.content); }
    // Use the ordinary real author/source compiler, not a synthetic index.
    const source = resolveSourcePointer(compileTreeWithSources(tree).sourceIndex, '/valueObjects/7/variants/1/fields/0/dataType')[0];
    assert.equal(source.kind, 'signature-field'); assert.ok(source.file.includes('/structures/')); assert.ok(source.locationMapping);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test('contract cannot move contexts by changing all nominal refs while retaining the real author context', () => {
  const f = moduleSeamsFixture(), canonical = structuredClone(f.canonical), row = canonical.value.moduleSeamsContracts[0];
  row.context = 'other';
  const change = v => { if (v && typeof v === 'object') { if (v.context === 'parcel') v.context = 'other'; Object.values(v).forEach(change); } };
  change(row); rejects(() => deriveModuleSeamsContract(canonical));
});

test('direct implementation lowering omits the bridge and rejects stale bridge options', () => {
  const f = moduleSeamsFixture(); f.composition.value.bridges = [];
  f.composition.value.implementations[0].implements = ref('port', 'CapacityPolicy');
  f.composition.value.root.bindings[0].target = { kind: 'implementation', id: 'capacity-rule' };
  rejects(() => lower(f, f.config.options)); // Old bridge name is now unused.
  const options = structuredClone(f.config.options); options.names = options.names.filter(n => n.ref.component !== 'capacity-bridge');
  const result = lower(f, options); assert.equal(result.generatedFiles.length, 6);
  assert.equal(result.generatedFiles.some(f => f.role === 'bridge'), false); assert.deepEqual(result.composition.bridges, []);
});

test('malformed documents and legacy declaration families produce diagnostics without invoking caller effects', () => {
  const f = moduleSeamsFixture(), c = deriveModuleSeamsContract(f.canonical);
  for (const b of [null, [], 'not a binding']) {
    rejects(() => compileModuleSeamsContract(b, f.canonical));
    rejects(() => compileModuleSeamsComposition(b, f.canonical, c));
  }
  for (const family of ['types', 'ports', 'domainServices', 'hostComputations']) for (const bad of [null, {}, [null]]) {
    const canonical = structuredClone(f.canonical); canonical.value[family] = bad; rejects(() => deriveModuleSeamsContract(canonical));
  }
  let calls = 0;
  const accessor = { ...f.canonical }; Object.defineProperty(accessor, 'value', { enumerable: true, get() { calls++; throw new Error('must not execute'); } });
  rejects(() => deriveModuleSeamsContract(accessor));
  rejects(() => deriveModuleSeamsContract(new Proxy(f.canonical, { ownKeys() { calls++; throw new Error('must not execute'); } })));
  assert.equal(calls, 0);
});

test('new schemas have closed, non-placeholder shapes and locally resolvable references', () => {
  const names = ['signature-value-v1', 'module-seams-contract-v1', 'module-seams-contract-binding-v1', 'module-seams-composition-binding-v1', 'module-seams-composition-v1', 'module-seams-options-v1'];
  const schemas = names.map(n => JSON.parse(readFileSync(new URL('../schema/' + n + '.schema.json', import.meta.url))));
  const lookup = new Map(schemas.map(s => [s.$id, s]));
  function walk(schema, document) {
    if (!schema || typeof schema !== 'object') return;
    if (schema.type === 'object') {
      assert.equal(schema.additionalProperties, false); assert.ok(Object.keys(schema.properties).length > 0);
      assert.ok(schema.required.length > 0); assert.ok(schema.required.every(k => Object.hasOwn(schema.properties, k)));
    }
    if (schema.$ref) {
      const [id, pointer] = schema.$ref.split('#'), target = id ? lookup.get(id) : document;
      assert.ok(target, 'no remote/unresolved schema ' + schema.$ref);
      const found = (pointer || '').split('/').filter(Boolean).reduce((v, k) => v?.[k], target); assert.ok(found, schema.$ref);
    }
    for (const value of Object.values(schema)) if (value && typeof value === 'object') {
      if (Array.isArray(value)) value.forEach(v => walk(v, document)); else walk(value, document);
    }
  }
  schemas.forEach(s => walk(s, s));
  const f = moduleSeamsFixture(), c = deriveModuleSeamsContract(f.canonical), composition = compileModuleSeamsComposition(f.composition, f.canonical, c);
  const keys = o => Object.keys(o).sort();
  assert.deepEqual(keys(c), keys(lookup.get('urn:truthsrc:module-seams-contract:v1').$defs.contract.properties));
  assert.deepEqual(keys(composition), keys(lookup.get('urn:truthsrc:module-seams-composition:v1').properties));
  assert.deepEqual(keys(f.composition.value), keys(lookup.get('urn:truthsrc:module-seams-composition-binding:v1').$defs.compositionInput.properties));
  assert.deepEqual(keys(f.config.options), keys(lookup.get('urn:truthsrc:module-seams-options:v1').properties));
});

test('reference implementations are intentionally copied original bytes, not generated code evidence', () => {
  const p = JSON.parse(readFileSync(projectRoot + 'SOURCES.json', 'utf8'));
  assert.equal(p.files.length, 3);
  for (const f of p.files) assert.deepEqual(readFileSync(projectRoot + f.file), readFileSync(new URL('../' + f.origin, import.meta.url)));
});
