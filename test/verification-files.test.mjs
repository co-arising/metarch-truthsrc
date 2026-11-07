import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assertCanonicalPath, captureEvidenceFile } from '../lib/verification/files.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t, text = 'evidence') {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'truthsrc-files-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'input');
  fs.writeFileSync(file, text);
  return { root, file };
}
const badOptions = [null, false, 1, 'options', [], new Date(), Object.create({ limit: 0 }),
  { unknown: true }, Object.defineProperty({}, 'limit', { value: 0 }), { [Symbol('policy')]: true },
  new Proxy({}, { ownKeys() { throw new Error('proxy executed'); } })];

// All filesystem writes/signals in this suite are confined to fresh owned data.
test('public paths admit spaces, Unicode and .scratch without bank filename policy', t => {
  const { root } = fixture(t);
  fs.mkdirSync(path.join(root, '資料 café space'));
  const directory = path.join(root, fs.readdirSync(root).find(name => name !== 'input'));
  fs.mkdirSync(path.join(directory, '.scratch'));
  const file = path.join(directory, '.scratch', 'ordinary name.txt');
  fs.writeFileSync(file, '€ 中文');
  assert.equal(assertCanonicalPath(directory), directory);
  assert.equal(assertCanonicalPath(file, { kind: 'file' }), file);
  assert.equal(captureEvidenceFile(file).value.toString(), '€ 中文');
  assert.equal(assertCanonicalPath(path.parse(root).root), path.parse(root).root);
});

test('new means absent leaf only; existing and aliased destinations are refused', t => {
  const { root, file } = fixture(t);
  const absent = path.join(root, 'new name');
  assert.equal(assertCanonicalPath(absent, { kind: 'new' }), absent);
  assert.equal(fs.existsSync(absent), false);
  for (const input of [file, path.join(root, 'INPUT')])
    assert.throws(() => assertCanonicalPath(input, { kind: 'new' }), /exists or aliases/);
  assert.throws(() => assertCanonicalPath(path.join(root, 'absent', 'leaf'), { kind: 'new' }));
  assert.throws(() => assertCanonicalPath(path.parse(root).root, { kind: 'new' }));
});

test('canonical spelling refuses relative, normalized, control and wrong-type paths', t => {
  const { root, file } = fixture(t);
  const wrong = ['', 'input', '.', root + '/./input', root + '/../input', root + '//input', file + '/',
    root + '/bad\0name', root + '/line\nfeed', root + '/delete\x7f', root + '/control\x85', root + '/bad\ud800',
    root + '/back\\slash', 'C:\\evidence\\input', 'C:input', '\\\\server\\share\\input'];
  for (const value of wrong) assert.throws(() => assertCanonicalPath(value, { kind: 'file' }), undefined, JSON.stringify(value));
  for (const value of [null, 1, {}, Buffer.from(file)]) assert.throws(() => assertCanonicalPath(value));
  assert.throws(() => assertCanonicalPath(file), /unexpected path type/);
  assert.throws(() => assertCanonicalPath(root, { kind: 'file' }), /unexpected path type/);
  assert.throws(() => captureEvidenceFile(root), /unexpected path type/);
});

test('reject malformed path/capture options before opening or invoking accessors', t => {
  const { file } = fixture(t);
  let getters = 0;
  const getter = { get limit() { getters++; return 1; } };
  for (const input of [...badOptions, getter]) assert.throws(() => captureEvidenceFile(file, input));
  for (const input of [...badOptions, { kind: 'unknown' }, { kind: null }, { limit: 4 }])
    assert.throws(() => assertCanonicalPath(file, input));
  for (const limit of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '8', null, 8n])
    assert.throws(() => captureEvidenceFile(file, { limit }), /byte limit/);
  for (const allowHardlinks of [null, 1, 'true', {}, [], new Boolean(true)])
    assert.throws(() => captureEvidenceFile(file, { allowHardlinks }), /allowHardlinks/);
  for (const parse of [null, false, 1, 'json', {}])
    assert.throws(() => captureEvidenceFile(file, { parse }), /synchronous function/);
  assert.equal(getters, 0);
});

