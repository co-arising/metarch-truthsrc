// domain-entity emitter (family #2): renders the per-aggregate State case class
// (`<pkg>.domain.<Name>State`) and Entity companion object
// (`<pkg>.domain.entities.<Name>Entity`) from the derived
// truthsrc.domain-entity-input/v1 contract.
//
// Golden provenance: handwritten-golden (rulings 2026-11-23,
// docs/emitter-unification-host-family-rulings.md §17, Q1–Q5). Against classic
// production the curated style makes exactly one deviation — no generated-file
// header (L1, face-family and value-object house style). Cross-package
// references retain fully qualified paths (strict N1, zero shadowing risk,
// 100% ABI-transparent); one-line case-class and `def empty` layouts (L2,
// preserving the exact single-line codeMappings anchor span on Entity.empty)
// and `java.lang.Long.parseLong(...)` integer literals are preserved.
//
// The module embeds zero business bytes: every aggregate name, field, type
// tree, typed default literal AST, event name and source pointer is contract
// data.
import { parseStrictJson } from '../../lib/strict-json.mjs';
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const SCHEMA = 'truthsrc.domain-entity-input/v1';
const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);
const PRIMITIVES = new Map([['string', 'String'], ['integer', 'Long'], ['boolean', 'Boolean'], ['decimal', 'BigDecimal']]);

const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('DE_INPUT', what + ' must be nonempty text');
  return value;
};
const identifier = (value, what) => {
  text(value, what);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) fail('DE_INPUT', what + ' must be a safe Scala identifier');
  return value;
};
const symbol = name => KEYWORDS.has(name) ? '`' + name + '`' : name;
const knowledgeOf = source => 'source:' + source.document + '#' + source.pointer;

function checkSource(source, what) {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    fail('DE_INPUT', what + ' must carry a {document, pointer} knowledge source');
}

function checkTypeTree(type, what, packages) {
  if (!type || typeof type !== 'object' || Array.isArray(type)) fail('DE_INPUT', what + ' must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVES.has(type.name)) fail('DE_INPUT', what + ' has unsupported primitive name: ' + JSON.stringify(type.name));
    return;
  }
  if (type.form === 'nominal') {
    text(type.context, what + ' nominal context');
    identifier(type.name, what + ' nominal name');
    if (!packages.some(p => p.context === type.context)) fail('DE_INPUT', what + ' nominal context ' + type.context + ' has no package binding');
    return;
  }
  if (type.form === 'optional' || type.form === 'sequence') {
    checkTypeTree(type.element, what + ' element', packages);
    return;
  }
  if (type.form === 'map') {
    checkTypeTree(type.key, what + ' map key', packages);
    checkTypeTree(type.value, what + ' map value', packages);
    return;
  }
  fail('DE_INPUT', what + ' has unsupported form: ' + JSON.stringify(type.form));
}

