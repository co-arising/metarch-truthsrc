import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, cpSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFixture, moduleSeamsFixture, ref, nominal, projectRoot } from './module-seams-fixture.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { validateCodeMappings } from '../src/core/code-mappings.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = root + 'generators/scala-cqrs-module-seams-v1/';
const footprint = [{ id: 'module-seams-contract', version: '1' }, { id: 'module-seams-composition', version: '1' }];
const buildRoots = [
  { id: 'kernel-handwritten', module: 'kernel', absolutePath: '/owned/project/handwritten/kernel' },
  { id: 'glue-handwritten', module: 'glue', absolutePath: '/owned/project/handwritten/glue' },
  { id: 'ext-handwritten', module: 'ext', absolutePath: '/owned/project/handwritten/ext' },
];
const api = async () => ({ ...await import('../generators/scala-cqrs-module-seams-v1/build-models.mjs'),
  ...await import('../generators/scala-cqrs-module-seams-v1/render.mjs'),
  ...await import('../generators/scala-cqrs-module-seams-v1/generate.mjs') });
function fixture(edit) {
  const f = moduleSeamsFixture();
  f.canonical = structuredClone(f.canonical);
  edit?.(f);
  const request = deriveProjectRequest(f.canonical.value, f.config, f.documents);
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  return { ...f, request, compilation };
}
async function rendered(edit, roots = buildRoots) {
  const f = fixture(edit), a = await api();
  const model = a.buildModels({ compilation: f.compilation, options: f.config.options });
  const entries = a.render(model, roots, footprint);
  return { f, a, model, entries };
}
const bySuffix = (entries, suffix) => {
  const rows = entries.filter(e => e.path.endsWith(suffix));
  assert.equal(rows.length, 1, suffix); return rows[0];
};
const fails = (fn, code) => assert.throws(fn, e => e.diagnostic && (!code || e.diagnostic.code === code));
const text = entries => entries.map(e => e.content).join('\n');
const plain = value => value.replace(/^\/\/ @generated[^\n]*\n/u, '').replaceAll('_root_.', '')
  .replaceAll('java.lang.String', 'String').replaceAll('scala.Boolean', 'Boolean').replaceAll('scala.Long', 'Long')
  .replaceAll('scala.collection.immutable.Vector', 'Vector').replaceAll('scala.collection.immutable.Map', 'Map')
  .replaceAll('scala.util.Either', 'Either').replaceAll('scala.Option', 'Option').replaceAll('scala.concurrent.Future', 'Future')
  .replaceAll('scala.concurrent.ExecutionContext', 'ExecutionContext').replace(/example\.parcel\.(?:domain\.values|domain\.ports|application\.ports|domain|infrastructure|application)\./gu, '');

