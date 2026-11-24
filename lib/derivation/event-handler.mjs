// Derivation layer for the event-handler family (emitter-unification plan F2,
// family #3, rulings 2026-11-24 §21): compiles the knowledge products
// (reference-layout, domain-folds, exact-value-types) + context package bindings
// fail-closed into truthsrc.event-handler-input/v1.
//
// All fold assignment expressions and Scala type renderings are derived here
// from the knowledge AST (supporting all 7 admitted fold operations: set, put,
// remove, put-all, remove-all, integer-apply, money-apply), so the emitter
// module embeds zero expression-interpreter logic or business bytes.
const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };

const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);
const symbol = name => {
  if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name))
    fail('EH_DERIVATION', 'target symbol requires an explicit safe identifier: ' + JSON.stringify(name));
  return KEYWORDS.has(name) ? '`' + name + '`' : name;
};
const packageFor = (context, options) => {
  if (!Array.isArray(options?.packages)) fail('EH_DERIVATION', 'explicit context packages required');
  const rows = options.packages.filter(p => p.context === context);
  if (rows.length !== 1 || Object.keys(rows[0]).sort().join(',') !== 'context,package')
    fail('EH_DERIVATION', 'context ' + context + ' has no unique exact package binding');
  const name = rows[0].package;
  if (typeof name !== 'string' || !name.split('.').every(p => /^[a-z][a-z0-9_]*$/u.test(p) && !KEYWORDS.has(p)))
    fail('EH_DERIVATION', 'package must be a safe explicit Scala package: ' + JSON.stringify(name));
  return name;
};
const key = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);
const owner = (ref, aggregate) => ref?.context === aggregate.context && ref?.owner?.[0] === aggregate.id;

const declaration = (layout, ref) => {
  const row = layout.declarations.find(d => key(d.ref) === key(ref));
  if (!row) fail('EH_DERIVATION', 'target reference has no admitted declaration: ' + key(ref));
  return row;
};
const exactType = (type, exact) => type?.form === 'nominal' ? exact.find(t => key(t.domain) === key(type.ref)) : null;

function typeName(type, options) {
  if (type.form === 'primitive') {
    const map = { string: 'String', boolean: 'Boolean', integer: 'Long', decimal: 'BigDecimal' };
    if (!map[type.name]) fail('EH_DERIVATION', 'unsupported primitive type: ' + String(type.name));
    return map[type.name];
  }
  if (type.form === 'nominal') return packageFor(type.ref.context, options) + '.domain.values.' + symbol(type.ref.id);
  if (type.form === 'optional') return 'Option[' + typeName(type.element, options) + ']';
  if (type.form === 'sequence') return 'Vector[' + typeName(type.element, options) + ']';
  if (type.form === 'map') return 'Map[' + typeName(type.key, options) + ', ' + typeName(type.value, options) + ']';
  fail('EH_DERIVATION', 'unsupported value type form: ' + String(type.form));
}

function literal(value, type, layout, exact, options) {
  if (type.form === 'primitive') {
    if (type.name === 'string') return JSON.stringify(value);
    if (type.name === 'boolean') return String(value);
    if (type.name === 'integer') return 'java.lang.Long.parseLong(' + JSON.stringify(value) + ')';
    return 'BigDecimal(' + JSON.stringify(value) + ')';
  }
  if (type.form === 'nominal') {
    const name = typeName(type, options);
    const descriptor = exactType(type, exact);
    if (descriptor) {
      return descriptor.form === 'decimal'
        ? name + '(BigDecimal(' + JSON.stringify(value) + '))'
        : name + '(BigDecimal(' + JSON.stringify(value[descriptor.amountMember.id]) + '), ' + JSON.stringify(value[descriptor.unitMember.id]) + ')';
    }
    const t = declaration(layout, type.ref).valueType;
    if (t.form === 'record')
      return name + '(' + t.members.map(r => literal(value[r.id], declaration(layout, r).valueType, layout, exact, options)).join(', ') + ')';
    return name + '(' + literal(value, t, layout, exact, options) + ')';
  }
  if (type.form === 'optional') return value.present ? 'Some(' + literal(value.value, type.element, layout, exact, options) + ')' : 'None';
  if (type.form === 'sequence') return 'Vector(' + value.map(v => literal(v, type.element, layout, exact, options)).join(', ') + ')';
  if (type.form === 'map') return 'Map(' + value.map(r => literal(r.key, type.key, layout, exact, options) + ' -> ' + literal(r.value, type.value, layout, exact, options)).join(', ') + ')';
  fail('EH_DERIVATION', 'unsupported literal carrier: ' + String(type.form));
}

