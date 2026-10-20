// compile.mjs — tree (hand-editable atoms) → canonical.json (machine projection).
//
// The tree is the ONLY edit surface. canonical.json is deterministic: the same
// tree always compiles to byte-identical output (invariant I1).
//
// v1 projection (schema v0.3):
//   sessions     — L1 sticky-note face: note payloads from inbox/<stage>/,
//                  aggregates/<slug>/notes/ and policies/, grouped by
//                  (stage, board), ordered by origin.seq.
//   aggregates   — solution contract: {...payload, commands, events} where
//                  commands follow aggregate order.commands (slice payloads)
//                  and events follow order.events (single event pool: slice
//                  `events` blocks + aggregate-level `extraEvents`).
//   valueObjects / readModels / stories — payload arrays ordered by seq.
//   useCases     — the flow model (use-cases.yaml payload), omitted if absent.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseDoc, STAGE_ORDER, listInboxStages, slug } from './shared.mjs';

const readAtoms = (dir, filter = () => true) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.yaml') && filter(f))
    .map((f) => ({ file: f, doc: parseDoc(readFileSync(join(dir, f), 'utf8'), join(dir, f)) }));
};

export function compileTree(treeDir) {
  // ── root config ──
  const metaFile = join(treeDir, 'workshop.yaml');
  const root = existsSync(metaFile) ? parseDoc(readFileSync(metaFile, 'utf8'), 'workshop.yaml') : {};
  const workshop = root.name || root.workshop || treeDir.split('/').filter(Boolean).pop();
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
  const notes = [];
  for (const { dir } of listInboxStages(treeDir)) {
    for (const { file, doc } of readAtoms(join(treeDir, 'inbox', dir))) {
      if (doc.kind === 'note') notes.push({ doc, inboxDir: dir });
    }
  }
  const aggDirs = existsSync(join(treeDir, 'aggregates'))
    ? readdirSync(join(treeDir, 'aggregates'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  for (const d of aggDirs) {
    for (const { doc } of readAtoms(join(treeDir, 'aggregates', d, 'notes'))) {
      if (doc.kind === 'note') notes.push({ doc, aggDir: d });
    }
  }
  for (const { doc } of readAtoms(join(treeDir, 'policies'), (f) => f.endsWith('.policy.yaml'))) {
    if (doc.kind === 'policy') notes.push({ doc });
  }
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
  const aggregates = aggDirs.map((d) => {
    const dir = join(treeDir, 'aggregates', d);
    const A = parseDoc(readFileSync(join(dir, 'aggregate.yaml'), 'utf8'), join(dir, 'aggregate.yaml'));
    const slices = readAtoms(join(dir, 'slices'), (f) => f.endsWith('.slice.yaml')).map((s) => s.doc);
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
  const valueObjects = bySeq(readAtoms(join(treeDir, 'value-objects'), (f) => f.endsWith('.vo.yaml')));
  const readModels = bySeq(readAtoms(join(treeDir, 'read-models'), (f) => f.endsWith('.rm.yaml')));
  const stories = bySeq(readAtoms(join(treeDir, 'stories'), (f) => f.endsWith('.story.yaml')));
  // ── E1: domain services (ports) — catalog model: payload + optional seq ──
  const domainServices = bySeq(readAtoms(join(treeDir, 'domain-services'), (f) => f.endsWith('.port.yaml')));
  const ucFiles = readAtoms(treeDir, (f) => f === 'use-cases.yaml');
  const useCases = ucFiles.length ? ucFiles[0].doc.payload : undefined;

  // ── v0.4 (scenario A): pipelines + scenarios ──
  // File order is the canonical order (deterministic: explicit filename sort).
  // The atom minus `kind` travels verbatim; `steps`/`script` ride as JSON blocks.
  const byFile = (docs) => [...docs].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const pipelines = byFile(readAtoms(join(treeDir, 'pipelines'), (f) => f.endsWith('.pipeline.yaml')))
    .map(({ doc }) => { const { kind, ...rest } = doc; return rest; });
  const scenarios = byFile(readAtoms(join(treeDir, 'scenarios'), (f) => f.endsWith('.scenario.yaml')))
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
  if (usesProductDirs) canonical.inboxLayout = inboxLayout;
  if (Object.keys(noteSurface).length) canonical.noteSurface = noteSurface;
  if (Object.keys(noteResidence).length) canonical.noteResidence = noteResidence;
  return JSON.stringify(canonical, null, 2) + '\n';
}
