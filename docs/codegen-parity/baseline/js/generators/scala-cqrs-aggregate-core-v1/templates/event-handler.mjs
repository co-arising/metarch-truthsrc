import { templateScope, expressionSyntax } from './expressions.mjs';

export function eventHandlerTemplate(aggregate, model, out) {
  const a=aggregate,b=a.base;
  const scope=templateScope(a.eventHandler,[b.protocol,b.state],[{container:b.protocol,members:[...b.protocol.commands,...b.protocol.events]}]);
  const name=scope.reference,syntax=expressionSyntax(model,{reference:name});
  out.append('package '+a.eventHandler.package+'\n\n'+scope.imports.join('\n')+'\n\n');
  out.append('object '+a.eventHandler.identifier+' {\n',a.eventHandler.sources);
  out.append('  def apply(state: '+name(b.state)+', event: '+name(b.protocol)+'.Event): '+name(b.state)+' = event match {\n');
  for(const e of a.events) {
    if(!e.assignments.length) {out.append('    case _: '+name(e.base)+' => state\n',[e.source]);continue;}
    out.append('    case value: '+name(e.base)+' =>\n',[e.source]);
    // Every expression explicitly reads state/value. Scala evaluates all copy
    // arguments before constructing one new State; no intermediate state exists.
    if(e.assignments.length===1) {
      const assignment=e.assignments[0];
      out.append('      state.copy('+assignment.field.identifier+' = '+syntax.fold(assignment)+')\n',[assignment.source]);
    } else {
      out.append('      state.copy(\n');
      e.assignments.forEach((assignment,index)=>out.append('        '+assignment.field.identifier+' = '+syntax.fold(assignment)+(index+1<e.assignments.length?',':'')+'\n',[assignment.source]));
      out.append('      )\n');
    }
  }
  out.append('  }\n}\n');
}
