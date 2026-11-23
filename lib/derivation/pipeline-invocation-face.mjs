// Derivation layer: knowledge products → truthsrc.pipeline-invocation-face-input/v1
// (emitter-unification plan F2 — the fail-closed seam between the knowledge graph
// and the unified emitter).
//
// The curated golden contract (test/reference/curated/pipeline-invocation-face/v1/
// technical-input.json) is the family spec (F3). This module proves the knowledge
// side can reproduce it: every case-varying slot is derived from the compiled
// product payloads (saga-host-contract, execution-contract, saga-runtime-contract,
// artifact-contract, reference-layout) plus the project package options; every
// case-independent slot is declared face knowledge below, migrated verbatim from
// the ruled host-face curation (docs/emitter-unification-host-family-rulings.md
// §5/§6 — messages, doc prose, R-group runtime slots, layout discipline, provenance
// annotations). Acceptance: the derived contract deep-equals the curated contract,
// and the emitter renders the golden bytes from it — nothing here reaches emitted
// output except through the emitter's validated input path.
//
// FLIPS: one business case per commit (F4 — never a wholesale switch). An entry in
// PIPELINE_INVOCATION_FLIPS both enables the case for emitter emission and declares
// the per-case doc facts (the business phrases the curated doc prose instantiates).
// Every derivation step is fail-closed: a payload slot that cannot be derived with
// a diagnostic refuses the contract (D-P08 discipline globalized), never defaults.

const fail = message => { throw new Error('HOST_FACE_DERIVATION: ' + message); };
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
const sha256Digest = value => {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) fail('definition digest must carry the sha256: prefix: ' + JSON.stringify(value));
  return value;
};
const refKey = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);

// Face knowledge: the frozen five result kinds, wire label → Pascal kind. The set
// is the RESULT_KINDS carrier of the saga-hosts product; the Pascal spellings are
// the ruled kind names (the payload's outcome codes carry the stage-error labels).
const RESULT_KINDS = Object.freeze({
  'succeeded': 'Succeeded',
  'rejected-before-effects': 'RejectedBeforeEffects',
  'compensated': 'Compensated',
  'recovery-required': 'RecoveryRequired',
  'outcome-unknown': 'OutcomeUnknown',
});

// Per-case flip manifest (F4): one entry per flipped business case, one commit per
// entry. docShort/docLong are the business phrases the curated doc prose
// instantiates ("the payment pipeline invocation face", "the cash purchase payment").
export const PIPELINE_INVOCATION_FLIPS = Object.freeze([
  Object.freeze({
    pipeline: 'bank-cash-payment-v1',
    host: 'bank-payment-host',
    case: 'payment',
    docShort: 'payment',
    docLong: 'cash purchase payment',
  }),
]);

