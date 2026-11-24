// Automated architectural gate enforcing docs/codegen-parity/layout-and-style.md §2
// on generated Scala projects (three-layer rule, pure domain boundary, zero root
// forwarding shells, explicit test packages, no duplicate technical suffixes).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BANK_GENERATED = path.resolve(import.meta.dirname, '../../bank-wealth-demo/generated/current');
const BASE_REL = 'app/example/bankwealth';
const ALLOWED_TOP_LAYERS = new Set(['domain', 'application', 'infrastructure']);
const ALLOWED_DOMAIN_SUBPACKAGES = new Set(['values', 'entities', 'invariants', 'services', 'policy']);
const ALLOWED_APPLICATION_SUBPACKAGES = new Set(['aggregates', 'api', 'integration', 'process', 'projection']);
const FORBIDDEN_PROCESS_INTEGRATION_PATTERNS = [
  { label: 'PersistenceId', re: /\bPersistenceId\b/ },
  { label: 'StateCodec', re: /\bStateCodec\b/ },
  { label: 'SerializerWithStringManifest', re: /\bSerializerWithStringManifest\b/ },
  { label: 'DomainConverters', re: /\bDomainConverters\b/ },
  { label: 'EventSourcedBehavior', re: /\bEventSourcedBehavior\b/ },
  { label: 'PersistentMonarch', re: /\bPersistentMonarch\b/ },
  { label: '.infrastructure.', re: /\.infrastructure\./ },
];
const FORBIDDEN_DOMAIN_PATTERNS = [
  { label: 'akka.*', re: /\bakka\./ },
  { label: 'play.*', re: /\bplay\./ },
  { label: '.application.', re: /\.application\./ },
  { label: '.infrastructure.', re: /\.infrastructure\./ },
  { label: '.service.', re: /\.service\./ },
];
const DUPLICATE_SUFFIX_RE = /(ServiceService|HostHost|FactoryFactory|RepositoryRepository|ProtocolProtocol)\.scala$/;

function walkScala(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkScala(full));
    else if (entry.name.endsWith('.scala')) out.push(full);
  }
  return out.sort();
}

test('layout-and-style §2: only domain/application/infrastructure layers under business root', () => {
  const root = path.join(BANK_GENERATED, BASE_REL);
  assert.ok(fs.existsSync(root), 'bank-wealth-demo/generated/current must exist');
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const unexpected = entries
    .filter(e => !e.isDirectory() || !ALLOWED_TOP_LAYERS.has(e.name))
    .map(e => e.name);
  assert.deepEqual(unexpected, [], 'forbidden top-level entries under business root: ' + unexpected.join(', '));
});

test('layout-and-style §2: domain root package has zero files and only sanctioned subpackages', () => {
  const domainRoot = path.join(BANK_GENERATED, BASE_REL, 'domain');
  const entries = fs.readdirSync(domainRoot, { withFileTypes: true });
  const rootFiles = entries.filter(e => e.isFile()).map(e => e.name);
  assert.deepEqual(rootFiles, [], 'domain root must contain zero files (no forwarding shells): ' + rootFiles.join(', '));
  const badDirs = entries.filter(e => e.isDirectory() && !ALLOWED_DOMAIN_SUBPACKAGES.has(e.name)).map(e => e.name);
  assert.deepEqual(badDirs, [], 'unsanctioned domain subpackages: ' + badDirs.join(', '));
});

test('layout-and-style §2/§4: domain layer has zero Akka, Play, application, infrastructure, or service references', () => {
  const domainFiles = walkScala(path.join(BANK_GENERATED, BASE_REL, 'domain'));
  assert.ok(domainFiles.length > 0, 'domain files expected');
  const violations = [];
  for (const file of domainFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const { label, re } of FORBIDDEN_DOMAIN_PATTERNS) {
      if (re.test(content)) {
        violations.push(path.relative(BANK_GENERATED, file) + ' references ' + label);
      }
    }
  }
  assert.deepEqual(violations, [], 'domain purity violations:\n' + violations.join('\n'));
});

