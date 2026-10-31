import { array, at, equal, fail, object, resolve, text, unique } from '../products/request.mjs';
import { domainDeclarations } from './dependencies.mjs';
import { canonicalType, checkFields, declaration } from './values.mjs';
import { refKey } from './references.mjs';

/** External ingress is a pinned typed port output, never a fabricated command. */
export function compileExternalEvents(binding, canonical, layout) {
  const result = deriveExternalEvents(canonical, layout, binding.schemaVersion);
  if (!equal(result, binding.value.externalEvents)) fail('PRODUCT_PAYLOAD_MISMATCH', 'entire external event product differs from its canonical source', at(binding.id, '/externalEvents'));
  return result;
}

export function deriveExternalEvents(canonical, layout, schemaVersion = 'truthsrc.domain-external-event-binding/v1') {
  if (!['truthsrc.domain-external-event-binding/v1', 'truthsrc.domain-external-event-binding/v2'].includes(schemaVersion))
    fail('PRODUCT_VERSION', 'unsupported external event binding version');
  const v2 = schemaVersion === 'truthsrc.domain-external-event-binding/v2';
  const textual = type => {
    while (type?.form === 'nominal') type = declaration(type.ref, layout).valueType;
    return equal(type, { form: 'primitive', name: 'string' });
  };
  const domain = domainDeclarations(canonical, layout);
  const producers = array(canonical.value.externalEventProducers, at(canonical.id, '/externalEventProducers')).map((p, ordinal) => {
    const source = at(canonical.id, `/externalEventProducers/${ordinal}`);
    object(p, ['id', 'version', 'kind', 'event', 'port', 'outputType', 'slotMappings', 'stableIdentityContract'], source);
    text(p.id, source); text(p.version, source);
    if (!['authority-event', 'saga-completion', 'technical-bridge'].includes(p.kind)) fail('EXTERNAL_KIND', 'external producer kind must be explicit', source);
    const event = domain.events.find(e => equal(e.ref, p.event));
    if (!event) fail('EXTERNAL_EVENT', 'external producer must name a complete declared event', source);
    const port = declaration(p.port, layout, source);
    const index = array(canonical.value.ports, at(canonical.id, '/ports')).findIndex((_, i) => equal(port.source, at(canonical.id, `/ports/${i}`)));
    if (port.ref.kind !== 'port' || port.ref.context !== event.ref.context || index < 0) fail('EXTERNAL_PORT', 'port must be a declared canonical port in the event context', source);
    const body = resolve(canonical.value, port.source.pointer, port.source);
    if (body.name !== port.ref.id || body.version !== p.version || !equal(canonicalType(body.outputType, port.ref.context, layout, port.source), p.outputType))
      fail('EXTERNAL_PORT', 'output type/version must exactly match the canonical port', source);
    const output = p.outputType.form === 'nominal' ? declaration(p.outputType.ref, layout, source) : null;
    if (output?.valueType?.form !== 'record') fail('EXTERNAL_TYPE', 'external ingress requires one explicit nominal output record', source);
    const members = output.valueType.members.map(r => declaration(r, layout, source));
    const outputBody = resolve(canonical.value, output.source.pointer, output.source);
    if (output.source.document !== canonical.id || outputBody.name !== output.ref.id || outputBody.context !== output.ref.context)
      fail('EXTERNAL_TYPE', 'nominal output record must identify its canonical definition', source);
    checkFields(outputBody.fields, members, canonical, layout, output.source.pointer + '/fields', 'member', output.ref);
    const eventSlots = checkFields(event.row.payloads,
      layout.declarations.filter(d => d.ref.kind === 'event-slot' && d.ref.context === event.ref.context && equal(d.ref.owner, [...event.ref.owner, event.ref.id])),
      canonical, layout, event.source.pointer + '/payloads', 'event-slot', event.ref);
    const mappings = array(p.slotMappings, source);
    mappings.forEach(mapping => { object(mapping, ['slot', 'member'], source); declaration(mapping.slot, layout, source); declaration(mapping.member, layout, source); });
    unique(mappings.map(m => refKey(m.slot)), 'EXTERNAL_SLOT', source);
    if (mappings.length !== eventSlots.length || mappings.some(m => !eventSlots.some(s => equal(s.ref, m.slot)))) fail('EXTERNAL_SLOT', 'every event slot needs one explicit external output member', source);
    const slots = eventSlots.map(slot => {
      const i = mappings.findIndex(m => equal(m.slot, slot.ref)), mapping = mappings[i], location = at(canonical.id, source.pointer + '/slotMappings/' + i);
      object(mapping, ['slot', 'member'], location);
      const member = members.find(m => equal(m.ref, mapping.member));
      if (!member || !equal(member.valueType, slot.valueType)) fail('EXTERNAL_TYPE', 'output member and target slot must have the exact nominal type', location);
      return { slot: slot.ref, valueType: slot.valueType, source: location, member: member.ref, dependencies: [port.ref, member.ref] };
    });
    object(p.stableIdentityContract, ['id', 'version', 'keys'], source);
    text(p.stableIdentityContract.id, source); text(p.stableIdentityContract.version, source);
    const keys = array(p.stableIdentityContract.keys, source);
    if (!keys.length || keys.some(key => !members.some(m => equal(m.ref, key) && (v2 ? textual(m.valueType) : equal(m.valueType, { form: 'primitive', name: 'string' }))) || !slots.some(s => equal(s.member, key))))
      fail('EXTERNAL_IDENTITY', 'identity keys must be explicit consumed output members', source);
    unique(keys.map(refKey), 'EXTERNAL_IDENTITY', source);
    return { id: p.id, version: p.version, kind: p.kind, event: event.ref, port: port.ref, outputType: p.outputType,
      slots, stableIdentityContract: p.stableIdentityContract, source };
  });
  unique(producers.map(p => p.id), 'EXTERNAL_DUPLICATE', at(canonical.id, '/externalEventProducers'));
  unique(producers.map(p => refKey(p.event)), 'EXTERNAL_DUPLICATE', at(canonical.id, '/externalEventProducers'));
  return { producers };
}
