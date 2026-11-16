import * as nodeFs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const ANCHORS_VERSION = 'truthsrc.anchors/v1';
const STATUSES = new Set(['planned', 'source-verified', 'stale', 'unmapped']);
const OUTCOMES = new Set(['ADD', 'COVER', 'MERGE', 'KEEP', 'IDENTICAL', 'MISSING', 'FAILED']);
const APPLIED = new Set(['ADD', 'COVER', 'MERGE', 'IDENTICAL']);
const LEVELS = new Set(['none', 'file', 'span', 'symbol']);
const HASH = /^sha256:[a-f0-9]{64}$/;
const clone = value => structuredClone(value);
const fold = value => value.normalize('NFC').toLowerCase();
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const scope = location => JSON.stringify([location.repo, location.file]);
/** Two records name the same physical anchor iff generator/repo/module/file/symbol/span
 * all match — extra metadata (e.g. definitionDigest) is not part of the identity. */
export const anchorIdentity = location => JSON.stringify([
  location.generator, location.repo, location.module, location.file, location.symbol, location.span,
]);
const sortedJson = value => JSON.stringify(value, (_, item) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
  }
  return item;
});

function fail(message, code = 'ANCHORS_INVALID') {
  throw Object.assign(new Error(message), { code });
}
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) fail(`${label} must be a non-empty string`);
  return value;
}
function relativeFile(file) {
  text(file, 'file');
  if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file) || file.includes('\\') ||
      file.split('/').some(part => !part || part === '.' || part === '..')) {
    fail(`Unsafe relative file: ${file}`, 'ANCHORS_PATH');
  }
  return file;
}
function fingerprint(value, label) {
  if (value != null && (typeof value !== 'string' || !HASH.test(value))) fail(`Invalid ${label}`);
  return value ?? null;
}
function span(value) {
  if (value == null) return null;
  object(value, 'span');
  if (!Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end) || value.start < 0 ||
      value.end <= value.start || typeof value.text !== 'string' ||
      Buffer.byteLength(value.text, 'utf8') !== value.end - value.start) {
    fail('span must have half-open UTF-8 byte offsets and exact text');
  }
  return { start: value.start, end: value.end, text: value.text };
}
function address(value) {
  object(value, 'location');
  return { repo: text(value.repo, 'repo'), file: relativeFile(value.file) };
}
function declaration(value) {
  return {
    ...address(value),
    module: value.module == null ? null : text(value.module, 'module'),
    symbol: value.symbol == null ? null : text(value.symbol, 'symbol'),
    span: span(value.span),
    ...(value.definitionDigest != null ? {
      definitionDigest: fingerprint(value.definitionDigest, 'definitionDigest'),
    } : {}),
  };
}
function unverified(reason, observedFingerprint = null) {
  return {
    method: 'none', level: 'none', fileVerified: false, symbolVerified: false, spanVerified: false,
    reason, ...(observedFingerprint ? { observedFingerprint } : {}),
  };
}
function spanMatches(bytes, value) {
  return value != null && value.end <= bytes.length &&
    bytes.subarray(value.start, value.end).equals(Buffer.from(value.text, 'utf8'));
}
function symbolEvidence(value) {
  object(value, 'symbolEvidence');
  const result = { symbol: text(value.symbol, 'symbolEvidence.symbol'), span: span(value.span),
    method: text(value.method, 'symbolEvidence.method') };
  if (!result.span || result.span.text !== result.symbol) fail('Symbol evidence must quote the exact symbol bytes');
  return result;
}
function checkedLocation(value) {
  object(value, 'indexed location');
  const result = { ...declaration(value), generator: text(value.generator, 'generator'),
    generatorVersion: text(value.generatorVersion, 'generatorVersion'),
    fingerprint: fingerprint(value.fingerprint, 'fingerprint'), status: value.status,
    verification: clone(object(value.verification, 'verification')) };
  // v1 optional location metadata: cross-pipeline reconciliation digest (a producer
  // pipeline pins the definition its artifacts were generated from). Carried, never
  // verified here — and deliberately not part of the anchor identity.
  if (value.definitionDigest != null) result.definitionDigest = fingerprint(value.definitionDigest, 'definitionDigest');
  if (!STATUSES.has(result.status)) fail(`Unknown anchor status: ${result.status}`);
  const verification = result.verification;
  if (!LEVELS.has(verification.level) || typeof verification.method !== 'string' ||
      ['fileVerified', 'symbolVerified', 'spanVerified'].some(key => typeof verification[key] !== 'boolean')) {
    fail('Invalid anchor verification');
  }
  if (result.status === 'source-verified') {
    if (!result.fingerprint || !verification.fileVerified || verification.level === 'none' ||
        verification.method === 'none' || verification.symbolVerified !== (verification.level === 'symbol') ||
        (verification.spanVerified && !result.span) ||
        (verification.level === 'span' && !verification.spanVerified)) fail('Invalid source verification');
    if (verification.symbolVerified) {
      const evidence = symbolEvidence(verification.symbolEvidence);
      if (!result.symbol || evidence.symbol !== result.symbol || (result.span &&
          (evidence.span.start < result.span.start || evidence.span.end > result.span.end))) {
        fail('Verified symbol needs matching parser evidence within its declared span');
      }
      verification.symbolEvidence = evidence;
    } else if (result.symbol && (verification.level !== 'file' || verification.spanVerified)) {
      fail('Unparsed declared symbols can only be file-verified');
    }
  } else if (verification.level !== 'none' || verification.method !== 'none' || verification.fileVerified ||
      verification.symbolVerified || verification.spanVerified) fail('Unverified status cannot carry verification');
  return result;
}
function indexFrom(anchors, migration) {
  const result = { version: ANCHORS_VERSION, anchors: Object.fromEntries(
    [...anchors.entries()].filter(([, locations]) => locations.length).sort(([a], [b]) => a.localeCompare(b)),
  ) };
  if (migration) result.migration = clone(migration);
  return result;
}