function checkLiteral(lit, what, packages) {
  if (!lit || typeof lit !== 'object' || Array.isArray(lit)) fail('DE_INPUT', what + ' must be a literal AST object');
  if (lit.kind === 'string') {
    if (typeof lit.value !== 'string') fail('DE_INPUT', what + ' string literal must carry a string value');
    return;
  }
  if (lit.kind === 'boolean') {
    if (typeof lit.value !== 'boolean') fail('DE_INPUT', what + ' boolean literal must carry a boolean value');
    return;
  }
  if (lit.kind === 'integer') {
    if (typeof lit.value !== 'string' || !/^-?\d+$/u.test(lit.value)) fail('DE_INPUT', what + ' integer literal must carry a digit string');
    return;
  }
  if (lit.kind === 'decimal') {
    if (typeof lit.value !== 'string' || !/^-?\d+(?:\.\d+)?$/u.test(lit.value)) fail('DE_INPUT', what + ' decimal literal must carry a numeric string');
    return;
  }
  if (lit.kind === 'nominal-wrapper') {
    text(lit.context, what + ' nominal context');
    identifier(lit.name, what + ' nominal name');
    if (!packages.some(p => p.context === lit.context)) fail('DE_INPUT', what + ' nominal context ' + lit.context + ' has no package binding');
    checkLiteral(lit.inner, what + '.inner', packages);
    return;
  }
  if (lit.kind === 'nominal-exact-decimal') {
    text(lit.context, what + ' nominal context');
    identifier(lit.name, what + ' nominal name');
    if (!packages.some(p => p.context === lit.context)) fail('DE_INPUT', what + ' nominal context ' + lit.context + ' has no package binding');
    if (typeof lit.amount !== 'string' || !/^-?\d+(?:\.\d+)?$/u.test(lit.amount)) fail('DE_INPUT', what + ' exact decimal amount must be numeric string');
    return;
  }
  if (lit.kind === 'nominal-exact-unit-decimal') {
    text(lit.context, what + ' nominal context');
    identifier(lit.name, what + ' nominal name');
    if (!packages.some(p => p.context === lit.context)) fail('DE_INPUT', what + ' nominal context ' + lit.context + ' has no package binding');
    if (typeof lit.amount !== 'string' || !/^-?\d+(?:\.\d+)?$/u.test(lit.amount)) fail('DE_INPUT', what + ' exact unit-decimal amount must be numeric string');
    text(lit.unit, what + ' exact unit-decimal unit');
    return;
  }
  if (lit.kind === 'nominal-record') {
    text(lit.context, what + ' nominal context');
    identifier(lit.name, what + ' nominal name');
    if (!packages.some(p => p.context === lit.context)) fail('DE_INPUT', what + ' nominal context ' + lit.context + ' has no package binding');
    if (!Array.isArray(lit.args) || lit.args.length === 0) fail('DE_INPUT', what + ' nominal record args must be nonempty array');
    for (const [i, arg] of lit.args.entries()) checkLiteral(arg, what + '.args[' + i + ']', packages);
    return;
  }
  if (lit.kind === 'optional') {
    if (typeof lit.present !== 'boolean') fail('DE_INPUT', what + ' optional literal must carry boolean present');
    if (lit.present) checkLiteral(lit.value, what + '.value', packages);
    return;
  }
  if (lit.kind === 'sequence') {
    if (!Array.isArray(lit.elements)) fail('DE_INPUT', what + ' sequence literal must carry elements array');
    for (const [i, el] of lit.elements.entries()) checkLiteral(el, what + '.elements[' + i + ']', packages);
    return;
  }
  if (lit.kind === 'map') {
    if (!Array.isArray(lit.entries)) fail('DE_INPUT', what + ' map literal must carry entries array');
    for (const [i, entry] of lit.entries.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('DE_INPUT', what + '.entries[' + i + '] must be an object');
      checkLiteral(entry.key, what + '.entries[' + i + '].key', packages);
      checkLiteral(entry.value, what + '.entries[' + i + '].value', packages);
    }
    return;
  }
  fail('DE_INPUT', what + ' has unsupported literal kind: ' + JSON.stringify(lit.kind));
}

function checkInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('DE_INPUT', 'input must be an object');
  if (input.schemaVersion !== SCHEMA) fail('DE_INPUT', 'unsupported schemaVersion: ' + JSON.stringify(input.schemaVersion));
  if (!Array.isArray(input.packages) || input.packages.length === 0) fail('DE_INPUT', 'packages must be a nonempty array');
  const boundContexts = new Set();
  for (const [i, binding] of input.packages.entries()) {
    const bt = what => 'packages[' + i + '] ' + what;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) fail('DE_INPUT', bt('must be an object'));
    const context = text(binding.context, bt('context'));
    if (boundContexts.has(context)) fail('DE_INPUT', bt('context ' + context + ' is bound twice'));
    boundContexts.add(context);
    const pkg = text(binding.package, bt('package'));
    if (!pkg.split('.').every(p => /^[a-z][a-z0-9_]*$/u.test(p) && !KEYWORDS.has(p)))
      fail('DE_INPUT', bt('package must be a dotted lowercase-root Scala package'));
  }
  if (!Array.isArray(input.aggregates) || input.aggregates.length === 0) fail('DE_INPUT', 'aggregates must be a nonempty array');
  const seenAggs = new Set();
  for (const [i, agg] of input.aggregates.entries()) {
    const at = what => 'aggregates[' + i + '] ' + what;
    if (!agg || typeof agg !== 'object' || Array.isArray(agg)) fail('DE_INPUT', at('must be an object'));
    const context = text(agg.context, at('context'));
    if (!boundContexts.has(context)) fail('DE_INPUT', at('context ' + context + ' has no package binding'));
    const name = identifier(agg.name, at('name'));
    const aggKey = context + '/' + name;
    if (seenAggs.has(aggKey)) fail('DE_INPUT', at('aggregate ' + name + ' is declared twice in context ' + context));
    seenAggs.add(aggKey);
    checkSource(agg.source, at('source'));
    if (!Array.isArray(agg.fields) || agg.fields.length === 0) fail('DE_INPUT', at('fields must be a nonempty array'));
    const seenFields = new Set();
    for (const [j, field] of agg.fields.entries()) {
      const ft = what => at('fields[' + j + '] ' + what);
      if (!field || typeof field !== 'object' || Array.isArray(field)) fail('DE_INPUT', ft('must be an object'));
      const fname = identifier(field.name, ft('name'));
      if (seenFields.has(fname)) fail('DE_INPUT', ft('field ' + fname + ' is declared twice'));
      seenFields.add(fname);
      checkTypeTree(field.type, ft('type'), input.packages);
      checkLiteral(field.default, ft('default'), input.packages);
      checkSource(field.source, ft('source'));
    }
    if (!Array.isArray(agg.events)) fail('DE_INPUT', at('events must be an array'));
    const seenEvents = new Set();
    for (const [j, event] of agg.events.entries()) {
      const et = what => at('events[' + j + '] ' + what);
      if (!event || typeof event !== 'object' || Array.isArray(event)) fail('DE_INPUT', et('must be an object'));
      const ename = identifier(event.name, et('name'));
      if (seenEvents.has(ename)) fail('DE_INPUT', et('event ' + ename + ' is declared twice'));
      seenEvents.add(ename);
      checkSource(event.source, et('source'));
    }
  }
}

const packageOf = (context, packages) => packages.find(p => p.context === context).package;
const pathOf = (pkg, rel) => {
  const slash = rel.lastIndexOf('/');
  return scalaSubpackagePath(pkg, rel.slice(0, slash).replaceAll('/', '.'), rel.slice(slash + 1));
};

const scalaType = (type, ownContext, packages) => {
  if (type.form === 'primitive') return PRIMITIVES.get(type.name);
  if (type.form === 'nominal') {
    if (type.context === ownContext) return symbol(type.name);
    return packageOf(type.context, packages) + '.domain.values.' + symbol(type.name);
  }
  if (type.form === 'optional') return 'Option[' + scalaType(type.element, ownContext, packages) + ']';
  if (type.form === 'sequence') return 'Vector[' + scalaType(type.element, ownContext, packages) + ']';
  return 'Map[' + scalaType(type.key, ownContext, packages) + ', ' + scalaType(type.value, ownContext, packages) + ']';
};

const usesOwnValues = (type, ownContext) => {
  if (type.form === 'nominal') return type.context === ownContext;
  if (type.form === 'optional' || type.form === 'sequence') return usesOwnValues(type.element, ownContext);
  if (type.form === 'map') return usesOwnValues(type.key, ownContext) || usesOwnValues(type.value, ownContext);
  return false;
};

const literalUsesOwnValues = (lit, ownContext) => {
  if (lit.kind === 'nominal-wrapper') return lit.context === ownContext || literalUsesOwnValues(lit.inner, ownContext);
  if (lit.kind === 'nominal-exact-decimal' || lit.kind === 'nominal-exact-unit-decimal') return lit.context === ownContext;
  if (lit.kind === 'nominal-record') return lit.context === ownContext || lit.args.some(a => literalUsesOwnValues(a, ownContext));
  if (lit.kind === 'optional') return lit.present && literalUsesOwnValues(lit.value, ownContext);
  if (lit.kind === 'sequence') return lit.elements.some(e => literalUsesOwnValues(e, ownContext));
  if (lit.kind === 'map') return lit.entries.some(e => literalUsesOwnValues(e.key, ownContext) || literalUsesOwnValues(e.value, ownContext));
  return false;
};

const valueDeps = (type, packages) => {
  if (type.form === 'nominal') return [pathOf(packageOf(type.context, packages), 'domain/values/' + type.name + '.scala')];
  if (type.form === 'optional' || type.form === 'sequence') return valueDeps(type.element, packages);
  if (type.form === 'map') return [...valueDeps(type.key, packages), ...valueDeps(type.value, packages)];
  return [];
};

