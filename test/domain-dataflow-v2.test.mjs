import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';
import { compileProductSet } from '../lib/products/compile.mjs';
import { evaluateValue, parseValue } from '../lib/domain-products/values.mjs';
import { evaluateFolds } from '../lib/domain-products/folds.mjs';
import { evaluateDecisions } from '../lib/domain-products/decision.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/dataflow-v2/${name}.json`, import.meta.url), 'utf8'));
const request = () => {
  const m = fixture('files');
  return { ...m, schemaVersion: 'truthsrc.product-compilation/v1', documents: m.documents.map(d => ({ id: d.id, schemaVersion: d.schemaVersion, value: fixture(d.id) })) };
};
const document = (r, id) => r.documents.find(d => d.id === id).value;
const compiled = () => {
  const c = compileProductSet(request()); assert.deepEqual(c.diagnostics, []); return c.result;
};
const payload = (set,id) => set.products.find(p => p.id === id).payload;
const inputs = rows => new Map(rows.map(([ref,value]) => [ref,value]));
test('explicit v2 dataflow preserves exact decision dependency, full signatures and source-derived arithmetic', () => {
  const set = compiled(), dependencies = payload(set,'domain-dependencies');
  assert.equal(set.products.find(p => p.id === 'domain-dependencies').version, '2');
  assert.deepEqual(dependencies.commands[0].declaredSignature.map(p => p.ref.id), ['label','delta','steps']);
  assert.deepEqual(dependencies.commands[0].usedDependencies.map(r => r.id), ['label','delta','steps']);
  assert.equal(dependencies.commands[0].events[0].slots[0].producer.op, 'add');
  assert.equal(dependencies.commands[0].events[0].slots[1].producer.op, 'subtract');
  assert.ok(Object.isFrozen(set));
});
test('exact decision, event producers and all replay RHS use independent exact/pre-event oracle', () => {
  const set=compiled(), layout=payload(set,'reference-layout'), exact=payload(set,'exact-value-types');
  const c=payload(set,'domain-dependencies').commands[0], signature=c.declaredSignature;
  const values=inputs(signature.map(s => [s.ref, {label:'g',delta:'0.25',steps:'3'}[s.ref.id]]));
  assert.deepEqual(evaluateDecisions(payload(set,'domain-decision').commands[0],values,layout,{types:exact}),{kind:'continue'});
  const slots=c.events[0].slots;
  assert.equal(evaluateValue(slots[0].producer,c.command,values,layout,[],exact), '0.35');
  assert.equal(evaluateValue(slots[1].producer,c.command,values,layout,[],exact), '2');
  const folds=payload(set,'domain-folds'), event=folds.events[0];
  const before=inputs([...folds.defaults.map(d => [d.target,{level:'1.00',previous:'9.00',count:'7'}[d.target.id]]),[slots[0].slot,'0.35'],[slots[1].slot,'2']]);
  const output=evaluateFolds(event,before,layout,exact);
  const get=id=>[...output].find(([r])=>r.id===id)[1];
  assert.equal(get('level'),'1.35'); assert.equal(get('previous'),'1.00'); assert.equal(get('count'),'5');
  assert.deepEqual([...evaluateFolds({...event,assignments:[...event.assignments].reverse()},before,layout,exact)].map(([r,v])=>[r.id,v]).sort(),[...output].map(([r,v])=>[r.id,v]).sort());
  assert.equal([...before].find(([r])=>r.id==='level')[1],'1.00');
});
for (const [name, mutate, code] of [
  ['v2 dependencies cannot require v1 decisions',r=>r.requirements.find(p=>p.id==='domain-dependencies').requires[1].version='1','PRODUCT_DEPENDENCY'],
  ['v2 folds cannot require v1 dependencies',r=>r.requirements.find(p=>p.id==='domain-folds').requires[1].version='1','PRODUCT_DEPENDENCY'],
  ['v2 bindings cannot masquerade as v1',r=>{ const d=r.documents.find(d=>d.id==='dependencies'); d.schemaVersion=d.value.schemaVersion='truthsrc.domain-dependency-binding/v1'; },'PRODUCT_ROLE'],
  ['missing exact dependency is rejected',r=>r.requirements.find(p=>p.id==='domain-dependencies').requires.pop(),'PRODUCT_DEPENDENCY'],
  ['wrong arithmetic operand type',r=>document(r,'domain').aggregates[0].events[0].bindings[0].expr.right='param.label','VALUE_TYPE'],
  ['exact event literal validates its explicit scale',r=>document(r,'domain').aggregates[0].events[0].bindings[0].expr.right='literal:0.100','EXACT_SCALE'],
  ['integer event literal rejects overflow',r=>document(r,'domain').aggregates[0].events[0].bindings[1].expr.right='literal:9223372036854775808','VALUE_OVERFLOW'],
  ['unsupported arithmetic form',r=>document(r,'domain').aggregates[0].events[0].bindings[0].expr.form='multiply','VALUE_OPERATOR'],
  ['closed arithmetic authored shape',r=>document(r,'domain').aggregates[0].events[0].bindings[0].expr.round=true,'PRODUCT_FIELD_UNKNOWN'],
  ['replay cannot access command through arithmetic',r=>document(r,'domain').aggregates[0].events[0].foldAssignments[0].expr.right='param.delta','VALUE_SCOPE'],
  ['forged complete binding still loses to canonical',r=>document(r,'dependencies').dependencies.commands[0].events[0].slots[0].producer.op='subtract','PRODUCT_PAYLOAD_MISMATCH'],
  ['guard-only signature cannot be omitted',r=>document(r,'dependencies').dependencies.commands[0].declaredSignature.shift(),'PRODUCT_PAYLOAD_MISMATCH'],
  ['fold RHS/source cannot be silently swapped',r=>document(r,'folds').folds.events[0].assignments[0].update.value.op='subtract','PRODUCT_PAYLOAD_MISMATCH'],
]) test(name,()=>{const r=request(); mutate(r); const c=compileProductSet(r);assert.equal(c.result,null);assert.equal(c.diagnostics[0].code,code);});
test('event/replay overflow rejects entire result without mutating inputs',()=>{
  const set=compiled(),layout=payload(set,'reference-layout'),exact=payload(set,'exact-value-types'),c=payload(set,'domain-dependencies').commands[0];
  const values=inputs(c.declaredSignature.map(s=>[s.ref,{label:'g',delta:'999.99',steps:'-9223372036854775808'}[s.ref.id]]));
  for(const s of c.events[0].slots)assert.throws(()=>evaluateValue(s.producer,c.command,values,layout,[],exact));
  const f=payload(set,'domain-folds'),e=f.events[0],before=inputs([...f.defaults.map(d=>[d.target,{level:'999.99',previous:'0.00',count:'0'}[d.target.id]]),[c.events[0].slots[0].slot,'0.35'],[c.events[0].slots[1].slot,'2']]);
  assert.throws(()=>evaluateFolds(e,before,layout,exact));assert.equal([...before][0][1],'999.99');
});
test('recursive arithmetic is bounded and old v1 authored arithmetic remains rejected',()=>{
  const set=compiled(),layout=payload(set,'reference-layout'),exact=payload(set,'exact-value-types'),c=payload(set,'domain-dependencies').commands[0],type=c.events[0].slots[0].valueType;
  assert.throws(()=>parseValue({form:'add',left:'param.delta',right:'literal:0.10'},type,c.command,layout,[],exact,undefined));
  const r=request();let e='param.delta';for(let i=0;i<70;i++)e={form:'add',left:e,right:'literal:0.10'};
  document(r,'domain').aggregates[0].events[0].bindings[0].expr=e;
  const result=compileProductSet(r);assert.equal(result.result,null);assert.equal(result.diagnostics[0].code,'VALUE_DEPTH');
});
test('v2 arithmetic rejects mixed nominal types, units and primitive decimal without conversion', () => {
  const set=compiled(),layout=payload(set,'reference-layout'),exact=payload(set,'exact-value-types'),c=payload(set,'domain-dependencies').commands[0];
  const nominal=c.events[0].slots[0].valueType, ref=id=>({context:'measurement',kind:'parameter',owner:['Gauge','Adjust'],id});
  const other={...exact[0],domain:{...exact[0].domain,id:'OtherRatio'}};
  const otherRef=ref('other');
  const otherLayout={...layout,declarations:[...layout.declarations,{ref:otherRef,valueType:{form:'nominal',ref:other.domain}}]};
  assert.throws(()=>evaluateValue({op:'add',left:{op:'ref',ref:c.declaredSignature[1].ref},right:{op:'ref',ref:otherRef}},c.command,new Map(),otherLayout,[],[...exact,other]));
  const distance={...exact[0],domain:{...exact[0].domain,id:'Distance'},form:'unit-decimal',amountMember:{context:'measurement',kind:'member',owner:['Distance'],id:'amount'},unitMember:{context:'measurement',kind:'member',owner:['Distance'],id:'unit'},units:['km','mi']};
  const type={form:'nominal',ref:distance.domain},literal=value=>({op:'literal',valueType:type,value});
  const left={amount:'1.00',unit:'km'},right={amount:'0.25',unit:'km'};
  assert.deepEqual(evaluateValue({op:'subtract',left:literal(left),right:literal(right)},c.command,new Map(),layout,[],[distance]),{amount:'0.75',unit:'km'});
  assert.throws(()=>evaluateValue({op:'add',left:literal(left),right:literal({...right,unit:'mi'})},c.command,new Map(),layout,[],[distance]));
  assert.throws(()=>evaluateValue({op:'add',left:{op:'literal',valueType:{form:'primitive',name:'decimal'},value:'1.00'},right:{op:'literal',valueType:nominal,value:'0.10'}},c.command,new Map(),layout,[],exact));
});
test('typed replay cannot substitute a different nominal type with the same JSON carrier', () => {
  const set=compiled(),layout=payload(set,'reference-layout'),exact=payload(set,'exact-value-types'),fold=payload(set,'domain-folds').events[0];
  const other={...exact[0],domain:{...exact[0].domain,id:'OtherRatio'}};
  const altered={...fold,assignments:[{...fold.assignments[0],update:{op:'set',value:{op:'literal',valueType:{form:'nominal',ref:other.domain},value:'0.10'}}}]};
  assert.throws(()=>evaluateFolds(altered,new Map(),layout,[...exact,other]),e=>e.diagnostic.code==='FOLD_TYPE');
});
test('compiled v2 output is detached and complete from caller-owned inputs', () => {
  const r=request(),set=compileProductSet(r).result;
  document(r,'domain').aggregates[0].events[0].bindings[0].expr.right='literal:9.99';
  document(r,'dependencies').dependencies.commands[0].usedDependencies=[];
  assert.equal(payload(set,'domain-dependencies').commands[0].events[0].slots[0].producer.right.value,'0.10');
  assert.equal(payload(set,'domain-dependencies').commands[0].usedDependencies.length,3);
});
test('v2 compiler initializes and executes arithmetic with effects denied', () => {
  const modules=new Map();
  function bundle(url) {
    if(modules.has(url.href))return modules.get(url.href);
    const text=readFileSync(url,'utf8').replace(/from '(\.[^']+)'/gu,(_,relative)=>`from ${JSON.stringify(bundle(new URL(relative,url)))}`);
    const result=`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;modules.set(url.href,result);return result;
  }
  const compiler=bundle(new URL('../lib/products/compile.mjs',import.meta.url));
  const script=`
    const fs=(await import('node:fs')).default,child=(await import('node:child_process')).default;
    const {syncBuiltinESMExports}=await import('node:module');const deny=()=>{throw Error('forbidden effect');};
    for(const k of ['readFileSync','readdirSync','existsSync','writeFileSync','mkdirSync','rmSync','statSync','lstatSync','openSync'])fs[k]=deny;
    for(const k of ['readFile','writeFile','readdir','stat','open','access'])fs.promises[k]=deny;
    for(const k of ['execFileSync','execSync','spawn','spawnSync','exec','fork'])child[k]=deny;
    syncBuiltinESMExports();const finish=process.exit.bind(process);
    globalThis.process=new Proxy({},{get:deny});globalThis.Date=new Proxy(class {},{get:deny,construct:deny});globalThis.fetch=deny;globalThis.setTimeout=deny;Math.random=deny;
    const {compileProductSet}=await import(${JSON.stringify(compiler)});const input=${JSON.stringify(request())};
    if(!compileProductSet(input).result)throw Error('pure v2 compilation failed');
    input.documents[0].value.aggregates[0].events[0].bindings[0].expr.form='eval';
    if(compileProductSet(input).result!==null)throw Error('illegal expression accepted');finish(0);
  `;
  execFileSync(process.execPath,['--input-type=module'],{input:script,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});
});
