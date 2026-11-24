// Derivation layer for the external-event-bridge family (#46)
// (emitter-unification plan F2; ruling §22, 2026-11-24).
// Pure, fail-closed translation from compiled knowledge products
// (`reference-layout` + `domain-dependencies`) and project package options to
// the `truthsrc.external-event-bridge-input/v1` contract.

const fail = message => {
  const error = new Error('EEB_DERIVATION: ' + message);
  error.code = 'EEB_DERIVATION';
  throw error;
};

const refKey = ref => {
  if (!ref || typeof ref !== 'object') fail('invalid reference');
  const owner = Array.isArray(ref.owner) ? ref.owner.join('/') : '';
  return `${ref.context}:${ref.kind}:${owner}:${ref.id}`;
};

const ownerOf = (ref, aggregate) =>
  ref?.context === aggregate.context && Array.isArray(ref.owner) && ref.owner[0] === aggregate.id;

function normalizeType(type, what) {
  if (!type || typeof type !== 'object') fail(what + ' missing type');
  if (type.form === 'primitive') return { form: 'primitive', name: type.name };
  if (type.form === 'nominal') {
    if (!type.ref?.context || !type.ref?.id) fail(what + ' nominal type missing ref');
    return { form: 'nominal', context: type.ref.context, name: type.ref.id };
  }
  if (type.form === 'optional' || type.form === 'sequence') {
    return { form: type.form, element: normalizeType(type.element, what + '.element') };
  }
  if (type.form === 'map') {
    return {
      form: 'map',
      key: normalizeType(type.key, what + '.key'),
      value: normalizeType(type.value, what + '.value'),
    };
  }
  fail(what + ' unsupported type form: ' + JSON.stringify(type.form));
}

function unwrapDepthFor(type, declByKey, seen = new Set()) {
  if (!type || typeof type !== 'object') fail('identity key type missing');
  if (type.form !== 'nominal') return 0;
  const k = refKey(type.ref);
  if (seen.has(k)) fail('cyclic nominal type in identity key: ' + k);
  seen.add(k);
  const decl = declByKey.get(k);
  if (!decl) fail('missing layout declaration for nominal identity key type: ' + k);
  return 1 + unwrapDepthFor(decl.valueType, declByKey, seen);
}

export function deriveExternalEventBridges(products, options) {
  const layout = products?.['reference-layout'];
  const deps = products?.['domain-dependencies'];
  if (!Array.isArray(layout?.declarations)) fail('reference-layout.declarations required');
  if (!Array.isArray(deps?.externalProducers)) fail('domain-dependencies.externalProducers required');
  if (!Array.isArray(options?.packages) || options.packages.length === 0)
    fail('options.packages required');

  const declByKey = new Map(layout.declarations.map(d => [refKey(d.ref), d]));
  const aggregates = layout.declarations.filter(d => d.ref?.kind === 'aggregate');
  const bridges = [];

  for (const agg of aggregates) {
    const producers = deps.externalProducers.filter(p => ownerOf(p.event, agg.ref));
    if (producers.length === 0) continue;

    bridges.push({
      context: agg.ref.context,
      aggregate: agg.ref.id,
      producers: producers.map((p, idx) => {
        if (!p.id || !p.event?.id) fail(`externalProducer[${idx}] missing id or event`);
        if (!Array.isArray(p.slots)) fail(`externalProducer ${p.id} missing slots`);
        if (!Array.isArray(p.stableIdentityContract?.keys) || p.stableIdentityContract.keys.length === 0)
          fail(`externalProducer ${p.id} missing stableIdentityContract.keys`);
        if (!p.source?.document || !p.source?.pointer) fail(`externalProducer ${p.id} missing source`);

        const identityKeys = p.stableIdentityContract.keys.map(keyRef => {
          const decl = declByKey.get(refKey(keyRef));
          if (!decl) fail(`externalProducer ${p.id} missing layout declaration for identity key ${refKey(keyRef)}`);
          return {
            member: keyRef.id,
            unwrapDepth: unwrapDepthFor(decl.valueType, declByKey),
          };
        });

        return {
          id: p.id,
          event: p.event.id,
          outputType: normalizeType(p.outputType, `externalProducer ${p.id}.outputType`),
          slotMembers: p.slots.map(s => {
            if (!s?.member?.id) fail(`externalProducer ${p.id} slot missing member.id`);
            return s.member.id;
          }),
          identityKeys,
          source: { document: p.source.document, pointer: p.source.pointer },
        };
      }),
    });
  }

  return {
    schemaVersion: 'truthsrc.external-event-bridge-input/v1',
    packages: options.packages.map(p => ({ context: p.context, package: p.package })),
    bridges,
  };
}
