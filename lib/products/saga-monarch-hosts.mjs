import { array, at, equal, fail, object, resolve, text, unique } from './request.mjs';
import { reference, refKey } from '../domain-products/references.mjs';
import { canonicalType, declaration } from '../domain-products/values.mjs';
import { STRICT_SAGA_TARGET, MONARCH_R2_ARTIFACTS } from '../saga/runtime-targets.mjs';
import { portableSeamsPath } from './module-seams-composition.mjs';

const phases = ['prepare', 'commit', 'compensate'];
const resultKinds = ['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown'];
const codecRoles = ['request', 'identity', 'phaseIdentity', 'item', 'association', 'prepare', 'commit', 'compensate', 'result', 'manifestResult'];
const string = value => typeof value === 'string' && value.length > 0 && value.isWellFormed() && !/[\p{Cc}\p{Cf}]/u.test(value) && Buffer.byteLength(value) <= 256;
function scalar(value, source) { if (!string(value)) fail('SAGA_MONARCH_TEXT', 'bounded well-formed identity without controls required', source); }
function count(value, min, max, source) { if (!Number.isSafeInteger(value) || value < min || value > max) fail('SAGA_MONARCH_BOUND', `expected integer ${min}..${max}`, source); }
const pin = (value, source) => { object(value, ['id', 'version'], source); scalar(value.id, source); scalar(value.version, source); };

