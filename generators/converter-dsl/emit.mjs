#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [s, o] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(s, "utf8"));
const out = "package " + spec.package + "\n\n/** Converts " + spec.fromType + " to " + spec.toType + " */\nobject " + spec.objectName + " {\n  def convert(from: " + spec.fromType + "): " + spec.toType + " = ??? // TODO: field mapping\n}\n";
writeFileSync(o, out); console.log("emitted " + o);
