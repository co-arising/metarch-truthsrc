import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAuthorDoc } from '../lib/author-parse.mjs';
import { AUTHOR_VERSION, CONTEXT_VERSION, compileAuthorEntries, emitAuthorDoc, restoreAuthorEntries } from '../lib/author-surface.mjs';
import { authorFiles, loadAuthorTree } from '../lib/author-tree.mjs';
import { parseDoc, INBOX_PRODUCTS, STAGE_ORDER } from '../lib/shared.mjs';
import { FORMAL_PRODUCT_FAMILIES } from '../lib/formal-products-pure.mjs';
import { compileTree } from '../lib/compile.mjs';
import { compileSnapshot } from '../lib/compile-snapshot.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { loadMetarchSnapshot, projectMetarchProducts } from '../lib/compat/metarch.mjs';
import { planAuthorMigration } from '../lib/author-migrate.mjs';

const prefix = 'contexts/main/';
const aggregateFile = prefix + 'aggregates/counter/aggregate.yaml';
const sliceFile = prefix + 'aggregates/counter/slices/set-count.slice.yaml';
function docs() {
  return new Map([
    ['system.yaml', { kind: 'system', schemaVersion: AUTHOR_VERSION, id: 'sample', name: 'Sample', workshop: 'sample', sessionOrder: ['refining'], contexts: ['main'] }],
    [prefix + 'context.yaml', { kind: 'context', schemaVersion: CONTEXT_VERSION, id: 'main', name: 'Main', responsibility: 'Own counts.' }],
    [aggregateFile, { kind: 'aggregate', name: 'Counter', context: 'main', order: { commands: ['SetCount'], events: ['CountSet'] }, payload: { name: 'Counter', entity: 'Counter', identifier: { name: 'id', dataType: 'String' }, stateFields: [{ name: 'count', dataType: 'Int' }] } }],
    [sliceFile, { kind: 'slice', aggregate: 'Counter', command: 'SetCount', payload: { name: 'SetCount', parameters: [{ name: 'count', dataType: 'Int' }], produces: ['CountSet'] }, events: { CountSet: { name: 'CountSet', payloads: [{ name: 'count', dataType: 'Int' }], bindings: [{ slot: 'count', expr: 'param.count' }], foldAssignments: [{ slot: 'count', expr: 'event.count' }] } } }],
  ]);
}
const entries = ds => [...ds].map(([file, doc]) => ({ file, content: typeof doc === 'string' ? doc : emitAuthorDoc(doc) })).sort((a, b) => a.file.localeCompare(b.file));
const compile = ds => compileAuthorEntries(entries(ds));
function tree(t, ds = docs()) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'author-negative-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, 'sample');
  for (const { file, content } of entries(ds)) {
    const target = join(path, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content);
  }
  return { root, path };
}
const note = (seq = 0, board = 'board1') => ({ kind: 'note', type: 'question', name: 'Why', origin: { stage: 'refining', board, seq }, payload: { type: 'question', name: 'Why', description: 'Why is the count bounded?' } });
const policy = (seq = 1, board = 'board1') => {
  const triggers = [{ event: 'CountSet', aggregate: 'Counter' }], invokes = [{ command: 'SetCount', aggregate: 'Counter' }];
  return { kind: 'policy', type: 'policy', name: 'Recount', origin: { stage: 'refining', board, seq }, triggers, invokes,
    payload: { type: 'policy', name: 'Recount', links: ['event:CountSet', 'command:SetCount'], info: { triggers, invokes } } };
};
const noteFile = 'inbox/06-aggregate-detail/question-rf-why-0.yaml';
const policyFile = prefix + 'policies/policy-rf-recount-1.policy.yaml';

