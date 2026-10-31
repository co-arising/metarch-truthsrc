import { readProductRequest } from '../lib/products/cli.mjs';

export function serviceArtifactFixture() {
  const request = structuredClone(readProductRequest(new URL('./fixtures/domain-generation/files.json', import.meta.url).pathname));
  const canonical = request.documents.find(d => d.id === 'domain').value;
  const layout = request.documents.find(d => d.id === 'references').value.layout;
  const ref = (kind, id) => ({ context: 'measurement', kind, owner: [], id });
  const source = { document: 'domain', pointer: '/artifactContracts/0' };
  const inputType = { form: 'nominal', ref: ref('type', 'Observation') };
  const ports = ['ServiceBootstrap', 'ReadObservation', 'RecordObservation'];
  for (const name of ports) {
    const pointer = '/ports/' + canonical.ports.length;
    canonical.ports.push({ name, version: '1', inputType, outputType: inputType });
    layout.declarations.push({ ref: ref('port', name), valueType: null, source: { document: 'domain', pointer }, dependencies: [] });
  }
  const pin = id => ({ ref: ref('port', id), version: '1' });
  const service = {
    schemaVersion: 'truthsrc.play-service/v1', profile: 'scala-cqrs-play-service@1',
    bootstrap: pin('ServiceBootstrap'), namespaceConfig: 'measurement.namespace',
    journal: { provider: 'mongodb-rxmongo', version: '3.0.8', connectionRef: 'journal-connection' },
    readSide: { provider: 'mysql-jdbc', driverVersion: '8.0.33', projectionVersion: '1.2.5', connectionRef: 'readside-connection' },
    endpoints: [
      { id: 'observation-query', method: 'GET', path: '/api/v1/observations/:id', audience: 'customer', operation: 'query',
        port: pin('ReadObservation'), inputType, outputType: inputType, csrf: false },
      { id: 'observation-record', method: 'POST', path: '/api/v1/observations', audience: 'customer', operation: 'command',
        port: pin('RecordObservation'), inputType, outputType: inputType, csrf: true }
    ],
    projections: [],
  };
  const artifact = { id: 'measurement-service', version: '1', artifact: ref('artifact', 'MeasurementService'), status: 'selected',
    provenance: [{ document: 'domain', pointer: '/valueObjects/1' }], references: [ref('type', 'Observation')],
    ports: ports.map(id => ({ ...pin(id), inputType, outputType: inputType, required: true })),
    deployment: { id: 'measurement-play-service', version: '1', secretRefs: [
      { id: 'journal-connection', provider: 'environment' }, { id: 'readside-connection', provider: 'environment' }
    ], service }, implementations: ports.map(id => ({ port: ref('port', id), id: 'measurement.' + id, version: '1' })) };
  canonical.artifactContracts = [artifact];
  layout.declarations.push({ ref: artifact.artifact, valueType: null, source, dependencies: [] });
  request.documents.push({ id: 'artifacts', schemaVersion: 'truthsrc.artifact-binding/v3', value: {
    schemaVersion: 'truthsrc.artifact-binding/v3', artifacts: { artifacts: [{ ...artifact, source }] }
  } });
  request.requirements.push({ id: 'artifact-contract', version: '3', payloadSchemaVersion: 'truthsrc.artifact-contract/v3',
    capabilities: [{ id: 'artifact-static-contract', version: '3' }], requires: [{ id: 'reference-layout', version: '1' }],
    inputRoles: { canonical: 'domain', artifactBinding: 'artifacts' } });
  return request;
}