test('layout-and-style §2: generated Scala tests declare an explicit package (zero default-package specs)', () => {
  const testFiles = walkScala(path.join(BANK_GENERATED, 'src/test/scala'));
  assert.ok(testFiles.length > 0, 'generated test files expected');
  const defaultPkg = [];
  const servicePkg = [];
  for (const file of testFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const m = /^package\s+([^\s]+)/m.exec(content);
    if (!m) defaultPkg.push(path.relative(BANK_GENERATED, file));
    else if (m[1].endsWith('.service') || m[1].includes('.service.')) servicePkg.push(path.relative(BANK_GENERATED, file));
  }
  assert.deepEqual(defaultPkg, [], 'tests in default package: ' + defaultPkg.join(', '));
  assert.deepEqual(servicePkg, [], 'tests in forbidden .service package: ' + servicePkg.join(', '));
});

test('layout-and-style §3 N1: zero duplicate technical suffixes in generated filenames', () => {
  const allScala = walkScala(path.join(BANK_GENERATED, BASE_REL));
  const bad = allScala.filter(f => DUPLICATE_SUFFIX_RE.test(f)).map(f => path.relative(BANK_GENERATED, f));
  assert.deepEqual(bad, [], 'duplicate technical suffixes: ' + bad.join(', '));
});

test('layout-and-style S12: domain.values contains zero HTTP API DTOs, CQRS views, saga triplets, or PO carriers', () => {
  const valuesDir = path.join(BANK_GENERATED, BASE_REL, 'domain/values');
  const files = walkScala(valuesDir).map(f => path.basename(f, '.scala'));
  assert.ok(files.length > 0, 'domain.values files expected');
  const forbidden = files.filter(name =>
    /PO$/u.test(name) ||
    /(Prepare|Commit|Compensate)(Input|Query|Receipt)$/u.test(name) ||
    /(Args|Result)$/u.test(name) ||
    /(Effect|Dispatch)(Request|Operation|Observation|Reconcile)$/u.test(name) ||
    /(View|Watermark|ReadMetadata|Page)$/u.test(name) ||
    /(Response|Acknowledgement|Key)$/u.test(name) ||
    /(BootstrapInput|RevisionInput|Revise|Tick)$/u.test(name)
  );
  assert.deepEqual(forbidden, [], 'non-domain value objects leaked into domain.values: ' + forbidden.join(', '));
});

test('layout-and-style Phase 2: domain layer has zero domain/events, zero Command definitions, and zero CommandHelpers', () => {
  const eventsDir = path.join(BANK_GENERATED, BASE_REL, 'domain/events');
  assert.equal(fs.existsSync(eventsDir), false, 'domain/events directory must not exist (events belong in domain/entities/*Entity.scala)');
  const singularInvariantDir = path.join(BANK_GENERATED, BASE_REL, 'domain/invariant');
  assert.equal(fs.existsSync(singularInvariantDir), false, 'singular domain/invariant directory must not exist (use plural domain/invariants)');
  const domainFiles = walkScala(path.join(BANK_GENERATED, BASE_REL, 'domain'));
  const violations = [];
  for (const file of domainFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (/\bsealed\s+trait\s+Command\b|\bextends\s+Command\b/.test(content)) {
      violations.push(path.relative(BANK_GENERATED, file) + ' defines Command in domain layer');
    }
    if (/\bCommandHelpers\b/.test(content)) {
      violations.push(path.relative(BANK_GENERATED, file) + ' defines/references CommandHelpers in domain layer');
    }
  }
  assert.deepEqual(violations, [], 'Phase 2 domain alignment violations:\n' + violations.join('\n'));
});

