import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { acquireFileLease } from '../lib/verification/lease.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'public-file-lease-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, registry: path.join(root, 'render registry'), lockNames: ['renderer.lock', 'dataset.lock'],
    record: { application: 'offline-renderer', job: 'preview', dimensions: [1.5, 2], enabled: true }, usedName: 'preview.used.json' };
}
const input = f => ({ registry: f.registry, lockNames: f.lockNames, record: f.record, usedName: f.usedName });
const code = expected => error => error.code === expected;
const entries = f => fs.readdirSync(f.registry).sort();

// Only fresh owned filesystem fixtures and one bounded child process; no services or ports.
test('generic lease preserves JSON bytes, caller lock order and detached frozen data', async t => {
  const f = fixture(t), names = ['z-resource.guard', 'a-resource.guard'];
  const record = JSON.parse('{"__proto__":{"safe":true},"kind":"renderer","amount":1.25,"then":3}');
  const expected = JSON.stringify(record) + '\n', opens = [];
  const open = fs.openSync;
  t.mock.method(fs, 'openSync', (file, flags, ...rest) => {
    if (typeof flags === 'number' && (flags & fs.constants.O_CREAT)) opens.push(file);
    return open(file, flags, ...rest);
  });
  const lease = await acquireFileLease({ ...input(f), lockNames: names, record });
  assert.deepEqual(Object.keys(lease), ['registry', 'record', 'assertHeld', 'release']);
  assert.equal(Object.isFrozen(lease), true);
  assert.notEqual(lease.record, record);
  assert.equal(Object.isFrozen(lease.record.__proto__), true);
  assert.equal(Object.getPrototypeOf(lease.record), Object.prototype);
  assert.deepEqual(lease.record, record);
  record.kind = 'mutated'; names.reverse();
  assert.equal(lease.record.kind, 'renderer');
  assert.equal(fs.lstatSync(f.registry).mode & 0o777, 0o700);
  assert.deepEqual(opens, [...['z-resource.guard', 'a-resource.guard', f.usedName].map(n => path.join(f.registry, n))]);
  for (const name of entries(f)) {
    assert.equal(fs.readFileSync(path.join(f.registry, name), 'utf8'), expected);
    assert.equal(fs.lstatSync(path.join(f.registry, name)).mode & 0o777, 0o600);
  }
  lease.assertHeld(); lease.release(); lease.release();
  assert.throws(() => lease.assertHeld(), code('FILE_LEASE_RELEASED'));
  assert.deepEqual(entries(f), [f.usedName]);
});

test('preflight holds all locks before a retained marker and snapshots options before await', async t => {
  const f = fixture(t);
  let entered, resume;
  const started = new Promise(resolve => { entered = resolve; });
  const waiting = new Promise(resolve => { resume = resolve; });
  const options = { ...input(f), preflight: async () => {
    assert.deepEqual(entries(f), [...f.lockNames].sort());
    entered(); await waiting;
  } };
  const acquisition = acquireFileLease(options);
  await started;
  await assert.rejects(acquireFileLease({ ...input(f), usedName: null }), code('FILE_LEASE_HELD'));
  options.lockNames.push('late.guard'); options.record.job = 'late'; options.usedName = 'late.used';
  options.preflight = () => { throw new Error('late callback'); };
  resume();
  const lease = await acquisition;
  assert.equal(lease.record.job, 'preview');
  assert.deepEqual(entries(f), ['dataset.lock', 'preview.used.json', 'renderer.lock']);
  lease.release();
  let probed = false;
  await assert.rejects(acquireFileLease({ ...input(f), preflight: () => { probed = true; } }), code('FILE_LEASE_USED'));
  assert.equal(probed, true); // Bank-compatible ordering: preflight precedes marker creation.
  assert.deepEqual(entries(f), [f.usedName]);
});

