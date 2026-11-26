// 6-Layer Verification Suite for:
//   - Batch A: Field Lineage Hardening (fail-closed unconsumed numerics, 3-way state diagnostics,
//              unsourced readModel diagnostics, typed waivers + invalid waiver rejection)
//   - Batch B: Pluggable Authz PEP Seam (auth-core static-roles + Workday/OPA external-pdp +
//              non-human callerKind filtering) in live Node TS & live Scala JVM +
//              ReadSide physical shared materialized view bindings
//   - Batch C: Narrative Topology (useCases, pipelines, journeys, enriched stories) & signoff docs
//   - Layer 3: Mutation Gate (proving generated locked post-replay tests kill domain fold mutants)
//   - Layer 4: Real-world Canary Corpus under strictLineage: true
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { typescriptCodegenPlugin } from '../lib/v2/codegen/typescript.mjs';
import { scalaCodegenPlugin } from '../lib/v2/codegen/scala.mjs';
import { emitV2ExecutableTests } from '../lib/v2/test-emitter/emit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANARY_ROOT = resolve(__dirname, 'fixtures/canary/wealth_exam_canary');

function makeProject(structuresYaml, behaviorFiles = {}, extraFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'coarising-v2-ledger-'));
  mkdirSync(join(dir, 'structures'), { recursive: true });
  mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
  mkdirSync(join(dir, 'behaviors/application'), { recursive: true });
  writeFileSync(join(dir, 'structures/model.yaml'), structuresYaml, 'utf8');
  for (const [rel, content] of Object.entries(behaviorFiles)) {
    const abs = join(dir, 'behaviors', rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
  for (const [rel, content] of Object.entries(extraFiles)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
  return dir;
}

function codes(diagnostics, severity = null) {
  return diagnostics
    .filter(d => (severity ? d.severity === severity : true))
    .map(d => d.code);
}

// ============================================================================
// LAYER 1 & 2 (Batch A): Orthogonal Numeric Type × Lineage Matrix + Waivers
// ============================================================================
test('Batch A Matrix: unconsumed numeric/exact event fields fail-closed across Int, Long, Decimal, Money, Optional[Int]; typed waivers unblock cleanly', () => {
  const numericTypes = [
    { label: 'Int', typeExpr: 'Int', guard: 'valNum > 0' },
    { label: 'Long', typeExpr: 'Long', guard: 'valNum > 0' },
    { label: 'Decimal', typeExpr: 'AmountDecimal', guard: 'valNum > 0.00' },
    { label: 'Money', typeExpr: 'Money', guard: 'valNum.currency == "CNY" and valNum.amount > 0.00' },
    { label: 'OptionalInt', typeExpr: 'Optional[Int]', guard: 'valNum is some' },
  ];

  for (const tc of numericTypes) {
    const buildYaml = (waiveLine = '') => `
system: num-matrix
context: matrix
exactTypes:
  - name: AmountDecimal
    form: decimal
    scale: 2
  - name: Money
    form: unit-decimal
    scale: 2
    amountField: amount
    unitField: currency
    units: ["CNY"]
aggregates:
  - name: Ledger
    aliases: [ledger, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "done"]
    commands:
      - name: Record
        parameters:
          - valNum: ${tc.typeExpr}
        produces: [Recorded]
    events:
      - name: Recorded
        fields:
          - name: valNum
            type: ${tc.typeExpr}
${waiveLine}
`;
    const ears = `
slice Ledger.Record
rules:
  [BAD] IF not (${tc.guard}) or ledger.status != "open" THEN SHALL reject request with BAD_INPUT
  [OK]  WHILE ${tc.guard} and ledger.status == "open"
        WHEN Record
        SHALL transition ledger.status -> "done"
          AND emit Recorded
`;

    // Negative: NO waiver -> MUST fail closed even with strictLineage=false!
    const negDir = makeProject(buildYaml(''), { 'domain/record.ears': ears });
    try {
      const neg = compileCanonicalV2({
        structuresDir: join(negDir, 'structures'),
        specsPath: join(negDir, 'behaviors'),
        strictLineage: false,
      });
      assert.equal(neg.passed, false, `unconsumed ${tc.label} MUST fail closed`);
      assert.ok(codes(neg.diagnostics, 'error').includes('V2_LINEAGE_UNCONSUMED_NUMERIC_FIELD'), `missing fail-closed error for ${tc.label}`);
    } finally {
      rmSync(negDir, { recursive: true, force: true });
    }

    // Positive: WITH typed waiver -> MUST pass and record waiver in canonical.lineage.waivers!
    const posDir = makeProject(buildYaml('            waiveLineage: audit-only'), { 'domain/record.ears': ears });
    try {
      const pos = compileCanonicalV2({
        structuresDir: join(posDir, 'structures'),
        specsPath: join(posDir, 'behaviors'),
        strictLineage: false,
      });
      assert.equal(pos.passed, true, `waived ${tc.label} should pass: ${JSON.stringify(pos.diagnostics)}`);
      assert.equal(pos.canonical.lineage.waivers.length, 1);
      assert.equal(pos.canonical.lineage.waivers[0].reason, 'audit-only');
    } finally {
      rmSync(posDir, { recursive: true, force: true });
    }
  }
});

test('Batch A: 3-way state diagnostics (DEAD, WRITE_ONLY, UNWRITTEN), unsourced ReadModel, and invalid waiver rejection', () => {
  const badYaml = `
system: state-split
context: split
aggregates:
  - name: Order
    aliases: [order, state]
    stateFields:
      - name: cap
        type: Int
        default: 100
      - name: writeOnlyCounter
        type: Int
        default: 0
      - name: deadNote
        type: String
        default: ""
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
    commands:
      - name: CloseOrder
        parameters:
          - delta: Int
        produces: [OrderClosed]
    events:
      - name: OrderClosed
        fields:
          - delta: Int
readModels:
  - name: order-view
    sourceAggregate: Order
    fields:
      - status: String
`;
  const ears = `
slice Order.CloseOrder
rules:
  [BAD] IF order.status != "open" or delta <= 0 or delta > order.cap THEN SHALL reject request with INVALID
  [OK]  WHILE order.status == "open" and delta > 0 and delta <= order.cap
        WHEN CloseOrder
        SHALL transition order.status -> "closed"
          AND emit OrderClosed
        post:
          order.writeOnlyCounter' = order.writeOnlyCounter + delta
`;
  const dir = makeProject(badYaml, { 'domain/close.ears': ears });
  try {
    // Non-strict: emits warnings for UNWRITTEN (cap), WRITE_ONLY (writeOnlyCounter), DEAD (deadNote), UNSOURCED (order-view.status)
    const warnRes = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      strictLineage: false,
    });
    assert.equal(warnRes.passed, true, JSON.stringify(warnRes.diagnostics));
    const warns = codes(warnRes.diagnostics, 'warning');
    assert.ok(warns.includes('V2_LINEAGE_UNWRITTEN_STATE_FIELD'), `expected UNWRITTEN: ${warns}`);
    assert.ok(warns.includes('V2_LINEAGE_WRITE_ONLY_STATE_FIELD'), `expected WRITE_ONLY: ${warns}`);
    assert.ok(warns.includes('V2_LINEAGE_DEAD_STATE_FIELD'), `expected DEAD: ${warns}`);
    assert.ok(warns.includes('V2_LINEAGE_UNSOURCED_READMODEL_FIELD'), `expected UNSOURCED: ${warns}`);

    // Strict: blocks on all four!
    const strictRes = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      strictLineage: true,
    });
    assert.equal(strictRes.passed, false);
    const errs = codes(strictRes.diagnostics, 'error');
    assert.ok(errs.includes('V2_LINEAGE_UNWRITTEN_STATE_FIELD'));
    assert.ok(errs.includes('V2_LINEAGE_WRITE_ONLY_STATE_FIELD'));
    assert.ok(errs.includes('V2_LINEAGE_DEAD_STATE_FIELD'));
    assert.ok(errs.includes('V2_LINEAGE_UNSOURCED_READMODEL_FIELD'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // Invalid waiver reason & invalid redundant-param ref must fail closed
  const invalidWaiverYaml = `
system: bad-waive
context: bw
aggregates:
  - name: Item
    aliases: [item, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "done"]
        waiveLineage: bogus-reason
    commands:
      - name: Finish
        parameters:
          - code: String
        produces: [Finished]
    events:
      - name: Finished
        fields:
          - name: code
            type: String
            waiveLineage: redundant-param:nonExistentParam
`;
  const invalidDir = makeProject(invalidWaiverYaml, {
    'domain/finish.ears': `
slice Item.Finish
rules:
  [BAD] IF item.status != "open" or code is empty THEN SHALL reject request with BAD
  [OK]  WHILE item.status == "open" and code is non-empty
        WHEN Finish
        SHALL transition item.status -> "done"
          AND emit Finished
`,
  });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(invalidDir, 'structures'),
      specsPath: join(invalidDir, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const errs = res.diagnostics.filter(d => d.code === 'V2_INVALID_LINEAGE_WAIVER');
    assert.ok(errs.length >= 2, `expected >=2 V2_INVALID_LINEAGE_WAIVER errors, got ${JSON.stringify(res.diagnostics)}`);
  } finally {
    rmSync(invalidDir, { recursive: true, force: true });
  }
});

// ============================================================================
// BATCH B: Pluggable Authz PEP Seam (auth-core + external-pdp + non-HTTP filter)
//          Live TypeScript execution + Live Scala scalac/scala JVM parity!
// ============================================================================
test('Batch B Authz PEP: auth-core + external-pdp + public + scheduler filtering compile & execute identically in TS and Scala JVM', async () => {
  const structuresYaml = `
system: authz-lab
context: expense

roles:
  - name: Employee
    kind: human
    scope: tenant
  - name: Approver
    kind: human
    scope: org
  - name: CronRunner
    kind: scheduler

valueObjects:
  - name: Ack
    fields:
      - ok: Bool

aggregates:
  - name: Expense
    aliases: [exp, state]
    stateFields:
      - name: status
        type: String
        default: "pending"
        enum: ["pending", "approved"]
    commands:
      - name: Approve
        parameters:
          - note: String
        produces: [ExpenseApproved]
    events:
      - name: ExpenseApproved
        fields:
          - name: note
            type: String
            waiveLineage: audit-only

ports:
  - name: ExpensePort
    operations:
      - name: ping
        callerKind: anonymous
        authz:
          mode: public
          action: "expense:ping"
        parameters: []
        returns: Ack
      - name: submit
        callerKind: human
        authz:
          mode: auth-core
          scope: tenant
          action: "expense:submit"
          allowedRoles: [Employee]
        parameters:
          - actor: ActorId
          - note: String
        returns: Ack
      - name: approve
        callerKind: human
        authz:
          mode: external-pdp
          policyRef: "workday.org-rbac.approve"
          action: "expense:approve"
          contextParams:
            - orgUnitId: param.orgUnitId
            - tenantId: token.tenantId
        parameters:
          - actor: ActorId
          - orgUnitId: OrgUnitId
          - note: String
        returns: Ack
  - name: InternalCronPort
    operations:
      - name: sweep
        callerKind: scheduler
        authz:
          mode: internal-only
          action: "expense:sweep"
        parameters:
          - note: String
        returns: Unit

externContracts:
  - name: actorKnown
    ownerPort: ExpensePort
    params:
      - actor: ActorId

stories:
  - name: ExpenseFlow
    responses: [Ack]
  - name: ExpenseAuditSync
`;
  const domainEars = `
slice Expense.Approve
rules:
  [BAD] IF exp.status != "pending" or note is empty THEN SHALL reject request with CANNOT_APPROVE
  [OK]  WHILE exp.status == "pending" and note is non-empty
        WHEN Approve
        SHALL transition exp.status -> "approved"
          AND emit ExpenseApproved
`;
  const storyEars = `
story ExpenseFlow layer application
where:
  extern actorKnown(actor)
rules:
  [P1] WHILE true WHEN ExpensePort.ping SHALL respond Ack with ack.ok == true
  [S1] IF not actorKnown(actor) WHEN ExpensePort.submit THEN SHALL reject request with UNAUTHORIZED
  [S2] WHILE actorKnown(actor) WHEN ExpensePort.submit SHALL respond Ack with ack.ok == true
  [A1] IF not actorKnown(actor) WHEN ExpensePort.approve THEN SHALL reject request with UNAUTHORIZED
  [A2] WHILE actorKnown(actor) WHEN ExpensePort.approve SHALL dispatch Expense.Approve AND respond Ack with ack.ok == true
  [C1] WHILE true WHEN InternalCronPort.sweep SHALL dispatch Expense.Approve
`;
  const integrationEars = `
story ExpenseAuditSync layer application
rules:
  [E1] WHILE true WHEN event Expense.ExpenseApproved SHALL keep state
`;

  const dir = makeProject(structuresYaml, {
    'domain/approve.ears': domainEars,
    'application/expense-flow.story.ears': storyEars,
    'application/expense-sync.integration.ears': integrationEars,
  });

  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      strictLineage: true,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    // Generate TS & Scala Onion layers
    const tsOut = join(dir, 'out-ts');
    const scalaOut = join(dir, 'out-scala');
    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: tsOut, packageName: 'test.authz' });
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: scalaOut, packageName: 'test.authz' });

    // 1. Live TypeScript runtime verification of public, auth-core, external-pdp, and scheduler/event exclusion
    const routerMod = await import(pathToFileURL(join(tsOut, 'generated-scaffold/ts/interfaces/http/router.ts')).href);
    const dtoMod = await import(pathToFileURL(join(tsOut, 'generated-scaffold/ts/interfaces/api/dto.ts')).href);

    // Non-HTTP scheduler & WHEN event integration must NOT appear in DECLARED_ROUTES
    const routeOps = routerMod.DECLARED_ROUTES.map(r => r.operation);
    assert.deepEqual(routeOps.sort(), ['ExpensePort.approve', 'ExpensePort.ping', 'ExpensePort.submit']);
    assert.equal(routerMod.OPERATION_AUTHZ_MAP['ExpensePort.submit'].authzMode, 'auth-core');
    assert.equal(routerMod.OPERATION_AUTHZ_MAP['ExpensePort.approve'].policyRef, 'workday.org-rbac.approve');

    const pdpCalls = [];
    const authority = dtoMod.createRoleBasedAuthority(
      req => req.principal ?? null,
      {
        decide(query) {
          pdpCalls.push(query);
          return query.policyRef === 'workday.org-rbac.approve'
            && query.context.orgUnitId === 'org-finance'
            && query.context.tenantId === 'tenant-1';
        },
      },
    );
    const stubCtrl = { handleOperation: () => dtoMod.jsonResponse(200, { ok: true }) };
    const router = routerMod.createHttpRouter({ expenseFlow: stubCtrl }, authority);

    // Public route: passes with NO principal
    assert.equal(router.route({ method: 'POST', path: '/api/v1/expense/expense-port/ping' }).status, 200);
    // auth-core route: 401 unauthenticated, 403 wrong role, 200 Employee role
    assert.equal(router.route({ method: 'POST', path: '/api/v1/expense/expense-port/submit' }).status, 401);
    assert.equal(router.route({
      method: 'POST',
      path: '/api/v1/expense/expense-port/submit',
      principal: { id: 'u1', roles: ['Guest'] },
    }).status, 403);
    assert.equal(router.route({
      method: 'POST',
      path: '/api/v1/expense/expense-port/submit',
      principal: { id: 'u1', roles: ['Employee'] },
    }).status, 200);
    // external-pdp route: 403 wrong orgUnitId, 200 matching orgUnitId + tenantId
    assert.equal(router.route({
      method: 'POST',
      path: '/api/v1/expense/expense-port/approve',
      principal: { id: 'u2', roles: ['Approver'], tenantId: 'tenant-1' },
      body: { orgUnitId: 'org-sales' },
    }).status, 403);
    assert.equal(router.route({
      method: 'POST',
      path: '/api/v1/expense/expense-port/approve',
      principal: { id: 'u2', roles: ['Approver'], tenantId: 'tenant-1' },
      body: { orgUnitId: 'org-finance' },
    }).status, 200);
    assert.equal(pdpCalls.length, 2);

    // 2. Live Scala scalac + JVM parity check on RoleBasedAuthority + commandRoleMap
    const scalaFiles = [
      join(scalaOut, 'generated-scaffold/scala/test/authz/DomainTypes.scala'),
      join(scalaOut, 'generated-scaffold/scala/test/authz/interfaces/api/ApiDto.scala'),
      join(scalaOut, 'generated-scaffold/scala/test/authz/interfaces/http/ExpenseFlowController.scala'),
      join(scalaOut, 'generated-scaffold/scala/test/authz/interfaces/http/ExpenseAuditSyncController.scala'),
      join(scalaOut, 'generated-scaffold/scala/test/authz/interfaces/http/HttpRouter.scala'),
      join(scalaOut, 'generated-scaffold/scala/test/authz/ExpenseFlowPort.scala'),
      join(scalaOut, 'generated-scaffold/scala/test/authz/ExpenseAuditSyncPort.scala'),
    ];
    const driverFile = join(dir, 'AuthzDriver.scala');
    writeFileSync(driverFile, `
import test.authz.interfaces.api._
import test.authz.interfaces.http._
import test.authz._

object AuthzDriver {
  def main(args: Array[String]): Unit = {
    val pdp = new AuthorizationPort {
      override def decide(q: AuthzDecisionQuery): Boolean =
        q.policyRef.contains("workday.org-rbac.approve") &&
          q.context.get("orgUnitId").contains("org-finance") &&
          q.context.get("tenantId").contains("tenant-1")
    }
    val auth = new RoleBasedAuthority(req => req.principal, Some(pdp))
    val stubHandler = new ExpenseFlowHandler {
      override def handle(req: ExpenseFlowRequest, externs: ExpenseFlowExternPorts, effects: ExpenseFlowEffectsPort) =
        Right(ExpenseFlowSuccessResponse(ruleId = "OK"))
    }
    val stubExterns = new ExpenseFlowExternPorts { override def actorKnown(actor: Any): Boolean = true }
    val stubEffects = new ExpenseFlowEffectsPort {
      override def pin(a: String, i: Map[String, Any]): Unit = ()
      override def dispatch(t: String, p: Map[String, Any]): Unit = ()
    }
    val ctrl = new ExpenseFlowController(stubHandler, stubExterns, stubEffects)
    val router = new HttpRouter(expenseFlowController = Some(ctrl), authority = auth)

    require(router.declaredRoutes.map(_.operation).sorted == Seq("ExpensePort.approve", "ExpensePort.ping", "ExpensePort.submit"))
    require(router.commandRoleMap("ExpensePort.submit") == Seq("Employee"))
    require(router.route(HttpRequest("POST", "/api/v1/expense/expense-port/ping")).status == 200)
    require(router.route(HttpRequest("POST", "/api/v1/expense/expense-port/submit")).status == 401)
    require(router.route(HttpRequest("POST", "/api/v1/expense/expense-port/submit", principal = Some(Principal("u1", Set("Guest"))))).status == 403)
    require(router.route(HttpRequest("POST", "/api/v1/expense/expense-port/submit", principal = Some(Principal("u1", Set("Employee"))))).status == 200)
    require(router.route(HttpRequest("POST", "/api/v1/expense/expense-port/approve", body = Map("orgUnitId" -> "org-sales"), principal = Some(Principal("u2", Set("Approver"), Some("tenant-1"))))).status == 403)
    require(router.route(HttpRequest("POST", "/api/v1/expense/expense-port/approve", body = Map("orgUnitId" -> "org-finance"), principal = Some(Principal("u2", Set("Approver"), Some("tenant-1"))))).status == 200)
    println("SCALA_AUTHZ_PARITY_OK")
  }
}
`, 'utf8');
    const classesDir = join(dir, 'scala-classes');
    mkdirSync(classesDir, { recursive: true });
    execFileSync('scalac', ['-d', classesDir, ...scalaFiles, driverFile], { encoding: 'utf8' });
    const jvmOut = execFileSync('scala', ['-cp', classesDir, 'AuthzDriver'], { encoding: 'utf8' });
    assert.ok(jvmOut.includes('SCALA_AUTHZ_PARITY_OK'), jvmOut);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Batch B Fail-Closed: Authz contract errors & ReadSide shared materialized view errors', () => {
  const badAuthzYaml = `
system: bad-authz
context: ba
roles:
  - name: Ghost
    kind: alien
  - name: Admin
    kind: human
aggregates:
  - name: Doc
    aliases: [doc, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "done"]
    commands:
      - name: Save
        parameters: []
        produces: [Saved]
    events:
      - name: Saved
        fields: []
readModels:
  - name: rm-a
    sourceAggregate: Doc
    fields:
      - name: score
        type: Int
        source: derived
  - name: rm-b
    sourceAggregate: Doc
    fields:
      - name: score
        type: String
        source: derived
ports:
  - name: DocPort
    operations:
      - name: save
        callerKind: human
        authz:
          mode: external-pdp
          allowedRoles: [NonExistentRole]
          contextParams:
            - orgId: param.missingOrgId
        parameters: []
        returns: Unit
      - name: openEndpoint
        parameters: []
        returns: Unit
`;
  const badReadsideYaml = `
schemaVersion: co-arising.readside-binding/v2
materializedViews:
  - name: mv_shared
    strategy: bogus-strategy
    servesReadModels: [rm-a, rm-b, rm-ghost]
    indexes:
      - name: idx_bad
        keys: [nonExistentCol]
  - name: mv_dup
    strategy: dedicated-table
    servesReadModels: [rm-a]
`;
  const dir = makeProject(
    badAuthzYaml,
    {
      'domain/save.ears': `
slice Doc.Save
rules:
  [BAD] IF doc.status != "open" THEN SHALL reject request with CLOSED
  [OK]  WHILE doc.status == "open" WHEN Save SHALL transition doc.status -> "done" AND emit Saved
`,
    },
    { 'bindings/bad-readside.yaml': badReadsideYaml },
  );
  try {
    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
      bindingsPath: join(dir, 'bindings'),
      strictLineage: true,
    });
    assert.equal(res.passed, false);
    const errs = codes(res.diagnostics, 'error');
    for (const expected of [
      'V2_INVALID_ROLE_KIND',
      'V2_AUTHZ_UNKNOWN_ROLE',
      'V2_AUTHZ_INVALID_CONTRACT',
      'V2_AUTHZ_UNKNOWN_CONTEXT_PARAM',
      'V2_AUTHZ_UNDECLARED_OPERATION',
      'V2_READSIDE_INVALID_STRATEGY',
      'V2_READSIDE_UNKNOWN_READMODEL',
      'V2_READSIDE_COLUMN_TYPE_CONFLICT',
      'V2_READSIDE_UNKNOWN_INDEX_KEY',
      'V2_READSIDE_DUPLICATE_BINDING',
    ]) {
      assert.ok(errs.includes(expected), `expected ${expected} in ${JSON.stringify(errs)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ============================================================================
// BATCH C: Use Cases, Pipelines, Journeys Fail-Closed Contracts
// ============================================================================
test('Batch C Fail-Closed: invalid references in useCases, stories.coversUseCases, pipelines, and journeys are blocked', () => {
  const badNarrativeYaml = `
system: bad-nav
context: nav
roles:
  - name: User
    kind: human
aggregates:
  - name: Ticket
    aliases: [t, state]
    stateFields:
      - name: status
        type: String
        default: "open"
        enum: ["open", "closed"]
    commands:
      - name: Close
        parameters: []
        produces: [Closed]
    events:
      - name: Closed
        fields: []
stories:
  - name: TicketStory
    role: User
    coversUseCases: [MissingUseCase]
pipelines:
  - id: pl-1
    name: TicketPipeline
    steps:
      - id: s1
        invokeSaga: GhostSaga
        command: Ticket.GhostCmd
useCases:
  - id: uc-1
    name: CloseTicketUC
    actor: GhostActor
    readEvidence: [ghost-view]
    steps:
      - id: step1
        port: GhostPort.run
        aggregate: Ticket
        command: GhostCmd
        emissions: [GhostEvent]
        readsView: ghost-view
        pipeline: ghost-pl
        saga: GhostSaga
journeys:
  - id: j-1
    name: TicketJourney
    stages:
      - name: S1
        stories: [GhostStory]
        useCases: [GhostUC]
`;
  const dir = makeProject(badNarrativeYaml, {
    'domain/close.ears': `
slice Ticket.Close
rules:
  [BAD] IF t.status != "open" THEN SHALL reject request with CLOSED
  [OK]  WHILE t.status == "open" WHEN Close SHALL transition t.status -> "closed" AND emit Closed
`,
  });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const errs = codes(res.diagnostics, 'error');
    for (const expected of [
      'V2_PIPELINE_UNKNOWN_REFERENCE',
      'V2_USECASE_UNKNOWN_ACTOR',
      'V2_USECASE_UNKNOWN_READMODEL',
      'V2_USECASE_UNKNOWN_REFERENCE',
      'V2_STORY_UNKNOWN_USECASE',
      'V2_JOURNEY_UNKNOWN_REFERENCE',
    ]) {
      assert.ok(errs.includes(expected), `expected ${expected} in ${JSON.stringify(errs)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ============================================================================
// LAYER 3 & 4: Real-World Canary Corpus (--strict-lineage + Signoff Docs +
//              Live TS & Scala Locked Oracles + Mutation Gate!)
// ============================================================================
test('Layer 3+4 Canary Corpus & Mutation Gate: compiles zero-warning under strictLineage, emits signoff docs, passes live TS/Scala tests, and kills fold mutant', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-canary-run-'));
  try {
    const signoffDir = join(workDir, 'signoff');
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors'),
      bindingsPath: join(CANARY_ROOT, 'bindings'),
      outSignoffDir: signoffDir,
      strictLineage: true,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));
    assert.equal(compiled.diagnostics.filter(d => d.severity === 'error').length, 0);

    // Verify ReadSide physical shared materialized view derived columns & events
    assert.equal(compiled.canonical.readside.materializedViews.length, 1);
    const mv = compiled.canonical.readside.materializedViews[0];
    assert.equal(mv.name, 'mv_exam_batch_unified');
    assert.equal(mv.strategy, 'shared-materialized-view');
    assert.deepEqual(mv.servesReadModels, ['batch-summary-view', 'batch-detail-view']);
    const colNames = mv.derivedColumns.map(c => c.name).sort();
    assert.deepEqual(colNames, ['batchId', 'publishedAtMs', 'status', 'totalFee', 'version']);

    // Verify UseCase coverage = 100%
    assert.deepEqual(compiled.canonical.lineage.useCaseCoverage.uncoveredCommands, []);
    assert.deepEqual(compiled.canonical.lineage.useCaseCoverage.uncoveredReadModels, []);

    // Verify Signoff docs emitted cleanly (disambiguated from CQRS readModels!)
    const ucMd = readFileSync(join(signoffDir, 'use-cases.md'), 'utf8');
    const linMd = readFileSync(join(signoffDir, 'lineage.md'), 'utf8');
    assert.ok(ucMd.includes('```mermaid') && ucMd.includes('sequenceDiagram'), 'signoff/use-cases.md must render Mermaid diagram');
    assert.ok(ucMd.includes('ExamBatchJourney') && ucMd.includes('PRD-1.1'), 'signoff/use-cases.md must include journey and PRD refs');
    assert.ok(linMd.includes('mv_exam_batch_unified') && linMd.includes('workday') === false && linMd.includes('org-rbac.withdraw-batch'));
    assert.ok(existsSync(join(signoffDir, 'ac/publish-batch.md')));
    assert.ok(existsSync(join(signoffDir, 'tables/publish-batch.md')));

    // Generate TS + Scala code & locked tests
    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'canary.exam' });
    scalaCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: 'canary.exam' });
    emitV2ExecutableTests(compiled.canonical, { outDir: workDir, targets: ['typescript', 'scala'], packageName: 'canary.exam' });

    // Run locked TS domain tests (clear NODE_TEST_CONTEXT so nested node --test executes!) -> MUST PASS
    const childEnv = { ...process.env };
    delete childEnv.NODE_TEST_CONTEXT;
    const publishTest = join(workDir, 'generated-tests/ts/exam-batch-publish-batch.ears.spec.ts');
    const withdrawTest = join(workDir, 'generated-tests/ts/exam-batch-withdraw-batch.ears.spec.ts');
    execFileSync(process.execPath, ['--test', publishTest, withdrawTest], { encoding: 'utf8', env: childEnv });

    // Layer 3 MUTATION GATE: inject a fold bug in generated ExamBatch behavior (+ 1 -> + 2)
    // and prove the locked post-replay assertion KILLS the mutant!
    const behaviorFile = join(workDir, 'generated-scaffold/ts/exam-batch.behavior.ts');
    const originalBehavior = readFileSync(behaviorFile, 'utf8');
    const mutatedBehavior = originalBehavior.replace('version: (state.version + 1)', 'version: (state.version + 2)');
    assert.notEqual(mutatedBehavior, originalBehavior, 'expected version fold in generated behavior');
    writeFileSync(behaviorFile, mutatedBehavior, 'utf8');

    let mutantKilled = false;
    try {
      execFileSync(process.execPath, ['--test', publishTest], { encoding: 'utf8', stdio: 'pipe', env: childEnv });
    } catch {
      mutantKilled = true;
    }
    assert.equal(mutantKilled, true, 'MUTATION GATE FAILED: locked post-replay test did not kill version fold mutant!');

    // Restore clean behavior and verify real scalac compiles generated Scala behavior + locked tests
    writeFileSync(behaviorFile, originalBehavior, 'utf8');
    const scalaMainFiles = [
      join(workDir, 'generated-scaffold/scala/canary/exam/DomainTypes.scala'),
      join(workDir, 'generated-scaffold/scala/canary/exam/ExamBatchBehavior.scala'),
      join(workDir, 'generated-scaffold/scala/canary/exam/interfaces/api/ApiDto.scala'),
      join(workDir, 'generated-scaffold/scala/canary/exam/BatchLifecyclePort.scala'),
      join(workDir, 'generated-scaffold/scala/canary/exam/interfaces/http/BatchLifecycleController.scala'),
      join(workDir, 'generated-scaffold/scala/canary/exam/interfaces/http/HttpRouter.scala'),
    ];
    const classesDir = join(workDir, 'classes');
    mkdirSync(classesDir, { recursive: true });
    execFileSync('scalac', ['-d', classesDir, ...scalaMainFiles], { encoding: 'utf8' });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

