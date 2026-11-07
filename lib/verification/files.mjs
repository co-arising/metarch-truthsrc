import assert from 'node:assert/strict';
import { constants as bufferConstants } from 'node:buffer';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { types } from 'node:util';

const DEFAULT_LIMIT = 8 * 1024 * 1024;
const fold = name => name.normalize('NFC').toLowerCase();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = stat => [stat.dev, stat.ino, stat.mode, stat.uid, stat.gid];
const stamp = stat => [...identity(stat), stat.nlink, stat.size, stat.mtimeMs, stat.ctimeMs];

// Unlike data-only options, these options may contain callbacks. Inspect own data
// descriptors without invoking getters/proxies; reject misspelled/hidden policies.
function options(value, allowed) {
  assert.ok(value && typeof value === 'object' && !types.isProxy(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'plain options object required');
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert.ok(allowed.includes(key) && descriptor.enumerable && Object.hasOwn(descriptor, 'value'),
      'unknown or non-data option');
    result[key] = descriptor.value;
  }
  return result;
}

function synchronousCallback(value, label) {
  assert.ok(typeof value === 'function' && !types.isProxy(value) && Object.getPrototypeOf(value) === Function.prototype &&
    !types.isAsyncFunction(value) && !types.isGeneratorFunction(value), label + ' must be a synchronous function');
}

function synchronousResult(value) {
  // Do not call a then getter, assimilate a promise, or accept deferred parsing.
  // A data property such as JSON {"then": 1} is not a thenable.
  let foundThen = false;
  for (let current = value; current !== null && ['object', 'function'].includes(typeof current);
    current = Object.getPrototypeOf(current)) {
    assert.ok(!types.isProxy(current) && !types.isPromise(current) && !types.isGeneratorObject(current),
      'parse must return a synchronous non-proxy value');
    const descriptor = Object.getOwnPropertyDescriptor(current, 'then');
    if (!foundThen && descriptor) {
      foundThen = true;
      assert.ok(Object.hasOwn(descriptor, 'value') && typeof descriptor.value !== 'function',
        'parse must not return a promise/thenable');
    }
  }
  return value;
}

function pathParts(file) {
  assert.ok(typeof file === 'string' && file.length > 0 && !/[\x00-\x1f\x7f-\x9f]/u.test(file) &&
    file.isWellFormed() && path.isAbsolute(file) && path.resolve(file) === file, 'canonical absolute path required');
  const root = path.parse(file).root;
  const parts = file.slice(root.length).split(path.sep).filter(Boolean);
  if (path.sep === '\\') {
    // Native drive/UNC paths only: not drive-relative, root-relative, device
    // namespaces, alternate data streams, DOS device names or Win32 trim aliases.
    const unc = /^\\\\[^\\]+\\[^\\]+\\$/.test(root) && !/^\\\\[?.]\\/.test(root);
    assert.ok(/^[A-Za-z]:\\$/.test(root) || unc, 'canonical Windows drive or UNC root required');
    const components = unc ? [...root.slice(2, -1).split('\\'), ...parts] : parts;
    assert.ok(!file.includes('/') && !components.some(part => /[<>:"|?*]|[. ]$/u.test(part)) &&
      !parts.some(part => /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])\s*(?:\.|$)/iu.test(part)),
    'Windows filesystem alias forbidden');
  } else assert.ok(!file.includes('\\'), 'non-native path separator forbidden');
  return { root, parts };
}

function snapshot(file, kind) {
  const { root, parts } = pathParts(file);
  assert.ok(parts.length > 0 || kind === 'directory', 'filesystem root must be a directory');
  let current = root;
  const rootStat = fs.lstatSync(root);
  assert.ok(!rootStat.isSymbolicLink() && rootStat.isDirectory(), 'unexpected filesystem root type');
  const entries = [{ file: root, identity: identity(rootStat) }];
  let leafStat;
  for (const [index, part] of parts.entries()) {
    const matches = fs.readdirSync(current).filter(name => fold(name) === fold(part));
    const leaf = index === parts.length - 1;
    if (leaf && kind === 'new') {
      assert.equal(matches.length, 0, 'destination already exists or aliases another path: ' + file);
      assert.equal(fs.lstatSync(file, { throwIfNoEntry: false }), undefined, 'destination already exists or aliases another path: ' + file);
      break;
    }
    assert.deepEqual(matches, [part], 'missing path or filesystem alias: ' + path.join(current, part));
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    assert.ok(!stat.isSymbolicLink(), 'symlink path forbidden: ' + current);
    assert.ok(leaf && kind === 'file' ? stat.isFile() : stat.isDirectory(), 'unexpected path type: ' + current);
    entries.push({ file: current, identity: leaf && kind === 'file' ? stamp(stat) : identity(stat) });
    if (leaf) leafStat = stat;
  }
  assert.equal(fs.realpathSync(current), current, 'physical path alias forbidden: ' + current);
  return { entries, leafStat };
}

