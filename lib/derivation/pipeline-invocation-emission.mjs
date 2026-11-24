// Emission bridge for the flipped pipeline invocation faces (emitter-unification
// plan F4 — 逐族替换, never a wholesale switch). The play-service producer
// registry calls these wrappers around the classic host-face renderers: flipped
// business cases stop producing classic face artifacts and produce the unified
// emitter's golden-shape artifacts instead — derived from the knowledge products
// (F2 derivation) and rendered through the fail-closed family envelope. Every
// removal is exact-match and fail-closed (a classic face that is not exactly the
// expected five files refuses the flip), every added entry carries the same
// knowledge source, artifact kind and product footprint conventions as the
// classic plan, and the plan stays double-run deterministic (pure functions only).
import { derivePipelineInvocationFace, isFlipped } from './pipeline-invocation-face.mjs';
import { deriveEffectFace, isEffectFlipped, effectFaceContract, effectFlipHostClass, EFFECT_FACE_FLIPS } from './effect-face.mjs';
import { valueObjectPath } from './value-object-package.mjs';
import { getFamily, renderFamily } from '../../emitter/registry.mjs';
import '../../emitter/families/index.mjs';

const fail = message => { throw new Error('HOST_FACE_EMISSION: ' + message); };
const knowledge = source => 'source:' + source.document + '#' + source.pointer;
const requireValue = (value, what) => {
  if (value === undefined || value === null || value === '') fail(what + ' is required');
  return value;
};
const exactlyOne = (rows, what) => {
  if (!Array.isArray(rows) || rows.length !== 1) fail('exactly one ' + what + ' required, got ' + (rows?.length ?? 'none'));
  return rows[0];
};


// Golden-shape basename suffix → the declared artifact kind of the producer that
// hosts the entry (finite-host-dsl: invocation-host/saga-definition/technical-port/
// host-serialization; finite-execution-dsl: execution-plan).
const CLASSIC_HOST_SUFFIXES = Object.freeze(['Host', 'Definition', 'HostIO', 'TechnicalPorts', 'HostSerializer']);

const packageOf = (context, boundedContext) => {
  const rows = (context.options?.packages ?? []).filter(p => p.context === boundedContext);
  if (rows.length !== 1) fail('exactly one project package binding for context ' + boundedContext + ' required');
  return requireValue(rows[0].package, 'project package for context ' + boundedContext);
};
const appRoot = (context, boundedContext) => 'app/' + packageOf(context, boundedContext).replaceAll('.', '/');
const pkgRoot = (context, boundedContext) => packageOf(context, boundedContext).replaceAll('.', '/');

// Play-service product footprints per wrapped producer row (generator.json
// products with their registered versions). With the classic renderers
// skipping flipped ids, the classic plan may be empty — the footprint can no
// longer be borrowed from its first entry and is declared here instead; the
// plan-level validation still demands exact equality with the live manifest.
const SERVICE_FOOTPRINTS = {
  'finite-host-dsl': [
    { id: 'reference-layout', version: '1' }, { id: 'saga-host-contract', version: '2' },
    { id: 'saga-runtime-contract', version: '1' }, { id: 'artifact-contract', version: '3' },
    { id: 'domain-external-events', version: '2' }, { id: 'execution-contract', version: '1' },
    { id: 'effect-host-contract', version: '2' },
  ],
  // finite-execution-dsl / durable-effect-host-dsl deliberately omit
  // artifact-contract: the service wrapper's unguarded pin push appends it
  // exactly once (the historical shape of the classic entries these rows fed).
  'finite-execution-dsl': [
    { id: 'reference-layout', version: '1' }, { id: 'execution-contract', version: '1' },
    { id: 'saga-host-contract', version: '2' }, { id: 'saga-runtime-contract', version: '1' },
    { id: 'effect-host-contract', version: '2' },
  ],
  'durable-effect-host-dsl': [
    { id: 'reference-layout', version: '1' }, { id: 'effect-host-contract', version: '2' },
    { id: 'execution-contract', version: '1' },
  ],
};
const classicHostPath = (context, host, suffix) => appRoot(context, host.saga.ref.context) + '/application/' + host.id.replaceAll('-', '_') + suffix + '.scala';

