import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verificationOutcome, summarizeVerificationStages } from '../lib/verification/outcome.mjs';

const complete = () => ({ observationPassed: true, processPassed: true,
  requiredChecks: ['inputs', 'artifacts'], checks: { inputs: true, artifacts: true } });
const summary = () => ({ stageIds: ['inspect', 'compile', 'exercise'], requiredStages: ['inspect', 'compile'],
  stages: { inspect: { status: 'passed' }, compile: { status: 'passed' } }, checks: { inspect: true, compile: true } });

function malicious() {
  let calls = 0;
  const getter = Object.defineProperty({}, 'passed', { enumerable: true, get() { calls++; return true; } });
  const proxy = new Proxy({}, { getPrototypeOf() { calls++; throw new Error('proxy executed'); },
    ownKeys() { calls++; throw new Error('proxy executed'); } });
  return { values: [getter, proxy, Object.create({ inherited: true }), new Date(),
    Object.defineProperty({}, 'hidden', { value: true }), { [Symbol('field')]: true }, { function() {} }], calls: () => calls };
}

test('outcome only reports explicit boolean gates and ordered source checks', () => {
  const data = complete(), before = structuredClone(data);
  const result = verificationOutcome(data);
  assert.deepEqual(result, { passed: true, outputPassed: true, processPassed: true, sourceBound: true, unverified: [] });
  assert.deepEqual(data, before); assert.equal(Object.isFrozen(data), false);
  data.checks.inputs = false;
  assert.equal(result.passed, true);
  const failed = verificationOutcome({ ...complete(), requiredChecks: ['second', 'first', 'artifacts'], checks: { artifacts: true } });
  assert.deepEqual(failed, { passed: false, outputPassed: true, processPassed: true, sourceBound: false, unverified: ['second', 'first'] });
});

test('truthy values never substitute for literal true or missing checks', () => {
  for (const value of [false, null, 0, 1, 1.5, '', 'true', [], {}, { passed: true }]) {
    assert.equal(verificationOutcome({ ...complete(), observationPassed: value }).outputPassed, false);
    assert.equal(verificationOutcome({ ...complete(), processPassed: value }).processPassed, false);
    const result = verificationOutcome({ ...complete(), checks: { inputs: value, artifacts: true } });
    assert.equal(result.passed, false); assert.deepEqual(result.unverified, ['inputs']);
  }
  for (const key of ['observationPassed', 'processPassed']) {
    const data = complete(); delete data[key]; assert.equal(verificationOutcome(data).passed, false);
  }
  assert.deepEqual(verificationOutcome({ ...complete(), checks: {} }).unverified, ['inputs', 'artifacts']);
});

test('cancellation and errors fail completion without falsifying individual observations', () => {
  for (const extra of [{ cancelled: true }, { errors: ['failure'] }, { errors: [{ elapsed: 1.25, reason: 'failure' }] }])
    assert.deepEqual(verificationOutcome({ ...complete(), ...extra }),
      { passed: false, outputPassed: true, processPassed: true, sourceBound: true, unverified: [] });
  assert.equal(verificationOutcome({ ...complete(), cancelled: false, errors: [] }).passed, true);
  for (const cancelled of [null, 0, 1, 'cancelled', {}])
    assert.throws(() => verificationOutcome({ ...complete(), cancelled }), /boolean/);
});

test('requirements are explicit, nonempty, unique ordered names; policy typos fail', () => {
  for (const requiredChecks of [undefined, null, '', [], ['inputs', 'inputs'], [''], [' input'], ['input '],
    ['bad\nname'], ['bad\x85name'], ['bad\ud800'], [1], ['inputs', , 'artifacts']]) {
    const data = complete();
    if (requiredChecks === undefined) delete data.requiredChecks;
    else data.requiredChecks = requiredChecks;
    assert.throws(() => verificationOutcome(data));
  }
  for (const checks of [null, [], true]) assert.throws(() => verificationOutcome({ ...complete(), checks }));
  const noChecks = complete(); delete noChecks.checks; assert.throws(() => verificationOutcome(noChecks));
  for (const errors of [null, {}, 'failure']) assert.throws(() => verificationOutcome({ ...complete(), errors }));
  assert.throws(() => verificationOutcome({ ...complete(), retry: true }), /unknown/);
});