/** Finite host assembly. Business declarations and technical deployment are separate inputs. */
export function compileSagaMonarchHosts(binding, technical, canonical, products) {
  const source = at(technical.id);
  object(binding.value, ['schemaVersion', 'hosts'], at(binding.id));
  const rows = array(canonical.value.sagaHosts, at(canonical.id, '/sagaHosts'));
  const hosts = rows.map((row, i) => ({ ...row, source: at(canonical.id, '/sagaHosts/' + i) }));
  if (!equal(binding.value.hosts, { hosts })) fail('SAGA_MONARCH_SOURCE', 'host binding must equal the complete canonical host rows and derived sources', at(binding.id));
  if (hosts.length !== 1) fail('SAGA_MONARCH_SCOPE', 'this candidate requires exactly one explicit host composition', source);
  const host = hosts[0], hs = host.source;
  object(host, ['schemaVersion', 'id', 'version', 'context', 'saga', 'workflow', 'requestType', 'slots', 'ports', 'source'], hs);
  if (host.schemaVersion !== 'truthsrc.saga-monarch-host/v1') fail('SAGA_MONARCH_VERSION', 'unsupported host author contract', hs);
  for (const key of ['id', 'version', 'context']) scalar(host[key], hs);
  pin(host.saga, hs); pin(host.workflow, hs); reference(host.requestType, hs);
  const layout = products['reference-layout'];
  const compiled = products['saga-contract'].sagas;
  const runtime = products['saga-runtime-contract'].sagas;
  if (compiled.length !== 1 || runtime.length !== 1) fail('SAGA_MONARCH_SCOPE', 'one exact Saga closure required', hs);
  const saga = compiled[0], lowered = runtime[0];
  if (saga.definition.id !== host.saga.id || saga.definition.version !== host.saga.version ||
      lowered.sagaId !== host.saga.id || lowered.definitionVersion !== host.saga.version ||
      !equal(lowered.contract.definition, saga.definition) || !equal(lowered.contract.binding, saga.binding))
    fail('SAGA_MONARCH_SAGA', 'host must pin the complete selected Saga/runtime closure', hs);
  const workflow = products['workflow-contract'].workflows.find(w => w.id === host.workflow.id && w.version === host.workflow.version);
  if (!workflow || workflow.context !== host.context || !equal(workflow.input.type, host.requestType))
    fail('SAGA_MONARCH_WORKFLOW', 'host workflow must consume this exact request/context', hs);
  const request = declaration(host.requestType, layout, hs);
  if (host.requestType.kind !== 'type' || host.requestType.context !== host.context || request.valueType?.form !== 'record')
    fail('SAGA_MONARCH_REQUEST', 'host request must be a declared nominal record', hs);
  const fields = request.valueType.members.map(r => declaration(r, layout, hs));
  object(host.slots, ['requestId', 'resourceA', 'resourceB', 'subject', 'quantity'], hs);
  for (const value of Object.values(host.slots)) scalar(value, hs);
  unique(Object.values(host.slots), 'SAGA_MONARCH_REQUEST', hs);
  if (!equal(fields.map(f => f.ref.id), Object.values(host.slots)))
    fail('SAGA_MONARCH_REQUEST', 'finite reservation request requires its five explicit ordered role fields', hs);
  const types = new Map(saga.binding.types.map(t => [t.id, t]));
  const args = saga.definition.payload.args;
  if (args.length !== fields.length || args.some((arg, i) => arg.slot !== fields[i].ref.id ||
      !equal(canonicalType(types.get(arg.type)?.canonicalType, host.context, layout, hs), fields[i].valueType)))
    fail('SAGA_MONARCH_REQUEST', 'request fields must equal all ordered typed Saga args', hs);
  const bySlot = new Map(args.map(arg => [arg.slot, types.get(arg.type)]));
  if (['requestId', 'resourceA', 'resourceB', 'subject'].some(role => bySlot.get(host.slots[role])?.kind !== 'id'))
    fail('SAGA_MONARCH_REQUEST', 'request/resource/subject roles require explicit bounded identity types', hs);
  const quantity = bySlot.get(host.slots.quantity);
  if (quantity?.kind !== 'integer' || quantity.minimum < 1 || quantity.maximum > 2147483647)
    fail('SAGA_MONARCH_REQUEST', 'quantity must be an exact positive Int domain', hs);
  if (bySlot.get(host.slots.resourceA).id !== bySlot.get(host.slots.resourceB).id)
    fail('SAGA_MONARCH_REQUEST', 'both resources must share the same explicit nominal type', hs);
  if (lowered.participants.length !== 2 || lowered.participants.some((p, i) => p.resource.ref !== 'args:' + host.slots[i ? 'resourceB' : 'resourceA']))
    fail('SAGA_MONARCH_PARTICIPANTS', 'finite two-resource composition must retain the two ordered resource arg identities', hs);
  for (const participant of lowered.participants) {
    for (const phase of phases) if (!participant.phases[phase]) fail('SAGA_MONARCH_PHASES', 'all three TCC phases required', hs);
  }
  const roles = ['participant', 'association', 'result', 'evidence', 'executionEvidence', 'recoveryAuthorization'];
  object(host.ports, roles, hs);
  const ports = roles.map(role => {
    const p = host.ports[role]; object(p, ['ref', 'version'], hs); reference(p.ref, hs); scalar(p.version, hs);
    const d = declaration(p.ref, layout, hs);
    if (p.ref.kind !== 'port' || p.ref.context !== host.context) fail('SAGA_MONARCH_PORT', 'port must be in the host context', hs);
    const body = resolve(canonical.value, d.source.pointer, d.source);
    if (body.name !== p.ref.id || body.version !== p.version) fail('SAGA_MONARCH_PORT', 'port version must equal its canonical declaration', hs);
    if (role === 'result') {
      if (!equal(body, saga.resultPort.declaration)) fail('SAGA_MONARCH_PORT', 'result port must equal the Saga completion target', hs);
    } else {
      object(body, ['schemaVersion', 'name', 'version', 'role'], d.source);
      if (body.schemaVersion !== 'truthsrc.saga-monarch-port/v1' || body.role !== role)
        fail('SAGA_MONARCH_PORT', 'explicit finite typed protocol role required', d.source);
    }
    return { role, ref: p.ref, version: p.version, source: d.source };
  });
  unique(ports.map(p => refKey(p.ref)), 'SAGA_MONARCH_PORT', hs);
  object(technical.value, ['schemaVersion', 'id', 'version', 'host', 'runtime', 'identity', 'wire', 'workflow', 'settings', 'implementations', 'root'], source);
  const t = technical.value;
  if (t.schemaVersion !== 'truthsrc.saga-monarch-binding/v1') fail('SAGA_MONARCH_VERSION', 'unsupported composition binding', source);
  scalar(t.id, source); scalar(t.version, source); pin(t.host, source);
  if (!equal(t.host, { id: host.id, version: host.version })) fail('SAGA_MONARCH_HOST', 'technical host pin differs', source);
  object(t.runtime, ['saga', 'monarch'], source);
  if (!equal(t.runtime.saga, STRICT_SAGA_TARGET) || !equal(t.runtime.monarch, MONARCH_R2_ARTIFACTS))
    fail('SAGA_MONARCH_ARTIFACT', 'fixed Saga/R2 artifact coordinates and hashes required', source);
  object(t.identity, ['transactionPrefix', 'resultPrefix', 'strategy'], source);
  scalar(t.identity.transactionPrefix, source); scalar(t.identity.resultPrefix, source);
  if (t.identity.strategy !== 'sha256-item-frame-v1') fail('SAGA_MONARCH_IDENTITY', 'explicit original-item frame identity strategy required', source);
  const transactionType = types.get(saga.definition.payload.transactionIdType);
  const transactionLength = [...t.identity.transactionPrefix].length + 64;
  if (transactionType?.kind !== 'id' || transactionLength < transactionType.minLength || transactionLength > transactionType.maxLength)
    fail('SAGA_MONARCH_IDENTITY', 'transaction prefix plus SHA-256 identity must fit the declared transaction type domain', at(technical.id, '/identity'));
  object(t.wire, ['format', 'maxBytes', 'codecs', 'phaseTags', 'resultTags'], source);
  if (t.wire.format !== 'length-prefixed-v1') fail('SAGA_MONARCH_WIRE', 'unsupported bounded wire format', source);
  count(t.wire.maxBytes, 1, 1048576, source);
  if (!equal(t.wire.phaseTags, phases.map((phase, i) => ({ phase, tag: i + 1 }))) ||
      !equal(t.wire.resultTags, resultKinds.map((kind, i) => ({ kind, tag: i + 1 }))))
    fail('SAGA_MONARCH_WIRE', 'all explicit v1 phase/result tags required', source);
  const codecs = array(t.wire.codecs, source);
  if (!equal(codecs.map(c => c.role), codecRoles)) fail('SAGA_MONARCH_CODEC', 'complete ordered codec role closure required', source);
  for (const codec of codecs) { object(codec, ['role', 'id', 'version'], source); scalar(codec.id, source); count(codec.version, 1, 2147483647, source); }
  unique(codecs.map(c => c.id), 'SAGA_MONARCH_CODEC', source);
  const argsCodec = codecs.find(c => c.role === 'request');
  if (!equal({ id: argsCodec.id, version: argsCodec.version }, lowered.args.runtimeCodec)) fail('SAGA_MONARCH_CODEC', 'request codec must equal actual Strict args codec', source);
  for (const participant of lowered.participants) for (const phase of phases) {
    const codec = codecs.find(c => c.role === phase);
    if (!equal({ id: codec.id, version: codec.version }, participant.phases[phase].runtimeCodec))
      fail('SAGA_MONARCH_CODEC', 'shared phase codec must equal each actual phase pin', source);
  }
  const workflowSource = at(technical.id, '/workflow'), wt = t.workflow;
  object(wt, ['stepId', 'codecVersion', 'connectorPrefix', 'connectorVersion', 'ledgerEpoch', 'proofFormat',
    ...(wt && Object.hasOwn(wt, 'carry') ? ['carry'] : [])], workflowSource);
  if (wt.stepId !== 'execute' || wt.codecVersion !== 'batch-codec-1')
    fail('SAGA_MONARCH_WORKFLOW_ABI', 'fixed R2 WorkflowHost requires execute and batch-codec-1', workflowSource);
  for (const key of ['connectorPrefix', 'connectorVersion', 'ledgerEpoch']) scalar(wt[key], workflowSource);
  if (!['digest-proof-v1', 'owner-certificates-v1'].includes(wt.proofFormat))
    fail('SAGA_MONARCH_PROOF', 'explicit supported execution proof format required', workflowSource);
  const carries = workflow.areas.some(area => area.completion.resource === 'carry');
  if ((carries || workflow.areas.some(area => area.completion.retainCarried)) && wt.proofFormat !== 'owner-certificates-v1')
    fail('SAGA_MONARCH_PROOF', 'carried resource claims require proof for every original owner', workflowSource);
  if (carries) {
    object(wt.carry, ['reservationSuffix', 'ownerSuffix'], workflowSource);
    scalar(wt.carry.reservationSuffix, workflowSource); scalar(wt.carry.ownerSuffix, workflowSource);
    if (wt.carry.reservationSuffix === wt.carry.ownerSuffix)
      fail('SAGA_MONARCH_IDENTITY', 'carried reservation and owner suffixes must be distinct', workflowSource);
  } else if (Object.hasOwn(wt, 'carry')) fail('SAGA_MONARCH_IDENTITY', 'unused carry identity binding is not admitted', workflowSource);
  for (const area of workflow.areas) if (area.action.kind !== 'run') scalar(wt.connectorPrefix + area.id, workflowSource);
  object(t.settings, ['maxTransactions', 'maxJobs', 'maxChildren', 'systemOwnership'], source);
  for (const key of ['maxTransactions', 'maxJobs', 'maxChildren']) count(t.settings[key], 1, 10000, source);
  if (!['caller', 'application'].includes(t.settings.systemOwnership)) fail('SAGA_MONARCH_OWNERSHIP', 'explicit ActorSystem ownership required', source);
  const runs = products['execution-contract'].pipelines;
  object(t.root, ['id', 'bindings', ...(runs.length ? ['runs'] : [])], source); scalar(t.root.id, source);
  const runBindings = runs.length ? array(t.root.runs, source) : [];
  unique(runBindings.map(binding => binding.id), 'SAGA_MONARCH_RUN_BINDING', source);
  if (runBindings.length !== runs.length) fail('SAGA_MONARCH_RUN_BINDING', 'bind every standalone Run exactly once', source);
  for (const runBinding of runBindings) {
    object(runBinding, ['id', 'version', 'ports'], source); pin({ id: runBinding.id, version: runBinding.version }, source);
    const run = runs.find(run => run.id === runBinding.id && run.binding.run.definitionVersion === runBinding.version);
    if (!run) fail('SAGA_MONARCH_RUN_BINDING', 'Run assembly must pin an exact selected version', source);
    const bindings = array(runBinding.ports, source);
    unique(bindings.map(binding => binding.id), 'SAGA_MONARCH_RUN_BINDING', source);
    if (bindings.length !== run.binding.ports.length) fail('SAGA_MONARCH_RUN_BINDING', 'bind every typed Run business leaf', source);
    for (const binding of bindings) {
      object(binding, ['id', 'implementation'], source); scalar(binding.id, source); scalar(binding.implementation, source);
      if (!run.binding.ports.some(port => port.id === binding.id)) fail('SAGA_MONARCH_RUN_BINDING', 'undeclared Run leaf binding', source);
    }
  }
  const runRoles = new Map(runs.flatMap(run => run.binding.ports.map(port => [
    'run:' + run.id + ':' + port.id, { run, port },
  ])));
  const implementations = array(t.implementations, source);
  if (!implementations.length || implementations.length > 64) fail('SAGA_MONARCH_IMPLEMENTATION', 'explicit captured external implementations required', source);
  unique(implementations.map(i => i.id), 'SAGA_MONARCH_IMPLEMENTATION', source);
  for (const implementation of implementations) {
    object(implementation, ['id', 'version', 'module', 'role', 'symbol', 'construction', 'implements', 'sourceRootKey', 'file', 'constructor', 'provides'], source);
    for (const key of ['id', 'version', 'symbol', 'sourceRootKey']) scalar(implementation[key], source);
    if (implementation.module !== 'ext' || !['adapter', 'extension'].includes(implementation.role) || !['class', 'object'].includes(implementation.construction))
      fail('SAGA_MONARCH_IMPLEMENTATION', 'external typed implementation with explicit constructor required', source);
    portableSeamsPath(implementation.file, source); reference(implementation.implements, source);
    const provides = array(implementation.provides, source);
    if (!provides.length || provides.some(role => !roles.includes(role) && !runRoles.has(role)))
      fail('SAGA_MONARCH_IMPLEMENTATION', 'explicit provided Saga or Run leaf roles required', source);
    unique(provides, 'SAGA_MONARCH_IMPLEMENTATION', source);
    if (provides.some(role => runRoles.has(role))) {
      if (provides.length !== 1 || implementation.implements.kind !== 'port' || implementation.implements.context !== host.context)
        fail('SAGA_MONARCH_IMPLEMENTATION', 'one exact typed Run leaf per external implementation', source);
      const { run, port } = runRoles.get(provides[0]);
      const declared = declaration(implementation.implements, layout, source);
      const body = resolve(canonical.value, declared.source.pointer, declared.source);
      object(body, ['schemaVersion', 'name', 'version', 'pipeline', 'port'], declared.source);
      if (body.schemaVersion !== 'truthsrc.saga-monarch-run-port/v1' || body.name !== implementation.implements.id ||
          body.version !== implementation.version || !equal(body.pipeline, { id: run.id, version: run.binding.run.definitionVersion }) ||
          body.port !== port.id || port.implementation !== implementation.symbol)
        fail('SAGA_MONARCH_IMPLEMENTATION', 'canonical Run leaf, execution binding and captured implementation must agree exactly', source);
    } else if (implementation.implements.kind !== 'port' || !ports.some(p => equal(p.ref, implementation.implements)))
      fail('SAGA_MONARCH_IMPLEMENTATION', 'external implementation must identify a selected Saga port', source);
    const groups = array(implementation.constructor, source);
    if (implementation.construction === 'object' && groups.length) fail('SAGA_MONARCH_IMPLEMENTATION', 'object cannot declare constructor arguments', source);
    for (const group of groups) {
      object(group, ['implicit', 'parameters'], source);
      if (typeof group.implicit !== 'boolean') fail('SAGA_MONARCH_IMPLEMENTATION', 'constructor list kind required', source);
      for (const parameter of array(group.parameters, source)) {
        object(parameter, ['name', 'input'], source); scalar(parameter.name, source);
        if (!['directory', 'resourceA', 'resourceB', 'recoveryAuthorization', 'executionContext'].includes(parameter.input))
          fail('SAGA_MONARCH_IMPLEMENTATION', 'unsupported external constructor input', source);
      }
    }
  }
  object(t.root.bindings, roles, source);
  for (const role of roles) {
    const implementation = implementations.find(i => i.id === t.root.bindings[role]);
    if (!implementation || !implementation.provides.includes(role)) fail('SAGA_MONARCH_ROOT', 'each port role requires an exact implementation provider', source);
  }
  const usedImplementations = new Set(Object.values(t.root.bindings));
  for (const run of runBindings) for (const port of run.ports) {
    const implementation = implementations.find(i => i.id === port.implementation);
    if (!implementation || !implementation.provides.includes('run:' + run.id + ':' + port.id))
      fail('SAGA_MONARCH_RUN_BINDING', 'Run leaf must bind its exact captured implementation role', source);
    usedImplementations.add(port.implementation);
  }
  if (implementations.some(i => !usedImplementations.has(i.id))) fail('SAGA_MONARCH_ROOT', 'unused external implementation is not admitted', source);
  return { schemaVersion: 'truthsrc.saga-host-contract/v2', host, technical: t, request: { ref: host.requestType, fields },
    ports, saga: lowered, workflow: { ...workflow, technical: wt }, runs: products['execution-contract'].pipelines,
    sources: [host.source, at(technical.id)] };
}
