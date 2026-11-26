// Comprehensive end-to-end tests for co-arising 2.0 Full-Chain Data Lineage & Type Safety (P0 + P1 + P2):
//   - Segment 0: Structure schema & type parsing (V2_UNKNOWN_TYPE, V2_DUPLICATE_DECLARATION, V2_INVALID_DEFAULT_VALUE, V2_UNKNOWN_PRODUCED_EVENT, V2_AMBIGUOUS_IMPLICIT_EVENT_FIELDS, V2_UNKNOWN_OWNER_PORT)
//   - Segment 1: (State, Command) -> Event field lineage & type safety across L1/L2/L3 (@PROPAGATED, @FROM_STATE, @CONSTANT, V2_EVENT_FIELD_TYPE_MISMATCH, V2_UNDECLARED_EMIT_IN_PRODUCES)
//   - Segment 2: (State, Event) -> State event-typed post: validation, nested record folds, multi-event fold disambiguation, and exact post-replay assertions in TS & ScalaTest
//   - Segments 3-7: Cross-operation scope isolation, pin input binding, extern argument type checking, respond/expose RHS & type checks, SHALL NOT supply static gate, dispatch param type checks, ReadModel & Saga lineage, and strictLineage coverage audit
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
import { formatType, isTypeCompatible, validateDefaultValue } from '../lib/ears/type-compat.mjs';
import { evaluateDomainPostAssertions } from '../lib/v2/test-emitter/witness-materialize.mjs';

function makeProject(structuresYaml, domainEars = {}, appEars = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'truthsrc-v2-lineage-'));
  mkdirSync(join(dir, 'structures'), { recursive: true });
  mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
  if (Object.keys(appEars).length > 0) {
    mkdirSync(join(dir, 'behaviors/application'), { recursive: true });
  }
  writeFileSync(join(dir, 'structures/model.yaml'), structuresYaml, 'utf8');
  for (const [name, content] of Object.entries(domainEars)) {
    writeFileSync(join(dir, 'behaviors/domain', name), content, 'utf8');
  }
  for (const [name, content] of Object.entries(appEars)) {
    writeFileSync(join(dir, 'behaviors/application', name), content, 'utf8');
  }
  return dir;
}

