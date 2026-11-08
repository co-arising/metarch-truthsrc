import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createAggregateCoreVariant } from './aggregate-core-variants.mjs';
import { domainKernelFixture } from './domain-kernel-fixture.mjs';
import { parseAuthorDoc } from '../lib/author-parse.mjs';
import { emitAuthorDoc } from '../lib/author-surface.mjs';
import { slug } from '../lib/shared.mjs';
import { validateTree } from '../lib/validate.mjs';
import { compileTree } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';

const guard = (cond, errCode, onFail = 'reject') => ({ kind: 'invariantRef', ref: errCode, errCode, cond, onFail });
const input = (name, type) => `${name}: ${JSON.stringify(type)} @BUSINESS_INPUT`;
const tenth = '0.10000000000000000000000000000000000000';

// These are physical author probes, not cloned canonicals or fabricated products.
// Only syntax already admitted by decision@4/dependencies@6 is used.
export const aggregateCorePredicateCases = Object.freeze([
  { name: 'CheckBoolean', parameters: ['first: Boolean', 'second: Boolean', 'third: Boolean'], guards: [
    guard('(param.first == param.second) == param.third', 'BOOLEAN_LEFT'),
    guard('param.first == (param.second == param.third)', 'BOOLEAN_RIGHT'),
    guard('param.first || (param.second && param.third)', 'BOOLEAN_PRECEDENCE'),
  ] },
  { name: 'CheckComparison', parameters: ['count: Long', 'expected: Boolean'], guards: [
    guard('param.expected == (param.count < state.maximum)', 'COMPARISON_RIGHT'),
    guard('(param.count < state.maximum) == param.expected', 'COMPARISON_LEFT'),
  ] },
  { name: 'CheckLong', parameters: ['count: Long'], guards: [
    guard('param.count + state.left >= param.count - state.right', 'LONG_MATH'),
    guard('param.count >= -9223372036854775808 && param.count <= 9223372036854775807', 'LONG_RANGE'),
  ] },
  { name: 'CheckScalar', parameters: ['delta: Ratio'], guards: [
    guard(`param.delta + ${tenth} >= state.ratioTotal - ${tenth}`, 'SCALAR_MATH'),
  ] },
  { name: 'CheckUnit', parameters: ['distance: Distance'], guards: [
    guard('param.distance + state.distanceTotal >= param.distance - state.distanceTotal', 'UNIT_MATH'),
  ] },
  { name: 'CheckAmount', parameters: ['distance: Distance'], guards: [
    guard('param.distance.amount + 1 >= state.distanceTotal.amount - 1', 'AMOUNT_MATH'),
  ] },
  { name: 'CheckAmountEquality', parameters: ['distance: Distance'], guards: [
    guard('param.distance.amount == state.distanceTotal.amount', 'AMOUNT_EQUAL'),
  ] },
  { name: 'CheckStructural', parameters: ['distance: Distance', 'delta: Ratio'], guards: [
    guard('param.distance == state.distanceTotal', 'STRUCTURAL_DISTANCE'),
    guard('param.delta == state.ratioTotal', 'STRUCTURAL_RATIO'),
  ] },
  { name: 'CheckMap', parameters: ['reading: Reading', 'delta: Ratio'], guards: [
    guard('!param.reading.ratios.contains(param.id) || param.reading.ratios(param.id) >= param.delta', 'MAP_LOOKUP'),
    guard('param.reading.ratios.get(param.id).isEmpty || param.reading.ratios.get(param.id).contains(param.delta)', 'MAP_OPTION'),
  ] },
  { name: 'CheckNestedOptional', parameters: ['expected: Option[String]'], guards: [
    guard('state.optionalMap.get(param.id).contains(param.expected)', 'NESTED_OPTION'),
  ] },
  { name: 'CheckText', parameters: ['text: WireRatio'], guards: [
    guard('param.text.value.nonEmpty && param.text.value.contains("x")', 'TEXT'),
  ] },
  { name: 'CheckAllEqual', parameters: [], guards: [
    guard('state.guardKeys.keys.forall(_ == param.id)', 'ALL_EQUAL'),
    guard('false', 'ALL_EQUAL_EMPTY_RESULT', 'succeed-empty'),
  ] },
  { name: 'CheckCovered', parameters: ['batch: Vector[String]'], guards: [
    { ruleId: 'COVERED', errCode: 'COVERED', onFail: 'reject', when: { form: 'collection-covered', map: 'guardKeys', collection: 'param.batch' } },
  ] },
  { name: 'CheckPositive', parameters: ['delta: Ratio', 'distance: Distance'], guards: [
    { ruleId: 'POSITIVE_SCALAR', errCode: 'POSITIVE_SCALAR', onFail: 'reject', when: { form: 'money-positive', amount: 'param.delta' } },
    { ruleId: 'POSITIVE_UNIT', errCode: 'POSITIVE_UNIT', onFail: 'reject', when: { form: 'money-positive', amount: 'param.distance' } },
  ] },
  { name: 'CheckSufficient', parameters: ['distance: Distance'], guards: [
    { ruleId: 'SUFFICIENT_UNIT', errCode: 'SUFFICIENT_UNIT', onFail: 'reject', when: { form: 'money-sufficient', amount: 'param.distance', in: 'balances' } },
  ] },
  { name: 'CheckScalarSufficient', parameters: ['delta: Ratio'], guards: [
    { ruleId: 'SUFFICIENT_SCALAR', errCode: 'SUFFICIENT_SCALAR', onFail: 'reject', when: { form: 'money-sufficient', amount: 'param.delta', in: 'ratioTotal' } },
  ] },
]);

