// Emission bridge for the flipped external-event-bridge family (#46)
// (emitter-unification plan F4 — 逐族替换; ruling §22, 2026-11-24).
// Wraps `command-dsl` in `scala-cqrs-play-service/generate.mjs`: replaces the
// classic `external-event-bridge` entry (`<Aggregate>ExternalEvents.scala`) for
// flipped contexts while leaving non-manifest fixtures untouched. Pure,
// fail-closed, and double-run deterministic.
import { deriveExternalEventBridges } from './external-event-bridge.mjs';
import { family, renderExternalEventBridgeFiles } from '../../emitter/families/external-event-bridge.mjs';

const fail = message => { throw new Error('EEB_EMISSION: ' + message); };

export const EXTERNAL_EVENT_BRIDGE_FLIP_CONTEXTS = Object.freeze(['bankwealth']);

export const isExternalEventBridgeFlipped = context =>
  EXTERNAL_EVENT_BRIDGE_FLIP_CONTEXTS.includes(context);

const COMMAND_DSL_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' },
  { id: 'domain-dependencies', version: '6' },
  { id: 'exact-value-types', version: '1' },
]);

const entryFromFile = file => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...file.deps],
  knowledgeIds: [...new Set(file.sources.map(s => 'source:' + s.document + '#' + s.pointer))],
  productFootprint: COMMAND_DSL_FOOTPRINT.map(pin => ({ ...pin })),
  merge: null,
});

function buildManifest(context) {
  const derived = deriveExternalEventBridges(context.products, context.options);
  const bridges = derived.bridges.filter(b => isExternalEventBridgeFlipped(b.context));
  if (bridges.length === 0) return null;
  const reachable = new Set(bridges.map(b => b.context));
  const scanType = type => {
    if (type?.form === 'nominal') reachable.add(type.context);
    if (type?.form === 'optional' || type?.form === 'sequence') scanType(type.element);
    if (type?.form === 'map') { scanType(type.key); scanType(type.value); }
  };
  for (const bridge of bridges) {
    for (const producer of bridge.producers) scanType(producer.outputType);
  }
  const manifest = {
    schemaVersion: derived.schemaVersion,
    packages: derived.packages.filter(p => reachable.has(p.context)),
    bridges,
  };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  return manifest;
}

export function withFlippedExternalEventBridges(produce, context) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;

  const manifest = buildManifest(context);
  if (!manifest) return classic;

  const packageRoots = new Map((context.options?.packages ?? []).map(p => [p.context, p.package.replaceAll('.', '/')]));
  const targets = new Map();
  for (const bridge of manifest.bridges) {
    const root = packageRoots.get(bridge.context);
    if (!root) fail('missing package binding for flip context ' + bridge.context);
    targets.set(`app/${root}/domain/${bridge.aggregate}ExternalEvents.scala`, `${bridge.context}/${bridge.aggregate}`);
  }

  const kept = [];
  const replaced = [];
  for (const entry of classic) {
    if (targets.has(entry.path)) { replaced.push(entry.path); continue; }
    kept.push(entry);
  }
  if (replaced.length !== targets.size)
    fail(`the classic command-dsl plan must carry exactly the external-event-bridge flip set: ${replaced.length} of ${targets.size} classic files present`);

  const flipRoots = [...new Set(manifest.bridges.map(b => packageRoots.get(b.context)))];
  const orphan = kept.find(e => e.kind === 'external-event-bridge' &&
    flipRoots.some(root => e.path.startsWith('app/' + root + '/')));
  if (orphan) fail('the classic command-dsl plan carries an external-event-bridge file outside the derived contract: ' + orphan.path);

  const files = renderExternalEventBridgeFiles(JSON.parse(JSON.stringify(manifest)));
  if (files.length !== manifest.bridges.length)
    fail('the family must render exactly 1 external-event-bridge file per bridge');

  const additions = files.map(entryFromFile);
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped external-event-bridge file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}
