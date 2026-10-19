#!/usr/bin/env node
// ═══ ts-types emitter — Spec → TypeScript ═══
// Emits TypeScript interfaces from event/command/aggregate specs.
import { readFileSync, writeFileSync } from "fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const tsType = (t) => ({string:"string",number:"number",integer:"number",long:"number",boolean:"boolean",timestamp:"number",object:"Record<string, unknown>"})[t] || "string";
const defs = (spec.definitions || []).map(d => {
  const fields = (d.fields || []).map(f => "  " + f.name + ": " + tsType(f.dataType) + ";").join("\n");
  return "/** " + d.description + " */\nexport interface " + d.name + " {\n" + fields + "\n}";
}).join("\n\n");
const out = "// Generated from " + spec.source + "\n// Generator: generators/ts-types/emit.mjs\n\n" + defs + "\n";
writeFileSync(outPath, out);
console.log("emitted " + outPath);
