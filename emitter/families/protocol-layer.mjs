// protocol-layer emitter (family #7, covering #7/10): renders the three
// protocol and command-emission files per aggregate from the derived
// truthsrc.protocol-layer-input/v1 contract:
//   1. `<pkg>.domain.<Name>Protocol` — Command/Event sealed traits & case classes (kind: protocol)
//   2. `<pkg>.domain.<Name>CommandHelpers` — Computations trait/companion & emit* helpers (kind: command-helpers)
//   3. `<pkg>.application.aggregates.<Name>Protocol` — application protocol type/val aliases (kind: application-protocol)
//
// Golden provenance: handwritten-golden (rulings 2026-11-23,
// docs/emitter-unification-host-family-rulings.md §19, Q1–Q6). Against classic
// production the curated style makes exactly one deviation — no generated-file
// header (L1, face-family, value-object, domain-entity and aggregate-layer
// house style). All public Scala ABI names (including backtick-escaped keywords
// such as `` `sealed` ``, 11 `Ingest<id>` type/val aliases, and
// `ExternalAuthority`) and strict N1 cross-package FQNs are preserved so
// handwritten bindings and unflipped siblings compile with zero F7 edits.
//
// The module embeds zero business bytes: every aggregate name, command, event,
// host, slot expression, external producer id and source pointer is contract data.
import { parseStrictJson } from '../../lib/strict-json.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const SCHEMA = 'truthsrc.protocol-layer-input/v1';
const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);
const PRIMITIVES = new Map([['string', 'String'], ['integer', 'Long'], ['boolean', 'Boolean'], ['decimal', 'BigDecimal']]);
const REF_SCOPES = new Set(['parameter', 'state-field', 'event-slot']);

