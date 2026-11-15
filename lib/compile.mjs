// Tree I/O adapter. Canonical projection lives in the pure snapshot worker;
// compileTree retains the existing text-returning API.
import { readdirSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { parseDoc, listInboxStages } from './shared.mjs';
import { createSnapshot, compileSnapshot } from './compile-snapshot.mjs';
import { FORMAL_PRODUCT_FAMILIES } from './formal-products-pure.mjs';
import { loadAuthorTree } from './author-tree.mjs';
import { buildSourceIndex } from './source-index.mjs';
import { carryLegacySurface, LEGACY_SURFACE_MAX_BYTES } from './legacy-author-surface.mjs';
import { decomposeEntries } from './decompose.mjs';

export function loadTreeSnapshot(treeDir) {
  if (existsSync(join(treeDir, 'system.yaml'))) return loadAuthorTree(treeDir).snapshot;
  return captureLegacyTree(treeDir).snapshot;
}

function captureLegacyTree(treeDir) {
  const atoms = [], files = [];
  const capture = (file, label = join(treeDir, file)) => {
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(join(treeDir, file)));
    const doc = parseDoc(content, label);
    atoms.push({ file, doc });
    files.push({ file, content });
  };
  const captureDirectory = (directory, filter = () => true) => {
    const absolute = join(treeDir, directory);
    if (!existsSync(absolute)) return;
    for (const file of readdirSync(absolute).filter(f => f.endsWith('.yaml') && filter(f))) {
      capture(`${directory}/${file}`);
    }
  };
  if (existsSync(join(treeDir, 'workshop.yaml'))) capture('workshop.yaml', 'workshop.yaml');
  const inboxDirs = listInboxStages(treeDir).map(({ dir }) => dir);
  for (const dir of inboxDirs) captureDirectory(`inbox/${dir}`);
  const aggregateDirs = existsSync(join(treeDir, 'aggregates'))
    ? readdirSync(join(treeDir, 'aggregates'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort() : [];
  for (const dir of aggregateDirs) captureDirectory(`aggregates/${dir}/notes`);
  captureDirectory('policies', f => f.endsWith('.policy.yaml'));
  for (const dir of aggregateDirs) {
    capture(`aggregates/${dir}/aggregate.yaml`);
    captureDirectory(`aggregates/${dir}/slices`, f => f.endsWith('.slice.yaml'));
  }
  for (const [dir, suffix] of [['value-objects', '.vo.yaml'], ['read-models', '.rm.yaml'], ['stories', '.story.yaml'], ['domain-services', '.port.yaml']]) captureDirectory(dir, f => f.endsWith(suffix));
  // Preserve the legacy root directory read and exact optional use-cases selection.
  if (existsSync(treeDir)) for (const file of readdirSync(treeDir).filter(f => f === 'use-cases.yaml')) capture(file);
  captureDirectory('pipelines', f => f.endsWith('.pipeline.yaml'));
  captureDirectory('scenarios', f => f.endsWith('.scenario.yaml'));
  captureDirectory('sagas', f => f.endsWith('.saga.yaml'));
  const formalRoot = join(treeDir, 'formal-products');
  if (existsSync(formalRoot)) {
    const families = readdirSync(formalRoot, { withFileTypes: true });
    for (const family of families) if (!family.isDirectory() || !Object.hasOwn(FORMAL_PRODUCT_FAMILIES, family.name)) throw new Error('unknown formal product residence ' + family.name);
    for (const family of Object.keys(FORMAL_PRODUCT_FAMILIES)) {
      const folder = join(formalRoot, family);
      if (!existsSync(folder)) continue;
      for (const file of readdirSync(folder, { withFileTypes: true })) if (!file.isFile() || !file.name.endsWith('.formal.yaml')) throw new Error('non-atom in formal product residence ' + family + '/' + file.name);
      captureDirectory('formal-products/' + family, f => f.endsWith('.formal.yaml'));
    }
  }
  const fallbackWorkshop = treeDir.split('/').filter(Boolean).pop();
  return { snapshot: createSnapshot(atoms, { ...(fallbackWorkshop !== undefined ? { fallbackWorkshop } : {}), inboxDirs, aggregateDirs }), files };
}

function capturesEveryYaml(treeDir, files) {
  if (!lstatSync(treeDir).isDirectory()) return false;
  const remaining = new Set(files.map(entry => entry.file)), pending = [''];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(join(treeDir, directory), { withFileTypes: true })) {
      const file = directory ? directory + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) return false;
      if (entry.isDirectory()) {
        if (file.split('/').length >= 4) return false;
        pending.push(file);
      } else if (entry.name.endsWith('.yaml') && (!entry.isFile() || !remaining.delete(file))) return false;
    }
  }
  return remaining.size === 0;
}

function compileLegacyTree(treeDir) {
  const { snapshot, files } = captureLegacyTree(treeDir), result = compileSnapshot(snapshot);
  const root = snapshot.atoms.find(atom => atom.file === 'workshop.yaml')?.doc;
  if (!root || !(root.name || root.workshop) ||
      files.reduce((size, entry) => size + Buffer.byteLength(entry.file) + Buffer.byteLength(entry.content), 0) > LEGACY_SURFACE_MAX_BYTES ||
      !capturesEveryYaml(treeDir, files)) return { ...result, snapshot };
  let regenerated;
  try { regenerated = decomposeEntries(result.text); }
  // Optional source preservation must not make an inverse a prerequisite for semantic compilation.
  catch { return { ...result, snapshot }; }
  return { ...carryLegacySurface(result, snapshot, files, regenerated), snapshot };
}

export function compileTreeWithSources(treeDir, options = {}) {
  if (existsSync(join(treeDir, 'system.yaml'))) {
    const result = loadAuthorTree(treeDir);
    return { ...result, sourceIndex: buildSourceIndex(result.snapshot, result.canonical, {
      system: result.system.id, context: result.context.id, physicalFiles: result.physicalFiles,
      authorAtoms: result.authorAtoms, authorSystem: result.system, representationMappings: result.representationMappings,
    }) };
  }
  const result = compileLegacyTree(treeDir);
  return { ...result, sourceIndex: buildSourceIndex(result.snapshot, result.canonical, options) };
}

export function compileTree(treeDir) {
  if (existsSync(join(treeDir, 'system.yaml'))) return loadAuthorTree(treeDir).text;
  return compileLegacyTree(treeDir).text;
}
