#!/usr/bin/env node
// ═══ run-all.mjs v2 — toolchain-driven pipeline ═══
// Uses lib/compile.mjs (compileTree) — NEVER hand-glob directories.
// The toolchain knows the canonical layout; we consume its output.
//
// Pipeline: tree → compileTree → canonical JSON → generators
//
// Usage: node run-all.mjs <tree-dir> <out-dir> [--binding <dir>]

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { compileTree } from "../lib/compile.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const [treeDir, outDir, ...rest] = process.argv.slice(2);
const bindingDir = rest.includes("--binding")
  ? rest[rest.indexOf("--binding") + 1]
  : join(__dirname, "bindings");

if (!treeDir || !outDir) {
  console.error("usage: node run-all.mjs <tree-dir> <out-dir> [--binding <dir>]");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// ── Step 1: compile tree via toolchain ──
console.log("compiling tree via lib/compile.mjs...");
const canonicalJson = compileTree(treeDir);
const canonical = JSON.parse(canonicalJson);
console.log(`  schema: ${canonical.schemaVersion}, workshop: ${canonical.workshop}`);

// ── Step 2: extract atoms by kind from canonical ──
const notes = [];
for (const session of canonical.sessions || []) {
  for (const scope of session.scopes || []) {
    for (const note of scope.notes || []) {
      notes.push(note);
    }
  }
}
console.log(`  total notes: ${notes.length}`);

const byType = (t) => notes.filter((n) => n.type === t);
const events = byType("event");
const commands = byType("command");
console.log(`  events: ${events.length}, commands: ${commands.length}`);
console.log(`  aggregates: ${(canonical.aggregates || []).length}`);
console.log(`  policies: ${byType("policy").length}`);
console.log(`  readModels: ${(canonical.readModels || []).length}`);
console.log(`  valueObjects: ${(canonical.valueObjects || []).length}`);
console.log(`  pipelines: ${(canonical.pipelines || []).length}`);

// ── Step 3: run generators ──
const results = [];

function runGen(gen, items, outSubdir, toSpec) {
  const genDir = join(__dirname, gen);
  const emitJs = join(genDir, "emit.mjs");
  if (!existsSync(emitJs)) {
    results.push({ gen, status: "skip", reason: "no emit.mjs" });
    return;
  }
  const out = join(outDir, outSubdir);
  mkdirSync(out, { recursive: true });
  let count = 0;
  items.forEach((item, i) => {
    try {
      const spec = toSpec(item);
      const specPath = join(out, `.spec-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      const codeOut = join(out, `out-${i}.scala`);
      execSync(`node "${emitJs}" "${specPath}" "${codeOut}"`, { stdio: "pipe" });
      count++;
    } catch (e) {
      results.push({ gen, status: "error", error: e.message.slice(0, 200) });
      return;
    }
  });
  results.push({ gen, status: "ok", count });
}

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join("");
const scalaType = (t) =>
  ({ string: "string", number: "number", integer: "integer", long: "long", boolean: "boolean", timestamp: "long" })[t] || "string";

runGen("event-dsl", events, "events", (n) => ({
  package: "generated.event",
  name: pascal(n.name),
  description: n.description || "",
  fields: (n.info?.fields || n.fields || []).map((f) => ({ name: f.name, dataType: scalaType(f.dataType) })),
}));

runGen("command-dsl", commands, "commands", (n) => ({
  package: "generated.command",
  name: pascal(n.name),
  description: n.description || "",
  fields: (n.info?.parameters || n.parameters || []).map((f) => ({ name: f.name, dataType: scalaType(f.dataType) })),
}));

runGen("aggregate-dsl", canonical.aggregates || [], "aggregates", (a) => ({
  package: "generated.aggregate",
  name: a.name,
  objectName: pascal(a.entity || a.name),
  stateType: pascal(a.entity || a.name) + "State",
  commandType: pascal(a.entity || a.name) + "Command",
  eventType: pascal(a.entity || a.name) + "Event",
  stateFields: (a.stateFields || []).map((f) => ({ name: f.name, dataType: scalaType(f.dataType) })),
  emptyState: "???",
  commands: [],
  events: [],
  statusTransitions: a.statusTransitions || {},
  commandHandlers: [],
}));

runGen("policy-dsl", byType("policy"), "policies", (n) => ({
  package: "generated.policy",
  name: n.name,
  objectName: pascal(n.id || n.name) + "Policy",
  description: n.description || "",
  triggers: [],
  invokes: [],
  rules: [],
}));

runGen("readmodel-dsl", canonical.readModels || [], "readmodels", (r) => ({
  package: "generated.readmodel",
  name: r.name,
  viewType: pascal(r.id || r.name),
  objectName: pascal(r.id || r.name) + "View",
  servedBy: r.served_by || "",
  sources: r.sources || [],
  fields: (r.fields || []).slice(0, 10).map((f) => ({ name: f.name.replace(/\./g, "_"), dataType: scalaType(f.dataType) })),
}));

runGen("valueobject-dsl", canonical.valueObjects || [], "valueobjects", (v) => ({
  package: "generated.valueobject",
  name: pascal(v.name),
  description: v.description || "",
  fields: (v.fields || []).map((f) => ({ name: f.name, dataType: scalaType(f.dataType) })),
}));

runGen("monarch-dsl", canonical.pipelines || [], "pipelines", (p) => ({
  ...p,
  package: "generated.monarch",
}));

console.log("\n═══ run-all v2 results (toolchain-driven) ═══");
for (const r of results) {
  console.log(`  ${r.gen}: ${r.status}${r.count !== undefined ? ` (${r.count} files)` : ""}${r.reason ? ` — ${r.reason}` : ""}`);
}
const ok = results.filter((r) => r.status === "ok").length;
console.log(`\n${ok}/${results.length} generators ok`);
