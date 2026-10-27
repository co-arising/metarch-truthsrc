// Tree I/O adapter. Canonical projection lives in the pure snapshot worker;
// compileTree retains the existing text-returning API.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseDoc, listInboxStages } from './shared.mjs';
import { createSnapshot, compileSnapshot } from './compile-snapshot.mjs';

export function loadTreeSnapshot(treeDir) {
  const atoms = [];
  const capture = (file, label = join(treeDir, file)) => {
    const doc = parseDoc(readFileSync(join(treeDir, file), 'utf8'), label);
    atoms.push({ file, doc });
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
  const fallbackWorkshop = treeDir.split('/').filter(Boolean).pop();
  return createSnapshot(atoms, { ...(fallbackWorkshop !== undefined ? { fallbackWorkshop } : {}), inboxDirs, aggregateDirs });
}

export function compileTree(treeDir) {
  return compileSnapshot(loadTreeSnapshot(treeDir)).text;
}