// The derived contracts are pure functions of the immutable restricted product
// view; memoizing per host keeps the two planProductSet probe runs and the
// service-configuration patch consistent without recomputing.
const contracts = new Map();
function faceContract(context, hostId) {
  if (!contracts.has(hostId)) {
    contracts.set(hostId, derivePipelineInvocationFace(context.products, context.options, hostId));
  }
  return contracts.get(hostId);
}

const entry = (path, content, kind, sources, footprint, deps) => ({
  path, content, kind,
  knowledgeIds: [...new Set(sources.map(knowledge))],
  productFootprint: footprint.map(pin => ({ ...pin })),
  merge: null,
  deps,
});

/** Host-side face entries: Host, SagaDefinition, HostIO, Ports, PortBindings, HostSerializer. */
function faceHostEntries(context, host, footprint) {
  const contract = faceContract(context, host.id);
  const outputs = renderFamily(getFamily('pipeline-invocation-face'), contract);
  const source = [requireValue(host.source, 'host knowledge source')];
  const pkg = packageOf(context, contract.saga.context);
  const app = appRoot(context, contract.saga.context) + '/application';
  const executionScala = app + '/' + contract.names.executionClass + '.scala';
  const definitionScala = app + '/' + contract.names.sagaDefinitionObject + '.scala';
  const hostScala = app + '/' + contract.names.hostClass + '.scala';
  const portsScala = app + '/' + contract.names.portsTrait + '.scala';
  const bindingsScala = app + '/' + contract.names.portBindingsObject + '.scala';
  const serializerScala = app + '/' + contract.names.serializerClass + '.scala';
  const original = valueObjectPath(pkg, contract.names.originalValue);
  const args = valueObjectPath(pkg, contract.names.argsValue);
  const result = valueObjectPath(pkg, contract.names.resultValue);
  const converters = appRoot(context, contract.saga.context) + '/infrastructure/persistence/converters/DomainConverters.scala';
  const protocols = [...new Set(contract.participants.map(p => appRoot(context, contract.saga.context) + '/domain/events/' + p.aggregate + 'Events.scala'))];
  const files = [
    { path: hostScala, kind: 'invocation-host', deps: [executionScala, definitionScala, portsScala, original, args, result] },
    { path: definitionScala, kind: 'saga-definition', deps: [converters, ...protocols, executionScala, portsScala, args] },
    { path: app + '/' + contract.names.hostIoObject + '.scala', kind: 'technical-port', deps: [hostScala, portsScala, original, result] },
    { path: portsScala, kind: 'technical-port', deps: [bindingsScala, original, result] },
    { path: bindingsScala, kind: 'technical-port', deps: [portsScala, original, result] },
    { path: serializerScala, kind: 'host-serialization', deps: ['app/protobuf/' + host.id.replaceAll('-', '_') + '_host.proto', hostScala] },
  ];
  return files.map(({ path, kind, deps }) => {
    const content = outputs[path];
    if (typeof content !== 'string') fail('the emitter did not produce the expected face file ' + path);
    return entry(path, content, kind, source, footprint, deps);
  });
}

/** Execution-side face entry: the durable execution plan of the flipped pipeline. */
function faceExecutionEntry(context, host, footprint) {
  const contract = faceContract(context, host.id);
  const outputs = renderFamily(getFamily('pipeline-invocation-face'), contract);
  const path = appRoot(context, contract.saga.context) + '/application/' + contract.names.executionClass + '.scala';
  const content = outputs[path];
  if (typeof content !== 'string') fail('the emitter did not produce the expected execution file ' + path);
  const layout = requireValue(context.products['reference-layout']?.declarations, 'reference-layout declarations');
  const declaration = layout.filter(d => d.ref.context === contract.saga.context && d.ref.kind === 'pipeline' && d.ref.id === contract.saga.id);
  if (declaration.length !== 1) fail('exactly one pipeline declaration required for ' + contract.saga.id);
  return entry(path, content, 'execution-plan', [requireValue(declaration[0].source, 'pipeline knowledge source')], footprint,
    ['app/protobuf/' + contract.saga.id.replaceAll('-', '_') + '_execution.proto', appRoot(context, contract.saga.context) + '/application/' + contract.names.hostClass + '.scala']);
}

/**
 * Effect-face entries for one flipped pair case: the durable external-effect
 * host and its wire serializer (effect-host / effect-serialization kinds).
 * knowledgeIds follow the classic convention (host files carry both the
 * effectHosts and pipelines pointers, serializers the effectHosts pointer).
 */
