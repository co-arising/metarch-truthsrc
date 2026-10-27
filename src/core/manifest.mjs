// manifest.mjs — generator.json loader/validator (fail-fast, CODEGEN.md §Generator manifest).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateDeclaredProducts } from './product-declarations.mjs';

const PRODUCTS = new Set(['template', 'readmodels', 'stories', 'useCases']);

export function loadManifest(genDir) {
  const file = join(genDir, 'generator.json');
  if (!existsSync(file)) throw new Error(`manifest missing: ${file}`);
  let m;
  try { m = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`${file}: malformed JSON (${e.message})`); }
  const fail = (msg) => { throw new Error(`${file}: ${msg}`); };
  if (typeof m.name !== 'string' || !/^_?[a-z0-9-]+$/.test(m.name)) fail('name required (slug-cased)');
  if (typeof m.inputSchema !== 'string' || !/^truthsrc\/v\d+\.\d+$/.test(m.inputSchema))
    fail('inputSchema required (truthsrc/vX.Y)');
  if (!Array.isArray(m.products) || !m.products.length || m.products.some((p) => !PRODUCTS.has(p)))
    fail(`products required, subset of: ${[...PRODUCTS].join('·')}`);
  if (!Array.isArray(m.artifactKinds) || !m.artifactKinds.length)
    fail('artifactKinds required (emitted file-kind vocabulary, feeds the concerns protocol)');
  if (!m.output || typeof m.output !== 'object') fail('output required (descriptive object)');
  if (Object.hasOwn(m, 'declaredProducts')) {
    const { diagnostics } = validateDeclaredProducts(m);
    if (diagnostics.length) fail(diagnostics.map(d => `${d.code} ${d.source.pointer}: ${d.message}`).join('; '));
  }
  return { ...m, __dir: genDir };
}
