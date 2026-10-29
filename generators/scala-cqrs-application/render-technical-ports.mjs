import { entry, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
export function renderTechnicalPorts({products,options},footprint){
 return products['saga-host-contract'].hosts.map(h=>{
  const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_');
  const artifact=products['artifact-contract'].artifacts.filter(a=>a.status==='selected').flatMap(a=>a.ports);
  let text='package '+pkg+'.application\n\nimport scala.concurrent.Future\nimport net.imadz.infra.saga.strict.{OperationIdentity, TransactionIdentity}\n\ntrait '+symbol(stem)+'TechnicalPorts {\n';
  for(const p of h.technicalPorts){const pin=artifact.find(a=>a.ref.id===p.port.ref.id&&a.ref.context===p.port.ref.context);text+='  def '+symbol(p.port.ref.id.replaceAll('-','_'))+'(input: '+typeName(pin.inputType,options)+'): Future['+typeName(pin.outputType,options)+']\n';}
  text+='}\nobject '+symbol(stem)+'TechnicalPorts {\n  val required: Vector[(String, String, String)] = Vector('+h.technicalPorts.map(p=>'('+JSON.stringify(p.port.ref.id)+', '+JSON.stringify(p.implementation.id)+', '+JSON.stringify(p.implementation.version)+')').join(', ')+')\n  def requireInstalled(actual: Map[String, (String, String)]): Unit = {\n    require(actual != null && required.forall { case (port, id, version) => actual.get(port).contains(id -> version) }, "missing or mismatched required implementation")\n  }\n';
  text+='  final case class CompletionContext(original: '+typeName(h.entry.inputType,options)+', identity: TransactionIdentity)\n  final case class Implementation[I, O](id: String, version: String, run: I => Future[O], operation: (I, OperationIdentity) => Future[O] = null, completion: (I, CompletionContext) => Future[O] = null)\n  final case class Bindings(\n';
  const pins=h.technicalPorts.map(p=>({p,pin:artifact.find(a=>a.ref.id===p.port.ref.id&&a.ref.context===p.port.ref.context),method:symbol(p.port.ref.id.replaceAll('-','_'))}));
  text+=pins.map(({pin,method})=>'    '+method+': Implementation['+typeName(pin.inputType,options)+', '+typeName(pin.outputType,options)+']').join(',\n')+'\n  )\n';
  text+='  final class Installed private['+symbol(stem)+'TechnicalPorts] (private val bindings: Bindings) extends '+symbol(stem)+'TechnicalPorts {\n';
  for(const {p,pin,method} of pins){
   text+='    def '+method+'(input: '+typeName(pin.inputType,options)+'): Future['+typeName(pin.outputType,options)+'] = bindings.'+method+'.run(input)\n';
   if(['authority','result-delivery'].includes(p.role))text+='    def '+method+'Completion(input: '+typeName(pin.inputType,options)+', context: CompletionContext): Future['+typeName(pin.outputType,options)+'] = bindings.'+method+'.completion(input, context)\n';
   if(['phase-execute','phase-query'].includes(p.role))text+='    def '+method+'Operation(input: '+typeName(pin.inputType,options)+', identity: OperationIdentity): Future['+typeName(pin.outputType,options)+'] = bindings.'+method+'.operation(input, identity)\n';
  }
  text+='    val declarations: Map[String, (String, String)] = Map('+pins.map(({p,method})=>JSON.stringify(p.port.ref.id)+' -> (bindings.'+method+'.id -> bindings.'+method+'.version)').join(', ')+')\n  }\n';
  text+='  def install(bindings: Bindings): Installed = {\n    require(bindings != null, "complete technical object bindings required")\n';
  for(const {p,method} of pins)text+='    require(bindings.'+method+' != null && bindings.'+method+'.id == '+JSON.stringify(p.implementation.id)+' && bindings.'+method+'.version == '+JSON.stringify(p.implementation.version)+' && bindings.'+method+'.run != null'+(['authority','result-delivery'].includes(p.role)?' && bindings.'+method+'.completion != null':'')+(['phase-execute','phase-query'].includes(p.role)?' && bindings.'+method+'.operation != null':'')+', '+JSON.stringify('missing or mismatched technical object '+p.port.ref.id)+')\n';
  text+='    new Installed(bindings)\n  }\n}\n';
  return entry(pathFor(pkg,'application/'+stem+'TechnicalPorts.scala'),text,'technical-port',[h.source],footprint,[...new Set(h.technicalPorts.flatMap(p=>{const pin=artifact.find(a=>a.ref.id===p.port.ref.id&&a.ref.context===p.port.ref.context);return [pin.inputType,pin.outputType].flatMap(t=>t.form==='nominal'?[pathFor(pkg,'domain/values/'+t.ref.id+'.scala')]:[]);}))]);
 });
}
