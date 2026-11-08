// Explicit bounded development lane, NOT full family4/reference qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dirname,join,resolve,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {privateOutput,files,snapshot,hash,compilerSession} from '../compiler-tools.mjs';
import {actorToolchain} from '../aggregate-core/toolchain.mjs';
import {acquireFileLease} from '../../../lib/verification/lease.mjs';
import {inspectProcessEvidence} from '../../../lib/verification/process.mjs';
if (!process.env.NODE_TEST_CONTEXT) {
assert(!process.env.NODE_TEST_CONTEXT,'Explicit bounded owner invocation required');
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../..');
const [round,out,runId]=process.argv.slice(2);
assert(round&&out&&/^[a-z0-9-]+$/.test(runId),'round out unique-run-id required');
const baseline=JSON.parse(fs.readFileSync(join(round,'offline-supply02.json')));
const jdkHome=dirname(dirname(baseline.java.path));
const supplies=baseline.finiteSupplyFiles.filter(x=>x.path.startsWith(jdkHome+'/')||x.path.startsWith(baseline.cache+'/')||x.path==='/usr/bin/sandbox-exec');
for(const p of supplies) assert.equal(hash(p.path),p.sha256,'Supply drift '+p.path);
const protoc=supplies.find(x=>x.path.endsWith('/protoc-3.21.9-osx-x86_64.exe')).path;
const tools=actorToolchain(baseline.java.path,baseline.cache,protoc);
for(const p of tools.paths) assert(supplies.some(x=>x.path===p),'Unpinned tool dependency '+p);
const originals=join(repo,'test/reference/aggregate-core');
const protectedRows=JSON.parse(fs.readFileSync(join(round,'baseline-files02.json'))).records.filter(x=>x.path.startsWith(originals+'/project/')||x.path.startsWith(originals+'/oracle/')||x.path===originals+'/oracle.lock.json');
for(const row of protectedRows) assert.equal(hash(row.path),row.sha256,'Original reference drift '+row.path);
const originalFiles=[...files(join(originals,'project')),...files(join(originals,'oracle')),join(originals,'oracle.lock.json')];
for(const p of originalFiles) assert(protectedRows.some(x=>x.path===p),'Original file absent from accepted baseline '+p);
const pinned=snapshot([...new Set([...tools.paths,...originalFiles,...files(here),join(repo,'test/reference/compiler-tools.mjs'),join(repo,'test/reference/aggregate-core/toolchain.mjs'),join(repo,'lib/verification/process.mjs'),join(repo,'lib/verification/lease.mjs')])]);
const capacity=fs.statfsSync('/private/tmp');assert(capacity.bavail*capacity.bsize>=30*1024**3,'Capacity insufficient; preserve history');
const raw=privateOutput(out,[repo,baseline.cache,jdkHome]);
raw.json('capacity.json',{availableBytes:capacity.bavail*capacity.bsize,retainedBudgetGiB:20,reserveGiB:10});
raw.json('inputs-before.json',pinned);
raw.write('safe-process-before.txt',execFileSync('/bin/ps',['-axo','pid=,ppid=,pgid=,comm='],{encoding:'utf8'}));
// Strengthen the standard compiler profile without changing the shared mechanism.
const io={...raw,write(name,bytes,mode) {if(name==='sandbox.sb') bytes+=`(deny file-write* (subpath ${JSON.stringify(join(out,'logs'))}) (literal ${JSON.stringify(join(out,'sandbox.sb'))}))\n`;return raw.write(name,bytes,mode);}};
const lease=await acquireFileLease({registry:join(repo,'.rounds/shared-jvm-leases'),lockNames:['jvm-slot'],usedName:runId+'-used',record:{owner:'persistence-readside-reference',pid:process.pid,runId,out,token:randomUUID()}});
let result;
try {
  io.json('lease-acquired.json',lease.record);
  const session=compilerSession(io,tools);
  const originalKernel=files(join(originals,'project/modules/kernel/src/main/scala'));
  const originalConverter=join(originals,'project/modules/glue/src/main/scala/example/inventory/infrastructure/serialization/DomainConverters.scala');
  const kernel=io.directory('classes/kernel'),pb=io.directory('classes/pb'),hand=io.directory('classes/hand'),oracle=io.directory('classes/oracle');
  const protoRoot=io.directory('proto'),managed=io.directory('managed');
  io.write('proto/inventory_domain.proto',fs.readFileSync(join(originals,'project/modules/glue/src/main/protobuf/inventory_domain.proto')));
  io.write('proto/warehouse_persistence_frame.proto',fs.readFileSync(join(here,'protobuf/warehouse_persistence_frame.proto')));
  await session.generate('independent-proto',protoRoot,[join(protoRoot,'inventory_domain.proto'),join(protoRoot,'warehouse_persistence_frame.proto')],managed);
  await session.compile('original-kernel',originalKernel,[tools.library],kernel);
  await session.compile('protobuf',files(managed).filter(x=>x.endsWith('.scala')),tools.runtime,pb);
  const productionCp=[...tools.runtime,kernel,pb];
  await session.compile('hand-envelope-and-original-converter',[originalConverter,...files(join(here,'scala'))],productionCp,hand);
  const oracleFiles=files(join(here,'oracle'));
  await session.compile('independent-oracle',oracleFiles,[...productionCp,hand,...tools.testLibraries],oracle);
  const suite='example.inventory.persistencereadside.reference.StageAReferenceSpec';
  const testNames=[
    'envelope captures caller bytes before async work and never exposes the retained array',
    'envelope rejects malformed strings invalid sequence and payload bounds synchronously',
    'original reserve fold is identity and commit writes only the existing receipt rule',
    'original domain protobuf bytes preserve both events and a genuinely nonempty state',
    'independent technical proto has the six fixed fields without certifying a wire registry',
  ];
  await session.jvm('stage-a-oracle',['-cp',[...productionCp,hand,...tools.testLibraries,oracle].join(delimiter),'org.scalatest.tools.Runner','-R',oracle,'-oW','-s',suite],{kind:'suites',suites:[suite],tests:5,testNames});
  assert.deepEqual(snapshot(pinned.map(x=>x.path)),pinned,'Inputs changed during own development lane');
  const evidence=session.runs.map(r=>inspectProcessEvidence(r.lifecycle.slice(0,-5)).references);
  result={passed:true,scope:'partial independent reference: envelope/value ABI + original Warehouse rules/domain PB + independent technical frame shape only',tests:5,suites:[suite],runs:session.runs,evidence,originalReferenceUnchanged:true,inputs:join(out,'inputs-before.json'),notQualified:['wire registry/layout pins','serializer and actor adapters','JDBC Repository/Handler/Runner','source/target replay','generated or installed candidate','full family4']};
} catch(error) {result={passed:false,error:{name:error.name,message:error.message},out};process.exitCode=1;}
finally {lease.release();io.json('lease-released.json',{runId,released:true});}
io.json('result.json',result);io.json('outputs.json',snapshot(files(out)));
fs.writeFileSync(join(round,runId+'-result.json'),JSON.stringify({...result,out},null,2)+'\n',{flag:'wx',mode:0o400});
console.log(JSON.stringify({passed:result.passed,tests:result.tests,out,result:join(round,runId+'-result.json')}));
}
