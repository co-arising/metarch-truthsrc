import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileTree } from '../lib/compile.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const example = join(root, 'example/saga-money-transfer-serial');
const canonical = JSON.parse(compileTree(join(example, 'tree')));
const expected = {
  ruleId: 'IR-CB-RESERVE-003', errCode: '60004', onFail: 'reject',
  when: { form: 'money-positive', amount: 'param.amount' },
  desc: 'Transfer amount must be positive (golden master 60004).',
};
function checkIncoming(source) {
  const aggregate = source.aggregates.find(a => a.name === 'CreditBalance');
  const guards = aggregate.commands.find(c => c.name === 'RecordIncomingCredits').guards;
  assert.deepEqual(guards.map(g => g.errCode), ['60011', '60012', '60007', '60004']);
  assert.deepEqual(guards[3], expected);
  assert.deepEqual(aggregate.commands.find(c => c.name === 'ReserveFunds').guards.filter(g => g.when.form === 'money-positive'), [expected]);
  assert.deepEqual(aggregate.aggregateRuleRefs.filter(r => r.ruleId === expected.ruleId),
    [{ ruleId: expected.ruleId, errCode: expected.errCode, desc: expected.desc }]);
}

test('P22 compiled tree reuses the existing positive rule after target terminal and live guards', () => {
  checkIncoming(canonical);
});

test('P22 contract oracle rejects missing, early, wrong-source/form/code and empty-success guards', () => {
  checkIncoming(canonical);
  for (const mutate of [
    guards => guards.pop(),
    guards => guards.unshift(guards.pop()),
    guards => guards.splice(2, 0, guards.pop()),
    guards => { guards[3].when.amount = 'param.resource'; },
    guards => { guards[3].when.form = 'map-absent'; },
    guards => { guards[3].errCode = '60007'; },
    guards => { guards[3].onFail = 'succeed-empty'; },
  ]) {
    const source = structuredClone(canonical);
    mutate(source.aggregates.find(a => a.name === 'CreditBalance').commands.find(c => c.name === 'RecordIncomingCredits').guards);
    assert.throws(() => checkIncoming(source), { name: 'AssertionError' });
  }
});

test('P22 public run-all emits actual positive Rules and real participant/Host recovery oracles', () => {
  checkIncoming(canonical);
  const out = join(realpathSync(mkdtempSync(join(tmpdir(), 'p22-money-positive-'))), 'app');
  const generated = spawnSync(process.execPath, [join(root, 'generators/run-all.mjs'), join(example, 'tree'), out,
    '--saga-binding', join(example, 'bindings.json'), '--saga-runtime-binding', join(example, 'runtime-binding.json')],
  { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(generated.status, 0, generated.stderr + generated.stdout);
  const rules = readFileSync(join(out, 'app/net/imadz/metarch/domain/invariant/CreditBalanceRules.scala'), 'utf8');
  assert.equal(rules, readFileSync(new URL('./golden/money-prepare-evidence/CreditBalanceRules.scala', import.meta.url), 'utf8'));
  const body = rules.slice(rules.indexOf('object RecordIncomingCreditsRule')).split('\n  }')[0];
  assert(body.indexOf('60011') < body.indexOf('60012'));
  assert(body.indexOf('60012') < body.indexOf('60007'));
  assert(body.indexOf('60007') < body.indexOf('60004'));
  assert(body.includes('MoneyOps.isPositive(p.amount.minorUnits)'));
  const spec = readFileSync(join(out, 'test/fixture/FixtureSafetySpec.scala'), 'utf8');
  for (const label of ['P22 participant incoming positive', 'P22 real Host incoming positive', 'P22 synthetic incoming precedence']) assert(spec.includes(label), label);
  assert(spec.includes('kit.stop(first)'));
  assert(spec.includes('p21AllEvents(kit, id) == journal'));
  assert(!/@[A-Z_]+@/.test(spec));
});
