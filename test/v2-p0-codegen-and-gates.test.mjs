import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { scalaCodegenPlugin } from '../lib/v2/codegen/scala.mjs';
import { typescriptCodegenPlugin } from '../lib/v2/codegen/typescript.mjs';
import { emitV2ExecutableTests } from '../lib/v2/test-emitter/emit.mjs';
import { materializeApplicationWitness } from '../lib/v2/test-emitter/witness-materialize.mjs';
import { extractFailedTsSpecIds } from '../lib/v2/verify-gate.mjs';
import { createSmtContext } from '../lib/ears/smt-encoder.mjs';

function makeProject(structuresYaml, earsFiles) {
  const dir = mkdtempSync(join(tmpdir(), 'truthsrc-v2-p0-'));
  mkdirSync(join(dir, 'structures'), { recursive: true });
  mkdirSync(join(dir, 'behaviors', 'domain'), { recursive: true });
  writeFileSync(join(dir, 'structures', 'model.yaml'), structuresYaml, 'utf8');
  for (const [name, content] of Object.entries(earsFiles)) {
    writeFileSync(join(dir, 'behaviors', 'domain', name), content, 'utf8');
  }
  return dir;
}

test('P0 codegen: Optional[Int] wrapping and Int arithmetic compile cleanly in real scalac and run in TS', async () => {
  const structuresYaml = `
system: p0-codegen-check
context: scheduling
aggregates:
  - name: ScheduleItem
    idField: itemId
    aliases: [item, state]
    stateFields:
      - name: status
        type: String
        default: "draft"
        enum: ["draft", "published", "withdrawn"]
      - name: publishedAtMs
        type: Optional[Int]
      - name: payUntilMs
        type: Int
        default: 0
    commands:
      - name: PublishItem
        parameters:
          - name: nowMs
            type: Int
        produces: [ItemPublished]
      - name: WithdrawItem
        parameters:
          - name: clearedPublishedAtMs
            type: Optional[Int]
        produces: [ItemWithdrawn]
    events:
      - name: ItemPublished
        fields:
          - name: nowMs
            type: Int
      - name: ItemWithdrawn
        fields:
          - name: clearedPublishedAtMs
            type: Optional[Int]
`;

  const publishEars = `
slice ScheduleItem.PublishItem

rules:
  [R1] WHILE item.status == "draft" and nowMs <= 0
       WHEN PublishItem
       SHALL reject request with INVALID_TIMESTAMP

  [R2] WHILE item.status == "draft" and nowMs > 0
       WHEN PublishItem
       SHALL emit ItemPublished
         AND transition item.status -> "published"
       post:
         item.publishedAtMs' = nowMs
         item.payUntilMs' = nowMs + 900000

  [R3] WHILE item.status != "draft"
       WHEN PublishItem
       SHALL reject request with ITEM_NOT_DRAFT
`;

  const withdrawEars = `
slice ScheduleItem.WithdrawItem

rules:
  [R1] WHILE item.status == "published"
       WHEN WithdrawItem
       SHALL emit ItemWithdrawn
         AND transition item.status -> "withdrawn"
       post:
         item.publishedAtMs' = clearedPublishedAtMs

  [R2] WHILE item.status != "published"
       WHEN WithdrawItem
       SHALL reject request with ITEM_NOT_PUBLISHED
`;

  const dir = makeProject(structuresYaml, {
    'publish-item.ears': publishEars,
    'withdraw-item.ears': withdrawEars,
  });

  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    // 1. Scala codegen check + real scalac compile
    const scalaOut = join(dir, 'out-scala');
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: scalaOut, packageName: 'test.p0' });
    const scalaBehavior = readFileSync(
      join(scalaOut, 'generated-scaffold/scala/test/p0/ScheduleItemBehavior.scala'),
      'utf8',
    );
    assert.match(scalaBehavior, /publishedAtMs = Some\(ev\.nowMs\)/u);
    assert.match(scalaBehavior, /payUntilMs = \(ev\.nowMs \+ 900000L\)/u);
    assert.match(scalaBehavior, /publishedAtMs = ev\.clearedPublishedAtMs/u);

    const classesDir = join(dir, 'scala-classes');
    mkdirSync(classesDir, { recursive: true });
    execFileSync('scalac', [
      '-d', classesDir,
      join(scalaOut, 'generated-scaffold/scala/test/p0/DomainTypes.scala'),
      join(scalaOut, 'generated-scaffold/scala/test/p0/ScheduleItemBehavior.scala'),
    ], { stdio: 'pipe' });

    // 2. TypeScript codegen check + live Node 22 execution
    const tsOut = join(dir, 'out-ts');
    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: tsOut });
    const tsBehaviorPath = join(tsOut, 'generated-scaffold/ts/schedule-item.behavior.ts');
    const tsBehavior = readFileSync(tsBehaviorPath, 'utf8');
    assert.match(tsBehavior, /payUntilMs: \(event\.nowMs \+ 900000\)/u);

    const mod = await import(pathToFileURL(tsBehaviorPath).href);
    const s0 = mod.initialScheduleItemState();
    const res = mod.handleScheduleItemCommand(s0, { type: 'PublishItem', nowMs: 1000000 });
    assert.equal(res.ok, true);
    const s1 = mod.replayScheduleItem(s0, res.events);
    assert.equal(s1.status, 'published');
    assert.equal(s1.publishedAtMs, 1000000);
    assert.equal(s1.payUntilMs, 1900000);
    assert.equal(typeof s1.payUntilMs, 'number');

    const res2 = mod.handleScheduleItemCommand(s1, { type: 'WithdrawItem', clearedPublishedAtMs: null });
    assert.equal(res2.ok, true);
    const s2 = mod.replayScheduleItem(s1, res2.events);
    assert.equal(s2.status, 'withdrawn');
    assert.equal(s2.publishedAtMs, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P0 compiler gate: blocks state transition/post without emit (V2_STATE_CHANGE_WITHOUT_EVENT)', () => {
  const structuresYaml = `
system: p0-gate-no-emit
context: delivery
aggregates:
  - name: DispatchJob
    idField: jobId
    aliases: [job, state]
    stateFields:
      - name: status
        type: String
        default: "prepared"
        enum: ["prepared", "failed"]
    commands:
      - name: MarkFailed
        parameters: []
        produces: [JobFailed]
    events:
      - name: JobFailed
        fields: []
`;
  const ears = `
slice DispatchJob.MarkFailed

rules:
  [R1] WHILE job.status == "prepared"
       WHEN MarkFailed
       SHALL transition job.status -> "failed"

  [R2] WHILE job.status != "prepared"
       WHEN MarkFailed
       SHALL reject request with NOT_PREPARED
`;

  const dir = makeProject(structuresYaml, { 'mark-failed.ears': ears });
  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, false);
    assert.ok(
      compiled.diagnostics.some(d => d.code === 'V2_STATE_CHANGE_WITHOUT_EVENT'),
      JSON.stringify(compiled.diagnostics, null, 2),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P0 compiler gate: blocks unpropagated L1 event field (V2_UNPROPAGATED_EVENT_FIELD)', () => {
  const structuresYaml = `
system: p0-gate-unpropagated
context: batching
aggregates:
  - name: BatchRecord
    idField: batchId
    aliases: [batch, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
    commands:
      - name: CloseBatch
        parameters:
          - name: observedAtMs
            type: Int
        produces: [BatchClosed]
    events:
      - name: BatchClosed
        fields:
          - name: batchId
            type: String
          - name: closedAtMs
            type: Int
`;
  const ears = `
slice BatchRecord.CloseBatch

rules:
  [R1] WHILE batch.status == "open" and observedAtMs > 0
       WHEN CloseBatch
       SHALL emit BatchClosed
         AND transition batch.status -> "closed"

  [R2] WHILE batch.status == "open" and observedAtMs <= 0
       WHEN CloseBatch
       SHALL reject request with INVALID_TIME

  [R3] WHILE batch.status != "open"
       WHEN CloseBatch
       SHALL reject request with ALREADY_CLOSED
`;

  const dir = makeProject(structuresYaml, { 'close-batch.ears': ears });
  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, false);
    const unpropagated = compiled.diagnostics.filter(d => d.code === 'V2_UNPROPAGATED_EVENT_FIELD');
    assert.equal(unpropagated.length, 2, JSON.stringify(compiled.diagnostics, null, 2));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P0 compiler gate: blocks post: referencing field absent from emitted event (V2_POST_EVENT_FIELD_MISSING)', () => {
  const structuresYaml = `
system: p0-gate-post-missing
context: batching
aggregates:
  - name: BatchRecord
    idField: batchId
    aliases: [batch, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
      - name: closedAtMs
        type: Int
        default: 0
    commands:
      - name: CloseBatch
        parameters:
          - name: closedAtMs
            type: Int
        produces: [BatchClosed]
    events:
      - name: BatchClosed
        fields:
          - name: reason
            type: String
`;
  const ears = `
slice BatchRecord.CloseBatch

rules:
  [R1] WHILE batch.status == "open" and closedAtMs > 0
       WHEN CloseBatch
       SHALL emit BatchClosed
         AND transition batch.status -> "closed"
       post:
         batch.closedAtMs' = closedAtMs

  [R2] WHILE batch.status == "open" and closedAtMs <= 0
       WHEN CloseBatch
       SHALL reject request with INVALID_TIME

  [R3] WHILE batch.status != "open"
       WHEN CloseBatch
       SHALL reject request with ALREADY_CLOSED
`;

  const dir = makeProject(structuresYaml, { 'close-batch.ears': ears });
  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, false);
    assert.ok(
      compiled.diagnostics.some(d => d.code === 'V2_POST_EVENT_FIELD_MISSING'),
      JSON.stringify(compiled.diagnostics, null, 2),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P1 none literal: clearing Optional[T] with post: x\' = none and guarding with ==/!= none compiles in scalac and runs in TS', async () => {
  const structuresYaml = `
system: p1-none-literal
context: scheduling
aggregates:
  - name: ScheduleItem
    idField: itemId
    aliases: [item, state]
    stateFields:
      - name: status
        type: String
        default: "draft"
        enum: ["draft", "published", "withdrawn"]
      - name: publishedAtMs
        type: Optional[Int]
    commands:
      - name: PublishItem
        parameters:
          - name: nowMs
            type: Int
        produces: [ItemPublished]
      - name: WithdrawItem
        parameters:
          - name: withdrawnAtMs
            type: Int
        produces: [ItemWithdrawn]
    events:
      - name: ItemPublished
        fields:
          - name: nowMs
            type: Int
      - name: ItemWithdrawn
        fields:
          - name: withdrawnAtMs
            type: Int
`;

  const publishEars = `
slice ScheduleItem.PublishItem

rules:
  [R1] WHILE item.status == "draft" and item.publishedAtMs == none and nowMs > 0
       WHEN PublishItem
       SHALL emit ItemPublished
         AND transition item.status -> "published"
       post:
         item.publishedAtMs' = nowMs

  [R2] WHILE item.status != "draft" or item.publishedAtMs != none or nowMs <= 0
       WHEN PublishItem
       SHALL reject request with CANNOT_PUBLISH
`;

  const withdrawEars = `
slice ScheduleItem.WithdrawItem

rules:
  [R1] WHILE item.status == "published" and item.publishedAtMs != none and withdrawnAtMs > 0
       WHEN WithdrawItem
       SHALL emit ItemWithdrawn
         AND transition item.status -> "withdrawn"
       post:
         item.publishedAtMs' = none

  [R2] WHILE item.status != "published" or item.publishedAtMs == none or withdrawnAtMs <= 0
       WHEN WithdrawItem
       SHALL reject request with CANNOT_WITHDRAW
`;

  const dir = makeProject(structuresYaml, {
    'publish-item.ears': publishEars,
    'withdraw-item.ears': withdrawEars,
  });

  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    // 1. Scala codegen + real scalac
    const scalaOut = join(dir, 'out-scala');
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: scalaOut, packageName: 'test.p1none' });
    const scalaBehavior = readFileSync(
      join(scalaOut, 'generated-scaffold/scala/test/p1none/ScheduleItemBehavior.scala'),
      'utf8',
    );
    assert.match(scalaBehavior, /publishedAtMs = Some\(ev\.nowMs\)/u);
    assert.match(scalaBehavior, /publishedAtMs = None/u);
    assert.match(scalaBehavior, /state\.publishedAtMs\.isEmpty/u);
    assert.match(scalaBehavior, /state\.publishedAtMs\.nonEmpty/u);

    const classesDir = join(dir, 'scala-classes');
    mkdirSync(classesDir, { recursive: true });
    execFileSync('scalac', [
      '-d', classesDir,
      join(scalaOut, 'generated-scaffold/scala/test/p1none/DomainTypes.scala'),
      join(scalaOut, 'generated-scaffold/scala/test/p1none/ScheduleItemBehavior.scala'),
    ], { stdio: 'pipe' });

    // 2. TypeScript codegen + live Node 22 execution
    const tsOut = join(dir, 'out-ts');
    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: tsOut });
    const tsBehaviorPath = join(tsOut, 'generated-scaffold/ts/schedule-item.behavior.ts');
    const tsBehavior = readFileSync(tsBehaviorPath, 'utf8');
    assert.match(tsBehavior, /publishedAtMs: null/u);

    const mod = await import(pathToFileURL(tsBehaviorPath).href);
    const s0 = mod.initialScheduleItemState();
    const res1 = mod.handleScheduleItemCommand(s0, { type: 'PublishItem', nowMs: 123456 });
    assert.equal(res1.ok, true);
    const s1 = mod.replayScheduleItem(s0, res1.events);
    assert.equal(s1.publishedAtMs, 123456);

    const res2 = mod.handleScheduleItemCommand(s1, { type: 'WithdrawItem', withdrawnAtMs: 200000 });
    assert.equal(res2.ok, true);
    const s2 = mod.replayScheduleItem(s1, res2.events);
    assert.equal(s2.status, 'withdrawn');
    assert.equal(s2.publishedAtMs, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P1 none literal gate: blocks assigning none to non-optional state field (EARS_TYPE_MISMATCH)', () => {
  const structuresYaml = `
system: p1-none-gate
context: scheduling
aggregates:
  - name: ScheduleItem
    idField: itemId
    aliases: [item, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
      - name: payUntilMs
        type: Int
        default: 0
    commands:
      - name: CloseItem
        parameters: []
        produces: [ItemClosed]
    events:
      - name: ItemClosed
        fields: []
`;

  const ears = `
slice ScheduleItem.CloseItem

rules:
  [R1] WHILE item.status == "open"
       WHEN CloseItem
       SHALL emit ItemClosed
         AND transition item.status -> "closed"
       post:
         item.payUntilMs' = none

  [R2] WHILE item.status != "open"
       WHEN CloseItem
       SHALL reject request with ALREADY_CLOSED
`;

  const dir = makeProject(structuresYaml, { 'close-item.ears': ears });
  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, false);
    assert.ok(
      compiled.diagnostics.some(d => d.code === 'EARS_TYPE_MISMATCH'),
      JSON.stringify(compiled.diagnostics, null, 2),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Optional witness materialization: .__present=false emits None/null in Scala+TS+Gherkin and all locked tests pass live on Node+JVM', () => {
  const structuresYaml = `
system: optional-witness-fix
context: batching
aggregates:
  - name: ExamBatch
    idField: batchId
    aliases: [batch, state]
    stateFields:
      - name: status
        type: String
        default: "draft"
        enum: ["draft", "published", "withdrawn"]
      - name: publishedAtMs
        type: Optional[Int]
      - name: note
        type: Optional[String]
    commands:
      - name: WithdrawBatch
        parameters:
          - name: clearedPublicationTime
            type: Optional[Int]
          - name: withdrawnAtMs
            type: Int
        produces: [BatchWithdrawn]
      - name: ClearWithNoneLiteral
        parameters:
          - name: withdrawnAtMs
            type: Int
        produces: [BatchCleared]
    events:
      - name: BatchWithdrawn
        fields:
          - name: clearedPublicationTime
            type: Optional[Int]
          - name: withdrawnAtMs
            type: Int
      - name: BatchCleared
        fields:
          - name: withdrawnAtMs
            type: Int
`;

  const withdrawEars = `
slice ExamBatch.WithdrawBatch

rules:
  [WB_BAD_CLEAR] IF clearedPublicationTime is some THEN SHALL reject request with CLEARED_TIME_MUST_BE_NONE
  [WB_BAD_TIME]  IF withdrawnAtMs <= 0 THEN SHALL reject request with INVALID_TIME
  [WB_NOT_PUB]   IF batch.status != "published" or batch.publishedAtMs is none
                 THEN SHALL reject request with BATCH_NOT_PUBLISHED
  [WB_OK]        WHILE batch.status == "published" and batch.publishedAtMs is some and clearedPublicationTime is none and withdrawnAtMs > 0
                 WHEN WithdrawBatch
                 SHALL emit BatchWithdrawn
                   AND transition batch.status -> "withdrawn"
                 post:
                   batch.publishedAtMs' = clearedPublicationTime
`;

  const clearEars = `
slice ExamBatch.ClearWithNoneLiteral

rules:
  [CL_OK]     WHILE batch.status == "published" and batch.publishedAtMs != none and batch.note == none and withdrawnAtMs > 0
              WHEN ClearWithNoneLiteral
              SHALL emit BatchCleared
                AND transition batch.status -> "withdrawn"
              post:
                batch.publishedAtMs' = none
  [CL_REJECT] WHILE batch.status != "published" or batch.publishedAtMs == none or batch.note != none or withdrawnAtMs <= 0
              WHEN ClearWithNoneLiteral
              SHALL reject request with CANNOT_CLEAR
`;

  const dir = makeProject(structuresYaml, {
    'withdraw-batch.ears': withdrawEars,
    'clear-batch.ears': clearEars,
  });

  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    // Verify anti-hardcoding secondary witness flips real live Int (withdrawnAtMs), NOT dead absent optional payload
    const wbBeh = compiled.canonical.behaviors.find(b => b.target === 'ExamBatch.WithdrawBatch');
    const wbOk = wbBeh.testIr.scenarios[0].examples.find(e => e.ruleId === 'WB_OK');
    assert.equal(wbOk.witness.scalars['clearedPublicationTime.__present'], false);
    assert.equal(wbOk.witness.scalars['batch.publishedAtMs.__present'], true);
    assert.ok(wbOk.secondaryWitness, 'expected distinct secondary witness for WB_OK');
    assert.equal(wbOk.secondaryWitness.scalars['clearedPublicationTime.__present'], false);
    assert.notEqual(
      wbOk.witness.scalars.withdrawnAtMs,
      wbOk.secondaryWitness.scalars.withdrawnAtMs,
      'secondary witness must vary a live variable instead of dead payload of an absent Optional',
    );

    // Generate TS + Scala production scaffolds AND locked BDD tests
    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: dir });
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: dir, packageName: 'test.optwitness' });
    const emittedTests = emitV2ExecutableTests(compiled.canonical, {
      outDir: dir,
      targets: ['typescript', 'scala'],
      packageName: 'test.optwitness',
    });

    // 1. Gherkin feature table must NOT leak .__present columns
    const wbFeatureEntry = emittedTests.emitted.find(
      e => e.kind === 'gherkin' && e.target === 'ExamBatch.WithdrawBatch',
    );
    assert.ok(wbFeatureEntry, 'expected emitted Gherkin feature for ExamBatch.WithdrawBatch');
    const wbFeature = readFileSync(wbFeatureEntry.file, 'utf8');
    assert.ok(!wbFeature.includes('__present'), `Gherkin leaked __present:\n${wbFeature}`);

    // 2. Generated TS locked specs must materialize null (not 0/1) and PASS 100% live via node --test
    const tsWithdrawSpec = join(dir, 'generated-tests/ts/exam-batch-withdraw-batch.ears.spec.ts');
    const tsClearSpec = join(dir, 'generated-tests/ts/exam-batch-clear-with-none-literal.ears.spec.ts');
    const tsWithdrawSrc = readFileSync(tsWithdrawSpec, 'utf8');
    assert.ok(!tsWithdrawSrc.includes('__present'), 'TS spec leaked __present');
    assert.match(tsWithdrawSrc, /"clearedPublicationTime":null/u);
    execFileSync(process.execPath, ['--test', tsWithdrawSpec, tsClearSpec], { stdio: 'pipe' });

    // 3. Generated Scala locked specs must materialize None (not Some(0L)/Some(1L)) and PASS 100% live on JVM
    const scWithdrawSpec = join(dir, 'generated-tests/scala/test/optwitness/ExamBatchWithdrawBatchEarsSpec.scala');
    const scClearSpec = join(dir, 'generated-tests/scala/test/optwitness/ExamBatchClearWithNoneLiteralEarsSpec.scala');
    const scWithdrawSrc = readFileSync(scWithdrawSpec, 'utf8');
    assert.ok(!scWithdrawSrc.includes('__present'), 'Scala spec leaked __present');
    assert.match(scWithdrawSrc, /clearedPublicationTime = None/u);
    assert.match(scWithdrawSrc, /publishedAtMs = Some\(/u);
    assert.match(scWithdrawSrc, /publishedAtMs = None/u);

    // Lightweight ScalaTest shim to compile & actually run EVERY generated ScalaTest case on JVM
    const shimDir = join(dir, 'scala-shim');
    mkdirSync(shimDir, { recursive: true });
    const shimPath = join(shimDir, 'AnyFunSuiteShim.scala');
    writeFileSync(shimPath, `
package org.scalatest.funsuite
import scala.collection.mutable.ListBuffer
abstract class AnyFunSuite {
  private val cases = ListBuffer.empty[(String, () => Unit)]
  protected def test(name: String)(body: => Unit): Unit = cases += ((name, () => body))
  protected def fail(msg: String): Nothing = throw new AssertionError(msg)
  def runAll(): Int = {
    cases.foreach { case (name, fn) =>
      try { fn() } catch { case e: Throwable => throw new RuntimeException(s"FAILED: $name -> \${e.getMessage}", e) }
    }
    cases.size
  }
}
`, 'utf8');
    const runnerPath = join(shimDir, 'RunSpecs.scala');
    writeFileSync(runnerPath, `
package test.optwitness
object RunSpecs {
  def main(args: Array[String]): Unit = {
    val c1 = new ExamBatchWithdrawBatchEarsSpec().runAll()
    val c2 = new ExamBatchClearWithNoneLiteralEarsSpec().runAll()
    println(s"SCALA_SPECS_PASSED=\${c1 + c2}")
  }
}
`, 'utf8');

    const classesDir = join(dir, 'scala-classes');
    mkdirSync(classesDir, { recursive: true });
    execFileSync('scalac', [
      '-d', classesDir,
      shimPath,
      join(dir, 'generated-scaffold/scala/test/optwitness/DomainTypes.scala'),
      join(dir, 'generated-scaffold/scala/test/optwitness/ExamBatchBehavior.scala'),
      scWithdrawSpec,
      scClearSpec,
      runnerPath,
    ], { stdio: 'pipe' });
    const jvmOut = execFileSync('scala', ['-cp', classesDir, 'test.optwitness.RunSpecs'], { encoding: 'utf8' });
    assert.match(jvmOut, /SCALA_SPECS_PASSED=\d+/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Application witness materialization and untyped story optionSyntax: no .__present leakage and absent optionals map to null', () => {
  // Direct unit check on materializeApplicationWitness
  const mat = materializeApplicationWitness({
    scalars: {
      'token.__present': false,
      token: 0,
      'presentFlag.__present': true,
      presentFlag: 42,
      'order.note.__present': false,
      'order.note': 1,
      'order.title.__present': true,
      'order.title': 'hello',
      'order.onlyPresent.__present': false,
    },
    externs: { authOk: true },
  });
  assert.deepEqual(mat.payload, {
    token: null,
    presentFlag: 42,
    order: { note: null, title: 'hello', onlyPresent: null },
  });
  assert.deepEqual(mat.stateSnapshot, {
    order: { note: null, title: 'hello', onlyPresent: null },
  });
  assert.ok(!JSON.stringify(mat).includes('__present'));

  // End-to-end untyped application story using is none / is some
  const dir = mkdtempSync(join(tmpdir(), 'truthsrc-app-opt-'));
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/application'), { recursive: true });
    writeFileSync(join(dir, 'structures/s.yaml'), `
system: app-opt-check
context: auth
ports:
  - name: AuthPort
    operations:
      - name: CheckToken
        parameters:
          - token: Optional[String]
valueObjects:
  - name: AuthAck
    fields:
      - ok: Bool
stories:
  - name: TokenGate
    responses: [AuthAck]
`, 'utf8');
    writeFileSync(join(dir, 'behaviors/application/token-gate.integration.ears'), `
story TokenGate layer application

rules:
  [TG-1] WHILE token is none
         WHEN AuthPort.CheckToken
         SHALL reject request with MISSING_TOKEN
  [TG-2] WHILE token is some
         WHEN AuthPort.CheckToken
         SHALL respond AuthAck with ack.ok == true
`, 'utf8');

    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    emitV2ExecutableTests(compiled.canonical, {
      outDir: dir,
      targets: ['typescript', 'scala'],
      packageName: 'test.appopt',
    });

    const tsSpec = readFileSync(join(dir, 'generated-tests/ts/token-gate.ears.spec.ts'), 'utf8');
    const scSpec = readFileSync(join(dir, 'generated-tests/scala/test/appopt/TokenGateEarsSpec.scala'), 'utf8');
    assert.ok(!tsSpec.includes('__present'), `TS app spec leaked __present:\n${tsSpec}`);
    assert.ok(!scSpec.includes('__present'), `Scala app spec leaked __present:\n${scSpec}`);
    assert.match(tsSpec, /"token":null/u);
    assert.match(scSpec, /"token" -> null/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SMT encoder regression: .__present flag does not pollute recordMembers during post-transition encoding', () => {
  const ctx = createSmtContext({
    kind: 'slice',
    target: 'ExamBatch.Publish',
    stateAliases: ['batch', 'state'],
    resolvedSymbols: new Map([
      ['Publish::batch.publishedAtMs', { type: { kind: 'optional', element: { kind: 'int' } } }],
      ['Publish::nowMs', { type: { kind: 'int' } }],
    ]),
    axioms: [],
    rules: [
      {
        id: 'R1',
        command: 'Publish',
        expandedGuard: {
          kind: 'emptiness',
          target: { kind: 'member', object: { kind: 'var', name: 'batch' }, field: 'publishedAtMs' },
          check: 'empty',
          optionSyntax: true,
        },
        post: [
          {
            target: { segments: ['batch', 'publishedAtMs'] },
            expandedIndex: null,
            expandedValue: { kind: 'var', name: 'nowMs' },
          },
        ],
        actions: [],
      },
    ],
  });

  const assertions = ctx.encodePostTransition(
    [
      {
        target: { segments: ['batch', 'publishedAtMs'] },
        expandedIndex: null,
        expandedValue: { kind: 'var', name: 'nowMs' },
      },
    ],
    '',
    '__next',
  );
  assert.ok(
    assertions.includes('(= v__batch_publishedAtMs___present__next true)'),
    `missing presence transition assertion: ${JSON.stringify(assertions)}`,
  );
  assert.ok(
    assertions.includes('(= v__batch_publishedAtMs__next v__nowMs)'),
    `missing value transition assertion: ${JSON.stringify(assertions)}`,
  );
});

test('verify-gate extractFailedTsSpecIds supports both TAP and Node 24+ spec reporter output (with or without ANSI)', () => {
  const tapOut = [
    'TAP version 13',
    'ok 1 - [LOT_OK] (primary) ConfirmUnits -> emit UnitsConfirmed',
    'not ok 2 - [LOT_BAD_PRICE] (primary) ConfirmUnits -> reject LOT_BAD_PRICE',
    'not ok 3 - [LOT_BAD_PRICE] (secondary) ConfirmUnits -> reject LOT_BAD_PRICE',
    'not ok 4 - [LOT_BAD_UNITS] (primary) ConfirmUnits -> reject LOT_BAD_UNITS',
  ].join('\n');
  assert.deepEqual(extractFailedTsSpecIds(tapOut), ['LOT_BAD_PRICE', 'LOT_BAD_UNITS']);

  const specOut = [
    '✔ [LOT_OK] (primary) ConfirmUnits -> emit UnitsConfirmed (0.5ms)',
    '\u001b[31m✖ [LOT_BAD_PRICE] (primary) ConfirmUnits -> reject LOT_BAD_PRICE (1.2ms)\u001b[39m',
    '  ✖ [LOT_ALREADY_CONFIRMED] (primary) ConfirmUnits -> reject LOT_ALREADY_CONFIRMED (0.3ms)',
    '  × [APP-01] (primary) Submit -> reject MISSING_TOKEN (0.2ms)',
  ].join('\n');
  assert.deepEqual(extractFailedTsSpecIds(specOut), ['LOT_BAD_PRICE', 'LOT_ALREADY_CONFIRMED', 'APP-01']);
});