test('marker is optional and release capability is not reconstructed from the record', async t => {
  const f = fixture(t);
  const options = { registry: f.registry, lockNames: f.lockNames, record: {} };
  const first = await acquireFileLease(options);
  await assert.rejects(acquireFileLease(options), code('FILE_LEASE_HELD'));
  const release = first.release;
  release.call({ record: {} }); release();
  const second = await acquireFileLease(options);
  first.release(); second.assertHeld(); second.release();
  assert.deepEqual(entries(f), []);
});

test('contention never steals stale, malformed, symlink or directory locks and rolls back only owned locks', async t => {
  for (const kind of ['file', 'directory', 'symlink']) await t.test(kind, async t => {
    const f = fixture(t); fs.mkdirSync(f.registry, { mode: 0o700 });
    const foreign = path.join(f.registry, 'dataset.lock');
    if (kind === 'file') fs.writeFileSync(foreign, '{"pid":99999999,"token":"stale"}', { mode: 0o600 });
    else if (kind === 'directory') fs.mkdirSync(foreign);
    else fs.symlinkSync(path.join(f.root, 'absent'), foreign);
    const before = fs.lstatSync(foreign);
    let probed = false;
    await assert.rejects(acquireFileLease({ ...input(f), preflight: () => { probed = true; } }), error =>
      error.code === 'FILE_LEASE_HELD' && error.lockName === 'dataset.lock' && /no automatic takeover/.test(error.message));
    assert.equal(probed, false);
    assert.deepEqual(entries(f), ['dataset.lock']);
    assert.equal(fs.lstatSync(foreign).ino, before.ino);
  });
});

test('another process cannot acquire a held non-bank resource', async t => {
  const f = fixture(t), lease = await acquireFileLease(input(f));
  const module = new URL('../lib/verification/lease.mjs', import.meta.url).href;
  const script = `import { acquireFileLease } from ${JSON.stringify(module)};
    try { await acquireFileLease(${JSON.stringify(input(f))}); process.exitCode=3; }
    catch (error) { console.log(error.code); process.exitCode=2; }`;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8', timeout: 15000,
  });
  assert.equal(child.status, 2, child.stderr);
  assert.match(child.stdout, /FILE_LEASE_HELD/);
  lease.assertHeld(); lease.release();
});

test('reject invalid options and callbacks without executing getters or proxies or writing a registry', async t => {
  const f = fixture(t); let calls = 0;
  const trap = () => { calls++; throw new Error('executed'); };
  for (const options of [undefined, null, [], new Date(), Object.create(input(f)),
    { ...input(f), unknown: true }, { ...input(f), [Symbol('hidden')]: true },
    Object.defineProperty(input(f), 'registry', { get: trap, enumerable: true }),
    Object.defineProperty(input(f), 'record', { value: {}, enumerable: false }),
    new Proxy(input(f), { get: trap, ownKeys: trap, getPrototypeOf: trap })])
    await assert.rejects(acquireFileLease(options), code('FILE_LEASE_INVALID'));
  const generator = function* () { calls++; yield true; };
  const asyncGenerator = async function* () { calls++; yield true; };
  for (const preflight of [null, true, {}, generator, generator.bind(null), asyncGenerator,
    asyncGenerator.bind(null), new Proxy(() => {}, { apply: trap })])
    await assert.rejects(acquireFileLease({ ...input(f), preflight }), code('FILE_LEASE_INVALID'));
  assert.equal(calls, 0); assert.equal(fs.existsSync(f.registry), false);
});

test('records are bounded plain JSON data, never getters, proxies, toJSON or lossy values', async t => {
  const f = fixture(t); let calls = 0;
  const trap = () => { calls++; throw new Error('executed'); };
  const cycle = {}; cycle.self = cycle;
  let deep = {}; for (let i = 0; i < 130; i++) deep = { child: deep };
  for (const record of [undefined, null, [], 'record', new Date(), { value: undefined }, { value: NaN },
    { value: Infinity }, { value: 1n }, { value: Symbol('x') }, { value: () => {} },
    { toJSON: trap }, { get value() { return trap(); } }, { value: new Proxy({}, { ownKeys: trap }) },
    Object.create({ inherited: true }), Object.defineProperty({}, 'hidden', { value: 1 }),
    { [Symbol('x')]: true }, { list: [, 1] }, { list: Object.assign([1], { extra: true }) }, cycle, deep,
    { text: 'x'.repeat(32768) }, { list: Array(20000).fill(0) }])
    await assert.rejects(acquireFileLease({ ...input(f), record }), code('FILE_LEASE_INVALID'));
  assert.equal(calls, 0); assert.equal(fs.existsSync(f.registry), false);
  const record = { text: 'x'.repeat(32768 - Buffer.byteLength('{"text":""}\n')) };
  const lease = await acquireFileLease({ ...input(f), record });
  assert.equal(fs.statSync(path.join(f.registry, f.lockNames[0])).size, 32768);
  lease.release();
});

