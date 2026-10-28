import { at, equal, fail, object, ProductError, resolve, text } from '../products/request.mjs';
import { exactOperand, infer, lookupSafety, parseExpression, presentWhen, references } from './expressions.mjs';
import { parseExact, unpackExact } from '../value-products/exact-types.mjs';
import { refKey } from './references.mjs';

export function compileDecisions(binding, canonical, layout, exactTypes = null) {
  if (!Array.isArray(canonical.value.aggregates)) fail('DECISION_COVERAGE', 'canonical aggregates array is required', at(canonical.id, '/aggregates'));
  const declarations = layout.declarations.filter(d => d.ref.kind === 'command');
  const expected = canonical.value.aggregates.flatMap((aggregate, ai) => {
    if (!Array.isArray(aggregate?.commands)) fail('DECISION_COVERAGE', 'aggregate commands array is required', at(canonical.id, `/aggregates/${ai}`));
    return aggregate.commands.map((command, ci) => ({ aggregate, command, pointer: `/aggregates/${ai}/commands/${ci}` }));
  });
  if (expected.length !== declarations.length || new Set(declarations.map(d => d.source.pointer)).size !== declarations.length ||
      expected.some(c => !declarations.some(d => d.source.document === canonical.id && d.source.pointer === c.pointer)))
    fail('DECISION_COVERAGE', 'layout must cover every canonical command exactly once', at(canonical.id, '/aggregates'));
  for (const c of expected) {
    const d = declarations.find(d => d.source.pointer === c.pointer);
    if (c.command?.name !== d.ref.id || c.aggregate.name !== d.ref.owner[0] ||
        Object.hasOwn(c.aggregate, 'context') && c.aggregate.context !== d.ref.context)
      fail('DECISION_SOURCE', 'command identity must match its canonical owner/name/context', d.source);
  }
  const commands = declarations.map(d => {
    const command = resolve(canonical.value, d.source.pointer, d.source);
    if (!Array.isArray(command.guards)) fail('DECISION_COVERAGE', 'command must declare its complete ordered guards array', d.source);
    let known = new Set();
    const decisions = command.guards.map((guard, index) => {
      const location = at(canonical.id, `${d.source.pointer}/guards/${index}`);
      try {
        const invariant = guard?.kind === 'invariantRef';
        const allowed = invariant ? ['kind', 'ref', 'errCode', 'cond', 'desc', 'onFail'] : ['ruleId', 'errCode', 'when', 'onFail', 'desc'];
        if (!guard || typeof guard !== 'object' || Array.isArray(guard) || Object.keys(guard).some(k => !allowed.includes(k)))
          fail('DECISION_SOURCE_EXPRESSION_UNSUPPORTED', 'unsupported or ambiguous source guard fields');
        if (Object.hasOwn(guard, 'errCode')) text(guard.errCode, location);
        if (Object.hasOwn(guard, 'onFail')) text(guard.onFail, location);
        const ruleId = text(invariant ? guard.ref : guard.ruleId, location);
        const onFail = guard.onFail ?? (invariant ? 'reject' : null);
        let onFalse;
        if (onFail === 'reject') onFalse = { kind: 'reject', errCode: text(guard.errCode, location) };
        else if (onFail === 'succeed-empty') onFalse = { kind: 'succeed-empty' };
        else fail('DECISION_FAILURE', 'explicit reject or succeed-empty required');
        let predicate;
        if (invariant) predicate = parseExpression(guard.cond, d.ref, layout, exactTypes);
        else {
          object(guard.when, ['form', 'map', 'key'], location);
          if (!['map-contains', 'map-absent'].includes(guard.when.form)) fail('DECISION_SOURCE_EXPRESSION_UNSUPPORTED', 'unsupported structured rule');
          const path = raw => {
            const parts = typeof raw === 'string' ? raw.split('.') : [];
            if (parts.length !== 2 || !['param', 'state'].includes(parts[0])) fail('DECISION_SOURCE_EXPRESSION_UNSUPPORTED', 'structured rule requires direct param/state path');
            const result = { op: 'ref', ref: { context: d.ref.context, kind: parts[0] === 'param' ? 'parameter' : 'state-field', owner: parts[0] === 'param' ? [...d.ref.owner, d.ref.id] : d.ref.owner, id: parts[1] } };
            infer(result, d.ref, layout);
            return result;
          };
          const contains = { op: 'map-contains', left: path(`state.${text(guard.when.map, location)}`), right: path(guard.when.key) };
          predicate = guard.when.form === 'map-absent' ? { op: 'not', argument: contains } : contains;
        }
        if (!equal(infer(predicate, d.ref, layout, exactTypes), { form: 'primitive', name: 'boolean' })) fail('DECISION_TYPE', 'predicate must be boolean');
        lookupSafety(predicate, known);
        known = new Set([...known, ...presentWhen(predicate, true)]);
        return { sourceOrdinal: index, ruleId, source: location, predicate, onFalse, dependencies: references(predicate) };
      } catch (e) {
        if (e instanceof ProductError) throw new ProductError(e.diagnostic.code, e.message, location, e.diagnostic.related);
        throw e;
      }
    });
    return { command: d.ref, source: d.source, decisions };
  });
  const result = { commands };
  if (!equal(result, binding.value.decisions)) fail('PRODUCT_PAYLOAD_MISMATCH', 'source-derived decisions differ from complete semantic binding', at(binding.id, '/decisions'));
  return result;
}

