import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAPABILITY_CASES } from './artifact-capability-fixtures.mjs';
import { observeArtifactCapability } from './artifact-capability-observer.mjs';
import { loadCatalogue } from '../lib/artifact-docs/catalog.mjs';
import { validateObservation } from '../lib/artifact-docs/capabilities.mjs';
import { DOC_ROOT, jsonBytes, sha256 } from '../lib/artifact-docs/io.mjs';

const { catalog, lock } = loadCatalogue();
for (const id of CAPABILITY_CASES) test('source-bound pure capability observation: ' + id, async () => {
  const observed = await observeArtifactCapability(catalog, id);
  const matches = catalog.observations.filter(observation => observation.producer === observed.producer && observation.level === 'generated' &&
    JSON.stringify(JSON.parse(readFileSync(join(DOC_ROOT, observation.receipt.file))).inputs) === JSON.stringify(observed.inputs));
  assert.equal(matches.length, 1, 'one current observation must be recorded for the actual input');
  const declaration = matches[0];
  const bytes = readFileSync(join(DOC_ROOT, declaration.receipt.file));
  const receipt = JSON.parse(bytes);
  assert.deepEqual(receipt.inputs, observed.inputs);
  assert.deepEqual(receipt.artifacts, observed.artifacts);
  assert.deepEqual(receipt.checks, observed.checks);
  assert.deepEqual(declaration.outputs, observed.outputs);
  assert.equal(validateObservation(catalog, lock, declaration, bytes).passed, true);
  assert.equal(receipt.level, 'generated');
  assert.equal(receipt.approval, null);
  if (id === 'scala-cqrs-play-service') {
    const producer = catalog.producers.find(producer => producer.id === observed.producer);
    const pages = producer.outputs.filter(output => output.conditions.some(condition => condition.includes('service.pages'))).map(output => output.id);
    assert.ok(pages.length);
    assert.ok(pages.every(output => !observed.outputs.includes(output)));
  }
});

test('previous observations retain their original bytes and never count as current evidence', () => {
  const history = JSON.parse(readFileSync(join(DOC_ROOT, 'evidence/capability-v2-initial-history.json')));
  assert.equal(history.status, 'historical-not-current');
  assert.equal(history.observations.length, 12);
  assert.notEqual(history.productionToolSha256, lock.productionToolSha256);
  const current = new Set(catalog.observations.map(observation => observation.id));
  for (const observation of history.observations) {
    const bytes = readFileSync(join(DOC_ROOT, observation.receipt.file));
    assert.equal(sha256(bytes), observation.receipt.sha256);
    assert.equal(current.has(observation.id), false);
    assert.throws(() => validateObservation(catalog, lock, observation, bytes), /stale producer observation/);
  }
});

test('installed observations have no checkout absolute path or dependency download requirement', () => {
  for (const observation of catalog.observations) {
    const bytes = readFileSync(join(DOC_ROOT, observation.receipt.file), 'utf8');
    assert.doesNotMatch(bytes, /\/Users\/|\/private\/tmp\/|file:\/\/\//);
    assert.equal(sha256(bytes), observation.receipt.sha256);
    assert.equal(bytes, jsonBytes(JSON.parse(bytes)));
  }
});
