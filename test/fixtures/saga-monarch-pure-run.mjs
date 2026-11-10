import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { emitAuthorDoc } from '../../lib/author-surface.mjs';

/** Finite standalone pure pipeline, an author delta applied to a private scaffold copy. */
export function configurePureRun(author) {
  const runId = 'pure-review';
  const outcomes = [
    { code: 'Done', kind: 'success', action: 'continue' },
    { code: 'Rejected', kind: 'business-rejection', action: 'stop' },
    { code: 'Failed', kind: 'infrastructure-failure', action: 'manual-recovery' },
  ];
  const step = (id, port, reads, writes) => ({ id, name: port, execution: { port, reads, writes, outcomes } });
  const pipeline = { kind: 'pipeline', id: runId, name: 'Pure ordered request review', context: 'inventory',
    steps: [
      step('review', 'Review', [{ slot: 'request', ref: 'input:request', type: 'ReservationRequest' }],
        [{ id: 'checked', slot: 'checked', type: 'ReservationRequest', durability: 'checkpoint' }]),
      step('summarize', 'Summarize', [{ slot: 'request', ref: 'step:review:checked', type: 'ReservationRequest' },
        { slot: 'transactionId', ref: 'input:transactionId', type: 'TransactionId' }],
      [{ id: 'result', slot: 'result', type: 'ReservationResult', durability: 'checkpoint' }]),
    ], execution: { schemaVersion: 'truthsrc.execution/v2',
      inputs: [{ id: 'request', type: 'ReservationRequest', durability: 'start-record' },
        { id: 'transactionId', type: 'TransactionId', durability: 'start-record' }],
      outputs: [{ id: 'result', ref: 'step:summarize:result', type: 'ReservationResult' }],
      recovery: { inputResponsibility: 'host', inputs: ['input:request', 'input:transactionId'], planVersion: 'v1', planCompatibility: 'exact',
        checkpoint: 'confirmed-prefix', unknownEffect: 'reconcile-before-resume', ownership: 'single-writer' },
      admission: { maxConcurrentRuns: 4, maxInFlightSteps: 1, maxItemsPerChunk: 1, maxInFlightChunks: 1 } } };
  const directory = join(author, 'truth/saga-monarch/contexts/inventory/pipelines'); mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'pure-review.pipeline.yaml'), emitAuthorDoc(pipeline), { flag: 'wx' });
  const executionFile = join(author, 'bindings/execution.json'), execution = JSON.parse(readFileSync(executionFile, 'utf8'));
  execution.pipelines.push({ pipelineId: runId, engine: 'monarch-persistence/0.3.0-dev.r2-20261106-dc168f96fa62',
    module: 'reference.inventory.glue.PureReviewRun', codec: { id: 'PureReviewCodec', version: 'pure-codec-v1', compatibleVersions: ['pure-codec-v1'] },
    types: ['TransactionId', 'ReservationRequest', 'ReservationResult'].map(id => ({ id, implementation: 'reference.inventory.kernel.' + id })),
    ports: pipeline.steps.map(step => ({ id: step.execution.port, implementation: 'reference.inventory.ext.' + step.execution.port + 'Leaf',
      effect: 'pure', confirmation: 'checkpoint', idempotency: { mode: 'none' },
      inputs: step.execution.reads.map(({ slot, type }) => ({ slot, type })),
      outputs: step.execution.writes.map(({ slot, type }) => ({ slot, type })),
      outcomes: outcomes.map(({ code, kind }) => ({ code, kind })) })),
    run: { definitionId: runId, definitionVersion: 'v1', codecVersion: 'pure-codec-v1', mode: 'versioned',
      identity: 'caller-supplied-exact', operations: [] } });
  writeFileSync(executionFile, JSON.stringify(execution, null, 2) + '\n');
  const compositionFile = join(author, 'bindings/composition.json'), composition = JSON.parse(readFileSync(compositionFile, 'utf8'));
  composition.root.runs = [{ id: runId, version: 'v1', ports: [] }];
  for (const port of ['Review', 'Summarize']) {
    const id = port.toLowerCase() + '-leaf', name = port + 'Leaf';
    composition.root.runs[0].ports.push({ id: port, implementation: id });
    composition.implementations.push({ id, version: 'v1', module: 'ext', role: 'adapter', symbol: 'reference.inventory.ext.' + name,
      construction: 'class', implements: { context: 'inventory', kind: 'port', owner: [], id: name },
      sourceRootKey: 'inventory-implementations', file: name + '.scala', constructor: [], provides: ['run:' + runId + ':' + port] });
    const atom = { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'technical-port', id: name, version: 'v1',
      payload: { schemaVersion: 'truthsrc.saga-monarch-run-port/v1', name, version: 'v1', pipeline: { id: runId, version: 'v1' }, port } };
    writeFileSync(join(author, 'truth/saga-monarch/contexts/inventory/formal-products/technical-port/' + port.toLowerCase() + '-leaf.formal.yaml'), emitAuthorDoc(atom), { flag: 'wx' });
    writeFileSync(join(author, 'implementations/' + name + '.scala'), readFileSync(new URL('../reference/saga-monarch/run-fixtures/' + name + '.scala', import.meta.url)), { flag: 'wx' });
  }
  writeFileSync(compositionFile, JSON.stringify(composition, null, 2) + '\n');
  const projectFile = join(author, 'truthsrc.project.json'), project = JSON.parse(readFileSync(projectFile, 'utf8'));
  project.options.names.push({ ref: { context: 'inventory', kind: 'pipeline', owner: [], id: runId }, role: 'run', name: 'PureReviewRun' });
  writeFileSync(projectFile, JSON.stringify(project, null, 2) + '\n');
}
