// Emission bridge for the flipped proto-schema family (#29).
// Replaces classic .proto entries on proto-dsl, finite-execution-dsl,
// finite-host-dsl, and durable-effect-host-dsl for manifest contexts with the
// unified emitter's clean multi-line proto3 render. Fail-closed (PS_EMISSION).
import {
  deriveDomainProtoSchemas,
  deriveExecutionProtoSchemas,
  deriveHostProtoSchemas,
  deriveEffectProtoSchemas,
} from './proto-schema.mjs';
import { family, renderProtoSchemaFiles } from '../../emitter/families/proto-schema.mjs';

const fail = message => { throw new Error('PS_EMISSION: ' + message); };

export const PROTO_SCHEMA_FLIP_CONTEXTS = Object.freeze(['bankwealth']);

export const isProtoSchemaFlipped = context => PROTO_SCHEMA_FLIP_CONTEXTS.includes(context);

const DERIVATIONS = Object.freeze({
  domain: deriveDomainProtoSchemas,
  execution: deriveExecutionProtoSchemas,
  host: deriveHostProtoSchemas,
  effect: deriveEffectProtoSchemas,
});

export function withFlippedProtoSchemas(produce, context, scope) {
  const classic = produce(context);
  const derive = DERIVATIONS[scope];
  if (!derive) fail('unsupported proto-schema scope: ' + scope);
  const contexts = context.products?.['reference-layout']?.contexts ?? [];
  if (!contexts.some(isProtoSchemaFlipped)) return classic;

  const contract = derive(context.products, context.options);
  if (!contract.files.length) return classic;
  family.checkInput(JSON.parse(JSON.stringify(contract)));
  const rendered = renderProtoSchemaFiles(JSON.parse(JSON.stringify(contract)));
  const byPath = new Map(rendered.map(f => [f.path, f]));

  const kept = [];
  const replaced = new Map();
  for (const entry of classic) {
    if (byPath.has(entry.path)) {
      replaced.set(entry.path, entry);
      continue;
    }
    kept.push(entry);
  }
  if (replaced.size !== byPath.size) {
    fail('classic ' + scope + ' plan must carry exactly the proto flip set: ' + replaced.size + ' of ' + byPath.size + ' present');
  }

  const additions = rendered.map(file => {
    const prior = replaced.get(file.path);
    return {
      path: file.path,
      content: file.content,
      kind: file.kind,
      deps: [...file.deps],
      knowledgeIds: [...new Set(file.sources.map(s => 'source:' + s.document + '#' + s.pointer))],
      productFootprint: prior.productFootprint.map(p => ({ ...p })),
      merge: null,
    };
  });
  return [...additions, ...kept];
}
