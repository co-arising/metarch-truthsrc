import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { copyImmutableData } from './immutable-data.mjs';
import { at, escape, object, pointer, resolve as resolvePointer, text } from './products/request.mjs';
import { planAnchors, verifyAnchorsPlan } from '../src/core/anchors.mjs';

export const bytesSha = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const fold = name => name.normalize('NFC').toLowerCase();
const stamp = stat => [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeMs, stat.ctimeMs];

function captureData(value) {
  const captured = copyImmutableData(value);
  assert.ok(Buffer.byteLength(JSON.stringify(captured)) <= 8 * 1024 * 1024, 'source data exceeds 8 MiB');
  return captured;
}

function canonicalRoot(root) {
  assert.ok(typeof root === 'string' && isAbsolute(root) && resolve(root) === root &&
    (sep === '\\' || !root.includes('\\')) && !root.includes('\0'), 'canonical absolute source root required');
  for (let path = root; ; path = dirname(path)) {
    const stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), 'symlink source root or ancestor: ' + path);
    assert.ok(stat.isDirectory(), 'source root and ancestors must be directories');
    if (dirname(path) === path) break;
    const name = relative(dirname(path), path);
    assert.deepEqual(readdirSync(dirname(path)).filter(item => fold(item) === fold(name)), [name],
      'case-fold source root alias: ' + path);
  }
  assert.equal(realpathSync(root), root, 'source root must be canonical and non-symlink');
}

function fileSha(file, initial) {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    assert.ok(before.isFile(), 'non-regular source file: ' + file);
    assert.deepEqual(stamp(before), stamp(initial), 'source changed before reading: ' + file);
    const bytes = readFileSync(fd), after = fstatSync(fd), current = lstatSync(file);
    assert.deepEqual(stamp(after), stamp(before), 'source changed while reading: ' + file);
    assert.deepEqual(stamp(current), stamp(before), 'source replaced while reading: ' + file);
    return bytesSha(bytes);
  } finally { closeSync(fd); }
}

/** Complete file inventory: no build-directory exclusions, links or filesystem aliases. */
export function sourceInventory(root) {
  canonicalRoot(root);
  const result = [], inodes = new Set();
  function walk(directory) {
    const names = readdirSync(directory).sort((a, b) => a.localeCompare(b, 'en'));
    assert.equal(new Set(names.map(fold)).size, names.length, 'case-fold inventory alias');
    for (const name of names) {
      assert.ok(!name.includes('\\') && !name.includes('\0'), 'unsafe inventory filename');
      const file = join(directory, name), key = relative(root, file).split(sep).join('/'), stat = lstatSync(file);
      assert.ok(!stat.isSymbolicLink(), 'symlink in inventory: ' + key);
      if (stat.isDirectory()) walk(file);
      else {
        assert.ok(stat.isFile(), 'non-regular inventory entry: ' + key);
        const inode = `${stat.dev}:${stat.ino}`;
        assert.ok(!inodes.has(inode), 'duplicate source filesystem alias: ' + key);
        inodes.add(inode);
        result.push([key, fileSha(file, stat)]);
      }
    }
  }
  walk(root);
  return Object.fromEntries(result);
}

