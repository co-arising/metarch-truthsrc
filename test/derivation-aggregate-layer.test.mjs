// Aggregate-layer family derivation and emission tests (emitter-unification
// plan F2/F4, rulings 2026-11-23 §18). The acceptance itself is
// `node emitter/parity.mjs` (golden parity + double-run determinism + 23-case
// battery); this suite pins the knowledge→contract derivation seam, fail-closed
// diagnostics, flip-manifest scoping, 57-span UTF-8 codeMappings preservation,
// and the emission wrapper's replacement guarantees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStrictJson } from '../lib/strict-json.mjs';
import { validateCodeMappings } from '../src/core/code-mappings.mjs';
import { deriveAggregateLayers } from '../lib/derivation/aggregate-layer.mjs';
import { AGGREGATE_LAYER_FLIP_CONTEXTS, isAggregateLayerFlipped, withFlippedAggregateLayers } from '../lib/derivation/aggregate-layer-emission.mjs';
import { renderAggregateLayerFiles, runNegatives } from '../emitter/families/aggregate-layer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = path.join(ROOT, 'test/reference/curated/aggregate-layer/v1');
const FIXTURE = path.join(ROOT, 'test/fixtures/aggregate-layer-v1');

const fixtureData = () => parseStrictJson(fs.readFileSync(path.join(FIXTURE, 'knowledge-products.json'), 'utf8'));
const contract = () => parseStrictJson(fs.readFileSync(path.join(FIXTURE, 'input.json'), 'utf8'));

const classicEntriesFor = data => {
  const packages = new Map(data.options.packages.map(p => [p.context, p.package.replaceAll('.', '/')]));
  const aggs = data.products['reference-layout'].declarations.filter(d => d.ref.kind === 'aggregate');
  const footprint = [
    { id: 'reference-layout', version: '1' },
    { id: 'domain-folds', version: '6' },
    { id: 'exact-value-types', version: '1' },
    { id: 'domain-dependencies', version: '6' },
  ];
  const entries = aggs.flatMap(d => {
    const pkgRoot = packages.get(d.ref.context);
    const id = d.ref.id;
    return [
      { path: 'app/' + pkgRoot + '/domain/' + id + 'Aggregate.scala', content: '// classic\n', kind: 'aggregate', deps: [], knowledgeIds: [], productFootprint: footprint, merge: null },
      { path: 'app/' + pkgRoot + '/application/aggregates/' + id + 'Aggregate.scala', content: '// classic\n', kind: 'aggregate-behavior', deps: [], knowledgeIds: [], productFootprint: footprint, merge: null },
      { path: 'app/' + pkgRoot + '/application/aggregates/' + id + 'AggregateFactory.scala', content: '// classic\n', kind: 'aggregate-factory', deps: [], knowledgeIds: [], productFootprint: footprint, merge: null },
      { path: 'app/' + pkgRoot + '/application/aggregates/behaviors/' + id + 'Behaviors.scala', content: '// classic\n', kind: 'aggregate-behavior', deps: [], knowledgeIds: [], productFootprint: footprint, merge: null },
    ];
  });
  return [...entries, {
    path: 'app/example/bankwealth/application/aggregates/CreditBalanceProtocol.scala',
    content: '// classic protocol, untouched\n',
    kind: 'application-protocol',
    deps: [],
    knowledgeIds: ['source:x#/y'],
    productFootprint: footprint,
    merge: null,
  }];
};

test('the derived aggregate-layer contract deep-equals the curated technical input', () => {
  const data = fixtureData();
  const derived = deriveAggregateLayers(data.products, data.options);
  assert.deepEqual(derived, contract());
  assert.equal(derived.aggregates.length, 3);
  const fundOrder = derived.aggregates.find(a => a.name === 'FundOrder');
  assert.equal(fundOrder.commands.length, 21);
  assert.equal(fundOrder.externalProducers.length, 11);
  assert.equal(derived.aggregates.find(a => a.name === 'CreditBalance').externalProducers.length, 0);
  assert.equal(derived.aggregates.find(a => a.name === 'SipPlan').commands.length, 18);
});

