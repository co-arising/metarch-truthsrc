// Generic S1 Architecture-Style Protocol Conformance & Fault-Injection TCK (TCK-01..TCK-08).
// Verifies any three-phase-reconcile EffectProtocolAdapter against timeouts, duplicate replays,
// payload tampering, late-confirmed partial failures, absence-proof-only compensation, crash recovery,
// and out-of-order/duplicate receipts.

function makeHarness(adapterFactory, initialExternalMode = 'CONFIRMED') {
  const store = new Map();
  let externalMode = initialExternalMode;
  let queryMode = initialExternalMode;
  let externalExecuteCalls = 0;
  let compensationCalls = 0;
  let confirmedCallbacks = 0;

  const durableStore = {
    get(key) { return store.has(key) ? structuredClone(store.get(key)) : null; },
    put(key, record) { store.set(key, structuredClone(record)); },
    listPending() {
      const out = [];
      for (const [k, v] of store.entries()) {
        if (v.status === 'PENDING_RECONCILE' || v.status === 'PINNED') {
          out.push({ key: k, record: structuredClone(v) });
        }
      }
      return out;
    },
  };

  const externalGateway = {
    execute(key, payload) {
      externalExecuteCalls += 1;
      if (externalMode === 'TIMEOUT') return { outcome: 'UNKNOWN_TIMEOUT' };
      if (externalMode === 'REJECTED') return { outcome: 'REJECTED', reason: 'REMOTE_REJECT' };
      return { outcome: 'CONFIRMED', receiptId: `rcpt:${key}`, payload };
    },
    queryStatus(key) {
      if (queryMode === 'ABSENT') return { status: 'ABSENT', absenceProof: `proof:absent:${key}` };
      if (queryMode === 'CONFIRMED') return { status: 'CONFIRMED', receiptId: `rcpt:${key}` };
      if (queryMode === 'REJECTED') return { status: 'REJECTED', reason: 'REMOTE_REJECT' };
      return { status: 'UNKNOWN' };
    },
  };

  const downstream = {
    recordConfirmed() { confirmedCallbacks += 1; },
    triggerCompensation() { compensationCalls += 1; },
  };

  const buildAdapter = () => adapterFactory({ store: durableStore, external: externalGateway, downstream });

  return {
    buildAdapter,
    setExternalMode(m) { externalMode = m; },
    setQueryMode(m) { queryMode = m; },
    stats() { return { externalExecuteCalls, compensationCalls, confirmedCallbacks, storeSize: store.size }; },
  };
}

function runCheck(id, title, fn) {
  try {
    fn();
    return { id, title, passed: true, error: null };
  } catch (err) {
    return { id, title, passed: false, error: err?.message ?? String(err) };
  }
}

function assertCond(cond, msg) {
  if (!cond) throw new Error(msg);
}

