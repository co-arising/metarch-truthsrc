// Emission bridge for the flipped value-object family (emitter-unification
// plan F4 — 逐族替换; rulings 2026-11-23 §6/§13). The play-service producer
// registry wraps the valueobject-dsl row with withFlippedValueObjects: flip
// manifest contexts stop producing the classic values files and produce the
// unified emitter's curated style instead (no generated header, same-package
// short nominal references — ABI-transparent, same JVM signatures). Non
// manifest contexts and projects without any manifest type declaration pass
// through untouched. The plan stays double-run deterministic (pure functions
// only).
import { deriveValueObjects } from './value-object.mjs';
import { family, renderValueObjectFiles } from '../../emitter/families/value-object.mjs';
import { isUnifiedContext } from './emission-policy.mjs';

const fail = message => { throw new Error('VO_EMISSION: ' + message); };

export const isValueObjectFlipped = (context, options) => isUnifiedContext(context, options);

const classicValuesPath = (packageRoot, name) => 'app/' + packageRoot + '/domain/values/' + name + '.scala';

// The valueobject-dsl row's declared products with their compiled versions
// (generators/scala-cqrs-play-service/generate.mjs pins).
const VALUE_OBJECT_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' }, { id: 'exact-value-types', version: '1' },
]);

const valueObjectEntry = file => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...new Set(file.deps)],
  knowledgeIds: [...new Set(file.sources.map(source => 'source:' + source.document + '#' + source.pointer))],
  productFootprint: VALUE_OBJECT_FOOTPRINT.map(pin => ({ ...pin })),
  merge: null,
});

/**
 * Wrap the valueobject-dsl producer: manifest contexts' classic values files
 * are replaced by the family's curated render. Projects without any manifest
 * type declaration (every fixture and inventory project) pass through
 * untouched; the classic plan must carry exactly the classic files being
 * replaced — nothing more, nothing less.
 */
export function withFlippedValueObjects(produce, context) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;
  const flipped = layout.filter(d => d.ref?.kind === 'type' && isValueObjectFlipped(d.ref.context, context.options) &&
    (!d.ref.owner || d.ref.owner.length === 0));
  if (!flipped.length) return classic;
  const packageRoots = new Map((context.options?.packages ?? []).map(p => [p.context, p.package.replaceAll('.', '/')]));
  const stems = new Map();
  for (const declaration of flipped) {
    const packageRoot = packageRoots.get(declaration.ref.context);
    if (!packageRoot) fail('missing package binding for flip context ' + declaration.ref.context);
    stems.set(classicValuesPath(packageRoot, declaration.ref.id), declaration.ref.context + '/' + declaration.ref.id);
  }
  const kept = [];
  const replaced = [];
  for (const entry of classic) {
    if (stems.has(entry.path)) { replaced.push(entry.path); continue; }
    kept.push(entry);
  }
  if (replaced.length !== stems.size)
    fail('the classic values plan must carry exactly the flip set: ' + replaced.length + ' of ' + stems.size + ' classic files present');
  // Any other values file inside a flipped context is an orphan the contract
  // cannot account for — refuse instead of silently keeping it.
  const flipRoots = [...new Set(flipped.map(d => packageRoots.get(d.ref.context)))];
  const orphan = kept.find(e => e.path.includes('/domain/values/') &&
    flipRoots.some(root => e.path.startsWith('app/' + root + '/domain/values/')));
  if (orphan) fail('the classic values plan carries a file outside the derived contract: ' + orphan.path);
  const contract = deriveValueObjects(context.products, context.options);
  const values = contract.values.filter(v => isValueObjectFlipped(v.context, context.options));
  // The manifest keeps the package bindings the values render can reach: the
  // values' own contexts plus any cross-context nominal target (N1's FQN rule).
  const reachable = new Set(values.map(v => v.context));
  for (const value of values) {
    const scan = type => {
      if (type?.form === 'nominal') reachable.add(type.context);
      if (type?.form === 'optional' || type?.form === 'sequence') scan(type.element);
      if (type?.form === 'map') { scan(type.key); scan(type.value); }
    };
    if (value.shape.kind === 'primitive') scan(value.shape.type);
    if (value.shape.kind === 'record') for (const member of value.shape.members) scan(member.type);
  }
  const manifest = { ...contract, values, packages: contract.packages.filter(p => reachable.has(p.context)) };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  const files = renderValueObjectFiles(JSON.parse(JSON.stringify(manifest)));
  const renderedSourceCount = files.reduce((sum, f) => sum + (f.sources?.length ?? 0), 0);
  if (!files.length || renderedSourceCount !== manifest.values.length) {
    fail(`the family must account for every declared value source (${renderedSourceCount} of ${manifest.values.length})`);
  }
  const additions = files.map(valueObjectEntry);
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped values file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}