test('plain JSON metadata accepts decimals, null and names resembling object prototype keys', () => {
  const checks = JSON.parse('{"__proto__":true,"constructor":true,"toString":true,"metadata":{"seconds":1.25,"note":null}}');
  assert.equal(verificationOutcome({ ...complete(), requiredChecks: ['__proto__', 'constructor', 'toString'], checks }).passed, true);
  assert.deepEqual(verificationOutcome({ ...complete(), requiredChecks: ['__proto__', 'constructor', 'toString'], checks: {} }).unverified,
    ['__proto__', 'constructor', 'toString']);
  const data = Object.assign(Object.create(null), complete());
  data.checks = Object.assign(Object.create(null), data.checks);
  assert.equal(verificationOutcome(data).passed, true);
});

test('outcome validates descriptors recursively without executing getters or proxies', () => {
  const bad = malicious();
  for (const value of bad.values) {
    assert.throws(() => verificationOutcome(value));
    assert.throws(() => verificationOutcome({ ...complete(), checks: value }));
    assert.throws(() => verificationOutcome({ ...complete(), checks: { inputs: true, artifacts: true, metadata: value } }));
    assert.throws(() => verificationOutcome({ ...complete(), errors: [value] }));
  }
  let calls = 0;
  const getter = { ...complete(), get observationPassed() { calls++; return true; } };
  assert.throws(() => verificationOutcome(getter));
  assert.equal(calls, 0); assert.equal(bad.calls(), 0);
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => verificationOutcome({ ...complete(), errors: [cycle] }), /cyclic/);
  assert.throws(() => verificationOutcome({ ...complete(), checks: Object.create({ inputs: true, artifacts: true }) }));
});

test('stage summaries preserve order and report partial scope without whole-system claims', () => {
  const data = summary(), before = structuredClone(data);
  const result = summarizeVerificationStages(data);
  assert.deepEqual(result, { requestedScopePassed: true, stages: [
    { id: 'inspect', status: 'passed', rechecked: true },
    { id: 'compile', status: 'passed', rechecked: true },
    { id: 'exercise', status: 'skipped', rechecked: false },
  ] });
  assert.deepEqual(data, before); assert.equal(Object.isFrozen(data), false);
  assert.deepEqual(Object.keys(result), ['requestedScopePassed', 'stages']);
  data.stages.compile.status = 'failed';
  assert.equal(result.stages[1].status, 'passed');
});

test('only explicit required stages count; no inferred predecessors or retries', () => {
  const data = summary();
  data.requiredStages = ['exercise'];
  data.stages = { inspect: { status: 'failed' }, exercise: { status: 'passed', attempt: 1.25 } };
  data.checks = { exercise: true };
  const result = summarizeVerificationStages(data);
  assert.equal(result.requestedScopePassed, true);
  assert.deepEqual(result.stages, [
    { id: 'inspect', status: 'failed', rechecked: false },
    { id: 'compile', status: 'skipped', rechecked: false },
    { id: 'exercise', status: 'passed', rechecked: true },
  ]);
  data.requiredStages.push('inspect');
  assert.equal(summarizeVerificationStages(data).requestedScopePassed, false);
});

