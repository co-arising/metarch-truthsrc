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
import {
  preflightPaths, preflightApply, captureFiles, checkCapturedFiles, validateExpectedFiles,
  checkExpectedFiles, fingerprint, generatedFingerprint,
} from './apply-preflight.mjs';
import { ANCHORS_VERSION, readAnchorsIndex, planAnchors, writeAnchorsIndex } from './anchors.mjs';
import { validateCodeMappings, finalMappingSpan } from './code-mappings.mjs';

const LEDGER = 'truthsrc.ledger.json';
const ANCHORS = 'anchors.json';

export function plan({ canonicalFile, generatorDir, options = {} }) {
  const manifest = loadManifest(generatorDir);
  if (Object.hasOwn(manifest, 'declaredProducts')) {
    throw new Error('PRODUCT_PLAN_UNSUPPORTED: versioned products require the explicit admission API; legacy plan cannot deliver declared products to a producer');
  }
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
  ...(e.productFootprint ? { productFootprint: e.productFootprint } : {}),
  ...(e.knowledgeIds ? { knowledgeIds: e.knowledgeIds } : {}),
});

// (exported for --plan concern previews — read-only)
const readPriorRows = (outDir) =>
  existsSync(join(outDir, LEDGER)) ? (JSON.parse(readFileSync(join(outDir, LEDGER), 'utf8')).entries ?? []) : [];

function mergeRows(priorRows, entries) {
  const rows = new Map(priorRows.map((r) => [r.path, r]));
  for (const e of entries) {
    if (e.noLedger) continue; // shared-territory entries (conf/routes) carry no ledger row — live C6
    rows.set(e.path, rowOf(e));
  }
  return [...rows.values()];
}

