import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate as generateApplication } from '../generators/scala-cqrs-application/generate.mjs';
import { generate as generateService } from '../generators/scala-cqrs-play-service/generate.mjs';
import { serviceApplicationFixture } from './service-application-fixture.mjs';
import { loadCatalogue } from '../lib/artifact-docs/catalog.mjs';

const { catalog } = loadCatalogue();
const known = new Set(catalog.categories.flatMap(category => category.aliases.jsKinds));
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
function inspect(result) {
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.plan?.entries.length);
  for (const entry of result.plan.entries) assert.ok(known.has(entry.kind), entry.path + ':' + entry.kind);
  return result.plan.entries;
}

test('actual pure application plan output kinds resolve in the central catalogue', () => {
  const root = new URL('./fixtures/inventory-host-products/', import.meta.url);
  const request = readProductRequest(fileURLToPath(new URL('files.json', root)));
  const compilation = compileProductSet(request);
  const manifest = json('../generators/scala-cqrs-application/generator.json');
  const options = JSON.parse(readFileSync(new URL('options.json', root), 'utf8'));
  const input = { compilation, manifest, options }, first = generateApplication(input);
  const entries = inspect(first);
  assert.deepEqual(generateApplication(input), first);
  assert.ok(entries.some(entry => entry.kind === 'technical-port'));
  assert.ok(entries.some(entry => entry.kind === 'invocation-host'));
  assert.ok(entries.some(entry => entry.kind === 'saga-definition'));
});

test('actual service plan covers implementation ports, layers and generated test/config entries without target writes', () => {
  const { request, options } = serviceApplicationFixture();
  const compilation = compileProductSet(request);
  const manifest = json('../generators/scala-cqrs-play-service/generator.json');
  const first = generateService({ compilation, manifest, options });
  const entries = inspect(first);
  for (const kind of ['service-port', 'service-runtime', 'service-test', 'aggregate-repository', 'application-protocol', 'aggregate-bootstrap'])
    assert.ok(entries.some(entry => entry.kind === kind), kind);
  assert.ok(entries.every(entry => entry.deps.every(path => entries.some(other => other.path === path))));
});
