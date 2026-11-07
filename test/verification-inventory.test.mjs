import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fingerprintEvidenceFile } from '../lib/verification/files.mjs';
import { inventoryEvidence, snapshotEvidenceFiles, compareEvidenceInventories, createEvidenceReferences } from '../lib/verification/inventory.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const receipt = value => ({ bytes: Buffer.byteLength(value), sha256: hash(value) });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'truthsrc-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, value = 'evidence') => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
    return file;
  };
  return { root, write };
}
const badOptions = [null, false, 1, 'options', [], new Date(), Object.create({ limit: 0 }),
  { unknown: true }, Object.defineProperty({}, 'limit', { value: 0 }), { [Symbol('policy')]: true },
  new Proxy({}, { ownKeys() { throw new Error('proxy executed'); } })];

test('streamed fingerprint matches exact bytes, empty files and short chunk reads', t => {
  const { write } = fixture(t), file = write('input', 'a€z');
  const read = fs.readSync, calls = [];
  t.mock.method(fs, 'readSync', (fd, buffer, offset, length, position) => {
    calls.push({ buffer, offset, length, position });
    return read(fd, buffer, offset, Math.min(2, length), position);
  });
  assert.deepEqual(fingerprintEvidenceFile(file, { limit: 5 }), receipt('a€z'));
  assert.deepEqual(calls.map(row => [row.offset, row.length]), [[0, 5], [0, 3], [0, 1], [0, 1]]);
  assert.ok(calls.slice(0, -1).every(row => row.buffer === calls[0].buffer && row.position === null));
  assert.deepEqual(fingerprintEvidenceFile(write('empty', ''), { limit: 0 }), receipt(''));
});

test('large sparse file fingerprints with a fixed buffer, not a file-sized allocation', t => {
  const { write } = fixture(t), file = write('sparse', ''), size = 64 * 1024 * 1024 + 13;
  const fd = fs.openSync(file, 'r+');
  try { fs.ftruncateSync(fd, size); } finally { fs.closeSync(fd); }
  const zero = Buffer.alloc(64 * 1024), expected = createHash('sha256');
  for (let remaining = size; remaining > 0; remaining -= zero.length)
    expected.update(zero.subarray(0, Math.min(zero.length, remaining)));
  const alloc = Buffer.alloc, unsafe = Buffer.allocUnsafe, read = fs.readSync;
  let largest = 0, requested = 0;
  const bounded = (original, count, ...args) => {
    largest = Math.max(largest, count);
    assert.ok(count <= 64 * 1024, 'allocation exceeded streaming buffer');
    return original(count, ...args);
  };
  t.mock.method(Buffer, 'alloc', (count, ...args) => bounded(alloc, count, ...args));
  t.mock.method(Buffer, 'allocUnsafe', (count, ...args) => bounded(unsafe, count, ...args));
  t.mock.method(fs, 'readSync', (...args) => { requested += args[3]; return read(...args); });
  assert.deepEqual(fingerprintEvidenceFile(file), { bytes: size, sha256: expected.digest('hex') });
  assert.equal(largest, 64 * 1024);
  assert.equal(requested, size + 1);
});

test('streaming policies are descriptor-first, strict and bounded before reading', t => {
  const { write } = fixture(t), file = write('input');
  let getters = 0, reads = 0;
  const read = fs.readSync;
  t.mock.method(fs, 'readSync', (...args) => { reads++; return read(...args); });
  for (const input of [...badOptions, { get limit() { getters++; return 0; } }, { parse: JSON.parse }])
    assert.throws(() => fingerprintEvidenceFile(file, input));
  for (const limit of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '8', null, 8n])
    assert.throws(() => fingerprintEvidenceFile(file, { limit }), /byte limit/);
  for (const allowHardlinks of [null, 1, 'true', {}, [], async () => true, function* () {},
    new Proxy(() => true, { apply() { throw new Error('executed'); } })])
    assert.throws(() => fingerprintEvidenceFile(file, { allowHardlinks }));
  assert.throws(() => fingerprintEvidenceFile(file, { limit: 7 }), /bounded regular file/);
  assert.equal(reads, 0); assert.equal(getters, 0);
  assert.equal(fingerprintEvidenceFile(file, { limit: Number.MAX_SAFE_INTEGER }).bytes, 8);
});

