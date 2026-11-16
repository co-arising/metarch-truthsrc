import * as review from './produce.mjs';
import { planProductSet } from '../../src/core/product-plan.mjs';

export const producerRegistry = Object.freeze({
  'product-design-review': Object.freeze({ version: review.version, produce: review.produce }),
});
export function generate({ compilation, manifest, options }) {
  return planProductSet({ compilation, manifest, options }, producerRegistry);
}
