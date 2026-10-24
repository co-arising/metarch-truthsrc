import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTree } from '../lib/compile.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { compileSagas } from '../lib/saga/compile.mjs';
import { lowerSagaRuntimeBindingV3 } from '../lib/saga/runtime-binding.mjs';
import { apply } from '../src/core/generate.mjs';
import { queryAnchorsIndex } from '../lib/anchor-query.mjs';
import { anchors, buildGraph } from '../lib/query.mjs';
import { buildGraphStore, graphFromStore } from '../lib/graphstore.mjs';

// 1:N re-anchor certification (P7): the serial money-transfer truth tree is the ONE
// source; its strict-contract artifacts are the N anchored locations. Everything runs
// through the real public surfaces — compileTree → core apply (ledger + anchors.json)
// → anchor fingerprint verification → graph store — inside this test's scratch root.
// Honest markers are asserted, never rewritten: contract-only, runnable=false.
const EXAMPLE = new URL('../example/saga-money-transfer-serial/', import.meta.url);
const TREE = new URL('tree/', EXAMPLE);
// Cross-pipeline identity: the same definition digest the scala pipeline (backkend-codegen
// r13) quotes in the generated SagaModule — one tree, two pipelines, one digest.
const DEFINITION_DIGEST = 'sha256:3a586c81b1a9af9a2cadfdc66306bc06ce063c1b37989985b5568c88fed9971d';
// The contract artifact's inputDigest carries the bare compileSagas IR digest (no prefix).
const IR_DIGEST = 'ba60f58a679aad1a2c1ccdc388b92db7d7bdc9021ee2de2879ae09a1758e3066';

const json = (url) => JSON.parse(readFileSync(url, 'utf8'));
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function fixture(t) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'truthsrc-saga-strict-anchors-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const canonicalFile = join(directory, 'canonical.json');
  writeFileSync(canonicalFile, compileTree(fileURLToPath(TREE)));
  return { directory, canonicalFile, canonical: readJson(canonicalFile), binding: json(new URL('bindings.json', EXAMPLE)) };
}

function dereferencePointer(document, pointer) {
  let value = document;
  for (const raw of pointer.split('/').slice(1)) {
    const token = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (value == null || typeof value !== 'object') throw new Error(`unresolvable pointer: ${pointer}`);
    value = value[token];
  }
  return value;
}

test('strict-contract generation anchors one saga to N fingerprint-verified artifacts', async (t) => {
  const { directory, canonicalFile, canonical, binding } = fixture(t);
  const compiled = compileSagas(canonical, binding);
  assert.deepEqual(compiled.diagnostics, []);
  const optionsFile = join(directory, 'options.json');
  writeFileSync(optionsFile, JSON.stringify({ mode: 'strict-contract', binding }));

  const out = join(directory, 'app');
  const result = await apply({ canonicalFile, generatorDir: fileURLToPath(new URL('../generators/saga-dsl/', import.meta.url)), outDir: out, options: { mode: 'strict-contract', binding } });
  assert.equal(result.total, 3);
  assert.equal(result.written, 3);

  // ── face 1: 1:N — one knowledge key, N real locations ──
  const index = readJson(join(out, 'anchors.json'));
  const locations = index.anchors['saga:money-transfer'];
  assert.ok(Array.isArray(locations) && locations.length === 3, JSON.stringify(Object.keys(index.anchors)));
  assert.deepEqual(locations.map(l => l.file).sort(), [
    'contracts/sagas/money-transfer.contract.json',
    'contracts/sagas/money-transfer.consumption.json',
    'contracts/sagas/money-transfer.phases.json',
  ].sort());
  assert.ok(locations.every(l => l.generator === 'saga-dsl' && l.status === 'source-verified'));

  // ── face 2: every location re-verifies against current bytes right now ──
  const verified = queryAnchorsIndex('saga:money-transfer', {
    indexFile: join(out, 'anchors.json'),
    repoRoots: { [out]: out },
  });
  assert.equal(verified.length, 3);
  assert.ok(verified.every(l => l.status === 'source-verified'), JSON.stringify(verified.map(l => l.status)));

  // ── face 3: honest markers are in the artifacts, never upgraded ──
  const contract = readJson(join(out, 'contracts/sagas/money-transfer.contract.json'));
  assert.equal(contract.readiness, 'contract-only');
  assert.equal(contract.runnable, false);
  assert.equal(contract.runtimeBindingVerified, false);
  assert.equal(contract.inputDigest, IR_DIGEST);
  const consumption = readJson(join(out, 'contracts/sagas/money-transfer.consumption.json'));
  assert.deepEqual(consumption.blocked, ['runtime-api-shape-unverified', 'no-strict-runnable-source']);
  assert.ok(consumption.runtimeRequirements.length > 0);
  assert.ok(consumption.runtimeRequirements.every(r => r.verification === 'unverified'));

  // ── face 4: ledger lineage navigates — every consumed pointer resolves in its document ──
  for (const row of consumption.consumed) {
    const document = row.source.document === 'canonical' ? canonical : binding;
    assert.notEqual(dereferencePointer(document, row.source.pointer), undefined, row.pointer);
  }

  // ── face 5: cross-pipeline digest — same definition the scala pipeline quotes ──
  const runtimeBinding = json(new URL('runtime-binding.json', EXAMPLE));
  const { ir } = compiled;
  const lowered = lowerSagaRuntimeBindingV3({ canonical, binding, runtimeBinding, ir });
  assert.deepEqual(lowered.diagnostics, []);
  assert.equal(lowered.plan.readiness, 'lowered-contract-only');
  assert.equal(lowered.plan.runnable, false);
  assert.equal(lowered.plan.runtimeBindingVerified, false);
  assert.equal(lowered.plan.sagas[0].definitionDigest, DEFINITION_DIGEST);
});