test('streaming detects shrink, growth, invalid read counts and closes its descriptor', async t => {
  for (const change of ['shrink', 'grow', 'zero', 'fraction', 'oversized-count']) await t.test(change, t => {
    const { write } = fixture(t), file = write('input');
    const read = fs.readSync, close = fs.closeSync;
    let once = false, closed = 0;
    t.mock.method(fs, 'closeSync', fd => { closed++; return close(fd); });
    t.mock.method(fs, 'readSync', (...args) => {
      if (!once) {
        once = true;
        if (change === 'shrink') fs.truncateSync(file, 0);
        if (change === 'grow') fs.appendFileSync(file, 'x');
      }
      if (change === 'zero') return 0;
      if (change === 'fraction') return 0.5;
      if (change === 'oversized-count') return args[3] + 1;
      return read(...args);
    });
    assert.throws(() => fingerprintEvidenceFile(file), /short input|input grew/);
    assert.ok(closed >= 1);
  });
});

test('streaming checks opened descriptor, post-read mutations and ancestor identities', async t => {
  for (const change of ['before-open', 'contents', 'ancestor']) await t.test(change, t => {
    const { root, write } = fixture(t), file = write('folder/input');
    let changed = false;
    if (change === 'before-open') {
      const open = fs.openSync;
      t.mock.method(fs, 'openSync', (...args) => {
        if (args[0] === file && !changed) {
          changed = true; fs.renameSync(file, file + '.old'); fs.writeFileSync(file, 'evidence');
        }
        return open(...args);
      });
    } else {
      const read = fs.readSync, lstat = fs.lstatSync;
      t.mock.method(fs, 'readSync', (...args) => {
        const count = read(...args);
        if (!changed) { changed = true; if (change === 'contents') fs.writeFileSync(file, 'modified'); }
        return count;
      });
      if (change === 'ancestor') t.mock.method(fs, 'lstatSync', (...args) => {
        const stat = lstat(...args);
        if (changed && args[0] === root) stat.ino++;
        return stat;
      });
    }
    assert.throws(() => fingerprintEvidenceFile(file), /changed during capture|replaced/);
  });
});

test('streaming has the same hardlink admission and callback rechecks as capture', t => {
  const { root, write } = fixture(t), file = write('input');
  fs.linkSync(file, path.join(root, 'alias'));
  assert.throws(() => fingerprintEvidenceFile(file), /non-hardlinked/);
  assert.deepEqual(fingerprintEvidenceFile(file, { allowHardlinks: true }), receipt('evidence'));
  assert.deepEqual(fingerprintEvidenceFile(file, { allowHardlinks: stat => {
    assert.equal(Object.isFrozen(stat), true); assert.equal(stat.nlink, 2); return true;
  } }), receipt('evidence'));
  for (const value of [1, 'true', null, Promise.resolve(true)])
    assert.throws(() => fingerprintEvidenceFile(file, { allowHardlinks: () => value }), /non-hardlinked/);
  assert.throws(() => fingerprintEvidenceFile(file, { allowHardlinks: () => {
    fs.renameSync(file, file + '.old'); fs.writeFileSync(file, 'evidence'); return true;
  } }), /changed during capture|replaced/);
});

test('inventory has no default exclusions, safe own keys and deterministic native paths', t => {
  const { root, write } = fixture(t);
  for (const name of ['z.txt', 'nested/b', 'nested/a', '.scratch/log', '__proto__', 'constructor', 'ordinary space']) write(name, name);
  const before = inventoryEvidence(root);
  assert.deepEqual(Object.keys(before), ['.scratch/log', '__proto__', 'constructor', 'nested/a', 'nested/b', 'ordinary space', 'z.txt'].map(name => name.split('/').join(path.sep)));
  assert.equal(Object.getPrototypeOf(before), Object.prototype);
  assert.equal(Object.hasOwn(before, '__proto__'), true);
  assert.deepEqual(before.__proto__, receipt('__proto__'));
  assert.deepEqual(compareEvidenceInventories(before, inventoryEvidence(root)), { passed: true, files: 7 });
  assert.deepEqual(compareEvidenceInventories(JSON.parse(JSON.stringify(before)), before), { passed: true, files: 7 });
});