function documentIndex(request) {
  const captured = captureData(request);
  assert.ok(Array.isArray(captured.documents), 'source request.documents must be an array');
  const documents = new Map();
  for (const document of captured.documents) {
    assert.ok(document && typeof document === 'object' && !Array.isArray(document), 'source document must be an object');
    text(document.id, at('request')); text(document.schemaVersion, at(document.id));
    assert.ok(!/[#\0]/u.test(document.id) && !document.schemaVersion.includes('\0'), 'invalid source document identity');
    assert.ok(Object.hasOwn(document, 'value'), 'source document value required');
    assert.ok(!documents.has(document.id), 'duplicate source document ID: ' + document.id);
    documents.set(document.id, { document, documentSha: bytesSha(JSON.stringify(document.value)) });
  }
  return documents;
}

function versionAt(value, previous) {
  if (value === null || typeof value !== 'object' || !Object.hasOwn(value, 'version')) return previous;
  const version = value.version;
  assert.ok(version === null || typeof version === 'string' && version.trim() && !version.includes('\0') ||
    Number.isSafeInteger(version) && version > 0, 'invalid source definition version');
  return version;
}

function referenceFrom(documents, knowledgeKey) {
  assert.ok(typeof knowledgeKey === 'string' && !knowledgeKey.includes('\0'), 'source key must be a string without NUL');
  const match = /^source:([^#]+)#(\/.*|)$/su.exec(knowledgeKey);
  assert.ok(match, 'unsupported source key: ' + knowledgeKey);
  const found = documents.get(match[1]);
  assert.ok(found, 'source document missing: ' + match[1]);
  const { document, documentSha } = found, path = match[2], location = at(document.id, path);
  let value = document.value, definitionVersion = versionAt(value, null);
  // Resolve each component through the strict RFC 6901 helper (including array indexes).
  for (const token of pointer(path, location)) {
    value = resolvePointer(value, '/' + escape(token), location);
    definitionVersion = versionAt(value, definitionVersion);
  }
  return { knowledgeKey, document: document.id, pointer: path, schemaVersion: document.schemaVersion,
    documentSha, valueSha: bytesSha(JSON.stringify(value)), definitionVersion,
    sourceVersion: { kind: 'document-content-sha256', value: documentSha } };
}

/** Resolve against detached strict JSON; schema names are caller-owned, not product policies. */
export function sourceReference(request, knowledgeKey) {
  return referenceFrom(documentIndex(request), knowledgeKey);
}

/**
 * Read-only, file-level evidence for explicit owner declarations. Never writes an index,
 * anchors or sources, and never certifies semantics, runtime behavior or symbols/spans.
 * Entries are {file, relation, rationale, sources: ['source:document#/pointer', ...]}.
 * generator is an explicit {id, version}; allowedRelations is a non-empty string array.
 * Callers pin previous inventories/references separately and coordinate exclusive roots:
 * full pre/post inventories detect ordinary drift, not hostile concurrent replacement.
 */
export async function verifyHandwrittenSources(root, request, entries, { generator, allowedRelations }) {
  const policy = captureData({ generator, allowedRelations });
  assert.ok(Array.isArray(policy.allowedRelations) && policy.allowedRelations.length > 0,
    'explicit non-empty allowedRelations required');
  for (const relation of policy.allowedRelations) {
    text(relation, at('allowedRelations'));
    assert.ok(!relation.includes('\0'), 'invalid allowed relation');
  }
  assert.equal(new Set(policy.allowedRelations).size, policy.allowedRelations.length, 'duplicate allowed relation');
  const documents = documentIndex(request), mappings = captureData(entries), inventory = sourceInventory(root);
  assert.ok(Array.isArray(mappings), 'handwritten entries must be an array');
  for (const entry of mappings) object(entry, ['file', 'relation', 'rationale', 'sources'], at('mapping'));
  assert.equal(new Set(mappings.map(entry => entry.file)).size, mappings.length, 'duplicate handwritten mapping');
  assert.deepEqual(mappings.map(entry => entry.file).sort(), Object.keys(inventory).sort(),
    'handwritten mapping must cover exact inventory');
  const groups = new Map(), references = new Map();
  const rows = mappings.map(entry => {
    assert.ok(policy.allowedRelations.includes(entry.relation), 'unsupported handwritten relation');
    text(entry.rationale, at('mapping', '/rationale'));
    assert.ok(!entry.rationale.includes('\0'), 'invalid handwritten rationale');
    assert.ok(Array.isArray(entry.sources) && entry.sources.length > 0 &&
      new Set(entry.sources).size === entry.sources.length, 'non-empty unique handwritten sources required');
    const refs = entry.sources.map(key => {
      if (!references.has(key)) references.set(key, referenceFrom(documents, key));
      const locations = groups.get(key) ?? [];
      locations.push({ repo: root, file: entry.file, expectedFingerprint: inventory[entry.file] });
      groups.set(key, locations);
      return references.get(key);
    });
    return { ...entry, fingerprint: inventory[entry.file], references: refs };
  });
  const anchors = await verifyAnchorsPlan(planAnchors({ generator: policy.generator,
    plannedKnowledgeKeys: [...groups].map(([knowledgeKey, locations]) => ({ knowledgeKey, locations })),
    finalApplyOutcomes: Object.entries(inventory).map(([file, fingerprint]) => ({ repo: root, file, outcome: 'IDENTICAL', fingerprint }))
  }), { repoRoots: { [root]: root } });
  assert.deepEqual(sourceInventory(root), inventory, 'handwritten source inventory changed during verification');
  assert.ok(Object.values(anchors.anchors).flat().every(location => location.status === 'source-verified' &&
    location.fingerprint === inventory[location.file] && location.verification.level === 'file' &&
    location.symbol === null && location.span === null), 'handwritten source bytes failed anchor verification');
  return { root, inventory, entries: rows, anchors, semanticMapping: 'explicit-owner-declared-not-inferred',
    verification: 'source-pointer-resolution-and-actual-file-sha', symbolSpanVerified: false };
}
