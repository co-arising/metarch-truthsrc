#!/usr/bin/env node
// compare-projection.mjs — dev loop: run the projection generator over the corpus canonical
// and diff every emitted file against the live tree (byte-exact). Reports per-kind pass/fail
// + the MANUAL derived-vs-sidecar split + first-diff excerpts. NOT a shipped gate (the corpus
// harness owns the measured comparison) — this is the porting iteration tool.
import fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const LIVE = resolve(argOf('--live', '/Users/zhongdj/Workspaces/ingested-app'));
const CANON = resolve(argOf('--canonical', join(ROOT, 'golden/scala-cqrs-es-metarch/full-corpus.canonical.json')));
const HASHES = resolve(argOf('--hashes', join(ROOT, 'golden/scala-cqrs-es-metarch/full-corpus.elementHashes.json')));
const MAX = Number(argOf('--max', '6'));
const ONLY = argOf('--only', '');

const canonical = JSON.parse(fs.readFileSync(CANON, 'utf8'));
const options = {
  elementHashes: JSON.parse(fs.readFileSync(HASHES, 'utf8')),
  manualBlocks: JSON.parse(fs.readFileSync(join(ROOT, 'golden/scala-cqrs-es-projection-metarch/manual-blocks.json'), 'utf8')),
  protoFields: JSON.parse(fs.readFileSync(join(ROOT, 'golden/scala-cqrs-es-projection-metarch/proto-fields.json'), 'utf8')),
  staleGenerations: JSON.parse(fs.readFileSync(join(ROOT, 'golden/scala-cqrs-es-projection-metarch/stale-generations.json'), 'utf8')),
};

const { generate } = await import(pathToFileURL(join(ROOT, 'generators/scala-cqrs-es-projection/generate.mjs')).href);

// MANUAL split accounting (renderHandler logs one [manual] line per handler)
let derived = 0, sidecar = 0;
const realError = console.error;
process.env.TRUTHSRC_MANUAL_REPORT = '1';
console.error = (...a) => {
  const s = String(a[0] ?? '');
  if (s.startsWith('[manual] ')) (s.endsWith(': derived') ? derived++ : sidecar++);
  else realError(...a);
};
const entries = generate({ canonical, products: {}, options, manifest: { name: 'scala-cqrs-es-projection', artifactKinds: ['projection-def', 'projection-handler', 'projection-repository', 'projection-repository-impl'] } });
console.error = realError;

const byKind = {};
let ok = 0, diff = 0, missing = 0;
const excerpts = [];
for (const e of entries) {
  if (ONLY && !e.path.includes(ONLY)) continue;
  const livePath = join(LIVE, e.path);
  (byKind[e.kind] ??= { ok: 0, diff: 0, missing: 0 });
  if (!fs.existsSync(livePath)) {
    missing++; byKind[e.kind].missing++;
    if (excerpts.length < MAX) excerpts.push(`MISSING LIVE: ${e.path}`);
    continue;
  }
  const want = fs.readFileSync(livePath, 'utf8');
  if (e.content === want) { ok++; byKind[e.kind].ok++; continue; }
  diff++; byKind[e.kind].diff++;
  if (excerpts.length < MAX * 4) {
    const a = e.content, b = want;
    let i = 0; const n = Math.min(a.length, b.length);
    while (i < n && a[i] === b[i]) i++;
    const lineStart = a.lastIndexOf('\n', i) + 1;
    const lineNo = a.slice(0, lineStart).split('\n').length;
    excerpts.push(`DIFF ${e.path} @line ${lineNo} byte ${i}/${a.length} vs ${b.length}\n  got:  ${JSON.stringify(a.slice(Math.max(0, i - 30), i + 140))}\n  want: ${JSON.stringify(b.slice(Math.max(0, i - 30), i + 140))}`);
  }
}
console.log(`entries=${entries.length} identical=${ok} diff=${diff} live-missing=${missing}`);
for (const [k, v] of Object.entries(byKind)) console.log(`  ${k}: ok=${v.ok} diff=${v.diff} missing=${v.missing}`);
console.log(`MANUAL: derived=${derived} sidecar=${sidecar} (total ${derived + sidecar})`);
if (process.argv.includes('--list')) {
  for (const e of entries) {
    if (ONLY && !e.path.includes(ONLY)) continue;
    const livePath = join(LIVE, e.path);
    if (fs.existsSync(livePath) && fs.readFileSync(livePath, 'utf8') !== e.content) console.log(`DIFF ${e.path}`);
    else if (!fs.existsSync(livePath)) console.log(`MISSING ${e.path}`);
  }
}
for (const x of excerpts) console.log(`\n${x}`);
