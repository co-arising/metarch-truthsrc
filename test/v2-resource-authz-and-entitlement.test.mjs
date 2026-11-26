// Resource-Level Authz, Principal Binding, Qualification Entitlements & Row-Scope Enforcement Tests
// Real-world scenario: Short-video platform creator qualification exam (`short_video_exam_canary`)
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { typescriptCodegenPlugin } from '../lib/v2/codegen/typescript.mjs';
import { scalaCodegenPlugin } from '../lib/v2/codegen/scala.mjs';
import { emitV2ExecutableTests } from '../lib/v2/test-emitter/emit.mjs';
import { buildAtlasBundle } from '../lib/v2/diagrams.mjs';
import { renderAtlasHtml } from '../lib/v2/atlas-viewer.mjs';
import { detectScalaToolchain, resolveScalaTestClasspath } from '../lib/v2/verify-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANARY_ROOT = resolve(__dirname, 'fixtures/canary/short_video_exam_canary');

test('Resource Authz Positive: short_video_exam_canary compiles cleanly with strictLineage, signoff & Atlas', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-res-authz-pos-'));
  try {
    const signoffDir = join(workDir, 'signoff');
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors'),
      outSignoffDir: signoffDir,
      strictLineage: true,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    const authzMatrix = compiled.canonical.lineage.authzMatrix;
    const submitRow = authzMatrix.find(r => r.operation === 'ExamAttemptPort.submit');
    assert.equal(submitRow.mode, 'resource-policy');
    assert.equal(submitRow.resource.type, 'ExamAttempt');
    assert.equal(submitRow.resource.idFrom, 'param.attemptId');
    assert.equal(submitRow.resource.ownerField, 'candidateId');
    assert.equal(submitRow.resource.relation, 'owner');
    assert.deepEqual(submitRow.bindPrincipal, [{ param: 'candidateId', from: 'principal.id' }]);

    const publishRow = authzMatrix.find(r => r.operation === 'CreatorPublishPort.publishVerticalVideo');
    assert.equal(publishRow.requiresEntitlement.length, 1);
    assert.equal(publishRow.requiresEntitlement[0].code, 'cert:vertical-video:active');
    assert.equal(publishRow.requiresEntitlement[0].matchParam, 'categoryId');

    const viewRm = compiled.canonical.structures.readModels.find(r => r.name === 'my-attempt-view');
    assert.equal(viewRm.rowScope, 'self');
    assert.deepEqual(viewRm.rowScopeSpec, { kind: 'self', matchField: 'candidateId', principalKey: 'id' });

    const signoffMd = readFileSync(join(signoffDir, 'lineage.md'), 'utf8');
    assert.ok(signoffMd.includes('`ExamAttempt` (owner:candidateId) [owner]'));
    assert.ok(signoffMd.includes('bind:candidateId<-principal.id'));
    assert.ok(signoffMd.includes('ent:cert:vertical-video:active(categoryId)'));

    const atlasHtml = renderAtlasHtml(buildAtlasBundle({ canonical: compiled.canonical }));
    assert.ok(atlasHtml.includes('ExamAttempt'));
    assert.ok(atlasHtml.includes('cert:vertical-video:active'));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('Resource Authz Fail-Closed: compiler catches invalid resource, bindPrincipal, entitlement & rowScope contracts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coarising-res-authz-neg-'));
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
    writeFileSync(join(dir, 'structures/bad.yaml'), `
system: bad-res-authz
context: bad
roles:
  - name: Creator
    kind: human
aggregates:
  - name: ExamAttempt
    aliases: [attempt, state]
    stateFields:
      - candidateId: CreatorId = ""
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
readModels:
  - name: bad-view
    sourceAggregate: ExamAttempt
    sourceEvents: [Closed]
    rowScope:
      kind: self
      matchField: ghostOwnerField
    fields:
      - name: status
        type: String
        enum: ["open", "closed"]
        source: stateField:status
  - name: bad-kind-view
    sourceAggregate: ExamAttempt
    sourceEvents: [Closed]
    rowScope: universe
    fields:
      - name: status
        type: String
        enum: ["open", "closed"]
        source: stateField:status
ports:
  - name: BadPort
    operations:
      - name: missingResource
        authz:
          mode: resource-policy
          allowedRoles: [Creator]
        parameters: []
        returns: Unit
      - name: badRefs
        authz:
          mode: resource-policy
          allowedRoles: [Creator]
          resource:
            type: ExamAttempt
            idFrom: param.ghostAttemptId
            ownerField: ghostStateOwner
          bindPrincipal:
            - ghostParam: principal.id
            - okParam: client.spoofed
          requiresEntitlement:
            - code: "cert:medical"
              source: GhostAggregate
              matchParam: ghostCategory
        parameters:
          - okParam: String
        returns: Unit
`, 'utf8');
    writeFileSync(join(dir, 'behaviors/domain/close.ears'), `
slice ExamAttempt.Close
rules:
  [CLOSED_ERR] IF attempt.status != "open" THEN SHALL reject request with ALREADY_CLOSED
  [CLOSED_OK]  WHILE attempt.status == "open" WHEN Close SHALL transition attempt.status -> "closed" AND emit Closed
`, 'utf8');

    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const codes = new Set(res.diagnostics.map(d => d.code));
    assert.ok(codes.has('V2_READMODEL_UNKNOWN_ROWSCOPE_FIELD'), `got: ${[...codes]}`);
    assert.ok(codes.has('V2_READMODEL_INVALID_ROWSCOPE'), `got: ${[...codes]}`);
    assert.ok(codes.has('V2_AUTHZ_INVALID_CONTRACT'), `got: ${[...codes]}`);
    assert.ok(codes.has('V2_AUTHZ_UNKNOWN_RESOURCE_PARAM'), `got: ${[...codes]}`);
    assert.ok(codes.has('V2_AUTHZ_UNKNOWN_RESOURCE_FIELD'), `got: ${[...codes]}`);
    assert.ok(codes.has('V2_AUTHZ_UNKNOWN_BIND_PARAM'), `got: ${[...codes]}`);
    assert.ok(codes.has('V2_AUTHZ_UNKNOWN_ENTITLEMENT_SOURCE'), `got: ${[...codes]}`);
    assert.ok(codes.has('V2_AUTHZ_UNKNOWN_ENTITLEMENT_PARAM'), `got: ${[...codes]}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Resource Authz TS Runtime: IDOR 403, scoped Entitlements 403, bindPrincipal anti-spoofing, rowScope 403 & auto-emitted HTTP spec', async () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-res-authz-ts-'));
  try {
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors'),
      strictLineage: true,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    typescriptCodegenPlugin.generate(compiled.canonical, { outDir: workDir });
    const emittedTests = emitV2ExecutableTests(compiled.canonical, {
      outDir: workDir,
      targets: ['typescript'],
    });
    const tsHttpSpecPath = join(workDir, 'generated-tests/ts/interfaces-http.ears.spec.ts');
    const tsHttpSpecContent = readFileSync(tsHttpSpecPath, 'utf8');
    assert.ok(emittedTests.emitted.some(f => f.relativePath.endsWith('interfaces-http.ears.spec.ts')));
    assert.ok(tsHttpSpecContent.includes('AUTHZ_EXAM_ATTEMPT_PORT_SUBMIT_403_IDOR'));
    assert.ok(tsHttpSpecContent.includes('AUTHZ_EXAM_ATTEMPT_PORT_START_403_ENTITLEMENT'));
    assert.ok(tsHttpSpecContent.includes('AUTHZ_CREATOR_PUBLISH_PORT_PUBLISH_VERTICAL_VIDEO_403_ENTITLEMENT'));
    assert.ok(tsHttpSpecContent.includes('seenResourceType'));

    // Run auto-generated TS interfaces HTTP oracle (exercises live node:http + RoleBasedAuthority IDOR & Entitlement matrix)
    // First write a tiny working cloze implementation for QualificationExam so interfaces-http spec imports resolve cleanly
    writeFileSync(join(workDir, 'handwritten/qualification-exam.cloze.ts'), `
import type { QualificationExamHandler, QualificationExamRequest, QualificationExamExternPorts, QualificationExamEffectsPort, QualificationExamOutcome } from "../generated-scaffold/ts/qualification-exam.port.ts";

export const qualificationExamHandler: QualificationExamHandler = {
  handle(req: QualificationExamRequest, externs: QualificationExamExternPorts, effects: QualificationExamEffectsPort): QualificationExamOutcome {
    const p = req.payload;
    if (req.operation === "ExamAttemptPort.start") {
      effects.dispatch("ExamAttempt.StartAttempt", { candidateId: p.candidateId, categoryId: p.categoryId });
      return { ok: true, ruleId: "QE-01", responseType: "ExamAck", response: { accepted: true } };
    }
    if (req.operation === "ExamAttemptPort.submit") {
      if (!externs.attemptExists(p.attemptId)) return { ok: false, code: "NOT_FOUND", ruleId: "QE-02" };
      effects.dispatch("ExamAttempt.SubmitAnswer", { score: p.score });
      return { ok: true, ruleId: "QE-03", responseType: "ExamAck", response: { accepted: true } };
    }
    if (req.operation === "ExamAttemptPort.review") {
      if (!externs.attemptExists(p.attemptId)) return { ok: false, code: "NOT_FOUND", ruleId: "QE-04" };
      effects.dispatch("ExamAttempt.ReviewAttempt", { approved: p.approved });
      return { ok: true, ruleId: "QE-05", responseType: "ExamAck", response: { accepted: true } };
    }
    if (req.operation === "ExamAttemptPort.getMyAttempt") {
      if (!externs.attemptExists(p.attemptId)) return { ok: false, code: "NOT_FOUND", ruleId: "QE-06" };
      return {
        ok: true,
        ruleId: "QE-07",
        viewName: "my-attempt-view",
        view: {
          attemptId: p.attemptId ?? "att-1",
          candidateId: req.stateSnapshot?.candidateId ?? p.candidateId ?? "unknown",
          categoryId: req.stateSnapshot?.categoryId ?? "medical",
          status: req.stateSnapshot?.status ?? "submitted",
          score: req.stateSnapshot?.score ?? 90,
        },
      };
    }
    if (req.operation === "CreatorPublishPort.publishVerticalVideo") {
      if (!externs.categoryOpen(p.categoryId)) return { ok: false, code: "CATEGORY_CLOSED", ruleId: "QE-08" };
      return { ok: true, ruleId: "QE-09", responseType: "PublishAck", response: { published: true } };
    }
    return { ok: false, code: "UNKNOWN_OPERATION", ruleId: "UNKNOWN" };
  },
};
`, 'utf8');

    execFileSync(process.execPath, ['--test', tsHttpSpecPath], {
      cwd: workDir,
      stdio: 'pipe',
    });

    // Direct behavioral verification of IDOR, bindPrincipal anti-spoofing, scoped entitlements, rowScope & PDP resource
    const dtoMod = await import(pathToFileURL(join(workDir, 'generated-scaffold/ts/interfaces/api/dto.ts')).href);
    const bootMod = await import(pathToFileURL(join(workDir, 'generated-scaffold/ts/modules/bootstrap.ts')).href);

    let capturedReq = null;
    const spyHandler = {
      handle(req) {
        capturedReq = req;
        if (req.operation === 'ExamAttemptPort.getMyAttempt') {
          return {
            ok: true,
            ruleId: 'QE-07',
            viewName: 'my-attempt-view',
            view: { attemptId: 'att-1', candidateId: req.stateSnapshot?.leakedOwner ?? req.payload.candidateId, status: 'passed', score: 96 },
          };
        }
        return { ok: true, ruleId: 'OK', responseType: 'ExamAck', response: { accepted: true } };
      },
    };

    let pdpCapturedQuery = null;
    const authority = dtoMod.createRoleBasedAuthority(
      req => {
        const who = req.headers?.['x-user'];
        if (!who) return null;
        if (who === 'alice-qualified') {
          return {
            id: 'alice',
            roles: ['Creator'],
            tenantId: 't-video',
            entitlements: ['creator:realname-verified', 'course:completed:medical', 'cert:vertical-video:active:medical'],
          };
        }
        if (who === 'alice-cooking-only') {
          return {
            id: 'alice',
            roles: ['Creator'],
            tenantId: 't-video',
            entitlements: ['creator:realname-verified', 'course:completed:cooking', 'cert:vertical-video:active:cooking'],
          };
        }
        if (who === 'reviewer-med') {
          return { id: 'rev-1', roles: ['CategoryReviewer'], tenantId: 't-video' };
        }
        return null;
      },
      {
        decide(query) {
          pdpCapturedQuery = query;
          return query.resource?.type === 'ExamAttempt' && query.resource?.id === 'att-99' && query.context.categoryId === 'medical';
        },
      },
    );

    const app = bootMod.createApp({ handlers: { QualificationExam: spyHandler }, authority });

    // 1. IDOR blocked: Alice tries to submit Bob's ExamAttempt -> 403 FORBIDDEN_RESOURCE
    const idorRes = app.router.route({
      method: 'POST',
      path: '/api/v1/creator-qualification/exam-attempt-port/submit',
      headers: { 'x-user': 'alice-qualified' },
      body: { attemptId: 'att-bob', candidateId: 'bob', score: 100 },
      stateSnapshot: { candidateId: 'bob', status: 'started' },
    });
    assert.equal(idorRes.status, 403);
    assert.equal(idorRes.body.code, 'FORBIDDEN_RESOURCE');

    // 2. Own resource + bindPrincipal anti-spoofing: Alice sends spoofed candidateId="victim-bob" -> overwritten to "alice"
    capturedReq = null;
    const ownRes = app.router.route({
      method: 'POST',
      path: '/api/v1/creator-qualification/exam-attempt-port/submit',
      headers: { 'x-user': 'alice-qualified' },
      body: { attemptId: 'att-alice', candidateId: 'victim-bob', score: 95 },
      stateSnapshot: { candidateId: 'alice', status: 'started' },
    });
    assert.equal(ownRes.status, 200);
    assert.equal(capturedReq.payload.candidateId, 'alice');
    assert.equal(capturedReq.principal.id, 'alice');

    // 3. Scoped Entitlement cross-category blocked: cooking cert CANNOT publish medical video -> 403 ENTITLEMENT_REQUIRED
    const wrongCatPub = app.router.route({
      method: 'POST',
      path: '/api/v1/creator-qualification/creator-publish-port/publish-vertical-video',
      headers: { 'x-user': 'alice-cooking-only' },
      body: { creatorId: 'spoofed', categoryId: 'medical', videoId: 'vid-1' },
    });
    assert.equal(wrongCatPub.status, 403);
    assert.equal(wrongCatPub.body.code, 'ENTITLEMENT_REQUIRED');

    // 4. Scoped Entitlement allowed: medical cert CAN publish medical video + creatorId force-bound to "alice"
    capturedReq = null;
    const okPub = app.router.route({
      method: 'POST',
      path: '/api/v1/creator-qualification/creator-publish-port/publish-vertical-video',
      headers: { 'x-user': 'alice-qualified' },
      body: { creatorId: 'spoofed', categoryId: 'medical', videoId: 'vid-1' },
    });
    assert.equal(okPub.status, 200);
    assert.equal(capturedReq.payload.creatorId, 'alice');

    // 5. External PDP ReBAC receives first-class resource object
    pdpCapturedQuery = null;
    const revOk = app.router.route({
      method: 'POST',
      path: '/api/v1/creator-qualification/exam-attempt-port/review',
      headers: { 'x-user': 'reviewer-med' },
      body: { attemptId: 'att-99', categoryId: 'medical', approved: true },
      stateSnapshot: { candidateId: 'alice', status: 'submitted' },
    });
    assert.equal(revOk.status, 200);
    assert.equal(pdpCapturedQuery.resource.type, 'ExamAttempt');
    assert.equal(pdpCapturedQuery.resource.id, 'att-99');
    assert.equal(pdpCapturedQuery.resource.ownerId, 'alice');
    assert.equal(pdpCapturedQuery.resource.relation, 'category-reviewer');

    // 6. ReadModel rowScope runtime enforcement: leaked row with Bob's candidateId blocked with 403 FORBIDDEN_ROW_SCOPE
    const leakRes = app.router.route({
      method: 'GET',
      path: '/api/v1/creator-qualification/exam-attempt-port/get-my-attempt',
      headers: { 'x-user': 'alice-qualified' },
      query: { attemptId: 'att-1', candidateId: 'bob' },
      stateSnapshot: { leakedOwner: 'bob' },
    });
    assert.equal(leakRes.status, 403);
    assert.equal(leakRes.body.code, 'FORBIDDEN_ROW_SCOPE');

    const ownViewRes = app.router.route({
      method: 'GET',
      path: '/api/v1/creator-qualification/exam-attempt-port/get-my-attempt',
      headers: { 'x-user': 'alice-qualified' },
      query: { attemptId: 'att-1', candidateId: 'spoofed-bob' },
    });
    assert.equal(ownViewRes.status, 200);
    assert.equal(ownViewRes.body.view.candidateId, 'alice');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('Resource Authz Scala Parity: scalac + ScalaTest executes IDOR, Entitlement, bindPrincipal & rowScope specs', () => {
  const tc = detectScalaToolchain();
  const cp = resolveScalaTestClasspath({ scalaBinaryVersion: tc.binaryVersion });
  if (!tc.available || cp.jars.length === 0) {
    return;
  }
  const classpath = cp.jars.join(':');
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-res-authz-scala-'));
  try {
    const pkg = 'example.shortvideo';
    const pkgDir = pkg.split('.').join('/');
    const compiled = compileCanonicalV2({
      structuresDir: join(CANARY_ROOT, 'structures'),
      specsPath: join(CANARY_ROOT, 'behaviors'),
      strictLineage: true,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics, null, 2));

    const scalaGen = scalaCodegenPlugin.generate(compiled.canonical, { outDir: workDir, packageName: pkg });
    const emittedTests = emitV2ExecutableTests(compiled.canonical, {
      outDir: workDir,
      targets: ['scala'],
      packageName: pkg,
    });
    const scalaHttpSpecPath = join(workDir, `generated-tests/scala/${pkgDir}/InterfacesHttpSpec.scala`);
    const scalaHttpSpecContent = readFileSync(scalaHttpSpecPath, 'utf8');
    assert.ok(emittedTests.emitted.some(f => f.relativePath.endsWith('InterfacesHttpSpec.scala')));
    assert.ok(scalaHttpSpecContent.includes('AUTHZ_EXAM_ATTEMPT_PORT_SUBMIT_403_IDOR'));
    assert.ok(scalaHttpSpecContent.includes('AUTHZ_EXAM_ATTEMPT_PORT_START_403_ENTITLEMENT'));
    assert.ok(scalaHttpSpecContent.includes('AUTHZ_CREATOR_PUBLISH_PORT_PUBLISH_VERTICAL_VIDEO_403_ENTITLEMENT'));

    // Implement QualificationExamCloze + a dedicated ResourceAuthzParitySpec exercising bindPrincipal & rowScope in Scala
    writeFileSync(join(workDir, `handwritten/scala/${pkgDir}/QualificationExamCloze.scala`), `
package ${pkg}

object QualificationExamCloze extends QualificationExamHandler {
  override def handle(req: QualificationExamRequest, externs: QualificationExamExternPorts, effects: QualificationExamEffectsPort): Either[DomainRejection, QualificationExamSuccessResponse] = {
    val p = req.payload
    req.operation match {
      case "ExamAttemptPort.start" =>
        effects.dispatch("ExamAttempt.StartAttempt", Map("candidateId" -> p.getOrElse("candidateId", ""), "categoryId" -> p.getOrElse("categoryId", "")))
        Right(QualificationExamSuccessResponse("QE-01", Some("ExamAck"), Map("accepted" -> true)))
      case "ExamAttemptPort.submit" =>
        if (!externs.attemptExists(p.getOrElse("attemptId", ""))) Left(DomainRejection("NOT_FOUND", "QE-02"))
        else {
          effects.dispatch("ExamAttempt.SubmitAnswer", Map("score" -> p.getOrElse("score", 0L)))
          Right(QualificationExamSuccessResponse("QE-03", Some("ExamAck"), Map("accepted" -> true)))
        }
      case "ExamAttemptPort.review" =>
        if (!externs.attemptExists(p.getOrElse("attemptId", ""))) Left(DomainRejection("NOT_FOUND", "QE-04"))
        else {
          effects.dispatch("ExamAttempt.ReviewAttempt", Map("approved" -> p.getOrElse("approved", false)))
          Right(QualificationExamSuccessResponse("QE-05", Some("ExamAck"), Map("accepted" -> true)))
        }
      case "ExamAttemptPort.getMyAttempt" =>
        if (!externs.attemptExists(p.getOrElse("attemptId", ""))) Left(DomainRejection("NOT_FOUND", "QE-06"))
        else Right(QualificationExamSuccessResponse(
          "QE-07",
          viewName = Some("my-attempt-view"),
          view = Map(
            "attemptId" -> p.getOrElse("attemptId", "att-1"),
            "candidateId" -> req.stateSnapshot.getOrElse("leakedOwner", p.getOrElse("candidateId", "unknown")),
            "categoryId" -> req.stateSnapshot.getOrElse("categoryId", "medical"),
            "status" -> req.stateSnapshot.getOrElse("status", "submitted"),
            "score" -> req.stateSnapshot.getOrElse("score", 90L)
          )
        ))
      case "CreatorPublishPort.publishVerticalVideo" =>
        if (!externs.categoryOpen(p.getOrElse("categoryId", ""))) Left(DomainRejection("CATEGORY_CLOSED", "QE-08"))
        else Right(QualificationExamSuccessResponse("QE-09", Some("PublishAck"), Map("published" -> true)))
      case _ => Left(DomainRejection("UNKNOWN_OPERATION", "UNKNOWN"))
    }
  }
}
`, 'utf8');

    const paritySpecPath = join(workDir, `generated-tests/scala/${pkgDir}/ResourceAuthzParitySpec.scala`);
    writeFileSync(paritySpecPath, `
package ${pkg}

import org.scalatest.funsuite.AnyFunSuite
import ${pkg}.interfaces.api.{AuthorizationPort, AuthzDecisionQuery, HttpRequest, Principal, RoleBasedAuthority}
import ${pkg}.modules.BootstrapModule

final class ResourceAuthzParitySpec extends AnyFunSuite {
  test("Scala bindPrincipal anti-spoofing, principal passthrough, scoped entitlement, IDOR & rowScope") {
    var seenCandidate: Any = ""
    var seenPrincipalId: Any = ""
    val spyHandler = new QualificationExamHandler {
      override def handle(req: QualificationExamRequest, externs: QualificationExamExternPorts, effects: QualificationExamEffectsPort) = {
        seenCandidate = req.payload.getOrElse("candidateId", "")
        seenPrincipalId = req.principal.flatMap(_.get("id")).getOrElse("")
        QualificationExamCloze.handle(req, externs, effects)
      }
    }
    var pdpResourceId: Option[String] = None
    val pdp = new AuthorizationPort {
      override def decide(q: AuthzDecisionQuery): Boolean = {
        pdpResourceId = q.resource.flatMap(_.id)
        q.resource.exists(r => r.resourceType == "ExamAttempt" && r.ownerId.contains("alice"))
      }
    }
    val auth = new RoleBasedAuthority(
      req => req.headers.get("x-user") match {
        case Some("alice-med") => Some(Principal("alice", Set("Creator"), Some("t-1"), entitlements = Set("creator:realname-verified", "course:completed:medical", "cert:vertical-video:active:medical")))
        case Some("alice-cook") => Some(Principal("alice", Set("Creator"), Some("t-1"), entitlements = Set("creator:realname-verified", "course:completed:cooking", "cert:vertical-video:active:cooking")))
        case Some("rev") => Some(Principal("rev-1", Set("CategoryReviewer"), Some("t-1")))
        case _ => None
      },
      pdp = Some(pdp)
    )
    val externsOk = new QualificationExamExternPorts {
      override def attemptExists(attemptId: Any): Boolean = true
      override def categoryOpen(categoryId: Any): Boolean = true
    }
    val rt = BootstrapModule.createRuntime(qualificationExamHandler = Some(spyHandler), qualificationExamExterns = Some(externsOk), authority = auth)

    // 1. IDOR blocked
    val idor = rt.router.route(HttpRequest("POST", "/api/v1/creator-qualification/exam-attempt-port/submit",
      headers = Map("x-user" -> "alice-med"),
      body = Map("attemptId" -> "att-bob", "candidateId" -> "bob", "score" -> 99L),
      stateSnapshot = Map("candidateId" -> "bob")))
    assert(idor.status == 403 && idor.body.get("code").contains("FORBIDDEN_RESOURCE"))

    // 2. bindPrincipal overwrites spoofed candidateId + forwards principal
    val okSubmit = rt.router.route(HttpRequest("POST", "/api/v1/creator-qualification/exam-attempt-port/submit",
      headers = Map("x-user" -> "alice-med"),
      body = Map("attemptId" -> "att-1", "candidateId" -> "spoofed-bob", "score" -> 95L),
      stateSnapshot = Map("candidateId" -> "alice")))
    assert(okSubmit.status == 200)
    assert(seenCandidate == "alice")
    assert(seenPrincipalId == "alice")

    // 3. Cross-category entitlement denied
    val wrongCat = rt.router.route(HttpRequest("POST", "/api/v1/creator-qualification/creator-publish-port/publish-vertical-video",
      headers = Map("x-user" -> "alice-cook"),
      body = Map("creatorId" -> "alice", "categoryId" -> "medical", "videoId" -> "v-1")))
    assert(wrongCat.status == 403 && wrongCat.body.get("code").contains("ENTITLEMENT_REQUIRED"))

    // 4. External PDP receives resource.id + ownerId
    val rev = rt.router.route(HttpRequest("POST", "/api/v1/creator-qualification/exam-attempt-port/review",
      headers = Map("x-user" -> "rev"),
      body = Map("attemptId" -> "att-99", "categoryId" -> "medical", "approved" -> true),
      stateSnapshot = Map("candidateId" -> "alice")))
    assert(rev.status == 200)
    assert(pdpResourceId.contains("att-99"))

    // 5. ReadModel rowScope blocks leaked row
    val leaked = rt.router.route(HttpRequest("GET", "/api/v1/creator-qualification/exam-attempt-port/get-my-attempt",
      headers = Map("x-user" -> "alice-med"),
      query = Map("attemptId" -> "att-1", "candidateId" -> "bob"),
      stateSnapshot = Map("leakedOwner" -> "bob")))
    assert(leaked.status == 403 && leaked.body.get("code").contains("FORBIDDEN_ROW_SCOPE"))
  }
}
`, 'utf8');

    const classesDir = join(workDir, 'classes');
    mkdirSync(classesDir, { recursive: true });
    const scalaFiles = [
      ...scalaGen.files.filter(f => f.path.endsWith('.scala') && !f.path.includes('handwritten/')).map(f => f.absPath),
      join(workDir, `handwritten/scala/${pkgDir}/QualificationExamCloze.scala`),
      scalaHttpSpecPath,
      paritySpecPath,
    ];
    execFileSync('scalac', ['-d', classesDir, '-cp', classpath, ...scalaFiles], {
      cwd: workDir,
      stdio: 'pipe',
    });
    try {
      execFileSync('scala', [
        '-cp', `${classesDir}:${classpath}`,
        'org.scalatest.tools.Runner', '-oD',
        '-s', `${pkg}.InterfacesHttpSpec`,
        '-s', `${pkg}.ResourceAuthzParitySpec`,
      ], { cwd: workDir, encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      throw new Error(`ScalaTest failed:\n${err.stdout || ''}\n${err.stderr || ''}`);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
