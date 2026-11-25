// Derivation layer: knowledge products → truthsrc.effect-face-input/v1
// (emitter-unification plan F2, family #44).
//
// The curated effect contract (test/reference/curated/effect-face/v1/
// technical-input.json) is the family spec (F3) for both cases — dispatch and
// ta flip as ONE emission unit, because the family contract itself carries the
// pair (validate requires exactly two cases; the one effect-host shape serves
// both, per-case knowledge only). Every case-varying slot derives from the
// compiled product payloads (effect-host-contract, execution-contract,
// reference-layout) plus the project package options; the case-independent
// face shape (ObservationStatus/ReconcileDecision ADTs, R-group runtime slots,
// the message inventories, layout discipline, provenance annotations) and the
// per-case doc prose (hand-balanced golden lines, both cases golden-backed)
// are declared face knowledge below. Acceptance: the derived contract
// deep-equals the curated contract, and the emitter renders the six golden
// bytes from it. Every derivation step fails closed with a diagnostic.

const fail = message => { throw new Error('EFFECT_FACE_DERIVATION: ' + message); };
const requireValue = (value, what) => {
  if (value === undefined || value === null || value === '') fail(what + ' is required by the face contract');
  return value;
};
const exactlyOne = (rows, what) => {
  if (!Array.isArray(rows) || rows.length !== 1) fail('exactly one ' + what + ' required, got ' + (rows?.length ?? 'none'));
  return rows[0];
};
const kebab = (value, what) => {
  if (typeof value !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) fail(what + ' must be a kebab-case identifier: ' + JSON.stringify(value));
  return value;
};
const pascalWords = value => kebab(value, 'name source').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
const refKey = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);

// Per-case flip manifest: the pair is the emission unit (F4, ruled) — one
// commit flips both. identityKeyNoun is the doc-facing key word of the
// operation identity; docs are the per-case curated golden lines (both cases
// golden-backed, verbatim per artifact).
export const EFFECT_FACE_FLIPS = Object.freeze([
  Object.freeze({
    host: 'bank-sip-dispatch',
    pipeline: 'bank-sip-dispatch-v1',
    case: 'dispatch',
    identityKeyNoun: 'occurrence',
    declarationNoun: 'pipeline',
  }),
  Object.freeze({
    host: 'bank-ta-effect',
    pipeline: 'bank-ta-submission-v1',
    case: 'ta',
    identityKeyNoun: 'request',
    declarationNoun: 'saga',
  }),
]);

export function isEffectFlipped(hostId) {
  return EFFECT_FACE_FLIPS.some(flip => flip.host === hostId);
}

// Retirement registry view: the pipeline ids whose classic execution-plan path
// is retired (ruling 2026-11-23 — flipped ids' classic templates are globally
// unreachable; the unified face is the only emitter for them).
export function isFlippedEffectPipeline(pipelineId) {
  return EFFECT_FACE_FLIPS.some(flip => flip.pipeline === pipelineId);
}

