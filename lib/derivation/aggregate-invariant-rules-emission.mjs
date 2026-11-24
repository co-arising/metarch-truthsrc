// Emission bridge for the flipped aggregate invariant rules cluster
// (emitter-unification plan F4 — 逐族替换, never a wholesale switch; ruling
// 2026-11-23). The play-service producer registry wraps the invariant-dsl row
// with withFlippedInvariantRules: flipped aggregates stop producing the classic
// rules trio (the classic renderer skips them; this wrapper refuses any
// survivor) and produce the unified emitter's byte-identical reproduction
// instead — derived from the knowledge products (F2) and rendered through the
// aggregate-invariant-rules family with its full codeMappings provenance, so
// the guard-level anchors verify unchanged. The cluster flips as one unit
// (every manifest aggregate present, or the wrapper stays out entirely), and
// the event-handler entries of the same producer row stay classic. The plan
// stays double-run deterministic (pure functions only).
import { deriveInvariantRules, RULES_FLIP_AGGREGATES } from './aggregate-invariant-rules.mjs';
import { family, renderInvariantRuleFiles } from '../../emitter/families/aggregate-invariant-rules.mjs';

const fail = message => { throw new Error('RULES_EMISSION: ' + message); };
const knowledge = source => 'source:' + source.document + '#' + source.pointer;

// The invariant-dsl row's declared products with their compiled versions
// (generators/scala-cqrs-play-service/generate.mjs pins).
const INVARIANT_DSL_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' }, { id: 'domain-decision', version: '4' },
  { id: 'domain-folds', version: '6' }, { id: 'exact-value-types', version: '1' },
  { id: 'domain-dependencies', version: '6' },
]);

const rulesEntry = (file, footprint) => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...file.deps],
  knowledgeIds: [...new Set([...file.sources.map(knowledge), ...file.codeMappings.map(m => m.knowledgeKey)])],
  productFootprint: footprint.map(pin => ({ ...pin })),
  merge: null,
  ...(file.codeMappings.length ? { codeMappings: file.codeMappings.map(m => ({ knowledgeKey: m.knowledgeKey, span: { ...m.span }, scope: { ...m.scope } })) } : {}),
});

/**
 * Wrap the invariant-dsl producer: flipped aggregates' classic rules trio is
 * replaced by the family's byte-identical reproduction. Projects without any
 * manifest aggregate (every fixture and inventory project) pass through
 * untouched; a partial cluster is refused fail-closed.
 */
export function withFlippedInvariantRules(produce, context) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;
  const present = RULES_FLIP_AGGREGATES.filter(f => layout.some(d =>
    d.ref?.kind === 'aggregate' && d.ref.context === f.context && d.ref.id === f.aggregate &&
    (!d.ref.owner || d.ref.owner.length === 0)));
  if (!present.length) return classic;
  if (present.length !== RULES_FLIP_AGGREGATES.length)
    fail('the rules cluster flips as one unit: ' + present.length + ' of ' + RULES_FLIP_AGGREGATES.length + ' manifest aggregates present');
  const stems = present.map(f => f.aggregate);
  const survivor = e => e.kind === 'rules' && stems.some(n =>
    e.path.endsWith('/domain/' + n + 'Rules.scala') ||
    e.path.endsWith('/domain/invariant/' + n + 'Rules.scala') ||
    e.path.endsWith('/domain/invariant/params/' + n + 'RuleParams.scala') ||
    e.path.endsWith('/domain/invariants/' + n + 'Rules.scala') ||
    e.path.endsWith('/domain/invariants/params/' + n + 'RuleParams.scala'));
  const leaks = classic.filter(survivor);
  if (leaks.length)
    fail('classic rules files for flipped aggregates must not be produced: ' + leaks.map(e => e.path).join(', '));
  const contract = deriveInvariantRules(context.products, context.options);
  family.checkInput(JSON.parse(JSON.stringify(contract)));
  const files = renderInvariantRuleFiles(JSON.parse(JSON.stringify(contract)));
  const additions = files.map(file => rulesEntry(file, INVARIANT_DSL_FOOTPRINT));
  const paths = new Set(classic.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped rules file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...classic, ...additions];
}
