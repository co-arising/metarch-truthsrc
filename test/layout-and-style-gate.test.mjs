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
const ALLOWED_DOMAIN_SUBPACKAGES = new Set(['values', 'entities', 'invariant', 'services', 'policy', 'events']);
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
