// Derivation-layer acceptance (emitter-unification plan F2): the knowledge
// products of the flipped payment business case must derive, fail-closed and
// exactly, the curated pipeline-invocation-face contract — and through the
// fail-closed family envelope, the curated golden bytes. The knowledge fixture
// is the product-payload slice the derivation reads (host, execution pipeline,
// both saga-runtime descriptors for the scalar resolution, the five selected
// technical artifacts for exact ownership, and the nine layout declarations the
// type/field resolution touches); extending the derivation's reads past this
// slice fails here with 'exactly one layout declaration required' instead of
// silently passing against stale knowledge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { derivePipelineInvocationFace, isFlipped, flipHostBase, PIPELINE_INVOCATION_FLIPS } from '../lib/derivation/pipeline-invocation-face.mjs';
import { getFamily, renderFamily } from '../emitter/registry.mjs';
import '../emitter/families/index.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = () => parseStrictJson(fs.readFileSync(path.join(ROOT, 'test/fixtures/pipeline-invocation-face-v1/knowledge-products.json'), 'utf8'));
const curated = () => parseStrictJson(fs.readFileSync(path.join(ROOT, 'test/reference/curated/pipeline-invocation-face/v1/technical-input.json'), 'utf8'));
const GOLDEN = path.join(ROOT, 'test/reference/curated/pipeline-invocation-face/v1');

test('the flipped payment business case derives exactly the curated face contract', () => {
  const f = fixture();
  assert.deepEqual(derivePipelineInvocationFace(f.products, f.options, 'bank-payment-host'), curated());
});

test('the derived contract renders the curated golden bytes through the family envelope', () => {
  const f = fixture();
  const contract = derivePipelineInvocationFace(f.products, f.options, 'bank-payment-host');
  const outputs = renderFamily(getFamily('pipeline-invocation-face'), contract);
  assert.equal(Object.keys(outputs).length, 7);
  for (const [relative, content] of Object.entries(outputs)) {
    assert.equal(content, fs.readFileSync(path.join(GOLDEN, relative), 'utf8'), relative);
  }
});

test('derivation is fail-closed on unknown hosts and broken runtime identity', () => {
  const f = fixture();
  assert.throws(() => derivePipelineInvocationFace(f.products, f.options, 'bank-refund-host'), /flip manifest entry/);
  assert.throws(() => derivePipelineInvocationFace(f.products, f.options, 'no-such-host'), /flip manifest entry/);
  const broken = fixture();
  broken.products['saga-runtime-contract'].sagas[0].definitionDigest = 'c13f703e';
  assert.throws(() => derivePipelineInvocationFace(broken.products, broken.options, 'bank-payment-host'), /sha256: prefix/);
  const unversioned = fixture();
  unversioned.products['saga-runtime-contract'].sagas[0].runtimeIdentity.version = 'bank-v1-1';
  assert.throws(() => derivePipelineInvocationFace(unversioned.products, unversioned.options, 'bank-payment-host'), /must be an integer/);
});

test('the flip manifest is the single flip switch and carries the base-name invariant', () => {
  assert.deepEqual([...PIPELINE_INVOCATION_FLIPS], [{ pipeline: 'bank-cash-payment-v1', host: 'bank-payment-host', case: 'payment', docShort: 'payment', docLong: 'cash purchase payment' }]);
  assert.equal(isFlipped('bank-payment-host'), true);
  assert.equal(isFlipped('bank-refund-host'), false);
  assert.equal(flipHostBase('bank-payment-host'), 'BankPayment');
  assert.throws(() => flipHostBase('bank-cash-payment-v1'), /must end in -host/);
});
