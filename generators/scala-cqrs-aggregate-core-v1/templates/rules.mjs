import { templateScope, expressionSyntax } from './expressions.mjs';

export function rulesTemplate(aggregate, model, out) {
  const a=aggregate,b=a.base;
  const scope=templateScope(a.rules,[b.protocol,b.state,a.helpers,{...b.ruleParams,wildcardOnly:true},b.computations],
    [{container:b.protocol,members:[...b.protocol.commands,...b.protocol.events]}, {container:b.ruleParams,members:b.ruleParams.params}]);
  const name=scope.reference, syntax=expressionSyntax(model,{state:'params.state',command:'params.command',hosts:'params.hosts',reference:name});
  const result='Either[String, Vector['+name(b.protocol)+'.Event]]';
  out.append('package '+a.rules.package+'\n\n'+scope.imports.join('\n')+'\n\n');
  out.append('object '+a.rules.identifier+' {\n',a.rules.sources);
  out.append('  def decide(\n    state: '+name(b.state)+',\n    command: '+name(b.protocol)+'.Command,\n    hosts: '+name(b.computations)+'\n  ): '+result+' = command match {\n');
  for(const c of a.commands) out.append('    case value: '+name(c.base)+' => '+c.ruleMethod.identifier+'('+name(c.params)+'(state, value, hosts))\n',[c.source]);
  out.append('  }\n');
  for(const c of a.commands) {
    out.append('\n  def '+c.ruleMethod.identifier+'(params: '+name(c.params)+'): '+result+' = {\n',[c.source]);
    c.guards.forEach((guard,index)=>{
      const p=guard.predicate;
      const failed=p.op==='not'?syntax.predicate(p.argument):'!('+syntax.predicate(p)+')';
      const failure=guard.onFalse.kind==='reject'?'Left('+JSON.stringify(guard.onFalse.errCode)+')':'Right(Vector.empty)';
      out.append('    '+(index?'else if':'if')+' ('+failed+') '+failure+'\n',[guard.source]);
    });
    out.append('    '+(c.guards.length?'else ':'')+'Right('+name(a.helpers)+'.'+c.emitMethod.identifier+'(params.state, params.command, params.hosts))\n',[c.source]);
    out.append('  }\n');
  }
  out.append('}\n');
}
