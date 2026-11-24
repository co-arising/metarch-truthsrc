// Knowledge → contract derivation for the protocol-layer family
// (emitter-unification plan F2, rulings 2026-11-23 §19). Turns the reference
// layout's aggregate declarations, domain-dependencies commands/events/hosts/
// externalProducers, exact-value-types and explicit context package bindings
// into the truthsrc.protocol-layer-input/v1 contract. Pure and fail-closed
// (D-P08 discipline): anything the contract cannot express refuses with a
// PL_DERIVATION diagnostic instead of emitting.
const fail = message => { throw new Error('PL_DERIVATION: ' + message); };

const SCHEMA = 'truthsrc.protocol-layer-input/v1';
const PRIMITIVE_FORMS = new Set(['string', 'integer', 'boolean', 'decimal']);

const key = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);

const requireArray = (value, what) => {
  if (!Array.isArray(value)) fail(what + ' must be an array');
  return value;
};

function checkSource(source, what) {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    fail(what + ' must carry a {document, pointer} knowledge source');
  return { document: source.document, pointer: source.pointer };
}

function typeTree(type, what) {
  if (!type || typeof type !== 'object') fail(what + ' must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVE_FORMS.has(type.name)) fail(what + ' unsupported primitive type name: ' + JSON.stringify(type.name));
    return { form: 'primitive', name: type.name };
  }
  if (type.form === 'nominal') {
    if (!type.ref || typeof type.ref !== 'object') fail(what + ' nominal type must carry a ref');
    return { form: 'nominal', context: type.ref.context, name: type.ref.id };
  }
  if (type.form === 'optional') return { form: 'optional', element: typeTree(type.element, what + '.element') };
  if (type.form === 'sequence') return { form: 'sequence', element: typeTree(type.element, what + '.element') };
  if (type.form === 'map') return { form: 'map', key: typeTree(type.key, what + '.key'), value: typeTree(type.value, what + '.value') };
  fail(what + ' unsupported type form: ' + JSON.stringify(type.form));
}

function lookupDeclaration(layout, ref, what) {
  const row = layout.find(d => d?.ref && key(d.ref) === key(ref));
  if (!row) fail(what + ' target reference has no admitted declaration');
  return row;
}

function deriveExpr(node, layout, what) {
  if (!node || typeof node !== 'object') fail(what + ' must be an expression node');
  if (node.op === 'ref') {
    const kind = node.ref?.kind;
    const scope = kind === 'state-field' ? 'state-field' : kind === 'event-slot' ? 'event-slot' : 'parameter';
    if (typeof node.ref?.id !== 'string' || !node.ref.id) fail(what + ' ref must carry id');
    return { op: 'ref', scope, name: node.ref.id };
  }
  if (node.op === 'literal') {
    return { op: 'literal', valueType: typeTree(node.valueType, what + '.valueType'), value: node.value };
  }
  if (node.op === 'host') {
    if (typeof node.id?.id !== 'string' || !node.id.id) fail(what + ' host must carry id.id');
    return { op: 'host', name: node.id.id };
  }
  if (node.op === 'member') {
    if (typeof node.member?.id !== 'string' || !node.member.id) fail(what + ' member must carry member.id');
    return { op: 'member', argument: deriveExpr(node.argument, layout, what + '.argument'), member: node.member.id };
  }
  if (node.op === 'map-get') {
    return { op: 'map-get', map: deriveExpr(node.map, layout, what + '.map'), key: deriveExpr(node.key, layout, what + '.key') };
  }
  if (node.op === 'add' || node.op === 'subtract') {
    const operandType = n => {
      if (n.op === 'literal') return n.valueType;
      if (n.op === 'ref') return lookupDeclaration(layout, n.ref, what).valueType;
      if (n.op === 'member') return lookupDeclaration(layout, n.member, what).valueType;
      return operandType(n.left);
    };
    const t = operandType(node);
    const arithmetic = t?.form === 'primitive' ? 'primitive' : 'nominal';
    return { op: node.op, arithmetic, left: deriveExpr(node.left, layout, what + '.left'), right: deriveExpr(node.right, layout, what + '.right') };
  }
  fail(what + ' unsupported value expression op: ' + JSON.stringify(node.op));
}

