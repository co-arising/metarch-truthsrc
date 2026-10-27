import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSnapshot, compileSnapshot, SNAPSHOT_VERSION } from '../lib/compile-snapshot.mjs';
import { compileTree, loadTreeSnapshot } from '../lib/compile.mjs';
import { emitDoc, slug, STAGE_ORDER } from '../lib/shared.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const hash = text => createHash('sha256').update(text).digest('hex');
const metadata = () => ({ fallbackWorkshop: 'Explicit memory fixture', inboxDirs: [], aggregateDirs: [] });
const empty = () => createSnapshot([], metadata());
const withTree = (atoms, fn) => {
  const tree = mkdtempSync(join(tmpdir(), 'truthsrc-snapshot-'));
  try { writeTree(atoms, tree); return fn(tree); }
  finally { rmSync(tree, { recursive: true, force: true }); }
};
const frozen = value => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(frozen));

// X01-A snapshot-only sub-slice. These byte digests were captured with the old
// compiler before relocation. Product/capability admission and runtime are not tested here.
for (const [name, atoms, expected] of [
  ['integer SKU inventory', inventoryAtoms, '9765005220bbd3e705c0bf12e4315baa62c0450903e0674f9890e9698199fb09'],
  ['projection edges', edgeAtoms, '514970c7b8c5bfe1d24a3accbac6220315162a1522a9ee9f23b2653f53358827'],
]) test(`${name}: adapter and memory retain independently captured legacy bytes`, () => withTree(atoms(), tree => {
  const snapshot = loadTreeSnapshot(tree);
  const before = JSON.stringify(snapshot);
  const result = compileSnapshot(snapshot);
  assert.equal(hash(result.text), expected);
  assert.equal(compileTree(tree), result.text);
  assert.equal(compileSnapshot(JSON.parse(before)).text, result.text);
  assert.equal(compileSnapshot(snapshot).text, result.text);
  assert.equal(JSON.stringify(snapshot), before);
  assert.ok(frozen(snapshot) && frozen(result));
  assert.deepEqual(result.canonical, JSON.parse(result.text));
  assert.deepEqual(result.sources, snapshot.atoms.map(({ file }, i) => ({ file, pointer: `/atoms/${i}/doc` })));
}));

test('public full-schema example retains pre-relocation oracle and roundtrip bytes', () => {
  const snapshot = loadTreeSnapshot(join(ROOT, 'example/tree'));
  const result = compileSnapshot(snapshot);
  assert.equal(snapshot.atoms.length, 27);
  assert.equal(hash(result.text), '5f87f2f2cb0a136b49526ffb52f37ed939c16f3785f48cb97495be3434f56e15');
  const tree = mkdtempSync(join(tmpdir(), 'truthsrc-snapshot-example-'));
  try { decomposeCanonical(result.text, tree); assert.equal(compileTree(tree), result.text); }
  finally { rmSync(tree, { recursive: true, force: true }); }
});

test('memory-only empty input has independently specified canonical bytes', () => {
  const expected = { schemaVersion: 'truthsrc/v1', workshop: 'Explicit memory fixture', sessions: STAGE_ORDER.map(session => ({ session, scopes: [] })), aggregates: [], valueObjects: [], readModels: [], stories: [], domainServices: [] };
  assert.equal(compileSnapshot(empty()).text, JSON.stringify(expected, null, 2) + '\n');
});

test('snapshot detaches caller objects without freezing or mutating the caller', () => {
  const atoms = [{ file: 'workshop.yaml', doc: { name: 'Original' } }];
  const meta = metadata();
  const snapshot = createSnapshot(atoms, meta);
  assert.ok(!Object.isFrozen(atoms) && !Object.isFrozen(meta));
  atoms[0].doc.name = 'Later';
  meta.fallbackWorkshop = 'Later';
  assert.equal(compileSnapshot(snapshot).canonical.workshop, 'Original');
  assert.throws(() => { snapshot.atoms[0].doc.name = 'Mutation'; }, TypeError);
  assert.throws(() => snapshot.atoms.push(atoms[0]), TypeError);
  const result = compileSnapshot(snapshot);
  assert.throws(() => { result.canonical.workshop = 'Mutation'; }, TypeError);
  assert.throws(() => result.sources.push({}), TypeError);
});

