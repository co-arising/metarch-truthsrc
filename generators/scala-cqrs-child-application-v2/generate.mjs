import { planProductSet } from '../../src/core/product-plan.mjs';
import { childRegistryV2 } from '../scala-cqrs-application/produce-child.mjs';
import { requireApplicationArtifact } from '../scala-cqrs-application/generate.mjs';
import { fail } from '../../lib/products/request.mjs';
export function generate(input) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-child-application@2') fail('PRODUCT_PRODUCER', 'explicit nominal-text child application profile required');
  requireApplicationArtifact(input);
  return planProductSet(input, childRegistryV2);
}
