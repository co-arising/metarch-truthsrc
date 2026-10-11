#!/usr/bin/env node
// truthsrc — CLI dispatcher. Zero dependencies; Node >= 18.
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compileTree } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? resolve(process.argv[i + 1]) : dflt;
};
const [cmd] = process.argv.slice(2);
const TREE = arg('--tree', resolve('tree'));
const OUT = arg('--out', resolve('canonical.json'));

const USAGE = `truthsrc v0.3 — git-native Event Storming truth source

  truthsrc compile   --tree <dir> [--out canonical.json]   tree → canonical projection
  truthsrc decompose --canonical <file> --tree <dir>       canonical → tree atoms
  truthsrc validate  [--tree <dir>]                        V* structure + ES/CS/AG/RF/SM stage rules
  truthsrc roundtrip [--tree <dir>]                        compile∘decompose∘compile identity gate
  truthsrc init      <dir>                                 scaffold a minimal workshop tree
`;

const die = (msg) => { console.error(msg); process.exit(2); };

switch (cmd) {
  case 'compile': {
    writeFileSync(OUT, compileTree(TREE));
    console.log(`✅ ${TREE} → ${OUT}`);
    break;
  }
  case 'decompose': {
    const c = arg('--canonical', OUT);
    if (!existsSync(c)) die(`canonical not found: ${c}`);
    const n = decomposeCanonical(readFileSync(c, 'utf8'), TREE);
    console.log(`✅ ${c} → ${TREE} (${n} atoms)`);
    break;
  }
  case 'validate': {
    const { hard, notices } = validateTree(TREE);
    for (const h of hard) console.error('🔴 ' + h);
    for (const n of notices) console.warn('🟡 ' + n);
    console.log(hard.length ? `❌ ${hard.length} hard · ${notices.length} notice` : `✅ 0 hard · ${notices.length} notice`);
    process.exit(hard.length ? 1 : 0);
    break;
  }
  case 'roundtrip': {
    const r = roundtrip(TREE);
    if (!r.ok) die(`❌ roundtrip red (${r.stage}): ${r.msg}`);
    console.log(`✅ roundtrip identity — ${r.atoms} atoms, canonical byte-stable`);
    break;
  }
  case 'init': {
    const dir = process.argv[3];
    if (!dir) die('usage: truthsrc init <dir>');
    const root = resolve(dir);
    mkdirSync(join(root, 'inbox', 'eventStorming'), { recursive: true });
    writeFileSync(join(root, 'workshop.yaml'), 'schemaVersion: truthsrc/v0\nname: my-workshop\n');
    copyFileSync(new URL('../example/tree/inbox/eventStorming/event-es-loanrequested-0.yaml', import.meta.url),
      join(root, 'inbox', 'eventStorming', 'event-es-loanrequested-0.yaml'));
    console.log(`✅ scaffolded ${root} — edit atoms, then: truthsrc validate && truthsrc roundtrip`);
    break;
  }
  default:
    process.stdout.write(USAGE);
    process.exit(cmd ? 2 : 0);
}
