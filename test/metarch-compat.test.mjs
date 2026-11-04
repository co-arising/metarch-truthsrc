import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadMetarchSnapshot, projectMetarchProducts, METARCH_COMPAT_VERSION } from '../lib/compat/metarch.mjs';
import { compileSnapshot, createSnapshot } from '../lib/compile-snapshot.mjs';
import { parseDoc, emitDoc, INBOX_PRODUCTS } from '../lib/shared.mjs';
import { AUTHOR_VERSION, CONTEXT_VERSION, compileAuthorEntries, emitAuthorDoc } from '../lib/author-surface.mjs';

// Independent, small BC-author fixtures. Do not generate them with a BC compiler,
// read a sibling checkout by default, or put a raw product snapshot in legacy.
const PREFIX = 'contexts/main/';
function bcDoc(headers, nested = {}, blocks = {}) {
  const lines = ['# synthetic BC author fixture'];
  for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
  for (const [k, v] of Object.entries(nested)) {
    lines.push(`${k}:`);
    for (const [name, value] of Object.entries(v)) lines.push(`  ${name}: ${Array.isArray(value) ? `[${value.join(', ')}]` : value}`);
  }
  for (const [k, value] of Object.entries(blocks)) {
    const [first, ...rest] = JSON.stringify(value, null, 2).split('\n');
    lines.push(`${k}: ${first}`, ...rest.map(line => `  ${line}`));
  }
  return lines.join('\n') + '\n';
}
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'metarch-compat-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = new Map();
  const write = (file, body) => {
    const p = join(dir, file); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); files.set(file, body);
  };
  const replace = (file, from, to) => {
    assert.ok(files.get(file).includes(from), `fixture replacement: ${file} ${from}`);
    write(file, files.get(file).replace(from, to));
  };
  write('metarch.yaml', '# root\nschemaVersion: "metarch.truth.v1"\nworkshop: synthetic\nsessionOrder:\n  - eventStorming\n  - refining\n  - storyMapping\n');
  const meta = {
    template: { name: 'fixture', version: 'historical', relationSemantics: { vocabulary: { REFERENCES: 'reference' } } },
    readmodels: { meta: { status: 'DRAFT', method: 'historical' }, stats: { readModels: 77, generatedAt: 'old' } },
    stories: { meta: { status: 'REVIEW' }, stats: { stories: 88, perRole: { Clerk: 20 } } },
  };
  const concerns = { version: 1, flavors: { all: { artifactKinds: ['*'] } }, concerns: { full: { flavors: ['all'] } } };
  write('governance/artifact-meta.json', JSON.stringify(meta));
  write('governance/concerns.json', JSON.stringify(concerns));
  const stock = { name: 'Stock', description: 'domain-only aggregate text', stateFields: [{ name: 'quantity', dataType: 'Int', writtenBy: ['Reserved.delta'] }] };
  const audit = { name: 'Audit', stateFields: [] };
  const reserve = { name: 'Reserve', parameters: [{ name: 'delta', dataType: 'Int' }], guards: [{ ref: 'source-rule' }], produces: ['Reserved'] };
  const check = { name: 'Check', parameters: [], produces: [], isReadOnly: true };
  const cancelBindings = { Cancelled: { delta: 'param.delta' } };
  const cancel = { name: 'Cancel', produces: ['Cancelled'], emissionBindings: cancelBindings };
  const reserved = { name: 'Reserved', payloads: [{ name: 'delta', dataType: 'Int' }], bindings: [{ slot: 'delta', expr: 'param.delta' }], foldAssignments: [{ slot: 'quantity', expr: 'event.delta' }] };
  const cancelled = { name: 'Cancelled', payloads: [], foldAssignments: [] };
  const observed = { name: 'Observed', payloads: [], unknownBusinessExtension: { preserve: true } };
  const reserveDecision = { command: 'Reserve', guards: [{ ref: 'stored-different-rule', context: { preserve: [true, false, null] } }], emissions: [{ event: 'Reserved', bindings: { delta: 'param.delta' } }], source: 'domain-only decision' };
  const cancelDecision = { command: 'Cancel', guards: [], emissions: [{ event: 'Cancelled', bindings: cancelBindings.Cancelled }] };
  const reserveFold = { event: 'Reserved', assignments: { quantity: 'patch:delta' }, opaque: { preserve: ['stored', 1.25] } };
  const cancelFold = { event: 'Cancelled', assignments: { quantity: 'literal:0' } };
  const extraFold = { event: 'Observed', assignments: { quantity: 'patch:observed' } };
  const bmExtra = { invariants: [{ description: 'domain-only behavior data' }], extension: { complete: true } };
  const aggFile = `${PREFIX}aggregates/stock/aggregate.yaml`;
  write(aggFile, bcDoc({ kind: 'aggregate', name: 'Stock', context: 'main', seq: 2 }, {
    order: { commands: ['Reserve', 'Check', 'Cancel'], events: ['Cancelled', 'Reserved', 'Observed'], decisions: ['Cancel', 'Reserve'], folds: ['Observed', 'Reserved', 'Cancelled'] },
  }, { payload: stock, extraEvents: [observed], extraFolds: [extraFold], bmExtra }));
  write(`${PREFIX}aggregates/audit/aggregate.yaml`, bcDoc({ kind: 'aggregate', name: 'Audit', seq: 0 }, { order: { commands: [], events: [], decisions: [], folds: [] } }, { payload: audit }));
  const sliceFile = name => `${PREFIX}aggregates/stock/slices/${name.toLowerCase()}.slice.yaml`;
  write(sliceFile('Reserve'), bcDoc({ kind: 'slice', aggregate: 'Stock', command: 'Reserve' }, {}, { payload: reserve, events: { Reserved: reserved }, fold: [reserveFold], decision: reserveDecision }));
  write(sliceFile('Check'), bcDoc({ kind: 'slice', aggregate: 'Stock', command: 'Check' }, {}, { payload: check, events: {} }));
  write(sliceFile('Cancel'), bcDoc({ kind: 'slice', aggregate: 'Stock', command: 'Cancel' }, {}, { payload: cancel, events: { Cancelled: cancelled }, decision: cancelDecision, fold: [cancelFold] }));
  const note = (type, name, id, extra = {}) => ({ type, name, noteId: id, links: ['keep:first', 'keep:first', 'keep:second'], info: { values: [null, false, 1.5, '001'], nested: { noteId: 'nested-not-identity' } }, ...extra });
  const question = note('question', 'Why?', 'duplicate', { description: 'line one\nline two: "verbatim"' });
  const one = note('question', 'Same name', 'duplicate', { description: 'domain-only note one' });
  const two = note('question', 'Same name', 'duplicate', { description: 'domain-only note two' });
  const commandNote = note('command', 'Reserve', 'command-id', { author: 'payload author differs', createdAt: 'payload time', info: { complete: { fields: [1, 2] } } });
  const addNote = (file, payload, stage, board, n, author = '""') => write(file, bcDoc({ id: '"shared-header-id"', kind: 'note', type: payload.type, name: JSON.stringify(payload.name) }, {
    origin: { stage, board, seq: n, author, createdAt: '"old author time"' },
  }, { payload }));
  addNote('inbox/eventStorming/question-es-0.yaml', question, 'eventStorming', 'board1', 7);
  addNote('inbox/refining/question-rf-4.yaml', one, 'refining', 'z-board', 4);
  addNote('inbox/refining/question-rf-5.yaml', two, 'refining', 'z-board', 5);
  const noteFile = `${PREFIX}aggregates/stock/notes/command-rf-9.yaml`;
  addNote(noteFile, commandNote, 'refining', 'z-board', 9, '"Alice \\"Q\\""');
  const policy = note('policy', 'Notify', 'policy-id', { info: { triggers: [{ event: 'Reserved', aggregate: 'Stock' }], invokes: [{ command: 'Notify', aggregate: 'Audit' }], bindings: { delta: 'event.delta' }, opaque: 'keep' } });
  const policyFile = `${PREFIX}policies/notify.policy.yaml`;
  write(policyFile, bcDoc({ id: '"policy-id"', kind: 'policy', name: '"Notify"' }, { origin: { stage: 'refining', board: 'b-board', seq: 2 } })
    + 'triggers:\n  - event: Reserved\n    aggregate: Stock\ninvokes:\n  - command: Notify\n    aggregate: Audit\nbindings:\n  delta: "event.delta"\n'
    + bcDoc({}, {}, { payload: policy }));
  const v1 = { name: 'Amount', fields: [{ name: 'value', dataType: 'Decimal' }] }, v4 = { name: 'Tag', fields: [] };
  const r1 = { id: 'read-1', name: 'Available', fields: [], extra: 'domain-only read data' }, r5 = { id: 'read-5', name: 'History', fields: [] };
  const s2 = { id: 'story-2', name: 'Reserve stock', testCases: [{ given: ['q=10'], when: 'reserve', then: ['q=9'] }] }, s9 = { id: 'story-9', name: 'Inspect', info: { untouched: true } };
  for (const [family, suffix, kind, rows] of [
    ['value-objects', 'vo', 'value-object', [[v4, 4], [v1, 1]]],
    ['read-models', 'rm', 'read-model', [[r5, 5], [r1, 1]]],
    ['stories', 'story', 'story', [[s9, 9], [s2, 2]]],
  ]) for (const [payload, n] of rows) write(`${PREFIX}${family}/item-${10 - n}.${suffix}.yaml`, bcDoc({ kind, name: payload.name, id: JSON.stringify(payload.id || `header-${n}`), seq: n }, {}, { payload }));
  const useCases = { useCases: [{ useCase: 'Reserve', steps: [{ command: 'Reserve', onFailure: 'Abort' }] }], extension: { retain: 'domain-only flow data' } };
  write(`${PREFIX}use-cases.yaml`, bcDoc({ kind: 'use-cases' }, {}, { payload: useCases }));
  const aggregates = [], valueObjects = [], behavior = [];
  aggregates[0] = { ...audit, commands: [], events: [] };
  aggregates[2] = { ...stock, commands: [reserve, check, cancel], events: [cancelled, reserved, observed] };
  valueObjects[1] = v1; valueObjects[4] = v4;
  behavior[0] = { name: 'Audit', decisions: [] };
  behavior[2] = { name: 'Stock', decisions: [cancelDecision, reserveDecision], folds: [extraFold, reserveFold, cancelFold], ...bmExtra };
  const expected = {
    METARCH: { workshop: 'synthetic', sessions: [
      { session: 'eventStorming', scopes: [{ scope: 'board1', notes: [question] }] },
      { session: 'refining', scopes: [
        { scope: 'b-board', notes: [policy], fieldModel: { aggregates, valueObjects }, behaviorModel: { aggregates: behavior }, flowModel: useCases },
        { scope: 'z-board', notes: [one, two, commandNote] },
      ] },
      { session: 'storyMapping', scopes: [] },
    ] },
    TEMPLATE: { meta: meta.template, aggregates, valueObjects },
    READMODELS: { meta: meta.readmodels.meta, stats: meta.readmodels.stats, readModels: [r1, r5] },
    STORIES: { meta: meta.stories.meta, stats: meta.stories.stats, stories: [s2, s9] },
    CONCERNS: concerns,
  };
  return { dir, files, write, replace, meta, expected, aggFile, sliceFile, policyFile, noteFile, commandNote, reserveDecision, reserveFold };
}
const compile = f => {
  const loaded = loadMetarchSnapshot(f.dir);
  return { ...loaded, ...compileSnapshot(loaded.snapshot) };
};
const PRODUCT_NAMES = ['METARCH', 'TEMPLATE', 'READMODELS', 'STORIES', 'CONCERNS'];
function assertKeyOrder(actual, expected, where) {
  if (expected === null || typeof expected !== 'object') return;
  assert.deepEqual(Object.keys(actual), Object.keys(expected), `${where} own key order`);
  for (const key of Object.keys(expected)) assertKeyOrder(actual[key], expected[key], `${where}/${key}`);
}
function assertProductsEqual(actual, expected) {
  assert.deepEqual(Object.keys(actual), PRODUCT_NAMES);
  for (const name of PRODUCT_NAMES) {
    assert.deepEqual(actual[name], expected[name], name);
    assertKeyOrder(actual[name], expected[name], name);
    assert.equal(JSON.stringify(actual[name]), JSON.stringify(expected[name]), `${name} serialized key/array order`);
  }
}
function unifiedFixture(t) {
  const f = fixture(t);
  // Explicit TEST author choice, not an adapter default or a production migration.
  f.replace(`${PREFIX}aggregates/audit/aggregate.yaml`, 'name: Audit\n', 'name: Audit\ncontext: main\n');
  const loaded = compile(f);
  const system = { kind: 'system', schemaVersion: AUTHOR_VERSION, id: 'synthetic', name: 'Synthetic stock system',
    workshop: loaded.legacy.root.workshop, sessionOrder: loaded.legacy.root.sessionOrder, contexts: ['main'],
    compatibility: { workshopKey: 'workshop', metarch: loaded.legacy } };
  const context = { kind: 'context', schemaVersion: CONTEXT_VERSION, id: 'main', name: 'Stock', responsibility: 'Synthetic stock accounting' };
  const entries = [{ file: 'system.yaml', content: emitAuthorDoc(system) },
    { file: 'contexts/main/context.yaml', content: emitAuthorDoc(context) }];
  for (const { file, doc } of loaded.snapshot.atoms) {
    if (file === 'workshop.yaml') continue;
    const target = file.startsWith('inbox/')
      ? `inbox/${INBOX_PRODUCTS.find(([, stage]) => stage === doc.origin.stage)[0]}/${file.split('/').at(-1)}`
      : `${PREFIX}${file}`;
    entries.push({ file: target, content: emitAuthorDoc(doc) });
  }
  return { f, ...loaded, canonical: compileAuthorEntries(entries).canonical };
}
function addRepeatedFold(f, residence, fold = f.reserveFold) {
  if (residence === 'extraFolds') f.replace(f.aggFile, 'extraFolds: [', `extraFolds: [\n    ${JSON.stringify(fold)},`);
  else if (residence === 'sameSlice') f.replace(f.sliceFile('Reserve'), 'fold: [', `fold: [\n    ${JSON.stringify(fold)},`);
  else f.write(f.sliceFile('Check'), f.files.get(f.sliceFile('Check')) + bcDoc({}, {}, { fold: [fold] }));
}

