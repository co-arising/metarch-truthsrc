import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, fchmodSync, fstatSync, fsyncSync, ftruncateSync, lstatSync, openSync, statSync, writeSync } from 'node:fs';
import { constants } from 'node:os';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual, types } from 'node:util';
import { copyImmutableData } from '../immutable-data.mjs';
import { MAX_JSON_BYTES, parseStrictJson } from '../strict-json.mjs';
import { assertCanonicalPath, captureEvidenceFile } from './files.mjs';
import { assertVerificationCallback, settleVerificationCallback } from './callbacks.mjs';

const SCHEMA = 'truthsrc.verified-process/v1';
const SANDBOX = '/usr/bin/sandbox-exec', GRACE_MS = 15_000, REAP_MS = 5_000, MAX_OUTPUT = 16 * 1024 * 1024;
const delay = ms => new Promise(done => setTimeout(done, ms));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const require = (ok, message) => { if (!ok) throw new Error(message); };
const pathText = value => typeof value === 'string' && value.isWellFormed() && isAbsolute(value) && resolve(value) === value &&
  !/[\x00-\x1f\x7f-\x9f]/u.test(value) && (sep !== '/' || !value.includes('\\'));
const schemaText = value => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 256 && value.isWellFormed() && !/[\x00-\x1f\x7f-\x9f]/u.test(value);
const monotonic = () => performance.now();
const safeData = value => {
  const pending = [value], seen = new Set();
  let nodes = 0, stringBytes = 0;
  while (pending.length) {
    const current = pending.pop();
    require(++nodes <= 100_000, 'process data exceeds node bound');
    if (typeof current === 'string') {
      stringBytes += Buffer.byteLength(current);
      require(stringBytes <= MAX_JSON_BYTES, 'process data exceeds byte bound');
    }
    if (!current || typeof current !== 'object') continue;
    require(!types.isProxy(current) && !seen.has(current), 'process data must be an unaliased JSON tree');
    seen.add(current);
    const descriptors = Object.getOwnPropertyDescriptors(current);
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key];
      require(Object.hasOwn(descriptor, 'value'), 'process data accessors forbidden');
      if (typeof key === 'string') stringBytes += Buffer.byteLength(key);
      require(stringBytes <= MAX_JSON_BYTES && pending.length < 100_000, 'process data exceeds bound');
      pending.push(descriptor.value);
    }
  }
  return copyImmutableData(value, '', () => { throw new Error('invalid process data'); });
};
const DATA_OPTIONS = ['executable', 'args', 'cwd', 'env', 'base', 'timeoutMs', 'sandbox', 'secrets',
  'expectedSignal', 'descendantExitGraceMs', 'receiptSchemaVersion'];

// Callbacks and AbortSignal are capabilities, not JSON; inspect descriptors before
// copying data so caller accessors and array iterators cannot run during admission.
export function captureProcessOptions(input = {}) {
  require(input && typeof input === 'object' && !types.isProxy(input) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'plain process options required');
  const data = Object.create(null), capabilities = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    require(typeof key === 'string' && [...DATA_OPTIONS, 'onStarted', 'signal'].includes(key) &&
      descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'invalid process option');
    if (key === 'onStarted' || key === 'signal') capabilities[key] = descriptor.value;
    else if (descriptor.value !== undefined) data[key] = descriptor.value;
  }
  const captured = safeData(data);
  require(Buffer.byteLength(JSON.stringify(captured)) <= MAX_JSON_BYTES / 2, 'process options exceed bounded metadata');
  return Object.freeze({ ...captured, ...capabilities });
}

