import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot } from '../lib/compile-snapshot.mjs';
import { copyImmutableData } from '../lib/immutable-data.mjs';
import * as policy from '../lib/compat/metarch-stage-policy.mjs';

const { METARCH_STAGE_POLICY: PROFILE, METARCH_STAGE_RECORDS: RECORDS,
  checkMetarchStageImport, checkMetarchStageAnnotations, isMetarchStageCarrier } = policy;
const PREFIX = 'contexts/main/';
const OTHER_AI = 'inbox/commandStorming/role-cs-ai-agent-8.yaml';
const OTHER_AI_AUTHOR = 'inbox/02-commands/role-cs-ai-agent-8.yaml';
const localFile = record => record.source.startsWith(PREFIX) ? record.source.slice(PREFIX.length) : record.source;
const sourceFile = file => file === 'workshop.yaml' ? 'metarch.yaml' : file.startsWith('inbox/') ? file : PREFIX + file;
const fullOrigin = record => ({ stage: 'refining', board: 'board1', seq: record.seq, author: '', createdAt: '' });
const docFor = (loaded, record) => loaded.snapshot.atoms.find(atom => atom.file === localFile(record)).doc;
const conflictFor = (loaded, record) => loaded.report.authorConflicts.find(row => row.file === record.source);
const evidenceFor = (loaded, record) => loaded.capture.files.find(row => row.file === record.source);

function note(record) {
  return { id: record.id, kind: 'note', type: record.type, name: record.name, origin: fullOrigin(record),
    payload: { type: record.type, name: record.name, noteId: record.id, stage: record.payloadStage,
      description: `Synthetic ${record.name}`, info: { nested: [null, false, 1.25, '001'], stage: 'opaque business content' } } };
}
function conflict(record, doc, evidence) {
  return { code: 'AUTHOR_STAGE_CONFLICT', file: record.source, snapshotFile: localFile(record),
    fileSha256: evidence.sha256, fileBytes: evidence.bytes,
    kind: doc.kind, type: doc.payload.type, name: doc.payload.name,
    headerId: doc.id, payloadNoteId: doc.payload.noteId, origin: doc.origin,
    originStage: doc.origin.stage, payloadStage: doc.payload.stage, payload: doc.payload,
    pointers: { origin: '/origin', originStage: '/origin/stage', payload: '/payload', payloadStage: '/payload/stage',
      headerId: '/id', payloadNoteId: '/payload/noteId' },
    disposition: 'preserved-in-compatibility; author migration requires an explicit decision' };
}

