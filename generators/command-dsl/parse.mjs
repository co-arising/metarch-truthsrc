#!/usr/bin/env node
// ═══ tree → Spec parser (command) ═══
import { readFileSync, writeFileSync } from "fs";
const [yamlPath, bindingPath, outPath] = process.argv.slice(2);
const text = readFileSync(yamlPath, "utf8");
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));
const payloadText = text.slice(text.indexOf("payload:") + 8).trim();
const payload = JSON.parse(payloadText);
const fieldKey = "parameters";
const spec = {
  package: binding.package,
  name: payload.name,
  description: payload.description,
  fields: (payload.info[fieldKey] ?? []).map((f) => ({ name: f.name, dataType: f.dataType })),
};
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`parsed command ${spec.name}`);