test('BC author adapter returns the existing immutable parsed snapshot, using real JS transport', t => {
  const f = fixture(t), loaded = compile(f);
  assert.equal(loaded.snapshot.schemaVersion, 'truthsrc.parsed-snapshot/v1');
  assert.deepEqual(createSnapshot(loaded.snapshot.atoms, loaded.snapshot.metadata), loaded.snapshot);
  assert.deepEqual(loaded.snapshot.metadata.aggregateDirs, ['audit', 'stock']);
  assert.equal(loaded.legacy.schemaVersion, METARCH_COMPAT_VERSION);
  assert.equal(loaded.legacy.root.schemaVersion, 'metarch.truth.v1');
  assert.ok(Object.isFrozen(loaded.snapshot.atoms[0].doc));
  const atom = loaded.snapshot.atoms.find(a => a.file === 'aggregates/stock/notes/command-rf-9.yaml');
  assert.deepEqual(atom.doc.payload, f.commandNote);
  assert.equal(atom.doc.origin.author, 'Alice "Q"');
  assert.equal(atom.doc.origin.seq, 9);
  assert.equal(atom.doc.id, 'shared-header-id');
  assert.deepEqual(parseDoc(emitDoc({ scalars: [['kind', atom.doc.kind], ['id', atom.doc.id], ['type', atom.doc.type], ['name', atom.doc.name]], blocks: { origin: atom.doc.origin, payload: atom.doc.payload } })), atom.doc);
  assert.ok(loaded.report.sources.some(s => s.source === f.noteFile && s.file === atom.file));
  assert.equal(loaded.report.redundantPolicyFaces, 3);
});