// Pure synthetic data in the loader's native immutable shape. Hashes are fixture
// evidence, not hashes of these synthetic docs and not an authenticated capture.
// The migration caller separately verifies real captured bytes. No sibling BC
// tree, filesystem, cache, subprocess or environment opt-in is used by this suite.
function loadedFixture() {
  const sessionOrder = ['commandStorming', 'aggregateDiscovery', 'refining', 'storyMapping'];
  const ai = note(RECORDS[4]);
  ai.origin.stage = 'commandStorming'; ai.origin.seq = 8; ai.payload.stage = 'commandStorming';
  const atoms = [
    { file: 'workshop.yaml', doc: { workshop: 'Synthetic stage-policy workshop', sessionOrder } },
    { file: 'aggregates/do-r/aggregate.yaml', doc: { kind: 'aggregate', name: 'DoR', context: 'main',
      seq: 0, order: { commands: [], events: [] }, payload: { name: 'DoR' } } },
    ...RECORDS.map(record => ({ file: localFile(record), doc: note(record) })),
    { file: OTHER_AI, doc: ai },
  ];
  const sources = atoms.map(atom => ({ source: sourceFile(atom.file), file: atom.file }));
  const sourceNames = [...sources.map(row => row.source), 'governance/artifact-meta.json', 'governance/concerns.json'].sort();
  const files = sourceNames.map((file, i) => ({ file, bytes: 100 + i,
    sha256: RECORDS.find(record => record.source === file)?.sha256 ?? '1'.repeat(64) }));
  const capture = copyImmutableData({ schemaVersion: 'truthsrc.metarch-source-capture/v1', root: '/synthetic/bc/truth/metarch',
    ignoreOSMetadata: false, directories: ['contexts', 'contexts/main', 'contexts/main/aggregates',
      'contexts/main/aggregates/do-r', 'contexts/main/aggregates/do-r/notes', 'inbox', 'inbox/commandStorming', 'inbox/refining', 'governance'],
    files, ignored: [], sha256: '2'.repeat(64) });
  const snapshot = createSnapshot(atoms, { inboxDirs: ['commandStorming', 'refining'], aggregateDirs: ['do-r'] });
  const legacy = copyImmutableData({ schemaVersion: 'truthsrc.compat.metarch/v1',
    root: { schemaVersion: 'metarch.truth.v1', workshop: 'Synthetic stage-policy workshop', sessionOrder },
    governance: { artifactMeta: { template: {}, readmodels: { meta: {} }, stories: { meta: {} } }, concerns: {} },
    authoredEmissionBindings: [] });
  const authorConflicts = RECORDS.map(record => conflict(record,
    atoms.find(atom => atom.file === localFile(record)).doc, files.find(row => row.file === record.source)));
  const report = copyImmutableData({ profile: 'metarch.truth.v1/main', files: files.length, atoms: atoms.length, notes: 8,
    sources, authorConflicts, duplicateNoteIds: 1, duplicateNoteIdOccurrences: [{ noteId: RECORDS[4].id,
      disposition: 'ambiguous-legacy-alias', occurrences: [OTHER_AI, localFile(RECORDS[4])].map(file => {
        const doc = atoms.find(atom => atom.file === file).doc, evidence = files.find(row => row.file === sourceFile(file));
        return { file: sourceFile(file), snapshotFile: file, fileSha256: evidence.sha256, fileBytes: evidence.bytes,
          kind: doc.kind, type: doc.type, name: doc.name, headerId: doc.id, payloadNoteId: doc.payload.noteId, origin: doc.origin };
      }) }], redundantPolicyFaces: 0, redundantFolds: [], missingContexts: [], ignored: [], unsupported: [], limits: [] });
  return Object.freeze({ snapshot, legacy, capture, report });
}
function rejectedImport(mutate, expected = /METARCH_STAGE_POLICY/) {
  const loaded = structuredClone(loadedFixture());
  mutate(loaded);
  const before = JSON.stringify(loaded);
  assert.throws(() => checkMetarchStageImport(loaded, PROFILE), expected);
  assert.equal(JSON.stringify(loaded), before, 'rejection must not repair snapshot, evidence or report');
}
function authorFixture() {
  const loaded = loadedFixture();
  const system = { kind: 'system', schemaVersion: 'truthsrc.author/v1', id: 'metarch', name: 'Synthetic Metarch',
    workshop: loaded.legacy.root.workshop, sessionOrder: [...loaded.legacy.root.sessionOrder], contexts: ['main'],
    compatibility: { metarch: { ...structuredClone(loaded.legacy), noteStageSemantics: PROFILE } } };
  const atoms = loaded.snapshot.atoms.filter(atom => atom.file !== 'workshop.yaml').map(atom => {
    const record = RECORDS.find(record => localFile(record) === atom.file), doc = structuredClone(atom.doc);
    if (record) doc.legacyStageAnnotation = PROFILE;
    return { file: record ? record.file : atom.file === OTHER_AI ? OTHER_AI_AUTHOR : PREFIX + atom.file, doc };
  });
  return { system, atoms };
}
const authorDoc = (fixture, record = RECORDS[0]) => fixture.atoms.find(atom => atom.file === record.file).doc;
function rejectedAnnotations(mutate, expected = /METARCH_STAGE_POLICY/) {
  const fixture = authorFixture();
  mutate(fixture);
  const before = JSON.stringify(fixture);
  assert.throws(() => checkMetarchStageAnnotations(fixture.system, fixture.atoms), expected);
  assert.equal(JSON.stringify(fixture), before, 'annotation validation must not repair authored data');
}

