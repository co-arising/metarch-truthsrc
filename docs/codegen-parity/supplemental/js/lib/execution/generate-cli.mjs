import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Parse public generator inputs before loading a producer or applying files. */
export function generatorCliArgs(args) {
  const paths = new Set(['--in', '--generator', '--out', '--concerns', '--options-json']);
  const text = new Set(['--concern', '--families']);
  const values = new Map();
  const options = {};
  const seenOptions = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--plan') {
      if (values.has(flag)) throw new Error('Repeated generator option: --plan');
      values.set(flag, true);
      continue;
    }
    if (!paths.has(flag) && !text.has(flag) && flag !== '--option') throw new Error(`Unknown generator option: ${flag}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    if (flag === '--option') {
      const separator = value.indexOf('=');
      if (separator < 1) throw new Error('--option requires key=value');
      const key = value.slice(0, separator);
      if (seenOptions.has(key)) throw new Error(`Repeated producer option: ${key}`);
      seenOptions.add(key);
      Object.defineProperty(options, key, { value: value.slice(separator + 1), enumerable: true });
    } else {
      if (values.has(flag)) throw new Error(`Repeated generator option: ${flag}`);
      values.set(flag, paths.has(flag) ? resolve(value) : value);
    }
  }
  for (const key of ['--in', '--generator']) if (!values.has(key)) throw new Error(`${key} is required`);
  if (!values.has('--out') && !values.has('--plan')) throw new Error('--out is required unless --plan is used');
  if (values.has('--families') && !values.has('--concern')) throw new Error('--families requires --concern');
  if (values.has('--options-json')) {
    const supplied = JSON.parse(readFileSync(values.get('--options-json'), 'utf8'));
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) throw new Error('--options-json must contain a JSON object');
    for (const [key, value] of Object.entries(supplied)) {
      if (seenOptions.has(key)) throw new Error(`Producer option occurs in both --option and --options-json: ${key}`);
      Object.defineProperty(options, key, { value, enumerable: true });
    }
  }
  return { values: Object.fromEntries(values), options };
}
