import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEars } from '../lib/ears/parser.mjs';
import { normalizeEars } from '../lib/ears/normalize.mjs';

const EN_STYLE_A = `
slice LedgerOrder.SubmitOrder

where:
  validAmount   = amount.currency == "CNY" and amount.amount > 0.00      as "amount is positive CNY"
  validAccounts = sourceAccountId != targetAccountId                     as "source and target differ"
  sameAsStored  = opId == order.opId and amount == order.amount          as "replay matches stored"
  extern matchesOriginal                                                 as "matches trusted original"

axioms:
  [AX-1] ALWAYS order.status in {"new", "requested", "settled", "canceled"}

rules:
  [ORD_ID]      IF orderId != order.id
                THEN SHALL reject request with ORD_ID

  [ORD_ACCTS]   IF not validAccounts
                THEN SHALL reject request with ORD_ACCTS

  [ORD_AMOUNT]  IF not validAmount
                THEN SHALL reject request with ORD_AMOUNT

  [ORD_REPLAY]  IF not sameAsStored WHILE order.status != "new"
                THEN SHALL reject request with ORD_REPLAY

  [ORD_ONCE]    WHILE order.status != "new"
                WHEN SubmitOrder AND sameAsStored
                SHALL succeed-empty

  [ORD_SUBMIT]  WHILE order.status == "new"
                WHEN SubmitOrder
                  AND orderId == order.id
                  AND validAccounts AND validAmount
                  AND (order.source is empty or matchesOriginal)
                SHALL transition order.status -> "requested"
                  AND emit OrderSubmitted
                post:
                  order.status' = "requested"
                  order.amount' = amount
`;

const CN_STYLE_A = `
切片 LedgerOrder.SubmitOrder

定义:
  金额合法     = amount.currency == "CNY" 且 amount.amount > 0.00
  账户不同     = sourceAccountId != targetAccountId
  重入一致     = opId == order.opId 且 amount == order.amount
  外部判定 与原单一致

公理:
  [AX-1] 恒成立 order.status 属于 {"new", "requested", "settled", "canceled"}

规则:
  [ORD_ID]      如果 orderId != order.id
                则 必须 拒绝请求，返回 ORD_ID

  [ORD_ACCTS]   如果 不满足 账户不同
                则 必须 拒绝请求，返回 ORD_ACCTS

  [ORD_AMOUNT]  如果 不满足 金额合法
                则 必须 拒绝请求，返回 ORD_AMOUNT

  [ORD_REPLAY]  当处于 order.status != "new"
                如果 不满足 重入一致
                则 必须 拒绝请求，返回 ORD_REPLAY

  [ORD_ONCE]    当处于 order.status != "new"
                当收到 SubmitOrder 且 重入一致
                必须 幂等空成功

  [ORD_SUBMIT]  当处于 order.status == "new"
                当收到 SubmitOrder
                  且 orderId == order.id
                  且 账户不同 且 金额合法
                  且 (order.source 为 空 或 与原单一致)
                必须 状态变为 order.status -> "requested"
                  且 发射 OrderSubmitted
                变更后:
                  order.status' = "requested"
                  order.amount' = amount
`;

const EN_STYLE_C = `
slice LedgerOrder.RequestRefund {
  define paidOk      = txId == order.selectedTxId and order.results[txId] == "succeeded"
  define rejectedOk  = order.externalStatus == "rejected"
  define hasRefund   = order.refundOpId is non-empty

  rule [REF_ID]     { if orderId != order.id then reject request with REF_ID }
  rule [REF_PAID]   { if not paidOk          then reject request with REF_PAID }
  rule [REF_ONCE]   {
    while hasRefund
    when RequestRefund and paidOk and rejectedOk
    then succeed-empty
  }
  rule [REF_START]  {
    while not hasRefund
    when RequestRefund and orderId == order.id and paidOk and rejectedOk
    then emit RefundRequested and transition order.refundOutcome -> "pending"
  }
}
`;

