// Emission bridge for the flipped domain-entity family (emitter-unification
// plan F4 — 逐族替换; rulings 2026-11-23 §17). The play-service producer
// registry wraps the aggregate-dsl row with withFlippedDomainEntities: flip
// manifest contexts stop producing the classic State and Entity files and
// produce the unified emitter's curated style instead (no generated header,
// strict N1 cross-package FQN, exact codeMappings anchor on Entity.empty).
// Other artifacts emitted by aggregate-dsl (protocol/behavior/aggregate/
// factory/bootstrap/repository) and non-manifest projects pass through
// untouched. The plan stays double-run deterministic (pure functions only).
import { deriveDomainEntities } from './domain-entity.mjs';
import { family, renderDomainEntityFiles } from '../../emitter/families/domain-entity.mjs';

const fail = message => { throw new Error('DE_EMISSION: ' + message); };

// The family flips as one unit per context (three bankwealth aggregates × 2
// files = 6 files). Projects with none of these contexts keep the classic
// renderer untouched.
export const DOMAIN_ENTITY_FLIP_CONTEXTS = Object.freeze(['bankwealth']);

export const isDomainEntityFlipped = context => DOMAIN_ENTITY_FLIP_CONTEXTS.includes(context);

const classicStatePath = (packageRoot, name) => 'app/' + packageRoot + '/domain/' + name + 'State.scala';
const classicEntityPath = (packageRoot, name) => 'app/' + packageRoot + '/domain/entities/' + name + 'Entity.scala';

// The aggregate-dsl row's declared products with their compiled versions
// (generators/scala-cqrs-play-service/generate.mjs pins).
const DOMAIN_ENTITY_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' },
  { id: 'domain-folds', version: '6' },
  { id: 'exact-value-types', version: '1' },
  { id: 'domain-dependencies', version: '6' },
]);

const domainEntityEntry = file => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...file.deps],
  knowledgeIds: [...new Set([
    ...file.sources.map(source => 'source:' + source.document + '#' + source.pointer),
    ...file.codeMappings.map(m => m.knowledgeKey),
  ])],
  productFootprint: DOMAIN_ENTITY_FOOTPRINT.map(pin => ({ ...pin })),
  merge: null,
  ...(file.codeMappings.length ? { codeMappings: file.codeMappings.map(m => ({ ...m, span: { ...m.span }, scope: { ...m.scope } })) } : {}),
});

/**
 * Wrap the aggregate-dsl producer: manifest contexts' classic State and Entity
 * files are replaced by the family's curated render. All other aggregate-dsl
 * layered entries (protocol/behavior/aggregate/factory/bootstrap/repository)
 * and projects without any manifest aggregate declaration pass through
 * untouched; the classic plan must carry exactly the classic state+entity set
 * being replaced — nothing more, nothing less.
 */
export function withFlippedDomainEntities(produce, context) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;
  const flipped = layout.filter(d => d.ref?.kind === 'aggregate' && isDomainEntityFlipped(d.ref.context));
  if (!flipped.length) return classic;
  const packageRoots = new Map((context.options?.packages ?? []).map(p => [p.context, p.package.replaceAll('.', '/')]));
  const targets = new Map();
  for (const declaration of flipped) {
    const packageRoot = packageRoots.get(declaration.ref.context);
    if (!packageRoot) fail('missing package binding for flip context ' + declaration.ref.context);
    targets.set(classicStatePath(packageRoot, declaration.ref.id), declaration.ref.context + '/' + declaration.ref.id + '/state');
    targets.set(classicEntityPath(packageRoot, declaration.ref.id), declaration.ref.context + '/' + declaration.ref.id + '/entity');
  }
  const kept = [];
  const replaced = [];
  for (const entry of classic) {
    if (targets.has(entry.path)) { replaced.push(entry.path); continue; }
    kept.push(entry);
  }
  if (replaced.length !== targets.size)
    fail('the classic aggregate plan must carry exactly the state/entity flip set: ' + replaced.length + ' of ' + targets.size + ' classic files present');

  const flipRoots = [...new Set(flipped.map(d => packageRoots.get(d.ref.context)))];
  const orphan = kept.find(e => (e.kind === 'state' || e.kind === 'entity') &&
    flipRoots.some(root => e.path.startsWith('app/' + root + '/domain/')));
  if (orphan) fail('the classic aggregate plan carries a state/entity file outside the derived contract: ' + orphan.path);

  const contract = deriveDomainEntities(context.products, context.options);
  const aggregates = contract.aggregates.filter(a => isDomainEntityFlipped(a.context));
  const reachable = new Set(aggregates.map(a => a.context));
  const scanType = type => {
    if (type?.form === 'nominal') reachable.add(type.context);
    if (type?.form === 'optional' || type?.form === 'sequence') scanType(type.element);
    if (type?.form === 'map') { scanType(type.key); scanType(type.value); }
  };
  const scanLit = lit => {
    if (!lit || typeof lit !== 'object') return;
    if (lit.context) reachable.add(lit.context);
    if (lit.inner) scanLit(lit.inner);
    if (lit.args) lit.args.forEach(scanLit);
    if (lit.value && lit.kind === 'optional') scanLit(lit.value);
    if (lit.elements) lit.elements.forEach(scanLit);
    if (lit.entries) lit.entries.forEach(e => { scanLit(e.key); scanLit(e.value); });
  };
  for (const agg of aggregates) {
    for (const f of agg.fields) { scanType(f.type); scanLit(f.default); }
  }
  const manifest = { ...contract, aggregates, packages: contract.packages.filter(p => reachable.has(p.context)) };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  const files = renderDomainEntityFiles(JSON.parse(JSON.stringify(manifest)));
  if (files.length !== manifest.aggregates.length) fail('the family must render exactly one Entity file per aggregate');
  const additions = files.map(domainEntityEntry);
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped domain-entity file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...additions, ...kept];
}
