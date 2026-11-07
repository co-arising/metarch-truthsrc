import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateCatalogue, loadCatalogue } from '../lib/artifact-docs/catalog.mjs';
import { DOC_ROOT, jsonBytes, sha256 } from '../lib/artifact-docs/io.mjs';
import { validateCapabilities, capabilitySummary, producerFingerprint, verifyCapabilitySources,
  matchOutputContracts, validateObservation, renderCapabilityMatrix } from '../lib/artifact-docs/capabilities.mjs';

const ref = (file, symbol = '*') => ({ repo: 'js', file, symbol });
function fixture() {
  const producer = { id: 'example', manifest: ref('generators/example/generator.json'), version: '1.0.0',
    lifecycle: 'current', registration: 'product-profile', input: 'Explicit example request and package options.',
    stages: [{ role: 'entrypoint', ref: ref('generators/example/generate.mjs', 'generate') },
      { role: 'writer', ref: ref('src/core/apply.mjs', 'apply') }],
    outputs: [{ id: 'state', kind: 'state', paths: ['app/**/domain/*State.scala'], shape: 'Immutable state carrier.',
      sources: [ref('generators/example/generate.mjs', 'generate')], channel: 'manifest', disposition: 'code', conditions: [] }], notes: [] };
  const capability = { lifecycle: 'current', responsibility: 'generate-code', input: 'Declared aggregate fields.',
    implementation: [{ role: 'template', ref: ref('generators/example/generate.mjs', 'generate') }],
    routes: [{ producer: 'example', outputs: ['state'] }], evidence: [], gaps: ['Compilation and behavior are not yet evidenced.'],
    rationale: 'The explicit output contract covers the application state, not a runtime library.' };
  const category = { id: 'domain-state', title: 'State', document: 'scala-cqrs/domain/domain-state.md',
    variants: [{ profile: 'js-formal', availability: 'implemented', ownership: 'generated', modules: ['single-project'],
      outputs: ['A state carrier'], sourceRefs: [ref('generators/example/generate.mjs', 'generate')], capability }] };
  const files = [
    { path: 'generators/example/generator.json', sha256: 'a'.repeat(64), bytes: 12, scope: 'generators', symbols: [],
      manifest: { name: 'example', artifactKinds: ['state'] } },
    { path: 'generators/example/generate.mjs', sha256: 'b'.repeat(64), bytes: 20, scope: 'generators', symbols: ['generate'] },
    { path: 'src/core/apply.mjs', sha256: 'c'.repeat(64), bytes: 30, scope: 'core', symbols: ['apply'] }
  ];
  const catalog = { schemaVersion: 'truthsrc.artifact-documentation/v2', version: '2.0.0', categories: [category],
    producers: [producer], observations: [] };
  const lock = { productionToolSha256: '0'.repeat(64), repositories: { js: { scopes: [{ id: 'generators', packaged: true }, { id: 'core', packaged: true }], files } } };
  return { catalog, lock, category, capability, producer };
}
function observed(f, level = 'generated', status = 'passed') {
  const receipt = { schemaVersion: 'truthsrc.artifact-capability-observation/v1', producer: 'example', channel: 'manifest', level, status,
    sourceFingerprint: producerFingerprint(f.catalog, f.lock, 'example'),
    command: 'node --test explicit-example.test.mjs', inputs: [{ name: 'explicit request', sha256: 'd'.repeat(64) }],
    artifacts: [{ path: 'app/example/domain/OrderState.scala', kind: 'state', bytes: 17, sha256: 'e'.repeat(64), contracts: ['state'] }],
    checks: [{ name: 'explicit output assertion', passed: true }], independent: false, approval: null };
  const bytes = jsonBytes(receipt);
  const observation = { id: 'example-' + level, producer: 'example', channel: 'manifest', level, status, sourceFingerprint: receipt.sourceFingerprint,
    outputs: ['state'], receipt: { file: 'evidence/example-' + level + '.json', sha256: sha256(bytes) } };
  f.catalog.observations.push(observation); f.capability.evidence.push(observation.id);
  return { receipt, bytes, observation };
}

test('capability schema binds every variant and reverse-maps every declared producer output', () => {
  const f = fixture();
  assert.doesNotThrow(() => validateCapabilities(f.catalog));
  assert.deepEqual(verifyCapabilitySources(f.catalog, f.lock), []);
  f.producer.outputs.push({ ...structuredClone(f.producer.outputs[0]), id: 'unmapped' });
  assert.throws(() => validateCapabilities(f.catalog), /unmapped producer output/);
});