test('complete leaf names reject traversal, duplicates, aliases and marker overlap', async t => {
  const f = fixture(t);
  for (const lockNames of [[], 'resource.lock', [null], [''], ['.'], ['..'], ['../resource'], ['/resource'],
    ['a/b'], ['a\\b'], ['a\0b'], ['a\nb'], ['a\ud800'], ['a:stream'], ['NUL'], ['trim.'], ['trim '],
    ['a', 'a'], ['a', 'A'], ['café', 'café'], ['x'.repeat(256)], new Proxy([], {})])
    await assert.rejects(acquireFileLease({ ...input(f), lockNames }), code('FILE_LEASE_INVALID'));
  for (const usedName of [false, {}, '', '../used', 'RENDERER.LOCK'])
    await assert.rejects(acquireFileLease({ ...input(f), usedName }), code('FILE_LEASE_INVALID'));
  assert.equal(fs.existsSync(f.registry), false);
  const lease = await acquireFileLease({ ...input(f), lockNames: ['resource with spaces.guard', '.scratch'] });
  lease.release();
});

test('registry must be canonical, a private current-user directory and have an existing parent', async t => {
  const f = fixture(t);
  for (const registry of ['', '.', f.registry + '/', path.join(f.root, 'absent', 'registry')])
    await assert.rejects(acquireFileLease({ ...input(f), registry }));
  fs.mkdirSync(f.registry, { mode: 0o755 });
  await assert.rejects(acquireFileLease(input(f)), code('FILE_LEASE_REGISTRY'));
  assert.deepEqual(entries(f), []);
  fs.chmodSync(f.registry, 0o700);
  const alias = path.join(f.root, 'alias'); fs.symlinkSync(f.registry, alias);
  await assert.rejects(acquireFileLease({ ...input(f), registry: alias }), code('FILE_LEASE_REGISTRY'));
  const lstat = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', (file, ...args) => {
    const stat = lstat(file, ...args); if (file === f.registry) stat.uid += 1; return stat;
  });
  await assert.rejects(acquireFileLease(input(f)), code('FILE_LEASE_REGISTRY'));
  assert.deepEqual(entries(f), []);
});

test('existing case-alias resources are refused without deleting or overwriting them', async t => {
  const f = fixture(t); fs.mkdirSync(f.registry, { mode: 0o700 });
  const alias = path.join(f.registry, 'DATASET.lock'); fs.writeFileSync(alias, 'foreign');
  await assert.rejects(acquireFileLease(input(f)), code('FILE_LEASE_REGISTRY'));
  assert.deepEqual(entries(f), ['DATASET.lock']); assert.equal(fs.readFileSync(alias, 'utf8'), 'foreign');
});

