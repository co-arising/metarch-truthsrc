import manifest from './generator.json' with { type: 'json' };
import { buildRunModel } from './run-model.mjs';
import { at, array, detach, equal, fail, object, text, unique } from '../../lib/products/request.mjs';
import { reference, refKey } from '../../lib/domain-products/references.mjs';
import { canonicalType, declaration } from '../../lib/domain-products/values.mjs';
import { resolveName, resolveNameSet, resolveArtifactPath } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';
import { portableSeamsPath } from '../../lib/products/module-seams-composition.mjs';
import { STRICT_SAGA_TARGET, MONARCH_R2_ARTIFACTS } from '../../lib/saga/runtime-targets.mjs';

export const productFootprint = detach(manifest.products.map(({ id, version }) => ({ id, version })));
export const productIds = Object.freeze(productFootprint.map(p => p.id));
const location = at('saga-monarch-generator');
const reject = message => fail('SAGA_MONARCH_MODEL', message, location);
const gap = message => fail('SAGA_MONARCH_INTERFACE', message, location);
export const sourcesOf = rows => [...new Map(rows.map(s => [JSON.stringify(s), s])).values()];
const phases = ['prepare', 'commit', 'compensate'];
const kinds = ['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown'];
const caseNames = ['Succeeded', 'RejectedBeforeEffects', 'Compensated', 'RecoveryRequired', 'OutcomeUnknown'];
const builtins = ['String', 'Int', 'Long', 'Boolean', 'Byte', 'Unit', 'Array', 'Vector', 'Map', 'Set', 'Option', 'Some', 'None', 'Either', 'Left', 'Right', 'Future', 'Try', 'Object', 'Product', 'Serializable', 'ActorSystem', 'ActorRef', 'ByteString', 'Phase', 'PayloadCodec', 'TransactionIdentity', 'OperationIdentity', 'OperationRequest', 'StrictParticipant', 'PhasePort', 'PhaseOutcome', 'StateCodec', 'RunDefinition', 'RunProtocol', 'RunSubmission', 'RunSubmissionPort', 'BatchDefinition', 'AreaDefinition', 'BatchManifest', 'Item', 'BatchCompletion', 'WorkflowProgram', 'WorkflowHost', 'ExecutionContext'];
const inherited = ['copy', 'productArity', 'productElement', 'productPrefix', 'canEqual', 'equals', 'hashCode', 'toString', 'getClass', 'wait', 'notify', 'notifyAll'];
builtins.push('ByteArrayInputStream', 'ByteArrayOutputStream', 'DataInputStream', 'DataOutputStream', 'ByteBuffer', 'CodingErrorAction', 'StandardCharsets', 'MessageDigest', 'Timeout', 'PersistenceId', 'Behavior', 'FiniteDuration', 'Duration', 'ResourceProtocol', 'ResourceEvidenceValidator', 'ExternalOperationPort', 'Op', 'BatchCodec', 'BatchPolicy', 'BatchSettings', 'ItemDecision', 'ItemDisposition', 'ResourceDisposition', 'BatchConservation', 'BatchProtocol', 'StrictSagaCoordinator', 'StrictSagaDefinition', 'ReconcileAuthorizer', 'ConfirmedReceipt', 'NotExecuted', 'Unknown', 'Rejected', 'PhaseBinding', 'QuerySafety', 'ReceiptCodecPin', 'CodecPin', 'Evidence', 'StrictStatus', 'ManagedStageScope', 'ManagedOperations', 'ManagedOperationSettings', 'PersistentMonarch', 'OperationProtocol');
builtins.push('Out', 'In', 'IllegalArgumentException', 'Nothing', 'Any', 'Null');
// Reserve only actual runtime/import/helper names, not our own protocol symbols
// (in particular the kernel PhaseIdentity is not Strict OperationIdentity).
const named = (id, scope, space, spelling, binding = spelling) => ({ knowledgeId: id, scope, space, spelling, binding, prefix: [], suffix: [] });
const member = (id, source) => {
  const n = resolveName({ profile: MODULAR_CANDIDATE, ...named(source.document + '#' + source.pointer, source.pointer, 'scala-member', id) });
  if (inherited.includes(n.name) || n.name === 'require') reject('request/payload member conflicts with generated Scala API');
  return n.identifier;
};
const only = (rows, predicate, message) => { const found = rows.filter(predicate); if (found.length !== 1) reject(message); return found[0]; };

