// aggregate-layer emitter (family #6, covering #6/8/9): renders the four
// layered aggregate files per aggregate from the derived
// truthsrc.aggregate-layer-input/v1 contract:
//   1. `<pkg>.domain.<Name>Aggregate` (+ `<Name>AggregateFactory`) — legacy facade (kind: aggregate)
//   2. `<pkg>.application.aggregates.<Name>Aggregate` — commandHandler facade (kind: aggregate-behavior)
//   3. `<pkg>.application.aggregates.<Name>AggregateFactory` — factory trait (kind: aggregate-factory)
//   4. `<pkg>.application.aggregates.behaviors.<Name>Behaviors` — behavior dispatcher (kind: aggregate-behavior)
//
// Golden provenance: handwritten-golden (rulings 2026-11-23,
// docs/emitter-unification-host-family-rulings.md §18, Q1–Q6). Against classic
// production the curated style makes exactly one deviation — no generated-file
// header (L1, face-family, value-object and domain-entity house style). All
// public Scala ABI names (including `Ingest<id>` external ingress case classes)
// and strict N1 cross-package FQNs are preserved so unflipped protocol/bootstrap
// files and handwritten bindings compile with zero F7 edits. Exact UTF-8 byte
// `codeMappings` spans are preserved on every external producer and command
// dispatch case in Behaviors.scala.
//
// The module embeds zero business bytes: every aggregate name, command,
// external producer, outputType tree and source pointer is contract data.
import { parseStrictJson } from '../../lib/strict-json.mjs';
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const SCHEMA = 'truthsrc.aggregate-layer-input/v1';
const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);
const PRIMITIVES = new Map([['string', 'String'], ['integer', 'Long'], ['boolean', 'Boolean'], ['decimal', 'BigDecimal']]);

const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('AL_INPUT', what + ' must be nonempty text');
  return value;
};
const identifier = (value, what) => {
  text(value, what);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) fail('AL_INPUT', what + ' must be a safe Scala identifier');
  return value;
};
const producerId = (value, what) => {
  text(value, what);
  if (!/^[a-z][a-z0-9_-]*$/u.test(value)) fail('AL_INPUT', what + ' must be a lowercase kebab/snake producer id');
  return value;
};
const symbol = name => KEYWORDS.has(name) ? '`' + name + '`' : name;
const knowledgeOf = source => 'source:' + source.document + '#' + source.pointer;
const toPascal = id => id.split(/[-_]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
const externalNames = id => {
  const pascal = toPascal(id);
  const camel = pascal[0].toLowerCase() + pascal.slice(1);
  return {
    ingress: 'Ingest' + pascal,
    method: symbol(camel),
    identity: symbol(camel + 'Identity'),
  };
};

function checkSource(source, what) {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    {fail('AL_INPUT', what + ' must carry a {document, pointer} knowledge source');}
}

function checkTypeTree(type, what, packages) {
  if (!type || typeof type !== 'object' || Array.isArray(type)) fail('AL_INPUT', what + ' must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVES.has(type.name)) fail('AL_INPUT', what + ' has unsupported primitive name: ' + JSON.stringify(type.name));
    return;
  }
  if (type.form === 'nominal') {
    text(type.context, what + ' nominal context');
    identifier(type.name, what + ' nominal name');
    if (!packages.some(p => p.context === type.context)) fail('AL_INPUT', what + ' nominal context ' + type.context + ' has no package binding');
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
  fail('AL_INPUT', what + ' has unsupported form: ' + JSON.stringify(type.form));
}

function checkInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('AL_INPUT', 'input must be an object');
  if (input.schemaVersion !== SCHEMA) fail('AL_INPUT', 'unsupported schemaVersion: ' + JSON.stringify(input.schemaVersion));
  if (!Array.isArray(input.packages) || input.packages.length === 0) fail('AL_INPUT', 'packages must be a nonempty array');
  const boundContexts = new Set();
  for (const [i, binding] of input.packages.entries()) {
    const bt = what => 'packages[' + i + '] ' + what;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) fail('AL_INPUT', bt('must be an object'));
    const context = text(binding.context, bt('context'));
    if (boundContexts.has(context)) fail('AL_INPUT', bt('context ' + context + ' is bound twice'));
    boundContexts.add(context);
    const pkg = text(binding.package, bt('package'));
    if (!pkg.split('.').every(p => /^[a-z][a-z0-9_]*$/u.test(p) && !KEYWORDS.has(p)))
      {fail('AL_INPUT', bt('package must be a dotted lowercase-root Scala package'));}
  }
  if (!Array.isArray(input.aggregates) || input.aggregates.length === 0) fail('AL_INPUT', 'aggregates must be a nonempty array');
  const seenAggs = new Set();
  for (const [i, agg] of input.aggregates.entries()) {
    const at = what => 'aggregates[' + i + '] ' + what;
    if (!agg || typeof agg !== 'object' || Array.isArray(agg)) fail('AL_INPUT', at('must be an object'));
    const context = text(agg.context, at('context'));
    if (!boundContexts.has(context)) fail('AL_INPUT', at('context ' + context + ' has no package binding'));
    const name = identifier(agg.name, at('name'));
    const aggKey = context + '/' + name;
    if (seenAggs.has(aggKey)) fail('AL_INPUT', at('aggregate ' + name + ' is declared twice in context ' + context));
    seenAggs.add(aggKey);
    checkSource(agg.source, at('source'));

    if (!Array.isArray(agg.commands) || agg.commands.length === 0) fail('AL_INPUT', at('commands must be a nonempty array'));
    const seenCmds = new Set();
    for (const [j, cmd] of agg.commands.entries()) {
      const ct = what => at('commands[' + j + '] ' + what);
      if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd)) fail('AL_INPUT', ct('must be an object'));
      const cname = identifier(cmd.name, ct('name'));
      if (seenCmds.has(cname)) fail('AL_INPUT', ct('command ' + cname + ' is declared twice'));
      seenCmds.add(cname);
      checkSource(cmd.source, ct('source'));
    }

    if (!Array.isArray(agg.externalProducers)) fail('AL_INPUT', at('externalProducers must be an array'));
    const seenProducers = new Set();
    for (const [j, producer] of agg.externalProducers.entries()) {
      const pt = what => at('externalProducers[' + j + '] ' + what);
      if (!producer || typeof producer !== 'object' || Array.isArray(producer)) fail('AL_INPUT', pt('must be an object'));
      const pid = producerId(producer.id, pt('id'));
      if (seenProducers.has(pid)) fail('AL_INPUT', pt('producer ' + pid + ' is declared twice'));
      seenProducers.add(pid);
      checkTypeTree(producer.outputType, pt('outputType'), input.packages);
      checkSource(producer.source, pt('source'));
    }
  }
}

