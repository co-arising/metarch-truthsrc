// Unified emitter family #47: aggregate-bootstrap.
// Emits headerless Scala EventSourcedBehavior bootstrap objects
// (`infrastructure/bootstrap/<Name>Bootstrap.scala`) from the typed
// truthsrc.aggregate-bootstrap-input/v1 contract. Zero hardcoded business
// identifiers; fail-closed on every contract violation (AB_INPUT).
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const SCHEMA = 'truthsrc.aggregate-bootstrap-input/v1';
const SUPPORTED_IDENTITIES = new Set(['unique-id']);
const CONTEXT_RE = /^[a-z][a-z0-9_-]*$/u;
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/u;
const TYPE_NAME_RE = /^[A-Z][A-Za-z0-9_]*$/u;

const fail = message => {
  const err = new Error('AB_INPUT: ' + message);
  err.code = 'AB_INPUT';
  throw err;
};

function checkObject(value, what) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(what + ' must be an object');
  return value;
}

function checkNoExtraKeys(obj, allowed, what) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) fail(what + ' has unexpected key: ' + key);
  }
}

function checkSource(source, what) {
  checkObject(source, what);
  checkNoExtraKeys(source, new Set(['document', 'pointer']), what);
  if (typeof source.document !== 'string' || !source.document) fail(what + '.document must be a non-empty string');
  if (typeof source.pointer !== 'string' || !source.pointer.startsWith('/')) fail(what + '.pointer must be a JSON pointer starting with /');
}

export function checkInput(input) {
  checkObject(input, 'input');
  checkNoExtraKeys(input, new Set(['schemaVersion', 'packages', 'bootstraps']), 'input');
  if (input.schemaVersion !== SCHEMA) fail('schemaVersion must be ' + SCHEMA);

  if (!Array.isArray(input.packages) || !input.packages.length) fail('packages must be a non-empty array');
  const packageByContext = new Map();
  for (let i = 0; i < input.packages.length; i++) {
    const entry = checkObject(input.packages[i], 'packages[' + i + ']');
    checkNoExtraKeys(entry, new Set(['context', 'package']), 'packages[' + i + ']');
    if (typeof entry.context !== 'string' || !CONTEXT_RE.test(entry.context))
      {fail('packages[' + i + '].context must match ' + CONTEXT_RE);}
    if (typeof entry.package !== 'string' || !PACKAGE_RE.test(entry.package))
      {fail('packages[' + i + '].package must match ' + PACKAGE_RE);}
    if (packageByContext.has(entry.context)) fail('duplicate package binding for context ' + entry.context);
    packageByContext.set(entry.context, entry.package);
  }

  if (!Array.isArray(input.bootstraps) || !input.bootstraps.length) fail('bootstraps must be a non-empty array');
  const seen = new Set();
  for (let i = 0; i < input.bootstraps.length; i++) {
    const row = checkObject(input.bootstraps[i], 'bootstraps[' + i + ']');
    checkNoExtraKeys(row, new Set(['context', 'name', 'persistenceIdentity', 'authority', 'source']), 'bootstraps[' + i + ']');
    if (typeof row.context !== 'string' || !packageByContext.has(row.context))
      {fail('bootstraps[' + i + '].context has no package binding: ' + JSON.stringify(row.context));}
    if (typeof row.name !== 'string' || !TYPE_NAME_RE.test(row.name))
      {fail('bootstraps[' + i + '].name must match ' + TYPE_NAME_RE);}
    if (typeof row.persistenceIdentity !== 'string' || !SUPPORTED_IDENTITIES.has(row.persistenceIdentity))
      {fail('bootstraps[' + i + '].persistenceIdentity unsupported: ' + JSON.stringify(row.persistenceIdentity));}
    if (typeof row.authority !== 'boolean')
      {fail('bootstraps[' + i + '].authority must be a boolean');}
    checkSource(row.source, 'bootstraps[' + i + '].source');
    const key = row.context + '/' + row.name;
    if (seen.has(key)) fail('duplicate bootstrap declaration: ' + key);
    seen.add(key);
  }
}

