import { planProductSet } from '../../src/core/product-plan.mjs';
import { registryV2 } from '../scala-cqrs-application/produce.mjs';
import { requireApplicationArtifact } from '../scala-cqrs-application/generate.mjs';
import { fail } from '../../lib/products/request.mjs';
export function generate(input) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-application@2') fail('PRODUCT_PRODUCER', 'explicit nominal-text application profile required');
  requireApplicationArtifact(input);
  return planProductSet(input, registryV2);
}
