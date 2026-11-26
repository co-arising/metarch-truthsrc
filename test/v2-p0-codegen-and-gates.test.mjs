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
