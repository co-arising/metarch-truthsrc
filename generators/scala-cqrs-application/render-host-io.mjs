import { entry, key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';

/** All host I/O goes through the exact installed objects; authority results retain full lineage. */
export function wireHostIO(text, stem, original, readOriginal, pending) {
 text=text.replace('coordinator: ActorRef[StrictSagaCoordinator.Command], delivery: Delivery)', 'coordinator: ActorRef[StrictSagaCoordinator.Command], technical: '+stem+'TechnicalPorts.Installed)');
 text=text.replace('coordinator != null && delivery != null', 'coordinator != null && technical != null');
 text=text.replace('delivered: Boolean = false)', 'delivered: Boolean = false, admitted: Boolean = false)');
 text=text.replace('  final case class DeliveryAcknowledged(kind: String) extends Event', '  final case class DeliveryAcknowledged(kind: String) extends Event\n  case object AdmissionGranted extends Event\n  private final case class Admitted(ok: Boolean, replyTo: ActorRef[Reply]) extends Request');
 const observation='    def observe(state: State, replyTo: ActorRef[Reply]): Unit = {\n';
 text=text.replace(observation, observation+'      if (!state.admitted) {\n        val original = '+readOriginal+'\n        context.pipeToSelf('+stem+'HostIO.admit(original, technical))(result => Admitted(result.getOrElse(false), replyTo))\n        return\n      }\n');
 const start=text.indexOf('      val result',text.indexOf('    def deliver(')),end=text.indexOf('      context.pipeToSelf(result)',start);
 if(start<0||end<0)fail('APPLICATION_HOST','complete host delivery body required');
 text=text.slice(0,start)+'      val result: Future[Boolean] = '+stem+'HostIO.deliver(kind, original, identity, technical)\n'+text.slice(end);
 const marker='      case Observed(StrictSagaCoordinator.Denied(reason), replyTo)';
 text=text.replace(marker,'      case Admitted(true, replyTo) if state.operation.nonEmpty => Effect.persist(AdmissionGranted).thenRun((s: State) => observe(s, replyTo))\n      case Admitted(_, replyTo) => Effect.none.thenRun((_: State) => replyTo ! '+pending+'("entry or association not admitted"))\n'+marker);
 text=text.replace('      case DeliveryAcknowledged(_) => state.copy(delivered = true)', '      case DeliveryAcknowledged(_) => state.copy(delivered = true)\n      case AdmissionGranted => state.copy(admitted = true)');
 return text;
}

export function renderHostIO({products,options},footprint) {
 const layout=products['reference-layout'],field=r=>layout.declarations.find(d=>key(d.ref)===key(r));
 return products['saga-host-contract'].hosts.map(h=>{
  const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_'),original=typeName(h.entry.inputType,options),technical=stem+'TechnicalPorts';
  const runtime=products['saga-runtime-contract'].sagas.find(s=>s.sagaId===h.saga.ref.id&&s.definitionVersion===h.saga.version),trigger=runtime.triggers.find(t=>t.declaration.id===h.entry.triggerId).declaration;
  const values=r=>r.inputs.map(m=>{
   if(m.input.kind==='args')return 'original.'+symbol(trigger.argsMapping.find(a=>a.slot===m.input.slot).ref.slice(7));
   if(m.input.kind==='transaction-id')return field(m.slot).valueType.form==='nominal'?typeName(field(m.slot).valueType,options)+'(identity.transactionId)':'identity.transactionId';
   fail('APPLICATION_HOST','complete result receipt adapter required');
  });
  let text='package '+pkg+'.application\n\nimport net.imadz.infra.saga.strict.TransactionIdentity\nimport scala.concurrent.{ExecutionContext, Future}\n\nobject '+stem+'HostIO {\n  def admit(original: '+original+', technical: '+technical+'.Installed)(implicit ec: ExecutionContext): Future[Boolean] = {\n    require(technical != null, "exact installed host I/O required")\n    technical.'+symbol(h.entry.port.ref.id)+'(original).flatMap { allowed => if (!allowed) Future.successful(false) else technical.'+symbol(h.association.port.ref.id)+'(original) }\n  }\n  def deliver(kind: String, original: '+original+', identity: TransactionIdentity, technical: '+technical+'.Installed)(implicit ec: ExecutionContext): Future[Boolean] = {\n    require(technical != null && identity != null, "authoritative completion context and actual objects required")\n    val context = '+technical+'.CompletionContext(original, identity)\n    kind match {\n';
  for(const r of h.results){const record=typeName(r.inputType,options);text+='      case '+JSON.stringify(r.kind)+' =>\n        val expected = '+record+'('+values(r).join(', ')+')\n        technical.'+symbol(r.authorityPort.ref.id)+'Completion(original, context).flatMap { actual =>\n          require(actual == expected, "authority result differs from complete original identity and event payload")\n          technical.'+symbol(r.deliveryPort.ref.id)+'Completion(actual, context)\n        }\n';}
  text+='      case _ => Future.failed(new IllegalArgumentException("unmapped host result"))\n    }\n  }\n}\n';
  return entry(pathFor(pkg,'application/'+stem+'HostIO.scala'),text,'technical-port',[h.source],footprint,[pathFor(pkg,'application/'+technical+'.scala')]);
 });
}
