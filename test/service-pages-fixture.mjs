import { serviceApplicationFixture } from './service-application-fixture.mjs';

// A complete authored inventory request, not a patched compilation payload.
// Both source and binding include pages before the public compiler is invoked.
export function servicePagesFixture(variant = 'inventory-mixed-effect-products') {
  const { request, options } = serviceApplicationFixture(variant);
  const canonical = request.documents.find(d => d.id === 'domain').value;
  const artifact = canonical.artifactContracts.find(a => a.id === options.service.artifact);
  artifact.deployment.service.pages = {
    schemaVersion: 'truthsrc.service-pages/v1',
    shellPath: '/inventory/v1',
    scriptPath: '/inventory/v1/client-script',
    renderer: { id: 'example.inventory.InventoryPages', version: '1' },
    aliases: [
      { endpointId: 'allocation-query', path: '/inventory/v1/allocations/:id' },
      { endpointId: 'allocation-record', path: '/inventory/v1/allocations' }
    ]
  };
  request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts = canonical.artifactContracts.map((a, i) => ({
    ...structuredClone(a), source: { document: 'domain', pointer: '/artifactContracts/' + i }
  }));
  return { request, options };
}