test('Segment 0: rejects malformed/misspelled types, duplicates, invalid defaults, bad produces, ambiguous implicit event fields, and bad ownerPort', () => {
  const yaml = `
system: schema-gate
context: core
nominalTypes: [AccountId]

ports:
  - name: MainPort
    operations:
      - name: run
        parameters:
          - acct: AccountId

externContracts:
  - name: checkAcct
    ownerPort: GhostPort
    params:
      - acct: AccountId

aggregates:
  - name: Ledger
    stateFields:
      - name: badOpt
        type: Option[Long]
      - name: badPrim
        type: Lng
      - name: unregisteredNom
        type: UnknownId
      - name: badDefaultInt
        type: Int
        default: "not_an_int"
      - name: status
        type: String
        default: "typo_default"
        enum: ["open", "closed"]
      - name: status
        type: String
        default: "open"
    commands:
      - name: CmdA
        parameters:
          - x: Int
        produces: [SharedEv, GhostEv]
      - name: CmdB
        parameters:
          - y: String
        produces: [SharedEv]
    events:
      - name: SharedEv
        fields: []
`;
  const dir = makeProject(yaml, {
    'cmd-a.ears': 'slice Ledger.CmdA\nrules:\n  [R1] WHEN CmdA SHALL emit SharedEv\n',
  });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const codes = new Set(res.diagnostics.map(d => d.code));
    assert.ok(codes.has('V2_UNKNOWN_TYPE'), `expected V2_UNKNOWN_TYPE in ${[...codes]}`);
    assert.ok(codes.has('V2_DUPLICATE_DECLARATION'), `expected V2_DUPLICATE_DECLARATION in ${[...codes]}`);
    assert.ok(codes.has('V2_INVALID_DEFAULT_VALUE'), `expected V2_INVALID_DEFAULT_VALUE in ${[...codes]}`);
    assert.ok(codes.has('V2_UNKNOWN_PRODUCED_EVENT'), `expected V2_UNKNOWN_PRODUCED_EVENT in ${[...codes]}`);
    assert.ok(codes.has('V2_AMBIGUOUS_IMPLICIT_EVENT_FIELDS'), `expected V2_AMBIGUOUS_IMPLICIT_EVENT_FIELDS in ${[...codes]}`);
    assert.ok(codes.has('V2_UNKNOWN_OWNER_PORT'), `expected V2_UNKNOWN_OWNER_PORT in ${[...codes]}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Segment 1: blocks Command->Event type mismatch across L1 and L2, and blocks undeclared emit vs produces', () => {
  const yaml = `
system: lineage-cmd-ev
context: orders
exactTypes:
  - name: Amount2
    form: decimal
    scale: 2
  - name: Amount4
    form: decimal
    scale: 4
aggregates:
  - name: Order
    aliases: [order, state]
    stateFields:
      - budget: Amount2 = "100.00"
      - status: String = "open"
    commands:
      - name: Reserve
        parameters:
          - orderId: OrderId
          - qty: Int
          - amount: Amount2
        produces: [Reserved]
      - name: Settle
        parameters:
          - units: Int
          - unitPrice: Amount4
        produces: [Settled]
    events:
      - name: Reserved
        fields:
          - orderId: AccountId
          - qty: String
          - amount: Amount4
      - name: Settled
        fields:
          - units: String
          - unitPrice: Amount4
      - name: SurpriseEv
        fields: []
`;
  const dir = makeProject(yaml, {
    'reserve.ears': `
slice Order.Reserve
rules:
  [R1] IF qty <= 0 THEN SHALL reject request with BAD_QTY
  [R2] WHILE qty > 0 WHEN Reserve SHALL emit Reserved
`,
    'settle.ears': `
slice Order.Settle
where:
  validFloor = units >= 0 and units * unitPrice <= order.budget
rules:
  [S1] IF not validFloor THEN SHALL reject request with BAD_FLOOR
  [S2] WHILE validFloor and units == 0 WHEN Settle SHALL emit SurpriseEv
  [S3] WHILE validFloor and units > 0 WHEN Settle SHALL emit Settled
`,
  });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      checkGaps: false,
    });
    assert.equal(res.passed, false);
    const typeMismatches = res.diagnostics.filter(d => d.code === 'V2_EVENT_FIELD_TYPE_MISMATCH');
    // 3 mismatches in L1 Reserved (OrderId vs AccountId, Int vs String, Amount2 vs Amount4) + 1 in L2 Settled (Int vs String)
    assert.ok(typeMismatches.length >= 4, `expected >=4 V2_EVENT_FIELD_TYPE_MISMATCH, got ${JSON.stringify(typeMismatches, null, 2)}`);
    assert.ok(
      res.diagnostics.some(d => d.code === 'V2_UNDECLARED_EMIT_IN_PRODUCES'),
      `expected V2_UNDECLARED_EMIT_IN_PRODUCES in ${JSON.stringify(res.diagnostics, null, 2)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Segment 1+2 E2E: @FROM_STATE, explicit source: (cmd/state/const), nested record post:, and exact post-replay assertions compile & run in TS and real scalac', async () => {
  const yaml = `
system: lineage-e2e
context: billing
valueObjects:
  - name: AuditMeta
    fields:
      - version: Int = 0
      - lastReason: String = ""
aggregates:
  - name: Invoice
    aliases: [inv, state]
    stateFields:
      - customerId: CustomerId = "cust-init"
      - name: status
        type: String
        default: "open"
        enum: ["open", "cancelled"]
      - publishedAtMs: Optional[Int]
      - meta: AuditMeta
    commands:
      - name: CancelInvoice
        parameters:
          - cancelReason: String
        produces: [InvoiceCancelled]
    events:
      - name: InvoiceCancelled
        fields:
          - customerId: CustomerId
          - name: reason
            type: String
            source: cmd.cancelReason
          - name: nextVersion
            type: Int
            source: const:1
          - name: snapshotStatus
            type: String
            source: state.status
`;
  const ears = `
slice Invoice.CancelInvoice
rules:
  [C1] WHILE inv.status != "open"
       WHEN CancelInvoice
       SHALL reject request with NOT_OPEN
  [C2] WHILE inv.status == "open"
       WHEN CancelInvoice
       SHALL transition inv.status -> "cancelled"
         AND emit InvoiceCancelled
       post:
         inv.publishedAtMs' = none
         inv.meta.version' = inv.meta.version + nextVersion
         inv.meta.lastReason' = reason
`;
  // Wait: `nextVersion` and `reason` in post: are event fields (not command params) — let's verify!
  // Actually in EARS domain rules, post: symbols bind against command params during binder, so let's keep `post:` referencing `cancelReason` when event carries `cancelReason`, OR test explicit source: cmd.cancelReason + state snapshot!
  const earsAligned = `
slice Invoice.CancelInvoice
rules:
  [C1] WHILE inv.status != "open"
       WHEN CancelInvoice
       SHALL reject request with NOT_OPEN
  [C2] WHILE inv.status == "open"
       WHEN CancelInvoice
       SHALL transition inv.status -> "cancelled"
         AND emit InvoiceCancelled
       post:
         inv.publishedAtMs' = none
         inv.meta.version' = inv.meta.version + 1
         inv.meta.lastReason' = cancelReason
`;
  const yamlAligned = yaml.replace(
    `          - name: reason
            type: String
            source: cmd.cancelReason`,
    `          - name: cancelReason
            type: String
            source: cmd.cancelReason`,
  );

  const dir = makeProject(yamlAligned, { 'cancel-invoice.ears': earsAligned });
  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));
    assert.ok(compiled.canonical.lineage, 'canonical must include lineage graph');

    // Verify TS codegen & live execution
    const tsOut = join(dir, 'out-ts');
    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: tsOut });
    const tsBehPath = join(tsOut, 'generated-scaffold/ts/invoice.behavior.ts');
    const tsBeh = readFileSync(tsBehPath, 'utf8');
    assert.match(tsBeh, /customerId: state\.customerId/u);
    assert.match(tsBeh, /snapshotStatus: state\.status/u);
    assert.match(tsBeh, /nextVersion: 1/u);
    assert.match(tsBeh, /meta: \{ \.\.\.state\.meta,/u);

    const mod = await import(pathToFileURL(tsBehPath).href);
    const s0 = { ...mod.initialInvoiceState(), customerId: 'C-42', publishedAtMs: 999 };
    const outcome = mod.handleInvoiceCommand(s0, { type: 'CancelInvoice', cancelReason: 'duplicate' });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.events[0].customerId, 'C-42');
    assert.equal(outcome.events[0].snapshotStatus, 'open');
    assert.equal(outcome.events[0].nextVersion, 1);
    const s1 = mod.replayInvoice(s0, outcome.events);
    assert.equal(s1.status, 'cancelled');
    assert.equal(s1.publishedAtMs, null);
    assert.equal(s1.meta.version, 1);
    assert.equal(s1.meta.lastReason, 'duplicate');

    // Emit locked TS & Scala tests and verify exact post-replay assertions are emitted
    emitV2ExecutableTests(compiled.canonical, { outDir: tsOut, targets: ['typescript', 'scala'], packageName: 'test.lin' });
    const tsSpec = readFileSync(join(tsOut, 'generated-tests/ts/invoice-cancel-invoice.ears.spec.ts'), 'utf8');
    assert.match(tsSpec, /assert\.deepEqual\(nextState\.publishedAtMs, null\)/u);
    assert.match(tsSpec, /assert\.deepEqual\(nextState\.meta\.version, 1\)/u);
    assert.match(tsSpec, /assert\.deepEqual\(nextState\.meta\.lastReason,/u);

    // Run generated locked TS test suite live
    execFileSync(process.execPath, ['--test', join(tsOut, 'generated-tests/ts/invoice-cancel-invoice.ears.spec.ts')], { stdio: 'pipe' });

    // Verify Scala codegen & live scalac + ScalaTest shim execution
    const scOut = join(dir, 'out-scala');
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: scOut, packageName: 'test.lin' });
    emitV2ExecutableTests(compiled.canonical, { outDir: scOut, targets: ['scala'], packageName: 'test.lin' });
    const scBeh = readFileSync(join(scOut, 'generated-scaffold/scala/test/lin/InvoiceBehavior.scala'), 'utf8');
    assert.match(scBeh, /state\.customerId/u);
    assert.match(scBeh, /state\.meta\.copy\(/u);
    const scSpec = readFileSync(join(scOut, 'generated-tests/scala/test/lin/InvoiceCancelInvoiceEarsSpec.scala'), 'utf8');
    assert.match(scSpec, /assert\(nextState\.publishedAtMs == None\)/u);
    assert.match(scSpec, /assert\(nextState\.meta\.version == 1L\)/u);

    const shimPath = join(dir, 'AnyFunSuiteShim.scala');
    writeFileSync(shimPath, `
package org.scalatest.funsuite
abstract class AnyFunSuite {
  private val tests = scala.collection.mutable.ListBuffer.empty[(String, () => Unit)]
  protected def test(name: String)(body: => Unit): Unit = tests += ((name, () => body))
  protected def fail(msg: String): Nothing = throw new AssertionError(msg)
  def runAll(): Int = { tests.foreach { case (_, fn) => fn() }; tests.size }
}
`, 'utf8');
    const runnerPath = join(dir, 'RunLineageSpec.scala');
    writeFileSync(runnerPath, `
object RunLineageSpec extends App {
  val n = new test.lin.InvoiceCancelInvoiceEarsSpec().runAll()
  assert(n >= 2)
}
`, 'utf8');
    const classesDir = join(dir, 'scala-classes');
    mkdirSync(classesDir, { recursive: true });
    execFileSync('scalac', [
      '-d', classesDir,
      shimPath,
      join(scOut, 'generated-scaffold/scala/test/lin/DomainTypes.scala'),
      join(scOut, 'generated-scaffold/scala/test/lin/InvoiceBehavior.scala'),
      join(scOut, 'generated-tests/scala/test/lin/InvoiceCancelInvoiceEarsSpec.scala'),
      runnerPath,
    ], { stdio: 'pipe' });
    execFileSync('scala', ['-cp', classesDir, 'RunLineageSpec'], { stdio: 'pipe' });
    void ears;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Segment 2: blocks post: type mismatches, closed-enum typos, map key/value mismatches, event-vs-cmd type divergence, and ambiguous multi-event folds', () => {
  // 2a. post: type mismatch + enum typo + map key mismatch + nominal ID mismatch
  const badPostYaml = `
system: bad-post
context: core
aggregates:
  - name: Account
    aliases: [acct, state]
    stateFields:
      - count: Int = 0
      - ownerId: OwnerId = ""
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
      - balances: Map[OwnerId, Int] = []
    commands:
      - name: Mutate
        parameters:
          - label: String
          - otherId: ActorId
        produces: [Mutated]
    events:
      - name: Mutated
        fields:
          - label: String
          - otherId: ActorId
`;
  const badPostEars = `
slice Account.Mutate
rules:
  [M1] WHEN Mutate SHALL emit Mutated
       post:
         acct.count' = label
         acct.status' = "bogus_status"
         acct.ownerId' = otherId
         acct.balances'[otherId] = label
`;
  const dir1 = makeProject(badPostYaml, { 'mutate.ears': badPostEars });
  try {
    const res = compileCanonicalV2({ structuresDir: join(dir1, 'structures'), specsPath: join(dir1, 'behaviors') });
    assert.equal(res.passed, false);
    const typeErrors = res.diagnostics.filter(d => d.code === 'EARS_TYPE_MISMATCH');
    const enumErrors = res.diagnostics.filter(d => d.code === 'EARS_UNKNOWN_ENUM_LITERAL');
    assert.ok(typeErrors.length >= 4, `expected >=4 EARS_TYPE_MISMATCH on post:, got ${JSON.stringify(res.diagnostics, null, 2)}`);
    assert.ok(enumErrors.length >= 1, `expected EARS_UNKNOWN_ENUM_LITERAL on post:, got ${JSON.stringify(res.diagnostics, null, 2)}`);
  } finally {
    rmSync(dir1, { recursive: true, force: true });
  }

  // 2b. Event field diverges from Command param (cmd.payload: PayloadVO vs event.payload: String) -> V2_POST_EVENT_TYPE_MISMATCH
  const divergeYaml = `
system: post-diverge
context: core
valueObjects:
  - name: PayloadVO
    fields:
      - score: Int = 0
aggregates:
  - name: Exam
    aliases: [exam, state]
    stateFields:
      - score: Int = 0
    commands:
      - name: Grade
        parameters:
          - payload: PayloadVO
        produces: [Graded]
    events:
      - name: Graded
        fields:
          - payload: String
`;
  const divergeEars = `
slice Exam.Grade
rules:
  [G1] WHEN Grade SHALL emit Graded
       post:
         exam.score' = payload.score
`;
  const dir2 = makeProject(divergeYaml, { 'grade.ears': divergeEars });
  try {
    const res = compileCanonicalV2({ structuresDir: join(dir2, 'structures'), specsPath: join(dir2, 'behaviors') });
    assert.equal(res.passed, false);
    const codes = new Set(res.diagnostics.map(d => d.code));
    assert.ok(codes.has('V2_EVENT_FIELD_TYPE_MISMATCH'), `expected V2_EVENT_FIELD_TYPE_MISMATCH in ${[...codes]}`);
    assert.ok(codes.has('V2_POST_EVENT_TYPE_MISMATCH'), `expected V2_POST_EVENT_TYPE_MISMATCH in ${[...codes]}`);
  } finally {
    rmSync(dir2, { recursive: true, force: true });
  }

  // 2c. Ambiguous multi-event rule fold blocked (V2_AMBIGUOUS_MULTI_EVENT_FOLD)
  const multiEvYaml = `
system: multi-ev
context: core
aggregates:
  - name: Counter
    aliases: [c, state]
    stateFields:
      - n: Int = 0
    commands:
      - name: Bump
        parameters: []
        produces: [EvA, EvB]
    events:
      - name: EvA
        fields: []
      - name: EvB
        fields: []
`;
  const multiEvEars = `
slice Counter.Bump
rules:
  [B1] WHEN Bump SHALL emit EvA AND emit EvB
       post:
         c.n' = c.n + 1
`;
  const dir3 = makeProject(multiEvYaml, { 'bump.ears': multiEvEars });
  try {
    const res = compileCanonicalV2({ structuresDir: join(dir3, 'structures'), specsPath: join(dir3, 'behaviors') });
    assert.equal(res.passed, false);
    assert.ok(
      res.diagnostics.some(d => d.code === 'V2_AMBIGUOUS_MULTI_EVENT_FOLD'),
      JSON.stringify(res.diagnostics, null, 2),
    );
  } finally {
    rmSync(dir3, { recursive: true, force: true });
  }
});

