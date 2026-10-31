import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-application/generate.mjs';
const root = new URL('./fixtures/inventory-invocation-products/', import.meta.url);
export function wrongAuthorityInputFixture() {
  const request = structuredClone(readProductRequest(new URL('files.json', root).pathname));
  const canonical = request.documents.find(d => d.id === 'domain').value;
  const result = canonical.sagaHosts[0].results[0];
  canonical.ports.find(p => p.name === result.authorityPort.ref.id).inputType = result.inputType.ref.id;
  for (const artifacts of [canonical.artifactContracts, request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts]) {
    artifacts.flatMap(a => a.ports).find(p => p.ref.id === result.authorityPort.ref.id).inputType = structuredClone(result.inputType);
  }
  return request;
}
test('source planning rejects authority signatures that cannot consume the complete retained original', () => {
  const compilation = compileProductSet(wrongAuthorityInputFixture());
  assert.deepEqual(compilation.diagnostics, []);
  const options = JSON.parse(readFileSync(new URL('options.json', root)));
  const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-application/generator.json', import.meta.url)));
  const result = generate({ compilation, manifest, options });
  assert.equal(result.plan, null);
  assert.equal(result.diagnostics[0].code, 'APPLICATION_HOST');
  assert.match(result.diagnostics[0].message, /authority.*original/);
});
