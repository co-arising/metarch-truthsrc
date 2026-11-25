// aggregate-invariant-rules emitter (family #45): renders each aggregate's
// pure-domain invariant rules (`domain.invariants.<Name>Rules`) and pure-domain
// parameter records (`domain.invariants.params.<Name>RuleParams`) aligned with
// playAkkaCQRS: zero Command dependency in domain/, direct event emission from
// `domain.entities.<Name>Entity`, and exact byte-level codeMappings provenance.
import { parseStrictJson } from '../../lib/strict-json.mjs';
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const SCHEMA = 'truthsrc.aggregate-invariant-rules-input/v1';
const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);
const PRIMITIVES = new Map([['string', 'String'], ['integer', 'Long'], ['boolean', 'Boolean'], ['decimal', 'BigDecimal']]);
const REF_SCOPES = new Set(['parameter', 'state-field', 'event-slot']);

const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('RULES_INPUT', what + ' must be nonempty text');
  return value;
};
const identifier = (value, what) => {
  text(value, what);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) fail('RULES_INPUT', what + ' must be a safe Scala identifier');
  return value;
};
const symbol = name => KEYWORDS.has(name) ? '`' + name + '`' : name;
const knowledgeOf = source => 'source:' + source.document + '#' + source.pointer;

function checkSource(source, what) {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    {fail('RULES_INPUT', what + ' must carry a {document, pointer} knowledge source');}
}

function checkTypeTree(type, what, pkgByContext) {
  if (!type || typeof type !== 'object' || Array.isArray(type)) fail('RULES_INPUT', what + ' must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVES.has(type.name)) fail('RULES_INPUT', what + ' unsupported primitive: ' + JSON.stringify(type.name));
    return;
  }
  if (type.form === 'nominal') {
    text(type.context, what + ' nominal context');
    identifier(type.name, what + ' nominal name');
    if (!pkgByContext.has(type.context)) fail('RULES_INPUT', what + ' unbound context: ' + type.context);
    return;
  }
  if (type.form === 'optional' || type.form === 'sequence') {
    checkTypeTree(type.element, what + '.element', pkgByContext);
    return;
  }
  if (type.form === 'map') {
    checkTypeTree(type.key, what + '.key', pkgByContext);
    checkTypeTree(type.value, what + '.value', pkgByContext);
    return;
  }
  fail('RULES_INPUT', what + ' unsupported type form: ' + JSON.stringify(type.form));
}

function checkExpr(expr, what, pkgByContext) {
  if (!expr || typeof expr !== 'object' || Array.isArray(expr)) fail('RULES_INPUT', what + ' must be an expression object');
  if (expr.op === 'ref') {
    if (!REF_SCOPES.has(expr.scope)) fail('RULES_INPUT', what + ' invalid ref scope: ' + JSON.stringify(expr.scope));
    identifier(expr.name, what + ' ref name');
    return;
  }
  if (expr.op === 'literal') {
    checkTypeTree(expr.valueType, what + '.valueType', pkgByContext);
    return;
  }
  if (expr.op === 'host') {
    identifier(expr.name, what + ' host name');
    return;
  }
  if (expr.op === 'member') {
    checkExpr(expr.argument, what + '.argument', pkgByContext);
    identifier(expr.member, what + ' member name');
    return;
  }
  if (expr.op === 'map-get') {
    checkExpr(expr.map, what + '.map', pkgByContext);
    checkExpr(expr.key, what + '.key', pkgByContext);
    return;
  }
  if (expr.op === 'add' || expr.op === 'subtract') {
    if (expr.arithmetic !== 'primitive' && expr.arithmetic !== 'nominal')
      {fail('RULES_INPUT', what + ' arithmetic must be primitive or nominal');}
    checkExpr(expr.left, what + '.left', pkgByContext);
    checkExpr(expr.right, what + '.right', pkgByContext);
    return;
  }
  fail('RULES_INPUT', what + ' unsupported expression op: ' + JSON.stringify(expr.op));
}