// Independent baseline rows catch transcription errors in the exported constants.
const BASELINE = [
  ['command-rf-submit-do-r-findings-288.yaml', 'command', 'SubmitDoRFindings', 'b3e10d41-34cb-4046-8550-9cff46ea3c1e', 288, 'storyMapping', 'd805fbb77a790f8e713b9d94750fe7332468e64b6b7de61f031dc562ca70dd4c'],
  ['event-rf-do-r-findings-submitted-289.yaml', 'event', 'DoRFindingsSubmitted', '889692b6-9138-4e18-8ee0-40af2178be55', 289, 'storyMapping', 'ea2653051d1066f816879d7574cff9d07a7dc55820aa0d5d1e6b567242ac700a'],
  ['aggregate-rf-knowledge-patch-247.yaml', 'aggregate', 'KnowledgePatch', '21d57ca3-9d00-44d2-bf31-c59aa67c8822', 247, 'aggregateDiscovery', '242114cea27bbfdb1e78b33c9bcb4d5893a088b2b7649cb3e3380aa8f747b938'],
  ['aggregate-rf-organization-member-266.yaml', 'aggregate', 'OrganizationMember', '8d51c927-11de-41ba-9723-d9997c66c084', 266, 'aggregateDiscovery', 'eccefbc60f9d5a59f4030983354894db86df3f0691a0f4a0ca981e052a1f4169'],
  ['role-rf-ai-agent-94.yaml', 'role', 'AI Agent', 'f3859a0e-9ede-41a0-b58f-93ae620a7cfc', 94, 'commandStorming', 'e270ccfbc3f02f0a8b6a3b324f3ed04daef2eb076d5bdf64a590ad5741824770'],
  ['role-rf-system-271.yaml', 'role', 'System', '3135f150-cce8-41f7-866d-6330632b3275', 271, 'storyMapping', '2cfa05796e74a1d8454a55921de855a28c14843f1a2622f36f8c2a9c8b4cb14f'],
  ['role-rf-system-operator-263.yaml', 'role', 'SystemOperator', '5e61e0bb-136c-4070-8f58-aa9ddd034a3c', 263, 'storyMapping', '07613450e1356bbf0da4791c73d91e1a2fdb06c0afd5a1c91fe950bda5f02180'],
];

test('the explicit profile and all seven immutable records match the BC decision baseline', () => {
  assert.equal(PROFILE, 'bc-seven-legacy-carrier/v1');
  assert.deepEqual(RECORDS, BASELINE.map(([basename, type, name, id, seq, payloadStage, sha256], i) => ({
    source: (i < 2 ? 'contexts/main/aggregates/do-r/notes/' : 'inbox/refining/') + basename,
    file: (i < 2 ? 'contexts/main/aggregates/do-r/notes/' : 'inbox/06-aggregate-detail/') + basename,
    type, name, id, seq, originStage: 'refining', payloadStage, sha256,
  })));
  assert.ok(Object.isFrozen(RECORDS));
  for (const record of RECORDS) {
    assert.ok(Object.isFrozen(record));
    assert.throws(() => { record.seq++; }, TypeError);
  }
  assert.throws(() => RECORDS.pop(), TypeError);
});

test('native immutable snapshot/report/capture select only the seven snapshot-local paths without mutation', () => {
  const loaded = loadedFixture(), before = JSON.stringify(loaded);
  assert.ok(Object.isFrozen(loaded));
  assert.ok(Object.isFrozen(loaded.snapshot.atoms[2].doc.origin));
  assert.ok(Object.isFrozen(loaded.report.authorConflicts[0].payload.info));
  assert.ok(Object.isFrozen(loaded.capture.files[0]));
  const files = checkMetarchStageImport(loaded, PROFILE);
  assert.deepEqual(files, RECORDS.map(localFile));
  assert.ok(Object.isFrozen(files));
  assert.equal(files.includes(OTHER_AI), false, 'the commandStorming occurrence is NOT selected by its shared ID');
  assert.equal(JSON.stringify(loaded), before);
  assert.equal(loaded.report.authorConflicts.length, 7, 'selection does not erase diagnostics');
});

test('import selection is a bijection, not dependent on report/capture/atom row order', () => {
  const loaded = structuredClone(loadedFixture());
  loaded.snapshot.atoms.reverse(); loaded.report.authorConflicts.reverse();
  loaded.report.sources.reverse(); loaded.capture.files.reverse();
  assert.deepEqual(checkMetarchStageImport(loaded, PROFILE), RECORDS.map(localFile));
});

for (const value of [undefined, null, false, true, '', 'preserve', 'bc-seven-legacy-carrier/v2',
  { stagePolicy: PROFILE }, [PROFILE]]) test(`import requires the exact explicit policy, not flags: ${JSON.stringify(value)}`, () => {
  assert.throws(() => checkMetarchStageImport(loadedFixture(), value), /import.policy.*explicit policy/);
});