export function createAggregateCorePredicateVariant(destination) {
  const variant = createAggregateCoreVariant(destination);
  const config = JSON.parse(readFileSync(variant.project, 'utf8'));
  // Deliberately admitted package root `params` exercises shadowing by generated
  // Rules' Params local. Actual nominal/member bindings also remain independent.
  config.options.packages[0].package = 'params.counter';
  config.options.names = [
    { ref: { context: 'counter', kind: 'type', owner: [], id: 'WireRatio' }, role: 'value', name: 'Text' },
    { ref: { context: 'counter', kind: 'member', owner: ['Distance'], id: 'amount' }, role: 'member', name: 'measure' },
    { ref: { context: 'counter', kind: 'member', owner: ['Distance'], id: 'unit' }, role: 'member', name: 'unitCode' },
    { ref: { context: 'counter', kind: 'member', owner: ['Reading'], id: 'ratios' }, role: 'member', name: 'index' },
    { ref: { context: 'counter', kind: 'state-field', owner: ['Counter'], id: 'left' }, role: 'state-field', name: 'firstCount' },
  ];
  writeFileSync(variant.project, JSON.stringify(config, null, 2) + '\n');
  const aggregate = parseAuthorDoc(readFileSync(variant.aggregatePath, 'utf8'), variant.aggregatePath);
  aggregate.payload.stateFields.push(
    { name: 'guardKeys', dataType: 'Map[String, String]', default: [] },
    { name: 'balances', dataType: 'Map[String, Distance]', default: [] },
    { name: 'optionalMap', dataType: 'Map[String, Option[String]]', default: [
      { key: 'none', value: { present: false, value: null } },
      { key: 'some', value: { present: true, value: 'x' } },
    ] },
  );
  aggregate.order.commands.push(...aggregateCorePredicateCases.map(c => c.name));
  writeFileSync(variant.aggregatePath, emitAuthorDoc(aggregate));
  const original = parseAuthorDoc(readFileSync(variant.slicePath, 'utf8'), variant.slicePath);
  original.payload.guards = [
    guard('param.id != "empty"', 'EARLY_EMPTY', 'succeed-empty'),
    ...original.payload.guards,
    guard('param.count + state.left >= param.count - state.right', 'EARLY_LONG'),
  ];
  original.events.CountSet.payloads.push('literalRatio: Ratio @PROPAGATED');
  original.events.CountSet.bindings.push({ slot: 'literalRatio', expr: 'literal:0.12500000000000000000000000000000000000' });
  writeFileSync(variant.slicePath, emitAuthorDoc(original));
  const slicePaths = [];
  for (const c of aggregateCorePredicateCases) {
    const slice = { kind: 'slice', aggregate: 'Counter', command: c.name, payload: {
      name: c.name, parameters: [input('id', 'String'), ...c.parameters.map(p => { const i = p.indexOf(':'); return input(p.slice(0, i), p.slice(i + 1).trim()); })],
      guards: structuredClone(c.guards), produces: ['CountRecorded'],
    }, events: {} };
    const file = join(dirname(variant.slicePath), slug(c.name) + '.slice.yaml');
    assert.equal(existsSync(file), false);
    writeFileSync(file, emitAuthorDoc(slice));
    slicePaths.push(file);
  }
  // decision@4 requires the nominal Text definition's explicit current context.
  const textPath = join(variant.tree, 'contexts/counter/value-objects/wire-ratio.vo.yaml');
  const text = parseAuthorDoc(readFileSync(textPath, 'utf8'), textPath);
  text.payload.context = 'counter';
  writeFileSync(textPath, emitAuthorDoc(text));
  return { ...variant, slicePaths, textPath: resolve(textPath) };
}

function authorFiles(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(e => {
    const path = join(prefix, e.name);
    return e.isDirectory() ? authorFiles(root, path) : e.name.endsWith('.yaml') ? [path] : [];
  }).sort();
}

// Same compile/decompose/compile + author bytes checks as lib/roundtrip.mjs,
// but retain the explicit new destination: this handoff prohibits cleanup.
export function admitAggregateCorePredicateVariant(variant, roundtripDestination) {
  assert.equal(existsSync(roundtripDestination), false, 'roundtrip destination must be absent');
  const validation = validateTree(variant.tree);
  assert.deepEqual(validation.hard, []);
  const canonicalA = compileTree(variant.tree);
  decomposeCanonical(canonicalA, roundtripDestination);
  assert.equal(compileTree(roundtripDestination), canonicalA);
  const paths = authorFiles(variant.tree);
  assert.deepEqual(authorFiles(roundtripDestination), paths);
  for (const path of paths) assert.deepEqual(readFileSync(join(roundtripDestination, path)), readFileSync(join(variant.tree, path)), path);
  const roundtrip = { ok: true, atoms: paths.length, destination: roundtripDestination, retained: true };
  const fixture = domainKernelFixture(variant.project);
  assert.deepEqual(fixture.compilation.diagnostics, []);
  return { validation, roundtrip, fixture };
}
