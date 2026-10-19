#!/usr/bin/env node
// === proto-dsl emitter — 1:1 restoration of old codegen ===
// Generates: .proto file for protobuf
// Usage: node emit.mjs <spec.json> <out.proto>

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const packageName = spec.protoPackage || "net.imadz.infrastructure.proto";

const messages = (spec.messages || []).map(m => {
  const fields = (m.fields || []).map((f, i) =>
    `  ${f.type} ${f.name} = ${i + 1};`
  ).join("\n");
  return `message ${m.name} {
${fields}
}`;
}).join("\n\n");

const out = `syntax = "proto3";

package ${packageName};

${messages}
`;

writeFileSync(outPath, out);
console.log(`emitted ${outPath}`);
