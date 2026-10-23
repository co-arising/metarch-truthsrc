import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ATOM_KINDS, STAGE_ORDER, slug, parseDoc, emitDoc, parseAtom, emitAtom } from '../lib/shared.mjs';
import { validateTree } from '../lib/validate.mjs';
import { compileTree } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'truthsrc-saga-tree-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // Match the existing workshop serializer so the full tree gate is meaningful.
  writeFileSync(join(dir, 'workshop.yaml'), [
    '# ═══ truthsrc workshop root — hand-editable; contract: SCHEMA.md ═══', '',
    'schemaVersion: truthsrc/v1', 'name: saga-tree-test', 'sessionOrder:',
    ...STAGE_ORDER.map((stage) => `  - ${stage}`), '',
  ].join('\n'));
  return dir;
}
function put(dir, file, text) {
  mkdirSync(join(dir, file, '..'), { recursive: true });
  writeFileSync(join(dir, file), text);
}
const saga = (overrides = {}) => ({
  kind: 'saga', id: 'money-transfer', name: 'Money Transfer', version: 'v1',
  payload: {
    purpose: 'Transfer reserved funds between accounts.',
    provenance: { status: 'designed', source: 'temporary test fixture, not historical workshop capture' },
    participants: [{ id: 'payer', aggregate: 'Account' }, { id: 'payee', aggregate: 'Account' }],
    phases: { prepare: ['reserve'], commit: ['settle'], compensate: ['release'] },
    nested: { amounts: ['12345678901234567890'], labels: ['quoted: text', '多方交易'], empty: {} },
  },
  ...overrides,
});
function emitSaga(doc) {
  const { payload, ...headers } = doc;
  const scalars = Object.entries(headers);
  if (payload !== undefined && payload !== null && typeof payload !== 'object') scalars.push(['payload', payload]);
  return emitDoc({
    scalars,
    ...(payload === null ? { nested: { payload: {} } } : {}),
    blocks: payload !== null && typeof payload === 'object' ? { payload } : {},
  });
}
function putSaga(dir, doc = saga(), file = `${slug(doc.id)}.saga.yaml`) {
  const text = emitSaga(doc);
  put(dir, `sagas/${file}`, text);
  return text;
}
function cycle(t, dir) {
  assert.deepEqual(validateTree(dir).hard, []);
  const canonical = compileTree(dir);
  const regen = scratch(t);
  const count = decomposeCanonical(canonical, regen);
  assert.deepEqual(validateTree(regen).hard, []);
  assert.equal(compileTree(regen), canonical, 'compile → decompose → compile byte identity');
  assert.deepEqual(roundtrip(dir), { ok: true, atoms: count });
  return { canonical: JSON.parse(canonical), regen, count };
}

// These fixtures exercise the tree transport, NOT SagaIR semantics or runtime.
test('Saga product uses parseDoc/emitDoc and preserves whole identity + payload through the tree cycle', (t) => {
  const dir = scratch(t);
  const doc = saga({ description: 'Two accounts, one transaction.', seq: 17, codecVersion: 'args/v1' });
  // Payload is last, but all scalar header order is authored and preserved.
  const text = putSaga(dir, doc);
  const parsed = parseDoc(text);
  assert.deepEqual(parsed, doc);
  assert.equal(emitSaga(parsed), text);
  assert.ok(ATOM_KINDS.includes('saga'));
  const { canonical, regen, count } = cycle(t, dir);
  const { kind, ...product } = doc;
  assert.deepEqual(canonical.sagas, [product], 'canonical carries headers, not a payload-only projection');
  assert.deepEqual(Object.keys(canonical.sagas[0]), Object.keys(parsed).filter((key) => key !== 'kind'));
  assert.equal(readFileSync(join(regen, 'sagas/money-transfer.saga.yaml'), 'utf8'), text);
  assert.equal(count, 2, 'only root and one genuine Saga product');
});