test('the wrapper renders manifest contexts through the family, byte-equal to the golden tree with 57 exact codeMappings', () => {
  const data = fixtureData();
  const context = { products: data.products, options: data.options };
  const classic = classicEntriesFor(data);
  const flipped = withFlippedAggregateLayers(() => classic, context);

  assert.equal(flipped.length, classic.length);
  assert.equal(flipped.filter(e => e.kind === 'application-protocol').length, 1);

  const replaced = flipped.filter(e => e.kind !== 'application-protocol');
  assert.equal(replaced.length, 12);

  let totalSpans = 0;
  for (const entry of replaced) {
    const golden = fs.readFileSync(path.join(GOLDEN, entry.path), 'utf8');
    assert.equal(entry.content, golden, entry.path);
    assert.equal(entry.merge, null);
    assert.deepEqual(entry.productFootprint, [
      { id: 'reference-layout', version: '1' },
      { id: 'domain-folds', version: '6' },
      { id: 'exact-value-types', version: '1' },
      { id: 'domain-dependencies', version: '6' },
    ]);
    if (entry.path.endsWith('Behaviors.scala')) {
      assert.doesNotThrow(() => validateCodeMappings(entry));
      const buf = Buffer.from(entry.content, 'utf8');
      for (const m of entry.codeMappings) {
        assert.equal(buf.subarray(m.span.start, m.span.end).toString('utf8'), m.span.text);
        assert.deepEqual(m.scope, m.span);
      }
      totalSpans += entry.codeMappings.length;
    } else {
      assert.equal(entry.codeMappings, undefined);
    }
  }
  assert.equal(totalSpans, 57);
  // Double-run determinism
  assert.deepEqual(withFlippedAggregateLayers(() => classic, context), flipped);
});

test('the wrapper passes through projects without any manifest aggregate declaration', () => {
  const empty = { 'reference-layout': { declarations: [] }, 'domain-dependencies': { externalProducers: [] } };
  const opts = { packages: [{ context: 'other', package: 'example.other' }] };
  const classic = [{ path: 'app/example/other/domain/OrderAggregate.scala', content: 'x', kind: 'aggregate', deps: [], knowledgeIds: [], productFootprint: [], merge: null }];
  assert.deepEqual(withFlippedAggregateLayers(() => classic, { products: empty, options: opts }), classic);
  assert.equal(isAggregateLayerFlipped('other'), false);
  assert.deepEqual(AGGREGATE_LAYER_FLIP_CONTEXTS, ['bankwealth']);
});

test('the wrapper refuses a classic plan that misses a flip file or carries an orphan aggregate-layer file', () => {
  const data = fixtureData();
  const context = { products: data.products, options: data.options };
  const classic = classicEntriesFor(data);
  const minusOne = classic.filter(e => e.path !== 'app/example/bankwealth/domain/CreditBalanceAggregate.scala');
  assert.throws(() => withFlippedAggregateLayers(() => minusOne, context),
    /the classic aggregate plan must carry exactly the aggregate-layer flip set: 11 of 12 classic files present/);
  const extra = [...classic, { ...classic[0], path: 'app/example/bankwealth/domain/InventedAggregate.scala' }];
  assert.throws(() => withFlippedAggregateLayers(() => extra, context),
    /classic aggregate plan carries an aggregate-layer file outside the derived contract: app\/example\/bankwealth\/domain\/InventedAggregate.scala/);
});

test('derivation fails closed on missing declarations and unbound contexts', () => {
  const data = fixtureData();
  assert.throws(() => deriveAggregateLayers({ ...data.products, 'reference-layout': { declarations: [] } }, data.options),
    /AL_DERIVATION: no aggregate declarations/);
  assert.throws(() => deriveAggregateLayers(data.products, { packages: [] }),
    /AL_DERIVATION: context bankwealth has no package binding/);
});

test('embedded negatives battery rejects every malformed input with AL_INPUT', () => {
  const result = runNegatives(contract());
  assert.equal(result.rejected, result.expected);
  assert.deepEqual(result.failures, []);
  assert.ok(result.expected >= 20);
  assert.equal(renderAggregateLayerFiles(contract()).length, 12);
});
