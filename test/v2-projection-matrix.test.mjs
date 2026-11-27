import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { scalaCodegenPlugin } from '../lib/v2/codegen/scala.mjs';
import { typescriptCodegenPlugin } from '../lib/v2/codegen/typescript.mjs';
import { emitV2ExecutableTests } from '../lib/v2/test-emitter/emit.mjs';
import { emitV1OrchestrationSuite } from '../lib/v2/bridge/v1-strict-orchestration.mjs';
import { checkContracts, exportCapabilitiesLock } from '../lib/v2/surface-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('Cross-projection type matrix: Int, Decimal, String, Enum, Bool, Optional[Int/String], and Map compile across Z3 -> TS -> Scala -> BDD specs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'truthsrc-v2-matrix-'));
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors', 'domain'), { recursive: true });

    writeFileSync(
      join(dir, 'structures', 'matrix.yaml'),
      `
system: matrix-check
context: core
aggregates:
  - name: MatrixRecord
    idField: recordId
    aliases: [rec, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
      - name: active
        type: Bool
        default: true
      - name: count
        type: Int
        default: 0
      - name: amount
        type: Decimal
        scale: 2
        default: "0.00"
      - name: optNote
        type: Optional[String]
      - name: optStamp
        type: Optional[Int]
      - name: counters
        type: Map[String, Int]
    commands:
      - name: UpdateMatrix
        parameters:
          - name: delta
            type: Int
          - name: stepAmount
            type: Decimal
            scale: 2
          - name: tag
            type: String
          - name: note
            type: Optional[String]
          - name: stamp
            type: Optional[Int]
        produces: [MatrixUpdated]
      - name: CloseMatrix
        parameters: []
        produces: [MatrixClosed]
    events:
      - name: MatrixUpdated
        fields:
          - name: delta
            type: Int
          - name: stepAmount
            type: Decimal
            scale: 2
          - name: tag
            type: String
          - name: note
            type: Optional[String]
          - name: stamp
            type: Optional[Int]
      - name: MatrixClosed
        fields: []
`,
      'utf8',
    );

    writeFileSync(
      join(dir, 'behaviors', 'domain', 'update-matrix.ears'),
      `
slice MatrixRecord.UpdateMatrix

rules:
  [MX-01] WHILE rec.status == "open" and rec.active == true and delta > 0 and stepAmount > 0.00
       WHEN UpdateMatrix
       SHALL emit MatrixUpdated
         AND transition rec.status -> "open"
       post:
         rec.count' = rec.count + delta
         rec.amount' = rec.amount + stepAmount
         rec.optNote' = note
         rec.optStamp' = stamp
         rec.counters'[tag] = rec.counters[tag] + delta

  [MX-02] WHILE rec.status == "open" and (rec.active == false or delta <= 0 or stepAmount <= 0.00)
       WHEN UpdateMatrix
       SHALL reject request with INVALID_MATRIX_INPUT

  [MX-03] WHILE rec.status != "open"
       WHEN UpdateMatrix
       SHALL reject request with MATRIX_ALREADY_CLOSED
`,
      'utf8',
    );

    writeFileSync(
      join(dir, 'behaviors', 'domain', 'close-matrix.ears'),
      `
slice MatrixRecord.CloseMatrix

rules:
  [MX-CL-01] WHILE rec.status == "open"
       WHEN CloseMatrix
       SHALL emit MatrixClosed
         AND transition rec.status -> "closed"
       post:
         rec.optNote' = none
         rec.optStamp' = none

  [MX-CL-02] WHILE rec.status != "open"
       WHEN CloseMatrix
       SHALL reject request with MATRIX_ALREADY_CLOSED
`,
      'utf8',
    );

    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    const scalaOut = join(dir, 'out-scala');
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: scalaOut, packageName: 'test.matrix' });
    const scalaBehavior = readFileSync(join(scalaOut, 'generated-scaffold/scala/test/matrix/MatrixRecordBehavior.scala'), 'utf8');
    assert.match(scalaBehavior, /count: Long/u);
    assert.match(scalaBehavior, /amount: BigDecimal/u);
    assert.match(scalaBehavior, /active: Boolean/u);
    assert.match(scalaBehavior, /optNote: Option\[String\]/u);
    assert.match(scalaBehavior, /optStamp: Option\[Long\]/u);
    assert.match(scalaBehavior, /counters: Map\[String, Long\]/u);

    const tsOut = join(dir, 'out-ts');
    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: tsOut });
    const tsBehaviorPath = join(tsOut, 'generated-scaffold/ts/matrix-record.behavior.ts');
    const mod = await import(pathToFileURL(tsBehaviorPath).href);

    const s0 = mod.initialMatrixRecordState();
    const res1 = mod.handleMatrixRecordCommand(s0, {
      type: 'UpdateMatrix',
      delta: 3,
      stepAmount: '12.50',
      tag: 'k1',
      note: 'hello',
      stamp: 42,
    });
    assert.equal(res1.ok, true);
    const s1 = mod.replayMatrixRecord(s0, res1.events);
    assert.equal(s1.count, 3);
    assert.equal(s1.amount, '12.50');
    assert.equal(s1.optNote, 'hello');
    assert.equal(s1.optStamp, 42);
    assert.equal(s1.counters.k1, 3);

    const res2 = mod.handleMatrixRecordCommand(s1, { type: 'CloseMatrix' });
    assert.equal(res2.ok, true);
    const s2 = mod.replayMatrixRecord(s1, res2.events);
    assert.equal(s2.status, 'closed');
    assert.equal(s2.optNote, null);
    assert.equal(s2.optStamp, null);

    const emitted = emitV2ExecutableTests(compiled.canonical, {
      outDir: tsOut,
      targets: ['typescript', 'scala'],
      packageName: 'test.matrix',
    });
    const tsSpecs = emitted.emitted.filter(e => e.kind === 'typescript-node-test');
    const scalaSpecs = emitted.emitted.filter(e => e.kind === 'scala-scalatest');
    assert.equal(tsSpecs.length, 2);
    assert.equal(scalaSpecs.length, 2);
    for (const entry of [...tsSpecs, ...scalaSpecs]) {
      const content = readFileSync(entry.file, 'utf8');
      assert.doesNotMatch(content, /__present/u, `witness must not leak .__present into ${entry.file}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Identifier stem idempotency: Saga orchestration never emits duplicate SagaSaga suffixes', () => {
  const canonical = {
    system: 'stem-test',
    context: 'core',
    structures: {
      aggregates: [],
      sagas: [
        { name: 'Order', steps: [{ name: 'Step1', command: 'Agg.Cmd' }] },
        { name: 'OrderFulfillmentSaga', steps: [{ name: 'Step1', command: 'Agg.Cmd' }] },
      ],
    },
    behaviors: [],
  };

  const out = emitV1OrchestrationSuite(canonical, { packageName: 'test.stem' });
  const allPaths = [...Object.keys(out.files), ...Object.keys(out.handwrittenFiles)];
  for (const p of allPaths) {
    assert.doesNotMatch(p, /SagaSaga/u, `path must not double Saga suffix: ${p}`);
  }
  assert.ok(allPaths.some(p => p.endsWith('/OrderSagaModule.scala')));
  assert.ok(allPaths.some(p => p.endsWith('/OrderFulfillmentSagaModule.scala')));
});

test('Single-source-of-truth contract gate passes and capabilities lock contains zero local paths', () => {
  const contracts = checkContracts(ROOT);
  assert.equal(contracts.passed, true, JSON.stringify(contracts.errors, null, 2));

  const lock = exportCapabilitiesLock(ROOT);
  assert.equal(lock.schemaVersion, 'co-arising.capabilities/v1');
  assert.equal(lock.mcpTools.total, 32);
  assert.equal(lock.runtimeDependencies, 0);
  assert.ok(lock.cliCommands.includes('export-capabilities'));
  assert.doesNotMatch(JSON.stringify(lock), /\/Users\/|\/home\//u);
});