export function captureProcessInspectionOptions(input = {}, allowed = ['schemaVersion', 'expectedSignal', 'base', 'embedded']) {
  require(input && typeof input === 'object' && !types.isProxy(input) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'plain process inspection options required');
  const data = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    require(typeof key === 'string' && allowed.includes(key) && descriptor.enumerable &&
      Object.hasOwn(descriptor, 'value'), 'invalid process inspection option');
    if (descriptor.value !== undefined) data[key] = descriptor.value;
  }
  return safeData(data);
}
const validSignal = value => typeof value === 'string' && Object.hasOwn(constants.signals, value) && constants.signals[value] > 0;
const writeAll = (fd, bytes) => { for (let n = 0; n < bytes.length;) { const count = writeSync(fd, bytes, n, bytes.length - n); require(count > 0, 'short evidence write'); n += count; } };
export function processEvidencePaths(base) {
  require(pathText(base), 'canonical process evidence base required');
  return Object.freeze({ stdout: base + '.stdout.log', stderr: base + '.stderr.log', receipt: base + '.json' });
}
const pathsFor = processEvidencePaths;
const jsonShape = value => Array.isArray(value) ? value.map(jsonShape) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonShape(entry)])) : value;
const same = (actual, expected, label) => require(isDeepStrictEqual(jsonShape(actual), jsonShape(expected)), 'process receipt mismatch: ' + label);
const keys = (value, expected, label) => {
  require(value !== null && typeof value === 'object' && !Array.isArray(value), 'invalid process receipt: ' + label);
  same(Object.keys(value).sort(), [...expected].sort(), label + ' fields');
};
const uint = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value <= max;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/**
 * Pure successful-receipt gate. Returns detached immutable JSON data; throws on
 * failure, incomplete metadata or inconsistent claims. base, when supplied, binds
 * the exact evidence names. No files, processes or recorded PIDs are inspected.
 * Hash consistency is not authenticity: callers must own/trust the evidence root.
 */
