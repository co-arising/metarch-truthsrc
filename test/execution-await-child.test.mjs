// P14 awaitChildRun composition contract: the authored fab tree is the positive
// fixture; each negative mutates one declaration and must fail with the exact
// EXECUTION_AWAIT_* diagnostic. Pure compiler regressions — no runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTree } from '../lib/compile.mjs';
import { compileExecution } from '../lib/execution/compile.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const clone = (value) => structuredClone(value);
const at = (value, pointer) => pointer.split('/').slice(1).reduce((node, key) => node[key], value);
const set = (value, pointer, entry) => {
  const end = pointer.lastIndexOf('/');
  at(value, pointer.slice(0, end))[pointer.slice(end + 1)] = entry;
};
const remove = (value, pointer) => {
  const end = pointer.lastIndexOf('/');
  const parent = at(value, pointer.slice(0, end));
  const key = pointer.slice(end + 1);
  if (Array.isArray(parent)) parent.splice(Number(key), 1);
  else delete parent[key];
};

const baseCanonical = JSON.parse(compileTree(join(root, 'example', 'fab-split-merge', 'tree')));
const baseBinding = JSON.parse(readFileSync(join(root, 'example', 'fab-split-merge', 'execution-bindings.json')));
const composeId = 'fab-split-child-merge';
const composeAt = (doc) => {
  const ordinal = doc.pipelines.findIndex((p) => p.id === composeId);
  return { pipeline: `/pipelines/${ordinal}`, pipelineValue: doc.pipelines[ordinal] };
};
// Canonical file order: fab-child-process, fab-merge-invoke,
// fab-split-await-child-merge-design, fab-split-child-merge, fab-split-invoke.
const CP = composeAt(baseCanonical).pipeline;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function failure(mutate, code, pointer, document = 'canonical') {
  const canonical = clone(baseCanonical);
  const binding = clone(baseBinding);
  const cp = composeAt(canonical).pipeline;
  const bp = `/pipelines/${binding.pipelines.findIndex((p) => p.pipelineId === composeId)}`;
  mutate({ canonical, binding, cp, bp });
  const before = [JSON.stringify(canonical), JSON.stringify(binding)];
  freeze(canonical);
  freeze(binding);
  const result = compileExecution(canonical, binding);
  assert.equal(result.ir, null, 'any error must discard the entire IR');
  const diagnostic = result.diagnostics.find((entry) => entry.code === code
    && entry.source.document === document && entry.source.pointer === pointer);
  assert.ok(diagnostic, `missing ${code} at ${document}${pointer}: ${JSON.stringify(result.diagnostics.map((d) => [d.code, d.source.document, d.source.pointer]))}`);
  assert.deepEqual([JSON.stringify(canonical), JSON.stringify(binding)], before, 'must not mutate inputs');
  assert.deepEqual(compileExecution(canonical, binding), result, 'diagnostics must be deterministic');
}

test('authored composition pipeline compiles with an awaitChildRun step (positive)', () => {
  const result = compileExecution(clone(baseCanonical), clone(baseBinding));
  assert.deepEqual(result.diagnostics, []);
  const { pipelineValue } = composeAt(result.ir);
  const awaitStep = pipelineValue.steps.find((step) => step.id === 'await-child');
  assert.ok(awaitStep, 'await-child step reaches the IR');
  assert.ok(awaitStep.awaitChildRun, 'the step carries the awaitChildRun variant');
  assert.equal(awaitStep.awaitChildRun.childRun.identity.derivation, 'durable-parent-step');
  const childBinding = pipelineValue.binding.childRuns.find((entry) => entry.stepId === 'await-child');
  assert.equal(childBinding.journal.pidPrefix, 'fab-child');
  const mergeStep = pipelineValue.steps.find((step) => step.id === 'merge');
  assert.equal(mergeStep.invokeSaga.args.find((arg) => arg.slot === 'wafers').ref, 'step:await-child:wafers');
});

test('awaitChildRun plan reference must name a declared monarch stages pipeline', () => {
  failure(({ canonical, cp }) => {
    set(canonical, `${cp}/steps/1/execution/awaitChildRun/childRun/planRef/pipelineId`, 'fab-nonexistent-plan');
  }, 'EXECUTION_AWAIT_PLAN_MISSING', `${CP}/steps/1/execution/awaitChildRun/childRun/planRef/pipelineId`);
});

test('awaitChildRun identity tokens must be durable initial inputs (no step writes, no attempt)', () => {
  failure(({ canonical, cp }) => {
    set(canonical, `${cp}/steps/1/execution/awaitChildRun/childRun/identity/source/ref`, 'step:split:txid');
  }, 'EXECUTION_AWAIT_IDENTITY_OPEN', `${CP}/steps/1/execution/awaitChildRun/childRun/identity/source/ref`);
});

test('awaitChildRun identity derivation is schema-closed (attempt counters rejected)', () => {
  failure(({ canonical, cp }) => {
    set(canonical, `${cp}/steps/1/execution/awaitChildRun/childRun/identity/derivation`, 'attempt-counter');
  }, 'EXEC_SCHEMA', `${CP}/steps/1/execution/awaitChildRun/childRun/identity/derivation`);
});

test('awaitChildRun payload must reference durable initial inputs, not step writes', () => {
  failure(({ canonical, cp }) => {
    set(canonical, `${cp}/steps/1/execution/awaitChildRun/childRun/payload/2/ref`, 'step:split:txid');
  }, 'EXECUTION_AWAIT_SOURCE', `${CP}/steps/1/execution/awaitChildRun/childRun/payload/2/ref`);
});

test('awaitChildRun chunk bound must cover the payload collection type', () => {
  failure(({ canonical, cp }) => {
    set(canonical, `${cp}/execution/admission/maxItemsPerChunk`, 8);
  }, 'EXECUTION_AWAIT_BOUND', `${CP}/execution/admission/maxItemsPerChunk`);
});

test('awaitChildRun requires a preceding same-source continue-on-success invokeSaga step', () => {
  failure(({ canonical, cp }) => {
    remove(canonical, `${cp}/steps/0`);
  }, 'EXECUTION_AWAIT_PRECEDES', `${CP}/steps/0/execution/awaitChildRun`);
});

test('binding childRun must target an awaitChildRun step', () => {
  failure(({ binding, bp }) => {
    set(binding, `${bp}/childRuns/0/stepId`, 'merge');
  }, 'EXECUTION_AWAIT_BINDING_ORPHAN', '/pipelines/2/childRuns/0/stepId', 'binding');
});

test('every awaitChildRun step needs a child run binding', () => {
  failure(({ binding, bp }) => {
    remove(binding, `${bp}/childRuns`);
  }, 'EXECUTION_AWAIT_BINDING_MISSING', `${CP}/steps/1/execution/awaitChildRun`);
});

test('await step reads must be consumed by identity or payload', () => {
  failure(({ canonical, cp }) => {
    const reads = at(canonical, `${cp}/steps/1/execution/reads`);
    reads.push({ slot: 'manifest', ref: 'input:manifest', type: 'ManifestRef' });
  }, 'EXECUTION_AWAIT_READ_UNUSED', `${CP}/steps/1/execution/reads/5/slot`);
});

test('child result coverage requires every step outcome mapped', () => {
  failure(({ canonical, cp }) => {
    // Rename one declared outcome so no child result maps it anymore (the
    // results array stays at five — its size floor is schema-enforced).
    set(canonical, `${cp}/steps/1/execution/outcomes/1/code`, 'ChildCancelled');
  }, 'EXECUTION_AWAIT_RESULT_COVERAGE', `${CP}/steps/1/execution/outcomes/1/code`);
});