test('all locks are checked before any unlink, including final lock content, mode and hardlinks', async t => {
  for (const change of ['content', 'mode', 'hardlink', 'replacement', 'oversize']) await t.test(change, async t => {
    const f = fixture(t), lease = await acquireFileLease(input(f));
    const file = path.join(f.registry, f.lockNames.at(-1)), original = fs.readFileSync(file);
    const backup = path.join(f.root, 'original');
    if (change === 'content') fs.writeFileSync(file, '{"owner":"foreign"}');
    else if (change === 'mode') fs.chmodSync(file, 0o640);
    else if (change === 'hardlink') fs.linkSync(file, backup);
    else if (change === 'oversize') fs.writeFileSync(file, 'x'.repeat(32769));
    else { fs.renameSync(file, backup); fs.writeFileSync(file, original, { mode: 0o600 }); }
    let unlinks = 0; const unlink = fs.unlinkSync;
    const mock = t.mock.method(fs, 'unlinkSync', (...args) => { unlinks++; return unlink(...args); });
    assert.throws(() => lease.assertHeld(), code('FILE_LEASE_CHANGED'));
    assert.throws(() => lease.release(), code('FILE_LEASE_CHANGED'));
    assert.equal(unlinks, 0); assert.equal(entries(f).length, 3); mock.mock.restore();
    if (change === 'mode') fs.chmodSync(file, 0o600);
    else if (change === 'hardlink') fs.unlinkSync(backup);
    else if (change === 'replacement') { fs.unlinkSync(file); fs.renameSync(backup, file); }
    else fs.writeFileSync(file, original);
    lease.release(); assert.deepEqual(entries(f), [f.usedName]);
  });
});

test('registry replacement or permission drift retains every file and allows restored owner release', async t => {
  for (const change of ['replacement', 'mode', 'ancestor']) await t.test(change, async t => {
    const f = fixture(t), lease = await acquireFileLease(input(f));
    const old = path.join(f.root, 'old-registry');
    const lstat = fs.lstatSync;
    let mock;
    if (change === 'replacement') { fs.renameSync(f.registry, old); fs.mkdirSync(f.registry, { mode: 0o700 }); }
    else if (change === 'mode') fs.chmodSync(f.registry, 0o750);
    else mock = t.mock.method(fs, 'lstatSync', (file, ...args) => {
      const stat = lstat(file, ...args); if (file === f.root) stat.ino += 1; return stat;
    });
    assert.throws(() => lease.release(), code('FILE_LEASE_CHANGED'));
    assert.equal(fs.readdirSync(change === 'replacement' ? old : f.registry).length, 3);
    if (change === 'replacement') { fs.rmdirSync(f.registry); fs.renameSync(old, f.registry); }
    else if (change === 'mode') fs.chmodSync(f.registry, 0o700);
    else mock.mock.restore();
    lease.release();
  });
});

test('open-descriptor identity drift cannot authorize unlink', async t => {
  const f = fixture(t), lease = await acquireFileLease(input(f));
  const fstat = fs.fstatSync;
  const mock = t.mock.method(fs, 'fstatSync', (...args) => { const stat = fstat(...args); stat.ino += 1; return stat; });
  assert.throws(() => lease.release(), code('FILE_LEASE_CHANGED'));
  assert.equal(entries(f).length, 3);
  mock.mock.restore(); lease.release();
});

test('invalid decorated native preflight work retains locks until it settles', async t => {
  const f = fixture(t); let finish;
  const promise = new Promise(resolve => { finish = resolve; }); promise.label = 'preflight';
  const acquisition = acquireFileLease({ ...input(f), preflight: () => promise });
  const rejection = assert.rejects(acquisition, code('FILE_LEASE_INVALID'));
  await new Promise(done => setImmediate(done));
  assert.deepEqual(entries(f), [...f.lockNames].sort());
  finish(); await rejection; assert.deepEqual(entries(f), []);
});

test('null-prototype parser values preserve JSON ownership equality', async t => {
  const f = fixture(t);
  const lease = await acquireFileLease({ ...input(f), parseRecord: bytes => Object.assign(Object.create(null), JSON.parse(bytes)) });
  lease.assertHeld(); lease.release();
});

test('failed preflight propagates its error, removes only its locks and writes no used marker', async t => {
  const f = fixture(t), failure = new Error('renderer inputs changed');
  await assert.rejects(acquireFileLease({ ...input(f), preflight: async () => { throw failure; } }), error => error === failure);
  assert.deepEqual(entries(f), []);
  const lease = await acquireFileLease(input(f)); lease.release();
});