test('Saga filename derives from stable id, not display name; missing identity is never copied from payload', (t) => {
  const dir = scratch(t);
  putSaga(dir, saga({ id: 'MoneyTransfer', name: 'Different display name' }));
  const { canonical, regen } = cycle(t, dir);
  assert.equal(canonical.sagas[0].id, 'MoneyTransfer');
  assert.ok(existsSync(join(regen, 'sagas/money-transfer.saga.yaml')));
  assert.ok(!existsSync(join(regen, 'sagas/different-display-name.saga.yaml')));
  const bad = scratch(t);
  const { id, ...doc } = saga({ payload: { id: 'money-transfer', name: 'Money Transfer' } });
  putSaga(bad, doc, 'money-transfer.saga.yaml');
  assert.ok(validateTree(bad).hard.some((h) => h.startsWith('[SA1]') && h.includes('id must')));
});

test('Saga ordering is filename-based without seq and emits no invented seq or payload identity', (t) => {
  const dir = scratch(t);
  for (const id of ['z-transfer', 'a-transfer']) putSaga(dir, saga({ id, name: id }));
  const { canonical, regen } = cycle(t, dir);
  assert.deepEqual(canonical.sagas.map((s) => s.id), ['a-transfer', 'z-transfer']);
  for (const product of canonical.sagas) {
    assert.ok(!Object.hasOwn(product, 'seq'));
    assert.ok(!Object.hasOwn(product.payload, 'id'));
    assert.ok(!Object.hasOwn(product.payload, 'version'));
    assert.ok(!readFileSync(join(regen, `sagas/${product.id}.saga.yaml`), 'utf8').includes('\nseq:'));
  }
});

test('Uniform Saga seq pins product order and roundtrips sparse authored numbers without renumbering', (t) => {
  const dir = scratch(t);
  putSaga(dir, saga({ id: 'a-transfer', seq: 90 }));
  putSaga(dir, saga({ id: 'z-transfer', seq: 4 }));
  const { canonical } = cycle(t, dir);
  assert.deepEqual(canonical.sagas.map((s) => [s.id, s.seq]), [['z-transfer', 4], ['a-transfer', 90]]);
  assert.ok(!validateTree(dir).notices.some((n) => n.startsWith('[SEQ1]')));
});

test('Mixed Saga seq preserves optional key presence, falls back to filename order and reports SEQ1', (t) => {
  const dir = scratch(t);
  putSaga(dir, saga({ id: 'z-transfer', seq: 0 }));
  putSaga(dir, saga({ id: 'a-transfer' }));
  const { canonical } = cycle(t, dir);
  assert.deepEqual(canonical.sagas.map((s) => s.id), ['a-transfer', 'z-transfer']);
  assert.ok(!Object.hasOwn(canonical.sagas[0], 'seq'));
  assert.equal(canonical.sagas[1].seq, 0);
  assert.ok(validateTree(dir).notices.some((n) => n.startsWith('[SEQ1]') && n.includes('sagas: 1/2')));
});

test('Legacy trees emit no sagas key, retain canonical bytes/key order, and decompose creates no Saga directory', (t) => {
  const dir = scratch(t);
  // Independently spell the legacy canonical, not an expectation derived from compile.
  const expected = JSON.stringify({
    schemaVersion: 'truthsrc/v1', workshop: 'saga-tree-test',
    sessions: STAGE_ORDER.map((session) => ({ session, scopes: [] })),
    aggregates: [], valueObjects: [], readModels: [], stories: [], domainServices: [],
  }, null, 2) + '\n';
  assert.equal(compileTree(dir), expected);
  const { regen, count } = cycle(t, dir);
  assert.equal(count, 1);
  assert.ok(!existsSync(join(regen, 'sagas')));
  mkdirSync(join(dir, 'sagas'));
  assert.equal(compileTree(dir), expected, 'empty product directory also emits no key');
  const emptyRegen = scratch(t);
  decomposeCanonical(JSON.stringify({ ...JSON.parse(expected), sagas: [] }), emptyRegen);
  assert.ok(!existsSync(join(emptyRegen, 'sagas')), 'empty array creates no invented product');
  // The live example intentionally gained one Saga-design knowledge note. Keep
  // this compatibility oracle on a private copy of its pre-Saga author surface,
  // rather than replacing the independently pinned legacy digest.
  const example = scratch(t);
  cpSync(join(import.meta.dirname, '..', 'example', 'tree'), example, { recursive: true });
  const addedNote = join(example, 'inbox', 'eventStorming', 'question-es-how-is-a-distributed-transfer-reconciled--7.yaml');
  assert.ok(existsSync(addedNote));
  rmSync(addedNote);
  assert.equal(createHash('sha256').update(compileTree(example)).digest('hex'),
    'fb8cc70e8702ea8c52498476e2c69bd39229076b72f26e8dc423cb7719d246e7',
    'pre-Saga legacy example canonical SHA256');
});

