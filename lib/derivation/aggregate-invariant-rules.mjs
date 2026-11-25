// Derivation layer for the aggregate invariant rules cluster (emitter-unification
// plan F2, family #45): compiles declared aggregates' knowledge products,
// fail-closed, into the truthsrc.aggregate-invariant-rules-input/v1 contract
// rendered by the unified aggregate-invariant-rules emitter family.
//
// The predicate expression renderer below is ported verbatim from the classic
// knowledge interpreter (generators/scala-cqrs-domain/render-expressions.mjs +
// naming.mjs) — the decision predicate AST is knowledge, and rendering it to
// contract text is derivation work, not emitter layout. The emitter embeds zero
// expression bytes; every guard text is contract data derived here.
import { isClassicRetiredContext, isUnifiedContext } from './emission-policy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };

export const isRulesFlipped = (context, _aggregateId, options) =>
  isClassicRetiredContext(context, options);

// ---- knowledge-side naming and expression interpreter (classic port) ----

const keywords = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);
const symbol = name => {
  if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) throw new TypeError('target symbol requires an explicit safe identifier');
  return keywords.has(name) ? '`' + name + '`' : name;
};
const packageFor = (context, options) => {
  if (!Array.isArray(options?.packages)) throw new TypeError('explicit context packages required');
  const rows = options.packages.filter(p => p.context === context);
  if (rows.length !== 1 || Object.keys(rows[0]).sort().join(',') !== 'context,package') throw new TypeError('one exact package binding per context required');
  const name = rows[0].package;
  if (typeof name !== 'string' || !name.split('.').every(p => /^[a-z][a-z0-9_]*$/u.test(p) && !keywords.has(p))) throw new TypeError('package must be a safe explicit Scala package');
  return name;
};
const key = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);

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
  const checkedComparison = (type, nodes, op, result) => {
    const values = [...new Set(nodes.flatMap(n => units(n, type)))];
    if (values.length <= 1) return result;
    if (op === 'not-equal') {
      const anyUnitDiffers = values.slice(1).map(u => '(' + values[0] + ' != ' + u + ')').join(' || ');
      return '(' + anyUnitDiffers + ' || ' + result + ')';
    }
    const sameUnits = values.slice(1).map(u => '(' + values[0] + ' == ' + u + ')').join(' && ');
    return '(' + sameUnits + ' && ' + result + ')';
  };
  if (node.op === 'ref') return (node.ref.kind === 'state-field' ? 'state.' : 'p.') + symbol(node.ref.id);
  if (node.op === 'boolean') return String(node.value);
  if (node.op === 'string') return string(node.value);
  if (node.op === 'integer') return node.value + 'L';
  if (node.op === 'decimal') return 'BigDecimal(' + string(node.value) + ')';
  if (node.op === 'member') return '(' + child(node.argument) + ').' + symbol(node.member.id);
  if (node.argument) {
    const a = child(node.argument);
    if (node.op === 'text-value') return '(' + a + ').value';
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
    return t?.form === 'map'
      ? '(' + left + ').get((' + right + ').' + symbol(type.unitMember.id) + ').exists(_.compareSameUnit(' + right + ').exists(_ >= 0))'
      : '(' + left + ').compareSameUnit(' + right + ').exists(_ >= 0)';
  }
  if (['add', 'subtract'].includes(node.op)) {
    const type = descriptor(node, layout, exact);
    if (!type) return 'java.lang.Math.' + (node.op === 'add' ? 'addExact' : 'subtractExact') + '(' + left + ', ' + right + ')';
    const amount = '(' + scalar(node.left, type) + (node.op === 'add' ? ' + ' : ' - ') + scalar(node.right, type) + ')';
    const result = nodeType(node, layout, exact).form === 'nominal' ? exactName(type, options) + '(' + amount + (type.form === 'unit-decimal' ? ', ' + units(node.left, type)[0] : '') + ')' : amount;
    return result;
  }
  const operators = { and: '&&', or: '||', equal: '==', 'not-equal': '!=', less: '<', 'less-equal': '<=', greater: '>', 'greater-equal': '>=' };
  if (operators[node.op]) {
    const type = descriptor(node.left, layout, exact) ?? descriptor(node.right, layout, exact);
    if (type && ['less', 'less-equal', 'greater', 'greater-equal', 'equal', 'not-equal'].includes(node.op))
      return checkedComparison(type, [node.left, node.right], node.op, '(' + scalar(node.left, type) + ' ' + operators[node.op] + ' ' + scalar(node.right, type) + ')');
    return '(' + left + ' ' + operators[node.op] + ' ' + right + ')';
  }
  if (node.op === 'map-lookup') return '(' + left + ')(' + right + ')';
  if (node.op === 'all-equal') return '(' + left + ').forall(_ == ' + right + ')';
  const op = { 'map-contains': 'contains', 'map-get': 'get', contains: 'contains' }[node.op];
  if (!op) throw new TypeError('unsupported admitted binary target operation');
  return '(' + left + ').' + op + '(' + right + ')';
}