test('five products match the independent oracle, including sparse index arrays and first refining board', t => {
  const f = fixture(t), { canonical, legacy } = compile(f);
  const products = projectMetarchProducts(canonical, legacy);
  assertProductsEqual(products, f.expected);
  assert.equal(1 in products.TEMPLATE.aggregates, false);
  assert.equal(products.READMODELS.stats.readModels, 77, 'historical statistics are not recalculated');
});

test('duplicate note IDs/header IDs and complete ordered payloads survive, not Map-by-id deduplication', t => {
  const f = fixture(t), { canonical, report } = compile(f);
  assert.equal(report.notes, 5);
  assert.equal(report.duplicateNoteIds, 2);
  const z = canonical.sessions[1].scopes[1];
  assert.deepEqual(z.notes.map(n => n.description || null), ['domain-only note one', 'domain-only note two', null]);
  assert.deepEqual(z.notes[0].links, ['keep:first', 'keep:first', 'keep:second']);
  assert.equal(canonical.noteSurface['refining|z-board|2'].author, 'Alice "Q"');
  assert.equal(canonical.noteSurface['refining|z-board|2'].createdAt, 'old author time');
  assert.equal(canonical.noteSurface['refining|z-board|2'].seq, 9);
  assert.equal(canonical.noteSurface['refining|z-board|0'].id, 'shared-header-id');
});

