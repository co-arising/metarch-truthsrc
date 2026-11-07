import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import promises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bytesSha, sourceInventory, sourceReference, verifyHandwrittenSources } from '../lib/handwritten-provenance.mjs';

const testDir = fs.realpathSync(dirname(fileURLToPath(import.meta.url)));
const policy = { generator: { id: 'garden-owner-map', version: '7' }, allowedRelations: ['cultivates', 'documents'] };
const key = 'source:garden#/plants/0';
const request = () => ({ documents: [
  { id: 'garden', schemaVersion: 'garden.catalog/v3', value: {
    version: 'catalog-3', plants: [{ version: 2, name: 'Rose' }, { name: 'Iris' }],
    'a/b': { '~leaf': [{ version: 'escaped-1', name: 'Lily' }] }, '': null,
  } },
  { id: 'notes', schemaVersion: 'garden.notes/v1', value: { text: 'Owner-declared, not inferred.' } },
] });
const mappings = () => [
  { file: 'source/plant.mjs', relation: 'cultivates', rationale: 'The owner implements this plant adapter.', sources: [key] },
  { file: 'guide.txt', relation: 'documents', rationale: 'The owner documents the plant adapter.', sources: [key, 'source:notes#'] },
];
function fixture(t) {
  const owned = fs.mkdtempSync(join(testDir, '.handwritten-provenance-'));
  t.after(() => fs.rmSync(owned, { recursive: true, force: true }));
  const root = join(owned, 'implementation');
  fs.mkdirSync(join(root, 'source'), { recursive: true });
  fs.writeFileSync(join(root, 'source/plant.mjs'), 'export const plant = "Rose";\n');
  fs.writeFileSync(join(root, 'guide.txt'), 'A rose, not a financial domain.\n');
  return { owned, root };
}
const verify = (root, entries = mappings(), input = request(), options = policy) =>
  verifyHandwrittenSources(root, input, entries, options);

test('nonbank explicit policy produces compatible file-only evidence with 1:N and N:1 references', async t => {
  const { root } = fixture(t), input = request(), entries = mappings();
  const before = structuredClone({ input, entries, policy });
  const result = await verify(root, entries, input);
  assert.equal(result.root, root);
  assert.deepEqual(result.inventory, sourceInventory(root));
  assert.equal(result.semanticMapping, 'explicit-owner-declared-not-inferred');
  assert.equal(result.symbolSpanVerified, false);
  assert.equal(result.verification, 'source-pointer-resolution-and-actual-file-sha');
  assert.equal(result.entries.length, 2);
  assert.equal(result.anchors.anchors[key].length, 2);
  assert.equal(result.entries[1].references.length, 2);
  for (const row of result.entries) {
    assert.equal(row.fingerprint, result.inventory[row.file]);
    assert.deepEqual(row.references, row.sources.map(k => sourceReference(input, k)));
  }
  for (const location of Object.values(result.anchors.anchors).flat()) {
    assert.equal(location.repo, root);
    assert.equal(location.generator, policy.generator.id);
    assert.equal(location.generatorVersion, policy.generator.version);
    assert.equal(location.status, 'source-verified');
    assert.equal(location.symbol, null); assert.equal(location.span, null);
    assert.deepEqual(location.verification, { method: 'sha256-bytes', level: 'file',
      fileVerified: true, symbolVerified: false, spanVerified: false });
  }
  assert.deepEqual({ input, entries, policy }, before);
});

