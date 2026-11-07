import { readFileSync } from 'node:fs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { profileFor } from '../lib/products/registry.mjs';
import { designRequest } from './product-design-fixtures.mjs';
import { serviceApplicationFixture } from './service-application-fixture.mjs';
import { servicePagesFixture } from './service-pages-fixture.mjs';

const files = {
  'scala-cqrs-domain': 'domain-generation',
  'scala-cqrs-domain-v2': 'tickets-domain-v4-products',
  'scala-cqrs-application': 'inventory-host-products',
  'scala-cqrs-application-v2': 'inventory-host-products',
  'scala-cqrs-child-application': 'inventory-child-products',
  'scala-cqrs-child-application-v2': 'inventory-child-products',
  'scala-cqrs-effect-application': 'inventory-mixed-effect-products',
  'scala-cqrs-effect-application-v2': 'inventory-mixed-effect-products'
};
export const CAPABILITY_CASES = [...Object.keys(files), 'product-design-review', 'scala-cqrs-play-service', 'scala-cqrs-play-service-pages', 'scala-cqrs-play-service-journal'];
export function artifactCapabilityFixture(id) {
  if (id === 'product-design-review') return { request: designRequest('inventory'), options: {}, producer: id };
  if (id === 'scala-cqrs-play-service') return { ...serviceApplicationFixture(), producer: id };
  if (id === 'scala-cqrs-play-service-pages') return { ...servicePagesFixture(), producer: 'scala-cqrs-play-service' };
  if (id === 'scala-cqrs-play-service-journal') {
    const fixture = servicePagesFixture(), { request, options } = fixture;
    const canonical = request.documents.find(document => document.id === 'domain').value;
    const artifact = canonical.artifactContracts.find(artifact => artifact.id === options.service.artifact);
    const reference = (kind, owner, id) => ({ context: 'inventory', kind, owner, id });
    artifact.deployment.service.projectionStore = {
      schemaVersion: 'truthsrc.journal-readside/v1', id: 'InventoryJournal', version: '1', tablePrefix: 'inventory_rs',
      pollIntervalMillis: 100, closeTimeoutMillis: 5000,
      streams: [{ kind: 'allocation', aggregate: reference('aggregate', [], 'AllocationOrder'),
        identity: reference('state-field', ['AllocationOrder'], 'status'), allowEmptyIdentity: false,
        eventIdentities: [{ event: reference('event', ['AllocationOrder'], 'AllocationPrepared'),
          field: reference('event-slot', ['AllocationOrder', 'AllocationPrepared'], 'txid') }] }],
      technicalKinds: ['workflow'], indexes: []
    };
    request.documents.find(document => document.id === 'artifacts').value.artifacts.artifacts = canonical.artifactContracts.map((artifact, index) => ({
      ...structuredClone(artifact), source: { document: 'domain', pointer: '/artifactContracts/' + index }
    }));
    return { ...fixture, producer: 'scala-cqrs-play-service' };
  }
  const name = files[id];
  if (!name) throw new Error('unknown capability fixture: ' + id);
  const directory = new URL('./fixtures/' + name + '/', import.meta.url);
  const request = structuredClone(readProductRequest(new URL('files.json', directory).pathname));
  const options = JSON.parse(readFileSync(new URL('options.json', directory), 'utf8'));
  if (id.endsWith('-v2') && id !== 'scala-cqrs-domain-v2') {
    for (const [product, version, documentId, schemaVersion] of [
      ['domain-decision', '4', 'decisions', 'truthsrc.domain-semantic-binding/v4'],
      ['domain-dependencies', '6', 'dependencies', 'truthsrc.domain-dependency-binding/v6'],
      ['domain-folds', '6', 'folds', 'truthsrc.domain-fold-binding/v6']
    ]) {
      const profile = profileFor(product, version);
      Object.assign(request.requirements.find(row => row.id === product), { version,
        payloadSchemaVersion: profile.payloadSchemaVersion, capabilities: profile.capabilities, requires: profile.requires });
      const document = request.documents.find(row => row.id === documentId);
      document.schemaVersion = schemaVersion; document.value.schemaVersion = schemaVersion;
    }
  }
  return { request, options, producer: id };
}
