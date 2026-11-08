import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { aggregateCoreFixture } from './aggregate-core-fixture.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { buildModels } from '../generators/scala-cqrs-aggregate-core-v1/build-models.mjs';
import { persistenceWireLayout } from '../generators/scala-cqrs-persistence-readside-v1/wire-layout.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/persistence-readside-project/', import.meta.url));
const project = join(scaffold, 'truthsrc.project.json');
const tree = join(scaffold, 'truth/persistence-readside');
const original = fileURLToPath(new URL('../scaffold/aggregate-core-project/truth/aggregate-core/', import.meta.url));
function files(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const file = prefix ? prefix + '/' + entry.name : entry.name;
    return entry.isDirectory() ? files(root, file) : [file];
  }).sort();
}

test('standalone persistence author validates and roundtrips without changing the original Warehouse business payloads', () => {
  assert.deepEqual(validateTree(tree).hard, []);
  const result = roundtrip(tree);
  assert.equal(result.ok, true, JSON.stringify(result));
  const context = 'contexts/inventory';
  assert.deepEqual(files(join(tree, context)), files(join(original, context)));
  for (const file of files(join(original, context))) {
    assert.ok(readFileSync(join(tree, context, file)).equals(readFileSync(join(original, context, file))), file);
  }
  const f = aggregateCoreFixture(project), previous = aggregateCoreFixture();
  for (const key of ['aggregates', 'valueObjects', 'hostComputations', 'ports']) {
    assert.deepEqual(f.canonical[key], previous.canonical[key], key);
  }
  assert.equal(f.config.generator, 'scala-cqrs-persistence-readside-v1');
  assert.equal(f.config.roles.persistenceReadsideBinding, 'persistence');
  assert.equal(f.products['persistence-readside-contract'].store.identity.kind, 'envelope-resource');
  assert.ok(!Object.hasOwn(f.canonical, 'persistenceReadsideContracts'), 'technical choices do not create a second business family');
});

test('standalone binding uses observed version pins, not synthetic admission-fixture pins', () => {
  const f = aggregateCoreFixture(project), model = buildModels({ products: Object.fromEntries(Object.entries(f.products).filter(([id]) => id !== 'persistence-readside-contract')), options: f.config.options });
  const p = f.products['persistence-readside-contract'];
  assert.equal(p.wire.registrations.length, 3);
  for (const r of p.wire.registrations) {
    assert.equal(persistenceWireLayout(model.serialization, r.ref, r.role).sha256, r.layoutSha256, r.typeId);
    assert.notEqual(r.layoutSha256, '1'.repeat(64));
    assert.notEqual(r.layoutSha256, '2'.repeat(64));
    assert.notEqual(r.layoutSha256, '3'.repeat(64));
  }
});