test('post-capture file edits and removal do not change the pure result', () => withTree(inventoryAtoms(), tree => {
  const snapshot = loadTreeSnapshot(tree);
  const before = compileSnapshot(snapshot).text;
  writeFileSync(join(tree, 'workshop.yaml'), 'name: changed-after-capture\n');
  assert.notEqual(compileTree(tree), before);
  const moved = `${tree}-moved`;
  renameSync(tree, moved);
  try { assert.equal(compileSnapshot(snapshot).text, before); }
  finally { renameSync(moved, tree); }
}));

test('workshop name/workshop spelling and explicit fallback remain distinct', () => {
  assert.equal(compileSnapshot(createSnapshot([{ file: 'workshop.yaml', doc: { name: 'Name', workshop: 'Other' } }], metadata())).canonical.workshopKey, undefined);
  const c = compileSnapshot(createSnapshot([{ file: 'workshop.yaml', doc: { workshop: 'Other' } }], metadata())).canonical;
  assert.equal(c.workshop, 'Other');
  assert.equal(c.workshopKey, 'workshop');
  const tree = mkdtempSync(join(tmpdir(), 'truthsrc-snapshot-fallback-'));
  try { assert.equal(JSON.parse(compileTree(tree)).workshop, tree.split('/').at(-1)); }
  finally { rmSync(tree, { recursive: true, force: true }); }
});

test('payload insertion order and null-prototype data survive capture', () => {
  const payload = Object.assign(Object.create(null), { z: 1, a: 2, constructor: 'own-data' });
  const snapshot = createSnapshot([{ file: 'value-objects/a.vo.yaml', doc: { payload } }], metadata());
  assert.equal(Object.getPrototypeOf(snapshot.atoms[0].doc.payload), null);
  assert.deepEqual(Object.keys(compileSnapshot(snapshot).canonical.valueObjects[0]), ['z', 'a', 'constructor']);
});

test('mixed seq, authored order, event residence and empty query events stay verbatim', () => withTree(edgeAtoms(), tree => {
  const c = JSON.parse(compileTree(tree));
  assert.deepEqual(c.aggregates.map(a => a.name), ['A', 'Z']);
  assert.deepEqual(c.valueObjects.map(v => v.name), ['AValue', 'ZValue']);
  assert.equal(c.aggregates[0].seq, 10);
  assert.equal(Object.hasOwn(c.aggregates[1], 'seq'), false);
  const a = c.aggregates[0];
  assert.deepEqual(a.commands.map(c => c.name), ['First', 'Second', 'Query']);
  assert.equal(a.events[0].origin, 'last');
  assert.deepEqual(a.eventResidence, { Changed: 'Second' });
  assert.deepEqual(a.commands[2].events, {});
  assert.deepEqual(a.commands[0].emissionBindings, { Changed: { slot: 'command.x' } });
  assert.deepEqual(a.commands[0].fold, { patch: [{ slot: 'state.y', expr: 'event.x' }] });
  assert.deepEqual(a.orderDecisions, ['Second', 'First']);
  assert.deepEqual(a.orderFolds, ['Changed']);
  assert.deepEqual(a.bmExtra, {});
  assert.deepEqual(a.extraFolds, []);
  assert.equal(a.context, 'edge-context');
}));

test('both inbox layouts and sparse note surface carry remain fixed points', () => withTree(edgeAtoms(), tree => {
  const c = JSON.parse(compileTree(tree));
  assert.deepEqual(c.sessions.map(s => s.session), ['refining', 'eventStorming']);
  assert.deepEqual(c.sessions[0].scopes[0].notes.map(n => n.name), ['A', 'Z']);
  assert.equal(c.inboxLayout['refining|edge|0'], '06-aggregate-detail');
  assert.equal(c.inboxLayout['refining|edge|1'], 'refining');
  assert.deepEqual(c.noteSurface['refining|edge|0'], { id: 'A-header', author: 'fixture-author', seq: 2 });
  assert.deepEqual(c.noteSurface['refining|edge|1'], { id: 'Z-header', author: 'fixture-author', seq: 9 });
}));

