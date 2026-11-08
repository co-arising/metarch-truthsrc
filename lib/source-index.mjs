import { createHash } from 'node:crypto';
import { FORMAL_PRODUCT_FAMILIES } from './formal-products-pure.mjs';
import { resolveSourceRefs } from './author-provenance.mjs';
import { copyImmutableData } from './immutable-data.mjs';

const V1 = 'truthsrc.source-index/v1', V2 = 'truthsrc.source-index/v2';
const fail = message => { throw new Error('SOURCE_INDEX: ' + message); };
const containsPointer = (base, pointer) => base === pointer || pointer.startsWith(base + '/');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function relativeFile(value, at) {
  if (typeof value !== 'string' || !value || /[\\\p{Cc}\p{Cf}]/u.test(value) || value.startsWith('/')
    || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.split('/').some(part => !part || part === '.' || part === '..'))
    fail(at + ': safe local relative file required');
}
function jsonPointer(value, at) {
  if (typeof value !== 'string' || value !== '' && !value.startsWith('/') || /~(?:[^01]|$)/u.test(value))
    fail(at + ': JSON pointer required');
}
function text(value, at) {
  if (typeof value !== 'string' || !value.trim() || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value))
    fail(at + ': nonempty text required');
}
function readRepresentationMappings(input) {
  const mappings = copyImmutableData(input, 'representationMappings', (at, message) => fail(at + ': ' + message));
  if (!Array.isArray(mappings)) fail('representationMappings: array required');
  const seen = new Set(), required = ['file', 'pointer', 'authorFile', 'authorPointer', 'mode', 'label'];
  mappings.forEach((mapping, i) => {
    const at = 'representationMappings/' + i;
    if (!object(mapping) || required.some(key => !Object.hasOwn(mapping, key))
      || Object.keys(mapping).some(key => !required.includes(key) && key !== 'template'))
      fail(at + ': unknown or missing field');
    relativeFile(mapping.file, at + '/file'); relativeFile(mapping.authorFile, at + '/authorFile');
    jsonPointer(mapping.pointer, at + '/pointer'); jsonPointer(mapping.authorPointer, at + '/authorPointer');
    if (!['declaration', 'subtree'].includes(mapping.mode)) fail(at + '/mode: declaration or subtree required');
    text(mapping.label, at + '/label');
    if (Object.hasOwn(mapping, 'template')) text(mapping.template, at + '/template');
    const key = JSON.stringify([mapping.file, mapping.pointer]);
    if (seen.has(key)) fail(at + ': duplicate virtual file/pointer');
    seen.add(key);
  });
  return mappings;
}
function mappedLocation(mappings, virtualFile, virtualPointer) {
  if (virtualFile == null || virtualPointer == null) return null;
  let selected;
  for (const mapping of mappings) if (mapping.file === virtualFile && containsPointer(mapping.pointer, virtualPointer)
    && (!selected || mapping.pointer.length > selected.pointer.length)) selected = mapping;
  if (!selected) return null;
  // A declaration can represent an entire expansion, including scalars and
  // macro roots. Only an explicitly verbatim subtree permits suffix copying.
  const { pointer, authorFile, authorPointer, mode, label, template } = selected;
  return { file: authorFile, atomPointer: authorPointer + (mode === 'subtree' ? virtualPointer.slice(pointer.length) : ''),
    locationMapping: Object.freeze({ virtualFile, virtualPointer, mappingPointer: pointer, authorFile, authorPointer, mode, label,
      ...(template !== undefined ? { template } : {}) }) };
}

