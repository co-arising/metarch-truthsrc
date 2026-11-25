// Emission bridge for the flipped service-runtime family (#38).
// Replaces classic service-port, service-runtime, and service-config entries
// on play-service-dsl for manifest contexts. Fail-closed (SR_EMISSION).
import { deriveServiceRuntime } from './service-runtime.mjs';
import { family, renderServiceRuntimeFiles } from '../../emitter/families/service-runtime.mjs';
import { serviceSelection } from '../../generators/scala-cqrs-play-service/render-service.mjs';
import { isUnifiedContext } from './emission-policy.mjs';

const fail = message => { throw new Error('SR_EMISSION: ' + message); };

export const isServiceRuntimeFlipped = (context, options) => isUnifiedContext(context, options);

const REPLACED_KINDS = new Set(['service-port', 'service-runtime', 'service-config']);

export function withFlippedServiceRuntime(produce, context) {
  const classic = produce(context);
  const artifact = serviceSelection(context.products, context.options);
  if (!isServiceRuntimeFlipped(artifact.artifact.context, context.options)) return classic;

  const kept = [];
  const removed = [];
  for (const entry of classic) {
    if (REPLACED_KINDS.has(entry.kind)) {
      removed.push(entry);
      continue;
    }
    kept.push(entry);
  }
  if (!removed.length) fail('play-service-dsl carried no service-runtime entries');

  const footprint = removed[0].productFootprint.map(p => ({ ...p }));
  const contract = deriveServiceRuntime(context.products, context.options);
  family.checkInput(JSON.parse(JSON.stringify(contract)));
  const rendered = renderServiceRuntimeFiles(JSON.parse(JSON.stringify(contract)));
  const additions = rendered.map(file => ({
    path: file.path,
    content: file.content,
    kind: file.kind,
    deps: [...file.deps],
    knowledgeIds: [...new Set(file.sources.map(s => 'source:' + s.document + '#' + s.pointer))],
    productFootprint: footprint.map(p => ({ ...p })),
    ...(file.codeMappings.length ? { codeMappings: file.codeMappings.map(m => ({ ...m })) } : {}),
    merge: null,
  }));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('collision with classic path: ' + added.path);
    paths.add(added.path);
  }
  return [...additions, ...kept];
}