// Face knowledge (ruled, case-independent). Sources are provenance annotations and
// stay verbatim so the derived contract equals the curated one exactly.
const FACE = Object.freeze({
  scheme: 'truthsrc-pipeline-invocation-v1',
  admissionGates: Object.freeze(['entry', 'association']),
  portBindings: Object.freeze({
    boundary: 'handwritten-composition-root',
    codecPinVersion: 1, // judged (rulings): the codec pin stays at 1 across member renames
    source: 'knowledge: artifact-contract port pins + roles; judged: codec-pin prefix + version',
    declaredIdNote: 'implementation identity strings keep the classic spelling (stable across member renames) — the handwritten composition root never retypes them',
  }),
  serializer: Object.freeze({
    identifierBase: 742000, // judged: allocation band per classic render-host-adapters
    manifest: 'event-v1',
    resultKindSlot: 'pb.operation (dedicated kind slot lands with the proto-family replacement, ruling T4)',
    source: 'judged: identifier allocation; knowledge: proto face schema',
  }),
  saga: Object.freeze({
    source: 'knowledge: saga payload + strict runtime binding',
    argsPinSource: 'judged: args codec pin version (the payload pin stays at 1)',
    argsFieldsSource: 'knowledge: payload args value composition (saga payload)',
  }),
  invocationSource: 'knowledge: pipeline invocation binding',
  resultsSource: 'knowledge: RESULT_KINDS frozen set (saga-hosts product); terminal set from the saga completion contract',
  participantsSource: 'knowledge: saga binding steps + payload participants in declaration order; N2 composes port member names from stepIds (camelCase), not ordinals; domain value types (BankPayment0PrepareInput and friends) keep knowledge-side names; per-participant protocol command composition is knowledge (which domain command each phase issues)',
  admissionSource: 'knowledge: R2(b) admission contract members (HostIO.admit asks entry then association)',
  executionSource: 'knowledge: pipeline declaration + execution plan product (the plan face of the saga); originalFields compose the original request value over the execution inputs',
  runtime: Object.freeze({
    admission: Object.freeze({
      contract: 'R2(b): in-memory coalescing; replies derived from durable state on re-invoke; caller owns ask timeout + retry; admission IO failure surfaces as \'admission unavailable\', never as a denial',
    }),
    retry: Object.freeze({
      initialMillis: 100, factor: 2, maxMillis: 5000, deadlineSeconds: 60, // judged slots (R1)
      source: 'judged slot (R1): consumed by the execution-face bridge (BankCashPaymentExecution)',
    }),
    coordinator: Object.freeze({
      askMillis: 1000, capacity: 32, // judged slots, carried from classic semantics
      source: 'judged slots, carried from classic semantics',
    }),
    logging: 'R4: debug points at associate/observe/deliver/admission-denial/retry',
  }),
  supply: Object.freeze({
    serializationObject: 'DomainConverters',
    strictRuntimePackage: 'net.imadz.infra.saga.strict',
    monarchPersistencePackage: 'net.imadz.monarch.persistence',
    source: 'knowledge: bankwealth supply tree (proven by the compile-face rounds)',
  }),
  layout: Object.freeze({ columnLimit: 120, discipline: 'L1: hand-balanced breaks, each frozen shape documented at its site' }),
  nameRule: 'N1: kebab-to-Pascal with stem/suffix dedup; type names carry no version suffix (versions live in contract slots and codecs)',
  argsValueSource: 'knowledge: strict-saga payload args value',
  resultValueSource: 'knowledge: result kind value (RESULT_KINDS carrier)',
  messagesSource: 'knowledge: reply reasons, require guards and refusal texts of the face (every message flows from the contract, none embedded in the emitter)',
  docsSource: 'knowledge: the face doc prose, verbatim per artifact (hand-balanced lines; the emitter emits them as data)',
  messages: Object.freeze({
    authorityResultDiffers: 'authority result differs from the original-identity-derived expectation',
    hostEventRequired: 'host event required',
    hostEventVersionRequired: 'host event version required',
    unknownHostEventKind: 'unknown host event kind',
    unconfirmedPredecessorOutput: 'unconfirmed predecessor output',
    exactPlanVersionRequired: 'exact finite plan version required',
    missingDurableInput: 'missing durable input $name',
    exactHostActorRequired: 'the exact invocation host actor is required',
    stageDeadlineExceeded: 'stage deadline exceeded',
    ownedInvocationObserverStopped: 'owned invocation observer stopped',
    explicitOwnedFiniteExecutionRequired: 'explicit owned finite execution and installed objects required',
    unknownStaticStep: 'unknown static step',
    identityMismatch: 'implementation identity mismatch: expected $expectedId, got $id',
    versionMismatch: 'implementation version mismatch: $id expected $expectedVersion, got $version',
    carriesNoRunFace: 'implementation $id carries no run face',
    carriesNoOperationFace: 'implementation $id carries no operation face',
    carriesNoCompletionFace: 'implementation $id carries no completion face',
    completeBindingsRequired: 'complete technical port bindings required',
    identityNotYetObserved: 'identity not yet observed',
    conflictDifferentInput: 'different complete parent input or args under existing invocation',
    authoritativeIdentityConflict: 'authoritative identity conflict',
    awaitingAuthoritativeResult: 'awaiting authoritative result',
    notAdmitted: 'entry or association not admitted',
    admissionUnavailablePrefix: 'admission unavailable: ',
    admissionUnavailable: 'admission unavailable',
    coordinatorIdentityConflict: 'coordinator identity conflict',
    deliveryUnacknowledged: 'delivery unacknowledged',
    durableIdentityTokenRequired: 'durable identity token required',
    receiptTxidDiffers: 'receipt txid differs from durable operation',
    receiptDefinitionVersionDiffers: 'receipt definition-version differs from durable operation',
    receiptArgsDigestDiffers: 'receipt args-digest differs from durable operation',
    receiptParticipantDiffers: 'receipt participant differs from durable operation',
    receiptResourceDiffers: 'receipt resource differs from durable operation',
    receiptStepDiffers: 'receipt step differs from durable operation',
    receiptPhaseDiffers: 'receipt phase differs from durable operation',
    readOnlyPhasePortRequired: 'required read-only phase port and exact codec implementation',
    operationIdentityMismatch: 'operation identity mismatch',
    technicalFaceFailedPrefix: 'technical $face failed: ',
    typedQueryNoEvidence: 'typed query returned no authoritative evidence',
    boundTechnicalPortsRequired: 'bound technical ports required',
    boundPhasePortsRequired: 'bound phase ports required',
    identityAndAuthorizerRequired: 'explicit identity and reconciliation authorizer required',
    explicitHostIdentityRequired: 'explicit owned host identity, coordinator and installed technical ports required',
  }),
});

