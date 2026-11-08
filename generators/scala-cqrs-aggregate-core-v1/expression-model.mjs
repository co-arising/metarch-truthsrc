import { array, at, equal, fail, object } from '../../lib/products/request.mjs';
import { reference, refKey, typeRefs } from '../../lib/domain-products/references.mjs';
import { exactComparison, exactOperand, infer, integer, lookupSafety } from '../../lib/domain-products/expressions.mjs';
import { inferValue } from '../../lib/domain-products/values.mjs';

const location = at('target', '/expressions');
const reject = message => fail('AGGREGATE_EXPRESSION', message, location);
const distinct = values => [...new Set(values)];
const refsOf = refs => [...new Map(refs.map(r => [refKey(r), r])).values()];
const nominal = a => ({ form: 'nominal', role: a.role, ref: a.ref, name: a.name, identifier: a.identifier, fqn: a.fqn, path: a.path });
export function typePaths(type) {
  if (type.form === 'nominal') return [type.path];
  if (['optional', 'sequence'].includes(type.form)) return typePaths(type.element);
  if (type.form === 'map') return [...typePaths(type.key), ...typePaths(type.value)];
  return [];
}
const typeReferences = type => type.form === 'nominal' ? [type.ref] : ['optional', 'sequence'].includes(type.form) ? typeReferences(type.element)
  : type.form === 'map' ? [...typeReferences(type.key), ...typeReferences(type.value)] : [];

