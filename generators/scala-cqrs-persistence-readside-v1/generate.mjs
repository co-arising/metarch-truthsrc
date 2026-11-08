import { planProductSet } from '../../src/core/product-plan.mjs';
import { fail } from '../../lib/products/request.mjs';
import { buildModels, productIds, productVersions } from './build-models.mjs';
import { render } from './render.mjs';

export function generate(input) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-persistence-readside@1')
    fail('PRODUCT_PRODUCER', 'explicit persistence-readside family4 profile required');
  return planProductSet(input, {
    'persistence-readside': {
      version: '1',
      produce(context) {
        const products = Object.fromEntries(productIds.map(id => [id, context.products[id]]));
        return render(buildModels({ products, options: context.options }), productIds.map((id, i) => ({ id, version: productVersions[i] })));
      },
    },
  });
}
