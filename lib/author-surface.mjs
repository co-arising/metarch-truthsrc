import { isDeepStrictEqual } from 'node:util';
import { emitDoc, INBOX_PRODUCTS, STAGE_ORDER } from './shared.mjs';
import { parseAuthorDoc } from './author-parse.mjs';
import { FORMAL_PRODUCT_FAMILIES } from './formal-products-pure.mjs';
import { createSnapshot, compileSnapshot } from './compile-snapshot.mjs';
import { copyImmutableData } from './immutable-data.mjs';
import { validateProvenance, validateSourceRefs } from './author-provenance.mjs';
import { METARCH_STAGE_POLICY, checkMetarchStageAnnotations } from './compat/metarch-stage-policy.mjs';
import { STRUCTURE_VERSION, expandAuthorStructures } from './author-structures.mjs';
import { MICRO_VERSION, expandMicroDocuments } from './author-micro.mjs';

export const AUTHOR_VERSION = 'truthsrc.author/v1';
export const CONTEXT_VERSION = 'truthsrc.context/v1';
const fail = message => { throw new Error('AUTHOR_CONTRACT: ' + message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const exact = (value, keys, label, optional = []) => {
  if (!plain(value) || keys.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => !keys.includes(k) && !optional.includes(k))) fail(label + ': unknown or missing field');
};
const segment = (value, label) => { if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value)) fail(label + ': lowercase identity/path segment required'); };
export function safeAuthorFile(file) {
  if (typeof file !== 'string' || !file || /[\\\x00-\x1f]/.test(file) || file.startsWith('/') || /^[A-Za-z]:/.test(file) || file.split('/').some(p => !p || p === '.' || p === '..')) fail('unsafe file ' + file);
  return file;
}
export function emitAuthorDoc(doc) {
  const scalars = [], nested = {}, objLists = {}, blocks = {};
  const scalar = v => typeof v === 'string' || typeof v === 'number';
  // emitDoc writes nested/list values literally; quote strings that its legacy
  // scalar decoder would otherwise alter. Rich values use a complete JSON block.
  const encoded = v => typeof v === 'string' && (!/^[\w.-]+$/.test(v) || /^-?\d+$/.test(v)) ? JSON.stringify(v) : v;
  const row = v => Object.fromEntries(Object.entries(v).map(([k, v]) => [k, encoded(v)]));
  for (const [key, value] of Object.entries(doc)) {
    if (['origin', 'order', 'bindings'].includes(key) && plain(value) && Object.keys(value).length && Object.values(value).every(v => scalar(v) || Array.isArray(v))) nested[key] = row(value);
    else if (['triggers', 'invokes'].includes(key) && Array.isArray(value) && value.length && value.every(v => plain(v) && Object.keys(v).length && Object.values(v).every(scalar))) objLists[key] = value.map(row);
    else if (value !== null && typeof value === 'object') blocks[key] = value;
    else scalars.push([key, value]);
  }
  return emitDoc({ scalars, nested, objLists, blocks }).replace(/^(\w+): (.*)$/gm, (line, key) =>
    typeof doc[key] === 'string' && /^-?\d+$/.test(doc[key]) ? `${key}: ${JSON.stringify(doc[key])}` : line);
}
const object = (value, label) => { if (!plain(value)) fail(label + ': object required'); };
const text = (value, label) => { if (!nonempty(value)) fail(label + ': nonempty text required'); };
const sequence = (value, label) => { if (!Number.isSafeInteger(value) || value < 0) fail(label + ': nonnegative safe integer seq required'); };
const names = (value, label) => {
  if (!Array.isArray(value) || value.some(v => !nonempty(v)) || new Set(value).size !== value.length) fail(label + ': unique text array required');
};
const same = (actual, expected, label) => { if (!isDeepStrictEqual(actual, expected)) fail(label + ': conflicting structural surface'); };
function checkCompatibility(system, context) {
  if (!Object.hasOwn(system, 'compatibility')) return;
  const compatibility = system.compatibility;
  exact(compatibility, [], 'compatibility', ['workshopKey', 'metarch']);
  if (Object.hasOwn(compatibility, 'workshopKey') && !['name', 'workshop'].includes(compatibility.workshopKey)) fail('compatibility.workshopKey: name or workshop required');
  if (!Object.hasOwn(compatibility, 'metarch')) return;
  const legacy = compatibility.metarch;
  exact(legacy, ['schemaVersion', 'root', 'governance', 'authoredEmissionBindings'], 'compatibility.metarch', ['noteStageSemantics']);
  if (Object.hasOwn(legacy, 'noteStageSemantics') && legacy.noteStageSemantics !== METARCH_STAGE_POLICY) fail('unsupported metarch noteStageSemantics');
  if (legacy.schemaVersion !== 'truthsrc.compat.metarch/v1' || context.id !== 'main') fail('unsupported metarch compatibility version/context');
  exact(legacy.root, ['schemaVersion', 'workshop', 'sessionOrder'], 'compatibility.metarch.root');
  if (legacy.root.schemaVersion !== 'metarch.truth.v1') fail('unsupported metarch root version');
  same(legacy.root.workshop, system.workshop, 'compatibility.metarch.root.workshop');
  same(legacy.root.sessionOrder, system.sessionOrder, 'compatibility.metarch.root.sessionOrder');
  exact(legacy.governance, ['artifactMeta', 'concerns'], 'compatibility.metarch.governance');
  const meta = legacy.governance.artifactMeta;
  exact(meta, ['template', 'readmodels', 'stories'], 'compatibility.metarch.artifactMeta');
  object(meta.template, 'compatibility.metarch.template');
  for (const family of ['readmodels', 'stories']) {
    exact(meta[family], ['meta'], 'compatibility.metarch.' + family, ['stats']);
    object(meta[family].meta, 'compatibility.metarch.' + family + '.meta');
    if (Object.hasOwn(meta[family], 'stats')) object(meta[family].stats, 'compatibility.metarch.' + family + '.stats');
  }
  object(legacy.governance.concerns, 'compatibility.metarch.concerns');
  if (!Array.isArray(legacy.authoredEmissionBindings) || legacy.authoredEmissionBindings.some(pair => !Array.isArray(pair) || pair.length !== 2 || !pair.every(nonempty))) fail('compatibility.metarch.authoredEmissionBindings: aggregate/command text pairs required');
}
export function checkAuthorDeclarations(system, context) {
  exact(system, ['kind', 'schemaVersion', 'id', 'name', 'workshop', 'sessionOrder', 'contexts'], 'system', ['description', 'relationships', 'compatibility', 'provenance', 'authoring']);
  if (system.kind !== 'system' || system.schemaVersion !== AUTHOR_VERSION) fail('unsupported system kind/version');
  segment(system.id, 'system.id');
  if (![system.name, system.workshop].every(nonempty)) fail('system name/workshop required');
  if (!Array.isArray(system.sessionOrder) || !system.sessionOrder.length || new Set(system.sessionOrder).size !== system.sessionOrder.length || system.sessionOrder.some(s => !STAGE_ORDER.includes(s))) fail('invalid sessionOrder');
  if (!Array.isArray(system.contexts) || system.contexts.length !== 1) fail('multiple contexts are not supported by this canonical/profile; no flattening');
  segment(system.contexts[0], 'system.contexts');
  exact(context, ['kind', 'schemaVersion', 'id', 'name', 'responsibility'], 'context', ['description', 'relationships']);
  if (context.kind !== 'context' || context.schemaVersion !== CONTEXT_VERSION || context.id !== system.contexts[0]) fail('context identity/version disagrees with system');
  if (![context.name, context.responsibility].every(nonempty)) fail('context name/responsibility required');
  if (system.relationships !== undefined && (!Array.isArray(system.relationships) || system.relationships.length)) fail('cross-context relationships require an explicitly supported multi-context contract');
  if (context.relationships !== undefined && (!Array.isArray(context.relationships) || context.relationships.length)) fail('cross-context relationships are not supported by this profile');
  for (const value of [system.description, context.description]) if (value !== undefined && !nonempty(value)) fail('description must be text');
  if (Object.hasOwn(system, 'authoring')) {
    exact(system.authoring, [], 'authoring', ['structures', 'micro']);
    if (Object.hasOwn(system.authoring, 'structures') && system.authoring.structures !== STRUCTURE_VERSION) fail('unsupported author structure version');
    if (Object.hasOwn(system.authoring, 'micro') && system.authoring.micro !== MICRO_VERSION) fail('unsupported author micro version');
  }
  checkCompatibility(system, context);
  validateProvenance(system);
  return { system: system.id, context: context.id };
}
const catalogKinds = { 'value-objects': ['.vo.yaml', 'value-object'], 'read-models': ['.rm.yaml', 'read-model'], stories: ['.story.yaml', 'story'], 'domain-services': ['.port.yaml', 'domain-service'], policies: ['.policy.yaml', 'policy'], pipelines: ['.pipeline.yaml', 'pipeline'], scenarios: ['.scenario.yaml', 'scenario'], sagas: ['.saga.yaml', 'saga'] };
export function checkResidence(file, doc, { legacy = false } = {}) {
  safeAuthorFile(file);
  const p = file.split('/');
  if (p[0] === 'inbox') {
    const stage = INBOX_PRODUCTS.find(([dir]) => dir === p[1])?.[1] ?? (legacy && STAGE_ORDER.includes(p[1]) ? p[1] : undefined);
    if (p.length !== 3 || !stage || !p[2].endsWith('.yaml') || doc.kind !== 'note' || doc.origin?.stage !== stage) fail('unknown/mixed inbox residence or stage: ' + file);
  } else if (p[0] === 'aggregates') {
    if (!/^[a-z0-9-]+$/.test(p[1] || '')) fail('invalid aggregate directory: ' + file);
    const expected = p.length === 3 && p[2] === 'aggregate.yaml' ? 'aggregate'
      : p.length === 4 && p[2] === 'slices' && p[3].endsWith('.slice.yaml') ? 'slice'
      : p.length === 4 && p[2] === 'notes' && p[3].endsWith('.yaml') ? 'note' : null;
    if (!expected || doc.kind !== expected) fail('unknown aggregate residence/kind: ' + file);
  } else if (p[0] === 'formal-products') {
    if (p.length !== 3 || !Object.hasOwn(FORMAL_PRODUCT_FAMILIES, p[1]) || !p[2].endsWith('.formal.yaml') || doc.kind !== 'formal-product') fail('unknown formal residence: ' + file);
  } else if (file === 'use-cases.yaml') { if (doc.kind !== 'use-cases') fail('use-cases kind required'); }
  else {
    const type = catalogKinds[p[0]];
    if (p.length !== 2 || !type || !p[1].endsWith(type[0]) || doc.kind !== type[1]) fail('unknown knowledge file: ' + file);
  }
}
// These families project payload only (plus the enumerated surface carries).
// Unknown headers cannot be made legitimate merely by saving their raw bytes.
const atomHeaders = {
  aggregate: [['kind', 'name', 'context', 'order', 'payload'], ['seq', 'bmExtra', 'extraEvents', 'extraFolds']],
  slice: [['kind', 'aggregate', 'command', 'payload'], ['events', 'decision', 'fold']],
  note: [['kind', 'type', 'name', 'origin', 'payload'], ['id']],
  policy: [['kind', 'name', 'origin', 'payload'], ['id', 'type', 'triggers', 'invokes', 'bindings']],
  'value-object': [['kind', 'payload'], ['id', 'name', 'seq']],
  'read-model': [['kind', 'payload'], ['id', 'name', 'seq']],
  story: [['kind', 'payload'], ['id', 'name', 'seq']],
  'domain-service': [['kind', 'payload'], ['id', 'name', 'seq']],
  'use-cases': [['kind', 'payload'], ['name']],
};
const aggregateReserved = ['commands', 'events', 'context', 'seq', 'bmExtra', 'orderDecisions', 'orderFolds', 'extraFolds', 'eventResidence'];
const forbid = (value, keys, label) => {
  for (const key of keys) if (Object.hasOwn(value, key)) fail(label + ': reserved payload collision ' + key);
};
function checkAtom(doc, file, system, context, origins, seqs) {
  const fields = atomHeaders[doc.kind];
  validateSourceRefs(doc, system, file);
  if (Object.hasOwn(doc, 'legacyStageAnnotation') && !['note', 'policy'].includes(doc.kind)) fail(file + ': legacy stage marker is note-only');
  if (fields) exact(doc, fields[0], file, [...fields[1], 'sourceRefs', ...(['note', 'policy'].includes(doc.kind) ? ['legacyStageAnnotation'] : [])]);
  else {
    // Whole-atom products explicitly document scalar extension headers. All of
    // those headers are projected; only their documented rich blocks are legal.
    const blocks = { pipeline: ['steps', 'execution', 'monarch'], scenario: ['script'], saga: ['payload'], 'formal-product': ['payload'] }[doc.kind];
    if (!blocks) fail(file + ': unsupported atom kind');
    for (const [key, value] of Object.entries(doc)) {
      if (blocks.includes(key) || key === 'sourceRefs') continue;
      if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) fail(file + ': unsupported rich header ' + key);
    }
    if (doc.kind === 'pipeline') {
      text(doc.id, file + '.id'); text(doc.name, file + '.name');
      if (!Array.isArray(doc.steps)) fail(file + ': steps array required');
      for (const key of ['execution', 'monarch']) if (Object.hasOwn(doc, key)) object(doc[key], file + '.' + key);
    } else if (doc.kind === 'scenario') {
      text(doc.name, file + '.name'); text(doc.description, file + '.description');
    } else if (doc.kind === 'saga') {
      text(doc.id, file + '.id'); text(doc.name, file + '.name');
      if (!nonempty(doc.version) && !(Number.isSafeInteger(doc.version) && doc.version > 0)) fail(file + ': version text or positive safe integer required');
    }
  }
  if (Object.hasOwn(doc, 'payload') || fields || ['saga', 'formal-product'].includes(doc.kind)) object(doc.payload, file + '.payload');
  if (Object.hasOwn(doc, 'context') && doc.context !== context.id) fail('declaration context conflicts: ' + file);
  for (const key of ['name', 'type', 'aggregate', 'command']) if (Object.hasOwn(doc, key)) text(doc[key], file + '.' + key);
  if (Object.hasOwn(doc, 'id') && !nonempty(doc.id) && !(typeof doc.id === 'number' && Number.isSafeInteger(doc.id))) fail(file + ': scalar id required');
  if (Object.hasOwn(doc, 'seq')) {
    sequence(doc.seq, file);
    const key = JSON.stringify([doc.kind, doc.seq]);
    if (seqs.has(key)) fail(file + ': duplicate family seq');
    seqs.add(key);
  }
  // Catalog ids are documented provenance aliases (not a replacement business
  // id); use-cases.name is a document label. Other projected names must agree.
  if (fields && doc.kind !== 'use-cases' && Object.hasOwn(doc, 'name')) same(doc.name, doc.payload.name, file + '.name');
  if (doc.kind === 'note' || doc.kind === 'policy') {
    exact(doc.origin, ['stage', 'seq'], file + '.origin', ['board', 'author', 'createdAt']);
    if (!system.sessionOrder.includes(doc.origin.stage)) fail(file + ': origin.stage must be explicit in sessionOrder');
    sequence(doc.origin.seq, file + '.origin');
    const board = Object.hasOwn(doc.origin, 'board') ? doc.origin.board : 'board1';
    if (!nonempty(board) || board.includes('|')) fail(file + ': origin.board must be nonempty text without |');
    for (const key of ['author', 'createdAt']) if (Object.hasOwn(doc.origin, key) && typeof doc.origin[key] !== 'string') fail(file + ': origin.' + key + ' must be text');
    const key = JSON.stringify([doc.origin.stage, board, doc.origin.seq]);
    if (origins.has(key)) fail(file + ': duplicate stage/board/seq across note/policy families');
    origins.add(key);
    if (Object.hasOwn(doc, 'type')) same(doc.type, doc.payload.type, file + '.type');
    if (Object.hasOwn(doc.payload, 'stage') && doc.legacyStageAnnotation !== METARCH_STAGE_POLICY) same(doc.payload.stage, doc.origin.stage, file + '.payload.stage');
    if (doc.kind === 'policy') {
      same(doc.payload.type, 'policy', file + '.payload.type');
      for (const key of ['triggers', 'invokes', 'bindings']) if (Object.hasOwn(doc, key)) {
        if (key === 'bindings') object(doc[key], file + '.' + key);
        else if (!Array.isArray(doc[key]) || doc[key].some(row => !plain(row))) fail(file + ': ' + key + ' object array required');
        same(doc[key], doc.payload.info?.[key], file + '.' + key + ' (must be carried by payload.info)');
      }
    }
  } else if (doc.kind === 'aggregate') {
    if (doc.context !== context.id) fail('aggregate requires explicit context matching its directory: ' + file);
    forbid(doc.payload, aggregateReserved, file);
    exact(doc.order, [], file + '.order', ['commands', 'events', 'decisions', 'folds']);
    for (const [key, value] of Object.entries(doc.order)) names(value, file + '.order.' + key);
    for (const key of ['extraEvents', 'extraFolds']) if (Object.hasOwn(doc, key) && (!Array.isArray(doc[key]) || doc[key].some(v => !plain(v)))) fail(file + ': ' + key + ' object array required');
    if (Object.hasOwn(doc, 'bmExtra')) object(doc.bmExtra, file + '.bmExtra');
  } else if (doc.kind === 'slice') {
    same(doc.command, doc.payload.name, file + '.command');
    forbid(doc.payload, ['decision', 'fold', 'events'], file);
    for (const key of ['events', 'decision']) if (Object.hasOwn(doc, key)) object(doc[key], file + '.' + key);
    if (Object.hasOwn(doc, 'fold') && (!Array.isArray(doc.fold) || doc.fold.some(v => !plain(v)))) fail(file + ': fold object array required');
    if (doc.decision && Object.hasOwn(doc.decision, 'emissions')) {
      if (!Array.isArray(doc.decision.emissions)) fail(file + ': decision.emissions array required');
      const derived = new Map();
      for (const em of doc.decision.emissions) if (em?.event && em?.bindings) derived.set(em.event, em.bindings);
      if (derived.size && Object.hasOwn(doc.payload, 'emissionBindings')) same(doc.payload.emissionBindings, Object.fromEntries(derived), file + '.emissionBindings');
    }
  } else if (['value-object', 'read-model', 'story', 'domain-service'].includes(doc.kind)) forbid(doc.payload, ['seq'], file);
  // Only explicit formal reference carriers are context declarations. Never
  // recursively interpret opaque business records with context/kind/id fields.
  if (doc.kind === 'formal-product') {
    const key = { 'artifact-contract': 'artifact', 'host-computation': 'id', 'product-design': 'artifact', 'product-design-decision': 'artifact' }[doc.family];
    const ref = key && doc.payload[key];
    if (plain(ref) && Object.hasOwn(ref, 'context') && ref.context !== context.id) fail('formal context conflicts: ' + file);
  }
}
function checkConsumedAtoms(atoms) {
  for (const { file, doc: aggregate } of atoms.filter(a => a.doc.kind === 'aggregate')) {
    const directory = file.slice(0, file.lastIndexOf('/')), commands = new Set(), events = new Set();
    const addEvent = (name, event, source) => {
      text(name, source + ': event name'); object(event, source + ': event');
      same(event.name, name, source + ': event name');
      if (events.has(name)) fail(source + ': duplicate event definition ' + name);
      events.add(name);
    };
    for (const { file: source, doc } of atoms.filter(a => a.file.startsWith(directory + '/slices/'))) {
      same(doc.aggregate, aggregate.name, source + '.aggregate');
      if (commands.has(doc.command)) fail(source + ': duplicate command definition');
      commands.add(doc.command);
      for (const [name, event] of Object.entries(doc.events || {})) addEvent(name, event, source);
    }
    for (const event of aggregate.extraEvents || []) addEvent(event.name, event, file);
    for (const [key, actual] of [['commands', commands], ['events', events]]) {
      const ordered = aggregate.order[key] || [];
      if (ordered.length !== actual.size || ordered.some(name => !actual.has(name))) fail(file + ': order.' + key + ' has missing or unconsumed definitions');
    }
  }
}
export function checkAuthorDirectory(dir, context, files) {
  const prefix = 'contexts/' + context;
  if (['inbox', 'contexts', prefix].includes(dir)) return;
  const p = dir.split('/');
  if (p.length === 2 && p[0] === 'inbox' && INBOX_PRODUCTS.some(([name]) => name === p[1])) return;
  if (dir.startsWith(prefix + '/')) {
    const local = dir.slice(prefix.length + 1), parts = local.split('/');
    if (['aggregates', 'formal-products', 'structures', ...Object.keys(catalogKinds)].includes(local)) return;
    if (parts.length === 2 && parts[0] === 'formal-products' && Object.hasOwn(FORMAL_PRODUCT_FAMILIES, parts[1])) return;
    if (parts[0] === 'aggregates' && /^[a-z0-9-]+$/.test(parts[1] || '') &&
      (parts.length === 2 || parts.length === 3 && ['notes', 'slices'].includes(parts[2])) &&
      files.has(prefix + '/aggregates/' + parts[1] + '/aggregate.yaml')) return;
  }
  fail('unknown/mixed author directory (including empty directories): ' + dir);
}
export function snapshotFromAuthorEntries(entries, { rootName } = {}) {
  const seen = new Set();
  for (const entry of entries) {
    safeAuthorFile(entry.file);
    const alias = entry.file.normalize('NFC').toLowerCase();
    if (seen.has(alias)) fail('duplicate/alias file ' + entry.file);
    seen.add(alias);
  }
  const systemEntry = entries.find(e => e.file === 'system.yaml');
  if (!systemEntry) fail('system.yaml required');
  const system = parseAuthorDoc(systemEntry.content, systemEntry.file);
  if (!Array.isArray(system.contexts) || system.contexts.length !== 1) fail('multiple or missing contexts are unsupported');
  const contextFile = 'contexts/' + system.contexts[0] + '/context.yaml';
  const contextEntry = entries.find(e => e.file === contextFile);
  if (!contextEntry) fail('context.yaml required');
  const context = parseAuthorDoc(contextEntry.content, contextFile);
  checkAuthorDeclarations(system, context);
  if (rootName !== undefined && rootName !== system.id) fail('system path disagrees with system.id');
  const prefix = 'contexts/' + context.id + '/', physicalFiles = {}, sourceTexts = {}, auxiliary = [], atoms = [], authorAtoms = [];
  const parsedDocs = new Map(entries.filter(entry => ![systemEntry.file, contextFile, 'README.md', 'inbox/README.md', prefix + 'README.md'].includes(entry.file))
    .map(entry => [entry.file, parseAuthorDoc(entry.content, entry.file)]));
  const structured = expandAuthorStructures(parsedDocs, { enabled: system.authoring?.structures === STRUCTURE_VERSION });
  const expansion = expandMicroDocuments(structured.documents, { enabled: system.authoring?.micro === MICRO_VERSION, representationMappings: structured.mappings });
  checkMetarchStageAnnotations(system, expansion.documents);
  const origins = new Set(), seqs = new Set();
  const workshop = { schemaVersion: 'truthsrc/v1', name: system.workshop, sessionOrder: system.sessionOrder };
  if (system.compatibility?.workshopKey === 'workshop') { delete workshop.name; workshop.workshop = system.workshop; }
  atoms.push({ file: 'workshop.yaml', doc: workshop });
  physicalFiles['workshop.yaml'] = 'system.yaml';
  for (const entry of entries) if (['README.md', 'inbox/README.md', prefix + 'README.md'].includes(entry.file)) auxiliary.push(entry);
  const textByFile = new Map(entries.map(entry => [entry.file, entry.content]));
  for (const entry of expansion.documents) {
    const file = entry.file.startsWith('inbox/') ? entry.file : entry.file.startsWith(prefix) ? entry.file.slice(prefix.length) : null;
    if (!file || file.startsWith('inbox/') && entry.file.startsWith(prefix)) fail('file outside declared context/system inbox: ' + entry.file);
    const doc = entry.doc;
    checkResidence(file, doc);
    if (doc.kind === 'aggregate' && doc.context !== context.id) fail('aggregate requires explicit context matching its directory: ' + entry.file);
    checkAtom(doc, entry.file, system, context, origins, seqs);
    const { sourceRefs, legacyStageAnnotation, ...semanticDoc } = doc;
    const representation = expansion.mappings.find(row => row.file === entry.file && row.pointer === '');
    atoms.push({ file, doc: semanticDoc }); authorAtoms.push({ file, doc });
    physicalFiles[file] = representation?.authorFile || entry.file;
    sourceTexts[file] = textByFile.get(physicalFiles[file]);
  }
  const representationMappings = expansion.mappings.map(row => ({ ...row,
    file: row.file.startsWith(prefix) ? row.file.slice(prefix.length) : row.file,
    ...(row.template ? { template: row.template.file + '#' + row.template.pointer } : {}) }));
  checkConsumedAtoms(atoms);
  const aggregateDirs = [...new Set(atoms.filter(a => a.file.startsWith('aggregates/')).map(a => a.file.split('/')[1]))].sort();
  const used = new Set(atoms.filter(a => a.file.startsWith('inbox/')).map(a => a.file.split('/')[1]));
  const inboxDirs = INBOX_PRODUCTS.map(([d]) => d).filter(d => used.has(d));
  const snapshot = createSnapshot(atoms, { fallbackWorkshop: system.workshop, inboxDirs, aggregateDirs });
  return { snapshot, authorAtoms, system, context, physicalFiles, sourceTexts, representationMappings, auxiliary, declarations: [systemEntry, contextEntry] };
}
export function restoreAuthorEntries(canonical) {
  const envelope = canonical.authoring;
  exact(envelope, ['schemaVersion', 'system', 'context', 'files'], 'canonical authoring');
  if (envelope.schemaVersion !== AUTHOR_VERSION) fail('unsupported canonical author surface');
  checkAuthorDeclarations(envelope.system, envelope.context);
  if (!Array.isArray(envelope.files)) fail('author surface files required');
  const entries = envelope.files.map(entry => {
    exact(entry, ['file', 'content'], 'author file');
    if (typeof entry.content !== 'string') fail('author file text required');
    return { ...entry };
  });
  const parsed = snapshotFromAuthorEntries(entries);
  if (JSON.stringify(parsed.system) !== JSON.stringify(envelope.system) || JSON.stringify(parsed.context) !== JSON.stringify(envelope.context)) fail('author declarations disagree');
  const expected = { ...canonical }; delete expected.authoring;
  const projected = compileSnapshot(parsed.snapshot).canonical;
  if (JSON.stringify(expected) !== JSON.stringify(projected)) fail('author surface disagrees with semantic projection');
  return entries;
}
export function compileAuthorEntries(entries, options) {
  const source = snapshotFromAuthorEntries(entries, options), result = compileSnapshot(source.snapshot);
  const canonical = { ...result.canonical, authoring: { schemaVersion: AUTHOR_VERSION, system: source.system, context: source.context, files: entries } };
  return { ...source, canonical: copyImmutableData(canonical), text: JSON.stringify(canonical, null, 2) + '\n' };
}
