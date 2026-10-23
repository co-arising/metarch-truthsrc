import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { apply } from '../src/core/generate.mjs';
import { ANCHORS_VERSION, readAnchorsIndex } from '../src/core/anchors.mjs';
import { queryAnchorsIndex } from '../lib/anchor-query.mjs';

// All inputs, generator modules, outputs and adversarial link targets belong to this
// test's realpathed scratch root. No authored tree, existing generator or shared app
// is used. Exercise the public core apply path, not an injected plan or filesystem.
const OWNER = 's8-fixture-generator';
const VERSION = 's8.1';
const KEY = 'aggregate:Wallet';
const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const artifact = (path, source, extra = {}) => ({
  path, source, kind: 'protocol', schemaCategory: 'aggregate',
  families: ['Wallet'], deps: [], knowledgeId: KEY, ...extra,
});
const shell = (version, body = 'generatedDefault()') => `// generated shell ${version}\nobject Owned {\n  def applyFor(state: State) = {\n    // ==== BEGIN MANUAL ====\n    ${body}\n    // ==== END MANUAL ====\n  }\n}\n`;
const ownedPath = '01-existing/Owned.scala';
const legalPath = '00-legal/New.scala';

function fixture(t) {
  // macOS tmpdir can contain /var -> /private/var. The caller root itself must
  // not be that system alias, otherwise an outDir-link test has a false oracle.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'truthsrc-s8-generate-anchors-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = join(root, 'input.fixture.json');
  const out = join(root, 'out');
  const registryFile = join(root, 'concerns.fixture.json');
  function put(file, bytes) {
    const absolute = join(root, file);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, bytes);
    return absolute;
  }
  function generator(name = OWNER) {
    const directory = join(root, name);
    put(`${name}/generator.json`, JSON.stringify({
      name, version: VERSION, inputSchema: 'truthsrc/v0.3', products: ['template'],
      artifactKinds: ['protocol', 'entity', 'rules', 'routes'], output: { language: 'fixture' },
    }));
    put(`${name}/generate.mjs`, `export function generate({ canonical }) {\n  return canonical.fixtureArtifacts.map(({ source, ...metadata }) => ({\n    ...metadata, content: source,\n  }));\n}\n`);
    return directory;
  }
  const generatorDir = generator();
  put('concerns.fixture.json', JSON.stringify({
    flavors: { all: { artifactKinds: ['*'] }, protocol: { artifactKinds: ['protocol'] } },
    concerns: {
      full: { schemaCategories: ['*'], flavors: ['all'] },
      protocol: { schemaCategories: ['aggregate'], flavors: ['protocol'] },
    },
  }));
  function setArtifacts(artifacts) {
    // Synthetic loadCanonical input only; never a canonical authority write.
    writeFileSync(input, JSON.stringify({ schemaVersion: 'truthsrc/v1', fixtureArtifacts: artifacts }));
  }
  setArtifacts([]);
  return {
    root, out, input, generatorDir, generator, put, setArtifacts,
    run: (extra = {}) => apply({ canonicalFile: input, generatorDir, outDir: out, ...extra }),
    concern: (name = 'protocol') => ({ name, families: 'Wallet', registryFile }),
    read: file => readFileSync(join(out, file)),
    index: () => readAnchorsIndex(readFileSync(join(out, 'anchors.json'), 'utf8')),
    ledger: () => JSON.parse(readFileSync(join(out, 'truthsrc.ledger.json'), 'utf8')),
    query: key => queryAnchorsIndex(key, {
      indexFile: join(out, 'anchors.json'), repoRoots: { [out]: out },
    }),
  };
}

function fileVerified(location, bytes, { file, generator = OWNER, version = VERSION } = {}) {
  assert.equal(location.file, file);
  assert.equal(location.generator, generator);
  assert.equal(location.generatorVersion, version);
  assert.equal(location.fingerprint, digest(bytes));
  assert.equal(location.status, 'source-verified');
  assert.equal(location.module, null);
  assert.equal(location.symbol, null);
  assert.equal(location.span, null);
  assert.equal(location.verification.level, 'file');
  assert.equal(location.verification.method, 'sha256-bytes');
  assert.equal(location.verification.fileVerified, true);
  assert.equal(location.verification.symbolVerified, false);
  assert.equal(location.verification.spanVerified, false);
  assert.equal(Object.hasOwn(location.verification, 'symbolEvidence'), false);
}
function at(index, key, file, generator = OWNER) {
  const location = (index.anchors[key] ?? []).find(item => item.file === file && item.generator === generator);
  assert.ok(location, `missing anchor ${key} -> ${generator}/${file}`);
  return location;
}
function noCertification(location, status) {
  assert.equal(location.status, status);
  assert.equal(location.verification.method, 'none');
  assert.equal(location.verification.level, 'none');
  for (const property of ['fileVerified', 'symbolVerified', 'spanVerified']) {
    assert.equal(location.verification[property], false);
  }
}