// Face knowledge (ruled, case-independent) — the one effect-host shape.
const FACE = Object.freeze({
  observationStatus: Object.freeze({
    wires: Object.freeze(['confirmed', 'rejected', 'failed', 'absent', 'unknown']),
    source: 'knowledge: observation domain value status slot',
  }),
  retry: Object.freeze({
    initialMillis: 100, factor: 2, maxMillis: 5000, deadlineSeconds: 60, // judged slots (R1)
    source: 'judged slot (R1), shared with the invocation face',
  }),
  admission: Object.freeze({
    contract: 'R2(b): in-memory waiter coalescing; replies derived from durable state on re-invoke; caller owns ask timeout + retry',
  }),
  logging: 'R4: debug points at execute-attempt/observation-stored/retry-authorized/reconcile-denied',
  layout: Object.freeze({ columnLimit: 120, discipline: 'L1: hand-balanced breaks, each frozen shape documented at its site' }),
  serializerManifest: 'effect-event-v1',
  serializerManifestSource: 'judged: the shared manifest token of the two effect serializers',
  reconcileDecisions: Object.freeze([
    Object.freeze({ decision: 'Query', wire: 'query' }),
    Object.freeze({ decision: 'Retry', wire: 'retry' }),
  ]),
  reconcileDecisionsSource: 'knowledge: the authorized reconcile commands of the effect-host shape',
  messagesSource: 'knowledge: reply reasons, require guards and refusal texts of the one effect-host shape',
  executionMessagesSource: null, // kept beside executionMessages below
  messages: Object.freeze({
    completeExternalInputRequired: 'complete durable external input required',
    stableIdentityRequired: 'stable initial external identity required',
    unknownObservationStatus: 'unknown external observation status',
    completeObservationRequired: 'complete same-operation same-request effect observation required',
    fullResultAndEvidenceRequired: 'full durable result and evidence required',
    authoritativeEvidenceRequired: 'authoritative non-success or absent evidence required',
    unknownIsNotAResult: 'unknown is not a result',
    carriesNoRunFace: 'effect implementation $id carries no run face',
    completeBindingsRequired: 'complete effect callback bindings required',
    identityMismatchFor: 'effect implementation identity mismatch for',
    versionMismatchFor: 'effect implementation version mismatch for',
    conflictDifferentInput: 'different complete original input under effect identity',
    outcomeUnknownPending: 'effect outcome remains unknown or absent; no implicit retry',
    optionalQueryObservationRequired: 'optional query observation required',
    reconcileRetainsDurable: 'reconcile must retain exact durable original and operation',
    reconcileRequiresAuthority: 'reconcile requires authority and durable absent or unknown evidence',
    reconciliationNotAuthorized: 'reconciliation not authorized',
    effectHostEventRequired: 'effect host event required',
    exactManifestRequired: 'exact effect event manifest required',
    exactPayloadVersionRequired: 'exact effect event payload version required',
    unknownEffectEventKind: 'unknown effect event kind',
  }),
  executionMessages: Object.freeze({
    unconfirmedPredecessorOutput: 'unconfirmed predecessor output',
    exactPlanVersionRequired: 'exact finite plan version required',
    missingDurableInput: 'missing durable input $name',
    exactEffectHostActorRequired: 'the exact effect host actor is required',
    stageDeadlineExceeded: 'stage deadline exceeded',
    ownedInvocationObserverStopped: 'owned invocation observer stopped',
    explicitOwnedFiniteExecutionRequired: 'explicit owned finite execution and installed objects required',
    unknownStaticStep: 'unknown static step',
  }),
  supply: Object.freeze({
    serializationObject: 'DomainConverters',
    monarchPersistencePackage: 'net.imadz.monarch.persistence',
    source: 'knowledge: bankwealth supply tree (proven by the compile-face rounds)',
  }),
  bindingsBoundary: 'handwritten-composition-root',
  bindingsSource: 'knowledge: effect-hosts product obligations',
  eventPbSource: 'knowledge: effect proto face schema; judged: identifier allocation',
  identifierBase: 744000, // judged: allocation band per classic render-effect-support
  contextSource: 'knowledge: bounded-context token of the durable operation identity',
  identityKeyNounSource: 'knowledge: the doc-facing key word of the operation identity',
  executionSourceNoun: 'knowledge: pipeline declaration + execution plan product',
  executionSourceNounSaga: 'knowledge: saga declaration + execution plan product',
});

