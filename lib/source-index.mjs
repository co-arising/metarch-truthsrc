import { createHash } from 'node:crypto';
import { FORMAL_PRODUCT_FAMILIES } from './formal-products-pure.mjs';

const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const byFile = (a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
const ordered = atoms => [...atoms].sort(atoms.length && atoms.every(a => a.doc.seq != null)
  ? (a, b) => Number(a.doc.seq) - Number(b.doc.seq) : byFile);
const identified = value => typeof value === 'string' && value.trim() !== '' || typeof value === 'number' && Number.isFinite(value);
export const snapshotDigest = canonical => 'sha256:' + createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
export const knowledgeIdentity = (system, context, kind, owner, id) =>
  'knowledge:' + [system, context, kind, ...owner, id].map(v => encodeURIComponent(String(v))).join('/');

export function buildSourceIndex(snapshot, canonical, { system = canonical.workshop, context = '', physicalFiles = {} } = {}) {
  const records = [], atoms = snapshot.atoms, digest = snapshotDigest(canonical);
  const add = (pointer, atom, atomPointer, kind, id, owner = [], meaning = {}, relation = 'direct', surface = '') => {
    if (!atom && relation !== 'unresolved') throw new Error('SOURCE_INDEX: missing atom for ' + pointer);
    const qualified = identified(id) && relation !== 'ordinal';
    const aliases = [...new Set([atom?.doc.id, atom?.doc.payload?.noteId].filter(identified).map(String))];
    records.push({ pointer, file: atom ? physicalFiles[atom.file] || atom.file : null, atomPointer, kind,
      identity: qualified ? knowledgeIdentity(system, context, kind, owner, id) : 'snapshot:' + digest + '#' + pointer,
      identityBasis: !qualified ? 'snapshot-ordinal' : kind === 'note' || kind === 'policy' ? 'legacy-alias' : 'qualified-declaration',
      aliases, owner, name: identified(id) ? String(id) : null,
      meaning: Object.fromEntries(Object.entries(meaning).filter(([, value]) => value !== undefined)),
      relation: !qualified && relation === 'direct' ? 'ordinal' : relation, surface });
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
    for (const header of Object.keys(canonical.formalProductSurface?.[key + '/' + i] || {}))
      add('/formalProductSurface/' + escape(key + '/' + i) + '/' + escape(header), atom, '/' + escape(header), family, atom.doc.id, [], meaning, 'direct', '/header/' + header);
  });
  return { schemaVersion: 'truthsrc.source-index/v1', snapshot: digest, system, context, records };
}

export function resolveSourcePointer(index, pointer) {
  const matching = index.records.filter(r => r.pointer === pointer || pointer.startsWith(r.pointer + '/'));
  if (!matching.length) return [];
  const longest = Math.max(...matching.map(r => r.pointer.length));
  return matching.filter(r => r.pointer.length === longest).map(r => ({ ...r, projectionPointer: r.pointer, pointer,
    atomPointer: r.atomPointer == null ? null : r.atomPointer + pointer.slice(r.pointer.length) }));
}
