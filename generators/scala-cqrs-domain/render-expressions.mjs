import { symbol, typeName, packageFor, key } from './naming.mjs';

const string = value => JSON.stringify(value);
const declaration = (layout, ref) => {
  const row = layout.declarations.find(d => key(d.ref) === key(ref));
  if (!row) throw new TypeError('target reference has no admitted declaration');
  return row;
};
const exactType = (type, exact) => type?.form === 'nominal' ? exact.find(t => key(t.domain) === key(type.ref)) : null;
function descriptor(node, layout, exact) {
  if (node.op === 'ref') return exactType(declaration(layout, node.ref).valueType, exact);
  if (node.op === 'member') {
    const parent = descriptor(node.argument, layout, exact);
    return parent?.amountMember && key(parent.amountMember) === key(node.member) ? parent : null;
  }
  if (node.op === 'map-lookup') return exactType(nodeType(node, layout, exact), exact);
  if (['add', 'subtract'].includes(node.op)) return descriptor(node.left, layout, exact) ?? descriptor(node.right, layout, exact);
  return null;
}
function nodeType(node, layout, exact) {
  if (node.op === 'ref') return declaration(layout, node.ref).valueType;
  if (node.op === 'member') return declaration(layout, node.member).valueType;
  if (node.op === 'integer') return { form: 'primitive', name: 'integer' };
  if (node.op === 'decimal') return { form: 'primitive', name: 'decimal' };
  if (node.op === 'map-lookup') return nodeType(node.left, layout, exact).value;
  if (['add', 'subtract'].includes(node.op)) {
    const left = nodeType(node.left, layout, exact), right = nodeType(node.right, layout, exact);
    const type = descriptor(node, layout, exact);
    return !type ? left : type.form === 'decimal' || left.form === 'nominal' && right.form === 'nominal' && key(left.ref) === key(right.ref) ? { form: 'nominal', ref: type.domain } : { form: 'primitive', name: 'decimal' };
  }
  return null;
}
const exactName = (type, options) => packageFor(type.domain.context, options) + '.domain.values.' + symbol(type.domain.id);
export function decision(node, layout, exact, options) {
  const child = n => decision(n, layout, exact, options);
  const scalar = (n, type) => nodeType(n, layout, exact)?.form === 'nominal' ? '(' + child(n) + ').' + symbol(type.amountMember?.id ?? 'value') : child(n);
  const units = (n, type) => {
    if (type.form !== 'unit-decimal') return [];
    if (nodeType(n, layout, exact)?.form === 'nominal') return ['(' + child(n) + ').' + symbol(type.unitMember.id)];
    if (n.op === 'member') return ['(' + child(n.argument) + ').' + symbol(type.unitMember.id)];
    return ['add', 'subtract'].includes(n.op) ? [...units(n.left, type), ...units(n.right, type)] : [];
  };
  const checked = (type, nodes, result) => {
    const values = [...new Set(nodes.flatMap(n => units(n, type)))];
    return values.length > 1 ? '{ require(' + values.slice(1).map(u => values[0] + ' == ' + u).join(' && ') + ', "exact units differ"); ' + result + ' }' : result;
  };
  if (node.op === 'ref') return (node.ref.kind === 'state-field' ? 'state.' : 'p.') + symbol(node.ref.id);
  if (node.op === 'boolean') return String(node.value);
  if (node.op === 'string') return string(node.value);
  if (node.op === 'integer') return 'java.lang.Long.parseLong(' + string(node.value) + ')';
  if (node.op === 'decimal') return 'BigDecimal(' + string(node.value) + ')';
  if (node.op === 'member') return '(' + child(node.argument) + ').' + symbol(node.member.id);
  if (node.argument) {
    const a = child(node.argument);
    if (node.op === 'not') return '!(' + a + ')';
    if (node.op === 'exact-positive') return '(' + a + ').isPositive';
    const op = { 'is-empty': 'isEmpty', 'non-empty': 'nonEmpty', 'map-keys': 'keys' }[node.op];
    if (!op) throw new TypeError('unsupported admitted unary target operation');
    return '(' + a + ').' + op;
  }
  const left = child(node.left), right = child(node.right);
  if (node.op === 'collection-covered') return '(' + right + ').forall((' + left + ').contains)';
  if (node.op === 'exact-sufficient') {
    const type = descriptor(node.right, layout, exact), t = nodeType(node.left, layout, exact);
    return t?.form === 'map' ? '(' + left + ').get((' + right + ').' + symbol(type.unitMember.id) + ').exists(_.compareSameUnit(' + right + ') >= 0)' : '(' + left + ').compareSameUnit(' + right + ') >= 0';
  }
  if (['add', 'subtract'].includes(node.op)) {
    const type = descriptor(node, layout, exact);
    if (!type) return 'java.lang.Math.' + (node.op === 'add' ? 'addExact' : 'subtractExact') + '(' + left + ', ' + right + ')';
    const amount = exactName(type, options) + '.checkedAmount(' + exactName(type, options) + '.checkedAmount(' + scalar(node.left, type) + ')' + (node.op === 'add' ? ' + ' : ' - ') + exactName(type, options) + '.checkedAmount(' + scalar(node.right, type) + '))';
    const result = nodeType(node, layout, exact).form === 'nominal' ? exactName(type, options) + '(' + amount + (type.form === 'unit-decimal' ? ', ' + units(node.left, type)[0] : '') + ')' : amount;
    return checked(type, [node.left, node.right], result);
  }
  const operators = { and: '&&', or: '||', equal: '==', 'not-equal': '!=', less: '<', 'less-equal': '<=', greater: '>', 'greater-equal': '>=' };
  if (operators[node.op]) {
    const type = descriptor(node.left, layout, exact) ?? descriptor(node.right, layout, exact);
    if (type && ['less', 'less-equal', 'greater', 'greater-equal', 'equal', 'not-equal'].includes(node.op))
      return checked(type, [node.left, node.right], '(' + scalar(node.left, type) + ' ' + operators[node.op] + ' ' + scalar(node.right, type) + ')');
    return '(' + left + ' ' + operators[node.op] + ' ' + right + ')';
  }
  if (node.op === 'map-lookup') return '(' + left + ')(' + right + ')';
  if (node.op === 'all-equal') return '(' + left + ').forall(_ == ' + right + ')';
  const op = { 'map-contains': 'contains', 'map-get': 'get', contains: 'contains' }[node.op];
  if (!op) throw new TypeError('unsupported admitted binary target operation');
  return '(' + left + ').' + op + '(' + right + ')';
}
export function literal(value, type, layout, exact, options) {
  if (type.form === 'primitive') return type.name === 'string' ? string(value) : type.name === 'boolean' ? String(value) : type.name === 'integer' ? 'java.lang.Long.parseLong(' + string(value) + ')' : 'BigDecimal(' + string(value) + ')';
  if (type.form === 'nominal') {
    const name = typeName(type, options), descriptor = exactType(type, exact);
    if (descriptor) return descriptor.form === 'decimal' ? name + '(BigDecimal(' + string(value) + '))' : name + '(BigDecimal(' + string(value[descriptor.amountMember.id]) + '), ' + string(value[descriptor.unitMember.id]) + ')';
    const t = declaration(layout, type.ref).valueType;
    if (t.form === 'record') return name + '(' + t.members.map(r => literal(value[r.id], declaration(layout, r).valueType, layout, exact, options)).join(', ') + ')';
    return name + '(' + literal(value, t, layout, exact, options) + ')';
  }
  if (type.form === 'optional') return value.present ? 'Some(' + literal(value.value, type.element, layout, exact, options) + ')' : 'None';
  if (type.form === 'sequence') return 'Vector(' + value.map(v => literal(v, type.element, layout, exact, options)).join(', ') + ')';
  if (type.form === 'map') return 'Map(' + value.map(r => literal(r.key, type.key, layout, exact, options) + ' -> ' + literal(r.value, type.value, layout, exact, options)).join(', ') + ')';
  throw new TypeError('unsupported value carrier');
}
export function valueExpression(node, layout, exact, options) {
  const render = n => valueExpression(n, layout, exact, options);
  if (node.op === 'ref') return (node.ref.kind === 'state-field' ? 'state.' : node.ref.kind === 'event-slot' ? 'event.' : 'p.') + symbol(node.ref.id);
  if (node.op === 'literal') return literal(node.value, node.valueType, layout, exact, options);
  if (node.op === 'host') return 'hosts.' + symbol(node.id.id) + '(state, p)';
  if (node.op === 'member') return '(' + render(node.argument) + ').' + symbol(node.member.id);
  if (node.op === 'map-get') return '(' + render(node.map) + ').get(' + render(node.key) + ')';
  if (['add', 'subtract'].includes(node.op)) {
    const operand = n => n.op === 'literal' ? n.valueType : n.op === 'ref' ? declaration(layout, n.ref).valueType : n.op === 'member' ? declaration(layout, n.member).valueType : operand(n.left);
    const t = operand(node);
    return t.form === 'primitive' ? 'java.lang.Math.' + (node.op === 'add' ? 'addExact' : 'subtractExact') + '(' + render(node.left) + ', ' + render(node.right) + ')' : '(' + render(node.left) + ').' + (node.op === 'add' ? 'plus' : 'minus') + '(' + render(node.right) + ')';
  }
  throw new TypeError('unsupported value operation');
}