// The per-case curated doc lines — both cases golden-backed (verbatim per
// artifact per case; the emitter emits them as data). Serializer prose is the
// one shared shape.
const SERIALIZER_DOC = Object.freeze([
  '/** Wire codec of the effect-host event journal. Event identities stay the',
  '  * declared protobuf shapes (the proto face owns the schema). Unknown event',
  '  * kinds refuse to deserialize; the payload version is pinned. */',
]);
const EXECUTION_DOCS = Object.freeze({
  dispatch: Object.freeze([
    '/** Durable execution plan of the SIP dispatch pipeline: one stage,',
    '  * `dispatch-cash`, which hands a durable SIP occurrence to the effect host',
    '  * and folds its authoritative result into the plan state. Stage outcomes are',
    '  * the monarch contract: Refused is a business rejection, Unavailable and',
    '  * Unknown demand manual recovery — never an implicit retry. */',
  ]),
  ta: Object.freeze([
    '/** Durable execution plan of the TA submission pipeline: one stage,',
    '  * `submit-ta`, which hands a paid fund order to the TA effect host and folds',
    '  * its authoritative result into the plan state. Stage outcomes are the',
    '  * monarch contract: Refused is a business rejection, Unavailable and Unknown',
    '  * demand manual recovery — never an implicit retry. */',
  ]),
});
const HOST_DOCS = Object.freeze({
  dispatch: Object.freeze([
    '/** Durable external-effect host of the SIP dispatch pipeline: owns the intent,',
    '  * the observed external evidence and the authorized retry, for exactly one',
    '  * dispatch operation.',
    '  *',
    '  * Semantics contracts:',
    '  * - Invoke is idempotent: the same complete input under the same operation',
    '  *   identity is coalesced; a different input under a live effect is a',
    '  *   Conflict. Every reply is derived from durable state, so a caller that',
    '  *   re-invokes after any crash recovers its answer (R2: reply targets are',
    '  *   in-memory coalesced and never persisted; caller-side ask timeout and',
    '  *   retry are part of the contract).',
    '  * - No implicit retry: an unobserved effect answers Pending. A retry happens',
    '    * only through Reconcile with explicit authorization and durable absent',
    '    * evidence; the observation is cleared on the authorized retry (the journal',
    '    * keeps the full evidence history) so stale evidence can never answer',
    '    * during the retry window (R3).',
    '  * - Observation validation is fail-closed: an unknown status wire refuses. */',
  ]),
  ta: Object.freeze([
    '/** Durable external-effect host of the TA submission pipeline: owns the',
    '  * intent, the observed TA evidence and the authorized retry, for exactly one',
    '  * submission operation.',
    '  *',
    '  * Semantics contracts (identical to the dispatch effect host — the effect',
    '  * face\'s one shape, per-case knowledge):',
    '  * - Invoke is idempotent; every reply derives from durable state (R2:',
    '    * waiters are in-memory coalesced, never persisted; callers own ask',
    '    * timeout and retry).',
    '  * - No implicit retry; Reconcile demands explicit authorization and durable',
    '    * absent evidence; the authorized retry clears the observation (the',
    '    * journal keeps the evidence history) so stale evidence cannot answer',
    '    * during the retry window (R3).',
    '  * - Observation validation is fail-closed: an unknown status wire refuses. */',
  ]),
});

function caseDocs(caseName) {
  return { execution: [...EXECUTION_DOCS[caseName]], host: [...HOST_DOCS[caseName]], serializer: [...SERIALIZER_DOC] };
}

const scalarOf = resolved => resolved.form === 'nominal'
  ? requireValue(resolved.ref.id, 'nominal type id')
  : { string: 'String', boolean: 'Boolean', integer: 'Long', decimal: 'BigDecimal' }[resolved.name];

function resolveType(layout, id) {
  // Effect inputs are domain values by construction (the durable external
  // input carries an identity encoding); no runtime-scalar fallback — the
  // durable-effect-host producer view does not declare the saga runtime.
  const rows = layout.filter(d => d.ref.context === 'bankwealth' && d.ref.kind === 'type' && d.ref.id === id);
  if (rows.length === 1) return { form: 'nominal', ref: rows[0].ref };
  fail('complete nominal type declaration required for ' + id);
}

function packageForContext(options, context) {
  const rows = (options?.packages ?? []).filter(p => p.context === context);
  const row = exactlyOne(rows, 'project package binding for context ' + context);
  return requireValue(row.package, 'project package for context ' + context);
}

/**
 * Derive the family input contract for the flipped effect-face pair.
 * @param products the compiled product payloads, keyed like the producer view
 * @param options the project options (options.packages explicit per context)
 */
