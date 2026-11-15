import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTree, compileTreeWithSources, loadTreeSnapshot } from '../lib/compile.mjs';
import { compileSnapshot } from '../lib/compile-snapshot.mjs';
import { decomposeCanonical, decomposeEntries } from '../lib/decompose.mjs';
import { parseDoc, emitDoc } from '../lib/shared.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { LEGACY_SURFACE_VERSION } from '../lib/legacy-author-surface.mjs';

const workshop = 'schemaVersion: truthsrc/v1\nname: legacy-demo\nsessionOrder:\n  - refining\n';
const policyFile = 'inbox/10-policies/policy-rf-faultreschedule-9.yaml';
const policy = '# Preserve this proposed workshop observation.\n\nkind: note\ntype: policy\nname: "FaultReschedule"\norigin:\n  stage: refining\n  board: proposed\n  seq: 9\npayload:\n  { "type": "policy", "name": "FaultReschedule", "info": { "confidence": "low" }, "description": "Await steward adjudication." }\n';
const catalogFile = 'read-models/chain-statistics.rm.yaml';
const catalog = emitDoc({ scalars: [['kind', 'read-model'], ['name', 'Chain Statistics']],
  blocks: { payload: { id: 'chain-stats', name: 'Chain Statistics', fields: [] } } });
const valueFile = 'value-objects/order-id.vo.yaml';
const value = emitDoc({ scalars: [['kind', 'value-object'], ['name', 'OrderId']],
  blocks: { payload: { id: 'order-id', name: 'OrderId', fields: [] } } });
const entries = () => [
  { file: 'workshop.yaml', content: workshop },
  { file: policyFile, content: policy },
  { file: catalogFile, content: catalog },
  { file: valueFile, content: value },
];
const withTree = fn => {
  const parent = mkdtempSync(join(tmpdir(), 'legacy-surface-')), tree = join(parent, 'tree');
  mkdirSync(tree);
  try {
    for (const { file, content } of entries()) {
      mkdirSync(dirname(join(tree, file)), { recursive: true });
      writeFileSync(join(tree, file), content);
    }
    fn(tree, parent);
  } finally { rmSync(parent, { recursive: true, force: true }); }
};
const withoutSurface = canonical => {
  const result = structuredClone(canonical);
  delete result.legacyAuthoring;
  return result;
};

test('legacy surface preserves catalogs, sparse origins, old filenames and exact note text', () => withTree((tree, parent) => {
  assert.deepEqual(validateTree(tree).hard, []);
  const text = compileTree(tree), canonical = JSON.parse(text);
  assert.equal(canonical.legacyAuthoring.schemaVersion, LEGACY_SURFACE_VERSION);
  assert.equal(compileTree(tree), text);
  assert.deepEqual(withoutSurface(canonical), compileSnapshot(loadTreeSnapshot(tree)).canonical);
  assert.equal(compileTreeWithSources(tree).text, text);
  assert.equal(canonical.noteSurface['refining|proposed|0'].seq, 9);
  const restored = decomposeEntries(text);
  assert.deepEqual(restored, entries().sort((a, b) => a.file < b.file ? -1 : 1));
  assert.equal(Object.hasOwn(parseDoc(restored.find(e => e.file === catalogFile).content), 'id'), false);
  assert.equal(parseDoc(restored.find(e => e.file === policyFile).content).kind, 'note');
  const output = join(parent, 'restored');
  decomposeCanonical(text, output);
  assert.equal(compileTree(output), text);
  assert.deepEqual(roundtrip(tree), { ok: true, atoms: 4 });
}));

test('policy-typed inbox notes are not promoted even with causal information', () => withTree(tree => {
  const doc = parseDoc(policy);
  doc.payload.info = { triggers: [{ event: 'EquipmentFailed' }], invokes: [{ command: 'Reschedule' }] };
  writeFileSync(join(tree, policyFile), emitDoc({ scalars: [['kind', 'note'], ['type', 'policy'], ['name', doc.name]],
    nested: { origin: doc.origin }, blocks: { payload: doc.payload } }));
  const projected = compileSnapshot(loadTreeSnapshot(tree));
  const restored = decomposeEntries(projected.text).map(e => ({ ...e, doc: parseDoc(e.content) }));
  const note = restored.find(e => e.doc.name === 'FaultReschedule');
  assert.equal(note.doc.kind, 'note');
  assert.ok(note.file.startsWith('inbox/10-policies/'));
  assert.equal(Object.hasOwn(note.doc, 'triggers'), false);
  assert.deepEqual(note.doc.payload, doc.payload);
}));

