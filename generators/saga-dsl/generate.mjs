// SagaS6 pure producer. Core owns dispatch, determinism checking and all writes.
// generate({canonical, options:{mode:'strict-contract', binding, ir?}}) -> entries
// generate({canonical, options:{mode:'legacy', legacySagaSpecs:[completeSpec]}})
// strict-scala is intentionally blocked: there is no verified runtime API here.
import { types } from 'node:util';
import { assertJsonData, emitLegacySagaSpec, stableJson, validateLegacySagaSpec } from './emit.mjs';
import { compileSagaContract } from './parse.mjs';

const phaseNames = ['prepare', 'commit', 'compensate'];
const pointerKey = (key) => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const runtimeBlocked = () => {
  throw new Error('SAGA_RUNTIME_BINDING_UNVERIFIED: strict Scala needs an explicitly verified runtime binding/API shape covering Decision, nonterminal unknown, query and recovery. No such shape is implemented here; only strict-contract output is supported.');
};

function verifyStrictIR(ir, expected) {
  assertJsonData(ir, 'strictIR');
  if (stableJson(ir) !== stableJson(expected)) {
    throw new Error('SAGA_IR_MISMATCH: strict IR must exactly equal compileSagas(canonical, binding), including digest/sourceMap; unknown fields or forged readiness are not supported');
  }
}

export function planStrictSagaIR(ir, context = {}) {
  assertJsonData(context, 'strictIRContext');
  const canonical = Object.hasOwn(context, 'canonical') ? context.canonical : undefined;
  const binding = Object.hasOwn(context, 'binding') ? context.binding : undefined;
  // The compiler is the schema + semantic authority. Verify the complete closure,
  // version, digest and provenance rather than trusting a caller-forged IR flag.
  const compiled = compileSagaContract(canonical, binding);
  verifyStrictIR(ir, compiled);
  return buildStrictPlan(compiled);
}

function buildStrictPlan(ir) {
  const entries = [];
  const physicalPrefixes = new Set();
  ir.sagas.forEach((contract, ordinal) => {
    const { definition, binding: technical } = contract;
    const payload = definition.payload;
    const prefix = `contracts/sagas/${definition.id}`;
    if (physicalPrefixes.has(prefix.toLowerCase())) throw new Error(`Case-alias Saga output path: ${prefix}`);
    physicalPrefixes.add(prefix.toLowerCase());
    const families = [...new Set(payload.participants.map((participant) => participant.aggregate))].sort(compare);
    const entry = (suffix, kind, value, deps = []) => ({
      path: `${prefix}.${suffix}.json`, content: stableJson(value), kind,
      schemaCategory: 'saga', schemaNode: definition.id, families, deps,
      // Anchor key == buildGraph node addressing (`saga:<id>`): core apply turns this
      // into anchors.json locations fingerprint-verified against the written bytes.
      knowledgeId: `saga:${definition.id}`,
    });
    const metadata = { schemaVersion: 'truthsrc.saga-generator-contract/v1',
      inputSchemaVersion: ir.schemaVersion, inputDigest: ir.digest,
      readiness: 'contract-only', runnable: false, runtimeBindingVerified: false,
      sagaId: definition.id, definitionVersion: definition.version };
    // Whole definition/binding (not first step/participant/trigger) remain physical
    // contract input. Names of runtime modules/mappers are requirements, not calls.
    entries.push(entry('contract', 'saga-contract', { ...metadata, workshop: ir.workshop, contract }));
    const participants = new Map(payload.participants.map((participant) => [participant.id, participant]));
    const addresses = new Map(technical.participants.map((participant) => [participant.participantId, participant.addressing]));
    const boundSteps = new Map(technical.steps.map((step) => [step.stepId, step]));
    const groups = new Map(payload.groups.map((group) => [group.id, group]));
    const rows = payload.steps.flatMap((step) => phaseNames.map((phase) => ({
      stepId: step.id, participantId: step.participant, participant: participants.get(step.participant),
      addressing: addresses.get(step.participant), group: groups.get(step.group), phase,
      declaration: step.phases[phase], binding: boundSteps.get(step.id).phases[phase],
    })));
    entries.push(entry('phases', 'saga-phase-table', { ...metadata, rows }, [`${prefix}.contract.json`]));
    const consumed = [];
    function visit(value, pointer) {
      const source = ir.sourceMap[pointer];
      if (!source) throw new Error(`SAGA_IR_SOURCE_MISSING: ${pointer}`);
      const container = value !== null && typeof value === 'object';
      consumed.push({ pointer, source, consumption: 'preserved-contract',
        ...(container ? { shape: Array.isArray(value) ? 'array' : 'object' } : { value }) });
      if (container) for (const key of Object.keys(value).sort(compare)) visit(value[key], `${pointer}/${pointerKey(key)}`);
    }
    visit(contract, `/sagas/${ordinal}`);
    entries.push(entry('consumption', 'saga-contract-ledger', {
      ...metadata, consumed,
      runtimeRequirements: technical.engine.capabilities.required.map((capability) => ({ capability, verification: 'unverified' })),
      blocked: ['runtime-api-shape-unverified', 'no-strict-runnable-source'],
    }, [`${prefix}.contract.json`, `${prefix}.phases.json`]));
  });
  return entries.sort((a, b) => compare(a.path, b.path));
}

