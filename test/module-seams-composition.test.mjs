import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveModuleSeamsContract } from '../lib/products/module-seams-contract.mjs';
import { compileModuleSeamsComposition } from '../lib/products/module-seams-composition.mjs';
import { lowerModuleSeamsTarget } from '../lib/products/module-seams-target.mjs';
import { ProductError, resolve } from '../lib/products/request.mjs';
import { moduleSeamsFixture, ref } from './module-seams-fixture.mjs';
const rejects = (fn, code) => assert.throws(fn, e => e instanceof ProductError && (!code || e.diagnostic.code === code));
const compile = edit => { const f = moduleSeamsFixture(); const binding = structuredClone(f.composition); edit?.(binding.value); return compileModuleSeamsComposition(binding, f.canonical, deriveModuleSeamsContract(f.canonical)); };

test('explicit ABI preserves root factory, all argument groups/sources and pure delegate', () => {
  const f = moduleSeamsFixture(), c = compile();
  assert.equal(c.root.method, 'create'); assert.equal(c.root.result.id, 'QuoteFlow');
  assert.deepEqual(c.root.parameterGroups.map(g => [g.implicit, g.inputs.map(i => i.name)]), [[false, ['routes']], [true, ['executionContext']]]);
  assert.deepEqual(c.implementations.find(i => i.id === 'flow').constructor.map(g => [g.implicit, g.arguments.map(a => a.name)]), [[false, ['repository', 'capacity']], [true, ['executionContext']]]);
  assert.equal(c.bridges[0].delegateImplementation, 'capacity-rule');
  assert.equal(c.bridges[0].methods[0].delegateMember, 'assess');
  assert.equal(c.bridges[0].methods[0].signature.result.effect, 'pure');
  assert.ok(c.order.indexOf('repository') < c.order.indexOf('flow'));
  assert.ok(c.order.indexOf('capacity-bridge') < c.order.indexOf('flow'));
  assert.equal(c.handwritten.length, 3); assert.throws(() => c.order.push('x'), TypeError);
  for (const s of [c.source, c.root.source, ...c.implementations.flatMap(i => [i.source, i.sourceFile.source, ...i.constructor.flatMap(g => [g.source, ...g.arguments.map(a => a.source)]), ...i.methods.map(m => m.source)]), ...c.bridges.map(b => b.source)]) {
    assert.equal(s.document, f.composition.id); assert.notEqual(resolve(f.composition.value, s.pointer, s), undefined);
  }
});

const negatives = [
  ['unknown composition key', b => { b.scalaBody = 'new DefaultQuoteFlow()'; }],
  ['unsupported binding version', b => { b.schemaVersion = 'truthsrc.module-seams-composition-binding/v2'; }],
  ['wrong contract pin', b => { b.contract.version = '2'; }],
  ['cross context', b => { b.contract.context = 'other'; }],
  ['missing adapter implements', b => { b.implementations[1].implements = null; }],
  ['missing extension implements', b => { b.implementations[2].implements = null; }],
  ['wrong module', b => { b.implementations[0].module = 'ext'; }],
  ['unknown role', b => { b.implementations[0].role = 'service'; }],
  ['missing handwritten source', b => { delete b.implementations[0].source; }],
  ['unsafe source path', b => { b.implementations[0].source.file = '../CapacityRule.scala'; }],
  ['absolute source path', b => { b.implementations[0].source.file = '/CapacityRule.scala'; }],
  ['backslash source path', b => { b.implementations[0].source.file = 'x\\CapacityRule.scala'; }],
  ['duplicate implementation', b => { b.implementations.push(structuredClone(b.implementations[0])); }],
  ['duplicate FQN', b => { b.implementations[1].symbol = b.implementations[0].symbol; }],
  ['unknown root input', b => { b.implementations[1].constructor[0].arguments[0].from.id = 'missing'; }],
  ['literal constructor source', b => { b.implementations[1].constructor[0].arguments[0].from = { kind: 'literal', value: '{}' }; }],
  ['unknown constructor field', b => { b.implementations[1].constructor[0].arguments[0].type = 'Map'; }],
  ['object constructor arguments', b => { b.implementations[0].constructor = structuredClone(b.implementations[1].constructor); }],
  ['implicit group not last', b => { b.implementations[2].constructor.reverse(); }],
  ['implicit group repeated', b => { b.implementations[2].constructor[0].implicit = true; }],
  ['pure dependency on flow', b => { b.implementations[0].construction = 'class'; b.implementations[0].constructor = [{ implicit: false, arguments: [{ name: 'flow', from: { kind: 'port', ref: ref('port', 'QuoteFlow') } }] }]; }],
  ['pure EC', b => { b.implementations[0].construction = 'class'; b.implementations[0].constructor = [structuredClone(b.implementations[2].constructor[1])]; }],
  ['unresolved component', b => { b.implementations[2].constructor[0].arguments[0].from = { kind: 'component', id: 'missing' }; }],
  ['component cycle', b => { b.implementations[1].constructor[0].arguments[0].from = { kind: 'port', ref: ref('port', 'QuoteFlow') }; }],
  ['bridge delegates to ext', b => { b.bridges[0].delegateImplementation = 'flow'; }],
  ['bridge wrong method', b => { b.bridges[0].methods[0].method.method = 'missing'; }],
  ['bridge renamed delegate mismatch', b => { b.bridges[0].methods[0].delegateMember = 'other'; }],
  ['missing implementation method ABI', b => { b.implementations[0].methods = []; }],
  ['overloaded member', b => { b.implementations[0].methods.push(structuredClone(b.implementations[0].methods[0])); }],
  ['missing root binding', b => { b.root.bindings.pop(); }],
  ['duplicate root binding', b => { b.root.bindings.push(structuredClone(b.root.bindings[0])); }],
  ['mismatched root selection', b => { b.root.bindings[0].target = { kind: 'implementation', id: 'flow' }; }],
  ['wrong root result', b => { b.root.result = ref('port', 'Missing'); }],
  ['unknown root parameter type', b => { b.root.parameterGroups[0].inputs[0].type = { form: 'technical', name: 'DataSource' }; }],
  ['unused root input', b => { b.root.parameterGroups[0].inputs.push({ id: 'unused', name: 'unused', type: { form: 'primitive', name: 'string' } }); }],
  ['unused implementation', b => { b.implementations.push({ ...structuredClone(b.implementations[0]), id: 'unused', symbol: 'example.parcel.domain.OtherRule' }); }],
  ['unused bridge direct binding', b => { b.implementations[0].implements = ref('port', 'CapacityPolicy'); b.root.bindings[0].target = { kind: 'implementation', id: 'capacity-rule' }; }],
];
for (const [name, edit] of negatives) test('reject ' + name, () => rejects(() => compile(edit)));

