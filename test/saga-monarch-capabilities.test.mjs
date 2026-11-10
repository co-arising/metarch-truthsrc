import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogue } from '../lib/artifact-docs/catalog.mjs';
import { DOC_ROOT, sha256 } from '../lib/artifact-docs/io.mjs';
import { validateObservation } from '../lib/artifact-docs/capabilities.mjs';
import { observeSagaMonarchCapability } from './saga-monarch-capability-observer.mjs';

const producer = 'scala-cqrs-saga-monarch-v1';

test('Saga Monarch public observations retain one input and code sample across qualification levels', () => {
  const { catalog, lock } = loadCatalogue();
  for (const variant of ['main', 'retry', 'pure', 'carry']) {
    const proofs = ['generated', 'compiled', 'behavior-verified'].map(level => {
      const observation = catalog.observations.find(row => row.id === 'mainline-play-application-saga-' + variant + '-' + level);
      assert(observation, variant + '/' + level);
      assert.equal(observation.producer, producer);
      const bytes = readFileSync(join(DOC_ROOT, observation.receipt.file));
      const receipt = JSON.parse(bytes);
      assert.equal(receipt.artifacts.some(artifact => artifact.kind === 'build'), false);
      assert.equal(receipt.approval, null);
      assert.equal(receipt.inputs.some(input => /receipt|oracle|process|tool/i.test(input.name)), false);
      return validateObservation(catalog, lock, observation, bytes);
    });
    assert(proofs.every(proof => proof.passed && proof.sample === proofs[0].sample));
    const build = catalog.observations.filter(row => row.id.startsWith('mainline-play-application-saga-' + variant + '-build-'));
    assert.deepEqual(build.map(row => row.level), ['generated']);
  }
});

test('Saga Monarch main observation replays the actual public project writer without inventing a typed Run', async t => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'saga-monarch-observation-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { catalog } = loadCatalogue();
  const observed = await observeSagaMonarchCapability(catalog, {
    author: fileURLToPath(new URL('../scaffold/saga-monarch-project/', import.meta.url)),
    destination: join(root, 'sample'),
  });
  const declaration = catalog.observations.find(row => row.id === 'mainline-play-application-saga-main-generated');
  assert(declaration);
  const receipt = JSON.parse(readFileSync(join(DOC_ROOT, declaration.receipt.file)));
  assert.deepEqual(observed.inputs, receipt.inputs);
  assert.deepEqual(observed.artifacts.filter(artifact => artifact.kind !== 'build'), receipt.artifacts);
  assert.equal(observed.hasRuns, false);
  assert.equal(declaration.outputs.includes('typed-run'), false);
});

test('the preceding 28 observations preserve their original bytes and are not current qualifications', () => {
  const { catalog } = loadCatalogue();
  const history = JSON.parse(readFileSync(join(DOC_ROOT, 'evidence/capability-saga-monarch-prior28-history.json')));
  assert.equal(history.status, 'historical-not-current');
  assert.equal(history.observations.length, 28);
  const active = new Set(catalog.observations.map(row => row.id));
  for (const observation of history.observations) {
    assert.equal(active.has(observation.id), false);
    assert.equal(sha256(readFileSync(join(DOC_ROOT, observation.receipt.file))), observation.receipt.sha256);
  }
});
