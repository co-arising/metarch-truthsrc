import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { planAuthorMigration, writeAuthorMigration } from '../lib/author-migrate.mjs';
import { parseDoc } from '../lib/shared.mjs';
import { emitAuthorDoc } from '../lib/author-surface.mjs';
import { projectCli } from '../lib/project/cli.mjs';
import { queryProject, statusProject } from '../lib/project/query.mjs';

const legacy = fileURLToPath(new URL('../scaffold/local-project/tree', import.meta.url));
async function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-query-project-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tree = join(root, 'example'), project = join(root, 'truthsrc.project.json'), out = join(root, 'generated');
  writeAuthorMigration(planAuthorMigration({ treeDir: legacy, system: 'example', context: 'example', name: 'Counter', responsibility: 'Own counter decisions and folds.' }), tree);
  const config = JSON.parse(readFileSync(new URL('../scaffold/local-project/truthsrc.project.json', import.meta.url)));
  config.tree = 'example'; writeFileSync(project, JSON.stringify(config, null, 2) + '\n');
  const args = ['--project', project, '--out', out];
  await projectCli('generate-project', args);
  return { root, tree, project, out, args };
}
test('bidirectional file provenance joins actual atoms and nextN returns only candidates', async t => {
  const f = await fixture(t), status = statusProject(f);
  assert.equal(status.synchronized, true);
  const command = queryProject({ ...f, knowledge: 'SetCount' });
  assert.equal(command.state, 'mapped');
  const file = command.result.flatMap(r => r.locations).find(l => l.file.endsWith('Rules.scala')).file;
  const reverse = queryProject({ ...f, file, symbol: 'next0' });
  assert.equal(reverse.state, 'candidates-only');
  assert.equal(reverse.precision, 'file');
  assert.ok(reverse.result.some(r => r.origins.some(o => o.file.endsWith('set-count.slice.yaml'))));
  assert.ok(reverse.result.every(r => r.snapshot.startsWith('sha256:')));
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../bin/truthsrc.js', import.meta.url)), 'status-project', '--project', f.project, '--out', f.out], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).synchronized, true);
});
test('real knowledge change is stale until controlled update then resolves fresh', async t => {
  const f = await fixture(t), aggregate = join(f.tree, 'contexts/example/aggregates/counter/aggregate.yaml');
  const before = readFileSync(aggregate, 'utf8'); writeFileSync(aggregate, before.replace('"default": "0"', '"default": "2"'));
  assert.equal(statusProject(f).inputs.state, 'changed');
  assert.equal(statusProject(f).synchronized, false);
  const preview = await projectCli('generate-project', [...f.args, '--update', '--plan']);
  assert.ok(preview.preview.actions.some(a => a.changed && a.path.endsWith('State.scala')));
  await projectCli('generate-project', [...f.args, '--update']);
  assert.equal(statusProject(f).synchronized, true);
  assert.equal((await projectCli('generate-project', [...f.args, '--update'])).result.written, 0);
});
test('hand edits conflict before evidence changes; unknown current input never looks fresh', async t => {
  const f = await fixture(t), command = queryProject({ ...f, knowledge: 'SetCount' });
  const path = command.result.flatMap(r => r.locations).find(l => l.file.endsWith('Rules.scala')).file;
  writeFileSync(join(f.out, path), readFileSync(join(f.out, path), 'utf8') + '// hand edit\n');
  assert.equal(statusProject(f).files.find(row => row.file === path).state, 'modified');
  const evidence = readFileSync(join(f.out, '.truthsrc/inputs.json'), 'utf8');
  await assert.rejects(projectCli('generate-project', [...f.args, '--update']), /update conflict/);
  assert.equal(readFileSync(join(f.out, '.truthsrc/inputs.json'), 'utf8'), evidence);
  writeFileSync(join(f.tree, 'unknown.yaml'), 'kind: note\n');
  assert.equal(statusProject(f).inputs.state, 'invalid');
  assert.equal(statusProject(f).synchronized, false);
});
test('moving atom or reordering fold assignments retains scoped identity without pointer aliasing', async t => {
  const f = await fixture(t), slice = join(f.tree, 'contexts/example/aggregates/counter/slices/set-count.slice.yaml');
  const moved = slice.replace('set-count.slice', 'renamed.slice'); renameSync(slice, moved);
  const doc = parseDoc(readFileSync(moved, 'utf8'));
  doc.events.CountSet.foldAssignments.reverse(); writeFileSync(moved, emitAuthorDoc(doc));
  const found = queryProject({ ...f, knowledge: 'knowledge:example/example/fold/Counter/CountSet/count' });
  assert.equal(found.selection[0].current.state, 'moved');
  assert.equal(found.selection[0].current.pointer, '/aggregates/0/events/0/foldAssignments/0');
  assert.match(found.selection[0].current.file, /renamed.slice.yaml$/);
  assert.equal(found.selection[0].atomPointer, '/events/CountSet/foldAssignments/1');
  await projectCli('generate-project', [...f.args, '--update']);
  assert.equal(statusProject(f).synchronized, true);
});
test('new author knowledge is visible as not-generated without reusing a prior pointer', async t => {
  const f = await fixture(t), directory = join(f.tree, 'contexts/example/stories'); mkdirSync(directory);
  writeFileSync(join(directory, 'story-adjust-counter.story.yaml'), emitAuthorDoc({ kind: 'story', name: 'AdjustCounter', id: 'adjust-counter', payload: {
    id: 'adjust-counter', name: 'AdjustCounter', role: 'operator', goal: 'Set the counter explicitly.' } }));
  const query = queryProject({ ...f, knowledge: 'adjust-counter' });
  assert.equal(query.state, 'not-generated');
  assert.equal(query.status.inputs.state, 'changed');
  assert.deepEqual(query.result, []);
  assert.equal(query.currentSelection.length, 1);
  assert.match(query.currentSelection[0].file, /stories\/story-adjust-counter.story.yaml$/);
  assert.equal(query.currentSelection[0].interpretation, 'current-author-not-generation-evidence');
});