function checkPackages(packages) {
  if (!Array.isArray(packages) || packages.length === 0) fail('RULES_INPUT', 'packages must be a nonempty array');
  const pkgByContext = new Map();
  for (const [i, p] of packages.entries()) {
    const pt = what => `packages[${i}] ${what}`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) fail('RULES_INPUT', pt('must be an object'));
    const ctx = text(p.context, pt('context'));
    const pkg = text(p.package, pt('package'));
    if (!pkg.split('.').every(seg => /^[a-z][a-z0-9_]*$/u.test(seg) && !KEYWORDS.has(seg)))
      {fail('RULES_INPUT', pt('package must be a dotted lowercase-root Scala package'));}
    if (pkgByContext.has(ctx)) fail('RULES_INPUT', pt('duplicate package binding for context ' + ctx));
    pkgByContext.set(ctx, pkg);
  }
  return pkgByContext;
}

function checkCommand(c, cat, pkgByContext) {
  identifier(c.command, cat('command'));
  checkSource(c.source, cat('source'));
  if (!Array.isArray(c.parameters)) fail('RULES_INPUT', cat('parameters must be an array'));
  const seenParams = new Set();
  for (const [k, param] of c.parameters.entries()) {
    const pat = what => cat(`parameters[${k}] ${what}`);
    if (!param || typeof param !== 'object' || Array.isArray(param)) fail('RULES_INPUT', pat('must be an object'));
    const pname = identifier(param.name, pat('name'));
    if (seenParams.has(pname)) fail('RULES_INPUT', pat('duplicate parameter ' + pname));
    seenParams.add(pname);
    checkTypeTree(param.valueType, pat('valueType'), pkgByContext);
  }
  if (!Array.isArray(c.guards)) fail('RULES_INPUT', cat('guards must be an array'));
  for (const [k, g] of c.guards.entries()) {
    const gat = what => cat(`guards[${k}] ${what}`);
    text(g.text, gat('text'));
    checkSource(g.source, gat('source'));
    if (!g.outcome || typeof g.outcome !== 'object') fail('RULES_INPUT', gat('outcome required'));
    if (g.outcome.kind === 'reject') text(g.outcome.code, gat('reject code'));
    else if (g.outcome.kind !== 'succeed-empty') fail('RULES_INPUT', gat('outcome kind must be reject or succeed-empty'));
  }
  if (!Array.isArray(c.events) || c.events.length === 0) fail('RULES_INPUT', cat('events must be a nonempty array'));
  for (const [k, ev] of c.events.entries()) {
    const eat = what => cat(`events[${k}] ${what}`);
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) fail('RULES_INPUT', eat('must be an object'));
    identifier(ev.name, eat('name'));
    if (!Array.isArray(ev.slots)) fail('RULES_INPUT', eat('slots must be an array'));
    for (const [s, slot] of ev.slots.entries()) {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) fail('RULES_INPUT', eat(`slots[${s}] must be an object`));
      checkExpr(slot.producer, eat(`slots[${s}].producer`), pkgByContext);
    }
  }
}

function checkInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('RULES_INPUT', 'input must be an object');
  if (input.schemaVersion !== SCHEMA) fail('RULES_INPUT', 'unsupported schemaVersion: ' + JSON.stringify(input.schemaVersion));
  const pkgByContext = checkPackages(input.packages);
  if (!Array.isArray(input.aggregates) || input.aggregates.length === 0) fail('RULES_INPUT', 'aggregates must be a nonempty array');
  for (const [i, a] of input.aggregates.entries()) {
    const at = what => `aggregates[${i}] ${what}`;
    if (!a || typeof a !== 'object' || Array.isArray(a)) fail('RULES_INPUT', at('must be an object'));
    text(a.context, at('context'));
    identifier(a.aggregate, at('aggregate'));
    const pkg = text(a.package, at('package'));
    if (!pkg.split('.').every(p => /^[a-z][a-z0-9_]*$/u.test(p) && !KEYWORDS.has(p)))
      {fail('RULES_INPUT', at('package must be a dotted lowercase-root Scala package'));}
    identifier(a.name, at('name'));
    checkSource(a.source, at('source'));
    if (!Array.isArray(a.commands)) fail('RULES_INPUT', at('commands must be an array'));
    for (const [j, c] of a.commands.entries()) {
      checkCommand(c, what => `aggregates[${i}].commands[${j}] ${what}`, pkgByContext);
    }
  }
}

