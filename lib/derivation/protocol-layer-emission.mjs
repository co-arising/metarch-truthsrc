// Dual-row emission bridge for the flipped protocol-layer family
// (emitter-unification plan F4 — 逐族替换; rulings 2026-11-23 §19).
// The play-service producer registry wraps two producer rows:
//   1. `command-dsl` via `withFlippedCommandProtocols`: replaces the classic
//      `protocol` and `command-helpers` entries (2 per aggregate = 6 files),
//      leaving `external-event-bridge` untouched.
//   2. `aggregate-dsl` via `withFlippedApplicationProtocols`: replaces the
//      classic `application-protocol` entries (1 per aggregate = 3 files),
//      leaving all other aggregate-dsl entries untouched.
// Both wrappers share the single cohesive `protocol-layer` family (#7) and
// remain pure, fail-closed, and double-run deterministic.
import { deriveProtocolLayers } from './protocol-layer.mjs';
import { family, renderProtocolLayerFiles } from '../../emitter/families/protocol-layer.mjs';

const fail = message => { throw new Error('PL_EMISSION: ' + message); };

export const PROTOCOL_LAYER_FLIP_CONTEXTS = Object.freeze(['bankwealth']);

export const isProtocolLayerFlipped = context => PROTOCOL_LAYER_FLIP_CONTEXTS.includes(context);

const COMMAND_DSL_KINDS = new Set(['protocol', 'command-helpers']);
const AGGREGATE_DSL_KINDS = new Set(['application-protocol']);

const COMMAND_DSL_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' },
  { id: 'domain-dependencies', version: '6' },
  { id: 'exact-value-types', version: '1' },
]);

const AGGREGATE_DSL_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' },
  { id: 'domain-folds', version: '6' },
  { id: 'exact-value-types', version: '1' },
  { id: 'domain-dependencies', version: '6' },
]);

const entryFromFile = (file, footprint) => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...file.deps],
  knowledgeIds: [...new Set(file.sources.map(source => 'source:' + source.document + '#' + source.pointer))],
  productFootprint: footprint.map(pin => ({ ...pin })),
  merge: null,
});

function buildManifest(context) {
  const contract = deriveProtocolLayers(context.products, context.options);
  const aggregates = contract.aggregates.filter(a => isProtocolLayerFlipped(a.context));
  const reachable = new Set(aggregates.map(a => a.context));
  const scanType = type => {
    if (type?.form === 'nominal') reachable.add(type.context);
    if (type?.form === 'optional' || type?.form === 'sequence') scanType(type.element);
    if (type?.form === 'map') { scanType(type.key); scanType(type.value); }
  };
  for (const agg of aggregates) {
    for (const c of agg.commands) for (const p of c.parameters) scanType(p.valueType);
    for (const h of agg.hosts) scanType(h.outputType);
    for (const p of agg.externalProducers) scanType(p.outputType);
  }
  const manifest = { ...contract, aggregates, packages: contract.packages.filter(p => reachable.has(p.context)) };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  return manifest;
}

function flipRow(produce, context, { targetPathsFor, kinds, footprint, expectedPerAggregate, rowLabel }) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;
  const flipped = layout.filter(d => d.ref?.kind === 'aggregate' && isProtocolLayerFlipped(d.ref.context));
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
    fail('the classic ' + rowLabel + ' plan must carry exactly the protocol-layer flip set: ' + replaced.length + ' of ' + targets.size + ' classic files present');

  const flipRoots = [...new Set(flipped.map(d => packageRoots.get(d.ref.context)))];
  const orphan = kept.find(e => kinds.has(e.kind) &&
    flipRoots.some(root => e.path.startsWith('app/' + root + '/')));
  if (orphan) fail('the classic ' + rowLabel + ' plan carries a protocol-layer file outside the derived contract: ' + orphan.path);

  const manifest = buildManifest(context);
  const files = renderProtocolLayerFiles(JSON.parse(JSON.stringify(manifest))).filter(f => kinds.has(f.kind));
  if (files.length !== manifest.aggregates.length * expectedPerAggregate)
    fail('the family must render exactly ' + expectedPerAggregate + ' ' + rowLabel + ' file(s) per aggregate');

  const additions = files.map(f => entryFromFile(f, footprint));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped protocol-layer file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...additions, ...kept];
}

export function withFlippedCommandProtocols(produce, context) {
  return flipRow(produce, context, {
    targetPathsFor: (packageRoot, name) => [
      ['app/' + packageRoot + '/domain/' + name + 'Protocol.scala', 'protocol'],
      ['app/' + packageRoot + '/domain/' + name + 'CommandHelpers.scala', 'command-helpers'],
    ],
    kinds: COMMAND_DSL_KINDS,
    footprint: COMMAND_DSL_FOOTPRINT,
    expectedPerAggregate: 2,
    rowLabel: 'command-dsl',
  });
}

export function withFlippedApplicationProtocols(produce, context) {
  return flipRow(produce, context, {
    targetPathsFor: (packageRoot, name) => [
      ['app/' + packageRoot + '/application/aggregates/' + name + 'Protocol.scala', 'application-protocol'],
    ],
    kinds: AGGREGATE_DSL_KINDS,
    footprint: AGGREGATE_DSL_FOOTPRINT,
    expectedPerAggregate: 1,
    rowLabel: 'aggregate-dsl',
  });
}