test('direct pure port implementation is selected without a bridge', () => {
  const c = compile(b => { b.bridges = []; b.implementations[0].implements = ref('port', 'CapacityPolicy'); b.root.bindings[0].target = { kind: 'implementation', id: 'capacity-rule' }; });
  assert.deepEqual(c.bridges, []); assert.equal(c.root.bindings[0].component, 'capacity-rule');
});

test('pure lowering rebuilds products and feeds only the existing target-model/v1 fields', () => {
  const f = moduleSeamsFixture(), original = structuredClone(f);
  const contract = deriveModuleSeamsContract(f.canonical);
  const binding = { id: 'contract', schemaVersion: 'truthsrc.module-seams-contract-binding/v1', value: { schemaVersion: 'truthsrc.module-seams-contract-binding/v1', contract } };
  const lowered = lowerModuleSeamsTarget(f.canonical, binding, f.composition, f.config.options);
  assert.equal(lowered.target.values.length, 8); assert.equal(lowered.target.ports.length, 3);
  assert.equal(lowered.generatedFiles.length, 7); assert.equal(lowered.handwritten.length, 3);
  assert.equal(lowered.target.components.find(c => c.id === 'capacity-rule').name, 'CapacityRule');
  assert.equal(lowered.target.components.find(c => c.id === 'root').name, 'ParcelModule');
  assert.deepEqual(f, original); assert.throws(() => { lowered.target.order.reverse(); }, TypeError);
});

for (const [name, edit] of [
  ['unknown options', o => { o.scalaBody = ''; }],
  ['unused name', o => { o.names.push({ ref: { component: 'missing' }, role: 'bridge', name: 'Missing' }); }],
  ['rename handwritten symbol', o => { o.names.push({ ref: { component: 'capacity-rule' }, role: 'pure-implementation', name: 'Renamed' }); }],
  ['unknown package context', o => { o.packages[0].context = 'other'; }],
  ['handwritten FQN package mismatch', o => { o.packages[0].package = 'another.parcel'; }],
  ['missing value file', o => { o.valueFiles.pop(); }],
  ['extra source root', o => { o.sourceRoots.push({ id: 'extra', module: 'kernel', path: 'extra' }); }],
  ['missing source root', o => { o.sourceRoots.pop(); }],
  ['source root module mismatch', o => { o.sourceRoots[0].module = 'ext'; }],
  ['unsafe source root', o => { o.sourceRoots[0].path = '../outside'; }],
]) test('lowering rejects ' + name, () => {
  const f = moduleSeamsFixture(), options = structuredClone(f.config.options); edit(options);
  rejects(() => lowerModuleSeamsTarget(f.canonical, { id: 'contract', schemaVersion: 'truthsrc.module-seams-contract-binding/v1', value: { schemaVersion: 'truthsrc.module-seams-contract-binding/v1', contract: deriveModuleSeamsContract(f.canonical) } }, f.composition, options));
});