/** Pure structural lowering of already compiled payloads. This is not compilation evidence. */
export function buildModels(raw) {
  const input = detach(raw);
  object(input, ['products', 'options'], location);
  const { products, options } = input;
  object(products, productIds, location); object(options, ['packages', 'names', 'sourceRoots'], location);
  const layout = products['reference-layout'], host = products['saga-host-contract'];
  if (host.schemaVersion !== 'truthsrc.saga-host-contract/v2') reject('host@3 payload required');
  const h = host.host, technical = host.technical, saga = host.saga, workflow = host.workflow;
  if (!equal(technical.runtime, { saga: STRICT_SAGA_TARGET, monarch: MONARCH_R2_ARTIFACTS })) reject('fixed runtime supply required');
  if (technical.identity.strategy !== 'sha256-item-frame-v1') reject('explicit original-item identity strategy required');
  if (workflow.settings.maxActiveItems > 100) gap('fixed R2 BatchCodec schema-1 permits at most 100 active items, even though the author compiler currently allows 1000');
  if (!equal(products['saga-runtime-contract'].sagas, [saga]) || !equal(products['execution-contract'].pipelines, host.runs)) reject('host runtime/run closure differs');
  const compiledSaga = only(products['saga-contract'].sagas, s => s.definition.id === h.saga.id, 'one exact Saga required');
  if (!equal(compiledSaga.definition, saga.contract.definition) || !equal(compiledSaga.binding, saga.contract.binding) ||
      !equal(compiledSaga.resultPort, saga.contract.resultPort)) reject('Saga semantic closure differs');
  const authoredWorkflow = only(products['workflow-contract'].workflows, w => w.id === h.workflow.id && w.version === h.workflow.version, 'selected workflow missing');
  const { technical: workflowTechnical, ...workflowAuthor } = workflow;
  const { technical: selectedTechnical, ...selectedAuthor } = authoredWorkflow;
  if (!equal(workflowAuthor, selectedAuthor)) reject('host/workflow semantic closure differs');
  if (selectedTechnical && !equal(selectedTechnical, workflowTechnical)) reject('workflow technical closure differs');
  if (!workflowTechnical) gap('workflow.technical requires stepId, codecVersion, connectorPrefix, connectorVersion, ledgerEpoch (interface-notes.md)');
  object(workflowTechnical, ['stepId', 'codecVersion', 'connectorPrefix', 'connectorVersion', 'ledgerEpoch', 'proofFormat', ...(Object.hasOwn(workflowTechnical, 'carry') ? ['carry'] : [])], location);
  if (!['digest-proof-v1', 'owner-certificates-v1'].includes(workflowTechnical.proofFormat)) gap('explicit execution evidence proofFormat required');
  if (workflow.areas.some(a => a.completion.resource === 'carry' || a.completion.retainCarried) && workflowTechnical.proofFormat !== 'owner-certificates-v1') gap('whole-group Carry requires explicit per-owner certificates proofFormat');
  if (workflow.areas.some(a => a.completion.resource === 'carry')) {
    if (!workflowTechnical.carry) gap('carry requires explicit reservationSuffix and ownerSuffix');
    object(workflowTechnical.carry, ['reservationSuffix', 'ownerSuffix'], location);
    for (const v of Object.values(workflowTechnical.carry)) text(v, location);
  } else if (workflowTechnical.carry) reject('unused carry identity binding');
  if (workflowTechnical.stepId !== 'execute' || workflowTechnical.codecVersion !== 'batch-codec-1') reject('fixed WorkflowHost internal execute/batch codec required');
  for (const key of ['connectorPrefix', 'connectorVersion', 'ledgerEpoch']) text(workflowTechnical[key], location);
  if (!/^sha256:[0-9a-f]{64}$/.test(saga.definitionDigest)) reject('full semantic lowered definitionDigest required');
  if (!equal(saga.schedule, { prepare: saga.participants.map(p => p.stepId), commit: saga.participants.map(p => p.stepId), compensate: saga.participants.map(p => p.stepId).reverse() }) || saga.participants.length !== 2) reject('exact two-participant serial TCC required');
  // Decimal/exact-money descriptors are not covertly reinterpreted as Int/string aliases.
  if (array(products['exact-value-types'], location).length || array(products['exact-value-codecs'], location).length)
    gap('finite identity/positive-Int host has no decimal/money role; nonempty exact decimal descriptors require explicit support');
  const packages = array(options.packages, location);
  if (packages.length !== 1) reject('one explicit host context package required');
  object(packages[0], ['context', 'package'], location);
  if (packages[0].context !== h.context || !layout.contexts.includes(h.context)) reject('package context differs from host');
  const packageName = resolveName({ profile: MODULAR_CANDIDATE, ...named(h.context, 'packages', 'scala-package', h.context, packages[0].package) }).name;
  const pkg = { kernel: packageName + '.kernel', glue: packageName + '.glue', root: packageName + '.root' };
  const names = array(options.names, location), used = new Set(), symbols = [], selectors = [];
  names.forEach(n => { object(n, ['ref', 'role', 'name'], location); reference(n.ref, location); declaration(n.ref, layout, location); text(n.role, location); text(n.name, location); });
  unique(names.map(n => JSON.stringify([n.ref, n.role])), 'SAGA_MONARCH_NAME', location);
  const sagaDeclaration = only(layout.declarations, d => d.ref.kind === 'saga' && d.ref.context === h.context && d.ref.id === h.saga.id, 'Saga source declaration missing');
  const rootSource = h.source;
  function symbol(ref, role, spelling, module, source = declaration(ref, layout, location).source) {
    selectors.push({ ref, role });
    const index = names.findIndex(n => equal(n.ref, ref) && n.role === role);
    if (index >= 0) used.add(index);
    const n = resolveName({ profile: MODULAR_CANDIDATE, ...named(refKey(ref) + ':' + role, pkg[module], 'scala-type', spelling, index < 0 ? null : names[index].name) });
    if (builtins.includes(n.name)) reject('generated type conflicts with Scala/runtime import: ' + n.name);
    const value = { ref, role, source, module, name: n.name, identifier: n.identifier, packageName: pkg[module], fqn: pkg[module] + '.' + n.name,
      path: resolveArtifactPath({ profile: MODULAR_CANDIDATE, module, packageName: pkg[module], typeName: n.name }) };
    symbols.push(value); return value;
  }
  const sagaTypes = new Map(saga.args.types.map(t => [t.id, t]));
  const nominal = (id, role) => {
    const type = sagaTypes.get(id); if (!type) reject('missing typed Saga role ' + role);
    const canonical = canonicalType(type.canonicalType, h.context, layout, location);
    if (canonical.form !== 'nominal') gap(role + ' requires a declared nominal alias, not ' + type.canonicalType);
    const d = declaration(canonical.ref, layout, location);
    const primitive = role === 'quantity' ? 'integer' : 'string';
    if (!equal(d.valueType, { form: 'primitive', name: primitive })) reject(role + ' nominal alias must wrap exactly ' + primitive);
    if (role === 'quantity' ? type.kind !== 'integer' || !Number.isSafeInteger(type.minimum) || type.minimum < 1 || !Number.isSafeInteger(type.maximum) || type.maximum > 2147483647 : type.kind !== 'id') reject('invalid identity/positive Int role');
    // Saga typeBinding minLength/maxLength both reference $defs.limit (1..2147483647).
    if (role !== 'quantity' && (!Number.isSafeInteger(type.minLength) || type.minLength < 1 ||
        !Number.isSafeInteger(type.maxLength) || type.minLength > type.maxLength || type.maxLength > 2147483647))
      reject('identity length bounds require explicit positive safe integers with minLength <= maxLength <= 2147483647');
    return { type, declaration: d };
  };
  const valueByRef = new Map(), values = [];
  const value = (id, role) => {
    const n = nominal(id, role), key = refKey(n.declaration.ref);
    if (valueByRef.has(key)) {
      const prior = valueByRef.get(key);
      if (prior.storage !== (role === 'quantity' ? 'positive-int' : 'identity-string')) reject('inconsistent nominal role storage');
      if (role !== 'quantity' && (prior.minLength !== n.type.minLength || prior.maxLength !== n.type.maxLength))
        reject('inconsistent nominal identity length bounds');
      return prior;
    }
    const model = { ...symbol(n.declaration.ref, 'value', n.declaration.ref.id, 'kernel'), storage: role === 'quantity' ? 'positive-int' : 'identity-string',
      ...(role === 'quantity' ? { minimum: n.type.minimum, maximum: n.type.maximum } : { minLength: n.type.minLength, maxLength: n.type.maxLength }) };
    valueByRef.set(key, model); values.push(model); return model;
  };
  const argsBySlot = new Map(saga.args.slots.map(a => [a.slot, a]));
  const fields = Object.entries(h.slots).map(([role, slot], i) => {
    const d = host.request.fields[i], arg = argsBySlot.get(slot);
    if (!d || d.ref.id !== slot || !arg) reject('ordered request role closure mismatch');
    const type = value(arg.type, role);
    if (!equal(d.valueType, { form: 'nominal', ref: type.ref })) reject('request role nominal type mismatch');
    return { role, slot, identifier: member(slot, d.source), source: d.source, type };
  });
  if (fields.length !== 5 || host.request.fields.length !== 5 || argsBySlot.size !== 5) reject('five explicit request roles required');
  const field = Object.fromEntries(fields.map(f => [f.role, f]));
  if (!equal(field.resourceA.type.ref, field.resourceB.type.ref)) reject('resources must share a nominal type');
  const transaction = value(saga.contract.definition.payload.transactionIdType, 'transactionId');
  const transactionPrefix = technical.identity.transactionPrefix;
  if (typeof transactionPrefix !== 'string') reject('transactionPrefix must be a string');
  const transactionLength = [...transactionPrefix].length + 64;
  if (transactionLength < transaction.minLength || transactionLength > transaction.maxLength)
    reject('generated transactionId length ' + transactionLength + ' outside declared transactionId length bounds');
  const request = { ...symbol(host.request.ref, 'value', host.request.ref.id, 'kernel'), fields };
  const argsType = sagaTypes.get(compiledSaga.definition.payload.argsType);
  if (!argsType || argsType.kind !== 'value-object' || !equal(argsType.fields, saga.args.slots) ||
      !equal(canonicalType(argsType.canonicalType, h.context, layout, location), { form: 'nominal', ref: request.ref }))
    gap('whole-request argsType must be the exact nominal record of all five ordered args');
  const resultDecl = only(layout.declarations, d => d.ref.kind === 'type' && d.ref.context === h.context && d.ref.id === compiledSaga.resultPort.payload.name, 'nominal result payload missing');
  if (resultDecl.valueType?.form !== 'record' || resultDecl.valueType.members.length !== 2) gap('frozen result ABI needs exactly nominal transactionId + originalRequest fields');
  const resultFields = resultDecl.valueType.members.map(r => declaration(r, layout, location));
  const txField = only(resultFields, d => equal(d.valueType, { form: 'nominal', ref: transaction.ref }), 'result transaction nominal mismatch');
  const requestField = only(resultFields, d => equal(d.valueType, { form: 'nominal', ref: request.ref }), 'result original request nominal mismatch');
  if (!equal(saga.completions.map(c => c.kind).sort(), [...kinds].sort())) reject('complete five-result completion contract required');
  for (const completion of saga.completions) {
    const tx = completion.inputs.find(i => i.slot === txField.ref.id), original = completion.inputs.find(i => i.slot === requestField.ref.id);
    if (completion.inputs.length !== 2 || !equal(tx?.source ?? null, { kind: 'transaction-id' }) || !equal(original?.source ?? null, { kind: 'args-record' }))
      gap('all result completions require exact transaction-id and whole-request args-record sources; no fabricated completion data');
  }
  const result = { ...symbol(resultDecl.ref, 'value', resultDecl.ref.id, 'kernel'), fields: resultFields.map(d => ({
    identifier: member(d.ref.id, d.source), role: d === txField ? 'transactionId' : 'originalRequest', source: d.source,
  })), transactionField: member(txField.ref.id, txField.source), requestField: member(requestField.ref.id, requestField.source) };
  const ports = Object.fromEntries(host.ports.map(p => [p.role, symbol(p.ref, 'port', p.ref.id, 'kernel', p.source)]));
  const support = {};
  for (const [role, name] of Object.entries({ codecIdentity: 'CodecIdentity', identity: 'SagaIdentity', phase: 'ReservationPhase', phaseIdentity: 'PhaseIdentity', item: 'ItemIdentity', association: 'Association', sagaResult: 'SagaResult', prepareReceipt: 'PrepareReceipt', commitReceipt: 'CommitReceipt', compensateReceipt: 'CompensateReceipt', prepareCommand: 'PrepareCommand', commitCommand: 'CommitCommand', compensateCommand: 'CompensateCommand', participantObservation: 'ParticipantObservation', resultEnvelope: 'ResultEnvelope', resultReceipt: 'ResultReceipt', itemResult: 'ItemResult', manifestResult: 'ManifestResult', resultObservation: 'ResultObservation', applicationPorts: 'ApplicationPorts', facade: 'ReservationFacade', binaryCodec: 'BinaryCodec' })) {
    support[role] = symbol(sagaDeclaration.ref, role, name, 'kernel', rootSource);
  }
  const artifacts = {
    protocol: symbol(sagaDeclaration.ref, 'protocol', h.id + '-protocol', 'kernel', rootSource),
    codecs: symbol(sagaDeclaration.ref, 'codecs', 'BinaryCodecs', 'kernel', rootSource),
    saga: symbol(sagaDeclaration.ref, 'saga', h.id + '-saga', 'glue'),
    runtime: symbol(sagaDeclaration.ref, 'runtime', 'PublicRuntime', 'glue', rootSource),
    workflow: symbol(sagaDeclaration.ref, 'workflow', h.workflow.id + '-workflow', 'glue', workflow.source),
    root: symbol(sagaDeclaration.ref, 'root', technical.root.id, 'root', rootSource),
  };
  for (const [role, name] of Object.entries({ settings: 'ApplicationSettings', ownership: 'SystemOwnership', runFactories: 'RunFactories', checkedRun: 'CheckedRunFacade' }))
    support[role] = symbol(sagaDeclaration.ref, role, name, 'glue', rootSource);
  // Artifact containers (protocol/runtime) are file names, not emitted Scala declarations.
  const declarations = symbols.filter(s => ![artifacts.protocol, artifacts.runtime].includes(s));
  resolveNameSet({ profile: MODULAR_CANDIDATE, names: declarations.map((s, i) => named('declaration:' + i, s.packageName, 'scala-type', s.name)), reserved: [] });
  for (const s of [...values, request, result, ...Object.values(ports), ...Object.values(support).filter(s => s.module === 'kernel')]) s.path = artifacts.protocol.path;
  for (const s of Object.values(support).filter(s => s.module === 'glue')) s.path = artifacts.runtime.path;
  const participants = saga.participants.map((p, i) => {
    if (p.resource.ref !== 'args:' + field[i ? 'resourceB' : 'resourceA'].slot) reject('participant resource role mismatch');
    const phaseModels = {};
    for (const phase of phases) {
      const lowered = p.phases[phase];
      if (!lowered) reject('complete phase bridge required');
      // The frozen port ABI carries one persisted reservation handle per phase.
      const handleType = sagaTypes.get(lowered.outputs[0]?.type);
      if (lowered.outputs.length !== 1 || !['id', 'string'].includes(handleType?.kind) ||
          handleType?.canonicalType !== 'String')
        gap('phase receipt ABI supports one explicit primitive-string reservation-handle output; a nominal/different receipt shape needs a versioned bridge');
      if (!Number.isSafeInteger(handleType.minLength) || handleType.minLength < 1 ||
          !Number.isSafeInteger(handleType.maxLength) || handleType.minLength > handleType.maxLength || handleType.maxLength > 2147483647)
        reject('receipt handle length bounds require explicit positive safe integers with minLength <= maxLength <= 2147483647');
      // Lower the existing binding type, per producer: a shared codec pin does not imply a shared range.
      phaseModels[phase] = { ...lowered, receiptHandle: {
        type: handleType.id, minLength: handleType.minLength, maxLength: handleType.maxLength,
      } };
      const reads = lowered.inputs.filter(x => x.source.kind === 'receipt-field').map(x => [x.source.stepId, x.source.phase, x.source.slot]);
      const expected = phase === 'prepare' ? i ? [[saga.participants[0].stepId, 'prepare']] : [] : phase === 'commit'
        ? [...saga.participants.map(p => [p.stepId, 'prepare']), ...(i ? [[saga.participants[0].stepId, 'commit']] : [])] : [[p.stepId, 'prepare']];
      const wanted = expected.map(([step, phase]) => [step, phase, saga.participants.find(p => p.stepId === step).phases[phase].outputs[0].slot]);
      const order = rows => rows.map(row => JSON.stringify(row)).sort();
      if (!equal(order(reads), order(wanted))) gap('phase receipt dataflow differs from the frozen complete A/B receipt ABI');
      if (lowered.inputs.some(x => !['transaction-id', 'args', 'receipt-field'].includes(x.source.kind) ||
          x.source.kind === 'args' && argsBySlot.get(x.source.slot)?.type !== x.type ||
          x.source.kind === 'transaction-id' && x.type !== saga.contract.definition.payload.transactionIdType)) reject('unsupported or mistyped phase input source');
      const direct = lowered.inputs.filter(x => x.source.kind !== 'receipt-field').map(x => [x.type, x.source]);
      const directFields = [field[i ? 'resourceB' : 'resourceA'], field.subject, ...(phase === 'prepare' ? [field.quantity] : [])];
      const required = [[saga.contract.definition.payload.transactionIdType, { kind: 'transaction-id' }],
        ...directFields.map(f => [argsBySlot.get(f.slot).type, { kind: 'args', slot: f.slot }])];
      if (!equal(order(direct), order(required))) gap('phase input roles differ from the finite transaction/resource/subject/prepare-quantity bridge');
      for (const input of lowered.inputs.filter(x => x.source.kind === 'receipt-field')) {
        const producer = saga.participants.find(p => p.stepId === input.source.stepId)?.phases[input.source.phase];
        if (!producer || producer.outputs.find(o => o.slot === input.source.slot)?.type !== input.type) reject('receipt input/output nominal type mismatch');
      }
    }
    const stepIndex = saga.contract.definition.payload.steps.findIndex(s => s.id === p.stepId);
    return { ...p, phases: phaseModels, index: i, resourceField: field[i ? 'resourceB' : 'resourceA'].identifier,
      source: at(sagaDeclaration.source.document, sagaDeclaration.source.pointer + '/payload/steps/' + stepIndex) };
  });
  object(technical.wire, ['format', 'maxBytes', 'codecs', 'phaseTags', 'resultTags'], location);
  if (technical.wire.format !== 'length-prefixed-v1') reject('explicit finite wire format required');
  const codecRoles = ['request', 'identity', 'phaseIdentity', 'item', 'association', 'prepare', 'commit', 'compensate', 'result', 'manifestResult'];
  if (!equal(technical.wire.codecs.map(c => c.role), codecRoles)) reject('all ten framed codec roles required');
  for (const phase of phases) for (const p of participants) {
    const codec = technical.wire.codecs.find(c => c.role === phase);
    if (!equal({ id: codec.id, version: codec.version }, p.phases[phase].runtimeCodec)) reject('phase codec pin mismatch');
  }
  if (!equal(technical.wire.phaseTags, phases.map((phase, i) => ({ phase, tag: i + 1 }))) || !equal(technical.wire.resultTags, kinds.map((kind, i) => ({ kind, tag: i + 1 })))) reject('explicit ABI tags required');
  const serialization = { ...technical.wire, maxManifestItems: Math.max(...workflow.areas.map(a => a.batch.maxItems)),
    results: kinds.map((kind, i) => ({ kind, name: caseNames[i], tag: technical.wire.resultTags[i].tag, terminal: i < 3 })) };
  const sourceRoots = array(options.sourceRoots, location);
  for (const root of sourceRoots) {
    object(root, ['id', 'module', 'path'], location); text(root.id, location); portableSeamsPath(root.path, location);
    if (root.module !== 'ext' || !technical.implementations.some(i => i.sourceRootKey === root.id)) reject('only used ext source roots are admitted');
  }
  unique(sourceRoots.map(r => r.id), 'SAGA_MONARCH_ROOTS', location);
  for (const [i, root] of sourceRoots.entries()) for (const other of sourceRoots.slice(0, i)) {
    const a = root.path.normalize('NFC').toLowerCase(), b = other.path.normalize('NFC').toLowerCase();
    if (a === b || a.startsWith(b + '/') || b.startsWith(a + '/')) reject('overlapping external source roots');
  }
  const implementations = technical.implementations.map((i, ordinal) => {
    const source = at(host.sources[1].document, host.sources[1].pointer + '/implementations/' + ordinal);
    const root = only(sourceRoots, r => r.id === i.sourceRootKey && r.module === i.module, 'missing implementation source root');
    const parts = i.symbol.split('.'), name = parts.pop(), packageName = parts.join('.');
    resolveName({ profile: MODULAR_CANDIDATE, ...named(i.id, 'external', 'scala-package', packageName) });
    resolveName({ profile: MODULAR_CANDIDATE, ...named(i.id, packageName, 'scala-type', name) });
    if (declarations.some(d => d.fqn.toLowerCase() === i.symbol.toLowerCase())) reject('external/generated FQN collision');
    portableSeamsPath(i.file, location);
    if (!['class', 'object'].includes(i.construction) || i.construction === 'object' && i.constructor.length) reject('explicit class/object constructor ABI required');
    for (const group of i.constructor) {
      object(group, ['implicit', 'parameters'], source);
      if (typeof group.implicit !== 'boolean') reject('constructor list kind must be explicit');
      for (const parameter of array(group.parameters, source)) {
        object(parameter, ['name', 'input'], source);
        member(parameter.name, source);
        if (!['directory', 'resourceA', 'resourceB', 'recoveryAuthorization', 'executionContext'].includes(parameter.input)) reject('unknown external constructor input');
      }
    }
    return { ...i, source, sourceRoot: root.path, local: 'implementation' + ordinal };
  });
  const handwritten = implementations.map(({ id, version, module, role, symbol, construction, implements: implementsRef, sourceRootKey, file, source, sourceRoot }) =>
    ({ id, version, module, role, symbol, construction, implements: implementsRef, sourceRootKey, file, source, sourceRoot }));
  const runs = host.runs.map((run, index) => {
    const d = only(layout.declarations, d => d.ref.kind === 'pipeline' && d.ref.context === h.context && d.ref.id === run.id, 'run declaration missing');
    const runSymbol = symbol(d.ref, 'run', run.id + '-run', 'glue', d.source);
    runSymbol.path = artifacts.runtime.path;
    const protocol = symbol(d.ref, 'runProtocol', runSymbol.name + 'Protocol', 'kernel', d.source);
    protocol.path = artifacts.protocol.path;
    const model = buildRunModel(run, { execution: products['execution-contract'], index, symbol: runSymbol, protocol,
      emittedTypes: [...values, request, result] });
    const local = spelling => resolveName({ profile: MODULAR_CANDIDATE,
      ...named(d.source.document + '#' + d.source.pointer + ':' + spelling, 'run-root-members', 'scala-member', spelling, null) }).identifier;
    return { ...model, hostIdentifier: local(run.id + '-run-host'), leavesIdentifier: local(run.id + '-run-leaves') };
  });
  if (runs.length) {
    const rootRuns = array(technical.root.runs, location);
    unique(rootRuns.map(r => r.id), 'SAGA_MONARCH_RUN_ROOT', location);
    if (rootRuns.length !== runs.length) reject('root.runs must bind every typed Run exactly once');
    const leafProviders = new Set();
    for (const run of runs) {
      const rootRun = only(rootRuns, r => r.id === run.id && r.version === run.binding.run.definitionVersion, 'root.runs exact Run version required');
      object(rootRun, ['id', 'version', 'ports'], location);
      const bindings = array(rootRun.ports, location);
      unique(bindings.map(p => p.id), 'SAGA_MONARCH_RUN_ROOT', location);
      if (bindings.length !== run.ports.length) reject('root.runs complete typed leaf coverage required');
      run.leaves = run.ports.map((port, index) => {
        const binding = only(bindings, p => p.id === port.id, 'root.runs typed leaf binding missing');
        object(binding, ['id', 'implementation'], location);
        const implementation = only(implementations, i => i.id === binding.implementation, 'typed Run leaf implementation missing');
        if (!equal(implementation.provides, ['run:' + run.id + ':' + port.id]) || implementation.symbol !== port.implementation)
          reject('typed Run leaf requires one exact run:id:port role and execution implementation');
        const canonicalPort = declaration(implementation.implements, layout, location);
        if (canonicalPort.ref.kind !== 'port' || canonicalPort.ref.context !== h.context)
          reject('typed Run leaf must capture a real canonical technical port');
        if (leafProviders.has(implementation.id)) reject('typed Run leaf implementation cannot serve multiple roles');
        leafProviders.add(implementation.id);
        return { port, implementation, source: canonicalPort.source, identifier: 'leaf' + index,
          local: resolveName({ profile: MODULAR_CANDIDATE, ...named(canonicalPort.source.document + '#' + canonicalPort.source.pointer,
            'run-root-members', 'scala-member', run.id + '-' + port.id + '-typed-leaf', null) }).identifier };
      });
    }
    if (implementations.some(i => i.provides.some(role => role.startsWith('run:')) && !leafProviders.has(i.id)))
      reject('unused typed Run leaf implementation');
  }
  if (used.size !== names.length) reject('unused/unknown name selector');
  // Root/glue wildcard-import the protocol. Cross-package homonyms therefore
  // also collide, even when their declaration scopes differ.
  resolveNameSet({ profile: MODULAR_CANDIDATE, names: [...declarations, ...runs.flatMap(r => [r.symbol, r.protocol])].map((s, i) => named('final-declaration:' + i, 'host-visible-types', 'scala-type', s.name)), reserved: [] });
  const areas = workflow.areas.map((area, i) => {
    if (!['invoke-saga', 'publish-result', 'query-saga', 'run'].includes(area.action.kind)) reject('unknown finite area action');
    if (!['single', 'count-or-wait', 'by-compatibility-key'].includes(area.batch.kind)) reject('unsupported batch mode');
    if (area.completion.unknown !== 'hold' || !['release', 'carry'].includes(area.completion.resource) || typeof area.completion.retainCarried !== 'boolean') reject('unsupported unknown/resource completion policy');
    const terminal = area.completion.terminal;
    const dispositions = terminal.kind === 'by-result' ? (() => {
      object(terminal, ['kind', 'cases'], location);
      if (!equal(terminal.cases.map(c => c.result).sort(), kinds.slice(0, 3).sort())) reject('by-result requires all three terminal result cases exactly once');
      terminal.cases.forEach(c => object(c, ['result', 'disposition'], location));
      return terminal.cases.map(c => c.disposition);
    })() : [terminal];
    for (const d of dispositions) {
      object(d, ['kind', 'target', 'compatibilityKey', 'delayMillis'], location);
      if (!['complete', 'route', 'retry', 'hold'].includes(d.kind)) reject('unsupported terminal disposition');
      if (!Number.isSafeInteger(d.delayMillis) || d.delayMillis < 0 || d.delayMillis > 86400000) reject('bounded terminal delay required');
      if (d.kind === 'route' ? !workflow.areas.some(a => a.id === d.target) || typeof d.compatibilityKey !== 'string' || !d.compatibilityKey.length : d.target !== null || d.compatibilityKey !== null) reject('terminal route target/key mismatch');
      if (d.kind === 'retry' && area.maxExecutions < 2 || !['route', 'retry'].includes(d.kind) && d.delayMillis !== 0) reject('retry/delay lacks an authored execution budget');
    }
    const hasRetry = dispositions.some(d => d.kind === 'retry');
    if (hasRetry) {
      if (terminal.kind !== 'by-result') reject('terminal Retry requires by-result; all-terminal Retry is unsafe');
      if (terminal.cases.some(c => c.disposition.kind === 'retry' && c.result !== 'rejected-before-effects'))
        reject('only rejected-before-effects may Retry; succeeded and compensated Retry are forbidden');
      if (area.action.kind !== 'run') reject('terminal Retry requires a managed run action; invoke-saga, query-saga and publish-result cannot reexecute business');
      const retry = area.action.retry;
      if (!retry || !equal(Object.keys(retry).sort(), ['identity', 'onExhausted', 'semantics']) ||
          retry.semantics !== 'reexecute-after-rejected-before-effects' || retry.identity !== 'original-item-new-batch-operation')
        reject('run Retry requires the exact explicit action.retry semantics, identity and exhaustion contract');
      const exhausted = retry.onExhausted;
      if (!exhausted || !equal(Object.keys(exhausted).sort(), ['kind', 'reason']) ||
          !['fail', 'hold'].includes(exhausted.kind) || typeof exhausted.reason !== 'string' ||
          !exhausted.reason.trim() || !exhausted.reason.isWellFormed() || /[\p{Cc}\p{Cf}]/u.test(exhausted.reason) || Buffer.byteLength(exhausted.reason) > 256)
        reject('run Retry requires the exact explicit action.retry exhaustion kind/reason');
    } else if (Object.hasOwn(area.action, 'retry')) reject('unused action.retry contract without a Retry disposition');
    if ((area.completion.resource === 'carry' || area.completion.retainCarried) && (dispositions.some(d => d.kind !== 'route') ||
        dispositions.some(d => !equal(d, dispositions[0])) || workflow.areas.find(a => a.id === dispositions[0].target).batch.maxItems < area.batch.maxItems))
      reject('Carry cannot split holders by result kind, target, key, delay, or downstream batch capacity');
    if (area.verification && area.action.kind !== 'query-saga') reject('verification must be explicitly query-only');
    const run = area.action.kind === 'run' ? only(runs, r => r.id === area.action.ref.id && r.binding.run.definitionVersion === area.action.ref.version, 'area managed Run missing') : null;
    // These pins describe WorkflowHost's durable batch operation, never the inner Run.
    const operation = {
      stepId: workflowTechnical.stepId, connectorId: workflowTechnical.connectorPrefix + area.id, connectorVersion: workflowTechnical.connectorVersion, ledgerEpoch: workflowTechnical.ledgerEpoch,
    };
    let runMapping;
    if (run) {
      if (run.mode !== 'managed' || run.steps.length !== 1) reject('workflow business bridge requires one managed typed Run step');
      const mappings = array(area.action.inputs, location);
      unique(mappings.map(row => row.slot), 'SAGA_MONARCH_RUN_INPUT', location);
      if (mappings.length !== run.inputs.length) reject('complete typed Run input mapping required');
      const inputs = run.inputs.map(input => {
        const mapping = only(mappings, row => row.slot === input.id, 'complete typed Run input mapping required');
        object(mapping, ['slot', 'source'], location);
        const type = mapping.source === 'request' ? request : mapping.source === 'transaction-id' ? transaction : null;
        if (!type || input.typeModel.fqn !== type.fqn) reject('Run input must map its exact original request or transaction-id nominal type');
        return { ...mapping, identifier: input.identifier };
      });
      const resultMapping = area.action.result;
      object(resultMapping, ['slot', 'onStopped', 'outcomes'], location);
      if (resultMapping.onStopped !== 'original-item') reject('Stopped Run requires explicit original-item result reconstruction');
      const output = only(run.outputs, output => output.id === resultMapping.slot && output.typeModel.fqn === result.fqn, 'Run result must select the exact nominal original-item output');
      if (run.outputs.length !== 1) reject('Run result must consume the single complete output');
      const outcomes = array(resultMapping.outcomes, location), declared = run.steps[0].outcomes;
      unique(outcomes.map(row => row.code), 'SAGA_MONARCH_RUN_RESULT', location);
      if (outcomes.length !== declared.length) reject('complete Run outcome mapping required');
      const allowed = { success: ['succeeded'], resolved: ['succeeded'], 'business-rejection': ['rejected-before-effects', 'compensated'],
        'infrastructure-failure': ['recovery-required'], 'unknown-effect': ['outcome-unknown'] };
      const mappedOutcomes = declared.map(outcome => {
        const mapping = only(outcomes, row => row.code === outcome.code, 'complete Run outcome mapping required');
        object(mapping, ['code', 'result'], location);
        if (!allowed[outcome.kind]?.includes(mapping.result)) reject('Run outcome mapping must preserve terminal/uncertain semantics');
        return { ...mapping, name: serialization.results.find(row => row.kind === mapping.result).name, stateEffect: outcome.stateEffect };
      });
      const completed = [...new Set(mappedOutcomes.filter(row => row.stateEffect === 'write').map(row => row.name))];
      if (completed.length !== 1) reject('Completed Run must have one exact success result classification');
      runMapping = { run, inputs, output, outcomes: mappedOutcomes, completedResult: completed[0], onStopped: resultMapping.onStopped };
    }
    return { ...area, operation, ...(runMapping ? { runMapping } : {}), source: at(workflow.source.document, workflow.source.pointer + '/areas/' + i) };
  });
  const artifactRows = Object.entries(artifacts).map(([role, a]) => ({ ...a, role,
    kind: { protocol: 'protocol', codecs: 'exact-value-codec', saga: 'saga-bridge', runtime: 'run-facade', workflow: 'workflow-program', root: 'application-root' }[role],
    sources: sourcesOf(role === 'protocol' ? [rootSource, ...values.map(v => v.source), request.source, ...fields.map(f => f.source), result.source, ...result.fields.map(f => f.source), ...Object.values(ports).map(p => p.source)] : role === 'saga' ? [sagaDeclaration.source, ...participants.map(p => p.source), ...host.sources] : role === 'workflow' ? [workflow.source, ...areas.map(a => a.source), ...host.sources] : host.sources),
    directDeps: ({ protocol: [], codecs: [artifacts.protocol.path], saga: [artifacts.protocol.path, artifacts.codecs.path, artifacts.runtime.path], runtime: [artifacts.protocol.path, artifacts.codecs.path], workflow: [artifacts.saga.path], root: [artifacts.workflow.path] })[role] }));
  const files = new Set();
  for (const a of artifactRows) { const key = a.path.normalize('NFC').toLowerCase(); if (files.has(key)) reject('portable artifact path collision'); files.add(key); }
  return detach({ schemaVersion: 'truthsrc.saga-monarch-model/v1', packageName, packages: pkg,
    lowered: { sourceRoots, handwritten }, sourceRoots, values, request, result, transaction, field, ports, support,
    saga: { ...saga, participants }, workflow: { ...workflow, areas }, runs, implementations,
    root: technical.root, technical, serialization, symbols: artifacts, artifacts: artifactRows, selectors,
    sources: host.sources, modules: [
      { id: 'kernel', dependsOn: [] }, { id: 'glue', dependsOn: ['kernel'] },
      { id: 'ext', dependsOn: ['kernel'] }, { id: 'root', dependsOn: ['kernel', 'glue', 'ext'] },
    ] });
}

/** Pure pre-capture selector. Only generate/planProductSet verifies compilation replay. */
export function resolveSagaMonarchTarget(raw) {
  const input = detach(raw);
  if (!Object.hasOwn(input, 'compilation')) return buildModels(input).lowered;
  object(input, ['compilation', 'options'], location);
  const envelopes = input.compilation?.result?.products;
  if (input.compilation?.diagnostics?.length || !Array.isArray(envelopes) || envelopes.length !== productIds.length)
    reject('complete eight-product compilation required for capture declarations');
  const products = Object.fromEntries(manifest.products.map(expected => {
    const actual = only(envelopes, p => p.id === expected.id, 'capture product missing');
    if (actual.version !== expected.version || actual.payloadSchemaVersion !== expected.payloadSchemaVersion || !equal(actual.capabilities, expected.capabilities))
      reject('capture product version/capabilities differ');
    return [actual.id, actual.payload];
  }));
  return buildModels({ products, options: input.options }).lowered;
}
export const resolveTarget = resolveSagaMonarchTarget;
