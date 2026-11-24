// Emission bridge for the flipped aggregate-repository family
// (emitter-unification plan F4 — 逐族替换; rulings 2026-11-23 §20). Wraps the
// aggregate-dsl row in scala-cqrs-play-service: manifest contexts replace their
// classic aggregate-repository entries with the unified emitter's curated
// render (no generated header; approved owned-local-actor-cache semantics).
// All other aggregate-dsl artifacts and non-manifest projects pass through
// untouched. Pure and double-run deterministic.
import { deriveAggregateRepositories } from './aggregate-repository.mjs';
import { family, renderAggregateRepositoryFiles } from '../../emitter/families/aggregate-repository.mjs';

const fail = message => { throw new Error('AR_EMISSION: ' + message); };

export const AGGREGATE_REPOSITORY_FLIP_CONTEXTS = Object.freeze(['bankwealth']);

export const isAggregateRepositoryFlipped = context => AGGREGATE_REPOSITORY_FLIP_CONTEXTS.includes(context);

const classicRepositoryPath = (packageRoot, name) =>
  'app/' + packageRoot + '/application/aggregates/' + name + 'Repository.scala';

// The aggregate-dsl row's declared products with their compiled versions
// (generators/scala-cqrs-play-service/generate.mjs pins).
const AGGREGATE_REPOSITORY_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' },
  { id: 'domain-folds', version: '6' },
  { id: 'exact-value-types', version: '1' },
  { id: 'domain-dependencies', version: '6' },
]);

const aggregateRepositoryEntry = file => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...file.deps],
  knowledgeIds: [...new Set(file.sources.map(source => 'source:' + source.document + '#' + source.pointer))],
  productFootprint: AGGREGATE_REPOSITORY_FOOTPRINT.map(pin => ({ ...pin })),
  merge: null,
});

export function withFlippedAggregateRepositories(produce, context) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;
  const flipped = layout.filter(d => d.ref?.kind === 'aggregate' && isAggregateRepositoryFlipped(d.ref.context));
  if (!flipped.length) return classic;

  const packageRoots = new Map((context.options?.packages ?? []).map(p => [p.context, p.package.replaceAll('.', '/')]));
  const targets = new Map();
  for (const declaration of flipped) {
    const packageRoot = packageRoots.get(declaration.ref.context);
    if (!packageRoot) fail('missing package binding for flip context ' + declaration.ref.context);
    targets.set(classicRepositoryPath(packageRoot, declaration.ref.id), declaration.ref.context + '/' + declaration.ref.id);
  }

  const kept = [];
  const replaced = [];
  for (const entry of classic) {
    if (targets.has(entry.path)) { replaced.push(entry.path); continue; }
    kept.push(entry);
  }
  if (replaced.length !== targets.size)
    fail('the classic aggregate plan must carry exactly the repository flip set: ' + replaced.length + ' of ' + targets.size + ' classic files present');

  const flipRoots = [...new Set(flipped.map(d => packageRoots.get(d.ref.context)))];
  const orphan = kept.find(e => e.kind === 'aggregate-repository' &&
    flipRoots.some(root => e.path.startsWith('app/' + root + '/application/aggregates/')));
  if (orphan) fail('the classic aggregate plan carries a repository file outside the derived contract: ' + orphan.path);

  const contract = deriveAggregateRepositories(context.products, context.options);
  const repositories = contract.repositories.filter(r => isAggregateRepositoryFlipped(r.context));
  const reachable = new Set(repositories.map(r => r.context));
  const manifest = {
    ...contract,
    repositories,
    packages: contract.packages.filter(p => reachable.has(p.context)),
  };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  const files = renderAggregateRepositoryFiles(JSON.parse(JSON.stringify(manifest)));
  if (files.length !== manifest.repositories.length * 2) fail('the family must render exactly two repository files (port + impl) per aggregate');

  const additions = files.map(aggregateRepositoryEntry);
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped aggregate-repository file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...additions, ...kept];
}