// ---- fail-closed contract derivation ----

const requireArray = (value, what) => {
  if (!Array.isArray(value) || !value.length) fail('RULES_DERIVATION', what + ' must be a nonempty array');
  return value;
};
const PRIMITIVE_FORMS = new Set(['string', 'integer', 'boolean', 'decimal']);
function typeTree(type, what) {
  if (!type || typeof type !== 'object') fail('RULES_DERIVATION', what + ' must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVE_FORMS.has(type.name)) fail('RULES_DERIVATION', what + ' unsupported primitive type: ' + JSON.stringify(type.name));
    return { form: 'primitive', name: type.name };
  }
  if (type.form === 'nominal') {
    if (!type.ref || typeof type.ref !== 'object') fail('RULES_DERIVATION', what + ' nominal type must carry ref');
    return { form: 'nominal', context: type.ref.context, name: type.ref.id };
  }
  if (type.form === 'optional') return { form: 'optional', element: typeTree(type.element, what + '.element') };
  if (type.form === 'sequence') return { form: 'sequence', element: typeTree(type.element, what + '.element') };
  if (type.form === 'map') return { form: 'map', key: typeTree(type.key, what + '.key'), value: typeTree(type.value, what + '.value') };
  fail('RULES_DERIVATION', what + ' unsupported type form: ' + JSON.stringify(type.form));
}
function deriveExpr(node, layout, what) {
  if (!node || typeof node !== 'object') fail('RULES_DERIVATION', what + ' must be an expression node');
  if (node.op === 'ref') {
    const kind = node.ref?.kind;
    const scope = kind === 'state-field' ? 'state-field' : kind === 'event-slot' ? 'event-slot' : 'parameter';
    if (typeof node.ref?.id !== 'string' || !node.ref.id) fail('RULES_DERIVATION', what + ' ref must carry id');
    return { op: 'ref', scope, name: node.ref.id };
  }
  if (node.op === 'literal') {
    return { op: 'literal', valueType: typeTree(node.valueType, what + '.valueType'), value: node.value };
  }
  if (node.op === 'host') {
    if (typeof node.id?.id !== 'string' || !node.id.id) fail('RULES_DERIVATION', what + ' host must carry id.id');
    return { op: 'host', name: node.id.id };
  }
  if (node.op === 'member') {
    if (typeof node.member?.id !== 'string' || !node.member.id) fail('RULES_DERIVATION', what + ' member must carry member.id');
    return { op: 'member', argument: deriveExpr(node.argument, layout, what + '.argument'), member: node.member.id };
  }
  if (node.op === 'map-get') {
    return { op: 'map-get', map: deriveExpr(node.map, layout, what + '.map'), key: deriveExpr(node.key, layout, what + '.key') };
  }
  if (node.op === 'add' || node.op === 'subtract') {
    const operandType = n => {
      if (n.op === 'literal') return n.valueType;
      if (n.op === 'ref') return declaration({ declarations: layout }, n.ref).valueType;
      if (n.op === 'member') return declaration({ declarations: layout }, n.member).valueType;
      return operandType(n.left);
    };
    const t = operandType(node);
    const arithmetic = t?.form === 'primitive' ? 'primitive' : 'nominal';
    return { op: node.op, arithmetic, left: deriveExpr(node.left, layout, what + '.left'), right: deriveExpr(node.right, layout, what + '.right') };
  }
  fail('RULES_DERIVATION', what + ' unsupported value expression op: ' + JSON.stringify(node.op));
}
const requireSource = (source, what) => {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    fail('RULES_DERIVATION', what + ' must carry a {document, pointer} knowledge source');
  return { document: source.document, pointer: source.pointer };
};
const outcomeOf = onFalse => {
  if (!onFalse || typeof onFalse !== 'object') fail('RULES_DERIVATION', 'guard outcome required');
  if (onFalse.kind === 'reject') {
    if (typeof onFalse.errCode !== 'string' || !onFalse.errCode) fail('RULES_DERIVATION', 'reject outcome requires a nonempty errCode');
    return typeof onFalse.message === 'string' && onFalse.message.length > 0
      ? { kind: 'reject', code: onFalse.errCode, message: onFalse.message }
      : { kind: 'reject', code: onFalse.errCode };
  }
  if (onFalse.kind === 'succeed-empty') return { kind: 'succeed-empty' };
  fail('RULES_DERIVATION', 'unsupported guard outcome kind: ' + String(onFalse.kind));
};