/** Pure reader. Unknown versions fail closed; legacy migration requires explicit opt-in. */
export function readAnchorsIndex(input, { legacy = 'reject', legacyDefaults = {} } = {}) {
  if (!['reject', 'planned'].includes(legacy)) fail('legacy must be reject or planned');
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  object(value, 'anchors index');
  if (value.version !== ANCHORS_VERSION) {
    if (value.version != null) fail(`Unsupported anchors version: ${value.version}`);
    if (legacy !== 'planned') fail('Legacy index requires explicit migration', 'ANCHORS_LEGACY');
    return migrateLegacyAnchorsIndex(value, legacyDefaults);
  }
  const anchors = new Map();
  for (const [key, locations] of Object.entries(object(value.anchors, 'anchors'))) {
    text(key, 'knowledgeKey');
    if (!Array.isArray(locations)) fail('v1 knowledgeKey values must be location arrays');
    const checked = locations.map(checkedLocation);
    if (new Set(checked.map(anchorIdentity)).size !== checked.length) fail(`Duplicate anchor location: ${key}`);
    anchors.set(key, checked);
  }
  return indexFrom(anchors, value.migration);
}

/**
 * Explicit, lossy legacy migration: { key: file | { file/path, ... } } (or { anchors: ... }).
 * Old fingerprints, spans and verification claims are deliberately NOT evidence.
 * Missing repo must be supplied in defaults. No source reads and no fake certification.
 */
export function migrateLegacyAnchorsIndex(input, defaults = {}) {
  object(input, 'legacy index');
  if (input.version != null) fail('Only unversioned single-value indexes can be migrated');
  const anchors = new Map();
  for (const [key, old] of Object.entries(object(input.anchors ?? input, 'legacy anchors'))) {
    text(key, 'knowledgeKey');
    const value = typeof old === 'string' ? { file: old } : object(old, 'legacy location');
    if (Array.isArray(old)) fail('Legacy migration expects a single location');
    const location = declaration({ ...defaults, ...value, file: value.file ?? value.path,
      span: null });
    anchors.set(key, [{ ...location,
      generator: text(value.generator ?? defaults.generator ?? 'legacy', 'generator'),
      generatorVersion: text(value.generatorVersion ?? defaults.generatorVersion ?? 'unknown', 'generatorVersion'),
      fingerprint: null, status: 'planned', verification: unverified('legacy-unverified'),
    }]);
  }
  const migrationDefaults = Object.fromEntries(['repo', 'module', 'generator', 'generatorVersion']
    .filter(key => defaults[key] != null).map(key => [key, text(defaults[key], `legacy default ${key}`)]));
  return indexFrom(anchors, { from: 'legacy-single-value', verification: 'discarded', defaults: migrationDefaults });
}