for (const record of RECORDS) {
  test(`raw SHA pin rejects capture/report drift together: ${record.name}`, () => {
    rejectedImport(loaded => {
      evidenceFor(loaded, record).sha256 = '0'.repeat(64);
      conflictFor(loaded, record).fileSha256 = '0'.repeat(64);
    }, /sha256.*raw SHA-256/);
  });
  test(`header identity is pinned even if the report agrees: ${record.name}`, () => {
    rejectedImport(loaded => {
      docFor(loaded, record).id = 'changed-header'; conflictFor(loaded, record).headerId = 'changed-header';
    }, /\.id:.*baseline/);
  });
  test(`origin seq is pinned even if the report agrees: ${record.name}`, () => {
    rejectedImport(loaded => {
      docFor(loaded, record).origin.seq++; conflictFor(loaded, record).origin.seq++;
    }, /\.origin:.*baseline/);
  });
}

for (const [label, mutate] of [
  ['hash', row => { row.fileSha256 = '0'.repeat(64); }],
  ['byte count', row => { row.fileBytes++; }],
  ['header ID', row => { row.headerId = 'changed'; }],
  ['payload ID', row => { row.payloadNoteId = 'changed'; }],
  ['snapshot path', row => { row.snapshotFile = OTHER_AI; }],
  ['kind', row => { row.kind = 'policy'; }],
  ['type', row => { row.type = 'event'; }],
  ['name', row => { row.name = 'Replacement'; }],
  ['origin stage', row => { row.originStage = 'storyMapping'; }],
  ['payload stage', row => { row.payloadStage = 'refining'; }],
  ['complete origin', row => { delete row.origin.author; }],
  ['full payload', row => { row.payload.description = 'stale report'; }],
  ['field pointer', row => { row.pointers.payloadStage = '/origin/stage'; }],
  ['diagnostic code', row => { row.code = 'APPROVED'; }],
  ['disposition', row => { row.disposition = 'silently approved'; }],
]) test(`report equality includes ${label}`, () => {
  rejectedImport(loaded => mutate(loaded.report.authorConflicts[0]), /import.report.authorConflicts/);
});

for (const [label, mutate, expected] of [
  ['missing conflict', loaded => { loaded.report.authorConflicts.pop(); }, /exactly seven/],
  ['eighth conflict', loaded => { loaded.report.authorConflicts.push({ ...loaded.report.authorConflicts[0], file: 'inbox/refining/eighth.yaml' }); }, /exactly seven/],
  ['duplicate conflict at unchanged count', loaded => { loaded.report.authorConflicts[6] = structuredClone(loaded.report.authorConflicts[0]); }, /duplicate file/],
  ['same-count physical replacement', loaded => { loaded.report.authorConflicts[6].file = 'inbox/refining/replacement.yaml'; }, /missing physical conflict/],
  ['missing snapshot occurrence', loaded => { loaded.snapshot.atoms = loaded.snapshot.atoms.filter(atom => atom.file !== localFile(RECORDS[0])); }, /missing snapshot/],
  ['duplicate snapshot occurrence', loaded => { loaded.snapshot.atoms.push(structuredClone(loaded.snapshot.atoms[2])); }, /duplicate file/],
  ['missing raw evidence', loaded => { loaded.capture.files = loaded.capture.files.filter(row => row.file !== RECORDS[0].source); }, /missing captured/],
  ['duplicate raw evidence', loaded => { loaded.capture.files.push(structuredClone(evidenceFor(loaded, RECORDS[0]))); }, /duplicate file/],
  ['wrong physical source mapping', loaded => { loaded.report.sources.find(row => row.source === RECORDS[0].source).file = 'aggregates/other/notes/wrong.yaml'; }, /sourceMapping/],
  ['duplicate source mapping', loaded => { loaded.report.sources.push(structuredClone(loaded.report.sources[0])); }, /duplicate source/],
  ['wrong loader profile', loaded => { loaded.report.profile = 'another-profile'; }, /import.report.profile/],
  ['pre-annotated raw input', loaded => { docFor(loaded, RECORDS[0]).legacyStageAnnotation = PROFILE; }, /raw BC input/],
]) test(`import rejects ${label}`, () => rejectedImport(mutate, expected));

