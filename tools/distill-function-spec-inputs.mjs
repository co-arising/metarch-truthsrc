#!/usr/bin/env node
// distill-function-spec-inputs.mjs — V4-22: distill the gen_function_specs inputs (BC
// knowledge_base/functions/functions.yaml + cases/*.yaml — the handwritten oracle tables) into
// the truthsrc sidecar JSON the scala-cqrs-es-function-specs generator consumes. The yaml
// parsing rides backend-codegen's `yaml` dep (truthsrc carries none); the sidecar is the
// committed golden copy — rerun this when the KB oracle tables change.
//
// Usage: node tools/distill-function-spec-inputs.mjs --functions <BC>/knowledge_base/functions/functions.yaml \
//          --cases <BC>/knowledge_base/functions/cases --out golden/scala-cqrs-es-metarch/function-spec-inputs.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const argOf = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const FUNCTIONS = argOf('--functions');
const CASES_DIR = argOf('--cases');
const OUT = argOf('--out');
if (!FUNCTIONS || !CASES_DIR || !OUT) {
  console.error('usage: distill-function-spec-inputs.mjs --functions <functions.yaml> --cases <dir> --out <sidecar.json>');
  process.exit(2);
}
const require = createRequire(path.resolve(FUNCTIONS));
const YAML = require('yaml');

const fnYaml = YAML.parse(fs.readFileSync(FUNCTIONS, 'utf8'));
const cases = fs.readdirSync(CASES_DIR).filter((f) => /\.ya?ml$/.test(f)).sort()
  .flatMap((f) => YAML.parse(fs.readFileSync(path.join(CASES_DIR, f), 'utf8')).cases ?? []);
// anchoredTo (`<type>:<name>`) → noteId — the same index gen_function_specs builds from metarch
const { pathToFileURL } = await import('node:url');
const loadMetarchPath = path.resolve(path.dirname(path.resolve(FUNCTIONS)), '../../tools/truthsrc/load.mjs');
const { loadMetarch } = await import(pathToFileURL(loadMetarchPath).href);
const noteIds = new Map();
for (const s of loadMetarch().sessions ?? [])
  for (const sc of s.scopes ?? [])
    for (const n of sc.notes ?? [])
      if (n.noteId && !noteIds.has(`${n.type}:${n.name}`)) noteIds.set(`${n.type}:${n.name}`, n.noteId);
const functions = (fnYaml.functions ?? []).map((f) => ({
  ...f,
  anchoredNoteId: noteIds.get(f.anchoredTo ?? '') ?? null,
}));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ functions, cases }, null, 2) + '\n');
console.log(`distilled ${functions.length} functions + ${cases.length} cases → ${OUT}`);
