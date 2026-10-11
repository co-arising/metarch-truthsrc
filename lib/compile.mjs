// compile.mjs — tree (hand-editable atoms) → canonical.json (machine projection).
//
// The tree is the ONLY edit surface. canonical.json is deterministic: the same
// tree always compiles to byte-identical output (invariant I1).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseAtom, STAGE_ORDER } from './shared.mjs';

export function compileTree(treeDir) {
  const metaFile = join(treeDir, 'workshop.yaml');
  let workshop = null;
  if (existsSync(metaFile)) {
    workshop = (readFileSync(metaFile, 'utf8').match(/^name:\s*(.+)$/m) || [])[1]?.trim() || null;
  }
  if (!workshop) workshop = treeDir.split('/').filter(Boolean).pop();

  const sessions = [];
  for (const stage of STAGE_ORDER) {
    const dir = join(treeDir, 'inbox', stage);
    if (!existsSync(dir)) continue;
    const atoms = readdirSync(dir).filter((f) => f.endsWith('.yaml'))
      .map((f) => parseAtom(readFileSync(join(dir, f), 'utf8'), f));
    atoms.sort((a, b) => Number(a.origin.seq) - Number(b.origin.seq));
    const boards = new Map();
    for (const a of atoms) {
      const board = a.origin.board || 'board1';
      if (!boards.has(board)) boards.set(board, []);
      boards.get(board).push(a.payload);
    }
    sessions.push({
      session: stage,
      scopes: [...boards.entries()].map(([scope, notes]) => ({ scope, notes })),
    });
  }

  const canonical = {
    schemaVersion: 'truthsrc/v0',
    workshop,
    sessions,
  };
  return JSON.stringify(canonical, null, 2) + '\n';
}
