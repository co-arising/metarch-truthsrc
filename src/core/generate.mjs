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
import { preflightPaths, preflightApply } from './apply-preflight.mjs';
import { ANCHORS_VERSION, readAnchorsIndex, planAnchors, writeAnchorsIndex } from './anchors.mjs';

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
  ...(e.noteIds ? { noteIds: e.noteIds } : {}),
  ...(e.causedBy ? { causedBy: e.causedBy } : {}), // event→event causal ledger face (S7 #3, live event-handlers rows)
});

// (exported for --plan concern previews — read-only)
const readPriorRows = (outDir) =>
  existsSync(join(outDir, LEDGER)) ? (JSON.parse(readFileSync(join(outDir, LEDGER), 'utf8')).entries ?? []) : [];

export function mergedRows(outDir, entries) {
  const rows = new Map(readPriorRows(outDir).map((r) => [r.path, r]));
  for (const e of entries) {
    if (e.noLedger) continue; // shared-territory entries (conf/routes) carry no ledger row — live C6
    rows.set(e.path, rowOf(e));
  }
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

const fingerprint = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function anchorInputs(entries, repo) {
  return entries.flatMap(entry => {
    if (entry.noteIds != null && !Array.isArray(entry.noteIds)) throw new Error('entry.noteIds must be an array');
    const keys = new Set([...(entry.knowledgeId != null ? [entry.knowledgeId] : []), ...(entry.noteIds ?? [])]);
    // Core has no source-language parser: never infer module/symbol/span or certify template text.
    return [...keys].map(knowledgeKey => ({ knowledgeKey, locations: [{ repo, file: entry.path }] }));
  });
}

export function apply({ canonicalFile, generatorDir, outDir, options = {}, concern }) {
  return plan({ canonicalFile, generatorDir, options }).then(async ({ manifest, entries }) => {
    const receipts = [LEDGER, ANCHORS];
    preflightPaths(outDir, [...entries.map(e => e.path), ...receipts], {
      entryPaths: entries.map(e => e.path), reservedFiles: receipts,
    });
    const priorByPath = new Map(readPriorRows(outDir).map(r => [r.path, r]));
    const ledgerRows = mergedRows(outDir, entries);
    const scope = concern ? scopeOf(ledgerRows, concern) : null;
    const repo = resolve(outDir);
    const generator = { id: manifest.name, version: String(options.generatorVersion ?? manifest.version ?? 'unknown') };
    const priorIndex = existsSync(join(outDir, ANCHORS))
      ? readAnchorsIndex(readFileSync(join(outDir, ANCHORS), 'utf8'), {
        legacy: 'planned', legacyDefaults: { repo, generator: 'legacy', generatorVersion: 'unknown' },
      }) : { version: ANCHORS_VERSION, anchors: {} };
    const plannedKnowledgeKeys = anchorInputs(entries, repo);
    const derivedFiles = receipts.map(file => ({ repo, file }));
    const anchorPlan = planAnchors({ priorIndex, generator, plannedKnowledgeKeys, derivedFiles });
    const priorPaths = Object.values(priorIndex.anchors).flat()
      .filter(location => location.generator === generator.id).map(location => {
        if (location.repo !== repo) throw new Error(`prior generator anchor outside owned outDir: ${location.repo}`);
        return location.file;
      });
    const { root, targets } = preflightPaths(outDir,
      [...entries.map(e => e.path), ...ledgerRows.map(r => r.path), ...priorPaths, ...receipts],
      { entryPaths: entries.map(e => e.path), reservedFiles: receipts });
    const actions = preflightApply({ entries, targets, priorByPath, scope });
    let written = 0, identical = 0, kept = 0, globalFlowed = 0, merged = 0, routesNoTarget = 0;
    const ledger = { generator: manifest.name, entries: ledgerRows };
    if (concern) ledger.concern = {
      name: concern.name, families: concern.families ?? 'all', scopeFile: concern.registryFile,
      scopeFileHash: createHash('sha256').update(readFileSync(concern.registryFile)).digest('hex').slice(0, 16),
      inScope: scope.set.size, closureAdded: scope.set.size - scope.base.size,
    };
    const outcomes = [];
    // Same mkdir/writeFile application channel as before, using prechecked final merge contents.
    // Exclusive outDir ownership is required: this is not a cross-file transaction or rollback.
    for (const action of actions) {
      const { entry, target, outcome, content, isGlobal } = action;
      if (action.changed) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
        written++;
        if (action.manualMerged) merged++;
        if (isGlobal && (scope || outcome !== 'ADD') && entry.merge !== 'markers') globalFlowed++;
      } else if (outcome === 'KEEP') kept++;
      else if (outcome === 'MISSING') routesNoTarget++;
      else identical++;
      // Capture evidence only after the actual policy outcome, including KEEP/IDENTICAL bytes.
      outcomes.push({ repo, file: entry.path, outcome,
        ...(outcome !== 'MISSING' ? { fingerprint: fingerprint(readFileSync(target)) } : {}) });
    }
    mkdirSync(root, { recursive: true });
    if (concern) Object.assign(ledger.concern, { written, identical, kept, globalFlowed });
    writeFileSync(targets.get(LEDGER), JSON.stringify(ledger, null, 2) + '\n');
    // No successful index/receipt is returned if any application/ledger write failed above.
    await writeAnchorsIndex(planAnchors({ priorIndex: anchorPlan.priorIndex, generator,
      plannedKnowledgeKeys, finalApplyOutcomes: outcomes, derivedFiles }), {
      repoRoots: { [repo]: root }, indexLocation: { repo, file: ANCHORS },
    });
    return {
      name: manifest.name, written, identical, total: entries.length,
      kept, globalFlowed, merged, routesNoTarget, outcomes,
      inScope: scope ? scope.set.size : null,
      closureAdded: scope ? scope.set.size - scope.base.size : null,
      ledger: targets.get(LEDGER), anchors: targets.get(ANCHORS),
    };
  });
}
