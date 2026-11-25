// Emission bridge for the flipped project-scaffold family (#39).
// Replaces build, service-test, and generated-test entries on proto-dsl,
// finite-host-dsl, and play-service-dsl for manifest contexts, emitting the
// clean 2-parent-class conf/serialization.conf and headerless test specs.
// Fail-closed (PSC_EMISSION).
import { deriveProjectScaffold } from './project-scaffold.mjs';
import { family, renderProjectScaffoldFiles } from '../../emitter/families/project-scaffold.mjs';
import { isUnifiedContext } from './emission-policy.mjs';

const fail = message => { throw new Error('PSC_EMISSION: ' + message); };

export const isProjectScaffoldFlipped = (context, options) => isUnifiedContext(context, options);

const SCAFFOLD_KINDS = new Set(['build', 'service-test', 'generated-test']);

export function withFlippedProjectScaffold(entries, context) {
  const contexts = context.products?.['reference-layout']?.contexts ?? [];
  if (!contexts.some(c => isProjectScaffoldFlipped(c, context.options))) return entries;

  const kept = [];
  const scaffold = [];
  for (const entry of entries) {
    if (SCAFFOLD_KINDS.has(entry.kind)) scaffold.push(entry);
    else kept.push(entry);
  }
  if (!scaffold.length) return entries;

  const footprintByPath = new Map(scaffold.map(e => [e.path, e.productFootprint.map(p => ({ ...p }))]));
  const contract = deriveProjectScaffold(context.products, context.options, scaffold);
  // Filter to only the files present in this producer row (e.g., proto-dsl vs play-service-dsl)
  const hasSer = scaffold.some(e => e.path === 'conf/serialization.conf');
  family.checkInput(JSON.parse(JSON.stringify(contract)));
  const rendered = renderProjectScaffoldFiles(JSON.parse(JSON.stringify(contract)))
    .filter(f => f.path !== 'conf/serialization.conf' || hasSer);

  const additions = rendered.map(file => {
    const fp = footprintByPath.get(file.path);
    if (!fp) fail('unexpected rendered scaffold path: ' + file.path);
    return {
      path: file.path,
      content: file.content,
      kind: file.kind,
      deps: [...file.deps],
      knowledgeIds: [...new Set(file.sources.map(s => 'source:' + s.document + '#' + s.pointer))],
      productFootprint: fp,
      merge: null,
    };
  });
  return [...kept, ...additions];
}
