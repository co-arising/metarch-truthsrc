import { aggregateCoreFixture } from './aggregate-core-fixture.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';

const ref = (kind, owner, id) => ({ context: 'inventory', kind, owner, id });

// This is a product-admission fixture. The synthetic SHA values below are NOT
// observed PB layouts or runtime qualification; producer lowering must reject them.
export function persistenceReadsideBinding() {
  return {
    schemaVersion: 'truthsrc.persistence-readside-binding/v1', id: 'warehouse-persistence', version: '1', context: 'inventory',
    aggregate: ref('aggregate', [], 'Warehouse'),
    wire: { serializerId: 736401, envelopeVersion: 1, registrations: [
      { ref: ref('event', ['Warehouse'], 'SkuQuantityReserved'), role: 'event', typeId: 'warehouse.reserved', version: 1, layoutSha256: '1'.repeat(64) },
      { ref: ref('event', ['Warehouse'], 'SkuReservationCommitted'), role: 'event', typeId: 'warehouse.committed', version: 1, layoutSha256: '2'.repeat(64) },
      { ref: ref('aggregate', [], 'Warehouse'), role: 'state', typeId: 'warehouse.state', version: 1, layoutSha256: '3'.repeat(64) },
    ] },
    store: {
      schemaVersion: 'truthsrc.journal-readside/v2', id: 'WarehouseReadside', version: '1', dialect: 'h2-2', tablePrefix: 'warehouse_rs',
      source: { id: 'warehouse-events', version: '1' }, identity: { kind: 'envelope-resource' }, streamKind: 'warehouse',
      pollIntervalMillis: 100, closeTimeoutMillis: 5000, pageSize: 64, maxPayloadBytes: 1048576, maxPending: 64,
      indexes: [{ id: 'Receipt', table: 'receipt', stateField: ref('state-field', ['Warehouse'], 'receipts'),
        keySize: 256, valueSize: 256, query: { id: 'by_resource' } }],
    },
  };
}

export function persistenceReadsideFixture(change = () => {}) {
  const original = aggregateCoreFixture(), canonical = structuredClone(original.canonical), config = structuredClone(original.config);
  const binding = persistenceReadsideBinding();
  config.products.push({ id: 'persistence-readside-contract', version: '1' });
  config.roles = { persistenceReadsideBinding: 'persistence' };
  config.documents = [{ id: 'persistence', file: 'bindings/persistence.json' }];
  config.generator = 'scala-cqrs-persistence-readside-v1';
  change({ binding, canonical, config });
  const documents = [{ id: 'persistence', schemaVersion: binding.schemaVersion, value: binding }];
  const request = deriveProjectRequest(canonical, config, documents);
  const compilation = compileProductSet(request);
  const products = compilation.result ? Object.fromEntries(compilation.result.products.map(p => [p.id, p.payload])) : null;
  return { original, canonical, config, binding, documents, request, compilation, products };
}