test('formal policy without its causal contract still fails', () => withTree(tree => {
  const canonical = withoutSurface(JSON.parse(compileTree(tree)));
  delete canonical.noteResidence;
  assert.throws(() => decomposeEntries(JSON.stringify(canonical)), /triggers\/invokes required/);
}));

test('serialized canonical restores without reading the original tree', () => withTree((tree, parent) => {
  const text = compileTree(tree);
  renameSync(tree, join(parent, 'unavailable-source'));
  const target = join(parent, 'from-canonical-only');
  decomposeCanonical(text, target);
  for (const { file, content } of entries()) assert.equal(readFileSync(join(target, file), 'utf8'), content);
  assert.equal(compileTree(target), text);
}));

test('fixed-point input retains the exact historical worker projection', () => withTree((_, parent) => {
  const example = fileURLToPath(new URL('../example/tree', import.meta.url));
  const projected = compileSnapshot(loadTreeSnapshot(example));
  const tree = join(parent, 'normalized');
  decomposeCanonical(projected.text, tree);
  const text = compileTree(tree);
  assert.equal(Object.hasOwn(JSON.parse(text), 'legacyAuthoring'), false);
  assert.equal(text, projected.text);
  assert.equal(text, compileSnapshot(loadTreeSnapshot(tree)).text);
}));

for (const [name, mutate, pattern] of [
  ['semantic payload drift', c => { c.readModels[0].name = 'Changed'; }, /disagrees with semantic/],
  ['raw payload drift', c => { c.legacyAuthoring.files.find(e => e.file === catalogFile).content = catalog.replace('chain-stats', 'different-id'); }, /disagrees with semantic/],
  ['unsupported envelope', c => { c.legacyAuthoring.schemaVersion = 'future'; }, /unsupported surface/],
  ['mixed author surface', c => { c.authoring = {}; }, /mixed author/],
  ['missing source file', c => { c.legacyAuthoring.files = c.legacyAuthoring.files.filter(e => e.file !== catalogFile); }, /disagrees with semantic/],
  ['absolute path', c => { c.legacyAuthoring.files[0].file = '/outside.yaml'; }, /unsafe file/],
  ['parent traversal', c => { c.legacyAuthoring.files[0].file = '../outside.yaml'; }, /unsafe file/],
  ['deep path', c => { c.legacyAuthoring.files[0].file = 'x/'.repeat(10000) + 'payload.yaml'; }, /unsupported residence depth/],
  ['oversized path', c => { c.legacyAuthoring.files[0].file = 'x'.repeat(8 * 1024 * 1024) + '.yaml'; }, /surface exceeds/],
  ['duplicate file', c => { c.legacyAuthoring.files.push(c.legacyAuthoring.files[0]); }, /duplicate file/],
  ['case-fold alias', c => { const e = structuredClone(c.legacyAuthoring.files[0]); e.file = e.file.toUpperCase(); c.legacyAuthoring.files.push(e); }, /path alias/],
  ['unknown header', c => { c.legacyAuthoring.files.find(e => e.file === catalogFile).content = catalog.replace('payload:', 'hiddenBinding: ignored\npayload:'); }, /unsupported header/],
  ['duplicate key', c => { c.legacyAuthoring.files.find(e => e.file === catalogFile).content = catalog.replace('payload:', 'name: Shadow\npayload:'); }, /duplicate root key/],
  ['unconsumed directory', c => { c.legacyAuthoring.files.push({ file: 'ignored/hidden.yaml', content: catalog }); }, /unknown knowledge file/],
  ['unconsumed stage', c => { const e = c.legacyAuthoring.files.find(e => e.file === 'workshop.yaml'); e.content = workshop.replace('refining', 'eventStorming'); }, /unconsumed workshop stage/],
]) test('legacy surface refuses ' + name + ' before writing any output', () => withTree((tree, parent) => {
  const canonical = JSON.parse(compileTree(tree));
  mutate(canonical);
  const target = join(parent, 'output'); mkdirSync(target);
  assert.throws(() => decomposeCanonical(JSON.stringify(canonical), target), pattern);
  assert.deepEqual(readdirSync(target), []);
}));