const byteSpan = (content, value) => ({
  start: Buffer.byteLength(content.slice(0, value.start)),
  end: Buffer.byteLength(content.slice(0, value.end)),
  text: content.slice(value.start, value.end),
});
const mapping = (content, m) => ({
  knowledgeKey: knowledgeOf(m.source),
  span: byteSpan(content, m.span),
  scope: byteSpan(content, m.scope),
});

function hasBalancedParens(expr) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) return false;
      if (depth === 0 && i < expr.length - 1) return false;
    }
  }
  return depth === 0 && !inString;
}

function renderGuardCondition(predicate) {
  const expr = predicate.trim();
  if (expr.startsWith('!(') && expr.endsWith(')') && hasBalancedParens(expr.slice(1))) {
    const inner = expr.slice(2, -1);
    return inner.startsWith('(') && inner.endsWith(')') && hasBalancedParens(inner) ? inner : '(' + inner + ')';
  }
  return '!(' + expr + ')';
}

function renderType(type, pkgByContext, ownContext) {
  if (type.form === 'primitive') return PRIMITIVES.get(type.name);
  if (type.form === 'nominal') {
    if (type.context === ownContext) return symbol(type.name);
    return pkgByContext.get(type.context) + '.domain.values.' + symbol(type.name);
  }
  if (type.form === 'optional') return 'Option[' + renderType(type.element, pkgByContext, ownContext) + ']';
  if (type.form === 'sequence') return 'Vector[' + renderType(type.element, pkgByContext, ownContext) + ']';
  return 'Map[' + renderType(type.key, pkgByContext, ownContext) + ', ' + renderType(type.value, pkgByContext, ownContext) + ']';
}

function usesOwnValues(type, ownContext) {
  if (type.form === 'nominal') return type.context === ownContext;
  if (type.form === 'optional' || type.form === 'sequence') return usesOwnValues(type.element, ownContext);
  if (type.form === 'map') return usesOwnValues(type.key, ownContext) || usesOwnValues(type.value, ownContext);
  return false;
}

function valueDeps(type, pkgByContext) {
  if (type.form === 'nominal') return [scalaSubpackagePath(pkgByContext.get(type.context), 'domain.values', type.name + '.scala')];
  if (type.form === 'optional' || type.form === 'sequence') return valueDeps(type.element, pkgByContext);
  if (type.form === 'map') return [...valueDeps(type.key, pkgByContext), ...valueDeps(type.value, pkgByContext)];
  return [];
}

function renderLiteral(value, type) {
  if (type.form === 'primitive') {
    if (type.name === 'string') return JSON.stringify(value);
    if (type.name === 'boolean') return String(value);
    if (type.name === 'integer') return value + 'L';
    return 'BigDecimal(' + JSON.stringify(value) + ')';
  }
  if (type.form === 'optional') return value.present ? 'Some(' + renderLiteral(value.value, type.element) + ')' : 'None';
  if (type.form === 'sequence') return 'Vector(' + value.map(v => renderLiteral(v, type.element)).join(', ') + ')';
  return 'Map(' + value.map(r => renderLiteral(r.key, type.key) + ' -> ' + renderLiteral(r.value, type.value)).join(', ') + ')';
}

const lowerFirst = s => (s ? s[0].toLowerCase() + s.slice(1) : s);

function renderExpr(expr) {
  if (expr.op === 'ref') {
    let prefix = 'p.';
    if (expr.scope === 'state-field') prefix = 'state.';
    else if (expr.scope === 'event-slot') prefix = 'event.';
    return prefix + symbol(expr.name);
  }
  if (expr.op === 'literal') return renderLiteral(expr.value, expr.valueType);
  if (expr.op === 'host') return 'hosts.' + symbol(lowerFirst(expr.name)) + '(state, p)';
  if (expr.op === 'member') return '(' + renderExpr(expr.argument) + ').' + symbol(expr.member);
  if (expr.op === 'map-get') return '(' + renderExpr(expr.map) + ').get(' + renderExpr(expr.key) + ')';
  const left = renderExpr(expr.left), right = renderExpr(expr.right);
  if (expr.arithmetic === 'primitive') {
    return 'java.lang.Math.' + (expr.op === 'add' ? 'addExact' : 'subtractExact') + '(' + left + ', ' + right + ')';
  }
  return '(' + left + ').' + (expr.op === 'add' ? 'plus' : 'minus') + '(' + right + ')';
}