// Snapshot contents AND identity/mtime/ctime: a rewrite with identical bytes is
// still a write. Never follow a symlink (its target also lives in this scratch).
function snapshot(root) {
  const result = {};
  function visit(absolute, relative) {
    const info = lstatSync(absolute, { bigint: true });
    const metadata = Object.fromEntries(['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs']
      .map(key => [key, String(info[key])]));
    if (info.isSymbolicLink()) result[relative] = { ...metadata, link: readlinkSync(absolute) };
    else if (info.isDirectory()) {
      result[relative] = { ...metadata, directory: true };
      for (const name of readdirSync(absolute).sort()) {
        visit(join(absolute, name), relative ? `${relative}/${name}` : name);
      }
    } else result[relative] = { ...metadata, bytes: readFileSync(absolute).toString('base64') };
  }
  visit(root, '');
  return result;
}
async function refusalFixture(t) {
  const f = fixture(t);
  f.setArtifacts([artifact(ownedPath, shell(1), { knowledgeId: 'old:owned' })]);
  await f.run();
  return f;
}
function legalEntries() {
  return [
    artifact(legalPath, 'object LegalNew {}\n', { knowledgeId: 'new:legal' }),
    // A real prospective MERGE as well as ADD must remain unapplied on refusal.
    artifact(ownedPath, shell(2), { knowledgeId: 'new:owned' }),
  ];
}
async function refusesWithoutWrites(f, entries, message, extra = {}) {
  f.setArtifacts(entries);
  const ledger = f.read('truthsrc.ledger.json');
  const anchors = f.read('anchors.json');
  const before = snapshot(f.root);
  let failure;
  try { await f.run(extra); } catch (error) { failure = error; }
  // Check side effects before the error oracle, even if production unexpectedly
  // succeeds or refuses for another reason. No retry can hide partial application.
  assert.deepEqual(snapshot(f.root), before,
    `apply refusal wrote to scratch before failing: ${failure?.message ?? 'unexpected success'}`);
  assert.deepEqual(f.read('truthsrc.ledger.json'), ledger, 'old ledger bytes changed');
  assert.deepEqual(f.read('anchors.json'), anchors, 'old anchor bytes changed');
  assert.equal(existsSync(join(f.out, legalPath)), false, 'earlier legal ADD was written');
  assert.ok(failure instanceof Error, 'unsafe apply unexpectedly succeeded');
  assert.match(failure.message, message);
}

test('core apply emits multiple actual files per knowledge key and retains other generator evidence/ledger rows', async t => {
  const f = fixture(t);
  const otherDir = f.generator('s8-other-generator');
  const otherFile = 'other/Kept.scala';
  const otherSource = 'object Other {}\n';
  f.setArtifacts([artifact(otherFile, otherSource, { noteIds: ['note:other'] })]);
  await f.run({ generatorDir: otherDir });
  const priorIndex = f.index();
  const priorRows = f.ledger().entries;
  // Core must preserve another generator's certificate, not read/recertify its
  // changed source under this generator's authority.
  f.put(`out/${otherFile}`, 'object OtherChangedOutsideThisRun {}\n');
  const artifacts = [
    artifact('domain/Wallet.scala', 'object Wallet {}\n', { noteIds: [KEY, 'note:shared', 'note:shared'] }),
    artifact('application/WalletProtocol.scala', 'object WalletProtocol {}\n', { noteIds: ['note:shared'] }),
    artifact('application/WalletEntity.scala', 'object WalletEntity {}\n', { kind: 'entity', noteIds: ['note:shared'] }),
  ];
  f.setArtifacts(artifacts);
  const result = await f.run();
  assert.equal(result.name, OWNER);
  assert.equal(result.written, 3);
  assert.equal(result.total, 3);
  assert.equal(result.anchors, join(f.out, 'anchors.json'));
  assert.equal(result.ledger, join(f.out, 'truthsrc.ledger.json'));
  assert.deepEqual(result.outcomes.map(item => item.outcome), ['ADD', 'ADD', 'ADD']);
  const index = f.index();
  assert.equal(index.version, ANCHORS_VERSION);
  assert.equal(index.anchors[KEY].length, 4);
  assert.equal(index.anchors['note:shared'].length, 3, 'same key/note repetition must not duplicate locations');
  assert.deepEqual(at(index, KEY, otherFile, 's8-other-generator'), priorIndex.anchors[KEY][0]);
  assert.deepEqual(index.anchors['note:other'], priorIndex.anchors['note:other']);
  assert.deepEqual(f.ledger().entries.find(row => row.path === otherFile), priorRows[0]);
  assert.equal(f.ledger().entries.length, 4);
  for (const item of artifacts) {
    const bytes = f.read(item.path);
    assert.equal(bytes.toString(), item.source);
    fileVerified(at(index, KEY, item.path), bytes, { file: item.path });
    fileVerified(at(index, 'note:shared', item.path), bytes, { file: item.path });
    assert.equal(result.outcomes.find(outcome => outcome.file === item.path).fingerprint, digest(bytes));
  }
});