test('exclusions select exact directories, allow absence, and do not hide other file sets', t => {
  const { root, write } = fixture(t);
  write('cache/log'); write('nested/cache/log'); write('input');
  const excludeDirectories = ['cache', 'not-yet-created'];
  assert.deepEqual(Object.keys(inventoryEvidence(root, { excludeDirectories })), ['input', path.join('nested', 'cache', 'log')]);
  assert.equal(Object.keys(inventoryEvidence(root)).length, 3);
  assert.throws(() => inventoryEvidence(root, { excludeDirectories: ['input'] }), /excluded directory/);
  assert.throws(() => inventoryEvidence(root, { limit: 7 }), /bounded regular/);
  assert.equal(Object.keys(inventoryEvidence(root, { limit: 8 })).length, 3);
});

test('invalid options, lists, paths and accessors do not execute', t => {
  const { root, write } = fixture(t), file = write('input');
  let calls = 0;
  const getter = { get limit() { calls++; return 0; } };
  for (const options of [...badOptions, getter, { allowHardlinks: true }]) {
    assert.throws(() => inventoryEvidence(root, options));
    assert.throws(() => snapshotEvidenceFiles([file], options));
  }
  const invalidLists = [null, 'input', {}, [null], [, file], Object.assign([file], { extra: true }),
    Object.defineProperty([], '0', { get() { calls++; return file; }, enumerable: true }),
    new Proxy([file], { get() { calls++; throw new Error('executed'); } })];
  for (const files of invalidLists) assert.throws(() => snapshotEvidenceFiles(files));
  for (const value of ['', '.', '..', '../out', '/absolute', 'cache/', 'a//b', 'a/./b', 'bad\\name', 'bad\x85name', 'bad\ud800', 'bad\nname'])
    assert.throws(() => inventoryEvidence(root, { excludeDirectories: [value] }));
  for (const excludeDirectories of [['cache', 'cache'], ['cache', 'CACHE'], ['café', 'café']])
    assert.throws(() => inventoryEvidence(root, { excludeDirectories }), /duplicate or aliased/);
  assert.equal(calls, 0);
});

test('aliases are rejected before exclusions, including excluded directory aliases', async t => {
  for (const alias of ['CACHE', 'café']) await t.test(alias, t => {
    const { root, write } = fixture(t);
    write('cache/log'); write('café/log');
    const readdir = fs.readdirSync;
    t.mock.method(fs, 'readdirSync', (...args) => {
      const names = readdir(...args);
      if (args[0] !== root) return names;
      const unicode = names.find(name => name.normalize('NFC') === 'café');
      const collision = alias === 'CACHE' ? alias : unicode === unicode.normalize('NFC') ? unicode.normalize('NFD') : unicode.normalize('NFC');
      return [...names, collision];
    });
    assert.throws(() => inventoryEvidence(root, { excludeDirectories: ['cache', 'café'] }), /aliases/);
  });
});

test('excluded entries cannot conceal symlinks, special files or hardlinked files', { skip: process.platform === 'win32' }, t => {
  const { root, write } = fixture(t), file = write('input');
  fs.symlinkSync(path.dirname(file), path.join(root, 'cache'));
  assert.throws(() => inventoryEvidence(root, { excludeDirectories: ['cache'] }), /symlink/);
  fs.unlinkSync(path.join(root, 'cache'));
  fs.linkSync(file, path.join(root, 'cache'));
  assert.throws(() => inventoryEvidence(root, { excludeDirectories: ['cache'] }), /directory|non-hardlinked/);
  fs.unlinkSync(path.join(root, 'cache'));
  assert.equal(spawnSync('mkfifo', [path.join(root, 'cache')], { timeout: 2000 }).status, 0);
  assert.throws(() => inventoryEvidence(root, { excludeDirectories: ['cache'] }), /unexpected inventory path type/);
});

