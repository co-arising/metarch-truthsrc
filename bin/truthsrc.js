#!/usr/bin/env node
// truthsrc — CLI dispatcher. Zero dependencies; Node >= 18.
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compileTree } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { apply } from '../src/core/generate.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? resolve(process.argv[i + 1]) : dflt;
};
const [cmd] = process.argv.slice(2);
const TREE = arg('--tree', resolve('tree'));
const OUT = arg('--out', resolve('canonical.json'));

const USAGE = `truthsrc v0.4 — git-native Event Storming truth source

  truthsrc compile   --tree <dir> [--out canonical.json]   tree → canonical projection
  truthsrc decompose --canonical <file> --tree <dir>       canonical → tree atoms
  truthsrc validate  [--tree <dir>]                        V* structure + ES/CS/AG/RF/SM stage rules
  truthsrc roundtrip [--tree <dir>]                        compile∘decompose∘compile identity gate
  truthsrc init      <dir>                                 scaffold a minimal workshop tree
  truthsrc generate  --in <canonical> --generator <dir> --out <dir> [--option k=v]
                                                           run a generator (ledger + anchors emitted)
                     [--concern <name>] [--families A,B] [--concerns <file>]
                                                           incremental regeneration: only the faces the
                                                           concern scope selects are rewritten (engine: core;
                                                           presets: project-level registry, default ./concerns.json)
  truthsrc init-generator <dir>                            scaffold a custom generator
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
  case 'generate': {
    // generate --in <canonical.json> --generator <dir> --out <target> [--option k=v ...]
    //          [--concern <name>] [--families A,B] [--concerns <file>]
    const gen = arg('--generator');
    const c = arg('--in');
    const o = arg('--out');
    if (!gen || !c || (!o && !process.argv.includes('--plan'))) die('usage: truthsrc generate --in <canonical.json> --generator <dir> --out <dir> [--plan] [--concern <name>] [--families A,B] [--concerns <file>]');
    const options = {};
    for (let i = 2; i < process.argv.length; i++) {
      if (process.argv[i] === '--option') {
        const [k, v] = String(process.argv[i + 1] ?? '').split('=');
        if (k) options[k] = v ?? true;
      }
    }
    const CONCERN = process.argv.includes('--concern') ? process.argv[process.argv.indexOf('--concern') + 1] : null;
    const FAMILIES = process.argv.includes('--families') ? process.argv[process.argv.indexOf('--families') + 1] : null;
    if (process.argv.includes('--concern') && !CONCERN) die('--concern requires a name (see the project concerns registry)');
    if (process.argv.includes('--families') && !CONCERN) die('--families requires --concern');
    const concern = CONCERN ? { name: CONCERN, families: FAMILIES, registryFile: arg('--concerns', resolve('concerns.json')) } : null;
    if (concern && !existsSync(concern.registryFile)) die(`concerns registry not found: ${concern.registryFile} (--concerns <file>; default ./concerns.json)`);
    if (process.argv.includes('--plan')) {
      const { plan, mergedRows, scopeOf } = await import('../src/core/generate.mjs');
      const { manifest, entries } = await plan({ canonicalFile: c, generatorDir: gen, options });
      if (concern) {
        const rows = mergedRows(o ?? resolve('.'), entries);
        const s = scopeOf(rows, concern);
        console.log(`  🎛 concern=${CONCERN}（families: ${FAMILIES ?? 'all'}｜in-scope ${s.set.size} = predicate ${s.base.size} + closure ${s.set.size - s.base.size}）`);
      }
      for (const e of entries) console.log(`  ${e.kind.padEnd(16)} ${e.path}`);
      console.log(`✅ plan [${manifest.name}] — ${entries.length} files (nothing written)`);
      break;
    }
    let r;
    try {
      r = await apply({ canonicalFile: c, generatorDir: gen, outDir: o, options, concern });
    } catch (e) {
      die(`[FAIL] ${e.message}`);
    }
    console.log(`✅ generate [${r.name}] — ${r.total} planned · ${r.written} written · ${r.identical} identical`
      + (r.merged ? ` · ${r.merged} merged (MANUAL blocks preserved)` : '')
      + (r.routesNoTarget ? ` · ${r.routesNoTarget} routes block awaiting a target conf/routes` : '')
      + (concern ? ` · ${r.kept} kept (out-of-scope) · in-scope ${r.inScope} (closure +${r.closureAdded})` + (r.globalFlowed ? ` · ${r.globalFlowed} global flowed` : '') : ''));
    console.log(`   ledger → ${r.ledger}\n   anchors → ${r.anchors}`);
    break;
  }
  case 'init-generator': {
    const dir = process.argv[3];
    if (!dir) die('usage: truthsrc init-generator <dir>');
    const root = resolve(dir);
    mkdirSync(root, { recursive: true });
    for (const f of ['generator.json', 'generate.mjs'])
      copyFileSync(new URL(`../generators/_template/${f}`, import.meta.url), join(root, f));
    writeFileSync(join(root, 'generator.json'),
      readFileSync(join(root, 'generator.json'), 'utf8').replace('"name": "_template"', `"name": "${root.split('/').pop()}"`));
    console.log(`✅ generator scaffolded at ${root} — edit generate.mjs, then: truthsrc generate --generator ${root} --in <canonical> --out <dir>`);
    break;
  }
  default:
    process.stdout.write(USAGE);
    process.exit(cmd ? 2 : 0);
}
