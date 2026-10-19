#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [s, o] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(s, "utf8"));
const rules = (spec.rules || []).map(r => "  // " + r.description + "\n  def " + r.name + "(s: " + spec.subjectType + "): Either[String, Unit] =\n    if (" + r.condition + ") Right(()) else Left(\"" + r.errorCode + ": " + r.errorMsg + "\")").join("\n\n");
const out = "package " + spec.package + "\n\n/** Invariant rules for " + spec.subjectType + " */\nobject " + spec.objectName + " {\n" + rules + "\n}\n";
writeFileSync(o, out); console.log("emitted " + o);
