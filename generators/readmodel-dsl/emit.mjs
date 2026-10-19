#!/usr/bin/env node
// ═══ readmodel-dsl emitter — ReadModelSpec → Scala ═══
// Emits a read-model view case class + projection stub.
import { readFileSync, writeFileSync } from "fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const scalaType = (t) => ({string:"String",number:"BigDecimal",integer:"Int",long:"Long",boolean:"Boolean",object:"Map[String, Any]",timestamp:"Long"})[t] || "String";
const fields = (spec.fields || []).map(f => f.name.replace(/\./g, "_") + ": " + scalaType(f.dataType)).join(", ");
const defaultVal = (dt) => ({string:'""',number:"BigDecimal(0)",integer:"0",long:"0L",boolean:"false",object:"Map.empty",timestamp:"0L"})[dt] || '""';
const out = "package " + spec.package + "\n\n" +
"import scala.math.BigDecimal\n\n" +
"/** Read model: " + spec.name + " — served by " + spec.servedBy + " */\n" +
"final case class " + spec.viewType + "(" + fields + ")\n\n" +
"object " + spec.objectName + " {\n" +
"  def empty: " + spec.viewType + " = " + spec.viewType + "(" + (spec.fields || []).map(f => defaultVal(f.dataType)).join(", ") + ")\n" +
"  // TODO(intent): projection logic from " + (spec.sources || []).join(", ") + "\n" +
"}\n";
writeFileSync(outPath, out);
console.log("emitted " + outPath);
