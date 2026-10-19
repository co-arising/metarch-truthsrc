#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [s, o] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(s, "utf8"));
const methods = (spec.methods || []).map(m => "  def " + m.name + "(" + (m.params || "") + "): " + m.returnType + " = ??? // TODO: " + m.description).join("\n");
const out = "package " + spec.package + "\n\n/** " + spec.description + " */\nclass " + spec.className + " {\n" + methods + "\n}\n";
writeFileSync(o, out); console.log("emitted " + o);