const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('PL_INPUT', what + ' must be nonempty text');
  return value;
};
const identifier = (value, what) => {
  text(value, what);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) fail('PL_INPUT', what + ' must be a safe Scala identifier');
  return value;
};
const producerId = (value, what) => {
  text(value, what);
  if (!/^[a-z][a-z0-9_-]*$/u.test(value)) fail('PL_INPUT', what + ' must be a lowercase kebab/snake producer id');
  return value;
};
const symbol = name => KEYWORDS.has(name) ? '`' + name + '`' : name;
const toPascal = id => id.split(/[-_]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
const ingressAlias = id => 'Ingest' + toPascal(id);

function checkSource(source, what) {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    fail('PL_INPUT', what + ' must carry a {document, pointer} knowledge source');
}

function checkTypeTree(type, what, packages) {
  if (!type || typeof type !== 'object' || Array.isArray(type)) fail('PL_INPUT', what + ' must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVES.has(type.name)) fail('PL_INPUT', what + ' has unsupported primitive name: ' + JSON.stringify(type.name));
    return;
  }
  if (type.form === 'nominal') {
    text(type.context, what + ' nominal context');
    identifier(type.name, what + ' nominal name');
    if (!packages.some(p => p.context === type.context)) fail('PL_INPUT', what + ' nominal context ' + type.context + ' has no package binding');
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
  fail('PL_INPUT', what + ' has unsupported form: ' + JSON.stringify(type.form));
}

function checkLiteralValue(value, type, what) {
  if (type.form === 'primitive') {
    if (type.name === 'string' && typeof value !== 'string') fail('PL_INPUT', what + ' string literal must be string');
    if (type.name === 'boolean' && typeof value !== 'boolean') fail('PL_INPUT', what + ' boolean literal must be boolean');
    if ((type.name === 'integer' || type.name === 'decimal') && typeof value !== 'string') fail('PL_INPUT', what + ' numeric literal must be decimal/integer string');
    return;
  }
  if (type.form === 'optional') {
    if (!value || typeof value !== 'object' || typeof value.present !== 'boolean') fail('PL_INPUT', what + ' optional literal must carry boolean present');
    if (value.present) checkLiteralValue(value.value, type.element, what + '.value');
    return;
  }
  if (type.form === 'sequence') {
    if (!Array.isArray(value)) fail('PL_INPUT', what + ' sequence literal must be array');
    for (const [i, item] of value.entries()) checkLiteralValue(item, type.element, what + '[' + i + ']');
    return;
  }
  if (type.form === 'map') {
    if (!Array.isArray(value)) fail('PL_INPUT', what + ' map literal must be array of {key, value}');
    for (const [i, row] of value.entries()) {
      if (!row || typeof row !== 'object') fail('PL_INPUT', what + '[' + i + '] must be an object');
      checkLiteralValue(row.key, type.key, what + '[' + i + '].key');
      checkLiteralValue(row.value, type.value, what + '[' + i + '].value');
    }
    return;
  }
  fail('PL_INPUT', what + ' unsupported literal type form: ' + JSON.stringify(type.form));
}

function checkExpr(expr, what, packages, hostNames) {
  if (!expr || typeof expr !== 'object' || Array.isArray(expr)) fail('PL_INPUT', what + ' must be an expression object');
  if (expr.op === 'ref') {
    if (!REF_SCOPES.has(expr.scope)) fail('PL_INPUT', what + ' ref has unsupported scope: ' + JSON.stringify(expr.scope));
    identifier(expr.name, what + ' ref name');
    return;
  }
  if (expr.op === 'literal') {
    checkTypeTree(expr.valueType, what + ' literal valueType', packages);
    checkLiteralValue(expr.value, expr.valueType, what + ' literal value');
    return;
  }
  if (expr.op === 'host') {
    const name = identifier(expr.name, what + ' host name');
    if (!hostNames.has(name)) fail('PL_INPUT', what + ' references undeclared host ' + name);
    return;
  }
  if (expr.op === 'member') {
    checkExpr(expr.argument, what + ' member argument', packages, hostNames);
    identifier(expr.member, what + ' member name');
    return;
  }
  if (expr.op === 'map-get') {
    checkExpr(expr.map, what + ' map-get map', packages, hostNames);
    checkExpr(expr.key, what + ' map-get key', packages, hostNames);
    return;
  }
  if (expr.op === 'add' || expr.op === 'subtract') {
    if (expr.arithmetic !== 'primitive' && expr.arithmetic !== 'nominal')
      fail('PL_INPUT', what + ' arithmetic must be primitive or nominal');
    checkExpr(expr.left, what + ' left', packages, hostNames);
    checkExpr(expr.right, what + ' right', packages, hostNames);
    return;
  }
  fail('PL_INPUT', what + ' unsupported expression op: ' + JSON.stringify(expr.op));
}

function checkInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('PL_INPUT', 'input must be an object');
  if (input.schemaVersion !== SCHEMA) fail('PL_INPUT', 'unsupported schemaVersion: ' + JSON.stringify(input.schemaVersion));
  if (!Array.isArray(input.packages) || input.packages.length === 0) fail('PL_INPUT', 'packages must be a nonempty array');
  const boundContexts = new Set();
  for (const [i, binding] of input.packages.entries()) {
    const bt = what => 'packages[' + i + '] ' + what;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) fail('PL_INPUT', bt('must be an object'));
    const context = text(binding.context, bt('context'));
    if (boundContexts.has(context)) fail('PL_INPUT', bt('context ' + context + ' is bound twice'));
    boundContexts.add(context);
    const pkg = text(binding.package, bt('package'));
    if (!pkg.split('.').every(p => /^[a-z][a-z0-9_]*$/u.test(p) && !KEYWORDS.has(p)))
      fail('PL_INPUT', bt('package must be a dotted lowercase-root Scala package'));
  }
  if (!Array.isArray(input.aggregates) || input.aggregates.length === 0) fail('PL_INPUT', 'aggregates must be a nonempty array');
  const seenAggs = new Set();
  for (const [i, agg] of input.aggregates.entries()) {
    const at = what => 'aggregates[' + i + '] ' + what;
    if (!agg || typeof agg !== 'object' || Array.isArray(agg)) fail('PL_INPUT', at('must be an object'));
    const context = text(agg.context, at('context'));
    if (!boundContexts.has(context)) fail('PL_INPUT', at('context ' + context + ' has no package binding'));
    const name = identifier(agg.name, at('name'));
    const aggKey = context + '/' + name;
    if (seenAggs.has(aggKey)) fail('PL_INPUT', at('aggregate ' + name + ' is declared twice in context ' + context));
    seenAggs.add(aggKey);
    checkSource(agg.source, at('source'));

    if (!Array.isArray(agg.events) || agg.events.length === 0) fail('PL_INPUT', at('events must be a nonempty array'));
    const seenEvents = new Set();
    for (const [j, ev] of agg.events.entries()) {
      const et = what => at('events[' + j + '] ' + what);
      if (!ev || typeof ev !== 'object' || Array.isArray(ev)) fail('PL_INPUT', et('must be an object'));
      const ename = identifier(ev.name, et('name'));
      if (seenEvents.has(ename)) fail('PL_INPUT', et('event ' + ename + ' is declared twice'));
      seenEvents.add(ename);
      checkSource(ev.source, et('source'));
      if (!Array.isArray(ev.slots)) fail('PL_INPUT', et('slots must be an array'));
      const seenSlots = new Set();
      for (const [k, slot] of ev.slots.entries()) {
        const st = what => et('slots[' + k + '] ' + what);
        if (!slot || typeof slot !== 'object' || Array.isArray(slot)) fail('PL_INPUT', st('must be an object'));
        const sname = identifier(slot.name, st('name'));
        if (seenSlots.has(sname)) fail('PL_INPUT', st('slot ' + sname + ' is declared twice'));
        seenSlots.add(sname);
        checkTypeTree(slot.valueType, st('valueType'), input.packages);
      }
    }

    if (!Array.isArray(agg.commands) || agg.commands.length === 0) fail('PL_INPUT', at('commands must be a nonempty array'));
    const seenCmds = new Set();
    for (const [j, cmd] of agg.commands.entries()) {
      const ct = what => at('commands[' + j + '] ' + what);
      if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd)) fail('PL_INPUT', ct('must be an object'));
      const cname = identifier(cmd.name, ct('name'));
      if (seenCmds.has(cname)) fail('PL_INPUT', ct('command ' + cname + ' is declared twice'));
      seenCmds.add(cname);
      checkSource(cmd.source, ct('source'));
      if (!Array.isArray(cmd.parameters)) fail('PL_INPUT', ct('parameters must be an array'));
      const seenParams = new Set();
      for (const [k, param] of cmd.parameters.entries()) {
        const pt = what => ct('parameters[' + k + '] ' + what);
        if (!param || typeof param !== 'object' || Array.isArray(param)) fail('PL_INPUT', pt('must be an object'));
        const pname = identifier(param.name, pt('name'));
        if (seenParams.has(pname)) fail('PL_INPUT', pt('parameter ' + pname + ' is declared twice'));
        seenParams.add(pname);
        checkTypeTree(param.valueType, pt('valueType'), input.packages);
      }
    }

    if (!Array.isArray(agg.hosts)) fail('PL_INPUT', at('hosts must be an array'));
    const seenHosts = new Set();
    for (const [j, host] of agg.hosts.entries()) {
      const ht = what => at('hosts[' + j + '] ' + what);
      if (!host || typeof host !== 'object' || Array.isArray(host)) fail('PL_INPUT', ht('must be an object'));
      const hname = identifier(host.name, ht('name'));
      if (seenHosts.has(hname)) fail('PL_INPUT', ht('host ' + hname + ' is declared twice'));
      seenHosts.add(hname);
      const hcmd = identifier(host.command, ht('command'));
      if (!seenCmds.has(hcmd)) fail('PL_INPUT', ht('command ' + hcmd + ' is not declared on aggregate ' + name));
      checkTypeTree(host.outputType, ht('outputType'), input.packages);
      checkSource(host.source, ht('source'));
    }

    for (const [j, cmd] of agg.commands.entries()) {
      const ct = what => at('commands[' + j + '] ' + what);
      if (!Array.isArray(cmd.events) || cmd.events.length === 0) fail('PL_INPUT', ct('events must be a nonempty array'));
      for (const [k, em] of cmd.events.entries()) {
        const emt = what => ct('events[' + k + '] ' + what);
        if (!em || typeof em !== 'object' || Array.isArray(em)) fail('PL_INPUT', emt('must be an object'));
        const ename = identifier(em.name, emt('name'));
        if (!seenEvents.has(ename)) fail('PL_INPUT', emt('event ' + ename + ' is not declared on aggregate ' + name));
        if (!Array.isArray(em.slots)) fail('PL_INPUT', emt('slots must be an array'));
        for (const [s, slot] of em.slots.entries()) {
          if (!slot || typeof slot !== 'object' || Array.isArray(slot)) fail('PL_INPUT', emt('slots[' + s + '] must be an object'));
          checkExpr(slot.producer, emt('slots[' + s + '].producer'), input.packages, seenHosts);
        }
      }
    }

    if (!Array.isArray(agg.externalProducers)) fail('PL_INPUT', at('externalProducers must be an array'));
    const seenProducers = new Set();
    for (const [j, p] of agg.externalProducers.entries()) {
      const pt = what => at('externalProducers[' + j + '] ' + what);
      if (!p || typeof p !== 'object' || Array.isArray(p)) fail('PL_INPUT', pt('must be an object'));
      const id = producerId(p.id, pt('id'));
      if (seenProducers.has(id)) fail('PL_INPUT', pt('producer ' + id + ' is declared twice'));
      seenProducers.add(id);
    }
  }
}