function unchanged(file, kind, before) {
  assert.deepEqual(snapshot(file, kind).entries, before.entries, 'input path or ancestor replaced: ' + file);
}

/**
 * Assert exact native absolute spelling, including every existing directory.
 * kind is directory, file, or new (only the final component may be absent).
 * Ordinary spaces/Unicode are allowed; sibling NFC/lowercase collisions and all
 * symlinks are refused. Hardlink policy belongs to capture, not path spelling.
 * These are pre/post drift checks, not an atomic openat traversal or a lock;
 * callers must own/coordinate roots against hostile concurrent replacement.
 * Windows uses native drive/UNC roots and rejects Win32 aliases. POSIX execution
 * does not constitute Windows/reparse-point execution coverage.
 */
export function assertCanonicalPath(file, input = {}) {
  const { kind = 'directory' } = options(input, ['kind']);
  assert.ok(['directory', 'file', 'new'].includes(kind), 'invalid path kind');
  const before = snapshot(file, kind);
  unchanged(file, kind, before);
  return file;
}

/**
 * Capture at most limit bytes (default 8 MiB; zero admits only an empty file).
 * Read a regular file once, with an additional one-byte EOF probe. Hash and parse
 * the SAME Buffer; never reopen to parse. parse is optional, synchronous and must
 * not mutate bytes or return a promise/thenable/generator/proxy. Its result is caller-defined
 * (no implicit JSON/number/immutability policy). Without parse, value is the captured
 * caller-owned Buffer; hashes describe capture time, not later caller mutations.
 *
 * Hardlinks are refused by default. Explicit true permits them; a synchronous
 * function is invoked only for nlink > 1 with the frozen opened-descriptor Stats,
 * and must return exactly true. Callbacks are trusted in-process code, not sandboxed
 * or interruptible. Descriptor/path identities are checked again after callbacks.
 */
export function captureEvidenceFile(file, input = {}) {
  const { limit = DEFAULT_LIMIT, parse, allowHardlinks = false } = options(input, ['limit', 'parse', 'allowHardlinks']);
  assert.ok(Number.isSafeInteger(limit) && limit >= 0 && limit <= bufferConstants.MAX_LENGTH, 'invalid byte limit');
  if (parse !== undefined) synchronousCallback(parse, 'parse');
  assert.ok(typeof allowHardlinks === 'boolean' || typeof allowHardlinks === 'function', 'invalid allowHardlinks policy');
  if (typeof allowHardlinks === 'function') synchronousCallback(allowHardlinks, 'allowHardlinks');
  const before = snapshot(file, 'file');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd), original = stamp(stat);
    assert.ok(stat.isFile() && Number.isSafeInteger(stat.size) && stat.size >= 0 && stat.size <= limit,
      'bounded regular file required: ' + file);
    assert.deepEqual(original, stamp(before.leafStat), 'input replaced before open: ' + file);
    assert.ok(stat.nlink === 1 || stat.nlink > 1 && (allowHardlinks === true ||
      typeof allowHardlinks === 'function' && allowHardlinks(Object.freeze(stat)) === true),
    'regular non-hardlinked file required: ' + file);
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, null);
      assert.ok(Number.isSafeInteger(count) && count > 0 && count <= bytes.length - offset, 'short input');
      offset += count;
    }
    assert.equal(fs.readSync(fd, Buffer.alloc(1), 0, 1, null), 0, 'input grew');
    const check = () => {
      assert.deepEqual(stamp(fs.fstatSync(fd)), original, 'input changed during capture');
      unchanged(file, 'file', before);
    };
    check();
    const sha256 = digest(bytes);
    const value = parse === undefined ? bytes : synchronousResult(parse(bytes));
    if (parse !== undefined) assert.equal(digest(bytes), sha256, 'parse mutated captured bytes');
    check();
    return { bytes: stat.size, sha256, value };
  } finally { fs.closeSync(fd); }
}
