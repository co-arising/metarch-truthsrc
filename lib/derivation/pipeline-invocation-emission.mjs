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
import { derivePipelineInvocationFace } from './pipeline-invocation-face.mjs';
import { effectFaceContract } from './effect-face.mjs';
import { isUnifiedContext } from './emission-policy.mjs';
import { valueObjectPath } from './value-object-package.mjs';
import { protoSchemaPath, scalaSubpackagePath, workflowSubpackageSlug } from '../layout/layout-strategy.mjs';
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
const classicHostPath = (context, host, suffix) =>
  scalaSubpackagePath(packageOf(context, host.saga.ref.context), 'application', host.id.replaceAll('-', '_') + suffix + '.scala');

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

/** Host-side face entries across application.process.<flow>, infrastructure.process, infrastructure.persistence, infrastructure.bootstrap. */
function faceHostEntries(context, host, footprint) {
  const contract = faceContract(context, host.id);
  const outputs = renderFamily(getFamily('pipeline-invocation-face'), contract);
  const source = [requireValue(host.source, 'host knowledge source')];
  const pkg = packageOf(context, contract.saga.context);
  const flowSubpkg = 'application.process.' + workflowSubpackageSlug(contract.saga.id);
  const executionScala = scalaSubpackagePath(pkg, flowSubpkg, contract.names.executionClass + '.scala');
  const stateCodecScala = scalaSubpackagePath(pkg, 'infrastructure.persistence', contract.names.executionClass.replace(/Execution$/, 'StateCodec') + '.scala');
  const processCodecsScala = scalaSubpackagePath(pkg, 'infrastructure.persistence', contract.names.hostClass.replace(/Host$/, 'ProcessCodecs') + '.scala');
  const processBootstrapScala = scalaSubpackagePath(pkg, 'infrastructure.bootstrap', contract.names.hostClass.replace(/Host$/, 'ProcessBootstrap') + '.scala');
  const definitionScala = scalaSubpackagePath(pkg, flowSubpkg, contract.names.sagaDefinitionObject + '.scala');
  const hostScala = scalaSubpackagePath(pkg, 'infrastructure.process', contract.names.hostClass + '.scala');
  const hostIoScala = scalaSubpackagePath(pkg, 'infrastructure.process', contract.names.hostIoObject + '.scala');
  const portsScala = scalaSubpackagePath(pkg, flowSubpkg, contract.names.portsTrait + '.scala');
  const bindingsScala = scalaSubpackagePath(pkg, 'infrastructure.bootstrap', contract.names.portBindingsObject + '.scala');
  const serializerScala = scalaSubpackagePath(pkg, 'infrastructure.persistence', contract.names.serializerClass + '.scala');
  const original = valueObjectPath(pkg, contract.names.originalValue);
  const args = valueObjectPath(pkg, contract.names.argsValue);
  const result = valueObjectPath(pkg, contract.names.resultValue);
  const converters = scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', 'DomainConverters.scala');
  const protocols = [...new Set(contract.participants.map(p => scalaSubpackagePath(pkg, 'domain.invariants.params', p.aggregate + 'RuleParams.scala')))];
  const files = [
    { path: hostScala, kind: 'invocation-host', deps: [...new Set([executionScala, definitionScala, original, args, result])] },
    { path: definitionScala, kind: 'saga-definition', deps: [...new Set([...protocols, portsScala, args])] },
    { path: hostIoScala, kind: 'technical-port', deps: [...new Set([hostScala, portsScala, original, result])] },
    { path: portsScala, kind: 'technical-port', deps: [...new Set([original, result])] },
    { path: bindingsScala, kind: 'technical-port', deps: [...new Set([portsScala, original, result])] },
    { path: processCodecsScala, kind: 'host-serialization', deps: [...new Set([definitionScala, converters, args])] },
    { path: serializerScala, kind: 'host-serialization', deps: [protoSchemaPath(host.id.replaceAll('-', '_') + '_host.proto'), hostScala] },
    { path: processBootstrapScala, kind: 'invocation-host', deps: [hostScala, hostIoScala, definitionScala, executionScala, portsScala, stateCodecScala, processCodecsScala] },
  ];
  return files.map(({ path, kind, deps }) => {
    const content = outputs[path];
    if (typeof content !== 'string') fail('the emitter did not produce the expected face file ' + path);
    return entry(path, content, kind, source, footprint, deps);
  });
}