test('core COVER replaces only this generator/path mapping, keeping other paths and a same-path other owner', async t => {
  const f = fixture(t);
  const path = 'domain/Shared.scala';
  const untouched = 'domain/Untouched.scala';
  f.setArtifacts([
    artifact(path, 'object Old {}\n', { knowledgeId: 'old:shared' }),
    artifact(untouched, 'object Untouched {}\n', { knowledgeId: 'old:untouched' }),
  ]);
  await f.run();
  const otherDir = f.generator('s8-other-generator');
  f.setArtifacts([artifact(path, 'object Old {}\n', { knowledgeId: 'old:shared' })]);
  await f.run({ generatorDir: otherDir });
  const other = at(f.index(), 'old:shared', path, 's8-other-generator');
  const untouchedBytes = f.read(untouched);
  f.setArtifacts([artifact(path, 'object New {}\n', { knowledgeId: 'new:shared' })]);
  const result = await f.run({ concern: f.concern('full') });
  assert.equal(result.written, 1);
  assert.equal(result.outcomes[0].outcome, 'COVER');
  const index = f.index();
  assert.deepEqual(index.anchors['old:shared'], [other]);
  assert.deepEqual(f.read(untouched), untouchedBytes);
  assert.equal(at(index, 'old:untouched', untouched).status, 'source-verified');
  fileVerified(at(index, 'new:shared', path), f.read(path), { file: path });
});

test('core KEEP hashes real out-of-concern bytes, not planned source, while stale old keys remain visible', async t => {
  const f = fixture(t);
  const selected = 'wallet/Protocol.scala';
  const keptPath = 'other/Rules.scala';
  f.setArtifacts([
    artifact(selected, 'object ProtocolV1 {}\n'),
    artifact(keptPath, 'object RulesV1 {}\n', { kind: 'rules', families: ['Other'], knowledgeId: 'old:kept' }),
  ]);
  await f.run();
  const actual = Buffer.from('// hand-owned é\r\nobject ActualRules { val x = 17 }\r\n');
  f.put(`out/${keptPath}`, actual);
  const planned = 'object PlannedRules { val x = 999 }\n';
  f.setArtifacts([
    artifact(selected, 'object ProtocolV2 {}\n'),
    artifact(keptPath, planned, { kind: 'rules', families: ['Other'], knowledgeId: 'new:kept' }),
  ]);
  const result = await f.run({ concern: f.concern() });
  assert.equal(result.written, 1);
  assert.equal(result.kept, 1);
  assert.equal(result.inScope, 1);
  assert.deepEqual(f.read(keptPath), actual);
  const outcome = result.outcomes.find(item => item.file === keptPath);
  assert.equal(outcome.outcome, 'KEEP');
  assert.equal(outcome.fingerprint, digest(actual));
  assert.notEqual(outcome.fingerprint, digest(planned));
  const index = f.index();
  fileVerified(at(index, 'new:kept', keptPath), actual, { file: keptPath });
  noCertification(at(index, 'old:kept', keptPath), 'stale');
  assert.equal(at(index, 'old:kept', keptPath).verification.observedFingerprint, digest(actual));
  assert.equal(f.query('new:kept')[0].freshness, 'current-bytes');
});

test('core MANUAL MERGE certifies exact final content and repeat regeneration is byte-idempotent', async t => {
  const f = fixture(t);
  f.setArtifacts([artifact(ownedPath, shell(1))]);
  await f.run();
  const manual = 'customRank("é", state) // human-owned';
  const oldHandSource = shell(1, manual);
  f.put(`out/${ownedPath}`, oldHandSource);
  const planned = shell(2, 'newGeneratedDefault()');
  const final = shell(2, manual);
  f.setArtifacts([artifact(ownedPath, planned)]);
  const result = await f.run();
  assert.equal(result.written, 1);
  assert.equal(result.merged, 1);
  assert.equal(result.outcomes[0].outcome, 'MERGE');
  assert.equal(f.read(ownedPath).toString(), final);
  assert.equal(result.outcomes[0].fingerprint, digest(Buffer.from(final)));
  assert.notEqual(result.outcomes[0].fingerprint, digest(planned));
  assert.notEqual(result.outcomes[0].fingerprint, digest(oldHandSource));
  fileVerified(at(f.index(), KEY, ownedPath), Buffer.from(final), { file: ownedPath });
  const oldIndex = f.read('anchors.json');
  const oldLedger = f.read('truthsrc.ledger.json');
  const oldSource = snapshot(join(f.out, '01-existing'));
  const repeated = await f.run();
  assert.equal(repeated.written, 0);
  assert.equal(repeated.merged, 0);
  assert.equal(repeated.identical, 1);
  assert.equal(repeated.outcomes[0].outcome, 'IDENTICAL');
  assert.deepEqual(f.read('anchors.json'), oldIndex);
  assert.deepEqual(f.read('truthsrc.ledger.json'), oldLedger);
  assert.deepEqual(snapshot(join(f.out, '01-existing')), oldSource, 'identical source must not be rewritten');
});