test('reject case/NFC aliases in every directory component and at the leaf', t => {
  const { root } = fixture(t);
  const directory = path.join(root, 'MixedCase');
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'input'), 'a');
  assert.throws(() => captureEvidenceFile(path.join(root, 'mixedcase', 'input')), /filesystem alias/);
  assert.throws(() => assertCanonicalPath(path.join(root, 'mixedcase', 'new'), { kind: 'new' }), /filesystem alias/);
  fs.mkdirSync(path.join(root, 'café'));
  const exact = fs.readdirSync(root).find(name => name.normalize('NFC') === 'café');
  fs.writeFileSync(path.join(root, exact, 'input'), 'a');
  const alias = exact === exact.normalize('NFC') ? exact.normalize('NFD') : exact.normalize('NFC');
  assert.throws(() => captureEvidenceFile(path.join(root, alias, 'input')), /filesystem alias/);
  fs.writeFileSync(path.join(directory, 'café'), 'a');
  const leaf = fs.readdirSync(directory).find(name => name.normalize('NFC') === 'café');
  const leafAlias = leaf === leaf.normalize('NFC') ? leaf.normalize('NFD') : leaf.normalize('NFC');
  assert.throws(() => captureEvidenceFile(path.join(directory, leafAlias)), /filesystem alias/);
});

test('reject colliding directory and leaf entries even where the host cannot create both', t => {
  const { root, file } = fixture(t);
  fs.mkdirSync(path.join(root, 'café'));
  const unicode = fs.readdirSync(root).find(name => name.normalize('NFC') === 'café');
  fs.writeFileSync(path.join(root, unicode, 'record'), 'a');
  const readdir = fs.readdirSync;
  let collision = 'case';
  t.mock.method(fs, 'readdirSync', (directory, ...args) => {
    const names = readdir(directory, ...args);
    if (directory === root) return [...names, collision === 'case' ? 'INPUT' :
      unicode === unicode.normalize('NFC') ? unicode.normalize('NFD') : unicode.normalize('NFC')];
    return names;
  });
  assert.throws(() => captureEvidenceFile(file), /filesystem alias/);
  collision = 'NFC';
  assert.throws(() => captureEvidenceFile(path.join(root, unicode, 'record')), /filesystem alias/);
});

test('symlinks at leaf/ancestor and dangling new destinations are rejected', { skip: process.platform === 'win32' }, t => {
  const { root, file } = fixture(t);
  const alias = path.join(root, 'alias'), dirAlias = path.join(root, 'directory-alias');
  fs.symlinkSync(file, alias);
  fs.symlinkSync(root, dirAlias);
  fs.symlinkSync(path.join(root, 'absent'), path.join(root, 'dangling'));
  for (const input of [alias, path.join(dirAlias, 'input')])
    assert.throws(() => captureEvidenceFile(input, { allowHardlinks: true }), /symlink/);
  assert.throws(() => assertCanonicalPath(path.join(root, 'dangling'), { kind: 'new' }), /exists or aliases/);
});

test('FIFO rejected before open; nonblocking open also protects replaced leaves', { skip: process.platform === 'win32' }, t => {
  const { root, file } = fixture(t);
  const fifo = path.join(root, 'fifo');
  assert.equal(spawnSync('mkfifo', [fifo], { timeout: 2000 }).status, 0);
  assert.throws(() => captureEvidenceFile(fifo), /unexpected path type/);
  const open = fs.openSync;
  t.mock.method(fs, 'openSync', (name, flags, ...args) => {
    if (name === file) {
      assert.notEqual(flags & fs.constants.O_NONBLOCK, 0);
      fs.renameSync(file, path.join(root, 'original'));
      fs.renameSync(fifo, file);
    }
    return open(name, flags, ...args);
  });
  assert.throws(() => captureEvidenceFile(file), /bounded regular file/);
});

