import { array, at, equal, fail, object, resolve, text, unique } from './request.mjs';
import { canonicalType, checkFields, declaration } from '../domain-products/values.mjs';
import { refKey } from '../domain-products/references.mjs';

const keys = ['id', 'version', 'pipeline', 'stepId', 'port', 'requestType', 'resultType', 'operationType', 'observationType', 'reconcileType', 'identity', 'outcomes', 'technicalPorts', 'provenance'];
const stringType = Object.freeze({ form: 'primitive', name: 'string' });
const boolType = Object.freeze({ form: 'primitive', name: 'boolean' });

/** Complete authored effect obligations. No status label grants evidence, authority or installed readiness. */
export function deriveEffectHosts(canonical, layout, execution, artifacts) {
  const record = (type, expected, source) => {
    object(type, ['form', 'ref'], source);
    if (type.form !== 'nominal') fail('EFFECT_TYPE', 'explicit nominal record required', source);
    const d = declaration(type.ref, layout, source), body = resolve(canonical.value, d.source.pointer, d.source);
    if (type.ref.kind !== 'type' || d.valueType?.form !== 'record' || d.source.document !== canonical.id || body.name !== type.ref.id || body.context !== type.ref.context) fail('EFFECT_TYPE', 'complete canonical nominal record required', source);
    const members = d.valueType.members.map(r => declaration(r, layout, source));
    const actual = checkFields(body.fields, members, canonical, layout, d.source.pointer + '/fields', 'member', type.ref);
    const signature = values => values.map(m => ({ id: m.ref.id, type: m.valueType }));
    const required = expected.map(([id, type]) => ({ id, type }));
    if (!equal(signature(actual), required) || !equal(signature(members), required)) fail('EFFECT_TYPE', 'whole ordered nominal record signature required', source);
  };
  const pin = (p, source) => { object(p, ['ref', 'version'], source); text(p.version, source); return declaration(p.ref, layout, source); };
  const port = (p, source) => {
    const d = pin(p, source);
    if (p.ref.kind !== 'port' || d.source.document !== canonical.id || !/^\/ports\/(0|[1-9][0-9]*)$/u.test(d.source.pointer)) fail('EFFECT_PORT', 'explicit canonical technical port required', source);
    const body = resolve(canonical.value, d.source.pointer, d.source);
    if (body.name !== p.ref.id || body.version !== p.version) fail('EFFECT_PORT', 'exact technical port identity/version required', source);
    const type = raw => typeof raw === 'string' ? canonicalType(raw, p.ref.context, layout, source) : raw;
    return [type(body.inputType), type(body.outputType)];
  };
  const textual = (t, source) => t.form === 'nominal' ? textual(declaration(t.ref, layout, source).valueType, source) : equal(t, stringType);
  const hosts = array(canonical.value.effectHosts, at(canonical.id, '/effectHosts')).map((h, i) => {
    const source = at(canonical.id, '/effectHosts/' + i);
    object(h, keys, source); text(h.id, source); text(h.version, source); text(h.stepId, source); text(h.port, source);
    const d = pin(h.pipeline, source), p = execution.pipelines.find(p => p.id === h.pipeline.ref.id);
    const body = resolve(canonical.value, d.source.pointer, d.source), context = h.pipeline.ref.context;
    for (const type of [h.requestType, h.resultType, h.operationType, h.observationType, h.reconcileType]) if (type?.form !== 'nominal' || type.ref?.context !== context) fail('EFFECT_TYPE', 'all nominal effect signatures require exact pipeline context', source);
    if (!p || h.pipeline.ref.kind !== 'pipeline' || d.source.document !== canonical.id || body.id !== p.id || !/^\/pipelines\/(0|[1-9][0-9]*)$/u.test(d.source.pointer)) fail('EFFECT_PIPELINE', 'full exact qualified canonical execution pipeline required', source);
    if (h.pipeline.version !== p.recovery.planVersion || h.pipeline.version !== p.binding.codec.version) fail('EFFECT_VERSION', 'exact pipeline plan and codec version required', source);
    if (p.admission.maxConcurrentRuns !== 1 || p.admission.maxInFlightSteps !== 1 || p.admission.maxInFlightChunks !== 1) fail('EFFECT_FINITE', 'finite single-run/step/chunk ownership required', source);
    const step = p.steps.find(s => s.id === h.stepId), effect = p.binding.ports.find(p => p.id === h.port);
    if (!step || step.port !== h.port) fail('EFFECT_STEP', 'effect host cannot replace a pure, Saga or child operation', source);
    if (!effect || effect.effect !== 'external' || effect.confirmation !== 'durable-ack' || effect.idempotency.mode !== 'keyed') fail('EFFECT_PORT', 'full external durable-ack keyed contract required', source);
    record(h.requestType, step.reads.map(r => [r.slot, canonicalType(r.type, context, layout, source)]), source);
    record(h.resultType, effect.outputs.map(o => [o.slot, canonicalType(o.type, context, layout, source)]), source);
    record(h.operationType, [['operation', stringType], ['request', h.requestType]], source);
    record(h.observationType, [['operation', stringType], ['request', h.requestType], ['status', stringType], ['evidence', stringType], ['result', { form: 'optional', element: h.resultType }]], source);
    record(h.reconcileType, [['operation', stringType], ['request', h.requestType], ['decision', stringType], ['evidence', { form: 'optional', element: h.observationType }], ['authorization', stringType]], source);
    object(h.identity, ['input', 'slot', 'valueType', 'encoding'], source);
    const read = step.reads.find(r => r.slot === h.identity.slot), initial = p.inputs.find(r => r.id === h.identity.input);
    if (!read || !initial || effect.idempotency.key !== h.identity.slot || read.ref !== 'input:' + h.identity.input || read.type !== initial.type || !equal(canonicalType(initial.type, context, layout, source), h.identity.valueType) || !textual(h.identity.valueType, source) || h.identity.encoding !== 'length-prefixed-utf8') fail('EFFECT_IDENTITY', 'same complete textual initial key required; no attempts, clocks or predecessor output', source);
    const statuses = [['confirmed', 'success'], ['rejected', 'business-rejection'], ['failed', 'infrastructure-failure'], ['unknown', 'unknown-effect']];
    array(h.outcomes, source).forEach(o => { object(o, ['status', 'code', 'kind'], source); text(o.code, source); });
    if (!equal(h.outcomes.map(o => [o.status, o.kind]), statuses) || h.outcomes.length !== effect.outcomes.length || h.outcomes.length !== step.outcomes.length || h.outcomes.some(o => !effect.outcomes.some(e => e.code === o.code && e.kind === o.kind) || !step.outcomes.some(e => e.code === o.code && e.kind === o.kind))) fail('EFFECT_OUTCOME', 'four closed observation statuses require exact declared port and step outcomes', source);
    unique(h.outcomes.map(o => o.code), 'EFFECT_OUTCOME', source);
    const shapes = [[h.operationType, h.observationType], [h.operationType, { form: 'optional', element: h.observationType }], [h.reconcileType, boolType]];
    const technical = array(h.technicalPorts, source);
    if (!equal(technical.map(t => t.role), ['execute', 'query', 'reconcile'])) fail('EFFECT_IMPLEMENTATION', 'three ordered execute/query/reconcile objects required', source);
    technical.forEach((t, i) => {
      object(t, ['role', 'port', 'implementation', 'owner'], source); object(t.implementation, ['id', 'version'], source); text(t.implementation.id, source); text(t.implementation.version, source); pin(t.owner, source);
      if (t.port.ref.context !== context || !equal(port(t.port, source), shapes[i])) fail('EFFECT_PORT', 'entire nominal technical operation signature required', source);
      const owners = artifacts.artifacts.filter(a => a.status === 'selected' && a.ports.some(p => equal(p.ref, t.port.ref) && p.version === t.port.version) && a.implementations.some(p => equal(p.port, t.port.ref) && p.id === t.implementation.id && p.version === t.implementation.version));
      if (owners.length !== 1 || t.owner.ref.kind !== 'artifact' || !equal(owners[0].artifact, t.owner.ref) || owners[0].version !== t.owner.version) fail('EFFECT_IMPLEMENTATION', 'one exact explicit selected authored owner required, not an installed certificate', source);
    });
    unique(technical.map(t => refKey(t.port.ref)), 'EFFECT_IMPLEMENTATION', source);
    const provenance = array(h.provenance, source);
    if (!provenance.length) fail('EFFECT_SOURCE', 'authored provenance required', source);
    for (const p of provenance) { object(p, ['document', 'pointer'], source); if (p.document !== canonical.id) fail('EFFECT_SOURCE', 'provenance must belong to exact canonical document', source); resolve(canonical.value, p.pointer, p); }
    unique(provenance.map(p => JSON.stringify(p)), 'EFFECT_SOURCE', source);
    return { ...h, source };
  });
  const external = execution.pipelines.flatMap(p => p.steps.filter(s => s.port && p.binding.ports.find(port => port.id === s.port)?.effect === 'external').map(s => [p.id, s.id]));
  if (!equal(hosts.map(h => [h.pipeline.ref.id, h.stepId]).sort(), external.sort())) fail('EFFECT_COVERAGE', 'every external step requires exactly one complete effect host; no hidden or unused obligations', at(canonical.id, '/effectHosts'));
  unique(hosts.map(h => h.id), 'EFFECT_COVERAGE', at(canonical.id, '/effectHosts'));
  return { hosts };
}
export function compileEffectHosts(binding, canonical, layout, execution, artifacts) {
  const expected = deriveEffectHosts(canonical, layout, execution, artifacts);
  if (!equal(expected, binding.value.effects)) fail('PRODUCT_PAYLOAD_MISMATCH', 'effect hosts differ from whole canonical reconstruction', at(binding.id, '/effects'));
  return expected;
}