function renderType(type, pkgByContext, ownContext) {
  if (type.form === 'primitive') return PRIMITIVES.get(type.name);
  if (type.form === 'nominal') {
    if (ownContext && type.context === ownContext) return symbol(type.name);
    return pkgByContext.get(type.context) + '.domain.values.' + symbol(type.name);
  }
  if (type.form === 'optional') return 'Option[' + renderType(type.element, pkgByContext, ownContext) + ']';
  if (type.form === 'sequence') return 'Vector[' + renderType(type.element, pkgByContext, ownContext) + ']';
  if (type.form === 'map') return 'Map[' + renderType(type.key, pkgByContext, ownContext) + ', ' + renderType(type.value, pkgByContext, ownContext) + ']';
  fail('PL_INPUT', 'unsupported type form: ' + JSON.stringify(type.form));
}

function usesOwnValues(type, ownContext) {
  if (type.form === 'nominal') return type.context === ownContext;
  if (type.form === 'optional' || type.form === 'sequence') return usesOwnValues(type.element, ownContext);
  if (type.form === 'map') return usesOwnValues(type.key, ownContext) || usesOwnValues(type.value, ownContext);
  return false;
}

function valuesPaths(type, pkgByContext) {
  if (type.form === 'nominal') return ['app/' + pkgByContext.get(type.context).replaceAll('.', '/') + '/domain/values/' + type.name + '.scala'];
  if (type.form === 'optional' || type.form === 'sequence') return valuesPaths(type.element, pkgByContext);
  if (type.form === 'map') return [...valuesPaths(type.key, pkgByContext), ...valuesPaths(type.value, pkgByContext)];
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
  if (type.form === 'map') return 'Map(' + value.map(r => renderLiteral(r.key, type.key) + ' -> ' + renderLiteral(r.value, type.value)).join(', ') + ')';
  fail('PL_INPUT', 'unsupported literal type form: ' + JSON.stringify(type.form));
}

