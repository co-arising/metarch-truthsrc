import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateLegacySagaSpec, emitCli, stableJson } from '../generators/saga-dsl/emit.mjs';
import { generate } from '../generators/saga-dsl/generate.mjs';
import { compileSagas } from '../lib/saga/compile.mjs';
import { sagaContract } from './fixtures/saga-contract.mjs';
const legacy = () => JSON.parse(readFileSync(new URL('../generators/saga-dsl/transfer.spec.json', import.meta.url)));

for (const key of ['objectName', 'contextType', 'argsType']) {
  for (const name of ['macro', 'SagaRegistry', 'RecipientRef']) test(`legacy rejects reserved/API declaration ${key}=${name}`, () => {
    const spec = legacy(); spec[key] = name;
    assert.throws(() => validateLegacySagaSpec(spec), /Scala identifier|shadows/);
  });
}
for (const name of ['getClass', 'productArity']) test(`legacy rejects inherited args member ${name}`, () => {
  const spec = legacy(); spec.argsFields = [{ name, type: 'String' }];
  assert.throws(() => validateLegacySagaSpec(spec), /inherited/);
});
test('legacy participant protocols compare equivalent nominal spellings', () => {
  const spec = legacy();
  const second = structuredClone(spec.steps[0]);
  second.id = 'second';
  spec.steps.push(second);
  spec.steps[0].protocolType = 'Envelope[String]';
  spec.steps[1].protocolType = 'Envelope[ String ]';
  assert.doesNotThrow(() => validateLegacySagaSpec(spec));
});
test('legacy nominal type depth is bounded independently of JSON depth', () => {
  const spec = legacy(); spec.errorType = 'List['.repeat(200) + 'String' + ']'.repeat(200);
  assert.throws(() => validateLegacySagaSpec(spec), /nesting exceeds/);
});
test('stableJson rejects getters without executing them', () => {
  let invoked = false;
  const value = { get x() { invoked = true; return 1; } };
  assert.throws(() => stableJson(value), /JSON data/);
  assert.equal(invoked, false);
});
test('public legacy emitter cannot overwrite its source or a different existing file', (t) => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'saga-safe-emit-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = join(directory, 'spec.json');
  const bytes = JSON.stringify(legacy());
  writeFileSync(input, bytes);
  assert.throws(() => emitCli([input, input]), /overwrite a source/);
  assert.equal(readFileSync(input, 'utf8'), bytes);
  const output = join(directory, 'existing.scala');
  writeFileSync(output, 'manual code');
  assert.throws(() => emitCli([input, output]), /different content/);
  assert.equal(readFileSync(output, 'utf8'), 'manual code');
});
test('serialized and null-prototype IR have the same verified JSON contract', () => {
  const { canonical, binding } = sagaContract();
  canonical.sagas[0].seq = -0;
  const { ir } = compileSagas(canonical, binding);
  assert.ok(ir);
  const serialized = JSON.parse(stableJson(ir));
  const reference = generate({ canonical, options: { mode: 'strict-contract', binding } });
  assert.deepEqual(generate({ canonical, options: { mode: 'strict-contract', binding, ir: serialized } }), reference);
  assert.deepEqual(generate({ canonical, options: { mode: 'strict-contract', binding,
    ir: Object.assign(Object.create(null), serialized) } }), reference);
});