test('stored decision/fold payloads stay distinct from inferred bindings and foldAssignments', t => {
  const f = fixture(t), { canonical, legacy } = compile(f);
  const stock = canonical.aggregates.find(a => a.name === 'Stock');
  assert.deepEqual(stock.commands[0].decision, f.reserveDecision);
  assert.deepEqual(stock.commands[0].fold, [f.reserveFold]);
  assert.deepEqual(stock.commands[1].events, {});
  const products = projectMetarchProducts(canonical, legacy);
  assert.equal(products.TEMPLATE.aggregates[2].commands[0].emissionBindings, undefined, 'do not leak JS-derived emissionBindings into BC command payloads');
  assert.deepEqual(products.TEMPLATE.aggregates[2].commands[2].emissionBindings, { Cancelled: { delta: 'param.delta' } }, 'retain authored command field');
  assert.equal(products.METARCH.sessions[1].scopes[0].behaviorModel.aggregates[2].folds[1].assignments.quantity, 'patch:delta');
  assert.equal(products.TEMPLATE.aggregates[2].events[1].foldAssignments[0].expr, 'event.delta');
});

test('projection uses common canonical business data, not opaque legacy fallback; inputs remain unchanged', t => {
  const f = fixture(t), { canonical, legacy } = compile(f);
  assert.deepEqual(Object.keys(legacy), ['schemaVersion', 'root', 'governance', 'authoredEmissionBindings']);
  assert.ok(!JSON.stringify(legacy).includes('domain-only'));
  const original = JSON.stringify(canonical), changed = structuredClone(canonical);
  changed.workshop = 'edited';
  changed.aggregates[1].description = 'edited aggregate';
  changed.aggregates[1].commands[0].decision.source = 'edited decision';
  changed.aggregates[1].commands[0].fold[0].assignments.quantity = 'edited fold';
  changed.sessions[1].scopes[1].notes[0].description = 'edited note';
  changed.readModels[0].extra = 'edited read model';
  changed.useCases.extension.retain = 'edited flow';
  const before = JSON.stringify(changed), products = projectMetarchProducts(changed, legacy);
  assert.equal(products.METARCH.workshop, 'edited');
  assert.equal(products.TEMPLATE.aggregates[2].description, 'edited aggregate');
  const scope = products.METARCH.sessions[1].scopes[0];
  assert.equal(scope.behaviorModel.aggregates[2].decisions[1].source, 'edited decision');
  assert.equal(scope.behaviorModel.aggregates[2].folds[1].assignments.quantity, 'edited fold');
  assert.equal(products.METARCH.sessions[1].scopes[1].notes[0].description, 'edited note');
  assert.equal(products.READMODELS.readModels[0].extra, 'edited read model');
  assert.equal(scope.flowModel.extension.retain, 'edited flow');
  assert.equal(JSON.stringify(canonical), original);
  assert.equal(JSON.stringify(changed), before);
  products.CONCERNS.version = 99;
  assert.equal(legacy.governance.concerns.version, 1);
});