test('optional catalogs/pipeline/scenario/Saga whole headers retain exact presence', () => withTree(edgeAtoms(), tree => {
  const c = JSON.parse(compileTree(tree));
  assert.equal(c.domainServices[0].name, 'StockPort');
  assert.deepEqual(c.useCases, { useCases: [] });
  assert.equal(c.pipelines[0].id, 'edge');
  assert.equal(c.scenarios[0].script, 'opaque narrative');
  assert.deepEqual(c.sagas.map(s => s.id), ['a', 'z']);
  assert.equal(c.sagas[1].version, 'v2');
  assert.equal(c.sagas[1].seq, 1);
  assert.equal(Object.hasOwn(c.sagas[0], 'seq'), false);
  assert.equal(Object.hasOwn(c.sagas[0], 'kind'), false);
  const emptyCanonical = compileSnapshot(empty()).canonical;
  for (const key of ['useCases', 'pipelines', 'scenarios', 'sagas', 'inboxLayout', 'noteSurface', 'noteResidence']) assert.equal(Object.hasOwn(emptyCanonical, key), false);
}));

test('shared API retains exact slug vocabulary and reference filename shape', () => {
  assert.equal(slug('RequestLoan'), 'request-loan');
  assert.equal(slug('HTTPPort'), 'http-port');
  assert.equal(slug('中文 A!!'), '---a--');
});

for (const [name, change, pattern] of [
  ['absolute source path', a => { a[0].file = '/outside.yaml'; }, /\/atoms\/0\/file/],
  ['parent path', a => { a[0].file = 'a/../outside.yaml'; }, /\/atoms\/0\/file/],
  ['backslash path', a => { a[0].file = 'a\\outside.yaml'; }, /\/atoms\/0\/file/],
  ['empty path segment', a => { a[0].file = 'a//outside.yaml'; }, /\/atoms\/0\/file/],
  ['drive prefix', a => { a[0].file = 'C:outside.yaml'; }, /\/atoms\/0\/file/],
  ['duplicate source', a => { a.push(structuredClone(a[0])); }, /duplicate source/],
  ['missing doc', a => { delete a[0].doc; }, /expected parsed atom/],
  ['extra transport field', a => { a[0].effects = true; }, /unsupported atom/],
  ['function data', a => { a[0].doc.value = () => {}; }, /expected plain JSON data/],
  ['undefined data', a => { a[0].doc.value = undefined; }, /expected plain JSON data/],
  ['non-finite data', a => { a[0].doc.value = Infinity; }, /expected plain JSON data/],
  ['cyclic data', a => { a[0].doc.self = a[0].doc; }, /cyclic data/],
  ['Map data', a => { a[0].doc.value = new Map(); }, /expected plain JSON data/],
  ['Date data', a => { a[0].doc.value = new Date(0); }, /expected plain JSON data/],
  ['symbol property', a => { a[0].doc[Symbol('hidden')] = 1; }, /enumerable data/],
  ['nonenumerable property', a => { Object.defineProperty(a[0].doc, 'hidden', { value: 1 }); }, /enumerable data/],
  ['sparse array', a => { a[0].doc.value = new Array(1); }, /sparse/],
  ['Proxy data', a => { a[0].doc = new Proxy({}, { get() { throw new Error('trap executed'); } }); }, /expected plain JSON data/],
]) test(`transport refuses ${name} with stable source pointer`, () => {
  const atoms = [{ file: 'workshop.yaml', doc: { name: 'Fixture' } }];
  change(atoms);
  let first;
  assert.throws(() => createSnapshot(atoms, metadata()), e => { first = e.message; return pattern.test(first) && first.startsWith('snapshot '); });
  assert.throws(() => createSnapshot(atoms, metadata()), e => e.message === first);
});

test('accessors are refused without executing any getter', () => {
  let reads = 0;
  const doc = { name: 'Fixture' };
  Object.defineProperty(doc, 'payload', { enumerable: true, get() { reads++; throw new Error('getter executed'); } });
  assert.throws(() => createSnapshot([{ file: 'workshop.yaml', doc }], metadata()), /enumerable data/);
  assert.equal(reads, 0);
});

test('missing aggregate source and malformed metadata refuse at transport boundary', () => {
  assert.throws(() => createSnapshot([], { ...metadata(), aggregateDirs: ['missing'] }), /missing aggregates\/missing\/aggregate.yaml/);
  assert.throws(() => createSnapshot([], { ...metadata(), inboxDirs: ['a', 'a'] }), /duplicate directory/);
  assert.throws(() => createSnapshot([], { ...metadata(), cache: 'implicit' }), /unsupported metadata/);
  assert.throws(() => createSnapshot([], { ...metadata(), aggregateDirs: undefined }), /expected plain JSON data/);
});

