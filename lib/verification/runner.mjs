import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { closeSync, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
import { copyImmutableData } from '../immutable-data.mjs';
import { assertCanonicalPath, captureEvidenceFile, fingerprintEvidenceFile } from './files.mjs';
import { compareEvidenceInventories, createEvidenceReferences, inventoryEvidence, snapshotEvidenceFiles } from './inventory.mjs';
import { abandonFileLease, acquireFileLease, validateFileLeaseDeclaration } from './lease.mjs';
import { captureProcessOptions, inspectProcessEvidence, processFailureState, runVerifiedProcess } from './process.mjs';
import { assertVerificationCallback, captureVerificationSignal, settleVerificationCallback } from './callbacks.mjs';

const SCHEMA = 'truthsrc.verification-run/v1', LIMIT = 8 * 1024 * 1024;
const fold = value => value.normalize('NFC').toLowerCase();
const own = (value, key) => Object.hasOwn(value, key);
const within = (root, file) => fold(file) === fold(root) || fold(file).startsWith(fold(root) + sep);
const overlap = (a, b) => within(a, b) || within(b, a);
const jsonText = value => JSON.stringify(value, null, 2) + '\n';
const invalid = () => { throw new Error('invalid verification data or options'); };
const stamp = ({ bytes, sha256 }) => ({ bytes, sha256 });
const reference = (file, limit = LIMIT) => ({ file, ...fingerprintEvidenceFile(file, { limit }) });
const support = ['runner.mjs', 'lease.mjs', 'files.mjs', 'inventory.mjs', 'process.mjs', 'callbacks.mjs',
  '../immutable-data.mjs', '../strict-json.mjs', '../products/request.mjs', '../products/registry.mjs', '../products/assemblies.mjs'].map(name => fileURLToPath(new URL(name, import.meta.url)));

function fields(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || types.isProxy(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!allowed.includes(key) || !descriptor.enumerable || !own(descriptor, 'value')) invalid();
    result[key] = descriptor.value;
  }
  if (!required.every(key => own(result, key))) invalid();
  return result;
}

function data(value) {
  const pending = [value], seen = new Set();
  let nodes = 0, bytes = 0;
  while (pending.length) {
    const current = pending.pop();
    if (++nodes > 100_000 || Object.is(current, -0)) invalid();
    if (typeof current === 'string') bytes += Buffer.byteLength(current);
    if (bytes > LIMIT) invalid();
    if (!current || typeof current !== 'object') continue;
    if (types.isProxy(current) || seen.has(current)) invalid();
    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!own(descriptor, 'value') || typeof key !== 'string') invalid();
      bytes += Buffer.byteLength(key);
      if (bytes > LIMIT || pending.length >= 100_000) invalid();
      pending.push(descriptor.value);
    }
  }
  const copied = copyImmutableData(value, '', invalid);
  if (Buffer.byteLength(jsonText(copied)) > LIMIT) invalid();
  return copyImmutableData(JSON.parse(JSON.stringify(copied)));
}

function text(value) {
  assert.ok(typeof value === 'string' && value.length > 0 && value.isWellFormed() &&
    !/[\x00-\x1f\x7f-\x9f]/u.test(value), 'nonempty plain text required');
  return value;
}

function absolute(value) {
  text(value);
  assert.ok(isAbsolute(value) && resolve(value) === value && (sep !== '/' || !value.includes('\\')), 'canonical absolute path required');
  return value;
}

function relative(value) {
  text(value);
  assert.ok(!isAbsolute(value) && normalize(value) === value && !value.includes('\\') &&
    value.split('/').every(part => part && !['.', '..'].includes(part)), 'canonical relative artifact path required');
  return value;
}

function unique(values, check) {
  assert.ok(Array.isArray(values), 'explicit array required'); values.forEach(check);
  assert.equal(new Set(values.map(fold)).size, values.length, 'aliased or repeated declaration');
  return values;
}

