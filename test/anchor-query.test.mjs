import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planAnchors, writeAnchorsIndex } from '../src/core/anchors.mjs';
import { buildGraph, anchors } from '../lib/query.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'saga-anchor-query-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  for (const name of ['Args', 'Definition']) await writeFile(join(root, 'src', `${name}.scala`), `object ${name}\n`);
  const key = 'saga:money-transfer';
  const plan = planAnchors({ generator: { id: 'saga-test', version: 'v1' },
    plannedKnowledgeKeys: [{ knowledgeKey: key, locations: ['Args', 'Definition'].map(name => ({ repo: 'owned', file: `src/${name}.scala`, module: 'core' })) }],
    finalApplyOutcomes: ['Args', 'Definition'].map(name => ({ repo: 'owned', file: `src/${name}.scala`, outcome: 'ADD' })),
  });
  await writeAnchorsIndex(plan, { repoRoots: { owned: root }, indexLocation: { repo: 'owned', file: 'anchors.json' } });
  return { root, key, options: { indexFile: join(root, 'anchors.json'), repoRoots: { owned: root } } };
}

test('anchors query exposes all actual current files without inventing symbol verification', async (t) => {
  const { options } = await fixture(t);
  const result = anchors(buildGraph({}), 'saga', 'money-transfer', options).result;
  assert.equal(result.status, 'source-verified');
  assert.equal(result.result.length, 2);
  for (const location of result.result) {
    assert.equal(location.verification.level, 'file');
    assert.equal(location.verification.symbolVerified, false);
    assert.equal(location.freshness, 'current-bytes');
  }
});
test('anchors query marks renamed, edited and missing files accurately', async (t) => {
  const { root, options } = await fixture(t);
  await writeFile(join(root, 'src', 'Args.scala'), 'edited source');
  await rm(join(root, 'src', 'Definition.scala'));
  const result = anchors(buildGraph({}), 'saga', 'money-transfer', options).result;
  assert.equal(result.status, 'stale');
  assert.deepEqual(result.result.map(location => location.status).sort(), ['stale', 'unmapped']);
  const unchangedIndex = JSON.parse(await readFile(options.indexFile, 'utf8'));
  assert.ok(unchangedIndex.anchors['saga:money-transfer'].every(location => location.status === 'source-verified'));
});
test('anchors query rejects symlink sources rather than following them', async (t) => {
  const { root, options } = await fixture(t);
  await rm(join(root, 'src', 'Args.scala'));
  await symlink(join(root, 'src', 'Definition.scala'), join(root, 'src', 'Args.scala'));
  assert.throws(() => anchors(buildGraph({}), 'saga', 'money-transfer', options), /symbolic link/);
});
test('without an explicit derived index the legacy query remains unanchored', () => {
  assert.deepEqual(anchors(buildGraph({}), 'saga', 'money-transfer').result, { status: 'unanchored', result: [] });
});