export function deriveEffectFace(products, options) {
  const hosts = requireValue(products['effect-host-contract']?.hosts, 'effect-host-contract hosts');
  const layout = requireValue(products['reference-layout']?.declarations, 'reference-layout declarations');

  const cases = EFFECT_FACE_FLIPS.map(flip => {
    const host = exactlyOne(hosts.filter(h => h.id === flip.host), 'effect host ' + flip.host);
    const context = requireValue(host.pipeline?.ref?.context, 'effect host bounded context');
    const pkg = packageForContext(options, context);
    const pipelineId = kebab(requireValue(host.pipeline?.ref?.id, 'effect host pipeline id'), 'pipeline id');
    const pipeline = exactlyOne((products['execution-contract']?.pipelines ?? []).filter(p => p.id === pipelineId),
      'execution pipeline ' + pipelineId);
    const pipelineDecl = exactlyOne(layout.filter(d => d.ref.context === context && d.ref.kind === 'pipeline' && d.ref.id === pipelineId),
      'layout pipeline declaration ' + pipelineId);
    void pipelineDecl;
    const scalars = id => scalarOf(resolveType(layout, id));

    const hostClass = pascalWords(kebab(flip.host, 'host id'));
    const effectHostClass = hostClass.endsWith('Effect') ? hostClass + 'Host' : hostClass + 'EffectHost'; // N1 dedup
    if (flip.host === 'bank-ta-effect' && effectHostClass !== 'BankTaEffectHost')
      fail('the ta N1 dedup must not stutter: ' + effectHostClass);
    const executionBase = pascalWords(pipelineId.replace(/-v\d+$/, ''));
    const write = exactlyOne(pipeline.steps.flatMap(s => s.writes ?? []), 'pipeline write');
    if (pipeline.steps.flatMap(s => s.writes ?? []).length !== 1) fail('the effect face carries exactly one stage write');
    const step = pipeline.steps[0];
    if (step.id !== host.stepId) fail('the effect host step must be the pipeline step');

    const execution = {
      stageId: kebab(host.stepId, 'effect host step id'),
      planVersion: requireValue(pipeline.recovery?.planVersion, 'pipeline recovery plan version'),
      executionStatePb: pkg + '.infrastructure.executionproto.' + pipelineId.replaceAll('-', '') + 'ExecutionStatePB',
      codecSlots: [
        ...pipeline.inputs.map((i, index) => ({ slot: 'input' + index, field: i.id, type: scalars(i.type), optional: false })),
        { slot: 'output0', field: write.id, type: scalars(write.type), optional: true },
      ],
      resultCases: step.outcomes.map(o => o.action === 'continue'
        ? { case: pascalWords(step.id) + o.code, slot: write.id, terminal: 'stage-success' }
        : { case: pascalWords(step.id) + o.code, stageError: requireValue(o.kind, 'outcome kind') + ':' + requireValue(o.code, 'outcome code') + ':' + requireValue(o.action, 'outcome action') }),
      source: flip.declarationNoun === 'saga' ? FACE.executionSourceNounSaga : FACE.executionSourceNoun,
      inputs: pipeline.inputs.map(i => ({ name: i.id, type: scalars(i.type) })),
    };

    const ports = requireValue(host.technicalPorts, 'effect host technical ports');
    if (ports.map(p => p.role).join(',') !== 'execute,query,reconcile')
      fail('the effect face requires exactly the execute, query, reconcile roles in order');
    const effect = {
      sagaId: pipelineId,
      artifactVersion: requireValue(host.version, 'effect host version'),
      hostId: kebab(flip.host, 'effect host id'),
      stepId: kebab(host.stepId, 'effect host step id'),
      participantStep: requireValue(host.port, 'effect host port'),
      identityKeySlot: 'inputs.' + requireValue(host.identity?.slot, 'effect identity slot'),
      requestValue: requireValue(host.requestType?.ref?.id, 'effect request value type'),
      operationValue: requireValue(host.operationType?.ref?.id, 'effect operation value type'),
      observationValue: requireValue(host.observationType?.ref?.id, 'effect observation value type'),
      reconcileValue: requireValue(host.reconcileType?.ref?.id, 'effect reconcile value type'),
      bindings: {
        declaredIds: ports.map(p => requireValue(p.implementation?.id, 'port implementation id')),
        roles: ports.map(p => requireValue(p.role, 'port role')),
        artifact: requireValue(ports[0].owner?.ref?.id, 'port owner artifact'),
        implementationVersion: requireValue(ports[0].implementation?.version, 'port implementation version'),
        boundary: FACE.bindingsBoundary,
        source: FACE.bindingsSource,
      },
      eventPb: pkg + '.infrastructure.effectproto.' + flip.host.replaceAll('-', '') + 'EffectHostEventPB',
      serializerIdentifier: FACE.identifierBase + hosts.findIndex(h => h.id === flip.host),
      source: FACE.eventPbSource,
      context,
      contextSource: FACE.contextSource,
      identityKeyNoun: flip.identityKeyNoun,
      identityKeyNounSource: FACE.identityKeyNounSource,
    };
    if (new Set(effect.bindings.declaredIds).size !== 3) fail('the three effect implementations must carry distinct declared ids');
    if (!effect.bindings.declaredIds.every(id => id.startsWith(context + '.' + effectHostClass.replace(/EffectHost$/, ''))))
      fail('effect implementations must carry the declared identity stem ' + context + '.' + effectHostClass.replace(/EffectHost$/, ''));
    if (effect.artifactVersion !== pipeline.version && pipeline.version !== undefined && effect.artifactVersion !== host.version)
      fail('the effect host version must be the admitted artifact version');

    return {
      case: flip.case,
      names: {
        executionClass: executionBase + 'Execution',
        effectHostClass,
        serializerClass: effectHostClass + 'Serializer',
        package: pkg + '.application.connectors',
        nameSources: {
          executionClass: flip.declarationNoun === 'saga'
            ? 'saga id ' + pipelineId
            : 'pipeline id ' + pipelineId + ' (the durable plan face of that pipeline)',
          effectHostClass: flip.case === 'ta'
            ? 'host id bank-ta-effect + EffectHost suffix with stem/suffix dedup (N1: BankTaEffectEffectHost stutters)'
            : 'host id ' + flip.host + ' + EffectHost suffix (N1 dedup)',
          serializerClass: 'host class + Serializer',
        },
      },
      execution,
      effect,
      docs: caseDocs(flip.case),
    };
  });

  const supply = {
    domainValuesPackage: packageForContext(options, cases[0].effect.context) + '.domain.values',
    protoPackage: packageForContext(options, cases[0].effect.context) + '.infrastructure.proto',
    serializationPackage: packageForContext(options, cases[0].effect.context) + '.infrastructure.persistence.converters',
    serializationObject: FACE.supply.serializationObject,
    executionProtoPackage: packageForContext(options, cases[0].effect.context) + '.infrastructure.executionproto',
    effectProtoPackage: packageForContext(options, cases[0].effect.context) + '.infrastructure.effectproto',
    monarchPersistencePackage: FACE.supply.monarchPersistencePackage,
    source: FACE.supply.source,
  };

  return {
    schemaVersion: 'truthsrc.effect-face-input/v1',
    cases,
    faceShape: {
      shared: 'one effect-host shape, per-case knowledge: ObservationStatus ADT (confirmed/rejected/failed/absent/unknown wires), ReconcileDecision ADT (query/retry), per-role EffectBinding records, obligation-table install, round-counted observation freshness, RecoveryCompleted re-query, two-phase result delivery into the execution stage',
      observationStatus: { wires: [...FACE.observationStatus.wires], source: FACE.observationStatus.source },
      retry: { initialMillis: FACE.retry.initialMillis, factor: FACE.retry.factor, maxMillis: FACE.retry.maxMillis, deadlineSeconds: FACE.retry.deadlineSeconds, source: FACE.retry.source },
      admission: { contract: FACE.admission.contract },
      logging: FACE.logging,
      layout: { columnLimit: FACE.layout.columnLimit, discipline: FACE.layout.discipline },
      serializerManifest: FACE.serializerManifest,
      serializerManifestSource: FACE.serializerManifestSource,
      messages: { ...FACE.messages },
      messagesSource: FACE.messagesSource,
      executionMessages: { ...FACE.executionMessages },
      reconcileDecisions: FACE.reconcileDecisions.map(row => ({ ...row })),
      reconcileDecisionsSource: FACE.reconcileDecisionsSource,
    },
    supply,
    docsSource: 'knowledge: the face doc prose, verbatim per artifact per case (hand-balanced lines; the emitter emits them as data)',
  };
}

// The derived contracts are pure functions of the immutable restricted product
// view; memoizing per call site keeps the two planProductSet probe runs and the
// service-configuration patch consistent without recomputing.
const contracts = new Map();
export function effectFaceContract(context) {
  const key = JSON.stringify([context.products['effect-host-contract']?.hosts?.map(h => h.id), context.options]);
  if (!contracts.has(key)) contracts.set(key, deriveEffectFace(context.products, context.options));
  return contracts.get(key);
}

// Flip-manifest-level host class (used where a producer view lacks the effect
// contract, e.g. the service configuration): the derivation cross-checks this
// spelling against the payload names at the effect-face producer.
export function effectFlipHostClass(hostId) {
  const pascal = pascalWords(kebab(hostId, 'host id'));
  return pascal.endsWith('Effect') ? pascal + 'Host' : pascal + 'EffectHost';
}