function planData(input) {
  const plan = data(input);
  fields(plan, ['contract', 'inputs', 'actionFile', 'verifiers', 'artifacts', 'processCount'],
    ['contract', 'inputs', 'actionFile', 'verifiers', 'artifacts']);
  fields(plan.contract, ['id', 'version']); text(plan.contract.id); text(plan.contract.version);
  fields(plan.inputs, ['files', 'trees']); unique(plan.inputs.files, absolute);
  assert.ok(Array.isArray(plan.inputs.trees));
  unique(plan.inputs.trees.map(row => {
    fields(row, ['root', 'excludeDirectories']); absolute(row.root); unique(row.excludeDirectories, relative); return row.root;
  }), absolute);
  absolute(plan.actionFile);
  assert.ok(Array.isArray(plan.verifiers) && plan.verifiers.length > 0 && plan.verifiers.length <= 64, 'explicit verifiers required');
  unique(plan.verifiers.map(row => {
    fields(row, ['id', 'file']);
    assert.ok(/^[a-z][a-z0-9-]{0,63}$/.test(row.id), 'plain verifier id required'); absolute(row.file); return row.id;
  }), text);
  unique(plan.artifacts, relative);
  assert.ok(plan.artifacts.length > 0, 'explicit expected artifacts required');
  const processCount = plan.processCount ?? 0;
  assert.ok(Number.isSafeInteger(processCount) && processCount >= 0 && processCount <= 64, 'invalid process count');
  return data({ ...plan, processCount });
}

const callback = assertVerificationCallback;
const settle = (fn, context, convert) => settleVerificationCallback(fn, [context], convert);

function verifierMap(input, plan) {
  const map = fields(input, plan.verifiers.map(row => row.id));
  for (const value of Object.values(map)) callback(value);
  return Object.freeze(map);
}

function captureInputs(plan) {
  const files = [...new Set([...plan.inputs.files, plan.actionFile, ...plan.verifiers.map(row => row.file), ...support])];
  return data({ files: snapshotEvidenceFiles(files), trees: plan.inputs.trees.map(row => ({ root: row.root,
    files: inventoryEvidence(row.root, { excludeDirectories: row.excludeDirectories }) })) });
}

function inputsUnchanged(plan, captured) { assert.deepEqual(captureInputs(plan), captured, 'verification inputs changed'); }
function artifactsAt(directory, plan) {
  const files = inventoryEvidence(directory);
  assert.deepEqual(Object.keys(files).sort(), [...plan.artifacts].sort(), 'expected artifact membership differs');
  return files;
}

function privateDirectory(directory) {
  assertCanonicalPath(directory);
  const stat = lstatSync(directory);
  assert.ok(typeof process.getuid === 'function' && stat.uid === process.getuid() && (stat.mode & 0o077) === 0,
    'private current-user verification directory required');
}

function directoryIdentity(directory) {
  const result = [];
  for (let current = directory; ; current = dirname(current)) {
    const stat = lstatSync(current);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    result.push([current, stat.dev, stat.ino, stat.mode, stat.uid, stat.gid]);
    if (parse(current).root === current) return result;
  }
}

function save(file, value) {
  const bytes = Buffer.from(jsonText(data(value)));
  assertCanonicalPath(file, { kind: 'new' });
  const fd = openSync(file, 'wx', 0o600);
  try {
    writeFileSync(fd, bytes); fsyncSync(fd); fchmodSync(fd, 0o400);
    const stat = fstatSync(fd), leaf = lstatSync(file);
    assert.ok(stat.dev === leaf.dev && stat.ino === leaf.ino && stat.nlink === 1, 'verification receipt replaced');
    assert.deepEqual(captureEvidenceFile(file).value, bytes, 'verification receipt bytes changed');
  } finally { closeSync(fd); }
  return reference(file);
}

function read(file) {
  const captured = captureEvidenceFile(file, { limit: LIMIT, parse: bytes => {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes), value = data(JSON.parse(raw));
    assert.equal(jsonText(value), raw, 'noncanonical verification receipt'); return value;
  } });
  return { value: captured.value, ref: { file, ...stamp(captured) } };
}

function report(directory, plan, passed, checks, diagnostics) {
  return data({ schemaVersion: 'truthsrc.verification-report/v1', directory, contract: plan.contract,
    passed, staticSnapshot: true, checks, diagnostics, runtimeVerified: false });
}

function admittedLocations(directory, plan, lease) {
  absolute(directory); absolute(lease.registry);
  assertCanonicalPath(directory, { kind: 'new' }); assertCanonicalPath(dirname(lease.registry));
  assert.ok(!overlap(directory, lease.registry), 'lease and evidence roots must be disjoint');
  const roots = plan.inputs.trees.map(row => row.root);
  const files = [...plan.inputs.files, plan.actionFile, ...plan.verifiers.map(row => row.file), ...support];
  assert.ok(roots.every(root => !overlap(root, directory) && !overlap(root, lease.registry)), 'input and writable roots overlap');
  assert.ok(files.every(file => !within(directory, file) && !within(lease.registry, file)), 'input falls inside a writable root');
}

