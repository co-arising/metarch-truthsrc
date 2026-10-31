import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { invocationTextFixture } from './invocation-text-fixture.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-application/generate.mjs';
import { renderInvocationExecution } from '../generators/scala-cqrs-application/render-invocation-execution.mjs';
const json = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const manifest = json('../generators/scala-cqrs-application/generator.json');
const options = json('./fixtures/inventory-invocation-products/options.json');

test('complete finite invocation retains explicitly typed raw text in presence-aware protobuf', () => {
  const request = invocationTextFixture(), before = structuredClone(request), compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  const result = generate({ compilation, manifest, options });
  assert.deepEqual(result.diagnostics, []);
  const execution = result.plan.entries.find(e => e.kind === 'execution-plan');
  assert.match(execution.content, /memo: String/);
  assert.match(execution.content, /identity\[String\]/);
  assert.match(result.plan.entries.find(e => e.path.endsWith('/GeneratedFiniteHostSpec.scala')).content, /WarehouseId\("warehouse-B"\), "memo-original"\)\)/);
  assert.match(result.plan.entries.find(e => e.path.endsWith('_execution.proto')).content, /optional string input7 = 9;/);
  assert.deepEqual(generate({ compilation, manifest, options }), result);
  assert.deepEqual(request, before);
});

test('text lowering refuses missing, mismatched or wrongly shaped explicit runtime descriptors', () => {
  const compilation = compileProductSet(invocationTextFixture());
  assert.deepEqual(compilation.diagnostics, []);
  const original = Object.fromEntries(compilation.result.products.map(p => [p.id, p.payload]));
  for (const change of [
    p => { p['execution-contract'].pipelines[0].binding.types.find(t => t.id === 'Memo').implementation = 'wrong.String'; },
    p => { p['saga-runtime-contract'].sagas[0].args.types.find(t => t.id === 'Memo').canonicalType = 'Unspecified'; },
    p => { p['saga-runtime-contract'].sagas[0].args.types.find(t => t.id === 'Memo').kind = 'id'; },
    p => { p['saga-runtime-contract'].sagas[0].args.types = p['saga-runtime-contract'].sagas[0].args.types.filter(t => t.id !== 'Memo'); },
  ]) {
    const products = structuredClone(original); change(products);
    assert.throws(() => renderInvocationExecution({ products, options }, products['execution-contract'].pipelines[0], []), e => e.diagnostic?.code === 'APPLICATION_EXECUTION_TYPE');
  }
});