function renderParamCaseClass(className, parameters, pkgByContext, ownContext) {
  const fields = parameters.map(r => symbol(r.name) + ': ' + renderType(r.valueType, pkgByContext, ownContext));
  const oneLine = '  final case class ' + className + '(' + fields.join(', ') + ')';
  if (fields.length > 4 || oneLine.length > 110) {
    return '  final case class ' + className + '(\n    ' + fields.join(',\n    ') + '\n  )';
  }
  return oneLine;
}

/**
 * Render one aggregate's pure-domain rules pair:
 *   1. `domain/invariants/<Name>Rules.scala`
 *   2. `domain/invariants/params/<Name>RuleParams.scala`
 */
function renderAggregateRules(a, pkgByContext) {
  const pkg = a.package, name = a.name;
  const entityPath = scalaSubpackagePath(pkg, 'domain.entities', a.aggregate + 'Entity.scala');
  const computationsPath = scalaSubpackagePath(pkg, 'domain.services', a.aggregate + 'Computations.scala');
  const corePath = scalaSubpackagePath(pkg, 'domain.invariants', a.aggregate + 'Rules.scala');
  const paramsPath = scalaSubpackagePath(pkg, 'domain.invariants.params', a.aggregate + 'RuleParams.scala');
  const aggregateSources = [a.source, ...a.commands.map(c => c.source)];

  let rules = 'package ' + pkg + '.domain.invariants\n\n' +
    'import ' + pkg + '.domain.entities.' + name + 'Entity._\n' +
    'import ' + pkg + '.domain.invariants.params.' + name + 'RuleParams._\n' +
    'import ' + pkg + '.domain.services.' + name + 'Computations\n' +
    'import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}\n\n' +
    'object ' + name + 'Rules {\n';
  const ruleMappings = [];
  for (const c of a.commands) {
    const start = rules.length;
    const parameterName = identifier(c.command + 'Params', 'derived params record name');
    const ruleClassName = identifier(c.command + 'Rule', 'derived rule class name');
    rules += '  final class ' + ruleClassName + '(hosts: ' + name + 'Computations)\n' +
      '      extends InvariantRule[Event, State, ' + parameterName + '] {\n' +
      '    override def apply(state: State, p: ' + parameterName + '): Either[iMadzError, List[Event]] = {\n';
    const guards = [];
    for (const g of c.guards) {
      const guardStart = rules.length;
      const codeLit = JSON.stringify(g.outcome.code);
      rules += '      if (' + renderGuardCondition(g.text) + ') return ' +
        (g.outcome.kind === 'reject' ? 'Left(iMadzError(' + codeLit + ', ' + codeLit + '))' : 'Right(Nil)') + '\n';
      guards.push({ source: g.source, span: { start: guardStart, end: rules.length } });
    }
    const eventsExpr = c.events
      .map(e => symbol(e.name) + '(' + e.slots.map(s => renderExpr(s.producer)).join(', ') + ')')
      .join(', ');
    rules += '      Right(List(' + eventsExpr + '))\n    }\n  }\n';
    const scope = { start, end: rules.length };
    ruleMappings.push({ source: c.source, span: scope, scope }, ...guards.map(m => ({ ...m, scope })));
  }
  rules += '}\n';

  const allParams = a.commands.flatMap(c => c.parameters);
  const importValues = allParams.some(r => usesOwnValues(r.valueType, a.context));
  const paramDeps = [...new Set(allParams.flatMap(r => valueDeps(r.valueType, pkgByContext)))];
  let params = 'package ' + pkg + '.domain.invariants.params\n\n' +
    (importValues ? 'import ' + pkg + '.domain.values._\n\n' : '') +
    'object ' + name + 'RuleParams {\n';
  for (const c of a.commands) {
    const parameterName = identifier(c.command + 'Params', 'derived params record name');
    params += renderParamCaseClass(parameterName, c.parameters, pkgByContext, a.context) + '\n';
  }
  params += '}\n';

  const coreSources = [a.source, ...a.commands.flatMap(c => [c.source, ...c.guards.map(g => g.source)])];
  return [
    {
      path: corePath, content: rules, kind: 'rules', sources: coreSources,
      deps: [entityPath, computationsPath, paramsPath],
      codeMappings: ruleMappings.map(m => mapping(rules, m)),
    },
    {
      path: paramsPath, content: params, kind: 'rules', sources: aggregateSources,
      deps: paramDeps, codeMappings: [],
    },
  ];
}

