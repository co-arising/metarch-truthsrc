// Read-only apply preparation. The existing core remains the only application write channel.
import { lstatSync, readdirSync, realpathSync, readFileSync } from 'node:fs';
import { dirname, join, parse, resolve, win32 } from 'node:path';
import { hasManualBlocks, mergeManualBlocks, mergeRoutesBlock } from './merge.mjs';

const fold = value => value.normalize('NFC').toLowerCase();
const changed = new Set(['ADD', 'COVER', 'MERGE']);
function stat(file) {
  try { return lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function relativeFile(file) {
  if (typeof file !== 'string' || !file || file.includes('\0') || file.includes('\\') ||
      win32.isAbsolute(file) || file.startsWith('/') || file.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`unsafe entry path / entry escapes outDir: ${file}`);
  }
}
function component(parent, name, label, allowSymlink = false) {
  const parentStat = stat(parent);
  if (!parentStat) return join(parent, name);
  if (!parentStat.isDirectory()) throw new Error(`non-directory path component: ${label}`);
  const matches = readdirSync(parent).filter(item => fold(item) === fold(name));
  if (matches.length > 1 || (matches.length === 1 && matches[0] !== name)) {
    throw new Error(`case-fold filesystem alias: ${label}`);
  }
  const target = join(parent, name), info = stat(target);
  if (info?.isSymbolicLink()) {
    if (!allowSymlink) throw new Error(`symlink apply path: ${label}`);
    return realpathSync(target); // Existing ancestors define the caller's root; never follow a target link.
  }
  return target;
}

/** Check every path/component, including absent paths, prior rows and derived receipts, before reads/writes. */
export function preflightPaths(outDir, files, { entryPaths = [], reservedFiles = [] } = {}) {
  if (typeof outDir !== 'string' || !outDir || outDir.includes('\0')) throw new Error('outDir required');
  const absolute = resolve(outDir), parts = absolute.slice(parse(absolute).root.length).split('/').filter(Boolean);
  let root = parse(absolute).root;
  for (const [i, name] of parts.entries()) root = component(root, name, absolute, i < parts.length - 1);
  if (stat(root) && !stat(root).isDirectory()) throw new Error(`outDir must be a directory: ${outDir}`);
  const entries = new Set();
  for (const file of entryPaths) {
    relativeFile(file);
    if (entries.has(fold(file))) throw new Error(`duplicate/case-fold output path: ${file}`);
    if (reservedFiles.some(reserved => fold(reserved) === fold(file))) throw new Error(`reserved apply receipt path: ${file}`);
    entries.add(fold(file));
  }
  const prefixes = new Map(), leaves = new Set(), inodes = new Map(), targets = new Map();
  for (const file of new Set(files)) {
    relativeFile(file);
    let target = root, prefix = '';
    const names = file.split('/');
    for (const [i, name] of names.entries()) {
      prefix = prefix ? `${prefix}/${name}` : name;
      const key = fold(prefix), previous = prefixes.get(key);
      if (previous && previous !== prefix) throw new Error(`case-fold path component alias: ${file}`);
      if ((i < names.length - 1 && leaves.has(key)) ||
          (i === names.length - 1 && prefixes.has(key) && !leaves.has(key))) {
        throw new Error(`file/directory output collision: ${file}`);
      }
      prefixes.set(key, prefix);
      target = component(target, name, file);
    }
    leaves.add(fold(file));
    const info = stat(target);
    if (info && !info.isFile()) throw new Error(`apply target must be a regular file: ${file}`);
    if (info) {
      if (info.nlink > 1) throw new Error(`hardlink apply target: ${file}`);
      const key = `${info.dev}:${info.ino}`, previous = inodes.get(key);
      if (previous && previous !== file) throw new Error(`hardlink output alias: ${file}`);
      inodes.set(key, file);
    }
    targets.set(file, target);
  }
  return { root, targets };
}

function checkManual(text, label) {
  // Reuse the merger's marker-order/pair checks, even for IDENTICAL/KEEP/MISSING inputs.
  if (text.includes('// ==== BEGIN MANUAL ====') || text.includes('// ==== END MANUAL ====')) {
    mergeManualBlocks(text, text, label);
  }
}
function checkRoutes(block, label) {
  const markers = block.match(/# >>> gen_api_layer \(E301\) >>>|# <<< gen_api_layer <<</g) ?? [];
  if (markers.length !== 2 || markers[0] !== '# >>> gen_api_layer (E301) >>>' || markers[1] !== '# <<< gen_api_layer <<<') {
    throw new Error(`${label}: malformed incoming routes marker block`);
  }
}

/** Compute final contents/policies without mkdir/write; every prospective scope leak refuses here. */
export function preflightApply({ entries, targets, priorByPath, scope }) {
  return entries.map(entry => {
    const target = targets.get(entry.path), exists = Boolean(stat(target));
    const previous = exists ? readFileSync(target, 'utf8') : null;
    checkManual(entry.content, entry.path);
    if (previous !== null) checkManual(previous, entry.path);
    if (entry.merge != null && entry.merge !== 'markers') throw new Error(`unknown merge policy: ${entry.merge}`);
    if (entry.merge === 'markers') checkRoutes(entry.content, entry.path);
    const isGlobal = (entry.families ?? []).length === 0;
    let outcome, content = entry.content, manualMerged = false;
    if (scope && !isGlobal && !scope.set.has(entry.path) && exists) {
      if (entry.merge === 'markers') mergeRoutesBlock(entry.content, previous, { label: entry.path });
      outcome = 'KEEP'; content = previous;
    } else if (entry.merge === 'markers') {
      if (!exists) { outcome = 'MISSING'; content = null; }
      else {
        const result = mergeRoutesBlock(entry.content, previous, { release: entry.release ?? null, label: entry.path });
        content = result.text; outcome = result.changed ? 'MERGE' : 'IDENTICAL';
      }
    } else if (!exists) outcome = 'ADD';
    else if (previous === content) outcome = 'IDENTICAL';
    else {
      const ownerKind = priorByPath.get(entry.path)?.kind ?? entry.kind;
      if (hasManualBlocks(previous) && ownerKind === entry.kind) {
        content = mergeManualBlocks(entry.content, previous, entry.path);
        outcome = content === previous ? 'IDENTICAL' : 'MERGE'; manualMerged = outcome === 'MERGE';
      } else if (!scope) {
        throw new Error(`refusing to overwrite existing file: ${entry.path} ` + (ownerKind !== entry.kind
          ? `(the ledger owns this path as kind "${ownerKind}", incoming "${entry.kind}" — cross-face regeneration needs the owning face or a --concern scope)`
          : '(no MANUAL blocks to merge and no --concern scope declared — the file drifted outside generated territory)'));
      } else outcome = 'COVER';
    }
    if (content !== null) checkManual(content, entry.path);
    if (scope && changed.has(outcome) && !isGlobal && !scope.set.has(entry.path)) {
      throw new Error(`scope leak: family artifact changed outside the concern closure — ${entry.path}`);
    }
    return { entry, target, outcome, content, isGlobal, manualMerged, changed: changed.has(outcome) };
  });
}
