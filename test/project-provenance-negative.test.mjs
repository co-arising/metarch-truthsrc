import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAuthorMigration, writeAuthorMigration } from '../lib/author-migrate.mjs';
import { parseDoc } from '../lib/shared.mjs';
import { emitAuthorDoc } from '../lib/author-surface.mjs';
import { createSnapshot, compileSnapshot } from '../lib/compile-snapshot.mjs';
import { buildSourceIndex, resolveSourcePointer } from '../lib/source-index.mjs';
import { projectCli } from '../lib/project/cli.mjs';
import { queryProject, statusProject } from '../lib/project/query.mjs';
import { profileFor } from '../lib/products/registry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value) + '\n');
const aggregateFile = f => join(f.tree, 'contexts/example/aggregates/counter/aggregate.yaml');
async function fixture(t, beforeGenerate = () => {}) {
  const directory = fs.mkdtempSync(join(fs.realpathSync(tmpdir()), 'truthsrc-provenance-negative-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const f = { root: directory, tree: join(directory, 'example'), project: join(directory, 'truthsrc.project.json'), out: join(directory, 'generated') };
  writeAuthorMigration(planAuthorMigration({ treeDir: join(root, 'scaffold/local-project/tree'), system: 'example', context: 'example', name: 'Counter', responsibility: 'Own counter decisions and folds.' }), f.tree);
  const config = readJson(join(root, 'scaffold/local-project/truthsrc.project.json'));
  config.tree = 'example';
  beforeGenerate(f, config);
  writeJson(f.project, config);
  await projectCli('generate-project', ['--project', f.project, '--out', f.out]);
  return f;
}
function withReads(hook, action) {
  const original = fs.readFileSync;
  fs.readFileSync = function (file, ...args) {
    const result = original.call(this, file, ...args);
    return hook(String(file), result) ?? result;
  };
  syncBuiltinESMExports();
  try { return action(); }
  finally { fs.readFileSync = original; syncBuiltinESMExports(); }
}
function receipt(f, name) { return join(f.out, '.truthsrc/' + name + '.json'); }
function replaceEvidence(f, name, value) {
  const file = receipt(f, name);
  writeJson(file, value);
  const ledgerFile = join(f.out, 'truthsrc.ledger.json'), ledger = readJson(ledgerFile);
  ledger.entries.find(row => row.path === '.truthsrc/' + name + '.json').ownership.fingerprint = hash(fs.readFileSync(file));
  writeJson(ledgerFile, ledger);
}
function associate(f, key) {
  const ledgerFile = join(f.out, 'truthsrc.ledger.json'), ledger = readJson(ledgerFile);
  const anchorsFile = join(f.out, 'anchors.json'), anchors = readJson(anchorsFile);
  const location = Object.values(anchors.anchors).flat().find(loc => loc.file.endsWith('Rules.scala'));
  const row = ledger.entries.find(row => row.path === location.file);
  row.knowledgeIds = [...new Set([...(row.knowledgeIds || []), key])];
  anchors.anchors[key] ??= [];
  if (!anchors.anchors[key].some(loc => loc.file === location.file && loc.generator === location.generator)) anchors.anchors[key].push(structuredClone(location));
  writeJson(ledgerFile, ledger); writeJson(anchorsFile, anchors);
  return location;
}
function projectSnapshot(atoms, metadata = {}) {
  const snapshot = createSnapshot(atoms, { inboxDirs: [], aggregateDirs: [], ...metadata });
  const { canonical } = compileSnapshot(snapshot);
  return { canonical, sourceIndex: buildSourceIndex(snapshot, canonical, { system: 'example', context: 'example' }) };
}
function replaceProjection(f, projection) {
  replaceEvidence(f, 'canonical', projection.canonical);
  const inputs = readJson(receipt(f, 'inputs')); inputs.sourceIndex = projection.sourceIndex;
  replaceEvidence(f, 'inputs', inputs);
  const request = readJson(receipt(f, 'request'));
  request.documents.find(doc => doc.id === inputs.canonicalId).value = projection.canonical;
  replaceEvidence(f, 'request', request);
}

test('closing current capture rejects project, document, tree and tool drift after fingerprints', async t => {
  for (const kind of ['project', 'document', 'tree', 'tool', 'tree-file-set']) await t.test(kind, async t => {
    const f = await fixture(t), trigger = join(root, 'package.json');
    let fired = false, treeReads = 0;
    let document;
    if (kind === 'document') {
      document = join(f.root, 'binding.json'); writeJson(document, { schemaVersion: 'test/v1' });
      const config = readJson(f.project); config.documents.push({ id: 'race-binding', file: 'binding.json' }); writeJson(f.project, config);
    }
    const result = withReads((file, bytes) => {
      if (kind === 'tree-file-set') {
        // Hash, validation, then compile: add a file after the compiler already
        // enumerated the root, without changing any captured atom bytes.
        if (file === aggregateFile(f) && ++treeReads === 3) {
          fired = true; fs.writeFileSync(join(f.tree, 'unexpected.yaml'), 'kind: note\n');
        }
      } else if (kind === 'tool' && file === trigger) {
        if (fired) return Buffer.concat([Buffer.from(bytes), Buffer.from(' ')]);
        fired = true;
      } else if (!fired && file === trigger) {
        fired = true;
        if (kind === 'project') fs.appendFileSync(f.project, ' ');
        if (kind === 'document') fs.appendFileSync(document, ' ');
        if (kind === 'tree') fs.writeFileSync(aggregateFile(f), fs.readFileSync(aggregateFile(f), 'utf8').replace('"default": "0"', '"default": "2"'));
      }
    }, () => statusProject(f));
    assert.equal(fired, true);
    assert.equal(result.inputs.state, 'invalid');
    assert.equal(result.synchronized, false);
    if (kind === 'tree-file-set') assert.match(result.inputs.error, /tree file set changed/);
  });
});

test('evidence parser consumes the exact authenticated bytes, not a second file read', async t => {
  const f = await fixture(t), file = receipt(f, 'inputs');
  const original = fs.readFileSync(file, 'utf8');
  const duplicate = Buffer.from(original.trimEnd().slice(0, -1) + ',"canonicalId":"replacement"}');
  const ledgerFile = join(f.out, 'truthsrc.ledger.json'), ledger = readJson(ledgerFile);
  ledger.entries.find(row => row.path === '.truthsrc/inputs.json').ownership.fingerprint = hash(duplicate);
  writeJson(ledgerFile, ledger);
  // Disk still contains valid JSON. Only the captured, authenticated bytes have
  // a duplicate key: reopening the file for parsing would silently accept it.
  const status = withReads(path => path === file ? duplicate : undefined, () => statusProject(f));
  assert.equal(status.evidence.state, 'invalid');
  assert.match(status.evidence.reason, /duplicate object key/);
});

test('every generation receipt is rechecked after status and reverse lookup', async t => {
  const f = await fixture(t);
  const files = ['truthsrc.ledger.json', 'anchors.json', ...['inputs', 'canonical', 'request', 'compiled'].map(name => '.truthsrc/' + name + '.json')];
  const generated = readJson(join(f.out, 'truthsrc.ledger.json')).entries.find(row => row.path.endsWith('Rules.scala')).path;
  for (const path of files) for (const query of [false, true]) {
    const file = join(f.out, path), original = fs.readFileSync(file);
    let replaced = false, reads = 0;
    const result = withReads(observed => {
      if (!replaced && observed === join(f.out, generated) && ++reads === (query ? 2 : 1)) {
        replaced = true; fs.appendFileSync(file, ' ');
      }
    }, () => query ? queryProject({ ...f, file: generated }) : statusProject(f));
    fs.writeFileSync(file, original);
    assert.equal(replaced, true, path);
    const status = query ? result.status : result;
    assert.equal(status.evidence.state, 'invalid', path);
    assert.equal(status.synchronized, false, path);
    if (query) { assert.equal(result.state, 'source-evidence-unavailable'); assert.deepEqual(result.result, []); }
  }
});

test('strict receipt JSON rejects duplicate keys in ledger and anchors too', async t => {
  const f = await fixture(t);
  for (const [path, key, value] of [['truthsrc.ledger.json', 'entries', '[]'], ['anchors.json', 'anchors', '{}']]) {
    const file = join(f.out, path), original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, original.trimEnd().slice(0, -1) + ',' + JSON.stringify(key) + ':' + value + '}');
    const status = statusProject(f);
    assert.equal(status.evidence.state, 'invalid'); assert.match(status.evidence.reason, /duplicate object key/);
    fs.writeFileSync(file, original);
  }
});

test('anchor reconciliation checks missing and extra associations, owners, generators and fingerprints', async t => {
  const f = await fixture(t), ledgerFile = join(f.out, 'truthsrc.ledger.json'), anchorsFile = join(f.out, 'anchors.json');
  const originalLedger = readJson(ledgerFile), originalAnchors = readJson(anchorsFile);
  const changes = {
    empty: (ledger, anchors) => { anchors.anchors = {}; },
    missingKey: (ledger, anchors) => { delete anchors.anchors[Object.keys(anchors.anchors)[0]]; },
    missingLocation: (ledger, anchors) => {
      const key = Object.keys(anchors.anchors).find(key => anchors.anchors[key].length > 1);
      assert.ok(key); anchors.anchors[key].pop();
    },
    extraKey: (ledger, anchors) => { anchors.anchors['invented-source'] = [Object.values(anchors.anchors)[0][0]]; },
    owner: (ledger, anchors) => { ledger.entries.find(row => row.path === Object.values(anchors.anchors)[0][0].file).ownership.id = '/another-project'; },
    generator: (ledger, anchors) => { Object.values(anchors.anchors)[0][0].generator = 'another-generator'; },
    fingerprint: (ledger, anchors) => { Object.values(anchors.anchors)[0][0].fingerprint = 'sha256:' + '0'.repeat(64); },
    duplicateLedger: ledger => { ledger.entries.push(structuredClone(ledger.entries[0])); },
  };
  for (const [name, change] of Object.entries(changes)) {
    const ledger = structuredClone(originalLedger), anchors = structuredClone(originalAnchors);
    change(ledger, anchors); writeJson(ledgerFile, ledger); writeJson(anchorsFile, anchors);
    const result = queryProject({ ...f, knowledge: 'SetCount' });
    assert.equal(result.status.evidence.state, 'invalid', name);
    assert.equal(result.state, 'source-evidence-unavailable', name);
  }
});

test('one anchor key partitions retained and last-generated location provenance', async t => {
  const f = await fixture(t), key = 'source:example-domain#/aggregates/0/commands/0';
  const location = associate(f, key), retainedFile = 'retained-rules.scala';
  fs.copyFileSync(join(f.out, location.file), join(f.out, retainedFile));
  const ledgerFile = join(f.out, 'truthsrc.ledger.json'), ledger = readJson(ledgerFile);
  const row = structuredClone(ledger.entries.find(row => row.path === location.file));
  row.path = retainedFile; row.knowledgeIds = [key]; delete row.noteIds;
  ledger.entries.push(row); writeJson(ledgerFile, ledger);
  const anchorsFile = join(f.out, 'anchors.json'), anchors = readJson(anchorsFile);
  anchors.anchors[key].push({ ...location, file: retainedFile }); writeJson(anchorsFile, anchors);
  const result = queryProject({ ...f, knowledge: key });
  assert.equal(result.status.evidence.state, 'verified');
  assert.equal(result.provenanceScope, 'last-generated-only');
  const group = result.result.find(row => row.knowledge === key);
  assert.equal(group.provenanceScope, 'last-generated-only'); assert.ok(group.origins.length);
  const retained = group.locations.find(loc => loc.file === retainedFile), current = group.locations.find(loc => loc.file === location.file);
  assert.equal(retained.sourceState, 'historical-source-unavailable'); assert.deepEqual(retained.origins, []);
  assert.equal(retained.truthFreshness, 'unknown'); assert.equal(Object.hasOwn(retained, 'snapshot'), false);
  assert.ok(current.origins.length); assert.equal(current.snapshot, group.snapshot);
  const reverse = queryProject({ ...f, file: retainedFile });
  assert.deepEqual(reverse.selection, []);
  assert.ok(reverse.result.every(row => row.sourceState === 'historical-source-unavailable' && !Object.hasOwn(row, 'snapshot') && !row.origins.length));
});

test('surface carry points to authored headers; synthesized containers have no fabricated payload pointer', () => {
  const atoms = [
    { file: 'workshop.yaml', doc: { workshop: 'example', sessionOrder: ['es'] } },
    { file: 'aggregates/a/aggregate.yaml', doc: { kind: 'aggregate', name: 'A', seq: 7, context: 'example', bmExtra: { label: 'board' }, extraFolds: [{ patch: 'stored' }],
      order: { commands: ['Cmd'], events: ['Event'], decisions: ['Cmd'], folds: ['Event'] }, payload: { name: 'A', stateFields: [{ name: 'total', default: '0' }] } } },
    { file: 'aggregates/a/slices/cmd.slice.yaml', doc: { kind: 'slice', command: 'Cmd',
      payload: { name: 'Cmd', guards: [{}], produces: [], events: ['payload-event'] }, decision: { emissions: [{ event: 'Event', bindings: { amount: '1' } }] }, fold: { patch: 'legacy' },
      events: { Event: { name: 'Event', foldAssignments: [{ slot: 'total', expr: '1' }] } } } },
    { file: 'inbox/es/note.yaml', doc: { kind: 'note', id: 'header-id', name: 'Note', origin: { stage: 'es', seq: 9, author: 'Ada' }, payload: { noteId: 'payload-id', name: 'Note' } } },
    ...[['value-objects', 'vo'], ['read-models', 'rm'], ['stories', 'story'], ['domain-services', 'port']].map(([dir, suffix]) =>
      ({ file: `${dir}/named.${suffix}.yaml`, doc: { seq: 3, payload: { name: 'Named' } } })),
  ];
  const { canonical, sourceIndex } = projectSnapshot(atoms, { aggregateDirs: ['a'], inboxDirs: ['es'] });
  const expected = {
    '/aggregates/0/seq': '/seq', '/aggregates/0/context': '/context', '/aggregates/0/bmExtra/label': '/bmExtra/label',
    '/aggregates/0/orderDecisions/0': '/order/decisions/0', '/aggregates/0/orderFolds/0': '/order/folds/0',
    '/aggregates/0/extraFolds/0/patch': '/extraFolds/0/patch', '/aggregates/0/commands/0/decision': '/decision',
    '/aggregates/0/commands/0/fold/patch': '/fold/patch', '/aggregates/0/commands/0/events/0': '/payload/events/0',
    '/aggregates/0/commands/0/emissionBindings/Event/amount': '/decision/emissions/0/bindings/amount',
    '/aggregates/0/events/0/foldAssignments/0/expr': '/events/Event/foldAssignments/0/expr',
    '/noteSurface/es|board1|0/id': '/id', '/noteSurface/es|board1|0/seq': '/origin/seq', '/noteSurface/es|board1|0/author': '/origin/author',
    ...Object.fromEntries(['valueObjects', 'readModels', 'stories', 'domainServices'].map(key => ['/' + key + '/0/seq', '/seq'])),
  };
  const valueAt = (value, pointer) => pointer.split('/').slice(1).reduce((v, key) => v?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], value);
  for (const [pointer, atomPointer] of Object.entries(expected)) {
    const [row] = resolveSourcePointer(sourceIndex, pointer);
    assert.equal(row.atomPointer, atomPointer, pointer);
    assert.deepEqual(valueAt(atoms.find(atom => atom.file === row.file).doc, row.atomPointer), valueAt(canonical, pointer), pointer);
  }
  for (const pointer of ['/aggregates/0/commands', '/aggregates/0/events', '/aggregates/0/eventResidence/Event', '/aggregates/0/commands/0/emissionBindings', '/workshopKey']) {
    const [row] = resolveSourcePointer(sourceIndex, pointer);
    assert.equal(row.relation, 'unresolved', pointer); assert.equal(row.atomPointer, null, pointer);
  }
  const guard = resolveSourcePointer(sourceIndex, '/aggregates/0/commands/0/guards/0')[0];
  assert.equal(guard.identityBasis, 'snapshot-ordinal'); assert.ok(!guard.identity.includes('/undefined'));
});

