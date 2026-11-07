import { planProductSet } from '../../src/core/product-plan.mjs';
import { fail } from '../../lib/products/request.mjs';
import { buildModels } from './build-models.mjs';
import { serializationModel } from './serialization-model.mjs';
import { render } from './render.mjs';

const productIds = ['reference-layout', 'exact-value-types', 'domain-decision', 'domain-dependencies',
  'domain-folds', 'domain-external-events', 'exact-value-codecs'];
const versions = { 'reference-layout': '1', 'exact-value-types': '1', 'domain-decision': '4',
  'domain-dependencies': '6', 'domain-folds': '6', 'domain-external-events': '2', 'exact-value-codecs': '1' };

export function generate(input) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-domain-kernel@1')
    fail('PRODUCT_PRODUCER', 'explicit domain-kernel family1 profile required');
  return planProductSet(input, {
    'domain-kernel': {
      version: '1',
      produce(context) {
        const products = Object.fromEntries(productIds.map(id => [id, context.products[id]]));
        const model = buildModels({ products, options: context.options });
        const serialization = serializationModel(model);
        const footprint = productIds.map(id => ({ id, version: versions[id] }));
        return render(model, serialization, footprint);
      },
    },
  });
}