test('seven report rows cannot hide an eighth conflicting snapshot note', () => {
  rejectedImport(loaded => {
    const doc = note(RECORDS[4]); doc.origin.seq = 900;
    loaded.snapshot.atoms.push({ file: 'inbox/refining/role-rf-eighth-900.yaml', doc });
  }, /unlisted stage conflict.*eighth/);
});

test('the other AI ID occurrence cannot replace the refining report row or snapshot document', () => {
  rejectedImport(loaded => {
    conflictFor(loaded, RECORDS[4]).file = OTHER_AI;
  }, /missing physical conflict occurrence/);
  rejectedImport(loaded => {
    loaded.snapshot.atoms.find(atom => atom.file === localFile(RECORDS[4])).doc =
      structuredClone(loaded.snapshot.atoms.find(atom => atom.file === OTHER_AI).doc);
  }, /\.origin:.*baseline/);
});

test('author validation admits all seven physical markers and leaves the other AI occurrence unmarked', () => {
  const fixture = authorFixture(), before = JSON.stringify(fixture);
  const frozen = copyImmutableData(fixture);
  assert.equal(checkMetarchStageAnnotations(frozen.system, frozen.atoms), undefined);
  for (const record of RECORDS) assert.equal(isMetarchStageCarrier(authorDoc(fixture, record), fixture.system), true);
  const other = fixture.atoms.find(atom => atom.file === OTHER_AI_AUTHOR).doc;
  assert.equal(other.id, RECORDS[4].id);
  assert.equal(isMetarchStageCarrier(other, fixture.system), false);
  assert.equal(fixture.atoms.filter(atom => Object.hasOwn(atom.doc, 'legacyStageAnnotation')).length, 7);
  assert.equal(JSON.stringify(fixture), before);
  assert.equal(/"(?:sha256|fileSha256|sourceUri|capture)":/.test(before), false, 'no raw hashes or invented provenance in author data');
});

test('description/info edits after migration do not require historical byte hashes', () => {
  const fixture = authorFixture();
  for (const record of RECORDS) {
    const doc = authorDoc(fixture, record);
    doc.payload.description = `New authored description for ${record.name}`;
    doc.payload.info = { revision: 2, stage: 'opaque info, not a second domain stage',
      origin: { uri: 'opaque-business-value' }, values: ['changed', null, false] };
  }
  const before = JSON.stringify(fixture);
  assert.equal(checkMetarchStageAnnotations(fixture.system, fixture.atoms), undefined);
  assert.equal(JSON.stringify(fixture), before, 'payload is neither normalized nor re-keyed');
});

test('without a profile normal coherent notes need no markers and no origin fields are fabricated', () => {
  const system = { contexts: ['main'] };
  const atoms = [{ file: 'inbox/01-event-flow/event-es-new-0.yaml', doc: { kind: 'note', type: 'event', name: 'New',
    origin: { stage: 'eventStorming', seq: 0 }, payload: { type: 'event', name: 'New', stage: 'eventStorming',
      info: { legacyStageAnnotation: 'opaque nested content' } } } }];
  const before = JSON.stringify(atoms);
  assert.equal(checkMetarchStageAnnotations(system, atoms), undefined);
  assert.equal(isMetarchStageCarrier(atoms[0].doc, system), false);
  assert.equal(JSON.stringify(atoms), before);
  atoms[0].doc.legacyStageAnnotation = PROFILE;
  assert.throws(() => checkMetarchStageAnnotations(system, atoms), /forbidden without.*profile/);
});

for (const [label, mutate, expected] of [
  ['absent compatibility', fixture => { delete fixture.system.compatibility; }, /forbidden without/],
  ['absent metarch profile', fixture => { delete fixture.system.compatibility.metarch; }, /forbidden without/],
  ['absent noteStageSemantics', fixture => { delete fixture.system.compatibility.metarch.noteStageSemantics; }, /forbidden without/],
  ['wrong system context', fixture => { fixture.system.contexts = ['other']; }, /system.contexts/],
  ['extra system context', fixture => { fixture.system.contexts.push('other'); }, /system.contexts/],
  ['empty author set', fixture => { fixture.atoms = []; }, /missing required/],
  ['duplicate physical entry', fixture => { fixture.atoms.push(structuredClone(fixture.atoms.find(atom => atom.file === RECORDS[0].file))); }, /duplicate file/],
]) test(`annotations reject ${label}`, () => rejectedAnnotations(mutate, expected));