test('Legacy single-payload emitAtom constructor and parseAtom alias stay unchanged', () => {
  const input = {
    kind: 'note', type: 'question', name: 'Where next?',
    origin: { stage: 'eventStorming', board: 'board1', seq: 0 },
    payload: { type: 'question', name: 'Where next?', links: [] },
  };
  assert.equal(parseAtom, parseDoc);
  assert.equal(emitAtom(input), emitDoc({
    scalars: [['kind', input.kind], ['type', input.type], ['name', input.name]],
    nested: { origin: input.origin }, blocks: { payload: input.payload },
  }));
  assert.deepEqual(parseAtom(emitAtom(input)), input);
});

test('Saga fidelity gate explicitly does not certify unknown execution keys or create workshop history', (t) => {
  const dir = scratch(t);
  const doc = saga({ futureCapability: 'unrecognized', payload: { unknownExecutionKey: { pretendExactlyOnce: true } } });
  putSaga(dir, doc);
  const result = validateTree(dir);
  assert.deepEqual(result.hard, [], 'transport supports opaque JSON; this is NOT semantic validation');
  assert.ok(result.notices.some((n) => n.startsWith('[SA0]') && n.includes('not execution-validated') && n.includes('strict Saga')));
  const { canonical, regen } = cycle(t, dir);
  assert.deepEqual(canonical.sagas[0].payload, doc.payload);
  assert.equal(canonical.sagas[0].futureCapability, 'unrecognized');
  assert.ok(canonical.sessions.every((s) => s.scopes.length === 0), 'no invented sticky notes or origins');
  assert.deepEqual(Object.keys(canonical), [
    'schemaVersion', 'workshop', 'sessions', 'aggregates', 'valueObjects', 'readModels', 'stories', 'domainServices', 'sagas',
  ]);
  assert.deepEqual(readdirSync(regen).sort(), ['sagas', 'workshop.yaml']);
});

for (const [label, changes, rule, message] of [
  ['wrong kind', { kind: 'pipeline' }, 'V1', 'kind must be "saga"'],
  ['unknown kind', { kind: 'future-saga' }, 'V1', 'kind must be "saga"'],
  ['missing kind', { kind: undefined }, 'V1', 'kind must be "saga"'],
  ['missing id', { id: undefined }, 'SA1', 'id must'],
  ['numeric id', { id: 42 }, 'SA1', 'id must'],
  ['blank id', { id: '   ' }, 'SA1', 'id must'],
  ['missing name', { name: undefined }, 'SA1', 'name must'],
  ['numeric name', { name: 42 }, 'SA1', 'name must'],
  ['blank name', { name: '   ' }, 'SA1', 'name must'],
  ['missing version', { version: undefined }, 'SA1', 'version must'],
  ['blank version', { version: '' }, 'SA1', 'version must'],
  ['zero version', { version: 0 }, 'SA1', 'version must'],
  ['missing payload', { payload: undefined }, 'SA2', 'payload must'],
  ['null payload', { payload: null }, 'SA2', 'payload must'],
  ['array payload', { payload: [] }, 'SA2', 'payload must'],
  ['scalar payload', { payload: 'opaque' }, 'SA2', 'payload must'],
  ['negative seq', { seq: -1 }, 'V12', 'seq must'],
  ['fractional seq', { seq: 1.5 }, 'V12', 'seq must'],
  ['noninteger seq', { seq: 'next' }, 'V12', 'seq must'],
  ['null seq', { seq: null }, 'V12', 'seq must'],
  ['unsafe seq', { seq: Number.MAX_SAFE_INTEGER + 1 }, 'V12', 'seq must'],
]) {
  test(`Saga validator diagnoses ${label}`, (t) => {
    const dir = scratch(t);
    const doc = Object.fromEntries(Object.entries(saga(changes)).filter(([, value]) => value !== undefined));
    putSaga(dir, doc, 'money-transfer.saga.yaml');
    assert.ok(validateTree(dir).hard.some((h) => h.startsWith(`[${rule}]`) && h.includes(message)), label);
  });
}

