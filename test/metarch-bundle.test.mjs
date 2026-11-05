import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { emitAuthorDoc, compileAuthorEntries } from '../lib/author-surface.mjs';
import { readMetarchBundle, writeMetarchBundle } from '../lib/compat/metarch-bundle.mjs';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { validateTree } from '../lib/validate.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'metarch-bundle-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tree = join(root, 'sample'); mkdirSync(tree); mkdirSync(join(tree, 'contexts/main'), { recursive: true }); mkdirSync(join(tree, 'inbox/06-aggregate-detail'), { recursive: true });
  const legacy = { schemaVersion: 'truthsrc.compat.metarch/v1', root: { schemaVersion: 'metarch.truth.v1', workshop: 'Sample', sessionOrder: ['refining'] },
    governance: { artifactMeta: { template: {}, readmodels: { meta: {} }, stories: { meta: {} } }, concerns: {} }, authoredEmissionBindings: [] };
  const system = { kind: 'system', schemaVersion: 'truthsrc.author/v1', id: 'sample', name: 'Sample', workshop: 'Sample', sessionOrder: ['refining'], contexts: ['main'],
    compatibility: { metarch: legacy }, provenance: { schemaVersion: 'truthsrc.provenance/v1', sessions: [
      { id: 'review-a', stage: 'refining', sites: [{ provider: 'miro', boardId: 'known-board' }] },
      { id: 'review-b', stage: 'refining', sites: [{ provider: 'miro', uri: 'https://boards.example.invalid/review' }] },
    ] } };
  const note = { kind: 'note', type: 'role', name: 'Reviewer', id: 'reviewer', origin: { stage: 'refining', board: 'board1', seq: 0 },
    sourceRefs: [{ sessionId: 'review-a', itemId: 'known-item' }, { sessionId: 'review-b' }],
    payload: { type: 'role', name: 'Reviewer', stage: 'refining', noteId: 'reviewer', description: 'Reviews knowledge', info: { weight: 1.25 }, links: [] } };
  const files = [
    { file: 'system.yaml', content: emitAuthorDoc(system) },
    { file: 'contexts/main/context.yaml', content: emitAuthorDoc({ kind: 'context', schemaVersion: 'truthsrc.context/v1', id: 'main', name: 'Main', responsibility: 'Own sample knowledge' }) },
    { file: 'inbox/06-aggregate-detail/role-rf-reviewer-0.yaml', content: emitAuthorDoc(note) },
    { file: 'contexts/main/use-cases.yaml', content: emitAuthorDoc({ kind: 'use-cases', payload: { useCases: [] } }) },
  ];
  for (const entry of files) writeFileSync(join(tree, entry.file), entry.content);
  return { root, tree, files, out: join(root, 'bundle'), note, system };
}
function published(t) { const f = fixture(t); const result = writeMetarchBundle({ treeDir: f.tree, outDir: f.out }); return { ...f, result, manifest: result.manifest }; }

test('source references survive author roundtrip and queries without leaking into semantic products', t => {
  const f = fixture(t), compiled = compileTreeWithSources(f.tree);
  assert.equal(roundtrip(f.tree).ok, true);
  assert.deepEqual(validateTree(f.tree).hard, []);
  const note = compiled.canonical.sessions[0].scopes[0].notes[0];
  assert.equal(Object.hasOwn(note, 'sourceRefs'), false);
  assert.deepEqual(note, f.note.payload);
  const records = compiled.sourceIndex.records.filter(row => row.kind === 'note' && row.atomPointer === '/payload');
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].sourceLocations.map(row => [row.sessionId, row.navigation, row.specificity]), [
    ['review-a', 'unavailable', 'identifier-only'], ['review-b', 'available', 'board'],
  ]);
  const altered = structuredClone(f.files), entry = altered.find(row => row.file.endsWith('reviewer-0.yaml'));
  entry.content = entry.content.replace('review-a', 'undeclared');
  assert.throws(() => compileAuthorEntries(altered), /undeclared session/);
});