/** Validate receipt mappings without requiring modern fields in legacy v1 records. */
export function validateSourceIndex(index) {
  if (!object(index) || ![V1, V2].includes(index.schemaVersion) || !Array.isArray(index.records))
    fail('supported source-index schema and records required');
  if (index.schemaVersion === V1) {
    if (Object.hasOwn(index, 'representationMappings')) fail('v1 cannot carry representationMappings');
    return index;
  }
  const mappings = readRepresentationMappings(index.representationMappings);
  if (!mappings.length) fail('v2 requires representationMappings');
  index.records.forEach((record, i) => {
    const at = 'records/' + i;
    if (!object(record)) fail(at + ': object required');
    jsonPointer(record.pointer, at + '/pointer');
    for (const key of ['file', 'virtualFile']) if (record[key] !== null) relativeFile(record[key], at + '/' + key);
    for (const key of ['atomPointer', 'virtualAtomPointer']) if (record[key] !== null) jsonPointer(record[key], at + '/' + key);
    if ((record.file === null) !== (record.virtualFile === null) || record.virtualFile === null && record.virtualAtomPointer !== null)
      fail(at + ': inconsistent virtual source');
    const location = mappedLocation(mappings, record.virtualFile, record.virtualAtomPointer);
    if (location) {
      if (record.file !== location.file || record.atomPointer !== location.atomPointer || !object(record.locationMapping)
        || Object.keys(record.locationMapping).length !== Object.keys(location.locationMapping).length
        || Object.entries(location.locationMapping).some(([key, value]) => !Object.hasOwn(record.locationMapping, key) || record.locationMapping[key] !== value))
        fail(at + ': source differs from representation mapping');
    } else if (Object.hasOwn(record, 'locationMapping') || record.atomPointer !== record.virtualAtomPointer)
      fail(at + ': unmapped virtual source differs');
  });
  return index;
}

