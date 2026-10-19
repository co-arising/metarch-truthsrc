#!/usr/bin/env node
// ═══ tree → AuthSpec parser ═══
// Auth comes from binding (role matrix); tree provides endpoint list via 12-use-cases.
import { readFileSync, writeFileSync } from "fs";
const [_, bindingPath, outPath] = process.argv.slice(1);
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));
writeFileSync(outPath, JSON.stringify(binding, null, 2));
console.log("auth spec from binding: " + binding.name);