const CN_STYLE_C = `
切片 LedgerOrder.RequestRefund {
  定义 已付款   = txId == order.selectedTxId 且 order.results[txId] == "succeeded"
  定义 外部拒绝 = order.externalStatus == "rejected"
  定义 已有退款 = order.refundOpId 为 非空

  规则 [REF_ID]     { 如果 orderId != order.id 则 拒绝请求，返回 REF_ID }
  规则 [REF_PAID]   { 如果 不满足 已付款        则 拒绝请求，返回 REF_PAID }
  规则 [REF_ONCE]   {
    当处于 已有退款
    当收到 RequestRefund 且 已付款 且 外部拒绝
    必须 幂等空成功
  }
  规则 [REF_START]  {
    当处于 不满足 已有退款
    当收到 RequestRefund 且 orderId == order.id 且 已付款 且 外部拒绝
    必须 发射 RefundRequested 且 状态变为 order.refundOutcome -> "pending"
  }
}
`;

test('EN and CN Style A specs compile to 100% identical canonical AST and hash', () => {
  const en = normalizeEars(parseEars(EN_STYLE_A, { file: 'en.ears' }));
  const cn = normalizeEars(parseEars(CN_STYLE_A, { file: 'cn.ears' }));
  assert.equal(en.diagnostics.length, 0);
  assert.equal(cn.diagnostics.length, 0);
  assert.deepEqual(en.canonicalForm, cn.canonicalForm);
  assert.equal(en.canonicalSha256, cn.canonicalSha256);
  assert.equal(en.theory.logic, 'QF_AUFLIA');
  assert.equal(en.theory.tier, 'L1');
  assert.equal(en.theory.externCount, 1);
});

test('EN and CN Style C block specs compile to 100% identical canonical AST', () => {
  const en = normalizeEars(parseEars(EN_STYLE_C, { file: 'en-c.ears' }));
  const cn = normalizeEars(parseEars(CN_STYLE_C, { file: 'cn-c.ears' }));
  assert.equal(en.style, 'C');
  assert.equal(cn.style, 'C');
  assert.equal(en.diagnostics.length, 0);
  assert.equal(cn.diagnostics.length, 0);
  assert.deepEqual(en.canonicalForm, cn.canonicalForm);
  assert.equal(en.canonicalSha256, cn.canonicalSha256);
});

