import { entry, key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
export function renderTechnicalPorts({products,options},footprint){
 const field=r=>products['reference-layout'].declarations.find(d=>key(d.ref)===key(r));
 const nonNull=(value,t)=>t.form==='nominal'?value+' != null && '+nonNull(value+'.value',field(t.ref).valueType):value+' != null';
 const textualValue=(value,t)=>t.form==='nominal'?textualValue(value+'.value',field(t.ref).valueType):value;
 const selected=products['artifact-contract'].artifacts.filter(a=>a.status==='selected');
 const owner=p=>{
  const rows=selected.filter(a=>a.ports.some(pin=>key(pin.ref)===key(p.port.ref)&&pin.version===p.port.version)&&a.implementations.some(i=>key(i.port)===key(p.port.ref)&&i.id===p.implementation.id&&i.version===p.implementation.version));
  if(rows.length!==1)throw new TypeError('exact selected technical port owner required');
  return rows[0];
 };
 return products['saga-host-contract'].hosts.map(h=>{
  const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_');
  const artifact=selected.flatMap(a=>a.ports);
  const pins=h.technicalPorts.map(p=>({p,pin:artifact.find(a=>key(a.ref)===key(p.port.ref)&&a.version===p.port.version),method:symbol(p.port.ref.id.replaceAll('-','_'))}));
  const installedRun=({p,pin,method})=>{
   const keys=h.association.inputKeys.map(r=>({id:symbol(r.id),type:field(r).valueType}));
   if(['external-submission','external-query','readside'].includes(p.role)){
    const inputGate=['input != null',...keys.map(k=>nonNull('input.'+k.id,k.type))].join(' && ');
    const sameKeys=keys.map(k=>'record.'+k.id+' == input.'+k.id).join(' && ');
    const resultGate=p.role==='external-submission'?'result != null && { val record = result; '+sameKeys+' }':'result != null && result.forall(record => record != null && '+sameKeys+')';
    return '{\n      require('+inputGate+', "complete original association input required")\n      val pending = bindings.'+method+'.run(input)\n      require(pending != null, "typed association callback future required")\n      pending.map { result =>\n        require('+resultGate+', "technical port changed original association")\n        result\n      }(scala.concurrent.ExecutionContext.parasitic)\n    }';
   }
   if(p.role==='deployment'){
    const members=field(pin.inputType.ref).valueType.members.map(field),secret=members.find(m=>m.ref.id==='secretRef');
    return '{\n      require(input != null && '+nonNull('input.secretRef',secret.valueType)+' && secretReferences.exists(_._1 == '+textualValue('input.secretRef',secret.valueType)+'), "declared symbolic secret reference required before deployment callback")\n      bindings.'+method+'.run(input)\n    }';
   }
   return 'bindings.'+method+'.run(input)';
  };
  let text='package '+pkg+'.application\n\nimport scala.concurrent.Future\nimport net.imadz.infra.saga.strict.{OperationIdentity, TransactionIdentity}\n\ntrait '+symbol(stem)+'TechnicalPorts {\n';
  for(const {p,pin,method} of pins){
   text+='  // '+p.role+': implementation is supplied by the handwritten composition root, never by this generated declaration.\n';
   text+='  def '+method+'(input: '+typeName(pin.inputType,options)+'): Future['+typeName(pin.outputType,options)+']\n';
  }
  text+='}\nobject '+symbol(stem)+'TechnicalPorts {\n  val required: Vector[(String, String, String)] = Vector('+h.technicalPorts.map(p=>'('+JSON.stringify(p.port.ref.id)+', '+JSON.stringify(p.implementation.id)+', '+JSON.stringify(p.implementation.version)+')').join(', ')+')\n  def requireInstalled(actual: Map[String, (String, String)]): Unit = {\n    require(actual != null && required.forall { case (port, id, version) => actual.get(port).contains(id -> version) }, "missing or mismatched required implementation")\n  }\n';
  text+='  // Install exact callback objects in the handwritten composition root before constructing a host or coordinator.\n  // Ownership below is a static binding obligation, not proof of business authorization, replay or deployment.\n';
  text+='  final case class BindingOwnership(port: String, role: String, artifact: String, artifactVersion: String, implementation: String, implementationVersion: String, boundary: String)\n  val bindingOwnership: Vector[BindingOwnership] = Vector(\n'+pins.map(({p})=>{const a=owner(p);return '    BindingOwnership('+[p.port.ref.id,p.role,a.id,a.version,p.implementation.id,p.implementation.version,'handwritten-composition-root'].map(JSON.stringify).join(', ')+')';}).join(',\n')+'\n  )\n';
  const secrets=pins.filter(({p})=>p.role==='deployment').flatMap(({p})=>owner(p).deployment.secretRefs);
  text+='  val secretReferences: Vector[(String, String)] = Vector('+secrets.map(s=>'('+JSON.stringify(s.id)+', '+JSON.stringify(s.provider)+')').join(', ')+')\n';
  text+='  final case class CompletionContext(original: '+typeName(h.entry.inputType,options)+', identity: TransactionIdentity)\n  final case class Implementation[I, O](id: String, version: String, run: I => Future[O], operation: (I, OperationIdentity) => Future[O] = null, completion: (I, CompletionContext) => Future[O] = null)\n  final case class Bindings(\n';
  text+=pins.map(({pin,method})=>'    '+method+': Implementation['+typeName(pin.inputType,options)+', '+typeName(pin.outputType,options)+']').join(',\n')+'\n  )\n';
  text+='  final class Installed private['+symbol(stem)+'TechnicalPorts] (private val bindings: Bindings) extends '+symbol(stem)+'TechnicalPorts {\n';
  for(const row of pins){
   const {p,pin,method}=row;
   text+='    def '+method+'(input: '+typeName(pin.inputType,options)+'): Future['+typeName(pin.outputType,options)+'] = '+installedRun(row)+'\n';
   if(['authority','result-delivery'].includes(p.role))text+='    def '+method+'Completion(input: '+typeName(pin.inputType,options)+', context: CompletionContext): Future['+typeName(pin.outputType,options)+'] = bindings.'+method+'.completion(input, context)\n';
   if(['phase-execute','phase-query'].includes(p.role))text+='    def '+method+'Operation(input: '+typeName(pin.inputType,options)+', identity: OperationIdentity): Future['+typeName(pin.outputType,options)+'] = bindings.'+method+'.operation(input, identity)\n';
  }
  text+='    val declarations: Map[String, (String, String)] = Map('+pins.map(({p,method})=>JSON.stringify(p.port.ref.id)+' -> (bindings.'+method+'.id -> bindings.'+method+'.version)').join(', ')+')\n  }\n';
  text+='  def install(bindings: Bindings): Installed = {\n    require(bindings != null, "complete technical object bindings required")\n';
  for(const {p,method} of pins)text+='    require(bindings.'+method+' != null && bindings.'+method+'.id == '+JSON.stringify(p.implementation.id)+' && bindings.'+method+'.version == '+JSON.stringify(p.implementation.version)+' && bindings.'+method+'.run != null'+(['authority','result-delivery'].includes(p.role)?' && bindings.'+method+'.completion != null':'')+(['phase-execute','phase-query'].includes(p.role)?' && bindings.'+method+'.operation != null':'')+', '+JSON.stringify('missing or mismatched technical object '+p.port.ref.id)+')\n';
  text+='    new Installed(bindings)\n  }\n}\n';
  return entry(pathFor(pkg,'application/'+stem+'TechnicalPorts.scala'),text,'technical-port',[h.source],footprint,[...new Set(pins.flatMap(({pin})=>[pin.inputType,pin.outputType].flatMap(t=>t.form==='nominal'?[pathFor(pkg,'domain/values/'+t.ref.id+'.scala')]:[])))]);
 });
}