test('source-site references travel from current author atoms into bidirectional code queries', async t => {
  const f = await fixture(t), systemFile = join(f.tree, 'system.yaml');
  const system = parseDoc(readFileSync(systemFile, 'utf8'));
  system.provenance = { schemaVersion: 'truthsrc.provenance/v1', sessions: [
    { id: 'review-a', stage: 'refining', sites: [{ provider: 'miro', uri: 'https://boards.example.invalid/review-a' }] },
    { id: 'review-b', stage: 'refining', sites: [{ provider: 'miro', boardId: 'known-board-b' }] },
  ] };
  writeFileSync(systemFile, emitAuthorDoc(system));
  const slice = join(f.tree, 'contexts/example/aggregates/counter/slices/set-count.slice.yaml');
  const doc = parseDoc(readFileSync(slice, 'utf8'));
  doc.sourceRefs = [{ sessionId: 'review-a', itemId: 'known-item' }, { sessionId: 'review-b' }];
  writeFileSync(slice, emitAuthorDoc(doc));
  assert.equal(statusProject(f).inputs.state, 'changed');
  await projectCli('generate-project', [...f.args, '--update']);
  const query = queryProject({ ...f, knowledge: 'SetCount' });
  assert.equal(query.status.synchronized, true);
  const origins = query.result.flatMap(row => row.origins);
  assert.ok(origins.some(row => row.sourceLocations?.some(source => source.sessionId === 'review-a' && source.specificity === 'board')));
  assert.ok(origins.some(row => row.sourceLocations?.some(source => source.sessionId === 'review-b' && source.navigation === 'unavailable')));
});

test('missing and edited source evidence refuses trusted interpretation', async t => {
  const f = await fixture(t), evidence = join(f.out, '.truthsrc/inputs.json');
  writeFileSync(evidence, readFileSync(evidence, 'utf8') + ' ');
  assert.equal(statusProject(f).evidence.state, 'invalid');
  assert.equal(queryProject({ ...f, knowledge: 'SetCount' }).state, 'source-evidence-unavailable');
  rmSync(evidence);
  assert.equal(statusProject(f).evidence.state, 'missing');
  assert.equal(existsSync(join(f.out, 'anchors.json')), true);
});
