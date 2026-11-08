import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { options, main, classShadow } from './reference/module-seams-mixed/verify.mjs';
import { replaceOnce, mutationCases } from './reference/module-seams-mixed/controls.mjs';
import { runtimeMutationAcceptance } from './reference/compiler-results.mjs';
import { runtimeMutationAcceptance as actorMutationAcceptance } from './reference/aggregate-core/verify.mjs';

const base = ['--java', '/jdk/java', '--maven-cache', '/cache', '--reference', '/reference',
  '--out', '/out', '--mode', 'reference', '--lease-registry', '/shared/leases', '--run-id', 'parcel-reference-01'];
test('finite baseline verifier requires explicit input, shared registry and run identity', () => {
  assert.equal(options(base)['--mode'], 'reference');
  for (const args of [[], [...base, '--unknown', 'x'], [...base, '--java', '/second'],
    base.map(v => v === '/out' ? 'relative' : v), base.map(v => v === 'reference' ? 'arbitrary' : v),
    base.map(v => v === 'parcel-reference-01' ? '../escape' : v), [...base, '--source', '/source']]) {
    assert.throws(() => options(args));
  }
  const generated = base.map(v => v === 'reference' ? 'generated-mixed' : v);
  assert.throws(() => options(generated), /Mixed flags/);
  assert.equal(options([...generated, '--source', '/source', '--source-receipt', '/receipt',
    '--project', '/project', '--producer-root', '/tool'])['--mode'], 'generated-mixed');
});

test('finite mutation anchors are exact and the Actor predicate is reused by identity', () => {
  assert.equal(runtimeMutationAcceptance, actorMutationAcceptance);
  assert.equal(mutationCases.length, 2);
  assert.equal(replaceOnce('before old after', 'old', 'new'), 'before new after');
  assert.throws(() => replaceOnce('no anchor', 'old', 'new'), /ambiguous/);
  assert.throws(() => replaceOnce('old old', 'old', 'new'), /ambiguous/);
  assert.throws(() => options([...base, '--controls', 'extended']), /require actual mixed/);
});

test('default Node discovery cannot launch even a fully configured baseline verifier', async () => {
  assert(process.env.NODE_TEST_CONTEXT);
  await assert.rejects(() => main(base), /NODE_TEST_CONTEXT/);
});

test('class output overlap detects cross-module shadow independently of scalac exit', t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'module-seams-shadow-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dirs = Object.fromEntries(['kernel', 'glue'].map(m => [m, join(root, m)]));
  for (const dir of Object.values(dirs)) mkdirSync(join(dir, 'example'), { recursive: true });
  writeFileSync(join(dirs.kernel, 'example/Shared.class'), 'unit-only');
  writeFileSync(join(dirs.glue, 'example/Other.class'), 'unit-only');
  assert.doesNotThrow(() => classShadow(dirs));
  writeFileSync(join(dirs.glue, 'example/Shared.class'), 'unit-only');
  assert.throws(() => classShadow(dirs), /CLASS_SHADOW: example\/Shared.class/);
});
