import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { applyEntries } from '../src/core/generate.mjs';
import { readAnchorsIndex } from '../src/core/anchors.mjs';
import { queryAnchorsIndex } from '../lib/anchor-query.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fab = join(root, 'example/fab-split-merge');
const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const scratch = () => realpathSync(mkdtempSync(join(tmpdir(), 'p18-run-all-anchors-')));
const read = path => readAnchorsIndex(readFileSync(path, 'utf8'));
const key = 'pipeline:fab-split-child-merge';
const childKey = 'pipeline:fab-child-process';
const child = 'app/fixture/composition/FabChildProcessPlan.scala';

function runAll(out, extra = []) {
  const result = spawnSync(process.execPath, [join(root, 'generators/run-all.mjs'), join(fab, 'tree'), out,
    '--binding', join(root, 'generators/bindings'), '--package', 'net.imadz.fab', ...extra],
  { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.error, undefined, String(result.error));
  return result;
}

test('public run-all emits real Scala sources with four keys, exact hashes and repeat-stable index', () => {
  const out = join(scratch(), 'app');
  let result = runAll(out);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const bootstrap = readFileSync(join(out, 'app/net/imadz/fab/infrastructure/bootstrap/ApplicationBootstrap.scala'), 'utf8');
  const entries = JSON.parse(readFileSync(join(fab, 'bindings.json'), 'utf8')).sagas.map(saga => saga.engine.entrypoint);
  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assert(bootstrap.includes(entry + '.spawnClusterSingleton(system, sharding,'));
    assert(bootstrap.includes(entry + '.installEventSource(system, sharding,'));
  }
  assert(!bootstrap.includes('ConceptDeltaAdjudicator') && !bootstrap.includes('ContentFingerprintPort'));
  const index = read(join(out, 'anchors.json'));
  assert.deepEqual(Object.keys(index.anchors).sort(), [key, childKey, 'saga:fab-merge', 'saga:fab-split'].sort());
  assert.equal(index.anchors['saga:fab-split'].length, 8);
  assert.equal(index.anchors['saga:fab-merge'].length, 8);
  assert.equal(index.anchors[key].length, 4);
  assert.deepEqual(index.anchors[childKey].map(row => row.file), [child]);
  const rows = Object.values(index.anchors).flat();
  assert.equal(rows.length, 21);
  assert.equal(new Set(rows.map(row => row.file)).size, 20);
  for (const row of rows) {
    assert.equal(row.generator, 'truthsrc-run-all');
    assert.equal(row.status, 'source-verified');
    assert.equal(row.fingerprint, digest(readFileSync(join(out, row.file))));
    assert.equal(row.verification.level, 'file');
    assert.equal(row.verification.symbolVerified, false);
    assert.equal(row.module, null); assert.equal(row.symbol, null); assert.equal(row.span, null);
  }
  for (const row of [...index.anchors[key], ...index.anchors[childKey]]) assert.equal(row.definitionDigest, undefined);
  for (const row of index.anchors['saga:fab-split']) assert.match(row.definitionDigest, /^sha256:86da085f/);
  const before = readFileSync(join(out, 'anchors.json'));
  result = runAll(out);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(readFileSync(join(out, 'anchors.json')), before);
  const options = { indexFile: join(out, 'anchors.json'), repoRoots: { [out]: out } };
  writeFileSync(join(out, child), '// modified child source\n');
  assert.equal(queryAnchorsIndex(childKey, options)[0].status, 'stale');
  const prior = readFileSync(join(out, 'anchors.json'));
  result = runAll(out);
  assert.notEqual(result.status, 0, 'drifted source must not be recertified by regeneration');
  assert.deepEqual(readFileSync(join(out, 'anchors.json')), prior);
  assert.equal(readFileSync(join(out, child), 'utf8'), '// modified child source\n');
});

test('run-all lowering error has nonzero exit and publishes no successful source index', () => {
  const dir = scratch(); const binding = join(dir, 'invalid-runtime.json');
  writeFileSync(binding, '{}');
  const out = join(dir, 'app');
  const result = runAll(out, ['--saga-runtime-binding', binding]);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(join(out, 'anchors.json')), false);
  assert.equal(existsSync(join(out, 'app/fixture/composition/FabCompositionHost.scala')), false);
});

test('entries written-only KEEP preserves source and prior owner without creating new knowledge ownership', async () => {
  const dir = scratch(); const out = join(dir, 'out'); const registry = join(dir, 'concerns.json');
  writeFileSync(registry, JSON.stringify({ flavors: { all: { artifactKinds: ['*'] } },
    concerns: { selected: { schemaCategories: ['*'], flavors: ['all'] } } }));
  const generator = { id: 'run-all-fixture', version: 'v1' };
  const file = 'Owned.scala';
  const initial = { path: file, content: 'object First {}\n', kind: 'source', families: ['Other'],
    knowledgeIds: ['pipeline:old'] };
  const selected = { path: 'Selected.scala', content: 'object Selected {}\n', kind: 'source', families: ['Selected'] };
  await applyEntries({ outDir: out, entries: [initial, selected], generator, anchorPolicy: 'written-only' });
  const original = read(join(out, 'anchors.json')).anchors['pipeline:old'][0];
  const actual = 'object HandOwned {}\n'; writeFileSync(join(out, file), actual);
  const result = await applyEntries({ outDir: out, entries: [{ ...initial, content: 'object Planned {}\n',
    knowledgeIds: ['pipeline:new'] }], generator, anchorPolicy: 'written-only',
  concern: { name: 'selected', families: 'Selected', registryFile: registry } });
  assert.equal(result.kept, 1);
  assert.equal(readFileSync(join(out, file), 'utf8'), actual);
  const index = read(join(out, 'anchors.json'));
  assert.equal(index.anchors['pipeline:new'], undefined);
  assert.equal(index.anchors['pipeline:old'][0].fingerprint, original.fingerprint);
  assert.equal(index.anchors['pipeline:old'][0].status, 'stale');
});

test('entries validation refuses a later invalid entry before writing earlier source', async () => {
  const out = join(scratch(), 'out');
  await assert.rejects(applyEntries({ outDir: out, generator: { id: 'source-fixture', version: '1' },
    entries: [{ path: 'First.scala', content: 'object First {}\n', kind: 'source' },
      { path: 'Second.scala', content: 'object Second {}\n', kind: null }] }), /source entries require/);
  assert.equal(existsSync(join(out, 'First.scala')), false);
});