test('hardlinks default to false; explicit boolean or strict true callback is required', t => {
  const { root, file } = fixture(t);
  fs.linkSync(file, path.join(root, 'hardlink'));
  assert.equal(assertCanonicalPath(file, { kind: 'file' }), file);
  assert.throws(() => captureEvidenceFile(file), /non-hardlinked/);
  assert.throws(() => captureEvidenceFile(file, { allowHardlinks: false }), /non-hardlinked/);
  assert.equal(captureEvidenceFile(file, { allowHardlinks: true }).value.toString(), 'evidence');
  let called = 0;
  const actual = fs.statSync(file);
  assert.equal(captureEvidenceFile(file, { allowHardlinks: stat => {
    called++;
    assert.equal(stat.ino, actual.ino);
    assert.equal(stat.dev, actual.dev);
    assert.equal(stat.nlink, 2);
    assert.equal(stat.isFile(), true);
    assert.equal(Object.isFrozen(stat), true);
    return true;
  } }).bytes, 8);
  assert.equal(called, 1);
  for (const value of [false, undefined, null, 1, 'true', {}, [], new Boolean(true), Promise.resolve(true)])
    assert.throws(() => captureEvidenceFile(file, { allowHardlinks: () => value }), /non-hardlinked/);
  assert.throws(() => captureEvidenceFile(file, { allowHardlinks: stat => { stat.nlink = 1; return true; } }), TypeError);
  const error = new Error('policy failure');
  assert.throws(() => captureEvidenceFile(file, { allowHardlinks: () => { throw error; } }), thrown => thrown === error);
});

test('callbacks cannot be async, generators or proxies even for a single-link file', t => {
  const { file } = fixture(t);
  let calls = 0;
  const deferred = [async () => { calls++; return true; }, function* () { calls++; yield true; },
    async function* () { calls++; yield true; }];
  const invalid = [...deferred, ...deferred.map(callback => callback.bind(null)),
    new Proxy(() => true, { apply() { calls++; return true; } })];
  for (const callback of invalid) for (const key of ['parse', 'allowHardlinks'])
    assert.throws(() => captureEvidenceFile(file, { [key]: callback }), /synchronous function/);
  assert.equal(calls, 0);
  captureEvidenceFile(file, { allowHardlinks: () => { throw new Error('single link needs no exception'); } });
  assert.equal(captureEvidenceFile(file, { parse: (function (bytes) { return bytes.toString(); }).bind(null) }).value, 'evidence');
});

test('exact bounds, byte counts and SHA; parser receives the same once-read Buffer', t => {
  const input = Buffer.from('a€z');
  const { file } = fixture(t, input);
  const read = fs.readSync, open = fs.openSync;
  const calls = [], opens = [];
  t.mock.method(fs, 'openSync', (...args) => { opens.push(args); return open(...args); });
  t.mock.method(fs, 'readSync', (fd, buffer, offset, length, position) => {
    calls.push({ buffer, offset, length, position });
    return read(fd, buffer, offset, Math.min(2, length), position);
  });
  let supplied;
  const capture = captureEvidenceFile(file, { limit: input.length, parse: bytes => {
    supplied = bytes;
    assert.equal(bytes, calls[0].buffer);
    return { text: bytes.toString(), decimal: 1.5 };
  } });
  assert.deepEqual(capture, { bytes: 5, sha256: hash(input), value: { text: 'a€z', decimal: 1.5 } });
  assert.ok(calls.slice(0, -1).every(call => call.buffer === supplied && call.position === null));
  assert.deepEqual(calls.map(call => [call.offset, call.length]), [[0, 5], [2, 3], [4, 1], [0, 1]]);
  assert.equal(opens.length, 1);
  assert.equal(opens[0][1] & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC), 0);
  assert.throws(() => captureEvidenceFile(file, { limit: input.length - 1 }), /bounded regular file/);
});

test('empty file accepts zero; default limit is exactly 8 MiB; raw binary is not implicit JSON', t => {
  const { file } = fixture(t, '');
  assert.deepEqual(captureEvidenceFile(file, { limit: 0 }), { bytes: 0, sha256: hash(''), value: Buffer.alloc(0) });
  const bytes = Buffer.alloc(8 * 1024 * 1024, 0xff);
  fs.writeFileSync(file, bytes);
  const captured = captureEvidenceFile(file);
  assert.equal(captured.bytes, bytes.length);
  assert.equal(captured.sha256, hash(bytes));
  assert.deepEqual(captured.value, bytes);
  fs.appendFileSync(file, 'a');
  assert.throws(() => captureEvidenceFile(file), /bounded regular file/);
});

