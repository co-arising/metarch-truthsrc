import assert from 'node:assert/strict';
import { constants as bufferConstants } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { types } from 'node:util';
import { copyImmutableData } from '../immutable-data.mjs';
import { assertCanonicalPath, captureEvidenceFile, fingerprintEvidenceFile } from './files.mjs';

const MAX_LIMIT = Number.MAX_SAFE_INTEGER;
const CAPTURE_LIMIT = 8 * 1024 * 1024;
const fold = value => value.normalize('NFC').toLowerCase();
const identity = stat => [stat.dev, stat.ino, stat.mode, stat.uid, stat.gid];
const stamp = stat => [...identity(stat), stat.nlink, stat.size, stat.mtimeMs, stat.ctimeMs];
const own = (value, key) => Object.hasOwn(value, key);
const define = (object, key, value) => Object.defineProperty(object, key,
  { value, enumerable: true, writable: true, configurable: true });

// parse is the only executable option, explicitly supplied by trusted code.
// Never destructure caller data before inspecting its descriptors.
function options(value, allowed) {
  assert.ok(value && typeof value === 'object' && !types.isProxy(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'plain options object required');
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert.ok(allowed.includes(key) && descriptor.enumerable && own(descriptor, 'value'), 'unknown or non-data option');
    result[key] = descriptor.value;
  }
  return result;
}

function byteLimit(limit, maximum = MAX_LIMIT) {
  assert.ok(Number.isSafeInteger(limit) && limit >= 0 && limit <= maximum, 'invalid byte limit');
  return limit;
}

function plain(value, label) {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  return value;
}

// Lexical only: comparison and retained references need no filesystem reads.
// Filesystem spellings/ancestors are checked separately at each capture.
function nativePath(value, absolute) {
  assert.ok(typeof value === 'string' && value.length > 0 && value.isWellFormed() &&
    !/[\x00-\x1f\x7f-\x9f]/u.test(value), 'unsafe inventory path');
  assert.equal(path.isAbsolute(value), absolute, absolute ? 'absolute file path required' : 'relative directory/file path required');
  assert.ok((absolute ? path.resolve(value) : path.normalize(value)) === value, 'canonical inventory path required');
  const root = absolute ? path.parse(value).root : '';
  const parts = value.slice(root.length).split(path.sep);
  assert.ok(parts.every(part => part && part !== '.' && part !== '..'), 'unsafe inventory path component');
  if (path.sep === '\\') {
    const unc = /^\\\\[^\\]+\\[^\\]+\\$/.test(root) && !/^\\\\[?.]\\/.test(root);
    if (absolute) assert.ok(/^[A-Za-z]:\\$/.test(root) || unc, 'canonical Windows root required');
    const components = unc ? [...root.slice(2, -1).split('\\'), ...parts] : parts;
    assert.ok(!value.includes('/') && !components.some(part => /[<>:"|?*]|[. ]$/u.test(part)) &&
      !parts.some(part => /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])\s*(?:\.|$)/iu.test(part)), 'Windows filesystem alias forbidden');
  } else assert.ok(!value.includes('\\'), 'non-native path separator forbidden');
  return value;
}

function declarations(value, absolute) {
  const files = copyImmutableData(value);
  assert.ok(Array.isArray(files), 'explicit path array required');
  const seen = new Set();
  for (const file of files) {
    nativePath(file, absolute);
    assert.ok(!seen.has(fold(file)), 'duplicate or aliased path declaration: ' + file);
    seen.add(fold(file));
  }
  return files;
}

function regular(stat, file) {
  assert.ok(!stat.isSymbolicLink() && stat.isFile() && stat.nlink === 1,
    'regular non-hardlinked file required: ' + file);
}

function ancestors(directory) {
  const rows = [];
  for (let current = directory; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    assert.ok(!stat.isSymbolicLink() && stat.isDirectory(), 'directory ancestor required: ' + current);
    rows.push([current, identity(stat)]);
    if (path.dirname(current) === current) return rows;
  }
}

function treeState(root, exclusions) {
  const rows = [];
  function visit(directory) {
    const stat = fs.lstatSync(directory), original = identity(stat);
    assert.ok(!stat.isSymbolicLink() && stat.isDirectory(), 'directory required: ' + directory);
    const names = fs.readdirSync(directory).sort();
    assert.equal(new Set(names.map(fold)).size, names.length, 'case/unicode aliases in inventory: ' + directory);
    rows.push({ file: directory, kind: 'directory', identity: original, names });
    for (const name of names) {
      // Validate every immediate entry before deciding whether to exclude it.
      nativePath(name, false);
      assert.equal(path.basename(name), name, 'unsafe inventory name');
      const file = path.join(directory, name), key = path.relative(root, file), entry = fs.lstatSync(file);
      assert.ok(!entry.isSymbolicLink(), 'symlink in inventory: ' + file);
      assert.ok(entry.isDirectory() || entry.isFile(), 'unexpected inventory path type: ' + file);
      assert.equal(fs.realpathSync(file), file, 'physical path alias forbidden: ' + file);
      if (exclusions.has(key)) {
        assert.ok(entry.isDirectory(), 'excluded directory replaced by non-directory: ' + file);
        rows.push({ file, kind: 'excluded', identity: identity(entry) });
      } else if (entry.isDirectory()) visit(file);
      else {
        regular(entry, file);
        rows.push({ file, kind: 'file', stamp: stamp(entry) });
      }
    }
    assert.deepEqual(fs.readdirSync(directory).sort(), names, 'directory membership changed: ' + directory);
    assert.deepEqual(identity(fs.lstatSync(directory)), original, 'directory identity changed: ' + directory);
  }
  visit(root);
  return rows;
}

