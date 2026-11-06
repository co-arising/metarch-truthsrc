import { readFileSync } from 'node:fs';
import { compactAuthorStructures } from './author-compact.mjs';
import { planAuthorTransform, applyAuthorTransform } from './author-transform.mjs';
import { parseStrictJson } from './strict-json.mjs';
import { compactMicroAuthorEntries } from './author-micro-migrate.mjs';

export function compactAuthorCli(args, { micro = false } = {}) {
  const flags = new Map(); let planOnly = false, inPlace = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--plan' && !planOnly) { planOnly = true; continue; }
    if (flag === '--in-place' && !inPlace) { inPlace = true; continue; }
    if (!['--tree', ...(micro ? [] : ['--groups']), '--out'].includes(flag) || flags.has(flag) || !args[i + 1] || args[i + 1].startsWith('--'))
      throw new Error('AUTHOR_COMPACT: unknown/duplicate/incomplete flag');
    flags.set(flag, args[++i]);
  }
  if (!flags.has('--tree') || !micro && !flags.has('--groups') || inPlace && flags.has('--out') || !planOnly && !inPlace && !flags.has('--out'))
    throw new Error('AUTHOR_COMPACT: explicit --tree and macro --groups, with --plan, --out or --in-place required');
  const groups = micro ? null : parseStrictJson(readFileSync(flags.get('--groups')));
  const plan = planAuthorTransform(flags.get('--tree'), entries => micro ? compactMicroAuthorEntries(entries) : compactAuthorStructures(entries, { groups }));
  if (planOnly) return { ...plan, files: undefined, applied: false };
  return applyAuthorTransform(plan, inPlace ? { inPlace: true } : { out: flags.get('--out') });
}
