import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, linkSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { loadMetarchSnapshot, verifyMetarchCapture, projectMetarchProducts, METARCH_COMPAT_VERSION } from '../lib/compat/metarch.mjs';
import { planAuthorMigration, writeAuthorMigration, assessMetarchMigration, verifyAuthorMigrationAssessment, migrateAuthorCli } from '../lib/author-migrate.mjs';
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
  const dir = mkdtempSync(join(realpathSync(tmpdir()), 'metarch-compat-'));
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
    assert.equal(JSON.stringify(actual[name], null, 2) + (name === 'METARCH' ? '' : '\n'),
      JSON.stringify(expected[name], null, 2) + (name === 'METARCH' ? '' : '\n'), `${name} BC file serialization`);
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

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const migrationOptions = f => ({ treeDir: f.dir, format: 'metarch.truth.v1', system: 'synthetic', context: 'main', name: 'Synthetic', responsibility: 'Own stock and audit.' });
const migrationArgs = (f, out) => ['--tree', f.dir, '--format', 'metarch.truth.v1', '--out', out, '--system', 'synthetic', '--context', 'main', '--name', 'Synthetic', '--responsibility', 'Own stock and audit.'];
function coherentFixture(t) {
  const f = fixture(t);
  f.replace(`${PREFIX}aggregates/audit/aggregate.yaml`, 'name: Audit\n', 'name: Audit\ncontext: main\n');
  return f;
}
function stageConflict(f, file = f.noteFile, stage = 'storyMapping') {
  f.replace(file, '"noteId":', `"stage": "${stage}",\n    "noteId":`);
}

test('source capture hashes the original bytes including ignored metadata, is immutable, and cannot be forged', t => {
  const f = fixture(t);
  f.write('.DS_Store', Buffer.from([0, 255, 254]));
  const loaded = loadMetarchSnapshot(f.dir, { ignoreOSMetadata: true });
  assert.equal(loaded.capture.root, f.dir);
  assert.deepEqual(loaded.capture.files.map(row => row.file), [...f.files.keys()].sort());
  for (const row of loaded.capture.files) {
    assert.equal(row.sha256, sha256(readFileSync(join(f.dir, row.file))));
    assert.equal(row.bytes, Buffer.byteLength(f.files.get(row.file)));
  }
  assert.ok(Object.isFrozen(loaded.capture.files[0]));
  assert.strictEqual(verifyMetarchCapture(loaded), loaded.capture);
  assert.throws(() => verifyMetarchCapture(structuredClone(loaded)), /live adapter capture/);
});

test('every stage blocker carries complete physical identity, distinct aliases and unchanged payload', t => {
  const f = fixture(t); stageConflict(f);
  const loaded = loadMetarchSnapshot(f.dir), conflict = loaded.report.authorConflicts[0];
  const atom = loaded.snapshot.atoms.find(a => a.file === conflict.snapshotFile);
  assert.equal(conflict.file, f.noteFile);
  assert.equal(conflict.fileSha256, sha256(f.files.get(f.noteFile)));
  assert.equal(conflict.headerId, 'shared-header-id');
  assert.equal(conflict.payloadNoteId, 'command-id');
  assert.deepEqual(conflict.origin, atom.doc.origin);
  assert.deepEqual(conflict.payload, atom.doc.payload);
  assert.equal(conflict.pointers.originStage, '/origin/stage');
  assert.equal(conflict.pointers.payloadStage, '/payload/stage');
  assert.equal(conflict.originStage, 'refining');
  assert.equal(conflict.payloadStage, 'storyMapping');
  const aliases = loaded.report.duplicateNoteIdOccurrences;
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0].noteId, 'duplicate');
  assert.equal(aliases[0].disposition, 'ambiguous-legacy-alias');
  assert.equal(aliases[0].occurrences.length, 3);
  assert.equal(new Set(aliases[0].occurrences.map(row => row.file)).size, 3);
  assert.deepEqual(aliases[0].occurrences.map(row => row.origin.seq), [7, 4, 5]);
  assert.ok(Object.isFrozen(conflict.payload.info));
});

