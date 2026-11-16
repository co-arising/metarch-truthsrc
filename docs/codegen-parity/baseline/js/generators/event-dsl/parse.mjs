#!/usr/bin/env node
// ═══ tree → Spec parser (event) ═══
import { readFileSync, writeFileSync } from "fs";
const [yamlPath, bindingPath, outPath] = process.argv.slice(2);
const text = readFileSync(yamlPath, "utf8");
if (!/^type:\s*event/m.test(text)) { console.error("skip non-event: " + yamlPath); process.exit(2); }
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));
const payloadText = text.slice(text.indexOf("payload:") + 8).trim();
const payload = JSON.parse(payloadText);
const fieldKey = "fields";
const spec = {
  package: binding.package,
  name: payload.name,
  description: payload.description,
  fields: (payload.info[fieldKey] ?? []).map((f) => ({ name: f.name, dataType: f.dataType })),
};
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`parsed event ${spec.name}`);
