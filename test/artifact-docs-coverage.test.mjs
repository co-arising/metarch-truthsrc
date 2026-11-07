import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileRecord, readJson, DOC_ROOT } from '../lib/artifact-docs/io.mjs';
import { discoverSources, inspectRepository, sourceFacts, generatedKinds, verifySourceReferences } from '../lib/artifact-docs/sources.mjs';
import { classifySource } from '../lib/artifact-docs/classify.mjs';
import { checkCrossRepository, loadCatalogue } from '../lib/artifact-docs/catalog.mjs';
import { reconcileInstance } from '../lib/artifact-docs/instances.mjs';
import { emittedKinds, validateOutputVocabulary } from '../lib/artifact-docs/vocabulary.mjs';
const data = loadCatalogue();
const ids = new Set(data.catalog.categories.map(c => c.id));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'artifact-census-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'sources'));
  const file = 'sources/Entity.scala'; writeFileSync(join(root, file), 'object Entity {}\n');
  const scopes = [{ id: 'source', paths: ['sources'], extensions: ['.scala'], packaged: false, files: false }];
  const spec = { scopes, files: [{ ...fileRecord(root, file), scope: 'source', categories: ['domain-entity'], disposition: 'artifact-source', reason: 'synthetic fixture', symbols: ['Entity'], outputSites: [] }] };
  return { root, file, spec };
}

test('new source, removed source and source byte changes cannot inherit covered status', t => {
  const { root, file, spec } = fixture(t);
  assert.equal(inspectRepository('fixture', root, spec, ids).diagnostics.length, 0);
  writeFileSync(join(root, 'sources/NewPort.scala'), 'trait NewPort {}\n');
  assert.ok(inspectRepository('fixture', root, spec, ids).diagnostics.some(d => d.code === 'UNDOCUMENTED_SOURCE'));
  rmSync(join(root, 'sources/NewPort.scala'));
  writeFileSync(join(root, file), 'object Entity { val changed = true }\n');
  assert.ok(inspectRepository('fixture', root, spec, ids).diagnostics.some(d => d.code === 'SOURCE_DRIFT'));
  rmSync(join(root, file));
  assert.ok(inspectRepository('fixture', root, spec, ids).diagnostics.some(d => d.code === 'MISSING_SOURCE'));
});

test('inventory rejects a symlink rather than following an outside source', t => {
  const { root, spec } = fixture(t);
  symlinkSync('/tmp', join(root, 'sources/link'));
  assert.throws(() => discoverSources(root, spec.scopes), /symlink/);
});

test('nested retired manifests are included and every declared kind is documented', () => {
  const kinds = new Set(data.catalog.categories.flatMap(c => c.aliases.jsKinds));
  const manifests = data.lock.repositories.js.files.filter(f => f.manifest);
  assert.ok(manifests.some(f => f.path.startsWith('generators/_deprecated/')));
  for (const file of manifests) for (const kind of file.manifest.artifactKinds) assert.ok(kinds.has(kind), file.path + ':' + kind);
});

test('raw template and static source inputs are included, not filtered by script extension', () => {
  const paths = new Set(data.lock.repositories.js.files.map(f => f.path));
  for (const path of ['generators/saga-dsl/templates/composition-recovery.scala.tpl',
    'generators/scaffold-static/build.sbt', 'generators/scaffold-static/conf/serialization.conf',
    'generators/scaffold-static/app/net/imadz/metarch/infrastructure/api/CommandDsl.scala']) assert.ok(paths.has(path), path);
  const scope = data.lock.repositories.js.scopes.find(s => s.id === 'generators');
  assert.ok(scope.extensions.includes('*'));
});