/**
 * One fresh cooperative run. Actions and verifiers are trusted in-process
 * capabilities, not modules loaded from receipts. They must settle and own any
 * work not dispatched through runProcess; no timer can preempt synchronous code.
 * Cancellation waits for the action and owned processes before owner release.
 * No resume, retries, compiler selection, downloads or data cleanup are implied.
 */
export async function runVerification(input) {
  const options = fields(input, ['directory', 'plan', 'lease', 'action', 'verify', 'signal'],
    ['directory', 'plan', 'lease', 'action', 'verify']);
  const plan = planData(options.plan), action = callback(options.action), verify = verifierMap(options.verify, plan);
  const directory = options.directory, leaseOptions = data(options.lease);
  fields(leaseOptions, ['registry', 'lockNames', 'usedName', 'record']);
  assert.ok(typeof leaseOptions.usedName === 'string' && leaseOptions.usedName.length > 0, 'single-use grant marker required');
  fields(leaseOptions.record, Object.keys(leaseOptions.record));
  for (const key of ['verificationRun', 'verificationContract', 'token']) assert.ok(!own(leaseOptions.record, key), 'reserved lease record field');
  const signal = captureVerificationSignal(options.signal);
  admittedLocations(directory, plan, leaseOptions);
  signal?.throwIfAborted();
  const record = data({ ...leaseOptions.record, verificationRun: directory, verificationContract: plan.contract,
    token: randomBytes(24).toString('hex') });
  const lease = await acquireFileLease({ ...leaseOptions, record });
  try { assertCanonicalPath(directory, { kind: 'new' }); mkdirSync(directory, { mode: 0o700 }); }
  catch (error) { lease.release(); throw error; }
  const artifactRoot = join(directory, 'artifacts');
  const abort = new AbortController(), cancel = () => abort.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let accepting = false, started = null, actionRef = null, captured = null, artifacts = {}, value = null;
  let leaseReleased = false, resourcesStopped = true, unchanged = false, artifactsUnchanged = false, callbackUnsettled = false;
  const jobs = [], checks = plan.verifiers.map(row => ({ id: row.id, passed: false })), diagnostics = [];
  const fail = code => { if (!diagnostics.includes(code)) diagnostics.push(code); };
  const dispatchProcess = input => {
    assert.ok(accepting && !abort.signal.aborted, 'verification execution capability is closed');
    const supplied = captureProcessOptions(input);
    assert.ok(!['base', 'signal', 'receiptSchemaVersion'].some(key => own(supplied, key)), 'process evidence and cancellation belong to the run');
    assert.ok(jobs.length < plan.processCount, 'process not declared in verification contract');
    const base = join(directory, 'process-' + String(jobs.length + 1).padStart(3, '0'));
    const job = { base, expectedSignal: supplied.expectedSignal ?? null, receipt: null, reference: null, references: [], stopped: false, failed: false };
    jobs.push(job);
    job.promise = runVerifiedProcess({ ...supplied, base, signal: abort.signal }).then(receipt => {
      job.receipt = receipt;
      job.stopped = receipt.directChildClosed === true && receipt.directChildReaped === true &&
        receipt.groupAliveAfter === false && receipt.barrier?.settled === true;
      job.reference = reference(base + '.json');
      if (receipt.passed === true) job.references = inspectProcessEvidence(base, { expectedSignal: job.expectedSignal }).references;
      else job.failed = true;
      return receipt;
    }).catch(error => {
      job.failed = true;
      if (processFailureState(error)?.spawnAttempted === false) job.stopped = true;
      throw error;
    });
    return job.promise;
  };
  const runProcess = input => {
    let promise;
    try { promise = dispatchProcess(input); }
    catch (error) {
      if (accepting) fail('VERIFICATION_PROCESS_ADMISSION_FAILED');
      promise = Promise.reject(error);
    }
    promise.catch(() => {});
    return promise;
  };
  let identity;
  try {
    mkdirSync(artifactRoot, { mode: 0o700 }); identity = directoryIdentity(artifactRoot);
    captured = captureInputs(plan); abort.signal.throwIfAborted(); lease.assertHeld();
    const marker = reference(join(lease.registry, leaseOptions.usedName), 32 * 1024);
    started = save(join(directory, 'started.json'), { schemaVersion: SCHEMA, directory, plan, inputs: captured,
      lease: { registry: lease.registry, lockNames: leaseOptions.lockNames, usedName: leaseOptions.usedName, record: lease.record, marker } });
    accepting = true;
    try { value = await settle(action, Object.freeze({ directory, artifactRoot, signal: abort.signal, runProcess }), data); }
    finally { accepting = false; }
    await Promise.allSettled(jobs.map(job => job.promise));
    abort.signal.throwIfAborted();
    assert.equal(jobs.length, plan.processCount, 'missing declared process');
    assert.ok(jobs.every(job => !job.failed && job.receipt?.passed === true), 'owned process did not pass');
    actionRef = save(join(directory, 'action.json'), { value });
    artifacts = artifactsAt(artifactRoot, plan);
    for (const check of checks) {
      abort.signal.throwIfAborted(); lease.assertHeld();
      check.passed = await settle(verify[check.id], Object.freeze({ directory, artifactRoot, value, signal: abort.signal }), value => value === true);
      assert.equal(check.passed, true, 'required verifier did not pass');
    }
    compareEvidenceInventories(artifacts, artifactsAt(artifactRoot, plan)); artifactsUnchanged = true;
    inputsUnchanged(plan, captured); unchanged = true;
    assert.deepEqual(directoryIdentity(artifactRoot), identity, 'owned verification directory changed');
    assert.deepEqual(reference(started.file), started);
    assert.deepEqual(reference(actionRef.file), actionRef);
  } catch (error) {
    callbackUnsettled = error?.callbackSettled === false;
    fail(abort.signal.aborted ? 'VERIFICATION_CANCELLED' : 'VERIFICATION_FAILED'); abort.abort();
  }
  finally {
    accepting = false;
    await Promise.allSettled(jobs.map(job => job.promise));
    await new Promise(done => setImmediate(done));
    if (signal?.aborted) { cancel(); fail('VERIFICATION_CANCELLED'); }
    if (diagnostics.length === 0) {
      try {
        privateDirectory(directory); privateDirectory(artifactRoot);
        inputsUnchanged(plan, captured); compareEvidenceInventories(artifacts, artifactsAt(artifactRoot, plan));
        assert.deepEqual(directoryIdentity(artifactRoot), identity);
        assert.deepEqual(reference(started.file), started); assert.deepEqual(reference(actionRef.file), actionRef);
        for (const job of jobs) {
          assert.deepEqual(reference(job.base + '.json'), job.reference);
          assert.deepEqual(inspectProcessEvidence(job.base, { expectedSignal: job.expectedSignal }).references, job.references);
        }
      } catch { unchanged = false; artifactsUnchanged = false; fail('VERIFICATION_FINAL_RECHECK_FAILED'); }
    }
    resourcesStopped = !callbackUnsettled && jobs.every(job => job.stopped);
    if (resourcesStopped) {
      try { lease.release(); leaseReleased = true; } catch { fail('VERIFICATION_LEASE_RETAINED'); }
    } else fail('VERIFICATION_RESOURCES_UNVERIFIED');
    if (!leaseReleased) { try { abandonFileLease(lease); } catch { fail('VERIFICATION_HANDLE_CLEANUP_FAILED'); } }
    signal?.removeEventListener('abort', cancel);
  }
  const passed = diagnostics.length === 0 && checks.every(check => check.passed) && unchanged && artifactsUnchanged && leaseReleased;
  save(join(directory, 'result.json'), { schemaVersion: SCHEMA, directory, passed, status: passed ? 'passed' : 'failed',
    started, action: actionRef, artifacts, checks, processes: jobs.map(job => ({ base: job.base, expectedSignal: job.expectedSignal,
      reference: job.reference, references: job.references, passed: job.receipt?.passed === true && !job.failed })),
    inputsUnchanged: unchanged, artifactsUnchanged, resourcesStopped, leaseReleased, cancelled: abort.signal.aborted, diagnostics });
  return report(directory, plan, passed, checks, diagnostics);
}