test('core generated anchors query edits/deletion/rename as stale or unmapped without guessing a new path', async t => {
  const f = fixture(t);
  const changed = 'src/Changed.scala';
  const deleted = 'src/Deleted.scala';
  const renamed = 'src/Before.scala';
  const after = 'src/After.scala';
  f.setArtifacts([changed, deleted, renamed].map(path => artifact(path, `// ${path}\nobject Fixture {}\n`)));
  await f.run();
  const oldIndex = f.read('anchors.json');
  const editedSource = 'object ChangedByHuman {}\n';
  f.put(`out/${changed}`, editedSource);
  rmSync(join(f.out, deleted));
  renameSync(join(f.out, renamed), join(f.out, after));
  const beforeQuery = snapshot(f.root);
  const queried = f.query(KEY);
  noCertification(queried.find(item => item.file === changed), 'stale');
  noCertification(queried.find(item => item.file === deleted), 'unmapped');
  noCertification(queried.find(item => item.file === renamed), 'unmapped');
  assert.equal(queried.some(item => item.file === after), false);
  assert.deepEqual(snapshot(f.root), beforeQuery, 'query must remain read-only');
  assert.deepEqual(f.read('anchors.json'), oldIndex);
  const renamedBytes = f.read(after);
  f.setArtifacts([artifact(after, renamedBytes.toString())]);
  const result = await f.run();
  assert.equal(result.written, 0);
  assert.equal(result.identical, 1);
  const index = f.index();
  noCertification(at(index, KEY, changed), 'stale');
  noCertification(at(index, KEY, deleted), 'unmapped');
  noCertification(at(index, KEY, renamed), 'unmapped');
  fileVerified(at(index, KEY, after), renamedBytes, { file: after });
  assert.equal(existsSync(join(f.out, deleted)), false);
  assert.equal(existsSync(join(f.out, renamed)), false);
  assert.equal(f.read(changed).toString(), editedSource, 'unplanned human source must not be deleted or covered');
});

test('core migrates legacy single-value anchors as planned and discards old fingerprint/span/certification', async t => {
  const f = fixture(t);
  const oldFile = 'legacy/Old.scala';
  const oldBytes = 'object Old {}\n';
  f.put(`out/${oldFile}`, oldBytes);
  f.put('out/anchors.json', JSON.stringify({
    [KEY]: oldFile,
    'old:claims': {
      file: oldFile, module: 'legacy', symbol: 'InventedSymbol',
      span: { start: 0, end: 6, text: 'object' }, fingerprint: digest(oldBytes),
      status: 'source-verified', verification: { symbolVerified: true },
    },
  }));
  const newFile = 'src/New.scala';
  f.setArtifacts([artifact(newFile, 'object New {}\n')]);
  const result = await f.run();
  assert.equal(result.written, 1);
  const index = f.index();
  assert.equal(index.version, ANCHORS_VERSION);
  assert.equal(index.migration.from, 'legacy-single-value');
  assert.equal(index.migration.verification, 'discarded');
  assert.equal(index.anchors[KEY].length, 2);
  for (const key of [KEY, 'old:claims']) {
    const old = at(index, key, oldFile, 'legacy');
    noCertification(old, 'planned');
    assert.equal(old.fingerprint, null);
    assert.equal(old.span, null);
    assert.equal(old.verification.reason, 'legacy-unverified');
  }
  assert.equal(f.read(oldFile).toString(), oldBytes);
  fileVerified(at(index, KEY, newFile), f.read(newFile), { file: newFile });
  const queried = f.query('old:claims')[0];
  noCertification(queried, 'planned');
  assert.equal(queried.observedFingerprint, digest(oldBytes));
});

