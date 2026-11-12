import { planProductSet } from '../../src/core/product-plan.mjs';
import { registry } from './produce.mjs';
import { fail } from '../../lib/products/request.mjs';
export function requireApplicationArtifact({compilation,options}) {
  if (options?.runtimeArtifact?.coordinate !== 'net.imadz:saga-core_2.13:0.3.0' || options.runtimeArtifact.sha256 !== '550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862') fail('APPLICATION_ARTIFACT','explicit frozen runtime coordinate and exact artifact SHA required');
  if (typeof options.runtimeArtifact.repository !== 'string' || !options.runtimeArtifact.repository.startsWith('file:///') || Object.keys(options.runtimeArtifact).sort().join(',') !== 'coordinate,repository,sha256,symbolicTarget') fail('APPLICATION_ARTIFACT','exact explicit file repository runtime artifact binding required');
  const runtime=compilation?.result?.products.find(p=>p.id==='saga-runtime-contract')?.payload;
  if (!runtime || runtime.target.artifact !== options.runtimeArtifact.symbolicTarget) fail('APPLICATION_ARTIFACT','symbolic runtime target must explicitly match consumed product without changing its status');
}
export function generate({compilation,manifest,options}) {
  requireApplicationArtifact({compilation,options});
  return planProductSet({compilation,manifest,options},registry);
}
