import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { artifactCapabilityFixture } from './artifact-capability-fixtures.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { matchOutputContracts } from '../lib/artifact-docs/capabilities.mjs';
import { jsonBytes, sha256 } from '../lib/artifact-docs/io.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export async function observeArtifactCapability(catalog, id) {
  const { request, options, producer: producerId } = artifactCapabilityFixture(id);
  const producer = catalog.producers.find(producer => producer.id === producerId);
  assert.ok(producer, 'fixture producer is not cataloged');
  const manifest = JSON.parse(readFileSync(join(root, producer.manifest.file), 'utf8'));
  const { generate } = await import(pathToFileURL(join(root, dirname(producer.manifest.file), 'generate.mjs')));
  const before = structuredClone({ request, options });
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  const result = generate({ compilation, manifest, options });
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.plan.entries.length);
  assert.deepEqual(generate({ compilation, manifest, options }), result);
  assert.deepEqual({ request, options }, before);
  const contracts = new Map(producer.outputs.map(output => [output.id, output]));
  const store = request.documents.find(document => document.id === 'domain').value.artifactContracts?.find(artifact => artifact.id === options.service?.artifact)?.deployment.service;
  const exact = compilation.result.products.find(product => product.id === 'exact-value-types')?.payload;
  const omitted = new Set();
  const artifacts = result.plan.entries.map(entry => {
    const eligible = matchOutputContracts(producer, entry, 'manifest');
    assert.ok(eligible.length, 'unmapped actual output: ' + entry.path + ':' + entry.kind);
    const observed = eligible.filter(id => {
      const output = contracts.get(id);
      if (output.conditions.some(condition => condition.includes('service.pages')) && !store?.pages) { omitted.add(id); return false; }
      if (output.conditions.some(condition => /projectionStore/.test(condition)) && !store?.projectionStore) { omitted.add(id); return false; }
      if (output.conditions.some(condition => condition.startsWith('exact descriptors')) && !exact?.length) { omitted.add(id); return false; }
      return true;
    });
    assert.ok(observed.length, 'no executed contract for actual output: ' + entry.path);
    if (observed.some(id => contracts.get(id).conditions.some(condition => condition.includes('service.pages'))))
      assert.match(entry.content, /PageRenderer|pageAliases|pageShell|pageScript|pages\./);
    return { path: entry.path, kind: entry.kind, bytes: Buffer.byteLength(entry.content), sha256: sha256(entry.content), contracts: observed.sort() };
  });
  const outputs = [...new Set(artifacts.flatMap(artifact => artifact.contracts))].sort();
  return { producer: producerId, inputs: [{ name: 'request', sha256: sha256(jsonBytes(request)) }, { name: 'options', sha256: sha256(jsonBytes(options)) }],
    artifacts, outputs, omitted: [...omitted].sort(), checks: [
      { name: 'product-compilation-has-no-diagnostics', passed: true },
      { name: 'pure-producer-has-no-diagnostics', passed: true },
      { name: 'repeat-plan-is-identical', passed: true },
      { name: 'request-and-options-unchanged', passed: true },
      { name: 'actual-path-kind-channel-and-conditional-contracts', passed: true }
    ] };
}