function renderBootstrapScala(pkg, row) {
  const name = row.name;
  const protocol = name + 'Protocol';
  const bootstrap = name + 'Bootstrap';
  const authorityParam = row.authority ? ', authority: ExternalAuthority' : '';
  const authorityArg = row.authority ? ', authority' : '';
  const authorityCheck = row.authority ? ' && authority != null' : '';
  return [
    `package ${pkg}.infrastructure.bootstrap`,
    '',
    'import akka.actor.typed.Behavior',
    'import akka.persistence.typed.PersistenceId',
    'import akka.persistence.typed.scaladsl.EventSourcedBehavior',
    `import ${pkg}.application.aggregates.${name}Aggregate`,
    `import ${pkg}.application.aggregates.${protocol}.${row.authority ? '_' : 'Command'}`,
    `import ${pkg}.application.aggregates.factories.${name}AggregateFactory`,
    `import ${pkg}.domain.entities.${name}Entity.{Event, State}`,
    `import ${pkg}.domain.entities.behaviors.${name}EventHandler`,
    `import ${pkg}.domain.services.${name}Computations`,
    `import ${pkg}.infrastructure.persistence.{${name}EventAdapter, ${name}SnapshotAdapter}`,
    '',
    `object ${bootstrap} extends ${name}AggregateFactory {`,
    '',
    `  override def create(persistenceId: String, initial: State, hosts: ${name}Computations${authorityParam}): Behavior[Command] = {`,
    `    require(persistenceId != null && persistenceId.nonEmpty && hosts != null${authorityCheck}, "explicit persistence identity and implementations required")`,
    '',
    '    EventSourcedBehavior[Command, Event, State](',
    '      persistenceId = PersistenceId.ofUniqueId(persistenceId),',
    '      emptyState = initial,',
    `      commandHandler = ${name}Aggregate.commandHandler(hosts${authorityArg}),`,
    `      eventHandler = ${name}EventHandler.apply`,
    '    )',
    `      .eventAdapter(${name}EventAdapter)`,
    `      .snapshotAdapter(${name}SnapshotAdapter)`,
    '  }',
    '}',
    '',
  ].join('\n');
}

export function renderAggregateBootstrapFiles(input) {
  checkInput(input);
  const packageByContext = new Map(input.packages.map(p => [p.context, p.package]));
  return input.bootstraps.map(row => {
    const pkg = packageByContext.get(row.context);
    const name = row.name;
    return {
      path: scalaSubpackagePath(pkg, 'infrastructure.bootstrap', `${name}Bootstrap.scala`),
      content: renderBootstrapScala(pkg, row),
      kind: 'aggregate-bootstrap',
      deps: [
        scalaSubpackagePath(pkg, 'application.aggregates.factories', `${name}AggregateFactory.scala`),
        scalaSubpackagePath(pkg, 'application.aggregates', `${name}Aggregate.scala`),
        scalaSubpackagePath(pkg, 'domain.entities', `${name}Entity.scala`),
        scalaSubpackagePath(pkg, 'domain.entities.behaviors', `${name}EventHandler.scala`),
        scalaSubpackagePath(pkg, 'infrastructure.persistence', `${name}Adapters.scala`),
      ],
      sources: [{ document: row.source.document, pointer: row.source.pointer }],
      codeMappings: [],
    };
  });
}

export function renderAll(input) {
  return Object.fromEntries(renderAggregateBootstrapFiles(input).map(f => [f.path, f.content]));
}

export function runNegatives(baseInput) {
  const clone = () => JSON.parse(JSON.stringify(baseInput));
  const cases = [
    ['non-object input', () => null],
    ['wrong schemaVersion', () => { const x = clone(); x.schemaVersion = 'wrong/v1'; return x; }],
    ['unexpected top-level key', () => { const x = clone(); x.extra = true; return x; }],
    ['empty packages', () => { const x = clone(); x.packages = []; return x; }],
    ['invalid package context', () => { const x = clone(); x.packages[0].context = 'BadContext'; return x; }],
    ['invalid package name', () => { const x = clone(); x.packages[0].package = 'Bad.Package'; return x; }],
    ['duplicate package context', () => { const x = clone(); x.packages.push({ ...x.packages[0] }); return x; }],
    ['empty bootstraps', () => { const x = clone(); x.bootstraps = []; return x; }],
    ['unbound bootstrap context', () => { const x = clone(); x.bootstraps[0].context = 'unknown'; return x; }],
    ['invalid bootstrap name', () => { const x = clone(); x.bootstraps[0].name = 'lowercase'; return x; }],
    ['unsupported persistenceIdentity', () => { const x = clone(); x.bootstraps[0].persistenceIdentity = 'sharded'; return x; }],
    ['non-boolean authority', () => { const x = clone(); x.bootstraps[0].authority = 'yes'; return x; }],
    ['duplicate bootstrap declaration', () => { const x = clone(); x.bootstraps.push({ ...x.bootstraps[0] }); return x; }],
    ['missing source document', () => { const x = clone(); x.bootstraps[0].source.document = ''; return x; }],
    ['malformed source pointer', () => { const x = clone(); x.bootstraps[0].source.pointer = 'aggregates/0'; return x; }],
  ];
  let rejected = 0;
  const failures = [];
  for (const [label, build] of cases) {
    try {
      checkInput(build());
      failures.push(label + ': unexpectedly accepted');
    } catch (err) {
      if (err?.code !== 'AB_INPUT') failures.push(label + ': wrong error code (' + err?.code + ')');
      else rejected++;
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'aggregate-bootstrap',
  familyNumber: 47,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/aggregate-bootstrap/v1',
  fixtureDir: 'test/fixtures/aggregate-bootstrap-v1',
  checkInput,
  renderAll,
  runNegatives,
});