function reserved(file) {
  return /^(?:.*\.)?(?:anchors|sourcemap|source-map|source_map)\.json$/i.test(path.posix.basename(file)) ||
    /\.map$/i.test(file);
}

/**
 * Pure planning API (does not read source or certify planned text).
 * generator: { id, version }; plannedKnowledgeKeys: [{ knowledgeKey, locations: [{
 *   repo, module?, file, symbol?, span?: {start,end,text}, expectedFingerprint?
 * }] }]; finalApplyOutcomes: [{ repo, file, outcome, fingerprint? }].
 * `fingerprint` on an outcome describes FINAL bytes, not a generated pre-MERGE/KEEP template.
 * expectedFingerprint is checked for ADD/COVER/IDENTICAL only, never for KEEP/MERGE.
 * derivedFiles can additionally exclude nonstandard source-map/index artifact names.
 */
export function planAnchors({ priorIndex = { version: ANCHORS_VERSION, anchors: {} }, generator,
  plannedKnowledgeKeys = [], finalApplyOutcomes = [], derivedFiles = [] }) {
  object(generator, 'generator');
  const owner = { id: text(generator.id, 'generator.id'), version: text(generator.version, 'generator.version') };
  if (![plannedKnowledgeKeys, finalApplyOutcomes, derivedFiles].every(Array.isArray)) fail('Plan inputs must be arrays');
  const prior = readAnchorsIndex(priorIndex);
  const excluded = derivedFiles.map(address);
  const excludedScopes = new Set(excluded.map(scope));
  const isExcluded = value => reserved(value.file) || excludedScopes.has(scope(value));
  const declarations = [];
  const seen = new Set();
  for (const group of plannedKnowledgeKeys) {
    object(group, 'planned knowledge key');
    const knowledgeKey = text(group.knowledgeKey, 'knowledgeKey');
    if (!Array.isArray(group.locations)) fail('planned locations must be an array');
    for (const input of group.locations) {
      const location = { ...declaration(input), generator: owner.id, generatorVersion: owner.version,
        fingerprint: null, status: 'planned', verification: unverified('awaiting-source-check') };
      if (isExcluded(location)) fail('Derived source maps/anchors cannot anchor themselves', 'ANCHORS_SELF_REFERENCE');
      const key = JSON.stringify([knowledgeKey, anchorIdentity(location)]);
      if (seen.has(key)) fail('Duplicate planned location');
      seen.add(key);
      declarations.push({ knowledgeKey, location, expectedFingerprint: fingerprint(input.expectedFingerprint, 'expectedFingerprint') });
    }
  }
  const outcomes = finalApplyOutcomes.map(input => {
    const result = { ...address(input), outcome: input.outcome,
      fingerprint: fingerprint(input.fingerprint, 'outcome fingerprint') };
    if (!OUTCOMES.has(result.outcome)) fail(`Unknown final apply outcome: ${result.outcome}`);
    return result;
  });
  if (new Set(outcomes.map(scope)).size !== outcomes.length) fail('Duplicate final apply path');
  // Legacy/self-referencing prior entries are quarantined without hashing derived artifacts.
  return { version: ANCHORS_VERSION, generator: owner, priorIndex: prior,
    declarations, outcomes, derivedFiles: excluded };
}

function within(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}
function isMissing(error) { return error.code === 'ENOENT'; }