/** Resolve admitted semantic AST, never parse author prose or interpolate Scala. */
export function expressionResolver(kernel, products) {
  const layout = products['reference-layout'], exactTypes = products['exact-value-types'];
  const exactInput = { types: exactTypes }, hosts = products['domain-dependencies'].hosts;
  const definitions = new Map(kernel.values.map(v => [refKey(v.ref), v]));
  const fields = new Map(kernel.values.flatMap(v => v.fields.filter(f => f.ref).map(f => [refKey(f.ref), f])));
  const methods = new Map();
  for (const a of kernel.aggregates) {
    for (const f of [...a.state.fields, ...a.protocol.commands.flatMap(c => c.fields), ...a.protocol.events.flatMap(e => e.fields)]) fields.set(refKey(f.ref), f);
    for (const m of a.computations.methods) methods.set(refKey(m.ref), m);
  }
  function resolveType(type) {
    typeRefs(type, location);
    if (type.form === 'primitive') return type;
    if (type.form === 'nominal') {
      const definition = definitions.get(refKey(type.ref));
      if (!definition) reject('nominal expression definition missing');
      return nominal(definition);
    }
    if (['optional', 'sequence'].includes(type.form)) return { form: type.form, element: resolveType(type.element) };
    if (type.form === 'map') return { form: 'map', key: resolveType(type.key), value: resolveType(type.value) };
    reject('expression record must be nominal');
  }
  function field(ref) {
    reference(ref, location);
    const f = fields.get(refKey(ref)); if (!f) reject('resolved expression field missing');
    return f;
  }
  function exact(descriptor) {
    if (!descriptor) reject('admitted exact definition missing');
    const definition = definitions.get(refKey(descriptor.domain));
    if (!definition?.exact || !equal(definition.exact, descriptor)) reject('exact model/descriptor mismatch');
    const amountField = descriptor.form === 'decimal' ? definition.fields[0] : field(descriptor.amountMember);
    const unitField = descriptor.form === 'unit-decimal' ? field(descriptor.unitMember) : null;
    return { descriptor, definition: nominal(definition), amountField, unitField };
  }
  function refNode(e, type, source) {
    const root = { 'state-field': 'state', parameter: 'command', 'event-slot': 'event' }[e.ref.kind];
    if (!root) reject('only resolved state/command/event fields can be read');
    const f = field(e.ref);
    if (!equal(f.type, resolveType(type))) reject('expression field type differs from the base model');
    return node(e.op, type, source, [], { ref: e.ref, root, field: f }, [e.ref]);
  }
  function node(op, semanticType, source, children, additions = {}, refs = [], paths = []) {
    const type = resolveType(semanticType);
    return { op, type, source, refs: refsOf([...refs, ...typeReferences(type), ...children.flatMap(c => c.refs)]),
      directDeps: distinct([...typePaths(type), ...paths, ...children.flatMap(c => c.directDeps)]), ...additions };
  }
  const predicateKeys = {
    ref: ['ref'], boolean: ['value'], string: ['value'], integer: ['value'], decimal: ['value'], member: ['argument', 'member'],
    not: ['argument'], 'text-value': ['argument'], 'exact-positive': ['argument'], 'map-keys': ['argument'], 'is-empty': ['argument'], 'non-empty': ['argument'],
    add: ['left', 'right'], subtract: ['left', 'right'], 'collection-covered': ['left', 'right'], 'exact-sufficient': ['left', 'right'],
    less: ['left', 'right'], 'less-equal': ['left', 'right'], greater: ['left', 'right'], 'greater-equal': ['left', 'right'],
    and: ['left', 'right'], or: ['left', 'right'], equal: ['left', 'right'], 'not-equal': ['left', 'right'],
    'map-get': ['left', 'right'], 'map-lookup': ['left', 'right'], 'map-contains': ['left', 'right'], 'all-equal': ['left', 'right'], contains: ['left', 'right'],
  };
  const valueKeys = { ref: ['ref'], literal: ['valueType', 'value'], host: ['id', 'version'], member: ['argument', 'member'], 'map-get': ['map', 'key'], add: ['left', 'right'], subtract: ['left', 'right'] };
  function shape(e, keys, depth = 0) {
    if (depth > 64) reject('expression exceeds AST depth bounds');
    if (!e || typeof e !== 'object' || !Object.hasOwn(keys, e.op)) reject('unsupported expression operator');
    object(e, ['op', ...keys[e.op]], location);
    if (e.op === 'boolean' && typeof e.value !== 'boolean' || e.op === 'string' && typeof e.value !== 'string') reject('predicate literal type mismatch');
    if (e.op === 'ref') reference(e.ref, location);
    if (e.op === 'member') reference(e.member, location);
    for (const key of ['argument', 'left', 'right', 'map', 'key']) if (Object.hasOwn(e, key)) shape(e[key], keys, depth + 1);
  }
  function lowerPredicate(e, scope, source) {
    const type = infer(e, scope, layout, exactInput, '4');
    if (e.op === 'ref') return refNode(e, type, source);
    if (['boolean', 'string', 'integer', 'decimal'].includes(e.op)) return node(e.op, type, source, [], { value: e.value });
    if (e.op === 'member') {
      const argument = lowerPredicate(e.argument, scope, source), f = field(e.member);
      return node(e.op, type, source, [argument], { argument, member: e.member, field: f }, [e.member]);
    }
    if (e.argument) {
      const argument = lowerPredicate(e.argument, scope, source), extra = {};
      if (e.op === 'text-value') {
        const d = definitions.get(refKey(argument.type.ref));
        if (!d || d.type.form !== 'primitive' || d.type.name !== 'string') reject('nominal text scalar base is missing');
        extra.field = d.fields[0];
      }
      if (e.op === 'exact-positive') extra.exact = exact(exactTypes.find(t => argument.type.form === 'nominal' && equal(t.domain, argument.type.ref)));
      return node(e.op, type, source, [argument], { argument, ...extra });
    }
    let left = lowerPredicate(e.left, scope, source), right = lowerPredicate(e.right, scope, source), extra = {};
    const ltype = infer(e.left, scope, layout, exactInput, '4'), rtype = infer(e.right, scope, layout, exactInput, '4');
    if (['add', 'subtract'].includes(e.op)) {
      if (equal(type, integer)) extra.mode = 'checked-long';
      else {
        const descriptor = exactComparison(e, scope, layout, exactInput, '4');
        extra = { mode: 'exact', exact: exact(descriptor) };
        left = numeric(e.left, left, descriptor, scope); right = numeric(e.right, right, descriptor, scope);
      }
    } else if (['less', 'less-equal', 'greater', 'greater-equal', 'equal', 'not-equal'].includes(e.op)) {
      const equality = ['equal', 'not-equal'].includes(e.op);
      // Nominal equality is structural, including units. Amount projections and
      // numeric literals use exactComparison instead of the old raw renderer rule.
      const numericEquality = ltype.form === 'primitive' && ltype.name === 'decimal' || rtype.form === 'primitive' && rtype.name === 'decimal';
      if (equality && !numericEquality) extra.mode = 'structural';
      else if (equal(ltype, integer) && equal(rtype, integer)) extra.mode = 'integer';
      else {
        const descriptor = exactComparison(e, scope, layout, exactInput, '4');
        extra = { mode: 'exact-amount', exact: exact(descriptor) };
        left = numeric(e.left, left, descriptor, scope); right = numeric(e.right, right, descriptor, scope);
      }
    } else if (e.op === 'exact-sufficient') {
      extra.exact = exact(exactTypes.find(t => rtype.form === 'nominal' && equal(t.domain, rtype.ref)));
      extra.balance = ltype.form === 'map' ? 'unit-map' : 'nominal';
    }
    return node(e.op, type, source, [left, right], { left, right, ...extra });
  }
  function numeric(raw, resolved, descriptor, scope) {
    const admitted = exactOperand(raw, scope, layout, exactInput, '4');
    if (!['decimal', 'integer'].includes(raw.op) && (!admitted || !equal(admitted.domain, descriptor.domain))) reject('exact operand definition mismatch');
    const carrier = ['decimal', 'integer'].includes(raw.op) ? 'literal' : ['add', 'subtract'].includes(raw.op) ? 'arithmetic'
      : raw.op === 'member' ? 'amount-member' : 'nominal';
    return { ...resolved, numeric: { exact: exact(descriptor), carrier } };
  }
  function lowerValue(e, scope, source) {
    const type = inferValue(e, scope, layout, hosts, exactTypes);
    if (e.op === 'ref') return refNode(e, type, source);
    if (e.op === 'literal') return node(e.op, type, source, [], { value: e.value, valueType: resolveType(e.valueType) });
    if (e.op === 'host') {
      const method = methods.get(refKey(e.id)), h = hosts.find(h => equal(h.id, e.id) && h.version === e.version && equal(h.command, scope));
      if (!method || !h || !equal(method.command, scope) || method.version !== e.version) reject('resolved host signature missing');
      const arguments_ = array(h.inputDependencies, location).map(ref => lowerValue({ op: 'ref', ref }, scope, source));
      if (!equal(method.parameters.map(p => p.ref), arguments_.map(p => p.ref))) reject('host inputDependencies/base signature order mismatch');
      return node(e.op, type, source, arguments_, { id: e.id, version: e.version, method, arguments: arguments_ }, [e.id], [method.path]);
    }
    if (e.op === 'member') {
      const argument = lowerValue(e.argument, scope, source), f = field(e.member);
      return node(e.op, type, source, [argument], { argument, member: e.member, field: f }, [e.member]);
    }
    if (e.op === 'map-get') {
      const map = lowerValue(e.map, scope, source), key = lowerValue(e.key, scope, source);
      return node(e.op, type, source, [map, key], { map, key });
    }
    if (['add', 'subtract'].includes(e.op)) {
      const left = lowerValue(e.left, scope, source), right = lowerValue(e.right, scope, source);
      const extra = equal(type, integer) ? { mode: 'checked-long' } : { mode: 'exact', exact: exact(exactTypes.find(t => type.form === 'nominal' && equal(t.domain, type.ref))) };
      return node(e.op, type, source, [left, right], { left, right, ...extra });
    }
    reject('unsupported value operator');
  }
  return Object.freeze({
    resolveType, field, exact,
    predicate(raw, scope, source, known = new Set()) {
      shape(raw, predicateKeys); lookupSafety(raw, known);
      const result = lowerPredicate(raw, scope, source);
      if (!equal(result.type, { form: 'primitive', name: 'boolean' })) reject('guard predicate must be Boolean');
      return result;
    },
    value(raw, scope, source) { shape(raw, valueKeys); return lowerValue(raw, scope, source); },
  });
}