export function validateProcessReceipt(input, options = {}) {
  const { schemaVersion = SCHEMA, expectedSignal = null, base, embedded } = captureProcessInspectionOptions(options,
    ['schemaVersion', 'expectedSignal', 'base', 'embedded']);
  require(schemaText(schemaVersion), 'invalid receipt schema version');
  require(expectedSignal === null || validSignal(expectedSignal), 'invalid expected signal');
  const receipt = safeData(input);
  keys(receipt, ['schemaVersion', 'passed', 'status', 'command', 'commandSha256', 'cwd', 'envKeys', 'sandboxProfile',
    'sandboxProfileSha256', 'sandboxProfileUnchanged', 'pid', 'startedAt', 'endedAt', 'elapsedMs', 'timeoutMs', 'graceMs',
    'reapMs', 'descendantExitGraceMs', 'maxOutputBytes', 'code', 'signal', 'expectedSignal', 'expectedTermination', 'launchError',
    'timedOut', 'cancelled', 'barrier', 'mainSignals', 'groupSignals', 'terminationErrors', 'directChildClosed', 'directChildReaped',
    'leftoverGroup', 'groupAliveAfter', 'rawOutputBytes', 'outputLimitExceeded', 'outputError', 'paths', 'stdoutSha256', 'stderrSha256'], 'receipt');
  same(receipt.schemaVersion, schemaVersion, 'schemaVersion');
  same([receipt.passed, receipt.status], [true, 'passed'], 'success');
  require(pathText(receipt.cwd) && pathText(receipt.sandboxProfile), 'canonical process metadata paths required');
  require(Array.isArray(receipt.command) && receipt.command.length >= 4 &&
    receipt.command.every(value => typeof value === 'string' && !value.includes('\0')), 'complete command metadata required');
  same(receipt.command.slice(0, 2), [SANDBOX, '-p'], 'sandbox command');
  require(pathText(receipt.command[3]), 'canonical executable path required');
  for (const field of ['commandSha256', 'sandboxProfileSha256', 'stdoutSha256', 'stderrSha256'])
    require(typeof receipt[field] === 'string' && /^[a-f0-9]{64}$/u.test(receipt[field]), 'invalid process receipt hash: ' + field);
  same(hash(JSON.stringify(receipt.command)), receipt.commandSha256, 'command hash');
  same(hash(receipt.command[2]), receipt.sandboxProfileSha256, 'command profile');
  require(Array.isArray(receipt.envKeys) && receipt.envKeys.every(key => typeof key === 'string' && key.length > 0 && !/[=\0]/u.test(key)) &&
    receipt.envKeys.includes('NODE_V8_COVERAGE'), 'explicit environment metadata required');
  same(receipt.envKeys, [...new Set(receipt.envKeys)].sort(), 'environment keys');
  keys(receipt.paths, ['stdout', 'stderr', 'receipt'], 'paths');
  require(Object.values(receipt.paths).every(pathText) && receipt.paths.receipt.endsWith('.json'), 'canonical evidence paths required');
  const actualBase = base === undefined ? receipt.paths.receipt.slice(0, -5) : base;
  require(pathText(actualBase), 'canonical evidence base required');
  same(receipt.paths, pathsFor(actualBase), 'evidence paths');
  require(!Object.values(receipt.paths).includes(receipt.sandboxProfile), 'profile overlaps evidence');
  require(Number.isSafeInteger(receipt.pid) && receipt.pid > 0, 'invalid process receipt pid');
  require(timestamp(receipt.startedAt) && timestamp(receipt.endedAt) && Date.parse(receipt.endedAt) >= Date.parse(receipt.startedAt), 'invalid process timestamps');
  require(uint(receipt.elapsedMs) && uint(receipt.timeoutMs, 2147483647) && receipt.timeoutMs > 0, 'invalid process timing');
  same([receipt.graceMs, receipt.reapMs, receipt.maxOutputBytes], [GRACE_MS, REAP_MS, MAX_OUTPUT], 'supervisor bounds');
  require(uint(receipt.descendantExitGraceMs, 10_000) && (receipt.descendantExitGraceMs === 0 || expectedSignal === 'SIGKILL'), 'invalid descendant grace');
  require(uint(receipt.rawOutputBytes, MAX_OUTPUT), 'invalid process output count');
  same([receipt.code, receipt.signal, receipt.expectedSignal, receipt.expectedTermination],
    [expectedSignal === null ? 0 : null, expectedSignal, expectedSignal, true], 'expected termination');
  same([receipt.launchError, receipt.timedOut, receipt.cancelled, receipt.leftoverGroup, receipt.groupAliveAfter, receipt.terminationErrors,
    receipt.outputLimitExceeded, receipt.outputError], [null, false, null, false, false, [], false, false], 'failure barriers');
  same([receipt.directChildClosed, receipt.directChildReaped, receipt.sandboxProfileUnchanged], [true, true, true], 'completion barriers');
  keys(receipt.barrier, ['status', 'settled', 'error'], 'barrier');
  require(['passed', 'not-requested'].includes(receipt.barrier.status), 'unsuccessful process callback barrier');
  same([receipt.barrier.settled, receipt.barrier.error], [true, null], 'callback settlement');
  same(receipt.groupSignals, [], 'unexpected group cleanup');
  require(Array.isArray(receipt.mainSignals), 'invalid targeted signals');
  let lastSignalAt = Date.parse(receipt.startedAt);
  for (const row of receipt.mainSignals) {
    keys(row, ['signal', 'sent', 'at'], 'targeted signal');
    require(validSignal(row.signal) && typeof row.sent === 'boolean' && timestamp(row.at), 'invalid targeted signal metadata');
    require(Date.parse(row.at) >= lastSignalAt && Date.parse(row.at) <= Date.parse(receipt.endedAt), 'targeted signal outside invocation');
    lastSignalAt = Date.parse(row.at);
  }
  if (receipt.mainSignals.length) same(receipt.barrier.status, 'passed', 'targeted signal callback');
  if (expectedSignal !== null) {
    same(receipt.barrier.status, 'passed', 'expected signal callback');
    require(receipt.mainSignals.some(row => row.sent === true && row.signal === expectedSignal), 'expected signal was not targeted');
  }
  if (embedded !== undefined) same(receipt, copyImmutableData(embedded), 'embedded receipt');
  return receipt;
}