test('bundle publishes five exact products and a last manifest, preserving noninteger legacy JSON', t => {
  const f = published(t), loaded = readMetarchBundle(f.manifest);
  assert.equal(loaded.manifest.system, 'sample');
  assert.equal(loaded.products.METARCH.sessions[0].scopes[0].notes[0].info.weight, 1.25);
  assert.deepEqual(readdirSync(f.out).sort(), ['concerns.json', 'metarch-bundle.json', 'metarch.fields.template.json', 'metarch.json', 'story.readmodels.json', 'story.stories.json']);
  assert.equal(readFileSync(join(f.out, 'metarch.json'), 'utf8').endsWith('\n'), false);
  assert.equal(readFileSync(join(f.out, 'story.stories.json'), 'utf8').endsWith('\n'), true);
  assert.equal(Object.isFrozen(loaded.products), true);
  for (const entry of f.files) assert.equal(readFileSync(join(f.tree, entry.file), 'utf8'), entry.content);
});

for (const mutation of ['source-byte', 'source-empty-directory', 'source-remove', 'product-byte', 'product-remove', 'extra-file', 'manifest-version', 'duplicate-product', 'duplicate-key', 'symlink-product', 'forged-digest']) test('bundle reader rejects ' + mutation + ' without fallback', t => {
  const f = published(t);
  if (mutation === 'source-byte') writeFileSync(join(f.tree, 'system.yaml'), readFileSync(join(f.tree, 'system.yaml'), 'utf8') + '# changed\n');
  if (mutation === 'source-empty-directory') mkdirSync(join(f.tree, 'read-models'));
  if (mutation === 'source-remove') rmSync(join(f.tree, 'system.yaml'));
  if (mutation === 'product-byte') writeFileSync(join(f.out, 'metarch.json'), '{}');
  if (mutation === 'product-remove') rmSync(join(f.out, 'metarch.json'));
  if (mutation === 'extra-file') writeFileSync(join(f.out, 'extra.json'), '{}');
  if (['manifest-version', 'duplicate-product', 'forged-digest'].includes(mutation)) {
    const manifest = JSON.parse(readFileSync(f.manifest, 'utf8'));
    if (mutation === 'manifest-version') manifest.schemaVersion = 'unknown';
    if (mutation === 'duplicate-product') manifest.products[1] = manifest.products[0];
    if (mutation === 'forged-digest') {
      const bytes = '{}'; writeFileSync(join(f.out, 'metarch.json'), bytes);
      manifest.products[0].bytes = bytes.length; manifest.products[0].sha256 = hash(bytes);
    }
    writeFileSync(f.manifest, JSON.stringify(manifest));
  }
  if (mutation === 'duplicate-key') writeFileSync(f.manifest, readFileSync(f.manifest, 'utf8').replace('"schemaVersion":', '"schemaVersion":"truthsrc.metarch-bundle/v1","schemaVersion":'));
  if (mutation === 'symlink-product') { rmSync(join(f.out, 'metarch.json')); symlinkSync(join(f.tree, 'system.yaml'), join(f.out, 'metarch.json')); }
  assert.throws(() => readMetarchBundle(f.manifest));
});

test('bundle write rejects existing outputs, overlap and path aliases without changing original bytes', t => {
  const f = published(t), before = readFileSync(f.manifest);
  assert.throws(() => writeMetarchBundle({ treeDir: f.tree, outDir: f.out }), /already exists/);
  assert.throws(() => writeMetarchBundle({ treeDir: f.tree, outDir: join(f.tree, 'bundle') }), /disjoint/);
  symlinkSync(f.tree, join(f.root, 'alias'));
  assert.throws(() => writeMetarchBundle({ treeDir: join(f.root, 'alias'), outDir: join(f.root, 'other') }), /alias/);
  assert.equal(existsSync(join(f.root, 'other')), false);
  assert.deepEqual(readFileSync(f.manifest), before);
});

test('explicit BC loader consumes the same bundle with no installed-source fallback', { skip: !process.env.TRUTHSRC_BC_ROOT }, async t => {
  const f = published(t);
  const { loadProductBundle } = await import(pathToFileURL(join(process.env.TRUTHSRC_BC_ROOT, 'tools/truthsrc/load.mjs')).href);
  const reader = new URL('../lib/compat/metarch-bundle.mjs', import.meta.url).href;
  assert.deepEqual(await loadProductBundle(f.manifest, reader), readMetarchBundle(f.manifest).products);
  await assert.rejects(loadProductBundle(join(f.root, 'missing/metarch-bundle.json'), reader));
  await assert.rejects(loadProductBundle(f.manifest, 'https://example.invalid/reader.mjs'), /explicit file URL/);
});
