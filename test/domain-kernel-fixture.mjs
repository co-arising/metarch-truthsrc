import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';

export const domainKernelProject = fileURLToPath(new URL('../scaffold/domain-kernel-project/truthsrc.project.json', import.meta.url));
export const domainKernelReference = fileURLToPath(new URL('./reference/domain-kernel/project/', import.meta.url));
export const domainKernelOracle = fileURLToPath(new URL('./reference/domain-kernel/oracle/', import.meta.url));

// Read the actual author project. No second canonical/request fixture, renderer,
// product mutation or synthetic success result is involved in this admission.
// Generator registration is deliberately outside this pure semantic fixture;
// CLI/captureProject admission is a separate integration gate.
export function domainKernelFixture(projectFile = domainKernelProject) {
  const config = JSON.parse(readFileSync(projectFile, 'utf8'));
  const tree = resolve(dirname(projectFile), config.tree);
  const { canonical, sourceIndex } = compileTreeWithSources(tree, { context: config.context });
  const documents = config.documents.map(({ id, file }) => {
    const value = JSON.parse(readFileSync(resolve(dirname(projectFile), file), 'utf8'));
    return { id, schemaVersion: value.schemaVersion, value };
  });
  const request = deriveProjectRequest(canonical, config, documents);
  const compilation = compileProductSet(request);
  if (!compilation.result) throw new Error('domain-kernel author admission failed: ' + JSON.stringify(compilation.diagnostics));
  const products = Object.fromEntries(compilation.result.products.map(product => [product.id, product.payload]));
  return { projectFile, config, tree, canonical, sourceIndex, request, compilation, products };
}