function renderExpr(expr) {
  if (expr.op === 'ref') {
    const prefix = expr.scope === 'state-field' ? 'state.' : expr.scope === 'event-slot' ? 'event.' : 'p.';
    return prefix + symbol(expr.name);
  }
  if (expr.op === 'literal') return renderLiteral(expr.value, expr.valueType);
  if (expr.op === 'host') return 'hosts.' + symbol(expr.name) + '(state, p)';
  if (expr.op === 'member') return '(' + renderExpr(expr.argument) + ').' + symbol(expr.member);
  if (expr.op === 'map-get') return '(' + renderExpr(expr.map) + ').get(' + renderExpr(expr.key) + ')';
  if (expr.op === 'add' || expr.op === 'subtract') {
    const left = renderExpr(expr.left), right = renderExpr(expr.right);
    if (expr.arithmetic === 'primitive') {
      return 'java.lang.Math.' + (expr.op === 'add' ? 'addExact' : 'subtractExact') + '(' + left + ', ' + right + ')';
    }
    return '(' + left + ').' + (expr.op === 'add' ? 'plus' : 'minus') + '(' + right + ')';
  }
  fail('PL_INPUT', 'unsupported expression op: ' + JSON.stringify(expr.op));
}

const renderCaseClass = (className, rows, ext, pkgByContext, ownContext) => {
  const fields = rows.map(r => symbol(r.name) + ': ' + renderType(r.valueType, pkgByContext, ownContext));
  const oneLine = '  final case class ' + symbol(className) + '(' + fields.join(', ') + ') extends ' + ext;
  if (fields.length > 4 || oneLine.length > 110) {
    return '  final case class ' + symbol(className) + '(\n    ' + fields.join(',\n    ') + '\n  ) extends ' + ext;
  }
  return oneLine;
};

