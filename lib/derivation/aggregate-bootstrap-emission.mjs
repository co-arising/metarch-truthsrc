// Emission bridge for the flipped aggregate-bootstrap family (#47).
// Wraps aggregate-dsl in scala-cqrs-play-service: manifest contexts replace
// their classic aggregate-bootstrap entries with the unified emitter's curated
// render (headerless). Pure and double-run deterministic.
import { deriveAggregateBootstraps } from './aggregate-bootstrap.mjs';
import { family, renderAggregateBootstrapFiles } from '../../emitter/families/aggregate-bootstrap.mjs';
import { isUnifiedContext } from './emission-policy.mjs';

const fail = message => { throw new Error('AB_EMISSION: ' + message); };

export const isAggregateBootstrapFlipped = (context, options) => isUnifiedContext(context, options);

const classicBootstrapPath = (packageRoot, name) =>
  'app/' + packageRoot + '/infrastructure/bootstrap/' + name + 'Bootstrap.scala';

const AGGREGATE_BOOTSTRAP_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' },
  { id: 'domain-folds', version: '6' },
  { id: 'exact-value-types', version: '1' },
  { id: 'domain-dependencies', version: '6' },
]);

const aggregateBootstrapEntry = file => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...file.deps],
  knowledgeIds: [...new Set(file.sources.map(source => 'source:' + source.document + '#' + source.pointer))],
  productFootprint: AGGREGATE_BOOTSTRAP_FOOTPRINT.map(pin => ({ ...pin })),
  merge: null,
});

export function withFlippedAggregateBootstraps(produce, context) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;
  const flipped = layout.filter(d => d.ref?.kind === 'aggregate' && isAggregateBootstrapFlipped(d.ref.context, context.options));
  if (!flipped.length) return classic;

  const packageRoots = new Map((context.options?.packages ?? []).map(p => [p.context, p.package.replaceAll('.', '/')]));
  const targets = new Map();
  for (const declaration of flipped) {
    const packageRoot = packageRoots.get(declaration.ref.context);
    if (!packageRoot) fail('missing package binding for flip context ' + declaration.ref.context);
    targets.set(classicBootstrapPath(packageRoot, declaration.ref.id), declaration.ref.context + '/' + declaration.ref.id);
  }

  const kept = [];
  const replaced = [];
  for (const entry of classic) {
    if (targets.has(entry.path)) { replaced.push(entry.path); continue; }
    kept.push(entry);
  }
  if (replaced.length !== targets.size)
    fail('the classic aggregate plan must carry exactly the bootstrap flip set: ' + replaced.length + ' of ' + targets.size + ' classic files present');

  const contract = deriveAggregateBootstraps(context.products, context.options);
  const bootstraps = contract.bootstraps.filter(b => isAggregateBootstrapFlipped(b.context, context.options));
  const reachable = new Set(bootstraps.map(b => b.context));
  const manifest = {
    ...contract,
    bootstraps,
    packages: contract.packages.filter(p => reachable.has(p.context)),
  };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  const files = renderAggregateBootstrapFiles(JSON.parse(JSON.stringify(manifest)));
  if (files.length !== manifest.bootstraps.length) fail('the family must render exactly one bootstrap file per aggregate');

  const additions = files.map(aggregateBootstrapEntry);
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped aggregate-bootstrap file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...additions, ...kept];
}