test('core without a source parser cannot authenticate entry-supplied or textual symbol/module/span claims', async t => {
  const f = fixture(t);
  const source = 'export function RealSymbol() {}\n';
  f.setArtifacts(['RealSymbol', 'AbsentSymbol'].map(symbol => artifact(`src/${symbol}.mjs`, source, {
    module: 'claimed-module', symbol,
    span: { start: 16, end: 26, text: 'RealSymbol' },
    fingerprint: digest(source), expectedFingerprint: digest(source), status: 'source-verified',
    verification: { level: 'symbol', method: 'claimed-template-parser', symbolVerified: true },
  })));
  await f.run();
  const index = f.index();
  assert.equal(index.anchors[KEY].length, 2);
  for (const location of index.anchors[KEY]) {
    fileVerified(location, f.read(location.file), { file: location.file });
  }
  for (const location of f.query(KEY)) {
    assert.equal(location.verification.level, 'file');
    assert.equal(location.verification.symbolVerified, false);
    assert.equal(location.symbol, null);
    assert.equal(location.freshness, 'current-bytes');
  }
});

test('core dependency closure legitimately COVERs a different kind and fingerprints both final sources', async t => {
  const f = fixture(t);
  function artifacts(version) {
    return [
      artifact('src/Protocol.scala', `object ProtocolV${version} {}\n`, { deps: ['Entity'] }),
      artifact('src/Entity.scala', `object EntityV${version} {}\n`, { kind: 'entity', schemaNode: 'Entity' }),
    ];
  }
  f.setArtifacts(artifacts(1));
  await f.run();
  f.setArtifacts(artifacts(2));
  const result = await f.run({ concern: f.concern() });
  assert.equal(result.inScope, 2);
  assert.equal(result.closureAdded, 1);
  assert.equal(result.written, 2);
  assert.equal(result.kept, 0);
  assert.deepEqual(result.outcomes.map(item => item.outcome), ['COVER', 'COVER']);
  for (const item of artifacts(2)) {
    assert.equal(f.read(item.path).toString(), item.source);
    fileVerified(at(f.index(), KEY, item.path), f.read(item.path), { file: item.path });
  }
});

test('core missing routes cannot certify planned bytes; subsequent marker MERGE hashes the whole real file', async t => {
  const f = fixture(t);
  const routePath = 'conf/routes';
  const block = '# >>> gen_api_layer (E301) >>>\nGET /generated controllers.Generated.index\n# <<< gen_api_layer <<<';
  f.setArtifacts([
    artifact('src/Legal.scala', 'object Legal {}\n'),
    artifact(routePath, block, { kind: 'routes', merge: 'markers', noLedger: true, families: [], knowledgeId: 'api:route' }),
  ]);
  const missing = await f.run();
  assert.equal(missing.written, 1);
  assert.equal(missing.routesNoTarget, 1);
  assert.equal(existsSync(join(f.out, routePath)), false);
  const outcome = missing.outcomes.find(item => item.file === routePath);
  assert.equal(outcome.outcome, 'MISSING');
  assert.equal(Object.hasOwn(outcome, 'fingerprint'), false);
  noCertification(at(f.index(), 'api:route', routePath), 'unmapped');
  const oldBlock = block.replace('/generated', '/old');
  const head = '# human routing head\nGET /manual controllers.Manual.index\n';
  const tail = '\n# human routing tail\n';
  f.put(`out/${routePath}`, head + oldBlock + tail);
  const merged = await f.run();
  const final = head + block + tail;
  assert.equal(merged.written, 1);
  assert.equal(merged.outcomes.find(item => item.file === routePath).outcome, 'MERGE');
  assert.equal(f.read(routePath).toString(), final);
  const anchor = at(f.index(), 'api:route', routePath);
  fileVerified(anchor, Buffer.from(final), { file: routePath });
  assert.notEqual(anchor.fingerprint, digest(block));
  assert.equal(f.ledger().entries.some(row => row.path === routePath), false);
});

test('core identical reapply preserves multivalued anchor/ledger bytes and never rewrites source files', async t => {
  const f = fixture(t);
  f.setArtifacts([
    artifact('domain/One.scala', 'object One {}\n', { noteIds: ['note:one'] }),
    artifact('application/Two.scala', 'object Two {}\n', { noteIds: ['note:one'] }),
  ]);
  await f.run();
  const anchors = f.read('anchors.json');
  const ledger = f.read('truthsrc.ledger.json');
  const domain = snapshot(join(f.out, 'domain'));
  const application = snapshot(join(f.out, 'application'));
  for (let i = 0; i < 2; i++) {
    const result = await f.run();
    assert.equal(result.written, 0);
    assert.equal(result.identical, 2);
    assert.deepEqual(result.outcomes.map(item => item.outcome), ['IDENTICAL', 'IDENTICAL']);
    assert.deepEqual(f.read('anchors.json'), anchors);
    assert.deepEqual(f.read('truthsrc.ledger.json'), ledger);
    assert.deepEqual(snapshot(join(f.out, 'domain')), domain);
    assert.deepEqual(snapshot(join(f.out, 'application')), application);
  }
});

