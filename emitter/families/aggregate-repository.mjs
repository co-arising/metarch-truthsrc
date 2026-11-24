// Unified emitter family #12: aggregate-repository (covers emitter-unification
// plan §5 #12/22, rulings 2026-11-23 §20). Emits headerless Scala local actor
// lookup repositories (owned-local-actor-cache) from the typed
// truthsrc.aggregate-repository-input/v1 contract. Zero hardcoded business
// identifiers; fail-closed on every contract violation (AR_INPUT).
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const SCHEMA = 'truthsrc.aggregate-repository-input/v1';
const SUPPORTED_LOOKUPS = new Set(['owned-local-actor-cache']);
const CONTEXT_RE = /^[a-z][a-z0-9_-]*$/u;
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/u;
const TYPE_NAME_RE = /^[A-Z][A-Za-z0-9_]*$/u;

const fail = message => { throw new Error('AR_INPUT: ' + message); };

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
  checkNoExtraKeys(input, new Set(['schemaVersion', 'packages', 'repositories']), 'input');
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

  if (!Array.isArray(input.repositories) || !input.repositories.length) fail('repositories must be a non-empty array');
  const seenRepos = new Set();
  for (let i = 0; i < input.repositories.length; i++) {
    const repo = checkObject(input.repositories[i], 'repositories[' + i + ']');
    checkNoExtraKeys(repo, new Set(['context', 'name', 'lookup', 'source']), 'repositories[' + i + ']');
    if (typeof repo.context !== 'string' || !packageByContext.has(repo.context))
      {fail('repositories[' + i + '].context has no package binding: ' + JSON.stringify(repo.context));}
    if (typeof repo.name !== 'string' || !TYPE_NAME_RE.test(repo.name))
      {fail('repositories[' + i + '].name must match ' + TYPE_NAME_RE);}
    if (typeof repo.lookup !== 'string' || !SUPPORTED_LOOKUPS.has(repo.lookup))
      {fail('repositories[' + i + '].lookup unsupported: ' + JSON.stringify(repo.lookup));}
    checkSource(repo.source, 'repositories[' + i + '].source');
    const key = repo.context + '/' + repo.name;
    if (seenRepos.has(key)) fail('duplicate repository declaration: ' + key);
    seenRepos.add(key);
  }
}

function renderRepositoryPortScala(pkg, name) {
  return [
    `package ${pkg}.application.aggregates.repository`,
    '',
    'import akka.actor.typed.ActorRef',
    `import ${pkg}.application.aggregates.${name}Protocol.Command`,
    '',
    `object ${name}Repository {`,
    '  final case class Handle(persistenceId: String, ref: ActorRef[Command])',
    '}',
    '',
    `trait ${name}Repository[K] extends AutoCloseable {`,
    `  def get(id: K): ${name}Repository.Handle`,
    '}',
    '',
  ].join('\n');
}

function renderRepositoryImplScala(pkg, name) {
  return [
    `package ${pkg}.infrastructure.repositories.aggregate`,
    '',
    'import akka.actor.typed.{ActorRef, Behavior}',
    `import ${pkg}.application.aggregates.${name}Protocol.Command`,
    `import ${pkg}.application.aggregates.repository.${name}Repository`,
    `import ${pkg}.application.aggregates.repository.${name}Repository.Handle`,
    '',
    `final class ${name}RepositoryImpl[K](`,
    '  identity: K => String,',
    '  behavior: (K, String) => Behavior[Command],',
    '  spawn: (String, Behavior[Command]) => ActorRef[Command]',
    `) extends ${name}Repository[K] {`,
    '  require(identity != null && behavior != null && spawn != null)',
    '  private val handles = scala.collection.mutable.Map.empty[K, Handle]',
    '  private val identities = scala.collection.mutable.Map.empty[String, K]',
    '  private var closed = false',
    '',
    '  override def get(id: K): Handle = synchronized {',
    '    require(!closed, "repository is closed")',
    '    handles.getOrElseUpdate(id, {',
    '      val pid = identity(id)',
    '      require(pid != null && pid.nonEmpty, "explicit persistence identity required")',
    '      require(!identities.contains(pid) || identities(pid) == id, "conflicting repository persistence identity")',
    '      val ref = spawn(pid, behavior(id, pid))',
    '      require(ref != null, "actor spawn returned no reference")',
    '      identities.put(pid, id)',
    '      Handle(pid, ref)',
    '    })',
    '  }',
    '',
    '  override def close(): Unit = synchronized { closed = true; handles.clear(); identities.clear() }',
    '}',
    '',
  ].join('\n');
}

export function renderAggregateRepositoryFiles(input) {
  checkInput(input);
  const packageByContext = new Map(input.packages.map(p => [p.context, p.package]));
  return input.repositories.flatMap(repo => {
    const pkg = packageByContext.get(repo.context);
    const protocolPath = scalaSubpackagePath(pkg, 'application.aggregates', repo.name + 'Protocol.scala');
    const portPath = scalaSubpackagePath(pkg, 'application.aggregates.repository', repo.name + 'Repository.scala');
    const implPath = scalaSubpackagePath(pkg, 'infrastructure.repositories.aggregate', repo.name + 'RepositoryImpl.scala');
    const sources = [{ document: repo.source.document, pointer: repo.source.pointer }];
    return [
      {
        path: portPath,
        content: renderRepositoryPortScala(pkg, repo.name),
        kind: 'aggregate-repository',
        deps: [protocolPath],
        sources,
        codeMappings: [],
      },
      {
        path: implPath,
        content: renderRepositoryImplScala(pkg, repo.name),
        kind: 'aggregate-repository',
        deps: [protocolPath, portPath],
        sources,
        codeMappings: [],
      },
    ];
  });
}

export function renderAll(input) {
  return Object.fromEntries(renderAggregateRepositoryFiles(input).map(f => [f.path, f.content]));
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
    ['unexpected package key', () => { const x = clone(); x.packages[0].extra = 1; return x; }],
    ['empty repositories', () => { const x = clone(); x.repositories = []; return x; }],
    ['non-object repository', () => { const x = clone(); x.repositories[0] = 'bad'; return x; }],
    ['unexpected repository key', () => { const x = clone(); x.repositories[0].extra = 1; return x; }],
    ['unbound repository context', () => { const x = clone(); x.repositories[0].context = 'unknown'; return x; }],
    ['invalid repository name', () => { const x = clone(); x.repositories[0].name = 'lowercase'; return x; }],
    ['unsupported lookup strategy', () => { const x = clone(); x.repositories[0].lookup = 'cluster-sharding'; return x; }],
    ['duplicate repository declaration', () => { const x = clone(); x.repositories.push({ ...x.repositories[0] }); return x; }],
    ['missing source document', () => { const x = clone(); x.repositories[0].source.document = ''; return x; }],
    ['malformed source pointer', () => { const x = clone(); x.repositories[0].source.pointer = 'aggregates/0'; return x; }],
    ['unexpected source key', () => { const x = clone(); x.repositories[0].source.extra = 1; return x; }],
  ];
  let rejected = 0;
  const failures = [];
  for (const [label, build] of cases) {
    try {
      checkInput(build());
      failures.push(label + ': unexpectedly accepted');
    } catch (err) {
      if (!String(err.message || '').startsWith('AR_INPUT:')) {
        failures.push(label + ': wrong error prefix (' + err.message + ')');
      } else {
        rejected++;
      }
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'aggregate-repository',
  familyNumber: 12,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/aggregate-repository/v1',
  fixtureDir: 'test/fixtures/aggregate-repository-v1',
  checkInput,
  renderAll,
  runNegatives,
});
