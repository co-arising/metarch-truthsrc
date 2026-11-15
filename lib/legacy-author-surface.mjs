import { parseDoc, STAGE_ORDER, INBOX_PRODUCTS } from './shared.mjs';
import { parseAuthorDoc } from './author-parse.mjs';
import { safeAuthorFile, checkResidence, checkConsumedAtoms, checkAggregateOrder, checkPolicySurface, checkSliceEmissionBindings } from './author-surface.mjs';
import { createSnapshot, compileSnapshot } from './compile-snapshot.mjs';
import { copyImmutableData } from './immutable-data.mjs';
import { validateSnapshot } from './validate.mjs';

export const LEGACY_SURFACE_VERSION = 'truthsrc.legacy-author/v1';
export const LEGACY_SURFACE_MAX_BYTES = 8 * 1024 * 1024;
const fail = message => { throw new Error('LEGACY_SURFACE: ' + message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys, label) => {
  if (!object(value) || keys.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !keys.includes(key))) fail(label + ': unknown or missing field');
};
const headers = {
  note: ['kind', 'id', 'type', 'name', 'origin', 'payload'],
  policy: ['kind', 'id', 'type', 'name', 'origin', 'triggers', 'invokes', 'bindings', 'payload'],
  aggregate: ['kind', 'name', 'seq', 'context', 'order', 'payload', 'bmExtra', 'extraEvents', 'extraFolds'],
  slice: ['kind', 'aggregate', 'command', 'payload', 'events', 'decision', 'fold'],
  'value-object': ['kind', 'id', 'name', 'seq', 'payload'],
  'read-model': ['kind', 'id', 'name', 'seq', 'payload'],
  story: ['kind', 'id', 'name', 'seq', 'payload'],
  'domain-service': ['kind', 'id', 'name', 'seq', 'payload'],
  'use-cases': ['kind', 'name', 'payload'],
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function checkHeaders(doc, file) {
  const allowed = file === 'workshop.yaml' ? ['schemaVersion', 'name', 'workshop', 'sessionOrder'] : headers[doc.kind];
  if (allowed) {
    for (const key of Object.keys(doc)) if (!allowed.includes(key)) fail(file + ': unsupported header ' + key);
  } else {
    const blocks = { pipeline: ['steps', 'execution', 'monarch'], scenario: ['script'], saga: ['payload'], 'formal-product': ['payload'] }[doc.kind];
    if (!blocks) fail(file + ': unsupported kind');
    for (const [key, value] of Object.entries(doc)) if (!blocks.includes(key) && typeof value !== 'string' && typeof value !== 'number') fail(file + ': unsupported block ' + key);
  }
  if (doc.kind !== 'use-cases' && object(doc.payload) && doc.name !== undefined && doc.payload.name !== undefined && doc.name !== doc.payload.name) fail(file + ': conflicting name');
  if (doc.origin) {
    for (const key of Object.keys(doc.origin)) if (!['stage', 'board', 'seq', 'author', 'createdAt'].includes(key)) fail(file + ': unsupported origin field ' + key);
  }
  if (Object.hasOwn(doc, 'order')) checkAggregateOrder(doc.order, file);
  if (doc.kind === 'policy') checkPolicySurface(doc, file);
  if (doc.kind === 'slice') checkSliceEmissionBindings(doc, file);
  const reserved = doc.kind === 'aggregate'
    ? ['commands', 'events', 'context', 'seq', 'bmExtra', 'orderDecisions', 'orderFolds', 'extraFolds', 'eventResidence']
    : doc.kind === 'slice' ? ['decision', 'fold', 'events']
      : ['value-object', 'read-model', 'story', 'domain-service'].includes(doc.kind) ? ['seq'] : [];
  for (const key of reserved) if (Object.hasOwn(doc.payload || {}, key)) fail(file + ': reserved payload field ' + key);
}

function snapshotFromEntries(files) {
  if (!Array.isArray(files) || !files.length) fail('files required');
  const paths = new Map(), docs = new Map();
  let bytes = 0;
  for (const entry of files) {
    exact(entry, ['file', 'content'], 'file');
    safeAuthorFile(entry.file);
    if (typeof entry.content !== 'string') fail(entry.file + ': text required');
    bytes += Buffer.byteLength(entry.file, 'utf8') + Buffer.byteLength(entry.content, 'utf8');
    if (bytes > LEGACY_SURFACE_MAX_BYTES) fail('surface exceeds 8 MiB');
    const segments = entry.file.split('/');
    if (segments.length > 4) fail('unsupported residence depth');
    for (let i = 1; i <= segments.length; i++) {
      const path = segments.slice(0, i).join('/'), alias = path.normalize('NFC').toLowerCase();
      if (paths.has(alias) && paths.get(alias) !== path) fail('path alias ' + path);
      paths.set(alias, path);
    }
    if (docs.has(entry.file)) fail('duplicate file ' + entry.file);
    // Audit duplicate keys without changing legacy quoted-number semantics.
    parseAuthorDoc(entry.content, entry.file);
    const doc = parseDoc(entry.content, entry.file);
    checkHeaders(doc, entry.file);
    if (entry.file !== 'workshop.yaml') checkResidence(entry.file, doc, { legacy: true });
    docs.set(entry.file, doc);
  }
  const root = docs.get('workshop.yaml');
  if (!root || typeof (root.name || root.workshop) !== 'string' || !(root.name || root.workshop).trim()) fail('explicit workshop name required');
  if (Object.hasOwn(root, 'name') && Object.hasOwn(root, 'workshop')) fail('ambiguous workshop identity');
  if (root.sessionOrder !== undefined && (!Array.isArray(root.sessionOrder) ||
      root.sessionOrder.some(stage => !STAGE_ORDER.includes(stage)) || new Set(root.sessionOrder).size !== root.sessionOrder.length)) fail('session order must contain unique supported stages');
  const stages = root.sessionOrder?.length ? root.sessionOrder : STAGE_ORDER;
  for (const [file, doc] of docs) if (doc.origin && !stages.includes(doc.origin.stage)) fail(file + ': unconsumed workshop stage');
  const inboxDirs = [...STAGE_ORDER, ...INBOX_PRODUCTS.map(([dir]) => dir)]
    .filter(dir => [...docs.keys()].some(file => file.startsWith('inbox/' + dir + '/')));
  const aggregateDirs = [...new Set([...docs.keys()].filter(file => file.startsWith('aggregates/')).map(file => file.split('/')[1]))].sort();
  const atoms = [{ file: 'workshop.yaml', doc: root }];
  const directory = (dir, suffix = '.yaml') => {
    for (const file of [...docs.keys()].filter(file => file.slice(0, file.lastIndexOf('/')) === dir && file.endsWith(suffix)).sort()) atoms.push({ file, doc: docs.get(file) });
  };
  for (const dir of inboxDirs) directory('inbox/' + dir);
  for (const dir of aggregateDirs) directory('aggregates/' + dir + '/notes');
  directory('policies', '.policy.yaml');
  for (const dir of aggregateDirs) {
    const file = 'aggregates/' + dir + '/aggregate.yaml';
    if (!docs.has(file)) fail('missing aggregate ' + file);
    atoms.push({ file, doc: docs.get(file) });
    directory('aggregates/' + dir + '/slices', '.slice.yaml');
  }
  for (const dir of ['value-objects', 'read-models', 'stories', 'domain-services']) directory(dir);
  if (docs.has('use-cases.yaml')) atoms.push({ file: 'use-cases.yaml', doc: docs.get('use-cases.yaml') });
  for (const dir of ['pipelines', 'scenarios', 'sagas']) directory(dir);
  for (const dir of [...new Set([...docs.keys()].filter(file => file.startsWith('formal-products/')).map(file => file.split('/')[1]))].sort()) directory('formal-products/' + dir);
  if (atoms.length !== files.length) fail('unconsumed files');
  const snapshot = createSnapshot(atoms, { fallbackWorkshop: root.name || root.workshop, inboxDirs, aggregateDirs });
  checkConsumedAtoms(snapshot.atoms);
  const validation = validateSnapshot(snapshot);
  if (validation.hard.length) fail(validation.hard.join('; '));
  return snapshot;
}

export function carryLegacySurface(result, snapshot, files, regenerated) {
  const original = new Map(files.map(entry => [entry.file, entry.content]));
  if (regenerated.length === files.length && regenerated.every(entry => original.get(entry.file) === entry.content)) return result;
  if (!original.has('workshop.yaml') || validateSnapshot(snapshot).hard.length) return result;
  const root = snapshot.atoms.find(atom => atom.file === 'workshop.yaml').doc;
  if (!(root.name || root.workshop)) return result;
  const ordered = [...files].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  const projected = compileSnapshot(snapshotFromEntries(ordered)).canonical;
  if (!same(projected, result.canonical)) fail('captured source disagrees with semantic projection');
  const canonical = copyImmutableData({ ...result.canonical,
    legacyAuthoring: { schemaVersion: LEGACY_SURFACE_VERSION, files: ordered } });
  return Object.freeze({ ...result, canonical, text: JSON.stringify(canonical, null, 2) + '\n' });
}

export function restoreLegacyEntries(canonical) {
  if (Object.hasOwn(canonical, 'authoring')) fail('mixed author surfaces');
  const envelope = canonical.legacyAuthoring;
  exact(envelope, ['schemaVersion', 'files'], 'legacy authoring');
  if (envelope.schemaVersion !== LEGACY_SURFACE_VERSION) fail('unsupported surface version');
  const snapshot = snapshotFromEntries(envelope.files);
  const expected = { ...canonical };
  delete expected.legacyAuthoring;
  if (!same(compileSnapshot(snapshot).canonical, expected)) fail('source surface disagrees with semantic projection');
  return envelope.files.map(entry => ({ ...entry }));
}
