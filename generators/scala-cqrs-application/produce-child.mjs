import { applicationRegistry } from './produce.mjs';
import { renderExecutionPlans } from './render-execution.mjs';
import { renderChildPlans } from './render-child-plans.mjs';
import { renderChildHosts } from './render-child-hosts.mjs';
import { applicationBuild } from './render-build.mjs';
import { renderProto } from '../scala-cqrs-domain/render-serialization.mjs';
import { renderScaffold } from '../scala-cqrs-domain/scaffold.mjs';
import { packageFor } from '../scala-cqrs-domain/naming.mjs';
import { renderHostVerification } from './render-host-verification.mjs';
export function createChildRegistry(version = '1') {
const base = applicationRegistry(version);
const footprint=ids=>ids.map(id=>({id,version:id==='domain-dependencies'||id==='domain-folds'?(version==='2'?'6':'5'):id==='domain-external-events'||id==='artifact-contract'?'2':'1'}));
const ids=['reference-layout','execution-contract','saga-host-contract','saga-runtime-contract','child-plan-contract'];
const buildIds=['reference-layout','domain-dependencies','domain-folds','exact-value-types','exact-value-codecs','saga-host-contract','execution-contract','child-plan-contract'];
return Object.freeze({...base,
 'finite-host-dsl':Object.freeze({version,produce:c=>[...base['finite-host-dsl'].produce(c).filter(e=>e.kind!=='generated-test').map(e=>({...e,productFootprint:[...e.productFootprint,{id:'child-plan-contract',version:'1'}]})),...renderHostVerification(c,footprint(['reference-layout','saga-host-contract','saga-runtime-contract','artifact-contract','domain-external-events','execution-contract','child-plan-contract']),true)]}),
 'finite-execution-dsl':Object.freeze({version,produce:c=>[...renderExecutionPlans(c,footprint(ids)),...renderChildPlans(c,footprint(ids)),...renderChildHosts(c,footprint(ids))]}),
 'proto-dsl':Object.freeze({version,produce:c=>[...renderProto(c,footprint(buildIds)),...applicationBuild(c,footprint(buildIds),renderScaffold(c,footprint(buildIds),true)).map(e=>{
  if(e.path!=='src/main/resources/application.conf')return e;
  const appended=c.products['execution-contract'].pipelines.flatMap(p=>p.steps.filter(s=>s.awaitChildRun).map(s=>{const child=c.products['child-plan-contract'].plans.find(c=>c.ref.id===s.awaitChildRun.childRun.planRef.pipelineId),pkg=packageFor(child.ref.context,c.options),name=p.id.replaceAll('-','_')+'_'+s.id.replaceAll('-','_')+'ChildHost';return {pkg,name};})).map(({pkg,name},i)=>'akka.actor.serializers.child'+i+' = '+JSON.stringify(pkg+'.application.'+name+'Serializer')+'\nakka.actor.serialization-bindings.'+JSON.stringify(pkg+'.application.'+name+'$Event')+' = child'+i+'\n').join('');
  return {...e,content:e.content+'\n'+appended};
 })]})
});
}
export const childRegistry = createChildRegistry();
export const childRegistryV2 = createChildRegistry('2');
