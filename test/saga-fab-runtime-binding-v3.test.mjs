// P13：fab 双 saga 的 v3 降低钉——可选能力（bounded-collection-args /
// args-anchored-manifest）门与 digest 钉。缺省 10 项必选能力的文件对 fab 树
// 保持三处拒绝（负例不因可选能力放松）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileTree } from '../lib/compile.mjs';
import { compileSagas } from '../lib/saga/compile.mjs';
import { lowerSagaRuntimeBindingV3 } from '../lib/saga/runtime-binding.mjs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const example = join(root, 'example', 'fab-split-merge');
const canonical = JSON.parse(compileTree(join(example, 'tree')));
const binding = JSON.parse(readFileSync(join(example, 'bindings.json'), 'utf8'));
const runtimeBinding = JSON.parse(readFileSync(join(example, 'runtime-binding.json'), 'utf8'));

const FAB_IR_DIGEST = '9fea619620317479945a48bfd07fa52e31d93f9bd19e1e91b911de8540efdf08';
const FAB_SPLIT_DIGEST = 'sha256:86da085f794307236236ec8de2326f861d77c5650b0385a36435c09654ea2d5d';
const FAB_MERGE_DIGEST = 'sha256:cd186ecbd0bb57e5183dd77e622f7def716f7fc653723a9956a7d5edf4c46cc2';

function lower(rb) {
  const { ir } = compileSagas(canonical, binding);
  return lowerSagaRuntimeBindingV3({ canonical, binding, runtimeBinding: rb, ir });
}

test('fab v3 lowering: both sagas lower with the two optional capabilities and pin fresh digests', () => {
  const { plan, diagnostics } = lower(runtimeBinding);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(plan.sagas.map((s) => s.sagaId), ['fab-split', 'fab-merge']);
  assert.equal(plan.sagas[0].definitionDigest, FAB_SPLIT_DIGEST);
  assert.equal(plan.sagas[1].definitionDigest, FAB_MERGE_DIGEST);
  assert.equal(plan.readiness, 'lowered-contract-only');
  for (const saga of plan.sagas) {
    assert.equal(saga.runnable, false, 'lowering never certifies runtime');
    assert.equal(saga.runtimeBindingVerified, false);
  }
});

test('fab v3 lowering: the money-tree IR digest stays untouched (aggregate faces never enter the saga IR)', () => {
  const { ir } = compileSagas(canonical, binding);
  assert.equal(ir.digest, FAB_IR_DIGEST);
});

test('fab v3 negative: without args-anchored-manifest the durable-reference manifest is rejected again', () => {
  const rb = JSON.parse(JSON.stringify(runtimeBinding));
  rb.target.capabilities = rb.target.capabilities.filter((c) => c !== 'args-anchored-manifest');
  const { diagnostics } = lower(rb);
  assert.ok(diagnostics.some((d) => d.code === 'RUNTIME_MANIFEST_UNSUPPORTED'));
  assert.ok(diagnostics.some((d) => d.code === 'RUNTIME_TYPE_UNSUPPORTED' && /manifest-reference/.test(d.message)),
    'the manifest-reference type must lose its anchor with the capability gone');
});

test('fab v3 negative: without bounded-collection-args the collection type is rejected again', () => {
  const rb = JSON.parse(JSON.stringify(runtimeBinding));
  rb.target.capabilities = rb.target.capabilities.filter((c) => c !== 'bounded-collection-args');
  const { diagnostics } = lower(rb);
  assert.ok(diagnostics.some((d) => d.code === 'RUNTIME_TYPE_UNSUPPORTED' && /collection/.test(d.message)));
});

test('fab v3 negative: the bare ten-mandatory-capability document (money shape) still rejects the fab tree', () => {
  const rb = JSON.parse(JSON.stringify(runtimeBinding));
  rb.target.capabilities = rb.target.capabilities.filter((c) => !['bounded-collection-args', 'args-anchored-manifest'].includes(c));
  const { diagnostics } = lower(rb);
  assert.ok(diagnostics.some((d) => d.code === 'RUNTIME_MANIFEST_UNSUPPORTED'));
  assert.ok(diagnostics.some((d) => d.code === 'RUNTIME_TYPE_UNSUPPORTED'));
});

test('fab v3 negative: unknown optional capabilities stay fail-closed', () => {
  const rb = JSON.parse(JSON.stringify(runtimeBinding));
  rb.target.capabilities = [...rb.target.capabilities, 'dynamic-participant-expansion'];
  const { diagnostics } = lower(rb);
  assert.ok(diagnostics.some((d) => d.code === 'RUNTIME_CAPABILITY_UNSUPPORTED'));
});