test('missing contexts are reported without injecting a context or a migration decision', t => {
  const f = fixture(t), loaded = compile(f);
  assert.deepEqual(loaded.report.missingContexts, [{ file: 'aggregates/audit/aggregate.yaml', aggregate: 'Audit', reason: 'explicit-context-migration-decision-required' }]);
  assert.ok(Object.isFrozen(loaded.report.missingContexts[0]));
  assert.equal(Object.hasOwn(loaded.snapshot.atoms.find(a => a.file === 'aggregates/audit/aggregate.yaml').doc, 'context'), false);
  assert.equal(Object.hasOwn(loaded.canonical.aggregates.find(a => a.name === 'Audit'), 'context'), false);
  assertProductsEqual(projectMetarchProducts(loaded.canonical, loaded.legacy), f.expected);
});

for (const residence of ['extraFolds', 'otherSlice', 'sameSlice']) test(`identical repeated folds survive in all authored locations: ${residence}`, t => {
  const f = fixture(t); addRepeatedFold(f, residence);
  const { snapshot, canonical, legacy, report } = compile(f);
  assert.equal(report.redundantFolds.length, 1);
  assert.equal(report.redundantFolds[0].aggregate, 'Stock');
  assert.equal(report.redundantFolds[0].event, 'Reserved');
  assert.equal(report.redundantFolds[0].sources.length, 2);
  assert.ok(Object.isFrozen(report.redundantFolds[0].sources));
  const stock = canonical.aggregates.find(a => a.name === 'Stock');
  const stored = [...stock.commands.flatMap(c => c.fold || []), ...stock.extraFolds];
  assert.equal(stored.filter(fold => fold.event === 'Reserved').length, 2);
  assert.equal(snapshot.atoms.flatMap(a => [...(a.doc.fold || []), ...(a.doc.extraFolds || [])]).filter(fold => fold.event === 'Reserved').length, 2);
  assertProductsEqual(projectMetarchProducts(canonical, legacy), f.expected);
});

test('a conflicting repeated fold is an irreducible error naming both source locations', t => {
  const f = fixture(t);
  addRepeatedFold(f, 'extraFolds', { ...f.reserveFold, assignments: { quantity: 'literal:999' } });
  assert.throws(() => loadMetarchSnapshot(f.dir), error => {
    assert.match(error.message, /irreducible fold conflict for Stock.Reserved/);
    assert.ok(error.message.includes('aggregates/stock/slices/reserve.slice.yaml#fold[0]'));
    assert.ok(error.message.includes('aggregates/stock/aggregate.yaml#extraFolds[0]'));
    return true;
  });
});

test('projection cannot hide edits to one repeated fold behind the other stored copy', t => {
  const f = fixture(t); addRepeatedFold(f, 'extraFolds');
  const { canonical, legacy } = compile(f), changed = structuredClone(canonical);
  changed.aggregates.find(a => a.name === 'Stock').extraFolds[0].assignments.quantity = 'changed';
  assert.throws(() => projectMetarchProducts(changed, legacy), /irreducible fold conflict for Stock.Reserved between Stock.Reserve.fold\[0\] and Stock.extraFolds\[0\]/);
});

test('repeated folds with different key order fail precisely instead of choosing an arbitrary BC order', t => {
  const f = fixture(t);
  addRepeatedFold(f, 'extraFolds', { assignments: f.reserveFold.assignments, event: f.reserveFold.event, opaque: f.reserveFold.opaque });
  assert.throws(() => loadMetarchSnapshot(f.dir), /irreducible fold key-order conflict for Stock.Reserved/);
});

test('unified author canonical projects all five products without consuming its derived raw surface', t => {
  const { f, canonical, legacy } = unifiedFixture(t);
  assert.equal(canonical.authoring.schemaVersion, AUTHOR_VERSION);
  assert.deepEqual(canonical.authoring.system.compatibility.metarch, legacy);
  assertProductsEqual(projectMetarchProducts(canonical, legacy), f.expected);
  const changed = structuredClone(canonical);
  changed.aggregates.find(a => a.name === 'Stock').commands[0].decision.source = 'edited semantic decision';
  changed.aggregates.find(a => a.name === 'Stock').commands[0].fold[0].assignments.quantity = 'edited semantic fold';
  changed.sessions[1].scopes[1].notes[0].description = 'edited semantic note';
  changed.useCases.extension.retain = 'edited semantic flow';
  const before = JSON.stringify(changed), products = projectMetarchProducts(changed, legacy);
  const scope = products.METARCH.sessions[1].scopes[0];
  assert.equal(scope.behaviorModel.aggregates[2].decisions[1].source, 'edited semantic decision');
  assert.equal(scope.behaviorModel.aggregates[2].folds[1].assignments.quantity, 'edited semantic fold');
  assert.equal(products.METARCH.sessions[1].scopes[1].notes[0].description, 'edited semantic note');
  assert.equal(scope.flowModel.extension.retain, 'edited semantic flow');
  assert.equal(JSON.stringify(changed), before);
  assert.deepEqual(changed.authoring, canonical.authoring, 'old author text is not repaired or used as fallback');
  assert.equal(Object.hasOwn(products.METARCH, 'authoring'), false);
});

