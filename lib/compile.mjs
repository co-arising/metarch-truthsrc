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
import { parseDoc, STAGE_ORDER, listInboxStages } from './shared.mjs';

const readAtoms = (dir, filter = () => true) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.yaml') && filter(f))
    .map((f) => ({ file: f, doc: parseDoc(readFileSync(join(dir, f), 'utf8'), join(dir, f)) }));
};

export function compileTree(treeDir) {
  // ── root config ──
  const metaFile = join(treeDir, 'workshop.yaml');
  const root = existsSync(metaFile) ? parseDoc(readFileSync(metaFile, 'utf8'), 'workshop.yaml') : {};
  const workshop = root.name || treeDir.split('/').filter(Boolean).pop();
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
      if (doc.kind === 'note') notes.push({ doc });
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
  // v0.4: record the inbox source directory per note so decompose reproduces
  // the exact layout (v0.3 stage-code dirs or v0.4 product dirs). Keyed by
  // stage|board|seq — V2 guarantees seq uniqueness per (stage, board).
  // Only recorded when a v0.4 product dir is actually in use; v0.3 trees emit
  // nothing here and decompose defaults to stage-code dirs (backward compat).
  const inboxLayout = {};
  let usesProductDirs = false;
  for (const n of notes) {
    const key = `${n.doc.origin.stage}|${n.doc.origin.board || 'board1'}|${n.doc.origin.seq}`;
    inboxLayout[key] = n.inboxDir;
    if (n.inboxDir !== n.doc.origin.stage) usesProductDirs = true;
  }
  const sessions = sessionOrder.map((stage) => {
    const boards = new Map();
    for (const doc of notes.map((n) => n.doc)
      .filter((d) => d.origin.stage === stage)
      .sort((a, b) => Number(a.origin.seq) - Number(b.origin.seq))) {
      const board = doc.origin.board || 'board1';
      if (!boards.has(board)) boards.set(board, []);
      boards.get(board).push(doc.payload);
    }
    return { session: stage, scopes: [...boards.entries()].map(([scope, ns]) => ({ scope, notes: ns })) };
  });

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
    const product = {
      ...A.payload,
      commands: (order.commands || []).map((c) => sliceByCmd.get(c)?.payload),
      events: (order.events || []).map((e) => evPool.get(e)),
    };
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
  if (useCases !== undefined) canonical.useCases = useCases;
  if (pipelines.length) canonical.pipelines = pipelines;
  if (scenarios.length) canonical.scenarios = scenarios;
  if (usesProductDirs) canonical.inboxLayout = inboxLayout;
  return JSON.stringify(canonical, null, 2) + '\n';
}
