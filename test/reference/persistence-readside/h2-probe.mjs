// Explicit opt-in only. Reuses the admitted round supply and public process/lease.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { privateOutput, snapshot, hash, files } from '../compiler-tools.mjs';
import { acquireFileLease } from '../../../lib/verification/lease.mjs';
import { runVerifiedProcess, inspectProcessEvidence } from '../../../lib/verification/process.mjs';

if (!process.env.NODE_TEST_CONTEXT) {
assert(!process.env.NODE_TEST_CONTEXT, 'Explicit owner invocation required');
const here=dirname(fileURLToPath(import.meta.url));
const repo=join(here,'../../..');
const round=process.argv[2], out=process.argv[3], runId=process.argv[4];
assert(round && out && /^[a-z0-9-]+$/.test(runId), 'round out unique-run-id required');
const baseline=JSON.parse(fs.readFileSync(join(round,'offline-supply02.json')));
assert.equal(baseline.passed,true);
const jdkHome=dirname(dirname(baseline.java.path));
// The inherited supply list also contains old verifier/product inputs. Those are
// not dependencies of this JDBC probe; main owns and may edit products concurrently.
const inputs=[...baseline.finiteSupplyFiles.filter(row=>row.path.startsWith(jdkHome+'/') || row.path.startsWith(baseline.cache+'/') || row.path==='/usr/bin/sandbox-exec'),...baseline.mechanismSources,baseline.h2.jar,baseline.h2.pom];
const prior=process.argv[5];
let priorWrite=null;
if(prior) {
  assert(/^\/private\/tmp\/persistence-readside-stage-a-h2-[a-z0-9-]+$/.test(prior),'Only own stage-A probe continuation');
  priorWrite=inspectProcessEvidence(join(prior,'logs/write'));
  assert.equal(hash(join(prior,'H2TransactionProbe.java')),hash(join(here,'H2TransactionProbe.java')),'Probe body changed');
  assert.equal(fs.readFileSync(priorWrite.receipt.paths.stdout,'utf8'),'PROVEN namespace-lock-second-connection-and-other-namespace-progress\nPROVEN blob-and-event-state-index-offset-atomic-commit\nPROVEN failure-after-index-write-before-commit-rolls-back-all-four\nPROVEN post-commit-exception-is-not-rollback-and-identical-retry-finds-commit\nPROVEN normal-close-file-retained\nH2_PROBE_WRITE_PASS\n');
}
for(const row of inputs) assert.equal(hash(row.path),row.sha256,'Supply drift: '+row.path);
assert(inputs.some(row=>row.path===join(jdkHome,'lib/modules')), 'Pin source-launch compiler module image');
const pinned=snapshot([...new Set([...inputs.map(x=>x.path),join(here,'H2TransactionProbe.java'),fileURLToPath(import.meta.url),join(repo,'lib/verification/lease.mjs')])]);
const stat=fs.statfsSync('/private/tmp');
const capacity={availableBytes:stat.bavail*stat.bsize,retainedOutputBudgetGiB:20,reserveGiB:10};
assert(capacity.availableBytes>=30*1024**3,'Insufficient capacity; do not clean retained history');
const io=privateOutput(out,[fs.realpathSync(repo),jdkHome,baseline.cache]);
io.json('capacity-before.json',capacity);
io.write('safe-process-before.txt',execFileSync('/bin/ps',['-axo','pid=,ppid=,pgid=,comm='],{encoding:'utf8'}));
io.json('inputs-before.json',pinned);
const source=io.write('H2TransactionProbe.java',fs.readFileSync(join(here,'H2TransactionProbe.java')));
const data=prior ? fs.realpathSync(join(prior,'data')) : io.directory('data'), home=io.directory('home'), tmp=io.directory('tmp');
io.json('continuation.json',{prior:prior??null,priorWriteReceipt:priorWrite?.receipt.paths.receipt??null,reason:prior?'Continue proven write without repeating it; initial collector erroneously pinned unrelated main-owned product source':'first write and reopen'});
const profile=io.write('sandbox.sb',`(version 1)\n(allow default)\n(deny network*)\n(deny file-write* (require-not (require-any (subpath ${JSON.stringify(out)}) (subpath ${JSON.stringify(data)}))))\n(deny file-write* (subpath ${JSON.stringify(join(out,'logs'))}) (literal ${JSON.stringify(join(out,'sandbox.sb'))}) (literal ${JSON.stringify(source)}))\n(allow file-write* (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom"))\n`);
io.directory('logs');
const lease=await acquireFileLease({registry:fs.realpathSync(join(repo,'.rounds/shared-jvm-leases')),lockNames:['jvm-slot'],usedName:runId+'-used',record:{owner:'persistence-readside-reference',runId,pid:process.pid,token:randomUUID(),out}});
let result;
try {
  io.json('lease-acquired.json',lease.record);
  const evidence=priorWrite?[{mode:'write',receipt:priorWrite.receipt.paths.receipt,references:priorWrite.references,retainedFromInitialAttempt:true}]:[];
  for(const mode of prior?['reopen']:['write','reopen']) {
    lease.assertHeld();
    const s=fs.statfsSync(out); assert(s.bavail*s.bsize>=30*1024**3,'capacity reserve');
    assert.deepEqual(snapshot(pinned.map(x=>x.path)),pinned,'Inputs changed before process');
    const base=join(out,'logs',mode);
    const receipt=await runVerifiedProcess({executable:baseline.java.path,args:['-Xmx512m','-XX:ActiveProcessorCount=2','-XX:-UsePerfData','-Dfile.encoding=UTF-8',`-Duser.home=${home}`,`-Djava.io.tmpdir=${tmp}`,`-XX:ErrorFile=${tmp}/hs_err_pid%p.log`,`-XX:HeapDumpPath=${tmp}`,'--class-path',baseline.h2.jar.path,source,mode,join(data,'native-h2')],cwd:out,env:{HOME:home,TMPDIR:tmp,TMP:tmp,TEMP:tmp,JAVA_HOME:jdkHome,PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8',LC_ALL:'en_US.UTF-8'},base,timeoutMs:120000,sandbox:{executable:'/usr/bin/sandbox-exec',profile,profileSha256:hash(profile)}});
    assert(receipt.passed && receipt.directChildReaped && !receipt.groupAliveAfter, 'Process failed: '+base);
    const inspected=inspectProcessEvidence(base);
    const stdout=fs.readFileSync(receipt.paths.stdout,'utf8');
    const expected=mode==='write'?['namespace-lock-second-connection-and-other-namespace-progress','blob-and-event-state-index-offset-atomic-commit','failure-after-index-write-before-commit-rolls-back-all-four','post-commit-exception-is-not-rollback-and-identical-retry-finds-commit','normal-close-file-retained']:['new-jvm-ifexists-reopen-exact-committed-facts','ifexists-missing-rejected-without-creation'];
    assert.deepEqual(stdout.trim().split('\n'),[...expected.map(x=>'PROVEN '+x),'H2_PROBE_'+mode.toUpperCase()+'_PASS'],'Exact probe assertions required');
    assert.equal(fs.readFileSync(receipt.paths.stderr,'utf8'),'');
    evidence.push({mode,assertions:expected,receipt:receipt.paths.receipt,references:inspected.references});
  }
  assert.deepEqual(snapshot(pinned.map(x=>x.path)),pinned,'Inputs changed during probe');
  result={passed:true,scope:'native H2 JDBC feasibility only; no family4/generated/Actor qualification',evidence,supplyManifest:join(out,'inputs-before.json'),capacity,limits:{heapMiB:512,cpus:2,processDeadlineMs:120000,network:'OS-denied'},db:join(data,'native-h2.mv.db'),dbSha256:hash(join(data,'native-h2.mv.db')),limitations:['Not arbitrary crash or power-loss recovery','Post-commit exception is deliberate observation failure after successful commit, not a simulated JDBC-driver commit exception','No business fold, serializer or production journal tested']};
} catch(error) { result={passed:false,error:{name:error.name,message:error.message},out}; process.exitCode=1; }
finally { lease.release(); io.json('lease-released.json',{runId,released:true}); }
io.json('result.json',result);
io.json('outputs.json',snapshot(files(out)));
fs.writeFileSync(join(round,runId+'-result.json'),JSON.stringify({...result,out,resultPath:join(out,'result.json')},null,2)+'\n',{flag:'wx',mode:0o400});
console.log(JSON.stringify({passed:result.passed,out,resultPath:join(round,runId+'-result.json')}));
}
