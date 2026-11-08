import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { aggregateCoreFixture } from './aggregate-core-fixture.mjs';
import { buildModels, diagnoseWireLayouts, baseProductIds } from '../generators/scala-cqrs-persistence-readside-v1/build-models.mjs';
import { buildModels as baseModels } from '../generators/scala-cqrs-aggregate-core-v1/build-models.mjs';

const project = fileURLToPath(new URL('../scaffold/persistence-readside-project/truthsrc.project.json', import.meta.url));
const input = () => { const f = aggregateCoreFixture(project); return { products: f.products, options: f.config.options }; };

test('persistence model preserves family2 and resolves versioned wire ABI from the real scaffold', () => {
  const i = input(), before = structuredClone(i), m = buildModels(i);
  assert.deepEqual(i, before);
  assert.equal(m.profile, 'scala-cqrs-persistence-readside@1');
  assert.deepEqual(m.family, baseModels({ products: Object.fromEntries(baseProductIds.map(id => [id, i.products[id]])), options: i.options }));
  assert.deepEqual(m.registrations.map(r => [r.typeId, r.encode]), [
    ['warehouse.reserved', 'encodeWarehouseSkuQuantityReserved'],
    ['warehouse.committed', 'encodeWarehouseSkuReservationCommitted'],
    ['warehouse.state', 'encodeWarehouseState'],
  ]);
  assert.equal(m.names.repository.fqn, 'example.inventory.infrastructure.readside.WarehouseReadsideRepository');
  assert.equal(m.names.frame.fqn, 'example.inventory.persistence.protobuf.Frame');
  assert.equal(m.index.keyMember, 'txid'); assert.equal(m.index.valueMember, 'receipt');
  assert.equal(m.index.replaceMethod, 'replaceReceipts');
  assert.deepEqual(m.schema.tables.map(t => t.name), ['warehouse_rs_namespace', 'warehouse_rs_event', 'warehouse_rs_state', 'warehouse_rs_offset', 'warehouse_rs_receipt']);
  assert.match(m.compatibilityKey, /^[a-f0-9]{64}$/);
  assert.equal(m.manifestPrefix, 'warehouse-frame/1');
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.registrations));
});

test('bad wire expectation is diagnosed but never silently accepted or refreshed', () => {
  const i = structuredClone(input());
  i.products['persistence-readside-contract'].wire.registrations[0].layoutSha256 = '0'.repeat(64);
  const before = structuredClone(i), diagnostics = diagnoseWireLayouts(i);
  assert.equal(diagnostics[0].expected, '0'.repeat(64));
  assert.notEqual(diagnostics[0].sha256, diagnostics[0].expected);
  assert.throws(() => buildModels(i), /wire layout mismatch/);
  assert.deepEqual(i, before);
});

test('supplied enriched payload drift cannot bypass reconstruction', () => {
  for (const mutation of [
    p => { p.store.indexes[0].sql.key = ['map_value']; },
    p => { p.store.indexes[0].keyCarriers = []; },
    p => { p.wire.registrations[0].domainSource.pointer = '/unrelated'; },
    p => { p.store.bindingSource.pointer = '/wire'; },
  ]) {
    const i = structuredClone(input()); mutation(i.products['persistence-readside-contract']);
    assert.throws(() => buildModels(i), /differs from|lowering/);
  }
});

test('new naming bindings are explicit and do not widen original family2 roles', () => {
  const i = structuredClone(input()), p = i.products['persistence-readside-contract'];
  i.options.names.push({ ref: p.aggregate, role: 'persistence-serializer', name: 'WireSerializer' });
  const m = buildModels(i);
  assert.equal(m.names.serializer.name, 'WireSerializer');
  assert.equal(m.family.aggregates[0].aggregate.name, 'WarehouseAggregate');
  i.options.names.push({ ref: p.aggregate, role: 'persistence-serializer', name: 'Again' });
  assert.throws(() => buildModels(i), /duplicate/);
});