test('large opaque payloads do not exceed the serializer argument limit', () => withTree(tree => {
  const payload = { type: 'policy', name: 'FaultReschedule', values: Array(250000).fill(1) };
  const text = policy.slice(0, policy.indexOf('payload:')) + 'payload:\n  ' + JSON.stringify(payload) + '\n';
  writeFileSync(join(tree, policyFile), text);
  const canonical = compileTree(tree);
  assert.equal(decomposeEntries(canonical).find(e => e.file === policyFile).content, text);
  assert.equal(JSON.parse(canonical).sessions[0].scopes[0].notes[0].values.length, 250000);
}));

test('legacy restoration rejects symlink targets before writing', () => withTree((tree, parent) => {
  const target = join(parent, 'output'), outside = join(parent, 'outside');
  mkdirSync(target); mkdirSync(outside);
  symlinkSync(outside, join(target, 'read-models'));
  assert.throws(() => decomposeCanonical(compileTree(tree), target), /symlink apply path/);
  assert.deepEqual(readdirSync(outside), []);
  assert.deepEqual(readdirSync(target), ['read-models']);
}));

const put = (tree, file, content) => {
  mkdirSync(dirname(join(tree, file)), { recursive: true });
  writeFileSync(join(tree, file), content);
};
const carriedInput = tree => {
  const snapshot = loadTreeSnapshot(tree);
  return JSON.stringify({ ...compileSnapshot(snapshot).canonical,
    legacyAuthoring: { schemaVersion: LEGACY_SURFACE_VERSION,
      files: snapshot.atoms.map(({ file }) => ({ file, content: readFileSync(join(tree, file), 'utf8') })) } });
};
const stockFile = 'aggregates/stock/aggregate.yaml';
const stockPayload = { name: 'Stock', entity: 'StockEntity', identifier: { name: 'id', dataType: 'String' }, stateFields: [] };
const stock = (tree, order) => put(tree, stockFile, emitDoc({
  scalars: [['kind', 'aggregate'], ['name', 'Stock']],
  blocks: { ...(order === undefined ? {} : { order }), payload: stockPayload },
}));
const reservation = (tree, bindings) => {
  stock(tree, { commands: ['Reserve'], events: ['Reserved'] });
  put(tree, 'aggregates/stock/slices/reserve.slice.yaml', emitDoc({
    scalars: [['kind', 'slice'], ['aggregate', 'Stock'], ['command', 'Reserve']],
    blocks: {
      payload: { name: 'Reserve', parameters: [{ name: 'quantity', dataType: 'Int' }], produces: ['Reserved'], emissionBindings: bindings },
      events: { Reserved: { name: 'Reserved', payloads: [{ name: 'quantity', dataType: 'Int' }] } },
      decision: { emissions: [{ event: 'Reserved', bindings: { quantity: 'param.quantity', detail: 'literal:reserved' } }] },
    },
  }));
};
const formalPolicy = (tree, { type = 'policy', payloadType = 'policy', mirrors = true, bindings } = {}) => {
  for (const [seq, type, name] of [[0, 'event', 'Recorded'], [1, 'command', 'Record']]) {
    put(tree, `inbox/refining/${type}-rf-${name.toLowerCase()}-${seq}.yaml`, emitDoc({
      scalars: [['kind', 'note'], ['type', type], ['name', name]],
      nested: { origin: { stage: 'refining', board: 'facts', seq } },
      blocks: { payload: { type, name, description: 'Recorded workshop fact', info: { timeline: 'recording' }, links: [] } },
    }));
  }
  const triggers = [{ event: 'Recorded', aggregate: 'Stock' }], invokes = [{ command: 'Record', aggregate: 'Stock' }];
  const payload = { type: payloadType, name: 'OnRecorded', links: ['event:Recorded', 'command:Record'],
    ...(mirrors ? { info: { triggers, invokes, ...(bindings ? { bindings: { first: 'a', second: 'b' } } : {}) } } : {}) };
  const file = 'policies/policy-rf-on-recorded-0.policy.yaml';
  put(tree, file, emitDoc({ scalars: [['kind', 'policy'], ['type', type], ['name', 'OnRecorded']],
    nested: { origin: { stage: 'refining', board: 'rules', seq: 0 }, ...(bindings ? { bindings } : {}) },
    objLists: { triggers, invokes }, blocks: { payload } }));
  return file;
};

