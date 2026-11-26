import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEars } from '../lib/ears/parser.mjs';
import { normalizeEars } from '../lib/ears/normalize.mjs';
import { bindEarsSpec, buildSymbolTableFromCompiled } from '../lib/ears/binder.mjs';

function makeGenericSymbolTable() {
  const canonical = {
    aggregates: [
      {
        name: 'QuotaPool',
        commands: [{ name: 'ReserveQuota', produces: ['QuotaReserved'] }],
        events: [{ name: 'QuotaReserved' }],
        aggregateRuleRefs: [
          { ruleId: 'Q_RANGE', errCode: 'Q_RANGE', desc: 'amount within single limit' },
          { ruleId: 'Q_CAP', errCode: 'Q_CAP', desc: 'amount within total cap' },
        ],
      },
    ],
    stories: [{ name: 'CashSubmitFlow', id: 'cash-submit-flow' }],
    readModels: [{ name: 'order-view' }],
  };
  const layout = {
    contexts: ['demo'],
    declarations: [
      { ref: { context: 'demo', kind: 'aggregate', owner: [], id: 'QuotaPool' }, valueType: null },
      { ref: { context: 'demo', kind: 'state-field', owner: ['QuotaPool'], id: 'minLimit' }, valueType: { form: 'primitive', name: 'decimal' } },
      { ref: { context: 'demo', kind: 'state-field', owner: ['QuotaPool'], id: 'maxLimit' }, valueType: { form: 'primitive', name: 'decimal' } },
      { ref: { context: 'demo', kind: 'state-field', owner: ['QuotaPool'], id: 'totalUsed' }, valueType: { form: 'primitive', name: 'decimal' } },
      { ref: { context: 'demo', kind: 'state-field', owner: ['QuotaPool'], id: 'totalCap' }, valueType: { form: 'primitive', name: 'decimal' } },
      {
        ref: { context: 'demo', kind: 'state-field', owner: ['QuotaPool'], id: 'accountUsed' },
        valueType: { form: 'map', key: { form: 'primitive', name: 'string' }, value: { form: 'primitive', name: 'decimal' } },
      },
      { ref: { context: 'demo', kind: 'command', owner: ['QuotaPool'], id: 'ReserveQuota' }, valueType: null },
      { ref: { context: 'demo', kind: 'parameter', owner: ['QuotaPool', 'ReserveQuota'], id: 'accountId' }, valueType: { form: 'primitive', name: 'string' } },
      { ref: { context: 'demo', kind: 'parameter', owner: ['QuotaPool', 'ReserveQuota'], id: 'amount' }, valueType: { form: 'primitive', name: 'decimal' } },
      { ref: { context: 'demo', kind: 'event', owner: ['QuotaPool'], id: 'QuotaReserved' }, valueType: null },
    ],
  };
  return buildSymbolTableFromCompiled({ canonical, layout, exactTypes: [] });
}

test('binds valid EARS slice against truthsrc symbol table with zero errors', () => {
  const sym = makeGenericSymbolTable();
  const norm = normalizeEars(parseEars(`
slice QuotaPool.ReserveQuota
where:
  validAmount = amount in [pool.minLimit..pool.maxLimit]
  withinCap   = pool.totalUsed + amount <= pool.totalCap
axioms:
  [AX-1] ALWAYS pool.totalUsed <= pool.totalCap
  [AX-2] ALWAYS pool.accountUsed[accountId] <= pool.totalCap
rules:
  [Q_RANGE] IF not validAmount THEN SHALL reject request with Q_RANGE
  [Q_CAP]   IF not withinCap   THEN SHALL reject request with Q_CAP
  [Q_OK]    WHILE validAmount and withinCap WHEN ReserveQuota SHALL emit QuotaReserved
            post:
              pool.totalUsed' = pool.totalUsed + amount
              pool.accountUsed'[accountId] = pool.accountUsed[accountId] + amount
`));
  const bound = bindEarsSpec(norm, sym, { strictRuleRefs: true });
  assert.equal(bound.bound, true);
  assert.deepEqual(bound.diagnostics, []);
});

test('reports unknown state fields, unknown events, and unanchored rule IDs', () => {
  const sym = makeGenericSymbolTable();
  const norm = normalizeEars(parseEars(`
slice QuotaPool.ReserveQuota
rules:
  [UNREGISTERED_CODE] IF pool.nonExistentField > 0 THEN SHALL reject request with UNREGISTERED_CODE
  [Q_OK]              WHILE amount > 0 WHEN ReserveQuota SHALL emit GhostEvent
`));
  const bound = bindEarsSpec(norm, sym, { strictRuleRefs: true });
  const codes = bound.diagnostics.map(d => d.code);
  assert.ok(codes.includes('EARS_UNKNOWN_SYMBOL'));
  assert.ok(codes.includes('EARS_UNANCHORED_RULE_ID'));
  assert.ok(codes.includes('EARS_UNKNOWN_EVENT'));
});
