// protocol-layer emitter (family #7): aligned with playAkkaCQRS, renders the
// three protocol/service/helper artifacts per aggregate from the derived
// truthsrc.protocol-layer-input/v1 contract:
//   1. `<pkg>.domain.services.<Name>Computations` — pure domain computation port (kind: command-helpers)
//   2. `<pkg>.application.aggregates.<Name>Protocol` — Commands (with replyTo), Replies, ExternalAuthority, CommandHandler (kind: application-protocol)
//   3. `<pkg>.application.aggregates.behaviors.<Name>CommandHelpers` — Command ↔ RuleParams ↔ Reply glue trait (kind: command-helpers)
//
// Zero Command types are emitted under domain/**; zero business identifiers are
// embedded in this module.
import {
  renderValueWildcardImports,
  valueObjectPath,
  valueObjectTypeQualifier,
} from '../../lib/derivation/value-object-package.mjs';
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const SCHEMA = 'truthsrc.protocol-layer-input/v1';
const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);
const PRIMITIVES = new Map([['string', 'String'], ['integer', 'Long'], ['boolean', 'Boolean'], ['decimal', 'BigDecimal']]);

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
    {fail('PL_INPUT', what + ' must carry a {document, pointer} knowledge source');}
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

function checkAggregateCommands(agg, at, packages) {
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
      checkTypeTree(param.valueType, pt('valueType'), packages);
    }
  }
  return seenCmds;
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
      {fail('PL_INPUT', bt('package must be a dotted lowercase-root Scala package'));}
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

    const seenCmds = checkAggregateCommands(agg, at, input.packages);

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

    if (!Array.isArray(agg.externalProducers)) fail('PL_INPUT', at('externalProducers must be an array'));
    const seenProducers = new Set();
    for (const [j, p] of agg.externalProducers.entries()) {
      const pt = what => at('externalProducers[' + j + '] ' + what);
      if (!p || typeof p !== 'object' || Array.isArray(p)) fail('PL_INPUT', pt('must be an object'));
      const id = producerId(p.id, pt('id'));
      if (seenProducers.has(id)) fail('PL_INPUT', pt('producer ' + id + ' is declared twice'));
      seenProducers.add(id);
      checkTypeTree(p.outputType, pt('outputType'), input.packages);
    }
  }
}

function renderType(type, pkgByContext, ownContext) {
  if (type.form === 'primitive') return PRIMITIVES.get(type.name);
  if (type.form === 'nominal') {
    if (ownContext && type.context === ownContext) return symbol(type.name);
    return valueObjectTypeQualifier(pkgByContext.get(type.context), symbol(type.name));
  }
  if (type.form === 'optional') return 'Option[' + renderType(type.element, pkgByContext, ownContext) + ']';
  if (type.form === 'sequence') return 'Vector[' + renderType(type.element, pkgByContext, ownContext) + ']';
  if (type.form === 'map') return 'Map[' + renderType(type.key, pkgByContext, ownContext) + ', ' + renderType(type.value, pkgByContext, ownContext) + ']';
  fail('PL_INPUT', 'unsupported type form: ' + JSON.stringify(type.form));
}

function collectOwnValueNames(type, ownContext, out) {
  if (type.form === 'nominal') {
    if (type.context === ownContext) out.add(type.name);
    return;
  }
  if (type.form === 'optional' || type.form === 'sequence') collectOwnValueNames(type.element, ownContext, out);
  else if (type.form === 'map') {
    collectOwnValueNames(type.key, ownContext, out);
    collectOwnValueNames(type.value, ownContext, out);
  }
}

function usesOwnValues(type, ownContext) {
  if (type.form === 'nominal') return type.context === ownContext;
  if (type.form === 'optional' || type.form === 'sequence') return usesOwnValues(type.element, ownContext);
  if (type.form === 'map') return usesOwnValues(type.key, ownContext) || usesOwnValues(type.value, ownContext);
  return false;
}

function valuesPaths(type, pkgByContext) {
  if (type.form === 'nominal') return [valueObjectPath(pkgByContext.get(type.context), type.name)];
  if (type.form === 'optional' || type.form === 'sequence') return valuesPaths(type.element, pkgByContext);
  if (type.form === 'map') return [...valuesPaths(type.key, pkgByContext), ...valuesPaths(type.value, pkgByContext)];
  return [];
}

