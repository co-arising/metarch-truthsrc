// Explicit, occurrence-bound compatibility for the seven BC baseline notes.
// payload.stage remains an opaque legacy annotation, NOT a second authoring
// stage. This module validates/selects only: it never migrates, rewrites payloads,
// fabricates provenance, reads disk, or puts capture hashes into the author tree.
import { isDeepStrictEqual } from 'node:util';
import { copyImmutableData } from '../immutable-data.mjs';

export const METARCH_STAGE_POLICY = 'bc-seven-legacy-carrier/v1';

// BC-STAGE-DECISION.md, baseline c612626f51bc5465d7466f122388cc87e6c9ef24.
// source is relative to the captured BC truth/metarch root; file is relative to
// the NEW system root. IDs are aliases, never the occurrence selection key.
export const METARCH_STAGE_RECORDS = copyImmutableData([
  ['contexts/main/aggregates/do-r/notes/command-rf-submit-do-r-findings-288.yaml',
    'command', 'SubmitDoRFindings', 'b3e10d41-34cb-4046-8550-9cff46ea3c1e', 288, 'storyMapping',
    'd805fbb77a790f8e713b9d94750fe7332468e64b6b7de61f031dc562ca70dd4c'],
  ['contexts/main/aggregates/do-r/notes/event-rf-do-r-findings-submitted-289.yaml',
    'event', 'DoRFindingsSubmitted', '889692b6-9138-4e18-8ee0-40af2178be55', 289, 'storyMapping',
    'ea2653051d1066f816879d7574cff9d07a7dc55820aa0d5d1e6b567242ac700a'],
  ['inbox/refining/aggregate-rf-knowledge-patch-247.yaml',
    'aggregate', 'KnowledgePatch', '21d57ca3-9d00-44d2-bf31-c59aa67c8822', 247, 'aggregateDiscovery',
    '242114cea27bbfdb1e78b33c9bcb4d5893a088b2b7649cb3e3380aa8f747b938'],
  ['inbox/refining/aggregate-rf-organization-member-266.yaml',
    'aggregate', 'OrganizationMember', '8d51c927-11de-41ba-9723-d9997c66c084', 266, 'aggregateDiscovery',
    'eccefbc60f9d5a59f4030983354894db86df3f0691a0f4a0ca981e052a1f4169'],
  ['inbox/refining/role-rf-ai-agent-94.yaml',
    'role', 'AI Agent', 'f3859a0e-9ede-41a0-b58f-93ae620a7cfc', 94, 'commandStorming',
    'e270ccfbc3f02f0a8b6a3b324f3ed04daef2eb076d5bdf64a590ad5741824770'],
  ['inbox/refining/role-rf-system-271.yaml',
    'role', 'System', '3135f150-cce8-41f7-866d-6330632b3275', 271, 'storyMapping',
    '2cfa05796e74a1d8454a55921de855a28c14843f1a2622f36f8c2a9c8b4cb14f'],
  ['inbox/refining/role-rf-system-operator-263.yaml',
    'role', 'SystemOperator', '5e61e0bb-136c-4070-8f58-aa9ddd034a3c', 263, 'storyMapping',
    '07613450e1356bbf0da4791c73d91e1a2fdb06c0afd5a1c91fe950bda5f02180'],
].map(([source, type, name, id, seq, payloadStage, sha256]) => ({
  source, file: source.replace(/^inbox\/refining\//, 'inbox/06-aggregate-detail/'),
  type, name, id, seq, originStage: 'refining', payloadStage, sha256,
})));

const fail = (where, message) => { throw new Error(`METARCH_STAGE_POLICY ${where}: ${message}`); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const object = (value, where) => { if (!plain(value)) fail(where, 'expected object'); return value; };
const same = (actual, expected, where, message = 'does not match the fixed seven-occurrence baseline') => {
  if (!isDeepStrictEqual(actual, expected)) fail(where, message);
};
const explicitPolicy = (value, where) => {
  if (value !== METARCH_STAGE_POLICY) fail(where, `explicit policy ${METARCH_STAGE_POLICY} required; unknown or absent policies are not admitted`);
};
const snapshotFile = record => record.source.startsWith('contexts/main/')
  ? record.source.slice('contexts/main/'.length) : record.source;
const origin = record => ({ stage: record.originStage, board: 'board1', seq: record.seq, author: '', createdAt: '' });
const recordsByFile = new Map(METARCH_STAGE_RECORDS.map(record => [record.file, record]));
const mismatch = doc => ['note', 'policy'].includes(doc.kind) && plain(doc.payload)
  && own(doc.payload, 'stage') && doc.payload.stage !== doc.origin?.stage;

function index(rows, key, where) {
  if (!Array.isArray(rows)) fail(where, 'expected array');
  const result = new Map();
  for (const row of rows) {
    object(row, where);
    const value = row[key];
    if (typeof value !== 'string' || !value) fail(where, `nonempty ${key} required`);
    if (result.has(value)) fail(where, `duplicate ${key} occurrence ${value}`);
    result.set(value, row);
  }
  return result;
}

function checkOccurrence(doc, record, where) {
  object(doc, where);
  same(doc.kind, 'note', `${where}.kind`);
  for (const key of ['type', 'name', 'id']) same(doc[key], record[key], `${where}.${key}`);
  if (own(doc, 'context')) same(doc.context, 'main', `${where}.context`);
  // Compare the whole origin: absent blank fields and invented URI/author/time
  // fields are not equivalent to the captured, complete historical origin.
  same(doc.origin, origin(record), `${where}.origin`);
  object(doc.payload, `${where}.payload`);
  for (const key of ['type', 'name']) same(doc.payload[key], record[key], `${where}.payload.${key}`);
  same(doc.payload.noteId, record.id, `${where}.payload.noteId`);
  same(doc.payload.stage, record.payloadStage, `${where}.payload.stage`);
}

/** Select snapshot-local files from ONE native loadMetarchSnapshot result.
 * Capture bytes must match the fixed baseline, and the report must exactly
 * describe those snapshot occurrences. No ID-only selection or partial approval.
 * This is NOT live-capture authentication: the caller must verifyMetarchCapture
 * before admitting/writing a source-bound migration, including at write time.
 */
export function checkMetarchStageImport(loaded, policy) {
  explicitPolicy(policy, 'import.policy');
  const data = copyImmutableData(loaded, 'import', fail);
  object(data, 'import');
  const snapshot = object(data.snapshot, 'import.snapshot');
  const report = object(data.report, 'import.report');
  const capture = object(data.capture, 'import.capture');
  same(snapshot.schemaVersion, 'truthsrc.parsed-snapshot/v1', 'import.snapshot.schemaVersion');
  same(report.profile, 'metarch.truth.v1/main', 'import.report.profile');
  same(capture.schemaVersion, 'truthsrc.metarch-source-capture/v1', 'import.capture.schemaVersion');
  const atoms = index(snapshot.atoms, 'file', 'import.snapshot.atoms');
  const captured = index(capture.files, 'file', 'import.capture.files');
  const sources = index(report.sources, 'source', 'import.report.sources');
  index(report.sources, 'file', 'import.report.sources');
  const conflicts = index(report.authorConflicts, 'file', 'import.report.authorConflicts');
  if (conflicts.size !== METARCH_STAGE_RECORDS.length) fail('import.report.authorConflicts',
    `expected exactly seven physical occurrences, received ${conflicts.size}; missing/eighth conflicts are not admitted`);

  for (const { file, doc } of atoms.values()) {
    object(doc, `import.snapshot.${file}`);
    if (own(doc, 'legacyStageAnnotation')) fail(file, 'raw BC input must not already carry legacyStageAnnotation');
  }
  const selected = [];
  for (const record of METARCH_STAGE_RECORDS) {
    const file = snapshotFile(record), atom = atoms.get(file), evidence = captured.get(record.source);
    const conflict = conflicts.get(record.source);
    if (!atom) fail(record.source, `missing snapshot occurrence ${file}`);
    if (!evidence) fail(record.source, 'missing captured source file');
    if (!conflict) fail(record.source, 'missing physical conflict occurrence; a duplicate ID elsewhere is not a replacement');
    same(sources.get(record.source), { source: record.source, file }, `${record.source}.sourceMapping`);
    checkOccurrence(atom.doc, record, record.source);
    same(evidence.sha256, record.sha256, `${record.source}.sha256`, 'captured raw SHA-256 differs from the approved baseline');
    if (!Number.isSafeInteger(evidence.bytes) || evidence.bytes <= 0) fail(record.source, 'captured file bytes must be a positive safe integer');
    const doc = atom.doc;
    same(conflict, {
      code: 'AUTHOR_STAGE_CONFLICT', file: record.source, snapshotFile: file,
      fileSha256: evidence.sha256, fileBytes: evidence.bytes,
      kind: doc.kind, type: doc.payload.type, name: doc.payload.name,
      headerId: doc.id, payloadNoteId: doc.payload.noteId, origin: doc.origin,
      originStage: doc.origin.stage, payloadStage: doc.payload.stage, payload: doc.payload,
      pointers: { origin: '/origin', originStage: '/origin/stage', payload: '/payload', payloadStage: '/payload/stage',
        headerId: '/id', payloadNoteId: '/payload/noteId' },
      disposition: 'preserved-in-compatibility; author migration requires an explicit decision',
    }, `import.report.authorConflicts[${record.source}]`,
    'report must exactly match snapshot identity, full origin, payload, pointers and captured file evidence');
    selected.push(file);
  }
  const approved = new Set(selected);
  for (const { file, doc } of atoms.values()) if (mismatch(doc) && !approved.has(file))
    fail(file, 'unlisted stage conflict in snapshot; the report cannot omit an eighth occurrence');
  return Object.freeze(selected);
}

/** Validate the WHOLE author set before stripping headers or relaxing the
 * ordinary note stage-equality gate. Entries are physical {file, doc} paths,
 * relative to the system root, NOT context-stripped snapshot paths.
 * Only the seven historical occurrence identities/stage pairs are fixed here;
 * later description/info edits remain authored data, without historical hashes.
 */
export function checkMetarchStageAnnotations(system, atoms) {
  const data = copyImmutableData({ system, atoms }, 'annotations', fail);
  object(data.system, 'annotations.system');
  let enabled = false;
  if (own(data.system, 'compatibility')) {
    const compatibility = object(data.system.compatibility, 'system.compatibility');
    if (own(compatibility, 'metarch')) {
      const metarch = object(compatibility.metarch, 'system.compatibility.metarch');
      if (own(metarch, 'noteStageSemantics')) {
        explicitPolicy(metarch.noteStageSemantics, 'system.compatibility.metarch.noteStageSemantics');
        enabled = true;
      }
    }
  }
  if (enabled) same(data.system.contexts, ['main'], 'system.contexts', 'the seven-occurrence legacy profile requires exactly the main context');
  const entries = index(data.atoms, 'file', 'annotations.atoms'), marked = new Set();
  for (const { file, doc } of entries.values()) {
    object(doc, file);
    const annotated = own(doc, 'legacyStageAnnotation');
    if (annotated) {
      if (!enabled) fail(file, 'legacyStageAnnotation is forbidden without the explicit system noteStageSemantics profile');
      explicitPolicy(doc.legacyStageAnnotation, `${file}.legacyStageAnnotation`);
      const record = recordsByFile.get(file);
      if (!record) fail(file, 'legacyStageAnnotation is restricted to the seven exact physical author files, not another context or ID occurrence');
      checkOccurrence(doc, record, file);
      marked.add(file);
    }
    if (enabled && mismatch(doc) && !annotated) fail(file, 'unannotated payload.stage/origin.stage conflict; all mismatches require an approved occurrence');
  }
  if (enabled) for (const record of METARCH_STAGE_RECORDS) if (!marked.has(record.file))
    fail(record.file, 'missing required legacyStageAnnotation occurrence; all seven markers are required');
}

// A signal ONLY after checkMetarchStageAnnotations has validated the whole set.
// This helper is deliberately not an independent admission or migration API.
export function isMetarchStageCarrier(doc, system) {
  return doc?.legacyStageAnnotation === METARCH_STAGE_POLICY
    && system?.compatibility?.metarch?.noteStageSemantics === METARCH_STAGE_POLICY;
}
