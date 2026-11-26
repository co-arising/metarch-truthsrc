// Generic S1 Architecture-Style Protocol Conformance & Fault-Injection TCK Suites for co-arising 2.0:
//   1. three-phase-reconcile (TCK-01..08)
//   2. transactional-outbox  (OUTBOX-01..05)
//   3. saga-compensation     (SAGA-01..05)
//   4. idempotent-consumer   (IDEMP-01..05)
// Supports both Node.js ESM/TS adapters and Scala/JVM adapters compiled & driven via NDJSON stdio IPC.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { detectScalaToolchain } from './verify-gate.mjs';

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

function formatTckReport(protocol, results, extra = {}) {
  const passed = results.every(r => r.passed);
  return {
    schemaVersion: 'co-arising.effect-tck/v2',
    protocol,
    passed,
    total: results.length,
    passedCount: results.filter(r => r.passed).length,
    failedIds: results.filter(r => !r.passed).map(r => r.id),
    ...extra,
    results,
  };
}

// ---------------------------------------------------------------------------
// Protocol 1: three-phase-reconcile (TCK-01..08)
// ---------------------------------------------------------------------------
function makeThreePhaseHarness(adapterFactory, initialExternalMode = 'CONFIRMED') {
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

export function runThreePhaseEffectTck(adapterFactory) {
  const results = [];

  results.push(runCheck('TCK-01-HAPPY-ONCE', 'First submission pins and executes external side effect exactly once', () => {
    const h = makeThreePhaseHarness(adapterFactory, 'CONFIRMED');
    const adapter = h.buildAdapter();
    const res = adapter.submit('k-1', { amount: '100.00', currency: 'CNY' });
    assertCond(res.ok === true && res.status === 'CONFIRMED', `expected CONFIRMED, got ${JSON.stringify(res)}`);
    assertCond(res.replayed === false, 'first submit must not be marked replayed');
    assertCond(h.stats().externalExecuteCalls === 1, `expected 1 execute call, got ${h.stats().externalExecuteCalls}`);
    assertCond(h.stats().compensationCalls === 0, 'happy path must never trigger compensation');
  }));

  results.push(runCheck('TCK-02-DUPLICATE-REPLAY', 'Identical replay executes 0 additional external side effects', () => {
    const h = makeThreePhaseHarness(adapterFactory, 'CONFIRMED');
    const adapter = h.buildAdapter();
    adapter.submit('k-2', { amount: '200.00', currency: 'CNY' });
    const replay = adapter.submit('k-2', { amount: '200.00', currency: 'CNY' });
    assertCond(replay.ok === true && replay.replayed === true, `expected replayed ok, got ${JSON.stringify(replay)}`);
    assertCond(h.stats().externalExecuteCalls === 1, `replay must not re-execute external call; got ${h.stats().externalExecuteCalls}`);
  }));

  results.push(runCheck('TCK-03-CONFLICT-PAYLOAD', 'Same key with mutated payload is rejected with 0 extra side effects', () => {
    const h = makeThreePhaseHarness(adapterFactory, 'CONFIRMED');
    const adapter = h.buildAdapter();
    adapter.submit('k-3', { amount: '300.00', currency: 'CNY' });
    const conflict = adapter.submit('k-3', { amount: '999.00', currency: 'CNY' });
    assertCond(conflict.ok === false && conflict.code === 'PAYLOAD_CONFLICT', `expected PAYLOAD_CONFLICT, got ${JSON.stringify(conflict)}`);
    assertCond(h.stats().externalExecuteCalls === 1, 'conflict must not trigger extra external execution');
  }));

  results.push(runCheck('TCK-04-TIMEOUT-NO-BLIND-COMPENSATION', 'Timeout/unknown outcome enters PENDING_RECONCILE with 0 blind compensations', () => {
    const h = makeThreePhaseHarness(adapterFactory, 'TIMEOUT');
    const adapter = h.buildAdapter();
    const res = adapter.submit('k-4', { amount: '400.00', currency: 'CNY' });
    assertCond(res.ok === true && res.status === 'PENDING_RECONCILE', `expected PENDING_RECONCILE, got ${JSON.stringify(res)}`);
    assertCond(h.stats().compensationCalls === 0, `timeout must NEVER trigger blind compensation; got ${h.stats().compensationCalls}`);
  }));

  results.push(runCheck('TCK-05-RECONCILE-ABSENCE-PROOF', 'Compensation fires at most once and ONLY upon explicit ABSENT proof', () => {
    const h = makeThreePhaseHarness(adapterFactory, 'TIMEOUT');
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
    const h = makeThreePhaseHarness(adapterFactory, 'TIMEOUT');
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
    const h = makeThreePhaseHarness(adapterFactory, 'TIMEOUT');
    const beforeCrash = h.buildAdapter();
    beforeCrash.submit('k-7', { amount: '700.00', currency: 'CNY' });

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
    const h = makeThreePhaseHarness(adapterFactory, 'CONFIRMED');
    const adapter = h.buildAdapter();
    adapter.submit('k-8', { amount: '800.00', currency: 'CNY' });
    const dup = adapter.ingestReceipt('k-8', { outcome: 'CONFIRMED', receiptId: 'rcpt:k-8' });
    const staleReject = adapter.ingestReceipt('k-8', { outcome: 'REJECTED', reason: 'LATE_NOISE' });
    assertCond(dup.ok === true && dup.status === 'CONFIRMED', 'duplicate receipt must stay CONFIRMED');
    assertCond(staleReject.status === 'CONFIRMED', 'stale reject receipt must not revert terminal CONFIRMED state');
    assertCond(h.stats().confirmedCallbacks === 1, `duplicate receipt must not double-count confirmed callback; got ${h.stats().confirmedCallbacks}`);
    assertCond(h.stats().compensationCalls === 0, 'stale reject after confirmed must not trigger compensation');
  }));

  return formatTckReport('three-phase-reconcile', results);
}

// ---------------------------------------------------------------------------
// Protocol 2: transactional-outbox (OUTBOX-01..05)
// ---------------------------------------------------------------------------
function makeOutboxHarness(adapterFactory) {
  let domainRows = new Map();
  let outboxRows = new Map();
  let failBrokerKeys = new Set();
  const published = [];
  const deadLetters = [];

  const txStore = {
    runInTransaction(fn) {
      const domSnap = structuredClone(domainRows);
      const outSnap = structuredClone(outboxRows);
      try {
        return fn({
          saveDomain(id, data) { domainRows.set(id, structuredClone(data)); },
          insertOutbox(id, event) { outboxRows.set(id, { id, event: structuredClone(event), status: 'PENDING', attempts: 0 }); },
        });
      } catch (err) {
        domainRows = domSnap;
        outboxRows = outSnap;
        throw err;
      }
    },
    listPendingOutbox() {
      return [...outboxRows.values()].filter(r => r.status === 'PENDING').map(r => structuredClone(r));
    },
    markPublished(id) {
      const r = outboxRows.get(id);
      if (r) outboxRows.set(id, { ...r, status: 'PUBLISHED' });
    },
    recordAttempt(id, deadLetter = false) {
      const r = outboxRows.get(id);
      if (!r) return 0;
      const attempts = r.attempts + 1;
      outboxRows.set(id, { ...r, attempts, status: deadLetter ? 'DEAD_LETTER' : 'PENDING' });
      if (deadLetter) deadLetters.push(id);
      return attempts;
    },
  };

  const broker = {
    publish(id, event) {
      if (failBrokerKeys.has(id)) return { ok: false, error: 'BROKER_ERROR' };
      published.push({ id, event: structuredClone(event) });
      return { ok: true };
    },
  };

  return {
    buildAdapter: () => adapterFactory({ txStore, broker, maxRetries: 2 }),
    setFailKeys(keys) { failBrokerKeys = new Set(keys); },
    stats: () => ({
      domainCount: domainRows.size,
      outboxCount: outboxRows.size,
      publishedCount: published.length,
      deadLetters: [...deadLetters],
    }),
  };
}

export function runTransactionalOutboxTck(adapterFactory) {
  const results = [];

  results.push(runCheck('OUTBOX-01-ATOMIC-COMMIT', 'Domain state and outbox row commit atomically in one transaction', () => {
    const h = makeOutboxHarness(adapterFactory);
    const adapter = h.buildAdapter();
    const res = adapter.writeAndEnqueue('e-1', { aggregate: 'A' }, { type: 'Created' });
    assertCond(res.ok === true, `expected ok write, got ${JSON.stringify(res)}`);
    assertCond(h.stats().domainCount === 1 && h.stats().outboxCount === 1, 'domain and outbox must commit together');
  }));

  results.push(runCheck('OUTBOX-02-ROLLBACK-ZERO-LEAK', 'Transaction failure rolls back both domain write and outbox row with 0 broker publishes', () => {
    const h = makeOutboxHarness(adapterFactory);
    const adapter = h.buildAdapter();
    const res = adapter.writeAndEnqueue('e-2', { aggregate: 'B', forceFail: true }, { type: 'ShouldNotExist' });
    assertCond(res.ok === false, 'failed transaction must return ok=false');
    assertCond(h.stats().domainCount === 0 && h.stats().outboxCount === 0, 'rollback must leave 0 domain & 0 outbox rows');
    assertCond(h.stats().publishedCount === 0, 'rollback must publish 0 events');
  }));

  results.push(runCheck('OUTBOX-03-CRASH-RELAY-RECOVERY', 'Crash before relay leaves pending row recovered on restart exactly once', () => {
    const h = makeOutboxHarness(adapterFactory);
    const beforeCrash = h.buildAdapter();
    beforeCrash.writeAndEnqueue('e-3', { aggregate: 'C' }, { type: 'Saved' });
    assertCond(h.stats().publishedCount === 0, 'write must not bypass outbox relay');

    const afterCrash = h.buildAdapter();
    const r1 = afterCrash.relayPending();
    const r2 = afterCrash.relayPending();
    assertCond(r1.published === 1, `expected 1 relayed event, got ${JSON.stringify(r1)}`);
    assertCond(r2.published === 0, 'second relay must be idempotent no-op');
    assertCond(h.stats().publishedCount === 1, 'exactly-once publish after crash recovery');
  }));

  results.push(runCheck('OUTBOX-04-POISON-ISOLATION', 'Poison outbox message dead-letters after maxRetries without blocking healthy rows', () => {
    const h = makeOutboxHarness(adapterFactory);
    h.setFailKeys(['e-poison']);
    const adapter = h.buildAdapter();
    adapter.writeAndEnqueue('e-poison', { aggregate: 'P' }, { type: 'Bad' });
    adapter.writeAndEnqueue('e-ok', { aggregate: 'G' }, { type: 'Good' });
    adapter.relayPending();
    adapter.relayPending();
    assertCond(h.stats().publishedCount === 1, `healthy row must still publish; got ${h.stats().publishedCount}`);
    assertCond(h.stats().deadLetters.includes('e-poison'), 'poison row must move to DEAD_LETTER after maxRetries');
  }));

  results.push(runCheck('OUTBOX-05-DUPLICATE-ENQUEUE', 'Duplicate event ID does not create duplicate broker publishes', () => {
    const h = makeOutboxHarness(adapterFactory);
    const adapter = h.buildAdapter();
    adapter.writeAndEnqueue('e-5', { aggregate: 'E' }, { type: 'Once' });
    adapter.relayPending();
    adapter.relayPending();
    assertCond(h.stats().publishedCount === 1, `expected 1 publish, got ${h.stats().publishedCount}`);
  }));

  return formatTckReport('transactional-outbox', results);
}

// ---------------------------------------------------------------------------
// Protocol 3: saga-compensation (SAGA-01..05)
// ---------------------------------------------------------------------------
function makeSagaHarness(adapterFactory) {
  const sagaStore = new Map();
  const executed = [];
  const compensated = [];
  let failStep = null;
  let failCompStepOnce = null;

  const store = {
    get(id) { return sagaStore.has(id) ? structuredClone(sagaStore.get(id)) : null; },
    put(id, state) { sagaStore.set(id, structuredClone(state)); },
  };

  const stepRunner = {
    executeStep(sagaId, stepName) {
      if (failStep === stepName) return { ok: false, error: `STEP_FAILED:${stepName}` };
      executed.push(`${sagaId}:${stepName}`);
      return { ok: true };
    },
    compensateStep(sagaId, stepName) {
      if (failCompStepOnce === stepName) {
        failCompStepOnce = null;
        return { ok: false, error: `COMP_TRANSIENT:${stepName}` };
      }
      compensated.push(`${sagaId}:${stepName}`);
      return { ok: true };
    },
  };

  return {
    buildAdapter: () => adapterFactory({ store, stepRunner }),
    setFailStep(s) { failStep = s; },
    setFailCompOnce(s) { failCompStepOnce = s; },
    stats: () => ({ executed: [...executed], compensated: [...compensated] }),
  };
}

export function runSagaCompensationTck(adapterFactory) {
  const results = [];

  results.push(runCheck('SAGA-01-HAPPY-CHAIN', 'All forward steps complete in order with 0 compensations', () => {
    const h = makeSagaHarness(adapterFactory);
    const adapter = h.buildAdapter();
    const res = adapter.run('s-1', ['stepA', 'stepB', 'stepC']);
    assertCond(res.ok === true && res.status === 'COMPLETED', `expected COMPLETED, got ${JSON.stringify(res)}`);
    assertCond(h.stats().executed.join(',') === 's-1:stepA,s-1:stepB,s-1:stepC', 'steps must execute in order');
    assertCond(h.stats().compensated.length === 0, 'happy saga must trigger 0 compensations');
  }));

  results.push(runCheck('SAGA-02-REVERSE-COMPENSATION', 'Failure at step N compensates completed steps in strict reverse order N-1..1', () => {
    const h = makeSagaHarness(adapterFactory);
    h.setFailStep('stepC');
    const adapter = h.buildAdapter();
    const res = adapter.run('s-2', ['stepA', 'stepB', 'stepC']);
    assertCond(res.status === 'COMPENSATED', `expected COMPENSATED, got ${JSON.stringify(res)}`);
    assertCond(h.stats().compensated.join(',') === 's-2:stepB,s-2:stepA', `expected reverse [stepB, stepA], got ${h.stats().compensated.join(',')}`);
  }));

  results.push(runCheck('SAGA-03-COMPENSATION-IDEMPOTENT-RETRY', 'Crash mid-compensation resumes remaining steps without re-compensating completed ones', () => {
    const h = makeSagaHarness(adapterFactory);
    h.setFailStep('stepC');
    h.setFailCompOnce('stepA');
    const adapter1 = h.buildAdapter();
    const first = adapter1.run('s-3', ['stepA', 'stepB', 'stepC']);
    assertCond(first.status === 'COMPENSATING', `expected COMPENSATING on transient comp failure, got ${JSON.stringify(first)}`);

    const adapter2 = h.buildAdapter();
    const resumed = adapter2.resumeCompensation('s-3');
    assertCond(resumed.status === 'COMPENSATED', `expected COMPENSATED after resume, got ${JSON.stringify(resumed)}`);
    assertCond(h.stats().compensated.join(',') === 's-3:stepB,s-3:stepA', `stepB must not be double-compensated; got ${h.stats().compensated.join(',')}`);
  }));

  results.push(runCheck('SAGA-04-TERMINAL-REJECTS-LATE-FORWARD', 'Compensated saga rejects late forward step replay cleanly', () => {
    const h = makeSagaHarness(adapterFactory);
    h.setFailStep('stepB');
    const adapter = h.buildAdapter();
    adapter.run('s-4', ['stepA', 'stepB']);
    const late = adapter.run('s-4', ['stepA', 'stepB']);
    assertCond(late.status === 'COMPENSATED', 'terminal compensated saga must stay COMPENSATED');
    assertCond(h.stats().executed.length === 1, 'late replay must not re-execute forward steps');
  }));

  results.push(runCheck('SAGA-05-FIRST-STEP-FAIL-ZERO-COMP', 'Failure on step 1 triggers 0 compensations', () => {
    const h = makeSagaHarness(adapterFactory);
    h.setFailStep('stepA');
    const adapter = h.buildAdapter();
    const res = adapter.run('s-5', ['stepA', 'stepB']);
    assertCond(res.status === 'COMPENSATED' || res.status === 'ABORTED', `expected COMPENSATED/ABORTED, got ${JSON.stringify(res)}`);
    assertCond(h.stats().compensated.length === 0, 'step 1 failure has nothing to compensate');
  }));

  return formatTckReport('saga-compensation', results);
}

// ---------------------------------------------------------------------------
// Protocol 4: idempotent-consumer (IDEMP-01..05)
// ---------------------------------------------------------------------------
function makeIdempotentConsumerHarness(adapterFactory) {
  const dedup = new Map();
  let sideEffectCalls = 0;
  let failHandlerOnce = false;

  const dedupStore = {
    get(msgId) { return dedup.has(msgId) ? structuredClone(dedup.get(msgId)) : null; },
    put(msgId, rec) { dedup.set(msgId, structuredClone(rec)); },
  };

  const handler = {
    apply(msgId, payload) {
      if (failHandlerOnce) {
        failHandlerOnce = false;
        throw new Error('TRANSIENT_HANDLER_ERROR');
      }
      sideEffectCalls += 1;
      return { handledId: msgId, payload };
    },
  };

  return {
    buildAdapter: () => adapterFactory({ dedupStore, handler }),
    setFailOnce: () => { failHandlerOnce = true; },
    stats: () => ({ sideEffectCalls, dedupSize: dedup.size }),
  };
}

export function runIdempotentConsumerTck(adapterFactory) {
  const results = [];

  results.push(runCheck('IDEMP-01-FIRST-PROCESS', 'First message executes handler once and records dedup entry', () => {
    const h = makeIdempotentConsumerHarness(adapterFactory);
    const adapter = h.buildAdapter();
    const res = adapter.consume('m-1', { value: 10 });
    assertCond(res.ok === true && res.replayed === false, `expected first consume ok, got ${JSON.stringify(res)}`);
    assertCond(h.stats().sideEffectCalls === 1, 'handler must run once');
  }));

  results.push(runCheck('IDEMP-02-DUPLICATE-DELIVERY', 'Duplicate redelivery executes handler 0 extra times', () => {
    const h = makeIdempotentConsumerHarness(adapterFactory);
    const adapter = h.buildAdapter();
    adapter.consume('m-2', { value: 20 });
    const dup = adapter.consume('m-2', { value: 20 });
    assertCond(dup.ok === true && dup.replayed === true, `expected replayed=true, got ${JSON.stringify(dup)}`);
    assertCond(h.stats().sideEffectCalls === 1, `expected 1 side effect, got ${h.stats().sideEffectCalls}`);
  }));

  results.push(runCheck('IDEMP-03-CONFLICT-PAYLOAD', 'Same message ID with mutated payload is rejected with PAYLOAD_CONFLICT', () => {
    const h = makeIdempotentConsumerHarness(adapterFactory);
    const adapter = h.buildAdapter();
    adapter.consume('m-3', { value: 30 });
    const conflict = adapter.consume('m-3', { value: 999 });
    assertCond(conflict.ok === false && conflict.code === 'PAYLOAD_CONFLICT', `expected PAYLOAD_CONFLICT, got ${JSON.stringify(conflict)}`);
    assertCond(h.stats().sideEffectCalls === 1, 'conflict must not run handler');
  }));

  results.push(runCheck('IDEMP-04-FAILURE-ALLOWS-CLEAN-RETRY', 'Handler failure before commit does not poison dedup store and allows retry', () => {
    const h = makeIdempotentConsumerHarness(adapterFactory);
    h.setFailOnce();
    const adapter = h.buildAdapter();
    const first = adapter.consume('m-4', { value: 40 });
    assertCond(first.ok === false, 'transient handler error must report ok=false');
    assertCond(h.stats().dedupSize === 0, 'failed attempt must not commit dedup marker');

    const retry = adapter.consume('m-4', { value: 40 });
    assertCond(retry.ok === true && retry.replayed === false, `retry must succeed cleanly, got ${JSON.stringify(retry)}`);
    assertCond(h.stats().sideEffectCalls === 1, 'retry should execute handler once');
  }));

  results.push(runCheck('IDEMP-05-CRASH-RECOVERY-DEDUP', 'Fresh consumer instance over durable dedup store still deduplicates', () => {
    const h = makeIdempotentConsumerHarness(adapterFactory);
    h.buildAdapter().consume('m-5', { value: 50 });
    const afterRestart = h.buildAdapter().consume('m-5', { value: 50 });
    assertCond(afterRestart.ok === true && afterRestart.replayed === true, 'restarted consumer must deduplicate');
    assertCond(h.stats().sideEffectCalls === 1, 'restarted consumer must not re-apply handler');
  }));

  return formatTckReport('idempotent-consumer', results);
}

export const SUPPORTED_S1_PROTOCOLS = [
  'three-phase-reconcile',
  'transactional-outbox',
  'saga-compensation',
  'idempotent-consumer',
];

export function runEffectTckByProtocol(protocol, adapterFactory) {
  switch (protocol) {
    case 'three-phase-reconcile': return runThreePhaseEffectTck(adapterFactory);
    case 'transactional-outbox': return runTransactionalOutboxTck(adapterFactory);
    case 'saga-compensation': return runSagaCompensationTck(adapterFactory);
    case 'idempotent-consumer': return runIdempotentConsumerTck(adapterFactory);
    default:
      throw new Error(`V2_TCK_UNKNOWN_PROTOCOL: unsupported S1 protocol "${protocol}" (supported: ${SUPPORTED_S1_PROTOCOLS.join(', ')})`);
  }
}

// ---------------------------------------------------------------------------
// JVM / Scala S1 Effect TCK Runner (compiles Scala adapter & runs NDJSON scenario suite)
// ---------------------------------------------------------------------------
function collectScalaFiles(srcPath, out = []) {
  const abs = resolve(srcPath);
  if (!existsSync(abs)) return out;
  if (abs.endsWith('.scala')) return [abs];
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(abs, entry.name);
    if (entry.isDirectory()) collectScalaFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.scala')) out.push(full);
  }
  return out;
}

