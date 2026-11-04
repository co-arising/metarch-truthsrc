// Standalone adapter for BC's metarch.truth.v1 author syntax, NOT its compiler.
// Domain data lives only in the ordinary parsed snapshot/common canonical.
// The legacy carry contains envelopes and authored-field presence, never a second
// copy of aggregates, notes, decisions, folds, catalogs or use cases.
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createSnapshot } from '../compile-snapshot.mjs';
import { parseDoc, emitDoc } from '../shared.mjs';
import { copyImmutableData } from '../immutable-data.mjs';

export const METARCH_COMPAT_VERSION = 'truthsrc.compat.metarch/v1';
const PROFILE = 'metarch.truth.v1/main';
const own = (o, k) => Object.hasOwn(o, k);
const fail = (where, message) => { throw new Error(`metarch compatibility ${where}: ${message}`); };
const object = (v, where) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(where, 'expected object');
  return v;
};
const array = (v, where) => {
  if (!Array.isArray(v)) fail(where, 'expected array');
  return v;
};
const keysOnly = (v, keys, where) => {
  object(v, where);
  for (const k of Object.keys(v)) if (!keys.includes(k)) fail(where, `unsupported structural field ${k}`);
};
const text = (v, where) => {
  if (typeof v !== 'string' || !v) fail(where, 'expected non-empty string');
  return v;
};
const seq = (v, where) => {
  if (!Number.isSafeInteger(v) || v < 0) fail(where, 'expected non-negative safe integer seq (negative/absent seq is unsupported)');
  return v;
};
const unique = (values, where) => {
  if (new Set(values).size !== values.length) fail(where, 'duplicate structural identity/order entry');
};
const same = (a, b, where) => {
  if (!isDeepStrictEqual(a, b)) fail(where, 'conflicting or unrepresentable structural face');
};
const put = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
const read = p => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(p)); }
  catch (e) { fail(p, e.message); }
};

// JSON.parse supplies the grammar/number semantics of BC. The token pass rejects
// duplicate object keys before they can disappear (including escaped aliases).
function json(raw, where) {
  let value;
  try { value = JSON.parse(raw); } catch (e) { fail(where, `invalid JSON: ${e.message}`); }
  const tokens = raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [];
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (tokens[i + 1] === ':') {
      const key = JSON.parse(token), names = stack.at(-1);
      if (names.has(key)) fail(where, `duplicate JSON key ${key}`);
      names.add(key);
    }
  }
  return value;
}
const rawScalar = s => /^-?\d+$/.test(s) ? Number(s) : s;
const authorScalar = (s, where) => s.startsWith('"') ? json(s, where) : rawScalar(s);

/** BC has `payload: {` with indented JSON continuations, and bare names in
 * nested order arrays. JS has `payload:\n  {` and JSON-quoted order arrays.
 * Parse that explicit dialect first; emitDoc/parseDoc are the sole JS transport.
 * BC compiler-significant raw scalars (workshop, aggregate name, command,
 * session/board and nested order entries) retain BC's literal semantics. Other
 * quoted author headers (id, author, createdAt, display name) use JS decoding.
 * This is deliberately not a permissive general YAML reader.
 */
