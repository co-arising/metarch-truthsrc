import { planProductSet } from '../../src/core/product-plan.mjs';
import { producerRegistryV2 } from '../scala-cqrs-domain/produce-v2.mjs';
import { fail } from '../../lib/products/request.mjs';
export function generate(input) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-domain@2') fail('PRODUCT_PRODUCER', 'explicit nominal-text domain profile required');
  return planProductSet(input, producerRegistryV2);
}
