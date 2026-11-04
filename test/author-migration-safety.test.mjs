import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, cpSync, readFileSync, writeFileSync, existsSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAuthorMigration, writeAuthorMigration } from '../lib/author-migrate.mjs';
import { authorFiles } from '../lib/author-tree.mjs';
import { compileTree } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/local-project/tree', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-migration-safety-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'legacy'); cpSync(scaffold, source, { recursive: true });
  const options = { treeDir: source, system: 'example', context: 'example', name: 'Counter', responsibility: 'Own counter rules.' };
  return { root, source, options, out: join(root, 'example') };
}
test('unknown legacy root field and version reject rather than silently disappearing', t => {
  const f = fixture(t), root = join(f.source, 'workshop.yaml'), bytes = readFileSync(root, 'utf8');
  writeFileSync(root, bytes + 'importantRule: yes\n');
  assert.throws(() => planAuthorMigration(f.options), /unknown legacy root/);
  writeFileSync(root, bytes.replace('truthsrc/v1', 'truthsrc/v999'));
  assert.throws(() => planAuthorMigration(f.options), /unknown legacy root/);
});
test('migration refuses source/destination overlap including parent symlink alias', t => {
  const f = fixture(t), plan = planAuthorMigration(f.options), before = authorFiles(f.source).files;
  assert.throws(() => writeAuthorMigration(plan, join(f.source, 'example')), /disjoint/);
  const alias = join(f.root, 'alias'); symlinkSync(f.source, alias);
  assert.throws(() => writeAuthorMigration(plan, join(alias, 'example')), /symlink/);
  assert.deepEqual(authorFiles(f.source).files, before);
});
for (const mutation of ['change', 'add', 'remove']) test('stale migration plan refuses after input ' + mutation, t => {
  const f = fixture(t), plan = planAuthorMigration(f.options), file = join(f.source, 'aggregates/counter/aggregate.yaml');
  if (mutation === 'change') writeFileSync(file, readFileSync(file, 'utf8').replace('"default": "0"', '"default": "9"'));
  if (mutation === 'add') writeFileSync(join(f.source, 'unknown.yaml'), 'kind: question\n');
  if (mutation === 'remove') rmSync(file);
  assert.throws(() => writeAuthorMigration(plan, f.out), /source changed/);
  assert.equal(existsSync(f.out), false);
});
test('modified plan cannot retain an obsolete semantic-preservation claim', t => {
  const f = fixture(t), plan = planAuthorMigration(f.options);
  const atom = plan.files.find(e => e.file.endsWith('/aggregate.yaml'));
  atom.content = atom.content.replace('"default": "0"', '"default": "9"');
  assert.throws(() => writeAuthorMigration(plan, f.out), /planned semantic content changed/);
  assert.equal(existsSync(f.out), false);
});

test('author decompose refuses existing roots and symlink parents', t => {
  const f = fixture(t); writeAuthorMigration(planAuthorMigration(f.options), f.out);
  const text = compileTree(f.out);
  assert.throws(() => decomposeCanonical(text, f.out), /new destination/);
  const destination = join(f.root, 'destination'); mkdirSync(destination);
  symlinkSync(destination, join(f.root, 'alias'));
  assert.throws(() => decomposeCanonical(text, join(f.root, 'alias/example')), /symlink/);
  assert.equal(existsSync(join(destination, 'example')), false);
});

test('author decompose refuses wrong system root without creating output', t => {
  const f = fixture(t); writeAuthorMigration(planAuthorMigration(f.options), f.out);
  const bad = join(f.root, 'wrong');
  assert.throws(() => decomposeCanonical(compileTree(f.out), bad), /destination.*system.id/);
  assert.equal(existsSync(bad), false);
});