test('raw carry rejects emission bindings overwritten by decision emissions', () => withTree((tree, parent) => {
  reservation(tree, { Reserved: { quantity: 'literal:0', detail: 'literal:reserved' } });
  assert.deepEqual(validateTree(tree).hard, []);
  const target = join(parent, 'rejected'); mkdirSync(target);
  assert.throws(() => decomposeCanonical(carriedInput(tree), target), /emissionBindings/);
  assert.deepEqual(readdirSync(target), []);
  assert.throws(() => compileTree(tree), /emissionBindings/);
}));

test('equivalent emission bindings ignore object insertion order without changing source bytes', () => withTree(tree => {
  reservation(tree, { Reserved: { detail: 'literal:reserved', quantity: 'param.quantity' } });
  assert.equal(roundtrip(tree).ok, true);
}));

for (const [key, value] of [['decisions', { hidden: true }], ['folds', 'Reserved'], ['decisions', ['Reserve', 'Reserve']]]) {
  test(`carry refuses malformed order.${key} ${JSON.stringify(value)}`, () => withTree(tree => {
    stock(tree, { commands: [], events: [], [key]: value });
    assert.throws(() => decomposeEntries(carriedInput(tree)), /order\./);
    assert.throws(() => compileTree(tree), /order\./);
  }));
}

for (const options of [{ type: 'event' }, { payloadType: 'event' }]) {
  test('formal policy type agrees with its payload ' + JSON.stringify(options), () => withTree(tree => {
    formalPolicy(tree, options);
    assert.throws(() => decomposeEntries(carriedInput(tree)), /type/);
  }));
}

for (const stages of [['invented'], ['refining', 'refining'], 'refining']) {
  test('carried root refuses invalid session order ' + JSON.stringify(stages), () => withTree((_, parent) => {
    const tree = join(parent, 'root-only');
    put(tree, 'workshop.yaml', 'schemaVersion: truthsrc/v1\nname: root-only\nsessionOrder: ' + JSON.stringify(stages) + '\n');
    assert.throws(() => decomposeEntries(carriedInput(tree)), /session order/);
  }));
}

for (const nameKey of ['name', 'workshop']) for (const order of ['', 'sessionOrder: []\n']) {
  test(`legacy ${nameKey} accepts ${order ? 'empty' : 'absent'} session order with the worker default`, () => withTree(tree => {
    const root = `schemaVersion: truthsrc/v1\n${nameKey}: legacy-demo\n${order}`;
    writeFileSync(join(tree, 'workshop.yaml'), root);
    assert.deepEqual(validateTree(tree).hard, []);
    const canonical = compileTree(tree);
    assert.equal(decomposeEntries(canonical).find(e => e.file === 'workshop.yaml').content, root);
    assert.equal(roundtrip(tree).ok, true);
  }));
}

test('carry rejects ambiguous workshop identity aliases', () => withTree(tree => {
  writeFileSync(join(tree, 'workshop.yaml'), workshop.replace('name: legacy-demo', 'name: legacy-demo\nworkshop: another-workshop'));
  assert.throws(() => decomposeEntries(carriedInput(tree)), /ambiguous workshop identity/);
  assert.throws(() => compileTree(tree), /ambiguous workshop identity/);
}));

