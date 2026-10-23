import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { compileSagas } from '../saga/compile.mjs';

// Static contract dependency only. compileExecution never reads source files,
// writes artifacts, resolves implementations, or invokes a runtime/emitter.
const schema = structuredClone(createRequire(import.meta.url)('../../schema/execution-ir-v1.schema.json'));
const sagaSchema = structuredClone(createRequire(import.meta.url)('../../schema/saga-ir-v1.schema.json'));
const own = (object, key) => Object.hasOwn(object, key);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const escape = (key) => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const child = (pointer, key) => `${pointer}/${escape(key)}`;

// Private bounded validator. External references are allowlisted static Saga
// contracts, not filesystem/network resolution or a second weakened definition.
const keywords = new Set(['$schema', '$id', '$defs', '$ref', 'title', 'description',
  'type', 'const', 'enum', 'oneOf', 'minLength', 'maxLength', 'pattern', 'minimum',
  'maximum', 'minItems', 'maxItems', 'uniqueItems', 'items', 'required', 'properties',
  'propertyNames', 'additionalProperties']);
function reference(ref, root) {
  const prefix = 'saga-ir-v1.schema.json#/$defs/';
  if (ref.startsWith(prefix) && own(sagaSchema.$defs, ref.slice(prefix.length))) {
    return [sagaSchema.$defs[ref.slice(prefix.length)], sagaSchema];
  }
  if (ref.startsWith('#/$defs/') && own(root.$defs, ref.slice(8))) return [root.$defs[ref.slice(8)], root];
  throw new Error(`Unsupported schema reference: ${ref}`);
}
function audit(contract, root) {
  for (const [key, value] of Object.entries(contract)) {
    if (!keywords.has(key)) throw new Error(`Unknown schema keyword: ${key}`);
    if (key === '$ref') reference(value, root);
    if (key === '$defs' || key === 'properties') Object.values(value).forEach((entry) => audit(entry, root));
    if (key === 'oneOf') value.forEach((entry) => audit(entry, root));
    if (['items', 'additionalProperties', 'propertyNames'].includes(key) && object(value)) audit(value, root);
  }
}
audit(schema, schema);
audit(sagaSchema, sagaSchema);
function validate(value, contract, pointer, report, root = schema) {
  if (contract.$ref) {
    const [target, targetRoot] = reference(contract.$ref, root);
    return validate(value, target, pointer, report, targetRoot);
  }
  if (contract.oneOf) {
    const attempts = contract.oneOf.map((branch) => {
      const errors = [];
      validate(value, branch, pointer, (at, message) => errors.push([at, message]), root);
      return errors;
    });
    if (attempts.filter((errors) => !errors.length).length !== 1) {
      // Prefer the explicitly present discriminator for diagnostics only. Still
      // require exactly one fully valid branch; this never weakens oneOf.
      const discriminator = object(value) && ['port', 'invokeSaga'].filter((key) => own(value, key));
      const selected = discriminator && discriminator.length === 1
        ? contract.oneOf.findIndex((branch) => {
          const target = branch.$ref ? reference(branch.$ref, root)[0] : branch;
          return target.required?.includes(discriminator[0]);
        }) : -1;
      const nearest = selected >= 0 ? attempts[selected] : [...attempts].sort((a, b) => a.length - b.length)[0];
      if (nearest.length) nearest.forEach(([at, message]) => report(at, message));
      else report(pointer, 'Exactly one schema variant must match.');
    }
  }
  const types = Array.isArray(contract.type) ? contract.type : [contract.type];
  const matches = (type) => type === undefined
    || (type === 'object' && object(value))
    || (type === 'array' && Array.isArray(value))
    || (type === 'null' && value === null)
    || (type === 'string' && typeof value === 'string')
    || (type === 'boolean' && typeof value === 'boolean')
    || (type === 'integer' && Number.isSafeInteger(value));
  if (!types.some(matches)) {
    report(pointer, `Expected ${types.join(' or ')}.`);
    return;
  }
  if (own(contract, 'const') && !isDeepStrictEqual(value, contract.const)) {
    report(pointer, `Expected constant ${JSON.stringify(contract.const)}.`);
  }
  if (contract.enum && !contract.enum.some((item) => isDeepStrictEqual(value, item))) {
    report(pointer, `Expected one of ${contract.enum.join(', ')}.`);
  }
  if (typeof value === 'string') {
    if (contract.minLength !== undefined && [...value].length < contract.minLength) {
      report(pointer, `Expected at least ${contract.minLength} characters.`);
    }
    if (contract.maxLength !== undefined && [...value].length > contract.maxLength) {
      report(pointer, `Expected at most ${contract.maxLength} characters.`);
    }
    if (contract.pattern && !new RegExp(contract.pattern, 'u').test(value)) {
      report(pointer, `Value does not match ${contract.pattern}.`);
    }
  }
  if (typeof value === 'number') {
    if (contract.minimum !== undefined && value < contract.minimum) report(pointer, `Minimum is ${contract.minimum}.`);
    if (contract.maximum !== undefined && value > contract.maximum) report(pointer, `Maximum is ${contract.maximum}.`);
  }
  if (Array.isArray(value)) {
    if (contract.minItems !== undefined && value.length < contract.minItems) {
      report(pointer, `Expected at least ${contract.minItems} items.`);
    }
    if (contract.maxItems !== undefined && value.length > contract.maxItems) {
      report(pointer, `Expected at most ${contract.maxItems} items.`);
    }
    for (let index = 0; index < value.length; index++) {
      const at = child(pointer, index);
      if (contract.items) validate(value[index], contract.items, at, report, root);
      if (contract.uniqueItems && value.slice(0, index).some((item) => isDeepStrictEqual(item, value[index]))) {
        report(at, 'Duplicate array item.');
      }
    }
  }
  if (object(value)) {
    for (const key of contract.required ?? []) {
      if (!own(value, key)) report(child(pointer, key), 'Required property is missing.');
    }
    for (const [key, entry] of Object.entries(value)) {
      const at = child(pointer, key);
      if (contract.propertyNames) validate(key, contract.propertyNames, at, report, root);
      if (own(contract.properties ?? {}, key)) validate(entry, contract.properties[key], at, report, root);
      else if (contract.additionalProperties === false) report(at, 'Unknown property is not supported in v1.');
      else if (object(contract.additionalProperties)) validate(entry, contract.additionalProperties, at, report, root);
    }
  }
}

