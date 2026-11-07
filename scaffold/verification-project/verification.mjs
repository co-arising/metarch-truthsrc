import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './build.mjs';
import { checkCatalog } from './check.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const input = join(root, 'input.json'), expected = join(root, 'expected.json');
const fingerprint = value => createHash('sha256').update(value).digest('hex');

export function catalogVerification(directory) {
  return { directory,
    plan: { contract: { id: 'standalone-catalog', version: '1' },
      inputs: { files: [input, expected], trees: [{ root, excludeDirectories: [] }] },
      actionFile: join(root, 'build.mjs'), verifiers: [{ id: 'independent-labels', file: join(root, 'check.mjs') }],
      artifacts: ['catalog.mjs'], processCount: 0 },
    lease: { registry: join(dirname(directory), 'catalog-leases'), lockNames: ['catalog-' + fingerprint(root) + '.lock'],
      usedName: 'run-' + fingerprint(directory) + '.used.json', record: { owner: 'catalog-example', source: root } },
    action: ({ artifactRoot }) => buildCatalog(input, artifactRoot),
    verify: { 'independent-labels': ({ artifactRoot }) => checkCatalog(expected, artifactRoot) },
  };
}