async function rootFor(repo, repoRoots, io) {
  const root = repoRoots instanceof Map ? repoRoots.get(repo) : Object.hasOwn(repoRoots, repo) ? repoRoots[repo] : undefined;
  if (typeof root !== 'string' || !path.isAbsolute(root)) fail(`Absolute repo root required: ${repo}`, 'ANCHORS_PATH');
  const realRoot = await io.realpath(root);
  if (!(await io.stat(realRoot)).isDirectory()) fail('Repo root must be a directory', 'ANCHORS_PATH');
  return realRoot;
}

// Resolve every component, rejecting both escaping links and case-insensitive aliases even on Linux.
async function resolveFile(value, root, io) {
  const file = relativeFile(value.file);
  const lexical = path.resolve(root, file);
  if (!within(root, lexical)) fail('Lexical path escapes repo', 'ANCHORS_PATH');
  let resolved = root;
  let missing = false;
  let leafStat = null;
  let leafSymlink = false;
  const components = file.split('/');
  for (const [i, component] of components.entries()) {
    if (!missing) {
      const names = await io.readdir(resolved);
      const matches = names.filter(name => fold(name) === fold(component));
      if (matches.length > 1 || (matches.length === 1 && matches[0] !== component)) {
        fail(`Case-fold filesystem alias: ${file}`, 'ANCHORS_ALIAS');
      }
    }
    const next = path.join(resolved, component);
    if (missing) { resolved = next; continue; }
    let stat;
    try { stat = await io.lstat(next); } catch (error) {
      if (!isMissing(error)) throw error;
      missing = true;
      resolved = next;
      continue;
    }
    let real;
    try { real = await io.realpath(next); } catch (error) {
      if (stat.isSymbolicLink()) fail(`Unresolvable symlink: ${file}`, 'ANCHORS_PATH');
      throw error;
    }
    if (!within(root, real)) fail(`Symlink escapes repo: ${file}`, 'ANCHORS_PATH');
    const actualStat = stat.isSymbolicLink() ? await io.stat(real) : stat;
    if (i < components.length - 1 && !actualStat.isDirectory()) fail(`Non-directory path component: ${file}`, 'ANCHORS_PATH');
    if (i === components.length - 1) { leafStat = actualStat; leafSymlink = stat.isSymbolicLink(); }
    resolved = real;
  }
  if (leafStat && !leafStat.isFile()) fail(`Source/index must be a regular file: ${file}`, 'ANCHORS_PATH');
  return { ...value, root, lexical, real: resolved, exists: !missing, stat: leafStat, leafSymlink };
}

function workPaths(plan) {
  const values = [...plan.declarations.map(item => item.location), ...plan.outcomes, ...plan.derivedFiles];
  for (const locations of Object.values(plan.priorIndex.anchors)) {
    values.push(...locations.filter(location => location.generator === plan.generator.id));
  }
  return [...new Map(values.map(value => [scope(value), address(value)])).values()];
}
function excluded(plan, value, indexLocation) {
  return reserved(value.file) || plan.derivedFiles.some(item => scope(item) === scope(value)) ||
    (indexLocation && scope(value) === scope(indexLocation));
}
async function preflight(plan, { repoRoots, indexLocation, io }) {
  object(repoRoots instanceof Map ? Object.fromEntries(repoRoots) : repoRoots, 'repoRoots');
  const paths = workPaths(plan);
  if (indexLocation) {
    address(indexLocation);
    if (!indexLocation.file.toLowerCase().endsWith('.json')) fail('Derived index must be a JSON file');
    if (plan.declarations.some(item => scope(item.location) === scope(indexLocation))) {
      fail('Index cannot reference itself', 'ANCHORS_SELF_REFERENCE');
    }
    if (paths.some(item => scope(item) === scope(indexLocation)) &&
        plan.outcomes.some(item => scope(item) === scope(indexLocation))) {
      fail('Index is not an application apply target', 'ANCHORS_SELF_REFERENCE');
    }
    paths.push(address(indexLocation));
  }
  const roots = new Map();
  const resolved = new Map();
  const aliases = new Map();
  function alias(key, value) {
    const previous = aliases.get(key);
    if (previous && previous !== scope(value)) fail(`Duplicate filesystem alias: ${value.file}`, 'ANCHORS_ALIAS');
    aliases.set(key, scope(value));
  }
  for (const value of paths) {
    if (resolved.has(scope(value))) continue;
    if (!roots.has(value.repo)) roots.set(value.repo, await rootFor(value.repo, repoRoots, io));
    const root = roots.get(value.repo);
    alias(`lexical:${fold(path.resolve(root, value.file))}`, value);
    const result = await resolveFile(value, root, io);
    alias(`real:${fold(result.real)}`, value);
    if (result.stat) alias(`inode:${result.stat.dev}:${result.stat.ino}`, value);
    resolved.set(scope(value), result);
  }
  if (indexLocation) {
    const target = resolved.get(scope(indexLocation));
    if (target.leafSymlink) fail('Index cannot replace a symlink', 'ANCHORS_PATH');
    // No mkdir: callers own repository layout and must supply an existing index directory.
    const parent = await io.realpath(path.dirname(target.real));
    if (!within(target.root, parent) || !(await io.stat(parent)).isDirectory()) fail('Unsafe index parent', 'ANCHORS_PATH');
  }
  return resolved;
}