/** Execution-side face entries: pure process execution plan + persistence state codec. */
function faceExecutionEntries(context, host, footprint) {
  const contract = faceContract(context, host.id);
  const outputs = renderFamily(getFamily('pipeline-invocation-face'), contract);
  const pkg = packageOf(context, contract.saga.context);
  const flowSubpkg = 'application.process.' + workflowSubpackageSlug(contract.saga.id);
  const executionPath = scalaSubpackagePath(pkg, flowSubpkg, contract.names.executionClass + '.scala');
  const stateCodecPath = scalaSubpackagePath(pkg, 'infrastructure.persistence', contract.names.executionClass.replace(/Execution$/, 'StateCodec') + '.scala');
  const converters = scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', 'DomainConverters.scala');
  const layout = requireValue(context.products['reference-layout']?.declarations, 'reference-layout declarations');
  const declaration = layout.filter(d => d.ref.context === contract.saga.context && d.ref.kind === 'pipeline' && d.ref.id === contract.saga.id);
  if (declaration.length !== 1) fail('exactly one pipeline declaration required for ' + contract.saga.id);
  const sources = [requireValue(declaration[0].source, 'pipeline knowledge source')];
  const files = [
    { path: executionPath, deps: [] },
    { path: stateCodecPath, deps: [protoSchemaPath(contract.saga.id.replaceAll('-', '_') + '_execution.proto'), executionPath, converters] },
  ];
  return files.map(({ path, deps }) => {
    const content = outputs[path];
    if (typeof content !== 'string') fail('the emitter did not produce the expected execution file ' + path);
    return entry(path, content, 'execution-plan', sources, footprint, deps);
  });
}

/**
 * Effect-face entries for one flipped pair case across application.connectors (Gateway),
 * infrastructure.connectors (EffectHost), infrastructure.persistence, and infrastructure.bootstrap.
 */
function faceEffectEntries(context, host, footprint) {
  const contract = effectFaceContract(context);
  const outputs = renderFamily(getFamily('effect-face'), contract);
  const caseData = exactlyOne(contract.cases.filter(c => c.effect.hostId === host.id), 'derived effect case for ' + host.id);
  const pkg = packageOf(context, caseData.effect.context);
  const flowSubpkg = 'application.process.' + workflowSubpackageSlug(caseData.effect.sagaId);
  const hostClass = caseData.names.effectHostClass;
  const gatewayClass = hostClass.replace(/(?:Effect)?Host$/, 'Gateway');
  const executionScala = scalaSubpackagePath(pkg, flowSubpkg, caseData.names.executionClass + '.scala');
  const stateCodecScala = scalaSubpackagePath(pkg, 'infrastructure.persistence', caseData.names.executionClass.replace(/Execution$/, 'StateCodec') + '.scala');
  const gatewayScala = scalaSubpackagePath(pkg, 'application.connectors', gatewayClass + '.scala');
  const hostScala = scalaSubpackagePath(pkg, 'infrastructure.connectors', hostClass + '.scala');
  const bootstrapScala = scalaSubpackagePath(pkg, 'infrastructure.bootstrap', hostClass.replace(/Host$/, 'Bootstrap') + '.scala');
  const serializerScala = scalaSubpackagePath(pkg, 'infrastructure.persistence', caseData.names.serializerClass + '.scala');
  const layout = requireValue(context.products['reference-layout']?.declarations, 'reference-layout declarations');
  const pipelineDecl = exactlyOne(layout.filter(d => d.ref.context === caseData.effect.context &&
    d.ref.kind === 'pipeline' && d.ref.id === caseData.effect.sagaId), 'layout pipeline declaration ' + caseData.effect.sagaId);
  const hostSource = [requireValue(host.source, 'effect host knowledge source'), requireValue(pipelineDecl.source, 'pipeline knowledge source')];
  const files = [
    { path: gatewayScala, kind: 'effect-host', deps: [], sources: hostSource },
    { path: hostScala, kind: 'effect-host', deps: [gatewayScala, executionScala], sources: hostSource },
    { path: bootstrapScala, kind: 'effect-host', deps: [hostScala, executionScala, stateCodecScala], sources: hostSource },
    { path: serializerScala, kind: 'effect-serialization', deps: [protoSchemaPath(host.id.replaceAll('-', '_') + '_effect.proto'), hostScala], sources: [requireValue(host.source, 'effect host knowledge source')] },
  ];
  return files.map(({ path, kind, deps, sources }) => {
    const content = outputs[path];
    if (typeof content !== 'string') fail('the emitter did not produce the expected effect file ' + path);
    return entry(path, content, kind, sources, footprint, deps);
  });
}

/**
 * Wrap a producer whose classic output includes per-host effect artifacts:
 * unified effect hosts lose their two classic files and gain the golden-shape
 * artifacts.
 */
