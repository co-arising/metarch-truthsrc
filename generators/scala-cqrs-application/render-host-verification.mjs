import { entry, key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';
import { invocationOracle } from './render-invocation-verification.mjs';
import { childOracle } from './render-child-verification.mjs';
const EXTENDED_ROLES=['resource-policy','external-submission','external-query','external-event','occurrence-source','readside','deployment'];
export function renderHostVerification({products,options},footprint,childProfile=false){
 const layout=products['reference-layout'];const field=r=>layout.declarations.find(d=>key(d.ref)===key(r));
 const make=(value,t)=>t.form==='nominal'?typeName(t,options)+'('+make(value,field(t.ref).valueType)+')':t.form==='primitive'&&t.name==='integer'?value:JSON.stringify(value);
 const raw=(value,t)=>t.form==='nominal'?raw(value+'.value',field(t.ref).valueType):value;
 const optionalElement=t=>{if(!t||t.form!=='optional')throw new TypeError('optional record output required');return t.element;};
 const recordMembersOf=t=>{if(!t||t.form!=='nominal')throw new TypeError('nominal record required');return field(t.ref).valueType.members.map(field);};
 const extendedLiteral=id=>({status:'unknown',producer:'owned-occurrence-producer',authorization:'owned-test-authority',identity:'request-A',endpoint:'tcp://loopback:0',route:'/inventory',secretRef:'secret-refs/inventory-hmac'}[id]??'extended-A');
 const extendedMember=(m,keyIds,sourceExpr)=>{
  if(keyIds.includes(m.ref.id))return sourceExpr+'.'+symbol(m.ref.id);
  const t=m.valueType;
  if(t.form==='primitive'&&t.name==='integer')return '3L';
  if(t.form==='primitive'&&t.name==='boolean')return 'true';
  if(t.form==='primitive'&&t.name==='string')return JSON.stringify(extendedLiteral(m.ref.id));
  if(t.form==='nominal')return typeName(t,options)+'('+JSON.stringify(extendedLiteral(m.ref.id))+')';
  throw new TypeError('finite extended record member required');
 };
 const extendedRecord=(t,keyIds,sourceExpr)=>typeName(t,options)+'('+recordMembersOf(t).map(m=>extendedMember(m,keyIds,sourceExpr)).join(', ')+')';
 const envelopeLiteral=(t,authorization)=>typeName(t,options)+'('+recordMembersOf(t).map(m=>m.ref.id==='producer'?'"owned-occurrence-producer"':m.ref.id==='authorization'?'"'+authorization+'"':m.ref.id==='identity'?'"request-A"':extendedMember(m,[],'input')).join(', ')+')';
 const originalLiteralOf=h=>{
  const members=field(h.entry.inputType.ref).valueType.members;
  return typeName(h.entry.inputType,options)+'('+members.map(r=>{const t=field(r).valueType;return t.form==='primitive'&&t.name==='integer'?'3L':make(r.id==='warehouse'?'warehouse-A':r.id==='destination'?'warehouse-B':r.id==='allocation'?'allocation-last':r.id==='sku'?'sku-A':'request-A',t);}).join(', ')+')';
 };
 const technicalObjectsBlock=(h,pkg,stem,working=false,originalLiteral='')=>{
  const artifacts=products['artifact-contract'].artifacts.filter(a=>a.status==='selected').flatMap(a=>a.ports);
  const objects=h.technicalPorts.map(p=>({p,pin:artifacts.find(a=>key(a.ref)===key(p.port.ref))}));
  const keyIds=h.association.inputKeys.map(r=>r.id);
  const gate=h.technicalPorts.find(p=>p.role==='external-event');
  const envelopeMembers=gate?recordMembersOf(artifacts.find(a=>key(a.ref)===key(gate.port.ref)).inputType):null;
  const operationFor=({p,pin})=>{
   if(!['phase-execute','phase-query'].includes(p.role))return '';
   const participant=h.participants.find(row=>row.phases.some(pf=>key(pf.executePort.ref)===key(p.port.ref)||key(pf.query.port.ref)===key(p.port.ref))),pf=participant.phases.find(pf=>key(pf.executePort.ref)===key(p.port.ref)||key(pf.query.port.ref)===key(p.port.ref));
   const receipt=typeName(pf.evidence.receiptType,options),inputType=typeName(pin.inputType,options);
   if(p.role==='phase-query')return ', (input: '+inputType+', identity: OperationIdentity) => Future.successful(receipts.get(identity).map(_.asInstanceOf['+receipt+']))';
   const aggregate=pkg+'.domain.'+participant.aggregate.id+'Aggregate',event=pkg+'.domain.'+participant.aggregate.id+'Protocol.'+pf.confirmation.event.id,idmap={'txid':'identity.transaction.transactionId','definition-version':'identity.transaction.definitionVersion.toString','args-digest':'identity.transaction.argsDigest','participant':'identity.participantId','resource':'identity.resource','step':'identity.stepId','phase':'identity.phase.toString.toLowerCase(java.util.Locale.ROOT)'};
   const values=[...pf.evidence.identity.map(i=>field(i.member).valueType.form==='nominal'?typeName(field(i.member).valueType,options)+'('+idmap[i.key]+')':idmap[i.key]),...pf.evidence.payload.map(i=>'event.'+symbol(i.output))];
   return ', (input: '+inputType+', identity: OperationIdentity) => { technicalCalls.incrementAndGet(); actor_'+participant.participantId+'.ask['+aggregate+'.Reply](reply => '+aggregate+'.Execute('+pkg+'.domain.'+participant.aggregate.id+'Protocol.'+pf.command.id+'('+pf.parameters.map(m=>'input.'+symbol(m.parameter.id)).join(', ')+'), reply)).map { case '+aggregate+'.Accepted(events) => val event = events.collectFirst { case e: '+event+' => e }.get; val receipt = '+receipt+'('+values.join(', ')+'); receipts.put(identity, receipt); receipt; case '+aggregate+'.Refused(code) => throw new IllegalStateException(code) } }';
  };
  const completionFor=({p,pin})=>{
   if(!['authority','result-delivery'].includes(p.role))return '';
   const r=h.results.find(r=>key(r.authorityPort.ref)===key(p.port.ref)||key(r.deliveryPort.ref)===key(p.port.ref));
   const record=typeName(r.inputType,options),context=pkg+'.application.'+stem+'TechnicalPorts.CompletionContext';
   if(p.role==='authority')return ', completion = (input: '+typeName(pin.inputType,options)+', context: '+context+') => { authorityCalls.incrementAndGet(); Future.successful('+record+'('+r.inputs.map(m=>{if(m.input.kind==='transaction-id')return field(m.slot).valueType.form==='nominal'?typeName(field(m.slot).valueType,options)+'(context.identity.transactionId)':'context.identity.transactionId';return 'input.'+symbol(rtOf(h).triggers.find(t=>t.declaration.id===h.entry.triggerId).declaration.argsMapping.find(a=>a.slot===m.input.slot).ref.slice(7));}).join(', ')+')) }';
   const producer=products['domain-external-events'].producers.find(x=>key(x.event)===key(r.event));
   return ', completion = (input: '+record+', context: '+context+') => resultDeliveryGate.get().flatMap { _ => { require(context.original.allocation.value == "allocation-last"); deliveryCounts.update('+JSON.stringify(r.kind)+', deliveryCounts.getOrElse('+JSON.stringify(r.kind)+', 0) + 1); actor_allocation.ask['+pkg+'.domain.AllocationOrderAggregate.Reply](reply => '+pkg+'.domain.AllocationOrderAggregate.Ingest'+producer.id+'(input, "owned-test-authority", reply)).map { case '+pkg+'.domain.AllocationOrderAggregate.Accepted(_) => delivered.put('+JSON.stringify(r.kind)+', context.original.allocation.value); !loseDeliveryAck.compareAndSet(true, false); case _ => false } } }';
  };
  const workingRun=({p,pin})=>{
   if(!working)return null;
   if(p.role==='resource-policy')return '(_: '+typeName(pin.inputType,options)+') => { technicalCalls.incrementAndGet(); Future.successful(true) }';
   if(p.role==='external-event'){
    for(const m of envelopeMembers)if(['producer','authorization'].includes(m.ref.id)&&!(m.valueType.form==='primitive'&&m.valueType.name==='string'))throw new TypeError('primitive string envelope admission members required');
    return '(input: '+typeName(pin.inputType,options)+') => { technicalCalls.incrementAndGet(); Future.successful(input.authorization == "owned-test-authority" && input.producer == "owned-occurrence-producer") }';
   }
   if(p.role==='occurrence-source')return '(_: '+typeName(pin.inputType,options)+') => { technicalCalls.incrementAndGet(); Future.successful('+originalLiteral+') }';
   if(p.role==='external-submission')return '(_: '+typeName(pin.inputType,options)+') => { technicalCalls.incrementAndGet(); Future.successful('+extendedRecord(pin.outputType,keyIds,'original')+') }';
   if(p.role==='external-query')return '(input: '+typeName(pin.inputType,options)+') => { technicalCalls.incrementAndGet(); Future.successful(Some('+extendedRecord(optionalElement(pin.outputType),keyIds,'input')+')) }';
   if(p.role==='readside')return '(input: '+typeName(pin.inputType,options)+') => { technicalCalls.incrementAndGet(); Future.successful(Some('+extendedRecord(optionalElement(pin.outputType),keyIds,'input')+')) }';
   if(p.role==='deployment')return '(_: '+typeName(pin.inputType,options)+') => { technicalCalls.incrementAndGet(); Future.successful(true) }';
   return null;
  };
  let text='      val receipts = scala.collection.concurrent.TrieMap.empty[OperationIdentity, Any]\n      val technicalCalls = new java.util.concurrent.atomic.AtomicInteger(0)\n      val loseDeliveryAck = new java.util.concurrent.atomic.AtomicBoolean(false)\n      val deliveryCounts = scala.collection.concurrent.TrieMap.empty[String, Int]\n      val delivered = scala.collection.concurrent.TrieMap.empty[String, String]\n      val authorityCalls = new java.util.concurrent.atomic.AtomicInteger(0)\n      val resultDeliveryGate = new java.util.concurrent.atomic.AtomicReference[Future[Unit]](Future.successful(()))\n      val technicalBindings = '+pkg+'.application.'+stem+'TechnicalPorts.Bindings(\n';
  text+=objects.map(({p,pin})=>{
   const run=workingRun({p,pin})??'(_: '+typeName(pin.inputType,options)+') => { technicalCalls.incrementAndGet(); '+(p.role==='entry'||p.role==='association'||p.role==='resource-policy'?'Future.successful(true)':'Future.failed(new IllegalStateException("test technical object not invoked without operation context"))')+' }';
   return '        '+pkg+'.application.'+stem+'TechnicalPorts.Implementation['+typeName(pin.inputType,options)+', '+typeName(pin.outputType,options)+']('+JSON.stringify(p.implementation.id)+', '+JSON.stringify(p.implementation.version)+', '+run+operationFor({p,pin})+completionFor({p,pin})+')';
  }).join(',\n')+'\n      )\n';
  const firstObject=symbol(objects[0].p.port.ref.id);
  text+='      val installedTechnical = '+pkg+'.application.'+stem+'TechnicalPorts.install(technicalBindings)\n      intercept[IllegalArgumentException] { '+pkg+'.application.'+stem+'TechnicalPorts.install(technicalBindings.copy('+firstObject+' = null)) }\n      intercept[IllegalArgumentException] { '+pkg+'.application.'+stem+'TechnicalPorts.install(technicalBindings.copy('+firstObject+' = technicalBindings.'+firstObject+'.copy(version = "wrong"))) }\n      intercept[IllegalArgumentException] { '+pkg+'.application.'+stem+'TechnicalPorts.install(technicalBindings.copy('+firstObject+' = technicalBindings.'+firstObject+'.copy(run = null))) }\n';
  return text;
 };
 const rtOf=h=>products['saga-runtime-contract'].sagas.find(s=>s.sagaId===h.saga.ref.id&&s.definitionVersion===h.saga.version);
 const admissionReentry=(h,pkg,stem)=>{
  const policy=h.technicalPorts.find(p=>p.role==='resource-policy');
  if(!policy)return '';
  const host=pkg+'.application.'+stem+'Host',definition=pkg+'.application.'+stem+'Definition',technical=pkg+'.application.'+stem+'TechnicalPorts';
  const originalType=typeName(h.entry.inputType,options),members=recordMembersOf(h.entry.inputType);
  const requestType=typeName(members.find(m=>m.ref.id==='requestId').valueType,options),skuType=typeName(members.find(m=>m.ref.id==='sku').valueType,options);
  const entryMethod=symbol(h.entry.port.ref.id),association=symbol(h.association.port.ref.id),resource=symbol(policy.port.ref.id);
  return `      val admissionJournal = akka.persistence.testkit.scaladsl.PersistenceTestKit(kit.system)
      assert(!admissionJournal.persistedInStorage("extended-denied-policy-host").contains(${host}.AdmissionGranted))
      val reentryOriginal = original.copy(requestId = ${requestType}("request-admission"))
      val entryAdmissions = new java.util.concurrent.atomic.AtomicInteger(0)
      val associationAdmissions = new java.util.concurrent.atomic.AtomicInteger(0)
      val policyAdmissions = new java.util.concurrent.atomic.AtomicInteger(0)
      val oldAdmissionGate = scala.concurrent.Promise[Boolean]()
      val admissionBase = technicalBindings.copy(
        ${entryMethod} = technicalBindings.${entryMethod}.copy(run = (_: ${originalType}) => { entryAdmissions.incrementAndGet(); Future.successful(true) }),
        ${association} = technicalBindings.${association}.copy(run = (_: ${originalType}) => { associationAdmissions.incrementAndGet(); Future.successful(true) }))
      val heldAdmission = ${technical}.install(admissionBase.copy(${resource} = technicalBindings.${resource}.copy(run = (_: ${originalType}) => { policyAdmissions.incrementAndGet(); oldAdmissionGate.future })))
      var reentryCoordinator = kit.spawn(${definition}.coordinator("extended-admission-coordinator", ${definition}.fromTechnical(heldAdmission), authorizer))
      var reentryHost = kit.spawn(${host}("extended-admission-host", reentryCoordinator, heldAdmission))
      val admissionReply1 = kit.createTestProbe[${host}.Reply]()
      val admissionReply2 = kit.createTestProbe[${host}.Reply]()
      val admissionConflict = kit.createTestProbe[${host}.Reply]()
      val beforeAdmissionReceipts = receipts.toMap
      val beforeAdmissionDeliveries = deliveryCounts.toMap
      val beforeAdmissionAuthority = authorityCalls.get()
      reentryHost ! ${host}.Submit(reentryOriginal, admissionReply1.ref)
      admissionReply1.awaitAssert { assert(policyAdmissions.get() == 1) }
      reentryHost ! ${host}.Submit(reentryOriginal, admissionReply2.ref)
      reentryHost ! ${host}.Submit(reentryOriginal.copy(sku = ${skuType}("conflicting-admission-sku")), admissionConflict.ref)
      admissionConflict.expectMessageType[${host}.Conflict]
      assert(entryAdmissions.get() == 1 && associationAdmissions.get() == 1 && policyAdmissions.get() == 1)
      assert(receipts.toMap == beforeAdmissionReceipts && deliveryCounts.toMap == beforeAdmissionDeliveries && authorityCalls.get() == beforeAdmissionAuthority)
      assert(admissionJournal.persistedInStorage("extended-admission-host").count(_.isInstanceOf[${host}.Associated]) == 1)
      assert(!admissionJournal.persistedInStorage("extended-admission-host").contains(${host}.AdmissionGranted))
      kit.stop(reentryHost)
      val newAdmissionGate = scala.concurrent.Promise[Boolean]()
      val replacementAdmission = ${technical}.install(admissionBase.copy(${resource} = technicalBindings.${resource}.copy(run = (_: ${originalType}) => { policyAdmissions.incrementAndGet(); newAdmissionGate.future })))
      reentryHost = kit.spawn(${host}("extended-admission-host", reentryCoordinator, replacementAdmission))
      reentryHost ! ${host}.Submit(reentryOriginal, admissionReply1.ref)
      admissionReply1.awaitAssert { assert(policyAdmissions.get() == 2) }
      reentryHost ! ${host}.Submit(reentryOriginal, admissionReply2.ref)
      reentryHost ! ${host}.Submit(reentryOriginal.copy(sku = ${skuType}("conflicting-admission-sku")), admissionConflict.ref)
      admissionConflict.expectMessageType[${host}.Conflict]
      oldAdmissionGate.success(true)
      admissionReply1.expectNoMessage(200.millis)
      admissionReply2.expectNoMessage(200.millis)
      assert(receipts.toMap == beforeAdmissionReceipts && deliveryCounts.toMap == beforeAdmissionDeliveries)
      assert(!admissionJournal.persistedInStorage("extended-admission-host").contains(${host}.AdmissionGranted))
      newAdmissionGate.success(true)
      val admissionIdentity1 = admissionReply1.expectMessageType[${host}.Accepted].identity
      val admissionIdentity2 = admissionReply2.expectMessageType[${host}.Accepted].identity
      assert(admissionIdentity1 == admissionIdentity2)
      val admissionStatus = kit.createTestProbe[StrictSagaCoordinator.Reply]()
      admissionStatus.awaitAssert { reentryCoordinator ! StrictSagaCoordinator.GetStatus(admissionStatus.ref); val state = admissionStatus.expectMessageType[StrictSagaCoordinator.Status].state; assert(state.status == StrictStatus.Succeeded && state.identity.contains(admissionIdentity1)); assert(state.evidence.values.count(_.isInstanceOf[Evidence.Confirmed]) == 6) }
      assert(admissionJournal.persistedInStorage("extended-admission-host").count(_ == ${host}.AdmissionGranted) == 1)
      reentryHost ! ${host}.Observe(admissionReply1.ref)
      admissionReply1.expectMessage(${host}.ResultRecorded("succeeded"))
      val admittedReceipts = receipts.toMap
      val admittedDeliveries = deliveryCounts.toMap
      val recoveryAdmission = ${technical}.install(admissionBase.copy(${resource} = technicalBindings.${resource}.copy(run = (_: ${originalType}) => { policyAdmissions.incrementAndGet(); throw new IllegalStateException("durable admission must not invoke policy again") })))
      kit.stop(reentryHost)
      kit.stop(reentryCoordinator)
      reentryCoordinator = kit.spawn(${definition}.coordinator("extended-admission-coordinator", ${definition}.fromTechnical(recoveryAdmission), authorizer))
      reentryHost = kit.spawn(${host}("extended-admission-host", reentryCoordinator, recoveryAdmission))
      reentryHost ! ${host}.Submit(reentryOriginal, admissionReply1.ref)
      admissionReply1.expectMessage(${host}.ResultRecorded("succeeded"))
      assert(entryAdmissions.get() == 2 && associationAdmissions.get() == 2 && policyAdmissions.get() == 2)
      assert(receipts.toMap == admittedReceipts && deliveryCounts.toMap == admittedDeliveries)
      assert(admissionJournal.persistedInStorage("extended-admission-host").count(_ == ${host}.AdmissionGranted) == 1)
      reentryCoordinator ! StrictSagaCoordinator.GetStatus(admissionStatus.ref)
      assert(admissionStatus.expectMessageType[StrictSagaCoordinator.Status].state.identity.contains(admissionIdentity1))
`;
 };
 const specCore=h=>{
  const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_'),definition=pkg+'.application.'+stem+'Definition',args=typeName(h.argsType,options);
  let t='';
    for(const p of h.participants){const aggregate=p.aggregate.id;let computations='new '+pkg+'.domain.'+aggregate+'Computations {}';if(aggregate==='Warehouse')computations='new '+pkg+'.domain.WarehouseComputations { def ReservationIdentity(state: '+pkg+'.domain.WarehouseState, p: '+pkg+'.domain.WarehouseProtocol.ReserveSkuQuantity): '+pkg+'.domain.values.ReservationId = '+pkg+'.domain.values.ReservationId("reservation-" + p.txid.value) }';const ingress = products['domain-external-events'].producers.some(e=>e.event.owner[0]===aggregate);const authority=ingress?', new '+pkg+'.domain.'+aggregate+'Aggregate.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = authorization == "owned-test-authority" }':'';t+='      val actor_'+p.participantId+' = kit.spawn('+pkg+'.domain.'+aggregate+'Aggregate("generated-'+p.participantId+'", '+pkg+'.domain.'+aggregate+'State.empty, '+computations+authority+'))\n';}
    t+=technicalObjectsBlock(h,pkg,stem);
    t+='      val executeCounts = scala.collection.concurrent.TrieMap.empty[OperationIdentity, Int]\n      val delegated = '+definition+'.fromTechnical(installedTechnical)\n      val queryCounts = scala.collection.concurrent.TrieMap.empty[OperationIdentity, Int]\n      val injectedAbsence = scala.collection.concurrent.TrieMap.empty[OperationIdentity, Boolean]\n      val fault = new java.util.concurrent.atomic.AtomicReference[String]("")\n      val ports = new '+definition+'.Ports {\n        val technical = installedTechnical\n        val installed = technical.declarations\n';
    for(const p of h.participants)for(const pf of p.phases){const method=(p.stepId+'_'+pf.phase).replaceAll('-','_'),receipt=typeName(pf.evidence.receiptType,options),event=pkg+'.domain.'+p.aggregate.id+'Protocol.'+pf.confirmation.event.id,aggregate=pkg+'.domain.'+p.aggregate.id+'Aggregate';
     const idmap={'txid':'request.identity.transaction.transactionId','definition-version':'request.identity.transaction.definitionVersion.toString','args-digest':'request.identity.transaction.argsDigest','participant':'request.identity.participantId','resource':'request.identity.resource','step':'request.identity.stepId','phase':'request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT)'};
     const identityValues=pf.evidence.identity.map(m=>{const t=field(m.member).valueType,v=idmap[m.key];return t.form==='nominal'?typeName(t,options)+'('+v+')':v;});
     const receiptValues=[...identityValues,...pf.evidence.payload.map(m=>'event.'+symbol(m.output))].join(', ');
     t+='        val '+symbol(method)+': PhasePort['+args+', '+receipt+'] = new PhasePort['+args+', '+receipt+'] {\n          val receiptCodec = '+definition+'.'+symbol(method)+'Codec\n          val querySafety = QuerySafety.DeclaredReadOnly\n          def execute(request: OperationRequest['+args+']): Future[PhaseOutcome['+receipt+']] = {\n            executeCounts.update(request.identity, executeCounts.getOrElse(request.identity, 0) + 1)\n            if (request.identity.stepId == "reserve-destination" && request.identity.phase == Phase.Prepare && fault.compareAndSet("compensated", "")) {\n              injectedAbsence.put(request.identity, true)\n              return Future.successful(NotExecuted(request.identity, "test-only injected fenced absence before destination effect", safeToRetry = true))\n            }\n            if (request.identity.stepId == "reserve-sku" && request.identity.phase == Phase.Commit && fault.compareAndSet("recovery-required", "")) {\n              injectedAbsence.put(request.identity, true)\n              return Future.successful(NotExecuted(request.identity, "test-only commit was not dispatched", safeToRetry = true))\n            }\n            delegated.'+symbol(method)+'.execute(request).map {\n              case c: ConfirmedReceipt['+receipt+'] =>\n                injectedAbsence.remove(request.identity)\n                if (request.identity.stepId == "reserve-sku" && request.identity.phase == Phase.Commit && fault.compareAndSet("outcome-unknown", "")) Unknown(request.identity, "test-only reply lost after actual event persistence") else c\n              case Unknown(_, reason) if request.args.quantity == 0L && reason.contains("quantity-positive") => NotExecuted(request.identity, "test-only authoritative zero quantity guard before any effect", safeToRetry = true)\n              case other => other\n            }\n          }\n          def query(request: OperationRequest['+args+']): Future[PhaseOutcome['+receipt+']] = {\n            queryCounts.update(request.identity, queryCounts.getOrElse(request.identity, 0) + 1)\n            if (injectedAbsence.contains(request.identity)) Future.successful(NotExecuted(request.identity, "test-only exact injected absence", safeToRetry = true)) else delegated.'+symbol(method)+'.query(request)\n          }\n        }\n';
    }
    t+='      }\n      val missingObjects = new '+definition+'.Ports {\n        val technical = installedTechnical\n        val installed = ports.installed\n';
    for(const p of h.participants)for(const pf of p.phases)t+='        def '+symbol((p.stepId+'_'+pf.phase).replaceAll('-','_'))+': PhasePort['+args+', '+typeName(pf.evidence.receiptType,options)+'] = null\n';
    t+='      }\n      intercept[IllegalArgumentException] { '+definition+'.definition(missingObjects) }\n      assert(executeCounts.isEmpty && queryCounts.isEmpty)\n      val authorizer = new ReconcileAuthorizer { def authorize(identity: TransactionIdentity, token: String): Either[String, String] = if (token == "owned-test-reconcile") Right("owned-test-principal") else Left("test reconciliation denied") }\n      val coordinator = kit.spawn('+definition+'.coordinator("generated-coordinator-'+stem+'", ports, authorizer))\n';
  return t;
 };

 const resultMatrix=(pkg,definition,host)=>'      val observedKinds = scala.collection.mutable.Set("succeeded", "rejected-before-effects")\n      for ((mode, expectedResult, expectedEvent) <- Vector(("compensated", "compensated", "ReservationCompensated"), ("recovery-required", "recovery-required", "ReservationRecoveryRequired"), ("outcome-unknown", "outcome-unknown", "ReservationOutcomeUnknown"))) {\n        fault.set(mode)\n        val input = original.copy(requestId = '+pkg+'.domain.values.ReservationRequestId("request-" + mode))\n        val pid = "matrix-coordinator-" + mode\n        var current = kit.spawn('+definition+'.coordinator(pid, ports, authorizer))\n        var matrixHost = kit.spawn('+host+'("matrix-host-" + mode, current, installedTechnical))\n        matrixHost ! '+host+'.Submit(input, reply.ref)\n        val started = reply.expectMessageType['+host+'.Accepted]\n        status.awaitAssert { current ! StrictSagaCoordinator.GetStatus(status.ref); terminal = status.expectMessageType[StrictSagaCoordinator.Status].state; assert('+host+'.classify(terminal).contains(expectedResult)) }\n        val countBeforeAttach = executeCounts.toMap\n        current ! StrictSagaCoordinator.Attach(started.identity, status.ref)\n        assert(status.expectMessageType[StrictSagaCoordinator.Status].state.identity.contains(started.identity))\n        assert(executeCounts.toMap == countBeforeAttach)\n        if (mode == "outcome-unknown") loseDeliveryAck.set(true)\n        matrixHost ! '+host+'.Observe(reply.ref)\n        if (mode == "outcome-unknown") {\n          reply.expectMessage('+host+'.Waiting("delivery unacknowledged"))\n          actor_allocation ! '+pkg+'.domain.AllocationOrderAggregate.GetState(allocation.ref)\n          assert(allocation.receiveMessage().result == expectedEvent)\n          kit.stop(matrixHost)\n          matrixHost = kit.spawn('+host+'("matrix-host-" + mode, current, installedTechnical))\n          matrixHost ! '+host+'.Submit(input, reply.ref)\n        }\n        reply.expectMessage('+host+'.ResultRecorded(expectedResult))\n        observedKinds += expectedResult\n        actor_allocation ! '+pkg+'.domain.AllocationOrderAggregate.GetState(allocation.ref)\n        assert(allocation.receiveMessage().result == expectedEvent)\n        if (mode == "compensated") {\n          assert(terminal.status == StrictStatus.Aborted)\n          assert(terminal.evidence.keys.exists(_.phase == Phase.Compensate))\n          assert(!terminal.commitDecision)\n        } else {\n          assert(terminal.status == StrictStatus.RecoveryRequired && terminal.commitDecision)\n          kit.stop(current)\n          kit.stop(matrixHost)\n          current = kit.spawn('+definition+'.coordinator(pid, ports, authorizer))\n          matrixHost = kit.spawn('+host+'("matrix-host-" + mode, current, installedTechnical))\n          matrixHost ! '+host+'.Submit(input, reply.ref)\n          reply.expectMessage('+host+'.ResultRecorded(expectedResult))\n          assert(executeCounts.toMap == countBeforeAttach)\n          current ! StrictSagaCoordinator.Reconcile(started.identity, "denied", 20, status.ref)\n          status.expectMessageType[StrictSagaCoordinator.Denied]\n          assert(executeCounts.toMap == countBeforeAttach)\n          current ! StrictSagaCoordinator.Reconcile(started.identity, "owned-test-reconcile", 20, status.ref)\n          assert(status.expectMessageType[StrictSagaCoordinator.Status].state.identity.contains(started.identity))\n          status.awaitAssert { current ! StrictSagaCoordinator.GetStatus(status.ref); terminal = status.expectMessageType[StrictSagaCoordinator.Status].state; assert(terminal.status == StrictStatus.Succeeded) }\n          val firstCommit = OperationIdentity(started.identity, "warehouse", "warehouse-A", "reserve-sku", Phase.Commit)\n          assert(queryCounts.getOrElse(firstCommit, 0) == (if (mode == "outcome-unknown") 1 else 0))\n          assert(executeCounts(firstCommit) == (if (mode == "outcome-unknown") 1 else 2))\n          matrixHost ! '+host+'.Observe(reply.ref)\n          reply.expectMessage('+host+'.ResultRecorded("succeeded"))\n          actor_allocation ! '+pkg+'.domain.AllocationOrderAggregate.GetState(allocation.ref)\n          assert(allocation.receiveMessage().result == "ReservationSucceeded")\n          matrixHost ! '+host+'.Submit(input.copy(sku = '+pkg+'.domain.values.SkuId("conflicting-sku")), reply.ref)\n          reply.expectMessageType['+host+'.Conflict]\n        }\n      }\n      assert(observedKinds == Set("succeeded", "rejected-before-effects", "compensated", "recovery-required", "outcome-unknown"))\n      assert(deliveryCounts("outcome-unknown") == 2)\n';

 let text='import akka.actor.testkit.typed.scaladsl.ActorTestKit\nimport akka.actor.typed.scaladsl.AskPattern._\nimport akka.persistence.testkit.PersistenceTestKitPlugin\nimport com.typesafe.config.ConfigFactory\nimport net.imadz.infra.saga.strict._\nimport org.scalatest.funsuite.AnyFunSuite\nimport scala.concurrent.{Await, ExecutionContext, Future}\nimport scala.concurrent.duration._\nimport akka.util.Timeout\n\nfinal class GeneratedFiniteHostSpec extends AnyFunSuite {\n';
 for(const h of products['saga-host-contract'].hosts){
  const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_'),definition=pkg+'.application.'+stem+'Definition',host=pkg+'.application.'+stem+'Host',args=typeName(h.argsType,options),original=typeName(h.entry.inputType,options),rt=rtOf(h);
  if(h.saga.ref.context!=='inventory')continue; // Explicit independent test oracle; never a production fixture or banking implementation.
  text+='  test("'+h.id+' actual generated three-participant calls, last destination and same identity reattach") {\n    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))\n    implicit val ec: ExecutionContext = kit.system.executionContext\n    implicit val timeout: Timeout = 3.seconds\n    implicit val scheduler: akka.actor.typed.Scheduler = kit.system.scheduler\n    try {\n';
  text+=specCore(h);
  if(h.entry.startOwner.kind==='pipeline') { text+=(childProfile?childOracle(h,pkg):invocationOracle(h,pkg,Object.hasOwn(products,'effect-host-contract')?products['effect-host-contract'].hosts.find(e=>e.pipeline.ref.id===h.entry.startOwner.ref.id):null)); continue; }
  text+='      val hostActor = kit.spawn('+host+'("generated-host-'+stem+'", coordinator, installedTechnical))\n      val reply = kit.createTestProbe['+host+'.Reply]()\n';
  const members=field(h.entry.inputType.ref).valueType.members;
  text+='      val original = '+originalLiteralOf(h)+'\n      assert(Await.result(installedTechnical.'+symbol(h.entry.port.ref.id.replaceAll('-','_'))+'(original), 3.seconds))\n      assert(Await.result(installedTechnical.'+symbol(h.association.port.ref.id.replaceAll('-','_'))+'(original), 3.seconds))\n      assert(technicalCalls.get() == 2)\n      val authorityProbeIdentity = TransactionIdentity("wrong-tx", "wrong-definition", 1, "wrong-args", "wrong-definition-digest", '+definition+'.argsCodec.pin, "wrong-plan-digest")\n      val missingCompletion = technicalBindings.copy(ResultAuthority0 = technicalBindings.ResultAuthority0.copy(completion = null))\n      intercept[IllegalArgumentException] { '+pkg+'.application.'+stem+'TechnicalPorts.install(missingCompletion) }\n      val wrongAuthority = '+pkg+'.application.'+stem+'TechnicalPorts.install(technicalBindings.copy(ResultAuthority0 = technicalBindings.ResultAuthority0.copy(completion = (_: '+original+', _: '+pkg+'.application.'+stem+'TechnicalPorts.CompletionContext) => Future.successful(CompletionRecord0(TxId("wrong-authority-tx"))))))\n      val beforeWrongDelivery = deliveryCounts.toMap\n      intercept[IllegalArgumentException] { Await.result('+pkg+'.application.'+stem+'HostIO.deliver("succeeded", original, authorityProbeIdentity, wrongAuthority), 3.seconds) }\n      assert(deliveryCounts.toMap == beforeWrongDelivery)\n      val deniedEntry = '+pkg+'.application.'+stem+'TechnicalPorts.install(technicalBindings.copy('+symbol(h.entry.port.ref.id)+' = technicalBindings.'+symbol(h.entry.port.ref.id)+'.copy(run = (_: '+original+') => Future.successful(false))))\n      val deniedHost = kit.spawn('+host+'("owned-denied-host", coordinator, deniedEntry))\n      deniedHost ! '+host+'.Submit(original, reply.ref)\n      reply.expectMessage('+host+'.Waiting("entry or association not admitted"))\n      assert(executeCounts.isEmpty && deliveryCounts.isEmpty)\n      val beforeHostEntry = technicalCalls.get()\n      hostActor ! '+host+'.ReceiveEntry('+pkg+'.domain.'+h.entry.source.owner[0]+'Protocol.'+symbol(h.entry.source.id)+'('+members.map(r=>'original.'+symbol(r.id)).join(', ')+'), reply.ref)\n      val first = reply.expectMessageType['+host+'.Accepted]\n      assert('+host+'.nextResult(Some("succeeded"), Some("outcome-unknown")).isEmpty)\n      assert('+host+'.nextResult(Some("outcome-unknown"), Some("succeeded")).contains("succeeded"))\n      assert('+host+'.classify(StrictState(status = StrictStatus.RecoveryRequired, evidence = Map(OperationIdentity(first.identity, "test", "test", "test", Phase.Prepare) -> Evidence.Uncertain(OperationIdentity(first.identity, "test", "test", "test", Phase.Prepare), "unknown")))).contains("outcome-unknown"))\n      val status = kit.createTestProbe[StrictSagaCoordinator.Reply]()\n      var terminal: StrictState = null\n      status.awaitAssert { coordinator ! StrictSagaCoordinator.GetStatus(status.ref); terminal = status.expectMessageType[StrictSagaCoordinator.Status].state; assert(terminal.status == StrictStatus.Succeeded) }\n      assert(terminal.participants.size == 3)\n      assert(terminal.evidence.values.count(_.isInstanceOf[Evidence.Confirmed]) == 6)\n      val allocation = kit.createTestProbe['+pkg+'.domain.AllocationOrderState]()\n      actor_allocation ! '+pkg+'.domain.AllocationOrderAggregate.GetState(allocation.ref)\n      assert(allocation.receiveMessage().status == "allocated")\n      hostActor ! '+host+'.Observe(reply.ref)\n      reply.expectMessage('+host+'.ResultRecorded("succeeded"))\n      assert(delivered.get("succeeded").contains("allocation-last"))\n      actor_allocation ! '+pkg+'.domain.AllocationOrderAggregate.GetState(allocation.ref)\n      assert(allocation.receiveMessage().result == "ReservationSucceeded")\n      val before = receipts.size\n      coordinator ! StrictSagaCoordinator.Attach(first.identity, status.ref)\n      assert(status.expectMessageType[StrictSagaCoordinator.Status].state.identity.contains(first.identity))\n      assert(receipts.size == before)\n      kit.stop(hostActor)\n      val resumed = kit.spawn('+host+'("generated-host-'+stem+'", coordinator, installedTechnical))\n      resumed ! '+host+'.Submit(original, reply.ref)\n      reply.expectMessage('+host+'.ResultRecorded("succeeded"))\n      assert(receipts.size == before)\n      val rejectedCoordinator = kit.spawn('+definition+'.coordinator("rejected-coordinator-'+stem+'", ports, authorizer))\n      val rejectedHost = kit.spawn('+host+'("rejected-host-'+stem+'", rejectedCoordinator, installedTechnical))\n      val rejectedInput = original.copy(requestId = '+pkg+'.domain.values.ReservationRequestId("request-rejected"), quantity = 0L)\n      rejectedHost ! '+host+'.Submit(rejectedInput, reply.ref)\n      reply.expectMessageType['+host+'.Accepted]\n      status.awaitAssert { rejectedCoordinator ! StrictSagaCoordinator.GetStatus(status.ref); terminal = status.expectMessageType[StrictSagaCoordinator.Status].state; assert(terminal.status == StrictStatus.Aborted) }\n      assert(!terminal.evidence.values.exists(_.isInstanceOf[Evidence.Confirmed]))\n      rejectedHost ! '+host+'.Observe(reply.ref)\n      reply.expectMessage('+host+'.ResultRecorded("rejected-before-effects"))\n      assert(delivered.get("rejected-before-effects").contains("allocation-last"))\n      actor_allocation ! '+pkg+'.domain.AllocationOrderAggregate.GetState(allocation.ref)\n      assert(allocation.receiveMessage().result == "ReservationRejected")\n      assert(receipts.size == before)\n    } finally kit.shutdownTestKit()\n  }\n';
 }
 text+='}\n';
 for(const context of [...new Set(products['saga-host-contract'].hosts.filter(h=>h.saga.ref.context==='inventory').map(h=>h.saga.ref.context))]) {
  const pkg=packageFor(context,options);
  text='import '+pkg+'.domain.values._\nimport '+pkg+'.application._\n'+text.replaceAll(pkg+'.domain.values.','').replaceAll(pkg+'.application.','');
 }
 const baseEntries=[entry('src/test/scala/GeneratedFiniteHostSpec.scala',text,'generated-test',products['saga-host-contract'].hosts.map(h=>h.source),footprint)];
 const recoveryHosts=products['saga-host-contract'].hosts.filter(h=>h.saga.ref.context==='inventory'&&h.entry.startOwner.kind!=='pipeline');
 let recoveryEntries=[];
 if(recoveryHosts.length){
  let rtext='import akka.actor.testkit.typed.scaladsl.ActorTestKit\nimport akka.actor.typed.scaladsl.AskPattern._\nimport akka.persistence.testkit.PersistenceTestKitPlugin\nimport com.typesafe.config.ConfigFactory\nimport net.imadz.infra.saga.strict._\nimport org.scalatest.funsuite.AnyFunSuite\nimport scala.concurrent.{Await, ExecutionContext, Future}\nimport scala.concurrent.duration._\nimport akka.util.Timeout\n\nfinal class GeneratedHostRecoverySpec extends AnyFunSuite {\n';
  for(const h of recoveryHosts){
   const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_'),definition=pkg+'.application.'+stem+'Definition',host=pkg+'.application.'+stem+'Host';
   rtext+='  test("'+h.id+' injected absence, late reconcile and same identity restart keep exact recovery effects") {\n    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))\n    implicit val ec: ExecutionContext = kit.system.executionContext\n    implicit val timeout: Timeout = 3.seconds\n    implicit val scheduler: akka.actor.typed.Scheduler = kit.system.scheduler\n    try {\n';
   rtext+=specCore(h);
   rtext+='      val reply = kit.createTestProbe['+host+'.Reply]()\n      val original = '+originalLiteralOf(h)+'\n      val status = kit.createTestProbe[StrictSagaCoordinator.Reply]()\n      var terminal: StrictState = null\n      val allocation = kit.createTestProbe['+pkg+'.domain.AllocationOrderState]()\n';
   rtext+=resultMatrix(pkg,definition,host);
   rtext+='    } finally kit.shutdownTestKit()\n  }\n';
  }
  rtext+='}\n';
  for(const context of [...new Set(recoveryHosts.map(h=>h.saga.ref.context))]) {
   const pkg=packageFor(context,options);
   rtext='import '+pkg+'.domain.values._\nimport '+pkg+'.application._\n'+rtext.replaceAll(pkg+'.domain.values.','').replaceAll(pkg+'.application.','');
  }
  recoveryEntries=[entry('src/test/scala/GeneratedHostRecoverySpec.scala',rtext,'generated-test',recoveryHosts.map(h=>h.source),footprint)];
 }
 const extendedHosts=products['saga-host-contract'].hosts.filter(h=>h.saga.ref.context==='inventory'&&h.technicalPorts.some(p=>EXTENDED_ROLES.includes(p.role)));
 let extendedEntries=[];
 if(extendedHosts.length){
  const artifacts=products['artifact-contract'].artifacts.filter(a=>a.status==='selected').flatMap(a=>a.ports);
  const pinOf=(h,role)=>{const p=h.technicalPorts.find(x=>x.role===role);return artifacts.find(a=>key(a.ref)===key(p.port.ref));};
  const methodOf=(h,role)=>symbol(h.technicalPorts.find(x=>x.role===role).port.ref.id);
  let etext='import akka.actor.testkit.typed.scaladsl.ActorTestKit\nimport akka.actor.typed.scaladsl.AskPattern._\nimport akka.persistence.testkit.PersistenceTestKitPlugin\nimport com.typesafe.config.ConfigFactory\nimport net.imadz.infra.saga.strict._\nimport org.scalatest.funsuite.AnyFunSuite\nimport scala.concurrent.{Await, ExecutionContext, Future}\nimport scala.concurrent.duration._\nimport akka.util.Timeout\n\nfinal class GeneratedExtendedPortsSpec extends AnyFunSuite {\n';
  for(const h of extendedHosts){
   const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_'),definition=pkg+'.application.'+stem+'Definition',host=pkg+'.application.'+stem+'Host',companion=pkg+'.application.'+stem+'TechnicalPorts';
   const originalLiteral=originalLiteralOf(h),original=typeName(h.entry.inputType,options),keyIds=h.association.inputKeys.map(r=>r.id);
   etext+='  test("'+h.id+' extended typed port roles deny without effects and roundtrip installed objects") {\n    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))\n    implicit val ec: ExecutionContext = kit.system.executionContext\n    implicit val timeout: Timeout = 3.seconds\n    implicit val scheduler: akka.actor.typed.Scheduler = kit.system.scheduler\n    try {\n';
   for(const p of h.participants){const aggregate=p.aggregate.id;let computations='new '+pkg+'.domain.'+aggregate+'Computations {}';if(aggregate==='Warehouse')computations='new '+pkg+'.domain.WarehouseComputations { def ReservationIdentity(state: '+pkg+'.domain.WarehouseState, p: '+pkg+'.domain.WarehouseProtocol.ReserveSkuQuantity): '+pkg+'.domain.values.ReservationId = '+pkg+'.domain.values.ReservationId("reservation-" + p.txid.value) }';const ingress=products['domain-external-events'].producers.some(e=>e.event.owner[0]===aggregate);const authority=ingress?', new '+pkg+'.domain.'+aggregate+'Aggregate.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = authorization == "owned-test-authority" }':'';etext+='      val actor_'+p.participantId+' = kit.spawn('+pkg+'.domain.'+aggregate+'Aggregate("extended-'+p.participantId+'", '+pkg+'.domain.'+aggregate+'State.empty, '+computations+authority+'))\n';}
   etext+='      val original = '+originalLiteral+'\n';
   etext+=technicalObjectsBlock(h,pkg,stem,true,originalLiteral);
   etext+='      val ports = '+definition+'.fromTechnical(installedTechnical)\n      val authorizer = new ReconcileAuthorizer { def authorize(identity: TransactionIdentity, token: String): Either[String, String] = if (token == "owned-test-reconcile") Right("owned-test-principal") else Left("test reconciliation denied") }\n      val coordinator = kit.spawn('+definition+'.coordinator("extended-coordinator-'+stem+'", ports, authorizer))\n      val reply = kit.createTestProbe['+host+'.Reply]()\n';
   if(h.entry.startOwner.kind==='direct'&&h.technicalPorts.some(p=>p.role==='resource-policy')){
    const m=methodOf(h,'resource-policy');
    etext+='      intercept[IllegalArgumentException] { '+companion+'.install(technicalBindings.copy('+m+' = technicalBindings.'+m+'.copy(run = null))) }\n      val deniedPolicy = '+companion+'.install(technicalBindings.copy('+m+' = technicalBindings.'+m+'.copy(run = (_: '+original+') => Future.successful(false))))\n      val deniedPolicyHost = kit.spawn('+host+'("extended-denied-policy-host", coordinator, deniedPolicy))\n      deniedPolicyHost ! '+host+'.Submit(original, reply.ref)\n      reply.expectMessage('+host+'.Waiting("resource policy denied"))\n      assert(receipts.isEmpty && deliveryCounts.isEmpty && authorityCalls.get() == 0)\n';
   }
   const gate=h.technicalPorts.find(p=>p.role==='external-event'),sourcePort=h.technicalPorts.find(p=>p.role==='occurrence-source');
   if(gate&&sourcePort&&h.entry.startOwner.kind==='direct'){
    const envelopeType=pinOf(h,'external-event').inputType;
    const owned=envelopeLiteral(envelopeType,'owned-test-authority'),forged=envelopeLiteral(envelopeType,'forged-authorization');
    etext+='      val occurrenceHost = kit.spawn('+host+'("extended-occurrence-host", coordinator, installedTechnical))\n      occurrenceHost ! '+host+'.SubmitOccurrence('+forged+', reply.ref)\n      reply.expectMessage('+host+'.Waiting("occurrence source denied"))\n      assert(receipts.isEmpty && deliveryCounts.isEmpty)\n      occurrenceHost ! '+host+'.SubmitOccurrence('+owned+', reply.ref)\n      reply.expectMessageType['+host+'.Accepted]\n      val extendedStatus = kit.createTestProbe[StrictSagaCoordinator.Reply]()\n      var extendedTerminal: StrictState = null\n      extendedStatus.awaitAssert { coordinator ! StrictSagaCoordinator.GetStatus(extendedStatus.ref); extendedTerminal = extendedStatus.expectMessageType[StrictSagaCoordinator.Status].state; assert(extendedTerminal.status == StrictStatus.Succeeded) }\n      occurrenceHost ! '+host+'.Observe(reply.ref)\n      reply.expectMessage('+host+'.ResultRecorded("succeeded"))\n';
   }
   if(h.technicalPorts.some(p=>p.role==='external-submission')){
    const pin=pinOf(h,'external-submission'),m=methodOf(h,'external-submission');
    const literal=extendedRecord(pin.outputType,keyIds,'original');
    etext+='      assert(Await.result(installedTechnical.'+m+'(original), 3.seconds) == '+literal+')\n';
   }
   if(h.technicalPorts.some(p=>p.role==='external-query')){
    const pin=pinOf(h,'external-query'),m=methodOf(h,'external-query'),query=extendedRecord(pin.inputType,keyIds,'original');
    const receipt=extendedRecord(optionalElement(pin.outputType),keyIds,'externalAssociation');
    etext+='      val externalAssociation = '+query+'\n      assert(Await.result(installedTechnical.'+m+'(externalAssociation), 3.seconds).contains('+receipt+'))\n      val absentReceipt = '+companion+'.install(technicalBindings.copy('+m+' = technicalBindings.'+m+'.copy(run = (_: '+typeName(pin.inputType,options)+') => Future.successful(None))))\n      assert(Await.result(absentReceipt.'+m+'(externalAssociation), 3.seconds).isEmpty)\n';
   }
   if(!(gate&&sourcePort)||h.entry.startOwner.kind==='pipeline'){
    if(gate){const pin=pinOf(h,'external-event'),m=methodOf(h,'external-event');etext+='      assert(!Await.result(installedTechnical.'+m+'('+envelopeLiteral(pin.inputType,'forged-authorization')+'), 3.seconds))\n      assert(Await.result(installedTechnical.'+m+'('+envelopeLiteral(pin.inputType,'owned-test-authority')+'), 3.seconds))\n      assert(receipts.isEmpty && deliveryCounts.isEmpty)\n';}
    if(sourcePort){const pin=pinOf(h,'occurrence-source'),m=methodOf(h,'occurrence-source');etext+='      assert(Await.result(installedTechnical.'+m+'('+envelopeLiteral(pin.inputType,'owned-test-authority')+'), 3.seconds) == original)\n      assert(receipts.isEmpty && deliveryCounts.isEmpty)\n';}
   }
   if(h.technicalPorts.some(p=>p.role==='readside')){
    const pin=pinOf(h,'readside'),m=methodOf(h,'readside');
    const query=extendedRecord(pin.inputType,keyIds,'original'),view=extendedRecord(optionalElement(pin.outputType),keyIds,'original');
    etext+='      assert(Await.result(installedTechnical.'+m+'('+query+'), 3.seconds) == Some('+view+'))\n';
   }
   if(h.technicalPorts.some(p=>p.role==='deployment')){
    const pin=pinOf(h,'deployment'),m=methodOf(h,'deployment');
    const target=extendedRecord(pin.inputType,[],'input');
    etext+='      val deploymentTarget = '+target+'\n      assert(Await.result(installedTechnical.'+m+'(deploymentTarget), 3.seconds))\n      val notReady = '+companion+'.install(technicalBindings.copy('+m+' = technicalBindings.'+m+'.copy(run = (_: '+typeName(pin.inputType,options)+') => Future.successful(false))))\n      assert(!Await.result(notReady.'+m+'(deploymentTarget), 3.seconds))\n';
   }
   if(h.technicalPorts.some(p=>p.role==='resource-policy'))etext+='      assert(Await.result(installedTechnical.'+methodOf(h,'resource-policy')+'(original), 3.seconds))\n';
   etext+='      assert('+companion+'.bindingOwnership.size == '+h.technicalPorts.length+')\n      assert('+companion+'.bindingOwnership.forall(_.boundary == "handwritten-composition-root"))\n';
   const wrongKey=(t,value)=>{const k=recordMembersOf(t).find(m=>keyIds.includes(m.ref.id));return value+'.copy('+symbol(k.ref.id)+' = '+make('wrong-original-association',k.valueType)+')';};
   for(const p of h.technicalPorts.filter(p=>['external-submission','external-query','readside'].includes(p.role))){
    const pin=pinOf(h,p.role),m=methodOf(h,p.role),input=p.role==='external-submission'?'original':extendedRecord(pin.inputType,keyIds,'original');
    const recordType=p.role==='external-submission'?pin.outputType:optionalElement(pin.outputType),record=extendedRecord(recordType,keyIds,'original');
    const response=wrongKey(recordType,record),result=p.role==='external-submission'?response:'Some('+response+')';
    etext+='      val wrong_'+m+' = '+companion+'.install(technicalBindings.copy('+m+' = technicalBindings.'+m+'.copy(run = (_: '+typeName(pin.inputType,options)+') => Future.successful('+result+'))))\n      intercept[IllegalArgumentException] { Await.result(wrong_'+m+'.'+m+'('+input+'), 3.seconds) }\n';
   }
   if(h.technicalPorts.some(p=>p.role==='deployment')){
    const m=methodOf(h,'deployment'),secret=recordMembersOf(pinOf(h,'deployment').inputType).find(m=>m.ref.id==='secretRef');
    etext+='      val beforeSecretCallback = technicalCalls.get()\n      intercept[IllegalArgumentException] { Await.result(installedTechnical.'+m+'(deploymentTarget.copy(secretRef = '+make('not-a-declared-secret-reference',secret.valueType)+')), 3.seconds) }\n      assert(technicalCalls.get() == beforeSecretCallback)\n';
   }
   if(h.entry.startOwner.kind==='direct')etext+=admissionReentry(h,pkg,stem);
   etext+='    } finally kit.shutdownTestKit()\n  }\n';
  }
  etext+='}\n';
  for(const context of [...new Set(extendedHosts.map(h=>h.saga.ref.context))]) {
   const pkg=packageFor(context,options);
   etext='import '+pkg+'.domain.values._\nimport '+pkg+'.application._\n'+etext.replaceAll(pkg+'.domain.values.','').replaceAll(pkg+'.application.','');
  }
  extendedEntries=[entry('src/test/scala/GeneratedExtendedPortsSpec.scala',etext,'generated-test',extendedHosts.map(h=>h.source),footprint)];
 }
 const bindingHosts=products['saga-host-contract'].hosts.filter(h=>h.saga.ref.context==='inventory');
 let bindingEntries=[];
 if(bindingHosts.length){
  const artifacts=products['artifact-contract'].artifacts.filter(a=>a.status==='selected').flatMap(a=>a.ports);
  let btext='import org.scalatest.funsuite.AnyFunSuite\nimport scala.concurrent.Future\nimport net.imadz.infra.saga.strict.OperationIdentity\n\nfinal class GeneratedRequiredBindingsSpec extends AnyFunSuite {\n';
  for(const h of bindingHosts){
   const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_'),companion=pkg+'.application.'+stem+'TechnicalPorts';
   btext+='  test('+JSON.stringify(h.id+' requires every exact technical object before host startup')+') {\n    val bindings = '+companion+'.Bindings(\n';
   btext+=h.technicalPorts.map(p=>{
    const pin=artifacts.find(a=>key(a.ref)===key(p.port.ref)&&a.version===p.port.version),input=typeName(pin.inputType,options),output=typeName(pin.outputType,options),callback='Future.failed(new IllegalStateException("installation-only test callback must not execute"))';
    return '      '+companion+'.Implementation['+input+', '+output+']('+JSON.stringify(p.implementation.id)+', '+JSON.stringify(p.implementation.version)+', (_: '+input+') => '+callback+(['phase-execute','phase-query'].includes(p.role)?', operation = (_: '+input+', _: OperationIdentity) => '+callback:'')+(['authority','result-delivery'].includes(p.role)?', completion = (_: '+input+', _: '+companion+'.CompletionContext) => '+callback:'')+')';
   }).join(',\n')+'\n    )\n';
   btext+='    val installed = '+companion+'.install(bindings)\n    assert(installed.declarations.size == '+h.technicalPorts.length+')\n    assert('+companion+'.bindingOwnership.map(_.port).toSet == installed.declarations.keySet)\n    intercept[IllegalArgumentException] { '+companion+'.install(null) }\n';
   const invalid=h.technicalPorts.flatMap(p=>{
    const m=symbol(p.port.ref.id.replaceAll('-','_'));
    const mutations=[['null','null'],['id','bindings.'+m+'.copy(id = "wrong-id")'],['version','bindings.'+m+'.copy(version = "wrong-version")'],['run','bindings.'+m+'.copy(run = null)']];
    if(['phase-execute','phase-query'].includes(p.role))mutations.push(['operation','bindings.'+m+'.copy(operation = null)']);
    if(['authority','result-delivery'].includes(p.role))mutations.push(['completion','bindings.'+m+'.copy(completion = null)']);
    return mutations.map(([kind,value])=>'      '+JSON.stringify(p.port.ref.id+'/'+kind)+' -> (() => '+companion+'.install(bindings.copy('+m+' = '+value+')))');
   });
   btext+='    val invalid: Vector[(String, () => '+companion+'.Installed)] = Vector(\n'+invalid.join(',\n')+'\n    )\n    invalid.foreach { case (name, run) => withClue(name) { intercept[IllegalArgumentException] { run() } } }\n  }\n';
  }
  btext+='}\n';
  for(const context of [...new Set(bindingHosts.map(h=>h.saga.ref.context))]){const pkg=packageFor(context,options);btext='import '+pkg+'.domain.values._\nimport '+pkg+'.application._\n'+btext.replaceAll(pkg+'.domain.values.','').replaceAll(pkg+'.application.','');}
  bindingEntries=[entry('src/test/scala/GeneratedRequiredBindingsSpec.scala',btext,'generated-test',bindingHosts.map(h=>h.source),footprint)];
 }
 return [...baseEntries,...recoveryEntries,...extendedEntries,...bindingEntries];
}
