import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveModuleSeamsContract, compileModuleSeamsContract } from '../lib/products/module-seams-contract.mjs';
import { ProductError, resolve } from '../lib/products/request.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { resolveSourcePointer } from '../lib/source-index.mjs';
import { moduleSeamsFixture, compileFixture, projectRoot, nominal, ref } from './module-seams-fixture.mjs';

const rejects = (fn, code) => assert.throws(fn, e => e instanceof ProductError && (!code || e.diagnostic.code === code));
const mutate = edit => { const c = structuredClone(moduleSeamsFixture().canonical); edit(c.value); return c; };
const row = c => c.moduleSeamsContracts[0];
const vo = (c, name) => c.valueObjects.find(v => v.name === name);

test('real author tree validates and roundtrips; derived contract is immutable and complete', () => {
  const f = moduleSeamsFixture(), path = projectRoot + f.config.tree;
  assert.deepEqual(validateTree(path).hard, []);
  assert.equal(roundtrip(path).ok, true);
  const c = deriveModuleSeamsContract(f.canonical);
  assert.deepEqual([c.id, c.version, c.context], ['parcel-seams', '1', 'parcel']);
  assert.equal(c.values.length, 8); assert.equal(c.ports.length, 3);
  assert.equal(c.values.find(v => v.name === 'QuoteError').variants.length, 7);
  assert.equal(Object.hasOwn(row(f.canonical.value), 'values'), false);
  assert.deepEqual(compileModuleSeamsContract({ id: 'contract', schemaVersion: 'truthsrc.module-seams-contract-binding/v1', value: { schemaVersion: 'truthsrc.module-seams-contract-binding/v1', contract: c } }, f.canonical), c);
  assert.throws(() => { c.ports[0].name = 'Mutated'; }, TypeError);
  for (const source of [c.source, ...c.values.flatMap(v => [v.source, ...v.fields.map(x => x.source), ...v.variants.flatMap(x => [x.source, ...x.fields.map(y => y.source)])]), ...c.ports.flatMap(p => [p.source, ...p.methods.flatMap(m => [m.source, m.result.source, ...m.parameters.map(x => x.source)])])]) {
    assert.notEqual(resolve(f.canonical.value, source.pointer, source), undefined);
    const matches = resolveSourcePointer(f.tree.sourceIndex, source.pointer);
    assert.equal(matches.length, 1); assert.ok(matches[0].file.startsWith('contexts/parcel/'));
    assert.ok(matches[0].atomPointer.startsWith('/payload'));
  }
});

test('real project derives and compiles both static products without a producer placeholder', () => {
  const f = compileFixture(); assert.deepEqual(f.compilation.diagnostics, []);
  assert.deepEqual(f.compilation.result.products.map(p => p.id), ['module-seams-composition', 'module-seams-contract']);
  assert.equal(f.compilation.result.readiness.runnable, false);
});