test('blocked assessment covers every file and both semantic blockers without making an executable plan', t => {
  const f = fixture(t); stageConflict(f);
  const options = migrationOptions(f), loaded = loadMetarchSnapshot(f.dir);
  const assessment = assessMetarchMigration(options, loaded);
  assert.equal(assessment.status, 'blocked');
  assert.equal(assessment.applied, false);
  assert.equal(assessment.writable, false);
  assert.equal(Object.hasOwn(assessment, 'files'), false);
  assert.deepEqual(assessment.blockers.map(row => row.code), ['AUTHOR_STAGE_CONFLICT', 'AUTHOR_CONTEXT_REQUIRED']);
  assert.deepEqual(assessment.mappings.map(row => row.from), [...f.files.keys()].sort());
  assert.equal(assessment.mappings.find(row => row.from === 'governance/concerns.json').pointer, '/compatibility/metarch/governance/concerns');
  assert.equal(assessment.mappings.find(row => row.from === f.noteFile).to, f.noteFile);
  assert.equal(assessment.checks.newAuthorAdmission, 'blocked');
  assert.equal(assessment.checks.newAuthorSemanticEquality, 'not-run');
  assert.equal(assessment.checks.newAuthorFiveProductEquality, 'not-run');
  assert.equal(assessment.checks.scalaConsumer, 'not-run');
  assert.equal(assessment.checks.independentBCOracle, 'not-run');
  assert.equal(assessment.proposedDeclarations.context.id, 'main');
  assert.equal(Object.hasOwn(loaded.snapshot.atoms.find(a => a.doc.name === 'Audit').doc, 'context'), false);
  assert.throws(() => writeAuthorMigration(assessment, join(f.dir, 'new/synthetic')), /not an assessment/);
  assert.equal(existsSync(join(f.dir, 'new')), false);
  assert.strictEqual(verifyAuthorMigrationAssessment(assessment), assessment);
  assert.throws(() => verifyAuthorMigrationAssessment(structuredClone(assessment)), /historical evidence/);
  const products = projectMetarchProducts(compileSnapshot(loaded.snapshot).canonical, loaded.legacy);
  for (const row of assessment.products) {
    const bytes = JSON.stringify(products[row.product], null, 2) + (row.product === 'METARCH' ? '' : '\n');
    assert.equal(row.bytes, Buffer.byteLength(bytes));
    assert.equal(row.sha256, sha256(bytes));
  }
});

for (const mutation of ['comment', 'payload', 'add', 'remove', 'empty-directory', 'ignored-metadata']) test('stale capture cannot acquire newer source evidence: ' + mutation, t => {
  const f = coherentFixture(t);
  f.write('.DS_Store', Buffer.from([0, 255]));
  const loaded = loadMetarchSnapshot(f.dir, { ignoreOSMetadata: true });
  const options = { ...migrationOptions(f), legacySnapshot: loaded.snapshot, legacyMetadata: loaded.legacy };
  const plan = planAuthorMigration(options);
  const assessment = assessMetarchMigration({ ...migrationOptions(f), ignoreOSMetadata: true }, loaded);
  if (mutation === 'comment') f.write(f.noteFile, f.files.get(f.noteFile) + '# changed bytes only\n');
  if (mutation === 'payload') f.replace(f.noteFile, 'payload author differs', 'changed author');
  if (mutation === 'add') f.write('unknown.yaml', 'kind: question\n');
  if (mutation === 'remove') rmSync(join(f.dir, f.noteFile));
  if (mutation === 'empty-directory') mkdirSync(join(f.dir, 'inbox/contextMapping'));
  if (mutation === 'ignored-metadata') f.write('.DS_Store', Buffer.from([0, 254]));
  assert.throws(() => verifyMetarchCapture(loaded), /changed|unrecognized/);
  assert.throws(() => verifyAuthorMigrationAssessment(assessment), /changed|unrecognized/);
  assert.throws(() => planAuthorMigration(options), /changed|unrecognized/);
  assert.throws(() => writeAuthorMigration(plan, join(f.dir, 'new/synthetic')), /changed|unrecognized/);
  assert.equal(existsSync(join(f.dir, 'new')), false);
});