/**
 * Read-only recheck against a caller-supplied plan and trusted inspectors. Never
 * acquires a lease, probes historical PIDs, loads receipt-selected code or reruns
 * an action. A private owned evidence root remains part of the trust model;
 * matching hashes are not a signature or proof of arbitrary callback semantics.
 */
export async function inspectVerificationRun(input) {
  let directory, plan, verify;
  try {
    const options = fields(input, ['directory', 'plan', 'verify']);
    directory = absolute(options.directory); plan = planData(options.plan); verify = verifierMap(options.verify, plan);
  } catch {
    return { schemaVersion: 'truthsrc.verification-report/v1', passed: false, staticSnapshot: true,
      checks: [], diagnostics: ['VERIFICATION_CONTRACT_INVALID'], runtimeVerified: false };
  }
  const checks = plan.verifiers.map(row => ({ id: row.id, passed: false }));
  try {
    privateDirectory(directory);
    const artifactRoot = join(directory, 'artifacts'); privateDirectory(artifactRoot);
    const identity = directoryIdentity(artifactRoot), signal = new AbortController().signal;
    const references = createEvidenceReferences();
    const captured = file => { const result = read(file); references.retain(result.ref, { limit: LIMIT }); return result; };
    const start = captured(join(directory, 'started.json')), result = captured(join(directory, 'result.json')).value;
    fields(start.value, ['schemaVersion', 'directory', 'plan', 'inputs', 'lease']);
    fields(result, ['schemaVersion', 'directory', 'passed', 'status', 'started', 'action', 'artifacts', 'checks', 'processes',
      'inputsUnchanged', 'artifactsUnchanged', 'resourcesStopped', 'leaseReleased', 'cancelled', 'diagnostics']);
    assert.deepEqual([start.value.schemaVersion, result.schemaVersion, start.value.directory, result.directory], [SCHEMA, SCHEMA, directory, directory]);
    assert.deepEqual(start.value.plan, plan); assert.deepEqual(result.started, start.ref);
    assert.equal(result.passed, true); assert.equal(result.status, 'passed'); assert.deepEqual(result.diagnostics, []);
    for (const key of ['inputsUnchanged', 'artifactsUnchanged', 'resourcesStopped', 'leaseReleased']) assert.equal(result[key], true);
    assert.equal(result.cancelled, false);
    assert.deepEqual(result.checks, plan.verifiers.map(row => ({ id: row.id, passed: true })));
    inputsUnchanged(plan, start.value.inputs);
    const grant = start.value.lease;
    fields(grant, ['registry', 'lockNames', 'usedName', 'record', 'marker']);
    validateFileLeaseDeclaration({ registry: grant.registry, lockNames: grant.lockNames, usedName: grant.usedName, record: grant.record });
    assert.ok(typeof grant.usedName === 'string'); privateDirectory(grant.registry);
    assert.equal(grant.marker.file, join(grant.registry, grant.usedName));
    assert.deepEqual(reference(grant.marker.file, 32 * 1024), grant.marker); references.retain(grant.marker, { limit: 32 * 1024 });
    const marker = captureEvidenceFile(grant.marker.file, { limit: 32 * 1024, parse: bytes => JSON.parse(bytes) }).value;
    assert.deepEqual(marker, grant.record); assert.equal(grant.record.verificationRun, directory);
    assert.deepEqual(grant.record.verificationContract, plan.contract);
    const action = captured(join(directory, 'action.json'));
    assert.deepEqual(result.action, action.ref); fields(action.value, ['value']);
    const artifacts = artifactsAt(artifactRoot, plan); compareEvidenceInventories(result.artifacts, artifacts);
    assert.ok(Array.isArray(result.processes)); assert.equal(result.processes.length, plan.processCount);
    for (const [index, process] of result.processes.entries()) {
      fields(process, ['base', 'expectedSignal', 'reference', 'references', 'passed']);
      assert.equal(process.base, join(directory, 'process-' + String(index + 1).padStart(3, '0')));
      assert.equal(process.passed, true); assert.deepEqual(reference(process.base + '.json'), process.reference);
      const checked = inspectProcessEvidence(process.base, { expectedSignal: process.expectedSignal });
      assert.deepEqual(checked.references, process.references);
      checked.references.forEach(ref => references.retain(ref));
    }
    for (const check of checks) {
      check.passed = await settle(verify[check.id], Object.freeze({ directory, artifactRoot, value: action.value.value, signal }), value => value === true);
      assert.equal(check.passed, true);
    }
    compareEvidenceInventories(artifacts, artifactsAt(artifactRoot, plan));
    inputsUnchanged(plan, start.value.inputs); references.assertUnchanged();
    assert.deepEqual(directoryIdentity(artifactRoot), identity);
    return report(directory, plan, true, checks, []);
  } catch { return report(directory, plan, false, checks, ['VERIFICATION_RECHECK_FAILED']); }
}
