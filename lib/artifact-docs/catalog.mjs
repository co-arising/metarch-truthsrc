import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { DOC_ROOT, TOOL_ROOT, compare, exactKeys, jsonBytes, normalizedPath, readJson, sha256, unique, walk, within } from './io.mjs';
import { generatedKinds, inspectRepository, verifySourceReferences, productionToolFingerprint } from './sources.mjs';
import { reconcileInstance } from './instances.mjs';
import { validateOutputVocabulary } from './vocabulary.mjs';
import { CAPABILITY_SCHEMA, validateCapabilities, verifyCapabilitySources, inspectCapabilityObservations,
  capabilitySummary, renderCapabilityMatrix } from './capabilities.mjs';

export const SECTIONS = ['职责', '输入与人工信息', '生产与所有权', '结构与命名', '依赖与装配', '回锚与更新', '验证', '版本与实例'];
const availability = new Set(['implemented', 'partial', 'reference-only', 'not-generated', 'retired']);
const ownership = new Set(['generated', 'handwritten', 'library', 'derived', 'mixed']);
export function loadCatalogue(directory = DOC_ROOT) {
  return { catalog: readJson(join(directory, 'catalog.json')), lock: readJson(join(directory, 'sources.lock.json')),
    coverage: readJson(join(directory, 'coverage.json')) };
}
export function validateCatalogue(catalog, readDocument) {
  const calibrated = catalog.schemaVersion === CAPABILITY_SCHEMA;
  assert.ok(calibrated || catalog.schemaVersion === 'truthsrc.artifact-documentation/v1', 'unsupported catalogue schema');
  exactKeys(catalog, ['schemaVersion', 'version', 'date', 'scope', 'categories', 'compatibility', 'dispatch',
    ...(calibrated ? ['producers', 'observations'] : [])], 'catalogue');
  assert.match(catalog.version, /^\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(catalog.categories) && catalog.categories.length);
  unique(catalog.categories.map(category => category.id), 'category');
  unique(catalog.categories.map(category => category.document), 'document');
  const ids = new Set(catalog.categories.map(category => category.id)), namedAliases = new Set();
  for (const category of catalog.categories) {
    exactKeys(category, ['id', 'title', 'family', 'document', 'aliases', 'variants', 'dependsOn'], 'category');
    assert.match(category.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(category.title && category.family && category.document.endsWith('.md'));
    normalizedPath(category.document);
    assert.ok(['scala-cqrs/', 'typescript/', 'tooling/'].some(prefix => category.document.startsWith(prefix)));
    exactKeys(category.aliases, ['docs', 'bcModels', 'bcKinds', 'jsKinds'], 'aliases');
    for (const name of ['docs', 'bcModels', 'bcKinds', 'jsKinds']) {
      assert.ok(Array.isArray(category.aliases[name])); unique(category.aliases[name], name + ' alias');
      for (const alias of category.aliases[name]) {
        assert.ok(typeof alias === 'string' && alias);
        if (name === 'docs') {
          assert.ok(!namedAliases.has(alias), 'ambiguous legacy document alias: ' + alias);
          namedAliases.add(alias);
        }
      }
    }
    assert.ok(Array.isArray(category.variants) && category.variants.length);
    unique(category.variants.map(variant => variant.profile), 'category profile');
    for (const variant of category.variants) {
      exactKeys(variant, ['profile', 'availability', 'ownership', 'modules', 'outputs', 'sourceRefs', ...(calibrated ? ['capability'] : [])], 'variant');
      assert.ok(variant.profile && availability.has(variant.availability) && ownership.has(variant.ownership));
      assert.ok(Array.isArray(variant.modules) && variant.modules.length && Array.isArray(variant.outputs) && variant.outputs.length);
      if (variant.ownership === 'library') assert.deepEqual(variant.modules, ['runtime-library'], 'library implementation must not be labelled as application output');
      if (['bc-multi', 'di-poc'].includes(variant.profile)) {
        const requiredModule = { 'computation-port': 'kernel', 'application-flow-port': 'kernel', 'signature-value-closure': 'kernel',
          'port-binding-module': 'root', 'port-bridge': 'kernel', 'protobuf-schema': 'glue' }[category.id];
        if (requiredModule) assert.deepEqual(variant.modules, [requiredModule], 'module boundary differs for ' + category.id);
      }
      assert.ok(Array.isArray(variant.sourceRefs) && variant.sourceRefs.length);
      for (const ref of variant.sourceRefs) {
        exactKeys(ref, ['repo', 'file', 'symbol'], 'source reference');
        assert.ok(ref.repo && ref.symbol); normalizedPath(ref.file);
      }
    }
    assert.ok(Array.isArray(category.dependsOn)); unique(category.dependsOn, 'dependency');
    for (const id of category.dependsOn) assert.ok(id !== category.id && ids.has(id), 'unknown/self category dependency: ' + id);
    const doc = readDocument(category.document);
    assert.ok(doc.startsWith('# ') && Buffer.byteLength(doc) >= 650, 'substantive category document required: ' + category.id);
    for (const section of SECTIONS) assert.ok(doc.includes('\n## ' + section + '\n'), 'missing document section: ' + category.id + ':' + section);
    assert.ok(!/\bTODO\b|待补充|待撰写|PLACEHOLDER/.test(doc), 'unfinished category page: ' + category.id);
  }
  if (calibrated) validateCapabilities(catalog);
  for (const [consumer, mapping] of Object.entries(catalog.dispatch)) for (const [alias, target] of Object.entries(mapping)) {
    assert.ok(alias && namedAliases.has(target), 'unknown dispatch document: ' + consumer + ':' + alias);
  }
  return ids;
}
export function coverageSummary(catalog, lock) {
  const categories = new Set(catalog.categories.map(category => category.id));
  const repositories = Object.fromEntries(Object.entries(lock.repositories).map(([repo, spec]) => [repo, {
    files: spec.files.length,
    outputSites: spec.files.reduce((sum, file) => sum + (file.outputSites?.length ?? 0), 0),
    unclassified: spec.files.filter(file => !file.categories.length || file.categories.some(id => !categories.has(id))).map(file => file.path),
    dispositions: Object.fromEntries([...new Set(spec.files.map(file => file.disposition))].sort(compare)
      .map(disposition => [disposition, spec.files.filter(file => file.disposition === disposition).length]))
  }]));
  return { schemaVersion: 'truthsrc.artifact-documentation-coverage/v1', catalogSha256: sha256(jsonBytes(catalog)),
    sourceLockSha256: sha256(jsonBytes(lock)), categories: catalog.categories.length,
    variants: catalog.categories.reduce((sum, category) => sum + category.variants.length, 0),
    documents: catalog.categories.map(category => category.document).sort(compare), repositories,
    instances: lock.instances, scope: 'declared source revisions and inspected output responsibilities; not arbitrary-input or runtime acceptance' };
}
export function checkLocal({ toolRoot = TOOL_ROOT, directory = DOC_ROOT, data = loadCatalogue(directory) } = {}) {
  const { catalog, lock, coverage } = data;
  const categories = validateCatalogue(catalog, file => readFileSync(within(directory, file), 'utf8'));
  assert.equal(lock.schemaVersion, 'truthsrc.artifact-documentation-sources/v1');
  const evidence = inspectCapabilityObservations(catalog, lock, directory);
  const diagnostics = [...verifySourceReferences(catalog, lock), ...validateOutputVocabulary(catalog, lock.repositories),
    ...verifyCapabilitySources(catalog, lock), ...evidence.diagnostics];
  if (catalog.schemaVersion === CAPABILITY_SCHEMA && productionToolFingerprint(toolRoot) !== lock.productionToolSha256)
    diagnostics.push({ code: 'CAPABILITY_TOOL_DRIFT' });
  for (const [repo, spec] of Object.entries(lock.repositories)) {
    unique(spec.files.map(file => file.path), repo + ' locked source');
    for (const file of spec.files) {
      if (!file.reason || !file.disposition || !Array.isArray(file.categories) || !file.categories.length || file.categories.some(id => !categories.has(id)))
        diagnostics.push({ code: 'LOCK_UNCLASSIFIED', repo, file: file.path });
    }
  }
  const documentFiles = new Set(walk(directory).filter(file => file.endsWith('.md')));
  for (const category of catalog.categories) {
    assert.ok(documentFiles.has(category.document));
    const expected = lock.documents[category.document];
    if (sha256(readFileSync(join(directory, category.document))) !== expected) diagnostics.push({ code: 'DOCUMENT_DRIFT', file: category.document });
  }
  for (const file of Object.keys(lock.documents)) if (!documentFiles.has(file)) diagnostics.push({ code: 'MISSING_DOCUMENT', file });
  for (const file of documentFiles) if (!Object.hasOwn(lock.documents, file)) diagnostics.push({ code: 'UNREGISTERED_DOCUMENT', file });
  const knownKinds = new Set(catalog.categories.flatMap(category => category.aliases.jsKinds));
  const manifests = generatedKinds(toolRoot);
  for (const { file, manifest } of manifests) for (const kind of manifest.artifactKinds ?? []) {
    if (!knownKinds.has(kind)) diagnostics.push({ code: 'UNDOCUMENTED_KIND', file, kind });
  }
  const js = lock.repositories.js;
  const localScopes = js.scopes.filter(scope => scope.packaged);
  const localIds = new Set(localScopes.map(scope => scope.id));
  const current = inspectRepository('js', toolRoot, { ...js, scopes: localScopes, files: js.files.filter(file => localIds.has(file.scope)) }, categories, catalog.categories);
  diagnostics.push(...current.diagnostics);
  if (catalog.schemaVersion === CAPABILITY_SCHEMA) {
    const matrix = 'CAPABILITY-MATRIX.md';
    if (!documentFiles.has(matrix) || readFileSync(join(directory, matrix), 'utf8') !== renderCapabilityMatrix(catalog, lock, evidence.verified))
      diagnostics.push({ code: 'CAPABILITY_MATRIX_DRIFT', file: matrix });
  }
  if (JSON.stringify(coverageSummary(catalog, lock)) !== JSON.stringify(coverage)) diagnostics.push({ code: 'COVERAGE_DRIFT' });
  return { passed: diagnostics.length === 0, mode: 'local', categories: catalog.categories.length,
    generators: manifests.length, filesChecked: current.checked, externalSourcesReverified: false,
    capabilities: capabilitySummary(catalog, lock, evidence.verified),
    unverifiedRepositories: Object.keys(lock.repositories).filter(repo => repo !== 'js'), diagnostics };
}
export function checkCrossRepository({ roots, directory = DOC_ROOT, requireAll = true }) {
  const data = loadCatalogue(directory), { catalog, lock } = data;
  const local = checkLocal({ directory, data });
  const categories = new Set(catalog.categories.map(category => category.id));
  const results = [], missing = [], diagnostics = [...local.diagnostics];
  for (const [name, spec] of Object.entries(lock.repositories)) {
    if (!roots[name]) { missing.push(name); continue; }
    try {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
      Object.assign(env, { GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' });
      const revision = execFileSync('git', ['--no-optional-locks', '-c', 'protocol.allow=never', '-C', roots[name], 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10000, env }).trim();
      const ancestor = execFileSync('git', ['--no-optional-locks', '-c', 'protocol.allow=never', '-C', roots[name], 'merge-base', spec.revision, 'HEAD'], { encoding: 'utf8', timeout: 10000, env }).trim();
      if (ancestor !== spec.revision) diagnostics.push({ code: 'REVISION_LINEAGE', repo: name, baseline: spec.revision, actual: revision });
      const result = inspectRepository(name, roots[name], spec, categories, catalog.categories);
      result.baselineRevision = spec.revision; result.actualRevision = revision;
      results.push(result); diagnostics.push(...result.diagnostics);
      if (name === 'dipoc') {
        const paths = spec.files.filter(file => /\.(scala|proto|sql)$/.test(file.path)).map(file => file.path);
        const instance = reconcileInstance(roots[name], '.codegen-ledger.json', paths);
        if (JSON.stringify(instance) !== JSON.stringify(lock.instances.dipoc)) diagnostics.push({ code: 'INSTANCE_DRIFT', repo: name });
        if (instance.unmatched.length || instance.ambiguous.length) diagnostics.push({ code: 'INSTANCE_UNRESOLVED', repo: name });
      }
    } catch (error) { diagnostics.push({ code: 'SOURCE_UNAVAILABLE', repo: name, message: error.message }); }
  }
  for (const name of Object.keys(roots)) assert.ok(lock.repositories[name], 'unknown source repository: ' + name);
  if (requireAll) diagnostics.push(...missing.map(repo => ({ code: 'MISSING_REPOSITORY', repo })));
  return { passed: diagnostics.length === 0 && missing.length === 0, mode: 'cross-repo',
    complete: missing.length === 0, repositories: results, missing, diagnostics };
}
