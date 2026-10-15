// generate.mjs — the orchestration core: manifest + canonical → generator → plan → apply.
// Contract (CODEGEN.md): a generator exports `generate(ctx)` returning a plan —
// [{ path, content, kind, schemaCategory?, schemaNode?, families?, deps? }] — byte-deterministic.
// Core owns everything else: validation, dispatch, the ledger, anchors, the concerns engine,
// writing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadManifest } from './manifest.mjs';
import { loadCanonical } from './canonical.mjs';
import { loadConcernRegistry, resolveConcernFilter, expandScope, compileClosure } from './concerns.mjs';

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

// Ledger rows describe what is on disk. This run's rows upsert the prior outDir rows by path —
// final-writer-wins (production ledger_append parity): when the rules face overwrites the
// skeleton's Behaviors/CommandHelpers paths, its rows replace those, and the concerns closure
// then runs over the merged truth (a concern regeneration must not clobber the newer face).
const rowOf = (e) => ({
  path: e.path,
  kind: e.kind,
  schemaCategory: e.schemaCategory ?? 'global',
  ...(e.schemaNode ? { schemaNode: e.schemaNode } : {}),
  families: e.families ?? [],
  deps: e.deps ?? [],
});

// (exported for --plan concern previews — read-only)
export function mergedRows(outDir, entries) {
  const p = join(outDir, LEDGER);
  const prior = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')).entries ?? []) : [];
  const rows = new Map(prior.map((r) => [r.path, r]));
  for (const e of entries) rows.set(e.path, rowOf(e));
  return [...rows.values()];
}

// Concern scope over merged ledger rows (exported for --plan previews): registry → filter →
// predicate expansion → dependency closure. `concern` = { name, families (string|null), registryFile }.
export function scopeOf(ledgerRows, concern) {
  const registry = loadConcernRegistry(concern.registryFile);
  const known = new Set(ledgerRows.flatMap((r) => r.families ?? []));
  const filter = resolveConcernFilter(registry, concern.name, concern.families, known);
  const base = expandScope(ledgerRows, filter);
  return { registry, filter, base, set: compileClosure(base, ledgerRows) };
}

export function apply({ canonicalFile, generatorDir, outDir, options = {}, concern }) {
  return plan({ canonicalFile, generatorDir, options }).then(({ manifest, entries }) => {
    const ledgerRows = mergedRows(outDir, entries);
    const rowByPath = new Map(ledgerRows.map((r) => [r.path, r]));
    const scope = concern ? scopeOf(ledgerRows, concern) : null;

    const anchors = {};
    let written = 0, identical = 0, kept = 0, globalFlowed = 0;
    const changedPaths = [];
    for (const e of entries) {
      const target = resolve(join(outDir, e.path));
      if (!target.startsWith(resolve(outDir) + '/')) throw new Error(`entry escapes outDir: ${e.path}`);
      if (e.knowledgeId) anchors[e.knowledgeId] = { file: e.path };
      const isGlobal = (e.families ?? []).length === 0;
      if (scope && !isGlobal && !scope.set.has(e.path) && existsSync(target)) {
        // Out-of-scope family artifact: the on-disk version is authoritative (zero-diff refill
        // parity — not regenerating it is exactly what the concern excludes). A file absent on
        // disk is a new family's first fill and goes out through the normal path below.
        kept++;
        continue;
      }
      if (existsSync(target)) {
        const prev = readFileSync(target, 'utf8');
        if (prev === e.content) { identical++; }
        else if (!scope) throw new Error(`refusing to overwrite existing file: ${e.path} (MERGE-protected blocks land in v0.4 port batches — in-place regeneration runs under a declared --concern scope)`);
        else { writeFileSync(target, e.content); written++; changedPaths.push(e.path); if (isGlobal) globalFlowed++; }
      } else {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, e.content);
        written++;
        changedPaths.push(e.path);
        if (scope && isGlobal) globalFlowed++;
      }
    }

    // Scope-leak gate (production assertNoScopeLeak parity): with a concern declared, every
    // family artifact whose on-disk content changed must sit inside the computed closure —
    // a violation means the engine and the write policy disagree, so refuse to certify.
    if (scope) {
      const leaks = changedPaths.filter((p) => {
        const r = rowByPath.get(p);
        return r && (r.families ?? []).length > 0 && !scope.set.has(p);
      });
      if (leaks.length) throw new Error(`scope leak: ${leaks.length} family artifact(s) changed outside the concern closure — ${leaks.slice(0, 5).join(' · ')}`);
    }

    mkdirSync(outDir, { recursive: true });
    const ledger = { generator: manifest.name, entries: ledgerRows };
    if (concern) {
      // audit chain (production manifest.meta.concern parity)
      ledger.concern = {
        name: concern.name,
        families: concern.families ?? 'all',
        scopeFile: concern.registryFile,
        scopeFileHash: createHash('sha256').update(readFileSync(concern.registryFile)).digest('hex').slice(0, 16),
        inScope: scope.set.size,
        closureAdded: scope.set.size - scope.base.size,
        written, identical, kept, globalFlowed,
      };
    }
    writeFileSync(join(outDir, LEDGER), JSON.stringify(ledger, null, 2) + '\n');
    writeFileSync(join(outDir, ANCHORS), JSON.stringify({ generator: manifest.name, anchors }, null, 2) + '\n');
    return {
      name: manifest.name, written, identical, total: entries.length,
      kept, globalFlowed,
      inScope: scope ? scope.set.size : null,
      closureAdded: scope ? scope.set.size - scope.base.size : null,
      ledger: join(outDir, LEDGER), anchors: join(outDir, ANCHORS),
    };
  });
}
