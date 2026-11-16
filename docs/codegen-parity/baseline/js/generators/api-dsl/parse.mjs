#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [_, bindingPath, outPath] = process.argv.slice(1);
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));
writeFileSync(outPath, JSON.stringify(binding, null, 2));
console.log("spec from binding");