test('stage presence/status and literal recheck are each necessary, diagnostics fail scope', () => {
  for (const status of ['failed', 'skipped', 'running', 'custom status', 'true']) {
    const data = summary(); data.stages.compile.status = status;
    assert.equal(summarizeVerificationStages(data).requestedScopePassed, false);
    assert.equal(summarizeVerificationStages(data).stages[1].status, status);
  }
  for (const rechecked of [false, null, 1, 'true', [], {}, { passed: true }]) {
    const data = summary(); data.checks.compile = rechecked;
    const result = summarizeVerificationStages(data);
    assert.equal(result.requestedScopePassed, false); assert.equal(result.stages[1].rechecked, false);
  }
  const absent = summary(); delete absent.stages.compile;
  assert.equal(summarizeVerificationStages(absent).requestedScopePassed, false);
  assert.deepEqual(summarizeVerificationStages(absent).stages[1], { id: 'compile', status: 'skipped', rechecked: true });
  const unchecked = summary(); delete unchecked.checks.compile;
  assert.equal(summarizeVerificationStages(unchecked).requestedScopePassed, false);
  assert.equal(summarizeVerificationStages({ ...summary(), diagnostics: [{ cost: 1.25 }] }).requestedScopePassed, false);
});

test('stage metadata is inert JSON and statuses must be explicit on present rows', () => {
  const data = summary();
  data.stages.compile = { status: 'passed', elapsed: 1.25, command: ['never', 'execute'], args: null };
  data.checks.metadata = { count: 2.5 };
  assert.equal(summarizeVerificationStages(data).requestedScopePassed, true);
  for (const row of [{}, { status: null }, { status: true }, { status: '' }, { status: ' passed' }, { status: 'bad\x85' }, []]) {
    data.stages.compile = row;
    assert.throws(() => summarizeVerificationStages(data));
  }
});

test('stage options reject missing/duplicate names, undeclared stages and malformed collections', () => {
  for (const key of ['stageIds', 'requiredStages']) for (const list of [[], null, 'inspect', ['inspect', 'inspect'], [''], ['bad\ud800']])
    assert.throws(() => summarizeVerificationStages({ ...summary(), [key]: list }));
  assert.throws(() => summarizeVerificationStages({ ...summary(), requiredStages: ['unknown'] }), /not declared/);
  assert.throws(() => summarizeVerificationStages({ ...summary(), stages: { unknown: { status: 'passed' } } }), /undeclared/);
  for (const key of ['stageIds', 'requiredStages', 'stages', 'checks']) {
    const data = summary(); delete data[key]; assert.throws(() => summarizeVerificationStages(data));
  }
  for (const key of ['stages', 'checks']) for (const value of [null, [], true])
    assert.throws(() => summarizeVerificationStages({ ...summary(), [key]: value }));
  assert.throws(() => summarizeVerificationStages({ ...summary(), diagnostics: 'failure' }));
  assert.throws(() => summarizeVerificationStages({ ...summary(), retryStages: [] }), /unknown/);
});

test('stage data rejects getters/proxies and inherited passing states without executing them', () => {
  const bad = malicious();
  for (const value of bad.values) {
    assert.throws(() => summarizeVerificationStages(value));
    assert.throws(() => summarizeVerificationStages({ ...summary(), stages: value }));
    assert.throws(() => summarizeVerificationStages({ ...summary(), stages: { inspect: { status: 'passed' }, compile: value } }));
    assert.throws(() => summarizeVerificationStages({ ...summary(), checks: { inspect: true, compile: true, metadata: value } }));
    assert.throws(() => summarizeVerificationStages({ ...summary(), diagnostics: [value] }));
  }
  assert.equal(bad.calls(), 0);
  assert.throws(() => summarizeVerificationStages({ ...summary(), stages: Object.create(summary().stages) }));
  assert.throws(() => summarizeVerificationStages({ ...summary(), checks: Object.create(summary().checks) }));
  const data = { stageIds: ['constructor', '__proto__'], requiredStages: ['constructor'], stages: {}, checks: {} };
  assert.equal(summarizeVerificationStages(data).requestedScopePassed, false);
  data.stages = JSON.parse('{"constructor":{"status":"passed"},"__proto__":{"status":"passed"}}');
  data.checks = JSON.parse('{"constructor":true,"__proto__":true}');
  assert.equal(summarizeVerificationStages(data).requestedScopePassed, true);
  assert.deepEqual(summarizeVerificationStages(data).stages.map(row => row.rechecked), [true, true]);
});