test('snapshot source residence must agree with declared captured directories', () => {
  const aggregate = { file: 'aggregates/a/aggregate.yaml', doc: { payload: { name: 'A' } } };
  assert.throws(() => createSnapshot([aggregate], metadata()), /aggregate directory absent from metadata/);
  const note = { file: 'inbox/refining/question.yaml', doc: { kind: 'note', payload: {} } };
  assert.throws(() => createSnapshot([note], metadata()), /inbox directory absent from metadata/);
  assert.throws(() => createSnapshot([{ file: 'misc/ignored.yaml', doc: {} }], metadata()), /outside captured atom residence/);
  assert.throws(() => createSnapshot([{ file: 'aggregates/a/slices/ignored.yaml', doc: {} }], { ...metadata(), aggregateDirs: ['a'] }), /outside captured atom residence/);
  assert.equal(compileSnapshot(createSnapshot([aggregate], { ...metadata(), aggregateDirs: ['a'] })).canonical.aggregates[0].name, 'A');
});

test('shared stage vocabulary cannot mutate later pure compilation', () => {
  assert.ok(Object.isFrozen(STAGE_ORDER));
  assert.throws(() => STAGE_ORDER.push('invented'), TypeError);
  assert.equal(compileSnapshot(empty()).canonical.sessions.length, 7);
});

test('unknown snapshot versions and undeclared fields never project', () => {
  const data = { schemaVersion: SNAPSHOT_VERSION, atoms: [], metadata: metadata() };
  assert.throws(() => compileSnapshot({ ...data, schemaVersion: 'truthsrc.parsed-snapshot/v999' }), /\/schemaVersion/);
  assert.throws(() => compileSnapshot({ ...data, products: {} }), /unsupported snapshot field/);
});

