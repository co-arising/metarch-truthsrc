// roundtrip.mjs — the correctness gate: compile → decompose → compile must be
// byte-identical, and the regenerated tree must equal the original byte for byte.
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileTree } from './compile.mjs';
import { decomposeCanonical } from './decompose.mjs';

export function roundtrip(treeDir) {
  const canonicalA = compileTree(treeDir);
  const tmp = mkdtempSync(join(tmpdir(), 'truthsrc-rt-'));
  try {
    decomposeCanonical(canonicalA, tmp);
    const canonicalB = compileTree(tmp);
    if (canonicalA !== canonicalB)
      return { ok: false, stage: 'canonical', msg: 'compile∘decompose∘compile is not byte-identical' };
    const treeFiles = (dir) => walk(dir).sort();
    const orig = treeFiles(treeDir), regen = treeFiles(tmp);
    if (orig.length !== regen.length)
      return { ok: false, stage: 'tree', msg: `file count differs: ${orig.length} vs ${regen.length}` };
    for (let i = 0; i < orig.length; i++) {
      const a = readFileSync(orig[i]), b = readFileSync(regen[i]);
      if (!a.equals(b)) return { ok: false, stage: 'tree', msg: `differs: ${orig[i]}` };
    }
    return { ok: true, atoms: orig.length };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function walk(dir, base = dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else if (e.endsWith('.yaml')) out.push(p);
  }
  return out;
}
