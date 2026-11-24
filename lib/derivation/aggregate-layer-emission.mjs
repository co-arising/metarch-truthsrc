// Emission bridge for the flipped aggregate-layer family (emitter-unification
// plan F4 — 逐族替换; rulings 2026-11-23 §18). The play-service producer
// registry wraps the aggregate-dsl row with withFlippedAggregateLayers: flip
// manifest contexts stop producing the classic aggregate, aggregate-factory
// and aggregate-behavior (facade + behaviors) files and produce the unified
// emitter's curated style instead (no generated header, strict N1 cross-package
// FQN, exact ABI names incl. Ingest*, exact 57-span UTF-8 codeMappings on
// Behaviors.scala). Other aggregate-dsl entries (protocol/bootstrap/repository
// and already-flipped state/entity) and non-manifest projects pass through
// untouched. The plan stays double-run deterministic (pure functions only).
import { deriveAggregateLayers } from './aggregate-layer.mjs';
import { family, renderAggregateLayerFiles } from '../../emitter/families/aggregate-layer.mjs';

const fail = message => { throw new Error('AL_EMISSION: ' + message); };

// The family flips as one unit per context (three bankwealth aggregates × 4
// files = 12 files). Projects with none of these contexts keep the classic
// renderer untouched.
export const AGGREGATE_LAYER_FLIP_CONTEXTS = Object.freeze(['bankwealth']);

export const isAggregateLayerFlipped = context => AGGREGATE_LAYER_FLIP_CONTEXTS.includes(context);

const FLIPPED_KINDS = new Set(['aggregate', 'aggregate-factory', 'aggregate-behavior']);

const targetPathsFor = (packageRoot, name) => [
  ['app/' + packageRoot + '/domain/' + name + 'Aggregate.scala', 'legacy'],
  ['app/' + packageRoot + '/application/aggregates/' + name + 'Aggregate.scala', 'aggregate'],
  ['app/' + packageRoot + '/application/aggregates/' + name + 'AggregateFactory.scala', 'factory'],
  ['app/' + packageRoot + '/application/aggregates/behaviors/' + name + 'Behaviors.scala', 'behavior'],
];

// The aggregate-dsl row's declared products with their compiled versions
// (generators/scala-cqrs-play-service/generate.mjs pins).
const AGGREGATE_LAYER_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' },
  { id: 'domain-folds', version: '6' },
  { id: 'exact-value-types', version: '1' },
  { id: 'domain-dependencies', version: '6' },
]);

const aggregateLayerEntry = file => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...file.deps],
  knowledgeIds: [...new Set([
    ...file.sources.map(source => 'source:' + source.document + '#' + source.pointer),
    ...file.codeMappings.map(m => m.knowledgeKey),
  ])],
  productFootprint: AGGREGATE_LAYER_FOOTPRINT.map(pin => ({ ...pin })),
  merge: null,
  ...(file.codeMappings.length ? { codeMappings: file.codeMappings.map(m => ({ ...m, span: { ...m.span }, scope: { ...m.scope } })) } : {}),
});

/**
 * Wrap the aggregate-dsl producer: manifest contexts' classic aggregate,
 * aggregate-factory and aggregate-behavior files (4 per aggregate) are replaced
 * by the family's curated render. All other aggregate-dsl entries and projects
 * without any manifest aggregate declaration pass through untouched; the
 * classic plan must carry exactly the 4×N flip set — nothing more, nothing less.
 */
export function withFlippedAggregateLayers(produce, context) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;
  const flipped = layout.filter(d => d.ref?.kind === 'aggregate' && isAggregateLayerFlipped(d.ref.context));
  if (!flipped.length) return classic;
  const packageRoots = new Map((context.options?.packages ?? []).map(p => [p.context, p.package.replaceAll('.', '/')]));
  const targets = new Map();
  for (const declaration of flipped) {
    const packageRoot = packageRoots.get(declaration.ref.context);
    if (!packageRoot) fail('missing package binding for flip context ' + declaration.ref.context);
    for (const [p, role] of targetPathsFor(packageRoot, declaration.ref.id)) {
      targets.set(p, declaration.ref.context + '/' + declaration.ref.id + '/' + role);
    }
  }
  const kept = [];
  const replaced = [];
  for (const entry of classic) {
    if (targets.has(entry.path)) { replaced.push(entry.path); continue; }
    kept.push(entry);
  }
  if (replaced.length !== targets.size)
    fail('the classic aggregate plan must carry exactly the aggregate-layer flip set: ' + replaced.length + ' of ' + targets.size + ' classic files present');

  const flipRoots = [...new Set(flipped.map(d => packageRoots.get(d.ref.context)))];
  const orphan = kept.find(e => FLIPPED_KINDS.has(e.kind) &&
    flipRoots.some(root => e.path.startsWith('app/' + root + '/')));
  if (orphan) fail('the classic aggregate plan carries an aggregate-layer file outside the derived contract: ' + orphan.path);

  const contract = deriveAggregateLayers(context.products, context.options);
  const aggregates = contract.aggregates.filter(a => isAggregateLayerFlipped(a.context));
  const reachable = new Set(aggregates.map(a => a.context));
  const scanType = type => {
    if (type?.form === 'nominal') reachable.add(type.context);
    if (type?.form === 'optional' || type?.form === 'sequence') scanType(type.element);
    if (type?.form === 'map') { scanType(type.key); scanType(type.value); }
  };
  for (const agg of aggregates) {
    for (const p of agg.externalProducers) scanType(p.outputType);
  }
  const manifest = { ...contract, aggregates, packages: contract.packages.filter(p => reachable.has(p.context)) };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  const files = renderAggregateLayerFiles(JSON.parse(JSON.stringify(manifest)));
  if (files.length !== manifest.aggregates.length * 4) fail('the family must render exactly four files per aggregate');
  const additions = files.map(aggregateLayerEntry);
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped aggregate-layer file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...additions, ...kept];
}