for (const [label, mutate, error] of [
  ['wrong author schema', c => { c.authoring.schemaVersion = 'truthsrc.author/v2'; }, /canonical.authoring.schemaVersion/],
  ['wrong system schema', c => { c.authoring.system.schemaVersion = 'unknown'; }, /canonical.authoring.system.schemaVersion/],
  ['missing compatibility', c => { delete c.authoring.system.compatibility; }, /compatibility.metarch/],
  ['mismatched compatibility', c => { c.authoring.system.compatibility.metarch.governance.concerns.version = 100; }, /compatibility.metarch/],
  ['domain snapshot in compatibility', c => { c.authoring.system.compatibility.metarch.rawSnapshot = c.aggregates; }, /compatibility.metarch/],
  ['unknown author surface', c => { c.authoring.rawSnapshot = c.aggregates; }, /unsupported structural field rawSnapshot/],
  ['missing semantic decision', c => { delete c.aggregates[1].commands[0].decision; }, /missing stored decision Reserve/],
  ['missing semantic fold', c => { delete c.aggregates[1].commands[0].fold; }, /missing or unconsumed definition/],
]) test(`unified author rejection without raw fallback: ${label}`, t => {
  const { canonical, legacy } = unifiedFixture(t), changed = structuredClone(canonical);
  mutate(changed);
  assert.throws(() => projectMetarchProducts(changed, legacy), error);
});

test('matching compatibility does not authorize a legacy domain snapshot', t => {
  const { canonical, legacy } = unifiedFixture(t), changed = structuredClone(canonical);
  const poisoned = { ...legacy, rawSnapshot: canonical.aggregates };
  changed.authoring.system.compatibility.metarch = poisoned;
  assert.throws(() => projectMetarchProducts(changed, poisoned), /legacy: unsupported structural field rawSnapshot/);
});

test('absent stats retain BC own undefined stats fields, not fabricated counts', t => {
  const f = fixture(t);
  delete f.meta.readmodels.stats; delete f.meta.stories.stats;
  f.write('governance/artifact-meta.json', JSON.stringify(f.meta));
  const { canonical, legacy } = compile(f), p = projectMetarchProducts(canonical, legacy);
  assert.ok(Object.hasOwn(p.READMODELS, 'stats'));
  assert.equal(p.READMODELS.stats, undefined);
  assert.equal(p.STORIES.stats, undefined);
});

test('OS metadata is strict by default and ignored only by the explicit boolean option, with a complete report', t => {
  const f = fixture(t), acceptedFiles = f.files.size;
  const ignored = ['.DS_Store', `${PREFIX}aggregates/stock/slices/.DS_Store`, 'governance/.DS_Store'];
  for (const file of ignored) f.write(file, Buffer.from([0, 255, 254]));
  assert.throws(() => loadMetarchSnapshot(f.dir), /unrecognized/);
  assert.throws(() => loadMetarchSnapshot(f.dir, { ignoreOSMetadata: false }), /unrecognized/);
  const { snapshot, legacy, report } = loadMetarchSnapshot(f.dir, { ignoreOSMetadata: true });
  assert.deepEqual(report.ignored, ignored.map(file => ({ file, reason: 'operating-system-metadata' })));
  assert.ok(Object.isFrozen(report.ignored[0]));
  assert.equal(report.files, acceptedFiles, 'accepted file count excludes explicitly reported OS metadata');
  assert.equal(report.atoms, acceptedFiles - 2, 'only the two governance envelopes are not atoms');
  assert.equal(report.sources.some(s => ignored.includes(s.source)), false);
  assertProductsEqual(projectMetarchProducts(compileSnapshot(snapshot).canonical, legacy), f.expected);
});

for (const options of [{ ignoreOSMetadata: 'true' }, { ignoreOSMetadata: 1 }, { ignoreOSMetadata: null }, { ignoreUnknown: true }, null]) {
  test(`invalid metadata option fails closed: ${JSON.stringify(options)}`, t => {
    const f = fixture(t);
    assert.throws(() => loadMetarchSnapshot(f.dir, options), /options/);
  });
}

for (const file of ['.DS_Store', 'Thumbs.db', '._note.yaml', '.DS_Store.bak', 'README.md', 'contexts/other/context.yaml', 'contexts/main/context.yaml', 'contexts/main/pipelines/run.pipeline.yaml', 'inbox/refining/nested/note.yaml', 'governance/extra.json']) {
  test(`unknown file/directory fails closed: ${file}`, t => {
    const f = fixture(t); f.write(file, 'unknown: true\n');
    assert.throws(() => loadMetarchSnapshot(f.dir), /unrecognized|unsupported structural/);
    if (file !== '.DS_Store') assert.throws(() => loadMetarchSnapshot(f.dir, { ignoreOSMetadata: true }), /unrecognized|unsupported structural/);
  });
}