const pathCases = [
  ['exact duplicate full paths', () => ['z/Duplicate.scala', 'z/Duplicate.scala'], /duplicate\/case-fold output path/],
  ['case-fold full path duplicate', () => ['z/Case.scala', 'z/case.scala'], /duplicate\/case-fold output path/],
  ['case-fold ancestor with distinct leaf names', () => ['z/Module/One.scala', 'z/module/Two.scala'], /case-fold path component alias/],
  ['NFC-equivalent ancestor aliases', () => ['z/Café/One.scala', 'z/Café/Two.scala'], /case-fold path component alias/],
  ['file/directory collision on absent targets', () => ['z/Block', 'z/Block/Child.scala'], /file\/directory output collision/],
  ['parent traversal', () => ['z/../../outside/escaped.scala'], /unsafe entry path/],
  ['dot path component', () => ['z/./Dot.scala'], /unsafe entry path/],
  ['empty path component', () => ['z//Double.scala'], /unsafe entry path/],
  ['trailing separator', () => ['z/Trailing/'], /unsafe entry path/],
  ['POSIX absolute path', f => [join(f.root, 'outside/absolute.scala')], /unsafe entry path/],
  ['Windows absolute path', () => ['C:/outside/Absolute.scala'], /unsafe entry path/],
  ['backslash path', () => ['z\\Outside.scala'], /unsafe entry path/],
  ['NUL path', () => ['z/Null\0.scala'], /unsafe entry path/],
  ['reserved ledger path without anchor metadata', () => ['truthsrc.ledger.json'], /reserved apply receipt path/],
  ['reserved anchor index path without anchor metadata', () => ['anchors.json'], /reserved apply receipt path/],
  ['case alias of reserved ledger', () => ['TRUTHSRC.LEDGER.JSON'], /reserved apply receipt path/],
  ['case alias of reserved anchors', () => ['ANCHORS.JSON'], /reserved apply receipt path/],
  ['nested anchors self-reference', () => ['z/nested/anchors.json'], /cannot anchor themselves/],
  ['source-map self-reference', () => ['z/app.source-map.json'], /cannot anchor themselves/],
  ['map self-reference', () => ['z/app.js.map'], /cannot anchor themselves/],
];
for (const [name, paths, message] of pathCases) {
  test(`core preflight zero writes: ${name} (earlier legal ADD/MERGE and old receipts untouched)`, async t => {
    const f = await refusalFixture(t);
    const bad = paths(f).map(path => artifact(path, 'object Unsafe {}\n',
      /^(?:anchors\.json|truthsrc\.ledger\.json)$/i.test(path) ? { knowledgeId: undefined } : {}));
    await refusesWithoutWrites(f, [...legalEntries(), ...bad], message);
  });
}

