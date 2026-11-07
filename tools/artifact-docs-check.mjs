#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCrossRepository, checkLocal } from '../lib/artifact-docs/catalog.mjs';
import { checkCompatibility } from '../lib/artifact-docs/compat.mjs';
import { DOC_ROOT, TOOL_ROOT } from '../lib/artifact-docs/io.mjs';

export function parseArgs(args) {
  const options = { mode: null, roots: {}, directory: DOC_ROOT, requireAll: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (['--local', '--cross-repo', '--snapshots'].includes(flag)) {
      if (options.mode) throw new Error('choose one check mode');
      options.mode = flag.slice(2); continue;
    }
    if (flag === '--require-all') { if (options.requireAll) throw new Error('duplicate --require-all'); options.requireAll = true; continue; }
    if (flag === '--check') { if (seen.has(flag)) throw new Error('duplicate --check'); seen.add(flag); continue; }
    if (!['--repo', '--catalog-root'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('unknown or incomplete flag: ' + flag);
    const value = args[++i];
    if (flag === '--repo') {
      const match = /^([a-z][a-z0-9-]*)=(\/.*)$/.exec(value);
      if (!match || options.roots[match[1]] || resolve(match[2]) !== match[2]) throw new Error('unique repo=absolute-path required');
      options.roots[match[1]] = match[2];
    } else {
      if (seen.has(flag) || resolve(value) !== value) throw new Error('one absolute --catalog-root required');
      seen.add(flag); options.directory = value;
    }
  }
  options.mode ??= 'local';
  if (options.mode === 'local' && (Object.keys(options.roots).length || options.requireAll)) throw new Error('local mode has no external repositories');
  if (options.mode === 'cross-repo' && !options.requireAll) throw new Error('cross-repo requires --require-all; incomplete cannot pass');
  return options;
}
export function run(args) {
  const options = parseArgs(args);
  if (options.mode === 'local') return checkLocal({ directory: options.directory });
  if (options.mode === 'cross-repo') return checkCrossRepository({ ...options, roots: { js: TOOL_ROOT, ...options.roots } });
  const results = Object.entries(options.roots).map(([target, root]) => checkCompatibility({ root, target, directory: options.directory }));
  if (!results.length) throw new Error('snapshot check requires an explicit --repo target=path');
  return { passed: results.every(result => result.passed), mode: 'snapshots', results };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = run(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 2;
  } catch (error) { console.error('artifact-docs: ' + error.message); process.exitCode = 2; }
}
