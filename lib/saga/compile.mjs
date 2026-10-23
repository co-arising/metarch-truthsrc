import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Static contract only. compileSagas has no filesystem, runtime or emitter calls.
const schema = structuredClone(createRequire(import.meta.url)('../../schema/saga-ir-v1.schema.json'));
const own = (value, key) => Object.hasOwn(value, key);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const child = (path, key) => `${path}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
const phases = ['prepare', 'commit', 'compensate'];
const resultKinds = schema.$defs.resultKinds.const;
const stable = (value) => Array.isArray(value) ? value.map(stable) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;

// Private, deliberately bounded JSON Schema implementation. Every keyword in the
// shipped schema is implemented; adding an unimplemented keyword throws at load,
// instead of silently weakening the contract. Not coupled to execution's helper.
const keywords = new Set(['$schema', '$id', '$defs', '$ref', 'title', 'description',
  'type', 'const', 'enum', 'oneOf', 'properties', 'required', 'additionalProperties',
  'propertyNames', 'items', 'uniqueItems', 'minItems', 'maxItems', 'minLength',
  'maxLength', 'pattern', 'minimum', 'maximum']);
function audit(contract) {
  for (const [key, value] of Object.entries(contract)) {
    if (!keywords.has(key)) throw new Error(`Unknown schema keyword: ${key}`);
    if (key === '$defs' || key === 'properties') Object.values(value).forEach(audit);
    if (key === 'oneOf') value.forEach(audit);
    if (['items', 'propertyNames', 'additionalProperties'].includes(key) && object(value)) audit(value);
    if (key === '$ref' && (!value.startsWith('#/$defs/') || !own(schema.$defs, value.slice(8)))) {
      throw new Error(`Unsupported schema reference: ${value}`);
    }
  }
}
audit(schema);
function validate(value, contract, path, report) {
  if (contract.$ref) return validate(value, schema.$defs[contract.$ref.slice(8)], path, report);
  if (contract.oneOf) {
    const attempts = contract.oneOf.map((branch) => {
      const errors = [];
      validate(value, branch, path, (at, message) => errors.push([at, message]));
      return errors;
    });
    if (attempts.filter((errors) => !errors.length).length !== 1) {
      // Nearest branch retains precise missing/unknown-field pointers.
      const nearest = [...attempts].sort((a, b) => a.length - b.length)[0];
      if (nearest.length) nearest.forEach(([at, message]) => report(at, message));
      else report(path, 'Exactly one schema variant must match.');
    }
  }
  const matches = (type) => type === 'object' ? object(value) : type === 'array' ? Array.isArray(value)
    : type === 'integer' ? Number.isSafeInteger(value) : type === 'null' ? value === null
      : typeof value === type;
  if (contract.type && !(Array.isArray(contract.type) ? contract.type : [contract.type]).some(matches)) {
    report(path, `Expected ${[].concat(contract.type).join(' or ')}.`);
    return;
  }
  if (own(contract, 'const') && !isDeepStrictEqual(value, contract.const)) report(path, `Expected constant ${JSON.stringify(contract.const)}.`);
  if (contract.enum && !contract.enum.some((item) => isDeepStrictEqual(value, item))) report(path, `Expected one of ${contract.enum.join(', ')}.`);
  if (typeof value === 'string') {
    const length = [...value].length;
    if (contract.minLength !== undefined && length < contract.minLength) report(path, `Minimum string length is ${contract.minLength}.`);
    if (contract.maxLength !== undefined && length > contract.maxLength) report(path, `Maximum string length is ${contract.maxLength}.`);
    if (contract.pattern && !new RegExp(contract.pattern, 'u').test(value)) report(path, `Value does not match ${contract.pattern}.`);
  }
  if (typeof value === 'number') {
    if (contract.minimum !== undefined && value < contract.minimum) report(path, `Minimum is ${contract.minimum}.`);
    if (contract.maximum !== undefined && value > contract.maximum) report(path, `Maximum is ${contract.maximum}.`);
  }
  if (Array.isArray(value)) {
    if (contract.minItems !== undefined && value.length < contract.minItems) report(path, `Minimum item count is ${contract.minItems}.`);
    if (contract.maxItems !== undefined && value.length > contract.maxItems) report(path, `Maximum item count is ${contract.maxItems}.`);
    for (let i = 0; i < value.length; i++) {
      if (contract.items) validate(value[i], contract.items, child(path, i), report);
      if (contract.uniqueItems && value.slice(0, i).some((item) => isDeepStrictEqual(item, value[i]))) report(child(path, i), 'Duplicate array item.');
    }
  }
  if (object(value)) {
    for (const key of contract.required ?? []) if (!own(value, key)) report(child(path, key), 'Required property is missing.');
    for (const key of Object.keys(value).sort()) {
      const at = child(path, key);
      if (contract.propertyNames) validate(key, contract.propertyNames, at, report);
      if (own(contract.properties ?? {}, key)) validate(value[key], contract.properties[key], at, report);
      else if (contract.additionalProperties === false) report(at, 'Unknown property is not supported in v1.');
      else if (object(contract.additionalProperties)) validate(value[key], contract.additionalProperties, at, report);
    }
  }
}
// Do not execute getters or accept functions, sparse arrays, cycles, prototypes,
// symbols, nonfinite numbers or non-JSON properties, even inside opaque metadata.
function jsonCheck(value, path, report, ancestors = new Set()) {
  if (ancestors.size > 128) return report(path, 'JSON nesting exceeds the v1 compiler bound of 128.');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if ((!Array.isArray(value) && !object(value))
    || (Array.isArray(value) && Object.getPrototypeOf(value) !== Array.prototype)) return report(path, 'Expected plain JSON data.');
  if (ancestors.has(value)) return report(path, 'Cyclic JSON data is not supported.');
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (Array.isArray(value) && key === 'length') continue;
    const at = child(path, key);
    const entry = descriptors[key];
    if (typeof key === 'symbol' || !entry.enumerable || !own(entry, 'value')
      || (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key))) {
      report(at, 'Only enumerable JSON data properties are supported.');
    } else jsonCheck(entry.value, at, report, ancestors);
  }
  if (Array.isArray(value)) {
    const indexes = Object.keys(descriptors).filter((key) => /^(0|[1-9][0-9]*)$/.test(key)).map(Number).sort((a, b) => a - b);
    const missing = indexes.findIndex((index, ordinal) => index !== ordinal);
    if (missing >= 0 || indexes.length !== value.length) report(child(path, missing >= 0 ? missing : indexes.length), 'Sparse arrays are not supported.');
  }
  ancestors.delete(value);
}
function sourceResolver(binding) {
  let hints = {};
  if (binding?.sourceMap) {
    const errors = [];
    validate(binding.sourceMap, schema.$defs.sourceHints, '', (...args) => errors.push(args));
    if (!errors.length) hints = binding.sourceMap;
  }
  return (document, pointer) => {
    const map = hints[document] ?? {};
    let ancestor = pointer;
    let hint;
    while (true) {
      if (own(map, ancestor)) { hint = map[ancestor]; break; }
      if (!ancestor) break;
      ancestor = ancestor.slice(0, ancestor.lastIndexOf('/'));
    }
    return { document, pointer, file: hint?.file ?? null, atom: hint?.atom ?? null,
      path: hint?.path !== undefined ? hint.path + pointer.slice(ancestor.length) : pointer,
      // Ancestor location is its supplied anchor, never a fabricated child line.
      location: hint?.location ? { ...hint.location } : null };
  };
}

/**
 * compileSagas(canonical, binding) => {ir, diagnostics}
 * canonical is the parsed public truthsrc/v1 projection, not raw atoms or JSON
 * text. Omitted binding is an empty binding document (only no-Saga inputs pass).
 * Errors discard ALL IR. Diagnostic shape: {code,message,source,related?}; source
 * is {document,pointer,file,atom,path,location}. No input mutation/borrowed objects.
 * Success shape: ir={schemaVersion:'truthsrc.saga-ir/v1',workshop,
 * readiness:'contract-only',sagas:[{definition:{id,name,seq,version,payload},
 * binding:{sagaId,version,module,engine,codec,types,participants,steps,
 * triggerMappers,completionMappers},readiness:'contract-only'}],digest,sourceMap}.
 * Capability declarations and named mappers are NOT runtime certificates.
 * v1: static logical participants, complete TCC (or entirely read-only none),
 * DAG groups, exact nominal mappings, no expressions/literals/implicit joins.
 */
export function compileSagas(canonical, binding) {
  const bindings = binding === undefined ? { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [] } : binding;
  const diagnostics = [];
  let source = sourceResolver(undefined);
  const error = (code, message, document, pointer, related) => {
    const entry = { code, message, source: source(document, pointer) };
    if (related?.length) entry.related = related.map(([doc, path]) => source(doc, path));
    diagnostics.push(entry);
  };
  const finish = (ir = null) => ({ ir: diagnostics.length ? null : ir,
    diagnostics: diagnostics.sort((a, b) => {
      const ka = JSON.stringify([a.source.document, a.source.pointer, a.code, a.message]);
      const kb = JSON.stringify([b.source.document, b.source.pointer, b.code, b.message]);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }) });
  for (const [doc, value] of [['canonical', canonical], ['binding', bindings]]) {
    jsonCheck(value, '', (at, message) => error('SAGA_JSON', message, doc, at));
  }
  if (diagnostics.length) return finish();
  source = sourceResolver(bindings);
  const check = (value, def, doc, path) => validate(value, schema.$defs[def], path,
    (at, message) => error('SAGA_SCHEMA', message, doc, at));
  check(canonical, 'canonical', 'canonical', '');
  check(bindings, 'bindingDocument', 'binding', '');
  if (diagnostics.length) return finish();
  const index = (rows, key, doc, path) => {
    const map = new Map();
    rows.forEach((value, ordinal) => {
      const pointer = child(path, ordinal);
      if (map.has(value[key])) error('SAGA_DUPLICATE', `Duplicate ${key}: ${value[key]}.`, doc, child(pointer, key), [[doc, child(map.get(value[key]).pointer, key)]]);
      else map.set(value[key], { value, pointer, doc });
    });
    return map;
  };
  const sagas = index(canonical.sagas ?? [], 'id', 'canonical', '/sagas');
  index(canonical.sagas ?? [], 'seq', 'canonical', '/sagas');
  const bound = index(bindings.sagas, 'sagaId', 'binding', '/sagas');
  for (const [id, entry] of sagas) {
    if (!bound.has(id)) error('SAGA_BINDING_MISSING', `No technical binding for Saga ${id}.`, 'canonical', entry.pointer);
    else if (entry.value.version !== bound.get(id).value.version) error('SAGA_VERSION', 'Binding must pin the exact definition version.', 'binding', `${bound.get(id).pointer}/version`, [['canonical', `${entry.pointer}/version`]]);
  }
  for (const [id, entry] of bound) if (!sagas.has(id)) error('SAGA_BINDING_ORPHAN', `Binding ${id} has no Saga declaration.`, 'binding', `${entry.pointer}/sagaId`);
  if (diagnostics.length) return finish();

  // Public compileTree folds slice payloads into aggregates[].commands, events
  // into aggregates[].events. A session note or use-case link cannot establish
  // ownership. Do not invent top-level slices, global-ID fallbacks or note joins.
  const aggregates = new Map();
  const catalogRows = canonical.aggregates ?? [];
  catalogRows.forEach((value, ordinal) => {
    const pointer = `/aggregates/${ordinal}`;
    if (!object(value) || typeof value.name !== 'string' || !value.name.trim()) {
      error('SAGA_REFERENCE_INSUFFICIENT', 'Aggregate requires a nonempty name.', 'canonical', pointer); return;
    }
    if (aggregates.has(value.name)) error('SAGA_DUPLICATE', `Duplicate aggregate ${value.name}.`, 'canonical', `${pointer}/name`);
    else {
      const bags = {};
      for (const kind of ['commands', 'events']) {
        if (value[kind] !== undefined && !Array.isArray(value[kind])) {
          error('SAGA_REFERENCE_INSUFFICIENT', `Aggregate ${kind} must be an array.`, 'canonical', `${pointer}/${kind}`); bags[kind] = new Map(); continue;
        }
        const rows = value[kind] ?? [];
        const entries = new Map();
        rows.forEach((row, i) => {
          const at = `${pointer}/${kind}/${i}`;
          if (!object(row) || typeof row.name !== 'string' || !row.name.trim()) {
            error('SAGA_REFERENCE_INSUFFICIENT', 'Owned declaration requires a nonempty name.', 'canonical', at);
          } else if (entries.has(row.name)) error('SAGA_DUPLICATE', `Duplicate owned ${kind} name ${row.name}.`, 'canonical', `${at}/name`);
          else entries.set(row.name, { value: row, pointer: at, doc: 'canonical' });
        });
        bags[kind] = entries;
      }
      aggregates.set(value.name, { value, pointer, ...bags });
    }
  });
  const narrativeHas = (kind, name) => (canonical.sessions ?? []).some((session) =>
    Array.isArray(session?.scopes) && session.scopes.some((scope) => Array.isArray(scope?.notes)
      && scope.notes.some((note) => note?.type === kind && note?.name === name)));
  const resolveOwned = (ref, kind, doc, path) => {
    const aggregate = aggregates.get(ref.aggregate);
    if (!aggregate) {
      error('SAGA_AGGREGATE_UNKNOWN', `Aggregate ${ref.aggregate} is not in canonical.aggregates.`, doc, `${path}/aggregate`); return;
    }
    const entry = aggregate[kind === 'command' ? 'commands' : 'events'].get(ref.name);
    if (!entry) error(narrativeHas(kind, ref.name) ? 'SAGA_REFERENCE_INSUFFICIENT' : 'SAGA_REFERENCE_UNKNOWN',
      `${kind} ${ref.name} has no definition owned by ${ref.aggregate}; session narratives do not prove ownership.`, doc, `${path}/name`);
    return entry;
  };
  for (const [id, entry] of sagas) {
    const definition = entry.value;
    const payload = definition.payload;
    const pp = `${entry.pointer}/payload`;
    const bindingEntry = bound.get(id);
    const technical = bindingEntry.value;
    const bp = bindingEntry.pointer;
    const types = index(technical.types, 'id', 'binding', `${bp}/types`);
    const args = index(payload.args, 'slot', 'canonical', `${pp}/args`);
    const participants = index(payload.participants, 'id', 'canonical', `${pp}/participants`);
    const participantBindings = index(technical.participants, 'participantId', 'binding', `${bp}/participants`);
    const steps = index(payload.steps, 'id', 'canonical', `${pp}/steps`);
    const stepBindings = index(technical.steps, 'stepId', 'binding', `${bp}/steps`);
    const groups = index(payload.groups, 'id', 'canonical', `${pp}/groups`);
    const triggers = index(payload.triggers, 'id', 'canonical', `${pp}/triggers`);
    const triggerBindings = index(technical.triggerMappers, 'triggerId', 'binding', `${bp}/triggerMappers`);
    const completions = index(payload.completions, 'kind', 'canonical', `${pp}/completions`);
    const completionBindings = index(technical.completionMappers, 'kind', 'binding', `${bp}/completionMappers`);
    const coverage = (actual, expected, doc, path, description) => {
      for (const key of expected.keys()) if (!actual.has(key)) error('SAGA_COVERAGE', `${description} missing ${key}.`, doc, path);
      for (const [key, item] of actual) if (!expected.has(key)) error('SAGA_COVERAGE', `${description} has undeclared ${key}.`, doc, item.pointer);
    };
    coverage(participantBindings, participants, 'binding', `${bp}/participants`, 'Participant addressing');
    coverage(stepBindings, steps, 'binding', `${bp}/steps`, 'Step bindings');
    coverage(triggerBindings, triggers, 'binding', `${bp}/triggerMappers`, 'Trigger mappings');
    coverage(completions, new Map(resultKinds.map((kind) => [kind, true])), 'canonical', `${pp}/completions`, 'Completion kinds');
    coverage(completionBindings, completions, 'binding', `${bp}/completionMappers`, 'Completion mappings');
    if (!technical.codec.compatibleVersions.includes(technical.codec.version)) error('SAGA_CODEC_VERSION', 'compatibleVersions must contain current codec version.', 'binding', `${bp}/codec/compatibleVersions`);
    const knownType = (type, doc, path) => {
      const found = types.get(type);
      if (!found) error('SAGA_TYPE_UNKNOWN', `Unbound nominal type ${type}.`, doc, path);
      return found;
    };
    const sameType = (actual, expected, doc, path, related) => {
      knownType(actual, doc, path);
      if (actual !== expected) error('SAGA_TYPE_MISMATCH', `Type ${actual} does not equal ${expected}.`, doc, path, related);
    };
    const typeEdges = new Map();
    for (const [type, item] of types) {
      const value = item.value;
      const path = item.pointer;
      // Explicit mappings may rename canonical types, never reinterpret a
      // floating/unknown amount as an integer/string just to bypass precision.
      const unsafe = /\b(number|double|float|decimal|bigdecimal)\b/i.test(value.canonicalType);
      const amount = /money|amount|monetary/i.test(`${type} ${value.canonicalType}`)
        && !(value.kind === 'id' && /(?:Id|_id|-id)$/i.test(value.canonicalType));
      if ((unsafe || amount) && value.kind !== 'money') error('SAGA_UNSAFE_AMOUNT', 'Numeric/amount types require an explicit exact Money contract, never Number/Double coercion.', 'binding', `${path}/canonicalType`);
      if (value.kind === 'money' && (value.scale > value.precision || unsafe)) error('SAGA_PRECISION', 'Money requires a named domain type, exact string codec and scale <= precision.', 'binding', path);
      if (value.kind === 'money' && Array.isArray(canonical.valueObjects)) {
        const evidence = canonical.valueObjects.filter((vo) => vo?.name === value.canonicalType);
        if (evidence.length > 1) error('SAGA_DUPLICATE', 'Money has multiple canonical value-object definitions.', 'binding', `${path}/canonicalType`);
        for (const vo of evidence) {
          if (!Array.isArray(vo.fields) || vo.fields.some((field) => !object(field) || typeof field.name !== 'string' || typeof field.dataType !== 'string')) {
            error('SAGA_REFERENCE_INSUFFICIENT', 'Canonical Money evidence requires explicit typed fields.', 'binding', `${path}/canonicalType`);
          } else if (vo.fields.some((field) => /\b(number|double|float)\b/i.test(field.dataType))) {
            error('SAGA_PRECISION', 'Exact Money codec cannot repair floating-point canonical amount evidence.', 'binding', `${path}/canonicalType`);
          }
        }
      }
      for (const [min, max] of [['minimum', 'maximum'], ['minLength', 'maxLength'], ['minItems', 'maxItems']]) {
        if (own(value, min) && value[min] > value[max]) error('SAGA_TYPE_BOUNDS', `${min} must not exceed ${max}.`, 'binding', `${path}/${min}`);
      }
      const edges = [];
      if (value.kind === 'collection') edges.push(value.elementType);
      if (value.kind === 'value-object') {
        const fields = index(value.fields, 'slot', 'binding', `${path}/fields`);
        edges.push(...value.fields.map((field) => field.type));
        const matches = Array.isArray(canonical.valueObjects) ? canonical.valueObjects.filter((vo) => vo?.name === value.canonicalType) : [];
        if (matches.length !== 1 || !Array.isArray(matches[0].fields)) error('SAGA_REFERENCE_INSUFFICIENT', 'Value-object requires one canonical.valueObjects definition with typed fields.', 'binding', `${path}/canonicalType`);
        else {
          const canonicalFields = matches[0].fields;
          if (new Set(canonicalFields.map((field) => field?.name)).size !== canonicalFields.length) error('SAGA_DUPLICATE', 'Duplicate canonical value-object fields.', 'binding', path);
          for (const field of canonicalFields) {
            const mapped = fields.get(field?.name);
            if (!mapped || !types.has(mapped.value.type) || types.get(mapped.value.type).value.canonicalType !== field.dataType) error('SAGA_TYPE_MISMATCH', 'Value-object field mapping must match canonical name/dataType exactly.', 'binding', `${path}/fields`);
          }
          if (fields.size !== canonicalFields.length) error('SAGA_COVERAGE', 'Value-object fields must match canonical fields exactly.', 'binding', `${path}/fields`);
        }
      }
      edges.forEach((edge) => knownType(edge, 'binding', path));
      typeEdges.set(type, edges);
    }
    const visitingTypes = new Set();
    const visitedTypes = new Set();
    const visitType = (type) => {
      if (visitingTypes.has(type)) { error('SAGA_TYPE_CYCLE', 'Recursive types are not bounded in v1.', 'binding', types.get(type).pointer); return; }
      if (visitedTypes.has(type)) return;
      visitingTypes.add(type);
      (typeEdges.get(type) ?? []).forEach(visitType);
      visitingTypes.delete(type); visitedTypes.add(type);
    };
    for (const type of types.keys()) visitType(type);
    knownType(payload.transactionIdType, 'canonical', `${pp}/transactionIdType`);
    if (types.get(payload.transactionIdType)?.value.kind !== 'id') error('SAGA_IDEMPOTENCY', 'Transaction identity requires a bounded domain ID type.', 'canonical', `${pp}/transactionIdType`);
    for (const item of args.values()) knownType(item.value.type, 'canonical', `${item.pointer}/type`);
    // Validate type closure first; subsequent DAG analyses use per-type caches
    // so shared value-object subgraphs cannot expand exponentially.
    if (diagnostics.length) continue;
    const collectionCache = new Map();
    const containsCollection = (type) => {
      if (!collectionCache.has(type)) collectionCache.set(type, types.get(type)?.value.kind === 'collection'
        || (typeEdges.get(type) ?? []).some(containsCollection));
      return collectionCache.get(type);
    };
    const cardinalityCache = new Map();
    const cardinalityCap = BigInt(payload.admission.maxItemsPerChunk) + 1n;
    const boundedCardinality = (type) => {
      if (cardinalityCache.has(type)) return cardinalityCache.get(type);
      const value = types.get(type)?.value;
      const cardinality = value?.kind === 'collection'
        ? BigInt(value.maxItems) * (boundedCardinality(value.elementType) || 1n)
        : value?.kind === 'value-object' ? value.fields.reduce((sum, field) => sum + boundedCardinality(field.type), 0n) : 0n;
      const bounded = cardinality > cardinalityCap ? cardinalityCap : cardinality;
      cardinalityCache.set(type, bounded);
      return bounded;
    };
    const manifest = payload.admission.manifest;
    const collectionArgs = [...args.values()].some((arg) => containsCollection(arg.value.type));
    for (const arg of args.values()) {
      if (boundedCardinality(arg.value.type) > BigInt(payload.admission.maxItemsPerChunk)) error('SAGA_ADMISSION', 'Argument collection cardinality exceeds maxItemsPerChunk, including nested collections.', 'canonical', arg.pointer);
    }
    if (collectionArgs && manifest.mode !== 'durable-reference') error('SAGA_MANIFEST', 'Collection args require a readable, versioned durable manifest frozen before Prepare.', 'canonical', `${pp}/admission/manifest`);
    const resolveArg = (ref, doc, path) => {
      const found = args.get(ref.ref.slice(5));
      if (!found) error('SAGA_REF_UNKNOWN', `Argument ${ref.ref} is not declared.`, doc, `${path}/ref`);
      else sameType(ref.type, found.value.type, doc, `${path}/type`, [['canonical', `${found.pointer}/type`]]);
      return found;
    };
    if (manifest.mode === 'durable-reference') {
      resolveArg(manifest.ref, 'canonical', `${pp}/admission/manifest/ref`);
      const manifestType = types.get(manifest.ref.type)?.value;
      if (manifestType?.kind !== 'manifest-reference' || manifestType.version !== manifest.version) error('SAGA_MANIFEST', 'Manifest arg must bind a readable manifest-reference of the same version.', 'canonical', `${pp}/admission/manifest`);
    }
    if (participants.size > payload.admission.maxParticipants || payload.admission.maxInFlight > payload.admission.maxParticipants) error('SAGA_ADMISSION', 'Participant count/in-flight bound exceeds maxParticipants.', 'canonical', `${pp}/admission`);
    const largestGroup = Math.max(...payload.groups.map((group) => payload.steps.filter((step) => step.group === group.id).length));
    if (largestGroup > payload.admission.maxInFlight) error('SAGA_ADMISSION', 'A concurrent group exceeds maxInFlight; v1 does not invent an internal scheduler.', 'canonical', `${pp}/admission/maxInFlight`);
    const budget = payload.resilience;
    const minimumBudget = BigInt(budget.maxAttempts) * (BigInt(budget.phaseTimeoutMs) + BigInt(budget.queryTimeoutMs)) + BigInt(budget.maxAttempts - 1) * BigInt(budget.backoffMs);
    if (minimumBudget > BigInt(budget.totalTimeoutMs)) error('SAGA_RESILIENCE', 'totalTimeoutMs must cover bounded phase/query attempts and backoff.', 'canonical', `${pp}/resilience/totalTimeoutMs`);

    const groupClosure = new Map();
    const visitingGroups = new Set();
    const ancestorsOf = (groupId) => {
      if (groupClosure.has(groupId)) return groupClosure.get(groupId);
      if (visitingGroups.has(groupId)) { error('SAGA_GROUP_CYCLE', 'Group dependency cycle.', 'canonical', groups.get(groupId).pointer); return new Set(); }
      visitingGroups.add(groupId);
      const group = groups.get(groupId);
      const ancestors = new Set();
      group?.value.dependsOn.forEach((dependency, ordinal) => {
        if (!groups.has(dependency)) error('SAGA_GROUP_UNKNOWN', `Unknown dependency group ${dependency}.`, 'canonical', `${group.pointer}/dependsOn/${ordinal}`);
        else { ancestors.add(dependency); for (const item of ancestorsOf(dependency)) ancestors.add(item); }
      });
      visitingGroups.delete(groupId); groupClosure.set(groupId, ancestors); return ancestors;
    };
    for (const group of groups.keys()) ancestorsOf(group);
    // v1 lowering has serial barriers, not a scheduler for arbitrary concurrent
    // DAG frontiers. Require explicit dependencies, never infer array-order joins.
    const groupOrder = [...groups.keys()].sort((a, b) => a - b);
    for (let i = 1; i < groupOrder.length; i++) {
      if (!groupClosure.get(groupOrder[i]).has(groupOrder[i - 1])) error('SAGA_GROUP_ORDER', 'v1 groups must explicitly depend on every previous numeric barrier (transitively).', 'canonical', groups.get(groupOrder[i]).pointer);
    }
    const usedParticipants = new Set();
    const resourceIdentities = new Set();
    for (const [participantId, item] of participants) {
      const value = item.value;
      const aggregate = aggregates.get(value.aggregate);
      if (!aggregate) error('SAGA_AGGREGATE_UNKNOWN', `Unknown aggregate ${value.aggregate}.`, 'canonical', `${item.pointer}/aggregate`);
      resolveArg(value.resourceRef, 'canonical', `${item.pointer}/resourceRef`);
      if (types.get(value.resourceRef.type)?.value.kind !== 'id') error('SAGA_RESOURCE', 'Resource addressing requires a bounded domain ID arg.', 'canonical', `${item.pointer}/resourceRef/type`);
      const resourceIdentity = JSON.stringify([value.aggregate, value.resourceRef.ref]);
      if (resourceIdentities.has(resourceIdentity)) error('SAGA_RESOURCE', 'Two participants alias the same declared resource.', 'canonical', `${item.pointer}/resourceRef`);
      resourceIdentities.add(resourceIdentity);
      const address = participantBindings.get(participantId)?.value.addressing;
      if (address && (address.aggregate !== value.aggregate || address.resourceType !== value.resourceRef.type)) error('SAGA_RESOURCE', 'Address binding must match the participant aggregate and exact resource type.', 'binding', `${participantBindings.get(participantId).pointer}/addressing`);
      if (aggregate?.value.identifier) {
        const identifier = aggregate.value.identifier;
        if (!object(identifier) || identifier.dataType !== types.get(value.resourceRef.type)?.value.canonicalType) error('SAGA_RESOURCE', 'Resource type must exactly map the canonical aggregate identifier.dataType.', 'canonical', `${item.pointer}/resourceRef/type`);
      } else if (aggregate) error('SAGA_REFERENCE_INSUFFICIENT', 'Aggregate identifier.dataType is required for resource addressing.', 'canonical', `${item.pointer}/aggregate`);
    }
    const ownedFields = (owned, kind, atDoc, atPath) => {
      if (!owned) return new Map();
      const key = kind === 'command' ? 'parameters' : 'payloads';
      if (!Array.isArray(owned.value[key])) {
        error('SAGA_REFERENCE_INSUFFICIENT', `${kind} must expose typed ${key}; narrative fields are not parsed.`, atDoc, atPath); return new Map();
      }
      const rows = owned.value[key];
      if (rows.some((field) => !object(field) || typeof field.name !== 'string' || typeof field.dataType !== 'string')) {
        error('SAGA_REFERENCE_INSUFFICIENT', 'Each owned field needs name and dataType.', 'canonical', `${owned.pointer}/${key}`); return new Map();
      }
      return index(rows, 'name', 'canonical', `${owned.pointer}/${key}`);
    };
    const matchFields = (mappings, fields, doc, path, resolver) => {
      const mapped = index(mappings, 'slot', doc, path);
      coverage(mapped, fields, doc, path, 'Typed slot mappings');
      mappings.forEach((mapping, ordinal) => {
        const at = `${path}/${ordinal}`;
        knownType(mapping.type, doc, `${at}/type`);
        const field = fields.get(mapping.slot);
        if (field && types.get(mapping.type)?.value.canonicalType !== field.value.dataType) error('SAGA_TYPE_MISMATCH', 'Mapped type must equal the canonical field dataType mapping.', doc, `${at}/type`, [['canonical', `${field.pointer}/dataType`]]);
        resolver(mapping, at);
      });
    };
    const resolveFlow = (ref, doc, path, consumer, phase, terminalKind) => {
      knownType(ref.type, doc, `${path}/type`);
      if (ref.ref === 'txid') return sameType(ref.type, payload.transactionIdType, doc, `${path}/type`);
      if (ref.ref.startsWith('args:')) return resolveArg(ref, doc, path);
      const [, stepId, producerPhase, slot] = ref.ref.split(':');
      const producer = steps.get(stepId);
      const output = producer?.value.phases[producerPhase]?.outputs?.find((item) => item.slot === slot);
      if (!output) { error('SAGA_REF_UNKNOWN', `Unknown output ${ref.ref}.`, doc, `${path}/ref`); return; }
      // Prepare refs require a confirmed dependency group. All Prepare outputs
      // are available to Commit after the durable global CommitDecision. Commit
      // outputs require a prior group, never a peer/self. Abort cannot read a
      // different participant's tentative output, or any Commit output.
      const allowed = consumer ? phase === 'prepare'
        ? producerPhase === 'prepare' && groupClosure.get(consumer.group)?.has(producer.value.group)
        : phase === 'commit'
          ? producerPhase === 'prepare' || (producerPhase === 'commit' && groupClosure.get(consumer.group)?.has(producer.value.group))
          : producerPhase === 'prepare' && producer.value.id === consumer.id
        : terminalKind === 'succeeded' && producerPhase === 'commit';
      if (!allowed) error('SAGA_REF_UNAVAILABLE', 'Reference is not guaranteed confirmed in this phase/result; no tentative/forward/unknown reads.', doc, `${path}/ref`);
      sameType(ref.type, output.type, doc, `${path}/type`);
    };
    for (const [stepId, item] of steps) {
      const step = item.value;
      const participant = participants.get(step.participant);
      if (!participant) error('SAGA_PARTICIPANT_UNKNOWN', `Unknown participant ${step.participant}.`, 'canonical', `${item.pointer}/participant`);
      else usedParticipants.add(step.participant);
      if (!groups.has(step.group)) error('SAGA_GROUP_UNKNOWN', `Unknown step group ${step.group}.`, 'canonical', `${item.pointer}/group`);
      const noneCount = phases.filter((phase) => step.phases[phase].kind === 'none').length;
      if (noneCount !== 0 && noneCount !== 3) error('SAGA_PHASE_INCOMPLETE', 'v1 requires complete TCC, or all three phases explicitly none/read-only.', 'canonical', `${item.pointer}/phases`);
      for (const phase of phases) {
        const declaration = step.phases[phase];
        const path = `${item.pointer}/phases/${phase}`;
        const phaseBinding = stepBindings.get(stepId)?.value.phases[phase];
        const bpath = `${stepBindings.get(stepId)?.pointer}/phases/${phase}`;
        if (phaseBinding && declaration.kind !== phaseBinding.kind) error('SAGA_PHASE_BINDING', 'Phase applicability must match business declaration exactly.', 'binding', bpath);
        if (declaration.kind === 'none') continue;
        if (participant && declaration.commandRef.aggregate !== participant.value.aggregate) error('SAGA_PHASE_PARTICIPANT', 'Phase command must be owned by this step participant aggregate.', 'canonical', `${path}/commandRef/aggregate`);
        const command = resolveOwned(declaration.commandRef, 'command', 'canonical', `${path}/commandRef`);
        const fields = ownedFields(command, 'command', 'canonical', `${path}/commandRef`);
        matchFields(declaration.bindings, fields, 'canonical', `${path}/bindings`, (mapping, at) => {
          resolveFlow(mapping, 'canonical', at, step, phase);
          if (participant && types.get(mapping.type)?.value.canonicalType === types.get(participant.value.resourceRef.type)?.value.canonicalType
            && (mapping.ref !== participant.value.resourceRef.ref || mapping.type !== participant.value.resourceRef.type)) error('SAGA_RESOURCE', 'v1 resource-typed phase slots must reference this participant exact resource arg; cross-resource parameter semantics are unsupported.', 'canonical', `${at}/ref`);
        });
        const outputIndex = index(declaration.outputs, 'slot', 'canonical', `${path}/outputs`);
        for (const output of outputIndex.values()) knownType(output.value.type, 'canonical', `${output.pointer}/type`);
        if (phaseBinding?.kind !== 'command') continue;
        const confirmation = phaseBinding.confirmation;
        if (confirmation.eventRef.aggregate !== declaration.commandRef.aggregate) error('SAGA_PHASE_PARTICIPANT', 'Confirmation event must belong to the same participant aggregate.', 'binding', `${bpath}/confirmation/eventRef/aggregate`);
        const event = resolveOwned(confirmation.eventRef, 'event', 'binding', `${bpath}/confirmation/eventRef`);
        if (!Array.isArray(command?.value.produces) || !command.value.produces.some((produced) => (typeof produced === 'string' ? produced : produced?.name) === confirmation.eventRef.name)) error('SAGA_CONFIRMATION', 'Command must explicitly produce its confirmation event.', 'binding', `${bpath}/confirmation/eventRef`);
        const eventFields = ownedFields(event, 'event', 'binding', `${bpath}/confirmation/eventRef`);
        const confirmations = index(confirmation.outputs, 'slot', 'binding', `${bpath}/confirmation/outputs`);
        coverage(confirmations, outputIndex, 'binding', `${bpath}/confirmation/outputs`, 'Phase receipt outputs');
        for (const output of confirmations.values()) {
          const target = outputIndex.get(output.value.slot);
          if (target) sameType(output.value.type, target.value.type, 'binding', `${output.pointer}/type`);
          const field = eventFields.get(output.value.ref.slice(8));
          if (!field) error('SAGA_REF_UNKNOWN', 'Receipt output must reference a typed confirmation payload field.', 'binding', `${output.pointer}/ref`);
          else if (types.get(output.value.type)?.value.canonicalType !== field.value.dataType) error('SAGA_TYPE_MISMATCH', 'Receipt output type must match canonical confirmation payload.', 'binding', `${output.pointer}/type`);
        }
      }
    }
    for (const [participantId, item] of participants) if (!usedParticipants.has(participantId)) error('SAGA_PARTICIPANT_UNUSED', 'Participant has no step.', 'canonical', item.pointer);
    for (const [groupId, item] of groups) {
      const groupSteps = payload.steps.filter((step) => step.group === groupId);
      if (!groupSteps.length) error('SAGA_GROUP_EMPTY', 'Group has no steps.', 'canonical', item.pointer);
      if (new Set(groupSteps.map((step) => step.participant)).size !== groupSteps.length) error('SAGA_RESOURCE', 'Concurrent steps cannot address the same participant.', 'canonical', item.pointer);
    }
    for (const trigger of triggers.values()) {
      const value = trigger.value;
      const path = trigger.pointer;
      const owned = resolveOwned(value.sourceRef, value.kind, 'canonical', `${path}/sourceRef`);
      const fields = ownedFields(owned, value.kind, 'canonical', `${path}/sourceRef`);
      const mappings = index(value.argsMapping, 'slot', 'canonical', `${path}/argsMapping`);
      coverage(mappings, args, 'canonical', `${path}/argsMapping`, 'Trigger args');
      const resolveSource = (ref, at) => {
        const field = fields.get(ref.ref.slice(7));
        knownType(ref.type, 'canonical', `${at}/type`);
        if (!field) error('SAGA_REF_UNKNOWN', 'Trigger ref must name a typed field of its own source.', 'canonical', `${at}/ref`);
        else if (types.get(ref.type)?.value.canonicalType !== field.value.dataType) error('SAGA_TYPE_MISMATCH', 'Trigger source type must match canonical dataType exactly.', 'canonical', `${at}/type`);
      };
      value.argsMapping.forEach((mapping, ordinal) => {
        const at = `${path}/argsMapping/${ordinal}`;
        const arg = args.get(mapping.slot);
        if (arg) sameType(mapping.type, arg.value.type, 'canonical', `${at}/type`);
        resolveSource(mapping, at);
      });
      resolveSource(value.idempotency, `${path}/idempotency`);
      if (types.get(value.idempotency.type)?.value.kind !== 'id') error('SAGA_IDEMPOTENCY', 'Trigger idempotency requires a domain operation ID, never time/random/attempt.', 'canonical', `${path}/idempotency/type`);
      const identityField = value.idempotency.ref.slice(7);
      const identityPayload = Array.isArray(owned?.value[value.kind === 'command' ? 'parameters' : 'payloads'])
        ? owned.value[value.kind === 'command' ? 'parameters' : 'payloads'].find((field) => field?.name === identityField) : undefined;
      if (identityPayload && !['BUSINESS_INPUT', 'PROPAGATED'].includes(identityPayload.origin)) error('SAGA_IDEMPOTENCY', 'Identity field must explicitly be durable business input/propagated, not generated time/random data.', 'canonical', `${path}/idempotency/ref`);
    }
    for (const completion of completions.values()) {
      const owned = resolveOwned(completion.value.eventRef, 'event', 'canonical', `${completion.pointer}/eventRef`);
      const fields = ownedFields(owned, 'event', 'canonical', `${completion.pointer}/eventRef`);
      matchFields(completion.value.bindings, fields, 'canonical', `${completion.pointer}/bindings`, (mapping, at) => resolveFlow(mapping, 'canonical', at, undefined, undefined, completion.value.kind));
    }
  }
  if (diagnostics.length) return finish();
  const sourceMap = {};
  const copy = (value, destination, doc, pointer, derived = false) => {
    sourceMap[destination] = source(doc, pointer);
    if (Array.isArray(value)) return value.map((item, ordinal) => copy(item, child(destination, ordinal), doc, derived ? pointer : child(pointer, ordinal), derived));
    if (object(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, copy(value[key], child(destination, key), doc, derived ? pointer : child(pointer, key), derived)]));
    return value;
  };
  sourceMap[''] = source('canonical', '');
  sourceMap['/sagas'] = source('canonical', '/sagas');
  const ir = {
    schemaVersion: copy('truthsrc.saga-ir/v1', '/schemaVersion', 'canonical', '/schemaVersion', true),
    workshop: copy(canonical.workshop, '/workshop', 'canonical', '/workshop'),
    readiness: copy('contract-only', '/readiness', 'canonical', '/sagas', true),
    sagas: [...sagas.values()].sort((a, b) => a.value.seq - b.value.seq).map((entry, ordinal) => {
      const at = `/sagas/${ordinal}`;
      const technical = bound.get(entry.value.id);
      sourceMap[at] = source('canonical', entry.pointer);
      return { definition: copy(entry.value, `${at}/definition`, 'canonical', entry.pointer),
        binding: copy(technical.value, `${at}/binding`, 'binding', technical.pointer),
        readiness: copy('contract-only', `${at}/readiness`, 'canonical', entry.pointer, true) };
    }),
  };
  ir.digest = createHash('sha256').update(JSON.stringify(stable(ir))).digest('hex');
  sourceMap['/digest'] = source('canonical', '/sagas');
  ir.sourceMap = stable(sourceMap);
  validate(ir, schema, '', (at, message) => error('SAGA_IR_SCHEMA', message, 'canonical', sourceMap[at]?.pointer ?? ''));
  return finish(stable(ir));
}