test('unsafe on-disk names and directory/file aliases fail inventory and streaming', t => {
  const { root, write } = fixture(t), file = write('MixedCase/input');
  assert.throws(() => fingerprintEvidenceFile(path.join(root, 'mixedcase', 'input')), /filesystem alias/);
  assert.throws(() => inventoryEvidence(path.join(root, 'mixedcase')), /filesystem alias/);
  if (process.platform !== 'win32') {
    write('bad\\name');
    assert.throws(() => inventoryEvidence(root), /non-native/);
  }
  assert.throws(() => fingerprintEvidenceFile(path.dirname(file)), /unexpected path type/);
});

test('inventory rechecks membership after hashing, including already visited subtrees', async t => {
  for (const change of ['add', 'remove', 'replace-directory', 'mutate-earlier']) await t.test(change, t => {
    const { root, write } = fixture(t), first = write('a/input'), last = write('z/input');
    const read = fs.readSync, open = fs.openSync;
    let lastFd, once = false;
    t.mock.method(fs, 'openSync', (...args) => {
      const fd = open(...args); if (args[0] === last) lastFd = fd; return fd;
    });
    t.mock.method(fs, 'readSync', (...args) => {
      const count = read(...args);
      if (args[0] === lastFd && !once) {
        once = true;
        if (change === 'add') write('a/added');
        if (change === 'remove') fs.unlinkSync(first);
        if (change === 'mutate-earlier') fs.writeFileSync(first, 'modified');
        if (change === 'replace-directory') {
          fs.renameSync(path.dirname(first), path.join(root, 'old'));
          fs.mkdirSync(path.dirname(first)); fs.renameSync(path.join(root, 'old/input'), first);
        }
      }
      return count;
    });
    assert.throws(() => inventoryEvidence(root), /membership|identity|changed/);
  });
});

test('excluded contents may change, but excluded directory identity may not', async t => {
  for (const replace of [false, true]) await t.test(String(replace), t => {
    const { root, write } = fixture(t); write('cache/log'); write('input');
    const read = fs.readSync;
    let once = false;
    t.mock.method(fs, 'readSync', (...args) => {
      const count = read(...args);
      if (!once) {
        once = true;
        if (replace) { fs.renameSync(path.join(root, 'cache'), path.join(root, 'old')); fs.mkdirSync(path.join(root, 'cache')); }
        else write('cache/new-log');
      }
      return count;
    });
    if (replace) assert.throws(() => inventoryEvidence(root, { excludeDirectories: ['cache'] }), /membership|identity/);
    else assert.deepEqual(inventoryEvidence(root, { excludeDirectories: ['cache'] }), { input: receipt('evidence') });
  });
});

test('snapshot preserves declarations and refuses duplicate/alias/symlink/hardlink paths', t => {
  const { root, write } = fixture(t), a = write('a'), z = write('z');
  assert.deepEqual(Object.keys(snapshotEvidenceFiles([z, a])), [z, a]);
  assert.deepEqual(snapshotEvidenceFiles([]), {});
  for (const files of [[a, a], [a, path.join(root, 'A')], [path.join(root, 'café'), path.join(root, 'café')]])
    assert.throws(() => snapshotEvidenceFiles(files), /duplicate or aliased/);
  fs.linkSync(a, path.join(root, 'hard'));
  assert.throws(() => snapshotEvidenceFiles([a, path.join(root, 'hard')]), /non-hardlinked/);
  if (process.platform !== 'win32') {
    fs.symlinkSync(z, path.join(root, 'symbolic'));
    assert.throws(() => snapshotEvidenceFiles([path.join(root, 'symbolic')]), /symlink/);
  }
});

