import { array, at, detach, equal, fail, object, text, unique } from './request.mjs';
import { reference, refKey } from '../domain-products/references.mjs';
import { canonicalType } from '../domain-products/values.mjs';

export const CONTRACT_SCHEMA = 'truthsrc.module-seams-contract/v1';
export const CONTRACT_BINDING_SCHEMA = 'truthsrc.module-seams-contract-binding/v1';
export const SIGNATURE_VALUE_SCHEMA = 'truthsrc.signature-value/v1';
const optionalObject = (v, required, optional, s) => object(v, [...required, ...optional.filter(k => Object.hasOwn(v ?? {}, k))], s);
export const seamsRef = (context, kind, id) => ({ context, kind, owner: [], id });
export function signatureReferences(type, context, values, location, depth = 0) {
  if (depth > 64) fail('MODULE_SEAMS_TYPE_DEPTH', 'signature type exceeds 64 levels', location);
  switch (type?.form) {
    case 'primitive':
      object(type, ['form', 'name'], location);
      if (!['string', 'boolean', 'integer'].includes(type.name)) fail('MODULE_SEAMS_TYPE', 'only String, Boolean and Long are admitted', location);
      return [];
    case 'nominal':
      object(type, ['form', 'ref'], location); reference(type.ref, location);
      if (type.ref.context !== context || type.ref.kind !== 'type' || type.ref.owner.length || !values.some(v => equal(v.ref, type.ref)))
        fail('MODULE_SEAMS_TYPE', 'one declared nominal in this context is required', location);
      return [type.ref];
    case 'optional': case 'sequence':
      object(type, ['form', 'element'], location);
      return signatureReferences(type.element, context, values, location, depth + 1);
    case 'map': case 'either': {
      const keys = type.form === 'map' ? ['key', 'value'] : ['left', 'right'];
      object(type, ['form', ...keys], location);
      return keys.flatMap(k => signatureReferences(type[k], context, values, location, depth + 1));
    }
    default: fail('MODULE_SEAMS_TYPE', 'explicit finite signature type required', location);
  }
}
// Only explicit primitives use canonicalType's old alias-aware parser. Every
// other admitted scalar is nominal. Either belongs here, not to old typeRefs.
function spellingType(raw, context, layout, location, depth = 0) {
  if (depth > 64) fail('MODULE_SEAMS_TYPE_DEPTH', 'signature type exceeds 64 levels', location);
  text(raw, location);
  const wrapped = /^(Option|Vector|Map|Either)\[(.*)\]$/u.exec(raw);
  if (wrapped) {
    const parts = []; let level = 0, start = 0;
    for (let i = 0; i < wrapped[2].length; i++) {
      const c = wrapped[2][i];
      if (c === '[') level++;
      if (c === ']') level--;
      if (level < 0) fail('MODULE_SEAMS_TYPE', 'unbalanced type spelling', location);
      if (c === ',' && level === 0) { parts.push(wrapped[2].slice(start, i).trim()); start = i + 1; }
    }
    if (level) fail('MODULE_SEAMS_TYPE', 'unbalanced type spelling', location);
    parts.push(wrapped[2].slice(start).trim());
    const binary = ['Map', 'Either'].includes(wrapped[1]);
    if (parts.length !== (binary ? 2 : 1) || parts.some(p => !p)) fail('MODULE_SEAMS_TYPE', 'incorrect container arity', location);
    const parsed = parts.map(p => spellingType(p, context, layout, location, depth + 1));
    if (!binary) return { form: wrapped[1] === 'Option' ? 'optional' : 'sequence', element: parsed[0] };
    return wrapped[1] === 'Map' ? { form: 'map', key: parsed[0], value: parsed[1] } : { form: 'either', left: parsed[0], right: parsed[1] };
  }
  if (['String', 'Boolean', 'Long'].includes(raw)) return canonicalType(raw, context, layout, location);
  const declaration = layout.declarations.find(d => d.ref.id === raw);
  if (!declaration) fail('MODULE_SEAMS_TYPE', 'unsupported spelling (aliases and external Scala types are not admitted)', location);
  return { form: 'nominal', ref: declaration.ref };
}
export function seamsPort(ref, contract, location) {
  reference(ref, location);
  const p = contract.ports.find(p => equal(p.ref, ref));
  if (!p) fail('MODULE_SEAMS_PORT', 'port must resolve in the selected contract', location);
  return p;
}
export function seamsMethod(ref, contract, location) {
  object(ref, ['port', 'method'], location); text(ref.method, location);
  const p = seamsPort(ref.port, contract, location), m = p.methods.find(m => m.id === ref.method);
  if (!m) fail('MODULE_SEAMS_METHOD', 'method must resolve in its declared port', location);
  return { port: p, signature: m };
}
export function deriveModuleSeamsContract(raw) {
  const canonical = detach(raw);
  object(canonical, ['id', 'schemaVersion', 'value'], at('canonical')); text(canonical.id, at('canonical'));
  if (canonical.schemaVersion !== 'truthsrc/v1' || canonical.value?.schemaVersion !== 'truthsrc/v1') fail('MODULE_SEAMS_VERSION', 'truthsrc/v1 canonical required');
  const source = pointer => at(canonical.id, pointer), rows = array(canonical.value.moduleSeamsContracts, source('/moduleSeamsContracts'));
  if (rows.length !== 1) fail('MODULE_SEAMS_CONTRACT_COUNT', 'exactly one explicit contract is supported', source('/moduleSeamsContracts'));
  const row = rows[0], root = '/moduleSeamsContracts/0';
  object(row, ['schemaVersion', 'id', 'version', 'context', 'ports'], source(root));
  if (row.schemaVersion !== CONTRACT_SCHEMA || row.version !== '1') fail('MODULE_SEAMS_VERSION', 'module-seams-contract/v1 version 1 required', source(root));
  text(row.id, source(root)); text(row.context, source(root));
  const context = row.context;
  if (canonical.value.context !== undefined && canonical.value.context !== context || canonical.value.contexts !== undefined && !equal(canonical.value.contexts, [context]) ||
      canonical.value.authoring?.context?.id !== undefined && canonical.value.authoring.context.id !== context ||
      canonical.value.authoring?.system?.contexts !== undefined && !equal(canonical.value.authoring.system.contexts, [context]))
    fail('MODULE_SEAMS_CONTEXT', 'only one matching canonical context is supported', source(root));
  const values = array(canonical.value.valueObjects, source('/valueObjects')).map((v, i) => {
    const p = '/valueObjects/' + i;
    text(v?.name, source(p));
    if (v.context !== undefined && v.context !== context) fail('MODULE_SEAMS_CONTEXT', 'value crosses contract context', source(p));
    const sum = Object.hasOwn(v, 'schemaVersion');
    optionalObject(v, sum ? ['schemaVersion', 'name', 'shape', 'variants'] : ['name', 'fields'], ['context', 'description', 'seq', 'id'], source(p));
    if (v.id !== undefined && v.id !== v.name) fail('MODULE_SEAMS_IDENTITY', 'nominal id and name must agree', source(p));
    if (sum && (v.schemaVersion !== SIGNATURE_VALUE_SCHEMA || v.shape !== 'sum')) fail('MODULE_SEAMS_VERSION', 'explicit closed signature sum/v1 required', source(p));
    return { ref: seamsRef(context, 'type', v.name), name: v.name, shape: sum ? 'sum' : 'record', source: source(p), fields: [], variants: [] };
  });
  unique(values.map(v => refKey(v.ref)), 'MODULE_SEAMS_DUPLICATE', source('/valueObjects'));
  for (const [i, v] of array(Object.hasOwn(canonical.value, 'types') ? canonical.value.types : [], source('/types')).entries()) {
    object(v, Object.keys(v ?? {}), source('/types/' + i));
    if (v.context !== undefined && v.context !== context) fail('MODULE_SEAMS_CONTEXT', 'a second context is not supported', source('/types/' + i));
    if (v.context === undefined || v.context === context) {
      if (values.some(x => x.name === (v.name ?? v.id))) fail('MODULE_SEAMS_DUPLICATE', 'nominal is defined on both types and valueObjects', source('/types/' + i));
      fail('MODULE_SEAMS_AUTHOR_SURFACE', 'signature values must be defined only in valueObjects', source('/types/' + i));
    }
  }
  const layout = { declarations: values.map(v => ({ ref: v.ref })) };
  function fields(rawFields, pointer, owner) {
    const fields = array(rawFields, source(pointer)).map((f, i) => {
      const p = pointer + '/' + i;
      object(f, ['name', 'dataType'], source(p)); text(f.name, source(p));
      return { id: f.name, name: f.name, ref: { ...owner, field: f.name }, valueType: spellingType(f.dataType, context, layout, source(p + '/dataType')), source: source(p) };
    });
    unique(fields.map(f => f.id), 'MODULE_SEAMS_DUPLICATE', source(pointer)); return fields;
  }
  values.forEach((v, i) => {
    const r = canonical.value.valueObjects[i], p = v.source.pointer;
    if (v.shape === 'record') v.fields = fields(r.fields, p + '/fields', { value: v.ref });
    else {
      if (!array(r.variants, source(p + '/variants')).length) fail('MODULE_SEAMS_SUM', 'closed sum requires variants', source(p));
      v.variants = r.variants.map((variant, j) => {
        const q = p + '/variants/' + j;
        object(variant, ['name', 'fields'], source(q)); text(variant.name, source(q));
        const ref = { value: v.ref, variant: variant.name };
        return { id: variant.name, name: variant.name, ref, source: source(q), fields: fields(variant.fields, q + '/fields', ref) };
      });
      unique(v.variants.map(x => x.id), 'MODULE_SEAMS_DUPLICATE', source(p + '/variants'));
    }
  });
  const edges = new Map(values.map(v => [refKey(v.ref), new Set([...v.fields, ...v.variants.flatMap(x => x.fields)].flatMap(f => signatureReferences(f.valueType, context, values, f.source).map(refKey)))]));
  while (edges.size) {
    const ready = [...edges].filter(([, deps]) => !deps.size).map(([k]) => k);
    if (!ready.length) fail('MODULE_SEAMS_TYPE_CYCLE', 'recursive signature values are not supported', source('/valueObjects'));
    ready.forEach(k => edges.delete(k)); edges.forEach(deps => ready.forEach(k => deps.delete(k)));
  }
  const ports = array(row.ports, source(root + '/ports')).map((p, i) => {
    const q = root + '/ports/' + i;
    object(p, ['id', 'name', 'role', 'methods'], source(q)); text(p.id, source(q)); text(p.name, source(q));
    if (!['computation', 'repository', 'flow'].includes(p.role)) fail('MODULE_SEAMS_ROLE', 'unsupported port role', source(q));
    for (const family of ['ports', 'domainServices', 'hostComputations']) for (const [j, old] of array(Object.hasOwn(canonical.value, family) ? canonical.value[family] : [], source('/' + family)).entries()) {
      object(old, Object.keys(old ?? {}), source('/' + family + '/' + j));
      if ((old.context ?? old.id?.context ?? context) === context && [old.name, old.id, old.id?.id].some(n => n === p.id || n === p.name))
        fail('MODULE_SEAMS_DUPLICATE', 'port is already declared on another author surface', source('/' + family + '/' + j));
    }
    const ref = seamsRef(context, 'port', p.id);
    const methods = array(p.methods, source(q + '/methods')).map((m, j) => {
      const z = q + '/methods/' + j;
      object(m, ['id', 'name', 'parameters', 'result'], source(z)); text(m.id, source(z)); text(m.name, source(z));
      const method = { port: ref, method: m.id };
      const parameters = array(m.parameters, source(z + '/parameters')).map((param, k) => {
        const a = z + '/parameters/' + k;
        object(param, ['id', 'name', 'valueType'], source(a)); text(param.id, source(a)); text(param.name, source(a));
        signatureReferences(param.valueType, context, values, source(a));
        return { ...param, ref: { method, parameter: param.id }, source: source(a) };
      });
      unique(parameters.map(x => x.id), 'MODULE_SEAMS_DUPLICATE', source(z)); unique(parameters.map(x => x.name), 'MODULE_SEAMS_DUPLICATE', source(z));
      object(m.result, ['effect', 'valueType'], source(z + '/result'));
      if (!['pure', 'future'].includes(m.result.effect) || p.role === 'computation' && m.result.effect !== 'pure') fail('MODULE_SEAMS_EFFECT', 'explicit pure/future effect; computations must be pure', source(z + '/result'));
      signatureReferences(m.result.valueType, context, values, source(z + '/result'));
      return { id: m.id, name: m.name, ref: method, source: source(z), parameters, result: { ...m.result, source: source(z + '/result') } };
    });
    if (!methods.length) fail('MODULE_SEAMS_EMPTY', 'port needs methods', source(q));
    unique(methods.map(m => m.id), 'MODULE_SEAMS_DUPLICATE', source(q)); unique(methods.map(m => m.name), 'MODULE_SEAMS_DUPLICATE', source(q));
    return { id: p.id, name: p.name, role: p.role, ref, source: source(q), methods };
  });
  if (!ports.length || !values.length) fail('MODULE_SEAMS_EMPTY', 'explicit values and ports are required', source(root));
  unique(ports.map(p => p.id), 'MODULE_SEAMS_DUPLICATE', source(root)); unique(ports.map(p => p.name), 'MODULE_SEAMS_DUPLICATE', source(root));
  return detach({ id: row.id, version: row.version, context, source: source(root), values, ports });
}
export function compileModuleSeamsContract(rawBinding, canonical) {
  const binding = detach(rawBinding);
  object(binding, ['id', 'schemaVersion', 'value'], at('contract-binding')); text(binding.id, at('contract-binding'));
  const location = at(binding.id);
  object(binding.value, ['schemaVersion', 'contract'], location);
  if (binding.schemaVersion !== CONTRACT_BINDING_SCHEMA || binding.value.schemaVersion !== CONTRACT_BINDING_SCHEMA) fail('MODULE_SEAMS_VERSION', 'contract binding/v1 required', location);
  const actual = deriveModuleSeamsContract(canonical);
  if (!equal(binding.value.contract, actual)) fail('MODULE_SEAMS_CONTRACT_DRIFT', 'complete reconstructed contract differs (including order and sources)', at(binding.id, '/contract'));
  return actual;
}
