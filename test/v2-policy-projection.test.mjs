import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { getCodegenPlugin } from '../lib/v2/codegen/interface.mjs';
import { generateScalaCqrsPlayServiceV2 } from '../generators/scala-cqrs-play-service-v2/generate.mjs';
import { emitV1PolicySuite } from '../lib/v2/bridge/v1-strict-policy.mjs';
import { checkBehavioralTestability, detectScalaToolchain } from '../lib/v2/verify-gate.mjs';
import { prepareStandaloneKernelFiles } from '../lib/v2/mutation-gate.mjs';
import { generatePolicyExec } from '../generators/policy-dsl/policyexec.mjs';

const SBT_FRAMEWORK_IMPORT_RE = /^\s*import\s+(?:akka\.|play\.|javax\.inject\.|com\.google\.inject\.|com\.google\.protobuf\.|scalapb\.|scalikejdbc\.|[^\s]+\.(?:application\.aggregates|application\.process\.[^\s]+SagaModule|infrastructure\.\{?proto|infrastructure\.persistence\.converters|infrastructure\.bootstrap|infrastructure\.readside|infrastructure\.api)\b|[^\s]+\.(?:common\.(?:application|serialization|auth)|infra\.saga)\.)/mu;

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function collectFiles(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, ext, out);
    else if (entry.isFile() && entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function writeReactivePolicyFixture(dir) {
  mkdirSync(join(dir, 'structures'), { recursive: true });
  mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
  mkdirSync(join(dir, 'behaviors/application'), { recursive: true });

  writeFileSync(join(dir, 'structures/s.yaml'), `
system: policy-lab
context: pol

exactTypes:
  - name: AmountDecimal
    form: decimal
    scale: 2

valueObjects:
  - name: FulfillmentOriginal
    fields:
      - fulfillmentId: String
      - actor: String
  - name: FulfillmentAck
    fields:
      - replayed: Bool

externContracts:
  - name: fulfillmentPinned
    params:
      - fulfillmentId: String
      - actor: String

aggregates:
  - name: SourceOrder
    aliases: [srcorder, state]
    stateFields:
      - paid: Bool = false
      - amount: AmountDecimal = "0.00"
    commands:
      - name: PayOrder
        parameters:
          - fulfillmentId: String
          - actor: String
          - amount: AmountDecimal
        produces: [OrderPaid]
    events:
      - name: OrderPaid
        fields:
          - fulfillmentId: String
          - actor: String
          - amount: AmountDecimal
  - name: Fulfillment
    aliases: [fulfillment, state]
    stateFields:
      - started: Bool = false
      - totalAmount: AmountDecimal = "0.00"
    commands:
      - name: StartFulfillment
        parameters:
          - fulfillmentId: String
          - actor: String
          - amount: AmountDecimal
        produces: [FulfillmentStarted]
    events:
      - name: FulfillmentStarted
        waiveLineage: audit-only
        fields:
          - fulfillmentId: String
          - amount: AmountDecimal

stories:
  - name: FulfillmentPolicy
    pins: [FulfillmentOriginal]
    responses: [FulfillmentAck]
    dispose:
      permanentOn: [INVALID_FULFILLMENT, AGG_NOT_INITIALIZED]
`, 'utf8');

  writeFileSync(join(dir, 'behaviors/domain/pay-order.ears'), `
slice SourceOrder.PayOrder

rules:
  [PAY-EMPTY] IF amount <= 0.00 THEN SHALL reject request with INVALID_AMOUNT
  [PAY-OK]    WHILE amount > 0.00
              WHEN PayOrder
              SHALL emit OrderPaid
              post:
                srcorder.paid' = true
                srcorder.amount' = amount
`, 'utf8');

  writeFileSync(join(dir, 'behaviors/domain/start-fulfillment.ears'), `
slice Fulfillment.StartFulfillment

rules:
  [FUL-STARTED] IF fulfillment.started THEN SHALL reject request with ALREADY_STARTED
  [FUL-BAD]     WHILE not fulfillment.started and amount <= 0.00
                WHEN StartFulfillment
                SHALL reject request with INVALID_FULFILLMENT
  [FUL-OK]      WHILE not fulfillment.started and amount > 0.00
                WHEN StartFulfillment
                SHALL emit FulfillmentStarted
                post:
                  fulfillment.started' = true
                  fulfillment.totalAmount' = amount
`, 'utf8');

  writeFileSync(join(dir, 'behaviors/application/fulfillment-policy.integration.ears'), `
story FulfillmentPolicy layer application

where:
  extern fulfillmentPinned(fulfillmentId, actor)

rules:
  [FP-01] WHILE not fulfillmentPinned(fulfillmentId, actor)
          WHEN event SourceOrder.OrderPaid
          SHALL pin FulfillmentOriginal from (fulfillmentId, actor)
            AND dispatch Fulfillment.StartFulfillment
            AND respond FulfillmentAck with ack.replayed == false

  [FP-02] WHILE fulfillmentPinned(fulfillmentId, actor)
          WHEN event SourceOrder.OrderPaid
          SHALL respond FulfillmentAck with ack.replayed == true
            AND SHALL NOT dispatch Fulfillment.StartFulfillment
`, 'utf8');
}

test('v1 policyexec PolicyMachine inspects Left(iMadzError) from Future.traverse instead of discarding it', () => {
  const canonicalV1 = {
    sessions: [
      {
        scopes: [
          {
            notes: [
              {
                type: 'policy',
                name: 'StartWork',
                info: {
                  executionSide: true,
                  invokes: [{ command: 'DoWork', aggregate: 'Target' }],
                  triggers: [{ event: 'WorkRequested', aggregate: 'Source' }],
                  entityIdField: 'targetId',
                  dispose: { permanentOn: ['PERM_ERR'], message: 'failed {code}' },
                },
              },
            ],
          },
        ],
      },
    ],
    aggregates: [
      {
        name: 'Source',
        events: [{ name: 'WorkRequested', fields: [] }],
      },
      {
        name: 'Target',
        commands: [{ name: 'DoWork', parameters: [{ name: 'targetId', dataType: 'Id' }] }],
      },
    ],
  };

  const files = generatePolicyExec(canonicalV1);
  const machine = files.find(f => f.path.endsWith('/PolicyMachine.scala'));
  assert.ok(machine, 'PolicyMachine.scala should be emitted');
  assert.match(machine.content, /val verdicts = results\.collect \{ case Left\(err\) => dispose\(e, err\) \}/u);
  assert.match(machine.content, /Future\s*\.traverse\(permanents\)\(p => bury\(envelope, s"\$aggType·\$\{p\.what\}"\)\)/u);
  assert.match(machine.content, /case Some\(FailureVerdict\.Retryable\(err\)\) =>/u);
});

test('v2 scala-cqrs-play-service:2 wires reactive Event => Command policies through PolicyMachine & ApplicationBootstrap', () => {
  const dir = makeTempDir('truthsrc-v2-policy-');
  try {
    writeReactivePolicyFixture(dir);
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      outFile: join(dir, '.truthsrc/canonical-v2.json'),
      dbFile: join(dir, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    const genRes = generateScalaCqrsPlayServiceV2(compiled.canonical, {
      outDir: dir,
      packageName: 'example.pol.v2',
    });
    for (const fam of ['policy-decision', 'policy-mechanics', 'policy-handler', 'policy-runner', 'policy-bootstrap', 'projection-runtime-mechanism']) {
      assert.ok(genRes.familiesUsed.includes(fam), `missing family ${fam} in familiesUsed`);
    }

    const pkgBase = join(dir, 'generated-scaffold/scala/example/pol/v2');
    const policyDir = join(pkgBase, 'application/projection/policy');
    const bootDir = join(pkgBase, 'infrastructure/bootstrap');

    const expectedFiles = [
      join(policyDir, 'FailureVerdict.scala'),
      join(policyDir, 'PolicyEnvelope.scala'),
      join(policyDir, 'PolicyMachine.scala'),
      join(policyDir, 'PolicyDlqBury.scala'),
      join(policyDir, 'PolicyOnStartFulfillment.scala'),
      join(policyDir, 'PolicyOnStartFulfillmentMechanics.scala'),
      join(policyDir, 'PolicyOnStartFulfillmentHandler.scala'),
      join(policyDir, 'PolicyOnStartFulfillmentRunner.scala'),
      join(bootDir, 'PolicyOnStartFulfillmentBootstrap.scala'),
    ];
    for (const file of expectedFiles) {
      assert.equal(existsSync(file), true, `missing expected generated file: ${file}`);
      const content = readFileSync(file, 'utf8');
      assert.ok(content.startsWith('// @generated by truthsrc scala-cqrs-play-service:2'));
      assert.doesNotMatch(content, /\?\?\?/u);
      assert.doesNotMatch(content, /\bcontractJson\b/u);
      assert.doesNotMatch(content, /@knowledge[^\n]*\/\d+/u);
    }

    const appBoot = readFileSync(join(bootDir, 'ApplicationBootstrap.scala'), 'utf8');
    assert.match(appBoot, /with PolicyOnStartFulfillmentBootstrap/u);
    assert.match(appBoot, /initPolicyOnStartFulfillmentProjection\(/u);
    assert.match(appBoot, /policyDlqSink: PolicyDlqSink/u);

    const genBindings = readFileSync(join(pkgBase, 'modules/GeneratedBindingsModule.scala'), 'utf8');
    assert.match(genBindings, /bind\(classOf\[PolicyDlqSink\]\)\.toInstance\(PolicyDlqSink\.Noop\)/u);
    assert.match(genBindings, /bind\(classOf\[PolicyOnStartFulfillmentSemantics\]\)\.toInstance\(PolicyOnStartFulfillment\.DefaultSemantics\)/u);

    const kernelSrc = readFileSync(join(policyDir, 'PolicyOnStartFulfillment.scala'), 'utf8');
    assert.match(kernelSrc, /entityId = event\.fulfillmentId\.toString/u);
    assert.match(kernelSrc, /FailureVerdict\.Permanent\(/u);
    assert.match(kernelSrc, /"INVALID_FULFILLMENT"/u);

    const mechanicsSrc = readFileSync(join(policyDir, 'PolicyOnStartFulfillmentMechanics.scala'), 'utf8');
    assert.match(mechanicsSrc, /FulfillmentAggregate\.EntityKey/u);
    assert.match(mechanicsSrc, /case Accepted\(_\) => Right\(\(\)\)/u);
    assert.match(mechanicsSrc, /case Refused\(err\) => Left\(err\)/u);

    const testability = checkBehavioralTestability(dir);
    assert.equal(testability.passed, true, JSON.stringify(testability.violations, null, 2));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('v2 generated PolicyMachine executes Right, Permanent-DLQ, Retryable-Fail, and mixed fan-out correctly in real scalac/scala', (t) => {
  const toolchain = detectScalaToolchain();
  if (!toolchain.available) {
    t.skip('scalac/scala binaries not found on PATH');
    return;
  }

  const dir = makeTempDir('truthsrc-v2-policy-scala-');
  try {
    writeReactivePolicyFixture(dir);
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    getCodegenPlugin('scala-cqrs-play-service-v2').generate(compiled.canonical, {
      outDir: dir,
      packageName: 'example.pol.v2',
    });

    const allScaffold = collectFiles(join(dir, 'generated-scaffold/scala'), '.scala');
    const standaloneFiles = allScaffold.filter(f => !SBT_FRAMEWORK_IMPORT_RE.test(readFileSync(f, 'utf8')));
    const kernelStubs = prepareStandaloneKernelFiles(dir, standaloneFiles);

    const driverPath = join(dir, 'PolicyMachineDriver.scala');
    writeFileSync(driverPath, `
package example.pol.v2.application.projection.policy

import net.imadz.common.CommonTypes.iMadzError
import example.pol.v2.domain.entities.SourceOrderEntity.OrderPaid
import scala.collection.mutable.ListBuffer
import scala.concurrent.duration._
import scala.concurrent.{Await, ExecutionContext, Future}

object PolicyMachineDriver extends App {
  implicit val ec: ExecutionContext = ExecutionContext.global
  val sem = PolicyOnStartFulfillment.DefaultSemantics
  val evt = OrderPaid("ful-1", "actor-1", BigDecimal("12.34"))
  val decode: Any => Option[OrderPaid] = {
    case o: OrderPaid => Some(o)
    case _ => None
  }

  // 1. Unmatched event skips execute & bury
  val buried1 = ListBuffer.empty[String]
  Await.result(
    PolicyMachine.run[OrderPaid, PolicyOnStartFulfillmentCommand](
      PolicyEnvelope("SourceOrder|1", 1L, "ignored"),
      "SourceOrder",
      decode,
      sem.decide,
      _ => Future.failed(new AssertionError("execute should not run")),
      sem.dispose,
      (_, what) => { buried1 += what; Future.successful(()) }
    ),
    5.seconds
  )
  require(buried1.isEmpty)

  // 2. Matched event with Right(()) succeeds and passes entityId & fields
  val executed = ListBuffer.empty[PolicyOnStartFulfillmentCommand]
  Await.result(
    PolicyMachine.run[OrderPaid, PolicyOnStartFulfillmentCommand](
      PolicyEnvelope("SourceOrder|1", 2L, evt),
      "SourceOrder",
      decode,
      sem.decide,
      cmd => { executed += cmd; Future.successful(Right(())) },
      sem.dispose,
      (_, what) => Future.failed(new AssertionError(s"unexpected bury: $what"))
    ),
    5.seconds
  )
  require(executed.size == 1 && executed.head.entityId == "ful-1" && executed.head.params.actor == "actor-1")

  // 3. Matched event returning Left(permanent error) invokes bury and advances offset
  val buried3 = ListBuffer.empty[String]
  Await.result(
    PolicyMachine.run[OrderPaid, PolicyOnStartFulfillmentCommand](
      PolicyEnvelope("SourceOrder|1", 3L, evt),
      "SourceOrder",
      decode,
      sem.decide,
      _ => Future.successful(Left(iMadzError("INVALID_FULFILLMENT", "bad payload"))),
      sem.dispose,
      (_, what) => { buried3 += what; Future.successful(()) }
    ),
    5.seconds
  )
  require(buried3.size == 1 && buried3.head.contains("SourceOrder") && buried3.head.contains("INVALID_FULFILLMENT"))

  // 4. Matched event returning Left(retryable error) fails the Future (no bury, no offset commit)
  val buried4 = ListBuffer.empty[String]
  val failed4 = scala.util.Try {
    Await.result(
      PolicyMachine.runSimple[OrderPaid, PolicyOnStartFulfillmentCommand](
        PolicyEnvelope("SourceOrder|1", 4L, evt),
        "SourceOrder",
        decode,
        e => sem.decide(PolicyEnvelope("SourceOrder|1", 4L, e), e),
        _ => Future.successful(Left(iMadzError("TRANSIENT_TIMEOUT", "try again"))),
        sem.dispose,
        (_, what) => { buried4 += what; Future.successful(()) }
      ),
      5.seconds
    )
  }
  require(buried4.isEmpty)
  require(failed4.isFailure && failed4.failed.get.getMessage.contains("TRANSIENT_TIMEOUT"))

  // 5. Fan-out mixing Permanent and Retryable buries permanent AND fails for retryable
  val buried5 = ListBuffer.empty[String]
  val fanOutCmds = List(
    PolicyOnStartFulfillmentCommand("ful-perm", sem.decide(PolicyEnvelope("p", 5L, evt), evt).head.params),
    PolicyOnStartFulfillmentCommand("ful-retry", sem.decide(PolicyEnvelope("p", 5L, evt), evt).head.params)
  )
  val failed5 = scala.util.Try {
    Await.result(
      PolicyMachine.run[OrderPaid, PolicyOnStartFulfillmentCommand](
        PolicyEnvelope("SourceOrder|1", 5L, evt),
        "SourceOrder",
        decode,
        (_, _) => fanOutCmds,
        cmd =>
          if (cmd.entityId == "ful-perm") Future.successful(Left(iMadzError("AGG_NOT_INITIALIZED", "gone")))
          else Future.successful(Left(iMadzError("TEMP_BUSY", "retry"))),
        sem.dispose,
        (_, what) => { buried5 += what; Future.successful(()) }
      ),
      5.seconds
    )
  }
  require(buried5.size == 1 && buried5.head.contains("AGG_NOT_INITIALIZED"))
  require(failed5.isFailure && failed5.failed.get.getMessage.contains("TEMP_BUSY"))

  println("POLICY_MACHINE_DRIVER_OK")
}
`, 'utf8');

    const outClasses = join(dir, 'classes');
    mkdirSync(outClasses, { recursive: true });
    const comp = spawnSync('scalac', ['-d', outClasses, ...kernelStubs, ...standaloneFiles, driverPath], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 90_000,
    });
    assert.equal(comp.status, 0, `scalac failed:\n${comp.stderr}\n${comp.stdout}`);

    const run = spawnSync('scala', ['-cp', outClasses, 'example.pol.v2.application.projection.policy.PolicyMachineDriver'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(run.status, 0, `scala driver failed:\n${run.stderr}\n${run.stdout}`);
    assert.match(run.stdout, /POLICY_MACHINE_DRIVER_OK/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('zero-policy canonicalV2 emits no policy files and preserves ApplicationBootstrap', () => {
  const canonicalV2 = {
    schemaVersion: 'co-arising.canonical/v2',
    system: 'empty-pol',
    context: 'core',
    canonicalSha256: 'a'.repeat(64),
    structures: {
      exactTypes: [],
      valueObjects: [],
      aggregates: [],
      sagas: [],
      readModels: [],
      ports: [],
      stories: [],
    },
    behaviors: [],
    eventFolds: [],
    clozeSlots: [],
    verificationSummary: { solver: 'z3', passed: true, behaviorCount: 0, deterministicCount: 0, clozeCount: 0 },
  };
  const emptyRes = emitV1PolicySuite(canonicalV2, { packageName: 'example.empty.v2' });
  assert.deepEqual(emptyRes, {
    files: {},
    handwrittenFiles: {},
    policyProjections: [],
    familiesUsed: [],
  });

  const dir = makeTempDir('truthsrc-v2-zero-policy-');
  try {
    const genRes = generateScalaCqrsPlayServiceV2(canonicalV2, { outDir: dir, packageName: 'example.empty.v2' });
    assert.equal(genRes.familiesUsed.includes('policy-decision'), false);
    assert.equal(genRes.familiesUsed.includes('projection-runtime-mechanism'), false);
    const appBoot = readFileSync(
      join(dir, 'generated-scaffold/scala/example/empty/v2/infrastructure/bootstrap/ApplicationBootstrap.scala'),
      'utf8',
    );
    assert.doesNotMatch(appBoot, /PolicyDlqSink/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