test('snapshot rechecks earlier files and ancestor identities after all fingerprints', async t => {
  for (const change of ['file', 'ancestor']) await t.test(change, t => {
    const { root, write } = fixture(t), a = write('a/input'), z = write('z');
    const read = fs.readSync, open = fs.openSync, lstat = fs.lstatSync;
    let lastFd, changed = false;
    t.mock.method(fs, 'openSync', (...args) => { const fd = open(...args); if (args[0] === z) lastFd = fd; return fd; });
    t.mock.method(fs, 'readSync', (...args) => {
      const count = read(...args);
      if (args[0] === lastFd && !changed) { changed = true; if (change === 'file') fs.writeFileSync(a, 'modified'); }
      return count;
    });
    if (change === 'ancestor') t.mock.method(fs, 'lstatSync', (...args) => {
      const stat = lstat(...args); if (changed && args[0] === path.join(root, 'a')) stat.ino++; return stat;
    });
    assert.throws(() => snapshotEvidenceFiles([a, z]), /declared input or ancestor changed/);
  });
});

test('comparison is pure, exact and descriptor-safe, accepting normal/null JSON objects', () => {
  const a = { file: receipt('a') }, same = Object.assign(Object.create(null), a);
  assert.deepEqual(compareEvidenceInventories(a, same), { passed: true, files: 1 });
  for (const b of [{}, { file: receipt('b') }, { ...a, extra: receipt('a') }, { file: { ...a.file, bytes: 0.5 } },
    { file: { ...a.file, sha256: a.file.sha256.toUpperCase() } }, { file: { ...a.file, extra: true } }])
    assert.throws(() => compareEvidenceInventories(a, b));
  let calls = 0;
  for (const b of [Object.create(a), { get file() { calls++; return receipt('a'); } },
    { file: { get bytes() { calls++; return 1; }, sha256: hash('a') } },
    new Proxy(a, { ownKeys() { calls++; return ['file']; } })]) assert.throws(() => compareEvidenceInventories(a, b));
  assert.equal(calls, 0);
});

test('references parse and hash one captured Buffer, detach metadata and preserve order', t => {
  const { write } = fixture(t), file = write('first', '{"value":1.25}'), second = write('second', 'two');
  const refs = createEvidenceReferences(), read = fs.readSync, open = fs.openSync;
  let supplied, opens = 0, parsed;
  t.mock.method(fs, 'openSync', (...args) => { opens++; return open(...args); });
  t.mock.method(fs, 'readSync', (...args) => { supplied ??= args[1]; return read(...args); });
  const captured = refs.capture(file, { limit: 30, parse: bytes => {
    assert.equal(bytes, supplied); parsed = JSON.parse(bytes); return parsed;
  } });
  assert.equal(opens, 1);
  assert.deepEqual(captured, { ...receipt('{"value":1.25}'), value: { value: 1.25 } });
  assert.notEqual(captured.value, parsed); assert.equal(Object.isFrozen(captured.value), true);
  parsed.value = 99;
  assert.equal(captured.value.value, 1.25);
  const returned = refs.retain({ file: second, ...receipt('two') });
  returned.sha256 = hash('different');
  assert.deepEqual(refs.references(), [{ file, ...receipt('{"value":1.25}') }, { file: second, ...receipt('two') }]);
  const detached = refs.references(); detached[0].bytes = 0; detached.pop();
  assert.equal(refs.references().length, 2);
  assert.deepEqual(refs.assertUnchanged(), { passed: true, files: 2 });
});

test('references reject parse-byte mutation, deferred parsing and executable/non-data metadata', t => {
  const { write } = fixture(t), file = write('input', '{"value":1.25}'), refs = createEvidenceReferences();
  let calls = 0;
  assert.throws(() => refs.capture(file, { parse: bytes => { bytes[0] ^= 1; return {}; } }), /mutated/);
  for (const parse of [async () => ({}), function* () {}, () => Promise.resolve({}), () => ({ then() {} }),
    () => ({ nested: { get data() { calls++; return true; } } }),
    () => new Proxy({}, { getPrototypeOf() { calls++; return Object.prototype; } }),
    () => Object.create({ inherited: true }), () => ({ run() {} }), () => ({ number: Infinity })])
    assert.throws(() => refs.capture(file, { parse }));
  assert.equal(calls, 0); assert.deepEqual(refs.references(), []);
  assert.deepEqual(refs.capture(file, { parse: () => ({ then: 1.25, value: null }) }).value, { then: 1.25, value: null });
});