test('without profile the ordinary author gate retains responsibility for unmarked stage conflicts', () => {
  const fixture = authorFixture();
  delete fixture.system.compatibility;
  fixture.atoms.forEach(atom => { delete atom.doc.legacyStageAnnotation; });
  assert.equal(checkMetarchStageAnnotations(fixture.system, fixture.atoms), undefined);
  assert.ok(fixture.atoms.some(atom => atom.doc.payload?.stage !== atom.doc.origin?.stage));
});

for (const value of [null, false, true, '', 'preserve', 'bc-seven-legacy-carrier/v2', { profile: PROFILE }, [PROFILE]]) {
  test(`system profile is exact, not a truthy flag: ${JSON.stringify(value)}`, () => {
    rejectedAnnotations(fixture => { fixture.system.compatibility.metarch.noteStageSemantics = value; }, /noteStageSemantics.*explicit policy/);
  });
  test(`marker is exact, not a truthy flag: ${JSON.stringify(value)}`, () => {
    rejectedAnnotations(fixture => { authorDoc(fixture).legacyStageAnnotation = value; }, /legacyStageAnnotation.*explicit policy/);
  });
}

for (const record of RECORDS) test(`all seven author markers are required: ${record.name}`, () => {
  rejectedAnnotations(fixture => { delete authorDoc(fixture, record).legacyStageAnnotation; }, /unannotated.*conflict/);
  rejectedAnnotations(fixture => { fixture.atoms = fixture.atoms.filter(atom => atom.file !== record.file); }, /missing required/);
});

for (const [label, mutate, expected] of [
  ['kind', doc => { doc.kind = 'policy'; }, /\.kind/],
  ['aggregate product kind', doc => { doc.kind = 'aggregate'; }, /\.kind/],
  ['header type', doc => { doc.type = 'event'; }, /\.type/],
  ['header name', doc => { doc.name = 'Renamed'; }, /\.name/],
  ['header ID', doc => { doc.id = 'different-header'; }, /\.id/],
  ['payload type', doc => { doc.payload.type = 'event'; }, /payload.type/],
  ['payload name', doc => { doc.payload.name = 'Renamed'; }, /payload.name/],
  ['payload ID', doc => { doc.payload.noteId = 'different-payload'; }, /payload.noteId/],
  ['missing payload ID', doc => { delete doc.payload.noteId; }, /payload.noteId/],
  ['aligned payload stage', doc => { doc.payload.stage = 'refining'; }, /payload.stage/],
  ['missing payload stage', doc => { delete doc.payload.stage; }, /payload.stage/],
  ['origin stage', doc => { doc.origin.stage = 'storyMapping'; }, /\.origin/],
  ['origin board', doc => { doc.origin.board = 'board2'; }, /\.origin/],
  ['origin seq', doc => { doc.origin.seq++; }, /\.origin/],
  ['missing blank author', doc => { delete doc.origin.author; }, /\.origin/],
  ['missing blank creation time', doc => { delete doc.origin.createdAt; }, /\.origin/],
  ['invented author', doc => { doc.origin.author = 'retroactive owner'; }, /\.origin/],
  ['invented creation time', doc => { doc.origin.createdAt = '2026-11-05'; }, /\.origin/],
  ['invented source URI', doc => { doc.origin.uri = 'truthsrc://metarch/fabricated-origin'; }, /\.origin/],
  ['new-style origin instead of captured origin', doc => { doc.origin = { uri: 'truthsrc://metarch/new-origin' }; }, /\.origin/],
  ['explicit wrong context', doc => { doc.context = 'other'; }, /\.context/],
]) test(`author marker cannot excuse changed ${label}`, () => {
  rejectedAnnotations(fixture => mutate(authorDoc(fixture)), expected);
  rejectedImport(loaded => mutate(docFor(loaded, RECORDS[0])), expected);
});