test('snapshots, governance and saved plans cannot be spliced across source captures', t => {
  const a = coherentFixture(t), b = coherentFixture(t), first = loadMetarchSnapshot(a.dir), second = loadMetarchSnapshot(b.dir);
  const input = { ...migrationOptions(a), legacySnapshot: first.snapshot, legacyMetadata: first.legacy };
  assert.throws(() => planAuthorMigration({ ...input, legacySnapshot: structuredClone(first.snapshot) }), /original snapshot/);
  assert.throws(() => planAuthorMigration({ ...input, legacyMetadata: second.legacy }), /original snapshot/);
  assert.throws(() => planAuthorMigration({ ...input, treeDir: b.dir }), /another source root/);
  assert.throws(() => assessMetarchMigration(migrationOptions(b), first), /differs from its capture/);
  const plan = planAuthorMigration(input), out = join(a.dir, 'new/synthetic');
  assert.throws(() => writeAuthorMigration(structuredClone(plan), out), /replanned from a live capture/);
  assert.equal(existsSync(join(a.dir, 'new')), false);
});

test('source-bound output edits to compatibility, provenance or binding cannot retain admission', t => {
  const f = coherentFixture(t), loaded = loadMetarchSnapshot(f.dir);
  const input = { ...migrationOptions(f), legacySnapshot: loaded.snapshot, legacyMetadata: loaded.legacy };
  for (const mutate of [
    plan => { const entry = plan.files.find(row => row.file === 'system.yaml'), doc = parseDoc(entry.content); doc.compatibility.metarch.governance.artifactMeta.readmodels.stats.readModels++; entry.content = emitAuthorDoc(doc); },
    plan => { const entry = plan.files.find(row => row.file === f.noteFile), doc = parseDoc(entry.content); doc.origin.author = 'rewritten'; entry.content = emitAuthorDoc(doc); },
    plan => { delete plan.sourceRoot; plan.format = 'truthsrc/v1'; },
  ]) {
    const plan = planAuthorMigration(input);
    mutate(plan);
    assert.throws(() => writeAuthorMigration(plan, join(f.dir, 'new/synthetic')), /plan changed after admission/);
    assert.equal(existsSync(join(f.dir, 'new')), false);
  }
});

test('copied BC capture cannot bypass binding by relabeling the plan format', t => {
  const f = coherentFixture(t), loaded = loadMetarchSnapshot(f.dir);
  const plan = structuredClone(planAuthorMigration({ ...migrationOptions(f), legacySnapshot: loaded.snapshot, legacyMetadata: loaded.legacy }));
  plan.format = 'truthsrc/v1';
  mkdirSync(join(f.dir, 'inbox/contextMapping'));
  assert.throws(() => writeAuthorMigration(plan, join(f.dir, 'new/synthetic')), /replanned from a live capture/);
  assert.equal(existsSync(join(f.dir, 'new')), false);
});

test('BC capture is rechecked after parent creation and before root creation', t => {
  const f = coherentFixture(t), loaded = loadMetarchSnapshot(f.dir);
  const plan = planAuthorMigration({ ...migrationOptions(f), legacySnapshot: loaded.snapshot, legacyMetadata: loaded.legacy });
  const outer = mkdtempSync(join(realpathSync(tmpdir()), 'metarch-boundary-'));
  t.after(() => rmSync(outer, { recursive: true, force: true }));
  const parent = join(outer, 'new'), out = join(parent, plan.system), realMkdir = fs.mkdirSync;
  let injected = 0, rootAttempts = 0;
  const mocked = t.mock.method(fs, 'mkdirSync', (...args) => {
    if (args[0] === out) rootAttempts++;
    const result = realMkdir(...args);
    if (args[0] === parent && args[1]?.recursive === true) {
      injected++;
      realMkdir(join(f.dir, 'inbox/contextMapping'));
    }
    return result;
  });
  try {
    syncBuiltinESMExports();
    assert.throws(() => writeAuthorMigration(plan, out), /source changed since parsing/);
    assert.equal(injected, 1);
    assert.equal(rootAttempts, 0);
    assert.equal(existsSync(out), false);
    assert.deepEqual(readdirSync(parent), []);
  } finally {
    mocked.mock.restore();
    syncBuiltinESMExports();
  }
});

