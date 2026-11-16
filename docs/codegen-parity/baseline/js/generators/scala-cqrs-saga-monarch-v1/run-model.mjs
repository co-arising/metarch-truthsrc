import { createHash } from 'node:crypto';
import { array, at, detach, equal, fail, object, text, unique } from '../../lib/products/request.mjs';

// Semantic pins exclude display names, implementation FQNs and provenance.
const canonical = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
import { resolveNameSet } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';

const inherited = ['copy', 'productArity', 'productElement', 'productPrefix', 'canEqual', 'equals', 'hashCode', 'toString', 'getClass', 'wait', 'notify', 'notifyAll', 'require'];
const outcomeKinds = ['success', 'resolved', 'business-rejection', 'infrastructure-failure', 'unknown-effect'];
const reject = (message, source) => fail('SAGA_MONARCH_RUN_MODEL', message, source);
const distinct = (rows, key, source) => unique(rows.map(r => r[key]), 'SAGA_MONARCH_RUN_DUPLICATE', source);
function names(rows, key, scope, space, reserved = []) {
  return resolveNameSet({ profile: MODULAR_CANDIDATE,
    names: rows.map(r => ({ knowledgeId: r.source.document + '#' + r.source.pointer, scope, space,
      spelling: r[key], binding: null, prefix: [], suffix: [] })),
    reserved: [...new Set([...reserved, ...(space === 'scala-member' ? inherited : [])])]
      .map(name => ({ scope, space, name, reason: 'conflicts with generated Run API' })),
  });
}

