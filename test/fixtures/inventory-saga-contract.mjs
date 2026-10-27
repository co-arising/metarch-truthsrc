// Independently authored warehouse/SKU reservation contract. Static types only;
// no claim about stock sufficiency, arithmetic conservation or runtime effects.
import { createSnapshot, compileSnapshot } from '../../lib/compile-snapshot.mjs';
import { slug } from '../../lib/shared-pure.mjs';

export function inventorySagaContract() {
  const outcomes = ['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown'];
  const required = ['durable-commit-decision', 'durable-abort-decision', 'typed-nonterminal-unknown', 'safe-status-reattach', 'receipt-reconciliation', 'participant-idempotency-query', 'pinned-definition-codec', 'manual-evidence-authorization', 'cancel-before-prepare-fencing', 'durable-manifest'];
  const operationIdentity = ['txid', 'definition-version', 'participant', 'resource', 'step', 'phase'];
  const receiptIdentity = ['txid', 'definition-version', 'args-digest', 'participant', 'resource', 'step', 'phase'];
  const field = (name, dataType) => ({ name, dataType, origin: 'BUSINESS_INPUT' });
  const map = (slot, ref, type) => ({ slot, ref, type });
  const ref = name => ({ aggregate: 'Warehouse', name });
  const types = ['TxId', 'ReservationRequestId', 'WarehouseId', 'SkuId', 'ReservationId'].map(id => ({
    id, canonicalType: id, implementation: `inventory.types.${id}`, kind: 'id', minLength: 1, maxLength: 80,
  }));
  types.push({ id: 'Quantity', canonicalType: 'Int', implementation: 'inventory.types.Quantity', kind: 'integer', minimum: 1, maximum: 10000 });
  const args = [{ slot: 'warehouse', type: 'WarehouseId' }, { slot: 'sku', type: 'SkuId' }, { slot: 'quantity', type: 'Quantity' }];
  const commands = [], events = [], phases = {}, technicalPhases = {};
  for (const [phase, command, event] of [
    ['prepare', 'ReserveSkuQuantity', 'SkuQuantityReserved'],
    ['commit', 'CommitSkuReservation', 'SkuReservationCommitted'],
    ['compensate', 'ReleaseSkuReservation', 'SkuReservationReleased'],
  ]) {
    const bindings = [map('txid', 'txid', 'TxId'), map('warehouse', 'args:warehouse', 'WarehouseId'), map('sku', 'args:sku', 'SkuId')];
    if (phase === 'prepare') bindings.push(map('quantity', 'args:quantity', 'Quantity'));
    else bindings.push(map('reservation', 'step:reserve-sku:prepare:reservation', 'ReservationId'));
    const outputs = phase === 'prepare' ? [{ slot: 'reservation', type: 'ReservationId' }] : [{ slot: 'txid', type: 'TxId' }];
    commands.push({ name: command, parameters: bindings.map(row => field(row.slot, row.type === 'Quantity' ? 'Int' : row.type)), produces: [event] });
    events.push({ name: event, payloads: outputs.map(row => field(row.slot, row.type)) });
    phases[phase] = { kind: 'command', commandRef: ref(command), bindings, outputs };
    technicalPhases[phase] = {
      kind: 'command', port: 'inventory.WarehousePort', commandMapper: `inventory.${command}Mapper`,
      confirmation: { kind: 'durable-receipt', eventRef: ref(event), mapper: 'inventory.ConfirmationMapper', outputs: outputs.map(row => map(row.slot, `receipt:${row.slot}`, row.type)) },
      query: { mapper: 'inventory.ReservationQuery', mode: 'read-only', identity: [...receiptIdentity], resultKinds: ['confirmed', 'not-executed', 'unknown'] },
      receipt: { mapper: 'inventory.ReservationReceipt', version: 'receipt-v1', durable: true, identity: [...receiptIdentity], payloadCompatibility: 'exact', evidence: 'reservation-decision-effect-reconciliation' },
      idempotency: { mapper: 'inventory.ReservationIdentity', identity: [...operationIdentity], payloadConflict: 'reject', attemptIdentity: 'excluded' },
    };
  }
  commands.push({ name: 'RequestSkuReservation', parameters: [field('requestId', 'ReservationRequestId'), field('warehouse', 'WarehouseId'), field('sku', 'SkuId'), field('quantity', 'Int')], produces: ['SkuReservationRequested'] });
  events.push({ name: 'SkuReservationRequested', payloads: commands.at(-1).parameters.map(row => ({ ...row })) });
  for (const kind of outcomes) events.push({ name: `Reservation-${kind}`, payloads: [field('txid', 'TxId')] });
  const saga = {
    id: 'reserve-warehouse-sku', name: 'Reserve integer SKU quantity in one warehouse', seq: 7, version: 'inventory-v3',
    payload: {
      schemaVersion: 'truthsrc.saga/v1', purpose: 'Reserve a requested SKU quantity, commit allocation or release the reservation',
      invariants: ['The reservation retains its warehouse, SKU and exact positive integer quantity'], transactionIdType: 'TxId', args,
      participants: [{ id: 'warehouse', aggregate: 'Warehouse', resourceRef: { ref: 'args:warehouse', type: 'WarehouseId' } }],
      groups: [{ id: 1, dependsOn: [] }], steps: [{ id: 'reserve-sku', participant: 'warehouse', group: 1, phases }],
      resilience: { maxAttempts: 2, phaseTimeoutMs: 500, queryTimeoutMs: 250, backoffMs: 100, totalTimeoutMs: 2000 },
      safety: { commitDecision: 'durable-before-commit', abortDecision: 'durable-before-compensate', afterCommit: 'forward-recovery', unknown: 'reconcile-before-resume', compensation: 'confirmed-reservations', cancelBeforePrepare: 'empty-release-and-fence', retryIdentity: 'stable-operation', manualRecovery: 'authorized-reconciliation-evidence' },
      admission: { maxParticipants: 1, maxInFlight: 1, maxItemsPerChunk: 1, manifest: { mode: 'static', durable: true } },
      triggers: [{ id: 'reservation-request', kind: 'command', sourceRef: ref('RequestSkuReservation'),
        argsMapping: args.map(row => map(row.slot, `source:${row.slot}`, row.type)),
        idempotency: { ref: 'source:requestId', type: 'ReservationRequestId', scope: 'saga-version', conflict: 'reject-different-args' } }],
      resultKinds: [...outcomes], completions: outcomes.map(kind => ({ kind, eventRef: ref(`Reservation-${kind}`), bindings: [map('txid', 'txid', 'TxId')] })),
    },
  };
  const atoms = [{ file: 'workshop.yaml', doc: { name: 'Warehouse SKU reservation' } },
    { file: 'aggregates/warehouse/aggregate.yaml', doc: { kind: 'aggregate', name: 'Warehouse',
      payload: { name: 'Warehouse', identifier: field('id', 'WarehouseId') },
      order: { commands: commands.map(row => row.name), events: events.map(row => row.name) }, extraEvents: events } },
    ...commands.map(command => ({ file: `aggregates/warehouse/slices/${slug(command.name)}.slice.yaml`,
      doc: { kind: 'slice', command: command.name, payload: command } })),
    { file: `sagas/${slug(saga.id)}.saga.yaml`, doc: { kind: 'saga', ...saga } }];
  const metadata = { fallbackWorkshop: 'Warehouse SKU reservation', inboxDirs: [], aggregateDirs: ['warehouse'] };
  const canonical = compileSnapshot(createSnapshot(atoms, metadata)).canonical;
  const binding = { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [{
    sagaId: saga.id, version: saga.version, module: 'inventory.ReservationModule',
    engine: { artifact: 'net.imadz:saga-core:0.2', apiMode: 'strict', entrypoint: 'inventory.StrictEntry', capabilities: { required } },
    codec: { id: 'ReservationArgs', version: 'args-v1', compatibleVersions: ['args-v1'], mapper: 'inventory.ReservationArgsCodec' }, types,
    participants: [{ participantId: 'warehouse', addressing: { resolver: 'inventory.WarehouseResolver', aggregate: 'Warehouse', resourceType: 'WarehouseId', mode: 'exact-resource' } }],
    steps: [{ stepId: 'reserve-sku', phases: technicalPhases }],
    triggerMappers: [{ triggerId: 'reservation-request', argsMapper: 'inventory.RequestMapper', idempotencyMapper: 'inventory.RequestIdentity' }],
    completionMappers: outcomes.map(kind => ({ kind, mapper: 'inventory.ReservationOutcome' })),
  }] };
  return { canonical, binding, atoms, metadata };
}
