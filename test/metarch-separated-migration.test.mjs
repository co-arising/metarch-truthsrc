import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadMetarchSnapshot, projectMetarchProducts } from '../lib/compat/metarch.mjs';
import { METARCH_STAGE_POLICY, METARCH_STAGE_RECORDS } from '../lib/compat/metarch-stage-policy.mjs';
import { assessMetarchMigration, planAuthorMigration, writeAuthorMigration } from '../lib/author-migrate.mjs';
import { loadAuthorTree, authorFiles } from '../lib/author-tree.mjs';
import { emitAuthorDoc } from '../lib/author-surface.mjs';
import { parseAuthorDoc } from '../lib/author-parse.mjs';
import { compileSnapshot } from '../lib/compile-snapshot.mjs';
import { validateSnapshot, validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { readMetarchBundle, writeMetarchBundle } from '../lib/compat/metarch-bundle.mjs';

const bcRoot = process.env.TRUTHSRC_BC_ROOT;
test('opt-in exact BC migration keeps content and merge carriers separate from source locations', { skip: !bcRoot }, async t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'metarch-separated-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(bcRoot, 'truth/metarch'), loaded = loadMetarchSnapshot(source, { ignoreOSMetadata: true });
  const input = { treeDir: source, format: 'metarch.truth.v1', system: 'metarch', context: 'main', name: 'Metarch', responsibility: 'Own the self-hosting knowledge model.',
    legacySnapshot: loaded.snapshot, legacyMetadata: loaded.legacy, stagePolicy: METARCH_STAGE_POLICY };
  const assessment = assessMetarchMigration({ ...input, ignoreOSMetadata: true }, loaded);
  assert.equal(assessment.status, 'ready');
  assert.equal(assessment.legacyPolicy.preservedAnnotations.length, 7);
  assert.equal(assessment.checks.newAuthorFiveProductEquality, 'passed');
  assert.equal(assessment.checks.operationalCutover, 'not-run');
  const plan = planAuthorMigration(input), tree = join(root, 'metarch');
  writeAuthorMigration(plan, tree);
  const author = loadAuthorTree(tree);
  assert.equal(author.system.compatibility.metarch.noteStageSemantics, METARCH_STAGE_POLICY);
  assert.equal(Object.hasOwn(author.system, 'provenance'), false, 'missing actual session IDs and URIs are not fabricated');
  assert.equal(author.authorAtoms.filter(atom => Object.hasOwn(atom.doc, 'legacyStageAnnotation')).length, 7);
  for (const record of METARCH_STAGE_RECORDS) {
    const original = loaded.snapshot.atoms.find(atom => loaded.report.sources.some(row => row.source === record.source && row.file === atom.file));
    const current = parseAuthorDoc(readFileSync(join(tree, record.file), 'utf8'));
    assert.deepEqual(current.payload, original.doc.payload);
    assert.deepEqual(current.origin, original.doc.origin);
    assert.equal(current.legacyStageAnnotation, METARCH_STAGE_POLICY);
    assert.equal(Object.hasOwn(current, 'sourceRefs'), false);
  }
  assert.equal(roundtrip(tree).ok, true);
  const previousValidation = validateSnapshot(loaded.snapshot), currentValidation = validateTree(tree);
  const remap = message => plan.mappings.reduce((text, row) => row.from.startsWith('inbox/') ? text.replaceAll(row.from, row.to) : text, message);
  assert.deepEqual([...currentValidation.hard].sort(), previousValidation.hard.map(remap).sort());
  assert.deepEqual([...currentValidation.notices].sort(), previousValidation.notices.map(remap).sort());
  const { compileTree } = await import(pathToFileURL(join(bcRoot, 'tools/truthsrc/compile.mjs')).href);
  const expected = compileTree(source), actual = projectMetarchProducts(author.canonical, author.system.compatibility.metarch);
  for (const name of Object.keys(expected)) {
    assert.deepEqual(actual[name], expected[name]);
    assert.equal(JSON.stringify(actual[name]), JSON.stringify(expected[name]));
  }
  const bundle = writeMetarchBundle({ treeDir: tree, outDir: join(root, 'products') });
  const { loadProductBundle } = await import(pathToFileURL(join(bcRoot, 'tools/truthsrc/load.mjs')).href);
  assert.deepEqual(await loadProductBundle(bundle.manifest, new URL('../lib/compat/metarch-bundle.mjs', import.meta.url).href), readMetarchBundle(bundle.manifest).products);
  const first = METARCH_STAGE_RECORDS[0], path = join(tree, first.file), original = readFileSync(path, 'utf8');
  const doc = parseAuthorDoc(original); delete doc.legacyStageAnnotation; writeFileSync(path, emitAuthorDoc(doc));
  assert.throws(() => loadAuthorTree(tree), /unannotated|missing required/);
  writeFileSync(path, original);
  const second = parseAuthorDoc(original); second.payload.stage = 'refining'; writeFileSync(path, emitAuthorDoc(second));
  assert.throws(() => loadAuthorTree(tree), /payload.stage/);
  writeFileSync(path, original);
  const fresh = loadMetarchSnapshot(source, { ignoreOSMetadata: true });
  assert.deepEqual(fresh.capture, loaded.capture);
  assert.deepEqual(fresh.snapshot, loaded.snapshot);
  const copy = join(root, 'legacy-copy'); cpSync(source, copy, { recursive: true });
  writeFileSync(join(copy, first.source), readFileSync(join(copy, first.source), 'utf8') + '# changed exact source\n');
  const changed = loadMetarchSnapshot(copy, { ignoreOSMetadata: true });
  const rejected = assessMetarchMigration({ ...input, treeDir: copy, ignoreOSMetadata: true }, changed);
  assert.equal(rejected.status, 'blocked');
  assert.ok(rejected.blockers.some(row => row.code === 'AUTHOR_LEGACY_POLICY'));
  assert.equal(existsSync(join(root, 'unrequested')), false);
  t.diagnostic(JSON.stringify({ atoms: author.snapshot.atoms.length, fiveProducts: Object.keys(actual).length,
    legacyAnnotations: 7, sourceUrisFabricated: 0, hardDiagnosticsPreserved: currentValidation.hard.length, noticesPreserved: currentValidation.notices.length }));
});
