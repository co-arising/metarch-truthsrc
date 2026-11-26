import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEars } from '../lib/ears/parser.mjs';
import { normalizeEars } from '../lib/ears/normalize.mjs';
import { projectStyleE } from '../lib/ears/project-ac.mjs';
import { projectStyleB } from '../lib/ears/project-table.mjs';

const QUOTA_SPEC = `
slice QuotaPool.ReserveQuota

where:
  validAmount   = amount in [pool.minLimit..pool.maxLimit]             as "单笔金额在合法区间内"
  withinPoolCap = pool.totalUsed + amount <= pool.totalCap             as "在池总门限内"
  withinAcctCap = pool.accountUsed[accountId] + amount <= pool.acctCap as "在单账户总门限内"

axioms:
  [AX-Q-1] ALWAYS pool.totalUsed <= pool.totalCap

rules:
  [Q_RANGE] IF not validAmount   THEN SHALL reject request with Q_RANGE
  [Q_POOL]  IF not withinPoolCap THEN SHALL reject request with Q_POOL
  [Q_ACCT]  IF not withinAcctCap THEN SHALL reject request with Q_ACCT
  [Q_OK]    WHILE validAmount and withinPoolCap and withinAcctCap
            WHEN ReserveQuota
            SHALL emit QuotaReserved
            post:
              pool.totalUsed' = pool.totalUsed + amount
`;

test('projects Style E PM-friendly AC deterministically with phrases and read-only header', () => {
  const norm = normalizeEars(parseEars(QUOTA_SPEC, { file: 'quota.ears' }));
  const ac1 = projectStyleE(norm, { sourceFile: 'quota.ears', sourceText: QUOTA_SPEC, lang: 'zh' });
  const ac2 = projectStyleE(norm, { sourceFile: 'quota.ears', sourceText: QUOTA_SPEC, lang: 'zh' });
  assert.equal(ac1.content, ac2.content);
  assert.match(ac1.content, /READ-ONLY PROJECTION — DO NOT EDIT/);
  assert.match(ac1.content, /AC-1 `\[Q_RANGE\]`.*不满足“单笔金额在合法区间内”.*拒绝请求并返回 `Q_RANGE`/);
  assert.match(ac1.content, /AC-4 `\[Q_OK\]`.*发射事件 `QuotaReserved`/);
});

test('projects Style B DMN decision table with condition columns and outcomes', () => {
  const norm = normalizeEars(parseEars(QUOTA_SPEC, { file: 'quota.ears' }));
  const tbl = projectStyleB(norm, { sourceFile: 'quota.ears', sourceText: QUOTA_SPEC });
  assert.match(tbl.content, /READ-ONLY DMN TABLE — DO NOT EDIT/);
  assert.match(tbl.content, /\| Rule ID \| `validAmount` \| `withinPoolCap` \| `withinAcctCap` \| Outcome \|/);
  assert.match(tbl.content, /\| `Q_RANGE` \| `false` \| any \| any \| `reject request with Q_RANGE` \|/);
  assert.match(tbl.content, /\| `Q_OK` \| `true` \| `true` \| `true` \| `emit QuotaReserved \+ post: pool\.totalUsed'` \|/);
});