const packageOf = (context, packages) => packages.find(p => p.context === context).package;
const pathOf = (pkg, rel) => {
  const slash = rel.lastIndexOf('/');
  return scalaSubpackagePath(pkg, rel.slice(0, slash).replaceAll('/', '.'), rel.slice(slash + 1));
};

function renderAggregateGroup(agg, packages) {
  const pkg = packageOf(agg.context, packages);
  const name = symbol(agg.name);
  const protocol = name + 'Protocol';
  const authority = agg.externalProducers.length > 0;
  const authorityParam = authority ? ', authority: ExternalAuthority' : '';
  const authorityArg = authority ? ', authority' : '';

  const paths = {
    protocol: pathOf(pkg, 'application/aggregates/' + agg.name + 'Protocol.scala'),
    aggregate: pathOf(pkg, 'application/aggregates/' + agg.name + 'Aggregate.scala'),
    behavior: pathOf(pkg, 'application/aggregates/behaviors/' + agg.name + 'Behaviors.scala'),
    commandHelpers: pathOf(pkg, 'application/aggregates/behaviors/' + agg.name + 'CommandHelpers.scala'),
    factory: pathOf(pkg, 'application/aggregates/factories/' + agg.name + 'AggregateFactory.scala'),
    rules: pathOf(pkg, 'domain/invariants/' + agg.name + 'Rules.scala'),
    computations: pathOf(pkg, 'domain/services/' + agg.name + 'Computations.scala'),
    entity: pathOf(pkg, 'domain/entities/' + agg.name + 'Entity.scala'),
    external: pathOf(pkg, 'application/aggregates/behaviors/' + agg.name + 'ExternalEvents.scala'),
  };

  const commandSources = [agg.source, ...agg.commands.map(c => c.source)];

  // 1. Application aggregate: application/aggregates/<Name>Aggregate.scala (kind: aggregate-behavior)
  const protocolImports = authority ? '{CommandHandler, ExternalAuthority}' : 'CommandHandler';
  const aggregateContent = `package ${pkg}.application.aggregates

import ${pkg}.application.aggregates.${protocol}.${protocolImports}
import ${pkg}.domain.services.${name}Computations

object ${name}Aggregate {

  def commandHandler(hosts: ${name}Computations${authorityParam}): CommandHandler =
    behaviors.${name}Behaviors(hosts${authorityArg})
}
`;

  // 2. Application factory trait: application/aggregates/factories/<Name>AggregateFactory.scala (kind: aggregate-factory)
  const factoryContent = `package ${pkg}.application.aggregates.factories

import akka.actor.typed.Behavior
import ${pkg}.application.aggregates.${protocol}.${authority ? '_' : 'Command'}
import ${pkg}.domain.entities.${name}Entity.State
import ${pkg}.domain.services.${name}Computations

trait ${name}AggregateFactory {

  def create(persistenceId: String, initial: State, hosts: ${name}Computations${authorityParam}): Behavior[Command]
}
`;

  // 3. Behavior dispatcher: application/aggregates/behaviors/<Name>Behaviors.scala (kind: aggregate-behavior)
  const calls = [
    ...(authority ? ['externalBehavior(authority)'] : []),
    'queryBehavior',
    'executionBehavior(state, hosts)',
  ];
  let behaviorContent = `package ${pkg}.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import ${pkg}.application.aggregates.${protocol}._
import ${pkg}.domain.entities.${name}Entity.{Event, State}
import ${pkg}.domain.invariants.${name}Rules
import ${pkg}.domain.services.${name}Computations

object ${name}Behaviors extends ${name}CommandHelpers {

  def apply(hosts: ${name}Computations${authorityParam}): CommandHandler = (state, command) =>
    ${calls[0]}${calls.slice(1).map(call => '\n      .orElse(' + call + ')').join('')}
      .apply(command)
`;
  const codeMappings = [];
  if (authority) {
    behaviorContent += `
  private def externalBehavior(authority: ExternalAuthority): PartialFunction[Command, Effect[Event, State]] = {
`;
    for (const producer of agg.externalProducers) {
      const names = externalNames(producer.id);
      const startChar = behaviorContent.length;
      behaviorContent += `    case ${names.ingress}(output, authorization, replyTo) =>
      if (!authority.authorize(${JSON.stringify(producer.id)}, authorization, ${name}ExternalEvents.${names.identity}(output)))
        Effect.none.thenRun((_: State) => replyTo ! Refused("external-authority-denied"))
      else {
        val event = ${name}ExternalEvents.${names.method}(output)
        Effect.persist(event).thenRun((_: State) => replyTo ! Accepted(Vector(event)))
      }
`;
      const endChar = behaviorContent.length;
      const startBytes = Buffer.byteLength(behaviorContent.slice(0, startChar));
      const endBytes = Buffer.byteLength(behaviorContent.slice(0, endChar));
      const span = { start: startBytes, end: endBytes, text: behaviorContent.slice(startChar, endChar) };
      codeMappings.push({ knowledgeKey: knowledgeOf(producer.source), span, scope: span });
    }
    behaviorContent += '  }\n';
  }
  behaviorContent += `
  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(replyTo) =>
      Effect.none.thenRun((s: State) => replyTo ! s)
  }

  private def executionBehavior(state: State, hosts: ${name}Computations): PartialFunction[Command, Effect[Event, State]] = {
`;
  for (const command of agg.commands) {
    const cname = symbol(command.name);
    const startChar = behaviorContent.length;
    behaviorContent += `    case cmd: ${cname} =>
      replyEffect(${name}Rules.${cname}(state, to${command.name}Params(cmd), hosts), cmd.replyTo)
`;
    const endChar = behaviorContent.length;
    const startBytes = Buffer.byteLength(behaviorContent.slice(0, startChar));
    const endBytes = Buffer.byteLength(behaviorContent.slice(0, endChar));
    const span = { start: startBytes, end: endBytes, text: behaviorContent.slice(startChar, endChar) };
    codeMappings.push({ knowledgeKey: knowledgeOf(command.source), span, scope: span });
  }
  behaviorContent += `  }
}
`;

  return [
    {
      path: paths.behavior,
      kind: 'aggregate-behavior',
      content: behaviorContent,
      deps: [paths.protocol, paths.commandHelpers, paths.entity, paths.rules, paths.computations, ...(authority ? [paths.external] : [])],
      sources: [...commandSources, ...agg.externalProducers.map(p => p.source)],
      codeMappings,
    },
    {
      path: paths.aggregate,
      kind: 'aggregate-behavior',
      content: aggregateContent,
      deps: [paths.protocol, paths.behavior, paths.computations],
      sources: commandSources,
      codeMappings: [],
    },
    {
      path: paths.factory,
      kind: 'aggregate-factory',
      content: factoryContent,
      deps: [paths.protocol, paths.entity, paths.computations],
      sources: [agg.source],
      codeMappings: [],
    },
  ];
}

