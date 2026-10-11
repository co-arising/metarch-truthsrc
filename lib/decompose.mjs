// decompose.mjs — canonical.json → tree atoms (the inverse projection).
//
// Deterministic by construction: filenames are (type, stage-code, slug(name), seq),
// byte layout comes from emitAtom, and ordering is the canonical's own order.
// decompose(compile(tree)) ≡ tree is the roundtrip gate (invariant I2).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitAtom, STAGE_CODE, slug } from './shared.mjs';

export function decomposeCanonical(canonicalText, treeDir) {
  const canonical = JSON.parse(canonicalText);
  mkdirSync(treeDir, { recursive: true });
  writeFileSync(join(treeDir, 'workshop.yaml'),
    `schemaVersion: ${canonical.schemaVersion || 'truthsrc/v0'}\nname: ${canonical.workshop}\n`);
  let count = 0;
  for (const sess of canonical.sessions || []) {
    const stage = sess.session;
    const code = STAGE_CODE[stage];
    if (!code) throw new Error(`unknown stage: ${stage}`);
    for (const sc of sess.scopes || []) {
      (sc.notes || []).forEach((payload, seq) => {
        const type = payload.type;
        const name = payload.name;
        if (!type || !name) throw new Error(`note #${seq} in ${stage}/${sc.scope}: payload.type/.name required`);
        const atom = {
          kind: 'note',
          type,
          name,
          origin: { stage, board: sc.scope, seq },
          payload,
        };
        const dir = join(treeDir, 'inbox', stage);
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `${type}-${code}-${slug(name)}-${seq}.yaml`);
        writeFileSync(file, emitAtom(atom));
        count++;
      });
    }
  }
  return count;
}
