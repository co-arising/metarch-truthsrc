import { planProductSet } from '../../src/core/product-plan.mjs';
import { childRegistry } from '../scala-cqrs-application/produce-child.mjs';
import { requireApplicationArtifact } from '../scala-cqrs-application/generate.mjs';
export function generate(input) {
 requireApplicationArtifact(input);
 return planProductSet(input,childRegistry);
}
