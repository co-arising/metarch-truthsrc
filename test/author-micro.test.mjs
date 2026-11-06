import test from 'node:test';
import assert from 'node:assert/strict';
import { compactMicro, parseMicro } from '../lib/author-micro-codec.mjs';
import { transformMicroDocument, expandMicroDocuments } from '../lib/author-micro.mjs';
import { compileAuthorEntries, restoreAuthorEntries, emitAuthorDoc } from '../lib/author-surface.mjs';
import { compactMicroAuthorEntries } from '../lib/author-micro-migrate.mjs';
import { buildSourceIndex, resolveSourcePointer, validateSourceIndex } from '../lib/source-index.mjs';

const ref = {context:'bank:wealth',kind:'command',owner:['Credit/Balance'],id:'Reserve#Funds'};
const cases = [
  ['ref',ref], ['pin',{ref,version:'v1@preview'}],
  ['type',{form:'map',key:{form:'primitive',name:'string'},value:{form:'optional',element:{form:'nominal',ref}}}],
  ['type',{form:'record',members:[ref]}],
  ['origin-field',{name:'source-id',dataType:'List[Money]',origin:'BUSINESS_INPUT'}],
  ['field',{name:'中文',dataType:'Map[TxId, Money]'}], ['slot',{slot:'source-id',type:'TxId'}],
  ['state-field',{name:'memo',dataType:'String',default:'hello, world'}],
  ['rule',{ruleId:'limit/one',errCode:'different/code',desc:'a | b, "quoted"\n说明'}],
  ['guard',{kind:'invariantRef',ref:'RULE-ONE',errCode:'ERR/ONE',cond:'a("x, y") && b > 0.00',onFail:'reject'}],
  ['guard',{ruleId:'ALREADY',errCode:'ALREADY',onFail:'succeed-empty',when:{form:'map-absent',map:'prepared',key:'param.txid'}}],
  ['binding',{slot:'memo',expr:'literal:status : String'}],
  ['binding',{slot:'value',expr:{form:'host',id:ref,version:'01@x'}}],
  ['typed-binding',{slot:'value',ref:'args:value',type:'List[Money]'}],
  ['fold',{slot:'memo',op:'set',value:'literal:hello, world'}],
  ['fold',{slot:'memo',expr:'literal:@fold[set](value=x)'}],
  ['fold',{slot:'counter',op:'integer-apply',delta:'event.value',sign:1}],
];
for (const [kind,value] of cases) test('micro codec preserves '+kind+' '+JSON.stringify(value),()=>{
  const text=compactMicro(value,kind);assert.equal(typeof text,'string');assert.equal(JSON.stringify(parseMicro(text,kind)),JSON.stringify(value));
});

test('unsafe micro declarations reject rather than normalize or discard fields',()=>{
  for(const [text,kind] of [
    ['x := @fold[set](value=first, value=second)','fold'],
    ['x := @fold[set](value=first, typo=second)','fold'],
    ['x := @fold[put](value=first)','fold'],
    ['x := @fold[integer-apply](delta=x, sign=0)','fold'],
    ['x := @fold[set](value=literal:hello, world)','fold'],
    ['@ref(ctx:unknown#id)','ref'], ['@ref(ctx:type#bad%GG)','ref'],
    ['@pin(ctx:type#id)','pin'], ['@type(record())','type'],
    ['x: String = {"a":1,"a":2}','state-field'], ['x: Long = 9007199254740993','state-field'],
    ['@type(map(primitive:string))','type'], ['@guard[when](reject R/R: money-positive(amount=x, extra=y))','guard'],
  ])assert.throws(()=>parseMicro(text,kind),/AUTHOR_MICRO/);
  assert.equal(compactMicro({slot:'x',op:'set',value:'x',extra:true},'fold'),null);
  assert.equal(compactMicro({slot:'x',type:'String',ref:'args:x'},'typed-binding'),null);
});

test('descriptions, arbitrary notes, defaults and explicit schema branches stay opaque',()=>{
  const note={kind:'note',payload:{description:'@ref(ctx:aggregate#A)',default:'@type(primitive:string)',parameters:['not an authored signature']}};
  assert.deepEqual(transformMicroDocument(note).doc,note);
  const formal={kind:'formal-product',family:'artifact-contract',payload:{id:'x',description:'@ref(ctx:aggregate#A)',extension:{ref:'@ref(ctx:aggregate#A)'},artifact:'@ref(ctx:artifact#A)'}};
  const expanded=transformMicroDocument(formal).doc;
  assert.equal(expanded.payload.description,formal.payload.description);assert.deepEqual(expanded.payload.extension,formal.payload.extension);
  assert.deepEqual(expanded.payload.artifact,{context:'ctx',kind:'artifact',owner:[],id:'A'});
  const host={kind:'formal-product',family:'saga-host',payload:{entry:{startOwner:{kind:'pipeline',ref:'@ref(ctx:pipeline#Run)',stepId:'step'}}}};
  assert.equal(transformMicroDocument(host).doc.payload.entry.startOwner.ref.id,'Run');
});

