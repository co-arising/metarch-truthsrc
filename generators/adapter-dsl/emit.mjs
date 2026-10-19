#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [s, o] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(s, "utf8"));
const out = "package " + spec.package + "\n\n/** Persistence adapter: " + spec.eventType + " <-> journal */\nobject " + spec.objectName + " {\n  def toJournal(event: " + spec.eventType + "): String = ??? // TODO: serialize\n  def fromJournal(json: String): " + spec.eventType + " = ??? // TODO: deserialize\n}\n";
writeFileSync(o, out); console.log("emitted " + o);