const renderNominalRef = (context, name, ownContext, packages) =>
  context === ownContext ? symbol(name) : packageOf(context, packages) + '.domain.values.' + symbol(name);

const renderLiteral = (lit, ownContext, packages) => {
  if (lit.kind === 'string') return JSON.stringify(lit.value);
  if (lit.kind === 'boolean') return String(lit.value);
  if (lit.kind === 'integer') return lit.value + 'L';
  if (lit.kind === 'decimal') return 'BigDecimal(' + JSON.stringify(lit.value) + ')';
  if (lit.kind === 'nominal-wrapper')
    return renderNominalRef(lit.context, lit.name, ownContext, packages) + '(' + renderLiteral(lit.inner, ownContext, packages) + ')';
  if (lit.kind === 'nominal-exact-decimal')
    return renderNominalRef(lit.context, lit.name, ownContext, packages) + '(BigDecimal(' + JSON.stringify(lit.amount) + '))';
  if (lit.kind === 'nominal-exact-unit-decimal')
    return renderNominalRef(lit.context, lit.name, ownContext, packages) + '(BigDecimal(' + JSON.stringify(lit.amount) + '), ' + JSON.stringify(lit.unit) + ')';
  if (lit.kind === 'nominal-record')
    return renderNominalRef(lit.context, lit.name, ownContext, packages) + '(' + lit.args.map(a => renderLiteral(a, ownContext, packages)).join(', ') + ')';
  if (lit.kind === 'optional') return lit.present ? 'Some(' + renderLiteral(lit.value, ownContext, packages) + ')' : 'None';
  if (lit.kind === 'sequence') return 'Vector(' + lit.elements.map(e => renderLiteral(e, ownContext, packages)).join(', ') + ')';
  return 'Map(' + lit.entries.map(e => renderLiteral(e.key, ownContext, packages) + ' -> ' + renderLiteral(e.value, ownContext, packages)).join(', ') + ')';
};

function renderAggregatePair(agg, packages) {
  const pkg = packageOf(agg.context, packages);
  const name = symbol(agg.name);
  const entityPath = pathOf(pkg, 'domain/entities/' + agg.name + 'Entity.scala');
  const eventsPath = pathOf(pkg, 'domain/events/' + agg.name + 'Events.scala');

  const paramList = agg.fields.map(f => symbol(f.name) + ': ' + scalaType(f.type, agg.context, packages));
  const namedInitials = agg.fields.map(f => symbol(f.name) + ' = ' + renderLiteral(f.default, agg.context, packages));
  const deps = [...new Set(agg.fields.flatMap(f => valueDeps(f.type, packages)))];
  const stateSources = [agg.source, ...agg.fields.map(f => f.source)];

  const importValues =
    agg.fields.some(f => usesOwnValues(f.type, agg.context)) ||
    agg.fields.some(f => literalUsesOwnValues(f.default, agg.context));
  const oneLineState = '  final case class State(' + paramList.join(', ') + ')';
  const stateDecl = paramList.length > 4 || oneLineState.length > 100
    ? '  final case class State(\n    ' + paramList.join(',\n    ') + '\n  )'
    : oneLineState;

  let entityContent = 'package ' + pkg + '.domain.entities\n\n' +
    (importValues ? 'import ' + pkg + '.domain.values._\n\n' : '') +
    'object ' + name + 'Entity {\n' +
    stateDecl + '\n\n' +
    '  type Event = ' + pkg + '.domain.events.' + name + 'Events.Event\n' +
    '  val Events: ' + pkg + '.domain.events.' + name + 'Events.type = ' + pkg + '.domain.events.' + name + 'Events\n\n';
  const startChar = entityContent.length;
  entityContent += '  def empty: State = State(\n    ' + namedInitials.join(',\n    ') + '\n  )\n';
  const endChar = entityContent.length;
  entityContent += '}\n';

  const startBytes = Buffer.byteLength(entityContent.slice(0, startChar));
  const endBytes = Buffer.byteLength(entityContent.slice(0, endChar));
  const span = { start: startBytes, end: endBytes, text: entityContent.slice(startChar, endChar) };

  const entityFile = {
    path: entityPath,
    content: entityContent,
    kind: 'entity',
    sources: [...stateSources, ...agg.events.map(e => e.source)],
    deps: [eventsPath, ...deps],
    codeMappings: [{ knowledgeKey: knowledgeOf(agg.source), span, scope: { ...span } }],
  };
  return [entityFile];
}

