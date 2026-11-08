// Sole-owner opt-in targeted checkpoint; no default discovery or JVM launch.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {privateOutput,files,snapshot,hash} from '../compiler-tools.mjs';
import {runVerifiedProcess} from '../../../lib/verification/process.mjs';
import {acquireFileLease} from '../../../lib/verification/lease.mjs';
if (!process.env.NODE_TEST_CONTEXT) {
assert(!process.env.NODE_TEST_CONTEXT);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const [round,out,id,...tests]=process.argv.slice(2);
const io=privateOutput(out,[root]);io.directory('logs');io.directory('tmp');
// Capture the stable product and legacy renderer inputs, not unrelated new renderer work.
const inputs=[...files(root+'/lib'),...files(root+'/schema'),...files(root+'/generators/scala-cqrs-play-service'),...files(root+'/scaffold/aggregate-core-project'),...tests.map(p=>join(root,p)),...['aggregate-core-fixture.mjs','journal-readside-fixture.mjs','persistence-readside-fixture.mjs'].map(p=>join(root,'test',p)).filter(fs.existsSync),fs.realpathSync(process.execPath),fileURLToPath(import.meta.url)];
const pins=snapshot(inputs);io.json('inputs-before.json',pins);
const profile=io.write('sandbox.sb',`(version 1)\n(allow default)\n(deny network*)\n(deny file-write* (subpath ${JSON.stringify(root)}))\n(deny file-write* (subpath ${JSON.stringify(out+'/logs')}) (literal ${JSON.stringify(out+'/sandbox.sb')}))\n`);
let lease,result;
try {
 lease=await acquireFileLease({registry:root+'/.rounds/shared-jvm-leases',lockNames:['jvm-slot'],usedName:id+'-used',record:{owner:'persistence-readside-reference',pid:process.pid,runId:id,out}});
 const receipt=await runVerifiedProcess({executable:fs.realpathSync(process.execPath),args:['--test','--test-concurrency=1',...tests],cwd:root,env:{HOME:process.env.HOME,PATH:'/usr/bin:/bin',TMPDIR:out+'/tmp'},base:out+'/logs/tests',timeoutMs:120000,sandbox:{executable:'/usr/bin/sandbox-exec',profile,profileSha256:hash(profile)}});
 const schemas=new Map(fs.readdirSync(root+'/schema').filter(p=>p.endsWith('.schema.json')).map(p=>{const v=JSON.parse(fs.readFileSync(root+'/schema/'+p));return[v.$id,v]})); const refs=[];
 for(const name of ['persistence-readside-binding-v1.schema.json','persistence-readside-contract-v1.schema.json']) {
  const schema=JSON.parse(fs.readFileSync(root+'/schema/'+name));
  const visit=v=>{if(!v||typeof v!=='object')return;if(v.$ref){const [uri,ptr]=v.$ref.split('#');const doc=uri?schemas.get(uri):schema;assert(doc,v.$ref);const target=(ptr||'').split('/').slice(1).reduce((o,k)=>o?.[k.replaceAll('~1','/').replaceAll('~0','~')],doc);assert(target!==undefined,v.$ref);refs.push({schema:name,ref:v.$ref});}Object.values(v).forEach(visit)};visit(schema);
 }
 io.json('schema-reference-resolution.json',{passed:true,refs,scope:'Parse/reference traversal from existing journal product test, not full schema validation'});
 const after=snapshot(inputs),changes=after.filter((v,i)=>v.sha256!==pins[i].sha256);io.json('inputs-after.json',after);
 const log=fs.readFileSync(out+'/logs/tests.stdout.log','utf8');result={passed:receipt.passed&&changes.length===0,receipt,changes,schemaRefs:refs.length,tapSummary:log.split('\n').filter(l=>/^# (tests|pass|fail|cancelled|skipped|duration_ms)/.test(l))};
} catch(e){result={passed:false,error:e.stack};}finally{lease?.release();}
io.json('result.json',result);fs.writeFileSync(join(round,id+'-result.json'),JSON.stringify({...result,out},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
}
