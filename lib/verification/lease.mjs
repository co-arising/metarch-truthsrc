import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { types } from 'node:util';
import { copyImmutableData } from '../immutable-data.mjs';
import { assertCanonicalPath, captureEvidenceFile } from './files.mjs';
import { assertVerificationCallback, settleVerificationCallback } from './callbacks.mjs';

const LIMIT = 32 * 1024;
const fold = name => name.normalize('NFC').toLowerCase();
const identity = stat => [stat.dev, stat.ino, stat.mode, stat.uid, stat.gid];
const failure = (code, message, details = {}) => Object.assign(new Error(message), { code, ...details });
const invalid = () => { throw failure('FILE_LEASE_INVALID', 'invalid file lease options or record'); };

function options(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))) invalid();
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!['registry', 'lockNames', 'record', 'usedName', 'preflight', 'parseRecord'].includes(key) ||
      !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
    result[key] = descriptor.value;
  }
  return result;
}

function data(value) {
  const pending = [value], seen = new Set();
  let count = 0, bytes = 0;
  while (pending.length) {
    const current = pending.pop();
    if (++count > 8192) invalid();
    if (typeof current === 'string') bytes += Buffer.byteLength(current);
    if (bytes > LIMIT || Object.is(current, -0)) invalid();
    if (!current || typeof current !== 'object') continue;
    if (types.isProxy(current) || seen.has(current)) invalid();
    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!Object.hasOwn(descriptor, 'value') || typeof key !== 'string') invalid();
      bytes += Buffer.byteLength(key);
      if (bytes > LIMIT || pending.length >= 8192) invalid();
      pending.push(descriptor.value);
    }
  }
  return copyImmutableData(value, '', invalid);
}

function leaf(name) {
  if (typeof name !== 'string' || !name || !name.isWellFormed() || Buffer.byteLength(name) > 255 ||
    /[\x00-\x1f\x7f-\x9f<>:"/\\|?*]|[. ]$/u.test(name) || ['.', '..'].includes(name) ||
    /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])\s*(?:\.|$)/iu.test(name)) invalid();
  return name;
}

function ancestry(directory) {
  const result = [];
  for (let current = directory; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    result.push([current, identity(stat)]);
    if (current === path.dirname(current)) return result;
  }
}

function privateDirectory(directory) {
  assertCanonicalPath(directory);
  const stat = fs.lstatSync(directory);
  assert.ok(typeof process.getuid === 'function' && stat.uid === process.getuid() && (stat.mode & 0o077) === 0,
    'private current-user lease directory required');
  return ancestry(directory);
}

const capabilities = new WeakMap();

/** Detach the disk declaration without inspecting files or acquiring resources. */
export function validateFileLeaseDeclaration(input) {
  const { registry, lockNames, record: original, usedName = null, preflight, parseRecord } = options(input);
  if (preflight !== undefined || parseRecord !== undefined) invalid();
  const names = data(lockNames), captured = data(original);
  if (typeof registry !== 'string' || !registry.isWellFormed() || !path.isAbsolute(registry) || path.resolve(registry) !== registry ||
    /[\x00-\x1f\x7f-\x9f]/u.test(registry) || path.sep === '/' && registry.includes('\\')) invalid();
  if (!Array.isArray(names) || names.length === 0 || names.length > 256 || !captured ||
    typeof captured !== 'object' || Array.isArray(captured)) invalid();
  names.forEach(leaf); if (usedName !== null) leaf(usedName);
  const allNames = usedName === null ? [...names] : [...names, usedName];
  if (new Set(allNames.map(fold)).size !== allNames.length) invalid();
  const text = JSON.stringify(captured) + '\n';
  if (Buffer.byteLength(text) > LIMIT) invalid();
  return Object.freeze({ registry, lockNames: names, usedName, record: copyImmutableData(JSON.parse(text)) });
}

/** Close this capability's descriptors without unlinking any retained lock. */
export function abandonFileLease(lease) {
  const abandon = capabilities.get(lease);
  if (!abandon) invalid();
  abandon();
}

/**
 * Cooperative, current-user file leases. Names, record and optional single-use
 * marker are explicit; no resource is probed or stopped and no stale lock is
 * reclaimed. All locks are held during preflight. Callbacks are trusted, must
 * settle, and cannot be preempted. Release preserves the marker and all data.
 * Canonical path/ancestor checks detect drift; they are not atomic openat locks.
 */