test('worker imports only its pure shared module and the no-I/O proxy predicate', () => {
  const worker = readFileSync(join(ROOT, 'lib/compile-snapshot.mjs'), 'utf8');
  const pure = readFileSync(join(ROOT, 'lib/shared-pure.mjs'), 'utf8');
  const helper = readFileSync(join(ROOT, 'lib/immutable-data.mjs'), 'utf8');
  const imports = source => [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.deepEqual(imports(worker), ['./immutable-data.mjs', './shared-pure.mjs']);
  assert.deepEqual(imports(helper), ['node:util']);
  assert.equal(/\bimport\b/.test(pure), false);
  assert.equal(/\b(?:process|Date|fetch|require|readFileSync|readdirSync|writeFileSync|existsSync|setTimeout)\b/.test(worker + helper), false);
});

test('preloaded pure module initialization and call succeed with effect APIs disabled', () => {
  // Preload code as the test harness; module source loading is not worker I/O.
  const shared = `data:text/javascript;base64,${Buffer.from(readFileSync(join(ROOT, 'lib/shared-pure.mjs'), 'utf8')).toString('base64')}`;
  const helper = `data:text/javascript;base64,${Buffer.from(readFileSync(join(ROOT, 'lib/immutable-data.mjs'), 'utf8')).toString('base64')}`;
  const source = readFileSync(join(ROOT, 'lib/compile-snapshot.mjs'), 'utf8')
    .replace("'./shared-pure.mjs'", JSON.stringify(shared))
    .replace("'./immutable-data.mjs'", JSON.stringify(helper));
  const entry = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const script = `
    const fs = (await import('node:fs')).default;
    const child = (await import('node:child_process')).default;
    const { syncBuiltinESMExports } = await import('node:module');
    const deny = () => { throw new Error('forbidden effect'); };
    for (const key of ['readFileSync', 'readdirSync', 'existsSync', 'writeFileSync', 'mkdirSync', 'rmSync', 'statSync', 'lstatSync']) fs[key] = deny;
    for (const key of ['execFileSync', 'execSync', 'spawn', 'spawnSync', 'exec', 'fork']) child[key] = deny;
    syncBuiltinESMExports();
    const finish = process.exit.bind(process);
    globalThis.process = new Proxy({}, { get: deny });
    globalThis.Date = new Proxy(class {}, { get: deny, construct: deny });
    globalThis.fetch = deny;
    Math.random = deny;
    const { createSnapshot, compileSnapshot } = await import(${JSON.stringify(entry)});
    const result = compileSnapshot(createSnapshot([], { fallbackWorkshop: 'Isolated', inboxDirs: [], aggregateDirs: [] }));
    if (result.canonical.workshop !== 'Isolated') throw new Error('wrong result');
    finish(0);
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000 });
});


function inventoryAtoms() {
  const quantity = { name: 'quantity', dataType: 'Int', origin: 'BUSINESS_INPUT' };
  const identity = { name: 'reservationId', dataType: 'String', origin: 'BUSINESS_INPUT' };
  const doc = (kind, headers, payload, extra = {}) => ({ kind, ...headers, payload, ...extra });
  return [
    { file: 'workshop.yaml', doc: { schemaVersion: 'truthsrc/v1', workshop: 'Inventory reservation contract' } },
    { file: 'inbox/02-commands/command-cs-reserve-stock-4.yaml', doc: doc('note', { type: 'command', name: 'ReserveStock', origin: { stage: 'commandStorming', board: 'stock-admission', seq: 4 } }, { type: 'command', name: 'ReserveStock', stage: 'commandStorming', description: 'Reserve an integer SKU quantity in the specified warehouse' }) },
    { file: 'aggregates/stock/aggregate.yaml', doc: doc('aggregate', { name: 'Stock', order: { commands: ['ReserveStock', 'ReleaseStock', 'GetStock'], events: ['StockReserved', 'StockReleased'] } }, { name: 'Stock', entity: 'StockEntity', identifier: { name: 'sku', dataType: 'String' }, stateFields: [{ name: 'available', dataType: 'Int' }, { name: 'reserved', dataType: 'Map[String, Int]' }] }) },
    { file: 'aggregates/stock/slices/reserve-stock.slice.yaml', doc: doc('slice', { aggregate: 'Stock', command: 'ReserveStock' }, { name: 'ReserveStock', parameters: [identity, quantity], guards: [{ condition: 'state.available >= command.quantity', error: 'InsufficientStock' }, { condition: 'command.warehouseId == state.warehouseId', error: 'WrongWarehouse' }], produces: ['StockReserved'] }, { events: { StockReserved: { name: 'StockReserved', payloads: [identity, quantity], bindings: [{ slot: 'reservationId', expr: 'command.reservationId' }, { slot: 'quantity', expr: 'command.quantity' }], foldAssignments: [{ slot: 'reserved', expr: 'put(state.reserved, event.reservationId, event.quantity)' }] } } }) },
    { file: 'aggregates/stock/slices/release-stock.slice.yaml', doc: doc('slice', { aggregate: 'Stock', command: 'ReleaseStock' }, { name: 'ReleaseStock', parameters: [identity], produces: ['StockReleased'] }, { events: { StockReleased: { name: 'StockReleased', payloads: [identity], foldAssignments: [{ slot: 'reserved', expr: 'remove(state.reserved, event.reservationId)' }] } } }) },
    { file: 'aggregates/stock/slices/get-stock.slice.yaml', doc: doc('slice', { aggregate: 'Stock', command: 'GetStock' }, { name: 'GetStock', parameters: [], produces: [] }, { events: {} }) },
    { file: 'value-objects/warehouse.vo.yaml', doc: doc('value-object', { name: 'Warehouse' }, { name: 'Warehouse', fields: [{ name: 'warehouseId', dataType: 'String' }] }) },
    { file: 'read-models/stock-availability.rm.yaml', doc: doc('read-model', { name: 'StockAvailability' }, { name: 'StockAvailability', sourceAggregate: 'Stock', fields: [{ name: 'sku', dataType: 'String', source: 'aggregateIdentity' }, { name: 'quantity', dataType: 'Int', source: 'eventField:StockReserved.quantity' }] }) },
  ];
}

function edgeAtoms() {
  const note = (name, seq) => ({ kind: 'note', id: `${name}-header`, type: 'question', name, origin: { stage: 'refining', board: 'edge', seq, author: 'fixture-author' }, payload: { type: 'question', name, nested: { z: 1, a: 2 } } });
  return [
    { file: 'workshop.yaml', doc: { workshop: 'Projection edge contract', sessionOrder: ['refining', 'eventStorming'] } },
    { file: 'inbox/refining/question-rf-z-9.yaml', doc: note('Z', 9) },
    { file: 'inbox/06-aggregate-detail/question-rf-a-2.yaml', doc: note('A', 2) },
    { file: 'aggregates/a/aggregate.yaml', doc: { kind: 'aggregate', name: 'A', seq: 10, context: 'edge-context', bmExtra: {}, order: { commands: ['First', 'Second', 'Query'], events: ['Changed', 'Unproduced'], decisions: ['Second', 'First'], folds: ['Changed'] }, payload: { name: 'A', fields: { z: 1, a: 2 } }, extraEvents: [{ name: 'Unproduced', payloads: [] }], extraFolds: [] } },
    { file: 'aggregates/a/slices/first.slice.yaml', doc: { kind: 'slice', aggregate: 'A', command: 'First', payload: { name: 'First', produces: ['Changed'] }, decision: { emissions: [{ event: 'Changed', bindings: { slot: 'command.x' } }] }, fold: { patch: [{ slot: 'state.y', expr: 'event.x' }] }, events: { Changed: { name: 'Changed', origin: 'first' } } } },
    { file: 'aggregates/a/slices/second.slice.yaml', doc: { kind: 'slice', aggregate: 'A', command: 'Second', payload: { name: 'Second', produces: ['Changed'] }, events: { Changed: { name: 'Changed', origin: 'last' } } } },
    { file: 'aggregates/a/slices/query.slice.yaml', doc: { kind: 'slice', aggregate: 'A', command: 'Query', payload: { name: 'Query', produces: [] }, events: {} } },
    { file: 'aggregates/z/aggregate.yaml', doc: { kind: 'aggregate', name: 'Z', order: { commands: [], events: [] }, payload: { name: 'Z' } } },
    { file: 'value-objects/z.vo.yaml', doc: { kind: 'value-object', name: 'ZValue', seq: 1, payload: { name: 'ZValue' } } },
    { file: 'value-objects/a.vo.yaml', doc: { kind: 'value-object', name: 'AValue', payload: { name: 'AValue' } } },
    { file: 'domain-services/stock.port.yaml', doc: { kind: 'domain-service', name: 'StockPort', payload: { name: 'StockPort', methods: [] } } },
    { file: 'use-cases.yaml', doc: { kind: 'use-cases', payload: { useCases: [] } } },
    { file: 'pipelines/edge.pipeline.yaml', doc: { kind: 'pipeline', id: 'edge', name: 'Edge', steps: [{ id: 'step', kind: 'manual' }], payload: {} } },
    { file: 'scenarios/edge.scenario.yaml', doc: { kind: 'scenario', name: 'Edge', description: 'source-only edge', script: 'opaque narrative' } },
    { file: 'sagas/z.saga.yaml', doc: { kind: 'saga', id: 'z', name: 'Z Saga', version: 'v2', seq: 1, payload: { original: { z: 1, a: 2 } } } },
    { file: 'sagas/a.saga.yaml', doc: { kind: 'saga', id: 'a', name: 'A Saga', version: 'v1', payload: {} } },
  ];
}

function writeTree(atoms, tree) {
  for (const { file, doc } of atoms) {
    const { kind, type, name, id, version, seq, command, aggregate, description, origin, order, ...blocks } = doc;
    const headers = { kind, type, name, id, version, seq, command, aggregate, description };
    const scalars = Object.entries(headers).filter(([, value]) => value !== undefined);
    for (const [key, value] of Object.entries(blocks)) {
      if (value === null || typeof value !== 'object') {
        scalars.push([key, value]);
        delete blocks[key];
      }
    }
    const nested = { ...(origin ? { origin } : {}), ...(order ? { order } : {}) };
    if (file === 'workshop.yaml') {
      for (const [key, value] of Object.entries(blocks)) scalars.push([key, value]);
      if (name !== undefined && !scalars.some(([key]) => key === 'name')) scalars.push(['name', name]);
      for (const [key, value] of Object.entries(doc)) if (!scalars.some(([k]) => k === key)) scalars.push([key, value]);
    }
    const path = join(tree, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, emitDoc({ scalars, nested, blocks: file === 'workshop.yaml' ? {} : blocks }));
  }
}
