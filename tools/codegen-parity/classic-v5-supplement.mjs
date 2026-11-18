#!/usr/bin/env node
// Prepared only. No public commands until ALL reviews and the parent's budget are sealed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { runVerifiedProcess, processFailureState, validateProcessReceipt } from '../../lib/verification/process.mjs';
import { assertCanonicalPath, captureEvidenceFile, fingerprintEvidenceFile } from '../../lib/verification/files.mjs';
import { inventoryEvidence, compareEvidenceInventories, createEvidenceReferences } from '../../lib/verification/inventory.mjs';

const SELF = fileURLToPath(import.meta.url), J = path.resolve(path.dirname(SELF), '../..');
const FORMAL = J + '/.rounds/classic-cqrs-v5-20261117-02/formal';
const PREP = FORMAL + '/supplement-preparation';
const CONTRACT = FORMAL + '/contract-10/preparedcases05.json';
const OWNER = 'classic-cqrs-v5-20261117-02';
const FILE = 8 * 1024 * 1024, LOG = 16 * 1024 * 1024, REPORT = 64 * 1024 * 1024;
const need = (ok, message) => { if (!ok) throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => file === root || file.startsWith(root + '/');
const fp = value => ({ bytes: value.bytes, sha256: value.sha256 });
const fold = s => s.normalize('NFC').toLowerCase();
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
  new Set(a).size === a.length && new Set(b).size === b.length && a.every(x => b.includes(x));
const pin = (file, limit = FILE) => ({ file, ...fingerprintEvidenceFile(file, { limit }) });
const json = (file, limit = FILE) => {
  const c = captureEvidenceFile(file, { limit });
  return { pin: { file, ...fp(c) }, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(c.value)) };
};
const identity = dir => {
  assertCanonicalPath(dir);
  const s = fs.lstatSync(dir); return [s.dev, s.ino, s.mode, s.uid, s.gid];
};
function checkPins(rows) {
  const unique = new Map();
  for (const r of rows) {
    need(r && path.isAbsolute(r.file) && Number.isSafeInteger(r.bytes) && r.bytes >= 0 && /^[a-f0-9]{64}$/u.test(r.sha256), 'complete bounded pin required');
    if (unique.has(r.file)) need(JSON.stringify(fp(unique.get(r.file))) === JSON.stringify(fp(r)), 'conflicting pin: ' + r.file);
    unique.set(r.file, r);
  }
  const references = createEvidenceReferences();
  for (const row of unique.values()) references.retain({ file: row.file, ...fp(row) }, { limit: row.bytes });
  references.assertUnchanged(); // Reject growth before hashing mixed source/log/binary pins.
}
// Read-role policy is checked on all folded path components before traversal or
// pinning, including explicitly enumerated extra tools.
const forbiddenSourceComponents = new Set(['.git', '.rounds', 'docs', 'node_modules', 'secrets', 'credentials']);
const sensitiveSourceNames = [
  /^(?:secrets?|credentials?)(?:[._-]|$)/u,
  /^(?:agent\.output|full[-.]agent\.output)(?:[._-]|$)/u,
  /^(?:passwd|private[-_]?key|environment|\.env)(?:[._-]|$)/u,
  /^(?:process|old)[._-](?:args|argv|env|environment)(?:[._-]|$)/u,
  /^(?:args|argv|env|environment)[._-](?:dump|dumps)(?:[._-]|$)/u,
  /^(?:process[._-])?(?:args[._-]env|env[._-]args)(?:[._-]|$)/u,
];
function sourceReadAllowed(file) {
  const relative = path.posix.relative(J, file);
  return relative.length > 0 && !relative.startsWith('../') && !path.posix.isAbsolute(relative) &&
    !/[\x00-\x1f\x7f-\x9f\\]/u.test(relative) && relative.split('/').every(part => {
      const name = fold(part);
      return part && part !== '.' && part !== '..' && !forbiddenSourceComponents.has(name) &&
        !sensitiveSourceNames.some(pattern => pattern.test(name));
    });
}
// This is used ONLY at the parent's final freeze; no preparation-time broad pin scan.
function sourceClosure() {
  const files = [], directories = [];
  function visit(dir) {
    const before = identity(dir), names = fs.readdirSync(dir).sort();
    need(new Set(names.map(fold)).size === names.length, 'source directory spelling alias');
    directories.push({ dir, identity: before, names });
    for (const name of names) {
      const f = dir + '/' + name;
      if (!sourceReadAllowed(f)) continue;
      const s = fs.lstatSync(f);
      need(!s.isSymbolicLink() && (s.isFile() || s.isDirectory()), 'unsafe public source member: ' + f);
      if (s.isDirectory()) visit(f);
      else {
        need(s.nlink === 1, 'hardlinked public source');
        if (/\.(?:mjs|cjs|js|json|scala|proto)$/u.test(name)) files.push(f);
      }
    }
    need(JSON.stringify(identity(dir)) === JSON.stringify(before) && JSON.stringify(fs.readdirSync(dir).sort()) === JSON.stringify(names), 'source membership changed while scanning');
  }
  for (const r of ['lib', 'generators', 'src/core', 'bin']) visit(J + '/' + r);
  return { files: files.sort(), directories };
}
function materialize(value, root) {
  if (typeof value === 'string') return value.replaceAll('${OUT}', () => root);
  if (Array.isArray(value)) return value.map(item => materialize(item, root));
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, materialize(item, root)]));
  return value;
}
const clean = r => r.schemaVersion === 'truthsrc.verified-process/v1' && Number.isSafeInteger(r.pid) && r.pid > 0 &&
  r.signal === null && r.expectedSignal === null && r.launchError === null && !r.timedOut && r.cancelled === null &&
  r.leftoverGroup === false && r.groupAliveAfter === false && r.outputLimitExceeded === false && r.outputError === false &&
  r.sandboxProfileUnchanged === true && r.directChildClosed === true && r.directChildReaped === true &&
  same(r.terminationErrors, []) && same(r.groupSignals, []) && same(r.mainSignals, []) &&
  r.graceMs === 15000 && r.reapMs === 5000 && r.descendantExitGraceMs === 0 && r.maxOutputBytes === LOG &&
  Number.isSafeInteger(r.rawOutputBytes) && r.rawOutputBytes <= LOG && r.barrier?.status === 'not-requested' && r.barrier.settled === true && r.barrier.error === null;