/** Shape validation for the tree's explicitly opted-in declarations only.
 * Binding/dataflow/runtime safety are checked by compileExecution separately. */
export function validateExecutionDeclarations(pipeline) {
  const diagnostics = [];
  const report = (pointer, message) => diagnostics.push({ pointer, message });
  if (own(pipeline, 'execution')) {
    validate(pipeline.execution, schema.$defs.execution, '/execution', report);
    for (const [index, step] of (pipeline.steps ?? []).entries()) {
      if (object(step)) validate(step.execution, schema.$defs.stepExecution, `/steps/${index}/execution`, report);
    }
  } else {
    for (const [index, step] of (pipeline.steps ?? []).entries()) {
      if (object(step) && own(step, 'execution')) {
        report(`/steps/${index}/execution`, 'Step execution requires an explicit pipeline execution declaration.');
      }
    }
  }
  return diagnostics;
}

function sourceResolver(binding) {
  // Only validated hint maps control provenance. Nested Saga binding pointers
  // are rebased to the actual two-argument document; outer exact hints win.
  const hints = { canonical: {}, binding: {} };
  const merge = (value, nested = false) => {
    if (!object(value) || !own(value, 'sourceMap')) return;
    const errors = [];
    validate(value.sourceMap, nested ? sagaSchema.$defs.sourceHints : schema.$defs.sourceHints, '',
      (path) => errors.push(path), nested ? sagaSchema : schema);
    if (errors.length) return;
    for (const document of ['canonical', 'binding']) {
      for (const [pointer, hint] of Object.entries(value.sourceMap[document] ?? {})) {
        hints[document][nested && document === 'binding' ? `/sagaBindings${pointer}` : pointer] = hint;
      }
    }
  };
  if (object(binding)) merge(binding.sagaBindings, true);
  merge(binding);
  return (document, pointer) => {
    const map = hints[document] ?? {};
    let ancestor = pointer;
    let hint;
    while (true) {
      if (own(map, ancestor)) { hint = map[ancestor]; break; }
      if (!ancestor) break;
      ancestor = ancestor.slice(0, ancestor.lastIndexOf('/'));
    }
    return {
      document, pointer,
      file: hint?.file ?? null,
      atom: hint?.atom ?? null,
      path: hint && own(hint, 'path') ? hint.path + pointer.slice(ancestor.length) : pointer,
      location: hint?.location ? { ...hint.location } : null,
    };
  };
}

/**
 * Compile canonical pipeline.execution / step.execution and a bindingDocument.
 * Returns { ir, diagnostics }; ir is null on ANY error (no partial execution).
 * A diagnostic is { code, message, source, related? }, with schema-defined source
 * records and optional related declaration sources. Ordering is deterministic.
 * An omitted binding is an empty binding document, useful for legacy narratives;
 * explicit null/invalid bindings fail. Inputs are neither mutated nor retained.
 * Optional binding.sagaBindings is an independent truthsrc.saga-binding/v1
 * document. compileSagas closes ALL canonical.sagas; adapters live only in each
 * pipeline binding's invocations facet. No third argument or CLI mode change.
 * durable-source-stage identity is scoped by Saga ID/version AND pipeline.id,
 * then durable source/stage occurrence/optional iteration/chunk plus step.id.
 * The host mapper must implement this declaration; it is not evaluated here.
 * Success means contract-only, never runtime/codec/idempotency certification.
 */
