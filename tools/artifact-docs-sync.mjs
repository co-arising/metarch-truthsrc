#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCompatibility, syncCompatibility } from '../lib/artifact-docs/compat.mjs';
import { DOC_ROOT, readJson } from '../lib/artifact-docs/io.mjs';

export function run(args) {
  const values = new Map(); let write = false, check = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--write' || flag === '--check') {
      if (write || check) throw new Error('choose --check or --write once');
      write = flag === '--write'; check = !write; continue;
    }
    if (!['--target', '--root', '--catalog-root', '--expected'].includes(flag) || values.has(flag) || !args[i + 1] || args[i + 1].startsWith('--'))
      throw new Error('unknown, duplicate or incomplete flag: ' + flag);
    values.set(flag, args[++i]);
  }
  const root = values.get('--root'), target = values.get('--target'), directory = values.get('--catalog-root') ?? DOC_ROOT;
  if (!root || resolve(root) !== root || !target || resolve(directory) !== directory) throw new Error('explicit target and absolute root required');
  if (!write && values.has('--expected')) throw new Error('--expected is only used by --write');
  if (write) {
    const prior = values.get('--expected');
    if (!prior || resolve(prior) !== prior) throw new Error('--write requires absolute --expected file');
    return syncCompatibility({ root, target, directory, expected: readJson(prior) });
  }
  return checkCompatibility({ root, target, directory });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = run(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 2;
  } catch (error) { console.error('artifact-docs-sync: ' + error.message); process.exitCode = 2; }
}
