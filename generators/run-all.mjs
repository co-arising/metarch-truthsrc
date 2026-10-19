#!/usr/bin/env node
// ═══ run-all.mjs — integration pipeline: tree → all code ═══
// Runs all new-baseline generators against a truth tree.
//
// Usage: node run-all.mjs <tree-dir> <out-dir> [--binding <binding-dir>]
//
// For each generator:
//   1. Find relevant tree files
//   2. parse.mjs → Spec JSON
//   3. emit.mjs → code
//
// Generators without a tree parser use binding directly.

import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const [treeDir, outDir, ...rest] = process.argv.slice(2);
const bindingDir = rest[rest.indexOf("--binding") + 1] || join(__dirname, "bindings");

if (!treeDir || !outDir) {
  console.error("usage: node run-all.mjs <tree-dir> <out-dir> [--binding <binding-dir>]");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const results = [];

function run(gen, treeFiles, bindingFile, outSubdir, multiOut = false) {
  const genDir = join(__dirname, gen);
  const parseJs = join(genDir, "parse.mjs");
  const emitJs = join(genDir, "emit.mjs");
  const out = join(outDir, outSubdir);
  mkdirSync(out, { recursive: true });

  if (!existsSync(parseJs) || !existsSync(emitJs)) {
    results.push({ gen, status: "skip", reason: "missing parse/emit" });
    return;
  }

  let count = 0;
  for (const treeFile of treeFiles) {
    const specPath = join(out, ".spec-" + count + ".json");
    const codeOut = multiOut ? join(out, "out-" + count) : join(out, "out-" + count + ".scala");
    try {
      execSync(`node "${parseJs}" "${treeFile}" "${bindingFile}" "${specPath}"`, { stdio: "pipe" });
      execSync(`node "${emitJs}" "${specPath}" "${codeOut}"`, { stdio: "pipe" });
      count++;
    } catch (e) {
      results.push({ gen, status: "error", file: treeFile, error: e.message.slice(0, 200) });
      return;
    }
  }
  results.push({ gen, status: "ok", count });
}

function glob(dir, pattern) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) out.push(...glob(p, pattern));
    else if (pattern.test(f.name)) out.push(p);
  }
  return out;
}

const B = (n) => join(bindingDir, n);

// 1. Events: truth/inbox/01-event-flow/*.yaml
run("event-dsl", glob(join(treeDir, "inbox/01-event-flow"), /\.yaml$/), B("event.json"), "events");
// 2. Commands: truth/inbox/02-commands/*.yaml
run("command-dsl", glob(join(treeDir, "inbox/02-commands"), /\.yaml$/), B("command.json"), "commands");
// 3. Aggregates: truth/aggregates/*/aggregate.yaml
run("aggregate-dsl", glob(join(treeDir, "aggregates"), /^aggregate\.yaml$/), B("aggregate.json"), "aggregates");
// 4. Policies: truth/policies/*.policy.yaml
run("policy-dsl", glob(join(treeDir, "policies"), /\.policy\.yaml$/), B("policy.json"), "policies");
// 5. Read models: truth/read-models/*.rm.yaml
run("readmodel-dsl", glob(join(treeDir, "read-models"), /\.rm\.yaml$/), B("readmodel.json"), "readmodels");
// 6. Pipelines (monarch): truth/pipelines/*.pipeline.yaml
run("monarch-dsl", glob(join(treeDir, "pipelines"), /\.pipeline\.yaml$/), B("monarch.json"), "pipelines");
// 7. Value objects: truth/value-objects/*.vo.yaml
run("valueobject-dsl", glob(join(treeDir, "value-objects"), /\.vo\.yaml$/), B("valueobject.json"), "valueobjects");

// Summary
console.log("\n═══ run-all results ═══");
for (const r of results) {
  console.log(`  ${r.gen}: ${r.status}${r.count !== undefined ? ` (${r.count} files)` : ""}${r.reason ? ` — ${r.reason}` : ""}${r.error ? ` — ${r.error}` : ""}`);
}
const ok = results.filter((r) => r.status === "ok").length;
const err = results.filter((r) => r.status === "error").length;
console.log(`\n${ok} ok, ${err} errors, ${results.length - ok - err} skipped`);
