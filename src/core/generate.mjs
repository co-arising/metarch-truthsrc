// generate.mjs — the orchestration core: manifest + canonical → generator → plan → apply.
// Contract (CODEGEN.md): a generator exports `generate(ctx)` returning a plan —
// [{ path, content, kind, schemaCategory?, families?, deps? }] — byte-deterministic.
// Core owns everything else: validation, dispatch, the ledger, anchors, writing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadManifest } from './manifest.mjs';
import { loadCanonical } from './canonical.mjs';

const LEDGER = 'truthsrc.ledger.json';
const ANCHORS = 'anchors.json';

export function plan({ canonicalFile, generatorDir, options = {} }) {
  const manifest = loadManifest(generatorDir);
  const canonical = loadCanonical(canonicalFile, manifest.inputSchema);
  const mod = pathToFileURL(join(generatorDir, 'generate.mjs')).href;
  return import(mod).then(({ generate }) => {
    const entries = generate({ canonical, products: {}, options, manifest });
    for (const e of entries) {
      if (!e.path || typeof e.content !== 'string') throw new Error(`generator ${manifest.name}: entry needs path+content`);
      if (!manifest.artifactKinds.includes(e.kind)) throw new Error(`generator ${manifest.name}: kind "${e.kind}" not declared in manifest.artifactKinds`);
    }
    // determinism gate: two runs must agree byte for byte (I1 for generated code)
    const again = generate({ canonical, products: {}, options, manifest });
    if (JSON.stringify(entries) !== JSON.stringify(again))
      throw new Error(`generator ${manifest.name}: non-deterministic output (two runs differ)`);
    entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return { manifest, entries };
  });
}

export function apply({ canonicalFile, generatorDir, outDir, options = {} }) {
  return plan({ canonicalFile, generatorDir, options }).then(({ manifest, entries }) => {
    const ledger = [], anchors = {};
    let written = 0, identical = 0;
    for (const e of entries) {
      const target = resolve(join(outDir, e.path));
      if (!target.startsWith(resolve(outDir) + '/')) throw new Error(`entry escapes outDir: ${e.path}`);
      if (existsSync(target)) {
        const prev = readFileSync(target, 'utf8');
        if (prev === e.content) { identical++; }
        else throw new Error(`refusing to overwrite existing file: ${e.path} (MERGE-protected blocks land in v0.4 port batches)`);
      } else {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, e.content);
        written++;
      }
      ledger.push({ path: e.path, kind: e.kind, schemaCategory: e.schemaCategory ?? 'global', families: e.families ?? [], deps: e.deps ?? [] });
      if (e.knowledgeId) anchors[e.knowledgeId] = { file: e.path };
    }
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, LEDGER), JSON.stringify({ generator: manifest.name, entries: ledger }, null, 2) + '\n');
    writeFileSync(join(outDir, ANCHORS), JSON.stringify({ generator: manifest.name, anchors }, null, 2) + '\n');
    return { name: manifest.name, written, identical, total: entries.length, ledger: join(outDir, LEDGER), anchors: join(outDir, ANCHORS) };
  });
}
