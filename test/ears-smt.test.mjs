import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEars } from '../lib/ears/parser.mjs';
import { normalizeEars } from '../lib/ears/normalize.mjs';
import { verifyEarsWithSmt } from '../lib/ears/clarification-card.mjs';

const QUOTA_COMPLETE = `
slice QuotaPool.ReserveQuota

where:
  validAmount   = amount in [pool.minLimit..pool.maxLimit]             as "single amount valid"
  withinPoolCap = pool.totalUsed + amount <= pool.totalCap             as "within pool cap"
  withinAcctCap = pool.accountUsed[accountId] + amount <= pool.acctCap as "within account cap"

axioms:
  [AX-Q-1] ALWAYS pool.totalUsed <= pool.totalCap
  [AX-Q-2] ALWAYS pool.accountUsed[accountId] <= pool.acctCap

rules:
  [Q_RANGE] IF not validAmount   THEN SHALL reject request with Q_RANGE
  [Q_POOL]  IF not withinPoolCap THEN SHALL reject request with Q_POOL
  [Q_ACCT]  IF not withinAcctCap THEN SHALL reject request with Q_ACCT
  [Q_OK]    WHILE validAmount and withinPoolCap and withinAcctCap
            WHEN ReserveQuota
            SHALL emit QuotaReserved
            post:
              pool.totalUsed' = pool.totalUsed + amount
              pool.accountUsed'[accountId] = pool.accountUsed[accountId] + amount
`;

const QUOTA_COMPLETE_CN = `
切片 QuotaPool.ReserveQuota

定义:
  单笔合法   = amount 属于 [pool.minLimit..pool.maxLimit]
  在总门限内 = pool.totalUsed + amount <= pool.totalCap
  在单户内   = pool.accountUsed[accountId] + amount <= pool.acctCap

公理:
  [AX-Q-1] 恒成立 pool.totalUsed <= pool.totalCap
  [AX-Q-2] 恒成立 pool.accountUsed[accountId] <= pool.acctCap

规则:
  [Q_RANGE] 如果 不满足 单笔合法   则 必须 拒绝请求，返回 Q_RANGE
  [Q_POOL]  如果 不满足 在总门限内 则 必须 拒绝请求，返回 Q_POOL
  [Q_ACCT]  如果 不满足 在单户内   则 必须 拒绝请求，返回 Q_ACCT
  [Q_OK]    当处于 单笔合法 且 在总门限内 且 在单户内
            当收到 ReserveQuota
            必须 发射 QuotaReserved
            变更后:
              pool.totalUsed' = pool.totalUsed + amount
              pool.accountUsed'[accountId] = pool.accountUsed[accountId] + amount
`;

test('Z3 passes all 5 checks (conflict, gap, invariant induction, dead-rule, witnesses) on complete dual-cap slice and EN/CN yield identical .smt2', () => {
  const en = normalizeEars(parseEars(QUOTA_COMPLETE));
  const cn = normalizeEars(parseEars(QUOTA_COMPLETE_CN));
  const resEn = verifyEarsWithSmt(en, { solver: 'z3' });
  const resCn = verifyEarsWithSmt(cn, { solver: 'z3' });

  assert.equal(resEn.passed, true, JSON.stringify(resEn.findings, null, 2));
  assert.equal(resCn.passed, true);
  assert.equal(resEn.logic, 'QF_AUFLIA');
  assert.equal(resEn.combinedSmt2, resCn.combinedSmt2);
  assert.equal(resEn.checks.conflicts.every(c => c.passed), true);
  assert.equal(resEn.checks.gaps.every(g => g.passed), true);
  assert.equal(resEn.checks.invariants.length, 1);
  assert.equal(resEn.checks.invariants[0].passed, true);
  assert.equal(resEn.checks.deadRules.length, 0);
  assert.equal(resEn.checks.witnesses.length, 4);
});

