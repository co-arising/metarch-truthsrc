#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [s, o] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(s, "utf8"));
const bindings = (spec.bindings || []).map(b => "  bind(classOf[" + b.from + "]).to(classOf[" + b.to + "])").join("\n");
const out = "package " + spec.package + "\n\nimport com.google.inject.AbstractModule\n\nclass " + spec.moduleName + " extends AbstractModule {\n  override def configure(): Unit = {\n" + bindings + "\n  }\n}\n";
writeFileSync(o, out); console.log("emitted " + o);
