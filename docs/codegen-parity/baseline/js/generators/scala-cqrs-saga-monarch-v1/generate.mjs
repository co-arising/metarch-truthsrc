import manifest from './generator.json' with { type: 'json' };
import { types } from 'node:util';
import { planProductSet } from '../../src/core/product-plan.mjs';
import { at, detach, equal, fail, object, ProductError } from '../../lib/products/request.mjs';
import { implementationBuildInputs } from '../../lib/project/implementations.mjs';
import { buildModels, productIds } from './build-models.mjs';
import { render } from './render.mjs';

const expectedManifest = detach(manifest), location = at('saga-monarch-generator');

/** Public entry. Exactly one plan gate replays compilation before either render. */
export function generate(raw, context = {}) {
  try {
    const input = detach(raw);
    object(input, ['compilation', 'manifest', 'options'], location);
    if (!equal(input.manifest, expectedManifest)) fail('PRODUCT_PRODUCER', 'complete fixed scala-cqrs-saga-monarch@1 manifest required', location);
    if (!context || typeof context !== 'object' || types.isProxy(context) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(context)))
      fail('SAGA_MONARCH_CAPTURE_REQUIRED', 'plain live capture invocation context required', location);
    const descriptors = Object.getOwnPropertyDescriptors(context);
    if (Reflect.ownKeys(descriptors).some(key => !['implementations', 'outDir'].includes(key)) ||
        Object.values(descriptors).some(d => !Object.hasOwn(d, 'value') || !d.enumerable))
      fail('SAGA_MONARCH_CAPTURE_REQUIRED', 'context must have own enumerable data fields only', location);
    const implementations = descriptors.implementations?.value, outDir = descriptors.outDir?.value;
    if (!implementations || typeof outDir !== 'string') fail('SAGA_MONARCH_CAPTURE_REQUIRED', 'live implementations and explicit absolute outDir required', location);
    const requirements = input.compilation?.result?.requirements;
    if (!Array.isArray(requirements) || requirements.length !== productIds.length ||
        productIds.some(id => requirements.filter(r => r.id === id && r.version === manifest.products.find(p => p.id === id).version).length !== 1))
      fail('SAGA_MONARCH_PRODUCTS', 'exactly the eight frozen product requirements are required', location);
    return planProductSet(input, {
      'saga-monarch': { version: '1', produce(context) {
        const products = Object.fromEntries(productIds.map(id => [id, context.products[id]]));
        const model = buildModels({ products, options: context.options });
        const roots = implementationBuildInputs(implementations, { ...model.lowered, outDir });
        return render(model, roots);
      } },
    });
  } catch (error) {
    if (error instanceof ProductError) return detach({ plan: null, diagnostics: [error.diagnostic] });
    if (error instanceof TypeError) return detach({ plan: null, diagnostics: [{ code: 'PRODUCT_PRODUCER',
      message: 'producer violated the frozen Saga/Monarch boundary', source: location, related: [] }] });
    throw error;
  }
}

export { resolveSagaMonarchTarget, resolveTarget } from './build-models.mjs';
