#!/usr/bin/env node
// ═══ tree → PolicySpec parser ═══
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
const pascal = (s) => s.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const spec = {
  package: binding.package,
  name: payload.name,
  objectName: pascal(payload.id || payload.name) + "Policy",
  description: payload.description,
  triggers: (payload.info.triggers || []).map(t => pascal(t.event)),
  invokes: (payload.info.invokes || []).map(c => pascal(c.command)),
  rules: binding.rules || [],
};
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log("parsed policy " + payload.name);
