#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
const [_, b, o] = process.argv.slice(1);
writeFileSync(o, readFileSync(b, "utf8"));
console.log("spec from binding");
