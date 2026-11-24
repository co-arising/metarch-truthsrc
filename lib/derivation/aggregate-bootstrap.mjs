// Knowledge → contract derivation for the aggregate-bootstrap family (#47).
// Derives truthsrc.aggregate-bootstrap-input/v1 from reference-layout
// aggregate declarations, domain-dependencies externalProducers, and context
// package bindings. Pure and fail-closed (AB_DERIVATION).
const fail = message => { throw new Error('AB_DERIVATION: ' + message); };

const SCHEMA = 'truthsrc.aggregate-bootstrap-input/v1';

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

export function deriveAggregateBootstraps(products, options) {
  const layout = requireArray(products?.['reference-layout']?.declarations, 'reference-layout declarations');
  const externalProducers = requireArray(products?.['domain-dependencies']?.externalProducers ?? [], 'domain-dependencies externalProducers');
  const packages = requireArray(options?.packages, 'explicit context package bindings');
  const boundContexts = new Set(packages.map(p => p.context));

  const bootstraps = [];
  const seen = new Set();
  for (const declaration of layout) {
    const ref = declaration?.ref;
    if (!ref || ref.kind !== 'aggregate') continue;
    if (!boundContexts.has(ref.context)) fail('context ' + ref.context + ' has no package binding');
    const seenKey = ref.context + '/' + ref.id;
    if (seen.has(seenKey)) fail('duplicate aggregate declaration ' + seenKey);
    seen.add(seenKey);
    const hasAuthority = externalProducers.some(p => p.event?.context === ref.context && p.event?.owner?.[0] === ref.id);
    bootstraps.push({
      context: ref.context,
      name: ref.id,
      persistenceIdentity: 'unique-id',
      authority: hasAuthority,
      source: checkSource(declaration.source, seenKey),
    });
  }
  if (!bootstraps.length) fail('no aggregate declarations in the reference layout');

  return {
    schemaVersion: SCHEMA,
    packages: packages.map(p => ({ context: p.context, package: p.package })),
    bootstraps,
  };
}
