import { planProductSet } from '../../src/core/product-plan.mjs';
import { registry } from './produce.mjs';
import { fail } from '../../lib/products/request.mjs';
export function requireApplicationArtifact({compilation,options}) {
  if (options?.runtimeArtifact?.coordinate !== 'net.imadz:saga-core_2.13:0.2.1-p23.20261027.1' || options.runtimeArtifact.sha256 !== 'f20ad61eba670d2766cd39a1f75bd236351d0069b0480bb85d7335ffff93f8cf') fail('APPLICATION_ARTIFACT','explicit frozen P23 runtime coordinate and exact artifact SHA required');
  if (typeof options.runtimeArtifact.repository !== 'string' || !options.runtimeArtifact.repository.startsWith('file:///') || Object.keys(options.runtimeArtifact).sort().join(',') !== 'coordinate,repository,sha256,symbolicTarget') fail('APPLICATION_ARTIFACT','exact explicit file repository runtime artifact binding required');
  const runtime=compilation?.result?.products.find(p=>p.id==='saga-runtime-contract')?.payload;
  if (!runtime || runtime.target.artifact !== options.runtimeArtifact.symbolicTarget) fail('APPLICATION_ARTIFACT','symbolic runtime target must explicitly match consumed product without changing its status');
}
export function generate({compilation,manifest,options}) {
  requireApplicationArtifact({compilation,options});
  return planProductSet({compilation,manifest,options},registry);
}
