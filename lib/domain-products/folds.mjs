import { copyImmutableData } from '../immutable-data.mjs';
import { array, at, equal, fail, object } from '../products/request.mjs';
import { domainDeclarations } from './dependencies.mjs';
import { applyExact, declaration, evaluateValue, inferValue, integer, orderedReferences, parseInteger, parseValue, sameValue, validateValue, valueReferences } from './values.mjs';

export function compileFolds(binding, canonical, layout, dependencies, exact) {
  const version = ['truthsrc.domain-fold-binding/v2', 'truthsrc.domain-fold-binding/v3', 'truthsrc.domain-fold-binding/v4', 'truthsrc.domain-fold-binding/v5'].includes(binding.schemaVersion) ? '2' : '1';
  const domain = domainDeclarations(canonical, layout);
  const defaults = domain.states.flatMap(a => a.rows.map(d => {
    const raw = canonical.value.aggregates.find(a => a.context === d.ref.context && a.name === d.ref.owner[0]).stateFields.find(f => f.name === d.ref.id);
    if (!Object.hasOwn(raw, 'default')) fail('FOLD_DEFAULT', 'each state field requires an explicit default', d.source);
    validateValue(raw.default, d.valueType, layout, exact, d.source);
    return { target: d.ref, valueType: d.valueType, source: at(canonical.id, d.source.pointer + '/default'), value: raw.default };
  }));
  const events = domain.events.map(e => {
    if (!dependencies.events.some(x => equal(x.event, e.ref))) fail('FOLD_DEPENDENCY', 'event must be covered by the complete dependency product', e.source);
    const assignments = array(e.row.foldAssignments, at(canonical.id, e.source.pointer + '/foldAssignments')).map((raw, i) => {
      const source = at(canonical.id, e.source.pointer + '/foldAssignments/' + i);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('PRODUCT_SHAPE', 'fold row must be an object', source);
      const op = raw.op ?? 'set';
      const keys = { set: ['slot', 'expr'], put: ['slot', 'key', 'value'], remove: ['slot', 'key'], 'put-all': ['slot', 'key', 'value'], 'remove-all': ['slot', 'key'], 'money-apply': ['slot', 'delta', 'sign'], 'integer-apply': ['slot', 'delta', 'sign'] };
      if (!Object.hasOwn(keys, op)) fail('FOLD_OPERATOR', 'unknown fold operator', source);
      object(raw, [...keys[op], ...(Object.hasOwn(raw, 'op') ? ['op'] : [])], source);
      const target = { context: e.ref.context, kind: 'state-field', owner: e.ref.owner, id: raw.slot }, valueType = declaration(target, layout, source).valueType;
      const expression = (field, expected) => parseValue(raw[field], expected, e.ref, layout, [], exact, source, version);
      let update;
      if (op === 'set') update = { op, value: expression('expr', valueType) };
      else if (['put', 'remove', 'put-all', 'remove-all'].includes(op)) {
        if (valueType.form !== 'map') fail('FOLD_TYPE', 'collection fold requires a declared map target', source);
        const keyType = op.endsWith('-all') ? { form: 'sequence', element: valueType.key } : valueType.key;
        update = { op, key: expression('key', keyType), ...(['put', 'put-all'].includes(op) ? { value: expression('value', valueType.value) } : {}) };
      } else {
        if (![1, -1].includes(raw.sign)) fail('FOLD_SIGN', 'arithmetic sign must be exactly 1 or -1', source);
        if (op === 'integer-apply' && !equal(valueType, integer) || op === 'money-apply' && !(valueType.form === 'nominal' && exact.some(t => equal(t.domain, valueType.ref)))) fail('FOLD_TYPE', 'arithmetic requires the exact declared integer/nominal type', source);
        update = { op, delta: expression('delta', valueType), sign: raw.sign };
      }
      const refs = Object.values(update).filter(x => x && typeof x === 'object').flatMap(valueReferences);
      if (op !== 'set') refs.unshift(target);
      return { target, valueType, sourceOrdinal: i, source, update, dependencies: orderedReferences(refs) };
    });
    if (new Set(assignments.map(a => a.target.id)).size !== assignments.length) fail('FOLD_TARGET', 'one assignment per target is required; no first-wins', e.source);
    return { event: e.ref, source: e.source, assignments };
  });
  const result = { defaults, events };
  if (!equal(result, binding.value.folds)) fail('PRODUCT_PAYLOAD_MISMATCH', 'complete source-derived folds differ from binding', at(binding.id, '/folds'));
  return result;
}

