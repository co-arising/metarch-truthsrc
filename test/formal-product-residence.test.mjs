import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emitDoc } from '../lib/shared.mjs';
import { formalProductFile, formalIdentity } from '../lib/formal-products-pure.mjs';
import { compileTree } from '../lib/compile.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { createSnapshot, compileSnapshot } from '../lib/compile-snapshot.mjs';
const domain=JSON.parse(readFileSync(new URL('./fixtures/inventory-host-products/domain.json',import.meta.url)));
const write=(root,path,doc)=>{mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),emitDoc(doc));};
function tree() {
 const root=mkdtempSync(join(tmpdir(),'owned-formal-residence-'));
 decomposeCanonical(JSON.stringify({schemaVersion:'truthsrc/v1',workshop:'formal-residence',sessions:['eventStorming','commandStorming','aggregateDiscovery','subdomainExploration','contextMapping','refining','storyMapping'].map(session=>({session,scopes:[]})),aggregates:[],valueObjects:[],readModels:[],stories:[],domainServices:[]}),root);
 return root;
}
test('all five formally declared roots roundtrip whole payloads, authored headers and selection unchanged',()=>{
 const root=tree(),families={'artifact-contract':'artifactContracts','technical-port':'ports','saga-host':'sagaHosts','host-computation':'hostComputations','external-event-producer':'externalEventProducers'};
 for(const [family,key]of Object.entries(families)) {
  const payload=structuredClone(domain[key][0]);if(!payload)continue;
  const id=formalIdentity(family,payload),file=formalProductFile(family,id);
  write(root,file,{scalars:[['kind','formal-product'],['schemaVersion','truthsrc.formal-product/v1'],['family',family],['id',id],['version',payload.version],['author','independent-contract-author']],blocks:{payload}});
 }
 const canonical=JSON.parse(compileTree(root));
 for(const [family,key]of Object.entries(families))if(domain[key].length)assert.deepEqual(canonical[key][0],domain[key][0]);
 assert.equal(canonical.artifactContracts[0].status,'selected');
 assert.ok(Object.values(canonical.formalProductSurface).every(h=>h.author==='independent-contract-author'));
 assert.deepEqual(validateTree(root).hard,[]);
 assert.deepEqual(roundtrip(root),{ok:true,atoms:6});
});
test('tree-carried formal artifact and port rows enter the real complete semantic compiler',()=>{
 const root=tree(),port={name:'ReadInventory',version:'port-v1',inputType:{form:'primitive',name:'string'},outputType:{form:'primitive',name:'boolean'}};
 const artifactRef={context:'inventory',kind:'artifact',owner:[],id:'InventoryRead'},portRef={context:'inventory',kind:'port',owner:[],id:port.name};
 const artifact={id:'inventory-read',version:'artifact-v1',artifact:artifactRef,status:'proposal',provenance:[{document:'domain',pointer:'/artifactContracts/0'}],references:[portRef],ports:[{ref:portRef,version:port.version,inputType:port.inputType,outputType:port.outputType,required:true}],deployment:{id:'inventory-read-deployment',version:'v1',secretRefs:[]},implementations:[{port:portRef,id:'inventory-reader',version:'v1'}]};
 for(const [family,payload]of [['technical-port',port],['artifact-contract',artifact]]){
  const id=formalIdentity(family,payload);write(root,formalProductFile(family,id),{scalars:[['kind','formal-product'],['schemaVersion','truthsrc.formal-product/v1'],['family',family],['id',id],['version',payload.version],['author','independent-author']],blocks:{payload}});
 }
 assert.equal(roundtrip(root).ok,true);
 const canonical=JSON.parse(compileTree(root));
 const layout={contexts:['inventory'],declarations:[{ref:artifactRef,valueType:null,source:{document:'domain',pointer:'/artifactContracts/0'},dependencies:[]},{ref:portRef,valueType:null,source:{document:'domain',pointer:'/ports/0'},dependencies:[]}]};
 const request={schemaVersion:'truthsrc.product-compilation/v1',assemblies:[],options:{},documents:[{id:'domain',schemaVersion:'truthsrc/v1',value:canonical},{id:'references',schemaVersion:'truthsrc.reference-binding/v1',value:{schemaVersion:'truthsrc.reference-binding/v1',layout}},{id:'artifacts',schemaVersion:'truthsrc.artifact-binding/v2',value:{schemaVersion:'truthsrc.artifact-binding/v2',artifacts:{artifacts:[{...artifact,source:{document:'domain',pointer:'/artifactContracts/0'}}]}}}],requirements:[{id:'reference-layout',version:'1',payloadSchemaVersion:'truthsrc.reference-layout/v1',capabilities:[{id:'qualified-reference-layout',version:'1'}],inputRoles:{canonical:'domain',referenceBinding:'references'},requires:[]},{id:'artifact-contract',version:'2',payloadSchemaVersion:'truthsrc.artifact-contract/v2',capabilities:[{id:'artifact-static-contract',version:'2'}],inputRoles:{canonical:'domain',artifactBinding:'artifacts'},requires:[{id:'reference-layout',version:'1'}]}]};
 const result=compileProductSet(request);assert.deepEqual(result.diagnostics,[]);
 assert.equal(result.result.products.find(p=>p.id==='artifact-contract').payload.artifacts[0].status,'proposal');
});
test('historical notes never implicitly lift into formal roots or acquire selection',()=>{
 const root=tree();write(root,'inbox/refining/question-rf-contract-0.yaml',{scalars:[['kind','note'],['type','question'],['name','Contract']],nested:{origin:{stage:'refining',board:'board1',seq:0}},blocks:{payload:{type:'question',name:'Contract',info:{artifact:{id:'proposal',authoredStatus:'demo-proposal'}}}}});
 const result=JSON.parse(compileTree(root));assert.ok(!Object.hasOwn(result,'artifactContracts'));assert.equal(result.sessions.find(s=>s.session==='refining').scopes[0].notes[0].info.artifact.authoredStatus,'demo-proposal');
});
test('formal headers cannot silently select a different whole payload',()=>{
 const root=tree(),payload=structuredClone(domain.artifactContracts[0]),file=formalProductFile('artifact-contract',payload.id);
 write(root,file,{scalars:[['kind','formal-product'],['schemaVersion','truthsrc.formal-product/v1'],['family','artifact-contract'],['id','different'],['version',payload.version]],blocks:{payload}});
 assert.throws(()=>compileTree(root),/identity\/version|filename/);assert.ok(validateTree(root).hard.some(x=>x.startsWith('[FP1]')));
});
test('pure snapshot rejects formal product outside declared residence and unknown family',()=>{
 const doc={kind:'formal-product',schemaVersion:'truthsrc.formal-product/v1',family:'artifact-contract',id:'example',version:'v1',payload:{id:'example',version:'v1'}};
 const metadata={inboxDirs:[],aggregateDirs:[]};
 assert.throws(()=>createSnapshot([{file:'formal-products/unknown/example.formal.yaml',doc}],metadata),/outside captured/);
 assert.throws(()=>createSnapshot([{file:'formal-products/artifact-contract/example.formal.yaml',doc:{...doc,family:'unknown'}}],metadata),/family/);
});