test('unavailable policy inverse does not block semantic-only legacy compilation', () => withTree(tree => {
  formalPolicy(tree, { mirrors: false });
  assert.deepEqual(validateTree(tree).hard, []);
  const projected = compileSnapshot(loadTreeSnapshot(tree));
  assert.equal(compileTree(tree), projected.text);
  assert.equal(compileTreeWithSources(tree).text, projected.text);
  assert.throws(() => decomposeEntries(projected.text), /triggers\/invokes required/);
  assert.throws(() => roundtrip(tree), /triggers\/invokes required/);
}));

test('an orderless sliceless aggregate is preserved while unconsumed definitions are still rejected', () => withTree(tree => {
  stock(tree);
  assert.deepEqual(validateTree(tree).hard, []);
  assert.equal(roundtrip(tree).ok, true);
  assert.equal(Object.hasOwn(parseDoc(decomposeEntries(compileTree(tree)).find(e => e.file === stockFile).content), 'order'), false);
  put(tree, 'aggregates/stock/slices/query.slice.yaml', emitDoc({
    scalars: [['kind', 'slice'], ['aggregate', 'Stock'], ['command', 'Query']],
    blocks: { payload: { name: 'Query', parameters: [], produces: [] } },
  }));
  assert.throws(() => decomposeEntries(carriedInput(tree)), /missing or unconsumed definitions/);
}));

test('policy mirror agreement ignores object-key order but preserves array order', () => withTree(tree => {
  const file = formalPolicy(tree, { bindings: { second: 'b', first: 'a' } });
  assert.deepEqual(validateTree(tree).hard, []);
  assert.equal(roundtrip(tree).ok, true);
  const input = JSON.parse(carriedInput(tree));
  const entry = input.legacyAuthoring.files.find(e => e.file === file);
  const original = entry.content;
  entry.content = entry.content.replace('\n  first: a\n', '\n  first: changed\n');
  assert.notEqual(entry.content, original);
  assert.throws(() => decomposeEntries(JSON.stringify(input)), /conflicting policy bindings|conflicting structural surface/);
}));

test('UTF-8 BOM on an accepted blank line survives file capture and restoration', () => withTree(tree => {
  writeFileSync(join(tree, 'workshop.yaml'), '﻿\n' + workshop);
  writeFileSync(join(tree, policyFile), '﻿\n' + policy);
  const canonical = compileTree(tree);
  const restored = decomposeEntries(canonical);
  assert.equal(restored.find(e => e.file === 'workshop.yaml').content, '﻿\n' + workshop);
  assert.equal(restored.find(e => e.file === policyFile).content, '﻿\n' + policy);
  assert.equal(roundtrip(tree).ok, true);
}));

test('use-case document label remains independent of payload.name', () => withTree(tree => {
  const content = emitDoc({ scalars: [['kind', 'use-cases'], ['name', 'Workshop label']],
    blocks: { payload: { name: 'Business workflow', useCases: [] } } });
  put(tree, 'use-cases.yaml', content);
  assert.equal(roundtrip(tree).ok, true);
  assert.equal(decomposeEntries(compileTree(tree)).find(e => e.file === 'use-cases.yaml').content, content);
}));

test('uncaptured YAML prevents an incomplete preservation envelope without changing semantic compilation', () => withTree(tree => {
  put(tree, 'sagas/unrecognized.yaml', 'kind: saga\nid: unrecognized\n');
  const expected = compileSnapshot(loadTreeSnapshot(tree)).text;
  assert.equal(compileTree(tree), expected);
  assert.equal(Object.hasOwn(JSON.parse(compileTree(tree)), 'legacyAuthoring'), false);
  assert.equal(roundtrip(tree).ok, false);
}));

test('oversized optional carry leaves legacy semantic compilation available and restoration strict', () => withTree(tree => {
  writeFileSync(join(tree, policyFile), '#' + 'x'.repeat(8 * 1024 * 1024) + '\n' + policy);
  const expected = compileSnapshot(loadTreeSnapshot(tree)).text;
  assert.equal(compileTree(tree), expected);
  assert.equal(compileTreeWithSources(tree).text, expected);
  assert.equal(roundtrip(tree).ok, false);
  assert.throws(() => decomposeEntries(carriedInput(tree)), /surface exceeds 8 MiB/);
}));
