import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { compileTree } from '../lib/compile.mjs';
import { lowerSagaRuntimeBindingV3 } from '../lib/saga/runtime-binding.mjs';
import { emitStrictFiles } from '../generators/saga-dsl/emit-strict.mjs';
import { emitStrictHostFiles } from '../generators/saga-dsl/emit-strict-host.mjs';
import { emitStrictSpecFiles } from '../generators/saga-dsl/emit-strict-spec.mjs';

const example = fileURLToPath(new URL('../example/saga-money-transfer-serial/', import.meta.url));
const canonical = JSON.parse(compileTree(join(example, 'tree')));
const binding = JSON.parse(readFileSync(join(example, 'bindings.json'), 'utf8'));
const runtimeBinding = JSON.parse(readFileSync(join(example, 'runtime-binding.json'), 'utf8'));
const { plan, diagnostics } = lowerSagaRuntimeBindingV3({ canonical, binding, runtimeBinding });
assert.deepEqual(diagnostics, []);
function emitted(source = canonical) {
  const { model } = emitStrictFiles(plan.sagas[0], source);
  return { model, host: emitStrictHostFiles(model).find(f => f.name === 'FixtureHost.scala').content };
}
const events = ['DeductFundsConfirmed', 'ReleaseReservedFundsConfirmed', 'CommitIncomingCreditsConfirmed', 'CancelIncomingCreditConfirmed'];

test('money terminal derives all four phase-specific live and opposite marker carriers', () => {
  const { model } = emitted();
  assert.deepEqual(model.phases.filter(p => p.runtime !== 'Prepare').map(p => p.terminalEvidence), [
    { liveMap: 'reservedAmount', markerMap: 'committed', oppositeMap: 'compensated' },
    { liveMap: 'reservedAmount', markerMap: 'compensated', oppositeMap: 'committed' },
    { liveMap: 'incomingCredits', markerMap: 'committed', oppositeMap: 'compensated' },
    { liveMap: 'incomingCredits', markerMap: 'compensated', oppositeMap: 'committed' },
  ]);
});

test('money terminal observes durable state after success and error, and refuses opposite or contradictory facts', () => {
  const { host } = emitted();
  assert.equal((host.match(/MONEY_TERMINAL_FACT_CONFLICT/g) || []).length, 4);
  assert.equal((host.match(/MONEY_TERMINAL_ACK_WITHOUT_FACT/g) || []).length, 4);
  assert.equal((host.match(/MONEY_TERMINAL_FACT_UNAVAILABLE/g) || []).length, 4);
  assert.equal((host.match(/\.flatMap \{/g) || []).length >= 6, true);
});

test('money terminal rejects bad or ambiguous folds and origins in any of the four confirmations', () => {
  for (const name of events) {
    for (const mutate of [
      e => { e.foldAssignments = []; },
      e => { e.foldAssignments.push(structuredClone(e.foldAssignments[0])); },
      e => { e.foldAssignments[0].key = 'event.resource'; },
      e => { e.foldAssignments[0].value = 'event.txid'; },
      e => { e.foldAssignments.find(r => r.op === 'remove').key = 'event.resource'; },
      e => { e.bindings.push({ slot: 'txid', expr: 'param.resource' }); },
      e => { e.bindings[0].expr = 'param.resource'; },
      e => { e.foldAssignments.push({ slot: e.foldAssignments[0].slot === 'committed' ? 'compensated' : 'committed', op: 'put', key: 'event.txid', value: e.foldAssignments[0].value }); },
    ]) {
      const source = structuredClone(canonical);
      mutate(source.aggregates.find(a => a.name === 'CreditBalance').events.find(e => e.name === name));
      assert.throws(() => emitted(source), /Terminal evidence/, name);
    }
  }
});

test('money terminal oracle has independent marker/live facts and all real ACK windows', () => {
  const { model } = emitted();
  const spec = emitStrictSpecFiles(model).find(f => f.name === 'FixtureSafetySpec.scala').content;
  assert.match(spec, /id\.contains\("live"\) && id\.contains\("commit"\)\) base\.copy\(committed = marker,/);
  assert.match(spec, /id\.contains\("live"\) && id\.contains\("compensate"\)\) base\.copy\(compensated = marker,/);
  assert.match(spec, /Vector\(\(true, true, false\), \(false, true, false\),/);
  assert.match(spec, /\(true, false, false\), \(false, false, false\), \(true, true, true\), \(true, false, true\)/);
  assert.match(spec, /P20_TEST_PRE_DISPATCH_TARGET_REFUSAL/);
  assert.match(spec, /P20_TEST_AUTHORIZED_ABORT_BEFORE_COMMIT/);
  assert.match(spec, /assert\(recovered == interrupted\)/);
  assert.doesNotMatch(spec, /@COMMANDS@/);
});

test('money terminal rejects a wrong Money marker type even when txid lineage matches', () => {
  for (const name of ['committed', 'compensated']) {
    const source = structuredClone(canonical);
    source.aggregates.find(a => a.name === 'CreditBalance').stateFields.find(f => f.name === name).dataType = 'Map[TxId, AccountId]';
    assert.throws(() => emitted(source), /Terminal evidence/);
  }
});
