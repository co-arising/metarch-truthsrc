import { lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { authorFiles } from './author-tree.mjs';
import { compileAuthorEntries } from './author-surface.mjs';
import { validateSnapshot } from './validate.mjs';
import { preflightPaths } from '../src/core/apply-preflight.mjs';
import { copyImmutableData } from './immutable-data.mjs';

const plans = new WeakMap();
const semantic = canonical => { const { authoring, ...value } = canonical; return JSON.stringify(value); };
const inside = (root, path) => { const p = relative(root, path); return p === '' || !isAbsolute(p) && p !== '..' && !p.startsWith('../'); };
const fail = message => { throw new Error('AUTHOR_TRANSFORM: ' + message); };
const stats = files => ({ files: files.filter(f => f.file.endsWith('.yaml')).length,
  bytes: files.reduce((n, f) => n + Buffer.byteLength(f.content), 0),
  lines: files.reduce((n, f) => n + f.content.split('\n').length - Number(f.content.endsWith('\n')), 0) });

export function planAuthorTransform(treeDir, transform) {
  const root = resolve(treeDir), input = authorFiles(root).files;
  const before = compileAuthorEntries(input, { rootName: basename(root) });
  const transformed = transform(copyImmutableData(input));
  const files = copyImmutableData(transformed.files);
  const after = compileAuthorEntries(files, { rootName: basename(root) });
  if (semantic(before.canonical) !== semantic(after.canonical)) fail('semantic projection differs');
  const validation = validateSnapshot(after.snapshot);
  if (validation.hard.length) fail('expanded validation failed: ' + validation.hard.join('; '));
  if (JSON.stringify(authorFiles(root).files) !== JSON.stringify(input)) fail('source changed during plan');
  const previous = new Map(input.map(f => [f.file, f.content])), next = new Map(files.map(f => [f.file, f.content]));
  const changes = [...new Set([...previous.keys(), ...next.keys()])].sort().flatMap(file =>
    previous.get(file) === next.get(file) ? [] : [{ file, operation: !previous.has(file) ? 'add' : !next.has(file) ? 'remove' : 'replace' }]);
  const plan = copyImmutableData({ schemaVersion: 'truthsrc.author-transform/v1', source: root, system: before.system.id,
    files, changes, before: stats(input), after: stats(files), validation, report: transformed.report || [] });
  plans.set(plan, input);
  return plan;
}

export function applyAuthorTransform(plan, { out, inPlace = false } = {}) {
  const input = plans.get(plan);
  if (!input) fail('live source-bound plan required');
  if (JSON.stringify(authorFiles(plan.source).files) !== JSON.stringify(input)) fail('source changed since plan');
  if (inPlace === Boolean(out)) fail('select a new output or explicit in-place apply');
  const root = inPlace ? plan.source : resolve(out);
  if (basename(root) !== plan.system) fail('output basename must equal system.id');
  if (!inPlace) {
    if (inside(root, plan.source) || inside(plan.source, root)) fail('source and output overlap');
    try { lstatSync(root); fail('output already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const paths = [...new Set([...plan.files.map(f => f.file), ...(inPlace ? input.map(f => f.file) : [])])];
  const { targets } = preflightPaths(root, paths, { entryPaths: plan.files.map(f => f.file) });
  const compiled = compileAuthorEntries(plan.files);
  if (semantic(compiled.canonical) !== semantic(compileAuthorEntries(input).canonical)) fail('planned semantics changed');
  if (JSON.stringify(authorFiles(plan.source).files) !== JSON.stringify(input)) fail('source changed before apply');
  const old = new Map(input.map(f => [f.file, f.content]));
  if (!inPlace) mkdirSync(root, { recursive: true });
  for (const entry of plan.files) {
    if (inPlace && old.get(entry.file) === entry.content) continue;
    const target = targets.get(entry.file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.content, { flag: inPlace && old.has(entry.file) ? 'w' : 'wx' });
  }
  if (inPlace) for (const change of plan.changes.filter(c => c.operation === 'remove')) {
    const target = targets.get(change.file);
    if (readFileSync(target, 'utf8') !== old.get(change.file)) fail('source changed before removal: ' + change.file);
    unlinkSync(target);
  }
  const actual = authorFiles(root).files;
  if (JSON.stringify(actual) !== JSON.stringify(plan.files)) fail('final author file set differs');
  return { schemaVersion: plan.schemaVersion, output: root, applied: true, changes: plan.changes, before: plan.before, after: plan.after };
}
