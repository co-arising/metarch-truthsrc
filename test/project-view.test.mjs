import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initProject } from '../lib/project/init.mjs';
import { projectCli } from '../lib/project/cli.mjs';
import { viewProject, viewProjectCli } from '../lib/project/view.mjs';
import { authorExcerpt } from '../lib/project/view-source.mjs';
import { declaredViewRelations } from '../lib/project/view-relations.mjs';

test('author excerpt locates a real JSON pointer without inventing virtual children', () => {
  const source = 'kind: structure\npayload:\n  {\n    "constants": {\n      "positive": "positive guard"\n    },\n    "items": [\n      {"x": "a,b"},\n      {"x": "line\\nnext"}\n    ]\n  }\n';
  const found = authorExcerpt(source, '/payload/constants/positive');
  assert.equal(found.pointerLocated, true); assert.ok(found.text.includes('positive guard'));
  assert.equal(authorExcerpt(source, '/payload/constants/positive/child').pointerLocated, false);
  assert.equal(authorExcerpt(source, '/payload/items/1/x').pointerLocated, true);
});

test('exports a real Counter graph, source excerpts, code spans and honest evidence', async t => {
  const parent = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-view-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const f = initProject([join(parent, 'counter')]), out = join(f.root, 'generated');
  await projectCli('generate-project', ['--project', f.project, '--out', out]);
  const view = viewProject({ project: f.project, out });
  assert.equal(view.schemaVersion, 'truthsrc.project-view/v1');
  assert.equal(view.verification.passed, true);
  assert.ok(view.nodes.some(row => row.kind === 'guard' && row.locations.some(loc => loc.precision === 'span')));
  assert.ok(view.nodes.some(row => row.locations.some(loc => loc.reverseIdentities.includes(row.identity))));
  assert.ok(view.nodes.some(row => row.locations.some(loc => loc.precision === 'file' && loc.reverseLocations.length > 0)));
  const event = view.nodes.find(row => row.kind === 'event');
  const ranges = event.locations.filter(loc => loc.precision === 'span').flatMap(loc => loc.reverseLocations).filter(row => row.identity.includes('/fold/'));
  assert.ok(new Set(ranges.map(row => row.startLine)).size >= 2, 'adjacent folds retain independent source line ranges');
  assert.ok(view.nodes.every(row => row.sources.every(source => !source.file.startsWith('/'))));
  assert.equal(view.evidence.find(row => row.id === 'service').status, 'not-run');
  assert.equal(view.freshness.live, false);
  const file = join(parent, 'counter.html');
  const result = viewProjectCli(['--project', f.project, '--out', out, '--html', file]);
  assert.equal(result.file, file); assert.ok(readFileSync(file, 'utf8').includes('workshop-view'));
  assert.throws(() => viewProjectCli(['--project', f.project, '--out', out, '--html', file]), /EEXIST/);
  assert.throws(() => viewProjectCli(['--project', f.project, '--out', out, '--html', join(out, 'bad.html')]), /outside/);
});

test('Saga host view edges come from explicit refs, not matching names', () => {
  const records = [
    { identity: 's', kind: 'saga', name: 'payment', owner: [], pointer: '/sagas/0', surface: '', file: 'saga.yaml' },
    { identity: 'h', kind: 'saga-host', name: 'host', owner: [], pointer: '/sagaHosts/0', surface: '', file: 'host.yaml' },
  ];
  const c = { sagas: [{ id: 'payment', payload: {} }], sagaHosts: [{ saga: { ref: { context: 'bank', kind: 'saga', owner: [], id: 'payment' } } }] };
  const result = declaredViewRelations(c, { records, context: 'bank' });
  assert.equal(result.edges.length, 1); assert.equal(result.edges[0].proof.carrier, 'saga/ref');
  c.sagaHosts[0] = { id: 'payment' };
  assert.equal(declaredViewRelations(c, { records, context: 'bank' }).edges.length, 0);
});