export function compileExecution(canonical, binding) {
  const bindings = binding === undefined
    ? { schemaVersion: 'truthsrc.execution-binding/v1', pipelines: [] }
    : binding;
  const source = sourceResolver(bindings);
  const diagnostics = [];
  const error = (code, message, document, pointer, related) => {
    const diagnostic = { code, message, source: source(document, pointer) };
    if (related?.length) diagnostic.related = related.map(([doc, path]) => source(doc, path));
    diagnostics.push(diagnostic);
  };
  const check = (value, definition, document, pointer) => {
    validate(value, schema.$defs[definition], pointer,
      (path, message) => error('EXEC_SCHEMA', message, document, path));
  };
  check(canonical, 'canonicalEnvelope', 'canonical', '');
  check(bindings, 'bindingDocument', 'binding', '');
  if (diagnostics.length) return { ir: null, diagnostics };

  const pipelines = canonical.pipelines ?? [];
  const index = (rows, key, document, pointer) => {
    const entries = new Map();
    rows.forEach((row, ordinal) => {
      const at = child(pointer, ordinal);
      if (entries.has(row[key])) {
        error('EXEC_DUPLICATE', `Duplicate ${key}: ${row[key]}.`, document, child(at, key),
          [[document, child(entries.get(row[key]).pointer, key)]]);
      } else entries.set(row[key], { value: row, pointer: at, ordinal });
    });
    return entries;
  };
  const pipelineIndex = index(pipelines, 'id', 'canonical', '/pipelines');
  const bindingIndex = index(bindings.pipelines, 'pipelineId', 'binding', '/pipelines');
  const executing = [];
  const narratives = [];
  pipelines.forEach((pipeline, ordinal) => {
    const pointer = `/pipelines/${ordinal}`;
    index(pipeline.steps, 'id', 'canonical', `${pointer}/steps`);
    if (!own(pipeline, 'execution')) {
      narratives.push({ pipeline, pointer });
      pipeline.steps.forEach((step, stepOrdinal) => {
        if (own(step, 'execution')) {
          error('EXEC_ORPHAN_STEP', 'Step execution requires an explicit pipeline execution declaration.',
            'canonical', `${pointer}/steps/${stepOrdinal}/execution`);
        }
      });
      return;
    }
    // Legacy identifiers remain text; execution identifiers are nominal IDs.
    validate(pipeline.id, schema.$defs.id, `${pointer}/id`,
      (path, message) => error('EXEC_SCHEMA', message, 'canonical', path));
    check(pipeline.execution, 'execution', 'canonical', `${pointer}/execution`);
    pipeline.steps.forEach((step, stepOrdinal) => {
      const at = `${pointer}/steps/${stepOrdinal}`;
      validate(step.id, schema.$defs.id, `${at}/id`,
        (path, message) => error('EXEC_SCHEMA', message, 'canonical', path));
      check(step.execution, 'stepExecution', 'canonical', `${at}/execution`);
    });
    const bound = bindingIndex.get(pipeline.id);
    if (!bound) error('EXEC_BINDING_MISSING', `No binding for execution pipeline ${pipeline.id}.`, 'canonical', `${pointer}/execution`);
    executing.push({ pipeline, pointer, bound });
  });
  for (const [id, bound] of bindingIndex) {
    const target = pipelineIndex.get(id);
    if (!target || !own(target.value, 'execution')) {
      error('EXEC_BINDING_ORPHAN', `Binding ${id} does not target a declared execution pipeline.`,
        'binding', `${bound.pointer}/pipelineId`);
    }
  }
  if (diagnostics.length) return { ir: null, diagnostics };

  // Standalone Saga products remain outside execution readiness unless an
  // invocation (or an explicitly supplied nested binding) opts into closure.
  const hasInvocations = executing.some(({ pipeline }) => pipeline.steps.some((step) => own(step.execution, 'invokeSaga')));
  let sagaIr;
  if (hasInvocations || own(bindings, 'sagaBindings')) {
    if (hasInvocations && !own(bindings, 'sagaBindings')) {
      error('EXEC_SAGA_BINDING_MISSING', 'invokeSaga requires a nested sagaBindings document.', 'binding', '/sagaBindings');
    }
    const result = compileSagas(canonical, bindings.sagaBindings);
    for (const entry of result.diagnostics) {
      const rebase = (record) => source(record.document,
        record.document === 'binding' ? `/sagaBindings${record.pointer}` : record.pointer);
      diagnostics.push({ code: entry.code, message: entry.message, source: rebase(entry.source),
        ...(entry.related ? { related: entry.related.map(rebase) } : {}) });
    }
    sagaIr = result.ir;
  }
  if (diagnostics.length) return { ir: null, diagnostics };
  const sagaIndex = new Map((sagaIr?.sagas ?? []).map((entry, ordinal) => [entry.definition.id, {
    value: entry, definitionPointer: sagaIr.sourceMap[`/sagas/${ordinal}/definition`].pointer,
    bindingPointer: `/sagaBindings${sagaIr.sourceMap[`/sagas/${ordinal}/binding`].pointer}`,
  }]));

  const sameType = (actual, expected, document, pointer, related) => {
    if (actual !== expected) {
      error('EXEC_TYPE_MISMATCH', `Nominal type ${actual} does not equal ${expected}.`, document, pointer, related);
    }
  };
  for (const { pipeline, pointer: pp, bound } of executing) {
    const execution = pipeline.execution;
    const ep = `${pp}/execution`;
    const binding = bound.value;
    const bp = bound.pointer;
    const types = index(binding.types, 'id', 'binding', `${bp}/types`);
    const ports = index(binding.ports, 'id', 'binding', `${bp}/ports`);
    const invocations = index(binding.invocations ?? [], 'stepId', 'binding', `${bp}/invocations`);
    for (const [id, entry] of invocations) {
      const target = pipeline.steps.find((step) => step.id === id);
      if (!target || !own(target.execution, 'invokeSaga')) {
        error('EXEC_SAGA_INVOCATION_ORPHAN', `Adapter ${id} does not target an invokeSaga step.`,
          'binding', `${entry.pointer}/stepId`);
      }
    }
    const inputs = index(execution.inputs, 'id', 'canonical', `${ep}/inputs`);
    index(execution.outputs, 'id', 'canonical', `${ep}/outputs`);
    const knownType = (type, document, at) => {
      if (!types.has(type)) error('EXEC_TYPE_UNKNOWN', `Type ${type} has no binding.`, document, at);
    };
    if (!binding.codec.compatibleVersions.includes(binding.codec.version)) {
      error('EXEC_CODEC_VERSION', 'compatibleVersions must include the current codec version.',
        'binding', `${bp}/codec/compatibleVersions`, [['binding', `${bp}/codec/version`]]);
    }
    // Check all port declarations, including unused ones; unused malformed
    // contracts cannot be smuggled into otherwise valid IR.
    for (const { value: port, pointer: portPointer } of ports.values()) {
      index(port.inputs, 'slot', 'binding', `${portPointer}/inputs`);
      index(port.outputs, 'slot', 'binding', `${portPointer}/outputs`);
      index(port.outcomes, 'code', 'binding', `${portPointer}/outcomes`);
      for (const direction of ['inputs', 'outputs']) {
        port[direction].forEach((slot, ordinal) => knownType(slot.type, 'binding', `${portPointer}/${direction}/${ordinal}/type`));
      }
      const kinds = new Set(port.outcomes.map((outcome) => outcome.kind));
      for (const kind of ['success', 'infrastructure-failure']) {
        if (!kinds.has(kind)) error('EXEC_PORT_OUTCOME_REQUIRED', `Port must declare ${kind}.`, 'binding', `${portPointer}/outcomes`);
      }
      const idempotency = port.idempotency;
      if (idempotency.mode === 'none' && own(idempotency, 'key')) {
        error('EXEC_IDEMPOTENCY_KEY', 'Idempotency mode none must not declare a key.', 'binding', `${portPointer}/idempotency/key`);
      }
      if (idempotency.mode === 'keyed' && !port.inputs.some((slot) => slot.slot === idempotency.key)) {
        error('EXEC_IDEMPOTENCY_KEY', 'Keyed idempotency requires the name of a declared input slot.',
          'binding', `${portPointer}/idempotency/key`);
      }
      if (port.effect === 'external') {
        if (port.confirmation !== 'durable-ack') {
          error('EXEC_EXTERNAL_CONFIRMATION', 'External effects require durable-ack confirmation.', 'binding', `${portPointer}/confirmation`);
        }
        if (idempotency.mode !== 'keyed') {
          error('EXEC_EXTERNAL_IDEMPOTENCY', 'External effects require keyed idempotency.', 'binding', `${portPointer}/idempotency/mode`);
        }
        if (!kinds.has('unknown-effect')) {
          error('EXEC_EXTERNAL_UNKNOWN_EFFECT', 'External effects must declare an unknown-effect outcome.', 'binding', `${portPointer}/outcomes`);
        }
      }
    }

    const available = new Map();
    for (const [id, entry] of inputs) {
      knownType(entry.value.type, 'canonical', `${entry.pointer}/type`);
      available.set(`input:${id}`, { type: entry.value.type, pointer: entry.pointer });
    }
    const recoveryRefs = new Set(execution.recovery.inputs);
    for (const id of inputs.keys()) {
      if (!recoveryRefs.has(`input:${id}`)) {
        error('EXEC_RECOVERY_COVERAGE', `Recovery must cover initial input:${id}.`, 'canonical', `${ep}/recovery/inputs`,
          [['canonical', `${inputs.get(id).pointer}/id`]]);
      }
    }
    execution.recovery.inputs.forEach((ref, ordinal) => {
      if (!available.has(ref)) error('EXEC_RECOVERY_COVERAGE', `Recovery reference ${ref} is not an initial input.`,
        'canonical', `${ep}/recovery/inputs/${ordinal}`);
    });

    const allWrites = new Map();
    pipeline.steps.forEach((step, ordinal) => {
      const sp = `${pp}/steps/${ordinal}/execution`;
      const writes = index(step.execution.writes, 'id', 'canonical', `${sp}/writes`);
      for (const [id, entry] of writes) {
        allWrites.set(`step:${step.id}:${id}`, { ...entry, stepOrdinal: ordinal });
      }
    });
    const resolve = (ref, type, at, stepOrdinal) => {
      knownType(type, 'canonical', `${at}/type`);
      const entry = available.get(ref);
      if (entry) sameType(type, entry.type, 'canonical', `${at}/type`, [['canonical', `${entry.pointer}/type`]]);
      else {
        const declared = allWrites.get(ref);
        const forward = declared && declared.stepOrdinal >= stepOrdinal;
        error(forward ? 'EXEC_REF_FORWARD' : 'EXEC_REF_UNKNOWN',
          forward ? `Reference ${ref} is not available before this step completes.` : `Reference ${ref} is not declared.`,
          'canonical', `${at}/ref`, declared ? [['canonical', declared.pointer]] : undefined);
      }
    };
    const slotsEqual = (rows, portRows, direction, sp, portPointer) => {
      const key = direction === 'reads' ? 'inputs' : 'outputs';
      const actual = index(rows, 'slot', 'canonical', `${sp}/${direction}`);
      const expected = new Map(portRows.map((slot, ordinal) => [slot.slot, { value: slot, pointer: `${portPointer}/${key}/${ordinal}` }]));
      for (const [slot, entry] of actual) {
        const declared = expected.get(slot);
        if (!declared) error('EXEC_PORT_SLOT_COVERAGE', `Slot ${slot} is not declared by the port ${key}.`, 'canonical', `${entry.pointer}/slot`);
        else sameType(entry.value.type, declared.value.type, 'canonical', `${entry.pointer}/type`, [['binding', `${declared.pointer}/type`]]);
      }
      for (const [slot, entry] of expected) {
        if (!actual.has(slot)) error('EXEC_PORT_SLOT_COVERAGE', `Step ${direction} must cover port slot ${slot}.`,
          'canonical', `${sp}/${direction}`, [['binding', entry.pointer]]);
      }
    };
    const sharedSagaTypes = new Map();
    const visitedSagas = new Set();
    const checkSaga = (step, contract, sp, ordinal, outcomes) => {
      const invocation = contract.invokeSaga;
      const ip = `${sp}/invokeSaga`;
      const adapter = invocations.get(step.id);
      const saga = sagaIndex.get(invocation.ref.sagaId);
      if (!adapter) error('EXEC_SAGA_INVOCATION_MISSING', `No Saga adapter for step ${step.id}.`, 'canonical', ip);
      if (!saga) error('EXEC_SAGA_UNKNOWN', `Saga ${invocation.ref.sagaId} is not declared.`, 'canonical', `${ip}/ref/sagaId`);
      const reads = index(contract.reads, 'slot', 'canonical', `${sp}/reads`);
      index(contract.writes, 'slot', 'canonical', `${sp}/writes`);
      const consumedReads = new Set();
      const readSource = (mapping, at) => {
        resolve(mapping.ref, mapping.type, at, ordinal);
        const candidates = [...reads.values()].filter(({ value }) => value.ref === mapping.ref && value.type === mapping.type);
        if (!candidates.length) error('EXEC_SAGA_READ_MAPPING', 'Mapping must consume an exact typed step read.', 'canonical', `${at}/ref`);
        candidates.forEach(({ value }) => consumedReads.add(value.slot));
      };
      const args = index(invocation.args, 'slot', 'canonical', `${ip}/args`);
      for (const entry of args.values()) readSource(entry.value, entry.pointer);
      const identity = invocation.transactionIdentity;
      knownType(identity.type, 'canonical', `${ip}/transactionIdentity/type`);
      if (identity.stageId !== step.id) error('EXEC_SAGA_STAGE_ID', 'Identity stageId must equal the invoking step ID.',
        'canonical', `${ip}/transactionIdentity/stageId`, [['canonical', `${pp}/steps/${ordinal}/id`]]);
      const identityEntries = ['source', 'stageOccurrence', 'iteration', 'chunk'].filter((key) => own(identity, key));
      for (const key of identityEntries) {
        const at = `${ip}/transactionIdentity/${key}`;
        readSource(identity[key], at);
        const ref = identity[key].ref;
        if (!ref.startsWith('input:') || !inputs.has(ref.slice(6))) {
          error('EXEC_SAGA_IDENTITY_SOURCE', 'Transaction identity tokens must reference durable initial inputs, never step writes.',
            'canonical', `${at}/ref`);
        }
      }
      for (const entry of reads.values()) {
        if (!consumedReads.has(entry.value.slot)) error('EXEC_SAGA_READ_UNUSED', 'Every Saga step read must be consumed by args or identity.',
          'canonical', `${entry.pointer}/slot`);
      }
      const results = index(invocation.results, 'resultKind', 'canonical', `${ip}/results`);
      index(invocation.results, 'code', 'canonical', `${ip}/results`);
      const kinds = {
        succeeded: 'success', 'rejected-before-effects': 'business-rejection', compensated: 'business-rejection',
        'recovery-required': 'infrastructure-failure', 'outcome-unknown': 'unknown-effect',
      };
      for (const kind of Object.keys(kinds)) {
        if (!results.has(kind)) error('EXEC_SAGA_RESULT_COVERAGE', `Explicit mapping required for Saga result ${kind}.`, 'canonical', `${ip}/results`);
      }
      const mappedCodes = new Set();
      for (const { value: mapping, pointer: at } of results.values()) {
        mappedCodes.add(mapping.code);
        const outcome = outcomes.get(mapping.code);
        if (!outcome) error('EXEC_SAGA_RESULT_COVERAGE', `Mapped outcome ${mapping.code} is not declared by the step.`, 'canonical', `${at}/code`);
        else if (outcome.value.kind !== kinds[mapping.resultKind]) {
          error('EXEC_SAGA_RESULT_KIND', `${mapping.resultKind} must map to ${kinds[mapping.resultKind]}; v1 has no resolved policy.`,
            'canonical', `${outcome.pointer}/kind`, [['canonical', `${at}/resultKind`]]);
        }
        const outputs = index(mapping.outputs, 'slot', 'canonical', `${at}/outputs`);
        const continuing = mapping.resultKind === 'succeeded';
        if (!continuing && mapping.outputs.length) error('EXEC_SAGA_RESULT_OUTPUT', 'Noncontinuing Saga results must not publish writes.',
          'canonical', `${at}/outputs`);
        if (continuing) {
          const writes = new Map(contract.writes.map((write, writeOrdinal) => [write.slot, { value: write, pointer: `${sp}/writes/${writeOrdinal}` }]));
          for (const [slot, entry] of outputs) {
            const write = writes.get(slot);
            if (!write) error('EXEC_SAGA_RESULT_OUTPUT', `Result output ${slot} has no step write.`, 'canonical', `${entry.pointer}/slot`);
            else sameType(entry.value.type, write.value.type, 'canonical', `${entry.pointer}/type`, [['canonical', `${write.pointer}/type`]]);
          }
          for (const [slot, write] of writes) {
            if (!outputs.has(slot)) error('EXEC_SAGA_RESULT_OUTPUT', `Continuing result must publish write ${slot}.`, 'canonical', `${at}/outputs`,
              [['canonical', write.pointer]]);
          }
        }
        for (const entry of outputs.values()) knownType(entry.value.type, 'canonical', `${entry.pointer}/type`);
      }
      for (const [code, outcome] of outcomes) {
        if (!mappedCodes.has(code)) error('EXEC_SAGA_RESULT_COVERAGE', `Step outcome ${code} has no Saga result mapping.`,
          'canonical', `${outcome.pointer}/code`);
      }
      if (!saga) return; // Unknown refs cannot bypass the mapping/identity checks above.
      const definition = saga.value.definition;
      const technical = saga.value.binding;
      const dp = saga.definitionPointer;
      const sbp = saga.bindingPointer;
      if (invocation.ref.version !== definition.version) error('EXEC_SAGA_VERSION', 'Invocation must pin the exact Saga definition version.',
        'canonical', `${ip}/ref/version`, [['canonical', `${dp}/version`]]);
      const sagaTypes = new Map(technical.types.map((type, typeOrdinal) => [type.id,
        { value: type, pointer: `${sbp}/types/${typeOrdinal}` }]));
      if (!visitedSagas.has(definition.id)) {
        visitedSagas.add(definition.id);
        // A pipeline's nominal type denotes one exact contract, recursively:
        // compare every shared binding (including referenced element/field types).
        for (const [id, entry] of sagaTypes) {
          const previous = sharedSagaTypes.get(id);
          if (previous && !isDeepStrictEqual(entry.value, previous.value)) {
            error('EXEC_SAGA_TYPE_CONTRACT', `Shared type ${id} has conflicting Saga contracts within this pipeline.`,
              'binding', entry.pointer, [['binding', previous.pointer]]);
          } else if (!previous) sharedSagaTypes.set(id, entry);
        }
      }
      const sharedType = (id, document, at) => {
        const expected = sagaTypes.get(id);
        const actual = types.get(id);
        if (!expected) error('EXEC_SAGA_TYPE_UNKNOWN', `Type ${id} has no Saga binding.`, document, at);
        else if (actual && actual.value.implementation !== expected.value.implementation) {
          error('EXEC_SAGA_TYPE_IMPLEMENTATION', `Type ${id} must use the exact Saga implementation.`, 'binding', `${actual.pointer}/implementation`,
            [['binding', `${expected.pointer}/implementation`]]);
        }
        return expected?.value;
      };
      for (const entry of reads.values()) sharedType(entry.value.type, 'canonical', `${entry.pointer}/type`);
      const expectedArgs = new Map(definition.payload.args.map((arg, argOrdinal) => [arg.slot,
        { value: arg, pointer: `${dp}/payload/args/${argOrdinal}` }]));
      for (const [slot, entry] of args) {
        const expected = expectedArgs.get(slot);
        if (!expected) error('EXEC_SAGA_ARG_COVERAGE', `Arg ${slot} is not declared by the Saga.`, 'canonical', `${entry.pointer}/slot`);
        else sameType(entry.value.type, expected.value.type, 'canonical', `${entry.pointer}/type`, [['canonical', `${expected.pointer}/type`]]);
        sharedType(entry.value.type, 'canonical', `${entry.pointer}/type`);
      }
      for (const [slot, expected] of expectedArgs) {
        if (!args.has(slot)) error('EXEC_SAGA_ARG_COVERAGE', `Explicit mapping required for Saga arg ${slot}.`, 'canonical', `${ip}/args`,
          [['canonical', expected.pointer]]);
      }
      // Substitution must preserve the Saga compiler's static non-aliasing
      // guarantee. Different runtime values still require host validation.
      const resources = new Map();
      definition.payload.participants.forEach((participant, participantOrdinal) => {
        const arg = args.get(participant.resourceRef.ref.slice(5));
        if (!arg) return;
        const key = JSON.stringify([participant.aggregate, arg.value.ref]);
        const previous = resources.get(key);
        if (previous) error('EXEC_SAGA_RESOURCE_ALIAS', 'Invocation args alias two participants to the same declared resource source.',
          'canonical', `${arg.pointer}/ref`, [['canonical', `${previous.pointer}/ref`],
            ['canonical', `${dp}/payload/participants/${participantOrdinal}/resourceRef`]]);
        else resources.set(key, arg);
      });
      sameType(identity.type, definition.payload.transactionIdType, 'canonical', `${ip}/transactionIdentity/type`,
        [['canonical', `${dp}/payload/transactionIdType`]]);
      sharedType(identity.type, 'canonical', `${ip}/transactionIdentity/type`);
      for (const key of identityEntries) {
        const type = sharedType(identity[key].type, 'canonical', `${ip}/transactionIdentity/${key}/type`);
        const stable = type && (type.kind === 'id' || (key !== 'source' && type.kind === 'integer'
          && type.minimum >= 0 && type.maximum >= type.minimum));
        if (!stable) error('EXEC_SAGA_IDENTITY_TYPE', 'Identity source must be an ID; occurrence/iteration/chunk require an ID or bounded nonnegative integer.',
          'canonical', `${ip}/transactionIdentity/${key}/type`);
      }
      for (const { value: mapping, pointer: at } of results.values()) {
        const completionOrdinal = definition.payload.completions.findIndex((entry) => entry.kind === mapping.resultKind);
        const completion = definition.payload.completions[completionOrdinal];
        const fields = new Map(completion.bindings.map((entry, fieldOrdinal) => [entry.slot,
          { value: entry, pointer: `${dp}/payload/completions/${completionOrdinal}/bindings/${fieldOrdinal}` }]));
        for (const [outputOrdinal, output] of mapping.outputs.entries()) {
          const op = `${at}/outputs/${outputOrdinal}`;
          const field = fields.get(output.ref.slice(7));
          if (!field) error('EXEC_SAGA_RESULT_REF', `Result field ${output.ref} is not declared by the completion event.`, 'canonical', `${op}/ref`,
            [['canonical', `${dp}/payload/completions/${completionOrdinal}`]]);
          else sameType(output.type, field.value.type, 'canonical', `${op}/type`, [['canonical', `${field.pointer}/type`]]);
          sharedType(output.type, 'canonical', `${op}/type`);
        }
      }
      if (!adapter) return;
      const ap = adapter.pointer;
      for (const key of ['sagaId', 'version']) {
        if (adapter.value.ref[key] !== invocation.ref[key]) error('EXEC_SAGA_ADAPTER_REF', 'Adapter must pin the exact invocation ref.',
          'binding', `${ap}/ref/${key}`, [['canonical', `${ip}/ref/${key}`]]);
      }
      for (const key of ['artifact', 'apiMode', 'entrypoint']) {
        if (adapter.value.runtime[key] !== technical.engine[key]) error('EXEC_SAGA_RUNTIME', 'Adapter runtime must equal the pinned Saga engine.',
          'binding', `${ap}/runtime/${key}`, [['binding', `${sbp}/engine/${key}`]]);
      }
      for (const key of ['id', 'version', 'mapper']) {
        if (adapter.value.argsCodec[key] !== technical.codec[key]) error('EXEC_SAGA_CODEC', 'Adapter args codec must exactly equal the Saga codec.',
          'binding', `${ap}/argsCodec/${key}`, [['binding', `${sbp}/codec/${key}`]]);
      }
      if (adapter.value.resultCodec.version !== technical.codec.version) error('EXEC_SAGA_CODEC', 'Result codec version must equal the pinned Saga args codec version.',
        'binding', `${ap}/resultCodec/version`, [['binding', `${sbp}/codec/version`]]);
    };
    pipeline.steps.forEach((step, ordinal) => {
      const sp = `${pp}/steps/${ordinal}/execution`;
      const contract = step.execution;
      const portEntry = ports.get(contract.port);
      // Even an unknown port cannot bypass dataflow/outcome validation.
      contract.reads.forEach((read, readOrdinal) => resolve(read.ref, read.type, `${sp}/reads/${readOrdinal}`, ordinal));
      contract.writes.forEach((write, writeOrdinal) => knownType(write.type, 'canonical', `${sp}/writes/${writeOrdinal}/type`));
      const outcomes = index(contract.outcomes, 'code', 'canonical', `${sp}/outcomes`);
      for (const { value: outcome, pointer: at } of outcomes.values()) {
        const allowed = outcome.kind === 'success' || outcome.kind === 'resolved' ? ['continue']
          : outcome.kind === 'business-rejection' ? ['stop', 'manual-recovery'] : ['manual-recovery'];
        if (!allowed.includes(outcome.action)) error('EXEC_OUTCOME_ACTION', `${outcome.kind} requires ${allowed.join(' or ')}.`, 'canonical', `${at}/action`);
      }
      if (own(contract, 'invokeSaga')) {
        checkSaga(step, contract, sp, ordinal, outcomes);
      } else if (!portEntry) {
        error('EXEC_PORT_UNKNOWN', `Port ${contract.port} has no binding.`, 'canonical', `${sp}/port`);
      } else {
        const port = portEntry.value;
        slotsEqual(contract.reads, port.inputs, 'reads', sp, portEntry.pointer);
        slotsEqual(contract.writes, port.outputs, 'writes', sp, portEntry.pointer);
        const portOutcomes = new Map(port.outcomes.map((outcome, outcomeOrdinal) => [outcome.code,
          { value: outcome, pointer: `${portEntry.pointer}/outcomes/${outcomeOrdinal}` }]));
        for (const [code, entry] of outcomes) {
          const expected = portOutcomes.get(code);
          if (!expected) error('EXEC_OUTCOME_COVERAGE', `Outcome ${code} is not declared by the port.`, 'canonical', `${entry.pointer}/code`);
          else if (entry.value.kind !== expected.value.kind) {
            error('EXEC_OUTCOME_KIND', `Outcome ${code} must have kind ${expected.value.kind}.`, 'canonical', `${entry.pointer}/kind`,
              [['binding', `${expected.pointer}/kind`]]);
          }
        }
        for (const [code, entry] of portOutcomes) {
          if (!outcomes.has(code)) error('EXEC_OUTCOME_COVERAGE', `Step must explicitly handle port outcome ${code}.`,
            'canonical', `${sp}/outcomes`, [['binding', entry.pointer]]);
        }
        if (port.effect === 'external' && port.idempotency.mode === 'keyed') {
          const keyOrdinal = contract.reads.findIndex((read) => read.slot === port.idempotency.key);
          const keyRef = keyOrdinal >= 0 ? contract.reads[keyOrdinal].ref : '';
          if (keyOrdinal >= 0 && (!keyRef.startsWith('input:') || !inputs.has(keyRef.slice(6)))) {
            error('EXEC_EXTERNAL_KEY_SOURCE', 'External idempotency keys must reference a durable initial input, never a step write.',
              'canonical', `${sp}/reads/${keyOrdinal}/ref`, [['binding', `${portEntry.pointer}/idempotency/key`]]);
          }
        }
      }
      // Publication follows reads: self/forward references can never resolve.
      contract.writes.forEach((write, writeOrdinal) => {
        available.set(`step:${step.id}:${write.id}`, { type: write.type, pointer: `${sp}/writes/${writeOrdinal}` });
      });
    });
    execution.outputs.forEach((output, ordinal) => resolve(output.ref, output.type, `${ep}/outputs/${ordinal}`, pipeline.steps.length));
  }
  if (diagnostics.length) return { ir: null, diagnostics };

  const sourceMap = {};
  // copy maps structurally identical input data; derived maps generated values
  // to their declaration without inventing field pointers or line numbers.
  const copy = (value, destination, document, pointer, derived = false) => {
    sourceMap[destination] = source(document, pointer);
    if (Array.isArray(value)) return value.map((item, ordinal) => copy(item, child(destination, ordinal), document,
      derived ? pointer : child(pointer, ordinal), derived));
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      copy(item, child(destination, key), document, derived ? pointer : child(pointer, key), derived)]));
    return value;
  };
  sourceMap[''] = source('canonical', '');
  sourceMap['/pipelines'] = source('canonical', '/pipelines');
  sourceMap['/documentOnly'] = source('canonical', '/pipelines');
  const ir = {
    schemaVersion: copy('truthsrc.execution/v1', '/schemaVersion', 'canonical',
      executing.length ? `${executing[0].pointer}/execution/schemaVersion` : '/schemaVersion', true),
    workshop: copy(canonical.workshop, '/workshop', 'canonical', '/workshop'),
    pipelines: executing.map(({ pipeline, pointer: pp, bound }, ordinal) => {
      const destination = `/pipelines/${ordinal}`;
      const ep = `${pp}/execution`;
      const bp = bound.pointer;
      const result = {
        id: copy(pipeline.id, `${destination}/id`, 'canonical', `${pp}/id`),
        name: copy(pipeline.name, `${destination}/name`, 'canonical', `${pp}/name`),
        readiness: copy('contract-only', `${destination}/readiness`, 'canonical', `${pp}/execution`, true),
        inputs: copy(pipeline.execution.inputs, `${destination}/inputs`, 'canonical', `${ep}/inputs`),
        outputs: copy(pipeline.execution.outputs, `${destination}/outputs`, 'canonical', `${ep}/outputs`),
        steps: pipeline.steps.map((step, stepOrdinal) => {
          const at = `${destination}/steps/${stepOrdinal}`;
          const sp = `${pp}/steps/${stepOrdinal}`;
          const result = {
            id: copy(step.id, `${at}/id`, 'canonical', `${sp}/id`),
            name: copy(step.name, `${at}/name`, 'canonical', `${sp}/name`),
            ordinal: copy(stepOrdinal, `${at}/ordinal`, 'canonical', sp, true),
          };
          sourceMap[at] = source('canonical', sp);
          const variant = own(step.execution, 'invokeSaga') ? 'invokeSaga' : 'port';
          for (const key of [variant, 'reads', 'writes', 'outcomes']) result[key] = copy(step.execution[key], `${at}/${key}`, 'canonical', `${sp}/execution/${key}`);
          return result;
        }),
        recovery: copy(pipeline.execution.recovery, `${destination}/recovery`, 'canonical', `${ep}/recovery`),
        admission: copy(pipeline.execution.admission, `${destination}/admission`, 'canonical', `${ep}/admission`),
        binding: {},
      };
      sourceMap[destination] = source('canonical', pp);
      sourceMap[`${destination}/steps`] = source('canonical', `${pp}/steps`);
      sourceMap[`${destination}/binding`] = source('binding', bp);
      for (const key of ['engine', 'module', 'codec', 'types', 'ports']) result.binding[key] = copy(bound.value[key], `${destination}/binding/${key}`, 'binding', `${bp}/${key}`);
      if (own(bound.value, 'invocations')) result.binding.invocations = copy(bound.value.invocations,
        `${destination}/binding/invocations`, 'binding', `${bp}/invocations`);
      return result;
    }),
    documentOnly: narratives.map(({ pipeline, pointer }, ordinal) => {
      const at = `/documentOnly/${ordinal}`;
      sourceMap[at] = source('canonical', pointer);
      return {
        id: copy(pipeline.id, `${at}/id`, 'canonical', `${pointer}/id`),
        reason: copy('execution-not-declared', `${at}/reason`, 'canonical', pointer, true),
        source: copy(source('canonical', pointer), `${at}/source`, 'canonical', pointer, true),
      };
    }),
    sourceMap,
  };
  if (sagaIr) {
    // Reuse compileSagas' provenance instead of pretending sorted output ordinals
    // were canonical/binding ordinals. Definitions are emitted once, not per step.
    const copySaga = (value, destination, origin) => {
      const record = sagaIr.sourceMap[origin];
      sourceMap[destination] = source(record.document,
        record.document === 'binding' ? `/sagaBindings${record.pointer}` : record.pointer);
      if (Array.isArray(value)) return value.map((item, ordinal) => copySaga(item, child(destination, ordinal), child(origin, ordinal)));
      if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
        copySaga(item, child(destination, key), child(origin, key))]));
      return value;
    };
    ir.sagas = copySaga(sagaIr.sagas, '/sagas', '/sagas');
    if (!own(canonical, 'sagas')) sourceMap['/sagas'] = source('binding', '/sagaBindings/sagas');
  }
  // Keep the output contract fail-closed as well when the static schema evolves.
  validate(ir, schema, '', (pointer, message) => {
    diagnostics.push({ code: 'EXEC_IR_SCHEMA', message, source: sourceMap[pointer] ?? source('canonical', '') });
  });
  return { ir: diagnostics.length ? null : ir, diagnostics };
}
