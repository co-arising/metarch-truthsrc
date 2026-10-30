import { planProductSet } from '../../src/core/product-plan.mjs';
import { requireApplicationArtifact } from '../scala-cqrs-application/generate.mjs';
import { effectRegistry } from '../scala-cqrs-application/produce-effect.mjs';
import { fail } from '../../lib/products/request.mjs';

export function generate(input) {
  requireApplicationArtifact(input);
  if (input.manifest?.targetProfile !== 'scala-cqrs-effect-application@1') fail('APPLICATION_EFFECT', 'explicit finite effect application profile required');
  const effects = input.compilation?.result?.products.find(p => p.id === 'effect-host-contract');
  if (!effects?.payload.hosts.length) fail('APPLICATION_EFFECT', 'complete admitted effect-host product required');
  return planProductSet(input, effectRegistry);
}
