import { scalaLiteral } from '../../scala-cqrs-domain-kernel-v1/templates/types.mjs';

/** Imports are merely an abbreviation for already-resolved FQNs. Ambiguous/own
 * names stay qualified; no rewritten author name or output string replacement. */
export function templateScope(artifact, imports, wildcards = []) {
  const candidates = [...imports, ...wildcards.flatMap(w => [w.container, ...w.members])];
  const groups = new Map();
  for (const a of candidates) {
    const set = groups.get(a.name) ?? new Set(); set.add(a.fqn); groups.set(a.name, set);
  }
  const safe = a => a.name !== artifact.name && groups.get(a.name)?.size === 1;
  const direct = imports.filter(a => !a.wildcardOnly && safe(a)), stars = wildcards.filter(w => w.members.every(safe) && safe(w.container));
  const names = new Map(direct.map(a => [a.fqn, a.identifier]));
  for (const w of stars) for (const a of w.members) names.set(a.fqn, a.identifier);
  function reference(a) {
    if (names.has(a.fqn)) return names.get(a.fqn);
    // A qualified parent import is safe even when a wildcard was suppressed.
    const parent = [...direct].sort((a,b) => b.fqn.length-a.fqn.length).find(p => a.fqn.startsWith(p.fqn+'.'));
    return parent ? parent.identifier+a.fqn.slice(parent.fqn.length) : '_root_.'+a.fqn;
  }
  const lines = [];
  // Scala resolves an unrooted import against enclosing packages first. A base
  // root named `params`, for example, is shadowed by invariant.params here.
  const qualifyImport = fqn => {
    const root = fqn.split('.')[0];
    return artifact.package.split('.').slice(1).includes(root) || candidates.some(candidate => candidate.fqn.startsWith(artifact.package + '.' + root + '.')) ? '_root_.' + fqn : fqn;
  };
  for (const a of imports) {
    if (direct.includes(a)) lines.push('import '+qualifyImport(a.fqn));
    const star = stars.find(w => w.container.fqn===a.fqn);
    if (star) lines.push('import '+qualifyImport(a.fqn)+'._');
  }
  // RuleParams imports only their nested types, matching the independent API.
  for (const w of stars) if (!imports.some(a => a.fqn===w.container.fqn)) lines.push('import '+qualifyImport(w.container.fqn)+'._');
  return { reference, imports: [...new Set(lines)] };
}

/** Target syntax only. Node type admission, accessors and exact projections are
 * supplied by expression-model. A new occurrence is never memoized by ref/deps. */
