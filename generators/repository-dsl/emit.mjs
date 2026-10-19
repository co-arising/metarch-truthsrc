#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [s, o] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(s, "utf8"));
const methods = (spec.methods || []).map(m => "  def " + m.name + "(" + m.param + ": " + m.paramType + "): " + m.returnType).join("\n");
const out = "package " + spec.package + "\n\ntrait " + spec.interfaceName + " {\n" + methods + "\n}\n\nclass " + spec.implName + " extends " + spec.interfaceName + " {\n" + (spec.methods || []).map(m => "  def " + m.name + "(" + m.param + ": " + m.paramType + "): " + m.returnType + " = ??? // TODO").join("\n") + "\n}\n";
writeFileSync(o, out); console.log("emitted " + o);
