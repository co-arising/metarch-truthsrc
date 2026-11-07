import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { performance } from 'node:perf_hooks';
import { PassThrough } from 'node:stream';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectProcessEvidence, runVerifiedProcess, validateProcessReceipt } from '../lib/verification/process.mjs';

// All evidence, including intentionally failed runs and tampered fixtures, is retained.
const root = mkdtempSync(join(realpathSync(tmpdir()), 'verified-process-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const schemaVersion = 'truthsrc.verified-process/v1';
const node = realpathSync(process.execPath);
const options = { skip: process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec'), timeout: 25_000 };
const delay = ms => new Promise(done => setTimeout(done, ms));
let sequence = 0;
function directory() { const dir = join(root, `${++sequence} space 文`); mkdirSync(dir, { mode: 0o700 }); return dir; }
function sample() {
  const dir = directory(), base = join(dir, 'process'), profile = join(dir, 'sandbox.sb');
  const text = '(version 1)\n(allow default)\n(deny network*)\n';
  const command = ['/usr/bin/sandbox-exec', '-p', text, node, '-e', 'console.log("owned")'];
  const paths = { stdout: base + '.stdout.log', stderr: base + '.stderr.log', receipt: base + '.json' };
  const receipt = { schemaVersion, passed: true, status: 'passed', command, commandSha256: hash(JSON.stringify(command)),
    cwd: dir, envKeys: ['NODE_V8_COVERAGE'], sandboxProfile: profile, sandboxProfileSha256: hash(text), sandboxProfileUnchanged: true,
    pid: 424242, startedAt: '2026-11-01T00:00:00.000Z', endedAt: '2026-11-01T00:00:00.100Z', elapsedMs: 100,
    timeoutMs: 3000, graceMs: 15000, reapMs: 5000, descendantExitGraceMs: 0, maxOutputBytes: 16 * 1024 * 1024,
    code: 0, signal: null, expectedSignal: null, expectedTermination: true, launchError: null, timedOut: false, cancelled: null,
    barrier: { status: 'not-requested', settled: true, error: null }, mainSignals: [], groupSignals: [], terminationErrors: [],
    directChildClosed: true, directChildReaped: true, leftoverGroup: false, groupAliveAfter: false, rawOutputBytes: 6,
    outputLimitExceeded: false, outputError: false, paths, stdoutSha256: hash('owned\n'), stderrSha256: hash('') };
  writeFileSync(profile, text, { flag: 'wx' });
  writeFileSync(paths.stdout, 'owned\n', { flag: 'wx' }); writeFileSync(paths.stderr, '', { flag: 'wx' });
  const save = () => writeFileSync(paths.receipt, JSON.stringify(receipt) + '\n');
  save(); return { base, receipt, save };
}
function fixture(t, source = 'console.log("owned");') {
  const cwd = directory(), profile = join(cwd, 'sandbox.sb'), base = join(cwd, 'process'), script = join(cwd, 'child.mjs');
  const text = '(version 1)\n(allow default)\n(deny network*)\n(deny file-write*)\n' +
    '(allow file-write* (subpath ' + JSON.stringify(cwd) + ') (literal "/dev/null"))\n' +
    '(deny file-write* ' + [profile, base + '.stdout.log', base + '.stderr.log', base + '.json'].map(p => '(literal ' + JSON.stringify(p) + ')').join(' ') + ')\n';
  writeFileSync(profile, text, { flag: 'wx' });
  writeFileSync(script, "import { writeFileSync, existsSync } from 'node:fs';\n" +
    "const mark = name => writeFileSync(process.env.OWNED_ROOT + '/' + name, '', {flag:'wx'});\n" + source, { flag: 'wx' });
  return { executable: node, args: [script], cwd, env: { OWNED_ROOT: cwd, HOME: cwd, TMPDIR: cwd, PATH: '/usr/bin:/bin' },
    base, timeoutMs: 3000, sandbox: { executable: '/usr/bin/sandbox-exec', profile, profileSha256: hash(text) }, signal: t.signal };
}
function sealed(receipt) {
  assert.deepEqual(JSON.parse(readFileSync(receipt.paths.receipt, 'utf8')), receipt);
  assert.equal(receipt.commandSha256, hash(JSON.stringify(receipt.command)));
  assert.equal(receipt.stdoutSha256, hash(readFileSync(receipt.paths.stdout)));
  assert.equal(receipt.stderrSha256, hash(readFileSync(receipt.paths.stderr)));
  assert.equal(receipt.groupAliveAfter, false);
  assert.ok(Object.isFrozen(receipt) && Object.isFrozen(receipt.command) && Object.isFrozen(receipt.barrier));
  for (const file of Object.values(receipt.paths)) assert.equal(statSync(file).mode & 0o777, 0o400);
  return receipt;
}

test('pure validation detaches immutable data without touching the caller', () => {
  const { base, receipt } = sample();
  const checked = validateProcessReceipt(receipt, { base });
  assert.deepEqual(checked, receipt); assert.notEqual(checked, receipt);
  assert.ok(Object.isFrozen(checked) && Object.isFrozen(checked.command) && Object.isFrozen(checked.paths));
  assert.equal(Object.isFrozen(receipt), false);
  receipt.command.push('later mutation'); assert.equal(checked.command.length, 6);
});

test('all receipt fields are mandatory; malformed data and spoofed success are rejected', () => {
  const { base, receipt } = sample();
  for (const key of Object.keys(receipt)) {
    const bad = structuredClone(receipt); delete bad[key];
    assert.throws(() => validateProcessReceipt(bad, { base }), undefined, 'missing ' + key);
  }
  const changes = [
    r => { r.passed = 'true'; }, r => { r.passed = false; }, r => { r.status = 'failed'; },
    r => { r.code = 1; }, r => { r.signal = 'SIGKILL'; }, r => { r.expectedTermination = false; },
    r => { r.launchError = 'spawn-failed'; }, r => { r.timedOut = true; }, r => { r.cancelled = 'AbortSignal'; },
    r => { r.directChildClosed = false; }, r => { r.directChildReaped = false; }, r => { r.leftoverGroup = true; },
    r => { r.groupAliveAfter = true; }, r => { r.outputLimitExceeded = true; }, r => { r.outputError = true; },
    r => { r.terminationErrors = ['group-probe-failed']; }, r => { r.sandboxProfileUnchanged = false; },
    r => { r.barrier.settled = false; }, r => { r.barrier.status = 'running'; }, r => { r.barrier.error = 'failed'; },
    r => { r.pid = 0; }, r => { r.pid = 1.1; }, r => { r.timeoutMs = 0; }, r => { r.graceMs = 1; },
    r => { r.reapMs = 1; }, r => { r.descendantExitGraceMs = 1; }, r => { r.maxOutputBytes++; },
    r => { r.elapsedMs = -1; }, r => { r.startedAt = 'yesterday'; }, r => { r.endedAt = '2026-01-01T00:00:00.000Z'; },
    r => { r.rawOutputBytes = -1; }, r => { r.envKeys = ['NODE_V8_COVERAGE', 'NODE_V8_COVERAGE']; },
    r => { r.envKeys = []; }, r => { r.env = { SECRET: 'must not be accepted' }; },
    r => { r.groupSignals = [{ signal: 'SIGTERM', at: r.startedAt }]; },
    r => { r.mainSignals = [{ signal: 'BAD', sent: true, at: r.startedAt }]; },
    r => { r.commandSha256 = '0'.repeat(64); }, r => { r.command = []; },
    r => { r.command[0] = node; r.commandSha256 = hash(JSON.stringify(r.command)); },
    r => { r.command[1] = '-f'; r.commandSha256 = hash(JSON.stringify(r.command)); },
    r => { r.command[2] += '(allow network*)'; r.commandSha256 = hash(JSON.stringify(r.command)); },
    r => { r.command[3] = './node'; r.commandSha256 = hash(JSON.stringify(r.command)); },
    r => { r.cwd += '/.'; }, r => { r.cwd += String.fromCharCode(0x85); }, r => { r.cwd += '\ud800'; }, r => { r.cwd += '\\alias'; },
    r => { r.sandboxProfile += '/..'; }, r => { r.paths.stdout = r.paths.stderr; },
    r => { r.paths.receipt += '\n'; }, r => { r.stdoutSha256 = 'x'; }, r => { r.schemaVersion = 'other/v1'; },
  ];
  changes.forEach((change, index) => { const bad = structuredClone(receipt); change(bad);
    assert.throws(() => validateProcessReceipt(bad, { base }), undefined, 'mutation ' + index); });
  assert.throws(() => validateProcessReceipt(null));
  let getterCalls = 0; const accessor = { get passed() { getterCalls++; return true; } };
  assert.throws(() => validateProcessReceipt(accessor)); assert.equal(getterCalls, 0);
  assert.throws(() => validateProcessReceipt(new Proxy(receipt, {})));
});

test('expected signal requires caller agreement, passed barrier and targeted signal', () => {
  const { base, receipt } = sample();
  Object.assign(receipt, { code: null, signal: 'SIGKILL', expectedSignal: 'SIGKILL', descendantExitGraceMs: 1000,
    barrier: { status: 'passed', settled: true, error: null }, mainSignals: [{ signal: 'SIGKILL', sent: true, at: receipt.startedAt }] });
  assert.deepEqual(validateProcessReceipt(receipt, { base, expectedSignal: 'SIGKILL' }), receipt);
  assert.throws(() => validateProcessReceipt(receipt, { base }));
  for (const change of [r => { r.mainSignals = []; }, r => { r.mainSignals[0].sent = false; },
    r => { r.mainSignals[0].signal = 'SIGTERM'; }, r => { r.barrier.status = 'not-requested'; }]) {
    const bad = structuredClone(receipt); change(bad);
    assert.throws(() => validateProcessReceipt(bad, { base, expectedSignal: 'SIGKILL' }));
  }
});

test('static inspection binds all references and embedded data, with no PID operations', t => {
  const { base, receipt } = sample();
  t.mock.method(process, 'kill', () => { assert.fail('static receipt inspection must never probe a PID'); });
  const result = inspectProcessEvidence(base, { embedded: structuredClone(receipt) });
  assert.deepEqual(result.receipt, receipt); assert.equal(result instanceof Promise, false);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.references));
  assert.deepEqual(result.references.map(r => r.file).sort(), [...Object.values(receipt.paths), receipt.sandboxProfile].sort());
  for (const ref of result.references) {
    const bytes = readFileSync(ref.file); assert.equal(ref.bytes, bytes.length); assert.equal(ref.sha256, hash(bytes));
  }
  assert.throws(() => inspectProcessEvidence(base, { embedded: { ...receipt, pid: 123 } }));
  assert.throws(() => inspectProcessEvidence(base, { embedded: null }));
  assert.throws(() => inspectProcessEvidence(base, { expectedSignal: 'SIGKILL' }));
  receipt.schemaVersion = 'custom.process/v1'; writeFileSync(base + '.json', JSON.stringify(receipt));
  assert.throws(() => inspectProcessEvidence(base));
  assert.equal(inspectProcessEvidence(base, { schemaVersion: receipt.schemaVersion }).receipt.schemaVersion, receipt.schemaVersion);
});

for (const file of ['stdout', 'stderr', 'profile']) test('static inspection rejects changed ' + file, () => {
  const { base, receipt } = sample();
  writeFileSync(file === 'profile' ? receipt.sandboxProfile : receipt.paths[file], 'changed');
  assert.throws(() => inspectProcessEvidence(base));
});

for (const kind of ['duplicate-key', 'invalid-utf8', 'fraction', 'missing-command']) test('strict report parsing rejects ' + kind, () => {
  const { base, receipt } = sample();
  let bytes = JSON.stringify(receipt);
  if (kind === 'duplicate-key') bytes = bytes.replace('"passed":true', '"passed":false,"passed":true');
  if (kind === 'invalid-utf8') bytes = Buffer.concat([Buffer.from(bytes.slice(0, -1) + ',"foreign":"'), Buffer.from([0xff]), Buffer.from('"}')]);
  if (kind === 'fraction') bytes = bytes.replace('"pid":424242', '"pid":424242.0');
  if (kind === 'missing-command') { delete receipt.command; bytes = JSON.stringify(receipt); }
  writeFileSync(base + '.json', bytes); assert.throws(() => inspectProcessEvidence(base));
});

for (const kind of ['base-alias', 'ancestor-symlink', 'leaf-symlink', 'hardlink']) test('static inspection rejects unsafe ' + kind, () => {
  const { base, receipt } = sample();
  let inspectBase = base;
  if (kind === 'base-alias') inspectBase = receipt.cwd + '/./process';
  if (kind === 'ancestor-symlink') { const alias = join(directory(), 'alias'); symlinkSync(receipt.cwd, alias); inspectBase = join(alias, 'process'); }
  if (kind === 'leaf-symlink') { renameSync(receipt.paths.stdout, receipt.paths.stdout + '.original'); symlinkSync(receipt.paths.stdout + '.original', receipt.paths.stdout); }
  if (kind === 'hardlink') linkSync(receipt.paths.stderr, receipt.paths.stderr + '.alias');
  assert.throws(() => inspectProcessEvidence(inspectBase));
});

test('real non-bank Node run seals evidence; inspector is static after completion', options, async t => {
  const f = fixture(t), receipt = sealed(await runVerifiedProcess(f));
  assert.equal(receipt.schemaVersion, schemaVersion); assert.equal(receipt.passed, true);
  assert.deepEqual(inspectProcessEvidence(f.base, { embedded: receipt }).receipt, receipt);
  const customized = fixture(t);
  assert.equal(sealed(await runVerifiedProcess({ ...customized, receiptSchemaVersion: 'consumer.process/v1' })).schemaVersion, 'consumer.process/v1');
});

test('Seatbelt actually denies writes outside its owned root and network access', options, async t => {
  const outside = join(directory(), 'forbidden');
  const f = fixture(t, `import { createConnection } from 'node:net';
let denied = false;
try { writeFileSync(process.env.OUTSIDE, 'forbidden', {flag:'wx'}); } catch (error) { denied = error.code === 'EPERM' || error.code === 'EACCES'; }
if (!denied) throw new Error('write confinement missing');
await new Promise((resolve, reject) => {
  const socket = createConnection({host:'127.0.0.1', port:9});
  socket.once('connect', () => { socket.destroy(); reject(new Error('network confinement missing')); });
  socket.once('error', error => error.code === 'EPERM' || error.code === 'EACCES' ? resolve() : reject(error));
});`);
  f.env.OUTSIDE = outside;
  const receipt = sealed(await runVerifiedProcess(f)); assert.equal(receipt.passed, true); assert.equal(existsSync(outside), false);
});

test('targeted signal, callback settlement and revoked controls are preserved', options, async t => {
  const f = fixture(t, "mark('ready'); setInterval(() => {}, 1000);"); let handle;
  const receipt = sealed(await runVerifiedProcess({ ...f, expectedSignal: 'SIGKILL', onStarted: async api => {
    handle = api; await api.waitForFile(join(f.cwd, 'ready'), 1500); api.killMain();
  } }));
  assert.equal(receipt.passed, true); assert.deepEqual(receipt.groupSignals, []);
  assert.deepEqual(inspectProcessEvidence(f.base, { expectedSignal: 'SIGKILL' }).receipt, receipt);
  assert.throws(() => handle.killMain(), /control is closed/);
});

test('timeout bounds uncooperative callback and retains a failed receipt', options, async t => {
  const f = fixture(t, 'setInterval(() => {}, 1000);');
  const receipt = sealed(await runVerifiedProcess({ ...f, timeoutMs: 250, onStarted: () => new Promise(() => {}) }));
  assert.equal(receipt.passed, false); assert.equal(receipt.timedOut, true); assert.equal(receipt.barrier.settled, false);
  assert.throws(() => inspectProcessEvidence(f.base));
});

test('cancellation and nonzero exits cannot be relabelled passed', options, async t => {
  const nonzero = fixture(t, 'process.exitCode = 7;');
  assert.equal(sealed(await runVerifiedProcess(nonzero)).passed, false);
  const f = fixture(t, "mark('ready'); setInterval(() => {}, 1000);"), controller = new AbortController();
  const receipt = sealed(await runVerifiedProcess({ ...f, signal: controller.signal, onStarted: async api => {
    await api.waitForFile(join(f.cwd, 'ready'), 1500); controller.abort('not recorded');
  } }));
  assert.equal(receipt.passed, false); assert.equal(receipt.cancelled, 'AbortSignal');
  assert.equal(JSON.stringify(receipt).includes('not recorded'), false);
});

test('redaction precedes disk and covers split UTF-8 plus truncated EOF', options, async t => {
  const secret = 'public-test-秘密-token-529831';
  const f = fixture(t, `const token = Buffer.from(process.env.TOKEN);
process.stdout.write(token.subarray(0, 14)); mark('prefix');
await new Promise(done => { const tick = setInterval(() => { if (existsSync(process.env.OWNED_ROOT + '/continue')) {clearInterval(tick);done();} }, 10); });
process.stdout.write(token.subarray(14)); process.stderr.write(token.subarray(0, 14));`);
  f.env.TOKEN = secret;
  const receipt = sealed(await runVerifiedProcess({ ...f, secrets: [secret], onStarted: async api => {
    await api.waitForFile(join(f.cwd, 'prefix'), 1500); await delay(40);
    assert.equal(readFileSync(f.base + '.stdout.log', 'utf8').includes('public-test-'), false);
    writeFileSync(join(f.cwd, 'continue'), '', { flag: 'wx' });
  } }));
  assert.equal(receipt.passed, true);
  for (const file of Object.values(receipt.paths)) assert.equal(readFileSync(file, 'utf8').includes('public-test-'), false);
  assert.match(readFileSync(receipt.paths.stdout, 'utf8'), /\[REDACTED\]/);
  assert.match(readFileSync(receipt.paths.stderr, 'utf8'), /\[REDACTED\]/);
});

test('sandbox mismatch, metadata secret and evidence collisions fail before spawn', options, async t => {
  for (const kind of ['wrapper', 'profile', 'secret', 'stdout.log', 'stderr.log', 'json']) {
    const f = fixture(t, "mark('started');");
    if (kind === 'wrapper') f.sandbox.executable = node;
    else if (kind === 'profile') f.sandbox.profileSha256 = '0'.repeat(64);
    else if (kind === 'secret') { f.secrets = ['test-only-sensitive']; f.args.push(f.secrets[0]); }
    else writeFileSync(f.base + '.' + kind, 'keep', { flag: 'wx' });
    await assert.rejects(runVerifiedProcess(f)); assert.equal(existsSync(join(f.cwd, 'started')), false);
    if (['stdout.log', 'stderr.log', 'json'].includes(kind)) assert.equal(readFileSync(f.base + '.' + kind, 'utf8'), 'keep');
  }
});

test('changed profile and replaced evidence descriptors cannot produce accepted evidence', options, async t => {
  const f = fixture(t);
  const failed = sealed(await runVerifiedProcess({ ...f, onStarted: () => writeFileSync(f.sandbox.profile, '\n', { flag: 'a' }) }));
  assert.equal(failed.passed, false); assert.equal(failed.sandboxProfileUnchanged, false);
  const replaced = fixture(t);
  await assert.rejects(runVerifiedProcess({ ...replaced, onStarted: () => {
    renameSync(replaced.base + '.stdout.log', replaced.base + '.stdout.original');
    writeFileSync(replaced.base + '.stdout.log', 'substituted', { flag: 'wx' });
  } }), /evidence finalization failed/);
  assert.throws(() => inspectProcessEvidence(replaced.base));
});

test('launch admission rejects custom iterators and getters before their code can execute', options, async t => {
  const secret = 'synthetic-sensitive-option-key-9468';
  for (const field of ['args', 'secrets']) {
    const f = fixture(t), values = field === 'args' ? [f.args[0]] : [secret];
    let calls = 0;
    Object.defineProperty(values, Symbol.iterator, { value() { calls++; throw new Error(secret); } });
    f[field] = values;
    await assert.rejects(runVerifiedProcess(f), error => !error.message.includes(secret));
    assert.equal(calls, 0); assert.equal(existsSync(f.base + '.json'), false);
  }
  const f = fixture(t); let calls = 0;
  Object.defineProperty(f.env, secret, { enumerable: true, get() { calls++; throw new Error(secret); } });
  await assert.rejects(runVerifiedProcess(f), error => !error.message.includes(secret));
  assert.equal(calls, 0); assert.equal(existsSync(f.base + '.json'), false);
});

test('inspection options cannot execute getters that mutate receipt claims', () => {
  const { base, receipt } = sample(); receipt.passed = false;
  let calls = 0;
  const options = { get schemaVersion() { calls++; receipt.passed = true; return schemaVersion; } };
  assert.throws(() => validateProcessReceipt(receipt, options));
  assert.throws(() => inspectProcessEvidence(base, options));
  assert.equal(calls, 0); assert.equal(receipt.passed, false);
});

test('a callback that yields then blocks beyond its deadline cannot pass', options, async t => {
  const f = fixture(t);
  const receipt = sealed(await runVerifiedProcess({ ...f, timeoutMs: 500, onStarted: async api => {
    while (!api.exited()) await delay(10);
    await delay(30);
    const until = performance.now() + 650;
    while (performance.now() < until) { /* bounded synchronous validation */ }
  } }));
  assert.equal(receipt.passed, false); assert.equal(receipt.timedOut, true);
  assert.throws(() => inspectProcessEvidence(f.base));
});

test('shared-reference graphs, oversized metadata and negative zero are rejected before launch', options, async t => {
  const shared = { value: true };
  assert.throws(() => validateProcessReceipt({ left: shared, right: shared }), /JSON tree/);
  for (const extra of [{ receiptSchemaVersion: 's'.repeat(8 * 1024 * 1024) }, { descendantExitGraceMs: -0 }]) {
    const f = fixture(t);
    await assert.rejects(runVerifiedProcess({ ...f, ...extra }));
    assert.equal(existsSync(f.base + '.json'), false);
  }
});

test('null-prototype JSON records compare by serialized fields, not object prototype', () => {
  const { base, receipt } = sample();
  receipt.paths = Object.assign(Object.create(null), receipt.paths);
  const input = Object.assign(Object.create(null), receipt);
  assert.doesNotThrow(() => validateProcessReceipt(input, { base }));
  assert.doesNotThrow(() => validateProcessReceipt(JSON.parse(JSON.stringify(input)), { embedded: input }));
});

test('reap exhaustion revokes stream writers before releasing owned evidence descriptors', options, async t => {
  const f = fixture(t), child = new EventEmitter();
  child.pid = 888888; child.stdout = new PassThrough(); child.stderr = new PassThrough();
  let unreferenced = false, clock = 0;
  child.unref = () => { unreferenced = true; };
  t.mock.method(childProcess, 'spawn', () => {
    setImmediate(() => { child.emit('spawn'); child.emit('exit', 0, null); });
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  t.mock.method(process, 'kill', () => { throw Object.assign(new Error('owned group absent'), { code: 'ESRCH' }); });
  t.mock.method(performance, 'now', () => { clock += 25000; return clock; });
  const receipt = await runVerifiedProcess({ ...f, timeoutMs: 50 });
  assert.equal(receipt.passed, false); assert.equal(receipt.directChildClosed, false);
  assert.equal(child.stdout.listenerCount('data'), 0); assert.equal(child.stderr.listenerCount('data'), 0);
  assert.equal(child.stdout.destroyed, true); assert.equal(child.stderr.destroyed, true); assert.equal(unreferenced, true);
  child.stdout.emit('data', Buffer.from('late-owned-output'));
  child.stdout.emit('end');
  assert.equal(readFileSync(receipt.paths.stdout, 'utf8'), '');
});

test('monotonic termination budgets do not follow a backwards wall-clock adjustment', options, async t => {
  const f = fixture(t), child = new EventEmitter();
  child.pid = 888887; child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.unref = () => {};
  let gone = false, clock = 0, wall = 1762000000000;
  const signals = [];
  t.mock.method(childProcess, 'spawn', () => { setImmediate(() => child.emit('spawn')); return child; });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  t.mock.method(Date, 'now', () => { wall -= 60000; return wall; });
  t.mock.method(performance, 'now', () => { clock += 16000; return clock; });
  t.mock.method(process, 'kill', (_pid, signal) => {
    if (gone) throw Object.assign(new Error('owned group absent'), { code: 'ESRCH' });
    if (signal !== 0) signals.push(signal);
    if (signal === 'SIGKILL') {
      gone = true; child.stdout.end(); child.stderr.end(); child.emit('exit', null, signal); child.emit('close', null, signal);
    }
    return true;
  });
  const receipt = await runVerifiedProcess({ ...f, timeoutMs: 50 });
  assert.equal(receipt.passed, false); assert.equal(receipt.timedOut, true);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.ok(receipt.elapsedMs >= 0);
});

test('same-inode equal-size log replacement is not accepted as captured output', options, async t => {
  const f = fixture(t, "console.log('owned');");
  await assert.rejects(runVerifiedProcess({ ...f, onStarted: async api => {
    while (!api.exited()) await delay(10);
    await delay(20);
    writeFileSync(f.base + '.stdout.log', 'other\n');
  } }), /evidence finalization failed/);
  assert.throws(() => inspectProcessEvidence(f.base));
});

test.after(() => console.log('Owned public process evidence retained at ' + root));
