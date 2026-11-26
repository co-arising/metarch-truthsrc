// Comprehensive tests for co-arising 2.0 P1 capabilities:
//   #5 EARS expressiveness (WHEN event, app k-step BMC, forall/exists, sum/count, is some/none, within time windows)
//      + compile-v2 projections (Style E AC + Style B DMN table) + .zh.ears bilingual equivalence gate
//   #6 S1 TCK protocol families (transactional-outbox, saga-compensation, idempotent-consumer) + Scala/JVM runner
//   #7 Hardened YAML parser (multiline |/>, multiline flow) + file:line:col source-caret diagnostics
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { renderCompileV2Human } from '../lib/v2/cli.mjs';
import { typescriptCodegenPlugin } from '../lib/v2/codegen/typescript.mjs';
import { scalaCodegenPlugin } from '../lib/v2/codegen/scala.mjs';
import { parseStructuredDoc, V2YamlError } from '../lib/v2/yaml-parser.mjs';
import {
  runEffectTckByProtocol,
  runJvmEffectTck,
} from '../lib/v2/effect-tck.mjs';

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('P1 #5a: WHEN event choreography, app k-step BMC, forall/exists, sum/count, is some/none, and within time windows', () => {
  const dir = makeTempDir('coarising-p1-expr-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/application'), { recursive: true });

    writeFileSync(join(dir, 'structures/core.yaml'), `
system: expr-lab
context: workflow

exactTypes:
  - name: QtyDecimal
    form: decimal
    scale: 2

ports:
  - name: BatchPort
    operations:
      - name: submit
        parameters:
          - actor: ActorId
          - reqId: RequestId

valueObjects:
  - name: BatchAck
    fields:
      - replayed: Bool

externContracts:
  - name: batchPinned
    params:
      - actor: ActorId
      - reqId: RequestId

aggregates:
  - name: BatchOrder
    aliases: [batch, state, batchorder]
    stateFields:
      - maxTotal: QtyDecimal = "1000.00"
      - couponCode: Optional[String]
      - items: Seq[QtyDecimal]
      - createdAtMs: Int = 0
    commands:
      - name: ApproveBatch
        parameters:
          - nowMs: Int
          - actor: ActorId
          - reqId: RequestId
        produces: [BatchApproved]
    events:
      - name: BatchApproved
        fields:
          - actor: ActorId
          - reqId: RequestId

stories:
  - name: BatchChoreography
    pins: [BatchOriginal]
    responses: [BatchAck]
`, 'utf8');

    // Domain slice exercising: is some/is none, count(), sum(), forall, exists, within 5m of
    writeFileSync(join(dir, 'behaviors/domain/batch-approve.ears'), `
slice BatchOrder.ApproveBatch

where:
  hasItems    = count(batch.items) > 0 as "batch has at least one item"
  withinCap   = sum(batch.items) <= batch.maxTotal as "sum of items within cap"
  allPositive = forall x in batch.items : x > 0.00 as "every item is positive"
  freshWindow = nowMs within 5m of batch.createdAtMs as "approved within 5 minute window"
  hasCoupon   = batch.couponCode is some as "coupon attached"

rules:
  [BATCH_EMPTY]    IF not hasItems THEN SHALL reject request with BATCH_EMPTY
  [BATCH_OVER_CAP] IF not withinCap THEN SHALL reject request with BATCH_OVER_CAP
  [BATCH_BAD_ITEM] IF not allPositive THEN SHALL reject request with BATCH_BAD_ITEM
  [BATCH_EXPIRED]  IF not freshWindow THEN SHALL reject request with BATCH_EXPIRED
  [BATCH_OK_COUP]  WHILE hasItems and withinCap and allPositive and freshWindow and hasCoupon
                   WHEN ApproveBatch
                   SHALL emit BatchApproved
  [BATCH_OK_PLAIN] WHILE hasItems and withinCap and allPositive and freshWindow and batch.couponCode is none
                   WHEN ApproveBatch
                   SHALL emit BatchApproved
`, 'utf8');

    // Application story exercising WHEN event <Aggregate>.<Event> + pin + SHALL NOT dispatch (triggers app k-step BMC)
    writeFileSync(join(dir, 'behaviors/application/batch-choreography.integration.ears'), `
story BatchChoreography layer application

where:
  extern batchPinned(actor, reqId)

rules:
  [BC-01] WHILE not batchPinned(actor, reqId)
          WHEN event BatchOrder.BatchApproved
          SHALL pin BatchOriginal from (actor, reqId)
            AND dispatch BatchOrder.ApproveBatch
            AND respond BatchAck with ack.replayed == false

  [BC-02] WHILE batchPinned(actor, reqId)
          WHEN event BatchOrder.BatchApproved
          SHALL respond BatchAck with ack.replayed == true
            AND SHALL NOT dispatch BatchOrder.ApproveBatch
`, 'utf8');

    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      outAcDir: join(dir, 'projections/ac'),
      outTablesDir: join(dir, 'projections/tables'),
      projectionLang: 'zh',
    });
    assert.equal(res.passed, true, JSON.stringify(res.diagnostics, null, 2));
    assert.equal(res.projections.length, 4);
    assert.ok(existsSync(join(dir, 'projections/ac/batch-approve.md')));
    assert.ok(existsSync(join(dir, 'projections/tables/batch-approve.md')));
    assert.ok(readFileSync(join(dir, 'projections/ac/batch-choreography.integration.md'), 'utf8').includes('事件'));

    // Verify application k-step BMC proved pin-once safety
    const appBeh = res.canonical.behaviors.find(b => b.target === 'BatchChoreography');
    assert.equal(appBeh.rules[0].triggerKind, 'event');
    assert.ok(appBeh.testIr.scenarios.some(s => s.kind === 'bmc' && s.id.startsWith('bmc-app-pin-once-') && s.bmc.passed));

    // Verify both TS and Scala codegen succeed on quantifiers/aggregations/time-windows
    const tsGen = typescriptCodegenPlugin.generate(res.canonical, { outDir: dir });
    const scalaGen = scalaCodegenPlugin.generate(res.canonical, { outDir: dir, packageName: 'example.expr' });
    const tsBeh = readFileSync(join(dir, 'generated-scaffold/ts/batch-order.behavior.ts'), 'utf8');
    const scBeh = readFileSync(join(dir, 'generated-scaffold/scala/example/expr/BatchOrderBehavior.scala'), 'utf8');
    assert.ok(tsGen.files.length > 0 && tsBeh.includes('.every(') && tsBeh.includes('300000'));
    assert.ok(scalaGen.files.length > 0 && scBeh.includes('.forall(') && scBeh.includes('300000'));

    // Negative check: undeclared WHEN event is rejected with EARS_UNKNOWN_TRIGGER_EVENT
    writeFileSync(join(dir, 'behaviors/application/batch-choreography.integration.ears'), `
story BatchChoreography layer application
where:
  extern batchPinned(actor, reqId)
rules:
  [BC-BAD] WHEN event BatchOrder.GhostEvent SHALL respond BatchAck with ack.replayed == false
`, 'utf8');
    const badEv = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(badEv.passed, false);
    assert.ok(badEv.diagnostics.some(d => d.code === 'EARS_UNKNOWN_TRIGGER_EVENT'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P1 #5b: compile-v2 bilingual .zh.ears gate passes on isomorphic EN/ZH and blocks on V2_BILINGUAL_DRIFT', () => {
  const dir = makeTempDir('coarising-p1-bilingual-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
    writeFileSync(join(dir, 'structures/s.yaml'), `
system: bi-lab
context: bi
aggregates:
  - name: Gate
    aliases: [gate, state]
    stateFields:
      - limit: Int = 10
    commands:
      - name: Pass
        parameters:
          - n: Int
        produces: [Passed]
    events:
      - name: Passed
        waiveLineage: audit-only
        fields:
          - n: Int
`, 'utf8');
    writeFileSync(join(dir, 'behaviors/domain/gate.ears'), `
slice Gate.Pass
where:
  withinLimit = n <= gate.limit
rules:
  [G1] IF not withinLimit THEN SHALL reject request with OVER_LIMIT
  [G2] WHILE withinLimit WHEN Pass SHALL emit Passed
`, 'utf8');
    writeFileSync(join(dir, 'behaviors/domain/gate.zh.ears'), `
切片 Gate.Pass
定义:
  在限额内 = n <= gate.limit
规则:
  [G1] 如果 不满足 在限额内 则 必须 拒绝请求，返回 OVER_LIMIT
  [G2] 当处于 在限额内 当收到 Pass 必须 发射 Passed
`, 'utf8');

    const ok = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(ok.passed, true, JSON.stringify(ok.diagnostics));
    assert.equal(ok.bilingualChecks.length, 1);
    assert.equal(ok.bilingualChecks[0].equivalent, true);

    // Introduce subtle semantic drift in .zh.ears (< instead of <=)
    writeFileSync(join(dir, 'behaviors/domain/gate.zh.ears'), `
切片 Gate.Pass
定义:
  在限额内 = n < gate.limit
规则:
  [G1] 如果 不满足 在限额内 则 必须 拒绝请求，返回 OVER_LIMIT
  [G2] 当处于 在限额内 当收到 Pass 必须 发射 Passed
`, 'utf8');
    const drifted = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(drifted.passed, false);
    assert.ok(drifted.diagnostics.some(d => d.code === 'V2_BILINGUAL_DRIFT'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P1 #6: S1 TCK suites (transactional-outbox, saga-compensation, idempotent-consumer) and Scala/JVM runner', () => {
  // 1. transactional-outbox
  const outboxAdapter = ({ txStore, broker, maxRetries }) => ({
    writeAndEnqueue(id, data, event) {
      try {
        txStore.runInTransaction(tx => {
          tx.saveDomain(id, data);
          if (data.forceFail) throw new Error('TX_ABORT');
          tx.insertOutbox(id, event);
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
    relayPending() {
      let published = 0;
      for (const row of txStore.listPendingOutbox()) {
        const res = broker.publish(row.id, row.event);
        if (res.ok) {
          txStore.markPublished(row.id);
          published += 1;
        } else {
          const nextAttempts = row.attempts + 1;
          txStore.recordAttempt(row.id, nextAttempts >= maxRetries);
        }
      }
      return { ok: true, published };
    },
  });
  const outboxRes = runEffectTckByProtocol('transactional-outbox', outboxAdapter);
  assert.equal(outboxRes.passed, true, JSON.stringify(outboxRes.results.filter(r => !r.passed), null, 2));
  assert.equal(outboxRes.passedCount, 5);

  // 2. saga-compensation
  const sagaAdapter = ({ store, stepRunner }) => ({
    run(sagaId, steps) {
      const existing = store.get(sagaId);
      if (existing && (existing.status === 'COMPLETED' || existing.status === 'COMPENSATED')) {
        return { ok: existing.status === 'COMPLETED', status: existing.status };
      }
      const done = [];
      for (const s of steps) {
        const r = stepRunner.executeStep(sagaId, s);
        if (!r.ok) {
          store.put(sagaId, { status: 'COMPENSATING', toCompensate: [...done].reverse() });
          return this.resumeCompensation(sagaId);
        }
        done.push(s);
      }
      store.put(sagaId, { status: 'COMPLETED', toCompensate: [] });
      return { ok: true, status: 'COMPLETED' };
    },
    resumeCompensation(sagaId) {
      const rec = store.get(sagaId);
      if (!rec) return { ok: false, status: 'UNKNOWN' };
      const remaining = [...rec.toCompensate];
      while (remaining.length > 0) {
        const nextStep = remaining[0];
        const r = stepRunner.compensateStep(sagaId, nextStep);
        if (!r.ok) {
          store.put(sagaId, { status: 'COMPENSATING', toCompensate: remaining });
          return { ok: false, status: 'COMPENSATING' };
        }
        remaining.shift();
      }
      store.put(sagaId, { status: 'COMPENSATED', toCompensate: [] });
      return { ok: true, status: 'COMPENSATED' };
    },
  });
  const sagaRes = runEffectTckByProtocol('saga-compensation', sagaAdapter);
  assert.equal(sagaRes.passed, true, JSON.stringify(sagaRes.results.filter(r => !r.passed), null, 2));
  assert.equal(sagaRes.passedCount, 5);

  // 3. idempotent-consumer
  const idempAdapter = ({ dedupStore, handler }) => ({
    consume(msgId, payload) {
      const existing = dedupStore.get(msgId);
      if (existing) {
        if (JSON.stringify(existing.payload) !== JSON.stringify(payload)) {
          return { ok: false, code: 'PAYLOAD_CONFLICT' };
        }
        return { ok: true, replayed: true };
      }
      try {
        const result = handler.apply(msgId, payload);
        dedupStore.put(msgId, { payload, result });
        return { ok: true, replayed: false, result };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  });
  const idempRes = runEffectTckByProtocol('idempotent-consumer', idempAdapter);
  assert.equal(idempRes.passed, true, JSON.stringify(idempRes.results.filter(r => !r.passed), null, 2));
  assert.equal(idempRes.passedCount, 5);

  // 4. Live Scala/JVM S1 TCK Runner
  const dir = makeTempDir('coarising-p1-jvm-tck-');
  try {
    writeFileSync(join(dir, 'SampleTckMain.scala'), `
package example.tck

object SampleTckMain {
  def main(args: Array[String]): Unit = {
    val proto = if (args.nonEmpty) args(0) else "idempotent-consumer"
    println(s"""{"id":"JVM-IDEMP-01","title":"Scala adapter deduplicates under $proto","passed":true,"error":null}""")
    println("""{"id":"JVM-IDEMP-02","title":"Scala adapter rejects payload conflict","passed":true,"error":null}""")
  }
}
`, 'utf8');
    const jvmRes = runJvmEffectTck({
      scalaSource: dir,
      mainClass: 'example.tck.SampleTckMain',
      protocol: 'idempotent-consumer',
    });
    assert.equal(jvmRes.passed, true, JSON.stringify(jvmRes, null, 2));
    assert.equal(jvmRes.runner, 'jvm-scala');
    assert.equal(jvmRes.passedCount, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P1 #7: hardened YAML parser (block scalars |/>, multiline flow) and file:line:col diagnostic snippets', () => {
  const parsed = parseStructuredDoc(`
---
system: yaml-lab
description: |-
  line one
  line two
summary: >
  folded paragraph
  continues here
tags: [
  "alpha",
  "beta",
  "gamma"
]
meta: {
  owner: "core",
  retries: 3
}
...
`, 'test.yaml');

  assert.equal(parsed.system, 'yaml-lab');
  assert.equal(parsed.description, 'line one\nline two');
  assert.equal(parsed.summary, 'folded paragraph continues here\n');
  assert.deepEqual(parsed.tags, ['alpha', 'beta', 'gamma']);
  assert.deepEqual(parsed.meta, { owner: 'core', retries: 3 });

  // Invalid YAML produces structured V2YamlError with file:line:col and caret snippet
  assert.throws(
    () => parseStructuredDoc('system: ok\nbad line without colon\n', 'broken.yaml'),
    err => err instanceof V2YamlError && err.line === 2 && err.location === 'broken.yaml:2:1' && err.snippet.includes('^'),
  );

  // Compiler diagnostics attach file:line:col and caret snippet for EARS_* errors
  const dir = makeTempDir('coarising-p1-diag-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
    writeFileSync(join(dir, 'structures/s.yaml'), `
system: diag-lab
context: diag
aggregates:
  - name: Valve
    stateFields:
      - name: state
        type: String
        enum: ["open", "closed"]
    commands:
      - name: Shut
        parameters: []
        produces: [ValveShut]
    events:
      - name: ValveShut
        fields: []
`, 'utf8');
    writeFileSync(join(dir, 'behaviors/domain/valve.ears'), `slice Valve.Shut
rules:
  [V1] IF valve.state == "clsoed" THEN SHALL reject request with BAD
`, 'utf8');
    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const enumDiag = res.diagnostics.find(d => d.code === 'EARS_UNKNOWN_ENUM_LITERAL');
    assert.ok(enumDiag, JSON.stringify(res.diagnostics));
    assert.equal(enumDiag.line, 3);
    assert.ok(enumDiag.location.endsWith('valve.ears:3:3'));
    assert.ok(enumDiag.snippet.includes('-->') && enumDiag.snippet.includes('^'));
    const human = renderCompileV2Human(res);
    assert.ok(human.includes('valve.ears:3:3') && human.includes('^'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
