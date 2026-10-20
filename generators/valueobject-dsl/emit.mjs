#!/usr/bin/env node
// ═══ valueobject-dsl emitter v2 — Spec → Scala (old codegen 1:1) ═══
// Matches golden_master/net/imadz/domain/values/Money.scala:
//   case class Money(amount: BigDecimal, currency: Currency) {
//     // Value Object Logic Stubs
//   }
// Note: old uses `case class` (not final); keeps the "// Value Object Logic Stubs" marker.
// Usage: node emit.mjs <spec.json> <out.scala>

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : "")).join("");
const name = pascal(spec.name);

const scalaType = (t) => {
  if (!t) return "String";
  // Handle parameterized types like list<string>, map<string, int>
  const lower = String(t).toLowerCase();
  if (lower.startsWith("list<") || lower === "list" || lower === "array") {
    const inner = t.match(/<(.+)>/)?.[1] || "String";
    return `List[${scalaType(inner)}]`;
  }
  if (lower.startsWith("map<")) {
    const m = t.match(/<(.+),\s*(.+)>/);
    if (m) return `Map[${scalaType(m[1])}, ${scalaType(m[2])}]`;
    return "Map[String, String]";
  }
  if (lower.startsWith("set<") || lower === "set") {
    const inner = t.match(/<(.+)>/)?.[1] || "String";
    return `Set[${scalaType(inner)}]`;
  }
  if (lower.startsWith("option<")) {
    const inner = t.match(/<(.+)>/)?.[1] || "String";
    return `Option[${scalaType(inner)}]`;
  }
  if (lower === "instant" || lower === "datetime" || lower === "date") return "Instant";
  return ({ string: "String", number: "BigDecimal", integer: "Int", long: "Long", boolean: "Boolean", timestamp: "Long" })[lower] || "String";
};

const fields = (spec.fields || []).map((f) => `${f.name}: ${scalaType(f.dataType)}`).join(", ");

// Auto-detect needed imports from field types (ingested-app 1:1)
// e.g., List[...] -> scala.collection.immutable.List, Instant -> java.time.Instant
const fieldTypes = (spec.fields || []).map((f) => scalaType(f.dataType)).join(" ");
const autoImports = [];
if (fieldTypes.includes("List[")) autoImports.push("scala.collection.immutable.List");
if (fieldTypes.includes("Instant")) autoImports.push("java.time.Instant");
if (fieldTypes.includes("Map[")) autoImports.push("scala.collection.immutable.Map");
if (fieldTypes.includes("Set[")) autoImports.push("scala.collection.immutable.Set");
if (fieldTypes.includes("Option[")) autoImports.push("scala.Option");

// extra imports for non-primitive types (e.g. Currency) — from spec or auto-detected
const allImports = [...new Set([...autoImports, ...(spec.imports || [])])];
const extraImports = allImports.map((i) => `import ${i}`).join("\n");
const importBlock = extraImports ? extraImports + "\n\n" : "";

const out = `package ${spec.package}

${importBlock}case class ${name}(${fields}) {
  // Value Object Logic Stubs
}
`;

writeFileSync(outPath, out);
console.log(`valueobject-dsl: wrote ${name} → ${outPath}`);
