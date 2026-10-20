#!/usr/bin/env node
// === proto-dsl emitter v3 — ingested-app 1:1 ===
// Generates: <snake_name>.proto with:
//   - <Event>PO message per event (alphabetical by event name)
//   - <Event>PO wrapper with oneof event { ... } (same order)
//   - <State>PO message
// Matches: app/protobuf/concept.proto (golden ingested-app)
// Usage: node emit.mjs <spec.json> <out.proto>
//
// Spec: {
//   protoPackage: "net.imadz.metarch.infrastructure.proto",
//   aggregateName: "Concept",            // PascalCase
//   stateFields: [{name, dataType}],     // RAW dataTypes
//   events: [{name, fields: [{name, dataType (RAW), noteId}]}]
// }
// Legacy spec {messages: [{name, fields: [{name, type}]}]} still supported.

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const packageName = spec.protoPackage || "net.imadz.infrastructure.proto";

// Shared value-object catalog of golden shared_value_objects.proto (all in
// package net.imadz.metarch.infrastructure.proto): fields typed with one of
// these names map to <protoPackage>.<Name>PO and REQUIRE the
// `import "shared_value_objects.proto";` header. Non-catalog VO names are
// aggregate-local (defined in the aggregate's own proto); they map to the
// same <protoPackage>.<Name>PO shape but need no import.
const SHARED_VOS = new Set([
  "AggregateRelationSpec", "CatalogConflict", "CatalogConflictSet",
  "CatalogPatchSet", "CodeAnchorDelta", "ConceptDelta", "ConceptIndexEntry",
  "EdgeTarget", "EventBinding", "FieldCommandSpec", "FieldEdge",
  "FieldEventSpec", "FieldParamSpec", "FieldSpec", "FieldStateSpec",
  "GuardSpec", "ParticipantRole", "RelationDelta", "RuleRef",
  "StateGateSpec", "StatusTransitionSpec", "UcStep",
]);

const SCALAR_MAP = {
  // RAW tree dataTypes → proto types (verified against golden protos)
  String: "string",
  "String (UUID)": "string",
  "String (Enum)": "string",
  "String (JSON)": "string",
  Enum: "string",
  JSON: "string",
  Integer: "int32",
  Int: "int32",
  Long: "int64",
  timestamp: "int64",
  Instant: "int64",
  Boolean: "bool",
  // no golden example of number/BigDecimal payloads (golden has zero
  // `double` fields across all protos); fall back to double.
  number: "double",
  BigDecimal: "double",
  Double: "double",
};

const protoType = (t) => {
  const raw = String(t || "");
  // List<X> / Array<X> → repeated <map(X)>
  const list = raw.match(/^(List|Array)<(.*)>$/);
  if (list) return `repeated ${protoType(list[2])}`;
  if (SCALAR_MAP[raw]) return SCALAR_MAP[raw];
  // bare VO name (catalog or aggregate-local) → <protoPackage>.<Name>PO
  return `${packageName}.${raw}PO`;
};

const usesSharedVO = (t) => {
  const raw = String(t || "");
  const list = raw.match(/^(List|Array)<(.*)>$/);
  if (list) return usesSharedVO(list[2]);
  if (SCALAR_MAP[raw]) return false;
  return SHARED_VOS.has(raw);
};

const camel = (s) => s[0].toLowerCase() + s.slice(1);

let out;
if (spec.aggregateName) {
  // v3: aggregate-driven, alphabetical by event name
  const agg = spec.aggregateName;
  const events = [...(spec.events || [])].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

  // golden: fields carrying an `introducedIn` annotation render it inline
  // before the @knowledge anchor (`// S2-73 补载荷 ... @knowledge <noteId>`)
  const knowledgeOf = (f) => {
    if (!f || !f.noteId) return f && f.introducedIn ? ` // ${f.introducedIn}` : "";
    const anchor = f.elementHash ? `${f.noteId}@${f.elementHash}` : f.noteId;
    return f.introducedIn
      ? ` // ${f.introducedIn} @knowledge ${anchor}`
      : ` // @knowledge ${anchor}`;
  };

  const fieldLines = (fields) =>
    (fields || []).map((f, i) => {
      const t = protoType(f.dataType);
      // golden: `optional` never prefixes a repeated field (proto3 forbids
      // it; field_model_definition's AggregateStatusPatchedPO proves the
      // old builder dropped it on Lists even when the field is optional).
      const opt = f.optional && !t.startsWith("repeated ") ? "optional " : "";
      return `  ${opt}${t} ${f.name} = ${i + 1};${knowledgeOf(f)}`;
    }).join("\n");

  // aggregate-local value objects (closure of state/event field types minus
  // the shared catalog) are emitted BEFORE the event messages (golden rule:
  // localMessages ++ eventMsgs :+ eventUnion :+ stateMsg).
  const localPOs = (spec.localVOs || [])
    .map((v) => `message ${v.name}PO {\n${fieldLines(v.fields)}\n\n}`)
    .join("\n\n");

  // blank line BEFORE the closing } of every payload message
  // B2b tenant stamp (old AggregateRootProtoBuilder, user ruling 2026-08-26):
  // except the User family, every event message lacking a declared tenantId
  // gets one appended as the last field (bare, no @knowledge anchor).
  const eventPOs = events
    .map((e) => {
      let body = fieldLines(e.fields);
      if (agg !== "User" && !(e.fields || []).some((f) => f.name === "tenantId"))
        body += `\n  string tenantId = ${(e.fields || []).length + 1};`;
      return `message ${e.name}PO {\n${body}\n\n}`;
    })
    .join("\n\n");

  const oneofFields = events
    .map((e, i) => `    ${e.name}PO ${camel(e.name)} = ${i + 1};`)
    .join("\n");

  const eventWrapper = `message ${agg}EventPO {\n\n\n  oneof event {\n${oneofFields}\n  }\n}`;

  const statePO = `message ${agg}StatePO {\n${fieldLines(spec.stateFields)}\n\n}`;

  // Shared import IFF some field references a catalog VO type (golden rule:
  // exactly the 6 protos referencing catalog VOs carry the import).
  const allFields = [...(spec.stateFields || []), ...events.flatMap(e => e.fields || [])];
  const needsSharedImport = allFields.some(f => f.dataType && usesSharedVO(f.dataType));
  const sharedImport = needsSharedImport ? '\nimport "shared_value_objects.proto";\n' : '\n\n';

  out = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
syntax = "proto3";

package ${packageName};
${sharedImport}
option java_multiple_files = true;




${localPOs ? `${localPOs}\n\n` : ""}${eventPOs}

${eventWrapper}

${statePO}
`;
} else if (spec.sharedVOs) {
  // shared_value_objects.proto: the cross-aggregate VO components, one file,
  // messages alphabetical by VO name, no imports (golden framing).
  const knowledgeOf = (f) => {
    if (!f || !f.noteId) return "";
    const anchor = f.elementHash ? `${f.noteId}@${f.elementHash}` : f.noteId;
    return ` // @knowledge ${anchor}`;
  };
  const msgs = [...spec.sharedVOs]
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map((v) => {
      const fields = (v.fields || []).map((f, i) => {
        const t = protoType(f.dataType);
        const opt = f.optional && !t.startsWith("repeated ") ? "optional " : "";
        return `  ${opt}${t} ${f.name} = ${i + 1};${knowledgeOf(f)}`;
      }).join("\n");
      return `message ${v.name}PO {\n${fields}\n\n}`;
    })
    .join("\n\n");
  out = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
syntax = "proto3";

package ${packageName};



option java_multiple_files = true;




${msgs}
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