/** Synchronous, read-only successful evidence inspection; never probes recorded PIDs. */
export function inspectProcessEvidence(base, options = {}) {
  const { schemaVersion = SCHEMA, expectedSignal = null, embedded } = captureProcessInspectionOptions(options,
    ['schemaVersion', 'expectedSignal', 'embedded']);
  require(pathText(base), 'canonical evidence base required');
  assertCanonicalPath(dirname(base));
  const captured = captureEvidenceFile(base + '.json', { parse: parseStrictJson });
  const receipt = validateProcessReceipt(captured.value, { base, schemaVersion, expectedSignal, embedded });
  const references = [{ file: receipt.paths.receipt, bytes: captured.bytes, sha256: captured.sha256 }];
  const profile = captureEvidenceFile(receipt.sandboxProfile);
  same(profile.sha256, receipt.sandboxProfileSha256, 'profile bytes');
  references.push({ file: receipt.sandboxProfile, bytes: profile.bytes, sha256: profile.sha256 });
  let outputBytes = 0;
  for (const stream of ['stdout', 'stderr']) {
    const file = receipt.paths[stream], capturedLog = captureEvidenceFile(file, { limit: MAX_OUTPUT });
    same(capturedLog.sha256, receipt[stream + 'Sha256'], stream + ' bytes');
    outputBytes += capturedLog.bytes;
    references.push({ file, bytes: capturedLog.bytes, sha256: capturedLog.sha256 });
  }
  require(outputBytes <= MAX_OUTPUT, 'process output evidence exceeds bound');
  return copyImmutableData({ receipt, references });
}

// Retain raw lookahead ONLY in memory. Mask overlapping matches, including a
// truncated secret prefix at EOF, before any bytes reach the evidence descriptor.
function redactor(secrets, emit) {
  let pending = Buffer.alloc(0), pendingMask = Buffer.alloc(0);
  const lookahead = Math.max(1, ...secrets.map(s => s.length)) - 1;
  return (chunk, final = false) => {
    const data = Buffer.concat([pending, chunk]), end = final ? data.length : Math.max(0, data.length - lookahead);
    const mask = Buffer.alloc(data.length); pendingMask.copy(mask);
    for (const secret of secrets) {
      for (let at = data.indexOf(secret); at >= 0; at = data.indexOf(secret, at + 1)) mask.fill(1, at, at + secret.length);
      if (final) for (let n = Math.min(secret.length - 1, data.length); n > 0; n--)
        if (data.subarray(data.length - n).equals(secret.subarray(0, n))) { mask.fill(1, data.length - n); break; }
    }
    const pieces = [], visibleMask = mask.subarray(0, end);
    let cursor = 0;
    for (let at = visibleMask.indexOf(1); at >= 0; at = visibleMask.indexOf(1, cursor)) {
      pieces.push(data.subarray(cursor, at), Buffer.from('[REDACTED]'));
      const next = visibleMask.indexOf(0, at); cursor = next < 0 ? end : next;
    }
    pieces.push(data.subarray(cursor, end)); emit(Buffer.concat(pieces));
    pending = Buffer.from(data.subarray(end)); pendingMask = Buffer.from(mask.subarray(end));
  };
}