function faceEffectEntries(context, host, footprint) {
  const contract = effectFaceContract(context);
  const outputs = renderFamily(getFamily('effect-face'), contract);
  const flip = exactlyOne(EFFECT_FACE_FLIPS.filter(f => f.host === host.id), 'effect flip manifest entry for ' + host.id);
  const caseData = exactlyOne(contract.cases.filter(c => c.case === flip.case), 'derived effect case ' + flip.case);
  const app = appRoot(context, caseData.effect.context) + '/application';
  const hostClass = caseData.names.effectHostClass;
  const executionScala = app + '/' + caseData.names.executionClass + '.scala';
  const hostScala = app + '/' + hostClass + '.scala';
  const serializerScala = app + '/' + caseData.names.serializerClass + '.scala';
  const converters = appRoot(context, caseData.effect.context) + '/infrastructure/persistence/converters/DomainConverters.scala';
  const layout = requireValue(context.products['reference-layout']?.declarations, 'reference-layout declarations');
  const pipelineDecl = exactlyOne(layout.filter(d => d.ref.context === caseData.effect.context &&
    d.ref.kind === 'pipeline' && d.ref.id === caseData.effect.sagaId), 'layout pipeline declaration ' + caseData.effect.sagaId);
  const hostSource = [requireValue(host.source, 'effect host knowledge source'), requireValue(pipelineDecl.source, 'pipeline knowledge source')];
  const files = [
    { path: hostScala, kind: 'effect-host', deps: [executionScala, converters], sources: hostSource },
    { path: serializerScala, kind: 'effect-serialization', deps: ['app/protobuf/' + flip.host.replaceAll('-', '_') + '_effect.proto', hostScala], sources: [requireValue(host.source, 'effect host knowledge source')] },
  ];
  return files.map(({ path, kind, deps, sources }) => {
    const content = outputs[path];
    if (typeof content !== 'string') fail('the emitter did not produce the expected effect file ' + path);
    return entry(path, content, kind, sources, footprint, deps);
  });
}

/**
 * Wrap a producer whose classic output includes per-host effect artifacts:
 * flipped effect hosts lose their two classic files and gain the golden-shape
 * pair. The flip unit is the PAIR (both cases or none — the family contract
 * itself carries the pair).
 */
export function withFlippedEffectHosts(produce, context) {
  const classic = produce(context);
  const hosts = context.products['effect-host-contract'].hosts.filter(h => isEffectFlipped(h.id));
  if (!hosts.length) return classic;
  if (hosts.length !== EFFECT_FACE_FLIPS.length)
    fail('the effect face flips as one pair: ' + hosts.length + ' of ' + EFFECT_FACE_FLIPS.length + ' hosts flipped');
  const footprint = SERVICE_FOOTPRINTS['durable-effect-host-dsl'];
  const kept = classic.filter(e => !hosts.some(h => {
    const stem = h.id.replaceAll('-', '_');
    return e.path === 'app/' + pkgRoot(context, h.pipeline.ref.context) + '/application/' + stem + 'EffectHost.scala' ||
      e.path === 'app/' + pkgRoot(context, h.pipeline.ref.context) + '/application/' + stem + 'EffectHostSerializer.scala';
  }));
  if (classic.length !== kept.length)
    fail('classic effect files for flipped hosts must not be produced: ' + classic.filter(e => !kept.includes(e)).map(e => e.path).join(', '));
  const additions = hosts.flatMap(h => faceEffectEntries(context, h, footprint));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped effect file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}