test('layout-and-style Phase 2: Aggregate aligns with playAkkaCQRS (no Execute shell, no backward bootstrap ref, real CommandHelpers)', () => {
  const aggDir = path.join(BANK_GENERATED, BASE_REL, 'application/aggregates');
  const aggFiles = fs.readdirSync(aggDir).filter(f => f.endsWith('Aggregate.scala'));
  assert.ok(aggFiles.length > 0, 'aggregate files expected');
  const violations = [];
  for (const name of aggFiles) {
    const stem = name.replace(/Aggregate\.scala$/, '');
    const aggContent = fs.readFileSync(path.join(aggDir, name), 'utf8');
    if (/infrastructure\.bootstrap/.test(aggContent)) {
      violations.push(name + ' references infrastructure.bootstrap');
    }
    if (/\bsealed\s+trait\s+Request\b|\bcase\s+class\s+Execute\b/.test(aggContent)) {
      violations.push(name + ' still defines legacy Request/Execute wrapper');
    }
    const helpersPath = path.join(aggDir, 'behaviors', stem + 'CommandHelpers.scala');
    if (!fs.existsSync(helpersPath)) {
      violations.push('missing ' + path.relative(BANK_GENERATED, helpersPath));
    } else {
      const helpersContent = fs.readFileSync(helpersPath, 'utf8');
      if (!new RegExp(`trait\\s+${stem}CommandHelpers\\b`).test(helpersContent)) {
        violations.push(stem + 'CommandHelpers.scala must define trait ' + stem + 'CommandHelpers');
      }
    }
    const behaviorsContent = fs.readFileSync(path.join(aggDir, 'behaviors', stem + 'Behaviors.scala'), 'utf8');
    if (!new RegExp(`object\\s+${stem}Behaviors\\s+extends\\s+${stem}CommandHelpers\\b`).test(behaviorsContent)) {
      violations.push(stem + 'Behaviors.scala must mix in ' + stem + 'CommandHelpers');
    }
  }
  assert.deepEqual(violations, [], 'Phase 2 aggregate alignment violations:\n' + violations.join('\n'));
});

test('layout-and-style Phase 3: application root has zero files, zero application.saga, and only problem-space subpackages', () => {
  const appRoot = path.join(BANK_GENERATED, BASE_REL, 'application');
  const entries = fs.readdirSync(appRoot, { withFileTypes: true });
  const rootFiles = entries.filter(e => e.isFile()).map(e => e.name);
  assert.deepEqual(rootFiles, [], 'application root must contain zero files: ' + rootFiles.join(', '));
  const badDirs = entries.filter(e => e.isDirectory() && !ALLOWED_APPLICATION_SUBPACKAGES.has(e.name)).map(e => e.name);
  assert.deepEqual(badDirs, [], 'unsanctioned application subpackages: ' + badDirs.join(', '));
  assert.equal(fs.existsSync(path.join(appRoot, 'saga')), false, 'application/saga must be retired');
  assert.equal(
    fs.existsSync(path.join(appRoot, 'integration/FundOrderExternalEvents.scala')),
    true,
    'FundOrderExternalEvents.scala must reside in application/integration',
  );
  assert.equal(
    fs.existsSync(path.join(appRoot, 'aggregates/behaviors/FundOrderExternalEvents.scala')),
    false,
    'FundOrderExternalEvents.scala must not reside in application/aggregates/behaviors',
  );
});

test('layout-and-style Phase 3: application.process and application.integration are free of persistence/serializer/bootstrap wiring', () => {
  const dirs = ['process', 'integration'].map(sub => path.join(BANK_GENERATED, BASE_REL, 'application', sub));
  const files = dirs.flatMap(walkScala);
  assert.ok(files.length > 0, 'application.process and application.integration files expected');
  const violations = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const { label, re } of FORBIDDEN_PROCESS_INTEGRATION_PATTERNS) {
      if (re.test(content)) {
        violations.push(path.relative(BANK_GENERATED, file) + ' references ' + label);
      }
    }
  }
  assert.deepEqual(violations, [], 'Phase 3 application purity violations:\n' + violations.join('\n'));
});

test('layout-and-style Phase 3: conf/serialization.conf binds infrastructure.persistence serializers to process/integration events', () => {
  const conf = fs.readFileSync(path.join(BANK_GENERATED, 'conf/serialization.conf'), 'utf8');
  assert.match(conf, /host0\s*=\s*"example\.bankwealth\.infrastructure\.persistence\.BankPaymentHostSerializer"/);
  assert.match(conf, /effect0\s*=\s*"example\.bankwealth\.infrastructure\.persistence\.BankSipDispatchEffectHostSerializer"/);
  assert.match(conf, /"example\.bankwealth\.application\.process\.BankPaymentHost\$Event"\s*=\s*host0/);
  assert.match(conf, /"example\.bankwealth\.application\.integration\.BankSipDispatchEffectHost\$Event"\s*=\s*effect0/);
});
