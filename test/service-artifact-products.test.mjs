import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProductSet } from '../lib/products/compile.mjs';
import { profileFor } from '../lib/products/registry.mjs';
import { serviceArtifactFixture } from './service-artifact-fixture.mjs';

const artifact = request => request.documents.find(d => d.id === 'domain').value.artifactContracts[0];
const synchronize = request => {
  request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts[0] = {
    ...structuredClone(artifact(request)), source: { document: 'domain', pointer: '/artifactContracts/0' }
  };
};
test('explicit service artifact compiles full pinned deployment and leaves readiness static', () => {
  const request = serviceArtifactFixture(), before = structuredClone(request);
  const compiled = compileProductSet(request);
  assert.deepEqual(compiled.diagnostics, []);
  assert.deepEqual(request, before);
  assert.deepEqual(compiled.result.products.find(p => p.id === 'artifact-contract').payload.artifacts[0].deployment.service,
    artifact(request).deployment.service);
  assert.equal(compiled.result.readiness.runnable, false);
});
test('service host profiles retain old exact dependencies and explicitly opt into artifact v3', () => {
  for (const id of ['saga-host-contract', 'effect-host-contract']) {
    assert.equal(profileFor(id, '1').requires.find(p => p.id === 'artifact-contract').version, '2');
    assert.equal(profileFor(id, '2').requires.find(p => p.id === 'artifact-contract').version, '3');
  }
});
for (const [name, mutate] of [
  ['missing selected owner', a => { a.status = 'proposal'; }],
  ['machine command on customer endpoint', a => { a.deployment.service.endpoints[1].operation = 'seed'; }],
  ['write over GET', a => { a.deployment.service.endpoints[1].method = 'GET'; }],
  ['missing CSRF', a => { a.deployment.service.endpoints[1].csrf = false; }],
  ['duplicate normalized route', a => { a.deployment.service.endpoints.push({ ...a.deployment.service.endpoints[0], id: 'other', path: '/api/v1/observations/:other' }); }],
  ['unknown implementation pin', a => { a.deployment.service.bootstrap.version = '2'; }],
  ['undeclared connection reference', a => { a.deployment.service.journal.connectionRef = 'missing'; }],
  ['aliased journal and read-side connection', a => { a.deployment.service.readSide.connectionRef = a.deployment.service.journal.connectionRef; }],
  ['injected deployment source', a => { a.deployment.service.scala = 'arbitrary source'; }],
  ['traversal route', a => { a.deployment.service.endpoints[0].path = '/api/../secret'; }],
  ['unbound output type', a => { a.deployment.service.endpoints[0].outputType = { form: 'primitive', name: 'string' }; }],
  ['implicit local journal fallback', a => { a.deployment.service.journal.provider = 'inmemory'; }],
  ['empty namespace', a => { a.deployment.service.namespaceConfig = ''; }]
]) test('service rejects ' + name + ' before binding payload comparison', () => {
  const request = serviceArtifactFixture(); mutate(artifact(request)); synchronize(request);
  const result = compileProductSet(request);
  assert.equal(result.result, null);
  assert.ok(result.diagnostics.some(d => d.code.startsWith('SERVICE_')), JSON.stringify(result.diagnostics));
});
test('projection maps the complete event key with exact nominal field types', () => {
  const request = serviceArtifactFixture();
  const ref = (kind, owner, id) => ({ context: 'measurement', kind, owner, id });
  artifact(request).deployment.service.projections = [{ id: 'observation-view', version: 'v1',
    aggregate: ref('aggregate', [], 'Gauge'), viewType: ref('type', [], 'Observation'),
    keyFields: [ref('member', ['Observation'], 'observationId')], events: [{ event: ref('event', ['Gauge'], 'Observed'),
      fields: ['observationId', 'level'].map(id => ({ target: ref('member', ['Observation'], id), source: ref('event-slot', ['Gauge', 'Observed'], id) })) }] }];
  synchronize(request);
  assert.deepEqual(compileProductSet(request).diagnostics, []);
  for (const mutate of [
    p => { p.events = [null]; },
    p => { p.keyFields = [null]; },
    p => { p.events[0].fields = [null]; },
    p => { p.events[0].fields[0].source = ref('event-slot', ['Gauge', 'Observed'], 'level'); },
    p => { p.events[0].fields = p.events[0].fields.slice(1); }
  ]) {
    const bad = structuredClone(request); mutate(artifact(bad).deployment.service.projections[0]); synchronize(bad);
    const result = compileProductSet(bad);
    assert.equal(result.result, null);
    assert.ok(result.diagnostics.length);
  }
});

test('old artifact versions do not silently admit service deployment fields', () => {
  for (const version of ['1', '2']) {
    const request = serviceArtifactFixture();
    const binding = request.documents.find(d => d.id === 'artifacts');
    binding.schemaVersion = binding.value.schemaVersion = 'truthsrc.artifact-binding/v' + version;
    const requirement = request.requirements.find(r => r.id === 'artifact-contract'), p = profileFor('artifact-contract', version);
    Object.assign(requirement, { version, payloadSchemaVersion: p.payloadSchemaVersion, capabilities: p.capabilities, requires: p.requires });
    assert.equal(compileProductSet(request).result, null);
  }
});
