import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { aggregateCoreFixture } from './aggregate-core-fixture.mjs';
import { buildModels } from '../generators/scala-cqrs-aggregate-core-v1/build-models.mjs';
import { persistenceWireLayout, wireCanonical, WIRE_LAYOUT_SCHEMA } from '../generators/scala-cqrs-persistence-readside-v1/wire-layout.mjs';

function fixture() {
  const f = aggregateCoreFixture(), model = buildModels({ products: f.products, options: f.config.options });
  const ref = f.products['reference-layout'].declarations.find(d => d.ref.kind === 'aggregate').ref;
  return { model, ref };
}

test('wire descriptor pins the nonempty complete Warehouse state graph and nominal map structure', () => {
  const { model, ref } = fixture(), before = structuredClone(model.serialization);
  const result = persistenceWireLayout(model.serialization, ref, 'state'), d = result.descriptor;
  assert.equal(d.schemaVersion, WIRE_LAYOUT_SCHEMA);
  assert.equal(d.root, 'example.inventory.protobuf.WarehouseSnapshot');
  assert.deepEqual(d.nodes.map(n => n.id), [
    'example.inventory.protobuf.TxIdValue', 'example.inventory.protobuf.WarehouseSnapshot',
    'example.inventory.protobuf.WarehouseSnapshotField0', 'example.inventory.protobuf.WarehouseSnapshotField0Entry',
  ]);
  const snapshot = d.nodes.find(n => n.kind === 'state');
  assert.deepEqual(snapshot.fields.map(f => [f.name, f.number, f.nodeId, f.required]),
    [['f0', 1, 'example.inventory.protobuf.WarehouseSnapshotField0', true]]);
  const map = d.nodes.find(n => n.kind === 'map');
  assert.deepEqual(map.fields.map(f => [f.name, f.number, f.repeated, f.wireType]), [['present', 1, false, 'bool'], ['f0', 2, true, null]]);
  const entry = d.nodes.find(n => n.kind === 'map-entry');
  assert.deepEqual(entry.fields.map(f => [f.number, f.nodeId, f.wireType, f.required]),
    [[1, 'example.inventory.protobuf.TxIdValue', null, true], [2, null, 'string', false]]);
  assert.equal(result.sha256, createHash('sha256').update(result.canonical).digest('hex'));
  assert.deepEqual(model.serialization, before);
  assert.ok(Object.isFrozen(d) && Object.isFrozen(d.nodes));
  assert.ok(!result.canonical.includes('inventory-domain') && !result.canonical.includes('/aggregates/'));
});

test('wire graph ignores source movement, Scala API spelling, object-key ordering and unrelated roots', () => {
  const { model, ref } = fixture(), original = persistenceWireLayout(model.serialization, ref, 'state');
  const s = structuredClone(model.serialization);
  function navigation(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'source') value[key] = { document: 'relocated', pointer: '/new' };
      else if (key === 'sources') value[key] = [{ document: 'relocated', pointer: '/new' }];
      else if (['accessor', 'identifier', 'fqn', 'path'].includes(key) && typeof item === 'string') value[key] = 'different';
      else navigation(item);
    }
  }
  navigation(s);
  const irrelevant = s.nodes.find(n => n.id.endsWith('WarehouseSkuQuantityReserved'));
  irrelevant.fields[0].number = 999;
  s.nodes.reverse();
  assert.equal(persistenceWireLayout(s, ref, 'state').sha256, original.sha256);
  assert.equal(wireCanonical({ z: 1, a: { y: 2, b: [3, 4] } }), wireCanonical({ a: { b: [3, 4], y: 2 }, z: 1 }));
  assert.notEqual(wireCanonical([1, 2]), wireCanonical([2, 1]));
});

for (const [label, change] of [
  ['field number', n => { n.fields[0].number = 7; }],
  ['field ownership', n => { n.fields[0].ref.id = 'other'; }],
  ['primitive wire type', n => { n.fields[0].wireType = 'bytes'; }],
  ['presence semantics', n => { n.fields[0].required = true; }],
  ['repeated semantics', n => { n.fields[0].repeated = true; }],
  ['codec identity', n => { n.codec = { schemaVersion: 'example/codec-v2', version: '2' }; }],
  ['exact precision', n => { n.exact = { form: 'decimal', precision: 20, scale: 2 }; }],
]) test(`transitive ${label} changes the persisted root layout identity`, () => {
  const { model, ref } = fixture(), original = persistenceWireLayout(model.serialization, ref, 'state');
  const s = structuredClone(model.serialization);
  const child = s.nodes.find(n => label === 'field ownership' ? n.kind === 'state' : n.id === 'example.inventory.protobuf.TxIdValue');
  change(child);
  assert.notEqual(persistenceWireLayout(s, ref, 'state').sha256, original.sha256);
});

test('different persisted roots have distinct stable identities and missing/duplicate/cyclic graphs reject', () => {
  const { model, ref } = fixture();
  const hashes = model.serialization.roots.filter(r => ['state', 'event'].includes(r.role))
    .map(r => persistenceWireLayout(model.serialization, r.ref, r.role).sha256);
  assert.equal(hashes.length, 3); assert.equal(new Set(hashes).size, 3);
  assert.throws(() => persistenceWireLayout(model.serialization, ref, 'value'), /event\/state/);
  const mutate = change => { const s = structuredClone(model.serialization); change(s); assert.throws(() => persistenceWireLayout(s, ref, 'state')); };
  mutate(s => { s.nodes = s.nodes.filter(n => !n.id.endsWith('TxIdValue')); });
  mutate(s => { s.nodes.push(s.nodes[0]); });
  mutate(s => { s.roots.push(s.roots.find(r => r.role === 'state')); });
  mutate(s => { const n = s.nodes.find(n => n.id.endsWith('TxIdValue')); n.fields[0].nodeId = n.id; });
});
