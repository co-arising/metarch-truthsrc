// scala-cqrs-es.test.mjs — V4-2 gate: golden-master byte identity against the production
// CodegenMain corpus (CreditBalance protocol + root), plus plan-shape assertions.
import { equal } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plan } from '../src/core/generate.mjs';

const GEN = join(import.meta.dirname, '..', 'generators', 'scala-cqrs-es');
const GOLD = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es');

const { manifest, entries } = await plan({ canonicalFile: join(GOLD, 'credit-balance.canonical.json'), generatorDir: GEN });
equal(manifest.name, 'scala-cqrs-es');
equal(entries.length, 4);
for (const e of entries) {
  const want = readFileSync(join(GOLD, 'expected', e.path), 'utf8');
  equal(e.content, want, `byte identity: ${e.path}`);
}
console.log('✅ scala-cqrs-es — golden byte identity (protocol + aggregate-root)');