// The face doc prose per artifact, instantiated per case (docShort/docLong business
// phrases, the ports trait, the stage id, the participant step-id list and count).
// Line breaks are the hand-balanced curated lines; a new case re-balances its own
// instantiation at flip time (each break is a documented frozen shape, L1).
// Prose numerals for the doc lines (fail-closed beyond ten: re-balance the line at
// flip time instead of emitting digits in prose).
const NUMERAL_WORDS = Object.freeze(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
const numeralWord = count => {
  if (!Number.isInteger(count) || count < 0 || count > 10) fail('participant count outside the prose numeral table: ' + count);
  return NUMERAL_WORDS[count];
};

export function faceDocs(flip, portsTrait, stageId, stepIds) {
  const stepList = '(' + stepIds.join(' / ') + ')';
  return {
    ports: [
      '/** Technical port surface of the ' + flip.docShort + ' pipeline invocation face — the one',
      '  * file that says what this face depends on. Grouped by role: the admission',
      '  * gates, the ' + numeralWord(stepIds.length) + ' participant phase pairs, the result-kind completion',
      '  * pairs. Implementations are supplied exclusively by the handwritten',
      '  * composition root through `' + portsTrait.replace(/Ports$/, '') + 'PortBindings.install`; this surface',
      '  * owns declarations only.',
      '  *',
      '  * Phase member names compose from the saga payload\'s participant step ids',
      '  * ' + stepList + ';',
      '  * the domain value types keep their knowledge-side names. */',
    ],
    hostIo: [
      '/** Input/output wiring of the ' + flip.docShort + ' invocation face: the admission gate and',
      '  * the two-phase receipt delivery. Every dispatch is over the typed result',
      '  * kind — the compiler, not a string match, closes the case set. */',
    ],
    serializer: [
      '/** Wire codec of the host event journal. Event identities stay the declared',
      '  * protobuf shapes (the proto face owns the schema); the `operation` field of',
      '  * the PB carries the result-kind wire for result events until the proto face',
      '  * gains a dedicated kind slot (proto-family replacement). Unknown event',
      '  * kinds refuse to deserialize. */',
    ],
    execution: [
      '/** Durable execution plan of the ' + flip.docLong + ' pipeline: one stage,',
      '  * `' + stageId + '`, which delegates to the invocation host and folds its',
      '  * authoritative result into the plan state. Stage outcomes are the monarch',
      '  * contract: business rejections stop the stage, unknown effects demand',
      '  * manual recovery — never an implicit retry. */',
    ],
    bindings: [
      '/** Exact bindings of the handwritten implementations to the declared ports.',
      '  *',
      '  * This is NOT a dependency-injection container: it is the executable form of',
      '  * the binding obligations declared in the truth/artifact contract. The',
      '  * composition root fills one record per port, `install` verifies every',
      '  * declared identity and returns the `' + portsTrait + '` surface — or refuses.',
      '  * Each port role exposes exactly the one face its consumers call, so a',
      '  * binding record carries no optional faces and no nulls. Implementation',
      '  * identity strings keep the knowledge-side spelling; renaming members never',
      '  * retypes them. */',
    ],
    host: [
      '/** Pipeline invocation host for the ' + flip.docLong + ': owns the durable',
      '  * association of one business request to its saga run, the admission gate,',
      '  * authoritative result observation and receipt delivery.',
      '  *',
      '  * Semantics contracts:',
      '  * - Invoke is idempotent: the same complete input under the same operation',
      '  *   identity is coalesced; a different input under a live invocation is a',
      '  *   Conflict. Every reply is derived from durable state, so a caller that',
      '  *   re-invokes after any crash recovers its answer (caller-side ask timeout',
      '  *   and retry are part of the contract — reply targets are never persisted).',
      '  * - Admission is a runtime gate, not an event-sourced fact; only the granted',
      '  *   admission is persisted.',
      '  * - Receipt delivery is two-phase (authority completion, then delivery',
      '  *   completion) and acknowledged by a persisted event. */',
    ],
    definition: [
      '/** Strict-saga definition of the ' + flip.docLong + ': the args codec, the',
      '  * three participants\' phase ports and the coordinator assembly.',
      '  *',
      '  * The per-phase business content — which domain command each phase issues,',
      '  * which receipt each phase accepts — is knowledge and stays explicit. The',
      '  * mechanics (codec records, receipt-identity checks, port wrapping) are',
      '  * written once as generic helpers below. Phase names compose from the',
      '  * participant step ids of the saga payload',
      '  * ' + stepList + '. */',
    ],
  };
}

export function isFlipped(hostId) {
  return PIPELINE_INVOCATION_FLIPS.some(flip => flip.host === hostId);
}

// Flip-manifest-level face base (used where a producer view lacks the host
// contract, e.g. the service configuration): the derivation cross-checks this
// spelling against the technical artifact at the host-face producer.
export function flipHostBase(hostId) {
  const pascal = pascalWords(kebab(hostId, 'host id'));
  if (!pascal.endsWith('Host')) fail('flip host id must end in -host: ' + hostId);
  return pascal.replace(/Host$/, '');
}

/**
 * Derive the family input contract for one flipped invocation face.
 * @param products the compiled product payloads, keyed like the producer view
 *   ({'saga-host-contract': {hosts}, 'execution-contract': {pipelines},
 *    'saga-runtime-contract': {sagas}, 'artifact-contract': {artifacts},
 *    'reference-layout': {declarations}})
 * @param options the project options (options.packages explicit per context)
 * @param hostId the flipped host id (must be a manifest entry)
 */
export function derivePipelineInvocationFace(products, options, hostId) {
  const flip = exactlyOne(PIPELINE_INVOCATION_FLIPS.filter(f => f.host === hostId), 'flip manifest entry for host ' + hostId);
  const hosts = requireValue(products['saga-host-contract']?.hosts, 'saga-host-contract hosts');
  const host = exactlyOne(hosts.filter(h => h.id === hostId), 'saga host ' + hostId);
  const context = requireValue(host.saga?.ref?.context, 'host saga context');
  const pkg = packageForContext(options, context);
  const layout = requireValue(products['reference-layout']?.declarations, 'reference-layout declarations');
  const field = ref => exactlyOne(layout.filter(d => refKey(d.ref) === refKey(ref)), 'layout declaration for ' + ref.kind + ' ' + ref.id);

  // The admitted pipeline invocation: host entry → pipeline step → exact saga op.
  const pipeline = exactlyOne((products['execution-contract']?.pipelines ?? []).filter(p => p.id === host.entry?.startOwner?.ref?.id),
    'execution pipeline ' + host.entry?.startOwner?.ref?.id);
  const step = exactlyOne(pipeline.steps.filter(s => s.id === host.entry.startOwner.stepId), 'pipeline step ' + host.entry.startOwner.stepId);
  const op = requireValue(step.invokeSaga, 'pipeline step invokeSaga');
  if (op.ref.sagaId !== host.saga.ref.id || op.ref.version !== host.saga.version)
    fail('the admitted pipeline invocation must target exactly this host saga');
  const sagaId = kebab(host.saga.ref.id, 'saga id');
  const runtime = exactlyOne((products['saga-runtime-contract']?.sagas ?? []).filter(s => s.sagaId === sagaId),
    'saga runtime contract for ' + sagaId);

  // Type resolution mirrors the execution-plan face: nominal layout declaration,
  // else a consistent runtime scalar (integer→Long / string→String) over the saga
  // runtime type descriptors, else fail-closed.
  const pin = id => exactlyOne(pipeline.binding.types.filter(t => t.id === id), 'execution binding pin for ' + id);
  const resolve = id => {
    const rows = layout.filter(d => d.ref.context === context && d.ref.kind === 'type' && d.ref.id === id);
    if (rows.length === 1) return { form: 'nominal', ref: rows[0].ref };
    const runtimeTypes = (products['saga-runtime-contract']?.sagas ?? []).flatMap(s => s.args.types).filter(t => t.id === id);
    const binding = pin(id);
    if (runtimeTypes.length && runtimeTypes.every(t => t.kind === 'integer' && t.canonicalType === 'Int' && t.implementation === binding.implementation))
      return { form: 'primitive', name: 'integer' };
    if (runtimeTypes.length && runtimeTypes.every(t => t.kind === 'string' && t.canonicalType === 'String' && t.implementation === binding.implementation))
      return { form: 'primitive', name: 'string' };
    fail('complete nominal or consistent explicit runtime scalar descriptor required for ' + id);
  };
  const scalars = id => {
    const resolved = resolve(id);
    return resolved.form === 'nominal' ? requireValue(resolved.ref.id, 'nominal type id') : { string: 'String', boolean: 'Boolean', integer: 'Long', decimal: 'BigDecimal' }[resolved.name];
  };

  // Names (N1): the face base comes from the owning technical artifact
  // (BankPaymentTechnical → BankPayment); the execution class from the saga id
  // with its version suffix stripped. Both spellings cross-check the host id.
  const artifact = owningArtifact(products, host);
  const base = requireValue(artifact.artifact?.id, 'artifact id');
  if (!/^[A-Z][A-Za-z0-9]*Technical$/.test(base)) fail('technical artifact id must end in Technical: ' + base);
  const faceBase = base.replace(/Technical$/, '');
  const hostClass = faceBase + 'Host';
  if (hostClass !== pascalWords(kebab(hostId, 'host id'))) fail('host id and technical artifact disagree on the face base: ' + hostClass);
  const executionBase = pascalWords(sagaId.replace(/-v\d+$/, ''));
  const names = {
    hostClass,
    hostIoObject: faceBase + 'HostIO',
    portsTrait: faceBase + 'Ports',
    portBindingsObject: faceBase + 'PortBindings',
    serializerClass: faceBase + 'HostSerializer',
    executionClass: executionBase + 'Execution',
    sagaDefinitionObject: faceBase + 'SagaDefinition',
    package: pkg + '.application',
    nameSources: {
      rule: FACE.nameRule,
      hostClass: 'host id ' + hostId,
      executionClass: 'saga id ' + sagaId + ' (the durable plan face of that saga)',
      sagaDefinitionObject: 'host id ' + hostId,
      originalValue: 'knowledge: ' + flip.docShort + ' original request value (domain values tree)',
      argsValue: FACE.argsValueSource,
      resultValue: FACE.resultValueSource,
    },
    originalValue: requireValue(host.entry?.inputType?.ref?.id, 'entry original value type'),
    argsValue: requireValue(runtime.args?.runtimeCodec?.id, 'runtime args codec id'),
    resultValue: requireValue(host.results?.[0]?.inputType?.ref?.id, 'result kind value type'),
  };
  if (!host.results.every(r => r.inputType?.ref?.id === names.resultValue))
    fail('every result kind must carry the same result value type');

  const saga = {
    id: sagaId,
    context,
    definitionVersion: requireInteger(runtime.runtimeIdentity?.version, 'runtime identity definition version'),
    definitionDigest: sha256Digest(requireValue(runtime.definitionDigest, 'runtime definition digest')),
    artifactVersion: requireValue(pipeline.recovery?.planVersion, 'pipeline recovery plan version'),
    source: FACE.saga.source,
    argsPinVersion: requireInteger(runtime.args?.runtimeCodec?.version, 'runtime args codec pin version'),
    argsPinSource: FACE.saga.argsPinSource,
    argsFields: exactlyOrdered(runtime.args?.slots?.map(s => requireValue(s.slot, 'args slot')), op.args?.map(a => requireValue(a.slot, 'invocation args slot')),
      'runtime args slots must equal the admitted invocation args slots in order'),
    argsFieldsSource: FACE.saga.argsFieldsSource,
  };
  if (saga.artifactVersion !== host.saga.version) fail('pipeline plan version must equal the host saga version');

  const identity = requireValue(op.transactionIdentity, 'pipeline transaction identity');
  if (identity.iteration || identity.chunk)
    fail('iteration/chunk identity tokens are outside the v1 face contract (fail-closed: extend the contract first)');
  const invocation = {
    scheme: FACE.scheme,
    pipelineStep: kebab(step.id, 'pipeline step id'),
    markers: ['iteration', 'absent', 'chunk', 'absent'],
    source: FACE.invocationSource,
  };

  const stepIds = host.participants.map(p => kebab(requireValue(p.stepId, 'participant step id'), 'participant step id'));
  const kinds = host.results.map(r => {
    const pascal = RESULT_KINDS[r.kind];
    if (!pascal) fail('result kind outside the frozen five-kind face set: ' + JSON.stringify(r.kind));
    return pascal;
  });
  if (new Set(kinds).size !== Object.keys(RESULT_KINDS).length) fail('the face contract requires exactly the five frozen result kinds');
  const results = {
    kinds: host.results.map(r => {
      const mapping = exactlyOne((op.results ?? []).filter(m => m.resultKind === r.kind), 'invocation result mapping for ' + r.kind);
      const outcome = exactlyOne(step.outcomes.filter(o => o.code === mapping.code), 'step outcome for result ' + r.kind);
      return {
        kind: RESULT_KINDS[r.kind],
        wire: r.kind,
        terminal: outcome.action !== 'manual-recovery',
        executionCase: pascalWords(step.id) + outcome.code,
        stageError: outcome.action === 'continue' ? null : {
          label: requireValue(outcome.code, 'stage error label'),
          category: requireValue(outcome.kind, 'stage error category'),
          discipline: requireValue(outcome.action, 'stage error discipline'),
        },
      };
    }),
    source: FACE.resultsSource,
  };

  const participants = host.participants.map(p => {
    const phases = requireValue(p.phases, 'participant phases');
    const ordered = ['prepare', 'commit', 'compensate'];
    if (phases.length !== 3 || phases.some((phase, i) => phase.phase !== ordered[i]))
      fail('participant phases must be exactly prepare, commit, compensate in order');
    return {
      stepId: kebab(p.stepId, 'participant step id'),
      participantId: requireValue(p.participantId, 'participant id'),
      aggregate: requireValue(p.aggregate?.id, 'participant aggregate'),
      resourceType: requireValue(field(p.resourceInput).valueType?.ref?.id, 'participant resource type'),
      protocol: requireValue(p.aggregate?.id, 'participant aggregate') + 'Protocol',
      argsField: requireValue(p.resourceInput?.id, 'participant args field'),
      commands: {
        prepare: requireValue(phases[0].command?.id, 'prepare command'),
        commit: requireValue(phases[1].command?.id, 'commit command'),
        compensate: requireValue(phases[2].command?.id, 'compensate command'),
      },
    };
  });

  const portBindings = {
    artifact: requireValue(artifact.id, 'owning artifact id'),
    implementationVersion: requireValue(artifact.version, 'owning artifact version'),
    boundary: FACE.portBindings.boundary,
    declaredIdStem: context + '.' + faceBase,
    declaredIdNote: FACE.portBindings.declaredIdNote,
    source: FACE.portBindings.source,
    codecPinPrefix: (() => {
      const prefix = requireValue(artifact.id, 'owning artifact id').replace(/-technical$/, '');
      if (prefix === artifact.id) fail('technical artifact id must end in -technical: ' + artifact.id);
      return prefix;
    })(),
    codecPinVersion: FACE.portBindings.codecPinVersion,
  };
  const entryAssociation = host.technicalPorts.filter(p => ['entry', 'association'].includes(p.role));
  if (entryAssociation.length !== 2) fail('the face requires the entry and association technical ports');
  if (!entryAssociation.every(p => requireValue(p.implementation?.id, 'port implementation id').startsWith(portBindings.declaredIdStem)))
    fail('entry/association implementations must carry the declared identity stem ' + portBindings.declaredIdStem);

  const hostIndex = hosts.findIndex(h => h.id === hostId);
  if (hostIndex < 0 || hostIndex >= 1000) fail('host index outside the serializer allocation band');
  const serializer = {
    identifier: FACE.serializer.identifierBase + hostIndex,
    manifest: FACE.serializer.manifest,
    eventPb: pkg + '.infrastructure.hostproto.' + hostId.replaceAll('-', '') + 'HostEventPB',
    resultKindSlot: FACE.serializer.resultKindSlot,
    source: FACE.serializer.source,
  };

  const inputNames = pipeline.inputs.map(i => requireValue(i.id, 'execution input id'));
  const writes = pipeline.steps.flatMap(s => s.writes ?? []);
  if (writes.length !== 1) fail('the face contract carries exactly one stage write, got ' + writes.length);
  const write = writes[0];
  const execution = {
    stageId: kebab(step.id, 'pipeline step id'),
    planVersion: requireValue(pipeline.recovery?.planVersion, 'pipeline recovery plan version'),
    inputs: pipeline.inputs.map(i => ({ name: i.id, type: scalars(requireValue(i.type, 'execution input type for ' + i.id)) })),
    requestInputs: pipeline.inputs.filter(i => resolve(i.type).form === 'nominal').map(i => i.id),
    output: (() => {
      const outputs = requireValue(pipeline.outputs, 'pipeline outputs');
      if (outputs.length !== 1) fail('the face contract carries exactly one pipeline output, got ' + outputs.length);
      return { field: requireValue(outputs[0].id, 'pipeline output id'), type: scalars(requireValue(outputs[0].type, 'pipeline output type')) };
    })(),
    codecSlots: [
      ...pipeline.inputs.map((i, index) => ({ slot: 'input' + index, field: i.id, type: scalars(i.type), optional: false })),
      { slot: 'output0', field: write.id, type: scalars(write.type), optional: true },
    ],
    executionStatePb: pkg + '.infrastructure.executionproto.' + pipeline.id.replaceAll('-', '') + 'ExecutionStatePB',
    source: FACE.executionSource,
    originalFields: (() => {
      const members = field(host.entry.inputType.ref).valueType?.members?.map(m => m.id) ?? [];
      if (!members.length) fail('original value members required');
      return members.map(member => {
        if (inputNames.includes(member)) return member;
        if (member.endsWith('Id') && inputNames.includes(member.slice(0, -2))) return member.slice(0, -2);
        fail('original value member ' + member + ' does not compose over the execution inputs');
      });
    })(),
  };
  if (!execution.originalFields.every(name => inputNames.includes(name)))
    fail('original fields must compose over the execution inputs');

  const supply = {
    domainPackage: pkg + '.domain',
    domainValuesPackage: pkg + '.domain.values',
    protoPackage: pkg + '.infrastructure.proto',
    serializationPackage: pkg + '.infrastructure.serialization',
    serializationObject: FACE.supply.serializationObject,
    executionProtoPackage: pkg + '.infrastructure.executionproto',
    hostProtoPackage: pkg + '.infrastructure.hostproto',
    strictRuntimePackage: FACE.supply.strictRuntimePackage,
    monarchPersistencePackage: FACE.supply.monarchPersistencePackage,
    source: FACE.supply.source,
  };

  return {
    schemaVersion: 'truthsrc.pipeline-invocation-face-input/v1',
    case: flip.case,
    names,
    saga,
    invocation,
    results,
    participants,
    participantsSource: FACE.participantsSource,
    admission: { gates: [...FACE.admissionGates], source: FACE.admissionSource },
    portBindings,
    serializer,
    execution,
    runtime: {
      admission: { contract: FACE.runtime.admission.contract },
      retry: { initialMillis: FACE.runtime.retry.initialMillis, factor: FACE.runtime.retry.factor, maxMillis: FACE.runtime.retry.maxMillis, deadlineSeconds: FACE.runtime.retry.deadlineSeconds, source: FACE.runtime.retry.source },
      coordinator: { askMillis: FACE.runtime.coordinator.askMillis, capacity: FACE.runtime.coordinator.capacity, source: FACE.runtime.coordinator.source },
      logging: FACE.runtime.logging,
    },
    supply,
    messages: { ...FACE.messages },
    messagesSource: FACE.messagesSource,
    layout: { columnLimit: FACE.layout.columnLimit, discipline: FACE.layout.discipline },
    docs: faceDocs(flip, names.portsTrait, execution.stageId, stepIds),
    docsSource: FACE.docsSource,
  };
}

// The selected artifact-contract artifact that owns every technical port of the
// host (exact port pin + implementation identity, the classic ownership rule).
function owningArtifact(products, host) {
  const selected = (products['artifact-contract']?.artifacts ?? []).filter(a => a.status === 'selected');
  const owners = host.technicalPorts.map(port => {
    const rows = selected.filter(a => a.ports.some(pin => refKey(pin.ref) === refKey(port.port.ref) && pin.version === port.port.version) &&
      a.implementations.some(i => refKey(i.port) === refKey(port.port.ref) && i.id === port.implementation.id && i.version === port.implementation.version));
    return exactlyOne(rows, 'selected technical port owner for ' + port.port.ref.id);
  });
  const artifact = exactlyOne([...new Set(owners.map(a => a.id))].map(id => exactlyOne(selected.filter(a => a.id === id), 'artifact ' + id)),
    'one owning artifact for all host technical ports');
  return artifact;
}

function exactlyOrdered(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(message);
  return actual;
}

function requireInteger(value, what) {
  if (!Number.isInteger(value)) fail(what + ' must be an integer, got ' + JSON.stringify(value));
  return value;
}

function packageForContext(options, context) {
  const rows = (options?.packages ?? []).filter(p => p.context === context);
  const row = exactlyOne(rows, 'project package binding for context ' + context);
  return requireValue(row.package, 'project package for context ' + context);
}
