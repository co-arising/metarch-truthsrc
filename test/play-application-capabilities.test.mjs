import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadCatalogue } from '../lib/artifact-docs/catalog.mjs';
import { DOC_ROOT, sha256 } from '../lib/artifact-docs/io.mjs';
import { validateObservation } from '../lib/artifact-docs/capabilities.mjs';
import { observePlayCapability } from './play-application-capability-observer.mjs';

test('Play application evidence preserves one semantic sample across code qualification levels', () => {
  const { catalog, lock } = loadCatalogue();
  for (const variant of ['main', 'renamed']) {
    const proofs = ['generated', 'compiled', 'behavior'].map(suffix => {
      const declaration = catalog.observations.find(o => o.id === 'pending-20261111-jpao-rv0-967a18ca-mainline-play-application-' + variant + '-' + suffix);
      assert(declaration);
      const bytes = fs.readFileSync(path.join(DOC_ROOT, declaration.receipt.file)), receipt = JSON.parse(bytes);
      assert.equal(receipt.artifacts.some(a => a.kind === 'build'), false);
      assert.equal(receipt.approval, null);
      assert(!receipt.inputs.some(i => /receipt|oracle|process|tool/i.test(i.name)));
      assert.doesNotMatch(bytes.toString(), /\/Users\/|\/private\/tmp\/|file:\/\/\//);
      return validateObservation(catalog, lock, declaration, bytes);
    });
    assert(proofs.every(p => p.passed && p.sample === proofs[0].sample));
    assert.equal(catalog.observations.find(o => o.id === 'pending-20261111-jpao-rv0-967a18ca-mainline-play-application-' + variant + '-build-generated').level, 'generated');
  }
});
test('Play public observation actually regenerates and reconciles main source bytes', async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), 'play-observation-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { catalog } = loadCatalogue();
  const observed = await observePlayCapability(catalog, { author: fileURLToPath(new URL('../scaffold/play-application-project/', import.meta.url)), destination: directory + '/sample' });
  const declaration = catalog.observations.find(o => o.id === 'pending-20261111-jpao-rv0-967a18ca-mainline-play-application-main-generated');
  const receipt = JSON.parse(fs.readFileSync(path.join(DOC_ROOT, declaration.receipt.file)));
  assert.deepEqual(observed.inputs, receipt.inputs);
  assert.deepEqual(observed.artifacts.filter(a => a.kind !== 'build'), receipt.artifacts);
});
test('mainline merge preserves all batch8 observation bytes under their original tool lock', () => {
  const { catalog } = loadCatalogue();
  const history = JSON.parse(fs.readFileSync(path.join(DOC_ROOT, 'evidence/capability-mainline-prior36-history.json')));
  assert.equal(history.status, 'historical-not-current'); assert.equal(history.observations.length, 36);
  const oldCatalog = Buffer.from(history.originalCatalogBytesBase64, 'base64');
  const oldLock = Buffer.from(history.originalSourceLockBytesBase64, 'base64');
  assert.equal(sha256(oldCatalog), history.catalogSha256); assert.equal(sha256(oldLock), history.sourceLockSha256);
  for (const declaration of history.observations) {
    assert(!catalog.observations.some(row => row.id === declaration.id));
    const bytes = fs.readFileSync(path.join(DOC_ROOT, declaration.receipt.file));
    assert(validateObservation(JSON.parse(oldCatalog), JSON.parse(oldLock), declaration, bytes).passed);
    assert(catalog.observations.some(row => row.id === 'pending-20261111-jpao-rv0-967a18ca-mainline-' + declaration.id));
  }
});
test('batch8 retains original batch7 observation bytes without treating old identities as current', () => {
  const { catalog } = loadCatalogue();
  const history = JSON.parse(fs.readFileSync(path.join(DOC_ROOT, 'evidence/capability-play-application-prior28-history.json')));
  assert.equal(history.status, 'historical-not-current'); assert.equal(history.observations.length, 28);
  const oldCatalog = Buffer.from(history.originalCatalogBytesBase64, 'base64');
  const oldLock = Buffer.from(history.originalSourceLockBytesBase64, 'base64');
  assert.equal(sha256(oldCatalog), history.catalogSha256); assert.equal(sha256(oldLock), history.sourceLockSha256);
  for (const old of history.observations) {
    assert(!catalog.observations.some(o => o.id === old.id));
    const bytes = fs.readFileSync(path.join(DOC_ROOT, old.receipt.file));
    assert.equal(sha256(bytes), old.receipt.sha256);
    assert(validateObservation(JSON.parse(oldCatalog), JSON.parse(oldLock), old, bytes).passed);
  }
});
