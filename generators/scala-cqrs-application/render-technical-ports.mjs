import { entry, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
export function renderTechnicalPorts({products,options},footprint){
 return products['saga-host-contract'].hosts.map(h=>{
  const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_');
  const artifact=products['artifact-contract'].artifacts.filter(a=>a.status==='selected').flatMap(a=>a.ports);
  let text='package '+pkg+'.application\n\nimport scala.concurrent.Future\n\ntrait '+symbol(stem)+'TechnicalPorts {\n';
  for(const p of h.technicalPorts){const pin=artifact.find(a=>a.ref.id===p.port.ref.id&&a.ref.context===p.port.ref.context);text+='  def '+symbol(p.port.ref.id.replaceAll('-','_'))+'(input: '+typeName(pin.inputType,options)+'): Future['+typeName(pin.outputType,options)+']\n';}
  text+='}\nobject '+symbol(stem)+'TechnicalPorts {\n  val required: Vector[(String, String, String)] = Vector('+h.technicalPorts.map(p=>'('+JSON.stringify(p.port.ref.id)+', '+JSON.stringify(p.implementation.id)+', '+JSON.stringify(p.implementation.version)+')').join(', ')+')\n  def requireInstalled(actual: Map[String, (String, String)]): Unit = {\n    require(actual != null && required.forall { case (port, id, version) => actual.get(port).contains(id -> version) }, "missing or mismatched required implementation")\n  }\n}\n';
  return entry(pathFor(pkg,'application/'+stem+'TechnicalPorts.scala'),text,'technical-port',[h.source],footprint,[...new Set(h.technicalPorts.flatMap(p=>{const pin=artifact.find(a=>a.ref.id===p.port.ref.id&&a.ref.context===p.port.ref.context);return [pin.inputType,pin.outputType].flatMap(t=>t.form==='nominal'?[pathFor(pkg,'domain/values/'+t.ref.id+'.scala')]:[]);}))]);
 });
}