export function generate(ctx = {}) {
  // Core's manifest is metadata, not producer input. Validate consumed own ctx
  // fields by descriptor before destructuring so accessors cannot run.
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx) || types.isProxy(ctx)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(ctx))) throw new Error('Saga generator requires a plain object context');
  if (Object.getOwnPropertyDescriptor(ctx, 'canonical') === undefined) throw new Error('Saga generator requires an own canonical input');
  const input = Object.create(null);
  for (const key of ['canonical', 'products', 'options']) {
    const descriptor = Object.getOwnPropertyDescriptor(ctx, key);
    if (!descriptor) continue;
    if (!Object.hasOwn(descriptor, 'value')) throw new Error(`context/${key}: only JSON data properties are supported`);
    input[key] = descriptor.value;
  }
  const { canonical, products = {}, options = {} } = input;
  assertJsonData(canonical, 'canonical');
  assertJsonData(products, 'products');
  assertJsonData(options, 'options');
  if (!canonical || Array.isArray(canonical) || !Object.hasOwn(canonical, 'schemaVersion') || canonical.schemaVersion !== 'truthsrc/v1') {
    throw new Error('Saga generator requires the truthsrc/v1 canonical view');
  }
  if (!products || typeof products !== 'object' || Array.isArray(products) || Object.keys(products).length) {
    throw new Error('Saga generator accepts canonical + explicit options only; populated products are not supported');
  }
  if (!options || Array.isArray(options) || typeof options !== 'object') throw new Error('Saga generator requires explicit options');
  if (!Object.hasOwn(options, 'mode')) throw new Error('Saga generator requires explicit mode');
  const supported = ['mode', 'binding', 'ir', 'legacySagaSpecs'];
  for (const key of Object.keys(options)) if (!supported.includes(key)) {
    throw new Error(`Saga generator unsupported option ${key}; runtime certificates/APIs cannot be guessed`);
  }
  if (options.mode === 'legacy') {
    if (Object.hasOwn(options, 'binding') || Object.hasOwn(options, 'ir')) throw new Error('Legacy mode cannot consume strict binding/IR');
    if (Object.hasOwn(canonical, 'sagas') && (!Array.isArray(canonical.sagas) || canonical.sagas.length)) {
      throw new Error('Legacy mode cannot downgrade or skip canonical Saga declarations');
    }
    if (!Object.hasOwn(options, 'legacySagaSpecs') || !Array.isArray(options.legacySagaSpecs) || !options.legacySagaSpecs.length) throw new Error('Legacy mode requires explicit complete legacySagaSpecs');
    const specs = options.legacySagaSpecs.map(validateLegacySagaSpec); // all fail before producing a plan
    const paths = new Set(), declarations = new Set();
    return specs.map((spec) => {
      const path = `src/main/scala/${spec.package.replaceAll('.', '/')}/${spec.objectName}.scala`;
      if (paths.has(path.toLowerCase())) throw new Error(`Duplicate legacy Saga output path: ${path}`);
      paths.add(path.toLowerCase());
      for (const name of [spec.objectName, spec.argsType, spec.contextType]) {
        const qualifiedName = `${spec.package}.${name}`;
        if (declarations.has(qualifiedName)) throw new Error(`Duplicate legacy Scala declaration: ${qualifiedName}`);
        declarations.add(qualifiedName);
      }
      return { path, content: emitLegacySagaSpec(spec), kind: 'saga-legacy-source',
        schemaCategory: 'saga', schemaNode: spec.name, families: [], deps: [] };
    }).sort((a, b) => compare(a.path, b.path));
  }
  if (!['strict-contract', 'strict-scala'].includes(options.mode)) {
    throw new Error('Saga generator requires explicit mode: legacy, strict-contract or strict-scala (runtime blocked)');
  }
  if (Object.hasOwn(options, 'legacySagaSpecs')) throw new Error('Strict mode cannot consume legacySagaSpecs');
  if (!Object.hasOwn(options, 'binding')) throw new Error('SAGA_BINDING_REQUIRED: provide the closed technical binding document explicitly');
  const compiled = compileSagaContract(canonical, options.binding);
  const ir = Object.hasOwn(options, 'ir') ? options.ir : compiled;
  verifyStrictIR(ir, compiled);
  if (options.mode === 'strict-scala') runtimeBlocked();
  return buildStrictPlan(compiled);
}