export function renderAggregateLayerFiles(input) {
  checkInput(input);
  return input.aggregates.flatMap(agg => renderAggregateGroup(agg, input.packages));
}

function renderAll(input) {
  return Object.fromEntries(renderAggregateLayerFiles(input).map(f => [f.path, f.content]));
}

function clone(v) { return parseStrictJson(JSON.stringify(v)); }

function runNegatives(baseInput) {
  const cases = [
    ['null-input', () => null],
    ['array-input', () => []],
    ['wrong-schema', b => { b.schemaVersion = 'truthsrc.aggregate-layer-input/v99'; return b; }],
    ['empty-packages', b => { b.packages = []; return b; }],
    ['duplicate-package-context', b => { b.packages.push({ ...b.packages[0] }); return b; }],
    ['invalid-package-segment', b => { b.packages[0].package = 'example.BadPkg'; return b; }],
    ['keyword-package-segment', b => { b.packages[0].package = 'example.match'; return b; }],
    ['empty-aggregates', b => { b.aggregates = []; return b; }],
    ['unbound-aggregate-context', b => { b.aggregates[0].context = 'ghost'; return b; }],
    ['invalid-aggregate-name', b => { b.aggregates[0].name = '9Bad'; return b; }],
    ['duplicate-aggregate', b => { b.aggregates.push(clone(b.aggregates[0])); return b; }],
    ['bad-aggregate-source-pointer', b => { b.aggregates[0].source.pointer = 'no-slash'; return b; }],
    ['empty-commands', b => { b.aggregates[0].commands = []; return b; }],
    ['invalid-command-name', b => { b.aggregates[0].commands[0].name = 'bad-cmd'; return b; }],
    ['duplicate-command', b => { b.aggregates[0].commands.push(clone(b.aggregates[0].commands[0])); return b; }],
    ['bad-command-source', b => { b.aggregates[0].commands[0].source = { document: '', pointer: '/a' }; return b; }],
    ['non-array-producers', b => { b.aggregates[0].externalProducers = null; return b; }],
    ['invalid-producer-id', b => { b.aggregates[0].externalProducers = [{ id: 'BadProducer', outputType: { form: 'primitive', name: 'string' }, source: { document: 'd', pointer: '/p' } }]; return b; }],
    ['duplicate-producer-id', b => { const agg = b.aggregates.find(a => a.externalProducers.length > 0) ?? b.aggregates[0]; const p = agg.externalProducers[0] ?? { id: 'p-one', outputType: { form: 'primitive', name: 'string' }, source: { document: 'd', pointer: '/p' } }; agg.externalProducers = [p, clone(p)]; return b; }],
    ['unsupported-output-type-form', b => { b.aggregates[0].externalProducers = [{ id: 'p-one', outputType: { form: 'tuple' }, source: { document: 'd', pointer: '/p' } }]; return b; }],
    ['unbound-output-nominal-context', b => { b.aggregates[0].externalProducers = [{ id: 'p-one', outputType: { form: 'nominal', context: 'missing', name: 'Foo' }, source: { document: 'd', pointer: '/p' } }]; return b; }],
    ['unsupported-output-primitive', b => { b.aggregates[0].externalProducers = [{ id: 'p-one', outputType: { form: 'primitive', name: 'float' }, source: { document: 'd', pointer: '/p' } }]; return b; }],
    ['bad-producer-source', b => { b.aggregates[0].externalProducers = [{ id: 'p-one', outputType: { form: 'primitive', name: 'string' }, source: null }]; return b; }],
  ];
  const failures = [];
  let rejected = 0;
  for (const [name, mutate] of cases) {
    try {
      checkInput(mutate(clone(baseInput)));
      failures.push({ name, reason: 'unexpectedly accepted' });
    } catch (err) {
      if (err?.code === 'AL_INPUT') rejected++;
      else failures.push({ name, reason: 'wrong error code: ' + (err?.code ?? err?.message) });
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'aggregate-layer',
  familyNumber: 6,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/aggregate-layer/v1',
  fixtureDir: 'test/fixtures/aggregate-layer-v1',
  checkInput,
  renderAll,
  runNegatives,
});

export { checkInput, renderAll, runNegatives };
