import { readFileSync } from 'node:fs';
import { compileReferences } from '../lib/domain-products/references.mjs';
import { deriveProductDesigns } from '../lib/products/designs.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { COMPILATION, PROFILES } from '../lib/products/registry.mjs';

export function designRequest(name = 'inventory') {
  const read = file => JSON.parse(readFileSync(new URL('./fixtures/product-design-products/' + name + '/' + file, import.meta.url), 'utf8'));
  const canonical = { id: 'domain', schemaVersion: 'truthsrc/v1', value: read('domain.json') };
  const references = { id: 'references', schemaVersion: 'truthsrc.reference-binding/v1', value: read('references.json') };
  const layout = compileReferences(references, canonical, [canonical, references]);
  const payload = deriveProductDesigns(canonical, layout);
  const designs = { id: 'designs', schemaVersion: 'truthsrc.product-design-binding/v1', value: { schemaVersion: 'truthsrc.product-design-binding/v1', designs: payload } };
  const requirements = ['reference-layout', 'product-design'].map(id => {
    const p = PROFILES[id];
    return { id, version: p.version, payloadSchemaVersion: p.payloadSchemaVersion, capabilities: structuredClone(p.capabilities),
      inputRoles: id === 'reference-layout' ? { canonical: 'domain', referenceBinding: 'references' } : { canonical: 'domain', designBinding: 'designs' }, requires: structuredClone(p.requires) };
  });
  return { schemaVersion: COMPILATION, documents: [canonical, references, designs], assemblies: [], requirements, options: {} };
}
export function compiledDesign(name) {
  const value = compileProductSet(designRequest(name));
  if (!value.result) throw new Error(JSON.stringify(value.diagnostics));
  return value.result;
}