test('source-dependent declaration failure remains a structured blocked assessment', async t => {
  const f = coherentFixture(t); f.meta.readmodels.stats = null;
  f.write('governance/artifact-meta.json', JSON.stringify(f.meta));
  const assessment = await migrateAuthorCli([...migrationArgs(f, join(f.dir, 'new/synthetic')), '--plan']);
  assert.equal(assessment.status, 'blocked');
  assert.equal(assessment.blockers[0].code, 'AUTHOR_DECLARATION_CONTRACT');
  assert.match(assessment.blockers[0].message, /stats/);
  assert.equal(assessment.checks.sourceBound, true);
  assert.equal(assessment.checks.newAuthorSemanticEquality, 'not-run');
  assert.equal(assessment.source.files.length, f.files.size);
  assert.equal(existsSync(join(f.dir, 'new')), false);
});

test('unsupported legacy destinations stay visible in the blocked assessment without rewriting stage values', async t => {
  const f = coherentFixture(t);
  f.write('metarch.yaml', f.files.get('metarch.yaml') + '  - customStage\n');
  const file = 'inbox/customStage/question-custom-0.yaml';
  const payload = { type: 'question', name: 'Custom', noteId: 'custom', stage: 'refining' };
  f.write(file, bcDoc({ kind: 'note', type: 'question', name: 'Custom', id: 'custom' }, {
    origin: { stage: 'customStage', board: 'board1', seq: 0 },
  }, { payload }));
  const loaded = loadMetarchSnapshot(f.dir), canonical = compileSnapshot(loaded.snapshot).canonical;
  assert.deepEqual(canonical.sessions.find(s => s.session === 'customStage').scopes[0].notes[0], payload);
  assert.ok(loaded.report.sources.some(row => row.source === file));
  const assessment = await migrateAuthorCli([...migrationArgs(f, join(f.dir, 'new/synthetic')), '--plan']);
  assert.equal(assessment.status, 'blocked');
  assert.equal(assessment.applied, false);
  assert.equal(assessment.writable, false);
  assert.equal(assessment.checks.completeFileMapping, false);
  assert.equal(assessment.mappings.length, f.files.size);
  assert.deepEqual(assessment.mappings.find(row => row.from === file), { from: file, snapshotFile: file, to: null, relation: 'unmapped' });
  assert.deepEqual(assessment.blockers.map(row => row.code), ['AUTHOR_DESTINATION_UNSUPPORTED', 'AUTHOR_STAGE_CONFLICT', 'AUTHOR_DECLARATION_CONTRACT']);
  assert.equal(assessment.blockers[1].originStage, 'customStage');
  assert.equal(assessment.blockers[1].payloadStage, 'refining');
  assert.match(assessment.blockers[2].message, /invalid sessionOrder/);
  assert.ok(assessment.proposedDeclarations.system.sessionOrder.includes('customStage'));
  assert.equal(assessment.checks.compatibilityProjection, 'passed');
  assert.equal(assessment.checks.newAuthorSemanticEquality, 'not-run');
  assert.throws(() => planAuthorMigration({ ...migrationOptions(f), legacySnapshot: loaded.snapshot, legacyMetadata: loaded.legacy }), /invalid sessionOrder/);
  assert.equal(existsSync(join(f.dir, 'new')), false);
});

