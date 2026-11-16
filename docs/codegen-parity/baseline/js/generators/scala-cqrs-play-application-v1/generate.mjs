import manifest from './generator.json' with { type: 'json' };
import { types } from 'node:util';
import { planProductSet } from '../../src/core/product-plan.mjs';
import { at, detach, equal, fail, object, ProductError } from '../../lib/products/request.mjs';
import { implementationBuildInputs } from '../../lib/project/implementations.mjs';
import { buildModels, productIds } from './build-models.mjs';
import { render } from './render.mjs';

const expectedManifest = detach(manifest), location = at('play-application-generator');
export function generate(raw, context = {}) {
  try {
    const input = detach(raw);
    object(input, ['compilation', 'manifest', 'options'], location);
    if (!equal(input.manifest, expectedManifest)) fail('PRODUCT_PRODUCER', 'complete fixed application manifest required', location);
    if (!context || typeof context !== 'object' || types.isProxy(context) || ![Object.prototype, null].includes(Object.getPrototypeOf(context)))
      fail('APPLICATION_CAPTURE_REQUIRED', 'plain live capture context required', location);
    const descriptors = Object.getOwnPropertyDescriptors(context);
    if (Reflect.ownKeys(descriptors).some(key => !['implementations', 'outDir'].includes(key)) ||
        Object.values(descriptors).some(d => !Object.hasOwn(d, 'value') || !d.enumerable))
      fail('APPLICATION_CAPTURE_REQUIRED', 'own data-only capture context required', location);
    const implementations = descriptors.implementations?.value, outDir = descriptors.outDir?.value;
    if (!implementations || typeof outDir !== 'string') fail('APPLICATION_CAPTURE_REQUIRED', 'live implementations and absolute output required', location);
    const requirements = input.compilation?.result?.requirements;
    if (!Array.isArray(requirements) || requirements.length !== productIds.length ||
        productIds.some(id => requirements.filter(r => r.id === id && r.version === manifest.products.find(p => p.id === id).version).length !== 1))
      fail('APPLICATION_PRODUCTS', 'exact ten-product closure required', location);
    return planProductSet(input, {
      'play-application': { version: '1', produce(context) {
        const products = Object.fromEntries(productIds.map(id => [id, context.products[id]]));
        const m = buildModels({ products, options: context.options });
        const roots = implementationBuildInputs(implementations, { sourceRoots: m.composition.sourceRoots, handwritten: m.composition.handwritten, outDir });
        const footprint = productIds.map(id => ({ id, version: manifest.products.find(p => p.id === id).version }));
        return render(m, roots, footprint);
      } },
    });
  } catch (error) {
    if (error instanceof ProductError) return detach({ plan: null, diagnostics: [error.diagnostic] });
    if (error instanceof TypeError) return detach({ plan: null, diagnostics: [{ code: 'PRODUCT_PRODUCER', message: error.message, source: location, related: [] }] });
    throw error;
  }
}
export { resolveApplicationTarget } from './build-models.mjs';
