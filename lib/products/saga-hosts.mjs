import { array, at, equal, fail, object, resolve, text, unique } from './request.mjs';
import { canonicalType, checkFields, declaration } from '../domain-products/values.mjs';
import { owner, refKey } from '../domain-products/references.mjs';

export const PHASES = Object.freeze(['prepare', 'commit', 'compensate']);
export const RESULT_KINDS = Object.freeze(['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown']);
export const IDENTITY_KEYS = Object.freeze(['txid', 'definition-version', 'args-digest', 'participant', 'resource', 'step', 'phase']);
const stringType = Object.freeze({ form: 'primitive', name: 'string' });
const booleanType = Object.freeze({ form: 'primitive', name: 'boolean' });
const pinKeys = ['ref', 'version'];
const hostKeys = ['id', 'version', 'saga', 'argsType', 'entry', 'association', 'participants', 'results', 'technicalPorts'];

/** A full source-derived static host contract. No authority, installed implementation or delivery claim. */
export function compileSagaHosts(binding, canonical, layout, sagas, runtime, execution, external, artifacts, exact) {
  const usedPorts = new Set();
  const declaredPort = (pin, source) => {
    object(pin, pinKeys, source); text(pin.version, source);
    const d = declaration(pin.ref, layout, source);
    if (d.ref.kind !== 'port' || d.source.document !== canonical.id || !/^\/ports\/(0|[1-9][0-9]*)$/u.test(d.source.pointer)) fail('HOST_PORT', 'explicit canonical port required', source);
    const body = resolve(canonical.value, d.source.pointer, d.source);
    if (body.name !== d.ref.id || body.version !== pin.version) fail('HOST_PORT', 'port identity/version differs from canonical', source);
    const typedBody = { ...body, inputType: typeof body.inputType === 'string' ? canonicalType(body.inputType, d.ref.context, layout, source) : body.inputType,
      outputType: typeof body.outputType === 'string' ? canonicalType(body.outputType, d.ref.context, layout, source) : body.outputType };
    usedPorts.add(refKey(pin.ref));
    return { declaration: d, body: typedBody };
  };
  const record = (type, source) => {
    object(type, ['form', 'ref'], source);
    if (type.form !== 'nominal') fail('HOST_TYPE', 'explicit nominal record required', source);
    const d = declaration(type.ref, layout, source);
    if (type.ref.kind !== 'type' || d.valueType?.form !== 'record') fail('HOST_TYPE', 'declared nominal record required', source);
    const members = d.valueType.members.map(r => declaration(r, layout, source));
    const body = resolve(canonical.value, d.source.pointer, d.source);
    if (d.source.document !== canonical.id || body.name !== type.ref.id || body.context !== type.ref.context) fail('HOST_TYPE', 'record must identify its complete canonical definition', source);
    checkFields(body.fields, members, canonical, layout, d.source.pointer + '/fields', 'member', type.ref);
    return members;
  };
  const recordMatches = (type, fields, source) => {
    const members = record(type, source);
    if (members.length !== fields.length || members.some((m, i) => m.ref.id !== fields[i].id || !equal(m.valueType, fields[i].valueType))) fail('HOST_TYPE', 'record must preserve the entire ordered typed signature', source);
    return members;
  };
  const fields = (ref, kind, source) => {
    const d = declaration(ref, layout, source);
    if (ref.kind !== kind || d.source.document !== canonical.id) fail('HOST_REFERENCE', 'explicit canonical command/event required', source);
    const aggregate = declaration(owner(ref), layout, source);
    if (aggregate.source.document !== canonical.id || !/^\/aggregates\/(0|[1-9][0-9]*)$/u.test(aggregate.source.pointer)) fail('HOST_REFERENCE', 'canonical aggregate required', source);
    const key = kind === 'command' ? 'parameters' : 'payloads';
    const body = resolve(canonical.value, d.source.pointer, d.source);
    if (body.name !== ref.id || !d.source.pointer.startsWith(aggregate.source.pointer + '/' + (kind === 'command' ? 'commands/' : 'events/'))) fail('HOST_REFERENCE', 'container reference differs from source owner/name', source);
    return checkFields(body[key], layout.declarations.filter(x => x.ref.kind === (kind === 'command' ? 'parameter' : 'event-slot') && x.ref.context === ref.context && equal(x.ref.owner, [...ref.owner, ref.id])), canonical, layout, d.source.pointer + '/' + key, kind === 'command' ? 'parameter' : 'event-slot', ref);
  };
  const shortRef = (r, ref, source) => {
    if (!r || r.aggregate !== ref.owner[0] || r.name !== ref.id) fail('HOST_REFERENCE', 'qualified reference differs from the complete Saga contract', source);
  };
  const pinRecord = (pin, input, output, source) => {
    const p = declaredPort(pin, source);
    if (!equal(p.body.inputType, input) || !equal(p.body.outputType, output)) fail('HOST_PORT', 'complete nominal port types differ from host contract', source);
    return p;
  };
  const rows = array(canonical.value.sagaHosts, at(canonical.id, '/sagaHosts')).map((h, i) => {
    const source = at(canonical.id, '/sagaHosts/' + i);
    object(h, hostKeys, source); text(h.id, source); text(h.version, source);
    object(h.saga, ['ref', 'version'], source); text(h.saga.version, source);
    const sagaDecl = declaration(h.saga.ref, layout, source);
    if (h.saga.ref.kind !== 'saga' || sagaDecl.source.document !== canonical.id) fail('HOST_REFERENCE', 'declared canonical Saga required', source);
    const s = runtime.sagas.find(s => s.sagaId === h.saga.ref.id && s.definitionVersion === h.saga.version);
    const compiled = sagas.sagas.find(s => s.definition.id === h.saga.ref.id && s.definition.version === h.saga.version);
    if (!s || !compiled || !equal(resolve(canonical.value, sagaDecl.source.pointer, sagaDecl.source), s.contract.definition)) fail('HOST_SAGA', 'full pinned live Saga/runtime closure required', source);
    const definition = s.contract.definition.payload;
    const type = name => canonicalType(s.args.types.find(t => t.id === name)?.canonicalType ?? name, h.saga.ref.context, layout, source);
    for (const descriptor of s.args.types.filter(t => t.kind === 'money')) {
      const nominal = type(descriptor.canonicalType), admitted = exact.find(t => equal(t.domain, nominal.ref));
      if (!admitted || admitted.form !== 'unit-decimal' || admitted.scale !== descriptor.scale || admitted.precision !== descriptor.precision || descriptor.amountEncoding !== 'minor-unit-string') fail('HOST_TYPE', 'runtime money descriptor must match a complete exact nominal product', source);
    }
    recordMatches(h.argsType, definition.args.map(a => ({ id: a.slot, valueType: type(a.type) })), source);
    object(h.entry, ['triggerId', 'kind', 'source', 'inputType', 'port', 'startOwner'], source);
    const triggerExecution = s.triggers.find(t => t.declaration.id === h.entry.triggerId);
    const trigger = triggerExecution?.declaration;
    if (!trigger || !['command', 'event'].includes(h.entry.kind) || trigger.kind !== h.entry.kind) fail('HOST_ENTRY', 'one declared trigger and unchanged entry kind required', source);
    shortRef(trigger.sourceRef, h.entry.source, source);
    if (h.entry.source.context !== h.saga.ref.context) fail('HOST_ENTRY', 'entry context differs from Saga', source);
    const entryFields = fields(h.entry.source, h.entry.kind, source);
    recordMatches(h.entry.inputType, entryFields.map(d => ({ id: d.ref.id, valueType: d.valueType })), source);
    pinRecord(h.entry.port, h.entry.inputType, booleanType, source);
    object(h.entry.startOwner, ['kind', 'ref', 'stepId'], source);
    const start = h.entry.startOwner;
    if (start.kind === 'direct') {
      if (start.ref !== null || start.stepId !== null) fail('HOST_START_OWNER', 'direct entry cannot also select a pipeline start', source);
    } else if (start.kind === 'pipeline') {
      const p = declaration(start.ref, layout, source); text(start.stepId, source);
      if (start.ref.kind !== 'pipeline' || p.source.document !== canonical.id) fail('HOST_START_OWNER', 'explicit pipeline start owner required', source);
      const pipeline = execution.pipelines.find(p => p.id === start.ref.id);
      const step = pipeline?.steps.find(s => s.id === start.stepId);
      if (!step?.execution?.invokeSaga || !equal(step.execution.invokeSaga.ref, { sagaId: h.saga.ref.id, version: h.saga.version })) fail('HOST_START_OWNER', 'pipeline owner must invoke this exact Saga at its declared step', source);
    } else fail('HOST_START_OWNER', 'exactly one direct or pipeline start owner required', source);
    const sourceInput = name => {
      const d = entryFields.find(d => d.ref.id === name);
      if (!d) fail('HOST_INPUT', 'original trigger input is missing', source);
      return d;
    };
    const inputFor = input => {
      if (input.kind !== 'args') fail('HOST_RESOURCE', 'resource/destination must be retained original args in this finite profile', source);
      const mapping = trigger.argsMapping.find(a => a.slot === input.slot);
      if (!mapping || !mapping.ref.startsWith('source:')) fail('HOST_INPUT', 'arg must have explicit original source-slot lineage', source);
      const d = sourceInput(mapping.ref.slice(7));
      if (!equal(d.valueType, type(mapping.type))) fail('HOST_TYPE', 'original arg nominal type differs', source);
      return d;
    };
    object(h.association, ['id', 'version', 'port', 'inputKeys', 'originalInputs', 'encoding', 'before', 'conflict'], source);
    text(h.association.id, source); text(h.association.version, source);
    if (h.association.encoding !== 'length-prefixed-utf8' || h.association.before !== 'phase-effects' || h.association.conflict !== 'reject-different-input') fail('HOST_ASSOCIATION', 'unambiguous original-input association before every phase effect required', source);
    const original = array(h.association.originalInputs, source);
    if (!equal(original, entryFields.map(d => d.ref))) fail('HOST_ASSOCIATION', 'association must retain the whole original ordered input', source);
    const keys = array(h.association.inputKeys, source);
    if (!keys.length || keys.some(r => !entryFields.some(d => equal(d.ref, r)))) fail('HOST_ASSOCIATION', 'stable keys must be retained source fields', source);
    unique(keys.map(refKey), 'HOST_ASSOCIATION', source);
    const identityInput = sourceInput(trigger.idempotency.ref.slice(7));
    if (!keys.some(r => equal(r, identityInput.ref))) fail('HOST_ASSOCIATION', 'original trigger identity must be retained as an association key', source);
    keys.forEach(r => {
      let t = declaration(r, layout, source).valueType;
      while (t.form === 'nominal') t = declaration(t.ref, layout, source).valueType;
      if (!equal(t, stringType)) fail('HOST_ASSOCIATION', 'identity keys require exact textual carriers', source);
    });
    pinRecord(h.association.port, h.entry.inputType, booleanType, source);
    const participants = array(h.participants, source);
    participants.forEach(p => object(p, ['stepId', 'participantId', 'aggregate', 'resourceInput', 'phases'], source));
    if (!equal(participants.map(p => p.stepId), s.schedule.prepare)) fail('HOST_PHASE_COVERAGE', 'every static participant step must be retained in declared order', source);
    participants.forEach(p => {
      object(p, ['stepId', 'participantId', 'aggregate', 'resourceInput', 'phases'], source);
      const rp = s.participants.find(x => x.stepId === p.stepId);
      const originalParticipant = definition.participants.find(x => x.id === p.participantId);
      if (!rp || rp.participantId !== p.participantId || !originalParticipant || originalParticipant.aggregate !== p.aggregate.id || p.aggregate.kind !== 'aggregate' || p.aggregate.context !== h.saga.ref.context) fail('HOST_PARTICIPANT', 'exact per-step participant aggregate required', source);
      declaration(p.aggregate, layout, source);
      const resource = inputFor({ kind: 'args', slot: originalParticipant.resourceRef.ref.slice(5) });
      if (!equal(resource.ref, p.resourceInput)) fail('HOST_RESOURCE', 'participant resource must retain exact original source lineage', source);
      const phases = array(p.phases, source);
      phases.forEach(pf => object(pf, ['phase', 'command', 'parameters', 'inputType', 'executePort', 'confirmation', 'query', 'evidence'], source));
      if (!equal(phases.map(p => p.phase), PHASES)) fail('HOST_PHASE_COVERAGE', 'exact prepare/commit/compensate coverage required', source);
      phases.forEach(pf => {
        object(pf, ['phase', 'command', 'parameters', 'inputType', 'executePort', 'confirmation', 'query', 'evidence'], source);
        const phase = rp.phases[pf.phase]; shortRef(phase.commandRef, pf.command, source);
        if (!equal(owner(pf.command), p.aggregate)) fail('HOST_PARTICIPANT', 'phase command must belong to this participant aggregate', source);
        const parameters = fields(pf.command, 'command', source);
        const mappings = array(pf.parameters, source);
        mappings.forEach(m => object(m, ['parameter', 'input'], source));
        if (parameters.length !== phase.inputs.length || !equal(mappings.map(m => m.parameter), parameters.map(d => d.ref))) fail('HOST_PARAMETER', 'entire ordered command signature required', source);
        mappings.forEach((m, j) => {
          object(m, ['parameter', 'input'], source);
          if (parameters[j].ref.id !== phase.inputs[j].slot || !equal(parameters[j].valueType, type(phase.inputs[j].type)) || !equal(m.input, phase.inputs[j].source)) fail('HOST_PARAMETER', 'phase input type/order/lineage differs from formal contract', source);
        });
        recordMatches(pf.inputType, parameters.map(d => ({ id: d.ref.id, valueType: d.valueType })), source);
        object(pf.confirmation, ['event', 'outputs'], source); shortRef(phase.confirmation.eventRef, pf.confirmation.event, source);
        if (!equal(owner(pf.confirmation.event), p.aggregate)) fail('HOST_CONFIRMATION', 'confirmation must belong to this participant', source);
        const slots = fields(pf.confirmation.event, 'event', source);
        const outputs = array(pf.confirmation.outputs, source);
        outputs.forEach(o => object(o, ['slot', 'output'], source));
        if (slots.length !== phase.outputs.length || !equal(outputs.map(o => o.slot), slots.map(d => d.ref))) fail('HOST_CONFIRMATION', 'entire confirmation event signature required', source);
        outputs.forEach((o, j) => {
          object(o, ['slot', 'output'], source);
          if (o.output !== phase.outputs[j].slot || slots[j].ref.id !== o.output || !equal(slots[j].valueType, type(phase.outputs[j].type))) fail('HOST_CONFIRMATION', 'confirmation output type/lineage differs from complete contract', source);
        });
        object(pf.evidence, ['kind', 'receiptType', 'identity', 'payload', 'codec', 'payloadCompatibility'], source);
        if (pf.evidence.kind !== 'typed-record' || pf.evidence.payloadCompatibility !== 'exact') fail('HOST_EVIDENCE', 'full typed identity and exact payload required; a marker is insufficient', source);
        object(pf.evidence.codec, ['contract', 'runtime'], source);
        if (!equal(pf.evidence.codec.contract, phase.contractCodec) || !equal(pf.evidence.codec.runtime, phase.runtimeCodec)) fail('HOST_CODEC', 'both contract and runtime receipt codec versions must be pinned', source);
        const identities = array(pf.evidence.identity, source), payload = array(pf.evidence.payload, source);
        identities.forEach(m => object(m, ['key', 'member'], source)); payload.forEach(m => object(m, ['output', 'member'], source));
        if (!equal(identities.map(m => m.key), IDENTITY_KEYS) || !equal(payload.map(m => m.output), phase.outputs.map(o => o.slot))) fail('HOST_EVIDENCE', 'full identity and all output payload members required', source);
        const receiptMembers = record(pf.evidence.receiptType, source);
        const mapped = [...identities.map(m => m.member), ...payload.map(m => m.member)];
        unique(mapped.map(refKey), 'HOST_EVIDENCE', source);
        if (!equal(receiptMembers.map(m => m.ref), mapped)) fail('HOST_EVIDENCE', 'every ordered receipt member requires exactly one identity/payload lineage', source);
        identities.forEach(m => {
          const expected = m.key === 'txid' ? type(definition.transactionIdType) : m.key === 'resource' ? resource.valueType : stringType;
          if (!equal(declaration(m.member, layout, source).valueType, expected)) fail('HOST_EVIDENCE', 'identity member has wrong nominal type', source);
        });
        payload.forEach((m, j) => { if (!equal(declaration(m.member, layout, source).valueType, type(phase.outputs[j].type))) fail('HOST_EVIDENCE', 'receipt output member has wrong nominal type', source); });
        pinRecord(pf.executePort, pf.inputType, pf.evidence.receiptType, source);
        object(pf.query, ['port', 'inputType', 'mode', 'identity'], source);
        if (pf.query.mode !== 'read-only' || !equal(pf.query.identity, IDENTITY_KEYS)) fail('HOST_QUERY', 'query must be read-only and compare the same entire identity as execute', source);
        recordMatches(pf.query.inputType, identities.map(m => ({ id: m.member.id, valueType: declaration(m.member, layout, source).valueType })), source);
        pinRecord(pf.query.port, pf.query.inputType, { form: 'optional', element: pf.evidence.receiptType }, source);
      });
    });
    const results = array(h.results, source);
    results.forEach(r => object(r, ['kind', 'event', 'inputType', 'inputs', 'destination', 'authorityPort', 'deliveryPort', 'associationVersion'], source));
    if (!equal(results.map(r => r.kind), RESULT_KINDS)) fail('HOST_RESULT_COVERAGE', 'all five result destinations required in contract order', source);
    results.forEach(r => {
      object(r, ['kind', 'event', 'inputType', 'inputs', 'destination', 'authorityPort', 'deliveryPort', 'associationVersion'], source);
      const completion = s.completions.find(c => c.kind === r.kind); shortRef(completion.eventRef, r.event, source);
      object(r.destination, ['aggregate', 'resourceInput'], source);
      if (!equal(owner(r.event), r.destination.aggregate)) fail('HOST_RESULT', 'result target must be its explicit declared aggregate, not the first participant', source);
      declaration(r.destination.aggregate, layout, source);
      if (!entryFields.some(d => equal(d.ref, r.destination.resourceInput))) fail('HOST_RESULT', 'early result destination must come from original durable input', source);
      if (r.associationVersion !== h.association.version) fail('HOST_ASSOCIATION', 'result must pin the before-effects association version', source);
      const eventFields = fields(r.event, 'event', source);
      const resultInputs = array(r.inputs, source);
      resultInputs.forEach(m => object(m, ['slot', 'input'], source));
      if (!equal(resultInputs.map(m => m.slot), eventFields.map(d => d.ref)) || resultInputs.length !== completion.inputs.length || resultInputs.some((m, i) => !equal(m.input, completion.inputs[i].source) || eventFields[i].ref.id !== completion.inputs[i].slot || !equal(eventFields[i].valueType, type(completion.inputs[i].type)))) fail('HOST_RESULT', 'every result slot requires its original typed completion lineage', source);
      recordMatches(r.inputType, eventFields.map(d => ({ id: d.ref.id, valueType: d.valueType })), source);
      const producer = external.producers.find(p => equal(p.event, r.event));
      if (!producer || producer.kind !== 'saga-completion' || !equal(producer.port, r.authorityPort.ref) || producer.version !== r.authorityPort.version || !equal(producer.outputType, r.inputType)) fail('HOST_RESULT', 'result event requires its exact explicit completion authority producer', source);
      declaredPort(r.authorityPort, source);
      pinRecord(r.deliveryPort, r.inputType, booleanType, source);
    });
    const technical = array(h.technicalPorts, source);
    technical.forEach(p => {
      object(p, ['role', 'port', 'implementation'], source); text(p.role, source);
      if (!['entry', 'association', 'phase-execute', 'phase-query', 'authority', 'result-delivery', 'resource-policy', 'external-submission', 'external-query', 'external-event', 'occurrence-source', 'readside'].includes(p.role)) fail('HOST_PORT', 'unsupported finite technical port role', source);
      declaredPort(p.port, source); object(p.implementation, ['id', 'version'], source); text(p.implementation.id, source); text(p.implementation.version, source);
      const contract = artifacts.artifacts.filter(a => a.status === 'selected').flatMap(a => a.ports.map(port => ({ port, implementation: a.implementations.find(i => equal(i.port, port.ref)) })));
      if (!contract.some(c => equal(c.port.ref, p.port.ref) && c.port.version === p.port.version && c.implementation?.id === p.implementation.id && c.implementation?.version === p.implementation.version)) fail('HOST_IMPLEMENTATION', 'required implementation must match a selected authored artifact obligation', source);
    });
    unique(technical.map(p => refKey(p.port.ref)), 'HOST_PORT', source);
    const referenced = [h.entry.port, h.association.port, ...participants.flatMap(p => p.phases.flatMap(p => [p.executePort, p.query.port])), ...results.flatMap(r => [r.authorityPort, r.deliveryPort])];
    if (referenced.some(pin => !technical.some(p => equal(p.port, pin)))) fail('HOST_IMPLEMENTATION', 'every used port requires a declared typed implementation obligation', source);
    return { ...h, source };
  });
  unique(rows.map(h => h.id), 'HOST_DUPLICATE', at(canonical.id, '/sagaHosts'));
  unique(rows.map(h => JSON.stringify([h.saga.ref, h.saga.version, h.entry.triggerId])), 'HOST_START_OWNER', at(canonical.id, '/sagaHosts'));
  const result = { hosts: rows };
  if (!equal(result, binding.value.hosts)) fail('PRODUCT_PAYLOAD_MISMATCH', 'host product differs from complete canonical source', at(binding.id, '/hosts'));
  return result;
}
