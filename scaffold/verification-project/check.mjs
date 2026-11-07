import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function checkCatalog(expectedFile, artifactRoot) {
  const expected = JSON.parse(readFileSync(expectedFile, 'utf8'));
  const code = readFileSync(join(artifactRoot, 'catalog.mjs'), 'utf8');
  const actual = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  assert.deepEqual([...actual.labels], expected.labels);
  assert.equal(actual.count, expected.count);
  assert.equal(Object.isFrozen(actual.labels), true);
  return true;
}