for (const [label, raw] of [
  ['duplicate root', 'kind: note\nkind: note\n'],
  ['duplicate origin header', 'origin:\n  stage: refining\norigin:\n  stage: refining\n'],
  ['duplicate nested origin', 'origin:\n  seq: 0\n  seq: 0\n'],
  ['duplicate nested order', 'order:\n  commands: []\n  commands: []\n'],
  ['duplicate list row', 'triggers:\n  - event: CountSet\n    event: CountSet\n'],
  ['duplicate JSON block', 'payload:\n  {"name":"one","name":"two"}\n'],
  ['escaped JSON alias', 'payload: {"name":"one","\\u006eame":"two"}\n'],
  ['nested JSON alias', 'payload:\n  {"rows":[{"id":1,"\\u0069d":2}]}\n'],
  ['inline array alias', 'order:\n  commands: [{"id":1,"\\u0069d":2}]\n'],
  ['prototype header', '__proto__: ignored\n'],
  ['prototype nested header', 'origin:\n  __proto__: ignored\n'],
]) test('new parser refuses ' + label + ' before data can disappear', () => {
  assert.throws(() => parseAuthorDoc(raw), /AUTHOR_PARSE.*duplicate|AUTHOR_PARSE.*unsupported/);
});

test('author parser otherwise keeps parseDoc grammar, including blocks, lists, raw scalars and malformed-line refusal', () => {
  const samples = [
    '# comment\nname: "A \\"quoted\\" name"\ncount: 007\nempty:\n',
    'payload:\n  {"flag":true,"nil":null,"n":1.25,"context":{"id":"opaque"}}\n',
    'origin:\n  stage: refining\n  board: board1\n  seq: 8\norder:\n  commands: ["SetCount"]\n',
    'triggers:\n  - event: CountSet\n    aggregate: Counter\n  - event: Other\n    aggregate: Other\n',
    'stages:\n  - refining\n  - 2\n',
    'literal: "not closed\nlist: []\n',
  ];
  for (const raw of samples) assert.deepEqual(parseAuthorDoc(raw), parseDoc(raw));
  for (const raw of ['payload: {\n  "n": 1\n  }\n', 'bad-key: no\n', 'order:\n    commands: []\n']) {
    assert.throws(() => parseDoc(raw)); assert.throws(() => parseAuthorDoc(raw));
  }
  assert.equal(parseDoc('id: "001"\n').id, 1, 'legacy parser stays unchanged');
  assert.deepEqual(parseDoc('name: first\nname: last\n'), { name: 'last' });
});

test('quoted numeric scalar aliases retain exact strings in every grammar position and through author emission', () => {
  const raw = 'id: "001"\nversion: "01"\norigin:\n  board: "001"\n  seq: 0\ntriggers:\n  - event: "001"\n    aggregate: "1"\nitems:\n  - "001"\n  - "1"\n';
  const parsed = parseAuthorDoc(raw);
  assert.equal(parsed.id, '001'); assert.equal(parsed.version, '01'); assert.equal(parsed.origin.board, '001');
  assert.deepEqual(parsed.triggers, [{ event: '001', aggregate: '1' }]); assert.deepEqual(parsed.items, ['001', '1']);
  assert.deepEqual(parseAuthorDoc(emitAuthorDoc(parsed)), parsed);
  const ds = docs();
  ds.set(noteFile, { ...note(0), id: '001' });
  ds.set('inbox/06-aggregate-detail/question-rf-why-1.yaml', { ...note(1), id: '1' });
  const { canonical } = compile(ds);
  assert.deepEqual(Object.values(canonical.noteSurface).map(x => x.id), ['001', '1']);
  assert.deepEqual(restoreAuthorEntries(canonical), entries(ds));
  for (const id of ['001', '1']) ds.set(prefix + `sagas/${id}.saga.yaml`, { kind: 'saga', id, name: id, version: '01', payload: { purpose: 'Keep numeric aliases distinct.' } });
  assert.deepEqual(compile(ds).canonical.sagas.map(x => x.id), ['001', '1']);
});

test('duplicate raw data cannot get green compile, validate, roundtrip or restoration via canonical authoring', t => {
  const ds = docs(), raw = emitAuthorDoc(ds.get(aggregateFile)) + 'order: {"commands":["SetCount"],"events":["CountSet"]}\n';
  ds.set(aggregateFile, raw);
  const f = tree(t, ds);
  assert.throws(() => compileTree(f.path), /duplicate root key order/);
  assert.ok(validateTree(f.path).hard.some(x => /duplicate root key order/.test(x)));
  assert.throws(() => roundtrip(f.path), /duplicate root key order/);
  const c = structuredClone(compile(docs()).canonical);
  c.authoring.files.find(e => e.file === aggregateFile).content = raw;
  assert.throws(() => restoreAuthorEntries(c), /duplicate root key order/);
});

