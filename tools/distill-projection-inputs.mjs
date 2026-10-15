#!/usr/bin/env node
// distill-projection-inputs.mjs — distill the projection face's two NON-DERIVABLE inputs
// from the live tree into golden sidecars (porting/fixture aid, NOT shipped).
//
// The projection face's handlers are skeleton + a MANUAL block. Most blocks are mechanically
// derived from metadata referenceCodes (the gen_projection_handlers port), but 53 carry
// HANDWRITTEN content preserved by the live pipeline's MERGE semantics (R10/S2-72 comment
// style — no canonical input derives those bytes). The skeleton side itself is derivable;
// the MANUAL text of the non-mechanical blocks is not. This script carries them verbatim:
//   • manual-blocks.json: { "<Handler>.scala": "<manual block text between the markers>" }
//   • proto-fields.json:  { "<Event>PO": { "<camelField>": "<protoType>" } } — the PO field
//     whitelist/type table the rewriter guards with (staging app/protobuf scan analogue).
//
// Usage: node tools/distill-projection-inputs.mjs [--live /path/to/ingested-app]
import fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
};
const LIVE = resolve(argOf('--live', '/Users/zhongdj/Workspaces/ingested-app'));
const OUT = join(ROOT, 'golden', 'scala-cqrs-es-projection-metarch');
fs.mkdirSync(OUT, { recursive: true });

const B = '// ==== BEGIN MANUAL ====';
const E = '// ==== END MANUAL ====';

// --- manual blocks ---------------------------------------------------------------------------
const handlersDir = join(LIVE, 'app/net/imadz/metarch/application/projection/handlers');
const manualBlocks = {};
let noMarkers = 0;
for (const f of fs.readdirSync(handlersDir).filter((x) => x.endsWith('.scala')).sort()) {
  const src = fs.readFileSync(join(handlersDir, f), 'utf8');
  const b = src.indexOf(B);
  const e = src.indexOf(E);
  if (b < 0 || e < 0) { noMarkers += 1; continue; }
  // content strictly between the marker texts. The rewriter writes `        ${E}` — the text
  // between markers always ends with "\n        " (newline + the END marker's 8-space indent);
  // strip it here, the renderer re-adds it.
  const inner0 = src.slice(b + B.length, e);
  const trimmed = inner0.endsWith('\n        ') ? inner0.slice(0, -'\n        '.length)
    : inner0.endsWith('\n') ? inner0.slice(0, -1) : inner0;
  // the leading newline stays: most blocks begin `\n        // …` (renderer emits the raw
  // text right after `==== BEGIN MANUAL ====`), but a few handwritten blocks are ATTACHED to
  // the marker line (`==== BEGIN MANUAL ====（批次一…）`) — both ride the sidecar verbatim.
  manualBlocks[f] = trimmed;
}
fs.writeFileSync(join(OUT, 'manual-blocks.json'), JSON.stringify(manualBlocks, null, 2) + '\n');

// --- proto field whitelist / types ------------------------------------------------------------
const protoDir = join(LIVE, 'app/protobuf');
const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const poFields = {};
for (const pf of fs.readdirSync(protoDir).filter((x) => x.endsWith('.proto'))) {
  const txt = fs.readFileSync(join(protoDir, pf), 'utf8');
  for (const m of txt.matchAll(/message\s+(\w+PO)\s*\{([\s\S]*?)\n\}/g)) {
    const fields = {};
    for (const f of m[2].matchAll(/^\s*(?:repeated\s+|optional\s+|required\s+)?([\w.<>\[\]]+)\s+(\w+)\s*=\s*\d+/gm)) {
      fields[snakeToCamel(f[2])] = f[1];
    }
    poFields[m[1]] = fields;
  }
}
fs.writeFileSync(join(OUT, 'proto-fields.json'), JSON.stringify(poFields, null, 2) + '\n');

console.log(`[distill-projection] manualBlocks=${Object.keys(manualBlocks).length} (no markers: ${noMarkers}) protoMessages=${Object.keys(poFields).length} → ${OUT}`);