test('duplicate, unknown and contradictory capability declarations reject', () => {
  for (const change of [
    f => { delete f.capability; delete f.category.variants[0].capability; },
    f => { f.capability.lifecycle = 'probably-current'; },
    f => { f.capability.responsibility = 'consume-library'; },
    f => { f.capability.routes[0].producer = 'unknown'; },
    f => { f.capability.routes[0].outputs = ['unknown']; },
    f => { f.capability.routes.push(structuredClone(f.capability.routes[0])); },
    f => { f.producer.stages = f.producer.stages.filter(s => s.role !== 'writer'); },
    f => { f.producer.outputs[0].paths = ['../outside']; },
    f => { f.capability.perfect = true; },
    f => { f.catalog.producers.push(structuredClone(f.producer)); }
  ]) {
    const f = fixture(); change(f); assert.throws(() => validateCapabilities(f.catalog));
  }
});

test('library, handwritten, evidence and retired responsibilities do not inflate current code denominator', () => {
  const f = fixture();
  for (const [id, responsibility, ownership, lifecycle] of [
    ['library', 'consume-library', 'library', 'current'], ['manual', 'handwritten', 'handwritten', 'current'],
    ['report', 'derive-evidence', 'derived', 'current'], ['retired', 'reference-only', 'generated', 'retired']
  ]) {
    const c = structuredClone(f.category); c.id = id;
    Object.assign(c.variants[0], { ownership, modules: ownership === 'library' ? ['runtime-library'] : ['single-project'] });
    Object.assign(c.variants[0].capability, { responsibility, lifecycle, routes: [], evidence: [] });
    f.catalog.categories.push(c);
  }
  validateCapabilities(f.catalog);
  const s = capabilitySummary(f.catalog, f.lock);
  assert.equal(s.js.code.required.categories, 1);
  assert.equal(s.js.code.producerLocated.categories, 1);
  assert.equal(s.js.evidence.required.categories, 1);
  assert.equal(s.js.excluded.categories, 3);
  assert.equal(s.js.code.generated.categories, 0);
  assert.equal(s.js.code.finalApproved.categories, 0);
});

test('a located legacy or retired producer cannot silently count as a current implementation', () => {
  const f = fixture(); f.producer.lifecycle = 'retired'; f.producer.registration = 'retired';
  assert.throws(() => validateCapabilities(f.catalog), /retired producer/);
  f.capability.lifecycle = 'retired';
  validateCapabilities(f.catalog);
  assert.equal(capabilitySummary(f.catalog, f.lock).js.code.required.categories, 0);
});

test('declared implementation is not upgraded without source-bound evidence', () => {
  const f = fixture(); observed(f);
  const s = capabilitySummary(f.catalog, f.lock);
  assert.equal(s.js.code.generated.categories, 0, 'an unverified receipt reference is not generation evidence');
  assert.equal(s.js.code.compiled.categories, 0);
  assert.equal(s.js.code.behaviorVerified.categories, 0);
});

test('generation observations require actual matching artifacts, inputs and successful checks', () => {
  const f = fixture(); const o = observed(f);
  assert.equal(validateObservation(f.catalog, f.lock, o.observation, o.bytes).passed, true);
  for (const change of [r => { r.artifacts = []; }, r => { r.inputs = []; },
    r => { r.checks[0].passed = false; }, r => { r.artifacts[0].path = 'app/example/domain/Wrong.scala'; },
    r => { r.artifacts[0].kind = 'library'; }, r => { r.artifacts[0].sha256 = 'not-a-digest'; }]) {
    const r = structuredClone(o.receipt); change(r); const bytes = jsonBytes(r);
    assert.throws(() => validateObservation(f.catalog, f.lock, { ...o.observation, receipt: { ...o.observation.receipt, sha256: sha256(bytes) } }, bytes));
  }
});

test('passing generation does not grant compilation, behavior or final approval', () => {
  const f = fixture(); const o = observed(f);
  const verified = [validateObservation(f.catalog, f.lock, o.observation, o.bytes)];
  const s = capabilitySummary(f.catalog, f.lock, verified);
  assert.equal(s.js.code.generated.categories, 1);
  assert.equal(s.js.code.compiled.categories, 0);
  assert.equal(s.js.code.behaviorVerified.categories, 0);
  assert.equal(s.js.code.finalApproved.categories, 0);
});

