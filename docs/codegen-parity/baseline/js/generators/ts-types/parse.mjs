#!/usr/bin/env node
// ═══ tree → TS Spec parser ═══
// Combines event/command specs into a TS definitions spec.
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
const [dir, outPath] = process.argv.slice(2);
const definitions = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".spec.json")) continue;
  const spec = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (spec.name && spec.fields) {
    definitions.push({name: spec.name, description: spec.description, fields: spec.fields});
  }
}
writeFileSync(outPath, JSON.stringify({source: dir, definitions}, null, 2));
console.log("combined " + definitions.length + " definitions");
