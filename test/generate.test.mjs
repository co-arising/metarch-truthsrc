// generate.test.mjs — core contract tests: manifest fail-fast, determinism, apply, ledger, golden identity.
import { deepEqual, equal, throws } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadManifest } from '../src/core/manifest.mjs';
import { apply, plan } from '../src/core/generate.mjs';

const GEN = join(import.meta.dirname, '..', 'generators', '_template');
const GOLD = join(import.meta.dirname, '..', 'golden', '_template');
const scratch = () => mkdtempSync(join(tmpdir(), 'truthsrc-gen-'));
// Synthetic unit input, not an authored truth tree or a generated corpus cache.
const fixture = scratch();
const CANON = join(fixture, 'canonical.json');
writeFileSync(CANON, JSON.stringify({ schemaVersion: 'truthsrc/v1', workshop: 'template-contract',
  aggregates: [{ name: 'Wallet', commands: [{ name: 'TopUp' }], events: [{ name: 'ToppedUp' }] }] }));

// manifest fail-fast
throws(() => loadManifest(GOLD), /manifest missing/);
deepEqual(loadManifest(GEN).artifactKinds, ['summary']);

// plan: deterministic, sorted, kinds validated
const { entries } = await plan({ canonicalFile: CANON, generatorDir: GEN });
equal(entries.length, 1);
equal(entries[0].path, 'aggregates/Wallet.md');
equal(entries[0].kind, 'summary');
deepEqual(entries[0].families, ['Wallet']);

// golden identity: applied output must equal the checked-in expected tree byte for byte
const out = scratch();
const r = await apply({ canonicalFile: CANON, generatorDir: GEN, outDir: out });
equal(r.written, 1);
equal(readFileSync(join(out, 'aggregates/Wallet.md'), 'utf8'),
  readFileSync(join(GOLD, 'expected', 'aggregates/Wallet.md'), 'utf8'));

// ledger + anchors emitted, row shape per CODEGEN.md
const ledger = JSON.parse(readFileSync(join(out, 'truthsrc.ledger.json'), 'utf8'));
equal(ledger.generator, '_template');
equal(ledger.entries[0].schemaCategory, 'aggregate');
const anchors = JSON.parse(readFileSync(join(out, 'anchors.json'), 'utf8'));
deepEqual(anchors.anchors, {});

// second apply is a no-op (identical), overwrite refusal is fail-fast
const r2 = await apply({ canonicalFile: CANON, generatorDir: GEN, outDir: out });
equal(r2.identical, 1);
mkdirSync(join(out, 'x'), { recursive: true });
writeFileSync(join(out, 'aggregates/Wallet.md'), 'tampered');
await apply({ canonicalFile: CANON, generatorDir: GEN, outDir: out })
  .then(() => { throw new Error('should have refused'); }, (e) => equal(/refusing to overwrite/.test(e.message), true));

// generator kind not declared in manifest → red
const bad = scratch();
mkdirSync(join(bad, 'generators', 'rogue'), { recursive: true });
writeFileSync(join(bad, 'generators', 'rogue', 'generator.json'), JSON.stringify({ name: 'rogue', inputSchema: 'truthsrc/v0.3', products: ['template'], artifactKinds: ['a'], output: {} }));
writeFileSync(join(bad, 'generators', 'rogue', 'generate.mjs'), 'export const generate = () => [{ path: "x", content: "y", kind: "undeclared" }];');
await plan({ canonicalFile: CANON, generatorDir: join(bad, 'generators', 'rogue') })
  .then(() => { throw new Error('should have failed'); }, (e) => equal(/not declared in manifest/.test(e.message), true));

rmSync(out, { recursive: true, force: true });
rmSync(bad, { recursive: true, force: true });
rmSync(fixture, { recursive: true, force: true });
console.log('✅ generate.test — manifest/plan/apply/golden/ledger all green');