function parseBC(raw, file) {
  const lines = raw.replaceAll('\r\n', '\n').split('\n');
  const doc = {};
  for (let i = 0; i < lines.length;) {
    const line = lines[i++];
    if (line.startsWith('#') || !line.trim()) continue;
    const m = /^([A-Za-z_]\w*): ?(.*)$/.exec(line);
    if (!m) fail(file, `malformed BC line ${i}: ${line}`);
    const [, key, rest] = m;
    if (own(doc, key)) fail(file, `duplicate header ${key}`);
    if (['__proto__', 'constructor', 'prototype'].includes(key)) fail(file, `unsupported header ${key}`);
    let value;
    if (rest === '{' || rest === '[') {
      const body = [rest];
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) body.push(lines[i++]);
      value = json(body.join('\n'), `${file}#${key}`);
    } else if (rest.startsWith('{') || rest.startsWith('[')) {
      value = json(rest, `${file}#${key}`);
    } else if (rest !== '') {
      const literal = ['kind', 'workshop', 'command'].includes(key) || (key === 'name' && doc.kind === 'aggregate');
      value = literal ? rawScalar(rest) : authorScalar(rest, `${file}#${key}`);
    } else {
      const rows = [];
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        if (lines[i].trim()) rows.push(lines[i].slice(2));
        i++;
      }
      if (rows[0]?.startsWith('{') || rows[0]?.startsWith('[')) fail(file, `unsupported JS-style JSON block at ${key}; BC requires ${key}: { or [`);
      if (rows.length && rows.every(r => /^- /.test(r)) && !/^- \w+: /.test(rows[0])) {
        value = rows.map(r => r.slice(2)); // BC scalar lists are literal strings.
      } else if (rows[0]?.startsWith('- ')) {
        // BC policy author syntax; the BC compiler ignores these rows, but we
        // may accept them only when the canonical payload already carries them.
        value = [];
        for (const row of rows) {
          const first = /^- ([A-Za-z_]\w*): (.*)$/.exec(row);
          if (first) value.push({});
          const part = first || /^  ([A-Za-z_]\w*): (.*)$/.exec(row);
          if (!part || !value.length) fail(file, `malformed ${key} object list`);
          const target = value.at(-1), [, k, v] = part;
          if (own(target, k)) fail(file, `duplicate ${key} row key ${k}`);
          put(target, k, authorScalar(v, file));
        }
      } else {
        value = {};
        for (const row of rows) {
          const part = /^([A-Za-z_]\w*): (.*)$/.exec(row);
          if (!part) fail(file, `malformed nested ${key}: ${row}`);
          const [, k, v] = part;
          if (own(value, k)) fail(file, `duplicate ${key}.${k}`);
          if (key === 'order' && /^\[.*\]$/.test(v)) {
            put(value, k, v.slice(1, -1) ? v.slice(1, -1).split(',').map(s => s.trim()) : []);
          } else {
            const literal = key === 'origin' && ['stage', 'board', 'seq'].includes(k);
            put(value, k, literal ? rawScalar(v) : authorScalar(v, file));
          }
        }
      }
    }
    put(doc, key, value);
  }
  return toJS(doc, file);
}

function toJS(doc, file) {
  const scalars = [], blocks = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v !== null && typeof v === 'object') put(blocks, k, v);
    else scalars.push([k, v]);
  }
  const parsed = parseDoc(emitDoc({ scalars, blocks }), file);
  // In particular, legacy JS coerces quoted numeric scalar headers. Never allow
  // that coercion to change an ID silently. Rich JSON payloads are unaffected.
  same(parsed, doc, `${file} (JS parseDoc/emitDoc transport)`);
  return parsed;
}