test('ordinary emitters and BC output kinds remain checked without artifactKinds manifest fields', () => {
  const js = emittedKinds('ordinary.mjs', "return [entry(pathFor(pkg, 'A.scala'), content, 'new-unknown-kind', sources, footprint)];");
  assert.deepEqual(js.kinds, ['new-unknown-kind']);
  const bc = emittedKinds('Emitter.scala', 'writeArtifact(model, content, out, Some(ArtifactAttribution("unknown-bc", name, "source", Nil)))');
  assert.deepEqual(bc.kinds, ['unknown-bc']);
  const rows = { js: { files: [{ path: 'ordinary.mjs', categories: ['artifact-generator'], emittedKinds: js.kinds }] },
    bc: { files: [{ path: 'Emitter.scala', categories: ['artifact-generator'], emittedKinds: bc.kinds }] } };
  assert.equal(validateOutputVocabulary(data.catalog, rows).filter(d => d.code === 'UNDOCUMENTED_OUTPUT_KIND').length, 2);
  const aggregate = classifySource('js', 'generators/aggregate-dsl/render.mjs', '', data.catalog.categories);
  for (const id of ['application-protocol', 'aggregate-behavior', 'aggregate-factory', 'event-handler']) assert.ok(aggregate.categories.includes(id), id);
});

test('port and module roles are not swallowed by a generic platform bucket', () => {
  for (const [repo, path, expected] of [
    ['dipoc', 'modules/kernel/src/main/scala/net/imadz/metarch/domain/service/ConceptDeltaAdjudicator.scala', 'computation-port'],
    ['dipoc', 'modules/kernel/src/main/scala/net/imadz/metarch/application/FlowPorts.scala', 'application-flow-port'],
    ['dipoc', 'modules/kernel/src/main/scala/net/imadz/metarch/infrastructure/auth/IdentityStoreApi.scala', 'identity-store-port'],
    ['dipoc', 'app/net/imadz/modules/RepositoryBindingModule.scala', 'port-binding-module'],
    ['bc', 'knowledge_base/design_docs/field_template/tools/gen_api_controllers/tpl_support.mjs', 'command-endpoint-dsl']
  ]) assert.ok(classifySource(repo, path, '', data.catalog.categories).categories.includes(expected), path);
});

test('catalogue source references resolve to classified locked symbols', () => {
  assert.deepEqual(verifySourceReferences(data.catalog, data.lock), []);
  const c = structuredClone(data.catalog); c.categories[0].variants[0].sourceRefs[0].symbol = 'nonexistentSymbol';
  assert.ok(verifySourceReferences(c, data.lock).some(d => d.code === 'REFERENCE_SYMBOL'));
});

test('missing cross-repository inputs never report complete latest coverage', () => {
  const result = checkCrossRepository({ roots: {}, requireAll: true });
  assert.equal(result.passed, false); assert.equal(result.complete, false);
  assert.equal(result.missing.length, Object.keys(data.lock.repositories).length);
});

test('instance mapping only permits explicit package-preserving relocations', t => {
  const root = mkdtempSync(join(tmpdir(), 'artifact-ledger-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = 'modules/kernel/src/main/scala/example/Port.scala';
  mkdirSync(join(root, 'modules/kernel/src/main/scala/example'), { recursive: true });
  writeFileSync(join(root, file), 'package example\ntrait Port\n');
  writeFileSync(join(root, '.codegen-ledger.json'), JSON.stringify({ artifacts: [{ path: 'app/modules/kernel/src/main/scala/example/Port.scala', kind: 'port' }] }));
  const result = reconcileInstance(root, '.codegen-ledger.json', [file]);
  assert.equal(result.resolved.length, 1); assert.equal(result.resolved[0].method, 'remove-stale-app-prefix');
  writeFileSync(join(root, '.codegen-ledger.json'), JSON.stringify({ artifacts: [{ path: 'app/other/Port.scala', kind: 'port' }] }));
  const wrong = reconcileInstance(root, '.codegen-ledger.json', [file]);
  assert.equal(wrong.resolved.length, 0); assert.equal(wrong.unmatched.length, 1);
  assert.deepEqual(wrong.unmatched[0].sameFilenameCandidates, [file]);
});

test('all observed multi-module ledger rows and source-only files have explicit disposition', () => {
  const instance = data.lock.instances.dipoc;
  assert.equal(instance.rows, instance.resolved.length);
  assert.deepEqual(instance.ambiguous, []); assert.deepEqual(instance.unmatched, []);
  const files = new Map(data.lock.repositories.dipoc.files.map(f => [f.path, f]));
  for (const path of instance.sourceOnly) assert.ok(files.get(path)?.categories.length, path);
});