/** Pure lowering only. No byte codec, interpreter, runtime construction or leaf loading. */
export function buildRunModel(raw, { execution, index, symbol, protocol, emittedTypes }) {
  const run = detach(raw), base = '/pipelines/' + index;
  const provenance = path => {
    const record = execution.sourceMap?.[base + path];
    if (!record) reject('complete execution sourceMap required: ' + base + path, symbol.source);
    text(record.document, symbol.source); text(record.pointer, symbol.source, true);
    return record;
  };
  const source = path => { const r = provenance(path); return at(r.document, r.pointer); };
  const mapped = (row, path) => ({ ...row, source: source(path), provenance: provenance(path) });
  object(run, ['id', 'name', 'readiness', 'inputs', 'outputs', 'steps', 'recovery', 'admission', 'binding'], source(''));
  if (execution.schemaVersion !== 'truthsrc.execution/v2' || run.readiness !== 'contract-only')
    reject('complete execution/v2 IR required', source(''));
  const b = run.binding, r = b.run;
  object(b, ['engine', 'module', 'codec', 'types', 'ports', 'run', ...(Object.hasOwn(b, 'invocations') ? ['invocations'] : [])], source('/binding'));
  if (Object.hasOwn(b, 'invocations') && array(b.invocations, source('/binding')).length)
    reject('only fixed port steps are supported; invokeSaga is not a pure leaf', source('/binding'));
  object(r, ['definitionId', 'definitionVersion', 'codecVersion', 'mode', 'identity', 'operations'], source('/binding/run'));
  for (const key of ['definitionId', 'definitionVersion', 'codecVersion']) text(r[key], source('/binding/run'));
  if (!['versioned', 'managed'].includes(r.mode) || r.identity !== 'caller-supplied-exact')
    reject('unsupported Run mode/identity', source('/binding/run'));
  const codec = (value, path) => {
    object(value, ['id', 'version', 'compatibleVersions'], source(path));
    text(value.id, source(path)); text(value.version, source(path));
    // This first exact-version codec model must not promise migration support.
    if (!equal(value.compatibleVersions, [value.version])) reject('only the exact current codec version is supported', source(path));
    return mapped(value, path);
  };
  const stateCodec = codec(b.codec, '/binding/codec');
  if (r.codecVersion !== b.codec.version || r.definitionVersion !== run.recovery.planVersion)
    reject('Run definition/recovery/codec pins differ', source('/binding/run'));
  object(run.recovery, ['inputResponsibility', 'inputs', 'planVersion', 'planCompatibility', 'checkpoint', 'unknownEffect', 'ownership'], source('/recovery'));
  if (run.recovery.inputResponsibility !== 'host' || run.recovery.planCompatibility !== 'exact' ||
      run.recovery.checkpoint !== 'confirmed-prefix' || run.recovery.unknownEffect !== 'reconcile-before-resume' || run.recovery.ownership !== 'single-writer')
    reject('unsupported recovery policy', source('/recovery'));
  object(run.admission, ['maxConcurrentRuns', 'maxInFlightSteps', 'maxItemsPerChunk', 'maxInFlightChunks'], source('/admission'));
  if (!Number.isSafeInteger(run.admission.maxConcurrentRuns) || run.admission.maxConcurrentRuns < 1 ||
      run.admission.maxInFlightSteps !== 1 || run.admission.maxItemsPerChunk !== 1 || run.admission.maxInFlightChunks !== 1)
    reject('finite standalone Run requires explicit singleton step/chunk admission', source('/admission'));
  const types = array(b.types, source('/binding/types')).map((binding, i) => {
    const path = '/binding/types/' + i;
    object(binding, ['id', 'implementation'], source(path));
    // The binding ID is deliberately not a nominal-name inference mechanism.
    const matches = emittedTypes.filter(t => t.fqn === binding.implementation);
    if (matches.length !== 1) reject('Run type implementation must match one already emitted declared nominal FQN: ' + binding.implementation, source(path));
    return { ...mapped(binding, path), model: matches[0] };
  });
  distinct(types, 'id', source('/binding/types'));
  const typed = (row, path) => {
    const binding = types.find(t => t.id === row.type);
    if (!binding) reject('unknown Run type: ' + row.type, source(path));
    return { ...mapped(row, path), typeModel: binding.model, typeSource: binding.source };
  };
  const fields = (rows, key, path, scope) => {
    const result = array(rows, source(path)).map((row, i) => typed(row, path + '/' + i));
    distinct(result, key, source(path));
    const resolved = names(result, key, scope, 'scala-member');
    return result.map((row, i) => ({ ...row, identifier: resolved[i].identifier }));
  };
  const inputs = fields(run.inputs, 'id', '/inputs', protocol.fqn + '.Input');
  if (!inputs.length) reject('Run requires durable original inputs', source('/inputs'));
  for (const input of inputs) if (!['start-record', 'durable-reference'].includes(input.durability)) reject('unsupported input durability', input.source);
  if (!equal([...run.recovery.inputs].sort(), inputs.map(i => 'input:' + i.id).sort())) reject('recovery must cover every original input exactly once', source('/recovery'));
  const ports = array(b.ports, source('/binding/ports')).map((port, i) => {
    const path = '/binding/ports/' + i;
    object(port, ['id', 'implementation', 'effect', 'confirmation', 'idempotency', 'inputs', 'outputs', 'outcomes'], source(path));
    if (!['pure', 'external'].includes(port.effect) || port.confirmation !== (port.effect === 'pure' ? 'checkpoint' : 'durable-ack'))
      reject('unsupported port effect/confirmation', source(path));
    object(port.idempotency, port.idempotency.mode === 'keyed' ? ['mode', 'key'] : ['mode'], source(path + '/idempotency'));
    if (!['none', 'keyed'].includes(port.idempotency.mode) || port.effect === 'external' && port.idempotency.mode !== 'keyed')
      reject('external port requires keyed idempotency', source(path + '/idempotency'));
    const args = fields(port.inputs, 'slot', path + '/inputs', protocol.fqn + '.' + port.id + '.Args');
    const values = fields(port.outputs, 'slot', path + '/outputs', protocol.fqn + '.' + port.id + '.Values');
    if (port.idempotency.mode === 'keyed' && !args.some(a => a.slot === port.idempotency.key)) reject('idempotency key must name a complete input slot', source(path));
    const outcomes = array(port.outcomes, source(path + '/outcomes')).map((o, j) => {
      object(o, ['code', 'kind'], source(path + '/outcomes/' + j));
      if (!outcomeKinds.includes(o.kind)) reject('unsupported outcome kind', source(path));
      return mapped(o, path + '/outcomes/' + j);
    });
    distinct(outcomes, 'code', source(path + '/outcomes'));
    for (const kind of ['success', 'infrastructure-failure', ...(port.effect === 'external' ? ['unknown-effect'] : [])])
      if (!outcomes.some(o => o.kind === kind)) reject('port must declare ' + kind, source(path));
    const cases = names(outcomes, 'code', protocol.fqn + '.' + port.id + '.Outcome', 'scala-type',
      ['Outcome', 'TerminalOutcome', 'Continuing', 'BusinessRejection', 'NonSuccessObservation', 'Args', 'Values', 'Request', 'Evidence', 'Observation', 'Leaf', 'String', 'Option', 'Vector', 'Future', 'Byte', 'Unit', 'Either']);
    return { ...mapped(port, path), inputs: args, outputs: values,
      outcomes: outcomes.map((o, j) => ({ ...o, identifier: cases[j].identifier, carriesValues: ['success', 'resolved'].includes(o.kind) })) };
  });
  distinct(ports, 'id', source('/binding/ports'));
  const portNames = names(ports, 'id', protocol.fqn, 'scala-type', ['Input', 'Output', 'State', 'Status', 'Steps', 'Leaves', 'Host', 'Completion', 'Completed', 'Stopped', 'Adapter', 'Codec', 'String', 'Option', 'Vector', 'Future', 'Byte', 'Unit', 'Either', ...emittedTypes.map(t => t.name)]);
  ports.forEach((p, i) => { p.identifier = portNames[i].identifier; });
  const available = new Map(inputs.map(input => ['input:' + input.id, { kind: 'input', id: input.id, identifier: input.identifier, type: input.type, typeModel: input.typeModel, source: input.source }]));
  const resolve = row => {
    const target = available.get(row.ref);
    if (!target) reject('read/output must reference input or earlier write: ' + row.ref, row.source);
    if (target.type !== row.type) reject('read/output nominal binding type differs: ' + row.ref, row.source);
    return { ...row, from: target };
  };
  const rawSteps = array(run.steps, source('/steps'));
  if (!rawSteps.length) reject('Run requires a nonempty fixed step list', source('/steps'));
  distinct(rawSteps, 'id', source('/steps'));
  const usedPorts = new Set(), allWrites = [];
  const coverage = (rows, expected, key, label, where) => {
    distinct(rows, key, where);
    if (rows.length !== expected.length || expected.some(e => !rows.some(row => row[key] === e[key] && row.type === e.type)))
      reject('complete ' + label + ' coverage required', where);
  };
  const steps = rawSteps.map((step, i) => {
    const path = '/steps/' + i;
    object(step, ['id', 'name', 'ordinal', 'port', 'reads', 'writes', 'outcomes'], source(path));
    if (step.ordinal !== i) reject('step ordinal must preserve the fixed declared order', source(path));
    const port = ports.find(p => p.id === step.port);
    if (!port) reject('step port is undeclared', source(path));
    usedPorts.add(port.id);
    if (port.effect !== (r.mode === 'versioned' ? 'pure' : 'external')) reject('Run mode must agree with every port effect', source(path));
    const reads = fields(step.reads, 'slot', path + '/reads', protocol.fqn + '.' + step.id + '.Reads').map(resolve);
    const writes = fields(step.writes, 'id', path + '/writes', protocol.fqn + '.' + step.id + '.Writes');
    coverage(reads, port.inputs, 'slot', 'read/input', source(path));
    coverage(writes, port.outputs, 'slot', 'write/output', source(path));
    const outcomes = array(step.outcomes, source(path + '/outcomes')).map((o, j) => {
      const declared = port.outcomes.find(p => p.code === o.code);
      if (!declared || declared.kind !== o.kind) reject('step outcome must match its declared code and kind', source(path));
      const actions = declared.carriesValues ? ['continue'] : o.kind === 'business-rejection' ? ['stop', 'manual-recovery'] : ['manual-recovery'];
      if (!actions.includes(o.action)) reject('outcome action cannot commit a non-success observation as success', source(path));
      return { ...mapped(o, path + '/outcomes/' + j), identifier: declared.identifier,
        stateEffect: declared.carriesValues ? 'write' : o.action === 'stop' ? 'stop' : 'block' };
    });
    distinct(outcomes, 'code', source(path + '/outcomes'));
    if (outcomes.length !== port.outcomes.length) reject('complete outcome coverage required', source(path));
    const keyRead = port.idempotency.mode === 'keyed' ? reads.find(read => read.slot === port.idempotency.key) : null;
    if (port.effect === 'external' && keyRead?.from.kind !== 'input') reject('external idempotency slot must read an original durable input', source(path));
    for (const write of writes) {
      if (!['checkpoint', 'durable-reference'].includes(write.durability)) reject('unsupported write durability', write.source);
      const stateName = names([{ ...write, stateName: 'write-' + step.id + '-' + write.id }], 'stateName', protocol.fqn + '.State', 'scala-member')[0];
      write.stateIdentifier = stateName.identifier;
      write.portIdentifier = port.outputs.find(o => o.slot === write.slot).identifier;
      const target = { kind: 'write', stepId: step.id, id: write.id, identifier: write.stateIdentifier, type: write.type, typeModel: write.typeModel, source: write.source };
      available.set('step:' + step.id + ':' + write.id, target);
      allWrites.push({ ...write, stepId: step.id });
    }
    return { ...mapped(step, path), portModel: port, reads, writes, outcomes,
      idempotency: keyRead ? { slot: keyRead.slot, type: keyRead.type, typeModel: keyRead.typeModel, from: keyRead.from, source: keyRead.source } : null };
  });
  if (usedPorts.size !== ports.length) reject('unused port bindings are not supported', source('/binding/ports'));
  names(allWrites, 'stateIdentifier', protocol.fqn + '.State', 'scala-member', ['runId', 'input', 'status', 'code', 'stoppedStep', 'reason']);
  const stepNames = names(steps, 'id', protocol.fqn + '.Steps', 'scala-member');
  steps.forEach((s, i) => { s.identifier = stepNames[i].identifier; });
  const outputs = fields(run.outputs, 'id', '/outputs', protocol.fqn + '.Output').map(resolve);
  const operations = array(r.operations, source('/binding/run/operations')).map((operation, i) => {
    const path = '/binding/run/operations/' + i;
    object(operation, ['stepId', 'connectorId', 'connectorVersion', 'ledgerEpoch', 'requestCodec', 'identity', 'query'], source(path));
    for (const key of ['stepId', 'connectorId', 'connectorVersion', 'ledgerEpoch']) text(operation[key], source(path));
    if (operation.identity !== 'original-run-step' || operation.query !== 'read-only-original-request') reject('original managed request identity/query required', source(path));
    return { ...mapped(operation, path), requestCodec: codec(operation.requestCodec, path + '/requestCodec') };
  });
  if (r.mode === 'versioned' ? operations.length !== 0 : steps.length !== 1 || operations.length !== 1 || operations[0].stepId !== steps[0].id)
    reject('pure Run has no operations; managed Run requires exactly one external step and operation', source('/binding/run'));
  const semanticDigest = 'sha256:' + createHash('sha256').update(canonical({
    id: run.id, inputs: run.inputs, outputs: run.outputs,
    steps: run.steps.map(({ name, ...step }) => step), recovery: run.recovery, admission: run.admission,
    binding: { ...b, types: types.map(({ id, model }) => ({ id, ref: model.ref,
      storage: model.storage ?? 'record', minimum: model.minimum ?? null, maximum: model.maximum ?? null,
      minLength: model.minLength ?? null, maxLength: model.maxLength ?? null,
      fields: model.fields?.map(f => ({ role: f.role, ref: f.type?.ref ?? null })) ?? [] })),
      ports: b.ports.map(({ implementation, ...port }) => port) },
  })).digest('hex');
  return detach({ ...run, semanticDigest, source: symbol.source, symbol, protocol, types, ports, inputs, outputs, steps, writes: allWrites,
    mode: r.mode, stateCodec, operations, recovery: mapped(run.recovery, '/recovery'), admission: mapped(run.admission, '/admission'),
    sources: [...new Map(Object.entries(execution.sourceMap).filter(([path]) => path === base || path.startsWith(base + '/'))
      .map(([, record]) => { const s = at(record.document, record.pointer); return [JSON.stringify(s), s]; })).values()] });
}
