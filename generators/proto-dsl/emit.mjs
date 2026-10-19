#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [s, o] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(s, "utf8"));
const protoType = (t) => ({string:"string",number:"double",integer:"int32",long:"int64",boolean:"bool"})[t] || "string";
const messages = (spec.messages || []).map((m, mi) => {
  const fields = (m.fields || []).map((f, i) => "  " + protoType(f.dataType) + " " + f.name + " = " + (i+1) + ";").join("\n");
  return "message " + m.name + " {\n" + fields + "\n}";
}).join("\n\n");
const out = 'syntax = "proto3";\n\npackage ' + spec.package + ';\n\n' + messages + "\n";
writeFileSync(o, out); console.log("emitted " + o);
