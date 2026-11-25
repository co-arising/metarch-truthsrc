// Derivation-layer acceptance (emitter-unification plan F2, family #44): the
// knowledge products of the flipped dispatch+ta business cases must derive,
// fail-closed and exactly, the curated effect-face contract — and through the
// fail-closed family envelope, the six curated golden bytes. The pair is the
// emission unit (the family contract itself carries both cases). The knowledge
// fixture is the product-payload slice the derivation reads; extending the
// derivation's reads past this slice fails here with 'exactly one layout
// declaration required' instead of silently passing against stale knowledge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveEffectFace, isEffectFlipped, effectFlipHostClass } from '../lib/derivation/effect-face.mjs';
import { getFamily, renderFamily } from '../emitter/registry.mjs';
import '../emitter/families/index.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = () => parseStrictJson(fs.readFileSync(path.join(ROOT, 'test/fixtures/effect-face-v1/knowledge-products.json'), 'utf8'));
const curated = () => parseStrictJson(fs.readFileSync(path.join(ROOT, 'test/reference/curated/effect-face/v1/technical-input.json'), 'utf8'));
const GOLDEN = path.join(ROOT, 'test/reference/curated/effect-face/v1');

test('the flipped dispatch+ta business cases derive exactly the curated effect contract', () => {
  const f = fixture();
  assert.deepEqual(deriveEffectFace(f.products, f.options), curated());
});

test('the derived contract renders the curated golden bytes through the family envelope', () => {
  const f = fixture();
  const contract = deriveEffectFace(f.products, f.options);
  const outputs = renderFamily(getFamily('effect-face'), contract);
  assert.equal(Object.keys(outputs).length, 6);
  for (const [relative, content] of Object.entries(outputs)) {
    assert.equal(content, fs.readFileSync(path.join(GOLDEN, relative), 'utf8'), relative);
  }
});

test('derivation is fail-closed on broken payload shapes', () => {
  const f = fixture();
  const noPorts = fixture();
  noPorts.products['effect-host-contract'].hosts[0].technicalPorts = noPorts.products['effect-host-contract'].hosts[0].technicalPorts.slice(0, 2);
  assert.throws(() => deriveEffectFace(noPorts.products, noPorts.options), /execute, query, reconcile roles in order/);
  const unversioned = fixture();
  unversioned.products['effect-host-contract'].hosts[0].version = null;
  assert.throws(() => deriveEffectFace(unversioned.products, unversioned.options), /required by the face contract/);
});

test('the effect retirement predicate is option-driven and carries the base-name invariant', () => {
  assert.equal(isEffectFlipped('bank-sip-dispatch', { emission: 'unified' }, 'bankwealth'), true);
  assert.equal(isEffectFlipped('warehouse-dispatch', { emission: 'unified' }, 'inventory'), true);
  assert.equal(isEffectFlipped('warehouse-dispatch', { emission: 'classic' }, 'inventory'), false);
  assert.equal(effectFlipHostClass('bank-sip-dispatch'), 'BankSipDispatchEffectHost');
  assert.equal(effectFlipHostClass('bank-ta-effect'), 'BankTaEffectHost');
  assert.equal(effectFlipHostClass('warehouse-dispatch'), 'WarehouseDispatchEffectHost');
  assert.throws(() => effectFlipHostClass('Bank Cash'), /must be a kebab-case identifier/);
});
