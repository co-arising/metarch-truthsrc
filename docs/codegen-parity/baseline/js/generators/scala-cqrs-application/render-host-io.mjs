import { entry, key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { equal, fail } from '../../lib/products/request.mjs';

/** All host I/O goes through the exact installed objects; authority results retain full lineage. */
export function wireHostIO(text, stem, original, readOriginal, pending, policy = false, occurrence = null) {
 text=text.replace('coordinator: ActorRef[StrictSagaCoordinator.Command], delivery: Delivery)', 'coordinator: ActorRef[StrictSagaCoordinator.Command], technical: '+stem+'TechnicalPorts.Installed)');
 text=text.replace('coordinator != null && delivery != null', 'coordinator != null && technical != null');
 text=text.replace('delivered: Boolean = false)', 'delivered: Boolean = false, admitted: Boolean = false)');
 text=text.replace('  final case class DeliveryAcknowledged(kind: String) extends Event', '  final case class DeliveryAcknowledged(kind: String) extends Event\n  case object AdmissionGranted extends Event\n  private final case class Admitted(denial: Option[String], operation: String) extends Request'+(occurrence?'\n  final case class SubmitOccurrence(envelope: '+occurrence.envelope+', replyTo: ActorRef[Reply]) extends Request\n  private final case class OccurrenceAdmitted(original: scala.util.Either[String, '+occurrence.originalType+'], replyTo: ActorRef[Reply]) extends Request':''));
 const observation='    def observe(state: State, replyTo: ActorRef[Reply]): Unit = {\n';
 text=text.replace(observation, '    var admissionPending = false\n    var admissionReplies = Vector.empty[ActorRef[Reply]]\n    def takeAdmissionReplies(): ActorRef[Reply] = {\n      val replies = admissionReplies\n      admissionReplies = Vector.empty\n      admissionPending = false\n      context.spawnAnonymous(Behaviors.receiveMessage[Reply] { reply => replies.foreach(_ ! reply); Behaviors.stopped })\n    }\n'+observation+'      if (!state.admitted) {\n        admissionReplies :+= replyTo\n        if (!admissionPending) {\n          admissionPending = true\n          val original = '+readOriginal+'\n          val admission = scala.util.Try('+stem+'HostIO.admit(original, technical)).getOrElse('+(policy?'Future.successful(Some("host admission failed"))':'Future.successful(false)')+')\n          context.pipeToSelf(admission)(result => Admitted('+(policy?'result.getOrElse(Some("host admission failed"))':'if (result.getOrElse(false)) None else Some("entry or association not admitted")')+', state.operation))\n        }\n        return\n      }\n');
 const start=text.indexOf('      val result',text.indexOf('    def deliver(')),end=text.indexOf('      context.pipeToSelf(result)',start);
 if(start<0||end<0)fail('APPLICATION_HOST','complete host delivery body required');
 text=text.slice(0,start)+'      val result: Future[Boolean] = '+stem+'HostIO.deliver(kind, original, identity, technical)\n'+text.slice(end);
 const admittedCases='      case Admitted(None, operation) if state.operation.nonEmpty && state.operation == operation && !state.admitted => Effect.persist(AdmissionGranted).thenRun((s: State) => observe(s, takeAdmissionReplies()))\n      case Admitted(Some(reason), operation) if state.operation == operation && !state.admitted => Effect.none.thenRun((_: State) => takeAdmissionReplies() ! '+pending+'(reason))\n      case _: Admitted => Effect.none\n';
 const occurrenceCases=occurrence
  ?'      case SubmitOccurrence(envelope, replyTo) =>\n        context.pipeToSelf('+stem+'HostIO.admitOccurrence(envelope, technical))(result => OccurrenceAdmitted(result.getOrElse(scala.util.Left("occurrence admission failed")), replyTo))\n        Effect.none\n      case OccurrenceAdmitted(scala.util.Right(original), replyTo) => context.self ! Submit(original, replyTo); Effect.none\n      case OccurrenceAdmitted(scala.util.Left(reason), replyTo) => Effect.none.thenRun((_: State) => replyTo ! '+pending+'(reason))\n'
  :'';
 const marker='      case Observed(StrictSagaCoordinator.Denied(reason), replyTo)';
 text=text.replace(marker,occurrenceCases+admittedCases+marker);
 text=text.replace('      case DeliveryAcknowledged(_) => state.copy(delivered = true)', '      case DeliveryAcknowledged(_) => state.copy(delivered = true)\n      case AdmissionGranted => state.copy(admitted = true)');
 return text;
}

export function renderHostIO({products,options},footprint){
 const layout=products['reference-layout'],field=r=>layout.declarations.find(d=>key(d.ref)===key(r));
 const pins=products['artifact-contract'].artifacts.filter(a=>a.status==='selected').flatMap(a=>a.ports);
 return products['saga-host-contract'].hosts.map(h=>{
  const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_'),original=typeName(h.entry.inputType,options),technical=stem+'TechnicalPorts';
  const runtime=products['saga-runtime-contract'].sagas.find(s=>s.sagaId===h.saga.ref.id&&s.definitionVersion===h.saga.version),trigger=runtime.triggers.find(t=>t.declaration.id===h.entry.triggerId).declaration;
  for(const r of h.results){
   const authority=pins.find(p=>key(p.ref)===key(r.authorityPort.ref)&&p.version===r.authorityPort.version);
   if(!authority||!equal(authority.inputType,h.entry.inputType)||!equal(authority.outputType,r.inputType))fail('APPLICATION_HOST','authority must consume the complete original and return the exact result record');
  }
  const values=r=>r.inputs.map(m=>{
   if(m.input.kind==='args')return 'original.'+symbol(trigger.argsMapping.find(a=>a.slot===m.input.slot).ref.slice(7));
   if(m.input.kind==='transaction-id')return field(m.slot).valueType.form==='nominal'?typeName(field(m.slot).valueType,options)+'(identity.transactionId)':'identity.transactionId';
   fail('APPLICATION_HOST','complete result receipt adapter required');
  });
  const policy=h.technicalPorts.find(p=>p.role==='resource-policy');
  const gate=h.technicalPorts.find(p=>p.role==='external-event'),occurrenceSource=h.technicalPorts.find(p=>p.role==='occurrence-source');
  const admit=policy
   ?'  def admit(original: '+original+', technical: '+technical+'.Installed)(implicit ec: ExecutionContext): Future[Option[String]] = {\n    require(technical != null, "exact installed host I/O required")\n    technical.'+symbol(h.entry.port.ref.id)+'(original).flatMap { allowed => if (!allowed) Future.successful(Some("entry or association not admitted")) else technical.'+symbol(h.association.port.ref.id)+'(original).flatMap { associated => if (!associated) Future.successful(Some("entry or association not admitted")) else technical.'+symbol(policy.port.ref.id)+'(original).map(admitted => if (admitted) None else Some("resource policy denied")) } }\n  }\n'
   :'  def admit(original: '+original+', technical: '+technical+'.Installed)(implicit ec: ExecutionContext): Future[Boolean] = {\n    require(technical != null, "exact installed host I/O required")\n    technical.'+symbol(h.entry.port.ref.id)+'(original).flatMap { allowed => if (!allowed) Future.successful(false) else technical.'+symbol(h.association.port.ref.id)+'(original) }\n  }\n';
  const admitOccurrence=(gate&&occurrenceSource)?(()=>{
   const pin=pins.find(a=>key(a.ref)===key(gate.port.ref)&&a.version===gate.port.version);
   const envelope=typeName(pin.inputType,options);
   return '  def admitOccurrence(envelope: '+envelope+', technical: '+technical+'.Installed)(implicit ec: ExecutionContext): Future[scala.util.Either[String, '+original+']] = {\n    require(technical != null, "exact installed host I/O required")\n    technical.'+symbol(gate.port.ref.id)+'(envelope).flatMap { accepted => if (!accepted) Future.successful(scala.util.Left("occurrence source denied")) else technical.'+symbol(occurrenceSource.port.ref.id)+'(envelope).map(restored => scala.util.Right(restored)) }\n  }\n';
  })():'';
  let text='package '+pkg+'.application\n\nimport net.imadz.infra.saga.strict.TransactionIdentity\nimport scala.concurrent.{ExecutionContext, Future}\n\nobject '+stem+'HostIO {\n'+admit+admitOccurrence+'  def deliver(kind: String, original: '+original+', identity: TransactionIdentity, technical: '+technical+'.Installed)(implicit ec: ExecutionContext): Future[Boolean] = {\n    require(technical != null && identity != null, "authoritative completion context and actual objects required")\n    val context = '+technical+'.CompletionContext(original, identity)\n    kind match {\n';
  for(const r of h.results){const record=typeName(r.inputType,options);text+='      case '+JSON.stringify(r.kind)+' =>\n        val expected = '+record+'('+values(r).join(', ')+')\n        technical.'+symbol(r.authorityPort.ref.id)+'Completion(original, context).flatMap { actual =>\n          require(actual == expected, "authority result differs from complete original identity and event payload")\n          technical.'+symbol(r.deliveryPort.ref.id)+'Completion(actual, context)\n        }\n';}
  text+='      case _ => Future.failed(new IllegalArgumentException("unmapped host result"))\n    }\n  }\n}\n';
  return entry(pathFor(pkg,'application/'+stem+'HostIO.scala'),text,'technical-port',[h.source],footprint,[pathFor(pkg,'application/'+technical+'.scala')]);
 });
}