test('ordinary parser values named then are data, not promises; deferred generators are refused', t => {
  const { file } = fixture(t);
  for (const value of [{ then: 1 }, { then: null }, { then: 'data' },
    Object.assign(Object.create({ then() {} }), { then: false })])
    assert.equal(captureEvidenceFile(file, { parse: () => value }).value, value);
  for (const parse of [(function* () { yield 'deferred'; }).bind(null),
    () => (function* () { yield 'deferred'; })(), () => (async function* () { yield 'deferred'; })()])
    assert.throws(() => captureEvidenceFile(file, { parse }), /synchronous/);
});

test('parser cannot spoof the receipt byte count with a Buffer length property', t => {
  const { file } = fixture(t);
  const captured = captureEvidenceFile(file, { parse: bytes => {
    Object.defineProperty(bytes, 'length', { value: 0 });
    return 'parser-owned value';
  } });
  assert.deepEqual(captured, { bytes: 8, sha256: hash('evidence'), value: 'parser-owned value' });
});

test('parser exceptions/mutation/promises/thenables fail and descriptor always closes', t => {
  const { file } = fixture(t);
  const close = fs.closeSync;
  let closed = 0, getters = 0;
  t.mock.method(fs, 'closeSync', fd => { closed++; return close(fd); });
  const error = new Error('parser failed');
  assert.throws(() => captureEvidenceFile(file, { parse: () => { throw error; } }), thrown => thrown === error);
  assert.throws(() => captureEvidenceFile(file, { parse: bytes => { bytes[0] ^= 1; return 'changed'; } }), /mutated/);
  for (const value of [Promise.resolve('x'), { then() {} }, { get then() { getters++; throw error; } },
    Object.create({ then: () => {} }), new Proxy({}, { getPrototypeOf() { throw error; } })])
    assert.throws(() => captureEvidenceFile(file, { parse: () => value }), /synchronous|thenable/);
  assert.equal(getters, 0);
  assert.equal(closed, 7);
  assert.equal(fs.readFileSync(file, 'utf8'), 'evidence');
});

test('short reads and growth fail; initial bound failure never reads', async t => {
  for (const change of ['short', 'grow', 'oversize']) await t.test(change, t => {
    const { file } = fixture(t);
    const read = fs.readSync;
    let reads = 0;
    t.mock.method(fs, 'readSync', (...args) => {
      reads++;
      if (change === 'short') return 0;
      if (change === 'grow' && reads === 1) fs.appendFileSync(file, 'x');
      return read(...args);
    });
    assert.throws(() => captureEvidenceFile(file, { limit: change === 'oversize' ? 7 : 8 }), /short input|input grew|bounded regular/);
    if (change === 'oversize') assert.equal(reads, 0);
  });
});

test('replacement before open and same-length mutation during read are refused', async t => {
  for (const moment of ['open', 'read']) await t.test(moment, t => {
    const { root, file } = fixture(t);
    if (moment === 'open') {
      const open = fs.openSync;
      let replaced = false;
      t.mock.method(fs, 'openSync', (...args) => {
        if (args[0] === file && !replaced) {
          replaced = true;
          fs.renameSync(file, path.join(root, 'original'));
          fs.writeFileSync(file, 'evidence');
        }
        return open(...args);
      });
    } else {
      const read = fs.readSync;
      let once = false;
      t.mock.method(fs, 'readSync', (...args) => {
        const n = read(...args);
        if (!once) { once = true; fs.writeFileSync(file, 'modified'); }
        return n;
      });
    }
    assert.throws(() => captureEvidenceFile(file), /replaced before open|changed during capture/);
  });
});

test('parser cannot replace leaf or ancestor (even moving the original leaf inode)', async t => {
  for (const target of ['leaf', 'ancestor', 'symlink', 'hardlink']) await t.test(target, t => {
    const { root } = fixture(t);
    const directory = path.join(root, 'directory'), file = path.join(directory, 'input');
    fs.mkdirSync(directory); fs.writeFileSync(file, 'evidence');
    assert.throws(() => captureEvidenceFile(file, { parse: bytes => {
      if (target === 'leaf') {
        fs.renameSync(file, path.join(directory, 'old')); fs.writeFileSync(file, bytes);
      } else if (target === 'hardlink') fs.linkSync(file, path.join(directory, 'alias'));
      else {
        const old = path.join(root, 'old');
        fs.renameSync(directory, old);
        if (target === 'symlink') fs.symlinkSync(old, directory);
        else { fs.mkdirSync(directory); fs.renameSync(path.join(old, 'input'), file); }
      }
      return bytes.toString();
    } }), /replaced|changed during capture|symlink/);
  });
});

