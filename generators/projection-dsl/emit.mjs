#!/usr/bin/env node
// ═══ projection-dsl emitter — ProjectionSpec → Scala ═══
// Emits an Akka projection event handler.
import { readFileSync, writeFileSync } from "fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const handlers = (spec.handlers || []).map(h =>
  "      case e: " + h.onEvent + " =>\n        // TODO(intent): update " + spec.viewType + " from " + h.onEvent
).join("\n");
const out = "package " + spec.package + "\n\n" +
"/** Projection: " + spec.name + " → " + spec.viewType + " */\n" +
"object " + spec.objectName + " {\n" +
"  def handle(event: Any): Unit = event match {\n" + handlers + "\n" +
"    case _ => ()\n" +
"  }\n" +
"}\n";
writeFileSync(outPath, out);
console.log("emitted " + outPath);
