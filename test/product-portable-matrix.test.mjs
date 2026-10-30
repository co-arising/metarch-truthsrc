import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { planProductSet } from '../src/core/product-plan.mjs';
import { generate as domainGenerate } from '../generators/scala-cqrs-domain/generate.mjs';
import { generate as applicationGenerate } from '../generators/scala-cqrs-application/generate.mjs';
import { generate as childGenerate } from '../generators/scala-cqrs-child-application/generate.mjs';
import { generate as designGenerate } from '../generators/product-design-review/generate.mjs';
import { registry } from '../generators/scala-cqrs-application/produce.mjs';

const fixtures = new URL('./fixtures/', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const request = name => readProductRequest(fileURLToPath(new URL(name + '/files.json', fixtures)));
const options = name => JSON.parse(readFileSync(new URL(name + '/options.json', fixtures)));
const applicationManifest = json('../generators/scala-cqrs-application/generator.json');
const compile = name => { const c = compileProductSet(request(name)); assert.deepEqual(c.diagnostics, []); return c; };
const reject = (result, code) => {
  assert.equal(result.plan, null);
  assert.ok(result.diagnostics.some(d => d.code === code), JSON.stringify(result.diagnostics));
};
test('complete domain, corner, direct, pure, invoke, child and design profiles give deterministic source-only plans', () => {
  const cases = [
    ['domain-generation', domainGenerate, '../generators/scala-cqrs-domain/generator.json'],
    ['domain-generation-corners', domainGenerate, '../generators/scala-cqrs-domain/generator.json'],
    ['inventory-host-products', applicationGenerate, '../generators/scala-cqrs-application/generator.json'],
    ['inventory-execution-products', applicationGenerate, '../generators/scala-cqrs-application/generator.json'],
    ['inventory-invocation-products', applicationGenerate, '../generators/scala-cqrs-application/generator.json'],
    ['inventory-child-products', childGenerate, '../generators/scala-cqrs-child-application/generator.json'],
    ['product-design-products/inventory', designGenerate, '../generators/product-design-review/generator.json'],
  ];
  for (const [name, generate, file] of cases) {
    const input = { compilation: compile(name), manifest: json(file), options: options(name) }, before = structuredClone(input);
    const first = generate(input), second = generate(input);
    assert.deepEqual(first.diagnostics, [], name); assert.deepEqual(second, first); assert.deepEqual(input, before);
    assert.ok(Object.isFrozen(first.plan) && first.plan.entries.length > 0);
    assert.ok(first.plan.entries.every(e => e.content.length > 0 && !e.content.includes('???') && e.knowledgeIds.length > 0));
    assert.equal(new Set(first.plan.entries.map(e => e.path)).size, first.plan.entries.length);
    assert.ok(first.plan.entries.every(e => e.deps.every(p => first.plan.entries.some(x => x.path === p))));
    if (name.includes('corners')) assert.deepEqual(input.compilation.result.products.find(p => p.id === 'reference-layout').payload.contexts, ['measurement', 'logistics']);
    if (name.startsWith('product-design')) assert.equal(first.plan.entries.length, 7);
  }
});
test('each missing product, capability, version, source or role is rejected without invoking any producer', () => {
  const original = compile('inventory-host-products'); assert.equal(original.result.products.length, 12);
  for (const [i, p] of original.result.products.entries()) for (const mutation of ['missing', 'capability', 'version', 'source', 'role']) {
    const c = structuredClone(original), changed = c.result.products[i];
    if (mutation === 'missing') c.result.products.splice(i, 1);
    if (mutation === 'capability') changed.capabilities = [];
    if (mutation === 'version') changed.version = 'unsupported-version';
    if (mutation === 'source') changed.sources[0].pointer = '/not-authored';
    if (mutation === 'role') changed.inputRoles.canonical = 'not-a-document';
    let calls = 0;
    const counted = Object.fromEntries(Object.entries(registry).map(([id, impl]) => [id, { version: impl.version, produce: () => { calls++; throw new Error('producer must not run'); } }]));
    const result = planProductSet({ compilation: c, manifest: applicationManifest, options: options('inventory-host-products') }, counted);
    reject(result, 'PRODUCT_PLAN_INPUT'); assert.equal(calls, 0, p.id + '/' + mutation);
  }
});
test('every trusted producer version is required; manifest options and target declarations fail closed', () => {
  const compilation = compile('inventory-host-products'), input = { compilation, manifest: applicationManifest, options: options('inventory-host-products') };
  for (const producer of applicationManifest.producers) {
    const missing = { ...registry }; delete missing[producer.id];
    reject(planProductSet(input, missing), 'PRODUCT_PRODUCER');
    reject(planProductSet(input, { ...registry, [producer.id]: { ...registry[producer.id], version: 'wrong' } }), 'PRODUCT_PRODUCER');
  }
  reject(planProductSet({ ...input, options: { ...input.options, secretValue: 'forbidden-test-value' } }, registry), 'PRODUCT_FIELD_UNKNOWN');
  const manifest = structuredClone(applicationManifest); manifest.products[0].capabilities = [];
  reject(planProductSet({ ...input, manifest }, registry), 'PRODUCT_MANIFEST');
  const c = structuredClone(compilation); c.result.readiness.runnable = true;
  reject(planProductSet({ ...input, compilation: c }, registry), 'PRODUCT_PLAN_INPUT');
});
