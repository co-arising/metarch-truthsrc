import { planProductSet } from '../../src/core/product-plan.mjs';
import { produce, version } from './produce.mjs';
import { CLASSIC_SCAFFOLD_PRODUCER, isClassicScaffoldManifest } from '../../lib/classic-architecture/target.mjs';
import { at, fail } from '../../lib/products/request.mjs';

const producers = Object.freeze({ 'classic-aggregate-scaffold': Object.freeze({ version, produce, [CLASSIC_SCAFFOLD_PRODUCER]: true }) });

export function generate({ compilation, manifest, options }) {
  if (!isClassicScaffoldManifest(manifest)) fail('CLASSIC_TARGET', 'exact classic scaffold manifest required', at('manifest'));
  const products = compilation?.result?.products;
  if (!Array.isArray(products) || products.length !== 1 || products[0].id !== 'classic-architecture')
    fail('CLASSIC_TARGET_INPUT', 'classic scaffold consumes exactly one classic-architecture product', at('compilation'));
  return planProductSet({ compilation, manifest, options }, producers);
}
