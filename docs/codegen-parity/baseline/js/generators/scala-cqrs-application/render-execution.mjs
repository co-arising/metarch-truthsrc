import { entry, key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';
import { renderInvocationExecution } from './render-invocation-execution.mjs';

/** A finite ordered plan over typed immutable state; every stage effect is an injected obligation. */
export function renderExecutionPlans({products, options}, footprint) {
  const layout=products['reference-layout'];
  return products['execution-contract'].pipelines.flatMap(p => {
    if(p.steps.some(s=>s.invokeSaga)||Object.hasOwn(products,'effect-host-contract')&&products['effect-host-contract'].hosts.some(h=>h.pipeline.ref.id===p.id))return renderInvocationExecution({products,options},p,footprint);
    const contexts=[...new Set(layout.declarations.filter(d=>d.ref.kind==='pipeline'&&d.ref.id===p.id).map(d=>d.ref.context))];
    if(contexts.length!==1)fail('APPLICATION_EXECUTION','pipeline requires an exact qualified layout declaration');
    const context=contexts[0],pkg=packageFor(context,options),name=symbol(p.id.replaceAll('-','_'))+'Execution';
    const declaration=layout.declarations.find(d=>d.ref.context===context&&d.ref.kind==='pipeline'&&d.ref.id===p.id);
    const resolve=id=>{
      const pin=p.binding.types.find(t=>t.id===id);
      const rows=layout.declarations.filter(d=>d.ref.context===context&&d.ref.kind==='type'&&d.ref.id===id);
      if(!pin||rows.length!==1)fail('APPLICATION_EXECUTION_TYPE','execution type requires one exact nominal declaration and binding, not a carrier guess');
      return typeName({form:'nominal',ref:rows[0].ref},options);
    };
    if(p.admission.maxConcurrentRuns!==1||p.admission.maxInFlightSteps!==1||p.admission.maxInFlightChunks!==1)fail('APPLICATION_EXECUTION','finite single-run single-step single-chunk ownership required by this lowering profile');
    if(p.steps.some(s=>!s.port))fail('APPLICATION_EXECUTION','invokeSaga and awaitChildRun require their explicit durable adapter profile; not converted to pure stages');
    if(p.steps.some(s=>p.binding.ports.find(port=>port.id===s.port)?.effect!=='pure'))fail('APPLICATION_EXECUTION','external steps require their exact effect/reconciliation adapter; not executed as pure stages');
    let text='package '+pkg+'.application\n\nimport akka.actor.typed.Behavior\nimport akka.persistence.typed.PersistenceId\nimport com.google.protobuf.ByteString\nimport net.imadz.monarch.{StageError, StageFailedException}\nimport net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}\nimport scala.concurrent.{ExecutionContext, Future}\n\nobject '+name+' {\n';
    text+='  final case class Inputs('+p.inputs.map(i=>symbol(i.id)+': '+resolve(i.type)).join(', ')+')\n';
    for(const s of p.steps){
      const n=symbol(s.id.replaceAll('-','_'));
      text+='  final case class '+n+'Request('+s.reads.map(r=>symbol(r.slot)+': '+resolve(r.type)).join(', ')+')\n';
      text+='  sealed trait '+n+'Result\n';
      for(const o of s.outcomes) {
        const constructor=n+'_'+symbol(o.code.replaceAll('-','_'));
        if(o.action==='continue')text+='  final case class '+constructor+'('+s.writes.map(w=>symbol(w.id)+': '+resolve(w.type)).join(', ')+') extends '+n+'Result\n';
        else text+='  case object '+constructor+' extends '+n+'Result\n';
      }
    }
    text+='  final case class State(inputs: Inputs'+p.steps.flatMap(s=>s.writes.map(w=>', '+symbol(s.id.replaceAll('-','_')+'_'+w.id)+': Option['+resolve(w.type)+'] = None')).join('')+')\n';
    text+='  final case class Outputs('+p.outputs.map(o=>symbol(o.id)+': '+resolve(o.type)).join(', ')+')\n';
    const valueRef=ref=>ref.startsWith('input:')?'state.inputs.'+symbol(ref.slice(6)):ref.startsWith('step:')?'state.'+symbol(ref.slice(5).replaceAll(':','_').replaceAll('-','_'))+'.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output"))':fail('APPLICATION_EXECUTION','result references require their explicit completion adapter');
    text+='  def outputs(state: State): Outputs = Outputs('+p.outputs.map(o=>valueRef(o.ref)).join(', ')+')\n';
    text+='  trait Stages {\n'+p.steps.map(s=>'    def '+symbol(s.id.replaceAll('-','_'))+'(request: '+symbol(s.id.replaceAll('-','_'))+'Request): Future['+symbol(s.id.replaceAll('-','_'))+'Result]').join('\n')+'\n  }\n';
    const protoName=name.replaceAll('_','')+'StatePB',protoPkg=pkg+'.infrastructure.executionproto';
    const pbType=id=>pkg+'.infrastructure.proto.'+id+'PB';
    const pbFields=p.inputs.map((i,index)=>({name:'input'+index,id:i.type,value:'state.inputs.'+symbol(i.id),optional:false}));
    for(const s of p.steps)for(const w of s.writes)pbFields.push({name:'output'+pbFields.filter(f=>f.optional).length,id:w.type,value:'state.'+symbol(s.id.replaceAll('-','_')+'_'+w.id),optional:true});
    text+='  val codec: StateCodec[State] = StateCodec[State](\n    state => '+protoPkg+'.'+protoName+'(planversion = '+JSON.stringify(p.recovery.planVersion)+', '+pbFields.map(f=>symbol(f.name)+' = '+(f.optional?f.value+'.map('+pkg+'.infrastructure.serialization.DomainConverters.encode'+f.id+'PB)':'Some('+pkg+'.infrastructure.serialization.DomainConverters.encode'+f.id+'PB('+f.value+'))')).join(', ')+').toByteArray,\n    bytes => { val pb = '+protoPkg+'.'+protoName+'.parseFrom(bytes); require(pb.planversion == '+JSON.stringify(p.recovery.planVersion)+', "exact finite plan version required"); State(Inputs('+p.inputs.map((i,index)=>pkg+'.infrastructure.serialization.DomainConverters.decode'+i.type+'PB(pb.'+symbol('input'+index)+'.getOrElse(throw new IllegalArgumentException("missing durable input '+i.id+'")))').join(', ')+')'+pbFields.filter(f=>f.optional).map(f=>', pb.'+symbol(f.name)+'.map('+pkg+'.infrastructure.serialization.DomainConverters.decode'+f.id+'PB)').join('')+') }\n  )\n';
    const read=r=>r.ref.startsWith('input:')?'state.inputs.'+symbol(r.ref.slice(6)):r.ref.startsWith('step:')?'state.'+symbol(r.ref.slice(5).replaceAll(':','_').replaceAll('-','_'))+'.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output"))':fail('APPLICATION_EXECUTION','stage input cannot use completion result sources');
    text+='  def behavior(persistenceId: String, stages: Stages, observer: RunObserver[State])(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[State]] = {\n    require(persistenceId != null && persistenceId.nonEmpty && stages != null && observer != null, "explicit owned finite execution and required stage objects")\n    val plan = Vector('+p.steps.map(s=>JSON.stringify(s.id)).join(', ')+')\n    PersistentMonarch.behavior[String, State](PersistenceId.ofUniqueId(persistenceId), plan, (step, state) => step match {\n';
    for(const s of p.steps){const n=symbol(s.id.replaceAll('-','_'));text+='      case '+JSON.stringify(s.id)+' => stages.'+n+'('+n+'Request('+s.reads.map(read).join(', ')+')).map {\n';
      for(const o of s.outcomes){const constructor=n+'_'+symbol(o.code.replaceAll('-','_'));text+=o.action==='continue'?'        case result: '+constructor+' => state.copy('+s.writes.map(w=>symbol(s.id.replaceAll('-','_')+'_'+w.id)+' = Some(result.'+symbol(w.id)+')').join(', ')+')\n':'        case '+name+'.'+constructor+' => throw StageFailedException(StageError('+JSON.stringify(s.id)+', Some('+JSON.stringify(o.code)+'), '+JSON.stringify(o.kind)+', '+JSON.stringify(o.kind+':'+o.code+':'+o.action)+'))\n';}
      text+='      }\n';}
    text+='      case _ => Future.failed(new IllegalArgumentException("unknown static step"))\n    }, codec, identity[String], None, observer)\n  }\n}\n';
    const protoPath='app/protobuf/'+p.id.replaceAll('-','_')+'_execution.proto';
    const proto='syntax = "proto3";\nimport "scalapb/scalapb.proto";\nimport "'+pkg.replaceAll('.','_')+'_domain.proto";\npackage '+protoPkg+';\noption (scalapb.options) = { flat_package: true };\nmessage '+protoName+' {\n  string planversion = 1;\n'+pbFields.map((f,i)=>'  .'+pkg+'.infrastructure.proto.'+f.id+'PB '+f.name+' = '+(i+2)+';').join('\n')+'\n}\n';
    const dependencies=[pathFor(pkg,'infrastructure/serialization/DomainConverters.scala'),protoPath];
    return [entry(pathFor(pkg,'application/'+name+'.scala'),text,'execution-plan',[declaration.source],footprint,dependencies),{...entry(protoPath,proto,'proto',[declaration.source],footprint,['app/protobuf/'+pkg.replaceAll('.','_')+'_domain.proto']),content:proto}];
  });
}