test('current comparison preserves descendant default suffixes, including older v1 receipts', async t => {
  const f = await fixture(t), knowledge = 'source:example-domain#/aggregates/0/stateFields/0/default';
  for (const legacy of [false, true]) {
    if (legacy) {
      const inputs = readJson(receipt(f, 'inputs')); inputs.sourceIndex.records.forEach(row => { delete row.surface; });
      replaceEvidence(f, 'inputs', inputs);
    }
    const [row] = queryProject({ ...f, knowledge }).selection;
    assert.equal(row.current.state, 'unchanged');
    assert.equal(row.current.pointer, '/aggregates/0/stateFields/0/default');
    assert.equal(row.current.atomPointer, '/payload/stateFields/0/default');
  }
});

test('aggregate reordering uses identity and projection surface rather than absolute index', async t => {
  const f = await fixture(t, f => {
    const counter = parseDoc(fs.readFileSync(aggregateFile(f), 'utf8'));
    counter.seq = 1; fs.writeFileSync(aggregateFile(f), emitAuthorDoc(counter));
    const auxiliary = structuredClone(counter);
    auxiliary.name = auxiliary.payload.name = 'Auxiliary'; auxiliary.payload.entity = 'AuxiliaryEntity'; auxiliary.seq = 0;
    auxiliary.order = { commands: [], events: [] };
    const directory = join(f.tree, 'contexts/example/aggregates/auxiliary'); fs.mkdirSync(directory);
    fs.writeFileSync(join(directory, 'aggregate.yaml'), emitAuthorDoc(auxiliary));
  });
  for (const [file, seq] of [[aggregateFile(f), 0], [join(f.tree, 'contexts/example/aggregates/auxiliary/aggregate.yaml'), 1]]) {
    const doc = parseDoc(fs.readFileSync(file, 'utf8')); doc.seq = seq; fs.writeFileSync(file, emitAuthorDoc(doc));
  }
  const base = queryProject({ ...f, knowledge: 'knowledge:example/example/aggregate/Counter' });
  assert.equal(base.selection.length, 1); assert.equal(base.selection[0].current.pointer, '/aggregates/0');
  assert.notEqual(base.selection[0].current.state, 'ambiguous');
  for (const suffix of ['/context', '/stateFields/0/default']) {
    const row = queryProject({ ...f, knowledge: 'source:example-domain#/aggregates/1' + suffix }).selection[0];
    assert.equal(row.current.state, 'unchanged'); assert.equal(row.current.pointer, '/aggregates/0' + suffix);
  }
});