/** Effect-side execution entry: the durable plan face of a flipped pipeline. */
function faceEffectExecutionEntry(context, host, footprint) {
  const contract = effectFaceContract(context);
  const outputs = renderFamily(getFamily('effect-face'), contract);
  const flip = exactlyOne(EFFECT_FACE_FLIPS.filter(f => f.host === host.id), 'effect flip manifest entry for ' + host.id);
  const caseData = exactlyOne(contract.cases.filter(c => c.case === flip.case), 'derived effect case ' + flip.case);
  const path = appRoot(context, caseData.effect.context) + '/application/' + caseData.names.executionClass + '.scala';
  const content = outputs[path];
  if (typeof content !== 'string') fail('the emitter did not produce the expected effect execution file ' + path);
  const layout = requireValue(context.products['reference-layout']?.declarations, 'reference-layout declarations');
  const declaration = exactlyOne(layout.filter(d => d.ref.context === caseData.effect.context && d.ref.kind === 'pipeline' && d.ref.id === caseData.effect.sagaId),
    'layout pipeline declaration ' + caseData.effect.sagaId);
  return entry(path, content, 'execution-plan', [requireValue(declaration.source, 'pipeline knowledge source')], footprint,
    ['app/protobuf/' + caseData.effect.sagaId.replaceAll('-', '_') + '_execution.proto',
      appRoot(context, caseData.effect.context) + '/application/' + caseData.names.effectHostClass + '.scala']);
}

/**
 * Wrap a producer whose classic output includes per-pipeline execution plans:
 * flipped effect pipelines lose their classic plan file and gain the
 * golden-shape one.
 */
export function withFlippedEffectPipelines(produce, context) {
  const classic = produce(context);
  const hosts = context.products['effect-host-contract'].hosts.filter(h => isEffectFlipped(h.id));
  if (!hosts.length) return classic;
  const flippedPipelines = new Set(hosts.map(h => requireValue(h.pipeline?.ref?.id, 'effect host pipeline id')));
  const appFor = id => {
    const host = hosts.find(h => h.pipeline.ref.id === id);
    return 'app/' + pkgRoot(context, host.pipeline.ref.context) + '/application/' + id.replaceAll('-', '_') + 'Execution.scala';
  };
  const removed = [];
  const kept = classic.filter(e => {
    const owner = [...flippedPipelines].find(id => e.path === appFor(id));
    if (owner) { removed.push(owner); return false; }
    return true;
  });
  if (removed.length)
    fail('classic effect execution plans for flipped pipelines must not be produced: ' + removed.join(', '));
  // The effect executions are emitted inside the finite-execution-dsl row —
  // their footprint is that row's, not durable-effect-host-dsl's.
  const footprint = SERVICE_FOOTPRINTS['finite-execution-dsl'];
  const additions = hosts.map(h => faceEffectExecutionEntry(context, h, footprint));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped effect execution file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}

/**
 * Wrap a producer whose classic output includes per-host face artifacts: flipped
 * hosts lose their five classic files and gain the six golden-shape files.
 */
export function withFlippedInvocationHosts(produce, context) {
  const classic = produce(context);
  const hosts = context.products['saga-host-contract'].hosts.filter(h => isFlipped(h.id));
  if (!hosts.length) return classic;
  const footprint = SERVICE_FOOTPRINTS['finite-host-dsl'];
  const kept = classic.filter(e => !hosts.some(h => CLASSIC_HOST_SUFFIXES.some(suffix => e.path === classicHostPath(context, h, suffix))));
  if (classic.length !== kept.length)
    fail('classic face files for flipped hosts must not be produced: ' + classic.filter(e => !kept.includes(e)).map(e => e.path).join(', '));
  const additions = hosts.flatMap(h => faceHostEntries(context, h, footprint));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped face file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}

/**
 * Wrap a producer whose classic output includes per-pipeline execution plans:
 * flipped pipelines lose their classic plan file and gain the golden-shape one.
 */
export function withFlippedExecutionPipelines(produce, context) {
  const classic = produce(context);
  const hosts = context.products['saga-host-contract'].hosts.filter(h => isFlipped(h.id));
  if (!hosts.length) return classic;
  const flippedPipelines = new Set(hosts.map(h => requireValue(h.entry?.startOwner?.ref?.id, 'host pipeline owner')));
  const removed = [];
  const kept = classic.filter(e => {
    const owner = [...flippedPipelines].find(id => e.path === appRoot(context, hosts.find(h => h.entry.startOwner.ref.id === id).saga.ref.context) + '/application/' + id.replaceAll('-', '_') + 'Execution.scala');
    if (owner) { removed.push(owner); return false; }
    return true;
  });
  if (removed.length)
    fail('classic execution plans for flipped pipelines must not be produced: ' + removed.join(', '));
  const footprint = SERVICE_FOOTPRINTS['finite-execution-dsl'];
  const additions = hosts.map(h => faceExecutionEntry(context, h, footprint));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped execution file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}

