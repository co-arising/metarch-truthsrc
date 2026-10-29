import { entry, key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';

export const version = '1';
const q = JSON.stringify;
const phaseName = p => ({prepare:'Prepare',commit:'Commit',compensate:'Compensate'})[p];
function targetName(h) { return symbol(h.id.replaceAll('-', '_')); }
function rawName(h) { return h.id.replaceAll('-', '_'); }
const runtime = 'net.imadz.infra.saga.strict.';

/** Typed adapters over the frozen runtime. Injected ports remain real required implementations. */
export function renderDefinitions({ products, options }, footprint) {
  const layout=products['reference-layout'], hosts=products['saga-host-contract'].hosts;
  const generated=[];
  const field = r => {const d=layout.declarations.find(d=>key(d.ref)===key(r));if(!d)fail('APPLICATION_TYPE','missing admitted field');return d;};
  const idValue = (value,type) => type.form==='nominal' ? idValue(value+'.value',layout.declarations.find(d=>key(d.ref)===key(type.ref)).valueType) : value;
  for(const h of hosts){
    const s=products['saga-runtime-contract'].sagas.find(s=>s.sagaId===h.saga.ref.id&&s.definitionVersion===h.saga.version);
    if(!s || !['direct','pipeline'].includes(h.entry.startOwner.kind))fail('APPLICATION_HOST','this registered finite host requires explicit ownership; pipeline lowering is not silently omitted');
    const pkg=packageFor(h.saga.ref.context,options),name=targetName(h),args=typeName(h.argsType,options),pb=pkg+'.infrastructure.proto.',converters=pkg+'.infrastructure.serialization.DomainConverters';
    const sourceForArg = slot => slot;
    const input = v => v.kind==='transaction-id' ? 'request.identity.transaction.transactionId' : v.kind==='args' ? 'request.args.'+symbol(sourceForArg(v.slot)) : null;
    const method = (p,pf) => symbol((p.stepId+'_'+pf.phase).replaceAll('-','_'));
    let text='package '+pkg+'.application\n\nimport akka.actor.typed.Behavior\nimport akka.persistence.typed.PersistenceId\nimport com.google.protobuf.ByteString\nimport net.imadz.infra.saga.strict._\nimport scala.concurrent.{ExecutionContext, Future}\nimport scala.util.Try\n\nobject '+name+'Definition {\n  type Args = '+args+'\n';
    text+='  val argsCodec: PayloadCodec[Args] = new PayloadCodec[Args] {\n    val pin = CodecPin('+q(s.args.runtimeCodec.id)+', '+s.args.runtimeCodec.version+')\n    def encode(value: Args): ByteString = '+converters+'.encode'+h.argsType.ref.id+'PB(value).toByteString\n    def decode(bytes: ByteString): Try[Args] = Try('+converters+'.decode'+h.argsType.ref.id+'PB('+pb+h.argsType.ref.id+'PB.parseFrom(bytes.toByteArray)))\n  }\n';
    text+='  trait Ports {\n    def technical: '+name+'TechnicalPorts.Installed\n    def installed: Map[String, (String, String)]\n';
    for(const p of h.participants)for(const pf of p.phases)text+='    def '+method(p,pf)+': PhasePort[Args, '+typeName(pf.evidence.receiptType,options)+']\n';
    text+='  }\n';
    const idParts={'txid':'request.identity.transaction.transactionId','definition-version':'request.identity.transaction.definitionVersion.toString','args-digest':'request.identity.transaction.argsDigest','participant':'request.identity.participantId','resource':'request.identity.resource','step':'request.identity.stepId','phase':'request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT)'};
    const wrap=(v,t)=>t.form==='nominal'?typeName(t,options)+'('+v+')':v;
    text+='  def fromTechnical(objects: '+name+'TechnicalPorts.Installed)(implicit ec: ExecutionContext): Ports = {\n    require(objects != null, "installed technical objects required")\n    new Ports {\n      val technical = objects\n      val installed = objects.declarations\n';
    for(const p of h.participants)for(const pf of p.phases){
      const m=method(p,pf),receipt=typeName(pf.evidence.receiptType,options),query=typeName(pf.query.inputType,options),inputType=typeName(pf.inputType,options);
      const queryMembers=field(pf.query.inputType.ref).valueType.members;
      const queryValues=queryMembers.map(member=>{const identityMember=pf.evidence.identity.find(i=>i.member.id===member.id);if(!identityMember)fail('APPLICATION_HOST','exact query member identity lineage required');return wrap(idParts[identityMember.key],field(member).valueType);});
      const commandValues=pf.parameters.map(map=>'command'+m+'(request).'+symbol(map.parameter.id));
      text+='      val '+m+': PhasePort[Args, '+receipt+'] = new PhasePort[Args, '+receipt+'] {\n        val receiptCodec = '+m+'Codec\n        val querySafety = QuerySafety.DeclaredReadOnly\n        def execute(request: OperationRequest[Args]): Future[PhaseOutcome['+receipt+']] = objects.'+symbol(pf.executePort.ref.id.replaceAll('-','_'))+'Operation('+inputType+'('+commandValues.join(', ')+'), request.identity).map(r => ConfirmedReceipt(request.identity, r)).recover { case ex => Unknown(request.identity, "technical execute failed: " + ex.getMessage) }\n        def query(request: OperationRequest[Args]): Future[PhaseOutcome['+receipt+']] = objects.'+symbol(pf.query.port.ref.id.replaceAll('-','_'))+'Operation('+query+'('+queryValues.join(', ')+'), request.identity).map { case Some(r) => ConfirmedReceipt(request.identity, r); case None => Unknown(request.identity, "typed query returned no authoritative evidence") }.recover { case ex => Unknown(request.identity, "technical query failed: " + ex.getMessage) }\n      }\n';
    }
    text+='    }\n  }\n';
    for(const p of h.participants)for(const pf of p.phases){
      const m=method(p,pf),receipt=typeName(pf.evidence.receiptType,options),receiptName=pf.evidence.receiptType.ref.id;
      text+='  val '+m+'Codec: PayloadCodec['+receipt+'] = new PayloadCodec['+receipt+'] {\n    val pin = CodecPin('+q(pf.evidence.codec.runtime.id)+', '+pf.evidence.codec.runtime.version+')\n    def encode(value: '+receipt+'): ByteString = '+converters+'.encode'+receiptName+'PB(value).toByteString\n    def decode(bytes: ByteString): Try['+receipt+'] = Try('+converters+'.decode'+receiptName+'PB('+pb+receiptName+'PB.parseFrom(bytes.toByteArray)))\n  }\n';
      const idParts={'txid':'request.identity.transaction.transactionId','definition-version':'request.identity.transaction.definitionVersion.toString','args-digest':'request.identity.transaction.argsDigest','participant':'request.identity.participantId','resource':'request.identity.resource','step':'request.identity.stepId','phase':'request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT)'};
      text+='  def check'+m+'(request: OperationRequest[Args], receipt: '+receipt+'): Unit = {\n';
      for(const map of pf.evidence.identity)text+='    require('+idValue('receipt.'+symbol(map.member.id),field(map.member).valueType)+' == '+idParts[map.key]+', '+q('receipt '+map.key+' differs from durable operation')+')\n';
      text+='  }\n';
      text+='  def command'+m+'(request: OperationRequest[Args]): '+pkg+'.domain.'+symbol(p.aggregate.id)+'Protocol.'+symbol(pf.command.id)+' = '+pkg+'.domain.'+symbol(p.aggregate.id)+'Protocol.'+symbol(pf.command.id)+'(';
      text+=pf.parameters.map(map=>{const t=field(map.parameter).valueType,expression=input(map.input);if(!expression){const producer=h.participants.find(p=>p.stepId===map.input.stepId),producerPhase=producer?.phases.find(p=>p.phase===map.input.phase),member=producerPhase?.evidence.payload.find(m=>m.output===map.input.slot)?.member;if(!producerPhase||!member)fail('APPLICATION_HOST','complete typed producer receipt is required');const phase=phaseName(map.input.phase),resource=producer.resourceInput;const argSlot=s.participants.find(p=>p.stepId===producer.stepId).resource.ref.slice(5);return 'request.receipt(request.identity.copy(participantId = '+q(producer.participantId)+', resource = '+idValue('request.args.'+symbol(argSlot),field(resource).valueType)+', stepId = '+q(producer.stepId)+', phase = Phase.'+phase+'), '+method(producer,producerPhase)+'Codec.pin, '+method(producer,producerPhase)+'Codec).get.'+symbol(member.id);}return map.input.kind==='transaction-id'&&t.form==='nominal'?typeName(t,options)+'('+expression+')':expression;}).join(', ')+')\n';
      text+='  private def bind'+m+'(underlying: PhasePort[Args, '+receipt+'])(implicit ec: ExecutionContext): PhaseBinding[Args] = {\n    require(underlying != null && underlying.receiptCodec != null && underlying.receiptCodec.pin == '+m+'Codec.pin && underlying.querySafety == QuerySafety.DeclaredReadOnly, "required read-only phase port and exact codec implementation")\n    val checked = new PhasePort[Args, '+receipt+'] {\n      val receiptCodec = '+m+'Codec\n      val querySafety = QuerySafety.DeclaredReadOnly\n      private def validate(result: Future[PhaseOutcome['+receipt+']], request: OperationRequest[Args]): Future[PhaseOutcome['+receipt+']] = result.map {\n        case c @ ConfirmedReceipt(identity, receipt) => require(identity == request.identity, "operation identity mismatch"); check'+m+'(request, receipt); c\n        case other => require(other.identity == request.identity, "operation identity mismatch"); other\n      }\n      def execute(request: OperationRequest[Args]): Future[PhaseOutcome['+receipt+']] = validate(underlying.execute(request), request)\n      def query(request: OperationRequest[Args]): Future[PhaseOutcome['+receipt+']] = validate(underlying.query(request), request)\n    }\n    PhaseBinding(checked)\n  }\n';
    }
    text+='  def definition(ports: Ports)(implicit ec: ExecutionContext): StrictSagaDefinition[Args] = {\n    require(ports != null && ports.technical != null, "all required implementation objects must be injected")\n    require(ports.installed == ports.technical.declarations, "installation declarations must come from exact typed objects")\n    '+name+'TechnicalPorts.requireInstalled(ports.installed)\n';
    for(const p of h.participants)for(const pf of p.phases)text+='    val installed_'+method(p,pf)+' = bind'+method(p,pf)+'(ports.'+method(p,pf)+')\n';
    text+='    StrictSagaDefinition('+q(s.runtimeIdentity.name)+', '+s.runtimeIdentity.version+', '+q(s.definitionDigest)+', argsCodec, args => Vector(\n';
    text+=h.participants.map(p=>'      StrictParticipant[Args]('+q(p.stepId)+', '+q(p.participantId)+', '+idValue('args.'+symbol(s.participants.find(x=>x.stepId===p.stepId).resource.ref.slice(5)),field(p.resourceInput).valueType)+', Map('+p.phases.map(pf=>'Phase.'+phaseName(pf.phase)+' -> installed_'+method(p,pf)).join(', ')+'))').join(',\n')+'\n    ))\n  }\n';
    text+='  def coordinator(persistenceId: String, ports: Ports, authorizer: ReconcileAuthorizer)(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {\n    require(persistenceId != null && persistenceId.nonEmpty && authorizer != null, "explicit identity and reconciliation authorizer required")\n    StrictSagaCoordinator(PersistenceId.ofUniqueId(persistenceId), definition(ports), authorizer, StrictSagaCoordinator.Settings(scala.concurrent.duration.Duration('+s.coordinatorSettings.interactionTimeoutMs+', "millis"), 32))\n  }\n}\n';
    generated.push(entry(pathFor(pkg,'application/'+rawName(h)+'Definition.scala'),text,'saga-definition',[h.source],footprint,[...new Set([pathFor(pkg,'infrastructure/serialization/DomainConverters.scala'),...h.participants.map(p=>pathFor(pkg,'domain/'+p.aggregate.id+'Protocol.scala'))])]));
  }
  return generated;
}