test('an OS metadata name does not authorize a symlink or directory', t => {
  const f = fixture(t);
  mkdirSync(join(f.dir, '.DS_Store'));
  assert.throws(() => loadMetarchSnapshot(f.dir, { ignoreOSMetadata: true }), /unsupported structural directory/);
  rmSync(join(f.dir, '.DS_Store'), { recursive: true });
  symlinkSync(join(f.dir, 'metarch.yaml'), join(f.dir, '.DS_Store'));
  assert.throws(() => loadMetarchSnapshot(f.dir, { ignoreOSMetadata: true }), /symlinks/);
});

test('symlinks are refused rather than following data outside the captured tree', t => {
  const f = fixture(t);
  symlinkSync(join(f.dir, 'metarch.yaml'), join(f.dir, 'inbox/refining/linked.yaml'));
  assert.throws(() => loadMetarchSnapshot(f.dir), /symlinks/);
});

for (const [label, mutate, error] of [
  ['unknown header', f => f.write(f.noteFile, f.files.get(f.noteFile) + 'unknownFace: yes\n'), /unsupported structural field unknownFace/],
  ['unknown kind', f => f.replace(f.noteFile, 'kind: note', 'kind: surprise'), /conflicting/],
  ['duplicate header', f => f.write(f.noteFile, f.files.get(f.noteFile) + 'kind: note\n'), /duplicate header/],
  ['malformed trailing content', f => f.write(f.noteFile, f.files.get(f.noteFile) + 'not a header\n'), /malformed BC line/],
  ['duplicate JSON key', f => f.replace(f.noteFile, '"type": "command",', '"type": "command", "t\\u0079pe": "event",'), /duplicate JSON key type/],
  ['duplicate nested key', f => f.replace(f.noteFile, '  board: z-board', '  board: z-board\n  board: another'), /duplicate origin.board/],
  ['numeric string header coercion', f => f.replace(f.noteFile, 'id: "shared-header-id"', 'id: "001"'), /JS parseDoc\/emitDoc transport/],
  ['unsupported schema version', f => f.replace('metarch.yaml', 'metarch.truth.v1', 'metarch.truth.v2'), /schemaVersion/],
  ['independent policy bindings', f => f.replace(f.policyFile, '  delta: "event.delta"', '  delta: "event.other"'), /no independent policy face/],
  ['missing event definition', f => f.replace(f.aggFile, 'events: [Cancelled, Reserved, Observed]', 'events: [Cancelled, Reserved, Missing]'), /unconsumed definition/],
  ['unconsumed command', f => f.replace(f.aggFile, 'commands: [Reserve, Check, Cancel]', 'commands: [Reserve, Cancel]'), /unconsumed definition/],
  ['unconsumed decision', f => f.replace(f.aggFile, 'decisions: [Cancel, Reserve]', 'decisions: [Cancel]'), /unconsumed definition/],
  ['unconsumed fold', f => f.replace(f.aggFile, 'folds: [Observed, Reserved, Cancelled]', 'folds: [Observed, Cancelled]'), /unconsumed definition/],
  ['reserved aggregate payload', f => f.replace(f.aggFile, '"description": "domain-only aggregate text",', '"seq": 3, "description": "domain-only aggregate text",'), /reserved payload collision seq/],
  ['conflicting emission bindings', f => f.replace(f.sliceFile('Cancel'), '"delta": "param.delta"', '"delta": "other.delta"'), /emissionBindings/],
  ['duplicate note seq', f => f.replace('inbox/refining/question-rf-5.yaml', '  seq: 5', '  seq: 4'), /duplicate stage seq/],
  ['duplicate aggregate seq', f => f.replace(f.aggFile, 'seq: 2', 'seq: 0'), /duplicate structural identity/],
  ['negative catalog seq', f => f.replace(`${PREFIX}value-objects/item-6.vo.yaml`, 'seq: 4', 'seq: -1'), /non-negative safe integer/],
  ['non-object events face', f => f.replace(f.sliceFile('Check'), 'events: {}', 'events: 0'), /expected object/],
  ['non-array order face', f => f.replace(f.aggFile, 'decisions: [Cancel, Reserve]', 'decisions: 0'), /expected array/],
  ['unknown origin stage', f => f.replace(f.noteFile, '  stage: refining', '  stage: missing'), /absent from sessionOrder/],
  ['unpopulated refining', f => f.replace('metarch.yaml', '  - refining', '  - other'), /requires a refining/],
  ['dual payload face', f => f.write(f.aggFile, f.files.get(f.aggFile) + 'payloadR: {}\n'), /unsupported structural field payloadR/],
  ['JS instead of BC JSON block', f => f.replace(f.noteFile, 'payload: {', 'payload:\n  {'), /unsupported JS-style JSON block/],
]) test(`reject ${label} without silent dropping`, t => {
  const f = fixture(t); mutate(f);
  assert.throws(() => loadMetarchSnapshot(f.dir), error);
});

test('duplicate event/fold definitions fail instead of BC last/first-wins data loss', t => {
  const f = fixture(t);
  f.replace(f.sliceFile('Check'), 'events: {}', 'events: {"Reserved":{"name":"Reserved"}}');
  assert.throws(() => loadMetarchSnapshot(f.dir), /duplicate structural identity/);
});

