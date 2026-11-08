import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';

export const projectRoot = fileURLToPath(new URL('../scaffold/module-seams-project/', import.meta.url));
export const ref = (kind, id) => ({ context: 'parcel', kind, owner: [], id });
export const nominal = id => ({ form: 'nominal', ref: ref('type', id) });
export const methodRef = (port, method) => ({ port: ref('port', port), method });
export function moduleSeamsFixture() {
  const config = JSON.parse(readFileSync(projectRoot + 'truthsrc.project.json', 'utf8'));
  const tree = compileTreeWithSources(projectRoot + config.tree);
  const documents = config.documents.map(d => {
    const value = JSON.parse(readFileSync(projectRoot + d.file, 'utf8'));
    return { id: d.id, schemaVersion: value.schemaVersion, value };
  });
  const canonical = { id: config.canonicalId, schemaVersion: tree.canonical.schemaVersion, value: tree.canonical };
  return { config, tree, canonical, documents, composition: documents[0] };
}
export function compileFixture() {
  const f = moduleSeamsFixture();
  const request = deriveProjectRequest(f.tree.canonical, f.config, f.documents);
  return { ...f, request, compilation: compileProductSet(request) };
}
