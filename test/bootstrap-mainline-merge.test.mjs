import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const emitter = fileURLToPath(new URL('../generators/bootstrap-dsl/emit.mjs', import.meta.url));
function render(t, fields) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'bootstrap-mainline-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const spec = join(directory, 'spec.json');
  writeFileSync(spec, JSON.stringify({ name: 'Application', package: 'example.infrastructure.bootstrap', basePkg: 'example', skipTrait: true, ...fields }));
  const result = spawnSync(process.execPath, [emitter, spec, join(directory, 'generated')], { encoding: 'utf8', timeout: 120000 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  return readFileSync(join(directory, 'generated/ApplicationBootstrap.scala'), 'utf8');
}

test('application bootstrap injects the union and passes each arbitrary aggregate its own ports', t => {
  const source = render(t, { aggTraits: ['Depot', 'Allocation'], viewTraits: [], aggPorts: {
    Allocation: [{ param: 'clock', type: 'Clock' }, { param: 'identity', type: 'Identity' }],
    Depot: [{ param: 'identity', type: 'Identity' }, { param: 'capacity', type: 'Capacity' }],
    Absent: [{ param: 'unused', type: 'Unused' }],
  } });
  assert(source.includes('initAllocationAggregate(sharding, clock, identity)'));
  assert(source.includes('initDepotAggregate(sharding, identity, capacity)'));
  for (const declaration of ['clock: Clock', 'identity: Identity', 'capacity: Capacity']) assert.equal(source.split(declaration).length - 1, 1);
  assert(!source.includes('unused') && !source.includes('Unused'));
});

test('an absent port owner never injects phantom ports and strict Saga wiring survives', t => {
  const source = render(t, { aggTraits: ['Lot'], viewTraits: [],
    aggPorts: { ModelCatalog: [{ param: 'adjudicator', type: 'ConceptDeltaAdjudicator' }] },
    strictEntries: ['fixture.split.SplitEntry', 'fixture.merge.MergeEntry'] });
  assert(source.includes('initLotAggregate(sharding)'));
  assert(!source.includes('adjudicator') && !source.includes('ConceptDeltaAdjudicator'));
  for (const entry of ['fixture.split.SplitEntry', 'fixture.merge.MergeEntry']) {
    assert(source.includes(entry + '.spawnClusterSingleton(system, sharding,'));
    assert(source.includes(entry + '.installEventSource(system, sharding,'));
  }
  assert(source.includes('classicSystem.settings.config.getString("net.imadz.strict-saga.reconcile-token")'));
});

test('existing ModelCatalog port ordering and projection initialization are retained', t => {
  const source = render(t, { aggTraits: ['Other', 'ModelCatalog'], viewTraits: ['Receipt'], aggPorts: {
    ModelCatalog: [{ param: 'adjudicator', type: 'ConceptDeltaAdjudicator' }, { param: 'fingerprint', type: 'ContentFingerprintPort' }],
  } });
  assert(source.includes('initModelCatalogAggregate(sharding, adjudicator, fingerprint)'));
  assert(source.includes('initOtherAggregate(sharding)'));
  assert(source.includes('initReceiptProjection(system, sharding, receiptRepository)'));
  assert(source.indexOf('initModelCatalogAggregate(') < source.indexOf('initOtherAggregate('));
});
