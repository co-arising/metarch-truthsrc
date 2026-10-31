import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as decisionApi from '../lib/domain-products/decision.mjs';
import * as dependencyApi from '../lib/domain-products/dependencies.mjs';
import * as foldApi from '../lib/domain-products/folds.mjs';

const fixture = name => JSON.parse(readFileSync(new URL('./fixtures/inventory-mixed-effect-products/' + name + '.json', import.meta.url)));
const canonical = { id: 'domain', schemaVersion: 'truthsrc/v1', value: fixture('domain') };
const layout = fixture('references').layout;
const exact = fixture('types').types;
const document = name => { const value = fixture(name); return { id: name, schemaVersion: value.schemaVersion, value }; };
const unchanged = action => {
  const before = JSON.stringify({ canonical, layout, exact });
  const result = action();
  assert.equal(JSON.stringify({ canonical, layout, exact }), before);
  return result;
};
const mismatch = action => assert.throws(action, error => error.diagnostic?.code === 'PRODUCT_PAYLOAD_MISMATCH');

test('public source derivation exposes complete ordered decisions without accepting asserted bindings', () => {
  assert.equal(typeof decisionApi.deriveDecisions, 'function');
  const value = unchanged(() => decisionApi.deriveDecisions(canonical, layout, { types: exact }, '3'));
  const binding = document('decisions');
  assert.deepEqual(value, binding.value.decisions);
  assert.deepEqual(decisionApi.compileDecisions(binding, canonical, layout, { types: exact }, '3'), value);
  const bad = structuredClone(binding);
  bad.value.decisions.commands.pop();
  mismatch(() => decisionApi.compileDecisions(bad, canonical, layout, { types: exact }, '3'));
  const source = structuredClone(canonical);
  source.value.aggregates[0].commands[0].guards = [{ kind: 'unknown-rule' }];
  assert.throws(() => decisionApi.deriveDecisions(source, layout, { types: exact }, '3'), error => !!error.diagnostic);
});

test('public source derivation retains full dependencies and fail-closed comparison', () => {
  assert.equal(typeof dependencyApi.deriveDependencies, 'function');
  const binding = document('dependencies');
  const value = unchanged(() => dependencyApi.deriveDependencies(canonical, layout, fixture('decisions').decisions, exact,
    fixture('external').externalEvents, binding.schemaVersion));
  assert.deepEqual(value, binding.value.dependencies);
  assert.deepEqual(dependencyApi.compileDependencies(binding, canonical, layout, fixture('decisions').decisions, exact, fixture('external').externalEvents), value);
  const bad = structuredClone(binding);
  bad.value.dependencies.commands.pop();
  mismatch(() => dependencyApi.compileDependencies(bad, canonical, layout, fixture('decisions').decisions, exact, fixture('external').externalEvents));
});

test('public source derivation retains complete defaults and pre-event folds with strict comparison', () => {
  assert.equal(typeof foldApi.deriveFolds, 'function');
  const binding = document('folds');
  const value = unchanged(() => foldApi.deriveFolds(canonical, layout, fixture('dependencies').dependencies, exact, binding.schemaVersion));
  assert.deepEqual(value, binding.value.folds);
  assert.deepEqual(foldApi.compileFolds(binding, canonical, layout, fixture('dependencies').dependencies, exact), value);
  const bad = structuredClone(binding);
  bad.value.folds.defaults.pop();
  mismatch(() => foldApi.compileFolds(bad, canonical, layout, fixture('dependencies').dependencies, exact));
});