test('the eighth conflict and same-count replacement remain blocked and are never selected by alias', t => {
  const f = coherentFixture(t);
  for (let i = 0; i < 8; i++) f.write(`inbox/refining/question-rf-conflict-${100 + i}.yaml`, bcDoc({ kind: 'note', type: 'question', name: `Question${i}`, id: 'shared-id' }, {
    origin: { stage: 'refining', board: 'board1', seq: 100 + i },
  }, { payload: { type: 'question', name: `Question${i}`, noteId: 'shared-id', stage: 'storyMapping' } }));
  const first = assessMetarchMigration(migrationOptions(f));
  assert.equal(first.blockers.length, 8);
  assert.equal(first.status, 'blocked');
  const duplicate = first.compatibility.duplicateNoteIdOccurrences.find(row => row.noteId === 'shared-id');
  assert.equal(duplicate.occurrences.length, 8);
  const old = 'inbox/refining/question-rf-conflict-100.yaml';
  rmSync(join(f.dir, old));
  const seventh = assessMetarchMigration(migrationOptions(f));
  assert.equal(seventh.blockers.length, 7);
  f.write(old, f.files.get(old).replaceAll('Question0', 'Replacement'));
  rmSync(join(f.dir, 'inbox/refining/question-rf-conflict-101.yaml'));
  const replaced = assessMetarchMigration(migrationOptions(f));
  assert.equal(replaced.blockers.length, 7);
  assert.equal(replaced.status, 'blocked');
  assert.notDeepEqual(replaced.blockers, seventh.blockers);
  assert.notEqual(replaced.source.sha256, seventh.source.sha256);
});

test('symlink roots, parent aliases and hardlinked source bytes are not admitted captures', t => {
  const f = fixture(t), outer = mkdtempSync(join(realpathSync(tmpdir()), 'metarch-alias-'));
  t.after(() => rmSync(outer, { recursive: true, force: true }));
  symlinkSync(f.dir, join(outer, 'alias'));
  assert.throws(() => loadMetarchSnapshot(join(outer, 'alias')), /symlink/);
  symlinkSync(dirname(f.dir), join(outer, 'parent'));
  assert.throws(() => loadMetarchSnapshot(join(outer, 'parent', f.dir.split('/').at(-1))), /symlink/);
  linkSync(join(f.dir, f.noteFile), join(outer, 'hardlink'));
  assert.throws(() => loadMetarchSnapshot(f.dir), /single-link/);
});