test('references without parse return detached caller-owned bytes and never change retained hashes', t => {
  const { write } = fixture(t), file = write('input'), refs = createEvidenceReferences();
  const captured = refs.capture(file);
  assert.ok(Buffer.isBuffer(captured.value)); captured.value[0] ^= 1;
  assert.deepEqual(refs.references(), [{ file, ...receipt('evidence') }]);
  assert.deepEqual(refs.assertUnchanged(), { passed: true, files: 1 });
});

test('references reject repeated conflicts and aliases without replacing an earlier declaration', t => {
  const { root, write } = fixture(t), file = write('input'), refs = createEvidenceReferences();
  refs.capture(file);
  refs.retain({ file, ...receipt('evidence') }, { limit: 8 });
  assert.throws(() => refs.retain({ file, ...receipt('modified') }), /conflicting/);
  assert.throws(() => refs.retain({ file: path.join(root, 'INPUT'), ...receipt('evidence') }), /aliased/);
  fs.writeFileSync(file, 'modified');
  assert.throws(() => refs.capture(file), /conflicting/);
  assert.deepEqual(refs.references(), [{ file, ...receipt('evidence') }]);
  assert.throws(() => refs.assertUnchanged(), /fingerprints differ/);
});

test('reference options/data reject hidden, inherited, accessor, proxy and unsafe input', t => {
  const { write } = fixture(t), file = write('input'), refs = createEvidenceReferences(), ref = { file, ...receipt('evidence') };
  let calls = 0;
  for (const policy of [...badOptions, { get limit() { calls++; return 8; } }, { allowHardlinks: true }]) {
    assert.throws(() => refs.capture(file, policy)); assert.throws(() => refs.retain(ref, policy));
  }
  for (const input of [Object.create(ref), { ...ref, bytes: 1.25 }, { ...ref, extra: true }, { ...ref, sha256: 'bad' },
    { ...ref, file: 'relative' }, { ...ref, file: file + '\x85' }, { ...ref, get bytes() { calls++; return 8; } },
    new Proxy(ref, { ownKeys() { calls++; return []; } })]) assert.throws(() => refs.retain(input));
  assert.throws(() => refs.retain(ref, { limit: 7 }), /byte limit/);
  assert.equal(calls, 0); assert.deepEqual(refs.references(), []);
});

test('reference rechecks preserve the tightest declared limit and reject growth before reading', async t => {
  for (const source of ['capture', 'retain']) await t.test(source, t => {
    const { write } = fixture(t), file = write('input'), refs = createEvidenceReferences();
    if (source === 'capture') refs.capture(file, { limit: 8 });
    else refs.retain({ file, ...receipt('evidence') }, { limit: 8 });
    refs.retain({ file, ...receipt('evidence') }, { limit: 100 });
    fs.appendFileSync(file, 'x');
    let reads = 0;
    t.mock.method(fs, 'readSync', () => { reads++; throw new Error('must reject before read'); });
    assert.throws(() => refs.assertUnchanged(), /bounded regular file/);
    assert.equal(reads, 0);
  });
});

test('reference rechecks refuse disappeared, symlinked or hardlinked files', async t => {
  for (const change of ['missing', 'hardlink', ...(process.platform === 'win32' ? [] : ['symlink'])]) await t.test(change, t => {
    const { root, write } = fixture(t), file = write('input'), refs = createEvidenceReferences();
    refs.capture(file);
    if (change === 'missing') fs.unlinkSync(file);
    if (change === 'hardlink') fs.linkSync(file, path.join(root, 'alias'));
    if (change === 'symlink') { fs.renameSync(file, file + '.old'); fs.symlinkSync(file + '.old', file); }
    assert.throws(() => refs.assertUnchanged());
  });
  assert.deepEqual(createEvidenceReferences().assertUnchanged(), { passed: true, files: 0 });
});