test('skipped and failed observations are retained but never promoted', () => {
  for (const status of ['skipped', 'failed']) {
    const f = fixture(); const o = observed(f, 'generated', status);
    const verified = [validateObservation(f.catalog, f.lock, o.observation, o.bytes)];
    assert.equal(verified[0].passed, false);
    assert.equal(capabilitySummary(f.catalog, f.lock, verified).js.code.generated.categories, 0);
  }
});

test('source changes, newly added production support and output-contract changes expire evidence', () => {
  for (const change of [
    f => { f.lock.productionToolSha256 = '9'.repeat(64); },
    f => { f.lock.repositories.js.files[1].sha256 = 'f'.repeat(64); },
    f => { f.lock.repositories.js.files.push({ path: 'src/core/new.mjs', scope: 'core', bytes: 2, sha256: 'f'.repeat(64) }); },
    f => { f.producer.outputs[0].shape = 'Different carrier contract'; }
  ]) {
    const f = fixture(); const o = observed(f); change(f);
    assert.throws(() => validateObservation(f.catalog, f.lock, o.observation, o.bytes), /stale producer/);
  }
});

test('all manifests, entrypoints and source locators must be backed by the lock', () => {
  for (const [change, code] of [
    [f => { f.lock.repositories.js.files.push({ ...f.lock.repositories.js.files[0], path: 'generators/new/generator.json' }); }, 'UNCALIBRATED_MANIFEST'],
    [f => { f.lock.repositories.js.files.shift(); }, 'CAPABILITY_SOURCE_MISSING'],
    [f => { f.producer.stages[0].ref.symbol = 'nonexistent'; }, 'CAPABILITY_SYMBOL_MISSING']
  ]) {
    const f = fixture(); change(f);
    assert.ok(verifyCapabilitySources(f.catalog, f.lock).some(d => d.code === code), code);
  }
});

test('paths and kinds jointly select output contracts, including root files', () => {
  const f = fixture();
  assert.deepEqual(matchOutputContracts(f.producer, { path: 'app/a/domain/OrderState.scala', kind: 'state' }), ['state']);
  assert.deepEqual(matchOutputContracts(f.producer, { path: 'app/domain/OrderState.scala', kind: 'state' }), ['state']);
  assert.deepEqual(matchOutputContracts(f.producer, { path: 'app/a/domain/OrderState.scala', kind: 'other' }), []);
  f.producer.outputs[0].paths = ['build.sbt'];
  assert.deepEqual(matchOutputContracts(f.producer, { path: 'build.sbt', kind: 'state' }), ['state']);
  assert.deepEqual(matchOutputContracts(f.producer, { path: 'nested/build.sbt', kind: 'state' }), []);
});

test('multi-output claims require every contract, not a neighboring file of the same kind', () => {
  const f = fixture();
  f.producer.outputs.push({ ...structuredClone(f.producer.outputs[0]), id: 'entity', paths: ['app/**/domain/*Entity.scala'] });
  f.capability.routes[0].outputs.push('entity');
  const o = observed(f); o.observation.outputs.push('entity');
  assert.throws(() => validateObservation(f.catalog, f.lock, o.observation, o.bytes), /unobserved output contract/);
});

test('compilation and behavior evidence cannot bypass lower-level evidence or independent oracles', () => {
  const f = fixture(); const o = observed(f, 'behavior-verified');
  assert.throws(() => validateObservation(f.catalog, f.lock, o.observation, o.bytes), /independent/);
  const r = { ...o.receipt, independent: true }; const bytes = jsonBytes(r);
  const verified = [validateObservation(f.catalog, f.lock, { ...o.observation, receipt: { ...o.observation.receipt, sha256: sha256(bytes) } }, bytes)];
  assert.equal(capabilitySummary(f.catalog, f.lock, verified).js.code.behaviorVerified.categories, 0);
});

test('final approval requires an explicit independent authority record, not a perfect flag', () => {
  const f = fixture(); const o = observed(f, 'final-approved');
  assert.throws(() => validateObservation(f.catalog, f.lock, o.observation, o.bytes), /approval|independent/);
});

test('capability matrix is deterministic and includes all category-profile rows and producer reverse mappings', () => {
  const f = fixture(); const text = renderCapabilityMatrix(f.catalog, f.lock);
  assert.equal(text, renderCapabilityMatrix(f.catalog, f.lock));
  assert.ok(text.includes('domain-state'));
  assert.ok(text.includes('js-formal'));
  assert.ok(text.includes('example'));
  assert.ok(text.includes('Compilation and behavior are not yet evidenced.'));
});