function renderDomainProtocol(agg, pkg, pkgPath, pkgByContext) {
  const name = symbol(agg.name);
  const types = [...agg.commands.flatMap(c => c.parameters), ...agg.events.flatMap(e => e.slots)];
  const importValues = types.some(r => usesOwnValues(r.valueType, agg.context));
  const lines = [
    'package ' + pkg + '.domain',
    '',
    ...(importValues ? ['import ' + pkg + '.domain.values._', ''] : []),
    'object ' + name + 'Protocol {',
    '  sealed trait Command',
    '  sealed trait Event',
  ];
  for (const c of agg.commands) {
    lines.push(renderCaseClass(c.name, c.parameters, 'Command', pkgByContext, agg.context));
  }
  for (const e of agg.events) {
    lines.push(renderCaseClass(e.name, e.slots, 'Event', pkgByContext, agg.context));
  }
  lines.push('}');
  return {
    path: 'app/' + pkgPath + '/domain/' + agg.name + 'Protocol.scala',
    kind: 'protocol',
    content: lines.join('\n') + '\n',
    sources: [agg.source, ...agg.commands.map(c => c.source), ...agg.events.map(e => e.source)],
    deps: [...new Set(types.flatMap(r => valuesPaths(r.valueType, pkgByContext)))],
  };
}

function renderCommandHelpers(agg, pkg, pkgPath, pkgByContext) {
  const name = symbol(agg.name);
  const importValues = agg.hosts.some(h => usesOwnValues(h.outputType, agg.context));
  const lines = [
    'package ' + pkg + '.domain',
    '',
    ...(importValues ? ['import ' + pkg + '.domain.values._'] : []),
    'import ' + name + 'Protocol._',
    '',
    'trait ' + name + 'Computations {',
  ];
  for (const h of agg.hosts) {
    lines.push('  def ' + symbol(h.name) + '(state: ' + name + 'State, p: ' + symbol(h.command) + '): ' + renderType(h.outputType, pkgByContext, agg.context));
  }
  lines.push('}');
  lines.push('object ' + name + 'Computations {');
  if (agg.hosts.length === 0) {
    lines.push('  val none: ' + name + 'Computations = new ' + name + 'Computations {}');
  }
  lines.push('}');
  lines.push('object ' + name + 'CommandHelpers {');
  for (const c of agg.commands) {
    const eventsExpr = c.events
      .map(e => symbol(e.name) + '(' + e.slots.map(s => renderExpr(s.producer)).join(', ') + ')')
      .join(', ');
    lines.push('  def emit' + c.name + '(state: ' + name + 'State, p: ' + symbol(c.name) + ', hosts: ' + name + 'Computations): Vector[Event] = Vector(' + eventsExpr + ')');
  }
  lines.push('}');
  return {
    path: 'app/' + pkgPath + '/domain/' + agg.name + 'CommandHelpers.scala',
    kind: 'command-helpers',
    content: lines.join('\n') + '\n',
    sources: [agg.source, ...agg.commands.map(c => c.source), ...agg.hosts.map(h => h.source)],
    deps: [
      'app/' + pkgPath + '/domain/' + agg.name + 'Protocol.scala',
      'app/' + pkgPath + '/domain/' + agg.name + 'State.scala',
    ],
  };
}