const CATALOGS = {
  'value-objects': ['.vo.yaml', 'value-object'],
  'read-models': ['.rm.yaml', 'read-model'],
  stories: ['.story.yaml', 'story'],
  policies: ['.policy.yaml', 'policy'],
};
function residence(file) {
  if (file === 'metarch.yaml' || ['governance/artifact-meta.json', 'governance/concerns.json'].includes(file)) return file;
  if (/^inbox\/[^/]+\/[^/]+\.yaml$/.test(file)) return file;
  const prefix = 'contexts/main/';
  if (!file.startsWith(prefix)) fail(file, 'unrecognized file/context (only contexts/main is supported)');
  const f = file.slice(prefix.length);
  if (f === 'use-cases.yaml' || /^aggregates\/[^/]+\/aggregate\.yaml$/.test(f)
    || /^aggregates\/[^/]+\/notes\/[^/]+\.yaml$/.test(f)
    || /^aggregates\/[^/]+\/slices\/[^/]+\.slice\.yaml$/.test(f)) return f;
  for (const [dir, [suffix]] of Object.entries(CATALOGS)) if (f.startsWith(`${dir}/`) && f.split('/').length === 2 && f.endsWith(suffix)) return f;
  fail(file, 'unrecognized file/structural residence');
}
function allowedDirectory(dir) {
  return ['inbox', 'contexts', 'contexts/main', 'contexts/main/aggregates', 'governance', ...Object.keys(CATALOGS).map(d => `contexts/main/${d}`)].includes(dir)
    || /^inbox\/[^/]+$/.test(dir)
    || /^contexts\/main\/aggregates\/[^/]+(?:\/(?:notes|slices))?$/.test(dir);
}
function inventory(treeDir, ignoreOSMetadata) {
  if (!lstatSync(treeDir).isDirectory()) fail(treeDir, 'expected real directory, not a symlink');
  const files = [], dirs = [], ignored = [];
  function walk(relative) {
    for (const e of readdirSync(join(treeDir, relative), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = relative ? `${relative}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!allowedDirectory(file)) fail(file, 'unsupported structural directory');
        dirs.push(file); walk(file);
      } else if (e.isFile()) {
        if (ignoreOSMetadata && e.name === '.DS_Store') ignored.push({ file, reason: 'operating-system-metadata' });
        else { residence(file); files.push(file); }
      } else fail(file, 'symlinks and special files are unsupported');
    }
  }
  walk('');
  return { files, dirs, ignored };
}
const AGG_SURFACE = ['seq', 'context', 'bmExtra', 'orderDecisions', 'orderFolds', 'extraFolds', 'eventResidence'];
const CMD_SURFACE = ['decision', 'fold', 'events'];
const forbid = (o, keys, where) => {
  for (const k of keys) if (own(o, k)) fail(where, `unsupported reserved payload collision ${k}`);
};
const namedSet = (values, where) => {
  array(values, where).forEach(v => text(v, where));
  unique(values, where);
  return values;
};
const sameMembers = (a, b, where) => {
  if (!isDeepStrictEqual([...a].sort(), [...b].sort())) fail(where,
    `missing or unconsumed definition: missing ${JSON.stringify(b.filter(x => !a.includes(x)))}; unconsumed ${JSON.stringify(a.filter(x => !b.includes(x)))}`);
};

// BC takes the first slice fold, then extraFolds. The common canonical preserves
// ALL stored fold blocks. Identical repetitions are safe to project once; no
// differing definition (including key order) may be hidden by first-wins lookup.
function collectFolds(entries, aggregate, redundant = []) {
  const pool = new Map();
  for (const { fold, source } of entries) {
    object(fold, source); text(fold.event, `${source}.event`);
    const previous = pool.get(fold.event);
    if (previous) {
      if (!isDeepStrictEqual(previous.fold, fold)) fail(source,
        `irreducible fold conflict for ${aggregate}.${fold.event} between ${previous.sources[0]} and ${source}; differing stored definitions cannot be discarded`);
      if (JSON.stringify(previous.fold) !== JSON.stringify(fold)) fail(source,
        `irreducible fold key-order conflict for ${aggregate}.${fold.event} between ${previous.sources[0]} and ${source}`);
      previous.sources.push(source);
    } else pool.set(fold.event, { fold, sources: [source] });
  }
  for (const [event, { sources }] of pool) if (sources.length > 1) redundant.push({ aggregate, event, sources });
  return new Map([...pool].map(([event, { fold }]) => [event, fold]));
}

function validateAggregate(A, slices, file, authoredEmissionBindings, redundantFolds) {
  keysOnly(A, ['kind', 'name', 'context', 'seq', 'order', 'payload', 'extraEvents', 'extraFolds', 'bmExtra'], file);
  same(A.kind, 'aggregate', file);
  text(A.name, file); seq(A.seq, file);
  if (own(A, 'context')) same(A.context, 'main', file);
  object(A.payload, file); same(A.payload.name, A.name, file);
  forbid(A.payload, [...AGG_SURFACE, 'commands', 'events'], file);
  keysOnly(A.order, ['commands', 'events', 'decisions', 'folds'], file);
  for (const key of ['commands', 'events', 'decisions', 'folds']) namedSet(own(A.order, key) ? A.order[key] : [], `${file}#order.${key}`);
  const commands = [], events = [], decisions = [], folds = [];
  for (const { doc: s, file: sf } of slices) {
    keysOnly(s, ['kind', 'aggregate', 'command', 'payload', 'events', 'decision', 'fold'], sf);
    same(s.kind, 'slice', sf); same(s.aggregate, A.name, sf);
    text(s.command, sf); object(s.payload, sf); same(s.payload.name, s.command, sf);
    forbid(s.payload, CMD_SURFACE, sf);
    commands.push(s.command);
    for (const [name, e] of Object.entries(object(own(s, 'events') ? s.events : {}, sf))) {
      object(e, sf); same(e.name, name, sf); events.push(name);
    }
    if (own(s, 'decision')) {
      object(s.decision, sf); decisions.push(s.command);
      if (own(s.decision, 'emissions')) {
        const derived = {};
        for (const em of array(s.decision.emissions, sf)) {
          object(em, sf);
          if (em.event && em.bindings) put(derived, em.event, em.bindings);
        }
        if (Object.keys(derived).length && own(s.payload, 'emissionBindings')) same(s.payload.emissionBindings, derived, `${sf}#emissionBindings`);
      }
    }
    if (own(s.payload, 'emissionBindings')) authoredEmissionBindings.push([A.name, s.command]);
    for (const [i, fold] of array(s.fold ?? [], sf).entries()) folds.push({ fold, source: `${sf}#fold[${i}]` });
  }
  for (const e of array(A.extraEvents ?? [], file)) { object(e, file); events.push(text(e.name, file)); }
  for (const [i, fold] of array(A.extraFolds ?? [], file).entries()) folds.push({ fold, source: `${file}#extraFolds[${i}]` });
  const foldPool = collectFolds(folds, A.name, redundantFolds);
  for (const [label, actual] of Object.entries({ commands, events, decisions, folds: [...foldPool.keys()] })) {
    unique(actual, `${file}#${label}`);
    sameMembers(actual, A.order[label] || [], `${file}#order.${label}`);
  }
  if (own(A, 'bmExtra')) {
    object(A.bmExtra, file);
    forbid(A.bmExtra, ['name', 'decisions', 'folds'], `${file}#bmExtra`);
  }
}

/** Read-only, synchronous. Unknown files, extra contexts, lossy pool overwrites,
 * seq collisions and uncarried policy faces fail closed. Strict by default;
 * ignoreOSMetadata admits ONLY regular .DS_Store files and reports each one.
 * The report describes this scoped profile, not whole-toolchain parity.
 */
export function loadMetarchSnapshot(treeDir, options = {}) {
  keysOnly(options, ['ignoreOSMetadata'], 'options');
  const { ignoreOSMetadata = false } = options;
  if (typeof ignoreOSMetadata !== 'boolean') fail('options.ignoreOSMetadata', 'expected boolean');
  const { files, dirs, ignored } = inventory(treeDir, ignoreOSMetadata);
  const required = ['metarch.yaml', 'governance/artifact-meta.json', 'governance/concerns.json', 'contexts/main/use-cases.yaml'];
  for (const file of required) if (!files.includes(file)) fail(file, 'missing required BC file');
  if (!dirs.includes('contexts/main/aggregates')) fail(treeDir, 'missing contexts/main/aggregates');
  const root = parseBC(read(join(treeDir, 'metarch.yaml')), 'metarch.yaml');
  keysOnly(root, ['schemaVersion', 'workshop', 'sessionOrder'], 'metarch.yaml');
  same(root.schemaVersion, 'metarch.truth.v1', 'metarch.yaml#schemaVersion');
  text(root.workshop, 'metarch.yaml#workshop');
  namedSet(root.sessionOrder, 'metarch.yaml#sessionOrder');
  if (!root.sessionOrder.includes('refining')) fail('metarch.yaml', 'BC requires a refining session with a populated scope');
  const artifactMeta = json(read(join(treeDir, 'governance/artifact-meta.json')), 'governance/artifact-meta.json');
  keysOnly(artifactMeta, ['template', 'readmodels', 'stories'], 'artifact-meta');
  object(artifactMeta.template, 'artifact-meta.template');
  for (const key of ['readmodels', 'stories']) {
    keysOnly(artifactMeta[key], ['meta', 'stats'], `artifact-meta.${key}`);
    object(artifactMeta[key].meta, `artifact-meta.${key}.meta`);
  }
  const concerns = json(read(join(treeDir, 'governance/concerns.json')), 'governance/concerns.json');
  object(concerns, 'governance/concerns.json');
  const atoms = [{ file: 'workshop.yaml', doc: toJS({ workshop: root.workshop, sessionOrder: root.sessionOrder }, 'workshop.yaml') }];
  const sources = [{ source: 'metarch.yaml', file: 'workshop.yaml' }];
  for (const source of files) {
    if (required.slice(0, 3).includes(source)) continue;
    const file = residence(source);
    atoms.push({ file, doc: parseBC(read(join(treeDir, source)), source) });
    sources.push({ source, file });
  }
  const aggregateDirs = dirs.filter(d => /^contexts\/main\/aggregates\/[^/]+$/.test(d)).map(d => d.split('/').at(-1));
  const inboxDirs = dirs.filter(d => /^inbox\/[^/]+$/.test(d)).map(d => d.split('/').at(-1));
  const authoredEmissionBindings = [], aggregateNames = [], aggregateSeqs = [], noteSeqs = new Set(), noteIds = new Map();
  const missingContexts = [], redundantFolds = [];
  let noteCount = 0, redundantPolicyFaces = 0, refining = false;
  for (const dir of aggregateDirs) {
    const file = `aggregates/${dir}/aggregate.yaml`, A = atoms.find(a => a.file === file)?.doc;
    if (!A) fail(file, 'missing aggregate');
    validateAggregate(A, atoms.filter(a => a.file.startsWith(`aggregates/${dir}/slices/`)), file, authoredEmissionBindings, redundantFolds);
    if (!own(A, 'context')) missingContexts.push({ file, aggregate: A.name, reason: 'explicit-context-migration-decision-required' });
    aggregateNames.push(A.name); aggregateSeqs.push(A.seq);
  }
  unique(aggregateNames, 'aggregates'); unique(aggregateSeqs, 'aggregate seqs');
  for (const { file, doc } of atoms.slice(1)) {
    if (file.startsWith('inbox/') || file.includes('/notes/') || file.startsWith('policies/')) {
      const policy = file.startsWith('policies/');
      keysOnly(doc, ['id', 'kind', 'type', 'name', 'origin', 'payload', ...(policy ? ['triggers', 'invokes', 'bindings'] : [])], file);
      same(doc.kind, policy ? 'policy' : 'note', file);
      object(doc.payload, file);
      for (const k of ['type', 'name']) if (own(doc, k)) same(doc[k], doc.payload[k], `${file}#${k}`);
      if (policy) {
        same(doc.payload.type, 'policy', file);
        for (const k of ['triggers', 'invokes', 'bindings']) if (own(doc, k)) {
          same(doc[k], doc.payload.info?.[k], `${file}#${k} (common canonical has no independent policy face)`);
          redundantPolicyFaces++;
        }
      }
      keysOnly(doc.origin, ['stage', 'board', 'seq', 'author', 'createdAt'], `${file}#origin`);
      const { stage, board } = doc.origin;
      if (!root.sessionOrder.includes(stage)) fail(file, 'origin.stage absent from sessionOrder');
      for (const part of [stage, board]) if (typeof part !== 'string' || !part || part.includes('|')) fail(file, 'stage/board must be non-empty and contain no |');
      const order = `${stage}|${seq(doc.origin.seq, file)}`;
      if (noteSeqs.has(order)) fail(file, 'duplicate stage seq (BC and JS cross-residence tie order may differ)');
      noteSeqs.add(order); noteCount++;
      if (stage === 'refining') refining = true;
      if (own(doc.payload, 'noteId')) noteIds.set(doc.payload.noteId, (noteIds.get(doc.payload.noteId) || 0) + 1);
    } else if (file === 'use-cases.yaml') {
      keysOnly(doc, ['kind', 'payload'], file); same(doc.kind, 'use-cases', file); object(doc.payload, file);
    } else if (!file.startsWith('aggregates/')) {
      const family = file.split('/')[0];
      keysOnly(doc, ['id', 'kind', 'name', 'seq', 'payload'], file);
      same(doc.kind, CATALOGS[family][1], file);
      seq(doc.seq, file); object(doc.payload, file); forbid(doc.payload, ['seq'], file);
      if (own(doc, 'name')) same(doc.name, doc.payload.name, file);
      // Catalog header IDs are provenance, not an extra business identity.
      // If not already in payload, keep them in the snapshot only; BC's five
      // products (and the JS catalog projection) do not expose these headers.
    }
  }
  for (const family of ['value-objects', 'read-models', 'stories']) unique(atoms.filter(a => a.file.startsWith(`${family}/`)).map(a => a.doc.seq), `${family} seqs`);
  if (!refining) fail(treeDir, 'BC requires a refining session with a populated scope');
  const snapshot = createSnapshot(atoms, { inboxDirs, aggregateDirs });
  const legacy = copyImmutableData({ schemaVersion: METARCH_COMPAT_VERSION, root,
    governance: { artifactMeta, concerns }, authoredEmissionBindings });
  const authorConflicts = atoms.filter(a => ['note', 'policy'].includes(a.doc.kind) &&
    own(a.doc.payload, 'stage') && a.doc.payload.stage !== a.doc.origin.stage).map(a => ({
      code: 'AUTHOR_STAGE_CONFLICT', file: sources.find(s => s.file === a.file).source,
      name: a.doc.name, originStage: a.doc.origin.stage, payloadStage: a.doc.payload.stage,
      disposition: 'preserved-in-compatibility; author migration requires an explicit decision',
    }));
  return Object.freeze({ snapshot, legacy, report: copyImmutableData({ profile: PROFILE,
    files: files.length, atoms: atoms.length, notes: noteCount, authorConflicts,
    duplicateNoteIds: [...noteIds.values()].reduce((n, count) => n + count - 1, 0),
    redundantPolicyFaces, redundantFolds, missingContexts, ignored, sources, unsupported: [],
    limits: ['Single main context; closed file/header vocabulary.',
      'Unique non-negative family seqs; unique note seqs per stage; complete ordered pools.',
      'Identical repeated folds remain authored in all locations; conflicting repeats are errors.',
      'Missing aggregate contexts remain absent; migration requires an explicit context decision.',
      'Independent policy triggers/invokes/bindings are unsupported unless equal to payload.info.',
      'Catalog header provenance remains in the snapshot; not in BC products/common canonical.',
      'Five-object projection only; no claim of full BC generation/toolchain parity.'] }) });
}

const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
/** Faithful five-object projection for the admitted profile. Only envelope data
 * comes from legacy. All business values come from the supplied common canonical.
 * No BC imports, caches, raw snapshot fallbacks, decision derivation or fold
 * synthesis. Unrepresented new structural families are errors, not omissions.
 */
export function projectMetarchProducts(canonical, legacy) {
  const c = structuredClone(copyImmutableData(canonical));
  const l = copyImmutableData(legacy);
  keysOnly(l, ['schemaVersion', 'root', 'governance', 'authoredEmissionBindings'], 'legacy');
  same(l.schemaVersion, METARCH_COMPAT_VERSION, 'legacy.schemaVersion');
  keysOnly(l.root, ['schemaVersion', 'workshop', 'sessionOrder'], 'legacy.root');
  same(l.root.schemaVersion, 'metarch.truth.v1', 'legacy.root.schemaVersion');
  keysOnly(c, ['schemaVersion', 'workshop', 'sessions', 'aggregates', 'valueObjects', 'readModels', 'stories', 'domainServices', 'workshopKey', 'useCases', 'inboxLayout', 'noteSurface', 'noteResidence', 'authoring'], 'canonical');
  same(c.schemaVersion, 'truthsrc/v1', 'canonical.schemaVersion');
  if (own(c, 'authoring')) {
    keysOnly(c.authoring, ['schemaVersion', 'system', 'context', 'files'], 'canonical.authoring');
    same(c.authoring.schemaVersion, 'truthsrc.author/v1', 'canonical.authoring.schemaVersion');
    object(c.authoring.system, 'canonical.authoring.system');
    same(c.authoring.system.schemaVersion, 'truthsrc.author/v1', 'canonical.authoring.system.schemaVersion');
    same(c.authoring.system.compatibility?.metarch, l, 'canonical.authoring.system.compatibility.metarch');
    // Author text is a derived surface, NOT a source of domain values here.
    // In particular, never restore/recompile authoring.files as a fallback.
    delete c.authoring;
  }
  text(c.workshop, 'canonical.workshop');
  if (array(c.domainServices, 'canonical.domainServices').length) fail('canonical.domainServices', 'unsupported BC structural face');
  const authored = array(l.authoredEmissionBindings, 'legacy.authoredEmissionBindings');
  const aggregates = [], behavior = [];
  const seenSeqs = [], names = [];
  for (const a of array(c.aggregates, 'canonical.aggregates')) {
    object(a, 'canonical aggregate'); seq(a.seq, a.name); text(a.name, 'aggregate name');
    seenSeqs.push(a.seq); names.push(a.name);
    if (own(a, 'context')) same(a.context, 'main', a.name);
    const commands = array(a.commands, a.name), events = array(a.events, a.name);
    unique(commands.map(cmd => text(cmd.name, a.name)), a.name);
    unique(events.map(e => text(e.name, a.name)), a.name);
    const byCommand = new Map(commands.map(cmd => [cmd.name, cmd]));
    const decisionOrder = namedSet(own(a, 'orderDecisions') ? a.orderDecisions : [], `${a.name}.orderDecisions`);
    const foldOrder = namedSet(own(a, 'orderFolds') ? a.orderFolds : [], `${a.name}.orderFolds`);
    const decisions = decisionOrder.map(name => {
      const decision = byCommand.get(name)?.decision;
      if (!decision) fail(a.name, `missing stored decision ${name}`);
      return object(decision, `${a.name}.${name}.decision`);
    });
    const foldEntries = commands.flatMap(cmd => array(own(cmd, 'fold') ? cmd.fold : [], `${a.name}.${cmd.name}.fold`)
      .map((fold, i) => ({ fold, source: `${a.name}.${cmd.name}.fold[${i}]` })));
    for (const [i, fold] of array(own(a, 'extraFolds') ? a.extraFolds : [], a.name).entries())
      foldEntries.push({ fold, source: `${a.name}.extraFolds[${i}]` });
    const foldPool = collectFolds(foldEntries, a.name);
    sameMembers(commands.filter(cmd => own(cmd, 'decision')).map(cmd => cmd.name), decisionOrder, `${a.name}.decisions`);
    sameMembers([...foldPool.keys()], foldOrder, `${a.name}.folds`);
    const folds = foldOrder.map(name => foldPool.get(name));
    const payload = omit(a, AGG_SURFACE);
    payload.commands = commands.map(cmd => {
      if (own(cmd, 'events')) same(cmd.events, {}, `${a.name}.${cmd.name}.events (only the empty surface is representable)`);
      const isAuthored = authored.some(([agg, command]) => agg === a.name && command === cmd.name);
      if (!isAuthored && own(cmd, 'emissionBindings')) {
        const derived = {};
        for (const em of array(cmd.decision?.emissions, `${a.name}.${cmd.name}.emissions`)) {
          if (em?.event && em?.bindings) put(derived, em.event, em.bindings);
        }
        same(cmd.emissionBindings, derived, `${a.name}.${cmd.name}.emissionBindings (untracked authored field)`);
      }
      return omit(cmd, [...CMD_SURFACE, ...(isAuthored ? [] : ['emissionBindings'])]);
    });
    // Common canonical already contains the full union event payloads in order.
    aggregates[a.seq] = payload;
    if (a.bmExtra) forbid(a.bmExtra, ['name', 'decisions', 'folds'], `${a.name}.bmExtra`);
    behavior[a.seq] = { name: a.name, decisions, ...(folds.length ? { folds } : {}), ...(a.bmExtra || {}) };
  }
  unique(seenSeqs, 'canonical aggregate seqs'); unique(names, 'canonical aggregate names');
  const catalog = (rows, indexed, where) => {
    array(rows, where); unique(rows.map(r => seq(r.seq, where)), `${where} seqs`);
    const result = [];
    for (const r of [...rows].sort((a, b) => a.seq - b.seq)) {
      const payload = omit(r, ['seq']);
      if (indexed) result[r.seq] = payload; else result.push(payload);
    }
    return result;
  };
  const valueObjects = catalog(c.valueObjects, true, 'valueObjects');
  const readModels = catalog(c.readModels, false, 'readModels');
  const stories = catalog(c.stories, false, 'stories');
  const sessions = array(c.sessions, 'canonical.sessions');
  unique(sessions.map(s => text(s.session, 'session')), 'canonical sessions');
  for (const s of sessions) {
    keysOnly(s, ['session', 'scopes'], s.session);
    for (const scope of array(s.scopes, s.session)) {
      keysOnly(scope, ['scope', 'notes'], s.session); array(scope.notes, s.session);
    }
  }
  const refining = sessions.find(s => s.session === 'refining')?.scopes[0];
  if (!refining) fail('canonical.sessions', 'missing populated refining scope');
  object(c.useCases, 'canonical.useCases');
  refining.fieldModel = { aggregates, valueObjects };
  refining.behaviorModel = { aggregates: behavior };
  refining.flowModel = c.useCases;
  keysOnly(l.governance, ['artifactMeta', 'concerns'], 'legacy.governance');
  const meta = structuredClone(l.governance.artifactMeta);
  keysOnly(meta, ['template', 'readmodels', 'stories'], 'legacy.governance.artifactMeta');
  for (const family of ['readmodels', 'stories']) keysOnly(meta[family], ['meta', 'stats'], `legacy.${family}`);
  return {
    METARCH: { workshop: c.workshop, sessions },
    TEMPLATE: { meta: meta.template, aggregates, valueObjects },
    READMODELS: { meta: meta.readmodels.meta, stats: meta.readmodels.stats, readModels },
    STORIES: { meta: meta.stories.meta, stats: meta.stories.stats, stories },
    CONCERNS: structuredClone(l.governance.concerns),
  };
}
