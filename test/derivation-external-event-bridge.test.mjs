import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveExternalEventBridges } from '../lib/derivation/external-event-bridge.mjs';
import { withFlippedExternalEventBridges } from '../lib/derivation/external-event-bridge-emission.mjs';
import { family, renderExternalEventBridgeFiles } from '../emitter/families/external-event-bridge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(ROOT, 'test/fixtures/external-event-bridge-v1');
const GOLDEN_DIR = path.join(ROOT, 'test/reference/curated/external-event-bridge/v1');

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

test('derivation reproduces the curated technical-input.json and fixture input.json exactly', () => {
  const kp = readJson(path.join(FIXTURE_DIR, 'knowledge-products.json'));
  const expected = readJson(path.join(FIXTURE_DIR, 'input.json'));
  const curated = readJson(path.join(GOLDEN_DIR, 'technical-input.json'));
  const derived = deriveExternalEventBridges(kp.products, kp.options);
  assert.deepEqual(derived, expected);
  assert.deepEqual(derived, curated);
});

test('emitter reproduces the curated golden byte-for-byte and is double-run deterministic', () => {
  const input = readJson(path.join(FIXTURE_DIR, 'input.json'));
  const run1 = family.renderAll(input);
  const run2 = family.renderAll(input);
  assert.deepEqual(run1, run2);
  const rel = 'app/example/bankwealth/domain/FundOrderExternalEvents.scala';
  assert.deepEqual(Object.keys(run1), [rel]);
  const golden = fs.readFileSync(path.join(GOLDEN_DIR, rel), 'utf8');
  assert.equal(run1[rel], golden);
  const files = renderExternalEventBridgeFiles(input);
  assert.equal(files.length, 1);
  assert.equal(files[0].kind, 'external-event-bridge');
  assert.equal(files[0].sources.length, 11);
  assert.deepEqual(files[0].deps, [
    'app/example/bankwealth/domain/FundOrderProtocol.scala',
    'app/example/bankwealth/domain/values/BankPaymentResult.scala',
    'app/example/bankwealth/domain/values/BankRefundResult.scala',
    'app/example/bankwealth/domain/values/TaReceipt.scala',
  ]);
});

test('emission bridge passes non-manifest contexts through untouched', () => {
  const sentinel = [{ path: 'app/example/inventory/domain/OrderExternalEvents.scala', kind: 'external-event-bridge', content: 'classic' }];
  const out = withFlippedExternalEventBridges(() => sentinel, {
    products: {
      'reference-layout': { declarations: [{ ref: { context: 'inventory', kind: 'aggregate', owner: [], id: 'Order' } }] },
      'domain-dependencies': { externalProducers: [] },
    },
    options: { packages: [{ context: 'inventory', package: 'example.inventory' }] },
  });
  assert.strictEqual(out, sentinel);
});

test('emission bridge and derivation fail closed on missing classic file, orphan, or malformed products', () => {
  const kp = readJson(path.join(FIXTURE_DIR, 'knowledge-products.json'));
  const ctx = { products: kp.products, options: kp.options };
  assert.throws(
    () => withFlippedExternalEventBridges(() => [], ctx),
    /EEB_EMISSION:.*0 of 1 classic files present/,
  );
  assert.throws(
    () => withFlippedExternalEventBridges(() => [
      { path: 'app/example/bankwealth/domain/FundOrderExternalEvents.scala', kind: 'external-event-bridge', content: 'old' },
      { path: 'app/example/bankwealth/domain/GhostExternalEvents.scala', kind: 'external-event-bridge', content: 'orphan' },
    ], ctx),
    /EEB_EMISSION:.*outside the derived contract/,
  );
  assert.throws(
    () => deriveExternalEventBridges({}, kp.options),
    /EEB_DERIVATION:/,
  );
});

test('embedded negative battery rejects all malformed input mutations', () => {
  const input = readJson(path.join(FIXTURE_DIR, 'input.json'));
  const result = family.runNegatives(input);
  assert.equal(result.expected, 19);
  assert.equal(result.rejected, 19);
  assert.deepEqual(result.failures, []);
});
