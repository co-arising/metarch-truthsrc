#!/usr/bin/env node
// ═══ policy-dsl emitter — PolicySpec → Scala ═══
// Emits a policy as a function: Event => Seq[Command].
// Decision logic from binding (intent).
import { readFileSync, writeFileSync } from "fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const rules = (spec.rules || []).map(r =>
  "      case e: " + r.onEvent + " if " + r.when + " =>\n        Seq(" + r.emit.join(", ") + ")"
).join("\n");
const out = "package " + spec.package + "\n\n" +
"// Policy: " + spec.name + "\n" +
"// Triggers: " + (spec.triggers || []).join(", ") + "\n" +
"// Invokes: " + (spec.invokes || []).join(", ") + "\n\n" +
"object " + spec.objectName + " {\n" +
"  /** " + spec.description + " */\n" +
"  def decide(event: Any): Seq[Any] = event match {\n" + rules + "\n" +
"    case _ => Seq.empty\n" +
"  }\n" +
"}\n";
writeFileSync(outPath, out);
console.log("emitted " + outPath);