function deriveEventPostconditions(layout, flip) {
  const eventRows = layout.filter(d => d.ref?.kind === 'event' && d.ref.context === flip.context && d.ref.owner?.[0] === flip.aggregate);
  const out = [];
  for (const ev of eventRows) {
    const slots = layout.filter(d => d.ref?.kind === 'event-slot' && d.ref.context === flip.context &&
      d.ref.owner?.[0] === flip.aggregate && d.ref.owner?.[1] === ev.ref.id);
    const checks = [];
    for (const slot of slots) {
      const t = slot.valueType;
      if (t?.form === 'primitive' && (t.name === 'integer' || t.name === 'boolean')) continue;
      checks.push({
        slot: slot.ref.id,
        kind: 'non-null',
        code: 'EVENT_POSTCONDITION_REQUIRED',
        message: ev.ref.id + '.' + slot.ref.id + ' 不能为空',
      });
    }
    if (checks.length > 0) out.push({ event: ev.ref.id, checks });
  }
  return out;
}

/**
 * Compile the flipped aggregates' invariant rules into the family contract.
 * The cluster is the emission unit: every manifest aggregate must be present
 * with exactly one layout declaration, and every command carries its pure
 * domain parameters, guard chain, and emitted events as derived contract data.
 */
export function deriveInvariantRules(products, options) {
  const layout = requireArray(products?.['reference-layout']?.declarations, 'reference-layout declarations');
  const exact = requireArray(products?.['exact-value-types'], 'exact-value-types rows');
  const commandRows = requireArray(products?.['domain-decision']?.commands, 'domain-decision command rows');
  const depCommands = requireArray(products?.['domain-dependencies']?.commands, 'domain-dependencies command rows');
  const depByKey = new Map(depCommands.map(c => [key(c.command), c]));
  const aggregateDecls = layout.filter(d =>
    d.ref?.kind === 'aggregate' && (!d.ref.owner || d.ref.owner.length === 0) &&
    isUnifiedContext(d.ref.context, options));
  if (!aggregateDecls.length) fail('RULES_DERIVATION', 'at least one aggregate declaration required');
  const seenAggs = new Set();
  const aggregates = aggregateDecls.map(declarationRow => {
    const flip = { context: declarationRow.ref.context, aggregate: declarationRow.ref.id };
    const aggKey = flip.context + '/' + flip.aggregate;
    if (seenAggs.has(aggKey)) fail('RULES_DERIVATION', `duplicate aggregate declaration ${flip.aggregate} in ${flip.context}`);
    seenAggs.add(aggKey);
    const pkg = packageFor(flip.context, options);
    const commands = commandRows
      .filter(c => c.command?.context === flip.context && c.command?.owner?.[0] === flip.aggregate)
      .map(c => {
        const depCmd = depByKey.get(key(c.command));
        if (!depCmd) fail('RULES_DERIVATION', 'command missing from domain-dependencies: ' + flip.aggregate + '.' + c.command.id);
        const parameters = (depCmd.declaredSignature ?? []).map(r => ({
          name: (r.ref ?? r.target).id,
          valueType: typeTree(r.valueType, 'command ' + c.command.id + ' param ' + (r.ref ?? r.target).id),
        }));
        const events = requireArray(depCmd.events, 'command ' + c.command.id + ' events').map(e => ({
          name: e.event.id,
          slots: (e.slots ?? []).map((s, idx) => ({
            producer: deriveExpr(s.producer, layout, 'command ' + c.command.id + ' event ' + e.event.id + ' slot[' + idx + ']'),
          })),
        }));
        return {
          command: symbol(c.command.id),
          source: requireSource(c.source, 'command knowledge source for ' + flip.aggregate + '.' + c.command.id),
          parameters,
          guards: requireArray(c.decisions, 'guard chain of ' + flip.aggregate + '.' + c.command.id).map((d, i) => ({
            source: requireSource(d.source, 'guard knowledge source ' + i + ' of ' + flip.aggregate + '.' + c.command.id),
            text: decision(d.predicate, { declarations: layout }, exact, options),
            outcome: outcomeOf(d.onFalse),
          })),
          events,
        };
      });
    return {
      context: flip.context,
      aggregate: flip.aggregate,
      package: pkg,
      name: symbol(flip.aggregate),
      source: requireSource(declarationRow.source, 'aggregate knowledge source ' + flip.aggregate),
      commands,
      eventPostconditions: deriveEventPostconditions(layout, flip),
    };
  });
  const packages = (options?.packages ?? []).map(p => ({ context: p.context, package: p.package }));
  return { schemaVersion: 'truthsrc.aggregate-invariant-rules-input/v1', packages, aggregates };
}
