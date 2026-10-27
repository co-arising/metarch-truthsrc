import { copyImmutableData } from './immutable-data.mjs';
import { STAGE_ORDER, slug } from './shared-pure.mjs';

export const SNAPSHOT_VERSION = 'truthsrc.parsed-snapshot/v1';
const fail = (pointer, message) => { throw new Error(`snapshot ${pointer}: ${message}`); };
const escape = key => key.replaceAll('~', '~0').replaceAll('/', '~1');

// Keep the snapshot error facade while sharing descriptor-first immutable data.
const copyData = (value, pointer) => copyImmutableData(value, pointer, fail);

function path(value, pointer, single = false) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f]/.test(value) || value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.split('/').some(s => !s || s === '.' || s === '..') || (single && value.includes('/'))) fail(pointer, 'expected safe relative path');
}

export function createSnapshot(atoms, metadata) {
  const data = copyData({ atoms, metadata }, '');
  if (!Array.isArray(data.atoms)) fail('/atoms', 'expected array');
  if (!data.metadata || typeof data.metadata !== 'object' || Array.isArray(data.metadata)) fail('/metadata', 'expected object');
  for (const key of Object.keys(data.metadata)) if (!['fallbackWorkshop', 'inboxDirs', 'aggregateDirs'].includes(key)) fail(`/metadata/${escape(key)}`, 'unsupported metadata');
  if (data.metadata.fallbackWorkshop !== undefined && typeof data.metadata.fallbackWorkshop !== 'string') fail('/metadata/fallbackWorkshop', 'expected string');
  for (const key of ['inboxDirs', 'aggregateDirs']) {
    const dirs = data.metadata[key];
    if (!Array.isArray(dirs)) fail(`/metadata/${key}`, 'expected explicit directory order');
    const seen = new Set();
    dirs.forEach((dir, i) => {
      path(dir, `/metadata/${key}/${i}`, true);
      if (seen.has(dir)) fail(`/metadata/${key}/${i}`, 'duplicate directory');
      seen.add(dir);
    });
  }
  const files = new Set();
  data.atoms.forEach((atom, i) => {
    const pointer = `/atoms/${i}`;
    if (!atom || typeof atom !== 'object' || Array.isArray(atom)) fail(pointer, 'expected atom');
    for (const key of Object.keys(atom)) if (!['file', 'doc'].includes(key)) fail(`${pointer}/${escape(key)}`, 'unsupported atom transport field');
    path(atom.file, `${pointer}/file`);
    if (files.has(atom.file)) fail(`${pointer}/file`, `duplicate source ${atom.file}`);
    files.add(atom.file);
    if (!atom.doc || typeof atom.doc !== 'object' || Array.isArray(atom.doc)) fail(`${pointer}/doc`, `${atom.file}: expected parsed atom object`);
    const segments = atom.file.split('/');
    const [family, dir, residence, file] = segments;
    const root = segments.length === 1 && ['workshop.yaml', 'use-cases.yaml'].includes(family);
    const inbox = segments.length === 3 && family === 'inbox' && residence.endsWith('.yaml');
    const aggregate = family === 'aggregates' && ((segments.length === 3 && residence === 'aggregate.yaml') || (segments.length === 4 && ((residence === 'notes' && file.endsWith('.yaml')) || (residence === 'slices' && file.endsWith('.slice.yaml')))));
    const catalogs = { policies: '.policy.yaml', 'value-objects': '.vo.yaml', 'read-models': '.rm.yaml', stories: '.story.yaml', 'domain-services': '.port.yaml', pipelines: '.pipeline.yaml', scenarios: '.scenario.yaml', sagas: '.saga.yaml' };
    const catalog = segments.length === 2 && Object.hasOwn(catalogs, family) && dir.endsWith(catalogs[family]);
    if (!root && !inbox && !aggregate && !catalog) fail(`${pointer}/file`, `${atom.file}: outside captured atom residence`);
    if (inbox && !data.metadata.inboxDirs.includes(dir)) fail(`${pointer}/file`, `${atom.file}: inbox directory absent from metadata`);
    if (aggregate && !data.metadata.aggregateDirs.includes(dir)) fail(`${pointer}/file`, `${atom.file}: aggregate directory absent from metadata`);
  });
  for (const dir of data.metadata.aggregateDirs) if (!files.has(`aggregates/${dir}/aggregate.yaml`)) fail('/metadata/aggregateDirs', `missing aggregates/${dir}/aggregate.yaml`);
  return Object.freeze({ schemaVersion: SNAPSHOT_VERSION, ...data });
}

