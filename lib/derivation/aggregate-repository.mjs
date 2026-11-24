// Knowledge → contract derivation for the aggregate-repository family
// (emitter-unification plan F2, rulings 2026-11-23 §20). Derives the
// truthsrc.aggregate-repository-input/v1 contract from reference-layout
// aggregate declarations and explicit context package bindings. Pure and
// fail-closed (AR_DERIVATION).
const fail = message => { throw new Error('AR_DERIVATION: ' + message); };

const SCHEMA = 'truthsrc.aggregate-repository-input/v1';
const DEFAULT_LOOKUP = 'owned-local-actor-cache';

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

export function deriveAggregateRepositories(products, options) {
  const layout = requireArray(products?.['reference-layout']?.declarations, 'reference-layout declarations');
  const packages = requireArray(options?.packages, 'explicit context package bindings');
  const boundContexts = new Set(packages.map(p => p.context));

  const repositories = [];
  const seen = new Set();
  for (const declaration of layout) {
    const ref = declaration?.ref;
    if (!ref || ref.kind !== 'aggregate') continue;
    if (!boundContexts.has(ref.context)) fail('context ' + ref.context + ' has no package binding');
    const seenKey = ref.context + '/' + ref.id;
    if (seen.has(seenKey)) fail('duplicate aggregate declaration ' + seenKey);
    seen.add(seenKey);
    repositories.push({
      context: ref.context,
      name: ref.id,
      lookup: DEFAULT_LOOKUP,
      source: checkSource(declaration.source, seenKey),
    });
  }
  if (!repositories.length) fail('no aggregate declarations in the reference layout');

  return {
    schemaVersion: SCHEMA,
    packages: packages.map(p => ({ context: p.context, package: p.package })),
    repositories,
  };
}
