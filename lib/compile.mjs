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
import { parseDoc, STAGE_ORDER } from './shared.mjs';

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
  const notes = [];
  for (const stage of sessionOrder) {
    for (const { file, doc } of readAtoms(join(treeDir, 'inbox', stage))) {
      if (doc.kind === 'note') notes.push({ doc });
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
    return { seq: Number(A.seq), product };
  }).sort((a, b) => a.seq - b.seq).map((a) => a.product);

  // ── catalogs ──
  const bySeq = (docs) => docs.sort((a, b) => Number(a.doc.seq) - Number(b.doc.seq)).map((d) => d.doc.payload);
  const valueObjects = bySeq(readAtoms(join(treeDir, 'value-objects'), (f) => f.endsWith('.vo.yaml')));
  const readModels = bySeq(readAtoms(join(treeDir, 'read-models'), (f) => f.endsWith('.rm.yaml')));
  const stories = bySeq(readAtoms(join(treeDir, 'stories'), (f) => f.endsWith('.story.yaml')));
  const ucFiles = readAtoms(treeDir, (f) => f === 'use-cases.yaml');
  const useCases = ucFiles.length ? ucFiles[0].doc.payload : undefined;

  const canonical = {
    schemaVersion: 'truthsrc/v1',
    workshop,
    sessions,
    aggregates,
    valueObjects,
    readModels,
    stories,
  };
  if (useCases !== undefined) canonical.useCases = useCases;
  return JSON.stringify(canonical, null, 2) + '\n';
}