/** Full provenance surface of the contract: [State, Entity] per aggregate, in order. */
export function renderDomainEntityFiles(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  return input.aggregates.flatMap(agg => renderAggregatePair(agg, input.packages));
}

const renderAll = input => Object.fromEntries(renderDomainEntityFiles(input).map(f => [f.path, f.content]));

// ---------- embedded negatives battery (fail-closed input validation) ----------
export function runNegatives(input) {
  const cases = [];
  const mutate = (name, fn) => {
    const broken = JSON.parse(JSON.stringify(input));
    fn(broken);
    cases.push({ name, broken });
  };
  mutate('wrong schemaVersion', x => { x.schemaVersion = 'truthsrc.domain-entity-input/v2'; });
  mutate('empty packages', x => { x.packages = []; });
  mutate('package bound twice', x => { x.packages.push({ context: 'bankwealth', package: 'example.bankwealth' }); });
  mutate('uppercase package segment', x => { x.packages[0].package = 'example.BankWealth'; });
  mutate('keyword package segment', x => { x.packages[0].package = 'example.match'; });
  mutate('empty aggregates', x => { x.aggregates = []; });
  mutate('aggregate context without package binding', x => { x.aggregates[0].context = 'other'; });
  mutate('duplicate aggregate declaration', x => { x.aggregates.push(JSON.parse(JSON.stringify(x.aggregates[0]))); });
  mutate('unsafe aggregate identifier', x => { x.aggregates[0].name = 'Credit Balance'; });
  mutate('aggregate source without pointer', x => { x.aggregates[0].source = { document: 'bank-v1' }; });
  mutate('aggregate source with non-slash pointer', x => { x.aggregates[0].source.pointer = 'aggregates/0'; });
  mutate('empty fields array', x => { x.aggregates[0].fields = []; });
  mutate('duplicate field name', x => { x.aggregates[0].fields.push(JSON.parse(JSON.stringify(x.aggregates[0].fields[0]))); });
  mutate('unsupported primitive field type', x => { x.aggregates[0].fields[0].type = { form: 'primitive', name: 'float' }; });
  mutate('nominal field type without package binding', x => { x.aggregates[0].fields[0].type = { form: 'nominal', context: 'unbound', name: 'X' }; });
  mutate('unsupported literal kind', x => { x.aggregates[0].fields[0].default = { kind: 'raw-scala', value: 'foo' }; });
  mutate('non-digit integer literal', x => { x.aggregates[0].fields[0].default = { kind: 'integer', value: '12x' }; });
  mutate('nominal literal without package binding', x => { x.aggregates[0].fields[0].default = { kind: 'nominal-wrapper', context: 'unbound', name: 'X', inner: { kind: 'string', value: '' } }; });
  mutate('empty nominal record args', x => { x.aggregates[0].fields[0].default = { kind: 'nominal-record', context: 'bankwealth', name: 'FundShare', args: [] }; });
  mutate('duplicate event name', x => { x.aggregates[0].events.push(JSON.parse(JSON.stringify(x.aggregates[0].events[0]))); });
  mutate('unsafe event identifier', x => { x.aggregates[0].events[0].name = 'Bad Event'; });

  let rejected = 0;
  const failures = [];
  for (const { name, broken } of cases) {
    try {
      renderDomainEntityFiles(broken);
      failures.push(name);
    } catch (error) {
      if (error.code !== 'DE_INPUT') failures.push(name + ' (wrong code: ' + error.code + ')');
      else rejected += 1;
    }
  }
  return { expected: cases.length, rejected, failures };
}

// ---------- unified-emitter family registration (emitter-unification Phase 3) ----------
export const family = {
  id: 'domain-entity',
  familyNumber: 2,
  inputSchema: SCHEMA,
  goldenRoot: 'test/reference/curated/domain-entity/v1',
  fixtureDir: 'test/fixtures/domain-entity-v1',
  toolsRef: null,
  provenance: 'handwritten-golden',
  checkInput,
  renderAll,
  runNegatives,
};