/**
 * Exact relative native paths, deterministic traversal order, no implicit
 * exclusions. Exclusions are exact relative directory paths (not patterns);
 * absent exclusions are allowed. Their entries/identities, but not their
 * contents, remain checked. All other memberships and file identities are
 * rechecked across the whole traversal. This is drift detection, not a lock.
 */
export function inventoryEvidence(root, input = {}) {
  const { excludeDirectories = [], limit = MAX_LIMIT } = options(input, ['excludeDirectories', 'limit']);
  byteLimit(limit);
  const exclusions = new Set(declarations(excludeDirectories, false));
  assertCanonicalPath(root);
  const parents = ancestors(root), before = treeState(root, exclusions), result = {};
  for (const row of before) if (row.kind === 'file')
    define(result, path.relative(root, row.file), fingerprintEvidenceFile(row.file, { limit }));
  assert.deepEqual(treeState(root, exclusions), before, 'inventory membership or identity changed');
  assertCanonicalPath(root);
  assert.deepEqual(ancestors(root), parents, 'inventory ancestor changed');
  return result;
}

function fileSetState(files) {
  const inodes = new Set();
  return files.map(file => {
    assertCanonicalPath(file, { kind: 'file' });
    const stat = fs.lstatSync(file);
    regular(stat, file);
    const inode = stat.dev + ':' + stat.ino;
    assert.ok(!inodes.has(inode), 'aliased file declarations: ' + file);
    inodes.add(inode);
    return { file, stamp: stamp(stat), ancestors: ancestors(path.dirname(file)) };
  });
}

function snapshotFiles(files, limitFor) {
  const before = fileSetState(files), result = {};
  for (const file of files) define(result, file, fingerprintEvidenceFile(file, { limit: limitFor(file) }));
  assert.deepEqual(fileSetState(files), before, 'declared input or ancestor changed');
  return result;
}

/** Caller order is preserved; duplicate, spelling-alias and hardlink inputs fail. */
export function snapshotEvidenceFiles(files, input = {}) {
  const { limit = MAX_LIMIT } = options(input, ['limit']);
  byteLimit(limit);
  return snapshotFiles(declarations(files, true), () => limit);
}

function fingerprint(value) {
  plain(value, 'fingerprint');
  assert.deepEqual(Object.keys(value).sort(), ['bytes', 'sha256'], 'exact fingerprint fields required');
  byteLimit(value.bytes);
  assert.ok(typeof value.sha256 === 'string' && /^[0-9a-f]{64}$/u.test(value.sha256), 'lowercase sha256 required');
  return { bytes: value.bytes, sha256: value.sha256 };
}

function inventory(value) {
  const data = plain(copyImmutableData(value), 'inventory'), result = {}, seen = new Set();
  for (const key of Object.keys(data)) {
    nativePath(key, path.isAbsolute(key));
    assert.ok(!seen.has(fold(key)), 'aliased inventory keys');
    seen.add(fold(key));
    define(result, key, fingerprint(data[key]));
  }
  return result;
}

/** Pure exact membership/value comparison; object prototypes and key order are not evidence. */
export function compareEvidenceInventories(before, after) {
  const expected = inventory(before), actual = inventory(after);
  assert.deepEqual(actual, expected, 'evidence inventory membership or fingerprints differ');
  return { passed: true, files: Object.keys(expected).length };
}

/**
 * Capture returns captureEvidenceFile's {bytes, sha256, value}; parsed values are
 * detached immutable JSON data (including finite decimals). Without parse the
 * value remains a caller-owned Buffer. Capture defaults to 8 MiB; retain defaults
 * to MAX_SAFE_INTEGER. Repeated identical references retain the tighter limit.
 * retain only records a declaration; assertUnchanged performs the file checks.
 */
export function createEvidenceReferences() {
  const entries = new Map(), spellings = new Map();
  function retain(input, policy = {}) {
    const { limit = MAX_LIMIT } = options(policy, ['limit']);
    byteLimit(limit);
    const data = plain(copyImmutableData(input), 'reference');
    assert.deepEqual(Object.keys(data).sort(), ['bytes', 'file', 'sha256'], 'exact reference fields required');
    const file = nativePath(data.file, true), ref = { file, ...fingerprint({ bytes: data.bytes, sha256: data.sha256 }) };
    assert.ok(ref.bytes <= limit, 'reference exceeds byte limit');
    const spelling = spellings.get(fold(file));
    assert.ok(spelling === undefined || spelling === file, 'aliased reference declaration');
    const previous = entries.get(file);
    if (previous) assert.deepEqual(ref, previous.ref, 'conflicting repeated evidence reference');
    entries.set(file, { ref, limit: previous ? Math.min(previous.limit, limit) : limit });
    spellings.set(fold(file), file);
    return { ...ref };
  }
  return {
    capture(file, input = {}) {
      const { limit = CAPTURE_LIMIT, parse } = options(input, ['limit', 'parse']);
      byteLimit(limit, bufferConstants.MAX_LENGTH);
      const captured = captureEvidenceFile(file, { limit, ...(parse === undefined ? {} : { parse }) });
      const value = parse === undefined ? captured.value : copyImmutableData(captured.value);
      retain({ file, bytes: captured.bytes, sha256: captured.sha256 }, { limit });
      return { ...captured, value };
    },
    retain,
    references() { return [...entries.values()].map(({ ref }) => ({ ...ref })); },
    assertUnchanged() {
      const files = [...entries.keys()], expected = {};
      for (const [file, { ref }] of entries) define(expected, file, { bytes: ref.bytes, sha256: ref.sha256 });
      const actual = snapshotFiles(files, file => entries.get(file).limit);
      return compareEvidenceInventories(expected, actual);
    },
  };
}
