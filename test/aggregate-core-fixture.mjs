import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';

export const aggregateCoreProject = fileURLToPath(new URL('../scaffold/aggregate-core-project/truthsrc.project.json', import.meta.url));
export const aggregateCoreReference = fileURLToPath(new URL('./reference/aggregate-core/project/', import.meta.url));
export const aggregateCoreOracle = fileURLToPath(new URL('./reference/aggregate-core/oracle/', import.meta.url));

// Real rich-author input, not editable canonical/request or renderer output.
// Registration and CLI project admission are separate main-integration gates.
// This helper performs Node-only product semantics and never launches a JVM.
export function aggregateCoreFixture(projectFile = aggregateCoreProject) {
  const config = JSON.parse(readFileSync(projectFile, 'utf8'));
  const tree = resolve(dirname(projectFile), config.tree);
  const { canonical, sourceIndex } = compileTreeWithSources(tree, { context: config.context });
  const documents = config.documents.map(({ id, file }) => {
    const value = JSON.parse(readFileSync(resolve(dirname(projectFile), file), 'utf8'));
    return { id, schemaVersion: value.schemaVersion, value };
  });
  const request = deriveProjectRequest(canonical, config, documents);
  const compilation = compileProductSet(request);
  if (!compilation.result) throw new Error('aggregate-core author admission failed: ' + JSON.stringify(compilation.diagnostics));
  const products = Object.fromEntries(compilation.result.products.map(product => [product.id, product.payload]));
  return { projectFile, config, tree, canonical, sourceIndex, request, compilation, products };
}