export function expressionSyntax(model, { state = 'state', command = 'command', event = 'value', hosts = 'hosts', reference = a => '_root_.'+a.fqn } = {}) {
  let sequence = 0;
  const reserved = new Set([
    ...[state, command, event, hosts].flatMap(root => root.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []),
    ...model.artifacts.map(a => a.name),
  ]);
  const fresh = kind => { let name; do { name = 'core'+kind+(++sequence); } while (reserved.has(name)); return name; };
  const root = { state, command, event };
  // Reuse family1's admitted-literal syntax with a template-local qualification
  // view. Never rewrite emitted Scala or mutate the shared family1 model.
  function literalType(type) {
    if (type.form === 'nominal') return { ...type, fqn: reference(type) };
    if (['optional', 'sequence'].includes(type.form)) return { ...type, element: literalType(type.element) };
    if (type.form === 'map') return { ...type, key: literalType(type.key), value: literalType(type.value) };
    return type;
  }
  const literalValues = model.kernel.values.map(v => ({ ...v, fields: v.fields.map(f => ({ ...f, type: literalType(f.type) })) }));
  const atom = n => ['ref','member','host','literal','integer','decimal','boolean','string','text-value','map-get','map-lookup'].includes(n.op);
  const receiver = (n, render) => atom(n) ? render(n) : '('+render(n)+')';
  const definition = exact => reference(exact.definition);
  const compare = {less:'<','less-equal':'<=',greater:'>','greater-equal':'>=',equal:'==','not-equal':'!='};
  function unitCheck(left,right) {
    return '_root_.scala.Predef.require('+left+'._2.isEmpty || '+right+'._2.isEmpty || '+left+'._2 == '+right+'._2, "exact units differ"); ';
  }
  function exactPair(n, exact) {
    if (!n.numeric) throw new TypeError('resolved numeric operand is required');
    const d=definition(exact), numeric=n.numeric;
    if (numeric.carrier==='literal') return '('+d+'.checkedAmount(BigDecimal('+JSON.stringify(n.value)+')), None)';
    if (numeric.carrier==='arithmetic') return arithmeticPair(n);
    const variable=fresh('Exact');
    const expression=numeric.carrier==='amount-member' ? predicate(n.argument) : predicate(n);
    return '{ val '+variable+' = '+expression+'; ('+d+'.checkedAmount('+variable+'.'+exact.amountField.accessor+'), '+
      (exact.unitField ? 'Some('+variable+'.'+exact.unitField.accessor+')' : 'None')+') }';
  }
  function arithmeticPair(n) {
    const left=fresh('Left'),right=fresh('Right'),amount=fresh('Amount'),d=definition(n.exact);
    return '{ val '+left+' = '+exactPair(n.left,n.exact)+'; val '+right+' = '+exactPair(n.right,n.exact)+'; '+
      unitCheck(left,right)+'val '+amount+' = '+d+'.checkedAmount('+left+'._1 '+(n.op==='add'?'+':'-')+' '+right+'._1); '+
      '('+amount+', '+left+'._2.orElse('+right+'._2)) }';
  }
  function arithmetic(n) {
    if (n.mode==='checked-long') return 'java.lang.Math.'+(n.op==='add'?'addExact':'subtractExact')+'('+predicate(n.left)+', '+predicate(n.right)+')';
    if (n.mode!=='exact') throw new TypeError('resolved arithmetic policy missing');
    const pair=fresh('Result'),d=definition(n.exact);
    return '{ val '+pair+' = '+arithmeticPair(n)+'; '+(n.type.form==='nominal' ? d+'('+pair+'._1'+(n.exact.unitField?', '+pair+'._2.get':'')+')' : pair+'._1')+' }';
  }
  function predicate(n) {
    if(n.op==='ref') return root[n.root]+'.'+n.field.accessor;
    if(n.op==='member'||n.op==='text-value') return receiver(n.argument,predicate)+'.'+n.field.accessor;
    if(n.op==='boolean') return String(n.value);
    if(n.op==='string') return JSON.stringify(n.value);
    if(n.op==='integer') return n.value==='-9223372036854775808'?'Long.MinValue':n.value+'L';
    if(n.op==='decimal') return 'BigDecimal('+JSON.stringify(n.value)+')';
    if(n.op==='not') return '!('+predicate(n.argument)+')';
    if(n.op==='is-empty'||n.op==='non-empty') return receiver(n.argument,predicate)+'.'+(n.op==='is-empty'?'isEmpty':'nonEmpty');
    if(n.op==='map-keys') return receiver(n.argument,predicate)+'.keys.toVector';
    if(n.op==='exact-positive') return receiver(n.argument,predicate)+'.isPositive';
    if(n.op==='add'||n.op==='subtract') return arithmetic(n);
    if(n.op==='and'||n.op==='or') return '('+predicate(n.left)+(n.op==='and'?' && ':' || ')+predicate(n.right)+')';
    if(n.op==='exact-sufficient') {
      const request=fresh('Request'),balance=fresh('Balance');
      if(n.balance==='nominal') return '{ val '+request+' = '+predicate(n.right)+'; val '+balance+' = '+predicate(n.left)+'; '+balance+'.compareSameUnit('+request+') >= 0 }';
      const available=fresh('Available');
      return '{ val '+request+' = '+predicate(n.right)+'; val '+balance+' = '+predicate(n.left)+'; '+balance+'.get('+request+'.'+n.exact.unitField.accessor+') match { '+
        'case None => false; case Some('+available+') => '+available+'.compareSameUnit('+request+') >= 0 } }';
    }
    if(n.op==='collection-covered') {
      const map=fresh('Map'),items=fresh('Items'),item=fresh('Item');
      return '{ val '+map+' = '+predicate(n.left)+'; val '+items+' = '+predicate(n.right)+'; '+items+'.forall('+item+' => '+map+'.contains('+item+')) }';
    }
    if(n.op==='all-equal') {
      const items=fresh('Items'),expected=fresh('Expected'),item=fresh('Item');
      return '{ val '+items+' = '+predicate(n.left)+'; if ('+items+'.isEmpty) true else { val '+expected+' = '+predicate(n.right)+'; '+items+'.forall('+item+' => '+item+' == '+expected+') } }';
    }
    if(Object.hasOwn(compare,n.op)) {
      if(n.mode==='exact-amount') {
        const left=fresh('Left'),right=fresh('Right');
        return '{ val '+left+' = '+exactPair(n.left,n.exact)+'; val '+right+' = '+exactPair(n.right,n.exact)+'; '+unitCheck(left,right)+left+'._1 '+compare[n.op]+' '+right+'._1 }';
      }
      const operand = child => Object.hasOwn(compare, child.op) ? '('+predicate(child)+')' : predicate(child);
      return operand(n.left)+' '+compare[n.op]+' '+operand(n.right);
    }
    if(['map-get','map-contains','map-lookup','contains'].includes(n.op)) {
      const left=receiver(n.left,predicate),right=predicate(n.right);
      return left+(n.op==='map-lookup'?'('+right+')':'.'+(n.op==='map-get'?'get':'contains')+'('+right+')');
    }
    throw new TypeError('unsupported resolved predicate op '+n.op);
  }
  function value(n) {
    if(n.op==='ref') return root[n.root]+'.'+n.field.accessor;
    if(n.op==='member') return receiver(n.argument,value)+'.'+n.field.accessor;
    if(n.op==='literal') return scalaLiteral(n.value,literalType(n.valueType),literalValues);
    if(n.op==='host') return hosts+'.'+n.method.identifier+'('+n.arguments.map(value).join(', ')+')';
    if(n.op==='map-get') return receiver(n.map,value)+'.get('+value(n.key)+')';
    if(n.op==='add'||n.op==='subtract') {
      if(n.mode==='checked-long') return 'java.lang.Math.'+(n.op==='add'?'addExact':'subtractExact')+'('+value(n.left)+', '+value(n.right)+')';
      if(n.mode==='exact') return receiver(n.left,value)+'.'+(n.op==='add'?'plus':'minus')+'('+value(n.right)+')';
    }
    throw new TypeError('unsupported resolved value op '+n.op);
  }
  function fold(assignment) {
    const u=assignment.update,base=state+'.'+assignment.field.accessor;
    if(u.op==='set') return value(u.value);
    if(u.op==='put') return base+'.updated('+value(u.key)+', '+value(u.value)+')';
    if(u.op==='remove') return base+' - '+value(u.key);
    if(u.op==='integer-apply') return 'java.lang.Math.'+(u.sign===1?'addExact':'subtractExact')+'('+base+', '+value(u.delta)+')';
    if(u.op==='money-apply') return base+'.'+(u.sign===1?'plus':'minus')+'('+value(u.delta)+')';
    if(u.op==='remove-all') return base+' -- '+value(u.key);
    if(u.op==='put-all') {
      const keys=fresh('Keys'),item=fresh('Value'),map=fresh('Map'),key=fresh('Key');
      // RHS expressions finish against pre-state before foldLeft applies keys;
      // even an empty key sequence evaluates the declared value exactly once.
      return '{ val '+keys+' = '+value(u.key)+'; val '+item+' = '+value(u.value)+'; '+keys+'.foldLeft('+base+')(('+map+', '+key+') => '+map+'.updated('+key+', '+item+')) }';
    }
    throw new TypeError('unsupported resolved fold op '+u.op);
  }
  return { predicate, value, fold };
}