test('Z3 catches logic gap and emits A/B clarification card', () => {
  const specWithGap = normalizeEars(parseEars(`
slice BatchPlan.SkipSlot
where:
  scheduleReady = plan.initialized and plan.sealed
rules:
  [SKIP_NOT_DUE] IF dueSlot > plan.currentTick WHEN SkipSlot THEN SHALL reject request with SKIP_NOT_DUE
  [SKIP_OK]      WHILE scheduleReady
                 WHEN SkipSlot AND dueSlot <= plan.currentTick
                 SHALL emit SlotSkipped
`));
  const res = verifyEarsWithSmt(specWithGap, { solver: 'z3' });
  assert.equal(res.passed, false);
  assert.equal(res.findings.some(f => f.kind === 'gap'), true);
  assert.equal(res.clarificationCards.length > 0, true);
  assert.match(res.clarificationCards[0].markdown, /需求缺口澄清/);
  assert.match(res.clarificationCards[0].markdown, /选项 A/);
});

test('Z3 catches conflict and invariant violation', () => {
  const broken = normalizeEars(parseEars(`
slice QuotaPool.BrokenReserve
axioms:
  [AX-1] ALWAYS pool.totalUsed <= pool.totalCap
rules:
  [R_REJECT] IF amount <= 0 THEN SHALL reject request with BAD_AMT
  [R_EMIT]   WHILE amount >= 0 WHEN BrokenReserve SHALL emit Reserved
             post:
               pool.totalUsed' = pool.totalUsed + amount
`));
  const res = verifyEarsWithSmt(broken, { solver: 'z3' });
  assert.equal(res.passed, false);
  assert.ok(res.findings.some(f => f.kind === 'conflict'), 'expected conflict when amount == 0');
  assert.ok(res.findings.some(f => f.kind === 'invariant'), 'expected invariant violation without cap check');
});

test('Z3 isolates QF_NIA nonlinear floor-division witness synthesis', () => {
  const niaSpec = normalizeEars(parseEars(`
slice AssetOrder.ConfirmUnits
where:
  validNav   = nav > 0.0000
  exactFloor = units >= 0 and units * nav <= order.netAmount and (units + 1) * nav > order.netAmount
rules:
  [BAD_NAV]   IF not validNav   THEN SHALL reject request with BAD_NAV
  [BAD_UNITS] IF not exactFloor THEN SHALL reject request with BAD_UNITS
  [OK_UNITS]  WHILE validNav and exactFloor WHEN ConfirmUnits SHALL emit UnitsConfirmed
`));
  const res = verifyEarsWithSmt(niaSpec, { solver: 'z3' });
  assert.equal(res.logic, 'QF_NIA');
  assert.equal(res.passed, true, JSON.stringify(res.findings, null, 2));
  const okWitness = res.checks.witnesses.find(w => w.ruleId === 'OK_UNITS');
  assert.ok(okWitness, 'expected witness for OK_UNITS');
  assert.ok(Number(okWitness.model.nav) > 0);
  assert.ok(Number(okWitness.model.units) >= 0);
});

test('4-step BMC proves skipped slot can never be resurrected into backlog', () => {
  const bmcSpec = normalizeEars(parseEars(`
slice BatchPlan.StreamBatch
axioms:
  [AX-1] ALWAYS plan.startCount <= plan.observedCount and plan.observedCount <= plan.scheduleCount
rules:
  [SKIP_OK] WHILE dueSlot not in plan.slotDisposition and plan.observedCount < plan.scheduleCount
            WHEN SkipDueSlot
            SHALL emit DueSlotSkipped
            post:
              plan.slotDisposition'[dueSlot] = "skipped"
              plan.observedCount' = plan.observedCount + 1

  [TRIG_OK] WHILE dueSlot in plan.slotDisposition and plan.slotDisposition[dueSlot] == "backlog" and plan.startCount < plan.observedCount
            WHEN TriggerSlot
            SHALL emit SlotTriggered
            post:
              plan.startCount' = plan.startCount + 1
`));
  const res = verifyEarsWithSmt(bmcSpec, { solver: 'z3', bmcSteps: 4, checkGaps: false });
  assert.equal(res.bmc.checked, true);
  assert.equal(res.bmc.passed, true, JSON.stringify(res.bmc.properties, null, 2));
  assert.ok(res.bmc.properties.some(p => p.id.includes('bmc-no-resurrect') && p.passed));
});
