// Derivation layer for the aggregate invariant rules cluster (emitter-unification
// plan F2, family #45): the knowledge products of the flipped rules cluster
// (bank aggregates CreditBalance / FundOrder / SipPlan) compile, fail-closed,
// into the truthsrc.aggregate-invariant-rules-input/v1 contract that the
// unified emitter family renders byte-identically to the classic invariant-dsl
// trio per aggregate — the core guard-chain rules, the rule params record
// object, and the domain facade wrapper.
//
// Ruling 2026-11-23 (recorded in docs/emitter-unification-host-family-rulings.md):
// this cluster's integration is a BYTE-REPRODUCTION flip. The rules files ARE
// the bank's verified business logic; their ABI (facade, guard chains, params
// records, Either[String, Vector[Event]]) is consumed by generated consumers
// whose own families flip later in Phase 3, so reshaping the rules now would
// break the per-flip isolation and the always-compilable guarantee. The emitter
// therefore reproduces the classic bytes exactly (golden provenance
// classic-reproduction, zero app-visible diff); shape evolution of this cluster
// belongs to the Phase-4 all31Closed evaluation, decided by the user.
//
// The predicate expression renderer below is ported verbatim from the classic
// knowledge interpreter (generators/scala-cqrs-domain/render-expressions.mjs +
// naming.mjs) — the decision predicate AST is knowledge, and rendering it to
// contract text is derivation work, not emitter layout. The emitter embeds zero
// expression bytes; every guard text is contract data derived here.

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };

export const RULES_FLIP_AGGREGATES = Object.freeze([
  { context: 'bankwealth', aggregate: 'CreditBalance' },
  { context: 'bankwealth', aggregate: 'FundOrder' },
  { context: 'bankwealth', aggregate: 'SipPlan' },
]);

export const isRulesFlipped = (context, aggregateId) =>
  RULES_FLIP_AGGREGATES.some(f => f.context === context && f.aggregate === aggregateId);

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
  const checked = (type, nodes, result) => {
    const values = [...new Set(nodes.flatMap(n => units(n, type)))];
    return values.length > 1 ? '{ require(' + values.slice(1).map(u => values[0] + ' == ' + u).join(' && ') + ', "exact units differ"); ' + result + ' }' : result;
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

// ---- fail-closed contract derivation ----

const requireArray = (value, what) => {
  if (!Array.isArray(value) || !value.length) fail('RULES_DERIVATION', what + ' must be a nonempty array');
  return value;
};
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
    return { kind: 'reject', code: onFalse.errCode };
  }
  if (onFalse.kind === 'succeed-empty') return { kind: 'succeed-empty' };
  fail('RULES_DERIVATION', 'unsupported guard outcome kind: ' + String(onFalse.kind));
};

/**
 * Compile the flipped aggregates' invariant rules into the family contract.
 * The cluster is the emission unit: every manifest aggregate must be present
 * with exactly one layout declaration, and every command carries its guard
 * chain as derived contract text (never emitter-embedded).
 */
export function deriveInvariantRules(products, options) {
  const layout = requireArray(products?.['reference-layout']?.declarations, 'reference-layout declarations');
  const exact = requireArray(products?.['exact-value-types'], 'exact-value-types rows');
  const commandRows = requireArray(products?.['domain-decision']?.commands, 'domain-decision command rows');
  const aggregates = RULES_FLIP_AGGREGATES.map(flip => {
    const rows = layout.filter(d => d.ref?.kind === 'aggregate' && d.ref.context === flip.context &&
      d.ref.id === flip.aggregate && (!d.ref.owner || d.ref.owner.length === 0));
    if (rows.length !== 1) fail('RULES_DERIVATION', `exactly one aggregate declaration ${flip.aggregate} in ${flip.context} required, got ${rows.length}`);
    const declarationRow = rows[0];
    const pkg = packageFor(flip.context, options);
    const commands = commandRows
      .filter(c => c.command?.context === flip.context && c.command?.owner?.[0] === flip.aggregate)
      .map(c => ({
        command: symbol(c.command.id),
        source: requireSource(c.source, 'command knowledge source for ' + flip.aggregate + '.' + c.command.id),
        guards: requireArray(c.decisions, 'guard chain of ' + flip.aggregate + '.' + c.command.id).map((d, i) => ({
          source: requireSource(d.source, 'guard knowledge source ' + i + ' of ' + flip.aggregate + '.' + c.command.id),
          text: decision(d.predicate, { declarations: layout }, exact, options),
          outcome: outcomeOf(d.onFalse),
        })),
      }));
    return {
      context: flip.context,
      aggregate: flip.aggregate,
      package: pkg,
      name: symbol(flip.aggregate),
      source: requireSource(declarationRow.source, 'aggregate knowledge source ' + flip.aggregate),
      commands,
    };
  });
  return { schemaVersion: 'truthsrc.aggregate-invariant-rules-input/v1', aggregates };
}
