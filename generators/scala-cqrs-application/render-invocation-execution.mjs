import { entry, key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';
const q=JSON.stringify;

/** Complete finite source plan; invocation replies come from durable hosts, never caller-success callbacks. */
export function renderInvocationExecution({products,options},p,footprint) {
 const layout=products['reference-layout'];
 const declarations=layout.declarations.filter(d=>d.ref.kind==='pipeline'&&d.ref.id===p.id);
 if(declarations.length!==1)fail('APPLICATION_EXECUTION','one exact pipeline declaration required');
 const declaration=declarations[0],context=declaration.ref.context,pkg=packageFor(context,options),name=p.id.replaceAll('-','_')+'Execution';
 if(p.admission.maxConcurrentRuns!==1||p.admission.maxInFlightSteps!==1||p.admission.maxInFlightChunks!==1)fail('APPLICATION_EXECUTION','finite single-run single-step single-chunk ownership required');
 const hosts=p.steps.filter(s=>s.invokeSaga).map(s=>{
  const rows=products['saga-host-contract'].hosts.filter(h=>h.saga.ref.context===context&&h.saga.ref.id===s.invokeSaga.ref.sagaId&&h.saga.version===s.invokeSaga.ref.version&&h.entry.startOwner.kind==='pipeline'&&h.entry.startOwner.ref.id===p.id&&h.entry.startOwner.stepId===s.id);
  if(rows.length!==1)fail('APPLICATION_EXECUTION','each invocation requires one exact pipeline-owned durable Saga host');
  return {s,h:rows[0],stem:rows[0].id.replaceAll('-','_')};
 });
 const awaits=p.steps.filter(s=>s.awaitChildRun).map(s=>{
  if(!Object.hasOwn(products,'child-plan-contract'))fail('APPLICATION_EXECUTION','child runs require their complete durable plan adapter');
  const child=products['child-plan-contract'].plans.find(c=>c.ref.id===s.awaitChildRun.childRun.planRef.pipelineId);
  if(!child)fail('APPLICATION_EXECUTION','whole admitted child plan required');
  return {s,stem:p.id.replaceAll('-','_')+'_'+s.id.replaceAll('-','_')+'Child'};
 });
 hosts.push(...awaits);
 if(p.steps.some(s=>s.port&&p.binding.ports.find(port=>port.id===s.port)?.effect!=='pure'))fail('APPLICATION_EXECUTION','external effects require exact reconciliation adapter');
 const resolve=id=>{
  const pin=p.binding.types.find(t=>t.id===id);if(!pin)fail('APPLICATION_EXECUTION_TYPE','exact execution binding required');
  const rows=layout.declarations.filter(d=>d.ref.context===context&&d.ref.kind==='type'&&d.ref.id===id);
  if(rows.length===1)return {form:'nominal',ref:rows[0].ref};
  const runtime=products['saga-runtime-contract'].sagas.flatMap(s=>s.args.types).filter(t=>t.id===id&&t.kind==='integer'&&t.canonicalType==='Int');
  if(runtime.length&&runtime.every(t=>t.implementation===pin.implementation))return {form:'primitive',name:'integer'};
  fail('APPLICATION_EXECUTION_TYPE','complete nominal or explicit runtime integer descriptor required');
 };
 const tpe=id=>typeName(resolve(id),options),n=s=>s.id.replaceAll('-','_');
 const value=ref=>ref.startsWith('input:')?'state.inputs.'+symbol(ref.slice(6)):ref.startsWith('step:')?'state.'+symbol(ref.slice(5).replaceAll(':','_').replaceAll('-','_'))+'.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output"))':fail('APPLICATION_EXECUTION','exact result adapter required');
 let text='package '+pkg+'.application\n\nimport akka.actor.typed.{ActorRef, Behavior, PostStop}\nimport akka.actor.typed.scaladsl.Behaviors\nimport akka.persistence.typed.PersistenceId\nimport net.imadz.monarch.{StageError, StageFailedException}\nimport net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}\nimport scala.concurrent.{ExecutionContext, Future, Promise}\nimport scala.concurrent.duration._\n\nobject '+name+' {\n';
 text+='  final case class Inputs('+p.inputs.map(i=>symbol(i.id)+': '+tpe(i.type)).join(', ')+')\n';
 for(const s of p.steps){text+='  final case class '+n(s)+'Request('+s.reads.map(r=>symbol(r.slot)+': '+tpe(r.type)).join(', ')+')\n  sealed trait '+n(s)+'Result\n';for(const o of s.outcomes){const ctor=n(s)+'_'+o.code.replaceAll('-','_');text+=o.action==='continue'?'  final case class '+ctor+'('+s.writes.map(w=>symbol(w.id)+': '+tpe(w.type)).join(', ')+') extends '+n(s)+'Result\n':'  case object '+ctor+' extends '+n(s)+'Result\n';}}
 text+='  final case class State(inputs: Inputs'+p.steps.flatMap(s=>s.writes.map(w=>', '+n(s)+'_'+symbol(w.id)+': Option['+tpe(w.type)+'] = None')).join('')+')\n  final case class Outputs('+p.outputs.map(o=>symbol(o.id)+': '+tpe(o.type)).join(', ')+')\n  def outputs(state: State): Outputs = Outputs('+p.outputs.map(o=>value(o.ref)).join(', ')+')\n';
 const protoName=name.replaceAll('_','')+'StatePB',protoPkg=pkg+'.infrastructure.executionproto',fields=p.inputs.map((i,index)=>({name:'input'+index,id:i.type,value:'state.inputs.'+symbol(i.id),optional:false}));
 for(const s of p.steps)for(const w of s.writes)fields.push({name:'output'+fields.filter(f=>f.optional).length,id:w.type,value:'state.'+n(s)+'_'+symbol(w.id),optional:true});
 const encode=f=>resolve(f.id).form==='nominal'?pkg+'.infrastructure.serialization.DomainConverters.encode'+f.id+'PB':'identity[Long]';
 const decode=f=>resolve(f.id).form==='nominal'?pkg+'.infrastructure.serialization.DomainConverters.decode'+f.id+'PB':'identity[Long]';
 text+='  val codec: StateCodec[State] = StateCodec[State](\n    state => '+protoPkg+'.'+protoName+'(planversion = '+q(p.recovery.planVersion)+', '+fields.map(f=>f.name+' = '+(f.optional?f.value+'.map('+encode(f)+')':'Some('+encode(f)+'('+f.value+'))')).join(', ')+').toByteArray,\n    bytes => { val pb = '+protoPkg+'.'+protoName+'.parseFrom(bytes); require(pb.planversion == '+q(p.recovery.planVersion)+', "exact finite plan version required"); State(Inputs('+fields.filter(f=>!f.optional).map(f=>decode(f)+'(pb.'+f.name+'.getOrElse(throw new IllegalArgumentException("missing durable input '+f.name+'")))').join(', ')+')'+fields.filter(f=>f.optional).map(f=>', pb.'+f.name+'.map('+decode(f)+')').join('')+') }\n  )\n';
 text+='  trait PureStages {\n'+p.steps.filter(s=>s.port).map(s=>'    def '+n(s)+'(request: '+n(s)+'Request): Future['+n(s)+'Result]').join('\n')+'\n  }\n  final class Installed private['+name+'] (val pure: PureStages'+hosts.map(({s,stem})=>', val '+n(s)+'Host: ActorRef['+stem+'Host.Request]').join('')+')\n  def install(pure: PureStages'+hosts.map(({s,stem})=>', '+n(s)+'Host: ActorRef['+stem+'Host.Request]').join('')+'): Installed = {\n    require(pure != null'+hosts.map(({s})=>' && '+n(s)+'Host != null').join('')+', "all exact finite stage and invocation objects required")\n    new Installed(pure'+hosts.map(({s})=>', '+n(s)+'Host').join('')+')\n  }\n';
 text+='  def behavior(persistenceId: String, installed: Installed, observer: RunObserver[State])(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[State]] = Behaviors.setup { context =>\n    require(persistenceId != null && persistenceId.nonEmpty && installed != null && observer != null, "explicit owned finite execution and installed objects required")\n';
 for(const {s,stem}of hosts){text+='    final case class '+n(s)+'Call(state: State, promise: Promise['+n(s)+'Result])\n    val '+n(s)+'Bridge = context.spawnAnonymous(Behaviors.setup['+n(s)+'Call] { bridgeContext => Behaviors.receiveMessage['+n(s)+'Call] { call =>\n      bridgeContext.spawnAnonymous(Behaviors.setup['+stem+'Host.Reply] { replyContext =>\n        installed.'+n(s)+'Host ! '+stem+'Host.Invoke(call.state, replyContext.self)\n        Behaviors.receiveMessage['+stem+'Host.Reply] {\n          case '+stem+'Host.Completed(result) => call.promise.trySuccess(result); Behaviors.stopped\n          case '+stem+'Host.Conflict(reason) => call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped\n          case '+stem+'Host.Pending(_) => replyContext.scheduleOnce(20.millis, installed.'+n(s)+'Host, '+stem+'Host.Invoke(call.state, replyContext.self)); Behaviors.same\n        }.receiveSignal { case (_, PostStop) => call.promise.tryFailure(new IllegalStateException("owned invocation observer stopped")); Behaviors.same }\n      })\n      Behaviors.same\n    } })\n    def invoke'+n(s)+'(state: State): Future['+n(s)+'Result] = {\n      val promise = Promise['+n(s)+'Result]()\n      '+n(s)+'Bridge ! '+n(s)+'Call(state, promise)\n      promise.future\n    }\n';}
 text+='    val plan = Vector('+p.steps.map(s=>q(s.id)).join(', ')+')\n    PersistentMonarch.behavior[String, State](PersistenceId.ofUniqueId(persistenceId), plan, (step, state) => step match {\n';
 for(const s of p.steps){const call=s.invokeSaga||s.awaitChildRun?'invoke'+n(s)+'(state)':'installed.pure.'+n(s)+'('+n(s)+'Request('+s.reads.map(r=>value(r.ref)).join(', ')+'))';text+='      case '+q(s.id)+' => '+call+'.map {\n';for(const o of s.outcomes){const ctor=n(s)+'_'+o.code.replaceAll('-','_');text+=o.action==='continue'?'        case result: '+ctor+' => state.copy('+s.writes.map(w=>n(s)+'_'+symbol(w.id)+' = Some(result.'+symbol(w.id)+')').join(', ')+')\n':'        case '+name+'.'+ctor+' => throw StageFailedException(StageError('+q(s.id)+', Some('+q(o.code)+'), '+q(o.kind)+', '+q(o.kind+':'+o.code+':'+o.action)+'))\n';}text+='      }\n';}
 text+='      case _ => Future.failed(new IllegalArgumentException("unknown static step"))\n    }, codec, identity[String], None, observer)\n  }\n}\n';
 const protoPath='app/protobuf/'+p.id.replaceAll('-','_')+'_execution.proto',proto='syntax = "proto3";\nimport "scalapb/scalapb.proto";\nimport "'+pkg.replaceAll('.','_')+'_domain.proto";\npackage '+protoPkg+';\noption (scalapb.options) = { flat_package: true };\nmessage '+protoName+' {\n  string planversion = 1;\n'+fields.map((f,i)=>'  '+(resolve(f.id).form==='nominal'?'.'+pkg+'.infrastructure.proto.'+f.id+'PB':'optional int64')+' '+f.name+' = '+(i+2)+';').join('\n')+'\n}\n';
 return [entry(pathFor(pkg,'application/'+name+'.scala'),text,'execution-plan',[declaration.source],footprint,[protoPath,...hosts.map(({stem})=>pathFor(pkg,'application/'+stem+'Host.scala'))]),{...entry(protoPath,proto,'proto',[declaration.source],footprint,['app/protobuf/'+pkg.replaceAll('.','_')+'_domain.proto']),content:proto}];
}
