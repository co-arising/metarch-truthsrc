import { lstatSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve, relative, isAbsolute, sep, parse } from 'node:path';
import { authorFiles } from './author-tree.mjs';
import { loadTreeSnapshot } from './compile.mjs';
import { compileSnapshot } from './compile-snapshot.mjs';
import { parseDoc, INBOX_PRODUCTS } from './shared.mjs';
import { parseAuthorDoc } from './author-parse.mjs';
import { AUTHOR_VERSION, CONTEXT_VERSION, emitAuthorDoc, checkAuthorDeclarations, checkResidence, compileAuthorEntries } from './author-surface.mjs';
import { loadMetarchSnapshot, metarchSnapshotCapture, metarchSnapshotSource, verifyMetarchCapture, projectMetarchProducts } from './compat/metarch.mjs';
import { METARCH_STAGE_POLICY, checkMetarchStageImport } from './compat/metarch-stage-policy.mjs';
import { copyImmutableData } from './immutable-data.mjs';
import { preflightPaths } from '../src/core/apply-preflight.mjs';

const json = value => JSON.stringify(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const within = (root, path) => { const p = relative(root, path); return p === '' || !isAbsolute(p) && p !== '..' && !p.startsWith('..' + sep); };
const boundPlans = new WeakMap();
const boundAssessments = new WeakMap();
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
function declarations(previous, { system, context, name, responsibility }, legacy) {
  const systemDoc = { kind: 'system', schemaVersion: AUTHOR_VERSION, id: system, name, workshop: previous.workshop,
    sessionOrder: previous.sessions.map(s => s.session), contexts: [context],
    ...(previous.workshopKey || legacy ? { compatibility: { ...(previous.workshopKey ? { workshopKey: previous.workshopKey } : {}), ...(legacy ? { metarch: legacy } : {}) } } : {}) };
  const contextDoc = { kind: 'context', schemaVersion: CONTEXT_VERSION, id: context, name: context, responsibility };
  return { systemDoc, contextDoc };
}
function migrationTarget(atom, context) {
  const normalized = destination(atom);
  return normalized.startsWith('inbox/') ? normalized : `contexts/${context}/${normalized}`;
}
export function planAuthorMigration({ treeDir, system, context, name, responsibility, format = 'truthsrc/v1', legacySnapshot, legacyMetadata, stagePolicy }) {
  if (!name || !responsibility) throw new Error('MIGRATION: explicit system name and context responsibility required');
  if (!['truthsrc/v1', 'metarch.truth.v1'].includes(format)) throw new Error('MIGRATION: unsupported explicit format');
  const sourceRoot = treeDir === undefined ? null : plainPath(treeDir);
  const sourceEvidence = sourceRoot ? evidence(sourceRoot) : null;
  let snapshot, originalFiles, legacy, captured, stageFiles = [];
  if (stagePolicy !== undefined && format !== 'metarch.truth.v1') throw new Error('MIGRATION: stage policy is BC compatibility-only');
  if (format === 'metarch.truth.v1') {
    if (!legacySnapshot) throw new Error('MIGRATION: BC adapter snapshot required');
    if (sourceRoot) captured = metarchSnapshotCapture(legacySnapshot, legacyMetadata, sourceRoot);
    if (stagePolicy !== undefined) {
      if (!sourceRoot) throw new Error('MIGRATION: legacy stage policy requires a live source capture');
      stageFiles = checkMetarchStageImport(metarchSnapshotSource(legacySnapshot, legacyMetadata, sourceRoot), stagePolicy);
    }
    snapshot = legacySnapshot; legacy = stagePolicy === undefined ? legacyMetadata : { ...legacyMetadata, noteStageSemantics: stagePolicy };
    originalFiles = new Map(snapshot.atoms.map(a => [a.file, emitAuthorDoc(stageFiles.includes(a.file) ? { ...a.doc, legacyStageAnnotation: stagePolicy } : a.doc)]));
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
  const { systemDoc, contextDoc } = declarations(previous, { system, context, name, responsibility }, legacy);
  checkAuthorDeclarations(systemDoc, contextDoc);
  const files = [{ file: 'system.yaml', content: emitAuthorDoc(systemDoc) },
    { file: `contexts/${context}/context.yaml`, content: emitAuthorDoc(contextDoc) }], mappings = [];
  for (const atom of snapshot.atoms) {
    if (atom.file === 'workshop.yaml') continue;
    if (atom.doc.kind === 'aggregate' && atom.doc.context !== context)
      throw new Error('MIGRATION: aggregate context must already be explicit and matching: ' + atom.file);
    const file = migrationTarget(atom, context);
    files.push({ file, content: originalFiles.get(atom.file) });
    mappings.push({ from: atom.file, to: file, relation: 'representation-only' });
  }
  for (const file of ['README.md', 'inbox/README.md']) if (originalFiles.has(file)) files.push({ file, content: originalFiles.get(file) });
  files.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  const migrated = compileAuthorEntries(files);
  if (json(semanticProjection(previous)) !== json(semanticProjection(migrated.canonical))) throw new Error('MIGRATION: semantic projection changed');
  if (sourceRoot && json(sourceEvidence) !== json(evidence(sourceRoot))) throw new Error('MIGRATION: source changed during plan');
  if (captured) metarchSnapshotCapture(snapshot, legacyMetadata, sourceRoot);
  const plan = { schemaVersion: 'truthsrc.author-migration/v1', format, system, context, files, mappings,
    ...(stagePolicy === undefined ? {} : { stagePolicy }),
    ...(sourceRoot ? { sourceRoot, sourceEvidence } : {}),
    ...(captured ? { sourceCapture: captured } : {}),
    preservation: { semanticEqual: true, semanticSha256: digest(json(semanticProjection(previous))), atoms: snapshot.atoms.length, frozenSeq: true, legacyNoteIds: true, storedDecisionsAndFolds: true } };
  if (captured) boundPlans.set(plan, { snapshot, legacy: legacyMetadata, planSha256: digest(json(plan)) });
  return plan;
}
function verifyBoundPlan(plan) {
  const bound = boundPlans.get(plan);
  if (!bound) throw new Error('MIGRATION: source-bound BC plans must be replanned from a live capture');
  if (digest(json(plan)) !== bound.planSha256) throw new Error('MIGRATION: source-bound BC plan changed after admission');
  return metarchSnapshotCapture(bound.snapshot, bound.legacy, plan.sourceRoot);
}
export function writeAuthorMigration(plan, outDir) {
  if (plan?.schemaVersion !== 'truthsrc.author-migration/v1' || plan?.status === 'blocked') throw new Error('MIGRATION: an admitted migration plan is required, not an assessment');
  const bound = boundPlans.has(plan) || Object.hasOwn(plan, 'sourceCapture') || plan.format === 'metarch.truth.v1' && plan.sourceRoot;
  if (bound) verifyBoundPlan(plan);
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
  if (bound) verifyBoundPlan(plan);
  mkdirSync(dirname(root), { recursive: true });
  plainPath(root);
  if (plan.sourceRoot && json(plan.sourceEvidence) !== json(evidence(plan.sourceRoot))) throw new Error('MIGRATION: source changed before write');
  if (bound) verifyBoundPlan(plan);
  mkdirSync(root);
  for (const { file, content } of plan.files) {
    mkdirSync(dirname(targets.get(file)), { recursive: true });
    writeFileSync(targets.get(file), content, { flag: 'wx' });
  }
  return { schemaVersion: plan.schemaVersion, out: root, preservation: plan.preservation, mappings: plan.mappings };
}
export function assessMetarchMigration({ treeDir, system, context, name, responsibility, ignoreOSMetadata = false, stagePolicy }, loaded = loadMetarchSnapshot(treeDir, { ignoreOSMetadata })) {
  const capture = verifyMetarchCapture(loaded);
  if (plainPath(treeDir) !== capture.root || ignoreOSMetadata !== capture.ignoreOSMetadata) throw new Error('MIGRATION: assessment input differs from its capture');
  const { canonical } = compileSnapshot(loaded.snapshot);
  const policyBlockers = [];
  let selectedStageFiles = [];
  if (stagePolicy !== undefined) {
    try { selectedStageFiles = checkMetarchStageImport(loaded, stagePolicy); }
    catch (error) { policyBlockers.push({ code: 'AUTHOR_LEGACY_POLICY', message: error.message, disposition: 'unresolved' }); }
  }
  const targetLegacy = selectedStageFiles.length ? { ...loaded.legacy, noteStageSemantics: stagePolicy } : loaded.legacy;
  const { systemDoc, contextDoc } = declarations(canonical, { system, context, name, responsibility }, targetLegacy);
  const sourceByFile = new Map(loaded.report.sources.map(row => [row.file, row.source]));
  const atomsBySource = new Map(loaded.snapshot.atoms.map(atom => [sourceByFile.get(atom.file), atom]));
  const mappingBlockers = [];
  const mappings = capture.files.map(source => {
    if (source.file === 'metarch.yaml') return { from: source.file, to: 'system.yaml', pointer: '/compatibility/metarch/root', relation: 'root-envelope-carry' };
    if (source.file.startsWith('governance/') && ['artifact-meta.json', 'concerns.json'].includes(basename(source.file))) return {
      from: source.file, to: 'system.yaml', pointer: '/compatibility/metarch/governance/' + (source.file.endsWith('artifact-meta.json') ? 'artifactMeta' : 'concerns'), relation: 'governance-envelope-carry',
    };
    const ignored = loaded.report.ignored.find(row => row.file === source.file);
    if (ignored) return { from: source.file, to: null, relation: ignored.reason };
    const atom = atomsBySource.get(source.file);
    if (!atom) throw new Error('MIGRATION: source has no migration mapping: ' + source.file);
    try { return { from: source.file, snapshotFile: atom.file, to: migrationTarget(atom, context), relation: 'representation-only' }; }
    catch (error) {
      mappingBlockers.push({ code: 'AUTHOR_DESTINATION_UNSUPPORTED', file: source.file, snapshotFile: atom.file,
        fileSha256: source.sha256, fileBytes: source.bytes, message: error.message, disposition: 'unresolved' });
      return { from: source.file, snapshotFile: atom.file, to: null, relation: 'unmapped' };
    }
  });
  const conflicts = [...policyBlockers, ...mappingBlockers, ...loaded.report.authorConflicts.filter(row => !selectedStageFiles.includes(row.snapshotFile)), ...loaded.report.missingContexts.map(row => {
    const file = sourceByFile.get(row.file), source = capture.files.find(entry => entry.file === file);
    return { code: 'AUTHOR_CONTEXT_REQUIRED', file, snapshotFile: row.file, aggregate: row.aggregate,
      fileSha256: source.sha256, fileBytes: source.bytes, pointer: '/context', proposedContext: context,
      disposition: row.reason };
  })];
  try { checkAuthorDeclarations(systemDoc, contextDoc); }
  catch (error) { conflicts.push({ code: 'AUTHOR_DECLARATION_CONTRACT', message: error.message, disposition: 'unresolved' }); }
  const products = projectMetarchProducts(canonical, loaded.legacy);
  const productEvidence = Object.entries(products).map(([product, value]) => {
    const bytes = JSON.stringify(value, null, 2) + (product === 'METARCH' ? '' : '\n');
    return { product, bytes: Buffer.byteLength(bytes), sha256: digest(bytes) };
  });
  let plan;
  if (!conflicts.length) {
    try {
      plan = planAuthorMigration({ treeDir, system, context, name, responsibility, format: 'metarch.truth.v1', legacySnapshot: loaded.snapshot, legacyMetadata: loaded.legacy, stagePolicy });
      const migrated = projectMetarchProducts(compileAuthorEntries(plan.files).canonical, targetLegacy);
      if (json(migrated) !== json(products)) throw new Error('MIGRATION: migrated five-product projection differs');
    } catch (error) {
      conflicts.push({ code: 'AUTHOR_MIGRATION_CONTRACT', message: error.message, disposition: 'unresolved' });
    }
  }
  verifyMetarchCapture(loaded);
  const assessment = copyImmutableData({ schemaVersion: 'truthsrc.author-migration-assessment/v1',
    format: 'metarch.truth.v1', status: conflicts.length ? 'blocked' : 'ready', applied: false, writable: false,
    system, context, proposedDeclarations: { system: systemDoc, context: contextDoc }, source: capture, mappings,
    blockers: conflicts, compatibility: loaded.report,
    ...(stagePolicy === undefined ? {} : { legacyPolicy: { requested: stagePolicy, admitted: selectedStageFiles.length > 0,
      preservedAnnotations: loaded.report.authorConflicts.filter(row => selectedStageFiles.includes(row.snapshotFile)), semantics: 'legacy-merge-carrier; not a second domain stage' } }),
    checks: { sourceBound: true, sourceUnchanged: true, completeFileMapping: mappingBlockers.length === 0,
      compatibilityProjection: 'passed', newAuthorAdmission: conflicts.length ? 'blocked' : 'passed',
      newAuthorSemanticEquality: conflicts.length ? 'not-run' : 'passed',
      newAuthorFiveProductEquality: conflicts.length ? 'not-run' : 'passed',
      independentBCOracle: 'not-run', scalaConsumer: 'not-run', operationalCutover: 'not-run' },
    products: productEvidence,
  });
  boundAssessments.set(assessment, loaded);
  return assessment;
}
export function verifyAuthorMigrationAssessment(assessment) {
  const loaded = boundAssessments.get(assessment);
  if (!loaded) throw new Error('MIGRATION: a live assessment is required; stored reports are historical evidence only');
  verifyMetarchCapture(loaded);
  return assessment;
}
export async function migrateAuthorCli(args) {
  const flags = new Map(); let planOnly = false, ignoreOSMetadata = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--plan' && !planOnly) { planOnly = true; continue; }
    if (flag === '--ignore-os-metadata' && !ignoreOSMetadata) { ignoreOSMetadata = true; continue; }
    if (!['--tree', '--out', '--format', '--system', '--context', '--name', '--responsibility', '--legacy-stage-policy'].includes(flag) || flags.has(flag) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('MIGRATION: unknown/duplicate/incomplete flag');
    flags.set(flag, args[++i]);
  }
  if (['--tree', '--out', '--format', '--system', '--context', '--name', '--responsibility'].some(flag => !flags.has(flag))) throw new Error('MIGRATION: explicit tree/out/format/system/context/name/responsibility required');
  const input = { treeDir: plainPath(flags.get('--tree')), format: flags.get('--format'), system: flags.get('--system'), context: flags.get('--context'), name: flags.get('--name'), responsibility: flags.get('--responsibility'),
    ...(flags.has('--legacy-stage-policy') ? { stagePolicy: flags.get('--legacy-stage-policy') } : {}) };
  if (input.stagePolicy !== undefined && input.format !== 'metarch.truth.v1') throw new Error('MIGRATION: stage policy is BC compatibility-only');
  let compatibility;
  if (ignoreOSMetadata && input.format !== 'metarch.truth.v1') throw new Error('MIGRATION: OS metadata exception is BC-compatibility-only');
  if (input.format === 'metarch.truth.v1') {
    const legacy = loadMetarchSnapshot(input.treeDir, { ignoreOSMetadata });
    const assessment = assessMetarchMigration({ ...input, ignoreOSMetadata }, legacy);
    if (assessment.status === 'blocked') {
      if (planOnly) return assessment;
      throw new Error('MIGRATION_AUTHOR_CONFLICTS: ' + JSON.stringify(assessment.blockers));
    }
    input.legacySnapshot = legacy.snapshot; input.legacyMetadata = legacy.legacy; compatibility = legacy.report;
    const plan = planAuthorMigration(input);
    return planOnly ? { ...plan, applied: false, compatibility, assessment }
      : { ...writeAuthorMigration(plan, flags.get('--out')), applied: true, compatibility };
  }
  const plan = planAuthorMigration(input);
  return planOnly ? { ...plan, applied: false, ...(compatibility ? { compatibility } : {}) }
    : { ...writeAuthorMigration(plan, flags.get('--out')), applied: true, ...(compatibility ? { compatibility } : {}) };
}
