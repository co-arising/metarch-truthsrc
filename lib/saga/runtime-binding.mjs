// First runtime-binding gate only: pure data lowering, never runtime certification.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual, types as nodeTypes } from 'node:util';
import { compileSagas } from './compile.mjs';

const PHASES = ['prepare', 'commit', 'compensate'];
const CAPABILITIES = ['positive-int-definition-version', 'static-participants',
  'serial-all-tcc', 'fresh-canonical-args', 'pinned-args-codec',
  'pinned-phase-receipt-codecs', 'minor-unit-string-money'];
const TARGET = {
  artifact: 'net.imadz:saga-core:strict-runtime-binding-v1-SNAPSHOT',
  artifactStatus: 'unpublished-candidate', apiMode: 'strict',
  definitionApi: 'net.imadz.infra.saga.strict.StrictSagaDefinition',
  coordinatorApi: 'net.imadz.infra.saga.strict.StrictSagaCoordinator',
  executionMode: 'static-serial-allTCC',
};
const own = (value, key) => Object.hasOwn(value, key);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const child = (path, key) => `${path}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
const stable = (value) => Array.isArray(value) ? value.map(stable) : plain(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const digest = (value) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const positiveInt = (value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const id = (value) => typeof value === 'string' && value.length <= 128
  && /^[A-Za-z][A-Za-z0-9_-]*$/u.test(value) && !/[\r\n]/u.test(value);

// Check descriptors before reading values, including opaque canonical metadata.
// Proxy detection precedes reflection; no accessor, toJSON or callback is invoked.
function jsonCheck(value, path, error, ancestors = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (ancestors.size > 128) return error('RUNTIME_JSON', 'JSON nesting exceeds 128.', path);
  if (nodeTypes.isProxy(value) || (!Array.isArray(value) && !plain(value))
    || (Array.isArray(value) && Object.getPrototypeOf(value) !== Array.prototype)) {
    return error('RUNTIME_JSON', 'Expected plain JSON data.', path);
  }
  if (ancestors.has(value)) return error('RUNTIME_JSON', 'Cyclic JSON data is unsupported.', path);
  ancestors.add(value);
  const entries = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(entries)) {
    if (Array.isArray(value) && key === 'length') continue;
    const entry = entries[key];
    const at = child(path, key);
    if (typeof key === 'symbol' || !entry.enumerable || !own(entry, 'value')
      || (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/u.test(key))) {
      error('RUNTIME_JSON', 'Only enumerable JSON data properties are supported.', at);
    } else jsonCheck(entry.value, at, error, ancestors);
  }
  if (Array.isArray(value)) {
    const indexes = Object.keys(entries).filter((key) => /^(0|[1-9][0-9]*)$/u.test(key)).map(Number).sort((a, b) => a - b);
    const missing = indexes.findIndex((index, ordinal) => index !== ordinal);
    if (missing >= 0 || indexes.length !== value.length) error('RUNTIME_JSON', 'Sparse arrays are unsupported.', child(path, missing >= 0 ? missing : indexes.length));
  }
  ancestors.delete(value);
}

const V3_CAPABILITIES = [...CAPABILITIES, 'singleton-serial-barriers',
  'confirmed-receipt-context', 'fresh-receipt-decode'];
// P13 可选能力：文件声明才生效（缺省文件行为/诊断/digest 完全不变——money 钉点纪律）。
// - bounded-collection-args：args/输入携带有界标量集合（elementType id/text、1..64），
//   运行时按确定性有序序列编解码，不做参与者/条目展开。
// - args-anchored-manifest：manifest mode durable-reference 放行，当且仅当冻结操作集
//   完整随 canonical args 携带（有界 collection 槽）；ref/version 仅审计锚，运行时永不解引用。
const V3_OPTIONAL_CAPABILITIES = ['bounded-collection-args', 'args-anchored-manifest'];

function documentCheck(document, error, version = 'truthsrc.saga-runtime-binding/v1', capabilities = CAPABILITIES, optional = []) {
  const shape = (value, keys, path) => {
    if (!plain(value)) { error('RUNTIME_SCHEMA', 'Expected an object.', path); return false; }
    for (const key of keys) if (!own(value, key)) error('RUNTIME_SCHEMA', 'Required property is missing.', child(path, key));
    for (const key of Object.keys(value)) if (!keys.includes(key)) error('RUNTIME_UNKNOWN', 'Unknown runtime-binding field.', child(path, key));
    return keys.every((key) => own(value, key));
  };
  const rows = (value, path, maximum = 1024) => {
    if (!Array.isArray(value) || value.length > maximum) { error('RUNTIME_SCHEMA', `Expected an array of at most ${maximum} entries.`, path); return false; }
    return true;
  };
  const identifier = (value, path) => { if (!id(value)) error('RUNTIME_SCHEMA', 'Expected a bounded contract ID.', path); };
  if (!shape(document, ['schemaVersion', 'target', 'sagas'], '/runtimeBinding')) return;
  if (document.schemaVersion !== version) error('RUNTIME_SCHEMA', 'Unsupported runtime-binding document version.', '/runtimeBinding/schemaVersion');
  if (shape(document.target, [...Object.keys(TARGET), 'capabilities'], '/runtimeBinding/target')) {
    for (const [key, expected] of Object.entries(TARGET)) if (document.target[key] !== expected) {
      error('RUNTIME_TARGET', `Only ${expected} is supported for ${key}; this is not artifact certification.`, `/runtimeBinding/target/${key}`);
    }
    const at = '/runtimeBinding/target/capabilities';
    if (rows(document.target.capabilities, at)) {
      const seen = new Set();
      const allowed = [...capabilities, ...optional];
      document.target.capabilities.forEach((value, ordinal) => {
        if (!allowed.includes(value)) error('RUNTIME_CAPABILITY_UNSUPPORTED', 'Unknown or unsupported lowering capability.', child(at, ordinal));
        if (seen.has(value)) error('RUNTIME_DUPLICATE', 'Duplicate lowering capability.', child(at, ordinal));
        seen.add(value);
      });
      for (const capability of capabilities) if (!seen.has(capability)) error('RUNTIME_CAPABILITY_MISSING', `Missing lowering capability ${capability}.`, at);
    }
  }
  if (!rows(document.sagas, '/runtimeBinding/sagas')) return;
  if (!document.sagas.length) error('RUNTIME_MAPPING_MISSING', 'At least one explicit Saga mapping is required; empty input is not lowering success.', '/runtimeBinding/sagas');
  document.sagas.forEach((saga, ordinal) => {
    const at = `/runtimeBinding/sagas/${ordinal}`;
    if (!shape(saga, ['sagaId', 'definitionVersion', 'runtimeVersion', 'argsCodec', 'receiptCodecs'], at)) return;
    identifier(saga.sagaId, `${at}/sagaId`);
    identifier(saga.definitionVersion, `${at}/definitionVersion`);
    if (!positiveInt(saga.runtimeVersion)) error('RUNTIME_VERSION', 'Runtime version must be a positive Scala Int, not a parsed/coerced business version.', `${at}/runtimeVersion`);
    if (shape(saga.argsCodec, ['id', 'version', 'runtimeVersion'], `${at}/argsCodec`)) {
      identifier(saga.argsCodec.id, `${at}/argsCodec/id`);
      identifier(saga.argsCodec.version, `${at}/argsCodec/version`);
      if (!positiveInt(saga.argsCodec.runtimeVersion)) error('RUNTIME_VERSION', 'Explicit args codec runtimeVersion must be a positive Scala Int.', `${at}/argsCodec/runtimeVersion`);
    }
    if (rows(saga.receiptCodecs, `${at}/receiptCodecs`, version === 'truthsrc.saga-runtime-binding/v2' ? 3072 : 1024)) saga.receiptCodecs.forEach((codec, i) => {
      const pointer = `${at}/receiptCodecs/${i}`;
      if (!shape(codec, ['stepId', 'phase', 'id', 'version', 'runtimeVersion'], pointer)) return;
      identifier(codec.stepId, `${pointer}/stepId`);
      identifier(codec.id, `${pointer}/id`);
      identifier(codec.version, `${pointer}/version`);
      if (!positiveInt(codec.runtimeVersion)) error('RUNTIME_VERSION', 'Explicit receipt codec runtimeVersion must be a positive Scala Int.', `${pointer}/runtimeVersion`);
      if (!PHASES.includes(codec.phase)) error('RUNTIME_SCHEMA', 'Unknown receipt phase.', `${pointer}/phase`);
    });
  });
}

// The live compiler receives the ORIGINAL inputs and owns schema/semantic validity.
// In particular, atom-header versions outside its current schema are not bridged.
function compileClosure(canonical, binding, error) {
  const result = compileSagas(canonical, binding);
  for (const diagnostic of result.diagnostics) error(diagnostic.code, diagnostic.message,
    `/${diagnostic.source.document}${diagnostic.source.pointer}`);
  return result.ir;
}

function featureCheck(saga, ordinal, error) {
  const payload = saga.definition.payload;
  const at = `/ir/sagas/${ordinal}/definition/payload`;
  if (payload.admission.manifest.mode !== 'static') error('RUNTIME_MANIFEST_UNSUPPORTED', 'Durable-reference/dynamic manifests are not implemented by this static target.', `${at}/admission/manifest`);
  // In current IR same-group steps are CONCURRENT, not an ordered list. Multiple
  // groups carry barrier dependencies. Neither may be erased into a serial plan.
  if (payload.groups.length !== 1 || payload.groups.some((group) => group.dependsOn.length)) error('RUNTIME_GROUP_UNSUPPORTED', 'Group dependency/barrier scheduling is outside this first binding gate.', `${at}/groups`);
  if (payload.groups.some((group) => payload.steps.filter((step) => step.group === group.id).length > 1)
    || payload.admission.maxInFlight !== 1) error('RUNTIME_PARALLEL_UNSUPPORTED', 'Concurrent groups/admission cannot be lowered as static serial execution.', `${at}/groups`);
  const resilience = payload.resilience;
  if (resilience.maxAttempts !== 1 || resilience.backoffMs !== 0
    || resilience.phaseTimeoutMs !== resilience.queryTimeoutMs) error('RUNTIME_RESILIENCE_UNSUPPORTED', 'Target has one interaction timeout, not attempt limits, backoff or separate phase/query deadlines.', `${at}/resilience`);
  for (const type of saga.binding.types) {
    if (['collection', 'manifest-reference'].includes(type.kind)) error('RUNTIME_TYPE_UNSUPPORTED', 'Collection/manifest expansion is outside the static binding gate.', `/ir/sagas/${ordinal}/binding/types/${saga.binding.types.indexOf(type)}`);
    if (type.kind === 'money' && type.amountEncoding !== 'minor-unit-string') error('RUNTIME_MONEY_UNSUPPORTED', 'This adapter contract requires exact minor-unit-string Money; no numeric conversion.', `/ir/sagas/${ordinal}/binding/types/${saga.binding.types.indexOf(type)}/amountEncoding`);
  }
  for (const [i, step] of payload.steps.entries()) for (const phase of PHASES) {
    const declaration = step.phases[phase];
    const path = `${at}/steps/${i}/phases/${phase}`;
    if (declaration.kind !== 'command') error('RUNTIME_ALL_TCC_REQUIRED', 'Strict target requires all three command phases for every step.', path);
    else declaration.bindings.forEach((mapping, j) => {
      if (mapping.ref.startsWith('step:')) error('RUNTIME_DATAFLOW_UNSUPPORTED', 'OperationRequest contains fresh canonical args and identity only; no prior receipt/result slot is passed.', `${path}/bindings/${j}/ref`);
    });
  }
  payload.completions.forEach((completion, i) => completion.bindings.forEach((mapping, j) => {
    if (mapping.ref.startsWith('step:')) error('RUNTIME_DATAFLOW_UNSUPPORTED', 'Completion receipt/result slot delivery needs an unimplemented host dataflow adapter.', `${at}/completions/${i}/bindings/${j}/ref`);
  }));
}

// v3 rechecks the admitted definition itself, not IR readiness/capability flags.
// A numeric barrier chain with exactly one static step per group is a plan,
// never permission to serialize a concurrent group or an arbitrary DAG frontier.
function featureCheckV3(saga, ordinal, error, capabilities = new Set()) {
  const payload = saga.definition.payload;
  const at = `/ir/sagas/${ordinal}/definition/payload`;
  const has = (capability) => capabilities.has(capability);
  const types = new Map(saga.binding.types.map((type) => [type.id, type]));
  const argsCollection = payload.args.some((arg) => types.get(arg.type)?.kind === 'collection');
  const manifest = payload.admission.manifest;
  const manifestOk = manifest.mode === 'static'
    || (has('args-anchored-manifest') && manifest.mode === 'durable-reference' && manifest.durable === true
      && manifest.selection === 'frozen-before-prepare' && argsCollection);
  if (!manifestOk) error('RUNTIME_MANIFEST_UNSUPPORTED', has('args-anchored-manifest')
    ? 'args-anchored-manifest requires durable + frozen-before-prepare and an args-carried bounded collection.'
    : 'v3 requires a static manifest; no dynamic participant expansion.', `${at}/admission/manifest`);
  if (payload.admission.maxInFlight !== 1) error('RUNTIME_PARALLEL_UNSUPPORTED', 'v3 requires explicit maxInFlight 1.', `${at}/admission/maxInFlight`);
  const resilience = payload.resilience;
  if (resilience.maxAttempts !== 1 || resilience.backoffMs !== 0
    || resilience.phaseTimeoutMs !== resilience.queryTimeoutMs) error('RUNTIME_RESILIENCE_UNSUPPORTED', 'v3 requires one attempt, no backoff and equal phase/query timeouts.', `${at}/resilience`);
  for (const [i, type] of saga.binding.types.entries()) {
    const path = `/ir/sagas/${ordinal}/binding/types/${i}`;
    if (type.kind === 'collection') {
      const element = types.get(type.elementType);
      const bounded = has('bounded-collection-args') && (element?.kind === 'id' || element?.kind === 'text')
        && type.minItems >= 1 && type.maxItems <= 64;
      if (!bounded) error('RUNTIME_TYPE_UNSUPPORTED', 'bounded-collection-args requires id/text elements and 1..64 items.', path);
    } else if (type.kind === 'manifest-reference') {
      const anchored = has('args-anchored-manifest') && type.readable === true
        && typeof type.version === 'string' && type.version.length > 0;
      if (!anchored) error('RUNTIME_TYPE_UNSUPPORTED', 'manifest-reference requires args-anchored-manifest with readable and a declared version.', path);
    }
    if (type.kind === 'money' && type.amountEncoding !== 'minor-unit-string') error('RUNTIME_MONEY_UNSUPPORTED', 'v3 requires exact minor-unit-string Money.', `${path}/amountEncoding`);
  }
  const groups = new Map(payload.groups.map((group) => [group.id, group]));
  if (!groups.size || groups.size > 1024 || groups.size !== payload.groups.length
    || payload.groups.some((group) => !Number.isSafeInteger(group.id) || group.id < 1)) {
    error('RUNTIME_GROUP_UNSUPPORTED', 'v3 requires 1..1024 unique positive numeric singleton groups.', `${at}/groups`);
  }
  const order = [...groups.keys()].sort((a, b) => a - b);
  const ancestors = new Map();
  const orderedSteps = [];
  for (const [i, groupId] of order.entries()) {
    const group = groups.get(groupId);
    const path = `${at}/groups/${payload.groups.indexOf(group)}`;
    const closure = new Set();
    for (const dependency of group.dependsOn) {
      if (!groups.has(dependency) || dependency >= groupId || !ancestors.has(dependency)) {
        error('RUNTIME_GROUP_UNSUPPORTED', 'Dependencies must name earlier numeric barriers, never unknown/forward/cyclic groups.', `${path}/dependsOn`);
      } else {
        closure.add(dependency);
        for (const ancestor of ancestors.get(dependency)) closure.add(ancestor);
      }
    }
    if (i > 0 && !closure.has(order[i - 1])) error('RUNTIME_GROUP_UNSUPPORTED', 'Each numeric barrier must transitively depend on the previous barrier.', `${path}/dependsOn`);
    ancestors.set(groupId, closure);
    const members = payload.steps.filter((step) => step.group === groupId);
    if (members.length !== 1) error('RUNTIME_PARALLEL_UNSUPPORTED', 'Each v3 group must contain exactly one step; concurrency cannot be erased.', path);
    else orderedSteps.push(members[0]);
  }
  const steps = new Map(payload.steps.map((step) => [step.id, step]));
  const args = new Map(payload.args.map((arg) => [arg.slot, arg]));
  const participants = new Map(payload.participants.map((row) => [row.id, row]));
  for (const [i, step] of payload.steps.entries()) {
    const participant = participants.get(step.participant);
    if (!groups.has(step.group)) error('RUNTIME_GROUP_UNSUPPORTED', 'Every step must belong to a declared singleton barrier.', `${at}/steps/${i}/group`);
    for (const phase of PHASES) {
      const declaration = step.phases[phase];
      const path = `${at}/steps/${i}/phases/${phase}`;
      if (declaration.kind !== 'command') {
        error('RUNTIME_ALL_TCC_REQUIRED', 'v3 requires all three command TCC phases.', path);
        continue;
      }
      for (const [j, mapping] of declaration.bindings.entries()) {
        const pointer = `${path}/bindings/${j}/ref`;
        // Keep resource-typed inputs pinned to this participant's exact arg,
        // including aliases with the same canonical type. No cross-address reads.
        if (types.get(mapping.type)?.canonicalType === types.get(participant?.resourceRef.type)?.canonicalType
          && (mapping.ref !== participant?.resourceRef.ref || mapping.type !== participant?.resourceRef.type)) {
          error('RUNTIME_RESOURCE_MISMATCH', 'Resource-typed slots require this participant exact resource arg and type.', pointer);
        }
        if (mapping.ref === 'txid') {
          if (mapping.type !== payload.transactionIdType) error('RUNTIME_DATAFLOW_UNSUPPORTED', 'Transaction-id input type must match exactly.', pointer);
        } else if (mapping.ref.startsWith('args:')) {
          if (args.get(mapping.ref.slice(5))?.type !== mapping.type) error('RUNTIME_DATAFLOW_UNSUPPORTED', 'Args input must name an exact declared typed slot.', pointer);
        } else {
          const parts = mapping.ref.split(':');
          const [, stepId, producerPhase, slot] = parts;
          const producer = steps.get(stepId);
          const output = producer?.phases[producerPhase]?.outputs?.find((row) => row.slot === slot);
          const prior = ancestors.get(step.group)?.has(producer?.group);
          const allowed = phase === 'prepare' ? producerPhase === 'prepare' && prior
            : phase === 'commit' ? producerPhase === 'prepare' || (producerPhase === 'commit' && prior)
              : producerPhase === 'prepare' && producer?.id === step.id;
          if (parts.length !== 4 || parts[0] !== 'step' || !output || output.type !== mapping.type || !allowed) {
            error('RUNTIME_DATAFLOW_UNSUPPORTED', 'Receipt reads require exact typed outputs: Prepare ancestor Prepare; Commit any Prepare or ancestor Commit; Compensate own Prepare only.', pointer);
          }
        }
      }
    }
  }
  payload.completions.forEach((completion, i) => completion.bindings.forEach((mapping, j) => {
    if (mapping.ref.startsWith('step:')) error('RUNTIME_DATAFLOW_UNSUPPORTED', 'Completion receipt delivery still requires an unimplemented host adapter.', `${at}/completions/${i}/bindings/${j}/ref`);
  }));
  return orderedSteps;
}

function receiptInput(mapping) {
  let source;
  if (mapping.ref === 'txid') source = { kind: 'transaction-id' };
  else if (mapping.ref.startsWith('args:')) source = { kind: 'args', slot: mapping.ref.slice(5) };
  else {
    const [, stepId, phase, slot] = mapping.ref.split(':');
    source = { kind: 'receipt-field', stepId, phase, slot };
  }
  return { slot: mapping.slot, type: mapping.type, source };
}

function pinCheck(saga, pin, path, error) {
  for (const key of ['artifact', 'apiMode']) if (saga.binding.engine[key] !== TARGET[key]) {
    error('RUNTIME_TARGET_MISMATCH', `Technical engine ${key} must equal the explicit runtime target.`, `${path}/sagaId`);
  }
  if (pin.definitionVersion !== saga.definition.version) error('RUNTIME_VERSION_MISMATCH', 'Mapping must pin exact sagaId and original business version value/type.', `${path}/definitionVersion`);
  for (const key of ['id', 'version']) if (pin.argsCodec[key] !== saga.binding.codec[key]) error('RUNTIME_CODEC_MISMATCH', `Args codec ${key} must equal the technical binding pin.`, `${path}/argsCodec/${key}`);
  const declared = new Map();
  for (const step of saga.binding.steps) for (const phase of PHASES) {
    if (step.phases[phase].kind === 'command') declared.set(JSON.stringify([step.stepId, phase]), step.phases[phase]);
  }
  const seen = new Set();
  pin.receiptCodecs.forEach((codec, ordinal) => {
    const key = JSON.stringify([codec.stepId, codec.phase]);
    const at = `${path}/receiptCodecs/${ordinal}`;
    if (seen.has(key)) error('RUNTIME_DUPLICATE', 'Duplicate step/phase receipt codec pin.', at);
    seen.add(key);
    const phase = declared.get(key);
    if (!phase) error('RUNTIME_CODEC_ORPHAN', 'Receipt codec must name a declared command step/phase.', at);
    else if (codec.version !== phase.receipt.version) error('RUNTIME_CODEC_MISMATCH', 'Explicit receipt codec version must equal the phase receipt contract version; receipt.mapper is not a codec.', `${at}/version`);
  });
  for (const key of declared.keys()) if (!seen.has(key)) error('RUNTIME_CODEC_MISSING', `Explicit receipt codec id/version required for ${key}; mapper is never a fallback.`, `${path}/receiptCodecs`);
}

function lowerContract(saga, pin, exactTarget = null, serialSteps = null) {
  const { definition, binding } = saga;
  const payload = definition.payload;
  const participants = new Map(payload.participants.map((row) => [row.id, row]));
  const addresses = new Map(binding.participants.map((row) => [row.participantId, row.addressing]));
  const steps = new Map(binding.steps.map((row) => [row.stepId, row]));
  const codecMapping = (codec) => ({ contractCodec: { id: codec.id, version: codec.version },
    runtimeCodec: { id: codec.id, version: codec.runtimeVersion } });
  const codecs = new Map(pin.receiptCodecs.map((row) => [JSON.stringify([row.stepId, row.phase]), codecMapping(row)]));
  const input = serialSteps === null ? (mapping) => ({ slot: mapping.slot, type: mapping.type,
    source: mapping.ref === 'txid' ? { kind: 'transaction-id' } : { kind: 'args', slot: mapping.ref.slice(5) } }) : receiptInput;
  const planSteps = serialSteps ?? payload.steps;
  return {
    sagaId: definition.id, definitionVersion: definition.version,
    runtimeIdentity: { name: definition.id, version: pin.runtimeVersion },
    // No provenance/readiness/IR digest enters this full semantic fingerprint.
    definitionDigest: `sha256:${digest({ definition, binding, runtimeBinding: { target: exactTarget ?? TARGET_WITH_CAPABILITIES, saga: pin } })}`,
    ...(exactTarget === null ? {} : { runtimeBinding: { target: exactTarget, saga: pin } }),
    contract: { definition, binding },
    args: { ...codecMapping(pin.argsCodec), codec: binding.codec, slots: payload.args, types: binding.types },
    participants: planSteps.map((step) => ({ stepId: step.id, participantId: step.participant,
      resource: { ...participants.get(step.participant).resourceRef, addressing: addresses.get(step.participant) },
      phases: Object.fromEntries(PHASES.map((phase) => {
        const technical = steps.get(step.id).phases[phase];
        const declaration = step.phases[phase];
        return [phase, { runtimePhase: phase[0].toUpperCase() + phase.slice(1),
          port: technical.port, commandMapper: technical.commandMapper,
          commandRef: declaration.commandRef, inputs: declaration.bindings.map(input),
          outputs: declaration.outputs, confirmation: technical.confirmation, query: technical.query,
          receipt: technical.receipt, ...codecs.get(JSON.stringify([step.id, phase])),
          idempotency: technical.idempotency }];
      })) })),
    schedule: { prepare: planSteps.map((step) => step.id), commit: planSteps.map((step) => step.id),
      compensate: planSteps.map((step) => step.id).reverse() },
    triggers: payload.triggers.map((trigger) => ({ declaration: trigger,
      binding: binding.triggerMappers.find((row) => row.triggerId === trigger.id) })),
    completions: payload.completions.map((completion) => ({ kind: completion.kind,
      eventRef: completion.eventRef, inputs: completion.bindings.map(input),
      mapper: binding.completionMappers.find((row) => row.kind === completion.kind).mapper })),
    coordinatorSettings: { interactionTimeoutMs: payload.resilience.phaseTimeoutMs },
    hostRequirements: {
      capabilities: binding.engine.capabilities.required.map((capability) => ({ capability, verified: false })),
      totalDeadline: { totalTimeoutMs: payload.resilience.totalTimeoutMs, enforcement: 'unverified-host-obligation' },
      admission: payload.admission, safety: payload.safety,
      businessInvariants: payload.invariants,
    },
    blocked: ['strict-scala', 'scala-ast-adapter-missing', 'real-phase-ports-and-participant-receipts-unverified',
      'args-and-receipt-codec-implementations-unverified', 'runtime-artifact-unpublished-candidate', 'runtime-artifact-api-unverified',
      'host-total-deadline-admission-and-business-invariants-unverified',
      'host-required-safety-capabilities-unverified'],
    readiness: 'lowered-contract-only', runtimeBindingVerified: false, runnable: false,
  };
}
const TARGET_WITH_CAPABILITIES = { ...TARGET, capabilities: CAPABILITIES };

/**
 * lowerSagaRuntimeBinding({canonical,binding,runtimeBinding,ir?})
 * All closure checks use the live compileSagas with unchanged inputs; optional IR
 * must equal its complete stable JSON output (digest/sourceMap included).
 * Returns {ir,plan,diagnostics}; ir and plan alias the same LOWERED contract
 * (not Scala AST / runtime objects). Every error returns BOTH null, no partials.
 * See SAGA-RUNTIME-BINDING-V1.md for explicit version mappings and adapter inputs.
 */
export function lowerSagaRuntimeBinding(context) {
  return lowerRuntimeBinding(context, false);
}

/** Explicit v2 output; unchanged v1 input documents and live compiler closure.
 * Exact target and Saga mapping (including receipt ARRAY order) enter the digest.
 * Output is detached plain JSON: neither caller inputs nor ir/plan share aliases. */
export function lowerSagaRuntimeBindingV2(context) {
  return lowerRuntimeBinding(context, true);
}

/** Explicit v3: v2 mapping document, exact ordered pins and singleton numeric
 * barriers with typed confirmed receipt sources. Pure JSON, not certification. */
export function lowerSagaRuntimeBindingV3(context) {
  return lowerRuntimeBinding(context, true, true);
}

function lowerRuntimeBinding(context, v2, v3 = false) {
  const diagnostics = [];
  const error = (code, message, pointer) => diagnostics.push({ code, message, pointer });
  const finish = (contract = null) => {
    diagnostics.sort((a, b) => {
      const left = JSON.stringify([a.pointer, a.code, a.message]);
      const right = JSON.stringify([b.pointer, b.code, b.message]);
      return left < right ? -1 : left > right ? 1 : 0;
    });
    if (diagnostics.length) return { ir: null, plan: null, diagnostics };
    return v2 ? { ir: stable(contract), plan: stable(contract), diagnostics }
      : { ir: contract, plan: contract, diagnostics };
  };
  jsonCheck(context, '', error);
  if (diagnostics.length) return finish();
  if (!plain(context)) { error('RUNTIME_SCHEMA', 'Expected an explicit input context object.', ''); return finish(); }
  for (const key of Object.keys(context)) if (!['canonical', 'binding', 'runtimeBinding', 'ir'].includes(key)) error('RUNTIME_UNKNOWN', 'Unknown input context field.', child('', key));
  for (const key of ['canonical', 'binding', 'runtimeBinding']) if (!own(context, key)) error('RUNTIME_SCHEMA', 'Required explicit input is missing.', child('', key));
  if (diagnostics.length) return finish();
  if (v3) documentCheck(context.runtimeBinding, error, 'truthsrc.saga-runtime-binding/v2', V3_CAPABILITIES, V3_OPTIONAL_CAPABILITIES);
  else documentCheck(context.runtimeBinding, error);
  if (diagnostics.length) return finish();
  const compiled = compileClosure(context.canonical, context.binding, error);
  if (diagnostics.length || !compiled) return finish();
  if (own(context, 'ir') && !isDeepStrictEqual(stable(context.ir), stable(compiled))) error('RUNTIME_IR_MISMATCH', 'Supplied IR must equal the entire live compiler closure, including digest/sourceMap; flags and forged digests confer no authority.', '/ir');
  const pins = new Map();
  const runtimeVersions = new Set();
  context.runtimeBinding.sagas.forEach((pin, ordinal) => {
    const path = `/runtimeBinding/sagas/${ordinal}`;
    if (pins.has(pin.sagaId)) error('RUNTIME_DUPLICATE', 'Duplicate Saga version mapping.', path);
    else pins.set(pin.sagaId, { pin, path });
    const key = JSON.stringify([pin.sagaId, pin.runtimeVersion]);
    if (runtimeVersions.has(key)) error('RUNTIME_DUPLICATE', 'Duplicate runtime identity/version mapping.', path);
    runtimeVersions.add(key);
  });
  const sagaIds = new Set(compiled.sagas.map((saga) => saga.definition.id));
  for (const [sagaId, entry] of pins) if (!sagaIds.has(sagaId)) error('RUNTIME_MAPPING_ORPHAN', 'Mapping sagaId has no compiled declaration; no name-based lookup.', `${entry.path}/sagaId`);
  const serialPlans = new Map();
  compiled.sagas.forEach((saga, ordinal) => {
    const entry = pins.get(saga.definition.id);
    if (!entry) error('RUNTIME_MAPPING_MISSING', 'Explicit exact sagaId/business-version mapping is required.', `/ir/sagas/${ordinal}/definition/version`);
    else pinCheck(saga, entry.pin, entry.path, error);
    if (v3) serialPlans.set(saga.definition.id, featureCheckV3(saga, ordinal, error, new Set(context.runtimeBinding.target.capabilities)));
    else featureCheck(saga, ordinal, error);
  });
  if (diagnostics.length) return finish();
  return finish(stable({ schemaVersion: v3 ? 'truthsrc.saga-runtime-contract/v3'
    : v2 ? 'truthsrc.saga-runtime-contract/v2' : 'truthsrc.saga-runtime-contract/v1',
    target: v2 ? context.runtimeBinding.target : TARGET_WITH_CAPABILITIES,
    readiness: 'lowered-contract-only', runtimeBindingVerified: false, runnable: false,
    sagas: compiled.sagas.map((saga) => lowerContract(saga, pins.get(saga.definition.id).pin,
      v2 ? context.runtimeBinding.target : null, v3 ? serialPlans.get(saga.definition.id) : null)) }));
}

/** Same gate/result as lowering, without publishing a plan. No success flag certifies runtime. */
export function validateSagaRuntimeBinding(context) {
  const { diagnostics } = lowerSagaRuntimeBinding(context);
  return { valid: diagnostics.length === 0, ir: null, plan: null, diagnostics,
    runtimeBindingVerified: false, runnable: false };
}