for (const [label, file] of [
  ['context-stripped snapshot path', localFile(RECORDS[0])],
  ['different context', RECORDS[0].file.replace('/main/', '/other/')],
  ['old inbox layout', RECORDS[2].source],
  ['invented URI', 'truthsrc://metarch/notes/approved'],
  ['path alias', 'contexts/main/aggregates/do-r/notes/../notes/command-rf-submit-do-r-findings-288.yaml'],
]) test(`markers require exact physical author residence, not ${label}`, () => {
  rejectedAnnotations(fixture => { fixture.atoms.find(atom => atom.file === RECORDS[0].file).file = file; }, /exact physical author files/);
});

test('the other AI occurrence cannot acquire a marker or substitute for the refining occurrence', () => {
  rejectedAnnotations(fixture => {
    fixture.atoms.find(atom => atom.file === OTHER_AI_AUTHOR).doc.legacyStageAnnotation = PROFILE;
  }, /exact physical author files/);
  rejectedAnnotations(fixture => {
    const other = fixture.atoms.find(atom => atom.file === OTHER_AI_AUTHOR).doc;
    fixture.atoms.find(atom => atom.file === RECORDS[4].file).doc = { ...structuredClone(other), legacyStageAnnotation: PROFILE };
  }, /\.origin/);
});

test('new notes remain unmarked: neither an eighth mismatch nor a copied legacy identity is approved', () => {
  const fixture = authorFixture();
  const extra = { file: 'inbox/06-aggregate-detail/question-rf-new-900.yaml', doc: { kind: 'note', type: 'question', name: 'New question',
    origin: { stage: 'refining', seq: 900 }, payload: { type: 'question', name: 'New question', stage: 'refining' } } };
  fixture.atoms.push(extra);
  const before = JSON.stringify(fixture);
  assert.equal(checkMetarchStageAnnotations(fixture.system, fixture.atoms), undefined);
  assert.equal(JSON.stringify(fixture), before, 'no legacy origin/URI is manufactured for new knowledge');
  extra.doc.payload.stage = 'storyMapping';
  assert.throws(() => checkMetarchStageAnnotations(fixture.system, fixture.atoms), /unannotated.*conflict/);
  extra.doc.legacyStageAnnotation = PROFILE;
  assert.throws(() => checkMetarchStageAnnotations(fixture.system, fixture.atoms), /exact physical author files/);
  extra.doc = structuredClone(authorDoc(fixture));
  assert.throws(() => checkMetarchStageAnnotations(fixture.system, fixture.atoms), /exact physical author files/);
});

test('carrier helper only signals marker/profile; whole-set validation must precede the stage gate', () => {
  const fixture = authorFixture(), doc = authorDoc(fixture);
  assert.equal(isMetarchStageCarrier(doc, {}), false);
  assert.equal(isMetarchStageCarrier({}, fixture.system), false);
  assert.equal(isMetarchStageCarrier(undefined, undefined), false);
  doc.id = 'forged-but-marked';
  assert.equal(isMetarchStageCarrier(doc, fixture.system), true, 'the signal is not standalone admission');
  assert.throws(() => checkMetarchStageAnnotations(fixture.system, fixture.atoms), /\.id/);
});

test('validators reject accessor data without invoking it', () => {
  const loaded = structuredClone(loadedFixture());
  let calls = 0;
  Object.defineProperty(loaded.report, 'authorConflicts', { enumerable: true, get() { calls++; return []; } });
  assert.throws(() => checkMetarchStageImport(loaded, PROFILE), /enumerable data properties/);
  const fixture = authorFixture();
  Object.defineProperty(authorDoc(fixture), 'legacyStageAnnotation', { enumerable: true, get() { calls++; return PROFILE; } });
  assert.throws(() => checkMetarchStageAnnotations(fixture.system, fixture.atoms), /enumerable data properties/);
  assert.equal(calls, 0);
});

test('policy exports only constants, validators and a signal, never an automatic migration or URI factory', () => {
  assert.deepEqual(Object.keys(policy).sort(), ['METARCH_STAGE_POLICY', 'METARCH_STAGE_RECORDS',
    'checkMetarchStageImport', 'checkMetarchStageAnnotations', 'isMetarchStageCarrier'].sort());
  const loaded = loadedFixture();
  checkMetarchStageImport(loaded, PROFILE);
  for (const record of RECORDS) {
    assert.equal(Object.hasOwn(docFor(loaded, record), 'legacyStageAnnotation'), false);
    assert.deepEqual(docFor(loaded, record).origin, fullOrigin(record));
  }
});