test('ancestor identity is checked even when leaf metadata does not reveal replacement', t => {
  const { root, file } = fixture(t);
  const lstat = fs.lstatSync;
  let afterParser = false;
  t.mock.method(fs, 'lstatSync', (...args) => {
    const stat = lstat(...args);
    if (afterParser && args[0] === root) stat.ino += 1;
    return stat;
  });
  assert.throws(() => captureEvidenceFile(file, { parse: bytes => { afterParser = true; return bytes.toString(); } }), /ancestor replaced/);
});

test('hardlink callback path changes are rejected despite explicit admission', t => {
  const { root, file } = fixture(t);
  fs.linkSync(file, path.join(root, 'alias'));
  assert.throws(() => captureEvidenceFile(file, { allowHardlinks: () => {
    fs.renameSync(file, path.join(root, 'old')); fs.writeFileSync(file, 'evidence'); return true;
  } }), /changed during capture|replaced/);
});

test('Windows path design uses drive/UNC roots and rejects Win32 aliases (mocked, not Windows execution)', t => {
  const { file } = fixture(t);
  const directoryStat = fs.statSync(path.dirname(file)), fileStat = fs.statSync(file);
  const oldSep = path.sep;
  path.sep = '\\';
  t.after(() => { path.sep = oldSep; });
  for (const name of ['parse', 'resolve', 'isAbsolute', 'join']) t.mock.method(path, name, path.win32[name]);
  const directories = new Set(['C:\\', 'C:\\Public Space', '\\\\server.example\\share\\']);
  const files = new Set(['C:\\Public Space\\資料.txt', '\\\\server.example\\share\\file']);
  const shortAlias = 'C:\\Public Space\\LONGFI~1.TXT';
  const denied = 'C:\\Public Space\\unreadable';
  t.mock.method(fs, 'lstatSync', (name, options) => {
    if (directories.has(name)) return directoryStat;
    if (files.has(name) || name === shortAlias) return fileStat;
    if (name === denied) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    if (options?.throwIfNoEntry === false) return undefined;
    throw new Error('unexpected mock Windows path: ' + name);
  });
  t.mock.method(fs, 'realpathSync', name => name);
  t.mock.method(fs, 'readdirSync', name => name === 'C:\\' ? ['Public Space'] :
    name === 'C:\\Public Space' ? ['資料.txt', 'LongFileName.txt'] : ['file']);
  for (const name of files) assert.equal(assertCanonicalPath(name, { kind: 'file' }), name);
  assert.equal(assertCanonicalPath('C:\\'), 'C:\\');
  assert.equal(assertCanonicalPath('C:\\Public Space\\new.txt', { kind: 'new' }), 'C:\\Public Space\\new.txt');
  assert.throws(() => assertCanonicalPath(shortAlias, { kind: 'new' }), /exists or aliases/);
  assert.throws(() => assertCanonicalPath(denied, { kind: 'new' }), error => error.code === 'EACCES');
  for (const name of ['C:\\Public Space\\NUL .txt', 'C:\\Public Space\\COM1  .log', 'C:\\Public Space\\CON .txt'])
    assert.throws(() => assertCanonicalPath(name, { kind: 'new' }), /Windows filesystem alias/);
  for (const name of ['C:input', '\\input', 'C:/Public Space/資料.txt', 'C:\\Public Space\\file.',
    'C:\\Public Space\\file ', 'C:\\Public Space\\file:stream', 'C:\\Public Space\\CON.txt',
    'C:\\Public Space\\lpt¹.txt', '\\\\?\\C:\\input', '\\\\.\\C:\\input',
    '\\\\server\\share:stream\\file'])
    assert.throws(() => assertCanonicalPath(name, { kind: 'file' }), /canonical|Windows/);
  assert.throws(() => assertCanonicalPath('C:\\public space\\資料.txt', { kind: 'file' }), /filesystem alias/);
});