test('references bind document/value content hashes and the nearest declared version', () => {
  const input = request(), document = input.documents[0];
  const documentSha = bytesSha(JSON.stringify(document.value));
  assert.deepEqual(sourceReference(input, key), { knowledgeKey: key, document: 'garden', pointer: '/plants/0',
    schemaVersion: 'garden.catalog/v3', documentSha, valueSha: bytesSha(JSON.stringify(document.value.plants[0])),
    definitionVersion: 2, sourceVersion: { kind: 'document-content-sha256', value: documentSha } });
  assert.equal(sourceReference(input, 'source:garden#/plants/1/name').definitionVersion, 'catalog-3');
  assert.equal(sourceReference(input, 'source:garden#/a~1b/~0leaf/0/name').definitionVersion, 'escaped-1');
  assert.equal(sourceReference(input, 'source:notes#').definitionVersion, null);
  assert.equal(sourceReference(input, 'source:garden#/').valueSha, bytesSha('null'));
  assert.equal(sourceReference(input, 'source:garden#').valueSha, documentSha);
  const old = sourceReference(input, key);
  document.value.plants[0].name = 'Tulip';
  const changed = sourceReference(input, key);
  assert.notEqual(old.documentSha, changed.documentSha); assert.notEqual(old.valueSha, changed.valueSha);
  document.value.plants[0].version = 4;
  assert.equal(sourceReference(input, key).definitionVersion, 4);
  assert.equal(bytesSha(Buffer.from('abc')), 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('generic source documents retain finite decimal values without product compilation policy', async t => {
  const { root } = fixture(t), input = request();
  input.documents[0].value.plants[0].rate = 0.5;
  input.documents[1].value.unreferencedRate = 1.25;
  const reference = sourceReference(input, key);
  assert.equal(reference.valueSha, bytesSha(JSON.stringify(input.documents[0].value.plants[0])));
  const result = await verify(root, mappings(), input);
  assert.equal(result.entries[0].references[0].valueSha, reference.valueSha);
});

test('native filesystem paths use portable slash-separated inventory and mapping keys', async t => {
  const { root } = fixture(t);
  assert.deepEqual(Object.keys(sourceInventory(root)).sort(), ['guide.txt', 'source/plant.mjs']);
  const result = await verify(root);
  assert.ok(Object.values(result.anchors.anchors).flat().every(location => !location.file.includes('\\')));
});

test('strict pointers reject escapes, array aliases, inherited properties and unsupported source keys', () => {
  for (const bad of ['source:garden#/a~2b', 'source:garden#/a~', 'source:garden#/plants/01',
    'source:garden#/plants/-', 'source:garden#/plants/length', 'source:garden#/plants/+0',
    'source:garden#/plants/9', 'source:garden#/toString', 'source:garden#/__proto__',
    'source:garden#/plants/0/name/length', 'source:missing#', 'source:garden#plants',
    'source:garden#%2Fplants%2F0', 'knowledge:garden#/plants/0', 'source:garden#/plants/0\0', null, 1]) {
    assert.throws(() => sourceReference(request(), bad), undefined, String(bad));
  }
  const input = request();
  input.documents[0].value = JSON.parse('{"__proto__":{"version":1,"name":"literal own key"}}');
  assert.equal(sourceReference(input, 'source:garden#/__proto__/name').valueSha, bytesSha('"literal own key"'));
});

test('duplicate document IDs fail even when the ambiguous document is not referenced', async t => {
  const { root } = fixture(t);
  for (const index of [0, 1]) {
    const input = request(); input.documents.push(structuredClone(input.documents[index]));
    assert.throws(() => sourceReference(input, key), /duplicate source document ID/);
    await assert.rejects(verify(root, mappings(), input), /duplicate source document ID/);
  }
});

test('source input and versions reject non-JSON data without invoking getters or toJSON', () => {
  let called = false;
  const input = request();
  Object.defineProperty(input.documents[0].value, 'unsafe', { enumerable: true, get() { called = true; return 1; } });
  assert.throws(() => sourceReference(input, key)); assert.equal(called, false);
  for (const version of ['', 0, -1, 1.5, {}, [], false]) {
    const value = request(); value.documents[0].value.plants[0].version = version;
    assert.throws(() => sourceReference(value, key));
  }
  for (const mutate of [
    value => { value.documents[0].value.toJSON = () => { called = true; return {}; }; },
    value => { value.documents[0].value.plants[0].name = undefined; },
    value => { value.documents[0].value.plants.push(NaN); },
    value => { delete value.documents[0].schemaVersion; },
    value => { delete value.documents[0].value; },
  ]) {
    const value = request(); mutate(value); assert.throws(() => sourceReference(value, key));
  }
  assert.equal(called, false);
});

test('exact coverage rejects missing, extra, duplicate and unsafe file entries', async t => {
  const { root } = fixture(t);
  for (const mutate of [
    rows => rows.pop(), rows => rows.push({ ...rows[0], file: 'extra.mjs' }), rows => rows.push({ ...rows[0] }),
    rows => { rows[0].file = '../plant.mjs'; }, rows => { rows[0].file = '/plant.mjs'; },
    rows => { rows[0].file = 'source/./plant.mjs'; }, rows => { rows[0].file = 'source\\plant.mjs'; },
  ]) {
    const rows = mappings(); mutate(rows); await assert.rejects(verify(root, rows), /exact inventory|duplicate handwritten/);
  }
});

test('entries require unique nonempty sources, explicit rationale and a declared relation', async t => {
  const { root } = fixture(t);
  for (const mutate of [
    row => { row.sources = []; }, row => { row.sources = [key, key]; }, row => { row.sources = key; },
    row => { row.sources = ['source:missing#']; }, row => { row.sources = ['source:garden#/plants/length']; },
    row => { row.rationale = ' \n '; }, row => { row.rationale = '\0'; },
    row => { delete row.rationale; }, row => { row.rationale = 1; },
    row => { row.relation = 'implements'; }, row => { row.symbol = 'plant'; },
  ]) {
    const rows = mappings(); mutate(rows[0]); await assert.rejects(verify(root, rows));
  }
});

test('generator and relation policies have no implicit defaults', async t => {
  const { root } = fixture(t);
  await assert.rejects(verifyHandwrittenSources(root, request(), mappings()));
  for (const options of [{}, { generator: policy.generator }, { allowedRelations: policy.allowedRelations },
    { ...policy, generator: {} }, { ...policy, generator: { id: 'owner', version: '' } },
    { ...policy, allowedRelations: [] }, { ...policy, allowedRelations: ['cultivates', 'cultivates'] },
    { ...policy, allowedRelations: [''] }]) await assert.rejects(verify(root, mappings(), request(), options));
});

test('inventory includes hidden and build files and safely represents a literal __proto__ filename', t => {
  const { root } = fixture(t);
  fs.mkdirSync(join(root, 'target')); fs.writeFileSync(join(root, 'target/extra.txt'), 'not excluded');
  fs.writeFileSync(join(root, '.hidden'), 'visible to inventory'); fs.writeFileSync(join(root, '__proto__'), 'own property');
  const inventory = sourceInventory(root);
  assert.equal(Object.keys(inventory).length, 5);
  assert.equal(inventory['target/extra.txt'], bytesSha('not excluded'));
  assert.equal(inventory['.hidden'], bytesSha('visible to inventory'));
  assert.equal(inventory.__proto__, bytesSha('own property'));
  assert.equal(Object.getPrototypeOf(inventory), Object.prototype);
});

test('canonical roots reject relative, non-normalized, missing and non-directory paths', async t => {
  const { root, owned } = fixture(t);
  for (const path of ['.', root + '/', root + '/.', root + '/../implementation', root + '\\alias', root + '\0',
    join(owned, 'missing'), join(root, 'guide.txt')]) {
    assert.throws(() => sourceInventory(path)); await assert.rejects(verify(path));
  }
});

test('symlink roots, ancestors, files, directories and dangling links are rejected', async t => {
  const { root, owned } = fixture(t);
  fs.symlinkSync(root, join(owned, 'root-link'));
  fs.symlinkSync(owned, join(owned, 'ancestor-link'));
  for (const path of [join(owned, 'root-link'), join(owned, 'ancestor-link/implementation')]) {
    assert.throws(() => sourceInventory(path), /symlink/); await assert.rejects(verify(path), /symlink/);
  }
  for (const target of ['guide.txt', 'source', '../missing', owned]) {
    const link = join(root, 'link'); fs.symlinkSync(target, link);
    try { assert.throws(() => sourceInventory(root), /symlink/); await assert.rejects(verify(root), /symlink/); }
    finally { fs.unlinkSync(link); }
  }
});

test('duplicate hardlinks are not accepted as independent source files', async t => {
  const { root } = fixture(t); fs.linkSync(join(root, 'guide.txt'), join(root, 'alias.txt'));
  assert.throws(() => sourceInventory(root), /filesystem alias/); await assert.rejects(verify(root), /filesystem alias/);
});

test('nonregular FIFO inventory entries reject before any blocking file read', { skip: process.platform === 'win32' }, async t => {
  const { root } = fixture(t); execFileSync('mkfifo', [join(root, 'pipe')]);
  assert.throws(() => sourceInventory(root), /non-regular/); await assert.rejects(verify(root), /non-regular/);
});

test('successful verification performs no filesystem writes or input mutations', async t => {
  const { root, owned } = fixture(t);
  fs.writeFileSync(join(owned, 'anchors.json'), 'untouched prior index');
  fs.writeFileSync(join(owned, 'truthsrc.ledger.json'), 'untouched prior ledger');
  const before = sourceInventory(owned), input = request(), rows = mappings();
  const snapshot = structuredClone({ input, rows });
  const writes = ['writeFile', 'appendFile', 'write', 'rename', 'unlink', 'rm', 'rmdir', 'mkdir', 'truncate', 'chmod', 'chown', 'link', 'symlink', 'copyFile', 'cp'];
  const denied = () => assert.fail('source verification attempted a write');
  const openSync = fs.openSync, open = promises.open;
  const readFlags = flags => {
    assert.equal(typeof flags, 'number');
    assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT |
      fs.constants.O_TRUNC | fs.constants.O_APPEND), 0, 'read-only open required');
  };
  try {
    for (const name of writes) {
      if (typeof fs[name + 'Sync'] === 'function') t.mock.method(fs, name + 'Sync', denied);
      if (typeof promises[name] === 'function') t.mock.method(promises, name, denied);
    }
    t.mock.method(fs, 'openSync', (file, flags, ...args) => { readFlags(flags); return openSync(file, flags, ...args); });
    t.mock.method(promises, 'open', (file, flags, ...args) => { readFlags(flags); return open(file, flags, ...args); });
    syncBuiltinESMExports();
    await verify(root, rows, input);
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  assert.deepEqual(sourceInventory(owned), before);
  assert.deepEqual({ input, rows }, snapshot);
});

test('unmapped file additions across async anchor verification fail the complete post-inventory', async t => {
  const { root } = fixture(t);
  const pending = verify(root);
  fs.mkdirSync(join(root, 'new-directory')); fs.writeFileSync(join(root, 'new-directory/unmapped.txt'), 'must not escape coverage');
  await assert.rejects(pending, /inventory changed during verification/);
});

test('stale, removed and renamed files across async verification cannot be certified', async t => {
  for (const mutate of [
    root => fs.writeFileSync(join(root, 'guide.txt'), 'new bytes'),
    root => fs.unlinkSync(join(root, 'guide.txt')),
    root => fs.renameSync(join(root, 'guide.txt'), join(root, 'renamed.txt')),
  ]) {
    const { root } = fixture(t), pending = verify(root); mutate(root); await assert.rejects(pending);
  }
});

test('links added during async verification and a replaced root are rejected on re-inventory', async t => {
  for (const mutate of [
    (root, owned) => fs.symlinkSync(owned, join(root, 'new-link')),
    root => { fs.renameSync(root, root + '-moved'); fs.symlinkSync(root + '-moved', root); },
  ]) {
    const { root, owned } = fixture(t), pending = verify(root); mutate(root, owned); await assert.rejects(pending, /symlink/i);
  }
});

test('caller mutations across await do not alter captured source references or declarations', async t => {
  const { root } = fixture(t), input = request(), rows = mappings(), options = structuredClone(policy);
  const expected = sourceReference(input, key), pending = verify(root, rows, input, options);
  input.documents[0].value.plants[0].name = 'Changed'; rows[0].sources[0] = 'source:missing#';
  rows[0].rationale = 'Changed'; options.generator.id = 'Changed'; options.allowedRelations.length = 0;
  const result = await pending;
  assert.deepEqual(result.entries[0].references, [expected]);
  assert.equal(result.entries[0].rationale, mappings()[0].rationale);
  assert.equal(result.anchors.anchors[key][0].generator, policy.generator.id);
});