export function mergedRows(outDir, entries) {
  return mergeRows(readPriorRows(outDir), entries);
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

const accepted = new Set(['ADD', 'COVER', 'MERGE', 'IDENTICAL']);

function anchorInputs(entries, repo, finalBytes) {
  return entries.flatMap(entry => {
    if (entry.noteIds != null && !Array.isArray(entry.noteIds)) throw new Error('entry.noteIds must be an array');
    if (entry.knowledgeIds != null && !Array.isArray(entry.knowledgeIds)) throw new Error('entry.knowledgeIds must be an array');
    const mappings = validateCodeMappings(entry);
    const keys = new Set([...(entry.knowledgeId != null ? [entry.knowledgeId] : []),
      ...(entry.knowledgeIds ?? []), ...(entry.noteIds ?? [])]);
    return [...keys].map(knowledgeKey => {
      const matched = mappings.filter(m => m.knowledgeKey === knowledgeKey);
      const spans = matched.map(m => finalBytes?.get(entry.path)
        ? finalMappingSpan(m, entry.content, finalBytes.get(entry.path)) : m.span).filter(Boolean);
      return { knowledgeKey, locations: (spans.length ? spans : [null]).map(span => ({ repo, file: entry.path,
        ...(span ? { span } : {}), ...(entry.definitionDigest != null ? { definitionDigest: entry.definitionDigest } : {}) })) };
    });
  });
}

export function apply({ canonicalFile, generatorDir, outDir, options = {}, concern }) {
  return plan({ canonicalFile, generatorDir, options }).then(({ manifest, entries }) =>
    applyEntries({ entries, outDir, concern, generator: {
      id: manifest.name, version: String(options.generatorVersion ?? manifest.version ?? 'unknown'),
    } }));
}

function ownershipRows(priorRows, actions, ownership, generator, finalBytes) {
  const rows = new Map(priorRows.map(row => [row.path, row]));
  for (const { entry, outcome } of actions) {
    // noLedger remains shared territory; neither KEEP nor MISSING is an ownership claim.
    if (entry.noLedger || !accepted.has(outcome)) continue;
    const prior = rows.get(entry.path);
    // Opt-in must not silently reclassify another kind/owner's row, even on IDENTICAL.
    // update preflight refuses these paths; ordinary apply keeps its legacy write policy.
    if (prior && (prior.kind !== entry.kind || (prior.ownership &&
        (prior.ownership.id !== ownership.id || prior.ownership.generator !== generator.id)))) continue;
    const bytes = finalBytes.get(entry.path);
    rows.set(entry.path, { ...rowOf(entry), ownership: {
      id: ownership.id, generator: generator.id,
      fingerprint: fingerprint(bytes), generatedFingerprint: generatedFingerprint(bytes, entry.path),
    } });
  }
  return [...rows.values()];
}

/** Shared synchronous, read-only preparation for both preview and the only apply channel. */
function prepareEntries({ entries, outDir, generator, concern, anchorPolicy = 'final-bytes',
  ownership, update = false, expectedFiles = [] }) {
  if (!Array.isArray(entries) || entries.some(entry => !entry || typeof entry !== 'object' ||
    typeof entry.path !== 'string' || typeof entry.content !== 'string' ||
    typeof entry.kind !== 'string' || !entry.kind.trim() ||
    (entry.families != null && (!Array.isArray(entry.families) || entry.families.some(f => typeof f !== 'string'))))) {
    throw new Error('source entries require path, content, kind and valid families');
  }
  if (!generator || typeof generator.id !== 'string' || !generator.id.trim() ||
    typeof generator.version !== 'string' || !generator.version.trim()) throw new Error('source generator id/version required');
  if (!['final-bytes', 'written-only'].includes(anchorPolicy)) throw new Error('unknown anchor policy');
  if (ownership !== undefined && (!ownership || Array.isArray(ownership) || typeof ownership !== 'object' ||
      typeof ownership.id !== 'string' || !ownership.id.trim() || ownership.id.includes('\0'))) {
    throw new Error('ownership requires a non-empty id');
  }
  if (typeof update !== 'boolean') throw new Error('update must be a boolean');
  if (update && !ownership) throw new Error('update requires ownership');
  validateExpectedFiles(expectedFiles);
  const receipts = [LEDGER, ANCHORS];
  const entryPaths = entries.map(e => e.path);
  const pathOptions = { entryPaths, reservedFiles: receipts };
  const initialFiles = [...entryPaths, ...receipts, ...expectedFiles.map(item => item.path)];
  const initial = preflightPaths(outDir, initialFiles, pathOptions);
  const captured = captureFiles(initial.targets);
  checkExpectedFiles(expectedFiles, captured);
  const priorRows = captured.get(LEDGER) === null ? [] : JSON.parse(captured.get(LEDGER).toString('utf8')).entries ?? [];
  const priorByPath = new Map(priorRows.map(r => [r.path, r]));
  if (ownership && priorByPath.size !== priorRows.length) throw new Error('duplicate ownership ledger path');
  const plannedRows = mergeRows(priorRows, entries);
  const scope = concern ? scopeOf(plannedRows, concern) : null;
  const repo = resolve(outDir);
  const priorIndex = captured.get(ANCHORS) !== null
    ? readAnchorsIndex(captured.get(ANCHORS).toString('utf8'), {
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
  const files = [...initialFiles, ...plannedRows.map(r => r.path), ...priorPaths];
  const { root, targets } = preflightPaths(outDir, files, pathOptions);
  if (root !== initial.root) throw new Error('apply precondition changed: outDir resolution');
  captureFiles(targets, captured);
  const actions = preflightApply({ entries, targets, priorByPath, scope, captured, ownership, generator, update });
  const finalBytes = new Map(actions.map(action => [action.entry.path,
    action.changed ? Buffer.from(action.content) : captured.get(action.entry.path)]));
  const ledgerRows = ownership ? ownershipRows(priorRows, actions, ownership, generator, finalBytes) : plannedRows;
  const plannedPaths = new Set(entryPaths);
  const retained = ownership ? priorRows.filter(row => row.ownership?.id === ownership.id &&
    row.ownership.generator === generator.id && !plannedPaths.has(row.path)).map(row => ({
    path: row.path, kind: row.kind, outcome: 'RETAINED', changed: false, exists: captured.get(row.path) !== null,
  })) : [];
  let written = 0, identical = 0, kept = 0, globalFlowed = 0, merged = 0, routesNoTarget = 0;
  for (const action of actions) {
    if (action.changed) {
      written++;
      if (action.manualMerged) merged++;
      if (action.isGlobal && (scope || action.outcome !== 'ADD') && action.entry.merge !== 'markers') globalFlowed++;
    } else if (action.outcome === 'KEEP') kept++;
    else if (action.outcome === 'MISSING') routesNoTarget++;
    else identical++;
  }
  const outcomes = actions.map(({ entry, outcome }) => ({ repo, file: entry.path, outcome,
    ...(outcome !== 'MISSING' ? { fingerprint: fingerprint(finalBytes.get(entry.path)) } : {}),
  }));
  const ledger = { generator: generator.id, entries: ledgerRows };
  if (concern) ledger.concern = {
    name: concern.name, families: concern.families ?? 'all', scopeFile: concern.registryFile,
    scopeFileHash: createHash('sha256').update(readFileSync(concern.registryFile)).digest('hex').slice(0, 16),
    inScope: scope.set.size, closureAdded: scope.set.size - scope.base.size,
    written, identical, kept, globalFlowed,
  };
  const ledgerContent = JSON.stringify(ledger, null, 2) + '\n';
  const anchorEntries = anchorPolicy === 'written-only' || ownership
    ? entries.filter(entry => actions.some(action => action.entry === entry && accepted.has(action.outcome))) : entries;
  const finalAnchorPlan = planAnchors({ priorIndex: anchorPlan.priorIndex, generator,
    plannedKnowledgeKeys: anchorInputs(anchorEntries, repo, finalBytes), finalApplyOutcomes: outcomes, derivedFiles });
  const result = {
    name: generator.id, written, identical, total: entries.length,
    kept, globalFlowed, merged, routesNoTarget, outcomes,
    actions: actions.map((action, i) => ({ path: action.entry.path, kind: action.entry.kind,
      outcome: action.outcome, changed: action.changed,
      ...(outcomes[i].fingerprint ? { fingerprint: outcomes[i].fingerprint } : {}),
    })),
    retained,
    // A caller can pass these back as expectedFiles to pin a separately approved preview.
    expectedFiles: [...captured].map(([path, bytes]) => ({ path, fingerprint: bytes === null ? null : fingerprint(bytes) })),
    inScope: scope ? scope.set.size : null,
    closureAdded: scope ? scope.set.size - scope.base.size : null,
    ledger: targets.get(LEDGER), anchors: targets.get(ANCHORS),
  };
  return { root, repo, targets, actions, finalBytes, ledgerContent, finalAnchorPlan, result,
    assertFresh: () => checkCapturedFiles({ outDir, root, files, pathOptions, captured }),
  };
}

/** Same decisions/preconditions as apply, without mkdir, source writes or receipt writes.
 * Preview fingerprints describe prospective final bytes, not a published source certificate. */
export function previewEntries(args) {
  const prepared = prepareEntries(args);
  prepared.assertFresh();
  return prepared.result;
}

/** Apply already-produced entries. Ownership is opt-in; update additionally requires each
 * preexisting planned path's matching owner/generator/kind and trusted byte baseline.
 * Exclusive outDir coordination is still required: rechecks are not locking or rollback. */
export async function applyEntries(args) {
  const prepared = prepareEntries(args);
  const { root, repo, targets, actions, finalBytes, ledgerContent, finalAnchorPlan, result } = prepared;
  // All validation, policy/merge decisions and receipt preparation precede this last recheck.
  prepared.assertFresh();
  for (const { entry, target, changed, content, outcome } of actions) {
    if (changed) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    if (outcome !== 'MISSING') {
      const actual = readFileSync(target);
      if (!actual.equals(finalBytes.get(entry.path))) throw new Error(`apply bytes changed: ${entry.path}`);
      // The prepared ownership receipt describes these actual bytes, including MANUAL merges.
    }
  }
  mkdirSync(root, { recursive: true });
  writeFileSync(targets.get(LEDGER), ledgerContent);
  // No successful index/receipt is returned if any application/ledger write failed above.
  await writeAnchorsIndex(finalAnchorPlan, {
    repoRoots: { [repo]: root }, indexLocation: { repo, file: ANCHORS },
  });
  return result;
}