for (const [kind, file, make] of [
  ['aggregate', aggregateFile, ds => ds.get(aggregateFile)],
  ['slice', sliceFile, ds => ds.get(sliceFile)],
  ['note', noteFile, () => note()],
  ['policy', policyFile, () => policy()],
  ['value-object', prefix + 'value-objects/count.vo.yaml', () => ({ kind: 'value-object', name: 'Count', payload: { name: 'Count', fields: [] } })],
  ['read-model', prefix + 'read-models/count.rm.yaml', () => ({ kind: 'read-model', name: 'Count', payload: { name: 'Count', fields: [] } })],
  ['story', prefix + 'stories/count.story.yaml', () => ({ kind: 'story', name: 'Count', payload: { name: 'Count' } })],
  ['domain-service', prefix + 'domain-services/count.port.yaml', () => ({ kind: 'domain-service', name: 'Count', payload: { name: 'Count', methods: [] } })],
  ['use-cases', prefix + 'use-cases.yaml', () => ({ kind: 'use-cases', name: 'CurrentFlows', payload: { useCases: [] } })],
]) test(kind + ' refuses unknown scalar and rich structural headers instead of hiding them in raw authoring', () => {
  for (const value of ['lost knowledge', { steps: ['lost'] }]) {
    const ds = docs(); ds.set(file, { ...make(ds), undocumented: value });
    assert.throws(() => compile(ds), /unknown or missing field/);
  }
});

test('whole-atom product scalar extension headers are projected; undocumented rich headers refuse', () => {
  for (const [file, doc] of [
    ['pipelines/p.pipeline.yaml', { kind: 'pipeline', id: 'p', name: 'P', steps: [{ id: 'one', name: 'One' }] }],
    ['scenarios/s.scenario.yaml', { kind: 'scenario', id: 's', name: 'S', description: 'Scenario', script: { arbitrary: ['business', { context: 'elsewhere' }] } }],
    ['sagas/s.saga.yaml', { kind: 'saga', id: 's', name: 'S', version: 'v1', payload: { purpose: 'Preserve' } }],
    ['formal-products/technical-port/p.formal.yaml', { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'technical-port', id: 'p', version: 'v1', payload: { name: 'p', version: 'v1' } }],
  ]) {
    const ds = docs(); ds.set(prefix + file, { ...doc, author: '001' });
    const c = compile(ds).canonical;
    const product = c.pipelines?.[0] || c.scenarios?.[0] || c.sagas?.[0] || c.formalProductSurface?.['ports/0'];
    assert.equal(product.author, '001');
    ds.set(prefix + file, { ...doc, undocumented: { lost: true } });
    assert.throws(() => compile(ds), /unsupported rich header/);
  }
});

test('aggregate and catalog reserved payload fields refuse even without a conflicting header value', () => {
  for (const key of ['commands', 'events', 'context', 'seq', 'bmExtra', 'orderDecisions', 'orderFolds', 'extraFolds', 'eventResidence']) {
    const ds = docs(); ds.get(aggregateFile).payload[key] = key === 'context' ? 'main' : [];
    assert.throws(() => compile(ds), new RegExp('reserved payload collision ' + key));
  }
  const ds = docs(); ds.set(prefix + 'value-objects/count.vo.yaml', { kind: 'value-object', payload: { name: 'Count', seq: 4 } });
  assert.throws(() => compile(ds), /reserved payload collision seq/);
});