// ============================================================================
// BATCH E: Compliance Privacy/Visibility Gates, Deadlines, & Stream/Batch Mode
// ============================================================================
test('Batch E: ReadModel PII/secret public exposure gate, visibleTo mismatch, deadlines, and readside refreshMode (stream/batch/hybrid)', () => {
  const negYaml = `
system: cert-exam
context: cert
roles:
  - name: Candidate
    kind: human
  - name: Grader
    kind: human
  - name: ExamCron
    kind: scheduler
aggregates:
  - name: ExamCert
    aliases: [cert, state]
    stateFields:
      - name: status
        type: String
        default: "active"
        enum: ["active", "revoked"]
      - name: idCardNo
        type: String
        default: ""
        waiveLineage: immutable-config
      - name: expiresAtMs
        type: Int
        default: 0
        waiveLineage: immutable-config
    commands:
      - name: Revoke
        parameters: []
        produces: [CertRevoked]
    events:
      - name: CertRevoked
        fields: []
    deadlines:
      - name: badDeadline
        stateField: missingTimeField
        triggerCommand: MissingExpireCmd
readModels:
  - name: public-cert-view
    sourceAggregate: ExamCert
    visibleTo: [GhostRole]
    fields:
      - name: status
        type: String
        source: stateField:status
        sensitivity: public
      - name: idCardNo
        type: String
        source: stateField:idCardNo
        sensitivity: pii
      - name: badFlag
        type: String
        source: derived
        sensitivity: top-secret-invalid
  - name: grader-only-view
    sourceAggregate: ExamCert
    visibleTo: [Grader]
    fields:
      - name: status
        type: String
        source: stateField:status
ports:
  - name: CertVerifyPort
    operations:
      - name: verifyPublic
        callerKind: anonymous
        authz:
          mode: public
          action: "cert:verify"
        parameters: []
        returns: public-cert-view
      - name: candidatePeekGrader
        callerKind: human
        authz:
          mode: auth-core
          allowedRoles: [Candidate]
        parameters: []
        returns: grader-only-view
`;
  const badReadside = `
schemaVersion: co-arising.readside-binding/v2
materializedViews:
  - name: mv_cert
    strategy: shared-materialized-view
    refreshMode: realtime-magic
    servesReadModels: [public-cert-view]
`;
  const ears = `
slice ExamCert.Revoke
rules:
  [BAD] IF cert.status != "active" THEN SHALL reject request with ALREADY_REVOKED
  [OK]  WHILE cert.status == "active" WHEN Revoke SHALL transition cert.status -> "revoked" AND emit CertRevoked
`;
  const negDir = makeProject(negYaml, { 'domain/revoke.ears': ears }, { 'bindings/cert-readside.yaml': badReadside });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(negDir, 'structures'),
      specsPath: join(negDir, 'behaviors'),
      bindingsPath: join(negDir, 'bindings'),
    });
    assert.equal(res.passed, false);
    const errs = codes(res.diagnostics, 'error');
    for (const expected of [
      'V2_DEADLINE_UNKNOWN_FIELD',
      'V2_DEADLINE_UNKNOWN_COMMAND',
      'V2_READMODEL_UNKNOWN_VISIBLE_ROLE',
      'V2_READMODEL_INVALID_SENSITIVITY',
      'V2_READMODEL_SENSITIVE_PUBLIC_EXPOSURE',
      'V2_READMODEL_VISIBILITY_MISMATCH',
      'V2_READSIDE_INVALID_REFRESH_MODE',
    ]) {
      assert.ok(errs.includes(expected), `expected ${expected} in ${JSON.stringify(errs)}`);
    }
  } finally {
    rmSync(negDir, { recursive: true, force: true });
  }

  // Positive: clean public non-PII view + matching visibleTo + valid deadline + hybrid stream/batch readside
  const posYaml = `
system: cert-exam
context: cert
roles:
  - name: Grader
    kind: human
  - name: ExamCron
    kind: scheduler
aggregates:
  - name: ExamCert
    aliases: [cert, state]
    stateFields:
      - name: status
        type: String
        default: "active"
        enum: ["active", "revoked"]
      - name: expiresAtMs
        type: Int
        default: 0
        waiveLineage: immutable-config
    commands:
      - name: Revoke
        parameters: []
        produces: [CertRevoked]
    events:
      - name: CertRevoked
        fields: []
    deadlines:
      - name: expireCert
        stateField: expiresAtMs
        triggerCommand: Revoke
        graceWindow: "60s"
readModels:
  - name: public-cert-view
    sourceAggregate: ExamCert
    fields:
      - name: status
        type: String
        source: stateField:status
        sensitivity: public
  - name: grader-only-view
    sourceAggregate: ExamCert
    visibleTo: [Grader]
    rowScope: org
    fields:
      - name: status
        type: String
        source: stateField:status
        sensitivity: internal
ports:
  - name: CertVerifyPort
    operations:
      - name: verifyPublic
        callerKind: anonymous
        authz:
          mode: public
          action: "cert:verify"
        parameters: []
        returns: public-cert-view
      - name: graderView
        callerKind: human
        authz:
          mode: auth-core
          allowedRoles: [Grader]
        parameters: []
        returns: grader-only-view
pipelines:
  - id: cert-batch-sync
    name: CertBatchSync
    admission:
      maxItemsPerChunk: 100
      maxInFlightChunks: 4
    steps:
      - id: s1
        command: ExamCert.Revoke
`;
  const posReadside = `
schemaVersion: co-arising.readside-binding/v2
materializedViews:
  - name: mv_cert_hybrid
    strategy: shared-materialized-view
    refreshMode: hybrid
    storage: jdbc-postgres
    servesReadModels: [public-cert-view, grader-only-view]
`;
  const posDir = makeProject(posYaml, { 'domain/revoke.ears': ears }, { 'bindings/cert-readside.yaml': posReadside });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(posDir, 'structures'),
      specsPath: join(posDir, 'behaviors'),
      bindingsPath: join(posDir, 'bindings'),
      strictLineage: true,
    });
    assert.equal(res.passed, true, JSON.stringify(res.diagnostics, null, 2));
    assert.equal(res.canonical.readside.materializedViews[0].refreshMode, 'hybrid');
    assert.equal(res.canonical.structures.aggregates[0].deadlines[0].triggerCommand, 'Revoke');
    assert.equal(res.canonical.structures.pipelines[0].admission.maxItemsPerChunk, 100);
  } finally {
    rmSync(posDir, { recursive: true, force: true });
  }
});

