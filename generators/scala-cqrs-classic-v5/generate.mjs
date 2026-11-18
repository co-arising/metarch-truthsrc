import { planProductSet } from '../../src/core/product-plan.mjs';
import { produce, version } from './produce.mjs';
import { CLASSIC_FULL_SCAFFOLD_PRODUCER, isClassicFullScaffoldManifest } from '../../lib/classic-architecture/target-v5.mjs';
import { at, fail } from '../../lib/products/request.mjs';

const producers = Object.freeze({ 'classic-source-scaffold': Object.freeze({ version, produce, [CLASSIC_FULL_SCAFFOLD_PRODUCER]: true }) });

export function generate({ compilation, manifest, options }) {
  if (!isClassicFullScaffoldManifest(manifest)) fail('CLASSIC_TARGET', 'exact classic @5 scaffold manifest required', at('manifest'));
  const products = compilation?.result?.products;
  if (!Array.isArray(products) || products.length !== 1 || products[0].id !== 'classic-architecture')
    fail('CLASSIC_TARGET_INPUT', 'classic scaffold consumes exactly one classic-architecture product', at('compilation'));
  return planProductSet({ compilation, manifest, options }, producers);
}