process.exitCode = 2; // Only the final post-closeout check can grant exit zero.
let R, E, rootOwned = false, contract, budget, deadlineMono, source, sourceFreeze, sandbox, policy, env, complete = false;
const ownedDirs = new Map(), pins = [], localPins = [], inventories = [], calls = [];
const abort = new AbortController(); let interrupted = null, streamFailure = null, primary = null;
const result = { schemaVersion: 'truthsrc.classic-v5-supplement-observations/v1', verdict: 'BLOCKED', calls,
  integrityFailures: [], finalizationFailures: [], budgetStartedOrExtendedByRunner: false, coverageSigned: false,
  boundary: 'Only pre-registered supplemental public observations. Old original inputs once each; real new core output copied into isolated actual-side negatives; nonempty plan suppression is not Scala parity or legality. No tests/typecheck/private-generator import-call/JVM/runtime/all31 claim. Never reuse feedback/F5 evidence. Completion/closeout require the parent to observe exit zero.' };
function interrupt(s) { interrupted ??= s; abort.abort(s); }
const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
for (const stream of [process.stdout, process.stderr]) stream.on('error', e => { streamFailure ??= e.message; process.exitCode = 2; });
function owned() {
  need(rootOwned, 'exclusive root was not admitted');
  for (const [d, i] of ownedDirs) need(JSON.stringify(identity(d)) === JSON.stringify(i), 'owned directory replaced: ' + d);
}
function directory(d) {
  owned(); need(inside(R, d) && d !== R, 'directory outside owned run');
  assertCanonicalPath(d, { kind: 'new' }); fs.mkdirSync(d, { mode: 0o700 }); ownedDirs.set(d, identity(d));
}
function parents(file) {
  const pending = [];
  for (let d = path.dirname(file); !ownedDirs.has(d); d = path.dirname(d)) { need(inside(R, d) && d !== R, 'unowned parent'); pending.push(d); }
  for (const d of pending.reverse()) directory(d);
}
function save(file, value, limit = REPORT) {
  owned(); need(inside(R, file) && file !== R, 'write outside owned run'); parents(file); assertCanonicalPath(file, { kind: 'new' });
  const b = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  need(b.length <= limit, 'whole capture exceeds bound; no truncation');
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, b); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const row = pin(file, limit); localPins.push(row); return row;
}
function checkDeadline(label, launching = 0) {
  need(!interrupted && !streamFailure, 'interrupted or output I/O failed');
  if (budget) need(Date.now() <= budget.deadlineEpochMs && performance.now() <= deadlineMono, 'original shared formal deadline exceeded: ' + label);
  if (launching) need(Math.min(budget.deadlineEpochMs - Date.now(), deadlineMono - performance.now()) >= launching + budget.reserveMs + 20000,
    'fixed command cap and shared reserve do not fit; refuse without shrinking or refreshing');
}
function checkAll(label) {
  owned(); checkPins([...pins, ...localPins]);
  if (source) need(JSON.stringify(sourceClosure()) === JSON.stringify(source), 'complete public source membership/identity drift');
  for (const t of inventories) {
    need(JSON.stringify(identity(t.root)) === JSON.stringify(t.identity), 'observed inventory root replaced');
    compareEvidenceInventories(t.inventory, inventoryEvidence(t.root, { limit: FILE }));
  }
  checkDeadline(label); // AFTER all synchronous hashes and filesystem checks.
}
function observe(root, expected = null) {
  const row = { root, identity: identity(root), inventory: inventoryEvidence(root, { limit: FILE }) };
  if (expected) compareEvidenceInventories(expected, row.inventory);
  inventories.push(row); return row;
}
function inventoryFor(root) { const r = inventories.find(x => x.root === root); need(r, 'comparison root lacks complete inventory'); return r.inventory; }
function membership(inv, declarations) { return { missing: declarations.filter(p => !Object.hasOwn(inv, p)), unexpected: Object.keys(inv).filter(p => !declarations.includes(p)) }; }
function reportGate(output, call) {
  const sf = json(call.scope), sc = sf.value, a = call.assertion;
  need(output.schemaVersion === 'truthsrc.codegen-parity-report/v1' && output.expectedRoot === call.expectedRoot && output.actualRoot === call.actualRoot &&
    output.scope?.file === call.scope && output.scope.bytes === sf.pin.bytes && output.scope.sha256 === sf.pin.sha256 && JSON.stringify(output.scope.definition) === JSON.stringify(sc), 'raw report roots/scope binding mismatch');
  need(same(output.files.map(r => r.path), sc.paths), 'report must enumerate every compared path');
  const n = sc.paths.length, c = output.counts;
  need(c.comparedPaths === n && c.expectedOnly === sc.expectedOnly.length && c.actualOnly === sc.actualOnly.length &&
    c.equalFiles + c.differentFiles + c.unavailableFiles === n, 'complete count accounting required');
  for (const side of ['expected', 'actual']) {
    const root = side === 'expected' ? call.expectedRoot : call.actualRoot, inv = inventoryFor(root);
    const only = sc[side + 'Only'], declarations = [...sc.paths, ...only], m = membership(inv, declarations), rr = output.inventories[side];
    need(c[side + 'InventoryFiles'] === Object.keys(inv).length && same(rr.map(r => r.path), Object.keys(inv)), 'full inventory omitted or count changed');
    compareEvidenceInventories(inv, Object.fromEntries(rr.map(r => [r.path, fp(r)])));
    for (const r of rr) need(r.partition === (sc.paths.includes(r.path) ? 'compared' : only.includes(r.path) ? 'ancillary' : 'unregistered'), 'inventory partition mismatch');
    need(same(output.membership[side].missing, m.missing) && same(output.membership[side].unexpected, m.unexpected), 'reported membership differs from whole capture');
    for (const r of output.files) {
      if (!Object.hasOwn(inv, r.path)) need(r[side] === null, 'missing file row must be null');
      else need(r[side]?.file === root + '/' + r.path && r[side].bytes === inv[r.path].bytes && r[side].sha256 === inv[r.path].sha256, 'file row lacks exact byte binding');
    }
  }
  for (const [status, key] of [['equal','equalFiles'],['different','differentFiles'],['unavailable','unavailableFiles']])
    need(output.files.filter(r => r.status === status).length === c[key], 'file statuses contradict counts');
  need(same(output.membership.expected.missing, []) && same(output.membership.expected.unexpected, []), 'sealed expected inventory drift');
  if (a.kind === 'equal') {
    need(output.status === 'equal' && c.equalFiles === n && c.differentFiles === 0 && c.unavailableFiles === 0 &&
      same(output.membership.actual.missing, []) && same(output.membership.actual.unexpected, []), 'old original input regression differs');
  } else {
    need(n === 52 && c.expectedInventoryFiles === 52 && output.status === 'different' && c.equalFiles === a.equalFiles &&
      c.differentFiles === a.differentFiles && c.unavailableFiles === a.unavailableFiles && c.actualInventoryFiles === a.actualInventoryFiles &&
      same(output.membership.actual.missing, a.missing) && same(output.membership.actual.unexpected, a.unexpected) &&
      same(output.files.filter(r => r.status === 'different').map(r => r.path), a.paths), 'negative must identify precisely the registered counts/membership/diff paths');
    for (const f of a.paths) {
      const row = output.files.find(r => r.path === f), b = captureEvidenceFile(call.expectedRoot + '/' + f).value, actual = captureEvidenceFile(call.actualRoot + '/' + f).value;
      let offset = 0; while (offset < Math.min(b.length, actual.length) && b[offset] === actual[offset]) offset++;
      need(!b.equals(actual) && row.firstDifference?.offset === offset && typeof row.unifiedDiff === 'string' && row.unifiedDiff.length > 0, 'whole retained diff and exact first-byte offset required');
    }
  }
}
function applyMutation(bytes, m) {
  if (m.operation === 'replace-one-byte') {
    need(bytes[m.offset] === 32 && Buffer.from(m.beforeHex, 'hex').length === 1 && m.beforeHex === '20' && m.afterHex === '09', 'one-byte mutation contract changed');
    const line = bytes.subarray(0, m.offset).toString('utf8').split('\n').length;
    need(line === m.line && bytes.toString('hex').includes(m.lineHex) && bytes.toString('utf8').split('\n')[line - 1] === Buffer.from(m.lineHex, 'hex').toString('utf8'), 'registered offset/line changed');
    const out = Buffer.from(bytes); out[m.offset] = 9; return out;
  }
  need(['remove-pinned-span', 'replace-pinned-span'].includes(m.operation), 'unknown mutation');
  const before = Buffer.from(m.beforeHex, 'hex');
  need(bytes.subarray(m.offset, m.offset + before.length).equals(before), 'registered span changed');
  if (m.occurrencesBefore !== undefined) need(bytes.toString('utf8').split(before.toString('utf8')).length - 1 === m.occurrencesBefore, 'import multiplicity changed');
  return Buffer.concat([bytes.subarray(0, m.offset), m.afterHex ? Buffer.from(m.afterHex, 'hex') : Buffer.alloc(0), bytes.subarray(m.offset + before.length)]);
}
function negativeCopy(call, coreActual) {
  const inv = inventoryFor(coreActual), target = call.actualRoot, mutations = new Map(call.assertion.mutations.map(m => [m.path, m]));
  need(target.startsWith(R + '/probes/'), 'negative outside exclusive actual-side roots'); directory(target);
  const receipt = [];
  for (const [f, recorded] of Object.entries(inv)) {
    const captured = captureEvidenceFile(coreActual + '/' + f); need(JSON.stringify(fp(captured)) === JSON.stringify(recorded), 'core drift during same-Buffer copy');
    const m = mutations.get(f);
    if (m) need(m.original.file === call.expectedRoot + '/' + f && m.original.bytes === captured.bytes && m.original.sha256 === captured.sha256, 'mutation source is not the new equal real core file');
    if (m?.operation === 'omit') { receipt.push({ path:f, original:recorded, omitted:true }); continue; }
    const b = m ? applyMutation(captured.value, m) : captured.value;
    save(target + '/' + f, b, FILE); receipt.push({ path:f, original:recorded, copied:{bytes:b.length,sha256:hash(b)}, unchanged:b.equals(captured.value) });
    need(m ? !b.equals(captured.value) : b.equals(captured.value), 'changed/equal Buffer partition wrong');
  }
  for (const [f, m] of mutations) if (m.operation === 'add') { need(!Object.hasOwn(inv, f), 'extra file was already present'); save(target + '/' + f, Buffer.from(m.bytesHex, 'hex'), FILE); }
  observe(target); save(E + '/' + call.id + '.copy.json', { actualSource:coreActual, target, receipt, mutations:call.assertion.mutations });
}
function recordSettlement(row, receipt, base) {
  need(receipt.schemaVersion === 'truthsrc.verified-process/v1' && receipt.cwd === J &&
    receipt.timeoutMs === row.capMs && receipt.sandboxProfile === sandbox.profile &&
    receipt.sandboxProfileSha256 === sandbox.profileSha256 && same(receipt.envKeys, Object.keys(env)) &&
    JSON.stringify(receipt.command) === JSON.stringify(['/usr/bin/sandbox-exec', '-p', policy, process.execPath, ...row.argv]) &&
    receipt.commandSha256 === hash(JSON.stringify(receipt.command)) &&
    receipt.paths?.receipt === base + '.json' && receipt.paths.stdout === base + '.stdout.log' &&
    receipt.paths.stderr === base + '.stderr.log', 'receipt does not bind public argv/environment/profile/paths/cap');
  need(row.receipt && row.stdout && row.stderr, 'all raw captures required for settlement classification');
  const raw = captureEvidenceFile(row.receipt.file, { limit: FILE });
  need(raw.bytes === row.receipt.bytes && raw.sha256 === row.receipt.sha256 &&
    raw.value.equals(Buffer.from(JSON.stringify(receipt, null, 2) + '\n')) &&
    row.stdout.sha256 === receipt.stdoutSha256 && row.stderr.sha256 === receipt.stderrSha256 &&
    row.stdout.bytes + row.stderr.bytes === receipt.rawOutputBytes && receipt.rawOutputBytes <= LOG,
    'raw receipt/log capture mismatch');
  const positivePid = Number.isSafeInteger(receipt.pid) && receipt.pid > 0;
  const failedSpawn = !positivePid && receipt.pid === null && receipt.launchError === 'spawn-failed';
  need(!row.noSpawnConfirmed || !positivePid && !failedSpawn,
    'receipt contradicts helper nonspawn failure state');
  row.actualPositivePidExecution = positivePid;
  row.pid = positivePid ? receipt.pid : null;
  row.failedSpawn = failedSpawn;
  row.suppressedLaunch = !positivePid && receipt.pid === null && receipt.launchError === null &&
    typeof receipt.cancelled === 'string' && receipt.cancelled.length > 0;
  row.spawnAttempted ||= positivePid || failedSpawn;
  row.unknownSettlement = !positivePid && !failedSpawn && !row.suppressedLaunch;
  row.spawnState = row.actualPositivePidExecution ? 'positive-pid' : row.failedSpawn ? 'failed-spawn' :
    row.suppressedLaunch ? 'suppressed' : 'unknown';
  row.rawReceipt = receipt; row.settlementRecorded = true;
}
async function command(call) {
  const row = { id:call.id, stage:call.stage, expectedExit:call.expectedExit, expectedRawPassed:call.expectedRawPassed, helperInvoked:false,
    spawnAttempted:false, spawnState:'not-attempted', actualPositivePidExecution:false, pid:null,
    failedSpawn:false, suppressedLaunch:false, unknownSettlement:false, settlementRecorded:false,
    noSpawnConfirmed:false, accepted:false, pinsBefore:false, pinsAfter:false, argv:call.argvTemplate, capMs:call.capMs };
  calls.push(row); const base = E + '/' + call.id; let receipt, error;
  try {
    checkAll('before '+call.id); row.pinsBefore = true; checkDeadline('launch '+call.id, call.capMs);
    const processOptions = { executable:process.execPath, args:row.argv, cwd:J, env, base, timeoutMs:call.capMs, sandbox };
    const commandBytes = Buffer.byteLength(JSON.stringify({ command: ['/usr/bin/sandbox-exec', '-p', policy, process.execPath, ...row.argv] }, null, 2));
    const optionBytes = Buffer.byteLength(JSON.stringify(processOptions));
    const cleanReceiptUpperBoundBytes = commandBytes + 4 * optionBytes + 4096;
    need(commandBytes <= FILE / 4 && optionBytes <= FILE / 4 && cleanReceiptUpperBoundBytes <= FILE / 2,
      'whole command, options and clean receipt must fit fixed helper JSON headroom');
    row.byteBounds = { profileBytes: Buffer.byteLength(policy), commandBytes, optionBytes,
      cleanReceiptUpperBoundBytes, receiptLimitBytes: FILE };
    row.helperInvoked = true;
    receipt = await runVerifiedProcess({ ...processOptions, signal:abort.signal });
    for (const [key,suffix] of [['receipt','.json'],['stdout','.stdout.log'],['stderr','.stderr.log']]) {
      const file=base+suffix;
      row[key] = pin(file,key==='receipt'?FILE:LOG); localPins.push(row[key]);
    }
    recordSettlement(row, receipt, base);
    need(clean(receipt) && receipt.code === call.expectedExit && receipt.passed === call.expectedRawPassed && receipt.status === (call.expectedExit === 0 ? 'passed':'failed') && receipt.expectedTermination === (call.expectedExit === 0), 'unexpected public result; retain raw passed:false on expected negatives');
    if (call.expectedExit === 0) validateProcessReceipt(receipt,{base});
    if (call.stage === 'plan' && call.expectedExit === 2) {
      const stderr = captureEvidenceFile(row.stderr.file,{limit:LOG}).value.toString('utf8');
      need(call.assertion.stderrContains.every(s => stderr.includes(s)) && !fs.existsSync(call.out), 'invalid plan failed at wrong guard or wrote target');
      row.observedDiagnostic = call.diagnostic;
    } else {
      const output = json(row.stdout.file, LOG).value;
      if (call.stage === 'compare') { reportGate(output,call); row.report = row.stdout; row.counts=output.counts; row.membership=output.membership; }
      else if (call.stage === 'generate') {
        need(output.applied === true && output.readiness?.runnable === false, 'old regression must actually generate non-runnable source'); observe(call.out);
      } else {
        const entries=output.plan?.entries, a=call.assertion;
        need(output.applied === false && output.plan?.readiness?.runnable === false && output.plan.generator.id === 'scala-cqrs-classic-v5' && output.plan.generator.version === '5' && !fs.existsSync(call.out), 'legal suppression must be public plan-only');
        need(Array.isArray(entries) && entries.length>0 && same(entries.map(e=>e.path),a.remainingPaths) && a.absent.every(f=>!entries.some(e=>e.path===f)), 'suppression must retain full nonempty remainder, without DSL/routes');
        for (const e of entries) need(e.deps.every(f=>entries.some(other=>other.path===f)), 'suppressed plan local dependency outside whole plan');
        row.planEntries=entries.length; row.claim='Nonempty public plan observation, not independent Scala coverage';
      }
    }
    row.accepted=true;
  } catch (failure) {
    error=failure; const state=processFailureState(failure);
    if (state) {
      row.processFailureState=state; row.spawnAttempted ||= state.spawnAttempted === true;
      row.noSpawnConfirmed=state.spawnAttempted === false;
    }
    if (row.helperInvoked && !row.settlementRecorded) {
      row.unknownSettlement=!row.noSpawnConfirmed;
      row.spawnState=row.unknownSettlement?'unknown':'not-attempted';
    }
  } finally {
    // Independently recover ALL partial captures; no PID probing or rerun.
    if (row.helperInvoked) for (const [key,suffix] of [['receipt','.json'],['stdout','.stdout.log'],['stderr','.stderr.log']]) {
      try {
        const file=base+suffix, s=fs.lstatSync(file,{throwIfNoEntry:false});
        if (s) { if (!row[key]) { row[key]=pin(file,key==='receipt'?FILE:LOG); localPins.push(row[key]); } }
        else need(!row.spawnAttempted && row.spawnState!=='unknown','post-spawn or unknown-spawn evidence missing: '+file);
      } catch (failure) { (row.evidenceFailures??=[]).push(failure.message); error??=failure; }
    }
    if (row.helperInvoked && !row.settlementRecorded && row.receipt && row.stdout && row.stderr) try {
      const recovered=json(row.receipt.file);
      need(recovered.pin.bytes===row.receipt.bytes && recovered.pin.sha256===row.receipt.sha256,
        'recovered receipt changed before classification');
      recordSettlement(row,recovered.value,base); row.settlementRecovered=true;
    } catch(failure) { (row.evidenceFailures??=[]).push(failure.message); error??=failure; }
    try { checkAll('after '+call.id); row.pinsAfter=true; } catch(failure) { row.integrityFailure=failure.message; result.integrityFailures.push(failure.message); error??=failure; }
  }
  if (error) { row.accepted=false; row.failure=error.message; throw error; }
}
try {
  need(process.platform==='darwin' && process.versions.node==='22.23.4','physical Node 22.23.4 on Darwin only');
  const args=process.argv.slice(2); need(args.length===6 && args[0]==='--out' && args[2]==='--budget' && args[4]==='--budget-sha256','exact --out/--budget/--budget-sha256 only; no cap/retry/help');
  const out=args[1], budgetFile=args[3];
  need(path.isAbsolute(out) && path.resolve(out)===out && path.dirname(out)===FORMAL && out!==PREP,'new output must be a direct child of the approved formal root');
  need(path.isAbsolute(budgetFile) && path.resolve(budgetFile)===budgetFile && inside(FORMAL,budgetFile) && !inside(PREP,budgetFile) && !inside(out,budgetFile),'integrator budget must be a separate formal file, never preparation/run-owned');
  const b=json(budgetFile); need(b.pin.sha256===args[5],'provided budget pin mismatch'); budget=b.value;
  const prepared=json(CONTRACT); contract=prepared.value;
  need(contract.schemaVersion==='truthsrc.classic-v5-supplement-preparation/v1' && contract.status==='PREPARED_NOT_RUN' && contract.runner===SELF && contract.coverageSigned===false && contract.actualRunCount===0,'fixed prepared contract required');
  need(budget.schemaVersion==='truthsrc.classic-v5-final-formal-budget/v1' && budget.owner===OWNER && budget.authorized===true && budget.reviewsComplete===true && budget.extensionAllowed===false && budget.extended===false &&
    budget.wallMs===7200000 && budget.reserveMs===120000 && Number.isSafeInteger(budget.startedEpochMs) && Number.isSafeInteger(budget.deadlineEpochMs) && budget.deadlineEpochMs-budget.startedEpochMs===budget.wallMs && Date.now()>=budget.startedEpochMs &&
    budget.supplementRoot===out && budget.coreExitCode===0 && JSON.stringify(budget.preparedCases)===JSON.stringify(prepared.pin) &&
    JSON.stringify(budget.coreCallIds)===JSON.stringify(contract.coreCallIds) && JSON.stringify(budget.supplementCallIds)===JSON.stringify(contract.plannedCallIds) && budget.combinedCapsMs===2790000,'parent review/budget/matrix authorization required; no extension or fresh local budget');
  need(contract.cases.length===47 && contract.cases.length<=120 && contract.cases.reduce((n,c)=>n+c.capMs,0)===2130000 && budget.combinedCapsMs+budget.reserveMs<=budget.wallMs &&
    contract.cases.every(c=>c.capMs===(c.stage==='generate'?120000:30000)),'pre-registered cap sum cannot fit or matrix changed');
  deadlineMono=performance.now()+budget.deadlineEpochMs-Date.now(); checkDeadline('admission');
  assertCanonicalPath(out,{kind:'new'}); fs.mkdirSync(out,{mode:0o700}); R=out; rootOwned=true; ownedDirs.set(R,identity(R));
  for(const d of ['evidence','actual','probes','runtime','runtime/home','runtime/tmp']) directory(R+'/'+d); E=R+'/evidence';
  result.rootOwnership={exclusive:true,root:R,identity:ownedDirs.get(R)}; result.budget=b.pin; result.preparedCases=prepared.pin;
  pins.push(b.pin,prepared.pin,pin(SELF),...contract.readPins,...contract.preparedInputPins);
  for(const c of contract.cases) if(c.diagnosticSource) pins.push(c.diagnosticSource.pin);
  need(path.isAbsolute(budget.coreRoot) && path.dirname(budget.coreRoot)===J+'/.rounds' && !inside(R,budget.coreRoot),'fresh core wrapper root required');
  const cc=json(budget.coreRoot+'/completion.json'), close=json(budget.coreRoot+'/closeout.json');
  need(JSON.stringify(close.pin)===JSON.stringify(budget.coreCloseout) && close.value.status==='closed' && close.value.requiresExitCodeZero===true &&
    JSON.stringify(close.value.completion)===JSON.stringify(cc.pin) && cc.value.verdict==='CORE_COMPLETE' && cc.value.integrity?.scopedPinsUnchanged===true &&
    cc.value.calls.length===10 && cc.value.actualCalls===10 && cc.value.failedObservations.length===0 &&
    cc.value.unexecuted.length===0 && cc.value.unknownSettlements.length===0 &&
    cc.value.failedSpawnAttempts.length===0 && cc.value.suppressedLaunches.length===0 &&
    cc.value.calls.every(c=>c.accepted && c.actualPositivePidExecution && c.settlementRecorded && !c.unknownSettlement) &&
    JSON.stringify(cc.value.plannedCallIds)===JSON.stringify(contract.coreCallIds),'completed new core and closed seal with parent-observed exit zero required');
  need(Array.isArray(close.value.evidenceBindings) && close.value.evidenceBindings.every(r=>inside(budget.coreRoot,r.file)), 'core local evidence bindings must stay in its new root');
  pins.push(cc.pin,close.pin,...close.value.evidenceBindings);
  for (const call of cc.value.calls) {
    need(call.receipt?.file && inside(budget.coreRoot,call.receipt.file), 'core call receipt is not locally bound');
    const captured=json(call.receipt.file), r=captured.value;
    need(JSON.stringify(captured.pin)===JSON.stringify(call.receipt) && clean(r) && r.code===0 && r.passed===true &&
      Date.parse(r.startedAt)>=budget.startedEpochMs && Date.parse(r.endedAt)<=budget.deadlineEpochMs, 'core must be a clean new invocation inside THIS shared formal clock, not historical feedback');
    validateProcessReceipt(r,{base:r.paths.receipt.slice(0,-5)});
  }
  need(inside(budget.coreRoot,cc.value.sourceBefore.file) && inside(budget.coreRoot,cc.value.sourceAfter.file), 'core source evidence must remain local');
  const before=json(cc.value.sourceBefore.file),after=json(cc.value.sourceAfter.file);
  need(JSON.stringify(before.value)===JSON.stringify(after.value),'core source pins drifted'); pins.push(before.pin,after.pin,...after.value);
  need(budget.sourceFreeze?.file && inside(FORMAL,budget.sourceFreeze.file) && !inside(PREP,budget.sourceFreeze.file) && !inside(R,budget.sourceFreeze.file), 'final source freeze belongs to the integrator, never this runner or preparation');
  sourceFreeze=json(budget.sourceFreeze.file);
  need(JSON.stringify(sourceFreeze.pin)===JSON.stringify(budget.sourceFreeze),'final freeze pin mismatch');
  source=sourceClosure(); need(JSON.stringify(sourceFreeze.value.directories)===JSON.stringify(source.directories),'final freeze omitted source filesystem members/identity');
  const explicit=[J+'/package.json',J+'/tools/codegen-parity.mjs',SELF,J+'/tools/codegen-parity/replay-classic-v5.mjs',process.execPath,'/usr/bin/sandbox-exec'];
  const extraTool=f=>[J+'/tools/codegen-parity/',J+'/tools/freeze/'].some(p=>f.startsWith(p)) &&
    /\.(?:mjs|cjs|js|json|scala|proto)$/u.test(f) && sourceReadAllowed(f);
  need(Array.isArray(sourceFreeze.value.files) && sourceFreeze.value.files.every(r=>source.files.includes(r.file)||explicit.includes(r.file)||extraTool(r.file)) &&
    [...source.files,...explicit].every(f=>sourceFreeze.value.files.some(r=>r.file===f)), 'final freeze must bind whole public closure and only explicit safe tools/runtime, not blanket tests/rounds/docs');
  const allowedCorePins=new Set([...sourceFreeze.value.files.map(r=>r.file),...contract.readPins.map(r=>r.file)]);
  need(after.value.every(r=>allowedCorePins.has(r.file)), 'core source pins contain undeclared read surfaces');
  pins.push(sourceFreeze.pin,...sourceFreeze.value.files);
  for(const r of contract.oldInputs) observe(r.expectedRoot,r.expectedInventory);
  const v5scope=json(J+'/test/reference/classic-cqrs-v5/scope.json').value;
  const expectedInv=Object.fromEntries(contract.readPins.filter(p=>p.file.startsWith(J+'/test/reference/classic-cqrs-v5/baseline/')).map(p=>[p.file.slice((J+'/test/reference/classic-cqrs-v5/baseline/').length),fp(p)]));
  need(same(Object.keys(expectedInv),v5scope.paths) && v5scope.paths.length===52,'sealed full 52 expected required'); observe(J+'/test/reference/classic-cqrs-v5/baseline',expectedInv);
  for(const c of cc.value.captures) {
    need(c.actual?.inventory && c.sources?.inventory && c.ledger && same(Object.keys(c.actual.inventory),[...v5scope.paths,...v5scope.actualOnly]),'complete new core real 54-file capture required');
    observe(c.actual.root,c.actual.inventory); observe(c.sources.root,c.sources.inventory);
  }
  const baseline=cc.value.captures.find(c=>c.variant==='baseline' && c.repeat==='a'); need(baseline,'baseline A real capture required');
  compareEvidenceInventories(expectedInv,Object.fromEntries(v5scope.paths.map(f=>[f,baseline.actual.inventory[f]])));
  const materialized = contract.cases.map(c => materialize(c, R));
  save(E+'/cases.json',materialized); checkPins(pins);
  // Minimal literal old-request/expected/prepared-input reads; never blanket test/docs/.rounds access.
  const dirs=new Set(source.directories.map(r=>r.dir));
  for(const r of [...pins,...localPins]) for(let d=path.dirname(r.file);;d=path.dirname(d)) { dirs.add(d); if(d===path.dirname(d))break; }
  for(const t of inventories) {
    function visit(d) { dirs.add(d); for(const e of fs.readdirSync(d,{withFileTypes:true})) if(e.isDirectory())visit(d+'/'+e.name); }
    visit(t.root);
  }
  const readFiles=[...new Set([...pins.map(r=>r.file),...inventories.flatMap(t=>Object.keys(t.inventory).map(f=>t.root+'/'+f))])];
  for(const d of ownedDirs.keys()) dirs.add(d);
  const system=['/System/Library','/usr/lib','/Library/Apple/System/Library','/private/var/db/dyld','/usr/share/icu','/private/var/db/timezone/zoneinfo'],q=JSON.stringify;
  policy='(version 1)\n(allow default)\n(deny network*)\n(deny file-write*)\n(deny file-read-data)\n'+
    '(allow file-read-data '+system.map(d=>'(subpath '+q(d)+')').join(' ')+' (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom") (literal "/private/etc/localtime") '+
    [...new Set([...readFiles,...dirs])].map(f=>'(literal '+q(f)+')').join(' ')+' (subpath '+q(R+'/actual')+') (subpath '+q(R+'/runtime')+') (subpath '+q(R+'/probes')+'))\n'+
    '(allow file-write* (subpath '+q(R+'/actual')+') (subpath '+q(R+'/runtime')+'))\n';
  need(Buffer.byteLength(policy) <= FILE / 4, 'whole sandbox profile must fit helper capture and command headroom');
  const profile=save(E+'/sandbox.sb',policy,FILE); sandbox={executable:'/usr/bin/sandbox-exec',profile:profile.file,profileSha256:profile.sha256};
  env={HOME:R+'/runtime/home',TMPDIR:R+'/runtime/tmp',PATH:path.dirname(process.execPath)+':/usr/bin:/bin',LANG:'en_US.UTF-8',LC_ALL:'en_US.UTF-8',TZ:'UTC',NODE_V8_COVERAGE:''};
  result.sandbox={...sandbox,childWrites:[R+'/actual',R+'/runtime'],negativeCopiesParentOnly:R+'/probes',receiptsParentOnly:E};
  result.sourceBefore=save(E+'/source-before.json',pins); result.plannedCallIds=contract.plannedCallIds;
  for(const call of materialized) {
    if(call.id.startsWith('supp.neg.')) negativeCopy(call,baseline.actual.root);
    if(call.stage==='compare' && !call.id.startsWith('supp.neg.')) need(inventories.some(t=>t.root===call.actualRoot),'old actual must come from immediately preceding single generation');
    await command(call);
  }
  need(calls.length===47 && calls.every(c=>c.accepted && c.actualPositivePidExecution &&
    c.settlementRecorded && !c.unknownSettlement && c.pinsBefore && c.pinsAfter),'every fixed observation must settle'); complete=true;
} catch(error) { primary=error; }
finally {
  if(rootOwned) {
    const fail=e=>{primary??=e;result.finalizationFailures.push(e.message);process.exitCode=2;};
    try { checkAll('final source scan'); result.sourceAfter=save(E+'/source-after.json',pins.map(r=>pin(r.file,r.bytes))); checkAll('after source-after write'); } catch(e){fail(e);}
    result.actualCalls=calls.filter(c=>c.actualPositivePidExecution).length;
    result.acceptedObservations=calls.filter(c=>c.accepted).length;
    result.failedObservations=calls.filter(c=>c.actualPositivePidExecution&&!c.accepted).map(c=>c.id);
    result.unknownSpawnStates=calls.filter(c=>c.unknownSettlement).map(c=>c.id);
    result.failedSpawnAttempts=calls.filter(c=>c.failedSpawn).map(c=>c.id);
    result.suppressedLaunches=calls.filter(c=>c.suppressedLaunch).map(c=>c.id);
    result.preSpawnFailures=calls.filter(c=>(!c.helperInvoked||c.noSpawnConfirmed)&&c.failure).map(c=>({id:c.id,failure:c.failure}));
    result.unexecuted=(contract?.plannedCallIds??[]).filter(id=>!calls.some(c=>c.id===id&&
      (c.actualPositivePidExecution||c.unknownSettlement)));
    result.remaining=result.unexecuted.length+result.failedObservations.length+result.unknownSpawnStates.length;
    result.holdsNotCoverage=contract?.holdsNotRunOrCoverage??[];
    result.pinsUnchanged=!!result.sourceBefore&&!!result.sourceAfter&&!result.integrityFailures.length&&!result.finalizationFailures.length;
    if(primary) result.failure=primary.message;
    let completionPin;
    try {
      checkAll('before completion');
      need(complete && result.pinsUnchanged && result.actualCalls===47 && result.acceptedObservations===47 && result.remaining===0 && result.unknownSpawnStates.length===0 &&
        calls.every(c=>!c.evidenceFailures?.length && clean(c.rawReceipt)) && !primary,'incomplete observations/integrity/settlement');
      result.verdict='SUPPLEMENT_COMPLETE'; result.acceptance={completionAloneIsUnsigned:true,requiresParentObservedExitZero:true,all31Closed:false};
      completionPin=save(R+'/completion.json',result); checkAll('after completion hash/write');
      save(R+'/closeout.json',{schemaVersion:'truthsrc.classic-v5-supplement-closeout/v1',status:'closed',completion:completionPin,budget:result.budget,preparedCases:result.preparedCases,
        sourceBefore:result.sourceBefore,sourceAfter:result.sourceAfter,evidenceBindings:localPins,actualCalls:47,acceptedObservations:47,failedObservations:[],unexecuted:[],
        deadlineEpochMs:budget.deadlineEpochMs,budgetNotExtended:true,requiresExitCodeZero:true,coverageSigned:false});
      await new Promise(done=>setImmediate(done)); checkAll('after closeout and final full pin settlement');
      fs.writeSync(1,JSON.stringify({completion:completionPin,closeout:R+'/closeout.json',actualCalls:47,coverageSigned:false})+'\n');
      await new Promise(done=>setImmediate(done)); checkAll('after notification'); process.exitCode=0;
    } catch(e) {
      fail(e); result.verdict='BLOCKED'; result.failure=primary?.message??e.message; result.invalidCompletion=completionPin??null; result.invalidCloseout=R+'/closeout.json';
      try { save(E+'/completion-failure.json',result); checkDeadline('after failure capture'); } catch(sealError) { process.exitCode=2; try{fs.writeSync(2,sealError.message+'\n');}catch{} }
    }
  }
  if(primary) try{fs.writeSync(2,primary.message+'\n');}catch{}
  process.off('SIGINT',onInt);process.off('SIGTERM',onTerm);
}
