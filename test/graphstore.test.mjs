import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTree } from '../lib/compile.mjs';
import {
  buildGraph, describe, expand, lineage, search,
  sagaParticipantsOf, sagaPhasesOf,
} from '../lib/query.mjs';
import { GRAPHSTORE_VERSION, buildGraphStore, graphFromStore, readStoreMeta } from '../lib/graphstore.mjs';

// Local SQLite-class embedded graph store (node:sqlite, zero npm deps). The store is a
// pure cache projection of one canonical.json: parity with buildGraph is the contract —
// every query verb must behave identically on a reopened store. Trees are read-only;
// all stores live in this test's realpathed scratch roots.
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'bin', 'truthsrc.js');
const TREES = {
  serial: new URL('../example/saga-money-transfer-serial/tree/', import.meta.url),
  v1: new URL('../example/saga-money-transfer/tree/', import.meta.url),
  demo: new URL('../example/tree/', import.meta.url),
};

const scratch = (t) => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'truthsrc-graphstore-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};
const canonicalOf = (tree) => JSON.parse(compileTree(fileURLToPath(tree)));

for (const [name, tree] of Object.entries(TREES)) test(`graphstore round-trips the ${name} tree into a buildGraph()-shaped object`, (t) => {
  const directory = scratch(t);
  const canonical = canonicalOf(tree);
  const memory = buildGraph(canonical);
  const file = join(directory, 'graph.db');
  const summary = buildGraphStore(canonical, { file });
  assert.equal(summary.schemaVersion, GRAPHSTORE_VERSION);
  assert.equal(summary.nodeCount, memory.nodes.size);
  assert.equal(summary.edgeCount, memory.edges.length);
  const meta = readStoreMeta(file);
  assert.equal(meta.schemaVersion, GRAPHSTORE_VERSION);
  assert.equal(meta.nodeCount, String(memory.nodes.size));
  assert.equal(meta.edgeCount, String(memory.edges.length));
  assert.match(meta.canonicalSha256, /^sha256:[a-f0-9]{64}$/);
  assert.equal(meta.workshop, String(canonical.workshop ?? ''));
  // Full deep-equal: all query verbs run against the reopened store unchanged.
  assert.deepStrictEqual(graphFromStore(file), memory);
});

test('graphstore parity holds for the query verbs on the serial tree', (t) => {
  const directory = scratch(t);
  const canonical = canonicalOf(TREES.serial);
  const file = join(directory, 'graph.db');
  buildGraphStore(canonical, { file });
  const memory = buildGraph(canonical);
  const stored = graphFromStore(file);
  assert.ok(memory.nodes.has('saga:money-transfer'));
  for (const [verb, run] of Object.entries({
    describe: (g) => describe(g, 'saga', 'money-transfer', true),
    expand: (g) => expand(g, 'saga:money-transfer', { depth: 2 }),
    participants: (g) => sagaParticipantsOf(g, 'money-transfer'),
    phases: (g) => sagaPhasesOf(g, 'money-transfer'),
    search: (g) => search(g, 'transfer'),
  })) assert.deepStrictEqual(run(stored), run(memory), verb);
  for (const id of ['saga:money-transfer', 'saga-participant:money-transfer.source',
    'saga-phase:money-transfer.reserve-source.prepare', 'command:CreditBalance.DeductFunds']) {
    assert.deepStrictEqual(
      expand(stored, id, { depth: 1, direction: 'both' }),
      expand(memory, id, { depth: 1, direction: 'both' }), `expand ${id}`);
    assert.deepStrictEqual(
      lineage(stored, id, { depth: 2 }),
      lineage(memory, id, { depth: 2 }), `lineage ${id}`);
  }
});

test('graphstore is deterministic per canonical and rebuilds over an existing file', (t) => {
  const directory = scratch(t);
  const canonical = canonicalOf(TREES.serial);
  const first = join(directory, 'one.db'), second = join(directory, 'two.db');
  buildGraphStore(canonical, { file: first });
  buildGraphStore(canonical, { file: second });
  assert.equal(readStoreMeta(first).canonicalSha256, readStoreMeta(second).canonicalSha256);
  assert.deepStrictEqual(graphFromStore(first), graphFromStore(second));
  // Rebuild in place: the store is a cache — overwrite must work and stay equivalent.
  buildGraphStore(canonical, { file: first });
  assert.deepStrictEqual(graphFromStore(first), graphFromStore(second));
});

test('graphstore reopens across processes', (t) => {
  const directory = scratch(t);
  const canonical = canonicalOf(TREES.serial);
  const file = join(directory, 'graph.db');
  buildGraphStore(canonical, { file });
  const reopened = spawnSync(process.execPath, ['--no-warnings', '-e', `
    const { graphFromStore, readStoreMeta } = await import(${JSON.stringify(join(root, 'lib', 'graphstore.mjs'))});
    const meta = readStoreMeta(${JSON.stringify(file)});
    const graph = graphFromStore(${JSON.stringify(file)});
    console.log(JSON.stringify({ nodeCount: Number(meta.nodeCount), edgeCount: Number(meta.edgeCount),
      actualNodes: graph.nodes.size, actualEdges: graph.edges.length,
      sagaNode: graph.nodes.has('saga:money-transfer') }));
  `], { encoding: 'utf8' });
  assert.equal(reopened.status, 0, reopened.stderr);
  const reported = JSON.parse(reopened.stdout);
  assert.equal(reported.actualNodes, reported.nodeCount);
  assert.equal(reported.actualEdges, reported.edgeCount);
  assert.equal(reported.sagaNode, true);
});

test('graphstore rejects non-canonical input and the CLI requires an explicit --out', (t) => {
  const directory = scratch(t);
  assert.throws(() => buildGraphStore([1, 2, 3], { file: join(directory, 'bad.db') }), /plain canonical object/);
  const db = join(directory, 'cli.db');
  const missingOut = spawnSync(process.execPath, [cli, 'graph', '--tree', fileURLToPath(TREES.serial)], { encoding: 'utf8' });
  assert.equal(missingOut.status, 2);
  const ok = spawnSync(process.execPath, [cli, 'graph', '--tree', fileURLToPath(TREES.serial), '--out', db], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /nodes · \d+ edges/);
  assert.equal(readStoreMeta(db).schemaVersion, GRAPHSTORE_VERSION);
});