function renderApplicationProtocol(agg, pkg, pkgPath) {
  const name = symbol(agg.name);
  const legacy = pkg + '.domain.' + name + 'Aggregate';
  const aliases = ['Execute', 'GetState', 'Accepted', 'Refused', ...agg.externalProducers.map(p => ingressAlias(p.id))];
  const hasAuthority = agg.externalProducers.length > 0;
  let content = `package ${pkg}.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import ${pkg}.domain.entities.${name}Entity.{Event, State}

object ${name}Protocol {

  type Command = ${legacy}.Request
  type Reply = ${legacy}.Reply
  type CommandPayload = ${pkg}.domain.${name}Protocol.Command
  type CommandHandler = (State, Command) => Effect[Event, State]
`;
  for (const id of aliases) {
    content += `
  type ${id} = ${legacy}.${id}
  val ${id}: ${legacy}.${id}.type =
    ${legacy}.${id}
`;
  }
  if (hasAuthority) {
    content += `\n  type ExternalAuthority = ${legacy}.ExternalAuthority\n`;
  }
  content += '}\n';
  return {
    path: 'app/' + pkgPath + '/application/aggregates/' + agg.name + 'Protocol.scala',
    kind: 'application-protocol',
    content,
    sources: [agg.source, ...agg.commands.map(c => c.source)],
    deps: [
      'app/' + pkgPath + '/domain/' + agg.name + 'Aggregate.scala',
      'app/' + pkgPath + '/domain/entities/' + agg.name + 'Entity.scala',
    ],
  };
}

export function renderProtocolLayerFiles(input) {
  checkInput(input);
  const pkgByContext = new Map(input.packages.map(p => [p.context, p.package]));
  const files = [];
  for (const agg of input.aggregates) {
    const pkg = pkgByContext.get(agg.context);
    const pkgPath = pkg.replaceAll('.', '/');
    files.push(renderDomainProtocol(agg, pkg, pkgPath, pkgByContext));
    files.push(renderCommandHelpers(agg, pkg, pkgPath, pkgByContext));
    files.push(renderApplicationProtocol(agg, pkg, pkgPath));
  }
  return files;
}

function renderAll(input) {
  return Object.fromEntries(renderProtocolLayerFiles(input).map(f => [f.path, f.content]));
}