/** Pure replay oracle. Every update is calculated before any state value changes. */
export function evaluateFolds(event, values, layout, exact = []) {
  if (!(values instanceof Map)) fail('VALUE_MISSING', 'oracle values must be a qualified-reference Map');
  if (new Set(event.assignments.map(a => JSON.stringify(a.target))).size !== event.assignments.length) fail('FOLD_TARGET', 'one update per target is required');
  const get = r => { const row = [...values].find(([ref]) => equal(ref, r)); if (!row) fail('VALUE_MISSING', 'missing pre-event state'); return row[1]; };
  const evaluated = event.assignments.map(a => {
    if (a.target.kind !== 'state-field' || a.target.context !== event.event.context || !equal(a.target.owner, event.event.owner) ||
        !equal(declaration(a.target, layout).valueType, a.valueType)) fail('FOLD_TYPE', 'target type/scope must match the layout');
    const u = a.update, expression = e => evaluateValue(e, event.event, values, layout, [], exact);
    const keys = { set: ['op', 'value'], put: ['op', 'key', 'value'], remove: ['op', 'key'], 'put-all': ['op', 'key', 'value'], 'remove-all': ['op', 'key'], 'money-apply': ['op', 'delta', 'sign'], 'integer-apply': ['op', 'delta', 'sign'] };
    if (!Object.hasOwn(keys, u.op)) fail('FOLD_OPERATOR', 'unsupported typed fold operation');
    object(u, keys[u.op]);
    if (['integer-apply', 'money-apply'].includes(u.op) && ![1, -1].includes(u.sign)) fail('FOLD_SIGN', 'sign must be exactly 1 or -1');
    if (u.op === 'integer-apply' && !equal(a.valueType, integer) || u.op === 'money-apply' && !(a.valueType.form === 'nominal' && exact.some(t => equal(t.domain, a.valueType.ref)))) fail('FOLD_TYPE', 'arithmetic target type mismatch');
    if (['put', 'remove', 'put-all', 'remove-all'].includes(u.op) && a.valueType.form !== 'map') fail('FOLD_TYPE', 'collection operation requires map target');
    const expected = (e, type) => { if (!equal(inferValue(e, event.event, layout, [], exact), type)) fail('FOLD_TYPE', 'typed fold operand must match its declared target type'); };
    if (u.op === 'set') expected(u.value, a.valueType);
    else if (['integer-apply', 'money-apply'].includes(u.op)) expected(u.delta, a.valueType);
    else {
      expected(u.key, u.op.endsWith('-all') ? { form: 'sequence', element: a.valueType.key } : a.valueType.key);
      if (Object.hasOwn(u, 'value')) expected(u.value, a.valueType.value);
    }
    let value;
    if (u.op === 'set') value = expression(u.value);
    else {
      const base = get(a.target); validateValue(base, a.valueType, layout, exact);
      if (u.op === 'integer-apply') { value = (parseInteger(base) + BigInt(u.sign) * parseInteger(expression(u.delta))).toString(); }
      else if (u.op === 'money-apply') value = applyExact(base, expression(u.delta), u.sign, a.valueType, exact);
      else {
        const keys = u.op.endsWith('-all') ? expression(u.key) : [expression(u.key)];
        value = base.filter(row => !keys.some(key => sameValue(row.key, key)));
        if (['put', 'put-all'].includes(u.op)) {
          const item = expression(u.value);
          for (const key of keys) if (!value.some(r => sameValue(r.key, key))) value.push({ key, value: item });
        }
      }
    }
    validateValue(value, a.valueType, layout, exact);
    return [a.target, copyImmutableData(value)];
  });
  const result = new Map([...values].filter(([r]) => r.kind === 'state-field'));
  for (const [ref, value] of evaluated) { const key = [...result.keys()].find(r => equal(r, ref)) ?? ref; result.set(key, value); }
  return result;
}
