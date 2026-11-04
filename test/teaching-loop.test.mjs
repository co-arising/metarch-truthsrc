import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { initProject } from '../lib/project/init.mjs';
import { projectCli } from '../lib/project/cli.mjs';
import { applyEntries, previewEntries } from '../src/core/generate.mjs';
import { requestFor } from '../example/handwritten-collaboration/request.mjs';
import { presentCounter } from '../example/handwritten-collaboration/presenter.mjs';
import { captureProject } from '../lib/project/cli.mjs';

const cli = fileURLToPath(new URL('../bin/truthsrc.js', import.meta.url));
test('ordinary custom generator scaffolds and actually generates from project-derived canonical', async t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-custom-teaching-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const project = initProject([join(root, 'project')]), out = join(root, 'generated');
  await projectCli('generate-project', ['--project', project.project, '--out', out]);
  const generator = join(root, 'my-generator'), custom = join(root, 'custom');
  for (const args of [['init-generator', generator], ['generate', '--in', join(out, '.truthsrc/canonical.json'), '--generator', generator, '--out', custom, '--plan'], ['generate', '--in', join(out, '.truthsrc/canonical.json'), '--generator', generator, '--out', custom]]) {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
  assert.match(readFileSync(join(custom, 'aggregates/Counter.md'), 'utf8'), /SetCount/);
});
test('separate agent-authored modules consume truth-derived contract before and after regeneration', async t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-two-agent-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const project = initProject([join(root, 'project')]), out = join(root, 'contract');
  const moduleFiles = ['request.mjs', 'presenter.mjs'].map(file => new URL('../example/handwritten-collaboration/' + file, import.meta.url));
  const before = moduleFiles.map(file => readFileSync(file, 'utf8'));
  const entries = captured => {
    const domain = captured.canonical.aggregates[0];
    const folds = captured.compilation.result.products.find(p => p.id === 'domain-folds').payload;
    const state = Object.fromEntries(folds.defaults.map(row => [row.target.id, row.value]));
    return [{ path: 'contract.mjs', kind: 'contract', content: 'export const commandName = ' + JSON.stringify(domain.commands[0].name) + ';\nexport const initialState = () => (' + JSON.stringify(state) + ');\n', knowledgeIds: ['source:example-domain#/aggregates/0'] }];
  };
  const common = { outDir: out, generator: { id: 'teaching-contract', version: '1' }, ownership: { id: project.project } };
  await applyEntries({ ...common, entries: entries(captureProject(project.project)) });
  const first = await import(pathToFileURL(join(out, 'contract.mjs')).href + '?first');
  assert.deepEqual(requestFor(first, '3'), { command: 'SetCount', count: '3' });
  assert.equal(presentCounter(first, first.initialState()), 'SetCount:count=0');
  for (const bad of [3, '1.5', '1e3', ' 3']) assert.throws(() => requestFor(first, bad));
  const atom = join(project.tree, 'contexts/example/aggregates/counter/aggregate.yaml');
  writeFileSync(atom, readFileSync(atom, 'utf8').replace('"default": "0"', '"default": "2"'));
  await applyEntries({ ...common, entries: entries(captureProject(project.project)), update: true });
  const second = await import(pathToFileURL(join(out, 'contract.mjs')).href + '?second');
  assert.equal(presentCounter(second, second.initialState()), 'SetCount:count=2');
  assert.deepEqual(moduleFiles.map(file => readFileSync(file, 'utf8')), before);
});

test('two independent handwritten modules consume a generated interface through a real knowledge update', async t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-handwritten-teaching-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const out = join(root, 'generated'), handwritten = join(root, 'handwritten'); mkdirSync(handwritten);
  const input = 'export const request = value => ({ value });\n';
  const view = 'export const present = result => result.ok ? `accepted:${result.value}` : `rejected:${result.reason}`;\n';
  writeFileSync(join(handwritten, 'input.mjs'), input);
  writeFileSync(join(handwritten, 'view.mjs'), view);
  const { request } = await import(pathToFileURL(join(handwritten, 'input.mjs')));
  const { present } = await import(pathToFileURL(join(handwritten, 'view.mjs')));
  const produce = maximum => [{ path: 'contract.mjs', kind: 'contract', content: `export const decide = ({value}) => value <= ${maximum} ? {ok:true,value} : {ok:false,reason:'maximum'};\n`, knowledgeIds: ['example:maximum'] }];
  const common = { outDir: out, generator: { id: 'tutorial-contract', version: '1' }, ownership: { id: 'teaching-project' } };
  await applyEntries({ ...common, entries: produce(10) });
  const first = await import(pathToFileURL(join(out, 'contract.mjs')).href + '?first');
  assert.equal(present(first.decide(request(11))), 'rejected:maximum');
  const preview = previewEntries({ ...common, entries: produce(12), update: true });
  assert.equal(preview.actions[0].outcome, 'COVER');
  await applyEntries({ ...common, entries: produce(12), update: true, expectedFiles: preview.expectedFiles });
  const second = await import(pathToFileURL(join(out, 'contract.mjs')).href + '?second');
  assert.equal(present(second.decide(request(11))), 'accepted:11');
  assert.equal(readFileSync(join(handwritten, 'input.mjs'), 'utf8'), input);
  assert.equal(readFileSync(join(handwritten, 'view.mjs'), 'utf8'), view);
});