const filesystemCases = [
  ['existing leaf case alias', f => {
    f.put('out/z/Actual.scala', 'old actual bytes');
    return 'z/actual.scala';
  }, /case-fold filesystem alias/],
  ['existing ancestor case alias', f => {
    f.put('out/z/Module/Existing.scala', 'old existing bytes');
    return 'z/module/New.scala';
  }, /case-fold filesystem alias/],
  ['existing non-directory ancestor', f => {
    f.put('out/z/Block', 'not a directory');
    return 'z/Block/New.scala';
  }, /non-directory path component/],
  ['existing directory as file target', f => {
    mkdirSync(join(f.out, 'z/Directory'), { recursive: true });
    return 'z/Directory';
  }, /regular file|file\/directory output collision/],
  ['inside leaf symlink', f => {
    const target = f.put('out/z/Target.scala', 'inside link target');
    symlinkSync(target, join(f.out, 'z/Link.scala'));
    return 'z/Link.scala';
  }, /symlink apply path/],
  ['escaping leaf symlink', f => {
    const target = f.put('outside/Target.scala', 'outside link target');
    mkdirSync(join(f.out, 'z'), { recursive: true });
    symlinkSync(target, join(f.out, 'z/Link.scala'));
    return 'z/Link.scala';
  }, /symlink apply path/],
  ['inside ancestor symlink', f => {
    f.put('out/real/Existing.scala', 'inside ancestor target');
    symlinkSync(join(f.out, 'real'), join(f.out, 'z-linked'));
    return 'z-linked/New.scala';
  }, /symlink apply path/],
  ['escaping ancestor symlink', f => {
    f.put('outside/Existing.scala', 'outside ancestor target');
    symlinkSync(join(f.root, 'outside'), join(f.out, 'z-linked'));
    return 'z-linked/New.scala';
  }, /symlink apply path/],
  ['dangling leaf symlink', f => {
    mkdirSync(join(f.out, 'z'), { recursive: true });
    symlinkSync(join(f.root, 'outside/Absent.scala'), join(f.out, 'z/Dangling.scala'));
    return 'z/Dangling.scala';
  }, /symlink apply path/],
  ['hardlink to a source outside the owned outDir with no second planned alias', f => {
    const target = f.put('outside/External.scala', 'external bytes must not change');
    mkdirSync(join(f.out, 'z'), { recursive: true });
    linkSync(target, join(f.out, 'z/ExternalLink.scala'));
    return 'z/ExternalLink.scala';
  }, /hardlink apply target/],
  ['hardlink to prior ledger source', f => {
    mkdirSync(join(f.out, 'z'), { recursive: true });
    linkSync(join(f.out, ownedPath), join(f.out, 'z/Linked.scala'));
    return 'z/Linked.scala';
  }, /hardlink (?:output alias|apply target)/],
  ['hardlink to ledger receipt', f => {
    mkdirSync(join(f.out, 'z'), { recursive: true });
    linkSync(join(f.out, 'truthsrc.ledger.json'), join(f.out, 'z/Linked.scala'));
    return 'z/Linked.scala';
  }, /hardlink (?:output alias|apply target)/],
  ['hardlink to anchor receipt', f => {
    mkdirSync(join(f.out, 'z'), { recursive: true });
    linkSync(join(f.out, 'anchors.json'), join(f.out, 'z/Linked.scala'));
    return 'z/Linked.scala';
  }, /hardlink (?:output alias|apply target)/],
];
for (const [name, setup, message] of filesystemCases) {
  test(`core filesystem preflight zero writes: ${name}`, async t => {
    const f = await refusalFixture(t);
    const path = setup(f);
    await refusesWithoutWrites(f, [...legalEntries(), artifact(path, 'object Unsafe {}\n')], message);
  });
}

test('core zero writes for hardlink aliases between two incoming full paths', async t => {
  const f = await refusalFixture(t);
  const source = f.put('out/z/One.scala', 'same hardlinked bytes');
  linkSync(source, join(f.out, 'z/Two.scala'));
  await refusesWithoutWrites(f, [
    ...legalEntries(), artifact('z/One.scala', 'object One {}\n'), artifact('z/Two.scala', 'object Two {}\n'),
  ], /hardlink (?:output alias|apply target)/);
});

for (const receipt of ['truthsrc.ledger.json', 'anchors.json']) {
  test(`core zero writes when ${receipt} itself is a symlink`, async t => {
    const f = await refusalFixture(t);
    const bytes = f.read(receipt);
    const target = f.put(`outside/${receipt}`, bytes);
    rmSync(join(f.out, receipt));
    symlinkSync(target, join(f.out, receipt));
    await refusesWithoutWrites(f, legalEntries(), /symlink apply path/);
  });
  test(`core zero writes when ${receipt} has a filesystem case alias`, async t => {
    const f = await refusalFixture(t);
    renameSync(join(f.out, receipt), join(f.out, receipt.toUpperCase()));
    // Reading the original-case receipt for the general helper would itself be
    // filesystem-dependent. Here compare the entire tree, including both receipts.
    f.setArtifacts(legalEntries());
    const before = snapshot(f.root);
    let failure;
    try { await f.run(); } catch (error) { failure = error; }
    assert.deepEqual(snapshot(f.root), before);
    assert.equal(existsSync(join(f.out, legalPath)), false);
    assert.ok(failure instanceof Error);
    assert.match(failure.message, /case-fold filesystem alias/);
  });
}

test('core zero writes for a symlink outDir root, even when its target is owned scratch', async t => {
  const f = await refusalFixture(t);
  const alias = join(f.root, 'out-alias');
  symlinkSync(f.out, alias);
  await refusesWithoutWrites(f, legalEntries(), /symlink apply path/, { outDir: alias });
});

test('core preflight validates unsafe prior ledger paths before any legal output write', async t => {
  const f = await refusalFixture(t);
  const ledger = f.ledger();
  ledger.entries.push({ path: 'z/../../outside/prior.scala', kind: 'protocol', families: [], deps: [] });
  f.put('out/truthsrc.ledger.json', JSON.stringify(ledger));
  await refusesWithoutWrites(f, legalEntries(), /unsafe entry path/);
});

test('core preflight validates case aliases in retained prior ledger rows', async t => {
  const f = await refusalFixture(t);
  f.put('out/z/Actual.scala', 'unplanned source');
  const ledger = f.ledger();
  ledger.entries.push({ path: 'z/actual.scala', kind: 'protocol', families: [], deps: [] });
  f.put('out/truthsrc.ledger.json', JSON.stringify(ledger));
  await refusesWithoutWrites(f, legalEntries(), /case-fold filesystem alias/);
});

