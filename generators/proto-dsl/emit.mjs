#!/usr/bin/env node
// === proto-dsl emitter v2 — ingested-app 1:1 ===
// Generates: <snake_name>.proto with:
//   - <Event>PO message per event
//   - <Event>PO wrapper with oneof event { ... }
//   - <State>PO message
// Matches: app/protobuf/subdomain.proto (golden scala-cqrs-es-metarch)
// Usage: node emit.mjs <spec.json> <out.proto>
//
// Spec: {
//   protoPackage: "net.imadz.metarch.infrastructure.proto",
//   aggregateName: "Subdomain",          // PascalCase
//   stateFields: [{name, dataType}],     // canonical dataTypes
//   events: [{name, fields: [{name, dataType}]}]
// }
// Legacy spec {messages: [{name, fields: [{name, type}]}]} still supported.

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const packageName = spec.protoPackage || "net.imadz.infrastructure.proto";

const protoType = (t) =>
  ({ string: "string", number: "double", integer: "int32", long: "int64", boolean: "bool", timestamp: "int64" })[t] ?? "string";

const camel = (s) => s[0].toLowerCase() + s.slice(1);

let out;
if (spec.aggregateName) {
  // v2: aggregate-driven
  const agg = spec.aggregateName;
  const fieldLines = (fields) =>
    (fields || []).map((f, i) => `  ${protoType(f.dataType)} ${f.name} = ${i + 1};`).join("\n");

  const eventPOs = (spec.events || [])
    .map((e) => `message ${e.name}PO {\n${fieldLines(e.fields)}\n}`)
    .join("\n\n");

  const oneofFields = (spec.events || [])
    .map((e, i) => `    ${e.name}PO ${camel(e.name)} = ${i + 1};`)
    .join("\n");

  const eventWrapper = `message ${agg}EventPO {\n  oneof event {\n${oneofFields}\n  }\n}`;

  const statePO = `message ${agg}StatePO {\n${fieldLines(spec.stateFields)}\n}`;

  out = `syntax = "proto3";

package ${packageName};

option java_multiple_files = true;

${eventPOs}

${eventWrapper}

${statePO}
`;
} else {
  // legacy: flat messages list
  const messages = (spec.messages || []).map(m => {
    const fields = (m.fields || []).map((f, i) =>
      `  ${f.type} ${f.name} = ${i + 1};`
    ).join("\n");
    return `message ${m.name} {\n${fields}\n}`;
  }).join("\n\n");

  out = `syntax = "proto3";

package ${packageName};

${messages}
`;
}

writeFileSync(outPath, out);
console.log(`emitted ${outPath}`);
