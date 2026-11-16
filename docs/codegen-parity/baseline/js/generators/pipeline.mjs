#!/usr/bin/env node
/**
 * pipeline.mjs — new-baseline generation pipeline orchestrator.
 *
 * Replaces backend-codegen/tools/gen_pipeline.mjs (47KB, old baseline).
 *
 * Old pipeline (5 steps):
 *   CodegenMain → rules_domain_gen → gen_projection_handlers → gen_api_layer → gen_projection_ddl
 *
 * New pipeline (generators/ directory):
 *   Each *-dsl generator is independent: parse.mjs (tree → Spec) + emit.mjs (Spec → code).
 *   This orchestrator runs them in dependency order with staging support.
 *
 * Dependency order:
 *   1. valueobject-dsl, event-dsl, command-dsl (leaves — no dependencies)
 *   2. aggregate-dsl (depends on event/command)
 *   3. saga-dsl, monarch-dsl, policy-dsl, invariant-dsl (depend on aggregate)
 *   4. repository-dsl, projection-dsl, readmodel-dsl (depend on aggregate)
 *   5. service-dsl, connector-dsl, adapter-dsl, converter-dsl (depend on above)
 *   6. api-dsl, auth-dsl, bootstrap-dsl (wiring)
 *   7. ddl-dsl, proto-dsl, ts-types (artifacts)
 *
 * Modes:
 *   --staging <dir> (default): generate to staging, then review
 *   --direct: generate directly to target (no staging)
 *   --check: print plan without generating
 *
 * Safety (from old pipeline):
 *   - Territory enforcement: never overwrite files outside generated dirs
 *   - Manifest: record what was generated
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const has = (name) => args.includes(name);

const TREE = getArg("--tree", null);
const OUT = getArg("--out", null);
const STAGING = getArg("--staging", join(process.cwd(), ".staging"));
const DIRECT = has("--direct");
const CHECK = has("--check");
const BINDING_DIR = getArg("--binding", join(__dirname, "bindings"));

if (!TREE || !OUT) {
  console.error("usage: node pipeline.mjs --tree <tree-dir> --out <out-dir> [--staging <dir>] [--direct] [--check] [--binding <dir>]");
  process.exit(1);
}

// Generator execution order (dependencies first)
const ORDER = [
  // Level 1: leaves
  "valueobject-dsl", "event-dsl", "command-dsl",
  // Level 2: aggregates
  "aggregate-dsl",
  // Level 3: behaviors
  "saga-dsl", "monarch-dsl", "policy-dsl", "invariant-dsl",
  // Level 4: read side
  "repository-dsl", "projection-dsl", "readmodel-dsl",
  // Level 5: services
  "service-dsl", "connector-dsl", "adapter-dsl", "converter-dsl",
  // Level 6: wiring
  "api-dsl", "auth-dsl", "bootstrap-dsl",
  // Level 7: artifacts
  "ddl-dsl", "proto-dsl", "ts-types",
];

// Tree source mapping (which tree files feed which generator)
const SOURCES = {
  "valueobject-dsl": ["value-objects/*.vo.yaml"],
  "event-dsl": ["inbox/01-event-flow/*.yaml"],
  "command-dsl": ["inbox/02-commands/*.yaml"],
  "aggregate-dsl": ["aggregates/*/aggregate.yaml"],
  "saga-dsl": [], // kind: saga atoms (future)
  "monarch-dsl": ["pipelines/*.pipeline.yaml"],
  "policy-dsl": ["policies/*.policy.yaml"],
  "invariant-dsl": [], // binding-driven
  "repository-dsl": [], // binding-driven
  "projection-dsl": [], // binding-driven
  "readmodel-dsl": ["read-models/*.rm.yaml"],
  "service-dsl": [], // binding-driven
  "connector-dsl": [], // binding-driven
  "adapter-dsl": [], // binding-driven
  "converter-dsl": [], // binding-driven
  "api-dsl": [], // binding-driven
  "auth-dsl": [], // binding-driven
  "bootstrap-dsl": [], // binding-driven
  "ddl-dsl": [], // binding-driven
  "proto-dsl": [], // binding-driven
  "ts-types": [], // aggregates event/command specs
};

const targetDir = DIRECT ? OUT : STAGING;

if (CHECK) {
  console.log("═══ Pipeline plan (check mode) ═══");
  console.log(`Tree: ${TREE}`);
  console.log(`Out: ${OUT} (${DIRECT ? "direct" : "staging → " + STAGING})`);
  console.log(`\nExecution order (${ORDER.length} generators):`);
  ORDER.forEach((g, i) => {
    const src = SOURCES[g] || [];
    console.log(`  ${i + 1}. ${g}${src.length ? ` ← ${src.join(", ")}` : " (binding-driven)"}`);
  });
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

const manifest = { tree: TREE, out: targetDir, generators: [], timestamp: new Date().toISOString() };

for (const gen of ORDER) {
  const genDir = join(__dirname, gen);
  if (!existsSync(join(genDir, "emit.mjs"))) {
    manifest.generators.push({ name: gen, status: "skip", reason: "no emit.mjs" });
    continue;
  }
  // For now, delegate to run-all.mjs for tree-driven generators
  // Binding-driven generators need explicit specs
  manifest.generators.push({ name: gen, status: "queued" });
}

const manifestPath = join(targetDir, "pipeline-manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nPipeline manifest: ${manifestPath}`);
console.log(`Generators: ${ORDER.length} (see run-all.mjs for tree-driven execution)`);
console.log(`\nNext: review ${targetDir}, then copy to ${OUT} (or use --direct)`);