const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const byFile = (a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
const ordered = atoms => [...atoms].sort(atoms.length && atoms.every(a => a.doc.seq != null)
  ? (a, b) => Number(a.doc.seq) - Number(b.doc.seq) : byFile);
const identified = value => typeof value === 'string' && value.trim() !== '' || typeof value === 'number' && Number.isFinite(value);
export const snapshotDigest = canonical => 'sha256:' + createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
export const knowledgeIdentity = (system, context, kind, owner, id) =>
  'knowledge:' + [system, context, kind, ...owner, id].map(v => encodeURIComponent(String(v))).join('/');

export function buildSourceIndex(snapshot, canonical, { system = canonical.workshop, context = '', physicalFiles = {}, authorAtoms = [], authorSystem, representationMappings = [] } = {}) {
  const records = [], atoms = snapshot.atoms, digest = snapshotDigest(canonical);
  const mappings = readRepresentationMappings(representationMappings);
  const provenance = new Map(authorAtoms.filter(atom => Object.hasOwn(atom.doc, 'sourceRefs')).map(atom => [atom.file, resolveSourceRefs(atom.doc, authorSystem)]));
  const add = (pointer, atom, atomPointer, kind, id, owner = [], meaning = {}, relation = 'direct', surface = '') => {
    if (!atom && relation !== 'unresolved') throw new Error('SOURCE_INDEX: missing atom for ' + pointer);
    const qualified = identified(id) && relation !== 'ordinal';
    const aliases = [...new Set([atom?.doc.id, atom?.doc.payload?.noteId].filter(identified).map(String))];
    records.push({ pointer, file: atom ? physicalFiles[atom.file] || atom.file : null, atomPointer, kind,
      identity: qualified ? knowledgeIdentity(system, context, kind, owner, id) : 'snapshot:' + digest + '#' + pointer,
      identityBasis: !qualified ? 'snapshot-ordinal' : kind === 'note' || kind === 'policy' ? 'legacy-alias' : 'qualified-declaration',
      aliases, owner, name: identified(id) ? String(id) : null,
      meaning: Object.fromEntries(Object.entries(meaning).filter(([, value]) => value !== undefined)),
      relation: !qualified && relation === 'direct' ? 'ordinal' : relation, surface,
      ...(atom && provenance.has(atom.file) ? { sourceLocations: provenance.get(atom.file) } : {}),
      ...(mappings.length ? { virtualFile: atom?.file ?? null, virtualAtomPointer: atomPointer,
        ...mappedLocation(mappings, atom?.file, atomPointer) } : {}) });
  };
  const inDir = dir => atoms.filter(a => a.file.slice(0, a.file.lastIndexOf('/')) === dir);
  const root = atoms.find(a => a.file === 'workshop.yaml');
  const derived = (pointer, atom = root, kind = 'derived', id = null, owner = [], surface = pointer) =>
    add(pointer, atom, null, kind, id, owner, { reason: 'compiler-derived; no verbatim author pointer' }, 'unresolved', surface);
  for (const key of ['schemaVersion', 'sessions', 'workshopKey', 'inboxLayout', 'noteSurface', 'noteResidence', 'formalProductSurface'])
    if (Object.hasOwn(canonical, key)) derived('/' + key);
  if (root) add('/workshop', root, physicalFiles['workshop.yaml'] === 'system.yaml' ? '/workshop' : root.doc.name ? '/name' : '/workshop', 'system', system);
  const notes = snapshot.metadata.inboxDirs.flatMap(dir => inDir('inbox/' + dir)).filter(a => a.doc.kind === 'note')
    .concat(snapshot.metadata.aggregateDirs.flatMap(dir => inDir('aggregates/' + dir + '/notes')).filter(a => a.doc.kind === 'note'), inDir('policies').filter(a => a.doc.kind === 'policy'));
  for (const [si, session] of canonical.sessions.entries()) for (const [bi, scope] of session.scopes.entries()) {
    const selected = notes.filter(a => a.doc.origin.stage === session.session && (a.doc.origin.board || 'board1') === scope.scope)
      .sort((a, b) => Number(a.doc.origin.seq) - Number(b.doc.origin.seq));
    if (selected.length !== scope.notes.length) throw new Error('SOURCE_INDEX: note projection differs');
    selected.forEach((atom, ni) => {
      const id = atom.doc.id ?? atom.doc.payload?.noteId ?? atom.doc.name, owner = [session.session, scope.scope];
      const meaning = { type: atom.doc.type, name: atom.doc.name, frozenSeq: atom.doc.origin.seq };
      add(`/sessions/${si}/scopes/${bi}/notes/${ni}`, atom, '/payload', atom.doc.kind, id, owner, meaning);
      const key = `${session.session}|${scope.scope}|${ni}`;
      for (const field of Object.keys(canonical.noteSurface?.[key] || {})) {
        const pointer = '/noteSurface/' + escape(key) + '/' + field;
        const atomPointer = field === 'id' ? '/id' : '/origin/' + field;
        if (field === 'id' && atom.doc.id == null) derived(pointer, atom, atom.doc.kind, id, owner, '/surface/id');
        else add(pointer, atom, atomPointer, atom.doc.kind, id, owner, meaning, 'direct', '/surface/' + field);
      }
    });
  }
  const aggregates = snapshot.metadata.aggregateDirs.map(dir => ({ dir, ...atoms.find(a => a.file === `aggregates/${dir}/aggregate.yaml`) }));
  aggregates.sort(aggregates.every(a => a.doc.seq != null) ? (a, b) => Number(a.doc.seq) - Number(b.doc.seq) : (a, b) => a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0);
  aggregates.forEach((atom, ai) => {
    const aggregate = canonical.aggregates[ai], base = `/aggregates/${ai}`, name = aggregate.name;
    if (atom.doc.payload.name !== name) throw new Error('SOURCE_INDEX: aggregate projection differs');
    add(base, atom, '/payload', 'aggregate', name);
    for (const [key, source] of [['context', '/context'], ['bmExtra', '/bmExtra'], ['seq', '/seq'],
      ['orderDecisions', '/order/decisions'], ['orderFolds', '/order/folds'], ['extraFolds', '/extraFolds']]) {
      const carried = key === 'seq' ? atom.doc.seq != null : key === 'orderDecisions' ? Array.isArray(atom.doc.order?.decisions)
        : key === 'orderFolds' ? Array.isArray(atom.doc.order?.folds) : atom.doc[key] !== undefined;
      if (carried) add(base + '/' + key, atom, source, 'aggregate', name, [], {}, 'direct', '/' + key);
    }
    for (const key of ['commands', 'events', 'eventResidence']) if (Object.hasOwn(aggregate, key)) derived(base + '/' + key, atom, 'aggregate', name, [], '/' + key);
    (aggregate.stateFields || []).forEach((field, fi) => add(base + '/stateFields/' + fi, atom, '/payload/stateFields/' + fi, 'state-field', field.name, [name]));
    const slices = inDir(`aggregates/${atom.dir}/slices`).filter(a => a.file.endsWith('.slice.yaml'));
    aggregate.commands.forEach((command, ci) => {
      // The compiler's pool is last-definition-wins, not alias lookup. Keep all
      // projected records even when their semantic identity happens to collide.
      const slice = slices.filter(s => s.doc.command === command.name).at(-1), ptr = base + '/commands/' + ci;
      add(ptr, slice, '/payload', 'command', command.name, [name]);
      for (const key of ['decision', 'fold', 'events']) if (slice.doc[key] !== undefined && Object.hasOwn(command, key)
        && (key !== 'events' || slice.doc.events && typeof slice.doc.events === 'object' && !Array.isArray(slice.doc.events) && !Object.keys(slice.doc.events).length))
        add(ptr + '/' + key, slice, '/' + key, 'command', command.name, [name], {}, 'direct', '/' + key);
      if (slice.doc.decision?.emissions?.length) {
        const emissions = new Map();
        for (const [i, emission] of slice.doc.decision.emissions.entries()) if (emission.event && emission.bindings) emissions.set(emission.event, i);
        if (emissions.size) {
          derived(ptr + '/emissionBindings', slice, 'command', command.name, [name], '/emissionBindings');
          for (const [event, i] of emissions) add(ptr + '/emissionBindings/' + escape(event), slice, '/decision/emissions/' + i + '/bindings',
            'command', command.name, [name], {}, 'direct', '/emissionBindings/' + escape(event));
        }
      }
      (command.guards || []).forEach((guard, gi) => {
        const id = guard.id ?? guard.ruleId ?? guard.ref ?? guard.name;
        add(ptr + '/guards/' + gi, slice, '/payload/guards/' + gi, 'guard', id, [name, command.name],
          { command: command.name, aggregate: name, ordinal: gi }, identified(id) ? 'direct' : 'ordinal');
      });
    });
    aggregate.events.forEach((event, ei) => {
      let source, atomPointer;
      for (const slice of slices) if (Object.hasOwn(slice.doc.events || {}, event.name)) { source = slice; atomPointer = '/events/' + escape(event.name); }
      (atom.doc.extraEvents || []).forEach((e, i) => { if (e.name === event.name) { source = atom; atomPointer = '/extraEvents/' + i; } });
      const ptr = base + '/events/' + ei;
      add(ptr, source, atomPointer, 'event', event.name, [name]);
      (event.foldAssignments || []).forEach((row, fi) => add(ptr + '/foldAssignments/' + fi, source, atomPointer + '/foldAssignments/' + fi,
        'fold', typeof row.slot === 'string' ? row.slot : row.slot == null ? null : JSON.stringify(row.slot), [name, event.name],
        { aggregate: name, event: event.name, target: row.slot, operation: row.op || 'set', expression: row.expr ?? row.delta ?? row.value, ordinal: fi }));
    });
  });
  for (const [family, key, kind] of [['value-objects', 'valueObjects', 'value-object'], ['read-models', 'readModels', 'read-model'], ['stories', 'stories', 'story'], ['domain-services', 'domainServices', 'domain-service']]) {
    ordered(inDir(family)).forEach((atom, i) => {
      const id = atom.doc.payload.id ?? atom.doc.payload.name, pointer = '/' + key + '/' + i;
      add(pointer, atom, '/payload', kind, id);
      if (atom.doc.seq != null) add(pointer + '/seq', atom, '/seq', kind, id, [], {}, 'direct', '/seq');
      // Opt-in only: absent family preserves every legacy source-index byte.
      if (family === 'value-objects' && canonical.moduleSeamsContracts?.length) {
        (atom.doc.payload.fields || []).forEach((f, j) => add(pointer + '/fields/' + j, atom, '/payload/fields/' + j, 'signature-field', f.name, [id]));
        (atom.doc.payload.variants || []).forEach((v, j) => {
          const p = '/variants/' + j;
          add(pointer + p, atom, '/payload' + p, 'signature-variant', v.name, [id]);
          (v.fields || []).forEach((f, k) => add(pointer + p + '/fields/' + k, atom, '/payload' + p + '/fields/' + k, 'signature-field', f.name, [id, v.name]));
        });
      }
    });
  }
  const useCases = atoms.find(a => a.file === 'use-cases.yaml');
  if (useCases) {
    add('/useCases', useCases, '/payload', 'use-cases', 'use-cases');
    const rows = canonical.useCases?.useCases;
    if (Array.isArray(rows)) rows.forEach((row, i) => add('/useCases/useCases/' + i, useCases, '/payload/useCases/' + i, 'use-case', row.id ?? row.name ?? row.useCase));
  }
  for (const [family, key, kind] of [['pipelines', 'pipelines', 'pipeline'], ['scenarios', 'scenarios', 'scenario'], ['sagas', 'sagas', 'saga']]) {
    (family === 'sagas' ? ordered(inDir(family)) : inDir(family).sort(byFile)).forEach((atom, i) =>
      add('/' + key + '/' + i, atom, '', kind, atom.doc.id ?? atom.doc.name));
  }
  for (const [family, key] of Object.entries(FORMAL_PRODUCT_FAMILIES)) inDir('formal-products/' + family).sort(byFile).forEach((atom, i) => {
    const meaning = { nature: family === 'product-design' ? 'product-design' : 'implementation-contract' };
    add('/' + key + '/' + i, atom, '/payload', family, atom.doc.id, [], meaning);
    if (family === 'module-seams-contract') (atom.doc.payload.ports || []).forEach((port, j) => {
      const p = '/' + key + '/' + i + '/ports/' + j, a = '/payload/ports/' + j;
      add(p, atom, a, 'port', port.id);
      (port.methods || []).forEach((method, k) => {
        const m = '/methods/' + k;
        add(p + m, atom, a + m, 'port-method', method.id, [port.id]);
        add(p + m + '/result', atom, a + m + '/result', 'port-method', method.id, [port.id], {}, 'direct', '/result');
        (method.parameters || []).forEach((param, n) => add(p + m + '/parameters/' + n, atom, a + m + '/parameters/' + n, 'port-parameter', param.id, [port.id, method.id]));
      });
    });
    for (const header of Object.keys(canonical.formalProductSurface?.[key + '/' + i] || {}))
      add('/formalProductSurface/' + escape(key + '/' + i) + '/' + escape(header), atom, '/' + escape(header), family, atom.doc.id, [], meaning, 'direct', '/header/' + header);
  });
  return { schemaVersion: mappings.length ? V2 : V1, snapshot: digest, system, context, records,
    ...(mappings.length ? { representationMappings: mappings } : {}) };
}

/** Resolve a record selected by identity/surface in this index's snapshot.
 * Compose canonical suffixes in virtual atom coordinates BEFORE mapping back
 * to authors. A parent record can have more specific mappings below its base.
 * v2 receipts should pass validateSourceIndex before being used for queries.
 */
export function resolveRecordSource(index, record, pointer = record.pointer) {
  if (!containsPointer(record.pointer, pointer)) fail('requested pointer is outside the record projection');
  const suffix = pointer.slice(record.pointer.length);
  const resolved = { ...record, projectionPointer: record.projectionPointer ?? record.pointer, pointer };
  if (index.schemaVersion !== V2) return { ...resolved,
    atomPointer: record.atomPointer == null ? null : record.atomPointer + suffix };
  const virtualAtomPointer = record.virtualAtomPointer == null ? null : record.virtualAtomPointer + suffix;
  return { ...resolved, virtualAtomPointer, atomPointer: virtualAtomPointer,
    ...mappedLocation(index.representationMappings, record.virtualFile, virtualAtomPointer) };
}

export function resolveSourcePointer(index, pointer) {
  const matching = index.records.filter(r => containsPointer(r.pointer, pointer));
  if (!matching.length) return [];
  const longest = Math.max(...matching.map(r => r.pointer.length));
  return matching.filter(r => r.pointer.length === longest).map(r => resolveRecordSource(index, r, pointer));
}
