import { lstatSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve, relative, isAbsolute, sep, parse } from 'node:path';
import { authorFiles } from './author-tree.mjs';
import { loadTreeSnapshot } from './compile.mjs';
import { compileSnapshot } from './compile-snapshot.mjs';
import { parseDoc, INBOX_PRODUCTS } from './shared.mjs';
import { parseAuthorDoc } from './author-parse.mjs';
import { AUTHOR_VERSION, CONTEXT_VERSION, emitAuthorDoc, checkResidence, compileAuthorEntries } from './author-surface.mjs';
import { preflightPaths } from '../src/core/apply-preflight.mjs';

const json = value => JSON.stringify(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const within = (root, path) => { const p = relative(root, path); return p === '' || !isAbsolute(p) && p !== '..' && !p.startsWith('..' + sep); };
function plainPath(input) {
  const lexical = isAbsolute(input) ? input : process.cwd() + sep + input;
  let current = parse(lexical).root;
  for (const part of lexical.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error('MIGRATION: symlink path ' + current); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return resolve(lexical);
}
function evidence(root, dir = '') {
  return readdirSync(join(root, dir)).sort().flatMap(name => {
    const file = dir ? dir + '/' + name : name, path = join(root, file), stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory() && !stat.isFile()) throw new Error('MIGRATION: special source file ' + file);
    if (stat.isDirectory()) return evidence(root, file);
    return [{ file, sha256: digest(readFileSync(path)) }];
  });
}
export function semanticProjection(canonical) {
  const value = structuredClone(canonical);
  for (const key of ['authoring', 'inboxLayout', 'noteResidence']) delete value[key];
  return value;
}
function destination(atom) {
  if (!atom.file.startsWith('inbox/')) return atom.file;
  const parts = atom.file.split('/'), stage = atom.doc.origin.stage;
  if (INBOX_PRODUCTS.some(([dir]) => dir === parts[1])) return atom.file;
  let dir = INBOX_PRODUCTS.find(([, s]) => s === stage)?.[0];
  if (stage === 'refining') dir = { relation: '07-aggregate-relations', readModel: '13-read-models', policy: '10-policies' }[atom.doc.type] || '06-aggregate-detail';
  if (!dir) throw new Error('MIGRATION: unknown note stage ' + stage);
  return 'inbox/' + dir + '/' + parts[2];
}
export function planAuthorMigration({ treeDir, system, context, name, responsibility, format = 'truthsrc/v1', legacySnapshot, legacyMetadata }) {
  if (!name || !responsibility) throw new Error('MIGRATION: explicit system name and context responsibility required');
  if (!['truthsrc/v1', 'metarch.truth.v1'].includes(format)) throw new Error('MIGRATION: unsupported explicit format');
  const sourceRoot = treeDir === undefined ? null : plainPath(treeDir);
  const sourceEvidence = sourceRoot ? evidence(sourceRoot) : null;
  let snapshot, originalFiles, legacy;
  if (format === 'metarch.truth.v1') {
    if (!legacySnapshot) throw new Error('MIGRATION: BC adapter snapshot required');
    snapshot = legacySnapshot; legacy = legacyMetadata;
    originalFiles = new Map(snapshot.atoms.map(a => [a.file, emitAuthorDoc(a.doc)]));
  } else {
    const inventory = authorFiles(treeDir);
    originalFiles = new Map(inventory.files.map(e => [e.file, e.content]));
    if (!originalFiles.has('workshop.yaml') || originalFiles.has('system.yaml')) throw new Error('MIGRATION: explicit legacy workshop tree required');
    const root = parseAuthorDoc(originalFiles.get('workshop.yaml'), 'workshop.yaml');
    if (root.schemaVersion !== 'truthsrc/v1' || Object.keys(root).some(k => !['schemaVersion', 'name', 'workshop', 'sessionOrder'].includes(k))
      || root.name !== undefined && root.workshop !== undefined || !(root.name || root.workshop))
      throw new Error('MIGRATION: unknown legacy root version/content or ambiguous workshop identity');
    snapshot = loadTreeSnapshot(treeDir);
    const captured = new Set(snapshot.atoms.map(a => a.file));
    for (const { file, content } of inventory.files) {
      if (['README.md', 'inbox/README.md'].includes(file)) continue;
      if (!captured.has(file)) throw new Error('MIGRATION: unrecognized source file ' + file);
      if (file !== 'workshop.yaml') checkResidence(file, parseDoc(content, file), { legacy: true });
    }
    const inboxDirs = inventory.directories.filter(d => d.startsWith('inbox/') && d.split('/').length === 2).map(d => d.split('/')[1]);
    if (inboxDirs.some(d => !INBOX_PRODUCTS.some(([p]) => p === d)) && inboxDirs.some(d => INBOX_PRODUCTS.some(([p]) => p === d)))
      throw new Error('MIGRATION: mixed legacy and numbered inbox requires an explicit prior resolution');
  }
  const previous = compileSnapshot(snapshot).canonical;
  const systemDoc = { kind: 'system', schemaVersion: AUTHOR_VERSION, id: system, name, workshop: previous.workshop,
    sessionOrder: previous.sessions.map(s => s.session), contexts: [context],
    ...(previous.workshopKey || legacy ? { compatibility: { ...(previous.workshopKey ? { workshopKey: previous.workshopKey } : {}), ...(legacy ? { metarch: legacy } : {}) } } : {}) };
  const contextDoc = { kind: 'context', schemaVersion: CONTEXT_VERSION, id: context, name: context, responsibility };
  const files = [{ file: 'system.yaml', content: emitAuthorDoc(systemDoc) },
    { file: `contexts/${context}/context.yaml`, content: emitAuthorDoc(contextDoc) }], mappings = [];
  for (const atom of snapshot.atoms) {
    if (atom.file === 'workshop.yaml') continue;
    if (atom.doc.kind === 'aggregate' && atom.doc.context !== context)
      throw new Error('MIGRATION: aggregate context must already be explicit and matching: ' + atom.file);
    const normalized = destination(atom), file = normalized.startsWith('inbox/') ? normalized : `contexts/${context}/${normalized}`;
    files.push({ file, content: originalFiles.get(atom.file) });
    mappings.push({ from: atom.file, to: file, relation: 'representation-only' });
  }
  for (const file of ['README.md', 'inbox/README.md']) if (originalFiles.has(file)) files.push({ file, content: originalFiles.get(file) });
  files.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  const migrated = compileAuthorEntries(files);
  if (json(semanticProjection(previous)) !== json(semanticProjection(migrated.canonical))) throw new Error('MIGRATION: semantic projection changed');
  if (sourceRoot && json(sourceEvidence) !== json(evidence(sourceRoot))) throw new Error('MIGRATION: source changed during plan');
  return { schemaVersion: 'truthsrc.author-migration/v1', format, system, context, files, mappings,
    ...(sourceRoot ? { sourceRoot, sourceEvidence } : {}),
    preservation: { semanticEqual: true, semanticSha256: digest(json(semanticProjection(previous))), atoms: snapshot.atoms.length, frozenSeq: true, legacyNoteIds: true, storedDecisionsAndFolds: true } };
}
export function writeAuthorMigration(plan, outDir) {
  const root = plainPath(outDir);
  if (basename(root) !== plan.system) throw new Error('MIGRATION: destination basename must equal system.id');
  if (plan.sourceRoot) {
    const source = plainPath(plan.sourceRoot);
    if (within(source, root) || within(root, source)) throw new Error('MIGRATION: source and destination must be disjoint');
    if (json(plan.sourceEvidence) !== json(evidence(source))) throw new Error('MIGRATION: source changed since plan');
  }
  const compiled = compileAuthorEntries(plan.files);
  if (compiled.system.id !== plan.system || compiled.context.id !== plan.context) throw new Error('MIGRATION: plan declarations differ');
  if (digest(json(semanticProjection(compiled.canonical))) !== plan.preservation?.semanticSha256)
    throw new Error('MIGRATION: planned semantic content changed after preservation check');
  try { lstatSync(root); throw new Error('MIGRATION: destination already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { targets } = preflightPaths(root, plan.files.map(f => f.file), { entryPaths: plan.files.map(f => f.file) });
  mkdirSync(dirname(root), { recursive: true });
  plainPath(root);
  if (plan.sourceRoot && json(plan.sourceEvidence) !== json(evidence(plan.sourceRoot))) throw new Error('MIGRATION: source changed before write');
  mkdirSync(root);
  for (const { file, content } of plan.files) {
    mkdirSync(dirname(targets.get(file)), { recursive: true });
    writeFileSync(targets.get(file), content, { flag: 'wx' });
  }
  return { schemaVersion: plan.schemaVersion, out: root, preservation: plan.preservation, mappings: plan.mappings };
}
export async function migrateAuthorCli(args) {
  const flags = new Map(); let planOnly = false, ignoreOSMetadata = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--plan' && !planOnly) { planOnly = true; continue; }
    if (flag === '--ignore-os-metadata' && !ignoreOSMetadata) { ignoreOSMetadata = true; continue; }
    if (!['--tree', '--out', '--format', '--system', '--context', '--name', '--responsibility'].includes(flag) || flags.has(flag) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('MIGRATION: unknown/duplicate/incomplete flag');
    flags.set(flag, args[++i]);
  }
  if (flags.size !== 7) throw new Error('MIGRATION: explicit tree/out/format/system/context/name/responsibility required');
  const input = { treeDir: resolve(flags.get('--tree')), format: flags.get('--format'), system: flags.get('--system'), context: flags.get('--context'), name: flags.get('--name'), responsibility: flags.get('--responsibility') };
  let compatibility;
  if (ignoreOSMetadata && input.format !== 'metarch.truth.v1') throw new Error('MIGRATION: OS metadata exception is BC-compatibility-only');
  if (input.format === 'metarch.truth.v1') {
    const { loadMetarchSnapshot } = await import('./compat/metarch.mjs');
    const legacy = loadMetarchSnapshot(input.treeDir, { ignoreOSMetadata });
    if (legacy.report.authorConflicts.length) throw new Error('MIGRATION_AUTHOR_CONFLICTS: ' + JSON.stringify(legacy.report.authorConflicts));
    input.legacySnapshot = legacy.snapshot; input.legacyMetadata = legacy.legacy; compatibility = legacy.report;
  }
  const plan = planAuthorMigration(input);
  return planOnly ? { ...plan, applied: false, ...(compatibility ? { compatibility } : {}) }
    : { ...writeAuthorMigration(plan, flags.get('--out')), applied: true, ...(compatibility ? { compatibility } : {}) };
}