test('slice reserved payload faces and conflicting emission bindings refuse, identical authored bindings survive', () => {
  for (const key of ['decision', 'fold', 'events']) {
    const ds = docs(); ds.get(sliceFile).payload[key] = {};
    assert.throws(() => compile(ds), new RegExp('reserved payload collision ' + key));
  }
  const ds = docs(), s = ds.get(sliceFile);
  s.decision = { command: 'SetCount', emissions: [{ event: 'CountSet', bindings: { count: 'param.count' } }] };
  s.payload.emissionBindings = { CountSet: { count: 'literal:999' } };
  assert.throws(() => compile(ds), /emissionBindings.*conflicting/);
  s.payload.emissionBindings.CountSet.count = 'param.count';
  assert.deepEqual(compile(ds).canonical.aggregates[0].commands[0].emissionBindings, s.payload.emissionBindings);
});

test('ignored nested order keys, unconsumed slices/events and last-wins event pools refuse at capture', () => {
  for (const mutate of [
    ds => { ds.get(aggregateFile).order.unknown = []; },
    ds => { ds.get(aggregateFile).order.commands = []; },
    ds => { ds.get(aggregateFile).order.events = []; },
    ds => { ds.get(aggregateFile).order.events.push('CountSet'); },
    ds => { ds.get(aggregateFile).extraEvents = [structuredClone(ds.get(sliceFile).events.CountSet)]; },
    ds => { ds.set(prefix + 'aggregates/counter/slices/duplicate.slice.yaml', structuredClone(ds.get(sliceFile))); },
    ds => { ds.get(sliceFile).events.CountSet.name = 'Different'; },
    ds => { ds.get(sliceFile).aggregate = 'Different'; },
  ]) {
    const ds = docs(); mutate(ds); assert.throws(() => compile(ds), /AUTHOR_CONTRACT/);
  }
});

test('documented flow name, catalog provenance and BC decision/fold/bmExtra/order carry survive without business-record scanning', () => {
  const ds = docs(), a = ds.get(aggregateFile), s = ds.get(sliceFile);
  const opaque = { context: 'business-context-not-a-reference', kind: 'port', id: '001', nested: { context: { rich: true } }, arbitrary: [false, null, 1.25] };
  a.payload.extension = opaque;
  a.bmExtra = { invariants: [opaque] }; a.extraFolds = [{ event: 'Unproduced', assignments: { count: 'patch:count' } }];
  a.order.decisions = ['SetCount']; a.order.folds = ['Unproduced', 'CountSet'];
  s.decision = { command: 'SetCount', guards: [opaque] }; s.fold = [{ event: 'CountSet', assignments: { count: 'patch:count' }, opaque }];
  s.payload.context = opaque; s.payload.kind = 'port'; s.payload.id = '001';
  const uc = { kind: 'use-cases', name: 'BankWealthCurrentFlows', payload: { useCases: [{ useCase: 'Set count', context: 'scenario-domain' }], context: opaque } };
  ds.set(prefix + 'use-cases.yaml', uc);
  ds.set(prefix + 'value-objects/count.vo.yaml', { kind: 'value-object', name: 'Count', id: 'legacy-provenance-only', payload: { name: 'Count', context: opaque, fields: [] } });
  ds.set(noteFile, { ...note(), payload: { ...note().payload, context: opaque } });
  const { canonical: c } = compile(ds), aggregate = c.aggregates[0], command = aggregate.commands[0];
  assert.deepEqual(aggregate.extension, opaque); assert.deepEqual(aggregate.bmExtra, a.bmExtra);
  assert.deepEqual(aggregate.orderDecisions, a.order.decisions); assert.deepEqual(aggregate.orderFolds, a.order.folds);
  assert.deepEqual(aggregate.extraFolds, a.extraFolds); assert.deepEqual(command.decision, s.decision); assert.deepEqual(command.fold, s.fold);
  assert.deepEqual(command.context, opaque); assert.deepEqual(c.useCases, uc.payload);
  assert.deepEqual(restoreAuthorEntries(c), entries(ds));
  assert.equal(parseAuthorDoc(c.authoring.files.find(e => e.file.endsWith('use-cases.yaml')).content).name, uc.name);
});

