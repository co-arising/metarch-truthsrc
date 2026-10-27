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
const expected = [
  { ruleId: 'IR-CB-PREPARE-NOT-COMMITTED', errCode: '60011', onFail: 'reject', when: { form: 'map-absent', map: 'committed', key: 'param.txid' } },
  { ruleId: 'IR-CB-PREPARE-NOT-COMPENSATED', errCode: '60012', onFail: 'reject', when: { form: 'map-absent', map: 'compensated', key: 'param.txid' } },
];
function checkBarrier(source) {
  const aggregate = source.aggregates.find(a => a.name === 'CreditBalance');
  for (const command of ['ReserveFunds', 'RecordIncomingCredits']) {
    const guards = aggregate.commands.find(c => c.name === command).guards;
    assert.deepEqual(guards.slice(0, 2).map(({ desc, ...g }) => g), expected, command);
    assert.equal(guards[2].when.map, command === 'ReserveFunds' ? 'reservedAmount' : 'incomingCredits');
    assert.equal(guards[2].onFail, command === 'ReserveFunds' ? 'succeed-empty' : 'reject');
  }
  for (const guard of expected) assert.deepEqual(
    aggregate.aggregateRuleRefs.filter(r => r.ruleId === guard.ruleId).map(({ ruleId, errCode }) => ({ ruleId, errCode })),
    [{ ruleId: guard.ruleId, errCode: guard.errCode }]);
}

test('P21 real money tree has both terminal rejection guards before live idempotency', () => {
  checkBarrier(canonical);
});

test('P21 contract oracle rejects missing, late, wrong-map/key and empty-success barriers', () => {
  checkBarrier(canonical);
  for (const command of ['ReserveFunds', 'RecordIncomingCredits']) for (const mutate of [
    guards => guards.shift(),
    guards => guards.push(guards.shift()),
    guards => { guards[0].when.map = 'reservedAmount'; },
    guards => { guards[1].when.key = 'param.resource'; },
    guards => { guards[0].onFail = 'succeed-empty'; },
  ]) {
    const source = structuredClone(canonical);
    mutate(source.aggregates[0].commands.find(c => c.name === command).guards);
    assert.throws(() => checkBarrier(source), { name: 'AssertionError' }, command);
  }
});

test('P21 public run-all emits actual Rules and participant/Host barrier safety oracles', () => {
  checkBarrier(canonical);
  const out = join(realpathSync(mkdtempSync(join(tmpdir(), 'p21-money-barrier-'))), 'app');
  const generated = spawnSync(process.execPath, [join(root, 'generators/run-all.mjs'), join(example, 'tree'), out,
    '--saga-binding', join(example, 'bindings.json'), '--saga-runtime-binding', join(example, 'runtime-binding.json')],
  { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(generated.status, 0, generated.stderr + generated.stdout);
  const rules = readFileSync(join(out, 'app/net/imadz/metarch/domain/invariant/CreditBalanceRules.scala'), 'utf8');
  assert.equal(rules, readFileSync(new URL('./golden/money-prepare-evidence/CreditBalanceRules.scala', import.meta.url), 'utf8'));
  for (const command of ['ReserveFunds', 'RecordIncomingCredits']) {
    const body = rules.slice(rules.indexOf(`object ${command}Rule`)).split('\n  }')[0];
    assert(body.indexOf('60011') < body.indexOf('60012'));
    assert(body.indexOf('60012') < body.indexOf(command === 'ReserveFunds' ? 'Right(Nil)' : '60007'));
  }
  const spec = readFileSync(join(out, 'test/fixture/FixtureSafetySpec.scala'), 'utf8');
  for (const label of ['P21 participant terminal barrier', 'P21 real Host terminal barrier', 'P21 ordered mailbox barrier', 'P21 synthetic rule precedence']) assert(spec.includes(label), label);
  assert(spec.includes('kit.stop(first)'));
  assert(spec.includes('p21AllEvents(kit, id) == journal'));
  assert(!/@[A-Z_]+@/.test(spec));
});
