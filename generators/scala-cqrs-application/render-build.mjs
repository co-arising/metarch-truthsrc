import { packageFor } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';
export function applicationBuild({products,options},footprint,entries) {
 const runtime=options.runtimeArtifact;
 if(!runtime || runtime.coordinate!=='net.imadz:saga-core_2.13:0.2.1-p23.20261027.1')fail('APPLICATION_ARTIFACT','frozen runtime artifact binding required');
 return entries.map(e=>{
  if(e.path==='build.sbt')return {...e,content:e.content+'\nresolvers += "explicit-frozen-runtime" at '+JSON.stringify(runtime.repository)+'\nlibraryDependencies += "net.imadz" %% "saga-core" % "0.2.1-p23.20261027.1"\n'};
  if(e.path==='src/main/resources/application.conf')return {...e,content:e.content+'\nakka.actor.serializers.strict-saga = "net.imadz.infra.saga.strict.StrictSagaSerializer"\nakka.actor.serialization-bindings."net.imadz.infra.saga.strict.StrictDurable" = strict-saga\n'+products['saga-host-contract'].hosts.map((h,i)=>{const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_');return 'akka.actor.serializers.host'+i+' = '+JSON.stringify(pkg+'.application.'+stem+'HostSerializer')+'\n'+'akka.actor.serialization-bindings.'+JSON.stringify(pkg+'.application.'+stem+'Host$Event')+' = host'+i+'\n';}).join('')};
  return e;
 });
}
