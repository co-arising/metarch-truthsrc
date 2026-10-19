#!/usr/bin/env node
// ═══ valueobject-dsl emitter — Spec → Scala ═══
// Value objects are immutable, no identity, compared by value.
import { readFileSync, writeFileSync } from "fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const pascal = (s) => s.split(/[-_ ]/).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
spec.name = pascal(spec.name);
const scalaType = (t) => ({string:"String",number:"BigDecimal",integer:"Int",long:"Long",boolean:"Boolean"})[t] || "String";
const fields = (spec.fields || []).map(f => f.name + ": " + scalaType(f.dataType)).join(", ");
const out = "package " + spec.package + "\n\n" +
"/** Value object: " + spec.description + " */\n" +
"final case class " + spec.name + "(" + fields + ")\n";
writeFileSync(outPath, out);
console.log("emitted " + outPath);
