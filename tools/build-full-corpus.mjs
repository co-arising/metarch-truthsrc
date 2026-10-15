#!/usr/bin/env node
// build-full-corpus.mjs — assemble the FULL-CORPUS canonical fixture (all fieldTree aggregates,
// not just ModelCatalog/Subdomain) by driving the three existing single-aggregate fixture CLIs:
//
//   for each aggregate:  extract-metarch-canonical  →  augment-rules-canonical
//   then: merge the 27 single-aggregate canonicals  →  augment-api-canonical (global slots, once)
//
// Pure orchestration — zero extraction logic here. The self-check at the end deep-equals the
// merged ModelCatalog fragment against the proven single-aggregate golden canonical
// (golden/scala-cqrs-es-metarch/model-catalog.canonical.json), so a wrong input copy (e.g. the
// engineering-domain generated_rules.json sibling) cannot pass silently.
//
// Usage:
//   node tools/build-full-corpus.mjs \
//     --export     <backend-codegen>/out/kn-system-metadata-v55.json \
//     --metarch    <backend-codegen>/out/truthsrc/metarch.json \
//     --rules      <backend-codegen>/knowledge_base/design_docs/field_template/generated_rules.json \
//     --cases      <backend-codegen>/knowledge_base/design_docs/field_template/story/executable_cases.json \
//     --functions  <backend-codegen>/knowledge_base/functions/functions.yaml \
//     --values     <ingested-app>/app/net/imadz/metarch/domain/values \
//     --readmodels <backend-codegen>/out/truthsrc/story.readmodels.json \
//     --rename-map <backend-codegen>/knowledge_base/design_docs/field_template/tools/viewkey_rename_map.json \
//     --template   <backend-codegen>/out/truthsrc/metarch.fields.template.json \
//     --out golden/scala-cqrs-es-metarch/full-corpus.canonical.json

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = join(ROOT, 'tools');
const req = ['export', 'metarch', 'rules', 'cases', 'functions', 'values', 'readmodels', 'rename-map', 'template', 'out'];
const missing = req.filter((k) => !arg(k));
if (missing.length) {
  console.error(`missing required args: ${missing.map((k) => `--${k}`).join(' ')}`);
  process.exit(2);
}

const run = (tool, args, label) => {
  const r = spawnSync(process.execPath, [join(TOOLS, tool), ...args], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`[FAIL] ${label} (${tool}) exit ${r.status}\n${r.stdout ?? ''}${r.stderr ?? ''}`);
    process.exit(1);
  }
};

// --- aggregate roster: fieldTree order (deterministic, mirrors the live generator's traversal) --
const exp = JSON.parse(fs.readFileSync(arg('export'), 'utf8'));
const aggNames = (exp.fieldTree?.aggregates ?? []).map((a) => a.name);
if (!aggNames.length) { console.error('no fieldTree.aggregates in export'); process.exit(2); }

// --- behaviorModel: the ④-layer decisions live at sessions[*].scopes[*].behaviorModel ----------
// Shape needed by augment-rules: { aggregates: [{ name, decisions: [...] }] }. Merge every
// scope that carries one, first-wins per aggregate (the provenance has exactly one today).
const metarch = JSON.parse(fs.readFileSync(arg('metarch'), 'utf8'));
const bmByAgg = new Map();
let bmScopes = 0;
for (const s of Object.values(metarch.sessions ?? {})) {
  for (const sc of Object.values(s?.scopes ?? {})) {
    if (!sc?.behaviorModel?.aggregates) continue;
    bmScopes++;
    for (const a of sc.behaviorModel.aggregates) if (!bmByAgg.has(a.name)) bmByAgg.set(a.name, a);
  }
}
if (!bmScopes) { console.error('no behaviorModel scope found in metarch'); process.exit(2); }
const behavior = { aggregates: aggNames.map((n) => bmByAgg.get(n)).filter(Boolean) };
const uncovered = aggNames.filter((n) => !bmByAgg.has(n));
if (uncovered.length) console.error(`[warn] aggregates without behaviorModel: ${uncovered.join(',')}`);

// --- per-aggregate: extract → augment-rules, in a scratch dir ----------------------------------
const scratch = mkdtempSync(join(tmpdir(), 'truthsrc-full-corpus-'));
const canonicals = [];
for (const name of aggNames) {
  const per = join(scratch, `${name}.canonical.json`);
  const perHashes = join(scratch, `${name}.elementHashes.json`);
  run('extract-metarch-canonical.mjs', [
    '--export', arg('export'), '--aggregate', name, '--out', per, '--hashes', perHashes,
  ], `extract ${name}`);
  run('augment-rules-canonical.mjs', [
    '--aggregate', name, '--canonical', per,
    '--rules', arg('rules'), '--cases', arg('cases'), '--behavior', behaviorPath(scratch),
    '--functions', arg('functions'), '--values', arg('values'), '--metarch', arg('metarch'),
  ], `augment-rules ${name}`);
  canonicals.push(JSON.parse(fs.readFileSync(per, 'utf8')));
}
function behaviorPath(dir) {
  const p = join(dir, 'behaviorModel.json');
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(behavior));
  return p;
}

// --- merge: canonical-level frame from the first fragment, aggregates in fieldTree order --------
const merged = canonicals[0];
merged.aggregates = canonicals.map((c) => c.aggregates[0]);
// identical-by-construction canonical-level slots set per-fragment by augment-rules — keep #0's.
const outPath = resolve(arg('out'));
fs.mkdirSync(dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n');
const hashesPath = join(dirname(outPath), 'full-corpus.elementHashes.json');
fs.writeFileSync(hashesPath, JSON.stringify(exp.elementHashes ?? {}, null, 2) + '\n');

// --- global api slots, once, on the merged canonical --------------------------------------------
run('augment-api-canonical.mjs', [
  '--canonical', outPath, '--metarch', arg('metarch'), '--readmodels', arg('readmodels'),
  '--rename-map', arg('rename-map'), '--template', arg('template'),
], 'augment-api merged');

// --- self-check: ModelCatalog fragment must equal the proven single-aggregate golden ------------
const refPath = join(ROOT, 'golden', 'scala-cqrs-es-metarch', 'model-catalog.canonical.json');
const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
const refAgg = ref.aggregates.find((a) => a.name === 'ModelCatalog');
const gotAgg = merged.aggregates.find((a) => a.name === 'ModelCatalog');
if (JSON.stringify(refAgg) !== JSON.stringify(gotAgg)) {
  console.error('[FAIL] self-check: merged ModelCatalog fragment ≠ golden model-catalog.canonical.json fragment (wrong input copy or extractor drift)');
  rmSync(scratch, { recursive: true, force: true });
  process.exit(1);
}

rmSync(scratch, { recursive: true, force: true });
console.log(`full corpus: ${merged.aggregates.length} aggregates (${bmScopes} behaviorModel scope(s)) → ${outPath}`);
console.log(`elementHashes sidecar: ${Object.keys(exp.elementHashes ?? {}).length} entries → ${hashesPath}`);
console.log('self-check ✅ ModelCatalog fragment ≡ golden model-catalog.canonical.json');