for (const kind of ['note', 'policy']) test(kind + ' requires an included explicit origin stage and a nonnegative safe frozen sequence', () => {
  for (const mutate of [
    o => { delete o.stage; }, o => { o.stage = 'eventStorming'; }, o => { o.stage = 'unknown'; },
    o => { delete o.seq; }, ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '0', null].map(value => o => { o.seq = value; }),
    o => { o.board = ''; }, o => { o.board = 2; }, o => { o.board = 'a|b'; },
    o => { o.author = {}; }, o => { o.createdAt = 42; }, o => { o.unrepresented = 'lost'; },
  ]) {
    const ds = docs(), doc = kind === 'note' ? note() : policy(); mutate(doc.origin);
    ds.set(kind === 'note' ? noteFile : policyFile, doc);
    assert.throws(() => compile(ds), /origin|seq|sessionOrder|inbox residence or stage/);
  }
});

test('origins are collision checked across inbox, aggregate notes and policies; every accepted payload enters sessions', () => {
  const ds = docs(); ds.set(noteFile, note(8)); ds.set(policyFile, policy(8));
  assert.throws(() => compile(ds), /duplicate stage\/board\/seq/);
  ds.set(policyFile, policy(13));
  const ownedFile = prefix + 'aggregates/counter/notes/question-rf-owned-8.yaml';
  ds.set(ownedFile, note(8)); assert.throws(() => compile(ds), /duplicate stage\/board\/seq/);
  ds.set(ownedFile, note(8, 'board2'));
  const { canonical: c } = compile(ds);
  assert.equal(c.sessions.flatMap(s => s.scopes.flatMap(s => s.notes)).length, 3);
  assert.deepEqual(c.sessions[0].scopes[0].notes, [note(8).payload, policy(13).payload]);
  assert.deepEqual(Object.values(c.noteSurface).map(s => s.seq).sort((a, b) => a - b), [8, 8, 13]);
  const p = policy(0); delete p.origin.board;
  ds.clear(); for (const [k, v] of docs()) ds.set(k, v);
  ds.set(policyFile, p); ds.set(noteFile, note(0));
  assert.throws(() => compile(ds), /duplicate stage\/board\/seq/);
});

test('policy structured faces cannot silently diverge from payload or be captured without their canonical meaning', () => {
  for (const key of ['triggers', 'invokes', 'bindings']) {
    const ds = docs(), p = policy();
    if (key === 'bindings') p.bindings = { count: 'event.count' };
    else p[key] = [{ [key === 'triggers' ? 'event' : 'command']: 'Discarded' }];
    ds.set(policyFile, p); assert.throws(() => compile(ds), /must be carried by payload.info/);
    p.payload.info[key] = p[key]; assert.doesNotThrow(() => compile(ds));
  }
});

for (const dir of ['inbox/01-foo', 'inbox/14-other', 'inbox/refining', 'inbox/01-event-flow/nested', 'contexts/other', prefix + 'inbox', prefix + 'inbox/01-event-flow', prefix + 'formal-products/unknown', 'formal-products', 'aggregates', prefix + 'aggregates/empty', prefix + 'unrecognized']) {
  test('empty unknown or mixed-layout directory refuses: ' + dir, t => {
    const f = tree(t); mkdirSync(join(f.path, dir), { recursive: true });
    assert.throws(() => loadAuthorTree(f.path), /unknown\/mixed author directory/);
    assert.ok(validateTree(f.path).hard.length > 0);
  });
}

test('all registered unused categories, formal families and declared aggregate child dirs may be empty; identity covers files not directories', t => {
  const ds = docs();
  ds.set('README.md', '# Sample\nDomain explanation.\n');
  ds.set('inbox/README.md', '# Coverage\nUnused categories are intentional.\n');
  ds.set(prefix + 'README.md', '# Main\nOwn counts.\n');
  const f = tree(t, ds);
  for (const dir of [
    ...INBOX_PRODUCTS.map(([d]) => 'inbox/' + d),
    ...['aggregates', 'value-objects', 'read-models', 'stories', 'domain-services', 'policies', 'pipelines', 'scenarios', 'sagas', 'formal-products'].map(d => prefix + d),
    ...Object.keys(FORMAL_PRODUCT_FAMILIES).map(d => prefix + 'formal-products/' + d),
    prefix + 'aggregates/counter/notes',
  ]) mkdirSync(join(f.path, dir), { recursive: true });
  assert.equal(validateTree(f.path).hard.length, 0);
  assert.equal(roundtrip(f.path).ok, true);
  const target = join(f.root, 'restored', 'sample'); decomposeCanonical(compileTree(f.path), target);
  assert.deepEqual(authorFiles(target).files, authorFiles(f.path).files);
  assert.equal(existsSync(join(target, prefix + 'formal-products/technical-port')), false, 'empty categories are not invented on decomposition');
});