test('useCase fallback identities are qualified; missing identities are snapshot-local', async t => {
  const f = await fixture(t);
  const projection = projectSnapshot([
    { file: 'workshop.yaml', doc: { name: 'example' } },
    { file: 'use-cases.yaml', doc: { kind: 'use-cases', payload: { useCases: [{ useCase: 'Transfer' }, { useCase: 'Purchase' }, { description: 'unnamed' }] } } },
  ]);
  replaceProjection(f, projection);
  const found = queryProject({ ...f, knowledge: 'Transfer' });
  assert.equal(found.selection.length, 1); assert.equal(found.selection[0].identity, 'knowledge:example/example/use-case/Transfer');
  const unnamed = projection.sourceIndex.records.find(row => row.pointer === '/useCases/useCases/2');
  assert.equal(unnamed.identityBasis, 'snapshot-ordinal'); assert.equal(unnamed.relation, 'ordinal');
  assert.ok(unnamed.identity.startsWith('snapshot:')); assert.ok(!projection.sourceIndex.records.some(row => row.identity.endsWith('/undefined')));
});

test('legacy duplicate aliases and duplicate projections never collapse or select the first', async t => {
  const f = await fixture(t);
  const projection = projectSnapshot([
    { file: 'workshop.yaml', doc: { name: 'example', sessionOrder: ['es', 'es'] } },
    ...['one', 'two'].map((name, seq) => ({ file: `inbox/es/${name}.yaml`, doc: {
      kind: 'note', id: 'duplicate', name, origin: { stage: 'es', seq }, payload: { noteId: 'duplicate', name },
    } })),
  ], { inboxDirs: ['es'] });
  replaceProjection(f, projection);
  const result = queryProject({ ...f, knowledge: 'duplicate' });
  assert.equal(result.state, 'ambiguous'); assert.equal(result.selection.length, 4);
  assert.equal(new Set(result.selection.map(row => row.pointer)).size, 4);
  assert.ok(result.selection.every(row => row.identityBasis === 'legacy-alias'));
});

