#!/usr/bin/env node
// ═══ event-dsl emitter — Spec → Scala (common-core 0.2) ═══
import { readFileSync, writeFileSync } from "fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const scalaType = (t) =>
  ({ string: "String", number: "BigDecimal", integer: "Int", long: "Long", boolean: "Boolean", timestamp: "Long" })[t] ?? "String";
const fields = spec.fields.map((f) => `${f.name}: ${scalaType(f.dataType)}`).join(", ");
const out = `package ${spec.package}\n\nimport net.imadz.common.CborSerializable\n\n/** ${spec.description} */\nfinal case class ${spec.name}(${fields}) extends CborSerializable\n`;
writeFileSync(outPath, out);
console.log(`emitted ${outPath}`);