test('anchors reach back to the truth tree: roundtrip identity and the saga atom file', async (t) => {
  const { directory, canonicalFile, canonical, binding } = fixture(t);
  // I2: the anchored projection cannot drift from the tree it came from.
  const r = roundtrip(fileURLToPath(TREE));
  assert.equal(r.ok, true, `${r.stage}: ${r.msg}`);
  // I1: the canonical the anchors and the store derive from is byte-deterministic.
  const first = compileTree(fileURLToPath(TREE));
  assert.equal(compileTree(fileURLToPath(TREE)), first);
  // The knowledge key names a real tree atom: the saga yaml the key is derived from.
  const atom = fileURLToPath(new URL('tree/sagas/money-transfer.saga.yaml', EXAMPLE));
  assert.ok(existsSync(atom));

  const out = join(directory, 'app');
  await apply({ canonicalFile, generatorDir: fileURLToPath(new URL('../generators/saga-dsl/', import.meta.url)), outDir: out, options: { mode: 'strict-contract', binding } });
  // Graph + anchor convergence: the reopened local graph store answers the anchors
  // verb from the same index and reports the locations source-verified.
  const store = join(directory, 'graph.db');
  buildGraphStore(canonical, { file: store });
  const stored = graphFromStore(store);
  assert.ok(stored.nodes.has('saga:money-transfer'));
  assert.deepStrictEqual(stored, buildGraph(canonical));
  const report = anchors(stored, 'saga', 'money-transfer', {
    indexFile: join(out, 'anchors.json'),
    repoRoots: { [out]: out },
  });
  assert.match(report.summary, /3 recorded locations \(source-verified\)/);
});

test('regeneration is byte-deterministic and the anchor index follows the bytes', async (t) => {
  const { directory, canonicalFile, canonical, binding } = fixture(t);
  const generatorDir = fileURLToPath(new URL('../generators/saga-dsl/', import.meta.url));
  const first = join(directory, 'one'), second = join(directory, 'two');
  await apply({ canonicalFile, generatorDir, outDir: first, options: { mode: 'strict-contract', binding } });
  await apply({ canonicalFile, generatorDir, outDir: second, options: { mode: 'strict-contract', binding } });
  for (const artifact of ['contracts/sagas/money-transfer.contract.json',
    'contracts/sagas/money-transfer.phases.json', 'contracts/sagas/money-transfer.consumption.json']) {
    assert.equal(readFileSync(join(first, artifact), 'utf8'), readFileSync(join(second, artifact), 'utf8'), artifact);
  }
  const normalize = (dir) => {
    const index = readJson(join(dir, 'anchors.json'));
    for (const locations of Object.values(index.anchors)) for (const l of locations) l.repo = '<out>';
    return index;
  };
  assert.deepEqual(normalize(first), normalize(second));
});