function valueExpression(node, layout, exact, options) {
  const render = n => valueExpression(n, layout, exact, options);
  if (node.op === 'ref') return (node.ref.kind === 'state-field' ? 'state.' : node.ref.kind === 'event-slot' ? 'event.' : 'p.') + symbol(node.ref.id);
  if (node.op === 'literal') return literal(node.value, node.valueType, layout, exact, options);
  if (node.op === 'host') return 'hosts.' + symbol(node.id.id) + '(state, p)';
  if (node.op === 'member') return '(' + render(node.argument) + ').' + symbol(node.member.id);
  if (node.op === 'map-get') return '(' + render(node.map) + ').get(' + render(node.key) + ')';
  if (['add', 'subtract'].includes(node.op)) {
    const operand = n => n.op === 'literal' ? n.valueType : n.op === 'ref' ? declaration(layout, n.ref).valueType : n.op === 'member' ? declaration(layout, n.member).valueType : operand(n.left);
    const t = operand(node);
    return t.form === 'primitive'
      ? 'java.lang.Math.' + (node.op === 'add' ? 'addExact' : 'subtractExact') + '(' + render(node.left) + ', ' + render(node.right) + ')'
      : '(' + render(node.left) + ').' + (node.op === 'add' ? 'plus' : 'minus') + '(' + render(node.right) + ')';
  }
  fail('EH_DERIVATION', 'unsupported value operation: ' + String(node.op));
}

function foldExpression(assignment, layout, exact, options) {
  const u = assignment.update;
  const base = 'state.' + symbol(assignment.target.id);
  const render = n => valueExpression(n, layout, exact, options);
  if (u.op === 'set') return render(u.value);
  if (u.op === 'put') return base + '.updated(' + render(u.key) + ', ' + render(u.value) + ')';
  if (u.op === 'remove') return base + ' - ' + render(u.key);
  if (u.op === 'put-all') return '{ val keys = ' + render(u.key) + '; val item = ' + render(u.value) + '; ' + base + ' ++ keys.map(_ -> item) }';
  if (u.op === 'remove-all') return base + ' -- ' + render(u.key);
  if (u.op === 'integer-apply') return 'java.lang.Math.' + (u.sign === 1 ? 'addExact' : 'subtractExact') + '(' + base + ', ' + render(u.delta) + ')';
  if (u.op === 'money-apply') return base + '.' + (u.sign === 1 ? 'plus' : 'minus') + '(' + render(u.delta) + ')';
  fail('EH_DERIVATION', 'unsupported admitted fold target operation: ' + String(u.op));
}

const requireSource = (source, what) => {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    fail('EH_DERIVATION', what + ' must carry a {document, pointer} knowledge source');
  return { document: source.document, pointer: source.pointer };
};

export function deriveEventHandlers(products, options) {
  const layout = products?.['reference-layout'];
  const folds = products?.['domain-folds'];
  const exact = products?.['exact-value-types'];
  if (!Array.isArray(layout?.declarations)) fail('EH_DERIVATION', 'reference-layout declarations required');
  if (!Array.isArray(folds?.events)) fail('EH_DERIVATION', 'domain-folds events required');
  if (!Array.isArray(exact)) fail('EH_DERIVATION', 'exact-value-types rows required');

  const aggregates = layout.declarations.filter(d => d.ref?.kind === 'aggregate');
  if (!aggregates.length) fail('EH_DERIVATION', 'no aggregate declarations');

  const contexts = [...new Set(aggregates.map(a => a.ref.context))];
  const packages = contexts.map(ctx => ({ context: ctx, package: packageFor(ctx, options) }));

  const handlers = aggregates.map(a => {
    const events = folds.events
      .filter(e => owner(e.event, a.ref))
      .map(e => ({
        name: symbol(e.event.id),
        source: requireSource(e.source, 'event source for ' + a.ref.id + '.' + e.event.id),
        assignments: (e.assignments ?? []).map((asgn, idx) => ({
          target: symbol(asgn.target.id),
          valueType: typeName(asgn.valueType, options),
          expression: foldExpression(asgn, layout, exact, options),
          source: requireSource(asgn.source, 'assignment source ' + idx + ' for ' + a.ref.id + '.' + e.event.id),
        })),
      }));
    return {
      context: a.ref.context,
      name: symbol(a.ref.id),
      source: requireSource(a.source, 'aggregate source for ' + a.ref.id),
      events,
    };
  });

  return {
    schemaVersion: 'truthsrc.event-handler-input/v1',
    packages,
    handlers,
  };
}
