import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { PROFILES } from '../lib/products/registry.mjs';
export function artifactFixture() {
  const r = structuredClone(readProductRequest(fileURLToPath(new URL('./fixtures/domain-generation/files.json', import.meta.url))));
  const c = r.documents.find(d => d.id === 'domain').value, layout = r.documents.find(d => d.id === 'references').value.layout;
  const ref = (kind, id) => ({ context: 'measurement', kind, owner: [], id });
  const inputType = { form: 'primitive', name: 'string' }, outputType = { form: 'nominal', ref: ref('type', 'Observation') };
  const index = c.ports.length;
  c.ports.push({ name: 'ObservationTransport', version: '1', inputType, outputType });
  layout.declarations.push({ ref: ref('port', 'ObservationTransport'), valueType: null, source: { document: 'domain', pointer: '/ports/' + index }, dependencies: [] });
  const artifact = { id: 'measurement-adapter', version: '1', artifact: ref('artifact', 'MeasurementAdapter'), status: 'proposal',
    provenance: [{ document: 'domain', pointer: '/valueObjects/1' }], references: [ref('type', 'Observation')],
    ports: [{ ref: ref('port', 'ObservationTransport'), version: '1', inputType, outputType, required: true }],
    deployment: { id: 'local-measurement', version: '1', secretRefs: [{ id: 'observation-token', provider: 'environment' }] },
    implementations: [{ port: ref('port', 'ObservationTransport'), id: 'observation-transport', version: '1' }] };
  c.artifactContracts = [artifact];
  layout.declarations.push({ ref: structuredClone(artifact.artifact), valueType: null, source: { document: 'domain', pointer: '/artifactContracts/0' }, dependencies: [] });
  r.documents.push({ id: 'artifacts', schemaVersion: 'truthsrc.artifact-binding/v1', value: { schemaVersion: 'truthsrc.artifact-binding/v1', artifacts: { artifacts: [{ ...artifact, source: { document: 'domain', pointer: '/artifactContracts/0' } }] } } });
  const p = PROFILES['artifact-contract'];
  r.requirements.push({ id: 'artifact-contract', version: p.version, payloadSchemaVersion: p.payloadSchemaVersion, capabilities: structuredClone(p.capabilities), requires: structuredClone(p.requires), inputRoles: { canonical: 'domain', artifactBinding: 'artifacts' } });
  return r;
}
test('artifact envelope preserves authored proposal and typed implementation obligations without runtime approval', () => {
  const r = artifactFixture(), before = structuredClone(r), result = compileProductSet(r);
  assert.deepEqual(result.diagnostics, []); assert.deepEqual(r, before);
  const p = result.result.products.find(p => p.id === 'artifact-contract');
  assert.equal(p.payload.artifacts[0].status, 'proposal'); assert.equal(result.result.readiness.runnable, false);
});
test('artifact provenance port pins secret values and missing implementations fail closed', () => {
  for (const mutate of [a => { a.status = 'approved'; }, a => { a.provenance[0].pointer = '/missing'; }, a => { a.ports[0].version = '2'; },
    a => { a.deployment.secretRefs[0].value = 'not-a-real-secret'; }, a => { a.implementations = []; }, a => { a.artifact.id = 'missing'; }]) {
    const r = artifactFixture(); mutate(r.documents.find(d => d.id === 'domain').value.artifactContracts[0]);
    const result = compileProductSet(r); assert.equal(result.result, null); assert.ok(result.diagnostics.length);
  }
});