function fixture(){return [
  ['system.yaml',{kind:'system',schemaVersion:'truthsrc.author/v1',id:'example',name:'Example',workshop:'example',sessionOrder:['refining'],contexts:['example']}],
  ['contexts/example/context.yaml',{kind:'context',schemaVersion:'truthsrc.context/v1',id:'example',name:'Example',responsibility:'Own the counter.'}],
  ['contexts/example/aggregates/counter/aggregate.yaml',{kind:'aggregate',name:'Counter',context:'example',order:{commands:['Set'],events:['SetConfirmed']},payload:{name:'Counter',entity:'Counter',identifier:{name:'id',dataType:'String',origin:'BUSINESS_INPUT'},stateFields:[{name:'memo',dataType:'String',default:'@type(primitive:string)'}]}}],
  ['contexts/example/aggregates/counter/slices/set.slice.yaml',{kind:'slice',aggregate:'Counter',command:'Set',payload:{name:'Set',description:'@ref(example:aggregate#Counter)',parameters:[{name:'memo',dataType:'String',origin:'BUSINESS_INPUT'}],guards:[],produces:['SetConfirmed']},events:{SetConfirmed:{name:'SetConfirmed',payloads:[{name:'memo',dataType:'String',origin:'PROPAGATED'}],bindings:[{slot:'memo',expr:'param.memo'}],foldAssignments:[{slot:'memo',op:'set',value:'event.memo'}]}}}],
].map(([file,doc])=>({file,content:emitAuthorDoc(doc)})).sort((a,b)=>a.file.localeCompare(b.file));}

test('author micro migration uses original text, independent semantics and source-aware scalar pointers',()=>{
  const files=fixture(),before=compileAuthorEntries(files),plan=compactMicroAuthorEntries(files),after=compileAuthorEntries(plan.files);
  const semantic=c=>{const{authoring,...v}=c;return JSON.stringify(v);};
  assert.equal(semantic(before.canonical),semantic(after.canonical));assert.deepEqual(restoreAuthorEntries(after.canonical),plan.files);
  assert.equal(after.canonical.aggregates[0].stateFields[0].default,'@type(primitive:string)');
  const index=buildSourceIndex(after.snapshot,after.canonical,{system:'example',context:'example',physicalFiles:after.physicalFiles,representationMappings:after.representationMappings});
  validateSourceIndex(index);
  const field=resolveSourcePointer(index,'/aggregates/0/events/0/foldAssignments/0/value')[0];
  assert.equal(field.atomPointer,'/events/SetConfirmed/foldAssignments/0');assert.equal(field.locationMapping.mode,'declaration');
  const altered=structuredClone(after.canonical);altered.aggregates[0].events[0].foldAssignments[0].value='literal:bad';
  assert.throws(()=>restoreAuthorEntries(altered),/disagrees/);
  assert.deepEqual(compactMicroAuthorEntries(plan.files).files,plan.files);
});

test('micro representation composes with a structure row source without fictional scalar children',()=>{
  const file='contexts/example/aggregates/counter/slices/set.slice.yaml';
  const documents=[{file,doc:{kind:'slice',payload:{parameters:['memo: String @BUSINESS_INPUT']}}}];
  const mappings=[{file,pointer:'',authorFile:'contexts/example/structures/protocol.structure.yaml',authorPointer:'/payload/atoms/0/$rows/rows/0',mode:'declaration',label:'row'},
    {file,pointer:'/payload/parameters',authorFile:'contexts/example/structures/protocol.structure.yaml',authorPointer:'/payload/constants/parameters',mode:'subtree',label:'parameters'}];
  const result=expandMicroDocuments(documents,{enabled:true,representationMappings:mappings});
  assert.equal(result.documents[0].doc.payload.parameters[0].name,'memo');
  const mapping=result.mappings.find(m=>m.pointer==='/payload/parameters/0');
  assert.equal(mapping.authorPointer,'/payload/constants/parameters/0');assert.equal(mapping.mode,'declaration');
});

test('raw duplicate keys are rejected before micro source rewriting',()=>{
  const entries=fixture(),source=entries.find(e=>e.file.endsWith('set.slice.yaml'));
  source.content=source.content.replace('"name": "Set",','"name": "Set",\n    "name": "Set",');
  assert.throws(()=>compactMicroAuthorEntries(entries),/duplicate JSON key/);
});