test('supports intervals, nonlinear QF_NIA classification, multi-command BMC, and application stories', () => {
  const quotaEn = normalizeEars(parseEars(`
slice QuotaPool.ReserveQuota
where:
  validAmount = amount in [quota.minLimit..quota.maxLimit] as "in single range"
  withinCap   = quota.used + amount <= quota.cap           as "within total cap"
axioms:
  [AX-Q1] ALWAYS quota.used <= quota.cap
rules:
  [Q_RANGE] IF not validAmount THEN SHALL reject request with Q_RANGE
  [Q_CAP]   IF not withinCap   THEN SHALL reject request with Q_CAP
  [Q_OK]    WHILE validAmount and withinCap WHEN ReserveQuota SHALL emit QuotaReserved
            post:
              quota.used' = quota.used + amount
              quota.perUser'[userId] = quota.perUser[userId] + amount
`));
  assert.equal(quotaEn.diagnostics.length, 0);
  assert.equal(quotaEn.theory.logic, 'QF_AUFLIA');

  const nia = normalizeEars(parseEars(`
slice AssetOrder.ConfirmUnits
where:
  validPrice = price > 0.0000
  exactFloor = units >= 0 and units * price <= order.netAmount and (units + 1) * price > order.netAmount
rules:
  [BAD_PRICE] IF not validPrice THEN SHALL reject request with BAD_PRICE
  [BAD_UNITS] IF not exactFloor THEN SHALL reject request with BAD_UNITS
  [CONFIRMED] WHILE order.paid == true WHEN ConfirmUnits AND validPrice AND exactFloor SHALL emit UnitsConfirmed
`));
  assert.equal(nia.theory.logic, 'QF_NIA');
  assert.equal(nia.theory.tier, 'L2');
  assert.equal(nia.theory.timeoutSec, 2);

  const storyEn = normalizeEars(parseEars(`
story CashSubmitFlow layer application
where:
  validSubmit = amount.currency == "CNY" and amount.amount > 0.00
  extern sessionOk(principal)
  extern existsReq(principal, reqId)
  extern matchesReq(principal, reqId, itemCode, amount)
axioms:
  [AX-APP-1] ALWAYS SubmitForm SHALL NOT supply opId, acctA, acctB
rules:
  [US-1] IF not sessionOk(principal) WHEN SubmitPort.submit THEN SHALL reject request with UNAUTH
  [US-2] WHILE not existsReq(principal, reqId)
         WHEN SubmitPort.submit AND sessionOk(principal) AND validSubmit
         SHALL pin OriginalReq from (principal, reqId)
           AND dispatch LedgerOrder.SubmitOrder
           AND respond SubmitAck with ack.replayed == false and ack.accepted == true
  [US-3] WHILE existsReq(principal, reqId)
         WHEN SubmitPort.submit AND matchesReq(principal, reqId, itemCode, amount)
         SHALL respond SubmitAck with ack.replayed == true
           AND SHALL NOT dispatch LedgerOrder.SubmitOrder
  [US-4] WHILE order.paid == true and order.confirmed == false
         WHEN OrderQuery.get
         SHALL expose order-view as view.paid == true and view.finalized == false
`));
  const storyCn = normalizeEars(parseEars(`
故事 CashSubmitFlow layer application
定义:
  提交合法 = amount.currency == "CNY" 且 amount.amount > 0.00
  外部判定 会话有效(principal)
  外部判定 请求存在(principal, reqId)
  外部判定 参数一致(principal, reqId, itemCode, amount)
公理:
  [AX-APP-1] 恒成立 禁止 SubmitForm 携带 opId, acctA, acctB
规则:
  [US-1] 如果 不满足 会话有效(principal) 当收到 SubmitPort.submit 则 必须 拒绝请求，返回 UNAUTH
  [US-2] 当处于 不满足 请求存在(principal, reqId)
         当收到 SubmitPort.submit 且 会话有效(principal) 且 提交合法
         必须 固定 OriginalReq from (principal, reqId)
           且 派发 LedgerOrder.SubmitOrder
           且 响应 SubmitAck with ack.replayed == false 且 ack.accepted == true
  [US-3] 当处于 请求存在(principal, reqId)
         当收到 SubmitPort.submit 且 参数一致(principal, reqId, itemCode, amount)
         必须 响应 SubmitAck with ack.replayed == true
           且 禁止 派发 LedgerOrder.SubmitOrder
  [US-4] 当处于 order.paid == true 且 order.confirmed == false
         当收到 OrderQuery.get
         必须 展示 order-view as view.paid == true 且 view.finalized == false
`));
  assert.equal(storyEn.diagnostics.length, 0);
  assert.equal(storyCn.diagnostics.length, 0);
  assert.deepEqual(storyEn.canonicalForm, storyCn.canonicalForm);
  assert.equal(storyEn.canonicalSha256, storyCn.canonicalSha256);
});

test('rejects negative predicate naming in both EN and CN', () => {
  const badEn = normalizeEars(parseEars(`
slice LedgerOrder.Submit
where:
  invalidAmount = amount <= 0
rules:
  [R1] IF invalidAmount THEN SHALL reject request with R1
`));
  assert.ok(badEn.diagnostics.some(d => d.code === 'EARS_NEG_PRED_NAME'));

  const badCn = normalizeEars(parseEars(`
切片 LedgerOrder.Submit
定义:
  未支付 = order.status != "paid"
规则:
  [R1] 如果 未支付 则 必须 拒绝请求，返回 R1
`));
  assert.ok(badCn.diagnostics.some(d => d.code === 'EARS_NEG_PRED_NAME'));
});