test('fabricated verification result objects cannot promote capability counts', () => {
  const f = fixture(); const o = observed(f);
  const forged = { id: o.observation.id, producer: 'example', level: 'generated', passed: true, outputs: ['state'] };
  assert.equal(capabilitySummary(f.catalog, f.lock, [forged]).js.code.generated.categories, 0);
});

test('changing a capability output route cannot borrow another output observation', () => {
  const f = fixture(); const o = observed(f);
  const proof = validateObservation(f.catalog, f.lock, o.observation, o.bytes);
  f.capability.routes[0].outputs = ['another-output'];
  assert.equal(capabilitySummary(f.catalog, f.lock, [proof]).js.code.generated.categories, 0);
});

test('overlapping selectors never auto-approve an unexecuted conditional output', () => {
  const f = fixture();
  f.producer.outputs.push({ ...structuredClone(f.producer.outputs[0]), id: 'conditional', conditions: ['explicit graph mode'] });
  const o = observed(f);
  o.receipt.artifacts[0].contracts = ['state'];
  const bytes = jsonBytes(o.receipt);
  const proof = validateObservation(f.catalog, f.lock, { ...o.observation, receipt: { ...o.observation.receipt, sha256: sha256(bytes) } }, bytes);
  assert.deepEqual(proof.outputs, ['state']);
  const c = structuredClone(f.category); c.id = 'graph'; c.variants[0].capability.routes[0].outputs = ['conditional'];
  f.catalog.categories.push(c);
  assert.equal(capabilitySummary(f.catalog, f.lock, [proof]).js.code.generated.categories, 1);
});

test('compilation and behavior from different inputs or artifacts cannot be stitched together', () => {
  for (const changed of ['input', 'artifact']) {
    const f = fixture(), verified = [];
    for (const [index, level] of ['generated', 'compiled', 'behavior-verified'].entries()) {
      const o = observed(f, level);
      if (changed === 'input') o.receipt.inputs[0].sha256 = String(index + 1).repeat(64);
      else o.receipt.artifacts[0].sha256 = String(index + 1).repeat(64);
      o.receipt.independent = true;
      const bytes = jsonBytes(o.receipt); o.observation.receipt.sha256 = sha256(bytes);
      verified.push(validateObservation(f.catalog, f.lock, o.observation, bytes));
    }
    const s = capabilitySummary(f.catalog, f.lock, verified);
    assert.equal(s.js.code.generated.categories, 1);
    assert.equal(s.js.code.compiled.categories, 0);
    assert.equal(s.js.code.behaviorVerified.categories, 0);
  }
});

test('partial outputs from different samples do not satisfy one complete route', () => {
  const f = fixture();
  f.producer.outputs.push({ ...structuredClone(f.producer.outputs[0]), id: 'entity', paths: ['app/**/domain/*Entity.scala'] });
  f.capability.routes[0].outputs.push('entity');
  const verified = [];
  for (const [index, contract] of ['state', 'entity'].entries()) {
    const o = observed(f); o.observation.id += '-' + index; f.capability.evidence[f.capability.evidence.length - 1] = o.observation.id;
    o.observation.outputs = [contract];
    if (contract === 'entity') o.receipt.artifacts[0].path = 'app/example/domain/OrderEntity.scala';
    o.receipt.artifacts[0].contracts = [contract];
    o.receipt.inputs[0].sha256 = String(index + 1).repeat(64);
    const bytes = jsonBytes(o.receipt); o.observation.receipt.sha256 = sha256(bytes);
    verified.push(validateObservation(f.catalog, f.lock, o.observation, bytes));
  }
  assert.equal(capabilitySummary(f.catalog, f.lock, verified).js.code.generated.categories, 0);
});

test('v1 catalogue remains readable but its implemented flags provide no calibrated capability totals', () => {
  const { catalog } = loadCatalogue();
  const legacy = structuredClone(catalog);
  legacy.schemaVersion = 'truthsrc.artifact-documentation/v1'; legacy.version = '1.0.0';
  delete legacy.producers; delete legacy.observations;
  for (const category of legacy.categories) for (const variant of category.variants) delete variant.capability;
  validateCatalogue(legacy, file => readFileSync(join(DOC_ROOT, file), 'utf8'));
  const summary = capabilitySummary(legacy, { repositories: {} });
  assert.equal(summary.calibrated, false); assert.equal(summary.js, null);
});