export function deriveProtocolLayers(products, options) {
  const layout = requireArray(products['reference-layout']?.declarations, 'reference-layout declarations');
  const dependencies = products['domain-dependencies'];
  if (!dependencies || typeof dependencies !== 'object') fail('domain-dependencies product required');
  const allCommands = requireArray(dependencies.commands, 'domain-dependencies commands');
  const allEvents = requireArray(dependencies.events, 'domain-dependencies events');
  const allHosts = requireArray(dependencies.hosts, 'domain-dependencies hosts');
  const allExternal = requireArray(dependencies.externalProducers, 'domain-dependencies externalProducers');
  const packages = requireArray(options?.packages, 'explicit context package bindings');

  const boundContexts = new Set();
  for (const p of packages) {
    if (!p || typeof p !== 'object' || typeof p.context !== 'string' || !p.context || typeof p.package !== 'string' || !p.package)
      fail('each package binding must carry nonempty context and package');
    if (boundContexts.has(p.context)) fail('duplicate package binding for context ' + p.context);
    boundContexts.add(p.context);
  }

  const aggregateDecls = layout.filter(d => d?.ref?.kind === 'aggregate');
  if (aggregateDecls.length === 0) fail('no aggregate declarations in reference-layout');

  const aggregates = [];
  const seenAggs = new Set();
  for (const declaration of aggregateDecls) {
    const ref = declaration.ref;
    if (!boundContexts.has(ref.context)) fail('context ' + ref.context + ' has no package binding');
    const aggKey = ref.context + '/' + ref.id;
    if (seenAggs.has(aggKey)) fail('duplicate aggregate declaration ' + aggKey);
    seenAggs.add(aggKey);

    const owns = target => target?.context === ref.context && Array.isArray(target.owner) && target.owner[0] === ref.id;

    const rawCommands = allCommands.filter(c => owns(c?.command));
    if (rawCommands.length === 0) fail('aggregate ' + aggKey + ' has no commands in domain-dependencies');

    const commands = rawCommands.map(c => {
      const cname = c.command.id;
      const parameters = requireArray(c.declaredSignature, 'command ' + cname + ' declaredSignature').map(r => ({
        name: (r.ref ?? r.target).id,
        valueType: typeTree(r.valueType, 'command ' + cname + ' param ' + (r.ref ?? r.target).id),
      }));
      const events = requireArray(c.events, 'command ' + cname + ' events').map(e => ({
        name: e.event.id,
        slots: requireArray(e.slots, 'command ' + cname + ' event ' + e.event.id + ' slots').map((s, idx) => ({
          producer: deriveExpr(s.producer, layout, 'command ' + cname + ' event ' + e.event.id + ' slot[' + idx + ']'),
        })),
      }));
      return {
        name: cname,
        source: checkSource(c.source, 'command ' + ref.id + '.' + cname),
        parameters,
        events,
      };
    });

    const rawEvents = allEvents.filter(e => owns(e?.event));
    if (rawEvents.length === 0) fail('aggregate ' + aggKey + ' has no events in domain-dependencies');
    const events = rawEvents.map(e => {
      const ename = e.event.id;
      const slots = requireArray(e.declaredSlots, 'event ' + ename + ' declaredSlots').map(r => ({
        name: (r.ref ?? r.target).id,
        valueType: typeTree(r.valueType, 'event ' + ename + ' slot ' + (r.ref ?? r.target).id),
      }));
      return {
        name: ename,
        source: checkSource(e.source, 'event ' + ref.id + '.' + ename),
        slots,
      };
    });

    const commandKeys = new Set(rawCommands.map(c => key(c.command)));
    const hosts = allHosts
      .filter(h => h?.command && commandKeys.has(key(h.command)))
      .map(h => ({
        name: h.id.id,
        command: h.command.id,
        outputType: typeTree(h.outputType, 'host ' + h.id.id + ' outputType'),
        source: checkSource(h.source, 'host ' + h.id.id),
      }));

    const externalProducers = allExternal
      .filter(p => owns(p?.event))
      .map(p => ({ id: p.id }));

    aggregates.push({
      context: ref.context,
      name: ref.id,
      source: checkSource(declaration.source, 'aggregate ' + aggKey),
      commands,
      events,
      hosts,
      externalProducers,
    });
  }

  return {
    schemaVersion: SCHEMA,
    packages: packages.map(p => ({ context: p.context, package: p.package })),
    aggregates,
  };
}
