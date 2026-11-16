import { templateScope, expressionSyntax } from './expressions.mjs';

export function commandHelpersTemplate(aggregate, model, out) {
  const a=aggregate,b=a.base;
  const scope=templateScope(a.helpers,[b.protocol,b.state,b.computations],[{container:b.protocol,members:[...b.protocol.commands,...b.protocol.events]}]);
  const name=scope.reference,syntax=expressionSyntax(model,{reference:name});
  out.append('package '+a.helpers.package+'\n\n'+scope.imports.join('\n')+'\n\n');
  out.append('object '+a.helpers.identifier+' {\n',a.helpers.sources);
  function emission(e) {
    out.append(name(e.base)+'(',[e.source]);
    e.slots.forEach((slot,index)=>out.append((index?', ':'')+syntax.value(slot.producer),[slot.source]));
    out.append(')');
  }
  a.commands.forEach((c,index)=>{
    if(index)out.append('\n');
    out.append('  def '+c.emitMethod.identifier+'(\n    state: '+name(b.state)+',\n    command: '+name(c.base)+',\n    hosts: '+name(b.computations)+'\n  ): Vector['+name(b.protocol)+'.Event] = Vector(',[c.source]);
    const inline=c.emissions.length===0||c.emissions.length===1&&c.emissions[0].slots.length<=1&&c.emissions[0].slots.every(s=>['ref','literal'].includes(s.producer.op));
    if(inline) {
      c.emissions.forEach(emission);out.append(')\n');
    } else {
      out.append('\n');
      c.emissions.forEach((e,i)=>{out.append('    ');emission(e);out.append((i+1<c.emissions.length?',':'')+'\n');});
      out.append('  )\n');
    }
  });
  out.append('}\n');
}
