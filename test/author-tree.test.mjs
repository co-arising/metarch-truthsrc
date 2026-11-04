import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTree, compileTreeWithSources } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { planAuthorMigration, writeAuthorMigration, semanticProjection } from '../lib/author-migrate.mjs';
import { authorFiles } from '../lib/author-tree.mjs';
import { emitAuthorDoc } from '../lib/author-surface.mjs';
import { parseDoc } from '../lib/shared.mjs';
import { resolveSourcePointer } from '../lib/source-index.mjs';
import { captureProject } from '../lib/project/cli.mjs';

const legacy = fileURLToPath(new URL('../scaffold/local-project/tree', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-author-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tree = join(root, 'example');
  const plan = planAuthorMigration({ treeDir: legacy, system: 'example', context: 'example', name: 'Counter workshop', responsibility: 'Own a counter and its command invariants.' });
  writeAuthorMigration(plan, tree);
  return { root, tree, plan };
}
test('explicit migration preserves semantics and physical-path roundtrip while keeping legacy bytes', t => {
  const before = authorFiles(legacy).files, f = fixture(t);
  assert.equal(f.plan.preservation.semanticEqual, true);
  assert.equal(existsSync(join(f.tree, 'workshop.yaml')), false);
  assert.ok(existsSync(join(f.tree, 'contexts/example/aggregates/counter/aggregate.yaml')));
  assert.deepEqual(semanticProjection(JSON.parse(compileTree(f.tree))), semanticProjection(JSON.parse(compileTree(legacy))));
  assert.deepEqual(validateTree(f.tree), { hard: [], notices: [] });
  assert.deepEqual(roundtrip(f.tree), { ok: true, atoms: 4 });
  assert.deepEqual(authorFiles(legacy).files, before);
  const another = join(f.root, 'other', 'example');
  decomposeCanonical(compileTree(f.tree), another);
  assert.deepEqual(authorFiles(another).files, authorFiles(f.tree).files);
  assert.throws(() => writeAuthorMigration(f.plan, f.tree), /already exists/);
});
test('new author contract refuses unknown knowledge, mixed inbox, context and path conflicts', t => {
  const f = fixture(t), before = authorFiles(f.tree).files;
  writeFileSync(join(f.tree, 'mystery.yaml'), 'kind: note\n');
  assert.throws(() => compileTree(f.tree), /outside|unknown/);
  rmSync(join(f.tree, 'mystery.yaml'));
  mkdirSync(join(f.tree, 'inbox/refining'), { recursive: true });
  writeFileSync(join(f.tree, 'inbox/refining/question-rf-x-0.yaml'), emitAuthorDoc({ kind: 'note', type: 'question', name: 'X', origin: { stage: 'refining', board: 'board1', seq: 0 }, payload: { type: 'question', name: 'X' } }));
  assert.throws(() => compileTree(f.tree), /mixed inbox/);
  rmSync(join(f.tree, 'inbox'), { recursive: true });
  const atom = join(f.tree, 'contexts/example/aggregates/counter/aggregate.yaml');
  const doc = parseDoc(readFileSync(atom, 'utf8')); delete doc.context;
  writeFileSync(atom, emitAuthorDoc(doc));
  assert.throws(() => compileTree(f.tree), /explicit context/);
  for (const entry of before) writeFileSync(join(f.tree, entry.file), entry.content);
  const moved = join(f.root, 'renamed'); renameSync(f.tree, moved);
  assert.throws(() => compileTree(moved), /system path/);
});
test('source index resolves every fold to its actual event block and survives atom movement', t => {
  const f = fixture(t), result = compileTreeWithSources(f.tree), ptr = '/aggregates/0/events/0/foldAssignments/1';
  const matches = resolveSourcePointer(result.sourceIndex, ptr);
  assert.equal(matches.length, 1);
  assert.match(matches[0].file, /contexts\/example\/aggregates\/counter\/slices\/set-count.slice.yaml$/);
  assert.equal(matches[0].atomPointer, '/events/CountSet/foldAssignments/1');
  assert.equal(matches[0].meaning.target, 'count');
  const original = join(f.tree, matches[0].file), newName = original.replace('set-count.slice.yaml', 'set-count-moved.slice.yaml');
  renameSync(original, newName);
  const moved = compileTreeWithSources(f.tree);
  assert.equal(resolveSourcePointer(moved.sourceIndex, ptr)[0].identity, matches[0].identity);
  assert.notEqual(moved.sourceIndex.snapshot, result.sourceIndex.snapshot);
  assert.ok(roundtrip(f.tree).ok);
});
test('project derives the same seven products from new author input, rejecting config context disagreement', t => {
  const f = fixture(t), project = join(f.root, 'truthsrc.project.json');
  const config = JSON.parse(readFileSync(new URL('../scaffold/local-project/truthsrc.project.json', import.meta.url)));
  config.tree = 'example'; writeFileSync(project, JSON.stringify(config));
  const captured = captureProject(project);
  assert.equal(captured.compilation.result.products.length, 7);
  assert.ok(captured.sourceIndex.records.some(r => r.kind === 'fold'));
  config.context = 'other'; writeFileSync(project, JSON.stringify(config));
  assert.throws(() => captureProject(project), /context disagrees/);
});
test('tampered derived author surface refuses decomposing inconsistent business data', t => {
  const f = fixture(t), canonical = JSON.parse(compileTree(f.tree));
  canonical.aggregates[0].stateFields[0].default = 'changed';
  assert.throws(() => decomposeCanonical(JSON.stringify(canonical), join(f.root, 'bad')), /disagrees with semantic projection/);
  assert.equal(existsSync(join(f.root, 'bad')), false);
});
