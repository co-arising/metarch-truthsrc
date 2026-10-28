import { array, at, equal, fail, object, resolve, text, unique } from '../products/request.mjs';
import { reference, refKey } from './references.mjs';
import { packExact, parseExact, unpackExact } from '../value-products/exact-types.mjs';

const integer = { form: 'primitive', name: 'integer' };
export function parseInteger(value, location) {
  if (typeof value !== 'string' || value.length > 20 || !/^-?(0|[1-9][0-9]*)$/u.test(value) || value === '-0') fail('VALUE_INTEGER', 'integer requires canonical signed-64 text', location);
  const n = BigInt(value);
  if (n < -(1n << 63n) || n >= (1n << 63n)) fail('VALUE_OVERFLOW', 'integer exceeds signed-64 bounds', location);
  return n;
}
export const declaration = (ref, layout, location) => {
  reference(ref, location);
  const row = layout.declarations.find(d => equal(d.ref, ref));
  if (!row) fail('VALUE_REFERENCE', 'reference must have a complete declaration', location);
  return row;
};
export function canonicalType(raw, context, layout, location, depth = 0) {
  if (depth > 64) fail('VALUE_DEPTH', 'canonical type exceeds nesting bound', location);
  text(raw, location);
  const simple = { String: 'string', Boolean: 'boolean', Integer: 'integer', Long: 'integer', Int: 'integer', Decimal: 'decimal' };
  if (Object.hasOwn(simple, raw)) return { form: 'primitive', name: simple[raw] };
  const wrapped = /^(Option|List|Seq|Vector|Map)\[(.*)\]$/u.exec(raw);
  if (wrapped) {
    const body = wrapped[2];
    if (wrapped[1] !== 'Map') return { form: wrapped[1] === 'Option' ? 'optional' : 'sequence', element: canonicalType(body, context, layout, location, depth + 1) };
    let level = 0, comma = -1;
    for (let i = 0; i < body.length; i++) { if (body[i] === '[') level++; if (body[i] === ']') level--; if (body[i] === ',' && level === 0) { if (comma >= 0) fail('VALUE_TYPE', 'map requires exactly two types', location); comma = i; } }
    if (comma < 0) fail('VALUE_TYPE', 'map requires key and value types', location);
    return { form: 'map', key: canonicalType(body.slice(0, comma).trim(), context, layout, location, depth + 1), value: canonicalType(body.slice(comma + 1).trim(), context, layout, location, depth + 1) };
  }
  const rows = layout.declarations.filter(d => d.ref.kind === 'type' && d.ref.context === context && d.ref.id === raw);
  if (rows.length !== 1) fail('VALUE_TYPE', 'canonical type requires one explicit nominal declaration in its context', location);
  return { form: 'nominal', ref: rows[0].ref };
}
export function checkFields(rows, refs, canonical, layout, pointer, kind, owner) {
  array(rows, at(canonical.id, pointer));
  const actual = rows.map((row, i) => {
    const location = at(canonical.id, `${pointer}/${i}`);
    const ref = { context: owner.context, kind, owner: [...owner.owner, owner.id], id: text(row?.name, location) };
    const d = declaration(ref, layout, location);
    const spelling = row.type ?? row.dataType;
    if (row.type !== undefined && row.dataType !== undefined && row.type !== row.dataType) fail('VALUE_TYPE', 'conflicting canonical type spellings', location);
    if (!equal(d.source, location) || !equal(d.valueType, canonicalType(spelling, owner.context, layout, location))) fail('VALUE_SOURCE', 'field type/source must match canonical declaration', location);
    return d;
  });
  if (actual.length !== refs.length || refs.some(r => !actual.some(d => equal(d.ref, r.ref)))) fail('VALUE_COVERAGE', 'layout must cover every canonical field exactly once', at(canonical.id, pointer));
  unique(actual.map(d => refKey(d.ref)), 'VALUE_COVERAGE', at(canonical.id, pointer));
  return actual;
}
export function validateValue(value, type, layout, exact = [], location = at('request'), depth = 0) {
  if (depth > 64) fail('VALUE_DEPTH', 'value/type exceeds depth bound', location);
  if (type.form === 'primitive') {
    if (type.name === 'string') { text(value, location, true); return; }
    if (type.name === 'boolean' && typeof value === 'boolean') return;
    if (type.name === 'integer') { parseInteger(value, location); return; }
    fail('VALUE_TYPE', 'unsupported primitive carrier; decimals require an exact nominal type', location);
  }
  if (type.form === 'nominal') {
    const t = exact.find(t => equal(t.domain, type.ref));
    if (t) { unpackExact(value, t); return; }
    const d = declaration(type.ref, layout, location);
    if (d.valueType?.form === 'record') {
      const members = d.valueType.members.map(r => declaration(r, layout, location));
      object(value, members.map(m => m.ref.id), location);
      members.forEach(m => validateValue(value[m.ref.id], m.valueType, layout, exact, location, depth + 1));
    } else validateValue(value, d.valueType, layout, exact, location, depth + 1);
    return;
  }
  if (type.form === 'optional') {
    object(value, ['present', 'value'], location);
    if (typeof value.present !== 'boolean' || !value.present && value.value !== null) fail('VALUE_OPTIONAL', 'optional requires explicit boolean presence and null when absent', location);
    if (value.present) validateValue(value.value, type.element, layout, exact, location, depth + 1);
    return;
  }
  if (type.form === 'sequence') { array(value, location).forEach(v => validateValue(v, type.element, layout, exact, location, depth + 1)); return; }
  if (type.form === 'map') {
    array(value, location).forEach(row => { object(row, ['key', 'value'], location); validateValue(row.key, type.key, layout, exact, location, depth + 1); validateValue(row.value, type.value, layout, exact, location, depth + 1); });
    for (let i = 0; i < value.length; i++) if (value.slice(0, i).some(r => sameValue(r.key, value[i].key))) fail('VALUE_DUPLICATE_KEY', 'map carrier requires unique keys', location);
    return;
  }
  fail('VALUE_TYPE', 'unsupported value type', location);
}
export function sameValue(a, b) { return equal(a, b); }
export function valueReferences(e) {
  const refs = e.op === 'ref' ? [e.ref] : e.op === 'host' ? [e.id] : e.op === 'member' ? [...valueReferences(e.argument), e.member] : e.op === 'map-get' ? [...valueReferences(e.map), ...valueReferences(e.key)] : ['add', 'subtract'].includes(e.op) ? [...valueReferences(e.left), ...valueReferences(e.right)] : [];
  return orderedReferences(refs);
}
export const orderedReferences = refs => refs.filter((r, i) => refs.findIndex(x => equal(x, r)) === i);
export function inferValue(e, scope, layout, hosts = [], exact = [], depth = 0) {
  if (depth > 64) fail('VALUE_DEPTH', 'value expression exceeds depth bound');
  const bad = () => fail('VALUE_SCOPE', 'value reference is outside the declared command/event scope');
  if (e.op === 'ref') {
    const r = e.ref;
    if (r.context !== scope.context || !(r.kind === 'state-field' && equal(r.owner, scope.owner) || scope.kind === 'command' && r.kind === 'parameter' && equal(r.owner, [...scope.owner, scope.id]) || scope.kind === 'event' && r.kind === 'event-slot' && equal(r.owner, [...scope.owner, scope.id]))) bad();
    return declaration(r, layout).valueType;
  }
  if (e.op === 'literal') { validateValue(e.value, e.valueType, layout, exact); return e.valueType; }
  if (e.op === 'host') {
    const h = hosts.find(h => equal(h.id, e.id) && h.version === e.version && equal(h.command, scope));
    if (scope.kind !== 'command' || !h) bad();
    return h.outputType;
  }
  if (e.op === 'member') {
    const parent = inferValue(e.argument, scope, layout, hosts, exact, depth + 1);
    const d = parent.form === 'nominal' ? declaration(parent.ref, layout) : null;
    if (d?.valueType?.form !== 'record' || !d.valueType.members.some(r => equal(r, e.member))) fail('VALUE_TYPE', 'member must belong to the declared nominal record');
    return declaration(e.member, layout).valueType;
  }
  if (e.op === 'map-get') {
    const map = inferValue(e.map, scope, layout, hosts, exact, depth + 1), key = inferValue(e.key, scope, layout, hosts, exact, depth + 1);
    if (map.form !== 'map' || !equal(map.key, key)) fail('VALUE_TYPE', 'map.get key type mismatch');
    return { form: 'optional', element: map.value };
  }
  if (['add', 'subtract'].includes(e.op)) {
    const left = inferValue(e.left, scope, layout, hosts, exact, depth + 1), right = inferValue(e.right, scope, layout, hosts, exact, depth + 1);
    if (!equal(left, right) || !(equal(left, integer) || left.form === 'nominal' && exact.some(t => equal(t.domain, left.ref)))) fail('VALUE_TYPE', 'arithmetic requires identical signed-64 or admitted exact nominal operands');
    return left;
  }
  fail('VALUE_OPERATOR', 'unsupported value expression');
}
export function parseValue(raw, expected, scope, layout, hosts, exact, location, version = '1', depth = 0) {
  if (depth > 64) fail('VALUE_DEPTH', 'authored value expression exceeds depth bound', location);
  let e;
  if (raw && typeof raw === 'object') {
    if (raw.form === 'host') { object(raw, ['form', 'id', 'version'], location); reference(raw.id, location); text(raw.version, location); e = { op: 'host', id: raw.id, version: raw.version }; }
    else if (raw.form === 'literal') { object(raw, ['form', 'value'], location); e = { op: 'literal', valueType: expected, value: raw.value }; }
    else if (version === '2' && ['add', 'subtract'].includes(raw.form)) {
      object(raw, ['form', 'left', 'right'], location);
      e = { op: raw.form, left: parseValue(raw.left, expected, scope, layout, hosts, exact, location, version, depth + 1), right: parseValue(raw.right, expected, scope, layout, hosts, exact, location, version, depth + 1) };
    }
    else fail('VALUE_OPERATOR', 'unsupported authored value form', location);
  } else {
    text(raw, location, true);
    if (raw.startsWith('literal:')) {
      const value = raw.slice(8);
      e = { op: 'literal', valueType: expected, value: equal(expected, { form: 'primitive', name: 'boolean' }) ? value === 'true' ? true : value === 'false' ? false : value : value };
    } else {
      const match = /^(param|state|event)\.([A-Za-z0-9_-]+)((?:\.[A-Za-z0-9_-]+)*)(?:\[(param|event)\.([A-Za-z0-9_-]+)\])?$/u.exec(raw);
      if (!match) fail('VALUE_OPERATOR', 'only declared paths, optional map lookup, literals and pinned host values are supported', location);
      const direct = (root, id) => ({ op: 'ref', ref: { context: scope.context, kind: root === 'state' ? 'state-field' : root === 'param' ? 'parameter' : 'event-slot', owner: root === 'state' ? scope.owner : [...scope.owner, scope.id], id } });
      e = direct(match[1], match[2]);
      for (const id of match[3].split('.').filter(Boolean)) {
        const parent = inferValue(e, scope, layout, hosts, exact);
        if (parent.form !== 'nominal') fail('VALUE_TYPE', 'member requires nominal record', location);
        e = { op: 'member', argument: e, member: { context: parent.ref.context, kind: 'member', owner: [parent.ref.id], id } };
      }
      if (match[4]) e = { op: 'map-get', map: e, key: direct(match[4], match[5]) };
    }
  }
  if (!equal(inferValue(e, scope, layout, hosts, exact), expected)) fail('VALUE_TYPE', 'producer type must exactly match its target nominal type', location);
  return e;
}
export function evaluateValue(e, scope, values, layout, hosts = [], exact = []) {
  const type = inferValue(e, scope, layout, hosts, exact);
  const lookup = r => {
    const row = [...values].find(([ref]) => equal(ref, r));
    if (!row) fail('VALUE_MISSING', 'missing explicit input or host output');
    return row[1];
  };
  let value;
  if (e.op === 'literal') value = e.value;
  else if (e.op === 'ref') value = lookup(e.ref);
  else if (e.op === 'host') value = lookup(e.id);
  else if (e.op === 'member') value = evaluateValue(e.argument, scope, values, layout, hosts, exact)[e.member.id];
  else if (e.op === 'map-get') {
    const map = evaluateValue(e.map, scope, values, layout, hosts, exact), key = evaluateValue(e.key, scope, values, layout, hosts, exact);
    const row = map.find(r => sameValue(r.key, key));
    value = row ? { present: true, value: row.value } : { present: false, value: null };
  }
  else if (['add', 'subtract'].includes(e.op)) {
    const left = evaluateValue(e.left, scope, values, layout, hosts, exact), right = evaluateValue(e.right, scope, values, layout, hosts, exact), sign = e.op === 'add' ? 1 : -1;
    value = equal(type, integer) ? (parseInteger(left) + BigInt(sign) * parseInteger(right)).toString() : applyExact(left, right, sign, type, exact);
  }
  else fail('VALUE_OPERATOR', 'unsupported value expression');
  validateValue(value, type, layout, exact);
  return value;
}
export function applyExact(base, delta, sign, type, exact) {
  const t = type.form === 'nominal' && exact.find(t => equal(t.domain, type.ref));
  if (!t) fail('FOLD_EXACT', 'money-apply requires a declared exact nominal type');
  const a = unpackExact(base, t), b = unpackExact(delta, t);
  if (a.unit !== b.unit) fail('EXACT_UNIT', 'exact arithmetic requires identical units');
  return packExact(a.coefficient + BigInt(sign) * b.coefficient, a.unit, t);
}
export { integer };