test('projection rejects unsupported common canonical families and absent stored faces', t => {
  const f = fixture(t), { canonical, legacy } = compile(f);
  const unsupported = structuredClone(canonical); unsupported.sagas = [{ id: 'unprojected' }];
  assert.throws(() => projectMetarchProducts(unsupported, legacy), /unsupported structural field sagas/);
  const missing = structuredClone(canonical); delete missing.aggregates[1].commands[0].decision;
  assert.throws(() => projectMetarchProducts(missing, legacy), /missing stored decision Reserve/);
});

// Explicit external oracle, TEST ONLY. No automatic sibling lookup, no cache
// writes, no skip-on-incompatibility. Only the explicit OS metadata exception is
// enabled; every ignored file is independently inventoried and asserted below.
// This is five-product equivalence, not a migration, validator or runtime claim.
test('opt-in actual BC tree: all five objects equal external compileTree', { skip: !process.env.TRUTHSRC_BC_ROOT }, async t => {
  const root = process.env.TRUTHSRC_BC_ROOT;
  const { compileTree } = await import(pathToFileURL(join(root, 'tools/truthsrc/compile.mjs')).href);
  const tree = join(root, 'truth/metarch');
  const { snapshot, legacy, report } = loadMetarchSnapshot(tree, { ignoreOSMetadata: true });
  const diskFiles = [];
  const walk = dir => {
    for (const entry of readdirSync(join(tree, dir), { withFileTypes: true })) {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(file); else diskFiles.push(file);
    }
  };
  walk('');
  assert.deepEqual(report.ignored, diskFiles.filter(file => file.split('/').at(-1) === '.DS_Store').sort()
    .map(file => ({ file, reason: 'operating-system-metadata' })));
  assert.equal(report.files + report.ignored.length, diskFiles.length);
  const aggregateAtoms = snapshot.atoms.filter(a => a.doc.kind === 'aggregate');
  assert.deepEqual(report.missingContexts, aggregateAtoms.filter(a => !Object.hasOwn(a.doc, 'context'))
    .map(a => ({ file: a.file, aggregate: a.doc.name, reason: 'explicit-context-migration-decision-required' })));
  const { canonical } = compileSnapshot(snapshot);
  const expected = compileTree(tree), actual = projectMetarchProducts(canonical, legacy);
  const kindCount = kind => snapshot.atoms.filter(a => a.doc.kind === kind).length;
  const foldDefinitions = snapshot.atoms.reduce((n, a) => n + (a.doc.fold?.length || 0) + (a.doc.extraFolds?.length || 0), 0);
  const refining = expected.METARCH.sessions.find(s => s.session === 'refining').scopes[0];
  const projectedFolds = refining.behaviorModel.aggregates.reduce((n, a) => n + (a.folds?.length || 0), 0);
  t.diagnostic(JSON.stringify({ files: report.files, ignored: report.ignored, atoms: report.atoms,
    sessions: canonical.sessions.length, notes: report.notes, duplicateNoteIds: report.duplicateNoteIds,
    aggregates: kindCount('aggregate'), commands: kindCount('slice'),
    events: canonical.aggregates.reduce((n, a) => n + a.events.length, 0),
    decisions: snapshot.atoms.filter(a => Object.hasOwn(a.doc, 'decision')).length,
    foldDefinitions, projectedFolds, redundantFolds: report.redundantFolds, missingContexts: report.missingContexts,
    valueObjects: kindCount('value-object'), readModels: kindCount('read-model'), stories: kindCount('story'),
    policies: kindCount('policy'), redundantPolicyFaces: report.redundantPolicyFaces, authorConflicts: report.authorConflicts, unsupported: report.unsupported }));
  assert.deepEqual(report.authorConflicts.map(row => row.name).sort(), ['AI Agent', 'DoRFindingsSubmitted', 'KnowledgePatch', 'OrganizationMember', 'SubmitDoRFindings', 'System', 'SystemOperator']);
  const { planAuthorMigration } = await import('../lib/author-migrate.mjs');
  assert.throws(() => planAuthorMigration({ treeDir: tree, format: 'metarch.truth.v1', legacySnapshot: snapshot, legacyMetadata: legacy,
    system: 'metarch', context: 'main', name: 'Metarch', responsibility: 'Own the self-hosting model.' }), /payload.stage: conflicting structural surface/);
  assert.equal(foldDefinitions - projectedFolds, report.redundantFolds.reduce((n, row) => n + row.sources.length - 1, 0));
  assert.equal(report.notes, expected.METARCH.sessions.flatMap(s => s.scopes).reduce((n, s) => n + s.notes.length, 0));
  assert.deepEqual(Object.keys(actual), PRODUCT_NAMES);
  for (const name of PRODUCT_NAMES) await t.test(`${name}: full object and recursive key order`, () => {
    assert.deepEqual(actual[name], expected[name], name);
    assertKeyOrder(actual[name], expected[name], name);
    assert.equal(JSON.stringify(actual[name]), JSON.stringify(expected[name]), `${name} serialized key/array order`);
  });
});