async function sourceBytes(value, io) {
  const fresh = await resolveFile(value, value.root, io);
  if (!fresh.exists) return null;
  const handle = await io.open(fresh.real, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile()) fail('Source is not a regular file', 'ANCHORS_PATH');
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const current = await resolveFile(value, value.root, io);
    if (!current.exists || before.dev !== current.stat.dev || before.ino !== current.stat.ino ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) {
      fail('Source changed while reading', 'ANCHORS_SOURCE_CHANGED');
    }
    return bytes;
  } finally { await handle.close(); }
}

async function observe(plan, resolved, { parseSymbols, indexLocation, io }) {
  const wanted = new Map();
  for (const item of plan.declarations) wanted.set(scope(item.location), item.location);
  for (const locations of Object.values(plan.priorIndex.anchors)) {
    for (const location of locations) if (location.generator === plan.generator.id) wanted.set(scope(location), location);
  }
  const observations = new Map();
  for (const [key, value] of wanted) {
    if (excluded(plan, value, indexLocation)) continue;
    const bytes = await sourceBytes(resolved.get(key), io);
    let parser = null;
    if (bytes && parseSymbols) {
      // No module inference; parser receives actual bytes, not planned expected content.
      parser = await parseSymbols({ repo: value.repo, file: value.file, source: Buffer.from(bytes) });
      if (parser != null) {
        object(parser, 'parser result');
        text(parser.method, 'parser method');
        if (!Array.isArray(parser.symbols)) fail('parser symbols must be an array');
        parser = { method: parser.method, symbols: parser.symbols.map(evidence => symbolEvidence({
          ...evidence, method: parser.method,
        })) };
      }
    }
    observations.set(key, { bytes, fingerprint: bytes ? hash(bytes) : null, parser });
  }
  return observations;
}

