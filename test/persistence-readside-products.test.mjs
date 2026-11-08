import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProductSet } from '../lib/products/compile.mjs';
import { compilePersistenceReadside, PERSISTENCE_DEPENDENCIES } from '../lib/products/persistence-readside.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { ProductError } from '../lib/products/request.mjs';
import { profileFor } from '../lib/products/registry.mjs';
import { refKey } from '../lib/domain-products/references.mjs';
import { persistenceReadsideFixture } from './persistence-readside-fixture.mjs';

const bindingDocument = request => request.documents.find(d => d.id === 'persistence');
const payload = result => result.products.find(p => p.id === 'persistence-readside-contract').payload;
function reject(change, expected) {
  const fixture = persistenceReadsideFixture(), request = structuredClone(fixture.request);
  change(bindingDocument(request).value, request);
  const before = structuredClone(request), result = compileProductSet(request);
  assert.equal(result.result, null);
  assert.ok(result.diagnostics.length);
  if (expected) assert.match(result.diagnostics[0].code, expected);
  assert.deepEqual(request, before);
}

test('file-first Warehouse prerequisites derive the new technical product without a second business definition', () => {
  const f = persistenceReadsideFixture();
  assert.deepEqual(f.compilation.diagnostics, []);
  assert.ok(f.compilation.result);
  assert.deepEqual(f.canonical, f.original.canonical);
  for (const { id } of PERSISTENCE_DEPENDENCIES) assert.deepEqual(f.products[id], f.original.products[id]);
  assert.deepEqual(profileFor('persistence-readside-contract', '1').requires, PERSISTENCE_DEPENDENCIES);
  const p = payload(f.compilation.result), index = p.store.indexes[0];
  assert.equal(p.schemaVersion, 'truthsrc.persistence-readside-contract/v1');
  assert.deepEqual(p.source, { document: 'persistence', pointer: '' });
  assert.deepEqual(index.source, { document: 'persistence', pointer: '/store/indexes/0' });
  assert.equal(index.fieldSource.document, 'inventory-domain');
  assert.deepEqual(index.keyCarriers.map(c => c.ref.id), ['TxId']);
  assert.deepEqual(index.valueCarriers, []);
  assert.deepEqual(index.sql.key, ['pid_key', 'map_key']);
  assert.deepEqual(index.sql.queries, [{ id: 'by_resource', where: ['resource_id'], orderBy: ['map_key', 'pid_key'] }]);
  assert.equal(p.wire.registrations[0].domainSource.document, 'inventory-domain');
  assert.deepEqual(p.wire.registrations.map(r => r.layoutSha256), f.binding.wire.registrations.map(r => r.layoutSha256));
  assert.deepEqual(f.compilation.result.readiness, { level: 'static-contract-only', runnable: false, runtimeBindingVerified: false });
  assert.deepEqual(compileProductSet(f.request), f.compilation);
  assert.ok(Object.isFrozen(p) && Object.isFrozen(index.sql));
});

const shapes = [
  b => b, b => b.aggregate, b => b.wire, b => b.wire.registrations[0], b => b.wire.registrations[0].ref,
  b => b.store, b => b.store.source, b => b.store.identity, b => b.store.indexes[0], b => b.store.indexes[0].query,
];
for (const [i, select] of shapes.entries()) {
  test(`closed technical shape ${i} rejects extra Scala or semantic state`, () => reject(b => { select(b).scalaBody = 'success'; }, /FIELD_UNKNOWN/));
  test(`closed technical shape ${i} rejects a missing declared field`, () => reject(b => { const row = select(b); delete row[Object.keys(row)[0]]; }, /FIELD_MISSING|VERSION/));
}