export async function acquireFileLease(input) {
  const { registry, lockNames, record: original, usedName = null, preflight,
    parseRecord = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } = options(input);
  if (typeof parseRecord !== 'function' || types.isProxy(parseRecord) || Object.getPrototypeOf(parseRecord) !== Function.prototype) invalid();
  const declaration = validateFileLeaseDeclaration({ registry, lockNames, record: original, usedName });
  const names = declaration.lockNames, record = declaration.record;
  const allNames = usedName === null ? [...names] : [...names, usedName];
  if (preflight !== undefined) { try { assertVerificationCallback(preflight); } catch { invalid(); } }
  const text = JSON.stringify(record) + '\n';
  let registryIdentity;
  try {
    if (typeof registry !== 'string') invalid();
    assertCanonicalPath(path.dirname(registry));
    if (fs.lstatSync(registry, { throwIfNoEntry: false }) === undefined) {
      assertCanonicalPath(registry, { kind: 'new' });
      try { fs.mkdirSync(registry, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    registryIdentity = privateDirectory(registry);
    const entries = fs.readdirSync(registry);
    for (const name of allNames) assert.ok(entries.filter(entry => fold(entry) === fold(name)).every(entry => entry === name));
  } catch (error) {
    if (error.code === 'FILE_LEASE_INVALID') throw error;
    throw failure('FILE_LEASE_REGISTRY', 'file lease registry is not canonical and private');
  }
  const locks = [];
  let released = false, abandoned = false, callbackUnsettled = false;
  const abandon = () => {
    abandoned = true;
    const errors = [];
    for (const lock of locks) if (lock.fd !== null) {
      const fd = lock.fd; lock.fd = null;
      try { fs.closeSync(fd); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'retained lease handle cleanup failed');
  };
  const changed = message => failure('FILE_LEASE_CHANGED', message);
  const checkRegistry = () => {
    try { assert.deepEqual(privateDirectory(registry), registryIdentity); }
    catch { throw changed('lease directory or ancestor replaced'); }
  };
  const checkLocks = () => {
    checkRegistry();
    for (const lock of locks) {
      let stat;
      try { stat = fs.lstatSync(lock.file); } catch { throw changed('lease lock replaced'); }
      if (stat.dev !== lock.identity[0] || stat.ino !== lock.identity[1]) throw changed('lease lock replaced');
      try {
        assert.deepEqual(identity(stat), lock.identity);
        assert.deepEqual(identity(fs.fstatSync(lock.fd)), lock.identity);
        const current = captureEvidenceFile(lock.file, { limit: LIMIT, parse: parseRecord });
        assert.deepEqual(JSON.parse(JSON.stringify(data(current.value))), record);
      } catch { throw changed('lease owner/token/content changed'); }
    }
  };
  const releaseLocks = () => {
    // Validate the whole acquired set before unlinking any member.
    checkLocks();
    const errors = [];
    while (locks.length) {
      const lock = locks.at(-1);
      fs.unlinkSync(lock.file); locks.pop();
      const fd = lock.fd; lock.fd = null;
      try { fs.closeSync(fd); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'lease descriptor close failed after unlink');
  };
  const create = (name, marker = false) => {
    checkRegistry();
    const aliases = fs.readdirSync(registry).filter(entry => fold(entry) === fold(name));
    if (aliases.some(entry => entry !== name)) throw changed('lease resource spelling changed');
    const file = path.join(registry, name);
    let fd;
    try { fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') throw failure(marker ? 'FILE_LEASE_USED' : 'FILE_LEASE_HELD',
        marker ? 'file lease grant already used; no automatic reuse' : 'file lease already held; no automatic takeover', { lockName: name });
      throw failure('FILE_LEASE_IO', 'file lease reservation failed');
    }
    try { if (!marker) locks.push({ file, fd, identity: identity(fs.fstatSync(fd)) }); }
    catch {
      try { fs.closeSync(fd); } catch { /* Unverified reservation remains; never unlink by a guessed identity. */ }
      throw failure('FILE_LEASE_IO', 'file lease handle admission failed; reservation retained');
    }
    try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); }
    catch { throw failure('FILE_LEASE_IO', 'file lease record write failed'); }
    finally { if (marker) fs.closeSync(fd); }
  };
  try {
    names.forEach(name => create(name));
    if (preflight !== undefined) {
      try { await settleVerificationCallback(preflight, [], () => null); }
      catch (error) {
        if (Object.hasOwn(error, 'callbackSettled')) {
          callbackUnsettled = error.callbackSettled === false;
          throw failure('FILE_LEASE_INVALID', 'invalid file lease preflight result');
        }
        throw error;
      }
    }
    checkLocks();
    if (usedName !== null) create(usedName, true);
    checkLocks();
  } catch (error) {
    try {
      if (callbackUnsettled) throw changed('lease preflight settlement unverified');
      releaseLocks();
    }
    catch (cleanupError) {
      try { abandon(); } catch { /* Lock files remain retained regardless of descriptor errors. */ }
      throw Object.assign(new AggregateError([error, cleanupError], 'lease acquisition failed; changed locks retained for owner investigation'),
        { code: 'FILE_LEASE_CLEANUP' });
    }
    throw error;
  }
  const lease = Object.freeze({ registry, record,
    assertHeld() {
      if (released || abandoned) throw failure('FILE_LEASE_RELEASED', 'lease already released or abandoned');
      checkLocks();
    },
    release() {
      if (abandoned) throw failure('FILE_LEASE_RELEASED', 'lease handles abandoned; files retained');
      if (!released) { releaseLocks(); released = true; }
    },
  });
  capabilities.set(lease, abandon);
  return lease;
}