test('core preflight validates unplanned own prior anchor paths as well as incoming entries', async t => {
  const f = await refusalFixture(t);
  const index = f.index();
  const prior = index.anchors['old:owned'][0];
  f.put('outside/Prior.scala', 'unplanned prior source');
  symlinkSync(join(f.root, 'outside/Prior.scala'), join(f.out, 'z-prior.scala'));
  prior.file = 'z-prior.scala';
  f.put('out/anchors.json', JSON.stringify(index));
  await refusesWithoutWrites(f, legalEntries(), /symlink apply path/);
});

test('core zero writes when own prior anchor claims a repository outside this outDir', async t => {
  const f = await refusalFixture(t);
  const index = f.index();
  index.anchors['old:owned'][0].repo = join(f.root, 'not-the-owned-outdir');
  f.put('out/anchors.json', JSON.stringify(index));
  await refusesWithoutWrites(f, legalEntries(), /prior generator anchor outside owned outDir/);
});

const badManualCases = [
  ['incoming unmatched BEGIN', '// ==== BEGIN MANUAL ====\nbody\n'],
  ['incoming unmatched END', '// ==== END MANUAL ====\n'],
  ['incoming reversed markers', '// ==== END MANUAL ====\nbody\n// ==== BEGIN MANUAL ====\n'],
  ['incoming nested markers', '// ==== BEGIN MANUAL ====\n// ==== BEGIN MANUAL ====\nbody\n// ==== END MANUAL ====\n// ==== END MANUAL ====\n'],
];
for (const [name, malformed] of badManualCases) {
  test(`core late MANUAL refusal zero writes: ${name}`, async t => {
    const f = await refusalFixture(t);
    await refusesWithoutWrites(f, [...legalEntries(), artifact('z/Bad.scala', malformed)], /MANUAL.*畸形/);
  });
}

test('core late MANUAL orphan refusal leaves earlier legal ADD/MERGE and old receipts untouched', async t => {
  const f = await refusalFixture(t);
  f.put('out/z/Orphan.scala', shell(1, 'humanBodyMustSurvive()'));
  const renamedMethod = shell(2).replace('def applyFor(', 'def renamedMethod(');
  await refusesWithoutWrites(f, [...legalEntries(), artifact('z/Orphan.scala', renamedMethod)], /手写块无落点/);
});

for (const outcome of ['KEEP', 'IDENTICAL']) {
  test(`core late malformed existing MANUAL is checked even for prospective ${outcome}`, async t => {
    const f = await refusalFixture(t);
    const malformed = '// ==== BEGIN MANUAL ====\nhumanBody\n';
    f.put('out/z/BadExisting.scala', malformed);
    const incoming = artifact('z/BadExisting.scala', outcome === 'KEEP' ? 'object Planned {}\n' : malformed,
      outcome === 'KEEP' ? { kind: 'rules', families: ['Other'] } : {});
    await refusesWithoutWrites(f, [...legalEntries(), incoming], /MANUAL.*畸形/,
      outcome === 'KEEP' ? { concern: f.concern() } : {});
  });
}

test('core late scope leak refuses a missing out-of-concern family file before all earlier writes', async t => {
  const f = await refusalFixture(t);
  await refusesWithoutWrites(f, [
    ...legalEntries(),
    artifact('z/OutOfScope.scala', 'object OutOfScope {}\n', { kind: 'rules', families: ['Other'] }),
  ], /scope leak.*z\/OutOfScope\.scala/, { concern: f.concern() });
});

test('core late malformed incoming routes block refuses all earlier writes', async t => {
  const f = await refusalFixture(t);
  await refusesWithoutWrites(f, [
    ...legalEntries(), artifact('z/routes', '# >>> gen_api_layer (E301) >>>\nGET /bad Bad.index', {
      kind: 'routes', merge: 'markers', noLedger: true, families: [], knowledgeId: 'api:bad',
    }),
  ], /malformed incoming routes marker block/);
});

test('core invalid final entry on an absent outDir does not create even its parent directory', async t => {
  const f = fixture(t);
  const absentOut = join(f.root, 'absent-parent', 'out');
  f.setArtifacts([artifact(legalPath, 'object Legal {}\n'), artifact('z/../unsafe.scala', 'object Unsafe {}\n')]);
  const before = snapshot(f.root);
  let failure;
  try { await f.run({ outDir: absentOut }); } catch (error) { failure = error; }
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(existsSync(dirname(absentOut)), false);
  assert.ok(failure instanceof Error);
  assert.match(failure.message, /unsafe entry path/);
});
