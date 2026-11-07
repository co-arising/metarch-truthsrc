import assert from 'node:assert/strict';
import path from 'node:path';
import { copyImmutableData } from '../immutable-data.mjs';
import { assertCanonicalPath, captureEvidenceFile } from './files.mjs';

export const TOOLING_OWNERSHIP_SCHEMA = 'truthsrc.tooling-ownership/v1';
const fold = value => value.normalize('NFC').toLowerCase();
const lifecycles = ['current', 'historical', 'shared-historical', 'paused'];
const natures = ['mechanism', 'policy', 'mixed', 'adapter'];
const statuses = ['migrated', 'partial', 'deferred', 'consumer-policy', 'historical-local', 'paused'];
const kinds = ['import', 'entry', 'test', 'reference'];

function object(value, keys, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label}: required/unknown fields`);
}
function text(value, label) {
  assert.ok(typeof value === 'string' && value.trim() === value && value.length > 0 &&
    value.isWellFormed() && !/[\x00-\x1f\x7f-\x9f]/u.test(value), `${label}: nonempty concrete text required`);
}
function relativeFile(value, label) {
  text(value, label);
  assert.ok(!/[\\:]/u.test(value) && !path.posix.isAbsolute(value) &&
    value.split('/').every(part => part !== '' && part !== '.' && part !== '..'), `${label}: unsafe relative path`);
  return value;
}
function uniqueStrings(value, label, validate = text, nonempty = true) {
  assert.ok(Array.isArray(value) && (!nonempty || value.length > 0), `${label}: array required`);
  value.forEach(item => validate(item, label));
  assert.equal(new Set(value.map(fold)).size, value.length, `${label}: duplicate or aliased value`);
}
function enumValue(value, values, label) {
  assert.ok(values.includes(value), `${label}: unsupported value`);
}
const inside = (file, root) => file.startsWith(root + '/');

/**
 * Optional, synchronous, READ-ONLY inventory validation. The caller supplies the
 * complete candidateFiles (e.g. its own git ls-files -z plus explicitly declared
 * new files); this library never invokes Git, imports inventoried modules, scans
 * outputs, starts services or downloads anything. toolRoots select the exact file
 * subset from that list, NOT from a hidden filesystem walk.
 *
 * Consumers contain literal evidence plus owner-declared kind/note. Public targets
 * name an explicitly supplied sourceRoots key, a file, and the consumer/specifier
 * that refers to it. We capture bounded regular files through files.mjs and check
 * literal references/relative resolution, not JavaScript grammar, exports, runtime
 * import closure, arbitrary dynamic imports, ownership semantics or business truth.
 * A quoted string in a comment can pass: this is declaration evidence, NOT proof
 * of invocation. Non-bank callers choose their own roots, tools and declarations.
 *
 * No global snapshot/locking guarantee: coordinate roots against concurrent edits.
 * Returned digests describe each individual capture; input objects are detached.
 */
export function verifyToolingOwnership(input) {
  const data = copyImmutableData(input);
  object(data, ['root', 'inventory', 'candidateFiles', 'sourceRoots'], 'options');
  assert.ok(Buffer.byteLength(JSON.stringify(data)) <= 8 * 1024 * 1024, 'inventory options exceed 8 MiB');
  const { root, inventory, candidateFiles, sourceRoots } = data;
  assertCanonicalPath(root);
  uniqueStrings(candidateFiles, 'candidateFiles', relativeFile);
  const candidates = new Set(candidateFiles);
  assert.ok(sourceRoots && typeof sourceRoots === 'object' && !Array.isArray(sourceRoots), 'sourceRoots: object required');
  for (const [name, directory] of Object.entries(sourceRoots)) {
    assert.match(name, /^[A-Za-z][A-Za-z0-9_-]*$/, 'invalid sourceRoots name');
    assertCanonicalPath(directory);
  }
  object(inventory, ['schemaVersion', 'toolRoots', 'scope', 'entries'], 'inventory');
  assert.equal(inventory.schemaVersion, TOOLING_OWNERSHIP_SCHEMA, 'inventory schemaVersion');
  text(inventory.scope, 'scope');
  uniqueStrings(inventory.toolRoots, 'toolRoots', relativeFile);
  for (const a of inventory.toolRoots) for (const b of inventory.toolRoots) {
    assert.ok(a === b || !inside(fold(a), fold(b)), 'overlapping toolRoots');
  }
  assert.ok(Array.isArray(inventory.entries), 'entries: array required');
  const toolFiles = inventory.entries.map(entry => {
    object(entry, ['file', 'provenance', 'responsibility', 'lifecycle', 'consumers', 'publicMechanism'], 'entry');
    return relativeFile(entry.file, 'entry.file');
  });
  uniqueStrings(toolFiles, 'entries', relativeFile);
  const expected = candidateFiles.filter(file => inventory.toolRoots.some(directory => inside(file, directory)));
  assert.deepEqual([...toolFiles].sort(), expected.sort(), 'inventory must cover exact candidate file membership');

  const captures = new Map();
  function capture(directory, file) {
    const absolute = path.join(directory, ...file.split('/'));
    if (!captures.has(absolute)) captures.set(absolute, captureEvidenceFile(absolute));
    return captures.get(absolute);
  }
  function local(file) {
    relativeFile(file, 'referenced file');
    assert.ok(candidates.has(file), 'referenced file absent from candidateFiles: ' + file);
    return capture(root, file);
  }
  function evidence(file, literal) {
    text(literal, 'reference evidence');
    assert.ok(local(file).value.includes(Buffer.from(literal)), 'missing literal reference in ' + file + ': ' + literal);
  }
  const entries = inventory.entries.map(entry => {
    const captured = local(entry.file);
    enumValue(entry.lifecycle, lifecycles, 'lifecycle');
    object(entry.provenance, ['kind', 'basis'], 'provenance');
    enumValue(entry.provenance.kind, ['engineering-authored', 'generated', 'external'], 'provenance.kind');
    text(entry.provenance.basis, 'provenance.basis');
    object(entry.responsibility, ['summary', 'owners', 'nature', 'mechanism', 'policy'], 'responsibility');
    const responsibility = entry.responsibility;
    for (const key of ['summary', 'mechanism', 'policy']) text(responsibility[key], 'responsibility.' + key);
    uniqueStrings(responsibility.owners, 'responsibility.owners');
    enumValue(responsibility.nature, natures, 'responsibility.nature');
    assert.ok(Array.isArray(entry.consumers), 'consumers: array required');
    const consumerKeys = new Set();
    for (const reference of entry.consumers) {
      object(reference, ['file', 'kind', 'evidence', 'note'], 'consumer');
      enumValue(reference.kind, kinds, 'consumer.kind');
      text(reference.note, 'consumer.note');
      const key = JSON.stringify([reference.file, reference.kind, reference.evidence]);
      assert.ok(!consumerKeys.has(key), 'duplicate consumer reference');
      consumerKeys.add(key);
      evidence(reference.file, reference.evidence);
    }
    object(entry.publicMechanism, ['status', 'targets', 'note'], 'publicMechanism');
    const { status, targets, note } = entry.publicMechanism;
    enumValue(status, statuses, 'publicMechanism.status');
    text(note, 'publicMechanism.note');
    assert.ok(Array.isArray(targets), 'publicMechanism.targets: array required');
    assert.ok(!['migrated', 'partial'].includes(status) || targets.length > 0,
      'migrated/partial public mechanism requires resolvable targets');
    const targetKeys = new Set();
    for (const target of targets) {
      object(target, ['sourceRoot', 'file', 'consumer', 'specifier'], 'public target');
      text(target.sourceRoot, 'public target sourceRoot');
      assert.ok(Object.hasOwn(sourceRoots, target.sourceRoot), 'undeclared public source root: ' + target.sourceRoot);
      relativeFile(target.file, 'public target file');
      relativeFile(target.consumer, 'public target consumer');
      text(target.specifier, 'public target specifier');
      assert.ok(/^\.\.?\//u.test(target.specifier) && !/[\\:#?'"`]/u.test(target.specifier),
        'public target requires a relative file specifier');
      const key = JSON.stringify([target.sourceRoot, target.file, target.consumer, target.specifier]);
      assert.ok(!targetKeys.has(key), 'duplicate public target');
      targetKeys.add(key);
      const destination = path.join(sourceRoots[target.sourceRoot], ...target.file.split('/'));
      assert.equal(path.resolve(root, path.dirname(target.consumer), target.specifier), destination,
        'public target does not resolve from declared consumer');
      const consumer = local(target.consumer);
      assert.ok(["'", '"'].some(quote => consumer.value.includes(Buffer.from(quote + target.specifier + quote))),
        'public target missing literal specifier: ' + target.consumer);
      capture(sourceRoots[target.sourceRoot], target.file);
    }
    return { file: entry.file, bytes: captured.bytes, sha256: captured.sha256, lifecycle: entry.lifecycle };
  });
  return copyImmutableData({
    schemaVersion: TOOLING_OWNERSHIP_SCHEMA, passed: true, toolCount: entries.length, entries,
    references: [...captures].map(([file, captured]) => ({ file, bytes: captured.bytes, sha256: captured.sha256 })),
    verification: 'exact-candidate-membership-and-captured-literal-references',
    declaration: 'owner-declared-not-semantic-proof', candidateCompletenessVerified: false,
    semanticsVerified: false, executionVerified: false, importClosureVerified: false,
  });
}