const negatives = [
  ['unknown payload field', c => { row(c).values = []; }],
  ['unsupported schema', c => { row(c).schemaVersion = 'truthsrc.module-seams-contract/v2'; }],
  ['unsupported signature value version', c => { vo(c, 'QuoteError').schemaVersion = 'truthsrc.signature-value/v2'; }],
  ['multiple contracts', c => { c.moduleSeamsContracts.push({ ...row(c), id: 'other' }); }],
  ['cross-context contract', c => { row(c).context = 'other'; }],
  ['cross-context nominal', c => { row(c).ports[0].methods[0].parameters[0].valueType.ref.context = 'other'; }],
  ['duplicate nominal across old types/VO', c => { c.types = [structuredClone(vo(c, 'Route'))]; }],
  ['duplicate value', c => { c.valueObjects.push(structuredClone(vo(c, 'Route'))); }],
  ['duplicate old technical port', c => { c.ports = [{ name: 'CapacityPolicy', context: 'parcel' }]; }],
  ['duplicate old domain-service port', c => { c.domainServices = [{ name: 'CapacityPolicy', context: 'parcel' }]; }],
  ['duplicate port', c => { row(c).ports.push(structuredClone(row(c).ports[0])); }],
  ['duplicate method id', c => { row(c).ports[0].methods.push(structuredClone(row(c).ports[0].methods[0])); }],
  ['overloaded method name', c => { const m = structuredClone(row(c).ports[0].methods[0]); m.id = 'other'; row(c).ports[0].methods.push(m); }],
  ['duplicate parameter', c => { row(c).ports[0].methods[0].parameters.push(structuredClone(row(c).ports[0].methods[0].parameters[0])); }],
  ['duplicate variant', c => { vo(c, 'QuoteError').variants.push(structuredClone(vo(c, 'QuoteError').variants[0])); }],
  ['duplicate field', c => { vo(c, 'Route').fields.push(structuredClone(vo(c, 'Route').fields[0])); }],
  ['sum with record fields', c => { vo(c, 'QuoteError').fields = []; }],
  ['empty sum', c => { vo(c, 'QuoteError').variants = []; }],
  ['dangling nominal', c => { row(c).ports[0].methods[0].parameters[0].valueType = nominal('Missing'); }],
  ['Decimal', c => { vo(c, 'Load').fields[0].dataType = 'Decimal'; }],
  ['Int alias is not Long', c => { vo(c, 'Load').fields[0].dataType = 'Int'; }],
  ['List alias is not Vector', c => { vo(c, 'QuoteRequest').fields[1].dataType = 'List[Parcel]'; }],
  ['arbitrary Scala', c => { vo(c, 'Load').fields[0].dataType = 'scala.math.BigDecimal'; }],
  ['bad Either arity', c => { vo(c, 'Load').fields[0].dataType = 'Either[String]'; }],
  ['bad Map arity', c => { vo(c, 'Load').fields[0].dataType = 'Map[String,Long,Boolean]'; }],
  ['unknown type AST field', c => { row(c).ports[0].methods[0].parameters[0].valueType.extra = true; }],
  ['unsupported primitive AST', c => { row(c).ports[0].methods[0].parameters[0].valueType = { form: 'primitive', name: 'decimal' }; }],
  ['empty ports', c => { row(c).ports = []; }],
  ['empty methods', c => { row(c).ports[0].methods = []; }],
  ['default parameter', c => { row(c).ports[0].methods[0].parameters[0].default = 'Route()'; }],
  ['implicit business parameter', c => { row(c).ports[0].methods[0].parameters[0].implicit = true; }],
  ['future pure policy', c => { row(c).ports[0].methods[0].result.effect = 'future'; }],
  ['unsupported effect', c => { row(c).ports[1].methods[0].result.effect = 'io'; }],
  ['recursive record', c => { vo(c, 'Route').fields[0].dataType = 'Option[Route]'; }],
  ['mutual recursion', c => { vo(c, 'Route').fields[0].dataType = 'Parcel'; vo(c, 'Parcel').fields[0].dataType = 'Route'; }],
  ['type nesting limit', c => { vo(c, 'Load').fields[0].dataType = 'Option['.repeat(66) + 'Long' + ']'.repeat(66); }],
];
for (const [name, edit] of negatives) test('reject ' + name, () => rejects(() => deriveModuleSeamsContract(mutate(edit))));

test('complete contract binding reconciliation rejects source, order and signature drift', () => {
  const f = moduleSeamsFixture(), c = deriveModuleSeamsContract(f.canonical);
  for (const edit of [x => { x.source.pointer = '/valueObjects/0'; }, x => x.values.reverse(), x => { x.ports[0].methods[0].result.effect = 'future'; }, x => { x.extra = true; }]) {
    const candidate = structuredClone(c); edit(candidate);
    rejects(() => compileModuleSeamsContract({ id: 'contract', schemaVersion: 'truthsrc.module-seams-contract-binding/v1', value: { schemaVersion: 'truthsrc.module-seams-contract-binding/v1', contract: candidate } }, f.canonical), 'MODULE_SEAMS_CONTRACT_DRIFT');
  }
});

test('old reference-layout does not silently reinterpret the new sum/Either', () => {
  const f = moduleSeamsFixture();
  rejects(() => deriveProjectRequest(f.tree.canonical, { ...f.config, products: [{ id: 'reference-layout', version: '1' }], roles: {}, documents: [] }, []));
});
