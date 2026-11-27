#!/usr/bin/env node
// Single-source-of-truth contract gate & capabilities.lock exporter for metarch-truthsrc.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContracts, exportCapabilitiesLock } from '../lib/v2/surface-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseOutArg(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--export' && argv[i + 1]) {
      return resolve(argv[i + 1]);
    }
  }
  return null;
}

const outPath = parseOutArg(process.argv.slice(2));
const report = checkContracts(ROOT);

if (outPath && report.passed) {
  exportCapabilitiesLock(ROOT, { outFile: outPath });
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
