import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedExternalTypeFixture } from './external-shared-type-fixture.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate, producerRegistry as registry } from '../generators/scala-cqrs-domain/generate.mjs';
import { planProductSet } from '../src/core/product-plan.mjs';
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = json('../generators/scala-cqrs-domain/generator.json');
const options = json('./fixtures/domain-generation/options.json');

test('distinct authority events sharing a nominal output retain all bridges and one dependency per path', () => {
  const request = sharedExternalTypeFixture(), before = structuredClone(request);
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  const input = { compilation, manifest, options }, result = generate(input);
  assert.deepEqual(result.diagnostics, []);
  const bridge = result.plan.entries.find(e => e.kind === 'external-event-bridge');
  assert.match(bridge.content, /def observation_ingress\(/);
  assert.match(bridge.content, /def reobservation_ingress\(/);
  assert.deepEqual(bridge.deps, ['app/net/imadz/measurement/domain/GaugeProtocol.scala', 'app/net/imadz/measurement/domain/values/Observation.scala']);
  assert.equal(bridge.knowledgeIds.length, 2);
  assert.deepEqual(generate(input), result);
  assert.deepEqual(request, before);
});

test('the strict source plan still refuses duplicate dependency evidence from a producer', () => {
  const compilation = compileProductSet(sharedExternalTypeFixture());
  assert.deepEqual(compilation.diagnostics, []);
  const command = registry['command-dsl'];
  const injected = { ...registry, 'command-dsl': { version: command.version, produce(context) {
    return command.produce(context).map(entry => entry.kind !== 'external-event-bridge' ? entry : { ...entry, deps: [...entry.deps, entry.deps[0]] });
  } } };
  const result = planProductSet({ compilation, manifest, options }, injected);
  assert.equal(result.plan, null);
  assert.equal(result.diagnostics[0].code, 'PRODUCT_ENTRY');
});