function runNegatives(baseInput) {
  const clone = () => JSON.parse(JSON.stringify(baseInput));
  const cases = [
    ['wrong-schema-version', () => { const c = clone(); c.schemaVersion = 'truthsrc.protocol-layer-input/v99'; return c; }],
    ['empty-packages', () => { const c = clone(); c.packages = []; return c; }],
    ['duplicate-package-context', () => { const c = clone(); c.packages.push({ ...c.packages[0] }); return c; }],
    ['invalid-scala-package-segment', () => { const c = clone(); c.packages[0].package = 'example.Object'; return c; }],
    ['keyword-scala-package-segment', () => { const c = clone(); c.packages[0].package = 'example.sealed'; return c; }],
    ['empty-aggregates', () => { const c = clone(); c.aggregates = []; return c; }],
    ['unbound-aggregate-context', () => { const c = clone(); c.aggregates[0].context = 'ghost'; return c; }],
    ['duplicate-aggregate-name', () => { const c = clone(); c.aggregates.push(clone().aggregates[0]); return c; }],
    ['invalid-aggregate-identifier', () => { const c = clone(); c.aggregates[0].name = 'Bad-Agg'; return c; }],
    ['missing-aggregate-source-pointer', () => { const c = clone(); c.aggregates[0].source.pointer = 'no-slash'; return c; }],
    ['empty-commands', () => { const c = clone(); c.aggregates[0].commands = []; return c; }],
    ['duplicate-command-name', () => { const c = clone(); c.aggregates[0].commands.push(clone().aggregates[0].commands[0]); return c; }],
    ['duplicate-command-parameter', () => { const c = clone(); c.aggregates[0].commands[0].parameters.push(clone().aggregates[0].commands[0].parameters[0]); return c; }],
    ['empty-events', () => { const c = clone(); c.aggregates[0].events = []; return c; }],
    ['duplicate-event-name', () => { const c = clone(); c.aggregates[0].events.push(clone().aggregates[0].events[0]); return c; }],
    ['duplicate-event-slot', () => { const c = clone(); c.aggregates[0].events[0].slots.push(clone().aggregates[0].events[0].slots[0]); return c; }],
    ['unsupported-primitive-type', () => { const c = clone(); c.aggregates[0].commands[0].parameters[0].valueType = { form: 'primitive', name: 'float' }; return c; }],
    ['unbound-nominal-type-context', () => { const c = clone(); c.aggregates[0].commands[0].parameters[0].valueType = { form: 'nominal', context: 'missing', name: 'Foo' }; return c; }],
    ['duplicate-host-name', () => { const c = clone(); c.aggregates[0].hosts.push(clone().aggregates[0].hosts[0]); return c; }],
    ['host-referencing-undeclared-command', () => { const c = clone(); c.aggregates[0].hosts[0].command = 'NoSuchCommand'; return c; }],
    ['command-emitting-undeclared-event', () => { const c = clone(); c.aggregates[0].commands[0].events[0].name = 'GhostEvent'; return c; }],
    ['expression-referencing-undeclared-host', () => { const c = clone(); c.aggregates[0].commands[0].events[0].slots[0].producer = { op: 'host', name: 'GhostHost' }; return c; }],
    ['expression-with-unsupported-op', () => { const c = clone(); c.aggregates[0].commands[0].events[0].slots[0].producer = { op: 'divide' }; return c; }],
    ['expression-with-invalid-ref-scope', () => { const c = clone(); c.aggregates[0].commands[0].events[0].slots[0].producer = { op: 'ref', scope: 'global', name: 'x' }; return c; }],
    ['duplicate-external-producer-id', () => { const c = clone(); const fo = c.aggregates.find(a => a.externalProducers.length > 0); fo.externalProducers.push({ ...fo.externalProducers[0] }); return c; }],
    ['invalid-external-producer-id', () => { const c = clone(); const fo = c.aggregates.find(a => a.externalProducers.length > 0); fo.externalProducers[0].id = 'Bad_Producer'; return c; }],
  ];
  const failures = [];
  let rejected = 0;
  for (const [name, build] of cases) {
    try {
      checkInput(build());
      failures.push({ name, reason: 'unexpectedly accepted' });
    } catch (err) {
      if (err?.code === 'PL_INPUT') rejected++;
      else failures.push({ name, reason: 'wrong error code: ' + (err?.code ?? err?.message) });
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'protocol-layer',
  familyNumber: 7,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/protocol-layer/v1',
  fixtureDir: 'test/fixtures/protocol-layer-v1',
  checkInput,
  renderAll,
  runNegatives,
});

export { checkInput, renderAll, runNegatives };
