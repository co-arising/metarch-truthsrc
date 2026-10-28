import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { planProductSet } from '../src/core/product-plan.mjs';

const input = () => compileProductSet(readProductRequest(fileURLToPath(new URL('./fixtures/guards-v3/files.json', import.meta.url))));
const declaration = { id: 'domain-decision', version: '3', payloadSchemaVersion: 'truthsrc.domain-decision/v3', capabilities: [{ id: 'ordered-domain-decision', version: '3' }] };
const manifest = { schemaVersion: 'truthsrc.product-generator/v1', name: 'plan-test', version: '1', targetProfile: 'test-only-source-contract',
  products: [declaration], producers: [{ id: 'test', version: '1', products: ['domain-decision'], artifactKinds: ['source'] }], artifactKinds: ['source'], options: [] };
const entry = () => ({ path: 'app/Test.scala', content: 'object Test {}\n', kind: 'source', deps: [], knowledgeIds: ['test:source'],
  productFootprint: [{ id: 'domain-decision', version: '3' }], merge: null });
const plan = produce => planProductSet({ compilation: input(), manifest }, { test: { version: '1', produce } });
const reject = (result, code) => { assert.equal(result.plan, null); assert.ok(result.diagnostics.some(d => d.code === code), JSON.stringify(result)); };

test('formal plan calls trusted producer twice with only declared frozen products and options', () => {
  let calls = 0;
  const result = plan(view => {
    calls++; assert.equal(Object.isFrozen(view.products['domain-decision']), true);
    assert.deepEqual(Object.keys(view.products), ['domain-decision']); assert.deepEqual(view.options, {});
    return [entry()];
  });
  assert.deepEqual(result.diagnostics, []); assert.equal(calls, 2); assert.equal(result.plan.entries.length, 1);
  assert.ok(Object.isFrozen(result.plan.entries[0]));
});
test('undeclared products and mutation do not bypass source planning', () => {
  reject(plan(view => { view.products['domain-dependencies']; return [entry()]; }), 'PRODUCT_UNDECLARED');
  reject(plan(view => { view.products['domain-decision'].commands.pop(); return [entry()]; }), 'PRODUCT_PRODUCER');
});
test('second output is validated independently and first output cannot be mutated to fake determinism', () => {
  let calls = 0;
  reject(plan(() => { calls++; return [{ ...entry(), kind: calls === 1 ? 'source' : 'undeclared' }]; }), 'PRODUCT_ENTRY');
  const reused = [entry()]; calls = 0;
  reject(plan(() => { if (++calls === 2) reused[0].content = 'changed'; return reused; }), 'PRODUCT_NONDETERMINISTIC');
});
test('unsafe, alias, reserved, bad merge, missing dependency and unsupported placeholders are refused', () => {
  for (const [path, code] of [['../escape.scala', 'PRODUCT_PATH'], ['/escape.scala', 'PRODUCT_PATH'], ['anchors.json', 'PRODUCT_PATH'], ['app//File.scala', 'PRODUCT_PATH']]) reject(plan(() => [{ ...entry(), path }]), code);
  reject(plan(() => [entry(), { ...entry(), path: 'APP/test.scala' }]), 'PRODUCT_PATH_ALIAS');
  reject(plan(() => [{ ...entry(), merge: 'overwrite' }]), 'PRODUCT_ENTRY');
  reject(plan(() => [{ ...entry(), deps: ['app/Missing.scala'] }]), 'PRODUCT_ENTRY_DEPENDENCY');
  reject(plan(() => [{ ...entry(), content: 'object Test { val x = ??? }' }]), 'PRODUCT_ENTRY');
});
test('forged successful compilation flags and missing target requirements never reach a producer', () => {
  const c = input(); const forged = JSON.parse(JSON.stringify(c)); forged.result.products[0].payload.extra = true;
  let calls = 0; const registry = { test: { version: '1', produce: () => { calls++; return [entry()]; } } };
  reject(planProductSet({ compilation: forged, manifest }, registry), 'PRODUCT_PLAN_INPUT'); assert.equal(calls, 0);
  reject(planProductSet({ compilation: c, manifest: { ...manifest, products: [{ ...declaration, version: '2' }] } }, registry), 'PRODUCT_MANIFEST');
});
