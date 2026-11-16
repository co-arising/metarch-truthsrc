#!/usr/bin/env node
// ═══ ddl-dsl emitter — DdlSpec → SQL ═══
import { readFileSync, writeFileSync } from "fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const sqlType = (t) => ({string:"TEXT",number:"DECIMAL",integer:"INTEGER",long:"BIGINT",boolean:"BOOLEAN",timestamp:"BIGINT"})[t] || "TEXT";
const tables = (spec.tables || []).map(tbl => {
  const cols = (tbl.columns || []).map(c => "  " + c.name + " " + sqlType(c.dataType) + (c.primaryKey ? " PRIMARY KEY" : "")).join(",\n");
  return "CREATE TABLE " + tbl.name + " (\n" + cols + "\n);";
}).join("\n\n");
writeFileSync(outPath, "-- Generated from " + spec.source + "\n\n" + tables + "\n");
console.log("emitted " + outPath);