test('two pipelines, two owned indexes: the union answers one key across both repositories', async (t) => {
  const { directory, canonicalFile, canonical, binding } = fixture(t);
  const out = join(directory, 'app');
  await apply({ canonicalFile, generatorDir: fileURLToPath(new URL('../generators/saga-dsl/', import.meta.url)), outDir: out, options: { mode: 'strict-contract', binding } });
  // A scala-pipeline (backkend-codegen) shaped index in a separate repo root: generated
  // source files, 'codegen-main' rows carrying the definition digest the scala
  // SagaModule quotes. Hand-written here to certify the query union without a scala
  // build; the real generator emits this same shape (batch P8 stage 2).
  const app = join(directory, 'scala-app');
  mkdirSync(join(app, 'app', 'fixture'), { recursive: true });
  const scalaFiles = ['SagaModule.scala', 'ArgsCodec.scala', 'FixtureHost.scala'];
  for (const name of scalaFiles) writeFileSync(join(app, 'app', 'fixture', name), `object ${name.replace('.scala', '')}\n`);
  const scalaLocations = scalaFiles.map(name => ({ repo: app, file: `app/fixture/${name}`, module: null, symbol: null, span: null,
    generator: 'codegen-main', generatorVersion: 'p8-anchors-20261024',
    fingerprint: `sha256:${createHash('sha256').update(readFileSync(join(app, 'app', 'fixture', name))).digest('hex')}`,
    status: 'source-verified', definitionDigest: DEFINITION_DIGEST,
    verification: { method: 'sha256-bytes', level: 'file', fileVerified: true, symbolVerified: false, spanVerified: false } }));
  const scalaIndex = join(app, 'anchors.json');
  writeFileSync(scalaIndex, JSON.stringify({ version: 'truthsrc.anchors/v1', anchors: { 'saga:money-transfer': scalaLocations } }, null, 2));

  const options = { indexFile: [join(out, 'anchors.json'), scalaIndex], repoRoots: { [out]: out, [app]: app } };
  const union = queryAnchorsIndex('saga:money-transfer', options);
  assert.equal(union.length, 6);
  assert.ok(union.every(l => l.status === 'source-verified'), JSON.stringify(union.map(l => l.status)));
  const fromScala = union.filter(l => l.generator === 'codegen-main');
  assert.equal(fromScala.length, 3);
  assert.ok(fromScala.every(l => l.definitionDigest === DEFINITION_DIGEST));
  // Cross-pipeline reconciliation is machine-checkable end to end: the js pipeline's
  // lowered plan and every scala row pin the same definition digest.
  const { ir } = compileSagas(canonical, binding);
  const lowered = lowerSagaRuntimeBindingV3({ canonical, binding, runtimeBinding: json(new URL('runtime-binding.json', EXAMPLE)), ir });
  assert.equal(lowered.plan.sagas[0].definitionDigest, fromScala[0].definitionDigest);
  // The same union through the public anchors verb keeps the aggregate honest.
  const report = anchors(buildGraph(canonical), 'saga', 'money-transfer', options);
  assert.match(report.summary, /6 recorded locations \(source-verified\)/);
  // Tampering with one scala source flips exactly that location to stale — nothing else.
  writeFileSync(join(app, 'app', 'fixture', 'ArgsCodec.scala'), 'object ArgsCodec // edited\n');
  const afterEdit = queryAnchorsIndex('saga:money-transfer', options);
  assert.deepEqual(afterEdit.map(l => l.status).sort(),
    ['source-verified', 'source-verified', 'source-verified', 'source-verified', 'source-verified', 'stale']);
  const edited = afterEdit.find(l => l.status === 'stale');
  assert.equal(edited.file, 'app/fixture/ArgsCodec.scala');
  assert.equal(edited.verification.reason, 'source-fingerprint-changed');
});
