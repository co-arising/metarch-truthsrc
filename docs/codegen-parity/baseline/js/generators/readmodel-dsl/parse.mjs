#!/usr/bin/env node
// ═══ tree → ReadModelSpec parser ═══
import { readFileSync, writeFileSync } from "fs";
const [yamlPath, bindingPath, outPath] = process.argv.slice(2);
const text = readFileSync(yamlPath, "utf8");
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));
const pStart = text.indexOf("payload:") + 8;
const pText = text.slice(pStart).trim();
let depth = 0, pEnd = 0;
for (let i = 0; i < pText.length; i++) {
  if (pText[i] === "{") depth++;
  if (pText[i] === "}") { depth--; if (depth === 0) { pEnd = i + 1; break; } }
}
const payload = JSON.parse(pText.slice(0, pEnd));
const pascal = (s) => s.split(/[-_ ]/).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const spec = {
  package: binding.package,
  name: payload.name,
  viewType: pascal(payload.id || payload.name),
  objectName: pascal(payload.id || payload.name) + "View",
  servedBy: payload.served_by,
  sources: payload.sources || [],
  fields: (payload.fields || []).slice(0, 5).map(f => ({name: f.name, dataType: f.dataType})),
};
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log("parsed read-model " + payload.name);
