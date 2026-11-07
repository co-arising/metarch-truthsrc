import assert from 'node:assert/strict';
import { copyImmutableData } from '../immutable-data.mjs';

const own = (object, key) => Object.hasOwn(object, key);
const field = (object, key, fallback) => own(object, key) ? object[key] : fallback;
const passed = (checks, key) => own(checks, key) && checks[key] === true;

function object(value, label) {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  return value;
}

function input(value, allowed) {
  const data = object(copyImmutableData(value), 'options');
  assert.ok(Object.keys(data).every(key => allowed.includes(key)), 'unknown outcome option');
  return data;
}

function name(value) {
  assert.ok(typeof value === 'string' && value.length > 0 && value.trim() === value && value.isWellFormed() &&
    !/[\x00-\x1f\x7f-\x9f]/u.test(value), 'nonempty safe name required');
  return value;
}

function names(value, label) {
  assert.ok(Array.isArray(value) && value.length > 0, label + ' must be an explicit nonempty array');
  value.forEach(name);
  assert.equal(new Set(value).size, value.length, 'duplicate ' + label);
  return value;
}

function array(value, label) {
  assert.ok(Array.isArray(value), label + ' must be an array');
  return value;
}

/**
 * Pure completion arithmetic. Only literal true is a passed observation,
 * process or named check. Cancellation is an explicit boolean; nonempty errors
 * fail completion, without changing the separately reported source binding.
 * Extra check metadata may be any JSON data, but never supplies implicit gates.
 */
export function verificationOutcome(value) {
  const data = input(value, ['observationPassed', 'processPassed', 'requiredChecks', 'checks', 'cancelled', 'errors']);
  const required = names(field(data, 'requiredChecks'), 'requiredChecks');
  const checks = object(field(data, 'checks'), 'checks');
  const cancelled = field(data, 'cancelled', false), errors = array(field(data, 'errors', []), 'errors');
  assert.equal(typeof cancelled, 'boolean', 'cancelled must be a boolean');
  const outputPassed = field(data, 'observationPassed') === true;
  const processPassed = field(data, 'processPassed') === true;
  const unverified = required.filter(key => !passed(checks, key)), sourceBound = unverified.length === 0;
  return { passed: outputPassed && processPassed && sourceBound && !cancelled && errors.length === 0,
    outputPassed, processPassed, sourceBound, unverified };
}

/**
 * Report every explicit stageId in caller order, but decide only the explicitly
 * required subset. Absent rows are skipped; present rows carry an explicit
 * status string. Only status "passed" plus a literal true recheck can pass.
 * No ordering dependencies, retries, stage execution or whole-system acceptance
 * are inferred. Stage/check metadata is inert JSON data, not instructions.
 */
export function summarizeVerificationStages(value) {
  const data = input(value, ['stageIds', 'requiredStages', 'stages', 'checks', 'diagnostics']);
  const stageIds = names(field(data, 'stageIds'), 'stageIds');
  const required = names(field(data, 'requiredStages'), 'requiredStages');
  const stages = object(field(data, 'stages'), 'stages'), checks = object(field(data, 'checks'), 'checks');
  const diagnostics = array(field(data, 'diagnostics', []), 'diagnostics');
  assert.ok(required.every(id => stageIds.includes(id)), 'required stage is not declared');
  for (const id of Object.keys(stages)) {
    assert.ok(stageIds.includes(id), 'undeclared stage: ' + id);
    const row = object(stages[id], 'stage');
    assert.ok(own(row, 'status'), 'explicit stage status required');
    name(row.status);
  }
  const rows = stageIds.map(id => ({ id, status: own(stages, id) ? stages[id].status : 'skipped', rechecked: passed(checks, id) }));
  const requestedScopePassed = diagnostics.length === 0 && required.every(id =>
    own(stages, id) && stages[id].status === 'passed' && passed(checks, id));
  return { requestedScopePassed, stages: rows };
}
