// Emission bridge for the flipped proto-converter family (#30).
// Replaces classic DomainConverters*.scala on converter-dsl for manifest
// contexts with the unified emitter's curated short-import / shared-helper
// render. Fail-closed (PC_EMISSION).
import { deriveProtoConverters } from './proto-converter.mjs';
import { family, renderProtoConverterFiles } from '../../emitter/families/proto-converter.mjs';

const fail = message => { throw new Error('PC_EMISSION: ' + message); };

export const PROTO_CONVERTER_FLIP_CONTEXTS = Object.freeze(['bankwealth']);

export const isProtoConverterFlipped = context => PROTO_CONVERTER_FLIP_CONTEXTS.includes(context);

export function withFlippedProtoConverters(produce, context) {
  const classic = produce(context);
  const contexts = context.products?.['reference-layout']?.contexts ?? [];
  const flippedContexts = contexts.filter(isProtoConverterFlipped);
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
    if (entry.kind === 'converter' && flipPrefixes.some(pre => entry.path.startsWith(pre))) {
      removed.push(entry);
      continue;
    }
    kept.push(entry);
  }
  if (!removed.length) fail('classic converter-dsl plan carried no converter entries for flip contexts');

  const footprint = removed[0].productFootprint.map(p => ({ ...p }));
  const fullContract = deriveProtoConverters(context.products, context.options);
  const flippedList = fullContract.contexts.filter(c => isProtoConverterFlipped(c.context));
  const reachable = new Set(flippedList.map(c => c.context));
  const manifest = {
    ...fullContract,
    packages: fullContract.packages.filter(p => reachable.has(p.context)),
    contexts: flippedList,
  };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  const rendered = renderProtoConverterFiles(JSON.parse(JSON.stringify(manifest)));
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