/**
 * runVerifiedProcess({executable, args=[], cwd, env, base, timeoutMs, sandbox,
 *   secrets=[], onStarted?, expectedSignal=null, descendantExitGraceMs=0, signal?,
 *   receiptSchemaVersion='truthsrc.verified-process/v1'}) -> frozen receipt.
 * sandbox: {executable:'/usr/bin/sandbox-exec', profile, profileSha256}.
 * base reserves .stdout.log/.stderr.log/.json with wx BEFORE spawn; never reuse.
 * env is explicit (not inherited); only envKeys are recorded. No secret in argv
 * or metadata. The verified profile bytes are passed with -p (no file TOCTOU).
 * onStarted({pid, signal, exited(), killMain(signal='SIGKILL'), waitForFile(path,ms)})
 * must honor signal; helpers are revoked on settlement/abort. waitForFile returns
 * a regular file's absolute path, NOT its contents or proof of barrier validity.
 * Expected termination additionally requires a successful callback/killMain call.
 * Failure returns passed:false; invalid admission/evidence I/O throws fixed errors.
 * Pending callbacks are bounded only while the event loop can run; synchronous
 * callback code must yield. A late completion is rejected after control returns.
 * Supervision covers the captured direct child/process group, not descendants
 * that deliberately detach into another group; those require an external owner.
 * Darwin only; this opt-in API never falls back to unsandboxed execution. The
 * caller owns the profile policy and must deny writes to profile/evidence paths.
 */
const failureStates = new WeakMap();
export const processFailureState = error => failureStates.get(error) ?? null;

export async function runVerifiedProcess(options = {}) {
  const lifecycle = { spawnAttempted: false };
  try { return await executeVerifiedProcess(options, lifecycle); }
  catch (error) {
    failureStates.set(error, Object.freeze({ ...lifecycle }));
    throw error;
  }
}

