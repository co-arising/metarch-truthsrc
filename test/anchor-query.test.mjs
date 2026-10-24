import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { planAnchors, writeAnchorsIndex } from '../src/core/anchors.mjs';
import { queryAnchorsIndex } from '../lib/anchor-query.mjs';
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

// ── multi-index union: each pipeline owns its index, the union happens at query ──
const DEFINITION_DIGEST = 'sha256:3a586c81b1a9af9a2cadfdc66306bc06ce063c1b37989985b5568c88fed9971d';

async function bcPipelineFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'saga-anchor-bc-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'app', 'fixture'), { recursive: true });
  const files = ['SagaModule.scala', 'ArgsCodec.scala'];
  for (const name of files) await writeFile(join(root, 'app', 'fixture', name), `object ${name.replace('.scala', '')}\n`);
  const locations = await Promise.all(files.map(async name => ({ repo: 'bc-app', file: `app/fixture/${name}`,
    module: null, symbol: null, span: null, generator: 'codegen-main', generatorVersion: 'p8-anchors-20261024',
    fingerprint: `sha256:${createHash('sha256').update(await readFile(join(root, 'app', 'fixture', name))).digest('hex')}`,
    status: 'source-verified', definitionDigest: DEFINITION_DIGEST,
    verification: { method: 'sha256-bytes', level: 'file', fileVerified: true, symbolVerified: false, spanVerified: false } })));
  const indexFile = join(root, 'anchors.json');
  await writeFile(indexFile, JSON.stringify({ version: 'truthsrc.anchors/v1', anchors: { 'saga:money-transfer': locations } }, null, 2));
  return { root, indexFile };
}

test('anchors query unions pipeline-owned indexes, collapsing duplicated physical anchors', async (t) => {
  const js = await fixture(t);
  const bc = await bcPipelineFixture(t);
  // The second index also carries a verbatim copy of one js-pipeline location: same
  // physical anchor seen through two indexes must collapse by six-field identity.
  const duplicated = JSON.parse(await readFile(js.options.indexFile, 'utf8')).anchors['saga:money-transfer'][0];
  const second = JSON.parse(await readFile(bc.indexFile, 'utf8'));
  second.anchors['saga:money-transfer'].push(duplicated);
  await writeFile(bc.indexFile, JSON.stringify(second, null, 2));
  const result = anchors(buildGraph({}), 'saga', 'money-transfer',
    { indexFile: [js.options.indexFile, bc.indexFile], repoRoots: { owned: js.root, 'bc-app': bc.root } }).result;
  assert.equal(result.status, 'source-verified');
  assert.equal(result.result.length, 4);
  const fromBc = result.result.filter(location => location.generator === 'codegen-main');
  assert.equal(fromBc.length, 2);
  for (const location of fromBc) {
    assert.equal(location.freshness, 'current-bytes');
    assert.equal(location.definitionDigest, DEFINITION_DIGEST);
  }
});

test('indexFile accepts a single path or an array of one — identical answers', async (t) => {
  const js = await fixture(t);
  const single = anchors(buildGraph({}), 'saga', 'money-transfer', js.options).result;
  const array = anchors(buildGraph({}), 'saga', 'money-transfer', { ...js.options, indexFile: [js.options.indexFile] }).result;
  assert.deepEqual(array, single);
});

test('union query fails closed when any index file is missing', async (t) => {
  const js = await fixture(t);
  assert.throws(() => queryAnchorsIndex('saga:money-transfer',
    { indexFile: [js.options.indexFile, join(js.root, 'missing-anchors.json')], repoRoots: { owned: js.root } }), /ENOENT/);
});

test('a malformed reconciliation digest fails closed at index read', async (t) => {
  const bc = await bcPipelineFixture(t);
  const index = JSON.parse(await readFile(bc.indexFile, 'utf8'));
  index.anchors['saga:money-transfer'][0].definitionDigest = 'not-a-digest';
  await writeFile(bc.indexFile, JSON.stringify(index, null, 2));
  assert.throws(() => queryAnchorsIndex('saga:money-transfer',
    { indexFile: bc.indexFile, repoRoots: { 'bc-app': bc.root } }), /Invalid definitionDigest/);
});