// These tests exercise resolver/renderer without implementation capture or any shared CLI.
test('exact manifest declares only both pinned products and one real producer', async () => {
  await api();
  const m = JSON.parse(readFileSync(directory + 'generator.json'));
  assert.equal(m.name, 'scala-cqrs-module-seams'); assert.equal(m.version, '1');
  assert.equal(m.targetProfile, 'scala-cqrs-module-seams@1');
  assert.deepEqual(m.products.map(({ id, version }) => ({ id, version })), footprint);
  assert.deepEqual(m.products.map(p => p.capabilities), [[{ id: 'finite-module-seams-signature', version: '1' }], [{ id: 'finite-module-seams-composition', version: '1' }]]);
  assert.deepEqual(m.producers.map(p => p.products), [footprint.map(p => p.id)]);
  assert.deepEqual(m.options, ['packages', 'names', 'valueFiles', 'sourceRoots']);
});
test('resolver uses requirement role IDs, not document or payload name guesses', async () => {
  const f = fixture(f => { f.config.canonicalId = 'real-canonical'; f.config.documents[0].id = 'real-technical';
    f.config.roles.moduleSeamsCompositionBinding = 'real-technical'; f.documents[0].id = 'real-technical'; });
  const a = await api(), lowered = a.resolveModuleSeamsTarget({ compilation: f.compilation, options: f.config.options });
  assert.equal(lowered.composition.source.document, 'real-technical'); assert.equal(lowered.contract.source.document, 'real-canonical');
  assert.equal(lowered.generatedFiles.length, 7); assert.equal(lowered.target.files.length, 10);
  assert.ok(Object.isFrozen(lowered));
});
for (const [name, edit] of [
  ['diagnostics', c => { c.diagnostics = [{ code: 'fake' }]; }],
  ['missing requirement', c => { c.result.requirements.pop(); }],
  ['different canonical roles', c => { c.result.requirements[1].inputRoles.canonical = 'forged'; }],
  ['forged payload', c => { c.result.products.find(p => p.id === 'module-seams-contract').payload.values[0].name = 'Forged'; }],
  ['extra product', c => { c.result.products.push(structuredClone(c.result.products[0])); }],
]) test('resolver rejects ' + name, async () => {
  const f = compileFixture(), a = await api(), c = structuredClone(f.compilation); edit(c);
  fails(() => a.resolveModuleSeamsTarget({ compilation: c, options: f.config.options }));
});
test('pure model/render preserve all caller data and deterministic final bytes', async () => {
  const { a, f, model, entries } = await rendered();
  const before = structuredClone({ f, model, roots: buildRoots });
  assert.deepEqual(a.render(model, buildRoots, footprint), entries);
  assert.deepEqual({ f, model, roots: buildRoots }, before); assert.ok(Object.isFrozen(model));
  assert.equal(entries.filter(e => e.path.includes('src/main/scala/')).length, 7);
  assert.equal(entries.filter(e => e.kind === 'build').length, 2);
  assert.equal(entries.filter(e => e.kind === 'generated-test').length, 2);
  assert.equal(entries.length, 11);
});
test('seven generated responsibilities match the independent original signatures, not copied bodies', async () => {
  const { entries } = await rendered();
  const original = 'test/reference/module-seams/';
  for (const e of entries.filter(e => e.path.includes('src/main/scala/'))) {
    const reference = readFileSync(root + original + e.path, 'utf8');
    const generated = plain(e.content);
    for (const line of reference.split('\n').filter(l => /(?:final case class|case object|sealed trait|trait |def (?:assess|find|quote))/u.test(l))) {
      const signature = line.trim().replace(/^override /u, '').replace(/\s*=\s*$/u, '');
      assert.ok(generated.includes(signature), e.path + ' missing signature ' + signature);
    }
  }
  assert.doesNotMatch(text(entries), /foldLeft|UnknownRoute\(request|Future\.successful|\?\?\?|@knowledge/u);
  for (const h of ['CapacityRule.scala', 'InMemoryRouteRepository.scala', 'DefaultQuoteFlow.scala']) assert.ok(!entries.some(e => e.path.endsWith('/' + h)));
});
test('root uses real initialization order, component identities and explicit implicit call group', async () => {
  const { entries, model } = await rendered(), c = bySuffix(entries, '/ParcelModule.scala').content;
  assert.match(plain(c), /def create\(routes: Map\[RouteId, Route\]\)\(implicit executionContext: ExecutionContext\): QuoteFlow/u);
  const order = model.root.initializations.map(i => i.id);
  assert.deepEqual(order, ['capacity-rule', 'repository', 'capacity-bridge', 'flow']);
  assert.ok(c.indexOf('CapacityRule') < c.indexOf('InMemoryRouteRepository'));
  assert.match(c, /new _root_\.example\.parcel\.application\.DefaultQuoteFlow\([^\n]*\)\(executionContext\)/u);
});
test('all entries have entire footprint, generated-only dependency closure and precise final UTF8 spans', async () => {
  const { entries, f } = await rendered(), paths = new Set(entries.map(e => e.path));
  for (const e of entries) {
    assert.deepEqual(e.productFootprint, footprint); assert.equal(e.merge, null); assert.ok(e.knowledgeIds.length);
    assert.ok(e.content.startsWith(e.path.endsWith('.properties') ? '# @generated by truthsrc scala-cqrs-module-seams:1\n' : '// @generated by truthsrc scala-cqrs-module-seams:1\n'));
    validateCodeMappings(e);
    for (const m of e.codeMappings) {
      assert.equal(Buffer.from(e.content).subarray(m.span.start, m.span.end).toString(), m.span.text);
      const [, doc, pointer] = /^source:([^#]+)#(.*)$/u.exec(m.knowledgeKey);
      assert.ok(f.compilation.result.documents.some(d => d.id === doc)); assert.ok(pointer === '' || pointer.startsWith('/'));
    }
    for (const d of e.deps) { assert.ok(paths.has(d)); assert.notEqual(d, e.path); }
  }
  const keys = entries.flatMap(e => e.codeMappings.map(m => m.knowledgeKey));
  for (const suffix of ['/fields/0', '/variants/0', '/methods/0', '/parameters/0', '/arguments/0/from', '/bindings/0']) assert.ok(keys.some(k => k.endsWith(suffix)), suffix);
  const rootEntry = bySuffix(entries, '/ParcelModule.scala');
  for (const path of entries.filter(e => e.path.includes('modules/kernel/src/main/scala/')).map(e => e.path)) assert.ok(rootEntry.deps.includes(path), 'external ABI closure ' + path);
});
test('build has four correct modules, external roots, finite versions and Test-only ScalaTest', async () => {
  const { entries, f } = await rendered(), b = bySuffix(entries, 'build.sbt').content;
  assert.match(b, /scalaVersion := "2\.13\.14"/u); assert.match(b, /"scalatest-funsuite" % "3\.2\.15" % Test/u);
  for (const module of ['kernel', 'glue', 'ext', 'root']) assert.match(b, new RegExp('lazy val ' + module + ' ='));
  assert.match(b, /\.dependsOn\(kernel, glue\)/u); assert.match(b, /\.dependsOn\(kernel, glue, ext\)/u);
  for (const r of buildRoots) assert.ok(b.includes('file("' + r.absolutePath + '")'));
  assert.doesNotMatch(b, /akka|play|protobuf|sbt-protoc|jdbc|mysql|mongo|runtime/u);
  assert.equal(bySuffix(entries, 'project/build.properties').content.split('\n')[1], 'sbt.version=1.4.9');
  assert.deepEqual(f.config.options.sourceRoots.map(r => r.path), ['handwritten/kernel', 'handwritten/glue', 'handwritten/ext']);
});
test('absolute external build paths are safely escaped, kept separate from relative options', async () => {
  const roots = buildRoots.map(r => ({ ...r, absolutePath: '/owned/项目/quote"/slash\\/' + r.id }));
  const { entries } = await rendered(undefined, roots), b = bySuffix(entries, 'build.sbt').content;
  assert.ok(b.includes('quote\\"/slash\\\\/')); assert.ok(b.includes('项目'));
});
for (const [name, edit] of [
  ['missing roots', r => r.pop()], ['wrong module', r => { r[0].module = 'ext'; }],
  ['relative root', r => { r[0].absolutePath = 'relative/kernel'; }],
  ['unknown root', r => { r[0].id = 'unknown'; }], ['extra root', r => r.push({ ...r[0], id: 'extra' })],
]) test('renderer refuses ' + name, async () => {
  const { a, model } = await rendered(), roots = structuredClone(buildRoots); edit(roots);
  fails(() => a.render(model, roots, footprint));
});
test('renaming and reordering use refs and IDs while preserving ABI order', async () => {
  const { entries } = await rendered(f => {
    f.config.options.names.push({ ref: ref('type', 'Parcel'), role: 'value', name: 'Shipment' },
      { ref: { value: ref('type', 'Parcel'), field: 'grams' }, role: 'field', name: 'weight' },
      { ref: { port: ref('port', 'CapacityPolicy'), method: 'assess' }, role: 'method', name: 'evaluate' });
    f.composition.value.implementations.reverse(); f.composition.value.root.bindings.reverse();
    f.canonical.value.valueObjects.reverse(); f.config.options.valueFiles.reverse();
  });
  assert.match(text(entries), /case class Shipment\(id: .*ParcelId, weight: _root_\.scala\.Long\)/u);
  assert.match(text(entries), /def evaluate\(/u); assert.match(text(entries), /CapacityRule\.assess\(/u);
});
test('keywords are escaped by central naming in parameter declarations and calls', async () => {
  const { entries } = await rendered(f => {
    f.config.options.names.push({ ref: { method: { port: ref('port', 'CapacityPolicy'), method: 'assess' }, parameter: 'route' }, role: 'parameter', name: 'type' });
    f.composition.value.root.parameterGroups[0].inputs[0].name = 'type';
  });
  assert.match(text(entries), /`type`: /u); assert.match(text(entries), /CapacityRule\.assess\(`type`, parcels\)/u);
  assert.match(text(entries), /InMemoryRouteRepository\(`type`\)/u);
});
test('Unicode author spelling with explicit ASCII binding produces mappings to actual source', async () => {
  const { entries } = await rendered(f => {
    const parcel = f.canonical.value.valueObjects.find(v => v.name === 'Parcel'); parcel.fields[1].name = '重量';
    f.config.options.names.push({ ref: { value: ref('type', 'Parcel'), field: '重量' }, role: 'field', name: 'weight' });
  });
  assert.match(text(entries), /weight: _root_\.scala\.Long/u);
  assert.ok(entries.flatMap(e => e.codeMappings).some(m => m.span.text.includes('weight:')));
});
test('nested finite types resolve every nominal and standard type without shadowing', async () => {
  const { entries } = await rendered(f => {
    f.canonical.value.valueObjects.find(v => v.name === 'Load').fields[0].dataType = 'Option[Map[String, Either[ParcelId, Vector[Route]]]]';
    f.config.options.names.push({ ref: ref('type', 'Load'), role: 'value', name: 'Int' });
  });
  assert.match(text(entries), /case class Int\(totalGrams: _root_\.scala\.Option\[_root_\.scala\.collection\.immutable\.Map\[_root_\.java\.lang\.String, _root_\.scala\.util\.Either\[/u);
  assert.match(text(entries), /capacityGrams: _root_\.scala\.Long/u);
});
test('empty port method parameters retain () on signature and delegate call', async () => {
  const { entries } = await rendered(f => { f.canonical.value.moduleSeamsContracts[0].ports[0].methods[0].parameters = []; });
  assert.match(text(entries), /def assess\(\):/u); assert.match(text(entries), /CapacityRule\.assess\(\)/u);
});
test('direct pure implementation produces six Scala files and no unused bridge', async () => {
  const { entries } = await rendered(f => {
    f.composition.value.bridges = []; f.composition.value.implementations[0].implements = ref('port', 'CapacityPolicy');
    f.composition.value.root.bindings[0].target = { kind: 'implementation', id: 'capacity-rule' };
    f.config.options.names = f.config.options.names.filter(n => n.role !== 'bridge');
  });
  assert.equal(entries.filter(e => e.path.includes('src/main/scala/')).length, 6);
  assert.doesNotMatch(text(entries), /CapacityPolicyBridge/u);
});
test('direct mode rejects residual bridge names rather than silently dropping them', async () => {
  const a = await api(), f = fixture(f => {
    f.composition.value.bridges = []; f.composition.value.implementations[0].implements = ref('port', 'CapacityPolicy');
    f.composition.value.root.bindings[0].target = { kind: 'implementation', id: 'capacity-rule' };
  });
  fails(() => a.buildModels({ compilation: f.compilation, options: f.config.options }));
});
test('class pure delegate receives its root-input constructor and is injected into bridge', async () => {
  const { entries } = await rendered(f => {
    const rule = f.composition.value.implementations[0]; rule.construction = 'class';
    rule.constructor = [{ implicit: false, arguments: [{ name: 'capacitySeed', from: { kind: 'root-input', id: 'seed' } }] }];
    f.composition.value.root.parameterGroups[0].inputs.push({ id: 'seed', name: 'seed', type: { form: 'primitive', name: 'integer' } });
  });
  assert.match(text(entries), /new _root_\.example\.parcel\.domain\.CapacityRule\(seed\)/u);
  const bridge = bySuffix(entries, '/CapacityPolicyBridge.scala').content;
  assert.match(bridge, /class CapacityPolicyBridge\(private val delegate: _root_\.example\.parcel\.domain\.CapacityRule\)/u);
  assert.match(bridge, /delegate\.assess\(route, parcels\)/u);
  assert.doesNotMatch(bridge, /new .*CapacityRule/u);
});
test('generated support is signature/shape-only, not business-oracle success', async () => {
  const { entries } = await rendered();
  const tests = entries.filter(e => e.kind === 'generated-test'); assert.equal(tests.length, 2);
  assert.match(text(tests), /signature shape/u); assert.match(text(tests), /bindingShape/u);
  assert.doesNotMatch(text(tests), /Await|ExecutionContext\.global|quote\(|assess\(|OverCapacity\(|InvalidWeight\(|Right\(Quote/u);
});
test('public generate without live capture fails closed; wrong target also refused', async () => {
  const a = await api(), f = compileFixture(), manifest = JSON.parse(readFileSync(directory + 'generator.json'));
  const input = { compilation: f.compilation, manifest, options: f.config.options };
  const noCapture = a.generate(input);
  assert.equal(noCapture.plan, null); assert.equal(noCapture.diagnostics[0].code, 'MODULE_SEAMS_CAPTURE_REQUIRED');
  const wrong = a.generate({ ...input, manifest: { ...manifest, targetProfile: 'other@1' } });
  assert.equal(wrong.plan, null); assert.ok(wrong.diagnostics.length);
});
test('public generate rejects fabricated evidence without reading or writing output', async () => {
  const a = await api(), f = compileFixture(), manifest = JSON.parse(readFileSync(directory + 'generator.json'));
  const forged = { schemaVersion: 'truthsrc.module-seams-implementations/v1', project: {}, roots: [], members: [] };
  const result = a.generate({ compilation: f.compilation, manifest, options: f.config.options }, { implementations: forged, outDir: '/owned/output' });
  assert.equal(result.plan, null); assert.ok(result.diagnostics.length);
});

test('bridge dependency closure includes declarations required by transitive external component ABI', async () => {
  const { entries } = await rendered(f => {
    f.canonical.value.valueObjects.push({ name: 'AuxiliaryValue', fields: [{ name: 'flag', dataType: 'Boolean' }] });
    f.config.options.valueFiles.push({ ref: ref('type', 'AuxiliaryValue'), fileStem: 'AuxiliaryValue' });
    f.canonical.value.moduleSeamsContracts[0].ports.push({ id: 'AuxiliaryPolicy', name: 'AuxiliaryPolicy', role: 'computation',
      methods: [{ id: 'inspect', name: 'inspect', parameters: [], result: { effect: 'pure', valueType: nominal('AuxiliaryValue') } }] });
    const auxiliary = structuredClone(f.composition.value.implementations[0]);
    auxiliary.id = 'auxiliary'; auxiliary.symbol = 'example.parcel.domain.AuxiliaryRule'; auxiliary.source.file = 'AuxiliaryRule.scala';
    auxiliary.implements = ref('port', 'AuxiliaryPolicy');
    auxiliary.methods = [{ method: { port: ref('port', 'AuxiliaryPolicy'), method: 'inspect' }, delegateMember: 'inspect' }];
    f.composition.value.implementations.push(auxiliary);
    f.composition.value.root.bindings.push({ port: ref('port', 'AuxiliaryPolicy'), target: { kind: 'implementation', id: 'auxiliary' } });
    f.composition.value.implementations[0].construction = 'class';
    f.composition.value.implementations[0].constructor = [{ implicit: false, arguments: [{ name: 'auxiliary', from: { kind: 'component', id: 'auxiliary' } }] }];
  });
  const bridge = bySuffix(entries, '/CapacityPolicyBridge.scala');
  for (const suffix of ['/AuxiliaryPolicy.scala', '/AuxiliaryValue.scala']) {
    const dep = bySuffix(entries, suffix); assert.ok(bridge.deps.includes(dep.path), suffix);
  }
});
test('actual Int nominal remains separate from primitive Long in values and port results', async () => {
  const { entries } = await rendered(f => {
    f.canonical.value.valueObjects.find(v => v.name === 'Load').name = 'Int';
    for (const v of f.canonical.value.valueObjects) for (const field of v.fields ?? []) if (field.dataType === 'Load') field.dataType = 'Int';
    f.canonical.value.moduleSeamsContracts[0].ports[0].methods[0].result.valueType.right.ref.id = 'Int';
    f.config.options.valueFiles.find(v => v.ref.id === 'Load').ref.id = 'Int';
  });
  assert.match(text(entries), /case class Int\(totalGrams: _root_\.scala\.Long\)/u);
  assert.match(text(entries), /\.domain\.values\.Int\]/u); assert.match(text(entries), /load: _root_\.example\.parcel\.domain\.values\.Int/u);
});
test('parameter order and bridge method order are resolved by method IDs, not ordinal pairing', async () => {
  const { entries } = await rendered(f => {
    const port = f.canonical.value.moduleSeamsContracts[0].ports[0];
    const m = structuredClone(port.methods[0]); m.id = 'other'; m.name = 'other'; m.parameters = [];
    port.methods[0].parameters.reverse(); port.methods.push(m);
    const mapping = { method: { port: ref('port', 'CapacityPolicy'), method: 'other' }, delegateMember: 'other' };
    f.composition.value.implementations[0].methods.push(structuredClone(mapping));
    f.composition.value.bridges[0].methods.unshift(mapping);
  });
  const b = bySuffix(entries, '/CapacityPolicyBridge.scala').content;
  assert.match(b, /CapacityRule\.assess\(parcels, route\)/u); assert.match(b, /CapacityRule\.other\(\)/u);
});
test('injected delegate cannot be shadowed by a same-named method parameter', async () => {
  const { entries } = await rendered(f => {
    f.composition.value.implementations[0].construction = 'class';
    f.config.options.names.push({ ref: { method: { port: ref('port', 'CapacityPolicy'), method: 'assess' }, parameter: 'route' }, role: 'parameter', name: 'delegate' });
  });
  assert.match(bySuffix(entries, '/CapacityPolicyBridge.scala').content, /this\.delegate\.assess\(delegate, parcels\)/u);
});
test('sum variants extending same-named parent use an absolute parent type', async () => {
  const { entries } = await rendered(f => {
    f.config.options.names.push({ ref: { value: ref('type', 'QuoteError'), variant: 'EmptyParcels' }, role: 'variant', name: 'QuoteError' });
  });
  assert.match(bySuffix(entries, '/QuoteError.scala').content, /case object QuoteError extends _root_\.example\.parcel\.domain\.QuoteError/u);
});
test('support Scala files stay in test roots; no plugins or production helper leakage', async () => {
  const { entries } = await rendered();
  for (const e of entries.filter(e => e.kind === 'generated-test')) assert.ok(e.path.includes('src/test/scala/'));
  assert.ok(!entries.some(e => e.path.endsWith('plugins.sbt')));
});
test('Unicode build mapping offsets equal final bytes, including fragments after the Unicode path', async () => {
  const { entries } = await rendered(undefined, buildRoots.map(r => ({ ...r, absolutePath: '/owned/项目/' + r.id })));
  const b = bySuffix(entries, 'build.sbt');
  validateCodeMappings(b); assert.ok(b.codeMappings.some(m => m.span.text.includes('项目')));
  for (const m of b.codeMappings) assert.equal(Buffer.from(b.content).subarray(m.span.start, m.span.end).toString(), m.span.text);
});
for (const [name, make] of [
  ['getters', () => ({ get options() { throw new Error('getter must not execute'); } })],
  ['proxy', () => new Proxy({}, { get() { throw new Error('proxy must not execute'); } })],
  ['callback', () => ({ compilation: {}, options: { callback() {} } })],
  ['unknown input field', f => ({ compilation: f.compilation, options: f.config.options, model: {} })],
]) test('resolver does not admit ' + name, async () => {
  const a = await api(), f = compileFixture(); fails(() => a.resolveModuleSeamsTarget(make(f)));
});
for (const [name, make] of [
  ['capture getter', () => ({ get implementations() { throw new Error('getter must not execute'); }, outDir: '/owned/out' })],
  ['context proxy', () => new Proxy({}, { ownKeys() { throw new Error('proxy must not execute'); } })],
  ['model bypass', () => ({ implementations: {}, outDir: '/owned/out', model: {} })],
  ['user producer callback', () => ({ implementations: {}, outDir: '/owned/out', produce() { throw new Error('callback must not execute'); } })],
]) test('public generate refuses ' + name, async () => {
  const a = await api(), f = compileFixture(), manifest = JSON.parse(readFileSync(directory + 'generator.json'));
  const result = a.generate({ compilation: f.compilation, manifest, options: f.config.options }, make());
  assert.equal(result.plan, null); assert.ok(result.diagnostics.length);
});

test('canonical mappings select exact source-index records rather than parent-only formal nodes', async () => {
  const { entries, f } = await rendered();
  const canonicalKeys = [...new Set(entries.flatMap(e => e.codeMappings.map(m => m.knowledgeKey)).filter(k => k.startsWith('source:parcel-domain#')))];
  for (const key of canonicalKeys) {
    const pointer = key.slice('source:parcel-domain#'.length);
    assert.equal(f.tree.sourceIndex.records.filter(r => r.pointer === pointer).length, 1, pointer);
  }
});
test('explicit zero-group root ABI renders without guessed input or implicit parameters', async () => {
  const { entries } = await rendered(f => {
    f.composition.value.root.parameterGroups = [];
    f.composition.value.implementations.forEach(i => { i.constructor = []; });
  });
  assert.match(plain(bySuffix(entries, '/ParcelModule.scala').content), /def create: QuoteFlow =/u);
  assert.doesNotMatch(bySuffix(entries, '/ParcelModule.scala').content, /executionContext|routes:/u);
});

// Never stub the peer's I/O success. If not ready, this remains explicitly skipped.
const captureReady = existsSync(root + 'lib/project/implementations.mjs');
test('real capture supplies actual external build roots to full compilation replay/two-produce plan', { skip: !captureReady && 'peer capture module not present' }, async () => {
  const a = await api(), capture = await import('../lib/project/implementations.mjs');
  const temp = mkdtempSync(join(realpathSync(tmpdir()), 'b-template-module-seams-'));
  try {
    const project = join(temp, 'project'); cpSync(projectRoot, project, { recursive: true });
    const f = compileFixture();
    const projectFile = join(project, 'truthsrc.project.json');
    // Source-index filenames are author-root-relative: explicitly inventory all copied inputs.
    const { readdirSync } = await import('node:fs');
    function inventory(path) { return readdirSync(path, { withFileTypes: true }).flatMap(d => d.isDirectory() ? inventory(join(path, d.name)) : [join(path, d.name)]); }
    const lowered = a.resolveModuleSeamsTarget({ compilation: f.compilation, options: f.config.options });
    const evidence = capture.captureImplementations({ projectFile, tree: join(project, f.config.tree),
      inputFiles: [projectFile, join(project, 'bindings/module-seams.json'), ...inventory(join(project, f.config.tree))], sourceRoots: lowered.sourceRoots, handwritten: lowered.handwritten });
    const outDir = join(temp, 'generated'), manifest = JSON.parse(readFileSync(directory + 'generator.json'));
    const plan = a.generate({ compilation: f.compilation, manifest, options: f.config.options }, { implementations: evidence, outDir });
    assert.deepEqual(plan.diagnostics, []); assert.equal(plan.plan.entries.length, 11);
    assert.equal(plan.plan.targetProfile, 'scala-cqrs-module-seams@1');
    assert.ok(bySuffix(plan.plan.entries, 'build.sbt').content.includes(join(project, 'handwritten/kernel')));
    assert.equal(existsSync(outDir), false); capture.assertImplementationsUnchanged(evidence);
    for (const badOutput of [undefined, 'relative/out', evidence.roots[0].absolutePath]) {
      const refused = a.generate({ compilation: f.compilation, manifest, options: f.config.options }, { implementations: evidence, outDir: badOutput });
      assert.equal(refused.plan, null); assert.ok(refused.diagnostics.length);
    }
    for (const forged of [structuredClone(evidence), JSON.parse(JSON.stringify(evidence))]) {
      const rejected = a.generate({ compilation: f.compilation, manifest, options: f.config.options }, { implementations: forged, outDir });
      assert.equal(rejected.plan, null); assert.ok(rejected.diagnostics.length);
    }
    for (const mutate of [m => { m.name = 'forged'; }, m => { m.products.pop(); }, m => { m.producers[0].products.reverse(); }]) {
      const bad = structuredClone(manifest); mutate(bad);
      assert.equal(a.generate({ compilation: f.compilation, manifest: bad, options: f.config.options }, { implementations: evidence, outDir }).plan, null);
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
