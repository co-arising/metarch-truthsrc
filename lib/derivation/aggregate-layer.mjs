// Knowledge → contract derivation for the aggregate-layer family
// (emitter-unification plan F2, rulings 2026-11-23 §18). Turns the reference
// layout's aggregate and command declarations, domain-dependencies external
// producers and explicit context package bindings into the
// truthsrc.aggregate-layer-input/v1 contract. Pure and fail-closed (D-P08
// discipline): anything the contract cannot express refuses with an
// AL_DERIVATION diagnostic instead of emitting.
const fail = message => { throw new Error('AL_DERIVATION: ' + message); };

const SCHEMA = 'truthsrc.aggregate-layer-input/v1';
const PRIMITIVE_FORMS = new Set(['string', 'integer', 'boolean', 'decimal']);

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

/** Transcribe a knowledge-side valueType tree into the contract's type tree. */
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

/**
 * Derive the aggregate-layer contract. Pure over {products, options}: reads
 * reference-layout aggregate/command declarations, domain-dependencies
 * externalProducers and explicit context package bindings.
 */
export function deriveAggregateLayers(products, options) {
  const layout = requireArray(products['reference-layout']?.declarations, 'reference-layout declarations');
  const externalProducers = requireArray(products['domain-dependencies']?.externalProducers, 'domain-dependencies externalProducers');
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

    const commands = layout
      .filter(d => d?.ref?.kind === 'command' && owns(d.ref))
      .map(d => ({ name: d.ref.id, source: checkSource(d.source, 'command ' + ref.id + '.' + d.ref.id) }));
    if (commands.length === 0) fail('aggregate ' + aggKey + ' has no command declarations');

    const producers = externalProducers
      .filter(p => owns(p?.event))
      .map(p => {
        if (typeof p.id !== 'string' || !p.id) fail('external producer for ' + aggKey + ' must carry nonempty id');
        return {
          id: p.id,
          outputType: typeTree(p.outputType, 'external producer ' + p.id + ' outputType'),
          source: checkSource(p.source, 'external producer ' + p.id),
        };
      });

    aggregates.push({
      context: ref.context,
      name: ref.id,
      source: checkSource(declaration.source, 'aggregate ' + aggKey),
      commands,
      externalProducers: producers,
    });
  }

  const reachable = new Set(aggregates.map(a => a.context));
  const scanType = type => {
    if (type.form === 'nominal') reachable.add(type.context);
    if (type.form === 'optional' || type.form === 'sequence') scanType(type.element);
    if (type.form === 'map') { scanType(type.key); scanType(type.value); }
  };
  for (const agg of aggregates) {
    for (const p of agg.externalProducers) scanType(p.outputType);
  }
  for (const ctx of reachable) {
    if (!boundContexts.has(ctx)) fail('referenced context ' + ctx + ' has no package binding');
  }

  return {
    schemaVersion: SCHEMA,
    packages: packages.filter(p => reachable.has(p.context)).map(p => ({ context: p.context, package: p.package })),
    aggregates,
  };
}
