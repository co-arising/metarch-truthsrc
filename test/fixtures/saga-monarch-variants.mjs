import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseAuthorDoc } from '../../lib/author-parse.mjs';
import { emitAuthorDoc } from '../../lib/author-surface.mjs';

const workflowFile = 'truth/saga-monarch/contexts/inventory/formal-products/workflow/inventory-job.formal.yaml';
const input = (id, type) => ({ id, type, durability: 'start-record' });
const source = ref => ({ context: 'inventory', kind: 'pipeline', owner: [], id: ref });
const terminal = (kind, target = null, delayMillis = 0) => ({ kind, target, compatibilityKey: target ? 'same' : null, delayMillis });

/** Test-only author-tree deltas. Never manufacture canonical or asserted products. */
export function configureSagaMonarchVariant(author, variant) {
  const file = join(author, workflowFile), doc = parseAuthorDoc(readFileSync(file, 'utf8'), workflowFile);
  const workflow = doc.payload, bindingFile = join(author, 'bindings/composition.json');
  const binding = JSON.parse(readFileSync(bindingFile, 'utf8'));
  if (variant === 'carry') {
    const sourceArea = workflow.areas[0], resultArea = workflow.areas[1];
    const batch = { kind: 'by-compatibility-key', maxItems: 2, minItems: 2, maxWaitMillis: 100, allowPartialOnClose: false };
    sourceArea.batch = { ...batch }; sourceArea.completion.resource = 'carry';
    sourceArea.completion.terminal = terminal('route', 'inspect');
    resultArea.batch = { ...batch };
    const inspect = structuredClone(sourceArea);
    inspect.id = 'inspect'; inspect.action.kind = 'query-saga'; inspect.verification = true;
    inspect.completion = { terminal: terminal('route', resultArea.id), unknown: 'hold', resource: 'release', retainCarried: true };
    workflow.areas.splice(1, 0, inspect);
    workflow.settings.maxAcceptedItems = 4; workflow.settings.maxActiveItems = 4;
    workflow.settings.maxActiveBytes = 16384;
    workflow.capacities[0].units = 2;
    binding.workflow.proofFormat = 'owner-certificates-v1';
    binding.workflow.carry = { reservationSuffix: '/occupancy', ownerSuffix: '/owner' };
  } else if (variant === 'retry') {
    const runId = 'managed-check', port = 'Check';
    const outcomes = [
      { code: 'Done', kind: 'success', action: 'continue' },
      { code: 'Rejected', kind: 'business-rejection', action: 'stop' },
      { code: 'Failed', kind: 'infrastructure-failure', action: 'manual-recovery' },
      { code: 'Uncertain', kind: 'unknown-effect', action: 'manual-recovery' },
    ];
    const pipeline = { kind: 'pipeline', id: runId, name: 'Managed result admission', context: 'inventory',
      steps: [{ id: 'execute', name: 'Execute one idempotent managed operation', execution: {
        port, reads: [{ slot: 'request', ref: 'input:request', type: 'ReservationRequest' },
          { slot: 'transactionId', ref: 'input:transactionId', type: 'TransactionId' }],
        writes: [{ id: 'result', slot: 'result', type: 'ReservationResult', durability: 'durable-reference' }], outcomes,
      } }],
      execution: { schemaVersion: 'truthsrc.execution/v2', inputs: [input('request', 'ReservationRequest'), input('transactionId', 'TransactionId')],
        outputs: [{ id: 'result', ref: 'step:execute:result', type: 'ReservationResult' }],
        recovery: { inputResponsibility: 'host', inputs: ['input:request', 'input:transactionId'], planVersion: 'v1', planCompatibility: 'exact',
          checkpoint: 'confirmed-prefix', unknownEffect: 'reconcile-before-resume', ownership: 'single-writer' },
        admission: { maxConcurrentRuns: 8, maxInFlightSteps: 1, maxItemsPerChunk: 1, maxInFlightChunks: 1 } },
    };
    const pipelineFile = join(author, 'truth/saga-monarch/contexts/inventory/pipelines/managed-check.pipeline.yaml');
    if (existsSync(pipelineFile)) throw new Error('variant pipeline destination already exists');
    // Caller creates the absent variant residence; only this explicit authored atom is added.
    writeFileSync(pipelineFile, emitAuthorDoc(pipeline), { flag: 'wx' });
    const executionFile = join(author, 'bindings/execution.json');
    const execution = JSON.parse(readFileSync(executionFile, 'utf8'));
    if (execution.pipelines.length) throw new Error('variant requires the unmodified empty standalone Run set');
    execution.pipelines.push({ pipelineId: runId, engine: 'monarch-persistence/0.3.0-dev.r2-20261106-dc168f96fa62',
      module: 'reference.inventory.glue.ManagedCheckRun',
      codec: { id: 'ManagedCodec', version: 'managed-codec-v1', compatibleVersions: ['managed-codec-v1'] },
      types: ['TransactionId', 'ReservationRequest', 'ReservationResult'].map(id => ({ id, implementation: 'reference.inventory.kernel.' + id })),
      ports: [{ id: port, implementation: 'reference.inventory.ext.ManagedCheck', effect: 'external', confirmation: 'durable-ack',
        idempotency: { mode: 'keyed', key: 'transactionId' },
        inputs: [{ slot: 'request', type: 'ReservationRequest' }, { slot: 'transactionId', type: 'TransactionId' }],
        outputs: [{ slot: 'result', type: 'ReservationResult' }], outcomes: outcomes.map(({ code, kind }) => ({ code, kind })) }],
      run: { definitionId: runId, definitionVersion: 'v1', codecVersion: 'managed-codec-v1', mode: 'managed', identity: 'caller-supplied-exact',
        operations: [{ stepId: 'execute', connectorId: 'managed-check', connectorVersion: 'v1', ledgerEpoch: 'epoch-1',
          requestCodec: { id: 'ManagedRequest', version: 'v1', compatibleVersions: ['v1'] },
          identity: 'original-run-step', query: 'read-only-original-request' }] },
    });
    writeFileSync(executionFile, JSON.stringify(execution, null, 2) + '\n');
    const area = workflow.areas[0];
    area.action = { kind: 'run', ref: { id: runId, version: 'v1' },
      inputs: [{ slot: 'request', source: 'request' }, { slot: 'transactionId', source: 'transaction-id' }],
      result: { slot: 'result', onStopped: 'original-item', outcomes: [
        { code: 'Done', result: 'succeeded' }, { code: 'Rejected', result: 'rejected-before-effects' },
        { code: 'Failed', result: 'recovery-required' }, { code: 'Uncertain', result: 'outcome-unknown' },
      ] },
      retry: { semantics: 'reexecute-after-rejected-before-effects', identity: 'original-item-new-batch-operation',
        onExhausted: { kind: 'fail', reason: 'finite item retry budget exhausted' } } };
    area.maxExecutions = 2;
    area.completion.terminal = { kind: 'by-result', cases: [
      { result: 'succeeded', disposition: terminal('complete') },
      { result: 'rejected-before-effects', disposition: terminal('retry', null, 6000) },
      { result: 'compensated', disposition: terminal('hold') },
    ] };
    binding.root.runs = [{ id: runId, version: 'v1', ports: [{ id: port, implementation: 'managed-check-leaf' }] }];
    binding.implementations.push({ id: 'managed-check-leaf', version: 'v1', module: 'ext', role: 'adapter',
      symbol: 'reference.inventory.ext.ManagedCheck', construction: 'class',
      implements: { context: 'inventory', kind: 'port', owner: [], id: 'ManagedCheck' },
      sourceRootKey: 'inventory-implementations', file: 'ManagedCheck.scala',
      constructor: [{ implicit: false, parameters: [{ name: 'directory', input: 'directory' }] },
        { implicit: true, parameters: [{ name: 'ec', input: 'executionContext' }] }], provides: ['run:' + runId + ':' + port] });
    const leaf = { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'technical-port',
      id: 'ManagedCheck', version: 'v1', payload: { schemaVersion: 'truthsrc.saga-monarch-run-port/v1',
        name: 'ManagedCheck', version: 'v1', pipeline: { id: runId, version: 'v1' }, port } };
    writeFileSync(join(author, 'truth/saga-monarch/contexts/inventory/formal-products/technical-port/managed-check.formal.yaml'),
      emitAuthorDoc(leaf), { flag: 'wx' });
    writeFileSync(join(author, 'implementations/ManagedCheck.scala'),
      readFileSync(new URL('../reference/saga-monarch/run-fixtures/ManagedCheck.scala', import.meta.url)), { flag: 'wx' });
    const projectFile = join(author, 'truthsrc.project.json'), project = JSON.parse(readFileSync(projectFile, 'utf8'));
    project.options.names.push({ ref: source(runId), role: 'run', name: 'ManagedCheckRun' });
    writeFileSync(projectFile, JSON.stringify(project, null, 2) + '\n');
  } else throw new Error('unknown finite author variant');
  writeFileSync(file, emitAuthorDoc(doc));
  writeFileSync(bindingFile, JSON.stringify(binding, null, 2) + '\n');
}
