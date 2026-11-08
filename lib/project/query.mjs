import { readFileSync, existsSync } from 'node:fs';
import { dirname, relative, isAbsolute, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { captureProductJson } from '../products/cli.mjs';
import { captureProject, localPath, treeEvidence, toolEvidence, assertUnchanged } from './cli.mjs';
import { describeImplementationSources } from './implementation-evidence.mjs';
import { compileTreeWithSources } from '../compile.mjs';
import { validateTree } from '../validate.mjs';
import { resolveSourcePointer, resolveRecordSource, validateSourceIndex, snapshotDigest } from '../source-index.mjs';
import { readAnchorsIndex } from '../../src/core/anchors.mjs';
import { parseStrictJson } from '../strict-json.mjs';
import * as requestHelpers from '../products/request.mjs';
import { assembleDocuments } from '../products/assemblies.mjs';
import { generatedFingerprint } from '../../src/core/apply-preflight.mjs';
import { relatedNarrativeSources } from './narrative-links.mjs';
import { projectGraphFile } from './graph.mjs';
import { SqliteKnowledgeGraphStore } from '../knowledge-sqlite.mjs';

const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const sourceKey = source => [source.role ?? source.document, source.file ?? source.root].join(':');
// Projection addresses distinguish duplicate aliases and separate surfaces of
// one declaration. Deduplication must not erase two actual source occurrences.
const rowKey = row => JSON.stringify([row.identity, row.file, row.atomPointer, row.pointer]);
const unique = rows => [...new Map(rows.map(row => [rowKey(row), row])).values()];
const inside = (root, path) => { const p = relative(root, path); return p === '' || !isAbsolute(p) && p !== '..' && !p.startsWith('..' + sep); };

function currentCapture(project) {
  const captured = captureProductJson(project), config = captured.value, tree = localPath(dirname(project), config.tree);
  if (config.generator === 'scala-cqrs-module-seams-v1') {
    const current = captureProject(project, { roundtripCheck: false });
    assertUnchanged(current);
    return current;
  }
  const sources = [{ role: 'project', file: project, bytes: captured.bytes, sha256: captured.sha256 }, ...treeEvidence(tree)];
  for (const doc of config.documents || []) {
    const input = captureProductJson(localPath(dirname(project), doc.file));
    sources.push({ document: doc.id, file: input.file, bytes: input.bytes, sha256: input.sha256 });
  }
  sources.push(toolEvidence());
  const checked = validateTree(tree);
  if (checked.hard.length) throw new Error('current author validation failed: ' + checked.hard.join('; '));
  const compiled = compileTreeWithSources(tree, { context: config.context });
  if (compiled.context && compiled.context.id !== config.context) throw new Error('current project context disagrees with author declaration');
  const result = { config, tree, sources, canonical: compiled.canonical, sourceIndex: compiled.sourceIndex };
  // Validation/compilation read the tree independently of the fingerprints.
  // Never call those bytes current without closing the entire input capture.
  assertUnchanged(result);
  return result;
}
function priorCapture(project, out) {
  const ledgerFile = localPath(out, 'truthsrc.ledger.json');
  if (!existsSync(ledgerFile)) return { state: 'missing', reason: 'no generation ledger' };
  const receipts = new Map();
  const read = file => { const bytes = readFileSync(file); receipts.set(file, bytes); return bytes; };
  const ledger = parseStrictJson(read(ledgerFile));
  if (!Array.isArray(ledger.entries) || new Set(ledger.entries.map(row => row.path)).size !== ledger.entries.length)
    return { state: 'invalid', reason: 'missing or duplicate ownership ledger paths' };
  const rows = new Map(ledger.entries.map(row => [row.path, row])), values = new Map();
  for (const name of ['inputs', 'canonical', 'request', 'compiled']) {
    const path = '.truthsrc/' + name + '.json', file = localPath(out, path);
    if (!existsSync(file)) return { state: 'missing', reason: 'missing evidence ' + path };
    const content = read(file), row = rows.get(path);
    if (!row?.ownership || row.ownership.id !== project || !row.ownership.generator || row.ownership.fingerprint !== hash(content))
      return { state: 'invalid', reason: 'unverified or changed evidence ' + path };
    // Parse precisely the authenticated bytes, never reopen for JSON parsing.
    values.set(name, parseStrictJson(content));
  }
  const inputs = values.get('inputs'), canonical = values.get('canonical');
  if (!['truthsrc.source-index/v1', 'truthsrc.source-index/v2'].includes(inputs.sourceIndex?.schemaVersion) || inputs.sourceIndex.snapshot !== snapshotDigest(canonical)
    || !Array.isArray(inputs.sourceIndex.records) || !Array.isArray(inputs.sources) || !Array.isArray(inputs.generatedFiles))
    return { state: 'invalid', reason: 'missing or inconsistent source index' };
  validateSourceIndex(inputs.sourceIndex);
  for (const file of inputs.generatedFiles) if (rows.get(file)?.ownership?.id !== project)
    return { state: 'invalid', reason: 'generated membership has no project ownership' };
  const anchorsFile = localPath(out, 'anchors.json');
  if (!existsSync(anchorsFile)) return { state: 'missing', reason: 'missing anchor index' };
  let anchors = readAnchorsIndex(parseStrictJson(read(anchorsFile)));
  if (inputs.graph) {
    const store = new SqliteKnowledgeGraphStore(localPath(process.cwd(), projectGraphFile(project)), { readonly: true });
    try {
      const snapshot = store.readSnapshot({ project, id: inputs.graph.snapshot });
      if (JSON.stringify(snapshot.capture.canonical) !== JSON.stringify(canonical)
        || JSON.stringify(snapshot.capture.sources) !== JSON.stringify(inputs.sources)
        || JSON.stringify(snapshot.capture.sourceIndex) !== JSON.stringify(inputs.sourceIndex)
        || JSON.stringify(snapshot.capture.request) !== JSON.stringify(values.get('request'))
        || JSON.stringify(snapshot.capture.compilation.result) !== JSON.stringify(values.get('compiled'))
        || JSON.stringify(snapshot.capture.implementations) !== JSON.stringify(inputs.implementations)) throw new Error('knowledge graph snapshot disagrees with generation evidence');
      const published = store.queryCodeAnchors({ project, snapshot: inputs.graph.snapshot, generation: inputs.graph.generation });
      const indexed = readAnchorsIndex(published.anchors);
      if (JSON.stringify(indexed) !== JSON.stringify(anchors)) throw new Error('graph anchors disagree with generated exchange index');
      anchors = indexed;
    } finally { store.close(); }
  }
  const associations = row => [...new Set([...(row.knowledgeIds || []), ...(row.noteIds || [])])];
  for (const [key, locations] of Object.entries(anchors.anchors)) for (const loc of locations) {
    const row = rows.get(loc.file);
    if (loc.repo !== out || row?.ownership?.id !== project || !associations(row).includes(key)
      || row.ownership.generator !== loc.generator || row.ownership.fingerprint !== loc.fingerprint)
      return { state: 'invalid', reason: 'anchor does not agree with recorded file ownership/source association/fingerprint' };
  }
  // Reconcile in the other direction as well: an empty/deleted anchor map is
  // not evidence of a successful lookup when the ledger records associations.
  for (const row of ledger.entries.filter(row => row.ownership?.id === project)) {
    for (const key of associations(row)) if (!anchors.anchors[key]?.some(loc => loc.file === row.path))
      return { state: 'invalid', reason: 'missing anchor for recorded source association: ' + row.path };
  }
  const prior = { state: 'verified', inputs, canonical, request: values.get('request'), ledger, anchors, receipts };
  requestEvidence(prior);
  assertReceiptsUnchanged(prior);
  return prior;
}
function assertReceiptsUnchanged(prior) {
  for (const [file, bytes] of prior.receipts) {
    if (!readFileSync(localPath(process.cwd(), file)).equals(bytes)) throw new Error('generation evidence changed during lookup: ' + file);
  }
}
function closeCapture(captured) {
  if (captured.current?.implementations) {
    try { assertUnchanged(captured.current); }
    catch (error) { captured.currentError = error.message; }
  }
  if (captured.prior.state !== 'verified') return;
  try { assertReceiptsUnchanged(captured.prior); }
  catch (error) { captured.prior = { state: 'invalid', reason: error.message }; }
}
function capture(projectFile, output) {
  const project = localPath(process.cwd(), projectFile), out = localPath(process.cwd(), output);
  let current, currentError = null, prior;
  try { current = currentCapture(project); } catch (error) { currentError = error.message; }
  try { prior = priorCapture(project, out); } catch (error) { prior = { state: 'invalid', reason: error.message }; }
  return { project, out, current, currentError, prior };
}
function statusOf(captured) {
  const { project, out, current, currentError, prior } = captured;
  const differences = [];
  if (current && prior.state === 'verified') {
    const a = new Map(prior.inputs.sources.map(s => [sourceKey(s), s])), b = new Map(current.sources.map(s => [sourceKey(s), s]));
    for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
      if (!a.has(key)) differences.push({ state: 'added', source: b.get(key) });
      else if (!b.has(key)) differences.push({ state: 'removed', source: a.get(key) });
      else if (a.get(key).sha256 !== b.get(key).sha256) differences.push({ state: 'changed', source: b.get(key), previousSha256: a.get(key).sha256 });
    }
  }
  const inputState = currentError ? 'invalid' : prior.state !== 'verified' ? 'unknown' : differences.length ? 'changed' : 'current';
  const files = prior.state !== 'verified' ? [] : prior.ledger.entries.filter(r => r.ownership?.id === project).map(row => {
    const file = localPath(out, row.path);
    if (!inside(out, file)) throw new Error('query output path escapes root');
    const member = prior.inputs.generatedFiles.includes(row.path) || row.kind === 'project-evidence';
    if (!existsSync(file)) return { file: row.path, state: 'missing', plannedLastGeneration: member };
    const bytes = readFileSync(file), observed = hash(bytes);
    const equal = observed === row.ownership.fingerprint;
    const manual = !equal && generatedFingerprint(bytes, row.path) === row.ownership.generatedFingerprint;
    return { file: row.path, state: !member ? 'retained' : equal ? 'unchanged' : manual ? 'manual-edited' : 'modified',
      plannedLastGeneration: member, fingerprint: observed, lastFingerprint: row.ownership.fingerprint };
  });
  return { schemaVersion: 'truthsrc.project-status/v1', project, output: out, inputs: { state: inputState, differences, error: currentError },
    evidence: { state: prior.state, ...(prior.reason ? { reason: prior.reason } : {}) }, files,
    synchronized: inputState === 'current' && files.every(f => f.state === 'unchanged' || f.state === 'manual-edited'),
    precision: 'file', runtimeVerified: false,
    limitations: ['File fingerprints are not semantic execution certification.', 'Runtime/external implementation dependencies are admitted at generation; this status checks recorded project inputs, not running services.'] };
}
export function statusProject({ project, out }) {
  const captured = capture(project, out), status = statusOf(captured);
  closeCapture(captured);
  return captured.prior.state === status.evidence.state && !captured.currentError ? status : statusOf(captured);
}

