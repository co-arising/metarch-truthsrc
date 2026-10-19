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

const scalaType = (t) =>
  ({ string: "String", number: "BigDecimal", integer: "Int", long: "Long", boolean: "Boolean", timestamp: "Long" })[t] || "String";

const fields = (spec.fields || []).map((f) => `${f.name}: ${scalaType(f.dataType)}`).join(", ");

// extra imports for non-primitive types (e.g. Currency)
const extraImports = (spec.imports || []).map((i) => `import ${i}`).join("\n");
const importBlock = extraImports ? extraImports + "\n\n" : "";

const out = `package ${spec.package}

${importBlock}case class ${name}(${fields}) {
  // Value Object Logic Stubs
}
`;

writeFileSync(outPath, out);
console.log(`valueobject-dsl: wrote ${name} → ${outPath}`);