export function withFlippedEffectHosts(produce, context) {
  const classic = produce(context);
  const hosts = context.products['effect-host-contract'].hosts.filter(h => isUnifiedContext(h.pipeline?.ref?.context, context.options));
  if (!hosts.length) return classic;
  const footprint = SERVICE_FOOTPRINTS['durable-effect-host-dsl'];
  const kept = classic.filter(e => !hosts.some(h => {
    const stem = h.id.replaceAll('-', '_');
    const pkg = packageOf(context, h.pipeline.ref.context);
    return e.path === scalaSubpackagePath(pkg, 'application', stem + 'EffectHost.scala') ||
      e.path === scalaSubpackagePath(pkg, 'application', stem + 'EffectHostSerializer.scala');
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

/** Effect-side execution entries: pure integration execution plan + persistence state codec. */
function faceEffectExecutionEntries(context, host, footprint) {
  const contract = effectFaceContract(context);
  const outputs = renderFamily(getFamily('effect-face'), contract);
  const caseData = exactlyOne(contract.cases.filter(c => c.effect.hostId === host.id), 'derived effect case for ' + host.id);
  const pkg = packageOf(context, caseData.effect.context);
  const flowSubpkg = 'application.process.' + workflowSubpackageSlug(caseData.effect.sagaId);
  const executionPath = scalaSubpackagePath(pkg, flowSubpkg, caseData.names.executionClass + '.scala');
  const stateCodecPath = scalaSubpackagePath(pkg, 'infrastructure.persistence', caseData.names.executionClass.replace(/Execution$/, 'StateCodec') + '.scala');
  const converters = scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', 'DomainConverters.scala');
  const layout = requireValue(context.products['reference-layout']?.declarations, 'reference-layout declarations');
  const declaration = exactlyOne(layout.filter(d => d.ref.context === caseData.effect.context && d.ref.kind === 'pipeline' && d.ref.id === caseData.effect.sagaId),
    'layout pipeline declaration ' + caseData.effect.sagaId);
  const sources = [requireValue(declaration.source, 'pipeline knowledge source')];
  const files = [
    { path: executionPath, deps: [] },
    { path: stateCodecPath, deps: [protoSchemaPath(caseData.effect.sagaId.replaceAll('-', '_') + '_execution.proto'), executionPath, converters] },
  ];
  return files.map(({ path, deps }) => {
    const content = outputs[path];
    if (typeof content !== 'string') fail('the emitter did not produce the expected effect execution file ' + path);
    return entry(path, content, 'execution-plan', sources, footprint, deps);
  });
}

/**
 * Wrap a producer whose classic output includes per-pipeline execution plans:
 * unified effect pipelines lose their classic plan file and gain the
 * golden-shape pair (application.process + infrastructure.persistence).
 */
export function withFlippedEffectPipelines(produce, context) {
  const classic = produce(context);
  const hosts = context.products['effect-host-contract'].hosts.filter(h => isUnifiedContext(h.pipeline?.ref?.context, context.options));
  if (!hosts.length) return classic;
  const flippedPipelines = new Set(hosts.map(h => requireValue(h.pipeline?.ref?.id, 'effect host pipeline id')));
  const appFor = id => {
    const host = hosts.find(h => h.pipeline.ref.id === id);
    return scalaSubpackagePath(packageOf(context, host.pipeline.ref.context), 'application', id.replaceAll('-', '_') + 'Execution.scala');
  };
  const removed = [];
  const kept = classic.filter(e => {
    const owner = [...flippedPipelines].find(id => e.path === appFor(id));
    if (owner) { removed.push(owner); return false; }
    return true;
  });
  if (removed.length)
    fail('classic effect execution plans for flipped pipelines must not be produced: ' + removed.join(', '));
  const footprint = SERVICE_FOOTPRINTS['finite-execution-dsl'];
  const additions = hosts.flatMap(h => faceEffectExecutionEntries(context, h, footprint));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped effect execution file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}

/**
 * Wrap a producer whose classic output includes per-host face artifacts: unified
 * hosts lose their classic files and gain the three-layer golden-shape files.
 */
export function withFlippedInvocationHosts(produce, context) {
  const classic = produce(context);
  const hosts = context.products['saga-host-contract'].hosts.filter(h =>
    h.entry?.startOwner?.kind === 'pipeline' && isUnifiedContext(h.saga?.ref?.context, context.options));
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
 * unified pipelines lose their classic plan file and gain the
 * golden-shape pair (application.process + infrastructure.persistence).
 */
export function withFlippedExecutionPipelines(produce, context) {
  const classic = produce(context);
  const hosts = context.products['saga-host-contract'].hosts.filter(h =>
    h.entry?.startOwner?.kind === 'pipeline' && isUnifiedContext(h.saga?.ref?.context, context.options));
  if (!hosts.length) return classic;
  const flippedPipelines = new Set(hosts.map(h => requireValue(h.entry?.startOwner?.ref?.id, 'host pipeline owner')));
  const removed = [];
  const kept = classic.filter(e => {
    const owner = [...flippedPipelines].find(id =>
      e.path === scalaSubpackagePath(packageOf(context, hosts.find(h => h.entry.startOwner.ref.id === id).saga.ref.context), 'application', id.replaceAll('-', '_') + 'Execution.scala'));
    if (owner) { removed.push(owner); return false; }
    return true;
  });
  if (removed.length)
    fail('classic execution plans for flipped pipelines must not be produced: ' + removed.join(', '));
  const footprint = SERVICE_FOOTPRINTS['finite-execution-dsl'];
  const additions = hosts.flatMap(h => faceExecutionEntries(context, h, footprint));
  const paths = new Set(kept.map(e => e.path));
  for (const added of additions) {
    if (paths.has(added.path)) fail('the flipped execution file collides with a classic plan path: ' + added.path);
    paths.add(added.path);
  }
  return [...kept, ...additions];
}