for (const file of ['wrong-name.saga.yaml', 'money-transfer.yaml', 'money-transfer.pipeline.yaml']) {
  test(`Saga validator does not silently ignore misnamed file ${file}`, (t) => {
    const dir = scratch(t);
    putSaga(dir, saga(), file);
    assert.ok(validateTree(dir).hard.some((h) => h.startsWith('[SA1]') && h.includes(`sagas/${file}`) && h.includes('filename must')));
  });
}

test('Saga validator reports duplicate ids and duplicate product seq with both file paths', (t) => {
  const dir = scratch(t);
  putSaga(dir, saga({ seq: 6 }));
  putSaga(dir, saga({ seq: 6 }), 'copy.saga.yaml');
  const { hard } = validateTree(dir);
  for (const rule of ['SA1', 'V12']) {
    assert.ok(hard.some((h) => h.startsWith(`[${rule}]`) && h.includes('sagas/copy.saga.yaml') && h.includes('sagas/money-transfer.saga.yaml')));
  }
  const separate = scratch(t);
  putSaga(separate, saga({ id: 'a', seq: 0 }));
  putSaga(separate, saga({ id: 'b', seq: 0 }));
  assert.ok(validateTree(separate).hard.some((h) => h.startsWith('[V12]') && h.includes('collision')));
});

test('Saga validator diagnoses malformed document/JSON per file and continues to other products', (t) => {
  const dir = scratch(t);
  put(dir, 'sagas/broken.saga.yaml', 'kind: saga\nnot a header\n');
  put(dir, 'sagas/broken-json.saga.yaml', 'kind: saga\npayload:\n  { broken JSON }\n');
  putSaga(dir, saga());
  const { hard, notices } = validateTree(dir);
  for (const name of ['broken', 'broken-json'])
    assert.ok(hard.some((h) => h.startsWith('[V1]') && h.includes(`sagas/${name}.saga.yaml`) && h.includes('malformed Saga atom')));
  assert.ok(notices.some((n) => n.includes('sagas/money-transfer.saga.yaml')));
});

test('Saga payload identity, when repeated, must agree with the scalar headers', (t) => {
  const dir = scratch(t);
  putSaga(dir, saga({ payload: { id: 'other', name: 'Other', version: 'v2' } }));
  const { hard } = validateTree(dir);
  for (const key of ['id', 'name', 'version'])
    assert.ok(hard.some((h) => h.startsWith('[V3]') && h.includes(`payload.${key}`)));
  const clean = scratch(t);
  putSaga(clean, saga({ version: 1, payload: { id: 'money-transfer', name: 'Money Transfer', version: 1 } }));
  cycle(t, clean);
});

test('Saga only permits a payload rich block and requires scalar headers before it', (t) => {
  const dir = scratch(t);
  put(dir, 'sagas/money-transfer.saga.yaml', emitDoc({
    scalars: [['kind', 'saga'], ['id', 'money-transfer'], ['name', 'Money Transfer'], ['version', 'v1']],
    blocks: { payload: {}, execution: { unknown: true } },
  }));
  assert.ok(validateTree(dir).hard.some((h) => h.startsWith('[SA3]') && h.includes('"execution" must be a scalar')));
  const late = scratch(t);
  put(late, 'sagas/money-transfer.saga.yaml', emitSaga(saga()) + 'description: late\n');
  assert.ok(validateTree(late).hard.some((h) => h.startsWith('[SA3]') && h.includes('follows a block')));
  const nullHeader = scratch(t);
  put(nullHeader, 'sagas/money-transfer.saga.yaml', emitDoc({
    scalars: [['kind', 'saga'], ['id', 'money-transfer'], ['name', 'Money Transfer'], ['version', 'v1']],
    nested: { description: {} }, blocks: { payload: {} },
  }));
  assert.ok(validateTree(nullHeader).hard.some((h) => h.startsWith('[SA3]') && h.includes('finite number header')));
});

test('Saga decompose refuses missing header identity and unplaceable rich content instead of inventing or dropping it', (t) => {
  for (const change of [{ id: undefined }, { version: undefined }, { payload: [] }, { execution: { unsupported: true } }]) {
    const dir = scratch(t);
    const { kind, ...product } = saga(change);
    assert.throws(() => decomposeCanonical(JSON.stringify({ workshop: 'test', sagas: [product] }), dir), /saga/i);
    assert.ok(!existsSync(join(dir, 'sagas')));
  }
});