export function runThreePhaseEffectTck(adapterFactory) {
  const results = [];

  results.push(runCheck('TCK-01-HAPPY-ONCE', 'First submission pins and executes external side effect exactly once', () => {
    const h = makeHarness(adapterFactory, 'CONFIRMED');
    const adapter = h.buildAdapter();
    const res = adapter.submit('k-1', { amount: '100.00', currency: 'CNY' });
    assertCond(res.ok === true && res.status === 'CONFIRMED', `expected CONFIRMED, got ${JSON.stringify(res)}`);
    assertCond(res.replayed === false, 'first submit must not be marked replayed');
    assertCond(h.stats().externalExecuteCalls === 1, `expected 1 execute call, got ${h.stats().externalExecuteCalls}`);
    assertCond(h.stats().compensationCalls === 0, 'happy path must never trigger compensation');
  }));

  results.push(runCheck('TCK-02-DUPLICATE-REPLAY', 'Identical replay executes 0 additional external side effects', () => {
    const h = makeHarness(adapterFactory, 'CONFIRMED');
    const adapter = h.buildAdapter();
    adapter.submit('k-2', { amount: '200.00', currency: 'CNY' });
    const replay = adapter.submit('k-2', { amount: '200.00', currency: 'CNY' });
    assertCond(replay.ok === true && replay.replayed === true, `expected replayed ok, got ${JSON.stringify(replay)}`);
    assertCond(h.stats().externalExecuteCalls === 1, `replay must not re-execute external call; got ${h.stats().externalExecuteCalls}`);
  }));

  results.push(runCheck('TCK-03-CONFLICT-PAYLOAD', 'Same key with mutated payload is rejected with 0 extra side effects', () => {
    const h = makeHarness(adapterFactory, 'CONFIRMED');
    const adapter = h.buildAdapter();
    adapter.submit('k-3', { amount: '300.00', currency: 'CNY' });
    const conflict = adapter.submit('k-3', { amount: '999.00', currency: 'CNY' });
    assertCond(conflict.ok === false && conflict.code === 'PAYLOAD_CONFLICT', `expected PAYLOAD_CONFLICT, got ${JSON.stringify(conflict)}`);
    assertCond(h.stats().externalExecuteCalls === 1, 'conflict must not trigger extra external execution');
  }));

  results.push(runCheck('TCK-04-TIMEOUT-NO-BLIND-COMPENSATION', 'Timeout/unknown outcome enters PENDING_RECONCILE with 0 blind compensations', () => {
    const h = makeHarness(adapterFactory, 'TIMEOUT');
    const adapter = h.buildAdapter();
    const res = adapter.submit('k-4', { amount: '400.00', currency: 'CNY' });
    assertCond(res.ok === true && res.status === 'PENDING_RECONCILE', `expected PENDING_RECONCILE, got ${JSON.stringify(res)}`);
    assertCond(h.stats().compensationCalls === 0, `timeout must NEVER trigger blind compensation; got ${h.stats().compensationCalls}`);
  }));

  results.push(runCheck('TCK-05-RECONCILE-ABSENCE-PROOF', 'Compensation fires at most once and ONLY upon explicit ABSENT proof', () => {
    const h = makeHarness(adapterFactory, 'TIMEOUT');
    h.setQueryMode('UNKNOWN');
    const adapter = h.buildAdapter();
    adapter.submit('k-5', { amount: '500.00', currency: 'CNY' });

    const rUnknown = adapter.reconcile('k-5');
    assertCond(rUnknown.status === 'PENDING_RECONCILE', `UNKNOWN reconcile must stay PENDING_RECONCILE, got ${JSON.stringify(rUnknown)}`);
    assertCond(h.stats().compensationCalls === 0, 'UNKNOWN reconcile must not compensate');

    h.setQueryMode('ABSENT');
    const rAbsent1 = adapter.reconcile('k-5');
    const rAbsent2 = adapter.reconcile('k-5');
    assertCond(rAbsent1.status === 'COMPENSATED', `ABSENT reconcile must converge to COMPENSATED, got ${JSON.stringify(rAbsent1)}`);
    assertCond(rAbsent2.status === 'COMPENSATED', 'second reconcile must stay COMPENSATED');
    assertCond(h.stats().compensationCalls === 1, `compensation must fire at most once; got ${h.stats().compensationCalls}`);
  }));

  results.push(runCheck('TCK-06-RECONCILE-CONFIRMED-LATE', 'Partial failure (timeout locally, confirmed remotely) converges to CONFIRMED with 0 compensations', () => {
    const h = makeHarness(adapterFactory, 'TIMEOUT');
    h.setQueryMode('CONFIRMED');
    const adapter = h.buildAdapter();
    adapter.submit('k-6', { amount: '600.00', currency: 'CNY' });
    const rec = adapter.reconcile('k-6');
    assertCond(rec.status === 'CONFIRMED', `expected late CONFIRMED, got ${JSON.stringify(rec)}`);
    assertCond(h.stats().externalExecuteCalls === 1, 'late-confirmed reconcile must not re-execute');
    assertCond(h.stats().compensationCalls === 0, 'late-confirmed reconcile must not compensate');
    assertCond(h.stats().confirmedCallbacks === 1, `expected 1 confirmed callback, got ${h.stats().confirmedCallbacks}`);
  }));

  results.push(runCheck('TCK-07-CRASH-RECOVERY-ZERO-NEW-AUTH', 'Crash recovery advances only pinned pending records and mints 0 new authorizations', () => {
    const h = makeHarness(adapterFactory, 'TIMEOUT');
    const beforeCrash = h.buildAdapter();
    beforeCrash.submit('k-7', { amount: '700.00', currency: 'CNY' });

    // Simulate process crash & fresh adapter reconstruction over same durable store
    h.setQueryMode('CONFIRMED');
    const afterCrash = h.buildAdapter();
    const recUnknown = afterCrash.reconcile('unpinned-rogue-key');
    assertCond(recUnknown.ok === false && recUnknown.code === 'UNKNOWN_ORIGINAL', `recovery must reject unpinned key, got ${JSON.stringify(recUnknown)}`);
    const recovered = afterCrash.recoverAll();
    assertCond(recovered.recoveredCount === 1, `expected 1 recovered record, got ${JSON.stringify(recovered)}`);
    assertCond(h.stats().externalExecuteCalls === 1, 'recovery must never execute new external authorizations');
    assertCond(h.stats().confirmedCallbacks === 1, 'recovery must converge pinned record');
  }));

  results.push(runCheck('TCK-08-OUT-OF-ORDER-DUPLICATE-RECEIPT', 'Duplicate or stale receipt after terminal state is ignored idempotently', () => {
    const h = makeHarness(adapterFactory, 'CONFIRMED');
    const adapter = h.buildAdapter();
    adapter.submit('k-8', { amount: '800.00', currency: 'CNY' });
    const dup = adapter.ingestReceipt('k-8', { outcome: 'CONFIRMED', receiptId: 'rcpt:k-8' });
    const staleReject = adapter.ingestReceipt('k-8', { outcome: 'REJECTED', reason: 'LATE_NOISE' });
    assertCond(dup.ok === true && dup.status === 'CONFIRMED', 'duplicate receipt must stay CONFIRMED');
    assertCond(staleReject.status === 'CONFIRMED', 'stale reject receipt must not revert terminal CONFIRMED state');
    assertCond(h.stats().confirmedCallbacks === 1, `duplicate receipt must not double-count confirmed callback; got ${h.stats().confirmedCallbacks}`);
    assertCond(h.stats().compensationCalls === 0, 'stale reject after confirmed must not trigger compensation');
  }));

  const passed = results.every(r => r.passed);
  return {
    schemaVersion: 'co-arising.effect-tck/v2',
    protocol: 'three-phase-reconcile',
    passed,
    total: results.length,
    passedCount: results.filter(r => r.passed).length,
    failedIds: results.filter(r => !r.passed).map(r => r.id),
    results,
  };
}
