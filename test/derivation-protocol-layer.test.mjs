import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveProtocolLayers } from '../lib/derivation/protocol-layer.mjs';
import { withFlippedCommandProtocols, withFlippedApplicationProtocols } from '../lib/derivation/protocol-layer-emission.mjs';
import { family, renderProtocolLayerFiles } from '../emitter/families/protocol-layer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/protocol-layer-v1/knowledge-products.json'), 'utf8'));
const GOLDEN_DIR = path.join(ROOT, 'test/reference/curated/protocol-layer/v1');
const TECHNICAL_INPUT = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, 'technical-input.json'), 'utf8'));

test('protocol-layer derivation reproduces curated technical-input.json', () => {
  const derived = deriveProtocolLayers(FIXTURE.products, FIXTURE.options);
  assert.deepEqual(derived, TECHNICAL_INPUT);
});

test('protocol-layer emitter renders 9/9 golden files byte-identically and deterministically', () => {
  const first = renderProtocolLayerFiles(TECHNICAL_INPUT);
  const second = renderProtocolLayerFiles(TECHNICAL_INPUT);
  assert.equal(first.length, 9);
  assert.deepEqual(first, second);
  for (const file of first) {
    const expected = fs.readFileSync(path.join(GOLDEN_DIR, file.path), 'utf8');
    assert.equal(file.content, expected, 'byte parity mismatch for ' + file.path);
  }
});

test('protocol-layer dual-row bridges pass through non-manifest contexts untouched', () => {
  const otherContext = {
    products: {
      'reference-layout': { declarations: [{ ref: { context: 'other', kind: 'aggregate', owner: [], id: 'Order' }, source: { document: 'd', pointer: '/a/0' } }] },
    },
    options: { packages: [{ context: 'other', package: 'example.other' }], emission: 'classic' },
  };
  const sentinel = [{ path: 'app/example/other/domain/OrderProtocol.scala', content: 'classic', kind: 'protocol' }];
  assert.deepEqual(withFlippedCommandProtocols(() => sentinel, otherContext), sentinel);
  assert.deepEqual(withFlippedApplicationProtocols(() => sentinel, otherContext), sentinel);
});

test('protocol-layer bridges fail closed on missing classic target or orphan file', () => {
  const ctx = { products: FIXTURE.products, options: FIXTURE.options };
  assert.throws(() => withFlippedCommandProtocols(() => [], ctx), /PL_EMISSION:.*0 of 6/);
  assert.throws(() => withFlippedApplicationProtocols(() => [], ctx), /PL_EMISSION:.*0 of 3/);

  const validCommandTargets = renderProtocolLayerFiles(TECHNICAL_INPUT)
    .filter(f => f.kind === 'protocol' || f.kind === 'command-helpers')
    .map(f => ({ path: f.path, content: 'classic', kind: f.kind, deps: [], knowledgeIds: [], productFootprint: [], merge: null }));
  const withOrphan = [...validCommandTargets, { path: 'app/example/bankwealth/domain/GhostProtocol.scala', content: 'classic', kind: 'protocol' }];
  assert.throws(() => withFlippedCommandProtocols(() => withOrphan, ctx), /PL_EMISSION:.*outside the derived contract/);

  const validAppTargets = renderProtocolLayerFiles(TECHNICAL_INPUT)
    .filter(f => f.kind === 'application-protocol')
    .map(f => ({ path: f.path, content: 'classic', kind: f.kind, deps: [], knowledgeIds: [], productFootprint: [], merge: null }));
  const withAppOrphan = [...validAppTargets, { path: 'app/example/bankwealth/application/aggregates/GhostProtocol.scala', content: 'classic', kind: 'application-protocol' }];
  assert.throws(() => withFlippedApplicationProtocols(() => withAppOrphan, ctx), /PL_EMISSION:.*outside the derived contract/);
});

test('protocol-layer embedded negative battery rejects 100% of mutations', () => {
  const result = family.runNegatives(TECHNICAL_INPUT);
  assert.ok(result.expected >= 20, 'expected at least 20 negative cases');
  assert.equal(result.rejected, result.expected);
  assert.deepEqual(result.failures, []);
});
