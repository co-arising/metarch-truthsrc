import manifest from './generator.json' with { type: 'json' };
import { planProductSet } from '../../src/core/product-plan.mjs';
import { at, detach, equal, fail, object, ProductError } from '../../lib/products/request.mjs';
import { buildModels, productFootprint } from './build-models.mjs';
import { render } from './render.mjs';

import { implementationBuildInputs } from '../../lib/project/implementations.mjs';
import { types } from 'node:util';

const expectedManifest = detach(manifest);

/** The ONLY public producer entry. Raw evidence clones and capture-free plans fail closed. */
export function generate(rawInput, context = {}) {
  try {
    const input = detach(rawInput);
    object(input, ['compilation', 'manifest', 'options'], at('module-seams-generator'));
    if (!equal(input.manifest, expectedManifest))
      fail('PRODUCT_PRODUCER', 'the complete fixed scala-cqrs-module-seams@1 manifest is required');
    // Do not detach the live capture: identity is the private capture module's capability.
    if (!context || typeof context !== 'object' || types.isProxy(context) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(context)) ||
        Reflect.ownKeys(context).some(k => !['implementations', 'outDir'].includes(k)))
      fail('MODULE_SEAMS_CAPTURE_REQUIRED', 'plain capture invocation context required');
    object(context, ['implementations', 'outDir'].filter(k => Object.hasOwn(context, k)), at('module-seams-generator'));
    const descriptors = Object.getOwnPropertyDescriptors(context);
    if (Object.values(descriptors).some(d => !Object.hasOwn(d, 'value')))
      fail('MODULE_SEAMS_CAPTURE_REQUIRED', 'capture invocation context must not contain accessors');
    const implementations = descriptors.implementations?.value, outDir = descriptors.outDir?.value;
    if (!implementations)
      fail('MODULE_SEAMS_CAPTURE_REQUIRED', 'a live implementation capture and explicit absolute output directory are required');
    const model = buildModels({ compilation: input.compilation, options: input.options });
    const buildSourceRoots = implementationBuildInputs(implementations, {
      sourceRoots: model.lowered.sourceRoots, handwritten: model.lowered.handwritten, outDir,
    });
    return planProductSet(input, {
      'module-seams': { version: '1', produce(produceContext) {
        // Restricted products are read explicitly, never enumerated/copied or mutated.
        if (!equal(produceContext.products['module-seams-contract'], model.lowered.contract) ||
            !equal(produceContext.products['module-seams-composition'], model.lowered.composition) ||
            !equal(produceContext.options, input.options))
          fail('MODULE_SEAMS_PRODUCT_DRIFT', 'both producer payloads and options must equal this fresh closure model');
        return render(model, buildSourceRoots, productFootprint);
      } },
    });
  } catch (error) {
    if (error instanceof ProductError) return detach({ plan: null, diagnostics: [error.diagnostic] });
    if (error instanceof TypeError) return detach({ plan: null, diagnostics: [{ code: 'PRODUCT_PRODUCER',
      message: 'producer violated the frozen module-seams input boundary', source: at('module-seams-generator'), related: [] }] });
    throw error;
  }
}