/** Full provenance surface of the contract: one pair per aggregate, in order. */
export function renderInvariantRuleFiles(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  const pkgByContext = new Map(input.packages.map(p => [p.context, p.package]));
  return input.aggregates.flatMap(a => renderAggregateRules(a, pkgByContext));
}

const renderAll = input => Object.fromEntries(renderInvariantRuleFiles(input).map(f => [f.path, f.content]));

// ---------- embedded negatives battery (fail-closed input validation) ----------
export function runNegatives(input) {
  const cases = [];
  const mutate = (name, fn) => {
    const broken = JSON.parse(JSON.stringify(input));
    fn(broken);
    cases.push({ name, broken });
  };
  mutate('wrong schemaVersion', x => { x.schemaVersion = 'truthsrc.aggregate-invariant-rules-input/v2'; });
  mutate('empty packages', x => { x.packages = []; });
  mutate('empty aggregates', x => { x.aggregates = []; });
  mutate('unsafe aggregate identifier', x => { x.aggregates[0].aggregate = 'Bank Cash'; });
  mutate('uppercase package segment', x => { x.aggregates[0].package = 'example.BankWealth'; });
  mutate('name disagrees with identifier rule', x => { x.aggregates[0].name = '1CreditBalance'; });
  mutate('aggregate source without pointer', x => { x.aggregates[0].source = { document: 'bank-v1' }; });
  mutate('command source without document', x => { x.aggregates[0].commands[0].source = { pointer: '/aggregates/0/commands/0' }; });
  mutate('empty guard text', x => { x.aggregates[0].commands[0].guards[0].text = ''; });
  mutate('guard source with non-slash pointer', x => { x.aggregates[0].commands[0].guards[0].source = { document: 'bank-v1', pointer: 'aggregates/0' }; });
  mutate('unknown outcome kind', x => { x.aggregates[0].commands[0].guards[0].outcome = { kind: 'retry' }; });
  mutate('reject outcome without code', x => { x.aggregates[0].commands[0].guards[0].outcome = { kind: 'reject' }; });
  mutate('commands not an array', x => { x.aggregates[0].commands = null; });
  mutate('empty command events', x => { x.aggregates[0].commands[0].events = []; });
  mutate('duplicate command parameter', x => { x.aggregates[0].commands[0].parameters.push(JSON.parse(JSON.stringify(x.aggregates[0].commands[0].parameters[0]))); });
  let rejected = 0;
  const failures = [];
  for (const { name, broken } of cases) {
    try {
      renderInvariantRuleFiles(broken);
      failures.push(name);
    } catch (error) {
      if (error.code !== 'RULES_INPUT') failures.push(name + ' (wrong code: ' + error.code + ')');
      else rejected += 1;
    }
  }
  return { expected: cases.length, rejected, failures };
}

// ---------- unified-emitter family registration (emitter-unification Phase 3) ----------
export const family = {
  id: 'aggregate-invariant-rules',
  familyNumber: 45,
  inputSchema: SCHEMA,
  goldenRoot: 'test/reference/curated/aggregate-invariant-rules/v1',
  fixtureDir: 'test/fixtures/aggregate-invariant-rules-v1',
  toolsRef: null,
  provenance: 'handwritten-golden',
  checkInput,
  renderAll,
  runNegatives,
};
