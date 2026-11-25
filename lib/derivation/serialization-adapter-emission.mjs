// Emission bridge for the flipped serialization-adapter family (#31).
// Replaces classic DomainProtoSerializer*.scala (including Part0..N) and
// <Agg>Adapters.scala on converter-dsl for manifest contexts with the unified
// emitter's data-driven ClassTag registry render. Fail-closed (SA_EMISSION).
import { deriveSerializationAdapters } from './serialization-adapter.mjs';
import { family, renderSerializationAdapterFiles } from '../../emitter/families/serialization-adapter.mjs';
import { isUnifiedContext } from './emission-policy.mjs';

const fail = message => { throw new Error('SA_EMISSION: ' + message); };

export const isSerializationAdapterFlipped = (context, options) => isUnifiedContext(context, options);

export function withFlippedSerializationAdapters(produce, context) {
  const classic = produce(context);
  const contexts = context.products?.['reference-layout']?.contexts ?? [];
  const flippedContexts = contexts.filter(c => isSerializationAdapterFlipped(c, context.options));
  if (!flippedContexts.length) return classic;

  const packageRoots = new Map((context.options?.packages ?? []).map(p => [p.context, p.package.replaceAll('.', '/')]));
  const flipPrefixes = flippedContexts.map(ctx => {
    const root = packageRoots.get(ctx);
    if (!root) fail('missing package binding for flip context ' + ctx);
    return 'app/' + root + '/infrastructure/serialization/';
  });

  const kept = [];
  const removed = [];
  for (const entry of classic) {
    if (entry.kind === 'serialization-adapter' && flipPrefixes.some(pre => entry.path.startsWith(pre))) {
      removed.push(entry);
      continue;
    }
    kept.push(entry);
  }
  if (!removed.length) fail('classic converter-dsl plan carried no serialization-adapter entries for flip contexts');

  const footprint = removed[0].productFootprint.map(p => ({ ...p }));
  const fullContract = deriveSerializationAdapters(context.products, context.options);
  const serializers = fullContract.serializers.filter(s => isSerializationAdapterFlipped(s.context, context.options));
  const adapters = fullContract.adapters.filter(a => isSerializationAdapterFlipped(a.context, context.options));
  const reachable = new Set([...serializers.map(s => s.context), ...adapters.map(a => a.context)]);
  const manifest = {
    ...fullContract,
    packages: fullContract.packages.filter(p => reachable.has(p.context)),
    serializers,
    adapters,
  };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  const rendered = renderSerializationAdapterFiles(JSON.parse(JSON.stringify(manifest)));
  const additions = rendered.map(file => ({
    path: file.path,
    content: file.content,
    kind: file.kind,
    deps: [...file.deps],
    knowledgeIds: [...new Set(file.sources.map(s => 'source:' + s.document + '#' + s.pointer))],
    productFootprint: footprint.map(p => ({ ...p })),
    merge: null,
  }));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('collision with classic path: ' + added.path);
    paths.add(added.path);
  }
  return [...additions, ...kept];
}