function projectionInputs(snapshot) {
  const byFile = new Map(snapshot.atoms.map(atom => [atom.file, atom.doc]));
  const inDirectory = (directory, suffix = '.yaml') => snapshot.atoms.filter(({ file }) => {
    const at = file.lastIndexOf('/');
    return file.slice(0, at) === directory && file.endsWith(suffix);
  }).map(({ file, doc }) => ({ file: file.slice(file.lastIndexOf('/') + 1), doc }));
  const notes = [];
  for (const dir of snapshot.metadata.inboxDirs) for (const { doc } of inDirectory(`inbox/${dir}`)) if (doc.kind === 'note') notes.push({ doc, inboxDir: dir });
  for (const dir of snapshot.metadata.aggregateDirs) for (const { doc } of inDirectory(`aggregates/${dir}/notes`)) if (doc.kind === 'note') notes.push({ doc, aggDir: dir });
  for (const { doc } of inDirectory('policies', '.policy.yaml')) if (doc.kind === 'policy') notes.push({ doc });
  return {
    root: byFile.get('workshop.yaml') || {}, notes,
    aggregates: snapshot.metadata.aggregateDirs.map(dirName => ({ dirName, doc: byFile.get(`aggregates/${dirName}/aggregate.yaml`), slices: inDirectory(`aggregates/${dirName}/slices`, '.slice.yaml').map(({ doc }) => doc) })),
    valueObjects: inDirectory('value-objects', '.vo.yaml'), readModels: inDirectory('read-models', '.rm.yaml'),
    stories: inDirectory('stories', '.story.yaml'), domainServices: inDirectory('domain-services', '.port.yaml'),
    useCases: byFile.has('use-cases.yaml') ? [{ doc: byFile.get('use-cases.yaml') }] : [],
    pipelines: inDirectory('pipelines', '.pipeline.yaml'), scenarios: inDirectory('scenarios', '.scenario.yaml'),
    sagas: inDirectory('sagas', '.saga.yaml'),
  };
}

export function compileSnapshot(input) {
  const data = copyData(input, '');
  if (!data || data.schemaVersion !== SNAPSHOT_VERSION) fail('/schemaVersion', `expected ${SNAPSHOT_VERSION}`);
  for (const key of Object.keys(data)) if (!['schemaVersion', 'atoms', 'metadata'].includes(key)) fail(`/${escape(key)}`, 'unsupported snapshot field');
  const snapshot = createSnapshot(data.atoms, data.metadata);
  const text = project(snapshot);
  // Serialize exactly as the legacy compiler did. In-memory canonical matches
  // those bytes, including legacy undefined-array-slot -> null behavior.
  return Object.freeze({ canonical: copyData(JSON.parse(text), '/canonical'), text,
    sources: Object.freeze(snapshot.atoms.map(({ file }, i) => Object.freeze({ file, pointer: `/atoms/${i}/doc` }))) });
}

