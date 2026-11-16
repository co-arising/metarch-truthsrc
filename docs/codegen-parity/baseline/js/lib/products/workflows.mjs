import { array, at, equal, fail, object, text, unique } from './request.mjs';
import { reference, refKey } from '../domain-products/references.mjs';
import { canonicalType, declaration } from '../domain-products/values.mjs';

const location = (doc, pointer) => at(doc.id, pointer);
const bounded = (value, min, max, source) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('WORKFLOW_BOUND', `expected an integer in ${min}..${max}`, source);
  return value;
};
const scalar = (value, source) => {
  text(value, source);
  if (!value.isWellFormed() || /[\p{Cc}\p{Cf}]/u.test(value) || Buffer.byteLength(value) > 256)
    fail('WORKFLOW_ID', 'bounded well-formed identity without controls required', source);
  return value;
};
const identity = (value, source) => { object(value, ['id', 'version'], source); scalar(value.id, source); scalar(value.version, source); };
const settingsKeys = ['maxAcceptedItems', 'maxActiveItems', 'maxActiveBytes', 'maxItemBytes', 'maxResultBytes',
  'maxConcurrentBatches', 'maxTransitions', 'maxBatchCalls', 'maxReconciliations', 'pollIntervalMillis', 'callTimeoutMillis'];
const bounds = {
  maxAcceptedItems: [1, 1000], maxActiveItems: [1, 100], maxActiveBytes: [1, 1048576], maxItemBytes: [1, 4096],
  maxResultBytes: [1, 4096], maxConcurrentBatches: [1, 32], maxTransitions: [1, 32], maxBatchCalls: [1, 100000],
  maxReconciliations: [0, 100], pollIntervalMillis: [1, 86400000], callTimeoutMillis: [1, 86400000],
};

export function deriveWorkflows(canonical) {
  const rows = array(canonical.value.workflows, location(canonical, '/workflows'));
  return rows.map((row, i) => {
    if (Object.hasOwn(row, 'source')) fail('WORKFLOW_SOURCE', 'workflow source is derived, never authored', location(canonical, '/workflows/' + i));
    return { ...row, source: location(canonical, '/workflows/' + i) };
  });
}