function actualVerification(location, observation) {
  const { bytes, parser } = observation;
  if (location.span && !spanMatches(bytes, location.span)) return { error: 'declared-span-source-mismatch' };
  let evidence = null;
  if (location.symbol && parser) {
    const found = parser.symbols.filter(item => item.symbol === location.symbol);
    const matching = found.filter(item => spanMatches(bytes, item.span));
    if (found.length && !matching.length) return { error: 'symbol-source-mismatch' };
    const inSpan = matching.filter(item => !location.span ||
      (item.span.start >= location.span.start && item.span.end <= location.span.end));
    if (matching.length && !inSpan.length) return { error: 'symbol-span-mismatch' };
    // Ambiguous names require a generator-declared span or a more precise parser adapter.
    if (inSpan.length === 1) evidence = inSpan[0];
  }
  const verifiedSpan = Boolean(location.span) && (!location.symbol || Boolean(evidence));
  return { verification: {
    method: evidence ? 'parser-symbol+sha256-bytes' : verifiedSpan ? 'declared-span+sha256-bytes' : 'sha256-bytes',
    level: evidence ? 'symbol' : verifiedSpan ? 'span' : 'file',
    fileVerified: true, symbolVerified: Boolean(evidence), spanVerified: verifiedSpan,
    ...(evidence ? { symbolEvidence: clone(evidence) } : location.symbol ? {
      reason: !parser ? 'symbol-parser-unavailable' : 'symbol-not-found-or-ambiguous',
    } : {}),
  } };
}
function downgrade(location, status, reason, observation) {
  return { ...clone(location), status, verification: unverified(reason, observation?.fingerprint) };
}
function freshPrior(location, observation, version) {
  if (location.status !== 'source-verified' || location.generatorVersion !== version ||
      location.fingerprint !== observation.fingerprint) return false;
  if (location.span && !spanMatches(observation.bytes, location.span)) return false;
  if (location.verification.symbolVerified && !spanMatches(observation.bytes, location.verification.symbolEvidence.span)) return false;
  return true;
}
function successfulApplication(outcome, work, observation) {
  return APPLIED.has(outcome?.outcome) && Boolean(observation?.bytes) &&
    (!outcome.fingerprint || outcome.fingerprint === observation.fingerprint) &&
    (outcome.outcome === 'MERGE' || work.every(item => !item.expectedFingerprint ||
      item.expectedFingerprint === observation.fingerprint));
}
function reconcile(plan, observations, indexLocation) {
  const outcomes = new Map(plan.outcomes.map(item => [scope(item), item]));
  const byPath = new Map();
  for (const item of plan.declarations) {
    const key = scope(item.location);
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(item);
  }
  const anchors = new Map();
  const put = (key, location, replace = false) => {
    const locations = anchors.get(key) ?? [];
    const old = locations.findIndex(item => anchorIdentity(item) === anchorIdentity(location));
    if (old < 0) locations.push(location);
    else if (replace) locations[old] = location;
    anchors.set(key, locations);
  };
  for (const [key, locations] of Object.entries(plan.priorIndex.anchors)) {
    for (const old of locations) {
      if (old.generator !== plan.generator.id) { put(key, clone(old)); continue; }
      const work = byPath.get(scope(old)) ?? [];
      const outcome = outcomes.get(scope(old));
      const observation = observations.get(scope(old));
      const applied = successfulApplication(outcome, work, observation);
      // A successful outcome alone is not enough if actual source is absent or has drifted.
      // Replacement is confined to checked application AND this generator AND this path.
      if (applied && work.length) continue;
      if (excluded(plan, old, indexLocation)) put(key, downgrade(old, 'unmapped', 'derived-artifact-excluded'));
      else if (!observation?.bytes) put(key, downgrade(old, 'unmapped', 'source-missing', observation));
      else if (['FAILED', 'MISSING'].includes(outcome?.outcome)) {
        put(key, downgrade(old, 'stale', `apply-${outcome.outcome.toLowerCase()}`, observation));
      } else if ((outcome?.fingerprint && outcome.fingerprint !== observation.fingerprint) ||
          (APPLIED.has(outcome?.outcome) && !applied)) {
        put(key, downgrade(old, 'stale', 'applied-fingerprint-mismatch', observation));
      } else if (applied && !work.length) {
        put(key, downgrade(old, 'unmapped', 'no-longer-planned', observation));
      } else if (freshPrior(old, observation, plan.generator.version)) {
        put(key, { ...clone(old), verification: { ...clone(old.verification), method: 'prior-verified+sha256-bytes' } });
      } else {
        put(key, downgrade(old, 'stale', old.generatorVersion !== plan.generator.version ? 'generator-version-changed' :
          old.fingerprint !== observation.fingerprint ? 'source-fingerprint-changed' : 'prior-unverified', observation));
      }
    }
  }
  for (const item of plan.declarations) {
    const { knowledgeKey, location, expectedFingerprint } = item;
    const outcome = outcomes.get(scope(location));
    const observation = observations.get(scope(location));
    let result;
    if (!outcome) result = downgrade(location, 'planned', 'no-final-apply-outcome');
    else if (['FAILED', 'MISSING'].includes(outcome.outcome)) {
      result = downgrade(location, observation?.bytes ? 'stale' : 'unmapped',
        `apply-${outcome.outcome.toLowerCase()}`, observation);
    } else if (!observation?.bytes) result = downgrade(location, 'unmapped', 'source-missing', observation);
    else if ((outcome.fingerprint && outcome.fingerprint !== observation.fingerprint) ||
      (['ADD', 'COVER', 'IDENTICAL'].includes(outcome.outcome) && expectedFingerprint && expectedFingerprint !== observation.fingerprint)) {
      result = downgrade(location, 'stale', 'applied-fingerprint-mismatch', observation);
    } else {
      const verified = actualVerification(location, observation);
      // KEEP may reuse authentic v1 evidence only for the EXACT same declared location and fresh bytes.
      const prior = anchors.get(knowledgeKey)?.find(old => anchorIdentity(old) === anchorIdentity(location));
      if (!verified.error && outcome.outcome === 'KEEP' && prior && freshPrior(prior, observation, plan.generator.version) &&
          prior.verification.symbolVerified && !verified.verification.symbolVerified) {
        verified.verification = clone(prior.verification);
      }
      result = verified.error ? downgrade(location, 'stale', verified.error, observation) : {
        ...clone(location), fingerprint: observation.fingerprint, status: 'source-verified', verification: verified.verification,
      };
    }
    // A non-applied plan must never erase a retained prior certificate. In particular, an
    // unverified KEEP declaration cannot overwrite a different prior symbol/span anchor.
    const prior = anchors.get(knowledgeKey)?.find(old => anchorIdentity(old) === anchorIdentity(location));
    if (prior && !APPLIED.has(outcome?.outcome) && result.status !== 'source-verified') continue;
    put(knowledgeKey, result, true);
  }
  return indexFrom(anchors, plan.priorIndex.migration);
}