test('preflight cannot defer work through synchronous thenables or generators', async t => {
  const f = fixture(t); let calls = 0;
  const trap = () => { calls++; throw new Error('executed'); };
  for (const result of [{ then: trap }, { get then() { return trap(); } },
    (function* () { calls++; })(),
    Object.defineProperty(Promise.resolve(), 'then', { get: trap })]) {
    await assert.rejects(acquireFileLease({ ...input(f), preflight: () => result }), code('FILE_LEASE_INVALID'));
    assert.deepEqual(entries(f), []);
  }
  assert.equal(calls, 0);
});

test('C1 proxy preflight promises retain locks without traps and close owned handles', { timeout: 5000 }, async t => {
  for (const revoked of [false, true]) await t.test(revoked ? 'revoked' : 'pending', async t => {
    const f = fixture(t), handles = new Set(), open = fs.openSync, close = fs.closeSync;
    t.mock.method(fs, 'openSync', (...args) => { const fd = open(...args); handles.add(fd); return fd; });
    t.mock.method(fs, 'closeSync', fd => { handles.delete(fd); return close(fd); });
    let finish, calls = 0, settled = false;
    const work = new Promise(resolve => { finish = resolve; }); work.then(() => { settled = true; });
    const trap = () => { calls++; throw new Error('proxy trap executed'); };
    const { proxy, revoke } = Proxy.revocable(work, { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap });
    if (revoked) revoke();
    try {
      await assert.rejects(acquireFileLease({ ...input(f), preflight: () => proxy }), error =>
        error.code === 'FILE_LEASE_CLEANUP' && error.errors[0].code === 'FILE_LEASE_INVALID' &&
        error.errors[1].code === 'FILE_LEASE_CHANGED');
      assert.equal(calls, 0); assert.equal(settled, false);
      assert.deepEqual(entries(f), [...f.lockNames].sort()); assert.equal(handles.size, 0);
      await assert.rejects(acquireFileLease(input(f)), code('FILE_LEASE_HELD'));
    } finally { finish(); await work; }
  });
});

test('preflight mutation is checked before marker; failed cleanup retains all locks and closes handles', async t => {
  const f = fixture(t), failure = new Error('preflight failed');
  const open = fs.openSync, close = fs.closeSync; const handles = new Set();
  t.mock.method(fs, 'openSync', (...args) => { const fd = open(...args); handles.add(fd); return fd; });
  t.mock.method(fs, 'closeSync', fd => { handles.delete(fd); return close(fd); });
  await assert.rejects(acquireFileLease({ ...input(f), preflight: () => {
    fs.writeFileSync(path.join(f.registry, f.lockNames.at(-1)), 'changed'); throw failure;
  } }), error => error instanceof AggregateError && error.code === 'FILE_LEASE_CLEANUP' &&
    error.errors[0] === failure && error.errors[1].code === 'FILE_LEASE_CHANGED');
  assert.deepEqual(entries(f), [...f.lockNames].sort()); assert.equal(handles.size, 0);
});

test('marker remains after post-creation failure and ordinary release unlinks in reverse order', async t => {
  const f = fixture(t), fsync = fs.fsyncSync, open = fs.openSync;
  let markerFd;
  t.mock.method(fs, 'openSync', (...args) => {
    const fd = open(...args); if (args[0] === path.join(f.registry, f.usedName)) markerFd = fd; return fd;
  });
  const mock = t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === markerFd) throw Object.assign(new Error('owned injected write failure'), { code: 'EIO' });
    return fsync(fd);
  });
  await assert.rejects(acquireFileLease(input(f)), code('FILE_LEASE_IO'));
  assert.deepEqual(entries(f), [f.usedName]); mock.mock.restore();
  const lease = await acquireFileLease({ ...input(f), usedName: null });
  const unlinked = [], unlink = fs.unlinkSync;
  t.mock.method(fs, 'unlinkSync', (file, ...args) => { unlinked.push(path.basename(file)); return unlink(file, ...args); });
  lease.release(); assert.deepEqual(unlinked, [...f.lockNames].reverse());
  assert.deepEqual(entries(f), [f.usedName]);
});
