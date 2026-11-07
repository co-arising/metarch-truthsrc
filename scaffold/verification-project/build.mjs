import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function buildCatalog(input, artifactRoot) {
  const { items } = JSON.parse(readFileSync(input, 'utf8'));
  assert.ok(Array.isArray(items) && items.every(item => typeof item === 'string'));
  const labels = items.map(item => item.toUpperCase());
  writeFileSync(join(artifactRoot, 'catalog.mjs'),
    'export const labels = Object.freeze(' + JSON.stringify(labels) + ');\n' +
    'export const count = ' + labels.length + ';\n', { flag: 'wx' });
  return { count: labels.length };
}
