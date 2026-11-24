// Emission bridge for the flipped event-handler family
// (emitter-unification plan F4 — 逐族替换; rulings 2026-11-24 §21). Wraps the
// invariant-dsl row in scala-cqrs-play-service (outer to withFlippedInvariantRules):
// manifest contexts replace their classic paired event-handler entries (core +
// domain facade) with the unified emitter's curated render (no generated header;
// exact byte-level codeMappings preserved). Non-manifest projects pass through
// untouched. Pure and double-run deterministic.
import { deriveEventHandlers } from './event-handler.mjs';
import { family, renderEventHandlerFiles } from '../../emitter/families/event-handler.mjs';

const fail = message => { throw new Error('EH_EMISSION: ' + message); };

export const EVENT_HANDLER_FLIP_CONTEXTS = Object.freeze(['bankwealth']);

export const isEventHandlerFlipped = context => EVENT_HANDLER_FLIP_CONTEXTS.includes(context);

const classicCorePath = (packageRoot, name) =>
  'app/' + packageRoot + '/domain/entities/behaviors/' + name + 'EventHandler.scala';
const classicFacadePath = (packageRoot, name) =>
  'app/' + packageRoot + '/domain/' + name + 'EventHandler.scala';

// The invariant-dsl row's declared products with their compiled versions
// (generators/scala-cqrs-play-service/generate.mjs pins).
const EVENT_HANDLER_FOOTPRINT = Object.freeze([
  { id: 'reference-layout', version: '1' },
  { id: 'domain-decision', version: '4' },
  { id: 'domain-folds', version: '6' },
  { id: 'exact-value-types', version: '1' },
  { id: 'domain-dependencies', version: '6' },
]);

const knowledge = source => 'source:' + source.document + '#' + source.pointer;

const eventHandlerEntry = file => ({
  path: file.path,
  content: file.content,
  kind: file.kind,
  deps: [...file.deps],
  knowledgeIds: [...new Set([
    ...file.sources.map(knowledge),
    ...file.codeMappings.map(m => m.knowledgeKey),
  ])],
  productFootprint: EVENT_HANDLER_FOOTPRINT.map(pin => ({ ...pin })),
  merge: null,
  ...(file.codeMappings.length ? {
    codeMappings: file.codeMappings.map(m => ({
      knowledgeKey: m.knowledgeKey,
      span: { ...m.span },
      scope: { ...m.scope },
    })),
  } : {}),
});

export function withFlippedEventHandlers(produce, context) {
  const classic = produce(context);
  const layout = context.products['reference-layout']?.declarations;
  if (!Array.isArray(layout)) fail('reference-layout declarations required');
  if (!layout.length) return classic;
  const flipped = layout.filter(d => d.ref?.kind === 'aggregate' && isEventHandlerFlipped(d.ref.context));
  if (!flipped.length) return classic;

  const packageRoots = new Map((context.options?.packages ?? []).map(p => [p.context, p.package.replaceAll('.', '/')]));
  const targets = new Map();
  for (const declaration of flipped) {
    const packageRoot = packageRoots.get(declaration.ref.context);
    if (!packageRoot) fail('missing package binding for flip context ' + declaration.ref.context);
    const tag = declaration.ref.context + '/' + declaration.ref.id;
    targets.set(classicCorePath(packageRoot, declaration.ref.id), tag + ':core');
    targets.set(classicFacadePath(packageRoot, declaration.ref.id), tag + ':facade');
  }

  const kept = [];
  const replaced = [];
  for (const entry of classic) {
    if (targets.has(entry.path)) { replaced.push(entry.path); continue; }
    kept.push(entry);
  }
  if (replaced.length !== targets.size)
    fail('the classic invariant plan must carry exactly the event-handler flip set: ' + replaced.length + ' of ' + targets.size + ' classic files present');

  const flipRoots = [...new Set(flipped.map(d => packageRoots.get(d.ref.context)))];
  const orphan = kept.find(e => e.kind === 'event-handler' &&
    flipRoots.some(root => e.path.startsWith('app/' + root + '/domain/')));
  if (orphan) fail('the classic invariant plan carries an event-handler file outside the derived contract: ' + orphan.path);

  const contract = deriveEventHandlers(context.products, context.options);
  const handlers = contract.handlers.filter(h => isEventHandlerFlipped(h.context));
  const reachable = new Set(handlers.map(h => h.context));
  const manifest = {
    ...contract,
    handlers,
    packages: contract.packages.filter(p => reachable.has(p.context)),
  };
  family.checkInput(JSON.parse(JSON.stringify(manifest)));
  const files = renderEventHandlerFiles(JSON.parse(JSON.stringify(manifest)));
  if (files.length !== manifest.handlers.length)
    fail('the family must render exactly one event-handler file per aggregate');

  const additions = files.map(eventHandlerEntry);
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped event-handler file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}
