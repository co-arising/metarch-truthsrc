import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStrictJson } from '../strict-json.mjs';

export const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DOC_ROOT = join(TOOL_ROOT, 'docs/artifacts');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = value => JSON.stringify(value, null, 2) + '\n';
export const readJson = file => parseStrictJson(readFileSync(file));
export function normalizedPath(file) {
  assert.equal(typeof file, 'string', 'relative path required');
  assert.ok(file && !isAbsolute(file) && !/[\\\x00-\x1f\x7f]/u.test(file) &&
    !file.split('/').some(part => !part || part === '.' || part === '..'), 'normalized relative path required');
  return file;
}
export function within(root, file) {
  normalizedPath(file);
  const base = realpathSync(root), target = join(base, file);
  for (let p = target; p !== base; p = dirname(p)) {
    const stat = lstatSync(p, { throwIfNoEntry: false });
    assert.ok(!stat?.isSymbolicLink(), 'symlink source/output is not admitted: ' + file);
  }
  assert.ok(relative(base, target) && !relative(base, target).startsWith('../'));
  return target;
}
export function fileRecord(root, file) {
  const path = within(root, file), stat = lstatSync(path);
  assert.ok(stat.isFile(), 'regular source file required: ' + file);
  const bytes = readFileSync(path);
  return { path: file, bytes: bytes.length, sha256: sha256(bytes), mode: stat.mode & 0o111 ? '100755' : '100644' };
}
export function walk(root, prefix = '') {
  const directory = prefix ? within(root, prefix) : root;
  const stat = lstatSync(directory, { throwIfNoEntry: false });
  if (!stat) return [];
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'plain directory required');
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
    const file = prefix ? prefix + '/' + entry.name : entry.name;
    assert.ok(!entry.isSymbolicLink(), 'symlink inventory entry is not admitted: ' + file);
    return entry.isDirectory() ? walk(root, file) : entry.isFile() ? [file] : [];
  });
}
export function exactKeys(value, keys, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label + ' fields differ');
}
export function unique(values, label) {
  assert.equal(new Set(values).size, values.length, 'duplicate ' + label);
}
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