/** Pure oracle for the declared expression subset; not an application state machine. */
export function evaluateDecisions(command, values, layout, exactTypes = null) {
  if (!(values instanceof Map)) fail('DECISION_VALUE', 'values must be an explicit qualified-reference Map');
  const keyed = new Map([...values].map(([ref, value]) => [refKey(ref), value]));
  const flag = value => { if (typeof value !== 'boolean') fail('DECISION_VALUE', 'expected boolean'); return value; };
  const same = (a, b) => {
    if (a instanceof Map || b instanceof Map) {
      if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
      return [...a].every(([key, value]) => [...b].some(([otherKey, otherValue]) => same(key, otherKey) && same(value, otherValue)));
    }
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
    return equal(a, b);
  };
  const expression = e => {
    if (e.op === 'ref') {
      const key = refKey(e.ref);
      if (!keyed.has(key)) fail('DECISION_VALUE', 'missing declared input value');
      const value = keyed.get(key), declaration = layout.declarations.find(d => refKey(d.ref) === key);
      const type = declaration?.valueType?.form === 'nominal' ? exactTypes?.types.find(t => equal(t.domain, declaration.valueType.ref)) : null;
      if (type) unpackExact(value, type);
      return value;
    }
    if (['boolean', 'string', 'decimal'].includes(e.op)) return e.value;
    if (e.op === 'member') {
      const value = expression(e.argument);
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, e.member.id)) fail('DECISION_VALUE', 'record member is missing');
      return value[e.member.id];
    }
    if (e.op === 'not') return !flag(expression(e.argument));
    if (['is-empty', 'non-empty'].includes(e.op)) {
      const value = expression(e.argument);
      const empty = typeof value === 'string' || Array.isArray(value) ? value.length === 0 : value instanceof Map ? value.size === 0 : value?.kind === 'optional' ? value.value === null : null;
      if (empty === null) fail('DECISION_VALUE', 'value has no emptiness operation');
      return e.op === 'is-empty' ? empty : !empty;
    }
    if (e.op === 'map-keys') { const value = expression(e.argument); if (!(value instanceof Map)) fail('DECISION_VALUE', 'expected map'); return [...value.keys()]; }
    if (e.op === 'and') return flag(expression(e.left)) && flag(expression(e.right));
    if (e.op === 'or') return flag(expression(e.left)) || flag(expression(e.right));
    if (e.op === 'all-equal') {
      const value = expression(e.left);
      if (!Array.isArray(value)) fail('DECISION_VALUE', 'expected sequence');
      if (!value.length) return true;
      const item = expression(e.right);
      return value.every(x => same(x, item));
    }
    if (['less', 'less-equal', 'greater', 'greater-equal', 'equal', 'not-equal'].includes(e.op) &&
        (['less', 'less-equal', 'greater', 'greater-equal'].includes(e.op) || exactTypes &&
        (e.left.op === 'decimal' || e.right.op === 'decimal' || exactOperand(e.left, command.command, layout, exactTypes) && exactOperand(e.right, command.command, layout, exactTypes)))) {
      infer(e, command.command, layout, exactTypes);
      const a = exactOperand(e.left, command.command, layout, exactTypes), b = exactOperand(e.right, command.command, layout, exactTypes), type = a ?? b;
      const number = node => {
        if (node.op === 'member' && type.form === 'unit-decimal') return unpackExact(expression(node.argument), type);
        return { coefficient: parseExact(expression(node), type), unit: null };
      };
      const l = number(e.left), r = number(e.right);
      if (l.unit !== null && r.unit !== null && l.unit !== r.unit) fail('EXACT_UNIT', 'cannot compare different units');
      return { less: l.coefficient < r.coefficient, 'less-equal': l.coefficient <= r.coefficient,
        greater: l.coefficient > r.coefficient, 'greater-equal': l.coefficient >= r.coefficient,
        equal: l.coefficient === r.coefficient, 'not-equal': l.coefficient !== r.coefficient }[e.op];
    }
    const left = expression(e.left), right = expression(e.right);
    if (e.op === 'equal') return same(left, right);
    if (e.op === 'not-equal') return !same(left, right);
    if (['map-contains', 'map-get', 'map-lookup'].includes(e.op)) {
      if (!(left instanceof Map)) fail('DECISION_VALUE', 'expected map');
      const entry = [...left].find(([key]) => same(key, right));
      if (e.op === 'map-contains') return !!entry;
      if (e.op === 'map-get') return { kind: 'optional', value: entry ? entry[1] : null };
      if (!entry) fail('DECISION_VALUE', 'missing map key');
      return entry[1];
    }
    if (e.op === 'contains') {
      if (typeof left === 'string' && typeof right === 'string') return left.includes(right);
      if (Array.isArray(left)) return left.some(x => same(x, right));
      if (left?.kind === 'optional') return left.value !== null && same(left.value, right);
    }
    fail('DECISION_VALUE', 'unsupported value operation');
  };
  for (const decision of command.decisions) {
    if (!flag(expression(decision.predicate))) return decision.onFalse.kind === 'reject' ?
      { kind: 'reject', errCode: decision.onFalse.errCode } : { kind: 'succeed-empty' };
  }
  return { kind: 'continue' };
}
