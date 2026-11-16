import { planProductSet } from '../../src/core/product-plan.mjs';
import { produce, version } from './produce.mjs';
import { CLASSIC_AGGREGATE_SCAFFOLD_PRODUCER, isClassicAggregateScaffoldManifest } from '../../lib/classic-architecture/target-v3.mjs';
import { at, fail } from '../../lib/products/request.mjs';

const producers = Object.freeze({ 'classic-source-scaffold': Object.freeze({ version, produce, [CLASSIC_AGGREGATE_SCAFFOLD_PRODUCER]: true }) });

export function generate({ compilation, manifest, options }) {
  if (!isClassicAggregateScaffoldManifest(manifest)) fail('CLASSIC_TARGET', 'exact classic @3 scaffold manifest required', at('manifest'));
  const products = compilation?.result?.products;
  if (!Array.isArray(products) || products.length !== 1 || products[0].id !== 'classic-architecture')
    fail('CLASSIC_TARGET_INPUT', 'classic scaffold consumes exactly one classic-architecture product', at('compilation'));
  return planProductSet({ compilation, manifest, options }, producers);
}