const cases = [
  ['wrong binding version', b => { b.version = '2'; }, /VERSION/],
  ['wrong context', b => { b.context = 'other'; }, /CONTEXT/],
  ['foreign aggregate', b => { b.aggregate.context = 'other'; }],
  ['wrong aggregate role', b => { b.aggregate = b.wire.registrations[0].ref; }, /AGGREGATE/],
  ['unresolved registration', b => { b.wire.registrations[0].ref.id = 'Absent'; }],
  ['wrong event role', b => { b.wire.registrations[0].role = 'state'; }, /WIRE_ROLE/],
  ['state as event', b => { b.wire.registrations[2].role = 'event'; }, /WIRE_ROLE/],
  ['missing state', b => { b.wire.registrations.pop(); }, /WIRE_COVERAGE/],
  ['missing event', b => { b.wire.registrations.shift(); }, /WIRE_COVERAGE/],
  ['duplicate registration', b => { b.wire.registrations.push(structuredClone(b.wire.registrations[0])); }, /DUPLICATE/],
  ['duplicate type id even at another version', b => { b.wire.registrations[1].typeId = b.wire.registrations[0].typeId; b.wire.registrations[1].version = 2; }, /DUPLICATE/],
  ['unbounded type id', b => { b.wire.registrations[0].typeId = 'x'.repeat(129); }, /IDENTITY/],
  ['manifest delimiter in type id', b => { b.wire.registrations[0].typeId = 'event:1'; }, /IDENTITY/],
  ['zero wire version', b => { b.wire.registrations[0].version = 0; }, /BOUND/],
  ['unknown envelope version', b => { b.wire.envelopeVersion = 2; }, /VERSION/],
  ['reserved serializer id', b => { b.wire.serializerId = 100; }, /BOUND/],
  ['oversize serializer id', b => { b.wire.serializerId = 2147483648; }, /BOUND/],
  ['malformed layout pin', b => { b.wire.registrations[0].layoutSha256 = 'a'; }, /LAYOUT_PIN/],
  ['uppercase layout pin', b => { b.wire.registrations[0].layoutSha256 = 'A'.repeat(64); }, /LAYOUT_PIN/],
  ['store v1 is not reinterpreted', b => { b.store.schemaVersion = 'truthsrc.journal-readside/v1'; }, /STORE_VERSION/],
  ['MySQL is not certified by H2', b => { b.store.dialect = 'mysql'; }, /STORE_VERSION/],
  ['blank store version', b => { b.store.version = ''; }],
  ['whitespace source version', b => { b.store.source.version = ' 1'; }, /VERSION/],
  ['state-field identity not fabricated', b => { b.store.identity.kind = 'state-field'; }, /IDENTITY/],
  ['missing source identity', b => { b.store.source.id = ''; }],
  ['zero page', b => { b.store.pageSize = 0; }, /BOUND/],
  ['oversize page', b => { b.store.pageSize = 1025; }, /BOUND/],
  ['oversize pending', b => { b.store.maxPending = 1025; }, /BOUND/],
  ['zero payload', b => { b.store.maxPayloadBytes = 0; }, /BOUND/],
  ['oversize payload', b => { b.store.maxPayloadBytes = 8388609; }, /BOUND/],
  ['zero close timeout', b => { b.store.closeTimeoutMillis = 0; }, /BOUND/],
  ['too small polling interval', b => { b.store.pollIntervalMillis = 9; }, /BOUND/],
  ['zero indexes', b => { b.store.indexes = []; }, /INDEX_COUNT/],
  ['second index not silently ignored', b => { b.store.indexes.push(structuredClone(b.store.indexes[0])); }, /INDEX_COUNT/],
  ['scalar index target', b => { b.store.indexes[0].stateField = { context: 'inventory', kind: 'type', owner: [], id: 'TxId' }; }, /INDEX_FIELD/],
  ['missing index field', b => { b.store.indexes[0].stateField.id = 'other'; }],
  ['reserved SQL table', b => { b.store.indexes[0].table = 'event'; }, /TABLE/],
  ['bad SQL identifier', b => { b.store.tablePrefix = 'foo; DROP'; }, /SQL_NAME/],
  ['reserved Scala index', b => { b.store.indexes[0].id = 'Row'; }, /NAME_COLLISION/],
  ['reserved query', b => { b.store.indexes[0].query.id = 'read'; }, /NAME_COLLISION/],
  ['unbounded key', b => { b.store.indexes[0].keySize = 2049; }, /BOUND/],
];
for (const [name, change, expected] of cases) test(name, () => reject(change, expected));

test('technical document requires selected product and exact dependencies without consuming an extra canonical', () => {
  const f = persistenceReadsideFixture(), request = structuredClone(f.request);
  request.requirements.find(r => r.id === 'persistence-readside-contract').requires.pop();
  assert.match(compileProductSet(request).diagnostics[0].code, /DEPENDENCY/);
  const config = structuredClone(f.original.config);
  assert.throws(() => deriveProjectRequest(f.canonical, config, f.documents), ProductError);
  const extra = structuredClone(f.request);
  extra.documents.push({ id: 'other-domain', schemaVersion: 'truthsrc/v1', value: structuredClone(f.canonical) });
  extra.requirements.find(r => r.id === 'persistence-readside-contract').inputRoles.canonical = 'other-domain';
  assert.equal(compileProductSet(extra).result, null);
  assert.match(compileProductSet(extra).diagnostics[0].code, /ROLE/);
});

test('direct lowerer rejects a second aggregate, external producer and wrong map carrier', () => {
  const f = persistenceReadsideFixture();
  const lower = change => {
    const products = structuredClone(f.original.products);
    change(products);
    assert.throws(() => compilePersistenceReadside(f.documents[0], f.request.documents.find(d => d.id === 'inventory-domain'), products), ProductError);
  };
  lower(p => p['reference-layout'].declarations.push({
    ref: { context: 'inventory', kind: 'aggregate', owner: [], id: 'Other' }, valueType: null,
    source: { document: 'inventory-domain', pointer: '/aggregates/1' }, dependencies: [],
  }));
  lower(p => { p['domain-external-events'].producers = [{}]; });
  lower(p => { p['domain-dependencies'].externalProducers = [{}]; });
  for (const type of [{ form: 'primitive', name: 'integer' }, { form: 'optional', element: { form: 'primitive', name: 'string' } }]) {
    lower(p => { p['reference-layout'].declarations.find(d => d.ref.kind === 'type' && d.ref.id === 'TxId').valueType = type; });
  }
  lower(p => {
    const d = p['reference-layout'].declarations.find(d => d.ref.kind === 'type' && d.ref.id === 'TxId');
    d.valueType = { form: 'nominal', ref: d.ref };
  });
  lower(p => { p['domain-folds'].events.pop(); });
  lower(p => { p['domain-dependencies'].commands.forEach(c => { c.events = []; }); });
});

test('new technical product exposes the exact declared event/state source refs without reordering field semantics', () => {
  const f = persistenceReadsideFixture(), before = structuredClone(f.request), p = payload(f.compilation.result);
  const expected = f.products['reference-layout'].declarations.filter(d => ['aggregate', 'event'].includes(d.ref.kind));
  assert.deepEqual(p.wire.registrations.map(r => refKey(r.ref)).sort(), expected.map(d => refKey(d.ref)).sort());
  assert.deepEqual(f.request, before);
  assert.equal(profileFor('persistence-readside-contract', '2'), null);
  assert.equal(profileFor('not-persistence-readside', '1'), null);
});