function project(snapshot) {
  const input = projectionInputs(snapshot);
  // ── root config ──
  const root = input.root;
  const workshop = root.name || root.workshop || snapshot.metadata.fallbackWorkshop;
  // The root may spell the name key `name:` (toolchain trees) or `workshop:`
  // (metarch trees). Record the non-default spelling so decompose writes the
  // tree's own form back (compiler-reserved sibling, emitted only when set).
  const workshopKey = !root.name && root.workshop ? 'workshop' : undefined;
  const sessionOrder = Array.isArray(root.sessionOrder) && root.sessionOrder.length
    ? root.sessionOrder : STAGE_ORDER;

  // ── L1 notes: inbox + aggregate-owned notes + policies → sessions ──
  // v0.4: inbox may use v0.3 stage-code dirs or v0.4 product dirs; listInboxStages
  // resolves each to its stage code. Notes are grouped by origin.stage for the
  // canonical sessions projection either way. The source directory of each note
  // is recorded in inboxLayout (below) so decompose reproduces the exact layout.
  const notes = input.notes;
  const byStage = new Map();
  for (const n of notes) {
    const key = `${n.doc.origin.stage}|${n.doc.origin.board || 'board1'}`;
    if (!byStage.has(key)) byStage.set(key, []);
    byStage.get(key).push(n.doc);
  }
  // Sessions scopes, ordered: per (stage, board) the note wrappers sorted by
  // origin.seq — the same order decompose later enumerates positionally.
  const orderedScopes = sessionOrder.map((stage) => {
    const boards = new Map();
    for (const n of notes
      .filter((x) => x.doc.origin.stage === stage)
      .sort((a, b) => Number(a.doc.origin.seq) - Number(b.doc.origin.seq))) {
      const board = n.doc.origin.board || 'board1';
      if (!boards.has(board)) boards.set(board, []);
      boards.get(board).push(n);
    }
    return { stage, boards };
  });
  const sessions = orderedScopes.map(({ stage, boards }) => ({
    session: stage,
    scopes: [...boards.entries()].map(([scope, ns]) => ({ scope, notes: ns.map((n) => n.doc.payload) })),
  }));

  // ── aggregates: single event pool + ordered commands ──
  // v0.4: `seq` is optional ("which aggregate is #n" is compiler-derived).
  // Order by seq when every aggregate carries one (legacy behavior, unchanged);
  // otherwise by directory name (deterministic). The seq rides along as a
  // compiler-reserved sibling key iff the tree atom had one — decompose writes
  // it back verbatim, so the roundtrip gate stays byte-identical.
  const aggregates = input.aggregates.map(({ dirName: d, doc: A, slices }) => {
    const sliceByCmd = new Map(slices.map((s) => [s.command, s]));
    const evPool = new Map();
    for (const s of slices) for (const [k, v] of Object.entries(s.events || {})) evPool.set(k, v);
    for (const e of A.extraEvents || []) evPool.set(e.name, e);
    const order = A.order || {};
    // Per-command emission bindings: the slice's top-level `decision.emissions`
    // (authored surface) overrides the event-definition bindings when a rule
    // body constructs the event for THIS command. Projected into the command
    // as a {event: {slot: expr}} map; decomposed trees carry the map inside
    // the payload instead, which is read back verbatim — either source yields
    // the same canonical form, keeping compile∘decompose∘compile stable.
    const emissionBindingsOf = (doc) => {
      const ems = doc?.decision?.emissions;
      if (Array.isArray(ems) && ems.length) {
        const map = {};
        for (const em of ems) if (em?.event && em?.bindings) map[em.event] = em.bindings;
        return Object.keys(map).length ? map : undefined;
      }
      return doc?.payload?.emissionBindings;
    };
    const commandProduct = (c) => {
      const doc = sliceByCmd.get(c);
      if (!doc) return undefined;
      const eb = emissionBindingsOf(doc);
      const base = eb ? { ...doc.payload, emissionBindings: eb } : { ...doc.payload };
      // v0.5.1 surface carry: the slice's stored `decision`/`fold` blocks ride
      // as compiler-reserved siblings so decompose can write them back
      // verbatim (they are NOT derivable from payload + pool in general —
      // stored folds carry `patch:`-style override assignments the event
      // definitions' foldAssignments do not; see SCHEMA.md §Surface carry).
      if (doc.decision !== undefined) base.decision = doc.decision;
      if (doc.fold !== undefined) base.fold = doc.fold;
      // Authored-empty `events: {}` (read-only query convention) has no pool entry
      // to reconstruct it from — ride it as surface carry (same class as
      // decision/fold above) so the atom round-trips byte-identically (I2).
      // Non-empty events travel through the evPool/order.events mechanism.
      if (doc.events !== undefined && typeof doc.events === 'object'
        && !Array.isArray(doc.events) && Object.keys(doc.events).length === 0) base.events = {};
      return base;
    };
    const product = {
      ...A.payload,
      commands: (order.commands || []).map(commandProduct),
      events: (order.events || []).map((e) => evPool.get(e)),
    };
    // v0.5.1 surface carry (aggregate level, compiler-reserved siblings):
    // atom-surface data the payload projection does not carry — decompose
    // writes each back verbatim. Emitted only when the atom carried it.
    if (A.context !== undefined) product.context = A.context;
    if (A.bmExtra !== undefined) product.bmExtra = A.bmExtra;
    if (Array.isArray(order.decisions)) product.orderDecisions = order.decisions;
    if (Array.isArray(order.folds)) product.orderFolds = order.folds;
    if (A.extraFolds !== undefined) product.extraFolds = A.extraFolds;
    // Event-definition residence: which slice's `events` block defines each
    // event (pool semantics: the LAST definer wins), recorded only where it
    // differs from decompose's default (first producing command; unproduced
    // events default to the aggregate's extraEvents). Values are command
    // names; null means extraEvents.
    {
      const definer = new Map();
      for (const s of slices) for (const k of Object.keys(s.events || {})) definer.set(k, s.command);
      const firstProducer = new Map();
      for (const c of order.commands || []) {
        const doc = sliceByCmd.get(c);
        for (const p of doc?.payload?.produces || []) {
          const n = typeof p === 'string' ? p : p.name;
          if (n !== undefined && !firstProducer.has(n)) firstProducer.set(n, c);
        }
      }
      const residence = {};
      for (const e of order.events || []) {
        const def = definer.has(e) ? definer.get(e) : null;
        const dflt = firstProducer.has(e) ? firstProducer.get(e) : null;
        if (def !== dflt) residence[e] = def;
      }
      if (Object.keys(residence).length) product.eventResidence = residence;
    }
    const seq = (A.seq === undefined || A.seq === null) ? undefined : Number(A.seq);
    return { seq, dirName: d, product: seq === undefined ? product : { ...product, seq } };
  });
  const aggAllSeq = aggregates.every((a) => a.seq !== undefined);
  aggregates.sort((a, b) => aggAllSeq ? a.seq - b.seq
    : (a.dirName < b.dirName ? -1 : a.dirName > b.dirName ? 1 : 0));
  const canonicalAggregates = aggregates.map((a) => a.product);

  // ── catalogs ──
  // v0.4: seq optional, same rule as aggregates. `seq` is a compiler-reserved
  // sibling key: present in canonical iff the tree atom carried one.
  const bySeq = (docs) => {
    const allSeq = docs.length > 0 && docs.every((d) => d.doc.seq !== undefined && d.doc.seq !== null);
    const sorted = [...docs].sort((a, b) => allSeq
      ? Number(a.doc.seq) - Number(b.doc.seq)
      : (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
    return sorted.map((d) => (d.doc.seq === undefined || d.doc.seq === null)
      ? d.doc.payload
      : { ...d.doc.payload, seq: Number(d.doc.seq) });
  };
  const valueObjects = bySeq(input.valueObjects);
  const readModels = bySeq(input.readModels);
  const stories = bySeq(input.stories);
  // ── E1: domain services (ports) — catalog model: payload + optional seq ──
  const domainServices = bySeq(input.domainServices);
  const ucFiles = input.useCases;
  const useCases = ucFiles.length ? ucFiles[0].doc.payload : undefined;

  // ── v0.4 (scenario A): pipelines + scenarios ──
  // File order is the canonical order (deterministic: explicit filename sort).
  // The atom minus `kind` travels verbatim; `steps`/`script` ride as JSON blocks.
  const byFile = (docs) => [...docs].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const pipelines = byFile(input.pipelines)
    .map(({ doc }) => { const { kind, ...rest } = doc; return rest; });
  const scenarios = byFile(input.scenarios)
    .map(({ doc }) => { const { kind, ...rest } = doc; return rest; });

  // ── Saga products: keep the WHOLE atom minus kind, not just the payload ──
  // Identity/version and optional seq are authored headers, never inferred from
  // the payload. As with catalogs, uniform seq pins order; otherwise file order
  // wins. No Saga product means no additive canonical key (legacy bytes stay put).
  const sagaAtoms = input.sagas;
  const sagaAllSeq = sagaAtoms.length > 0 && sagaAtoms.every(({ doc }) => doc.seq !== undefined && doc.seq !== null);
  const sagas = [...sagaAtoms].sort((a, b) => sagaAllSeq
    ? Number(a.doc.seq) - Number(b.doc.seq)
    : (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map(({ doc }) => { const { kind, ...rest } = doc; return rest; });

  // ── inboxLayout: the physical inbox dir per session note, recorded so
  // decompose reproduces the exact layout (v0.4 product dirs). This map must
  // be a FIXED POINT of decompose∘compile, so it is built by simulating
  // decompose's placement rather than by recording physical residence:
  //   key   = stage|board|rank, rank = positional index within the session
  //           scope (the key decompose looks up; origin.seq coincides with it
  //           in decomposed trees but is not the lookup key).
  //   entry = every note decompose would place under inbox/ — i.e. not a
  //           policy (routed to policies/) and not an owned command/event
  //           note (routed to aggregates/<slug>/notes/).
  //   value = the note's physical inbox dir when it lives in inbox/, else the
  //           stage name — the fallback dir decompose itself would choose, so
  //           a note decompose relocates lands exactly where this map says.
  // Keys are emitted in canonical sessions order, making the map a pure
  // function of (sessions, physical inbox dirs). Only emitted when a v0.4
  // product dir is actually in use; v0.3 trees emit nothing here and
  // decompose defaults to stage-code dirs (backward compat).
  const commandNames = new Set(canonicalAggregates.flatMap((a) => (a.commands || []).map((c) => c.name)));
  const eventNames = new Set(canonicalAggregates.flatMap((a) => (a.events || []).map((e) => e.name)));
  const inboxLayout = {};
  let usesProductDirs = false;
  for (const { stage, boards } of orderedScopes) {
    for (const [board, ns] of boards) {
      ns.forEach((n, rank) => {
        const type = n.doc.payload?.type;
        const name = n.doc.payload?.name;
        if (type === 'policy') return;
        const owned = (type === 'command' && commandNames.has(name))
          || (type === 'event' && eventNames.has(name));
        if (owned) return;
        if (n.inboxDir !== undefined && n.inboxDir !== stage) usesProductDirs = true;
        inboxLayout[`${stage}|${board}|${rank}`] = n.inboxDir !== undefined ? n.inboxDir : stage;
      });
    }
  }

  // ── v0.5.1 noteSurface / noteResidence: atom-surface data the sessions
  // projection (payloads only) does not carry, keyed exactly like
  // inboxLayout (stage|board|rank; rank = positional index in the scope).
  //   noteSurface[key]   — only the non-default fields: header `id` when it
  //                        differs from payload.noteId (null = no header id),
  //                        origin `author`/`createdAt` when the atom's origin
  //                        carries the key, origin `seq` when it differs
  //                        from the positional rank.
  //   noteResidence[key] — the note's physical directory (relative to the
  //                        tree root) when it differs from decompose's
  //                        default placement (policies/ for policies, the
  //                        owning aggregate's notes/ for owned command/event
  //                        notes, inbox/<layout dir> otherwise).
  // Both maps are fixed points of decompose∘compile by the same argument as
  // inboxLayout: decompose places/annotates exactly what the maps say, and
  // recompiling the result recomputes the same maps.
  const ownerAggOf = (type, name) => {
    for (const a of canonicalAggregates) {
      const bag = type === 'command' ? (a.commands || []) : (a.events || []);
      if (bag.some((x) => x.name === name)) return a.name;
    }
    return null;
  };
  const noteSurface = {};
  const noteResidence = {};
  for (const { stage, boards } of orderedScopes) {
    for (const [board, ns] of boards) {
      ns.forEach((n, rank) => {
        const key = `${stage}|${board}|${rank}`;
        const doc = n.doc;
        const payload = doc.payload || {};
        const origin = doc.origin || {};
        const entry = {};
        if (doc.id !== payload.noteId) entry.id = doc.id ?? null;
        if ('author' in origin) entry.author = origin.author;
        if ('createdAt' in origin) entry.createdAt = origin.createdAt;
        if (origin.seq !== undefined && Number(origin.seq) !== rank) entry.seq = Number(origin.seq);
        if (Object.keys(entry).length) noteSurface[key] = entry;
        const type = payload.type;
        let defaultDir;
        if (type === 'policy') defaultDir = 'policies';
        else {
          const owner = (type === 'command' || type === 'event') ? ownerAggOf(type, payload.name) : null;
          defaultDir = owner ? `aggregates/${slug(owner)}/notes` : `inbox/${inboxLayout[key] || stage}`;
        }
        const actualDir = n.inboxDir !== undefined ? `inbox/${n.inboxDir}`
          : n.aggDir !== undefined ? `aggregates/${n.aggDir}/notes` : 'policies';
        if (actualDir !== defaultDir) noteResidence[key] = actualDir;
      });
    }
  }

  const canonical = {
    schemaVersion: 'truthsrc/v1',
    workshop,
    sessions,
    aggregates: canonicalAggregates,
    valueObjects,
    readModels,
    stories,
    domainServices,
  };
  if (workshopKey) canonical.workshopKey = workshopKey;
  if (useCases !== undefined) canonical.useCases = useCases;
  if (pipelines.length) canonical.pipelines = pipelines;
  if (scenarios.length) canonical.scenarios = scenarios;
  if (sagas.length) canonical.sagas = sagas;
  if (usesProductDirs) canonical.inboxLayout = inboxLayout;
  if (Object.keys(noteSurface).length) canonical.noteSurface = noteSurface;
  if (Object.keys(noteResidence).length) canonical.noteResidence = noteResidence;
  return JSON.stringify(canonical, null, 2) + '\n';
}
