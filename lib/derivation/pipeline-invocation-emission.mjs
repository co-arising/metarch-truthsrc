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
import { getFamily, renderFamily } from '../../emitter/registry.mjs';
import '../../emitter/families/index.mjs';

const fail = message => { throw new Error('HOST_FACE_EMISSION: ' + message); };
const knowledge = source => 'source:' + source.document + '#' + source.pointer;
const requireValue = (value, what) => {
  if (value === undefined || value === null || value === '') fail(what + ' is required');
  return value;
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
  const app = appRoot(context, contract.saga.context) + '/application';
  const values = appRoot(context, contract.saga.context) + '/domain/values';
  const executionScala = app + '/' + contract.names.executionClass + '.scala';
  const definitionScala = app + '/' + contract.names.sagaDefinitionObject + '.scala';
  const hostScala = app + '/' + contract.names.hostClass + '.scala';
  const portsScala = app + '/' + contract.names.portsTrait + '.scala';
  const bindingsScala = app + '/' + contract.names.portBindingsObject + '.scala';
  const serializerScala = app + '/' + contract.names.serializerClass + '.scala';
  const original = values + '/' + contract.names.originalValue + '.scala';
  const args = values + '/' + contract.names.argsValue + '.scala';
  const result = values + '/' + contract.names.resultValue + '.scala';
  const converters = appRoot(context, contract.saga.context) + '/infrastructure/serialization/DomainConverters.scala';
  const protocols = [...new Set(contract.participants.map(p => appRoot(context, contract.saga.context) + '/domain/' + p.aggregate + 'Protocol.scala'))];
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
 * Wrap a producer whose classic output includes per-host face artifacts: flipped
 * hosts lose their five classic files and gain the six golden-shape files.
 */
export function withFlippedInvocationHosts(produce, context) {
  const classic = produce(context);
  const hosts = context.products['saga-host-contract'].hosts.filter(h => isFlipped(h.id));
  if (!hosts.length) return classic;
  const footprint = requireValue(classic[0]?.productFootprint, 'classic plan product footprint');
  const kept = classic.filter(e => !hosts.some(h => CLASSIC_HOST_SUFFIXES.some(suffix => e.path === classicHostPath(context, h, suffix))));
  const expectedRemovals = hosts.length * CLASSIC_HOST_SUFFIXES.length;
  if (classic.length - kept.length !== expectedRemovals)
    fail('the flip must remove exactly ' + expectedRemovals + ' classic face files, matched ' + (classic.length - kept.length));
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
  if (removed.length !== flippedPipelines.size)
    fail('the flip must remove exactly ' + flippedPipelines.size + ' classic execution plans, matched ' + removed.length);
  const footprint = requireValue(classic[0]?.productFootprint, 'classic plan product footprint');
  const additions = hosts.map(h => faceExecutionEntry(context, h, footprint));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped execution file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}