export function runJvmEffectTck({
  scalaSource,
  mainClass,
  protocol = 'three-phase-reconcile',
  classpath = null,
} = {}) {
  const toolchain = detectScalaToolchain();
  if (!toolchain.available) {
    return formatTckReport(protocol, [{
      id: 'JVM-PREFLIGHT',
      title: 'Scala/JVM toolchain availability',
      passed: false,
      error: 'scalac/scala binaries not found on PATH',
    }], { runner: 'jvm-scala' });
  }

  const scalaFiles = collectScalaFiles(scalaSource);
  if (scalaFiles.length === 0) {
    throw new Error(`V2_TCK_JVM_NO_SOURCES: no .scala files found at "${scalaSource}"`);
  }

  const work = mkdtempSync(join(tmpdir(), 'coarising-jvm-tck-'));
  try {
    const classesDir = join(work, 'classes');
    mkdirSync(classesDir, { recursive: true });
    const compileArgs = ['-d', classesDir];
    if (classpath) compileArgs.push('-cp', classpath);
    compileArgs.push(...scalaFiles);

    const comp = spawnSync('scalac', compileArgs, { encoding: 'utf8', timeout: 60_000 });
    if (comp.status !== 0) {
      return formatTckReport(protocol, [{
        id: 'JVM-COMPILE',
        title: 'Compile Scala S1 adapter',
        passed: false,
        error: (comp.stderr || comp.stdout || 'scalac failed').trim(),
      }], { runner: 'jvm-scala', mainClass });
    }

    const runCp = classpath ? `${classesDir}${delimiter}${classpath}` : classesDir;
    const run = spawnSync('scala', ['-cp', runCp, mainClass, protocol], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    if (run.status !== 0 && !(run.stdout ?? '').trim()) {
      return formatTckReport(protocol, [{
        id: 'JVM-EXEC',
        title: `Execute Scala S1 adapter runner ${mainClass}`,
        passed: false,
        error: (run.stderr || `exit code ${run.status}`).trim(),
      }], { runner: 'jvm-scala', mainClass });
    }

    const lines = (run.stdout ?? '').split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
    const parsedResults = lines.map(l => JSON.parse(l));
    if (parsedResults.length === 0) {
      return formatTckReport(protocol, [{
        id: 'JVM-OUTPUT',
        title: 'Parse NDJSON TCK results from Scala runner',
        passed: false,
        error: `no NDJSON TCK lines emitted by ${mainClass}`,
      }], { runner: 'jvm-scala', mainClass });
    }
    return formatTckReport(protocol, parsedResults, { runner: 'jvm-scala', mainClass });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
