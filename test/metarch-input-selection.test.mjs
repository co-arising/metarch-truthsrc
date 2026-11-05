import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { emitAuthorDoc } from '../lib/author-surface.mjs';
import { writeMetarchBundle, readMetarchBundle } from '../lib/compat/metarch-bundle.mjs';

const bcRoot = process.env.TRUTHSRC_BC_ROOT;
const reader = new URL('../lib/compat/metarch-bundle.mjs', import.meta.url).href;
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'bc-selected-products-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tree = join(root, 'sample');
  mkdirSync(join(tree, 'contexts/main'), { recursive: true });
  mkdirSync(join(tree, 'inbox/06-aggregate-detail'), { recursive: true });
  const compatibility = { schemaVersion: 'truthsrc.compat.metarch/v1', root: { schemaVersion: 'metarch.truth.v1', workshop: 'SelectedSample', sessionOrder: ['refining'] },
    governance: { artifactMeta: { template: {}, readmodels: { meta: {} }, stories: { meta: {} } }, concerns: {} }, authoredEmissionBindings: [] };
  const docs = [
    ['system.yaml', { kind: 'system', schemaVersion: 'truthsrc.author/v1', id: 'sample', name: 'SelectedSample', workshop: 'SelectedSample', sessionOrder: ['refining'], contexts: ['main'], compatibility: { metarch: compatibility } }],
    ['contexts/main/context.yaml', { kind: 'context', schemaVersion: 'truthsrc.context/v1', id: 'main', name: 'Main', responsibility: 'Own selected test knowledge' }],
    ['contexts/main/use-cases.yaml', { kind: 'use-cases', payload: { useCases: [] } }],
    ['inbox/06-aggregate-detail/role-rf-reviewer-0.yaml', { kind: 'note', type: 'role', name: 'Reviewer', id: 'reviewer', origin: { stage: 'refining', board: 'board1', seq: 0 }, payload: { type: 'role', name: 'Reviewer', stage: 'refining', noteId: 'reviewer', info: { weight: 1.25 }, links: [] } }],
  ];
  for (const [file, doc] of docs) writeFileSync(join(tree, file), emitAuthorDoc(doc));
  const bundle = writeMetarchBundle({ treeDir: tree, outDir: join(root, 'products') });
  const file = join(root, 'truthsrc.input.json');
  writeFileSync(file, JSON.stringify({ schemaVersion: 'truthsrc.bc-input/v1', mode: 'bundle', manifest: bundle.manifest, reader }));
  return { root, tree, file, bundle };
}
function child(f, source, selected = true, extraArgs = []) {
  const env = { PATH: process.env.PATH, HOME: f.root, LANG: 'en_US.UTF-8', ...(selected ? { TRUTHSRC_METARCH_INPUT: f.file } : {}) };
  return spawnSync(process.execPath, ['--input-type=module', '-e', source, '--', ...extraArgs], { cwd: f.root, env, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
}
function loaderUrl() { return pathToFileURL(join(bcRoot, 'tools/truthsrc/load.mjs')).href; }
function success(result) { assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr || result.stdout); }

const optedIn = { skip: !bcRoot };
test('selected normal BC loaders stay synchronous and use all five public products without the old tree or cache', optedIn, t => {
  const f = fixture(t), result = child(f, `
    import assert from 'node:assert/strict';
    import * as loader from ${JSON.stringify(loaderUrl())};
    const all = loader.loadProducts();
    assert.equal(all.then, undefined);
    assert.equal(all.METARCH.workshop, 'SelectedSample');
    assert.deepEqual(loader.loadMetarch(), all.METARCH);
    assert.deepEqual(loader.loadTemplate(), all.TEMPLATE);
    assert.deepEqual(loader.loadReadmodels(), all.READMODELS);
    assert.deepEqual(loader.loadStories(), all.STORIES);
    assert.deepEqual(loader.loadConcerns(), all.CONCERNS);
    assert.equal(loader.metarchBytes(), JSON.stringify(all.METARCH, null, 2));
    all.METARCH.workshop = 'caller mutation';
    assert.equal(loader.loadMetarch().workshop, 'SelectedSample');
    console.log(JSON.stringify(loader.loadProducts()));
  `, true, ['--tree', join(f.root, 'does-not-exist'), '--root', join(f.root, 'no-legacy-root')]);
  success(result);
  assert.deepEqual(JSON.parse(result.stdout), readMetarchBundle(f.bundle.manifest).products);
  assert.deepEqual(readdirSync(f.root).sort(), ['products', 'sample', 'truthsrc.input.json']);
});

for (const mutation of ['source', 'product', 'manifest', 'selection', 'disable', 'other-selection']) test('selected normal BC loader rejects changed ' + mutation + ' after a successful read', optedIn, t => {
  const f = fixture(t);
  const mutationCode = {
    source: `fs.appendFileSync(${JSON.stringify(join(f.tree, 'system.yaml'))}, '# changed\\n');`,
    product: `fs.appendFileSync(${JSON.stringify(join(f.root, 'products/metarch.json'))}, ' ');`,
    manifest: `fs.appendFileSync(${JSON.stringify(f.bundle.manifest)}, ' ');`,
    selection: `fs.appendFileSync(${JSON.stringify(f.file)}, ' ');`,
    disable: 'delete process.env.TRUTHSRC_METARCH_INPUT;',
    'other-selection': `fs.writeFileSync(${JSON.stringify(join(f.root, 'other.json'))}, fs.readFileSync(process.env.TRUTHSRC_METARCH_INPUT)); process.env.TRUTHSRC_METARCH_INPUT = ${JSON.stringify(join(f.root, 'other.json'))};`,
  }[mutation];
  const result = child(f, `
    import assert from 'node:assert/strict'; import * as fs from 'node:fs';
    import * as loader from ${JSON.stringify(loaderUrl())};
    assert.equal(loader.loadMetarch().workshop, 'SelectedSample');
    ${mutationCode}
    assert.throws(() => loader.loadMetarch(), /TRUTHSRC_INPUT:|METARCH_BUNDLE:/);
    assert.throws(() => loader.loadProducts({ fresh: true }), /TRUTHSRC_INPUT:|METARCH_BUNDLE:/);
  `);
  success(result);
});

test('a process imported in legacy mode refuses a later selection rather than serving its old memo', optedIn, t => {
  const f = fixture(t), result = child(f, `
    import assert from 'node:assert/strict';
    import * as loader from ${JSON.stringify(loaderUrl())};
    const legacy = loader.loadMetarch();
    assert.notEqual(legacy.workshop, 'SelectedSample');
    process.env.TRUTHSRC_METARCH_INPUT = ${JSON.stringify(f.file)};
    assert.throws(() => loader.loadMetarch(), /input selection changed/);
  `, false);
  success(result);
});

test('selected compile check verifies the bundle without writing old cache; write and override modes refuse', optedIn, t => {
  const f = fixture(t), script = join(bcRoot, 'tools/truthsrc/compile.mjs');
  const env = { PATH: process.env.PATH, HOME: f.root, TRUTHSRC_METARCH_INPUT: f.file };
  for (const [args, expected] of [[['--check'], 0], [[], 1], [['--out', join(f.root, 'cache')], 1], [['--check', '--tree', f.tree], 1], [['--check', '--root', f.root], 1]]) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd: f.root, env, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, expected, result.stderr);
    if (expected === 0) assert.match(result.stdout, /five products; legacy cache unchanged/);
    else assert.match(result.stderr, /TRUTHSRC_INPUT:/);
  }
  assert.deepEqual(readdirSync(f.root).sort(), ['products', 'sample', 'truthsrc.input.json']);
});

test('direct legacy compiler is not a fallback for the selected source', optedIn, t => {
  const f = fixture(t), url = pathToFileURL(join(bcRoot, 'tools/truthsrc/compile.mjs')).href;
  success(child(f, `import assert from 'node:assert/strict'; import { compileTree } from ${JSON.stringify(url)}; assert.throws(() => compileTree(), /TRUTHSRC_INPUT:/);`));
});