function renderCommandCaseClass(className, rows, pkgByContext, ownContext) {
  const fields = [
    ...rows.map(r => symbol(r.name) + ': ' + renderType(r.valueType, pkgByContext, ownContext)),
    'replyTo: ActorRef[Reply]',
  ];
  const oneLine = '  final case class ' + symbol(className) + '(' + fields.join(', ') + ') extends Command';
  if (fields.length > 4 || oneLine.length > 110) {
    return '  final case class ' + symbol(className) + '(\n    ' + fields.join(',\n    ') + '\n  ) extends Command';
  }
  return oneLine;
}

const lowerFirst = s => (s ? s[0].toLowerCase() + s.slice(1) : s);

function renderComputations(agg, pkg, pkgByContext) {
  const name = symbol(agg.name);
  const hasHosts = agg.hosts.length > 0;
  const importValues = agg.hosts.some(h => usesOwnValues(h.outputType, agg.context));
  const lines = [
    'package ' + pkg + '.domain.services',
    '',
    ...(hasHosts ? [
      `import ${pkg}.domain.entities.${name}Entity.State`,
      `import ${pkg}.domain.invariants.params.${name}RuleParams._`,
    ] : []),
    ...(importValues ? ['import ' + pkg + '.domain.values._'] : []),
    'import net.imadz.common.CommonTypes.DomainService',
    '',
    'trait ' + name + 'Computations extends DomainService {',
  ];
  for (const h of agg.hosts) {
    lines.push('  def ' + symbol(lowerFirst(h.name)) + '(state: State, p: ' + symbol(h.command) + 'Params): ' + renderType(h.outputType, pkgByContext, agg.context));
  }
  lines.push('}');
  lines.push('object ' + name + 'Computations {');
  if (!hasHosts) {
    lines.push('  val none: ' + name + 'Computations = new ' + name + 'Computations {}');
  }
  lines.push('}');
  const deps = hasHosts
    ? [
        scalaSubpackagePath(pkg, 'domain.entities', agg.name + 'Entity.scala'),
        scalaSubpackagePath(pkg, 'domain.invariants.params', agg.name + 'RuleParams.scala'),
        ...new Set(agg.hosts.flatMap(h => valuesPaths(h.outputType, pkgByContext))),
      ]
    : [];
  return {
    path: scalaSubpackagePath(pkg, 'domain.services', agg.name + 'Computations.scala'),
    kind: 'command-helpers',
    content: lines.join('\n') + '\n',
    sources: [agg.source, ...agg.hosts.map(h => h.source)],
    deps,
  };
}

function renderCommandHelpersTrait(agg, pkg) {
  const name = symbol(agg.name);
  const lines = [
    `package ${pkg}.application.aggregates.behaviors`,
    '',
    `import ${pkg}.application.aggregates.${name}Protocol._`,
    `import ${pkg}.domain.entities.${name}Entity.State`,
    `import ${pkg}.domain.invariants.params.${name}RuleParams._`,
    'import net.imadz.common.CommonTypes.iMadzError',
    'import net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper',
    '',
    `trait ${name}CommandHelpers {`,
  ];
  for (const c of agg.commands) {
    const cname = symbol(c.name);
    const args = c.parameters.map(p => 'command.' + symbol(p.name)).join(', ');
    lines.push(
      '',
      `  implicit object ${c.name}Helper extends CommandHelper[${cname}, State, ${c.name}Params, Reply] {`,
      `    override def toParam(state: State, command: ${cname}): ${c.name}Params =`,
      `      ${c.name}Params(${args})`,
      '',
      `    override def createFailureReply(param: ${c.name}Params)(error: iMadzError): Reply =`,
      '      Refused(error)',
      '',
      `    override def createSuccessReply(param: ${c.name}Params)(state: State): Reply =`,
      '      Accepted(Vector.empty)',
      '  }',
    );
  }
  lines.push('}');
  return {
    path: scalaSubpackagePath(pkg, 'application.aggregates.behaviors', agg.name + 'CommandHelpers.scala'),
    kind: 'command-helpers',
    content: lines.join('\n') + '\n',
    sources: [agg.source, ...agg.commands.map(c => c.source)],
    deps: [
      scalaSubpackagePath(pkg, 'application.aggregates', agg.name + 'Protocol.scala'),
      scalaSubpackagePath(pkg, 'domain.entities', agg.name + 'Entity.scala'),
      scalaSubpackagePath(pkg, 'domain.invariants.params', agg.name + 'RuleParams.scala'),
    ],
  };
}

