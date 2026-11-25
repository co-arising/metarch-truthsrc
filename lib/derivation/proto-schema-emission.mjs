// Emission bridge for the flipped proto-schema family (#29).
// Replaces classic .proto entries on proto-dsl (monolithic domain proto ->
// shared_value_objects.proto + per-aggregate <agg>.proto), finite-execution-dsl,
// finite-host-dsl, and durable-effect-host-dsl for manifest contexts.
// Fail-closed (PS_EMISSION).
import {
  deriveDomainProtoSchemas,
  deriveExecutionProtoSchemas,
  deriveHostProtoSchemas,
  deriveEffectProtoSchemas,
} from './proto-schema.mjs';
import { family, renderProtoSchemaFiles } from '../../emitter/families/proto-schema.mjs';
import { isUnifiedContext } from './emission-policy.mjs';

const fail = message => { throw new Error('PS_EMISSION: ' + message); };

export const isProtoSchemaFlipped = (context, options) => isUnifiedContext(context, options);

const DERIVATIONS = Object.freeze({
  domain: deriveDomainProtoSchemas,
  execution: deriveExecutionProtoSchemas,
  host: deriveHostProtoSchemas,
  effect: deriveEffectProtoSchemas,
});

const SCOPE_KINDS = Object.freeze({
  domain: 'proto',
  execution: 'proto',
  host: 'host-proto',
  effect: 'effect-proto',
});

export function withFlippedProtoSchemas(produce, context, scope) {
  const classic = produce(context);
  const derive = DERIVATIONS[scope];
  const expectedKind = SCOPE_KINDS[scope];
  if (!derive || !expectedKind) fail('unsupported proto-schema scope: ' + scope);
  const contexts = context.products?.['reference-layout']?.contexts ?? [];
  if (!contexts.some(c => isProtoSchemaFlipped(c, context.options))) return classic;

  const contract = derive(context.products, context.options);
  if (!contract.files.length) return classic;
  family.checkInput(JSON.parse(JSON.stringify(contract)));
  const rendered = renderProtoSchemaFiles(JSON.parse(JSON.stringify(contract)));

  const kept = [];
  const removed = [];
  for (const entry of classic) {
    if (entry.kind === expectedKind) {
      removed.push(entry);
      continue;
    }
    kept.push(entry);
  }
  if (!removed.length) fail('classic ' + scope + ' plan carried no ' + expectedKind + ' entries');
  const footprint = removed[0].productFootprint.map(p => ({ ...p }));

  const additions = rendered.map(file => ({
    path: file.path,
    content: file.content,
    kind: file.kind,
    deps: [...file.deps],
    knowledgeIds: [...new Set(file.sources.map(s => 'source:' + s.document + '#' + s.pointer))],
    productFootprint: footprint.map(p => ({ ...p })),
    merge: null,
  }));
  return [...additions, ...kept];
}
