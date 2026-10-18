#!/usr/bin/env node
// ═══ tree → SagaSpec parser ═══
// Reads a `kind: saga` atom YAML and emits a SagaSpec JSON for
// generators/saga-dsl/emit.mjs.
//
// Honest boundary (see saga.atom.md):
// - IN TREE: saga id, ordered steps, phases→commands, resilience, types.
// - NOT IN TREE: command argument expressions, preCheck/mapReply logic,
//   protocol definitions. These come from --binding JSON or emit as TODO.
//
// Usage: node parse.mjs <saga.yaml> <binding.json> <out.spec.json>

import { readFileSync, writeFileSync } from "fs";

const [sagaPath, bindingPath, outPath] = process.argv.slice(2);
if (!sagaPath || !bindingPath || !outPath) {
  console.error("usage: node parse.mjs <saga.yaml> <binding.json> <out.spec.json>");
  process.exit(1);
}

const text = readFileSync(sagaPath, "utf8");
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));

function field(re) {
  return text.match(re)?.[1]?.trim();
}

// Minimal parse: top-level scalar fields + steps with phases.
const id = field(/^id:\s*"?([^"\n]+)"?/m);
const argsType = field(/^args_type:\s*"?([^"\n]+)"?/m);
const errorType = field(/^error_type:\s*"?([^"\n]+)"?/m) ?? "String";
const contextType = field(/^context_type:\s*"?([^"\n]+)"?/m);

// Extract steps: "- id: X" blocks with nested phases.
const steps = [];
const stepBlocks = text.split(/^\s*-\s+id:\s*/m).slice(1);
for (const block of stepBlocks) {
  const stepId = block.match(/^"?([^"\n]+)"?/)?.[1].trim();
  const participantRef =
    block.match(/participant_ref:\s*"?([^"\n]+)"?/)?.[1].trim() ??
    binding.participantRef;
  const maxRetries =
    parseInt(block.match(/max_retries:\s*(\d+)/)?.[1] ?? "3", 10);
  const phases = {};
  for (const ph of ["prepare", "commit", "compensate"]) {
    const phBlock = block.match(
      new RegExp(`${ph}:\\s*\\n((?:\\s+\\w+:.*\\n?)+)`)
    )?.[1];
    if (phBlock) {
      phases[ph] = {
        command: phBlock.match(/command:\s*"?([^"\n]+)"?/)?.[1].trim(),
        replyType: phBlock.match(/reply_type:\s*"?([^"\n]+)"?/)?.[1].trim(),
        // Argument expressions come from binding (command signatures).
        commandArgs: binding.commandArgs?.[phBlock.match(/command:\s*"?([^"\n]+)"?/)?.[1].trim()] ?? [
          "txId",
          "replyTo",
        ],
      };
    }
  }
  steps.push({ id: stepId, participantRef, maxRetries, phases });
}

const spec = {
  name: id,
  version: binding.version ?? 1,
  package: binding.package,
  objectName: binding.objectName,
  errorType,
  contextType,
  participantRef: binding.participantRef,
  protocolType: binding.protocolType,
  argsType,
  argsFields: binding.argsFields,
  mapReply: binding.mapReply,
  preCheck: binding.preCheck,
  preCheckError: binding.preCheckError,
  errorCode: binding.errorCode,
  prelude: binding.prelude,
  helpers: binding.helpers,
  steps: steps.map((s) => ({
    id: s.id,
    group: 1,
    maxRetries: s.maxRetries,
    phases: s.phases,
  })),
};

writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`parsed saga ${id}: ${steps.length} steps → ${outPath}`);
