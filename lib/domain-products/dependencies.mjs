import { array, at, equal, escape, fail, object, resolve, text, unique } from '../products/request.mjs';
import { refKey } from './references.mjs';
import { canonicalType, checkFields, declaration, orderedReferences, parseValue, valueReferences } from './values.mjs';

export function domainDeclarations(canonical, layout) {
  const aggregates = array(canonical.value.aggregates, at(canonical.id, '/aggregates'));
  const commands = [], events = [], states = [];
  aggregates.forEach((aggregate, ai) => {
    const pointer = `/aggregates/${ai}`, context = text(aggregate.context, at(canonical.id, pointer));
    const ref = { context, kind: 'aggregate', owner: [], id: text(aggregate.name, at(canonical.id, pointer)) };
    const d = declaration(ref, layout);
    if (!equal(d.source, at(canonical.id, pointer))) fail('DEPENDENCY_SOURCE', 'aggregate source mismatch', d.source);
    const stateRows = checkFields(aggregate.stateFields, layout.declarations.filter(x => x.ref.kind === 'state-field' && x.ref.context === context && equal(x.ref.owner, [ref.id])), canonical, layout, pointer + '/stateFields', 'state-field', ref);
    states.push({ aggregate: ref, source: d.source, rows: stateRows });
    for (const [kind, field] of [['command', 'commands'], ['event', 'events']]) {
      array(aggregate[field], at(canonical.id, pointer + '/' + field)).forEach((row, i) => {
        const r = { context, kind, owner: [ref.id], id: text(row?.name, at(canonical.id, pointer)) };
        const declarationRow = declaration(r, layout), source = at(canonical.id, `${pointer}/${field}/${i}`);
        if (!equal(declarationRow.source, source)) fail('DEPENDENCY_SOURCE', 'container source/name mismatch', source);
        (kind === 'command' ? commands : events).push({ ref: r, source, row });
      });
    }
  });
  for (const [kind, rows] of [['aggregate', states.map(x => x.aggregate)], ['command', commands.map(x => x.ref)], ['event', events.map(x => x.ref)]]) {
    const declared = layout.declarations.filter(d => d.ref.kind === kind).map(d => d.ref);
    if (rows.length !== declared.length || declared.some(r => !rows.some(x => equal(x, r)))) fail('DEPENDENCY_COVERAGE', 'every canonical aggregate/command/event must have exactly one layout declaration', at(canonical.id, '/aggregates'));
    unique(rows.map(refKey), 'DEPENDENCY_COVERAGE', at(canonical.id, '/aggregates'));
  }
  return { commands, events, states };
}
export function compileDependencies(binding, canonical, layout, decisions, exact = [], externalEvents = null) {
  const result = deriveDependencies(canonical, layout, decisions, exact, externalEvents, binding.schemaVersion);
  if (!equal(result, binding.value.dependencies)) fail('PRODUCT_PAYLOAD_MISMATCH', 'source-derived complete dependencies differ from binding', at(binding.id, '/dependencies'));
  return result;
}

