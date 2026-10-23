// Synthetic, closed business contracts; neither fixture claims runtime support.
export const RESULT_KINDS = ['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown'];
export const REQUIRED_CAPABILITIES = ['durable-commit-decision', 'durable-abort-decision', 'typed-nonterminal-unknown', 'safe-status-reattach', 'receipt-reconciliation', 'participant-idempotency-query', 'pinned-definition-codec', 'manual-evidence-authorization', 'cancel-before-prepare-fencing', 'durable-manifest'];
const OPERATION_IDENTITY = ['txid', 'definition-version', 'participant', 'resource', 'step', 'phase'];
const RECEIPT_IDENTITY = ['txid', 'definition-version', 'args-digest', 'participant', 'resource', 'step', 'phase'];
const slot = (slot, type) => ({ slot, type });
const mapping = (slot, ref, type) => ({ slot, ref, type });
const field = (name, dataType) => ({ name, dataType, origin: 'BUSINESS_INPUT' });
const idType = (id) => ({ id, canonicalType: id, implementation: `fixture.types.${id}`, kind: 'id', minLength: 1, maxLength: 128 });
const phaseBinding = (eventRef, outputs) => ({
  kind: 'command', port: 'fixture.PhasePort', commandMapper: 'fixture.CommandMapper',
  confirmation: { kind: 'durable-receipt', eventRef, mapper: 'fixture.ConfirmationMapper',
    outputs: outputs.map(({ slot, type }) => mapping(slot, `receipt:${slot}`, type)) },
  query: { mapper: 'fixture.QueryMapper', mode: 'read-only', identity: [...RECEIPT_IDENTITY], resultKinds: ['confirmed', 'not-executed', 'unknown'] },
  receipt: { mapper: 'fixture.ReceiptMapper', version: 'receipt-v1', durable: true, identity: [...RECEIPT_IDENTITY], payloadCompatibility: 'exact', evidence: 'reservation-decision-effect-reconciliation' },
  idempotency: { mapper: 'fixture.IdempotencyMapper', identity: [...OPERATION_IDENTITY], payloadConflict: 'reject', attemptIdentity: 'excluded' },
});
export function sagaContract(domain = 'MoneyTransfer') {
  const fab = domain === 'Fab';
  const id = fab ? 'fab-double-lot' : 'money-transfer';
  const aggregateName = fab ? 'Lot' : 'Account';
  const resourceType = fab ? 'LotId' : 'AccountId';
  const operationType = fab ? 'WaferSet' : 'Money';
  const args = [slot('from', resourceType), slot('to', resourceType), slot(fab ? 'wafers' : 'amount', operationType),
    ...(fab ? [slot('manifest', 'ManifestRef')] : [])];
  const aggregate = { name: aggregateName, identifier: field('id', resourceType), commands: [], events: [] };
  const ownedRef = (name) => ({ aggregate: aggregateName, name });
  const businessSteps = [];
  const technicalSteps = [];
  for (const [ordinal, participant] of ['source', 'target'].entries()) {
    const stepId = participant === 'source' ? 'reserve-source' : 'reserve-target';
    const businessPhases = {};
    const technicalPhases = {};
    for (const phase of ['prepare', 'commit', 'compensate']) {
      const name = `${phase}-${participant}`;
      const bindings = [mapping('txid', 'txid', 'TxId'), mapping('resource', `args:${ordinal === 0 ? 'from' : 'to'}`, resourceType)];
      if (phase === 'prepare') bindings.push(mapping(fab ? 'wafers' : 'amount', fab && ordinal === 1
        ? 'step:reserve-source:prepare:carried' : `args:${fab ? 'wafers' : 'amount'}`, operationType));
      if (phase !== 'prepare') bindings.push(mapping('reservation', `step:${stepId}:prepare:reservation`, 'ReservationId'));
      const outputs = phase === 'prepare' ? [slot('reservation', 'ReservationId'), ...(fab && ordinal === 0 ? [slot('carried', 'WaferSet')] : [])]
        : phase === 'commit' ? [slot('receiptId', 'TxId')] : [];
      aggregate.commands.push({ name, parameters: bindings.map(({ slot, type }) => field(slot, type)), produces: [`${name}-confirmed`] });
      aggregate.events.push({ name: `${name}-confirmed`, payloads: outputs.map(({ slot, type }) => field(slot, type)) });
      businessPhases[phase] = { kind: 'command', commandRef: ownedRef(name), bindings, outputs };
      technicalPhases[phase] = phaseBinding(ownedRef(`${name}-confirmed`), outputs);
    }
    businessSteps.push({ id: stepId, participant, group: fab ? ordinal + 1 : 1, phases: businessPhases });
    technicalSteps.push({ stepId, phases: technicalPhases });
  }
  const sourceFields = [field('operationId', 'OperationId'), ...args.map(({ slot, type }) => field(slot, type))];
  aggregate.commands.push({ name: 'StartTransfer', parameters: sourceFields, produces: ['TransferRequested'] });
  aggregate.events.push({ name: 'TransferRequested', payloads: sourceFields });
  for (const kind of RESULT_KINDS) aggregate.events.push({ name: `result-${kind}`, payloads: [field('txid', 'TxId')] });
  const types = [idType('TxId'), idType('OperationId'), idType(resourceType), idType('ReservationId'),
    ...(fab ? [idType('WaferId'), { id: 'WaferSet', canonicalType: 'WaferSet', implementation: 'fixture.types.WaferSet', kind: 'collection', elementType: 'WaferId', minItems: 1, maxItems: 64 },
      { id: 'ManifestRef', canonicalType: 'ManifestRef', implementation: 'fixture.types.ManifestRef', kind: 'manifest-reference', readable: true, version: 'manifest-v1' }]
      : [{ id: 'Money', canonicalType: 'Money', implementation: 'fixture.types.Money', kind: 'money', currency: 'ISO-4217', amountEncoding: 'minor-unit-string', scale: 2, precision: 38, codec: 'fixture.ExactMoneyCodec' }])];
  const payload = {
    schemaVersion: 'truthsrc.saga/v1', purpose: fab ? 'Transfer a frozen wafer set between two Lots' : 'Reserve then transfer between two accounts',
    invariants: [fab ? 'Frozen manifest and wafer identities are conserved' : 'Currency and exact minor units are conserved'],
    transactionIdType: 'TxId', args,
    participants: ['source', 'target'].map((id, ordinal) => ({ id, aggregate: aggregateName, resourceRef: { ref: `args:${ordinal === 0 ? 'from' : 'to'}`, type: resourceType } })),
    groups: fab ? [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [1] }] : [{ id: 1, dependsOn: [] }],
    steps: businessSteps,
    resilience: { maxAttempts: 3, phaseTimeoutMs: 1000, queryTimeoutMs: 500, backoffMs: 100, totalTimeoutMs: 10000 },
    safety: { commitDecision: 'durable-before-commit', abortDecision: 'durable-before-compensate', afterCommit: 'forward-recovery', unknown: 'reconcile-before-resume', compensation: 'confirmed-reservations', cancelBeforePrepare: 'empty-release-and-fence', retryIdentity: 'stable-operation', manualRecovery: 'authorized-reconciliation-evidence' },
    admission: { maxParticipants: 2, maxInFlight: fab ? 1 : 2, maxItemsPerChunk: 64,
      manifest: fab ? { mode: 'durable-reference', durable: true, ref: { ref: 'args:manifest', type: 'ManifestRef' }, version: 'manifest-v1', selection: 'frozen-before-prepare' } : { mode: 'static', durable: true } },
    triggers: ['command', 'event'].map((kind) => ({ id: `from-${kind}`, kind, sourceRef: ownedRef(kind === 'command' ? 'StartTransfer' : 'TransferRequested'),
      argsMapping: args.map(({ slot, type }) => mapping(slot, `source:${slot}`, type)),
      idempotency: { ref: 'source:operationId', type: 'OperationId', scope: 'saga-version', conflict: 'reject-different-args' } })),
    resultKinds: [...RESULT_KINDS],
    completions: RESULT_KINDS.map((kind) => ({ kind, eventRef: ownedRef(`result-${kind}`), bindings: [mapping('txid', 'txid', 'TxId')] })),
  };
  return {
    canonical: { schemaVersion: 'truthsrc/v1', workshop: `${domain} closed contract fixture`, aggregates: [aggregate], sessions: [],
      sagas: [{ id, name: fab ? 'Fab double Lot contract' : 'MoneyTransfer contract', seq: 0, version: 'v1', payload }] },
    binding: { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [{ sagaId: id, version: 'v1', module: 'fixture.SagaModule',
      engine: { artifact: 'net.imadz:saga-core:0.2', apiMode: 'strict', entrypoint: 'fixture.StrictSagaEntry', capabilities: { required: [...REQUIRED_CAPABILITIES] } },
      codec: { id: 'ArgsCodec', version: 'codec-v1', compatibleVersions: ['codec-v1'], mapper: 'fixture.ArgsCodec' }, types,
      participants: payload.participants.map(({ id, aggregate, resourceRef }) => ({ participantId: id,
        addressing: { resolver: `fixture.${id}Resolver`, aggregate, resourceType: resourceRef.type, mode: 'exact-resource' } })),
      steps: technicalSteps,
      triggerMappers: payload.triggers.map(({ id }) => ({ triggerId: id, argsMapper: 'fixture.TriggerArgsMapper', idempotencyMapper: 'fixture.TriggerIdempotencyMapper' })),
      completionMappers: RESULT_KINDS.map((kind) => ({ kind, mapper: 'fixture.CompletionMapper' })),
    }] },
  };
}
