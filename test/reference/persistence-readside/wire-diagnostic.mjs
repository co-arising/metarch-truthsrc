// Explicit diagnostic over REAL author products. The expected PB graph is read from original HAND proto, not generated text.
import fs from 'node:fs';import assert from 'node:assert/strict';import {dirname,resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {aggregateCoreFixture} from '../../aggregate-core-fixture.mjs';
import {buildModels} from '../../../generators/scala-cqrs-aggregate-core-v1/build-models.mjs';
import {persistenceWireLayout} from '../../../generators/scala-cqrs-persistence-readside-v1/wire-layout.mjs';
import {files,snapshot,hash} from '../compiler-tools.mjs';
if (!process.env.NODE_TEST_CONTEXT) {
assert(!process.env.NODE_TEST_CONTEXT);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),round=process.argv[2];
const original=root+'/test/reference/aggregate-core/project/modules/glue/src/main';
const proto=original+'/protobuf/inventory_domain.proto',converter=original+'/scala/example/inventory/infrastructure/serialization/DomainConverters.scala';
const baseline=JSON.parse(fs.readFileSync(round+'/baseline-files02.json')).records;
for(const p of [proto,converter])assert.equal(hash(p),baseline.find(r=>r.path===p).sha256);
const inputPaths=[...files(root+'/scaffold/aggregate-core-project'),...files(root+'/lib'),...files(root+'/generators/scala-cqrs-domain-kernel-v1').filter(p=>!p.includes('/templates/')),...['build-models.mjs','expression-model.mjs'].map(p=>root+'/generators/scala-cqrs-aggregate-core-v1/'+p),root+'/generators/scala-cqrs-persistence-readside-v1/wire-layout.mjs',root+'/test/aggregate-core-fixture.mjs',proto,converter,fileURLToPath(import.meta.url)];
const inputs=snapshot(inputPaths),f=aggregateCoreFixture(),serialization=buildModels({products:f.products,options:f.config.options}).serialization;
const text=fs.readFileSync(proto,'utf8'),pkg=text.match(/package\s+([\w.]+);/)[1],messages=new Map();
for(const m of text.matchAll(/message\s+(\w+)\s*\{([^}]+)\}/g)){
 const fields=[...m[2].matchAll(/\b(?:(repeated)\s+)?(\w+)\s+(\w+)\s*=\s*(\d+)\s*;/g)].map(x=>({name:x[3],number:+x[4],repeated:!!x[1],type:x[2]}));assert(fields.length);messages.set(pkg+'.'+m[1],fields);
}
const layouts=serialization.roots.filter(r=>['event','state'].includes(r.role)).map(r=>persistenceWireLayout(serialization,r.ref,r.role));
const graphChecks=[];
for(const layout of layouts)for(const n of layout.descriptor.nodes){
 const expected=messages.get(n.id);assert(expected,'original message missing '+n.id);
 const actual=n.fields.map(f=>({name:f.name,number:f.number,repeated:f.repeated,type:f.nodeId?f.nodeId.slice(pkg.length+1):f.wireType}));assert.deepEqual(actual,expected,n.id);
 // Proto3 singular message presence is Option; original converter requires all these messages.
 for(const field of n.fields){assert.equal(field.required,!!field.nodeId&&!field.repeated,n.id+'.'+field.name);if(field.required)assert(fs.readFileSync(converter,'utf8').includes('"'+n.id.slice(pkg.length+1)+'.'+field.name+'"'));}
 graphChecks.push({root:layout.descriptor.root,node:n.id,fields:actual,matchedOriginal:true});
}
assert.equal(layouts.length,3);assert.deepEqual(snapshot(inputPaths),inputs,'inputs changed during diagnostic');
const result={schemaVersion:'truthsrc.reference-wire-diagnostic/v1',passed:true,inputs,projectFile:f.projectFile,options:f.config.options,products:f.products,serialization,layouts,graphChecks,presenceEvidence:'Original proto3 singular messages and unchanged DomainConverters required(...) checks; original map present=true/require(value.present), repeated entries retained. No hash self-equality oracle.',originalProto:proto,originalConverter:converter};
fs.writeFileSync(join(round,'wire-layout-diagnostic.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o400});
console.log(JSON.stringify(layouts.map(l=>({root:l.descriptor.root,sha256:l.sha256})),null,2));
}