function renderApplicationProtocol(agg, pkg, pkgByContext) {
  const name = symbol(agg.name);
  const hasAuthority = agg.externalProducers.length > 0;
  const ownNames = new Set();
  for (const c of agg.commands) {
    for (const p of c.parameters) collectOwnValueNames(p.valueType, agg.context, ownNames);
  }
  for (const p of agg.externalProducers) collectOwnValueNames(p.outputType, agg.context, ownNames);

  const lines = [
    `package ${pkg}.application.aggregates`,
    '',
    'import akka.actor.typed.ActorRef',
    'import akka.persistence.typed.scaladsl.Effect',
    `import ${pkg}.domain.entities.${name}Entity.{Event, State}`,
    ...renderValueWildcardImports(pkg, [...ownNames], 'application.aggregates'),
    'import net.imadz.common.CborSerializable',
    'import net.imadz.common.CommonTypes.iMadzError',
    '',
    `object ${name}Protocol {`,
    '',
    '  sealed trait Command extends CborSerializable',
  ];
  for (const c of agg.commands) {
    lines.push(renderCommandCaseClass(c.name, c.parameters, pkgByContext, agg.context));
  }
  lines.push('  final case class GetState(replyTo: ActorRef[State]) extends Command');
  for (const p of agg.externalProducers) {
    const outType = renderType(p.outputType, pkgByContext, agg.context);
    lines.push(`  final case class ${ingressAlias(p.id)}(output: ${outType}, authorization: String, replyTo: ActorRef[Reply]) extends Command`);
  }
  lines.push(
    '',
    '  sealed trait Reply extends CborSerializable',
    '  final case class Accepted(events: Vector[Event]) extends Reply',
    '  final case class Refused(error: iMadzError) extends Reply {',
    '    def code: String = error.code',
    '  }',
  );
  if (hasAuthority) {
    lines.push(
      '',
      '  trait ExternalAuthority {',
      '    def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean',
      '  }',
    );
  }
  lines.push(
    '',
    '  type CommandHandler = (State, Command) => Effect[Event, State]',
    '}',
  );
  const valueDeps = [
    ...agg.commands.flatMap(c => c.parameters.flatMap(p => valuesPaths(p.valueType, pkgByContext))),
    ...agg.externalProducers.flatMap(p => valuesPaths(p.outputType, pkgByContext)),
  ];
  return {
    path: scalaSubpackagePath(pkg, 'application.aggregates', agg.name + 'Protocol.scala'),
    kind: 'application-protocol',
    content: lines.join('\n') + '\n',
    sources: [agg.source, ...agg.commands.map(c => c.source)],
    deps: [
      scalaSubpackagePath(pkg, 'domain.entities', agg.name + 'Entity.scala'),
      ...new Set(valueDeps),
    ],
  };
}

export function renderProtocolLayerFiles(input) {
  checkInput(input);
  const pkgByContext = new Map(input.packages.map(p => [p.context, p.package]));
  const files = [];
  for (const agg of input.aggregates) {
    const pkg = pkgByContext.get(agg.context);
    files.push(renderComputations(agg, pkg, pkgByContext));
    files.push(renderCommandHelpersTrait(agg, pkg));
    files.push(renderApplicationProtocol(agg, pkg, pkgByContext));
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
    ['unsupported-primitive-type', () => { const c = clone(); c.aggregates[0].commands[0].parameters[0].valueType = { form: 'primitive', name: 'float' }; return c; }],
    ['unbound-nominal-type-context', () => { const c = clone(); c.aggregates[0].commands[0].parameters[0].valueType = { form: 'nominal', context: 'missing', name: 'Foo' }; return c; }],
    ['duplicate-host-name', () => { const c = clone(); c.aggregates[0].hosts.push(clone().aggregates[0].hosts[0]); return c; }],
    ['host-referencing-undeclared-command', () => { const c = clone(); c.aggregates[0].hosts[0].command = 'NoSuchCommand'; return c; }],
    ['duplicate-external-producer-id', () => { const c = clone(); const fo = c.aggregates.find(a => a.externalProducers.length > 0); fo.externalProducers.push({ ...fo.externalProducers[0] }); return c; }],
    ['invalid-external-producer-id', () => { const c = clone(); const fo = c.aggregates.find(a => a.externalProducers.length > 0); fo.externalProducers[0].id = 'Bad_Producer'; return c; }],
    ['invalid-external-producer-output-type', () => { const c = clone(); const fo = c.aggregates.find(a => a.externalProducers.length > 0); fo.externalProducers[0].outputType = { form: 'tuple' }; return c; }],
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
