// Derivation-layer acceptance (emitter-unification plan F2, family #45): the
// knowledge products of the flipped rules cluster (bank aggregates
// CreditBalance / FundOrder / SipPlan) must derive, fail-closed and exactly,
// the curated aggregate-invariant-rules contract — and through the fail-closed
// family envelope, the nine curated golden bytes (the classic production bytes
// pinned as the reproduction receipt, ruling 2026-11-23). The knowledge fixture
// is the product-payload slice the derivation reads (the three aggregate
// declarations, the 46 command decision rows with their guard predicate ASTs,
// the state-field/parameter/member declarations the predicate resolution
// touches, and the two exact-value descriptors); extending the derivation's
// reads past this slice fails here with 'target reference has no admitted
// declaration' instead of silently passing against stale knowledge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveInvariantRules, isRulesFlipped, RULES_FLIP_AGGREGATES } from '../lib/derivation/aggregate-invariant-rules.mjs';
import { withFlippedInvariantRules } from '../lib/derivation/aggregate-invariant-rules-emission.mjs';
import { family, renderInvariantRuleFiles } from '../emitter/families/aggregate-invariant-rules.mjs';
import { getFamily, renderFamily } from '../emitter/registry.mjs';
import '../emitter/families/index.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'test/fixtures/aggregate-invariant-rules-v1');
const fixture = () => parseStrictJson(fs.readFileSync(path.join(FIXTURE, 'knowledge-products.json'), 'utf8'));
const curated = () => parseStrictJson(fs.readFileSync(path.join(ROOT, 'test/reference/curated/aggregate-invariant-rules/v1/technical-input.json'), 'utf8'));
const GOLDEN = path.join(ROOT, 'test/reference/curated/aggregate-invariant-rules/v1');

test('the flipped rules cluster derives exactly the curated contract', () => {
  const f = fixture();
  assert.deepEqual(deriveInvariantRules(f.products, f.options), curated());
});

test('the derived contract renders the curated golden bytes through the family envelope', () => {
  const f = fixture();
  const contract = deriveInvariantRules(f.products, f.options);
  const outputs = renderFamily(getFamily('aggregate-invariant-rules'), contract);
  assert.equal(Object.keys(outputs).length, 9);
  for (const [relative, content] of Object.entries(outputs)) {
    assert.equal(content, fs.readFileSync(path.join(GOLDEN, relative), 'utf8'), relative);
  }
});

test('every code mapping lands on the anchor-verified classic byte span', () => {
  const receipt = parseStrictJson(fs.readFileSync(path.join(FIXTURE, 'anchor-span-receipt.json'), 'utf8')).spans;
  const landed = renderInvariantRuleFiles(curated()).flatMap(file =>
    file.codeMappings.map(m => ({
      knowledgeKey: m.knowledgeKey, file: file.path,
      span: { start: m.span.start, end: m.span.end, text: m.span.text },
    })));
  const byIdentity = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
  assert.equal(landed.length, receipt.length);
  assert.deepEqual([...landed].sort(byIdentity), [...receipt].sort(byIdentity));
});

test('derivation is fail-closed on broken payload shapes', () => {
  const f = fixture();
  const halfCluster = fixture();
  halfCluster.products['reference-layout'].declarations =
    halfCluster.products['reference-layout'].declarations.filter(d => !(d.ref.kind === 'aggregate' && d.ref.id === 'FundOrder'));
  assert.throws(() => deriveInvariantRules(halfCluster.products, halfCluster.options), /exactly one aggregate declaration FundOrder/);
  const dropped = fixture();
  dropped.products['reference-layout'].declarations =
    dropped.products['reference-layout'].declarations.filter(d => !(d.ref.kind === 'parameter' && d.ref.id === 'resource'));
  assert.throws(() => deriveInvariantRules(dropped.products, dropped.options), /target reference has no admitted declaration/);
  const unsupported = fixture();
  unsupported.products['domain-decision'].commands[0].decisions[0].predicate =
    { op: 'multiply', left: { op: 'integer', value: '2' }, right: { op: 'integer', value: '3' } };
  assert.throws(() => deriveInvariantRules(unsupported.products, unsupported.options), /unsupported admitted binary target operation/);
  const outcome = fixture();
  outcome.products['domain-decision'].commands[0].decisions[0].onFalse = { kind: 'retry' };
  assert.throws(() => deriveInvariantRules(outcome.products, outcome.options), /unsupported guard outcome kind: retry/);
  const sourceless = fixture();
  sourceless.products['domain-decision'].commands[0].source = { pointer: '/aggregates/0/commands/0' };
  assert.throws(() => deriveInvariantRules(sourceless.products, sourceless.options), /must carry a \{document, pointer\} knowledge source/);
});

test('the rules flip manifest is the cluster emission unit and its predicate is context-scoped', () => {
  assert.deepEqual([...RULES_FLIP_AGGREGATES], [
    { context: 'bankwealth', aggregate: 'CreditBalance' },
    { context: 'bankwealth', aggregate: 'FundOrder' },
    { context: 'bankwealth', aggregate: 'SipPlan' },
  ]);
  for (const { context, aggregate } of RULES_FLIP_AGGREGATES) assert.equal(isRulesFlipped(context, aggregate), true);
  assert.equal(isRulesFlipped('bankwealth', 'StockReservation'), false);
  assert.equal(isRulesFlipped('bank-v1', 'CreditBalance'), false);
});

test('the embedded negatives battery rejects malformed contracts', () => {
  const result = family.runNegatives(curated());
  assert.equal(result.rejected, result.expected);
  assert.deepEqual(result.failures, []);
});

test('the emission wrapper appends the family trio, refuses classic survivors and partial clusters', () => {
  const f = fixture();
  const context = { products: f.products, options: f.options };
  const eventHandlerEntry = { path: 'app/example/bankwealth/domain/entities/behaviors/CreditBalanceEventHandler.scala', kind: 'event-handler' };
  const wrapped = withFlippedInvariantRules(() => [eventHandlerEntry], context);
  assert.equal(wrapped.length, 10);
  assert.equal(wrapped[0], eventHandlerEntry);
  const golden = relative => fs.readFileSync(path.join(GOLDEN, relative), 'utf8');
  for (const added of wrapped.slice(1)) {
    assert.equal(added.kind, 'rules');
    assert.equal(added.content, golden(added.path), added.path);
    assert.deepEqual(added.productFootprint, [
      { id: 'reference-layout', version: '1' }, { id: 'domain-decision', version: '4' },
      { id: 'domain-folds', version: '6' }, { id: 'exact-value-types', version: '1' },
    ]);
  }
  assert.throws(() => withFlippedInvariantRules(() => [eventHandlerEntry,
    { path: 'app/example/bankwealth/domain/invariant/CreditBalanceRules.scala', kind: 'rules' }], context),
  /classic rules files for flipped aggregates must not be produced/);
  const halfCluster = fixture();
  halfCluster.products['reference-layout'].declarations =
    halfCluster.products['reference-layout'].declarations.filter(d => d.ref.kind !== 'aggregate' || d.ref.id === 'CreditBalance');
  assert.throws(() => withFlippedInvariantRules(() => [eventHandlerEntry], { products: halfCluster.products, options: f.options }),
    /the rules cluster flips as one unit: 1 of 3/);
  const unflipped = { products: { 'reference-layout': { declarations: [] } }, options: f.options };
  assert.equal(withFlippedInvariantRules(() => eventHandlerEntry, unflipped), eventHandlerEntry);
});