test('duplicate qualified identities remain ambiguous even when one matches an old pointer', async t => {
  const f = await fixture(t, f => {
    const directory = join(f.tree, 'contexts/example/stories'); fs.mkdirSync(directory, { recursive: true });
    for (const file of ['one', 'two']) fs.writeFileSync(join(directory, file + '.story.yaml'), emitAuthorDoc({ kind: 'story', name: 'DuplicateStory', payload: { name: 'DuplicateStory' } }));
  });
  const result = queryProject({ ...f, knowledge: 'DuplicateStory' });
  assert.equal(result.state, 'ambiguous'); assert.equal(result.selection.length, 2);
  assert.ok(result.selection.every(row => row.current.state === 'ambiguous' && row.current.candidates.length === 2));
});

test('assembly receipts map only the contributing row and preserve descendant suffixes', async t => {
  const f = await fixture(t), inputs = readJson(receipt(f, 'inputs'));
  const schemaVersion = 'truthsrc.saga-binding/v1';
  const documents = [{ id: inputs.canonicalId, schemaVersion: 'truthsrc/v1', value: readJson(receipt(f, 'canonical')) },
    { id: 'left', schemaVersion, value: { schemaVersion, sagas: [{ sagaId: 'One', label: 'left-one' }, { sagaId: 'Two', label: 'left-two' }] } },
    { id: 'right', schemaVersion, value: { schemaVersion, sagas: [{ sagaId: 'Three', label: 'right-three', document: inputs.canonicalId, pointer: '/aggregates/0' }] } }];
  for (const document of documents.slice(1)) {
    const file = join(f.root, document.id + '.json'); writeJson(file, document.value);
    inputs.sources.push({ document: document.id, file, bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)).slice(7) });
  }
  const profile = profileFor('saga-contract', '1');
  const request = { schemaVersion: 'truthsrc.compilation/v1', documents,
    assemblies: [{ id: 'joined', kind: 'saga-bindings-union', sources: ['left', 'right'] }],
    requirements: [{ id: 'saga-contract', version: profile.version, payloadSchemaVersion: profile.payloadSchemaVersion,
      capabilities: profile.capabilities, requires: profile.requires, inputRoles: { canonical: inputs.canonicalId, sagaBinding: 'joined' } }], options: {} };
  // Use the existing request's version rather than inventing a compile API.
  request.schemaVersion = readJson(receipt(f, 'request')).schemaVersion;
  replaceEvidence(f, 'request', request); replaceEvidence(f, 'inputs', inputs);
  const key = 'source:joined#/sagas/2/label'; associate(f, key);
  const result = queryProject({ ...f, knowledge: key });
  assert.equal(result.status.evidence.state, 'verified');
  assert.equal(result.selection.length, 1);
  assert.equal(result.selection[0].file, join(f.root, 'right.json'));
  assert.equal(result.selection[0].atomPointer, '/sagas/0/label');
  assert.equal(result.selection[0].kind, 'technical-binding');
  const row = queryProject({ ...f, knowledge: 'source:joined#/sagas/2' }).selection;
  assert.equal(row.length, 1); assert.equal(row[0].file, join(f.root, 'right.json'));
  assert.ok(row.every(origin => origin.kind === 'technical-binding'));
});

test('raw node keys and arbitrary business document/pointer objects do not manufacture origins', async t => {
  const f = await fixture(t), request = readJson(receipt(f, 'request'));
  request.documents.find(doc => doc.id === 'references').value.layout.businessRecord = {
    document: 'example-domain', pointer: '/aggregates/0/commands/0',
  };
  replaceEvidence(f, 'request', request);
  for (const key of ['source:references#/layout/businessRecord', 'node:example/Counter/SetCount']) {
    associate(f, key);
    const result = queryProject({ ...f, knowledge: key });
    assert.equal(result.status.evidence.state, 'verified'); assert.deepEqual(result.selection, []);
    const exact = result.result.find(row => row.knowledge === key);
    assert.deepEqual(exact.origins, []); assert.equal(exact.sourceState, 'unresolved-derived-source');
  }
});