async function assertFresh(plan, observations, options) {
  // Re-preflight ALL paths, including the index, before any write/rename.
  const current = await preflight(plan, options);
  for (const [key, observation] of observations) {
    const bytes = await sourceBytes(current.get(key), options.io);
    if ((bytes ? hash(bytes) : null) !== observation.fingerprint) {
      fail('Source changed after verification', 'ANCHORS_SOURCE_CHANGED');
    }
  }
  return current;
}
async function assertIndexUnchanged(plan, target, io) {
  if (!target.exists) return;
  const raw = (await sourceBytes(target, io)).toString('utf8');
  // Reading prior metadata is for optimistic ownership checking, never a source digest.
  const index = readAnchorsIndex(raw, { legacy: plan.priorIndex.migration ? 'planned' : 'reject',
    legacyDefaults: plan.priorIndex.migration?.defaults ?? {} });
  if (sortedJson(index) !== sortedJson(plan.priorIndex)) fail('Index differs from supplied priorIndex', 'ANCHORS_INDEX_CHANGED');
}

/**
 * Read-only filesystem boundary. Source reads are POST apply; it never writes application code.
 * repoRoots: object or Map of logical repo ID -> absolute owned root.
 * parseSymbols?: async ({repo,file,source: Buffer}) -> null | {
 *   method: parser/version, symbols: [{symbol, span: {start,end,text}}]
 * }. Symbol evidence must be parser-produced and quote the literal symbol bytes. No built-in
 * parser, qualified-name resolution or module validation is provided. No symbol match =>
 * file verification only; location.span is never inferred from parser results.
 * Callers must coordinate exclusive roots/index ownership. Rechecks detect ordinary drift,
 * not hostile concurrent directory replacement; portable fs/promises has no openat/renameat
 * transaction. Other generators' locations are preserved, not read or recertified.
 */
export async function verifyAnchorsPlan(plan, { repoRoots, parseSymbols, io = nodeFs } = {}) {
  return materialize(plan, { repoRoots, parseSymbols, io }, false);
}