async function executeVerifiedProcess(options, lifecycle) {
  const { executable, args = [], cwd, env, base, timeoutMs, sandbox, secrets = [], onStarted, expectedSignal = null,
    descendantExitGraceMs = 0, signal: cancellation, receiptSchemaVersion = SCHEMA } = captureProcessOptions(options);
  require(process.platform === 'darwin' && sandbox?.executable === SANDBOX, 'OS sandbox required');
  require(schemaText(receiptSchemaVersion), 'invalid receipt schema version');
  require(Array.isArray(secrets) && secrets.every(s => typeof s === 'string' && s.length > 0 && Buffer.byteLength(s) <= 65536), 'invalid secrets');
  require([executable, cwd, base, sandbox.profile].every(pathText), 'absolute canonical paths required');
  require(Array.isArray(args) && args.every(s => typeof s === 'string' && !s.includes('\0')), 'string argv required');
  require(env && typeof env === 'object' && !Array.isArray(env) && Object.entries(env).every(([k, v]) => k && !/[=\0]/.test(k) && typeof v === 'string' && !v.includes('\0')), 'explicit string environment required');
  require(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 2147483647, 'bounded timeout required');
  require(expectedSignal === null || validSignal(expectedSignal), 'invalid expected signal');
  require(uint(descendantExitGraceMs, 10_000) &&
    (descendantExitGraceMs === 0 || expectedSignal === 'SIGKILL'), 'descendant grace requires an explicit crash signal');
  if (onStarted !== undefined) assertVerificationCallback(onStarted);
  require(cancellation === undefined || cancellation instanceof AbortSignal, 'invalid cancellation signal');
  let profile, profileSha256;
  try {
    assertCanonicalPath(dirname(base));
    const captured = captureEvidenceFile(sandbox.profile);
    profile = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(captured.value);
    profileSha256 = captured.sha256;
    require(!profile.includes('\0'), 'invalid sandbox profile');
  } catch { throw new Error('runtime evidence/profile admission failed'); }
  const profilePath = sandbox.profile;
  require(profileSha256 === sandbox.profileSha256, 'sandbox profile hash mismatch');
  const command = copyImmutableData([SANDBOX, '-p', profile, executable, ...args]), childEnv = { NODE_V8_COVERAGE: '', ...env }, envKeys = Object.keys(childEnv).sort();
  const paths = pathsFor(base);
  require(![...command, cwd, ...Object.values(paths), profilePath, receiptSchemaVersion, ...envKeys].some(text => secrets.some(secret => text.includes(secret))), 'secret forbidden in argv or metadata');
  const buffers = [...new Set(secrets)].map(s => Buffer.from(s)), fds = [], streamControls = [];
  const logDigests = [createHash('sha256'), createHash('sha256')];
  const started = Date.now(), startedClock = monotonic(), abort = new AbortController(), terminationErrors = [], groupSignals = [], mainSignals = [];
  const eventAt = () => new Date(started + Math.floor(monotonic() - startedClock)).toISOString();
  let child, pid = null, exited = false, closed = false, groupGone = false, leftoverGroup = false, stopPromise, timer, descendantDrain;
  let code = null, exitSignal = null, launchError = null, timedOut = false, cancelled = null, outputLimitExceeded = false;
  let rawBytes = 0, logBytes = 0, outputError = false, active = false, sandboxProfileUnchanged = false, outputActive = true;
  const barrier = { status: onStarted ? 'not-started' : 'not-requested', settled: !onStarted, error: null };
  const groupAlive = () => {
    if (!pid || groupGone) return false;
    try { process.kill(-pid, 0); return true; }
    catch (error) {
      if (error.code === 'ESRCH') { groupGone = true; return false; }
      if (error.code === 'EPERM') return true;
      terminationErrors.push('group-probe-failed'); return true;
    }
  };
  const sendGroup = sig => {
    if (!groupAlive()) return;
    try { process.kill(-pid, sig); groupSignals.push({ signal: sig, at: eventAt() }); }
    catch (error) { if (error.code !== 'ESRCH') terminationErrors.push('group-signal-failed'); }
  };
  const stop = () => {
    if (stopPromise) return stopPromise;
    active = false;
    if (barrier.status === 'running') barrier.status = 'aborted';
    stopPromise = Promise.resolve().then(async () => {
      abort.abort();
      sendGroup('SIGTERM');
      const until = monotonic() + GRACE_MS;
      while (pid && (!closed || groupAlive()) && monotonic() < until) await delay(25);
      if (pid && (!closed || groupAlive())) {
        sendGroup('SIGKILL');
        const reapUntil = monotonic() + REAP_MS;
        while ((!closed || groupAlive()) && monotonic() < reapUntil) await delay(25);
      }
    });
    return stopPromise;
  };
  const cancel = why => { cancelled ??= why; void stop(); };
  const onAbort = () => cancel('AbortSignal'), onInt = () => cancel('SIGINT'), onTerm = () => cancel('SIGTERM');
  const control = () => require(active && !abort.signal.aborted, 'runtime callback control is closed');
  const api = Object.freeze({
    get pid() { return pid; }, signal: abort.signal, exited: () => exited,
    killMain(sig = 'SIGKILL') {
      control(); require(validSignal(sig), 'invalid main signal');
      require(!exited && !!child?.pid, 'main child already exited');
      const sent = child.kill(sig); mainSignals.push({ signal: sig, sent, at: eventAt() });
      require(sent, 'main child signal failed'); return sent;
    },
    async waitForFile(path, ms) {
      require(typeof path === 'string' && isAbsolute(path) && Number.isSafeInteger(ms) && ms > 0, 'invalid barrier wait');
      const until = monotonic() + ms;
      for (;;) {
        control();
        try { require(statSync(path).isFile(), 'barrier is not a regular file'); return path; }
        catch (error) { if (error.code !== 'ENOENT') throw new Error('barrier file unavailable'); }
        require(!exited, 'main exited before barrier'); require(monotonic() < until, 'barrier wait timed out');
        await delay(Math.min(25, Math.max(1, until - monotonic())));
      }
    },
  });
  try {
    try { for (const path of Object.values(paths)) fds.push(openSync(path, 'wx', 0o600)); }
    catch { throw new Error('runtime evidence reservation failed'); }
    if (cancellation) cancellation.addEventListener('abort', onAbort, { once: true });
    process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
    if (cancellation?.aborted) cancel('AbortSignal');
    if (!cancelled) {
      timer = setTimeout(() => {
        if (closed && barrier.settled && !groupAlive()) return;
        timedOut = true; void stop();
      }, timeoutMs);
      try {
        lifecycle.spawnAttempted = true;
        child = spawn(SANDBOX, command.slice(1), { cwd, env: childEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
        pid = child.pid ?? null;
        child.once('error', () => { launchError = 'spawn-failed'; void stop(); });
        child.once('exit', (c, s) => {
          exited = true; code = c; exitSignal = s;
          if (groupAlive() && descendantExitGraceMs && exitSignal === expectedSignal && mainSignals.some(row => row.sent && row.signal === expectedSignal)) {
            descendantDrain = (async () => {
              const until = monotonic() + descendantExitGraceMs;
              while (groupAlive() && monotonic() < until && !stopPromise) await delay(25);
              if (groupAlive()) { leftoverGroup = true; await stop(); }
            })();
          } else {
            leftoverGroup = groupAlive();
            if (leftoverGroup) void stop();
          }
        });
        child.once('close', (c, s) => {
          closed = true; code = c; exitSignal = s;
          if (!stopPromise && monotonic() - startedClock >= timeoutMs) { timedOut = true; void stop(); }
        });
        for (const [index, stream] of [child.stdout, child.stderr].entries()) {
          const redact = redactor(buffers, bytes => {
            if (bytes.length > MAX_OUTPUT - logBytes) { outputLimitExceeded = true; void stop(); }
            const safe = bytes.subarray(0, MAX_OUTPUT - logBytes);
            writeAll(fds[index], safe); logDigests[index].update(safe); logBytes += safe.length;
          });
          const consume = (chunk, final = false) => {
            if (!outputActive) return;
            const remaining = Math.max(0, MAX_OUTPUT - rawBytes); rawBytes += chunk.length;
            if (rawBytes > MAX_OUTPUT) { outputLimitExceeded = true; void stop(); }
            try { redact(chunk.subarray(0, remaining), final); }
            catch { outputError = true; void stop(); }
          };
          const end = () => consume(Buffer.alloc(0), true);
          const error = () => { if (outputActive) { outputError = true; void stop(); } };
          stream.on('data', consume); stream.once('end', end); stream.once('error', error);
          streamControls.push({ stream, consume, end });
        }
        child.once('spawn', () => {
          if (!onStarted || abort.signal.aborted) return;
          active = true; barrier.status = 'running';
          Promise.resolve().then(() => { control(); return settleVerificationCallback(onStarted, [api], () => null); }).then(() => {
            if (active && monotonic() - startedClock >= timeoutMs) { timedOut = true; void stop(); }
            if (active) barrier.status = 'passed';
            active = false; barrier.settled = true;
          }, error => {
            const failed = active;
            active = false; barrier.settled = error?.callbackSettled !== false;
            if (failed) { barrier.status = 'failed'; barrier.error = 'onStarted callback failed'; void stop(); }
          });
        });
      } catch { launchError = 'spawn-failed'; void stop(); }
      while (!closed || !barrier.settled) {
        if (stopPromise) { await stopPromise; break; }
        await delay(25);
      }
    }
  } finally {
    if (descendantDrain) await descendantDrain;
    if (groupAlive() || (pid && !closed)) await stop();
    if (stopPromise) await stopPromise;
    // Let pending local INT/TERM events run before sealing the cancellation fact.
    await new Promise(done => setImmediate(done)); await delay(0);
    if (stopPromise) await stopPromise;
    active = false; abort.abort(); clearTimeout(timer);
    if (cancellation) cancellation.removeEventListener('abort', onAbort);
    process.off('SIGINT', onInt); process.off('SIGTERM', onTerm);
    outputActive = false;
    for (const { stream, consume, end } of streamControls) {
      stream.off('data', consume); stream.off('end', end);
      if (!stream.destroyed) stream.destroy();
    }
    if (!closed) child?.unref();
    if (fds.length !== 3) for (const fd of fds) closeSync(fd);
  }
  try {
    try { sandboxProfileUnchanged = captureEvidenceFile(profilePath).sha256 === profileSha256; } catch { /* fail closed */ }
    // A pathname must still designate the descriptor exclusively reserved before
    // spawn. Capture also rejects aliases, hardlinks, replacement and short reads.
    const owned = (file, fd) => {
      assertCanonicalPath(file, { kind: 'file' });
      const pathStat = lstatSync(file), descriptor = fstatSync(fd);
      require(pathStat.dev === descriptor.dev && pathStat.ino === descriptor.ino && pathStat.nlink === 1, 'evidence descriptor replaced');
    };
    Object.values(paths).forEach((file, index) => owned(file, fds[index]));
    require(fstatSync(fds[2]).size === 0, 'reserved receipt was modified');
    const logs = ['stdout', 'stderr'].map((stream, index) => {
      fsyncSync(fds[index]); fchmodSync(fds[index], 0o400);
      const captured = captureEvidenceFile(paths[stream], { limit: MAX_OUTPUT });
      require(captured.sha256 === logDigests[index].digest('hex'), 'evidence differs from captured output');
      owned(paths[stream], fds[index]); return captured;
    });
    require(logs.reduce((bytes, log) => bytes + log.bytes, 0) === logBytes, 'evidence log size changed');
    const groupAliveAfter = groupAlive(), directChildReaped = exited && closed && !launchError;
    const expectedTermination = expectedSignal === null ? code === 0 && exitSignal === null :
      code === null && exitSignal === expectedSignal && mainSignals.some(s => s.sent && s.signal === expectedSignal) && barrier.status === 'passed';
    const passed = !!(pid && directChildReaped && expectedTermination && !timedOut && !cancelled && !launchError &&
      !leftoverGroup && !groupAliveAfter && !terminationErrors.length && !outputLimitExceeded && !outputError && sandboxProfileUnchanged &&
      barrier.settled && ['passed', 'not-requested'].includes(barrier.status));
    const receipt = copyImmutableData({ schemaVersion: receiptSchemaVersion, passed, status: passed ? 'passed' : 'failed',
      command, commandSha256: hash(JSON.stringify(command)), cwd, envKeys, sandboxProfile: profilePath, sandboxProfileSha256: profileSha256,
      sandboxProfileUnchanged, pid, startedAt: new Date(started).toISOString(), endedAt: eventAt(), elapsedMs: Math.floor(monotonic() - startedClock),
      timeoutMs, graceMs: GRACE_MS, reapMs: REAP_MS, descendantExitGraceMs, maxOutputBytes: MAX_OUTPUT, code, signal: exitSignal, expectedSignal,
      expectedTermination, launchError, timedOut, cancelled, barrier: { ...barrier }, mainSignals, groupSignals, terminationErrors,
      directChildClosed: closed, directChildReaped, leftoverGroup, groupAliveAfter, rawOutputBytes: rawBytes, outputLimitExceeded, outputError,
      paths, stdoutSha256: logs[0].sha256, stderrSha256: logs[1].sha256 });
    const serialized = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
    require(serialized.length <= MAX_JSON_BYTES, 'process receipt exceeds bounded JSON');
    fchmodSync(fds[2], 0o400);
    writeAll(fds[2], serialized);
    fsyncSync(fds[2]);
    owned(paths.receipt, fds[2]);
    return receipt;
  } catch {
    try { ftruncateSync(fds[2], 0); fsyncSync(fds[2]); } catch { /* caller still fails; partial evidence is never accepted */ }
    throw new Error('runtime evidence finalization failed');
  }
  finally { for (const fd of fds) closeSync(fd); }
}