test('strict root/context/compatibility option types refuse unknown, null, rich and inconsistent structures', () => {
  const cases = [
    ['system.yaml', 'description', {}], ['system.yaml', 'relationships', {}], ['system.yaml', 'relationships', ['other']],
    ['system.yaml', 'compatibility', 'legacy'], ['system.yaml', 'compatibility', null], ['system.yaml', 'compatibility', []],
    ['system.yaml', 'compatibility', { unknown: 'lost' }], ['system.yaml', 'compatibility', { workshopKey: true }],
    ['system.yaml', 'compatibility', { workshopKey: 'unknown' }], ['system.yaml', 'compatibility', { metarch: {} }],
    ['system.yaml', 'contexts', ['main', 'other']], ['system.yaml', 'sessionOrder', ['refining', 'refining']],
    ['system.yaml', 'id', 1], ['system.yaml', 'workshop', {}], ['system.yaml', 'name', []],
    [prefix + 'context.yaml', 'description', []], [prefix + 'context.yaml', 'relationships', null],
    [prefix + 'context.yaml', 'responsibility', {}], [prefix + 'context.yaml', 'id', 'other'],
    [prefix + 'context.yaml', 'unknown', 'lost'],
  ];
  for (const [file, key, value] of cases) {
    const ds = docs(); ds.get(file)[key] = value; assert.throws(() => compile(ds), /AUTHOR_CONTRACT/);
  }
  const ds = docs(); delete ds.get(aggregateFile).context; assert.throws(() => compile(ds), /explicit context/);
  ds.get(aggregateFile).context = 'other'; assert.throws(() => compile(ds), /explicit context/);
});

test('formal declared context is checked, but context/kind/id-shaped business extensions are not reference scans', () => {
  const ds = docs();
  const file = prefix + 'formal-products/artifact-contract/c.formal.yaml';
  const doc = { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'artifact-contract', id: 'c', version: 'v1', payload: { id: 'c', version: 'v1', artifact: { context: 'other', kind: 'aggregate', owner: [], id: 'Counter' } } };
  ds.set(file, doc); assert.throws(() => compile(ds), /formal context conflicts/);
  doc.payload.artifact.context = 'main'; doc.payload.opaque = { kind: 'port', context: 'different', id: 'data' };
  assert.deepEqual(compile(ds).canonical.artifactContracts[0].opaque, doc.payload.opaque);
});

function bcFixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'author-bc-contract-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (file, text) => { const target = join(root, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text); };
  // BC's own block-opening convention; no dependency on its compiler.
  const bc = (headers, blocks) => Object.entries(headers).map(([k, v]) => `${k}: ${v}\n`).join('') + Object.entries(blocks).map(([k, v]) => {
    const [first, ...rest] = JSON.stringify(v, null, 2).split('\n');
    return `${k}: ${first}\n` + rest.map(l => '  ' + l + '\n').join('');
  }).join('');
  put('metarch.yaml', 'schemaVersion: metarch.truth.v1\nworkshop: sample\nsessionOrder:\n  - refining\n');
  put('governance/artifact-meta.json', JSON.stringify({ template: { source: 'historical' }, readmodels: { meta: {}, stats: { count: 4 } }, stories: { meta: {}, stats: {} } }));
  put('governance/concerns.json', JSON.stringify({ concern: { opaque: ['retain'] } }));
  const a = docs().get(aggregateFile), s = docs().get(sliceFile);
  put(aggregateFile, bc({ kind: 'aggregate', name: 'Counter', context: 'main', seq: 2 }, {}) + 'order:\n  commands: [SetCount]\n  events: [CountSet]\n  decisions: [SetCount]\n  folds: [CountSet]\n' + bc({}, { payload: a.payload, bmExtra: { source: 'legacy' } }));
  put(sliceFile, bc({ kind: 'slice', aggregate: 'Counter', command: 'SetCount' }, { payload: s.payload, events: s.events, decision: { command: 'SetCount', emissions: [{ event: 'CountSet', bindings: { count: 'param.count' } }] }, fold: [{ event: 'CountSet', assignments: { count: 'patch:count' } }] }));
  put('inbox/refining/question-rf-why-8.yaml', bc({ kind: 'note', type: 'question', name: 'Why', id: 'legacy-note' }, {}) + 'origin:\n  stage: refining\n  board: board1\n  seq: 8\n  author: ""\n  createdAt: "old time"\n' + bc({}, { payload: note().payload }));
  put(prefix + 'use-cases.yaml', bc({ kind: 'use-cases' }, { payload: { useCases: [] } }));
  put(prefix + 'value-objects/count.vo.yaml', bc({ kind: 'value-object', name: 'Count', id: 'provenance-only', seq: 3 }, { payload: { name: 'Count', fields: [] } }));
  const p = policy(5); delete p.type;
  put(policyFile, bc({ kind: 'policy', name: p.name }, {}) + 'origin:\n  stage: refining\n  board: board1\n  seq: 5\n' + bc({}, { triggers: p.triggers, invokes: p.invokes, payload: p.payload }));
  return root;
}

test('BC migration conventions retain five-product meaning, sparse seq, policy optional type and catalog provenance', t => {
  const treeDir = bcFixture(t), loaded = loadMetarchSnapshot(treeDir);
  const plan = planAuthorMigration({ treeDir, format: 'metarch.truth.v1', system: 'sample', context: 'main', name: 'Sample', responsibility: 'Own counts.', legacySnapshot: loaded.snapshot, legacyMetadata: loaded.legacy });
  const migrated = compileAuthorEntries(plan.files).canonical;
  assert.deepEqual(projectMetarchProducts(migrated, loaded.legacy), projectMetarchProducts(compileSnapshot(loaded.snapshot).canonical, loaded.legacy));
  assert.equal(migrated.aggregates[0].seq, 2);
  assert.equal(migrated.aggregates[0].commands[0].fold[0].assignments.count, 'patch:count');
  assert.deepEqual(restoreAuthorEntries(migrated), plan.files);
  for (const mutate of [
    l => { l.unexpected = {}; }, l => { l.root.workshop = 'other'; }, l => { l.root.sessionOrder = ['eventStorming']; },
    l => { l.root.unknown = []; }, l => { l.governance = []; }, l => { l.governance.artifactMeta.stories.stats = 'wrong'; },
    l => { l.governance.concerns = []; }, l => { l.authoredEmissionBindings = [['Counter']]; },
  ]) {
    const changed = structuredClone(plan.files), system = parseAuthorDoc(changed.find(e => e.file === 'system.yaml').content);
    mutate(system.compatibility.metarch); changed.find(e => e.file === 'system.yaml').content = emitAuthorDoc(system);
    assert.throws(() => compileAuthorEntries(changed), /AUTHOR_CONTRACT/);
  }
});

const bankTree = fileURLToPath(new URL('../../bank-wealth-demo/truth/bank-wealth', import.meta.url));
test('existing bank new author tree remains admitted, including its named use-case document', { skip: !existsSync(join(bankTree, 'system.yaml')) }, () => {
  const result = loadAuthorTree(bankTree);
  const useCases = result.canonical.authoring.files.find(e => e.file.endsWith('/use-cases.yaml'));
  assert.equal(parseAuthorDoc(useCases.content).name, 'BankWealthCurrentFlows');
  assert.ok(result.canonical.aggregates.length > 0);
  assert.deepEqual(restoreAuthorEntries(result.canonical), authorFiles(bankTree).files);
  assert.equal(result.canonical.sessions.flatMap(s => s.scopes.flatMap(s => s.notes)).length,
    result.snapshot.atoms.filter(a => ['note', 'policy'].includes(a.doc.kind)).length);
  assert.ok(result.system.sessionOrder.every(s => STAGE_ORDER.includes(s)));
});
