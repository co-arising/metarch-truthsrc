import { planProductSet } from '../../src/core/product-plan.mjs';
import { requireApplicationArtifact } from '../scala-cqrs-application/generate.mjs';
import { effectRegistryV2 } from '../scala-cqrs-application/produce-effect.mjs';
import { fail } from '../../lib/products/request.mjs';
export function generate(input) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-effect-application@2') fail('APPLICATION_EFFECT', 'explicit nominal-text effect application profile required');
  requireApplicationArtifact(input);
  const effects = input.compilation?.result?.products.find(p => p.id === 'effect-host-contract');
  if (!effects?.payload.hosts.length) fail('APPLICATION_EFFECT', 'complete admitted effect-host product required');
  return planProductSet(input, effectRegistryV2);
}