test('public blocked plan is JSON with exit 2, no parent creation, and no implicit write mode', async t => {
  const f = coherentFixture(t); stageConflict(f);
  const parent = join(dirname(f.dir), f.dir.split('/').at(-1) + '-output'), out = join(parent, 'synthetic');
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const args = migrationArgs(f, out), cli = fileURLToPath(new URL('../bin/truthsrc.js', import.meta.url));
  const before = loadMetarchSnapshot(f.dir).capture;
  const result = spawnSync(process.execPath, [cli, 'migrate-author', ...args, '--plan'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'blocked');
  assert.equal(report.blockers[0].file, f.noteFile);
  assert.equal(result.stderr, '');
  assert.equal(existsSync(parent), false);
  await assert.rejects(migrateAuthorCli(args), /MIGRATION_AUTHOR_CONFLICTS/);
  for (const suffix of [['--stage-policy', 'preserve'], ['--plan', '--plan'], ['--ignore-os-metadata', '--ignore-os-metadata']])
    await assert.rejects(migrateAuthorCli([...args, ...suffix]), /unknown\/duplicate\/incomplete/);
  assert.deepEqual(loadMetarchSnapshot(f.dir).capture, before);
  assert.equal(existsSync(parent), false);
});

test('coherent public BC plan retains admitted semantics and can be freshly applied and roundtripped', async t => {
  const f = coherentFixture(t), outer = mkdtempSync(join(realpathSync(tmpdir()), 'metarch-apply-'));
  t.after(() => rmSync(outer, { recursive: true, force: true }));
  const out = join(outer, 'synthetic'), args = migrationArgs(f, out);
  const result = await migrateAuthorCli([...args, '--plan']);
  assert.equal(result.assessment.status, 'ready');
  assert.equal(result.assessment.writable, false);
  assert.equal(result.assessment.checks.newAuthorFiveProductEquality, 'passed');
  assert.equal(existsSync(out), false);
  const applied = await migrateAuthorCli(args);
  assert.equal(applied.applied, true);
  const { validateTree, validateSnapshot } = await import('../lib/validate.mjs');
  const { roundtrip } = await import('../lib/roundtrip.mjs');
  const original = validateSnapshot(loadMetarchSnapshot(f.dir).snapshot);
  const mapPaths = messages => messages.map(message => result.assessment.mappings.reduce((text, row) =>
    row.snapshotFile?.startsWith('inbox/') ? text.replaceAll(row.snapshotFile, row.to) : text, message));
  assert.deepEqual(validateTree(out), { hard: mapPaths(original.hard), notices: mapPaths(original.notices) });
  assert.equal(original.hard.length, 10, 'the preservation fixture intentionally includes unresolved modeling diagnostics');
  assert.equal(roundtrip(out).ok, true);
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
  const expectedConflicts = [
    ['contexts/main/aggregates/do-r/notes/command-rf-submit-do-r-findings-288.yaml', 'SubmitDoRFindings', 288, 'storyMapping', 'b3e10d41-34cb-4046-8550-9cff46ea3c1e', 'd805fbb77a790f8e713b9d94750fe7332468e64b6b7de61f031dc562ca70dd4c'],
    ['contexts/main/aggregates/do-r/notes/event-rf-do-r-findings-submitted-289.yaml', 'DoRFindingsSubmitted', 289, 'storyMapping', '889692b6-9138-4e18-8ee0-40af2178be55', 'ea2653051d1066f816879d7574cff9d07a7dc55820aa0d5d1e6b567242ac700a'],
    ['inbox/refining/aggregate-rf-knowledge-patch-247.yaml', 'KnowledgePatch', 247, 'aggregateDiscovery', '21d57ca3-9d00-44d2-bf31-c59aa67c8822', '242114cea27bbfdb1e78b33c9bcb4d5893a088b2b7649cb3e3380aa8f747b938'],
    ['inbox/refining/aggregate-rf-organization-member-266.yaml', 'OrganizationMember', 266, 'aggregateDiscovery', '8d51c927-11de-41ba-9723-d9997c66c084', 'eccefbc60f9d5a59f4030983354894db86df3f0691a0f4a0ca981e052a1f4169'],
    ['inbox/refining/role-rf-ai-agent-94.yaml', 'AI Agent', 94, 'commandStorming', 'f3859a0e-9ede-41a0-b58f-93ae620a7cfc', 'e270ccfbc3f02f0a8b6a3b324f3ed04daef2eb076d5bdf64a590ad5741824770'],
    ['inbox/refining/role-rf-system-271.yaml', 'System', 271, 'storyMapping', '3135f150-cce8-41f7-866d-6330632b3275', '2cfa05796e74a1d8454a55921de855a28c14843f1a2622f36f8c2a9c8b4cb14f'],
    ['inbox/refining/role-rf-system-operator-263.yaml', 'SystemOperator', 263, 'storyMapping', '5e61e0bb-136c-4070-8f58-aa9ddd034a3c', '07613450e1356bbf0da4791c73d91e1a2fdb06c0afd5a1c91fe950bda5f02180'],
  ];
  assert.deepEqual(report.authorConflicts.map(row => [row.file, row.name, row.origin.seq, row.payloadStage, row.payloadNoteId, row.fileSha256]), expectedConflicts);
  for (const row of report.authorConflicts) {
    assert.equal(row.headerId, row.payloadNoteId);
    assert.equal(row.originStage, 'refining');
    assert.deepEqual(row.origin, { stage: 'refining', board: 'board1', seq: row.origin.seq, author: '', createdAt: '' });
    assert.equal(row.fileSha256, sha256(readFileSync(join(tree, row.file))));
    assert.deepEqual(row.payload, snapshot.atoms.find(atom => atom.file === row.snapshotFile).doc.payload);
  }
  const ai = report.duplicateNoteIdOccurrences.find(row => row.noteId === 'f3859a0e-9ede-41a0-b58f-93ae620a7cfc');
  assert.ok(ai.occurrences.some(row => row.file === 'inbox/commandStorming/role-cs-ai-agent-8.yaml'));
  assert.ok(ai.occurrences.some(row => row.file === 'inbox/refining/role-rf-ai-agent-94.yaml'));
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
