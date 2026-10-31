import { readFileSync } from 'node:fs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { profileFor } from '../lib/products/registry.mjs';
import { serviceArtifactFixture } from './service-artifact-fixture.mjs';

export function serviceApplicationFixture() {
  const root = new URL('./fixtures/inventory-mixed-effect-products/', import.meta.url);
  const request = structuredClone(readProductRequest(new URL('files.json', root).pathname));
  const options = JSON.parse(readFileSync(new URL('options.json', root), 'utf8'));
  for (const [id, version, doc, schema] of [
    ['domain-decision', '4', 'decisions', 'truthsrc.domain-semantic-binding/v4'],
    ['domain-dependencies', '6', 'dependencies', 'truthsrc.domain-dependency-binding/v6'],
    ['domain-folds', '6', 'folds', 'truthsrc.domain-fold-binding/v6'],
    ['artifact-contract', '3', 'artifacts', 'truthsrc.artifact-binding/v3'],
    ['saga-host-contract', '2', 'hosts', 'truthsrc.saga-host-binding/v1'],
    ['effect-host-contract', '2', 'effects', 'truthsrc.effect-host-binding/v1']
  ]) {
    const p = profileFor(id, version), row = request.requirements.find(r => r.id === id);
    Object.assign(row, { version, payloadSchemaVersion: p.payloadSchemaVersion, capabilities: p.capabilities, requires: p.requires });
    const document = request.documents.find(d => d.id === doc);
    document.schemaVersion = document.value.schemaVersion = schema;
  }
  const canonical = request.documents.find(d => d.id === 'domain').value;
  const layout = request.documents.find(d => d.id === 'references').value.layout;
  const template = serviceArtifactFixture().documents.find(d => d.id === 'domain').value.artifactContracts[0];
  const artifact = structuredClone(template);
  const ref = (kind, id) => ({ context: 'inventory', kind, owner: [], id });
  const type = structuredClone(canonical.effectHosts[0].requestType);
  const index = canonical.artifactContracts.length;
  artifact.id = 'inventory-service'; artifact.artifact = ref('artifact', 'InventoryService');
  artifact.provenance = [{ document: 'domain', pointer: '/effectHosts/0' }]; artifact.references = [type.ref];
  artifact.ports = ['ServiceBootstrap', 'ReadAllocation', 'RecordAllocation'].map(id => ({ ref: ref('port', id), version: '1', inputType: type, outputType: type, required: true }));
  artifact.implementations = artifact.ports.map(p => ({ port: p.ref, id: 'example.inventory.' + p.ref.id, version: '1' }));
  artifact.deployment.id = 'inventory-service';
  artifact.deployment.service.bootstrap = { ref: artifact.ports[0].ref, version: '1' };
  artifact.deployment.service.namespaceConfig = 'inventory.namespace';
  artifact.deployment.service.endpoints.forEach((e, i) => {
    e.id = ['allocation-query', 'allocation-record'][i]; e.path = ['/api/v1/allocations/:id', '/api/v1/allocations'][i];
    e.port = { ref: artifact.ports[i + 1].ref, version: '1' }; e.inputType = type; e.outputType = type;
  });
  for (const p of artifact.ports) {
    const pointer = '/ports/' + canonical.ports.length;
    canonical.ports.push({ name: p.ref.id, version: p.version, inputType: type, outputType: type });
    layout.declarations.push({ ref: p.ref, valueType: null, source: { document: 'domain', pointer }, dependencies: [] });
  }
  canonical.artifactContracts.push(artifact);
  layout.declarations.push({ ref: artifact.artifact, valueType: null, source: { document: 'domain', pointer: '/artifactContracts/' + index }, dependencies: [] });
  request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts = canonical.artifactContracts.map((a, i) => ({ ...structuredClone(a), source: { document: 'domain', pointer: '/artifactContracts/' + i } }));
  options.service = { artifact: artifact.id, externalSourceRoots: [] };
  return { request, options };
}