export function deriveDependencies(canonical, layout, decisions, exact = [], externalEvents = null, schemaVersion = 'truthsrc.domain-dependency-binding/v1') {
  const v4 = ['truthsrc.domain-dependency-binding/v4', 'truthsrc.domain-dependency-binding/v5', 'truthsrc.domain-dependency-binding/v6'].includes(schemaVersion);
  const version = ['truthsrc.domain-dependency-binding/v2', 'truthsrc.domain-dependency-binding/v3', 'truthsrc.domain-dependency-binding/v4', 'truthsrc.domain-dependency-binding/v5', 'truthsrc.domain-dependency-binding/v6'].includes(schemaVersion) ? '2' : '1';
  const domain = domainDeclarations(canonical, layout);
  const hosts = array(Object.hasOwn(canonical.value, 'hostComputations') ? canonical.value.hostComputations : [], at(canonical.id, '/hostComputations')).map((h, i) => {
    const source = at(canonical.id, `/hostComputations/${i}`);
    object(h, ['id', 'version', 'command', 'outputType', 'inputDependencies', 'stableIdentityContract'], source);
    const port = declaration(h.id, layout, source), command = domain.commands.find(c => equal(c.ref, h.command));
    if (port.ref.kind !== 'port' || !command) fail('HOST_DESCRIPTOR', 'host requires declared port and command', source);
    text(h.version, source);
    const portBody = resolve(canonical.value, port.source.pointer, port.source);
    const portRows = array(canonical.value.ports, at(canonical.id, '/ports'));
    const portIndex = portRows.findIndex((_, n) => port.source.pointer === `/ports/${n}`);
    if (h.id.context !== command.ref.context || portIndex < 0 || port.source.document !== canonical.id || portBody.name !== h.id.id || portBody.version !== h.version || !equal(h.outputType, canonicalType(portBody.outputType, h.id.context, layout, port.source))) fail('HOST_DESCRIPTOR', 'host output type/version must match its canonical port definition in the command context', source);
    array(h.inputDependencies, source).forEach(r => {
      const d = declaration(r, layout, source);
      if (!d.valueType || r.context !== command.ref.context || !(r.kind === 'parameter' && equal(r.owner, [...command.ref.owner, command.ref.id]) || r.kind === 'state-field' && equal(r.owner, command.ref.owner))) fail('HOST_DESCRIPTOR', 'host inputs must be declared command/state values', source);
    });
    unique(h.inputDependencies.map(refKey), 'HOST_DESCRIPTOR', source);
    object(h.stableIdentityContract, ['id', 'version', 'keys'], source);
    text(h.stableIdentityContract.id, source); text(h.stableIdentityContract.version, source);
    if (!array(h.stableIdentityContract.keys, source).length || h.stableIdentityContract.keys.some(r => !h.inputDependencies.some(x => equal(x, r)))) fail('HOST_DESCRIPTOR', 'stable identity keys must be nonempty declared host inputs', source);
    unique(h.stableIdentityContract.keys.map(refKey), 'HOST_DESCRIPTOR', source);
    return { ...h, source };
  });
  unique(hosts.map(h => refKey(h.id)), 'HOST_DESCRIPTOR', at(canonical.id, '/hostComputations'));
  const events = domain.events.map(e => {
    const slots = checkFields(e.row.payloads, layout.declarations.filter(d => d.ref.kind === 'event-slot' && d.ref.context === e.ref.context && equal(d.ref.owner, [...e.ref.owner, e.ref.id])), canonical, layout, e.source.pointer + '/payloads', 'event-slot', e.ref);
    return { event: e.ref, source: e.source, declaredSlots: slots.map(d => ({ ref: d.ref, valueType: d.valueType, source: d.source })) };
  });
  const usedHosts = new Set();
  const commands = domain.commands.map(c => {
    const fields = checkFields(c.row.parameters, layout.declarations.filter(d => d.ref.kind === 'parameter' && d.ref.context === c.ref.context && equal(d.ref.owner, [...c.ref.owner, c.ref.id])), canonical, layout, c.source.pointer + '/parameters', 'parameter', c.ref);
    const declaredSignature = fields.map(d => {
      const row = resolve(canonical.value, d.source.pointer, d.source);
      if (!['BUSINESS_INPUT', 'PROPAGATED'].includes(row.origin)) fail('DEPENDENCY_ORIGIN', 'command signature requires explicit BUSINESS_INPUT or PROPAGATED; host output is not a command parameter', d.source);
      return { ref: d.ref, valueType: d.valueType, origin: row.origin, source: d.source };
    });
    const declaredEvents = array(c.row.produces, at(canonical.id, c.source.pointer + '/produces'));
    declaredEvents.forEach(e => text(e, c.source)); unique(declaredEvents, 'DEPENDENCY_EVENT', c.source);
    const override = Object.hasOwn(c.row, 'emissionBindings');
    if (override) object(c.row.emissionBindings, declaredEvents, at(canonical.id, c.source.pointer + '/emissionBindings'));
    const emissions = declaredEvents.map(name => {
      const ref = { context: c.ref.context, kind: 'event', owner: c.ref.owner, id: name }, event = domain.events.find(e => equal(e.ref, ref));
      if (!event) fail('DEPENDENCY_EVENT', 'produces must name a declared event in the same aggregate', c.source);
      const declared = events.find(e => equal(e.event, ref));
      const path = override ? c.source.pointer + '/emissionBindings/' + escape(name) : event.source.pointer + '/bindings';
      const rows = override ? c.row.emissionBindings[name] : event.row.bindings;
      if (override) object(rows, declared.declaredSlots.map(s => s.ref.id), at(canonical.id, path));
      else {
        array(rows, at(canonical.id, path)).forEach(r => object(r, ['slot', 'expr'], at(canonical.id, path)));
        unique(rows.map(r => r.slot), 'DEPENDENCY_SLOT', at(canonical.id, path));
        if (rows.length !== declared.declaredSlots.length || rows.some(r => !declared.declaredSlots.some(d => d.ref.id === r.slot))) fail('DEPENDENCY_SLOT', 'each event slot requires exactly one producer', at(canonical.id, path));
      }
      const slots = declared.declaredSlots.map(d => {
        const index = override ? -1 : rows.findIndex(r => r.slot === d.ref.id), source = at(canonical.id, override ? path + '/' + escape(d.ref.id) : path + '/' + index);
        const raw = override ? rows[d.ref.id] : rows[index].expr;
        const producer = parseValue(raw, d.valueType, c.ref, layout, hosts, version === '2' ? exact : [], source, version), dependencies = valueReferences(producer);
        dependencies.filter(r => r.kind === 'port').forEach(r => usedHosts.add(refKey(r)));
        return { slot: d.ref, valueType: d.valueType, source, producer, dependencies };
      });
      return { event: ref, source: at(canonical.id, path), slots };
    });
    const decision = decisions.commands.find(d => equal(d.command, c.ref));
    if (!decision) fail('DEPENDENCY_DECISION', 'complete decision product is required', c.source);
    const used = [...decision.decisions.flatMap(d => d.dependencies), ...emissions.flatMap(e => e.slots.flatMap(s => s.dependencies))];
    for (const r of [...used]) if (r.kind === 'port') used.push(...hosts.find(h => equal(h.id, r)).inputDependencies);
    return { command: c.ref, source: c.source, declaredSignature, usedDependencies: orderedReferences(used), events: emissions };
  });
  const unproduced = events.filter(e => !commands.some(c => c.events.some(p => equal(p.event, e.event))));
  if (v4) {
    if (!externalEvents || unproduced.some(e => !externalEvents.producers.some(p => equal(p.event, e.event))) || externalEvents.producers.some(p => !unproduced.some(e => equal(e.event, p.event))))
      fail('DEPENDENCY_EVENT_UNPRODUCED', 'every external event must have exactly one declared external producer, never a duplicate command producer', at(canonical.id, '/aggregates'));
  } else if (unproduced.length) fail('DEPENDENCY_EVENT_UNPRODUCED', 'each event requires an explicit command producer in this profile; external event producers need a separate contract', at(canonical.id, '/aggregates'));
  if (hosts.some(h => !usedHosts.has(refKey(h.id)))) fail('HOST_DESCRIPTOR_UNUSED', 'host descriptors must be consumed by an event slot', at(canonical.id, '/hostComputations'));
  return { commands, events, hosts, ...(v4 ? { externalProducers: externalEvents.producers } : {}) };
}