/**
 * Atomic derived-index boundary. indexLocation: {repo,file}; parent must already exist;
 * caller must place it OUTSIDE the authority truth tree and provide post-apply outcomes.
 * Existing target must match priorIndex (unknown files are never overwritten). Only our
 * exclusive new temporary file can be cleaned up. Returns an index ONLY after rename succeeds.
 * `io` is the fs/promises interface, injectable for boundary-failure tests, not a rewrite channel.
 */
export async function writeAnchorsIndex(plan, { repoRoots, indexLocation, parseSymbols, io = nodeFs } = {}) {
  if (!indexLocation) fail('indexLocation is required');
  return materialize(plan, { repoRoots, indexLocation: address(indexLocation), parseSymbols, io }, true);
}

async function materialize(input, options, write) {
  // Revalidate even if a caller mutates a pure plan; never trust planned verification flags.
  object(input, 'plan');
  if (input.version !== ANCHORS_VERSION) fail('Unsupported plan version');
  const plan = planAnchors({ priorIndex: input.priorIndex, generator: input.generator,
    plannedKnowledgeKeys: input.declarations.map(item => ({ knowledgeKey: item.knowledgeKey,
      locations: [{ ...item.location, expectedFingerprint: item.expectedFingerprint }] })),
    finalApplyOutcomes: input.outcomes, derivedFiles: input.derivedFiles });
  if (options.parseSymbols != null && typeof options.parseSymbols !== 'function') fail('parseSymbols must be a function');
  const resolved = await preflight(plan, options);
  if (write) await assertIndexUnchanged(plan, resolved.get(scope(options.indexLocation)), options.io);
  const observations = await observe(plan, resolved, options);
  const index = reconcile(plan, observations, options.indexLocation);
  const fresh = await assertFresh(plan, observations, options);
  if (!write) return index;
  const target = fresh.get(scope(options.indexLocation));
  // A disappeared/appeared index is also a concurrent change, not permission to clobber it.
  if (target.exists !== resolved.get(scope(options.indexLocation)).exists) fail('Index existence changed', 'ANCHORS_INDEX_CHANGED');
  await assertIndexUnchanged(plan, target, options.io);
  const temporary = path.join(path.dirname(target.real), `.${path.basename(target.real)}.tmp-${process.pid}-${randomUUID()}`);
  let handle;
  let ownedStat;
  let created = false;
  try {
    handle = await options.io.open(temporary, 'wx', 0o600);
    created = true;
    ownedStat = await handle.stat();
    await handle.writeFile(`${JSON.stringify(index, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    const beforeRename = await assertFresh(plan, observations, options);
    const latest = beforeRename.get(scope(options.indexLocation));
    if (latest.exists !== target.exists || latest.real !== target.real) fail('Index changed before rename', 'ANCHORS_INDEX_CHANGED');
    await assertIndexUnchanged(plan, latest, options.io);
    const temporaryStat = await options.io.lstat(temporary);
    if (temporaryStat.isSymbolicLink() || temporaryStat.dev !== ownedStat.dev || temporaryStat.ino !== ownedStat.ino) {
      fail('Owned temporary index was replaced', 'ANCHORS_INDEX_CHANGED');
    }
    await options.io.rename(temporary, target.real);
    // No fallible receipt/cleanup operation after the atomic commit.
    return index;
  } catch (error) {
    // If the initial handle.stat failed, recover inode identity while our exclusive handle
    // is still open. Never unlink merely because an unpredictable filename looks like ours.
    if (created && !ownedStat && handle) { try { ownedStat = await handle.stat(); } catch { /* Fail closed. */ } }
    if (handle) { try { await handle.close(); } catch { /* Preserve the original failure. */ } }
    if (ownedStat) {
      try {
        const current = await options.io.lstat(temporary);
        if (!current.isSymbolicLink() && current.dev === ownedStat.dev && current.ino === ownedStat.ino) {
          await options.io.unlink(temporary);
        }
      } catch { /* Never delete an unknown file or obscure the original error. */ }
    }
    throw error;
  }
}