/** Finite R2 policy compilation. Every business row comes from the same author tree. */
export function compileWorkflows(binding, canonical, layout, sagas, execution) {
  object(binding.value, ['schemaVersion', 'workflows'], at(binding.id));
  const expected = deriveWorkflows(canonical);
  if (!equal(binding.value.workflows, expected)) fail('WORKFLOW_SOURCE', 'workflow binding must equal every complete canonical workflow', at(binding.id, '/workflows'));
  if (!expected.length || expected.length > 32) fail('WORKFLOW_BOUND', 'one to 32 explicit finite workflows required', at(binding.id, '/workflows'));
  unique(expected.map(w => w.id), 'WORKFLOW_DUPLICATE', at(binding.id, '/workflows'));
  const workflows = expected.map(row => {
    const source = row.source;
    object(row, ['schemaVersion', 'id', 'version', 'context', 'input', 'capacities', 'areas', 'settings', 'source'], source);
    if (row.schemaVersion !== 'truthsrc.workflow/v1') fail('WORKFLOW_VERSION', 'unsupported workflow author version', source);
    for (const key of ['id', 'version', 'context']) scalar(row[key], source);
    if (!layout.contexts.includes(row.context)) fail('WORKFLOW_CONTEXT', 'workflow context is not in the selected reference layout', source);
    const input = row.input;
    object(input, ['type', 'identity', 'eof', 'conflict'], source);
    reference(input.type, source);
    if (input.type.kind !== 'type' || input.type.context !== row.context || declaration(input.type, layout, source).valueType?.form !== 'record')
      fail('WORKFLOW_INPUT', 'workflow input must reference a declared nominal record in this context', source);
    if (input.identity !== 'caller-job-sequence-item' || input.eof !== 'explicit-close' || input.conflict !== 'reject-different-payload')
      fail('WORKFLOW_IDENTITY', 'original caller item identity, exact conflicts and explicit EOF required', source);
    object(row.settings, settingsKeys, source);
    for (const key of settingsKeys) bounded(row.settings[key], ...bounds[key], source);
    if (row.settings.maxActiveItems > row.settings.maxAcceptedItems) fail('WORKFLOW_BOUND', 'active item capacity exceeds finite accepted item budget', source);
    const capacities = array(row.capacities, source);
    if (!capacities.length || capacities.length > 32) fail('WORKFLOW_RESOURCE', 'one to 32 explicit resource capacities required', source);
    unique(capacities.map(c => c.id), 'WORKFLOW_RESOURCE', source);
    for (const capacity of capacities) { object(capacity, ['id', 'units'], source); scalar(capacity.id, source); bounded(capacity.units, 1, 2147483647, source); }
    const capacityById = new Map(capacities.map(c => [c.id, c.units]));
    const areas = array(row.areas, source);
    if (!areas.length || areas.length > 32) fail('WORKFLOW_BOUND', 'one to 32 areas required', source);
    unique(areas.map(a => a.id), 'WORKFLOW_AREA', source);
    const areaById = new Map(areas.map(a => [a.id, a]));
    for (const [i, area] of areas.entries()) {
      const s = at(source.document, source.pointer + '/areas/' + i);
      object(area, ['id', 'version', 'batch', 'resources', 'parallelism', 'maxExecutions', 'action', 'completion', 'verification'], s);
      scalar(area.id, s); scalar(area.version, s);
      bounded(area.parallelism, 1, row.settings.maxConcurrentBatches, s);
      bounded(area.maxExecutions, 1, 32, s);
      const batch = area.batch;
      object(batch, ['kind', 'maxItems', 'minItems', 'maxWaitMillis', 'allowPartialOnClose'], s);
      if (!['single', 'count-or-wait', 'by-compatibility-key'].includes(batch.kind) || typeof batch.allowPartialOnClose !== 'boolean')
        fail('WORKFLOW_BATCH', 'explicit supported batch policy required', s);
      bounded(batch.maxItems, 1, row.settings.maxActiveItems, s); bounded(batch.minItems, 1, batch.maxItems, s);
      bounded(batch.maxWaitMillis, 0, 86400000, s);
      if (batch.maxItems * row.settings.maxItemBytes > row.settings.maxActiveBytes) fail('WORKFLOW_BOUND', 'active byte capacity cannot accommodate this legal batch', s);
      if (batch.kind === 'single' && !equal(batch, { kind: 'single', maxItems: 1, minItems: 1, maxWaitMillis: 0, allowPartialOnClose: true }))
        fail('WORKFLOW_BATCH', 'single has exact one-item/zero-wait semantics', s);
      if (batch.kind === 'by-compatibility-key' && batch.allowPartialOnClose) fail('WORKFLOW_BATCH', 'hard compatibility minimum cannot be bypassed by EOF', s);
      const resources = array(area.resources, s); unique(resources.map(r => r.id), 'WORKFLOW_RESOURCE', s);
      if (!resources.length) fail('WORKFLOW_RESOURCE', 'positive per-batch resource bundle required', s);
      for (const resource of resources) {
        object(resource, ['id', 'units'], s); scalar(resource.id, s); bounded(resource.units, 1, 2147483647, s);
        if (!capacityById.has(resource.id) || resource.units > capacityById.get(resource.id)) fail('WORKFLOW_RESOURCE', 'resource bundle exceeds declared capacity', s);
      }
      const action = area.action;
      object(action, ['kind', 'ref', ...(action.kind === 'run' ? ['inputs', 'result'] : []),
        ...(Object.hasOwn(action, 'retry') ? ['retry'] : [])], s); identity(action.ref, s);
      if (['invoke-saga', 'publish-result', 'query-saga'].includes(action.kind)) {
        const saga = sagas.sagas.find(x => x.definition.id === action.ref.id && x.definition.version === action.ref.version);
        if (!saga) fail('WORKFLOW_SAGA', 'area must reference a selected exact Saga version', s);
        if (saga.resultPort?.payload?.name === input.type.id) fail('WORKFLOW_INPUT', 'input cannot be replaced by a result payload', s);
      } else if (action.kind === 'run') {
        const run = execution.pipelines.find(p => p.id === action.ref.id && p.binding.run?.definitionVersion === action.ref.version);
        if (!run) fail('WORKFLOW_RUN', 'area must reference a selected exact versioned run', s);
        if (run.steps.length !== 1 || run.binding.run.mode !== 'managed' || !run.steps[0].port)
          fail('WORKFLOW_RUN', 'business Run bridge requires one managed port step; the outer WorkflowHost execute/codec are separate', s);
        if (sagas.sagas.length !== 1) fail('WORKFLOW_RUN', 'one explicit Saga result identity closure required for item Run mapping', s);
        const saga = sagas.sagas[0], tx = saga.binding.types.find(type => type.id === saga.definition.payload.transactionIdType);
        const mappings = array(action.inputs, s);
        unique(mappings.map(mapping => mapping.slot), 'WORKFLOW_RUN_INPUT', s);
        if (mappings.length !== run.inputs.length) fail('WORKFLOW_RUN_INPUT', 'map every business Run input exactly once', s);
        for (const mapping of mappings) {
          object(mapping, ['slot', 'source'], s); scalar(mapping.slot, s);
          const slot = run.inputs.find(slot => slot.id === mapping.slot);
          if (!slot || !['request', 'transaction-id'].includes(mapping.source)) fail('WORKFLOW_RUN_INPUT', 'unknown Run input or item source selector', s);
          const expectedType = mapping.source === 'request' ? { form: 'nominal', ref: input.type }
            : canonicalType(tx.canonicalType, row.context, layout, s);
          if (!equal(canonicalType(slot.type, row.context, layout, s), expectedType))
            fail('WORKFLOW_RUN_INPUT', 'Run input type must equal its original item request or transaction identity type', s);
        }
        object(action.result, ['slot', 'onStopped', 'outcomes'], s); scalar(action.result.slot, s);
        if (action.result.onStopped !== 'original-item') fail('WORKFLOW_RUN_RESULT', 'stopped Run result must explicitly use the original item identity and payload', s);
        const output = run.outputs.find(slot => slot.id === action.result.slot);
        const resultType = canonicalType(saga.resultPort.payload.name, row.context, layout, s);
        if (run.outputs.length !== 1 || !output || !equal(canonicalType(output.type, row.context, layout, s), resultType))
          fail('WORKFLOW_RUN_RESULT', 'consume the exact single nominal item result output; no output may be discarded', s);
        const outcomes = array(action.result.outcomes, s), declared = run.steps[0].outcomes;
        unique(outcomes.map(outcome => outcome.code), 'WORKFLOW_RUN_RESULT', s);
        if (outcomes.length !== declared.length) fail('WORKFLOW_RUN_RESULT', 'map every declared Run outcome exactly once', s);
        const allowed = { success: ['succeeded'], resolved: ['succeeded'], 'business-rejection': ['rejected-before-effects', 'compensated'],
          'infrastructure-failure': ['recovery-required'], 'unknown-effect': ['outcome-unknown'] };
        for (const outcome of outcomes) {
          object(outcome, ['code', 'result'], s);
          const declaredOutcome = declared.find(row => row.code === outcome.code);
          if (!declaredOutcome || !allowed[declaredOutcome.kind]?.includes(outcome.result))
            fail('WORKFLOW_RUN_RESULT', 'Run outcome mapping must preserve success, rejection and nonterminal uncertainty', s);
        }
      } else fail('WORKFLOW_ACTION', 'unsupported finite area action', s);
      if (typeof area.verification !== 'boolean' || area.verification && action.kind !== 'query-saga')
        fail('WORKFLOW_VERIFY', 'verification routes must be explicitly query-only Saga observation', s);
      const completion = area.completion;
      object(completion, ['terminal', 'unknown', 'resource', 'retainCarried'], s);
      if (completion.unknown !== 'hold' || typeof completion.retainCarried !== 'boolean') fail('WORKFLOW_COMPLETION', 'unknown must stay held, with explicit carried ownership', s);
      if (!['release', 'carry'].includes(completion.resource)) fail('WORKFLOW_RESOURCE', 'resource completion requires release or carry with evidence', s);
      const terminal = completion.terminal, terminalKinds = ['succeeded', 'rejected-before-effects', 'compensated'];
      let cases;
      if (terminal?.kind === 'by-result') {
        object(terminal, ['kind', 'cases'], s);
        cases = array(terminal.cases, s);
        for (const entry of cases) object(entry, ['result', 'disposition'], s);
        unique(cases.map(entry => entry.result), 'WORKFLOW_COMPLETION', s);
        if (cases.length !== terminalKinds.length || cases.some(entry => !terminalKinds.includes(entry.result)))
          fail('WORKFLOW_COMPLETION', 'by-result must declare each of the three terminal results exactly once', s);
      } else cases = [{ result: null, disposition: terminal }];
      let retry = false;
      for (const entry of cases) {
        const result = entry.disposition;
        object(result, ['kind', 'target', 'compatibilityKey', 'delayMillis'], s);
        bounded(result.delayMillis, 0, 86400000, s);
        if (!['complete', 'route', 'retry', 'hold'].includes(result.kind)) fail('WORKFLOW_COMPLETION', 'unsupported item disposition', s);
        if (result.kind === 'route') {
          scalar(result.target, s); scalar(result.compatibilityKey, s);
          if (!areaById.has(result.target)) fail('WORKFLOW_ROUTE', 'route must name a declared area', s);
          if (row.settings.maxTransitions < 2) fail('WORKFLOW_BOUND', 'route requires a remaining transition budget', s);
        } else if (result.target !== null || result.compatibilityKey !== null) fail('WORKFLOW_ROUTE', 'non-route dispositions cannot hide a target/key', s);
        if (result.kind !== 'retry' && result.kind !== 'route' && result.delayMillis !== 0) fail('WORKFLOW_COMPLETION', 'delay belongs only to route/retry', s);
        if (result.kind === 'retry') {
          retry = true;
          if (area.maxExecutions < 2) fail('WORKFLOW_BOUND', 'retry requires a finite execution budget greater than one', s);
          if (action.kind !== 'run' || entry.result !== 'rejected-before-effects')
            fail('WORKFLOW_RETRY', 'only an explicitly repeatable managed Run rejected before effects may retry; successful or terminal Saga identities cannot restart', s);
        }
        if (action.kind === 'publish-result' && result.kind !== 'complete') fail('WORKFLOW_COMPLETION', 'result delivery settles only after durable acknowledgement', s);
      }
      if (retry) {
        object(action.retry, ['semantics', 'identity', 'onExhausted'], s);
        if (action.retry.semantics !== 'reexecute-after-rejected-before-effects' || action.retry.identity !== 'original-item-new-batch-operation')
          fail('WORKFLOW_RETRY', 'retry must explicitly preserve the original item and use the new durable batch operation after a confirmed no-effects rejection', s);
        object(action.retry.onExhausted, ['kind', 'reason'], s);
        if (!['fail', 'hold'].includes(action.retry.onExhausted.kind)) fail('WORKFLOW_RETRY', 'retry budget exhaustion must explicitly fail or hold', s);
        scalar(action.retry.onExhausted.reason, s);
      } else if (Object.hasOwn(action, 'retry')) fail('WORKFLOW_RETRY', 'unused retry contract is not admitted', s);
      if (completion.resource === 'carry' || completion.retainCarried) {
        const result = cases[0].disposition, target = areaById.get(result.target);
        if (result.kind !== 'route' || cases.some(entry => !equal(entry.disposition, result)) || target.batch.maxItems < batch.maxItems)
          fail('WORKFLOW_CARRY', 'all holders must route together with the same target/key/delay to a target able to carry the whole batch', s);
        const minimum = batch.allowPartialOnClose ? 1 : batch.minItems;
        if (target.batch.minItems > minimum && !target.batch.allowPartialOnClose)
          fail('WORKFLOW_CARRY', 'a legal partial source batch cannot satisfy the target hard minimum while retaining its whole resource claim', s);
        if (completion.retainCarried && completion.resource !== 'release') fail('WORKFLOW_CARRY', 'incoming occupancy can be retained only without creating another carried claim', s);
      }
    }
    return { ...row, sources: [source], inputKey: refKey(input.type) };
  });
  return { schemaVersion: 'truthsrc.workflow-contract/v1', workflows };
}