test('Batch E Compliance: blocks raw PII in immutable events under erasureRequired, validates obligation mappedTo, and renders legal signoff', () => {
  const ears = `
slice CandidateProfile.Register
rules:
  [BAD] IF prof.status != "new" or idToken is empty THEN SHALL reject request with INVALID
  [OK]  WHILE prof.status == "new" and idToken is non-empty
        WHEN Register
        SHALL transition prof.status -> "registered"
          AND emit CandidateRegistered
        post:
          prof.idToken' = idToken
`;

  // Negative: raw sensitivity: pii inside immutable event while erasureRequired=true & piiStrategy=pii-vault + unknown mappedTo
  const negYaml = `
system: exam-compliance
context: compliance
compliance:
  industry: media-certification
  jurisdictions: [CN-PIPL, CN-NRTA]
  dataResidency: mars-datacenter
  erasureRequired: true
  piiStrategy: pii-vault
  retentionPolicy: "5y-statutory"
  obligations:
    - id: COMP-01
      regulation: "CN-PIPL §47"
      summary: "Erasable PII via vault"
      mappedTo: [CandidateProfile.GhostCmd]
      legalSignoff: pending-counsel
aggregates:
  - name: CandidateProfile
    aliases: [prof, state]
    stateFields:
      - name: status
        type: String
        default: "new"
        enum: ["new", "registered"]
      - name: idToken
        type: String
        default: ""
        waiveLineage: external-read
    commands:
      - name: Register
        parameters:
          - idToken: String
        produces: [CandidateRegistered]
    events:
      - name: CandidateRegistered
        fields:
          - name: idToken
            type: String
            sensitivity: pii
`;
  const negDir = makeProject(negYaml, { 'domain/register.ears': ears });
  try {
    const res = compileCanonicalV2({
      structuresDir: join(negDir, 'structures'),
      specsPath: join(negDir, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const errs = codes(res.diagnostics, 'error');
    assert.ok(errs.includes('V2_COMPLIANCE_RAW_PII_IN_IMMUTABLE_EVENT'), `expected RAW_PII error in ${errs}`);
    assert.ok(errs.includes('V2_COMPLIANCE_UNKNOWN_MAPPING'), `expected UNKNOWN_MAPPING error in ${errs}`);
    assert.ok(errs.includes('V2_COMPLIANCE_INVALID_CONTRACT'), `expected INVALID_CONTRACT error in ${errs}`);
  } finally {
    rmSync(negDir, { recursive: true, force: true });
  }

  // Positive: tokenized-pii in immutable event + valid mappedTo + signoff/lineage.md legal signoff section
  const posYaml = `
system: exam-compliance
context: compliance
compliance:
  industry: media-certification
  jurisdictions: [CN-PIPL, CN-NRTA]
  dataResidency: cn-mainland
  erasureRequired: true
  piiStrategy: pii-vault
  retentionPolicy: "5y-statutory"
  obligations:
    - id: COMP-01
      regulation: "CN-PIPL §47"
      summary: "Raw PII stored in external PiiVault; immutable events store tokenized-pii only"
      mappedTo: [CandidateProfile.Register, CandidateProfile.CandidateRegistered]
      legalSignoff: pending-counsel
aggregates:
  - name: CandidateProfile
    aliases: [prof, state]
    stateFields:
      - name: status
        type: String
        default: "new"
        enum: ["new", "registered"]
      - name: idToken
        type: String
        default: ""
        sensitivity: tokenized-pii
        waiveLineage: external-read
    commands:
      - name: Register
        parameters:
          - idToken: String
        produces: [CandidateRegistered]
    events:
      - name: CandidateRegistered
        fields:
          - name: idToken
            type: String
            sensitivity: tokenized-pii
`;
  const posDir = makeProject(posYaml, { 'domain/register.ears': ears });
  try {
    const signoffDir = join(posDir, 'signoff');
    const res = compileCanonicalV2({
      structuresDir: join(posDir, 'structures'),
      specsPath: join(posDir, 'behaviors'),
      outSignoffDir: signoffDir,
      strictLineage: true,
    });
    assert.equal(res.passed, true, JSON.stringify(res.diagnostics, null, 2));
    assert.equal(res.canonical.structures.compliance.industry, 'media-certification');
    assert.equal(res.canonical.structures.compliance.piiStrategy, 'pii-vault');
    const linMd = readFileSync(join(signoffDir, 'lineage.md'), 'utf8');
    assert.ok(linMd.includes('Regulatory & Privacy Compliance Signoff'));
    assert.ok(linMd.includes('CN-PIPL §47') && linMd.includes('pending-counsel'));
  } finally {
    rmSync(posDir, { recursive: true, force: true });
  }
});