function sourceParts(key) {
  if (!key.startsWith('source:')) return null;
  const pos = key.indexOf('#', 7);
  return pos < 0 ? null : { document: key.slice(7, pos), pointer: key.slice(pos + 1) };
}
function pointerValue(value, pointer) {
  for (const part of pointer.split('/').slice(1).map(s => s.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined;
    value = value[part];
  }
  return value;
}
function requestEvidence(prior) {
  if (!prior.assembled) {
    const request = requestHelpers.validateRequest(prior.request);
    prior.assembled = assembleDocuments(request.documents, request.assemblies, requestHelpers);
  }
  return prior.assembled;
}
// Only schema-declared provenance slots are links. In particular, document and
// pointer properties in business payloads/expressions are ordinary data.
const derivedRowPaths = [
  ['truthsrc.reference-binding/', /^\/layout\/declarations\/\d+$/],
  ['truthsrc.exact-type-binding/', /^\/types\/\d+$/],
  ['truthsrc.exact-codec-binding/', /^\/codecs\/\d+$/],
  ['truthsrc.domain-semantic-binding/', /^\/decisions\/\d+(?:\/decisions\/\d+)?$/],
  ['truthsrc.domain-fold-binding/', /^\/folds\/(?:defaults\/\d+|events\/\d+(?:\/assignments\/\d+)?)$/],
  ['truthsrc.domain-dependency-binding/', /^\/dependencies\/(?:commands|events)\/\d+$/],
  ['truthsrc.domain-external-event-binding/', /^\/externalEvents\/\d+$/],
  ['truthsrc.saga-host-binding/', /^\/hosts\/hosts\/\d+$/],
  ['truthsrc.artifact-binding/', /^\/artifacts\/artifacts\/\d+$/],
  ['truthsrc.effect-host-binding/', /^\/effects\/hosts\/\d+$/],
  ['truthsrc.product-design-binding/', /^\/designs\/\d+$/],
];
const containsPointer = (parent, child) => parent === child || child.startsWith(parent + '/');
function directSources(captured, source, visited = new Set()) {
  const { prior } = captured, key = JSON.stringify(source);
  if (visited.has(key)) return [];
  visited = new Set([...visited, key]);
  if (source.document === prior.inputs.canonicalId)
    return pointerValue(prior.canonical, source.pointer) === undefined ? [] : resolveSourcePointer(prior.inputs.sourceIndex, source.pointer);
  const assembled = requestEvidence(prior), doc = assembled.documents.find(d => d.id === source.document);
  if (!doc || pointerValue(doc.value, source.pointer) === undefined) return [];
  const inputs = prior.inputs.sources.filter(s => s.document === source.document);
  if (inputs.length) return inputs.map(input => ({ pointer: source.pointer, file: input.file, atomPointer: source.pointer, kind: 'technical-binding', identity: 'document:' + source.document,
    identityBasis: 'document', aliases: [], owner: [], name: source.document, meaning: { nature: 'implementation-choice' }, relation: 'direct' }));
  const assembly = assembled.assemblies.find(a => a.id === source.document);
  if (assembly) {
    const links = assembly.provenance.filter(link => {
      const input = assembled.documents.find(d => d.id === link.source.document);
      return isDeepStrictEqual(pointerValue(doc.value, link.targetPointer), pointerValue(input?.value, link.source.pointer));
    });
    const parents = links.filter(link => containsPointer(link.targetPointer, source.pointer));
    const selected = parents.length ? parents.filter(link => link.targetPointer.length === Math.max(...parents.map(p => p.targetPointer.length)))
      : links.filter(link => containsPointer(source.pointer, link.targetPointer));
    return unique(selected.flatMap(link => directSources(captured, { document: link.source.document,
      pointer: link.source.pointer + (containsPointer(link.targetPointer, source.pointer) ? source.pointer.slice(link.targetPointer.length) : '') }, visited)))
      .map(row => ({ ...row, via: source }));
  }
  const pattern = derivedRowPaths.find(([schema]) => doc.schemaVersion.startsWith(schema))?.[1];
  if (!pattern) return [];
  const links = [];
  const walk = (value, pointer = '') => {
    if (!value || typeof value !== 'object') return;
    if (pattern.test(pointer) && typeof value.source?.document === 'string' && typeof value.source?.pointer === 'string')
      links.push({ pointer, source: value.source });
    for (const [key, child] of Object.entries(value)) walk(child, pointer + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'));
  };
  walk(doc.value);
  const parents = links.filter(link => containsPointer(link.pointer, source.pointer));
  const selected = parents.length ? parents.filter(link => link.pointer.length === Math.max(...parents.map(p => p.pointer.length)))
    : links.filter(link => containsPointer(source.pointer, link.pointer));
  return unique(selected.flatMap(link => directSources(captured, link.source, visited))).map(row => ({ ...row, via: source }));
}
function projectionSurface(row, index) {
  if (row.surface !== undefined) return row.surface;
  // Old v1 receipts did not record surface. Recover it from the declaration's
  // ancestor record, not from an absolute array index or physical file name.
  const pointer = row.projectionPointer ?? row.pointer;
  const bases = index.records.filter(r => r.identity === row.identity && r.kind === row.kind && containsPointer(r.pointer, pointer));
  const base = bases.sort((a, b) => a.pointer.length - b.pointer.length)[0];
  return base ? pointer.slice(base.pointer.length) : '';
}
function currentRelation(row, captured) {
  if (!captured.current) return { state: 'current-source-invalid' };
  if (row.relation === 'unresolved') return { state: 'unresolved-derived-source' };
  if (row.kind === 'technical-binding') return { state: 'technical-binding', file: row.file, atomPointer: row.atomPointer };
  const previous = captured.prior.inputs.sourceIndex;
  if (row.relation === 'ordinal' || row.identityBasis === 'snapshot-ordinal' || row.identityBasis === 'legacy-alias') {
    const same = previous.snapshot === captured.current.sourceIndex.snapshot;
    return { state: same ? 'same-snapshot' : 'requires-qualified-comparison', snapshot: captured.current.sourceIndex.snapshot };
  }
  const surface = projectionSurface(row, previous);
  const matches = captured.current.sourceIndex.records.filter(r => r.identity === row.identity && r.kind === row.kind
    && projectionSurface(r, captured.current.sourceIndex) === surface);
  if (!matches.length) return { state: 'removed-or-renamed' };
  // Same pointer is not a tiebreaker: after a reorder it may name another row.
  if (matches.length !== 1) return { state: 'ambiguous', candidates: matches };
  const current = matches[0];
  if (current.relation === 'unresolved') return { state: 'unresolved-derived-source' };
  const suffix = row.pointer.slice((row.projectionPointer ?? row.pointer).length);
  const pointer = current.pointer + suffix;
  const location = resolveRecordSource(captured.current.sourceIndex, current, pointer), atomPointer = location.atomPointer;
  const a = pointerValue(captured.prior.canonical, row.pointer), b = pointerValue(captured.current.canonical, pointer);
  return { state: b === undefined ? 'removed-or-renamed' : isDeepStrictEqual(a, b) ? row.file === location.file && row.atomPointer === atomPointer ? 'unchanged' : 'moved' : 'changed',
    file: location.file, atomPointer, pointer, snapshot: captured.current.sourceIndex.snapshot,
    ...(location.locationMapping ? { locationMapping: location.locationMapping } : {}) };
}
function observedLocation(location, out) {
  // Interpret the already captured anchor object, never reopen anchors.json
  // between authenticating its associations and selecting locations.
  const file = localPath(out, location.file);
  if (!inside(out, file)) throw new Error('anchor file escapes its repository');
  const unverified = (status, reason, fingerprint) => ({ ...location, status,
    verification: { method: 'none', level: 'none', fileVerified: false, symbolVerified: false, spanVerified: false,
      reason, ...(fingerprint ? { observedFingerprint: fingerprint } : {}) } });
  if (!existsSync(file)) return unverified('unmapped', 'source-missing');
  const bytes = readFileSync(file), fingerprint = hash(bytes);
  if (location.status !== 'source-verified') return { ...location, observedFingerprint: fingerprint };
  if (fingerprint !== location.fingerprint) return unverified('stale', 'source-fingerprint-changed', fingerprint);
  const evidence = location.verification.symbolEvidence?.span ?? location.span;
  if (evidence && !bytes.subarray(evidence.start, evidence.end).equals(Buffer.from(evidence.text))) return unverified('stale', 'source-span-changed');
  return { ...location, freshness: 'current-bytes', observedFingerprint: fingerprint };
}
/** Batch, in-memory queries over ONE caller-captured project and anchor index.
 * No capture, graph open, filesystem read, or freshness certification occurs here:
 * callers must authenticate these inputs and close their capture after the batch.
 * Unlike the interactive file-candidate query, joins use qualified identities, not
 * coincident author filenames. All occurrences (including multiple spans) survive.
 */
export function createProjectQuerySession({ captured, anchors }) {
  const context = { current: captured, prior: { canonical: captured.canonical, request: captured.request,
    inputs: { canonicalId: captured.config.canonicalId, sourceIndex: captured.sourceIndex, sources: captured.sources } } };
  const index = readAnchorsIndex(anchors), cache = new Map(), byFile = new Map();
  const origins = key => {
    if (!cache.has(key)) {
      const source = sourceParts(key);
      cache.set(key, source ? directSources(context, source) : captured.sourceIndex.records
        .filter(row => row.identity === key && projectionSurface(row, captured.sourceIndex) === '')
        .map(row => resolveRecordSource(captured.sourceIndex, row)));
    }
    return cache.get(key);
  };
  const rows = Object.entries(index.anchors).map(([knowledge, locations]) => ({ knowledge, origins: origins(knowledge), locations }));
  for (const row of rows) for (const location of row.locations) {
    if (!byFile.has(location.file)) byFile.set(location.file, []);
    byFile.get(location.file).push({ knowledge: row.knowledge, origins: row.origins, location });
  }
  const select = selector => sourceParts(selector) ? origins(selector) : unique(captured.sourceIndex.records
    .filter(row => projectionSurface(row, captured.sourceIndex) === '' &&
      (row.identity === selector || row.name === selector || row.aliases.includes(selector)))
    .map(row => resolveRecordSource(captured.sourceIndex, row)));
  return {
    origins: key => structuredClone(origins(key)),
    select: selector => structuredClone(select(selector)),
    forward: selector => {
      const selected = select(selector);
      const matches = (wanted, origin) => wanted.identity === origin.identity &&
        (wanted.kind !== 'technical-binding' && origin.kind !== 'technical-binding' ||
          wanted.file === origin.file && wanted.atomPointer === origin.atomPointer);
      return structuredClone(Object.hasOwn(index.anchors, selector) ? rows.filter(row => row.knowledge === selector)
        : rows.filter(row => row.origins.some(origin => selected.some(wanted => matches(wanted, origin)))));
    },
    reverse: file => structuredClone(byFile.get(file) || []),
  };
}

function queryImplementation({ project, out, implementation }) {
  if (typeof implementation !== 'string' || !implementation.trim()) throw new Error('explicit implementation id required');
  const captured = capture(project, out), status = statusOf(captured);
  let evidence = null;
  if (!captured.currentError && captured.current?.implementations) {
    try { evidence = describeImplementationSources(captured.current); }
    catch (error) { captured.currentError = error.message; }
  }
  closeCapture(captured);
  const closedStatus = captured.currentError || captured.prior.state !== status.evidence.state ? statusOf(captured) : status;
  const members = captured.currentError ? [] : (evidence?.members ?? []).filter(member => member.id === implementation);
  const priorMembers = captured.prior.state === 'verified' ? captured.prior.inputs.implementations?.members ?? [] : [];
  return { schemaVersion: 'truthsrc.project-implementation-query/v1', status: closedStatus, precision: 'file',
    state: captured.currentError ? 'source-evidence-unavailable' : members.length ? 'mapped' : 'unmapped',
    provenanceScope: 'current-declared-handwritten', runtimeVerified: false,
    result: members.map(member => ({ ...member,
      generationInput: closedStatus.inputs.state === 'current' && priorMembers.some(prior => prior.id === member.id && prior.absoluteFile === member.file && prior.sha256 === member.sha256)
        ? 'matches-last-generated-input' : 'not-synchronized' })) };
}

export function queryProject({ project, out, knowledge, file, symbol, line, implementation }) {
  if ([knowledge, file, implementation].filter(value => value !== undefined).length !== 1)
    throw new Error('query requires exactly one knowledge, generated file or implementation selector');
  if (implementation !== undefined) {
    if (symbol !== undefined || line !== undefined) throw new Error('implementation evidence has file precision only');
    return queryImplementation({ project, out, implementation });
  }
  if ((symbol !== undefined || line !== undefined) && file === undefined) throw new Error('symbol/line candidates require an explicit file');
  const captured = capture(project, out), status = statusOf(captured);
  const currentSelection = knowledge !== undefined && captured.current && !sourceParts(knowledge)
    ? captured.current.sourceIndex.records.filter(row => row.surface === '' &&
      (row.identity === knowledge || row.name === knowledge || row.aliases.includes(knowledge)))
      .map(row => ({ ...row, snapshot: captured.current.sourceIndex.snapshot, interpretation: 'current-author-not-generation-evidence' })) : [];
  if (captured.prior.state !== 'verified') {
    closeCapture(captured);
    return { schemaVersion: 'truthsrc.project-query/v1', status: statusOf(captured), result: [],
      currentSelection: captured.currentError ? [] : currentSelection, state: 'source-evidence-unavailable', precision: 'file' };
  }
  const { prior } = captured, sourceRows = prior.inputs.sourceIndex.records;
  let selected = [], linked = [], keys = [];
  const diagnostics = [];
  if (knowledge !== undefined) {
    const source = sourceParts(knowledge);
    selected = source ? directSources(captured, source) : sourceRows.filter(row =>
      (row.identity === knowledge || row.aliases.includes(knowledge) || row.name === knowledge)
      && projectionSurface(row, prior.inputs.sourceIndex) === '');
    selected = unique(selected);
    linked = relatedNarrativeSources(prior.canonical, prior.inputs.sourceIndex, selected, diagnostics);
    const candidates = [...selected, ...linked];
    for (const key of Object.keys(prior.anchors.anchors)) {
      const parts = sourceParts(key);
      if (key === knowledge || parts && directSources(captured, parts).some(row => candidates.some(s => s.identity === row.identity && s.file === row.file))) keys.push(key);
    }
  } else {
    const path = localPath(captured.out, file);
    if (!inside(captured.out, path)) throw new Error('generated file outside output');
    file = relative(captured.out, path).split(sep).join('/');
    keys = Object.entries(prior.anchors.anchors).filter(([, locations]) => locations.some(loc => loc.file === file)).map(([key]) => key);
  }
  let result = keys.map(key => {
    const source = sourceParts(key);
    const associated = prior.anchors.anchors[key].filter(loc => file === undefined || loc.file === file);
    const historical = associated.every(loc => !prior.inputs.generatedFiles.includes(loc.file));
    const origins = source && !historical ? directSources(captured, source).map(row => ({ ...row, current: currentRelation(row, captured) })) : [];
    const sourceState = historical ? 'historical-source-unavailable'
      : !origins.length || origins.every(row => row.relation === 'unresolved') ? 'unresolved-derived-source' : 'mapped';
    return { knowledge: key, ...(!historical ? { snapshot: prior.inputs.sourceIndex.snapshot } : {}),
      provenanceScope: 'last-generated-only', origins, sourceState,
      locations: associated.map(location => {
        const retained = !prior.inputs.generatedFiles.includes(location.file), loc = observedLocation(location, captured.out);
        return { ...loc, generationMembership: retained ? 'retained' : 'last-generated',
          truthFreshness: retained ? 'unknown' : status.inputs.state,
          ...(retained ? { origins: [], sourceState: 'historical-source-unavailable' }
            : { snapshot: prior.inputs.sourceIndex.snapshot, origins, sourceState }) };
      }) };
  });
  let exactPosition = false;
  if (line !== undefined) {
    if (!Number.isSafeInteger(line) || line < 1) throw new Error('line must be a positive safe integer');
    const bytes = readFileSync(localPath(captured.out, file)), starts = [0];
    for (let i = 0; i < bytes.length; i++) if (bytes[i] === 10) starts.push(i + 1);
    const start = starts[line - 1], end = starts[line] ?? bytes.length;
    const precise = result.map(row => ({ ...row, locations: row.locations.filter(loc =>
      loc.verification.spanVerified && loc.freshness === 'current-bytes' && start !== undefined && loc.span.start < end && loc.span.end > start) })).filter(row => row.locations.length);
    if (precise.length) { result = precise; exactPosition = true; }
  }
  if (result.length && result.every(row => row.sourceState === 'historical-source-unavailable')) selected = [];
  closeCapture(captured);
  if (captured.prior.state !== 'verified' || captured.current?.implementations && captured.currentError) return { schemaVersion: 'truthsrc.project-query/v1', status: statusOf(captured), result: [], state: 'source-evidence-unavailable', precision: 'file' };
  const selectors = new Set(selected.map(r => r.identity));
  const occurrences = selected.map(row => JSON.stringify([row.identity, projectionSurface(row, prior.inputs.sourceIndex)]));
  const ambiguous = selectors.size > 1 || new Set(occurrences).size !== occurrences.length;
  return { schemaVersion: 'truthsrc.project-query/v1', status, precision: exactPosition ? 'span' : 'file', provenanceScope: 'last-generated-only',
    state: exactPosition ? 'mapped' : symbol !== undefined || line !== undefined ? 'candidates-only' : ambiguous ? 'ambiguous' : result.length ? 'mapped' : currentSelection.length ? 'not-generated' : 'unmapped',
    ...(symbol !== undefined || line !== undefined ? { requestedPosition: { ...(symbol !== undefined ? { symbol } : {}), ...(line !== undefined ? { line } : {}) },
      explanation: exactPosition ? 'Matched verified final UTF-8 source spans; semantic identities come from the same knowledge snapshot.' : 'No unique verified span matched this position. These are file-associated candidates; nextN is not a knowledge identity.' } : {}),
    selection: selected.map(row => ({ ...row, current: currentRelation(row, captured) })), currentSelection,
    linked: linked.map(row => ({ ...row, current: currentRelation(row, captured) })), diagnostics, result };
}
export function projectQueryCli(command, args) {
  const flags = new Map();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--project', '--out', ...(command === 'query-project' ? ['--knowledge', '--file', '--symbol', '--line', '--implementation'] : [])].includes(flag) || flags.has(flag) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('unknown/duplicate/incomplete query flag');
    flags.set(flag, args[++i]);
  }
  if (!flags.has('--project') || !flags.has('--out')) throw new Error('explicit project and output required');
  const input = { project: flags.get('--project'), out: flags.get('--out') };
  if (command === 'status-project') return statusProject(input);
  if (flags.has('--line') && !/^[1-9][0-9]*$/.test(flags.get('--line'))) throw new Error('line must be a positive integer');
  return queryProject({ ...input, knowledge: flags.get('--knowledge'), file: flags.get('--file'), symbol: flags.get('--symbol'),
    implementation: flags.get('--implementation'), ...(flags.has('--line') ? { line: Number(flags.get('--line')) } : {}) });
}
