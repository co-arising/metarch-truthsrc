// scala-cqrs-es-metarch.test.mjs — inc4 gate: golden byte identity against LIVE CodegenMain
// output from the REAL metarch truth source (IngestedSystem, multi-module), for the Subdomain
// aggregate. Exercises the @knowledge anchor layer: fields carry noteId, and the hash suffix is
// looked up from the elementHashes sidecar (a slice of the pinned graph export v55).
import { equal, ok } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plan } from '../src/core/generate.mjs';

const GEN = join(import.meta.dirname, '..', 'generators', 'scala-cqrs-es');
const GOLD = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-metarch');
const GOLDEN_VERSION = 'af096839';
const elementHashes = JSON.parse(readFileSync(join(GOLD, 'elementHashes.json'), 'utf8'));

const { entries } = await plan({
  canonicalFile: join(GOLD, 'subdomain.canonical.json'),
  generatorDir: GEN,
  options: { generatorVersion: GOLDEN_VERSION, elementHashes },
});
equal(entries.length, 8);
for (const e of entries) {
  const want = readFileSync(join(GOLD, 'expected', e.path), 'utf8');
  equal(e.content, want, `byte identity: ${e.path}`);
}

// anchors actually rendered: the Protocol must carry a @knowledge <uuid>@<hash> line.
const proto = entries.find((e) => e.path.endsWith('SubdomainProtocol.scala')).content;
ok(/@knowledge [0-9a-f-]{36}@[0-9a-f]{16}/.test(proto), 'protocol renders @knowledge anchors with hash');

// a noteId with no sidecar entry falls back to a bare anchor (no @hash) — mirrors internal getOrElse "".
const { entries: noHash } = await plan({
  canonicalFile: join(GOLD, 'subdomain.canonical.json'),
  generatorDir: GEN,
  options: { generatorVersion: GOLDEN_VERSION, elementHashes: {} },
});
const protoNoHash = noHash.find((e) => e.path.endsWith('SubdomainProtocol.scala')).content;
ok(/@knowledge 1d4ff2f9-aa52-4480-822a-3c1c31ab4b53(?!@)/.test(protoNoHash), 'missing hash → bare noteId anchor');

console.log('✅ scala-cqrs-es-metarch — golden byte identity (Subdomain, 8 kinds, live metarch + @knowledge)');