test('Segments 3-7: blocks cross-operation scope pollution, bad pin inputs, extern arg type mismatch, respond/expose RHS & type errors, SHALL NOT supply violation, dispatch param type mismatch, and ReadModel/Saga lineage errors', () => {
  const yaml = `
system: cross-layer-lineage
context: app
ports:
  - name: PortA
    operations:
      - name: opA
        parameters:
          - actor: ActorId
          - qty: String
          - secretInternalId: String
  - name: PortB
    operations:
      - name: opB
        parameters:
          - onlyInB: Int

valueObjects:
  - name: AckVO
    fields:
      - accepted: Bool
      - name: kind
        type: String
        enum: ["ok", "dup"]

externContracts:
  - name: needsInt
    params:
      - count: Int

aggregates:
  - name: Box
    aliases: [box, state]
    stateFields:
      - qty: Int = 0
    commands:
      - name: Put
        parameters:
          - qty: Int
        produces: [PutDone]
    events:
      - name: PutDone
        fields:
          - qty: Int

readModels:
  - name: bad-view
    sourceAggregate: GhostAgg
    sourceEvents: [GhostEvent]
    fields:
      - name: qty
        type: String
        source: eventField:Box.PutDone.qty
      - name: missing
        type: Int
        source: eventField:Box.PutDone.noSuchField

sagas:
  - name: BrokenSaga
    triggers:
      - event: Box.NoSuchEvent
    invokes:
      - command: Box.NoSuchCmd

stories:
  - name: BadAppStory
    pins: [PinA]
    responses: [AckVO]
`;
  const domainEars = `
slice Box.Put
rules:
  [P1] IF qty <= 0 THEN SHALL reject request with BAD_QTY
  [P2] WHILE qty > 0 WHEN Put SHALL emit PutDone
       post:
         box.qty' = box.qty + qty
`;
  const appEars = `
story BadAppStory layer application
where:
  extern needsInt(count)
axioms:
  [AX-SEC] ALWAYS PortA SHALL NOT supply secretInternalId
rules:
  [A1] IF not needsInt(actor) or onlyInB > 0
       WHEN PortA.opA
       THEN SHALL reject request with BAD
  [A2] WHILE needsInt(actor)
       WHEN PortA.opA
       SHALL pin PinA from (actor, ghostPinVar)
         AND dispatch Box.Put
         AND respond AckVO with ack.accepted == "not_bool" and ack.kind == "bad_enum"
`;
  const dir = makeProject(yaml, { 'put.ears': domainEars }, { 'bad-app.story.ears': appEars });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const codes = new Set(res.diagnostics.map(d => d.code));
    for (const expected of [
      'EARS_UNKNOWN_SYMBOL', // onlyInB leaked from PortB.opB blocked!
      'EARS_EXTERN_ARG_TYPE_MISMATCH', // actor (ActorId) passed to needsInt(count: Int)
      'EARS_UNKNOWN_PIN_INPUT', // ghostPinVar
      'EARS_FORBIDDEN_SUPPLY_DECLARED', // secretInternalId declared on PortA.opA
      'EARS_TYPE_MISMATCH', // ack.accepted == "not_bool"
      'EARS_UNKNOWN_ENUM_LITERAL', // ack.kind == "bad_enum"
      'V2_READMODEL_UNKNOWN_SOURCE_AGGREGATE',
      'V2_READMODEL_UNKNOWN_SOURCE_EVENT',
      'V2_READMODEL_FIELD_TYPE_MISMATCH',
      'V2_READMODEL_UNKNOWN_SOURCE_FIELD',
      'V2_SAGA_UNKNOWN_EVENT',
      'V2_SAGA_UNKNOWN_COMMAND',
    ]) {
      assert.ok(codes.has(expected), `missing ${expected} in ${[...codes].join(', ')}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // Also test V2_DISPATCH_PARAM_TYPE_MISMATCH directly on a story that passes binder!
  const dispatchBadYaml = `
system: dispatch-type-check
context: app
ports:
  - name: BoxPort
    operations:
      - name: put
        parameters:
          - qty: String
valueObjects:
  - name: PutAck
    fields:
      - ok: Bool
aggregates:
  - name: Box
    aliases: [box, state]
    stateFields:
      - qty: Int = 0
    commands:
      - name: Put
        parameters:
          - qty: Int
        produces: [PutDone]
    events:
      - name: PutDone
        fields:
          - qty: Int
stories:
  - name: PutStory
    responses: [PutAck]
`;
  const dispatchBadApp = `
story PutStory layer application
rules:
  [S1] WHEN BoxPort.put
       SHALL dispatch Box.Put
         AND respond PutAck with ack.ok == true
`;
  const dir2 = makeProject(dispatchBadYaml, { 'put.ears': domainEars }, { 'put.story.ears': dispatchBadApp });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(dir2, 'structures'),
      specsPath: join(dir2, 'behaviors'),
    });
    assert.equal(res.passed, false);
    assert.ok(
      res.diagnostics.some(d => d.code === 'V2_DISPATCH_PARAM_TYPE_MISMATCH'),
      JSON.stringify(res.diagnostics, null, 2),
    );
  } finally {
    rmSync(dir2, { recursive: true, force: true });
  }
});

test('P2 Coverage Audit: strictLineage=false emits warnings and canonical.lineage, strictLineage=true fails closed; valid ReadModel & Saga pass cleanly', () => {
  const yaml = `
system: coverage-lineage
context: shop
aggregates:
  - name: Cart
    aliases: [cart, state]
    stateFields:
      - itemCount: Int = 0
      - unusedDeadField: String = ""
    commands:
      - name: AddItem
        parameters:
          - delta: Int
          - auditTag: String
        produces: [ItemAdded, NeverEmittedEv]
      - name: UnspecifiedCmd
        parameters: []
        produces: []
    events:
      - name: ItemAdded
        fields:
          - delta: Int
          - auditTag: String
      - name: NeverEmittedEv
        fields: []

readModels:
  - name: cart-summary
    sourceAggregate: Cart
    sourceEvents: [ItemAdded]
    fields:
      - name: totalCount
        type: Int
        source: stateField:itemCount
      - name: lastDelta
        type: Int
        source: eventField:ItemAdded.delta

sagas:
  - name: CartSaga
    triggers:
      - event: Cart.ItemAdded
    invokes:
      - command: Cart.AddItem
`;
  const ears = `
slice Cart.AddItem
rules:
  [A1] IF delta <= 0 THEN SHALL reject request with BAD_DELTA
  [A2] WHILE delta > 0 WHEN AddItem SHALL emit ItemAdded
       post:
         cart.itemCount' = cart.itemCount + delta
`;
  const dir = makeProject(yaml, { 'add-item.ears': ears });
  try {
    // Non-strict mode: passes with structured coverage warnings and canonical.lineage
    const warnRes = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      strictLineage: false,
    });
    assert.equal(warnRes.passed, true, JSON.stringify(warnRes.diagnostics, null, 2));
    const warnCodes = new Set(warnRes.diagnostics.filter(d => d.severity === 'warning').map(d => d.code));
    for (const c of [
      'V2_LINEAGE_UNSPECIFIED_COMMAND',
      'V2_LINEAGE_UNEMITTED_EVENT',
      'V2_LINEAGE_UNUSED_PRODUCES',
      'V2_LINEAGE_UNCONSUMED_EVENT_FIELD',
      'V2_LINEAGE_DEAD_STATE_FIELD',
    ]) {
      assert.ok(warnCodes.has(c), `expected warning ${c}, got ${[...warnCodes]}`);
    }
    assert.deepEqual(warnRes.canonical.lineage.coverage.unspecifiedCommands, ['Cart.UnspecifiedCmd']);
    assert.deepEqual(warnRes.canonical.lineage.coverage.unemittedEvents, ['Cart.NeverEmittedEv']);
    assert.deepEqual(warnRes.canonical.lineage.coverage.deadStateFields, ['Cart.unusedDeadField']);
    assert.deepEqual(warnRes.canonical.lineage.coverage.unconsumedEventFields, ['Cart.ItemAdded.auditTag']);

    // Strict mode: fails closed on the exact same coverage gaps
    const strictRes = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      strictLineage: true,
    });
    assert.equal(strictRes.passed, false);
    const errCodes = new Set(strictRes.diagnostics.filter(d => d.severity === 'error').map(d => d.code));
    assert.ok(errCodes.has('V2_LINEAGE_UNSPECIFIED_COMMAND'));
    assert.ok(errCodes.has('V2_LINEAGE_UNCONSUMED_EVENT_FIELD'));
    assert.ok(errCodes.has('V2_LINEAGE_DEAD_STATE_FIELD'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Unit: type-compat matrix covers full type lattice (Optional, Nominal, Enum subset, Decimal scale, UnitDecimal, Seq, Map, Record) and default validation', () => {
  const tInt = { kind: 'int', typeName: 'Int' };
  const tBool = { kind: 'bool', typeName: 'Bool' };
  const tStr = { kind: 'string', typeName: 'String' };
  const tNone = { kind: 'none' };
  const tDec2 = { kind: 'decimal', scale: 2 };
  const tDec4 = { kind: 'decimal', scale: 4 };
  const tOptInt = { kind: 'optional', element: tInt };
  const tOptStr = { kind: 'optional', element: tStr };
  const tOrderId = { kind: 'string', typeName: 'OrderId', nominal: true };
  const tAcctId = { kind: 'string', typeName: 'AccountId', nominal: true };
  const tEnumAB = { kind: 'string', typeName: 'String', enumValues: ['a', 'b'] };
  const tEnumA = { kind: 'string', typeName: 'String', enumValues: ['a'] };
  const tEnumAC = { kind: 'string', typeName: 'String', enumValues: ['a', 'c'] };
  const tMoney = {
    kind: 'record',
    typeName: 'Money',
    exactForm: 'unit-decimal',
    fields: { amount: tDec2, currency: { kind: 'string', units: ['CNY'] } },
  };
  const tRec1 = { kind: 'record', typeName: 'Pair', fields: { a: tInt, b: tStr } };
  const tRec1Same = { kind: 'record', typeName: 'Pair', fields: { a: tInt, b: tStr } };
  const tRecDiffName = { kind: 'record', typeName: 'OtherPair', fields: { a: tInt, b: tStr } };
  const tRecExtraField = { kind: 'record', fields: { a: tInt, b: tStr, c: tBool } };
  const tRecWrongKey = { kind: 'record', fields: { a: tInt, x: tStr } };
  const tRecWrongFieldType = { kind: 'record', fields: { a: tInt, b: tInt } };

  // formatType coverage
  assert.equal(formatType(null), 'unknown');
  assert.equal(formatType(tInt), 'Int');
  assert.equal(formatType(tBool), 'Bool');
  assert.equal(formatType(tDec2), 'Decimal(2)');
  assert.equal(formatType({ kind: 'decimal' }), 'Decimal');
  assert.equal(formatType(tEnumAB), 'String[a|b]');
  assert.equal(formatType(tNone), 'None');
  assert.equal(formatType(tOptInt), 'Optional[Int]');
  assert.equal(formatType({ kind: 'sequence', element: tInt }), 'Seq[Int]');
  assert.equal(formatType({ kind: 'map', key: tOrderId, value: tDec2 }), 'Map[OrderId, Decimal(2)]');
  assert.equal(formatType(tRec1), 'Pair');

  // Optional & none rules
  assert.equal(isTypeCompatible(tNone, tOptInt), true);
  assert.equal(isTypeCompatible(tNone, tInt), false);
  assert.equal(isTypeCompatible(tOptInt, tNone), true);
  assert.equal(isTypeCompatible(tInt, tNone), false);
  assert.equal(isTypeCompatible(tInt, tOptInt, { allowOptionalWrap: false }), false);
  assert.equal(isTypeCompatible(tInt, tOptInt, { allowOptionalWrap: true }), true);
  assert.equal(isTypeCompatible(tOptInt, tInt, { allowOptionalWrap: true }), false);
  assert.equal(isTypeCompatible(tOptInt, tOptStr), false);

  // Numeric & unit-decimal projection
  assert.equal(isTypeCompatible(tDec2, tDec4, { exactScale: true }), false);
  assert.equal(isTypeCompatible(tDec2, tDec4, { exactScale: false }), true);
  assert.equal(isTypeCompatible(tInt, tDec2, { allowNumericPromotion: false }), false);
  assert.equal(isTypeCompatible(tInt, tDec2, { allowNumericPromotion: true }), true);
  assert.equal(isTypeCompatible(tMoney, tDec2, { allowUnitDecimalUnwrap: true }), true);
  assert.equal(isTypeCompatible(tMoney, tDec4, { allowUnitDecimalUnwrap: true, exactScale: true }), false);
  assert.equal(isTypeCompatible(tMoney, tDec2, { allowUnitDecimalUnwrap: false }), false);

  // Nominal & enum subset rules
  assert.equal(isTypeCompatible(tOrderId, tAcctId), false);
  assert.equal(isTypeCompatible(tOrderId, tStr, { strictNominal: false }), true);
  assert.equal(isTypeCompatible(tOrderId, tStr, { strictNominal: true }), false);
  assert.equal(isTypeCompatible(tEnumA, tEnumAB), true);
  assert.equal(isTypeCompatible(tEnumAC, tEnumAB), false);

  // Composite Seq / Map / Record rules
  assert.equal(isTypeCompatible({ kind: 'sequence', element: tInt }, { kind: 'sequence', element: tInt }), true);
  assert.equal(isTypeCompatible({ kind: 'sequence', element: tInt }, { kind: 'sequence', element: tStr }), false);
  assert.equal(isTypeCompatible({ kind: 'map', key: tOrderId, value: tDec2 }, { kind: 'map', key: tOrderId, value: tDec2 }), true);
  assert.equal(isTypeCompatible({ kind: 'map', key: tOrderId, value: tDec2 }, { kind: 'map', key: tAcctId, value: tDec2 }), false);
  assert.equal(isTypeCompatible(tRec1, tRec1Same), true);
  assert.equal(isTypeCompatible(tRec1, tRecDiffName), false);
  assert.equal(isTypeCompatible({ kind: 'record', fields: { a: tInt, b: tStr } }, tRecExtraField), false);
  assert.equal(isTypeCompatible({ kind: 'record', fields: { a: tInt, b: tStr } }, tRecWrongKey), false);
  assert.equal(isTypeCompatible({ kind: 'record', fields: { a: tInt, b: tStr } }, tRecWrongFieldType), false);

  // validateDefaultValue across every kind
  assert.equal(validateDefaultValue(null, tOptInt), null);
  assert.equal(validateDefaultValue('none', tOptInt), null);
  assert.equal(validateDefaultValue(42, tOptInt), null);
  assert.ok(validateDefaultValue('bad', tOptInt));
  assert.ok(validateDefaultValue(null, tInt));
  assert.equal(validateDefaultValue(true, tBool), null);
  assert.ok(validateDefaultValue('true', tBool));
  assert.equal(validateDefaultValue('12.50', tDec2), null);
  assert.equal(validateDefaultValue(12.5, tDec2), null);
  assert.ok(validateDefaultValue('abc', tDec2));
  assert.ok(validateDefaultValue(123, tStr));
  assert.equal(validateDefaultValue('a', tEnumAB), null);
  assert.ok(validateDefaultValue('z', tEnumAB));
  assert.equal(validateDefaultValue([], { kind: 'sequence', element: tInt }), null);
  assert.ok(validateDefaultValue('not-arr', { kind: 'sequence', element: tInt }));
  assert.equal(validateDefaultValue({}, { kind: 'map', key: tStr, value: tInt }), null);
  assert.equal(validateDefaultValue([], { kind: 'map', key: tStr, value: tInt }), null);
  assert.ok(validateDefaultValue([1], { kind: 'map', key: tStr, value: tInt }));
  assert.equal(validateDefaultValue({ a: 1, b: 'x' }, tRec1), null);
  assert.ok(validateDefaultValue([], tRec1));
});

test('Unit: witness-materialize evaluateDomainPostAssertions computes exact BigInt decimals, negation, and Map updates', () => {
  const agg = {
    name: 'Ledger',
    aliases: ['ledger', 'state'],
    stateFields: [
      { name: 'total', resolvedType: { kind: 'decimal', scale: 2 } },
      { name: 'delta', resolvedType: { kind: 'decimal', scale: 2 } },
      { name: 'balances', resolvedType: { kind: 'map', key: { kind: 'string' }, value: { kind: 'decimal', scale: 2 } } },
      { name: 'count', resolvedType: { kind: 'int' } },
      { name: 'note', resolvedType: { kind: 'optional', element: { kind: 'string' } } },
    ],
  };
  const cmd = {
    name: 'Adjust',
    parameters: [
      { name: 'acct', resolvedType: { kind: 'string' } },
      { name: 'qty', resolvedType: { kind: 'int' } },
      { name: 'unitPrice', resolvedType: { kind: 'decimal', scale: 4 } },
      { name: 'reason', resolvedType: { kind: 'string' } },
    ],
  };
  const mat = {
    state: { total: '100.25', delta: '0.00', balances: { A1: '10.50' }, count: 3, note: null },
    command: { type: 'Adjust', acct: 'A1', qty: 2, unitPrice: '1.2550', reason: 'promo' },
  };
  const post = [
    // total' = total + (qty * unitPrice) -> 100.25 + 2.5100 = 102.76
    {
      target: { segments: ['ledger', 'total'], index: null },
      value: {
        kind: 'arith',
        op: '+',
        left: { kind: 'member', object: { kind: 'var', name: 'ledger' }, field: 'total' },
        right: {
          kind: 'arith',
          op: '*',
          left: { kind: 'var', name: 'qty' },
          right: { kind: 'var', name: 'unitPrice' },
        },
      },
    },
    // delta' = -(qty * unitPrice) -> -2.51
    {
      target: { segments: ['ledger', 'delta'], index: null },
      value: {
        kind: 'neg',
        argument: {
          kind: 'arith',
          op: '*',
          left: { kind: 'var', name: 'qty' },
          right: { kind: 'var', name: 'unitPrice' },
        },
      },
    },
    // balances'[acct] = balances[acct] - 3.25 -> 7.25
    {
      target: { segments: ['ledger', 'balances'], index: { kind: 'var', name: 'acct' } },
      value: {
        kind: 'arith',
        op: '-',
        left: {
          kind: 'index',
          collection: { kind: 'member', object: { kind: 'var', name: 'ledger' }, field: 'balances' },
          index: { kind: 'var', name: 'acct' },
        },
        right: { kind: 'number', value: '3.25', scale: 2 },
      },
    },
    // note' = reason (Optional[String] wrap)
    {
      target: { segments: ['ledger', 'note'], index: null },
      value: { kind: 'var', name: 'reason' },
    },
    // count' = count + 1 -> 4
    {
      target: { segments: ['ledger', 'count'], index: null },
      value: {
        kind: 'arith',
        op: '+',
        left: { kind: 'member', object: { kind: 'var', name: 'ledger' }, field: 'count' },
        right: { kind: 'number', value: 1, scale: 0 },
      },
    },
  ];

  const assertions = evaluateDomainPostAssertions(agg, cmd, post, mat);
  assert.equal(assertions.length, 5);
  assert.equal(assertions[0].expectedValue, '102.76');
  assert.equal(assertions[1].expectedValue, '-2.51');
  assert.equal(assertions[2].indexKey, 'A1');
  assert.equal(assertions[2].expectedValue, '7.25');
  assert.equal(assertions[3].expectedValue, 'promo');
  assert.equal(assertions[4].expectedValue, 4);
});

test('Unit: binder catches index/set/interval/membership type errors and story metadata (entryPort, entryOperation, queryPort, dispatches) mismatches', () => {
  const yaml = `
system: binder-edge
context: core
ports:
  - name: RealPort
    operations:
      - name: run
        parameters:
          - actor: ActorId
valueObjects:
  - name: RealAck
    fields:
      - ok: Bool
aggregates:
  - name: Bucket
    aliases: [b, state]
    stateFields:
      - count: Int = 0
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
      - scores: Map[OwnerId, Int] = []
      - tags: Seq[String]
    commands:
      - name: Check
        parameters:
          - actor: ActorId
          - label: String
        produces: [Checked]
    events:
      - name: Checked
        fields:
          - actor: ActorId
          - label: String
stories:
  - name: BadMetaStory
    entryPort: GhostEntryPort
    entryOperation: ghostOp
    queryPort: GhostQueryPort
    dispatches: [Bucket.GhostCmd]
    responses: [RealAck]
`;
  const badDomain = `
slice Bucket.Check
rules:
  [E1] IF b.count[actor] > 0
          or b.scores[actor] > 0
          or b.tags[label] == "x"
          or b.count in {"a", "b"}
          or b.status in {"open", "typo"}
          or label in [1..10]
          or actor in b.scores
          or b.count in b.tags
       THEN SHALL reject request with BAD
  [E2] WHILE b.count >= 0 WHEN Check SHALL emit Checked
`;
  const badStory = `
story BadMetaStory layer application
rules:
  [S1] WHEN RealPort.run
       SHALL respond GhostAck with ack.ok == true
`;
  const dir = makeProject(yaml, { 'check.ears': badDomain }, { 'bad-meta.story.ears': badStory });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const codes = res.diagnostics.map(d => d.code);
    assert.ok(codes.filter(c => c === 'EARS_TYPE_MISMATCH').length >= 7, `expected >=7 EARS_TYPE_MISMATCH, got ${JSON.stringify(res.diagnostics, null, 2)}`);
    assert.ok(codes.includes('EARS_UNKNOWN_ENUM_LITERAL'));
    assert.ok(codes.filter(c => c === 'EARS_UNKNOWN_PORT_OP').length >= 3, 'expected entryPort, entryOperation, queryPort errors');
    assert.ok(codes.includes('EARS_UNKNOWN_DISPATCH_TARGET'));
    assert.ok(codes.includes('EARS_UNKNOWN_RESPONSE'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Unit: lineage explicit source errors (invalid format, missing cmd/state, bad const, bad state type) and valid multi-event disambiguation', () => {
  // 1. Explicit source errors
  const badSrcYaml = `
system: bad-ev-src
context: core
aggregates:
  - name: Doc
    aliases: [doc, state]
    stateFields:
      - title: String = ""
    commands:
      - name: Save
        parameters:
          - n: Int
        produces: [Saved]
    events:
      - name: Saved
        fields:
          - name: f1
            type: Int
            source: bogus:xyz
          - name: f2
            type: Int
            source: cmd.missingParam
          - name: f3
            type: Int
            source: state.missingState
          - name: f4
            type: Int
            source: state.title
          - name: f5
            type: Int
            source: const:not_an_int
`;
  const dir1 = makeProject(badSrcYaml, {
    'save.ears': 'slice Doc.Save\nrules:\n  [R1] WHEN Save SHALL emit Saved\n',
  });
  try {
    const res = compileCanonicalV2({ structuresDir: join(dir1, 'structures'), specsPath: join(dir1, 'behaviors') });
    assert.equal(res.passed, false);
    const codes = new Set(res.diagnostics.map(d => d.code));
    assert.ok(codes.has('V2_INVALID_EVENT_FIELD_SOURCE'));
    assert.ok(codes.has('V2_UNPROPAGATED_EVENT_FIELD'));
    assert.ok(codes.has('V2_EVENT_FIELD_TYPE_MISMATCH'));
    assert.ok(res.diagnostics.filter(d => d.code === 'V2_EVENT_FIELD_TYPE_MISMATCH').length >= 2);
  } finally {
    rmSync(dir1, { recursive: true, force: true });
  }

  // 2. Valid disambiguated multi-event rule: EvA carries `a`, EvB carries `b` -> cleanly partitioned without double-replay!
  const goodMultiYaml = `
system: multi-ev-disambig
context: core
aggregates:
  - name: PairAgg
    aliases: [p, state]
    stateFields:
      - leftVal: Int = 0
      - rightVal: Int = 0
    commands:
      - name: UpdateBoth
        parameters:
          - a: Int
          - b: Int
        produces: [LeftUpdated, RightUpdated]
    events:
      - name: LeftUpdated
        fields:
          - a: Int
      - name: RightUpdated
        fields:
          - b: Int
`;
  const goodMultiEars = `
slice PairAgg.UpdateBoth
rules:
  [U1] WHEN UpdateBoth
       SHALL emit LeftUpdated AND emit RightUpdated
       post:
         p.leftVal' = a
         p.rightVal' = b
`;
  const dir2 = makeProject(goodMultiYaml, { 'update-both.ears': goodMultiEars });
  try {
    const res = compileCanonicalV2({ structuresDir: join(dir2, 'structures'), specsPath: join(dir2, 'behaviors') });
    assert.equal(res.passed, true, JSON.stringify(res.diagnostics, null, 2));
    const foldA = res.canonical.eventFolds.find(f => f.event === 'LeftUpdated');
    const foldB = res.canonical.eventFolds.find(f => f.event === 'RightUpdated');
    assert.equal(foldA.assignments.length, 1);
    assert.equal(foldA.assignments[0].target.segments.join('.'), 'state.leftVal');
    assert.equal(foldB.assignments.length, 1);
    assert.equal(foldB.assignments[0].target.segments.join('.'), 'state.rightVal');
  } finally {
    rmSync(dir2, { recursive: true, force: true });
  }
});
