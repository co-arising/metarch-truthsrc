#!/usr/bin/env node
// ═══ tree → MonarchSpec parser ═══
// Reads truth/pipelines/*.pipeline.yaml (v0.5 pipeline atom) and emits a
// MonarchSpec JSON for generators/monarch-dsl/emit.mjs.
//
// Honest boundary:
// - IN TREE: pipeline id, ordered steps, step ids/names, failure_semantics.
// - NOT IN TREE: state type shape, per-stage logic (intent). These come from
//   the --binding JSON (human/agent supplied) or emit as TODO.
//
// Usage: node parse.mjs <pipeline.yaml> <binding.json> <out.spec.json>

import { readFileSync, writeFileSync } from "fs";

const [pipelinePath, bindingPath, outPath] = process.argv.slice(2);
if (!pipelinePath || !bindingPath || !outPath) {
  console.error("usage: node parse.mjs <pipeline.yaml> <binding.json> <out.spec.json>");
  process.exit(1);
}

// Minimal YAML subset parser (pipeline atoms use a constrained shape).
function parsePipeline(text) {
  const id = text.match(/^id:\s*"?([^"\n]+)"?/m)?.[1].trim();
  const name = text.match(/^name:\s*"([^"]+)"/m)?.[1];
  // steps: [ { "id": "...", "name": "...", ... }, ... ]
  const stepsBlock = text.match(/^steps:\s*\n((?:  \[.*\n?)+)/m)?.[1] ?? "";
  const steps = [];
  const stepRe = /\{\s*"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"/g;
  let m;
  const stepsArrayText = text.slice(text.indexOf("steps:"));
  while ((m = stepRe.exec(stepsArrayText)) !== null) {
    steps.push({ id: m[1], name: m[2] });
  }
  return { id, name, steps };
}

const pipeline = parsePipeline(readFileSync(pipelinePath, "utf8"));
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));

function pascalCase(kebab) {
  return kebab
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

const spec = {
  name: binding.name ?? pipeline.id,
  package: binding.package,
  objectName: binding.objectName ?? pascalCase(pipeline.id) + "Run",
  stageType: binding.stageType ?? "RunStage",
  stateType: binding.stateType,
  stateFields: binding.stateFields,
  stages: pipeline.steps.map((s) => ({
    name: pascalCase(s.id),
    label: s.id, // stable label = tree step id (cursor vocabulary)
    logic:
      binding.stageLogic?.[s.id] ??
      `// TODO(intent): implement "${s.name}" — see pipeline step "${s.id}"`,
  })),
};

writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`parsed ${pipeline.id}: ${spec.stages.length} stages → ${outPath}`);
