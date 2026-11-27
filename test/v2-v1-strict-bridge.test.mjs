import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { getCodegenPlugin } from '../lib/v2/codegen/interface.mjs';
import '../lib/v2/bridge/v1-strict-scala.mjs';
import {
  GENERATED_HEADER_CONF,
  GENERATED_HEADER_SCALA,
  GENERATOR_MANIFEST,
  generateScalaCqrsPlayServiceV2ForBc,
} from '../generators/scala-cqrs-play-service-v2/generate.mjs';
import { renderCleanBoolScala, simplifyBoolExpr } from '../lib/v2/bridge/ears-simplify.mjs';
import { emitV2ExecutableTests } from '../lib/v2/test-emitter/emit.mjs';
import { deriveClozeTasksV2 } from '../lib/v2/tasks-v2.mjs';
import { buildSandwichContextPack } from '../lib/v2/context-pack.mjs';
import { detectScalaToolchain, resolveScalaTestClasspath, runV2VerifyGate } from '../lib/v2/verify-gate.mjs';
import { exportAtlasV2 } from '../lib/v2/atlas-viewer.mjs';
import { exportV2WorkshopHtml } from '../lib/v2/view-v2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const BANK_V2_CANONICAL = resolve(ROOT, '../bank-wealth-demo/v2-pilot/.truthsrc/canonical-v2.json');

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('EARS Algebraic Simplifier eliminates double negations and flips comparison operators cleanly', () => {
  const env = {
    aliases: new Set(['state', 'ledger']),
    stateTypes: new Map([
      ['availableAmount', { kind: 'decimal', scale: 2 }],
      ['reservedByTx', { kind: 'map', value: { kind: 'decimal', scale: 2 } }],
    ]),
    paramTypes: new Map([
      ['amount', { kind: 'decimal', scale: 2 }],
      ['txId', { kind: 'string' }],
    ]),
    paramPrefix: 'p',
  };

  // not (amount > 0.00) -> p.amount <= BigDecimal("0.00")
  const notGt = {
    kind: 'not',
    argument: {
      kind: 'compare',
      op: '>',
      left: { kind: 'var', name: 'amount' },
      right: { kind: 'number', value: '0.00', scale: 2 },
    },
  };
  assert.equal(renderCleanBoolScala(notGt, env), 'p.amount <= BigDecimal("0.00")');

  // not (not (txId in ledger.reservedByTx)) -> state.reservedByTx.contains(p.txId)
  const doubleNeg = {
    kind: 'not',
    argument: {
      kind: 'not',
      argument: {
        kind: 'in',
        element: { kind: 'var', name: 'txId' },
        target: { kind: 'member', object: { kind: 'var', name: 'ledger' }, field: 'reservedByTx' },
      },
    },
  };
  assert.equal(renderCleanBoolScala(doubleNeg, env), 'state.reservedByTx.contains(p.txId)');

  // De Morgan: not ((not A) or B) -> A && (not B)
  const deMorgan = {
    kind: 'not',
    argument: {
      kind: 'binary',
      op: 'or',
      left: {
        kind: 'not',
        argument: {
          kind: 'in',
          element: { kind: 'var', name: 'txId' },
          target: { kind: 'member', object: { kind: 'var', name: 'ledger' }, field: 'reservedByTx' },
        },
      },
      right: {
        kind: 'compare',
        op: '==',
        left: { kind: 'member', object: { kind: 'var', name: 'ledger' }, field: 'availableAmount' },
        right: { kind: 'var', name: 'amount' },
      },
    },
  };
  const simplified = simplifyBoolExpr(deMorgan);
  assert.equal(simplified.kind, 'binary');
  assert.equal(simplified.op, 'and');
  assert.equal(
    renderCleanBoolScala(deMorgan, env),
    'state.reservedByTx.contains(p.txId) && state.availableAmount != p.amount',
  );
});

test('scala-strict bridge: multi-aggregate duplicate command names + sequence/map types compile and pass live ScalaTest + Mutation Gate', () => {
  const work = makeTempDir('truthsrc-v1-strict-multiagg-');
  try {
    mkdirSync(join(work, 'truth/exam/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/exam/behaviors/domain'), { recursive: true });
    mkdirSync(join(work, 'truth/exam/behaviors/application'), { recursive: true });

    // Two aggregates in the SAME bounded context both declaring a `Submit` command and `Submitted` event!
    writeFileSync(join(work, 'truth/exam/structures/exam.yaml'), `
system: drama-exam
subdomain: exam
context: exam
roles:
  - name: candidate
exactTypes:
  - name: ExamFee
    form: unit-decimal
    amountField: amount
    unitField: currency
    units: [CNY]
    scale: 2
    precision: 18
valueObjects:
  - name: AnswerSummary
    fields:
      - name: questionCount
        type: Int
externContracts:
  - name: paperExists
    ownerPort: ExamHttpPort
    params:
      - paperId: String
aggregates:
  - name: CandidatePaper
    aliases: [paper, state]
    stateFields:
      - name: paperId
        type: String
        default: ""
      - name: status
        type: String
        enum: [DRAFT, SUBMITTED]
        default: DRAFT
      - name: answeredCount
        type: Int
        default: 0
      - name: tags
        type: Seq[String]
      - name: scoreBySection
        type: Map[String, Int]
    commands:
      - name: Submit
        produces: [Submitted]
        parameters:
          - name: paperId
            type: String
          - name: minAnswers
            type: Int
    events:
      - name: Submitted
        fields:
          - name: paperId
            type: String
          - name: minAnswers
            type: Int
            waiveLineage: audit-only
  - name: ExamAttempt
    aliases: [attempt, state]
    stateFields:
      - name: attemptId
        type: String
        default: ""
      - name: status
        type: String
        enum: [OPEN, SUBMITTED]
        default: OPEN
      - name: penalty
        type: Decimal(2)
        default: "0.00"
    commands:
      - name: Submit
        produces: [Submitted]
        parameters:
          - name: attemptId
            type: String
          - name: penalty
            type: Decimal(2)
    events:
      - name: Submitted
        fields:
          - name: attemptId
            type: String
          - name: penalty
            type: Decimal(2)
ports:
  - name: ExamHttpPort
    direction: inbound
    operations:
      - name: submitPaper
        callerKind: human
        authz:
          mode: static-roles
          allowedRoles: [candidate]
        parameters:
          - name: paperId
            type: String
stories:
  - name: SubmitPaperStory
    entryPort: ExamHttpPort
    entryOperation: submitPaper
    dispatches: [CandidatePaper.Submit]
    responses: [SubmitAccepted]
`, 'utf8');

    writeFileSync(join(work, 'truth/exam/behaviors/domain/candidate-paper-submit.ears'), `
slice CandidatePaper.Submit

axioms:
  [AX-PAPER-1] ALWAYS paper.answeredCount >= 0

rules:
  [PAPER_ALREADY_SUBMITTED] IF paper.status != "DRAFT" THEN SHALL reject request with PAPER_ALREADY_SUBMITTED
  [PAPER_TOO_FEW_ANSWERS]   IF paper.status == "DRAFT" and paper.answeredCount < minAnswers THEN SHALL reject request with PAPER_TOO_FEW_ANSWERS
  [PAPER_SUBMITTED]         WHILE paper.status == "DRAFT" and paper.answeredCount >= minAnswers
                            WHEN Submit
                            SHALL emit Submitted
                            post:
                              paper.status' = "SUBMITTED"
`, 'utf8');

    writeFileSync(join(work, 'truth/exam/behaviors/domain/exam-attempt-submit.ears'), `
slice ExamAttempt.Submit

axioms:
  [AX-ATTEMPT-1] ALWAYS attempt.penalty >= 0.00

rules:
  [ATTEMPT_NEGATIVE_PENALTY]  IF penalty < 0.00 THEN SHALL reject request with ATTEMPT_NEGATIVE_PENALTY
  [ATTEMPT_ALREADY_SUBMITTED] IF penalty >= 0.00 and attempt.status != "OPEN" THEN SHALL reject request with ATTEMPT_ALREADY_SUBMITTED
  [ATTEMPT_SUBMITTED]         WHILE penalty >= 0.00 and attempt.status == "OPEN"
                              WHEN Submit
                              SHALL emit Submitted
                              post:
                                attempt.status'  = "SUBMITTED"
                                attempt.penalty' = penalty
`, 'utf8');

    writeFileSync(join(work, 'truth/exam/behaviors/application/submit-paper.story.ears'), `
story SubmitPaperStory layer application

where:
  extern paperExists(paperId) as "paper record exists"

rules:
  [STORY_PAPER_NOT_FOUND] IF not paperExists(paperId)
                          WHEN ExamHttpPort.submitPaper
                          THEN SHALL reject request with PAPER_NOT_FOUND
  [STORY_PAPER_SUBMITTED] WHILE paperExists(paperId)
                          WHEN ExamHttpPort.submitPaper
                          SHALL dispatch CandidatePaper.Submit
                          AND SHALL respond SubmitAccepted
`, 'utf8');

    const canonicalPath = join(work, '.truthsrc/canonical-v2.json');
    const dbPath = join(work, '.truthsrc/knowledge.sqlite');
    const compiled = compileCanonicalV2({
      structuresDir: join(work, 'truth/exam/structures'),
      specsPath: join(work, 'truth/exam/behaviors'),
      outFile: canonicalPath,
      dbFile: dbPath,
    });
    assert.equal(compiled.passed, true, `Compile should pass: ${JSON.stringify(compiled.diagnostics)}`);

    // Generate 1.0 strict-governance Scala architecture via real emitter/families/*
    const plugin = getCodegenPlugin('scala-strict');
    assert.ok(plugin, 'scala-strict codegen plugin must be registered');
    const genRes = plugin.generate(compiled.canonical, {
      outDir: work,
      packageName: 'exam.platform.exam',
    });
    assert.equal(genRes.architecture, '1.0-strict-governance');

    // Verify 1.0 strict-governance directory layout (zero flat root-package files!)
    const pkgBase = 'generated-scaffold/scala/exam/platform/exam';
    assert.equal(existsSync(join(work, `${pkgBase}/domain/values/ExamFee.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/values/AnswerSummary.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/entities/CandidatePaperEntity.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/entities/ExamAttemptEntity.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/entities/behaviors/CandidatePaperEventHandler.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/entities/behaviors/ExamAttemptEventHandler.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/invariants/CandidatePaperRules.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/invariants/ExamAttemptRules.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/invariants/params/CandidatePaperRuleParams.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/invariants/params/ExamAttemptRuleParams.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/domain/services/CandidatePaperComputations.scala`)), true);
    assert.equal(existsSync(join(work, `${pkgBase}/application/services/SubmitPaperStoryPort.scala`)), true);
    assert.equal(existsSync(join(work, 'handwritten/scala/exam/platform/exam/application/services/SubmitPaperStoryImpl.scala')), true);

    // Check emitted rules have ZERO double negations
    const attemptRules = readFileSync(join(work, `${pkgBase}/domain/invariants/ExamAttemptRules.scala`), 'utf8');
    assert.match(attemptRules, /if \(\(p\.penalty < BigDecimal\("0\.00"\)\)\)/);
    assert.doesNotMatch(attemptRules, /!\(\(!\(/);

    // Emit locked BDD/TDD oracles against 1.0 strict-governance architecture
    const testRes = emitV2ExecutableTests(compiled.canonical, {
      outDir: work,
      targets: ['scala-strict'],
      packageName: 'exam.platform.exam',
    });
    assert.ok(testRes.manifestCount >= 6);

    // Check tasks-v2 & context-pack-v2 point to 1.0 strict-governance handwritten isolation zone
    const tasks = deriveClozeTasksV2({
      rootDir: work,
      canonicalFile: canonicalPath,
      dbFile: dbPath,
      targets: ['scala-strict'],
      packageName: 'exam.platform.exam',
    });
    assert.equal(tasks.summary.pending, 1);
    assert.equal(
      tasks.tasks[0].targetFiles[0].file,
      'handwritten/scala/exam/platform/exam/application/services/SubmitPaperStoryImpl.scala',
    );
    const pack = buildSandwichContextPack({
      canonicalV2: compiled.canonical,
      dbFile: dbPath,
      slotId: 'submit-paper-story',
      workspaceDir: work,
    });
    assert.ok(pack.pack.middle.clozeBounds, 'context-pack-v2 must locate Scala strict-governance @cloze bounds');
    assert.match(pack.pack.middle.clozeBounds.file, /application\/services\/SubmitPaperStoryImpl\.scala$/);

    // If Scala toolchain + ScalaTest jars are available, run FULL live scalac + ScalaTest + Mutation Gate!
    const tc = detectScalaToolchain();
    const cp = resolveScalaTestClasspath({ scalaBinaryVersion: tc.binaryVersion });
    if (tc.available && cp.jars.length > 0) {
      // 1. Before filling @cloze -> verify-v2 reports expectedClozeRed.isExpectedTddRed === true
      const redVerify = runV2VerifyGate({
        rootDir: work,
        targets: ['scala-strict'],
        canonicalFile: canonicalPath,
        dbFile: dbPath,
        strict: true,
      });
      assert.equal(redVerify.passed, false);
      assert.equal(redVerify.scalaCheck.stage, 'scalatest', 'scalac must succeed cleanly even with duplicate command names!');
      assert.equal(redVerify.expectedClozeRed.isExpectedTddRed, true);
      assert.equal(redVerify.expectedClozeRed.unimplementedCount, 1);
      assert.equal(redVerify.onionCheck.passed, true);
      assert.equal(redVerify.testabilityCheck.passed, true);

      // 2. Fill ONLY inside @cloze:start..@cloze:end of handwritten/scala/.../application/services/SubmitPaperStoryImpl.scala
      const clozeFile = join(work, 'handwritten/scala/exam/platform/exam/application/services/SubmitPaperStoryImpl.scala');
      const filled = readFileSync(clozeFile, 'utf8').replace(
        'throw new UnsupportedOperationException("CLOZE_NOT_IMPLEMENTED: submit-paper-story")',
        [
          'val paperId = req.payload.getOrElse("paperId", "")',
          '    if (!externs.paperExists(paperId)) Left(iMadzError("PAPER_NOT_FOUND", "PAPER_NOT_FOUND"))',
          '    else {',
          '      effects.dispatch("CandidatePaper.Submit", req.payload)',
          '      Right(SubmitPaperStorySuccessResponse(ruleId = "STORY_PAPER_SUBMITTED", responseType = Some("SubmitAccepted")))',
          '    }',
        ].join('\n'),
      );
      writeFileSync(clozeFile, filled, 'utf8');

      // 3. Re-run verify-v2 --strict + Mutation Gate -> 100% GREEN including 100% mutant kill rate on 1.0 Rules!
      const greenVerify = runV2VerifyGate({
        rootDir: work,
        targets: ['scala-strict'],
        canonicalFile: canonicalPath,
        dbFile: dbPath,
        strict: true,
        mutationGate: true,
      });
      assert.equal(greenVerify.passed, true, `Strict verify + mutation gate must pass: ${JSON.stringify(greenVerify, null, 2)}`);
      assert.equal(greenVerify.scalaCheck.passed, true);
      assert.equal(greenVerify.onionCheck.passed, true);
      assert.equal(greenVerify.testabilityCheck.passed, true);
      assert.equal(greenVerify.mutationCheck.passed, true);
      assert.equal(greenVerify.mutationCheck.scala.killRate, 100);
      assert.ok(greenVerify.mutationCheck.scala.total >= 3);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('scala-strict bridge: generates and compiles bank-wealth-demo v2-pilot canonical through 1.0 strict-governance emitters cleanly', () => {
  if (!existsSync(BANK_V2_CANONICAL)) return;
  const work = makeTempDir('truthsrc-v1-strict-bank-');
  try {
    const canonicalV2 = JSON.parse(readFileSync(BANK_V2_CANONICAL, 'utf8'));
    const plugin = getCodegenPlugin('scala-strict');
    plugin.generate(canonicalV2, { outDir: work, packageName: 'example.bankwealth' });
    emitV2ExecutableTests(canonicalV2, { outDir: work, targets: ['scala-strict'], packageName: 'example.bankwealth' });

    const cbRules = readFileSync(
      join(work, 'generated-scaffold/scala/example/bankwealth/domain/invariants/CreditBalanceRules.scala'),
      'utf8',
    );
    // Clean algebraically simplified guards (zero `!((cmd.amount > ...))` double negation)
    assert.match(cbRules, /if \(\(p\.amount <= BigDecimal\("0\.00"\)\)\)/);
    assert.match(cbRules, /else if \(\(state\.reservedByTx\.contains\(p\.txId\)\)\)/);
    assert.match(cbRules, /else if \(\(state\.availableAmount < p\.amount\)\)/);

    // L2 cloze lands in 1.0 domain/services/impl/ and L3 cloze lands in application/services/
    assert.equal(
      existsSync(join(work, 'handwritten/scala/example/bankwealth/domain/services/impl/FundOrderConfirmTASharesImpl.scala')),
      true,
    );
    assert.equal(
      existsSync(join(work, 'handwritten/scala/example/bankwealth/application/services/CashFundPurchaseImpl.scala')),
      true,
    );

    // Real scalac compile check (no type errors across all 1.0-emitted + L2/L3 files!)
    const tc = detectScalaToolchain();
    const cp = resolveScalaTestClasspath({ scalaBinaryVersion: tc.binaryVersion });
    if (tc.available && cp.jars.length > 0) {
      const verify = runV2VerifyGate({
        rootDir: work,
        targets: ['scala-strict'],
        canonicalFile: BANK_V2_CANONICAL,
        strict: true,
      });
      assert.equal(verify.scalaCheck.stage, 'scalatest', `scalac failed on bank v2-pilot: ${JSON.stringify(verify.scalaCheck)}`);
      assert.equal(verify.onionCheck.passed, true);
      assert.equal(verify.testabilityCheck.passed, true);
      assert.equal(verify.expectedClozeRed.isExpectedTddRed, true);
      assert.equal(verify.expectedClozeRed.unimplementedCount, 3);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('multi-domain atlas-v2 handles auditSystemLineageV2 field schema and emits all subdomain diagrams without undefined fields', () => {
  const work = makeTempDir('truthsrc-multi-atlas-');
  try {
    mkdirSync(join(work, 'identity/structures'), { recursive: true });
    mkdirSync(join(work, 'identity/behaviors/domain'), { recursive: true });
    mkdirSync(join(work, 'exam/structures'), { recursive: true });
    mkdirSync(join(work, 'exam/behaviors/domain'), { recursive: true });

    writeFileSync(join(work, 'identity/structures/id.yaml'), `
system: exam-sys
subdomain: identity
context: identity
aggregates:
  - name: Account
    aliases: [acc, state]
    stateFields:
      - name: accountId
        type: String
        default: ""
      - name: active
        type: Bool
        default: true
    commands:
      - name: Register
        produces: [AccountRegistered]
        parameters:
          - name: accountId
            type: String
    events:
      - name: AccountRegistered
        fields:
          - name: accountId
            type: String
`, 'utf8');
    writeFileSync(join(work, 'identity/behaviors/domain/account-register.ears'), `
slice Account.Register
rules:
  [ID_EMPTY] IF accountId == "" THEN SHALL reject request with ID_EMPTY
  [ID_OK]    WHILE accountId != ""
             WHEN Register
             SHALL emit AccountRegistered
             post:
               acc.accountId' = accountId
`, 'utf8');

    writeFileSync(join(work, 'exam/structures/exam.yaml'), `
system: exam-sys
subdomain: exam
context: exam
aggregates:
  - name: Registration
    aliases: [reg, state]
    stateFields:
      - name: accountId
        type: String
        default: ""
      - name: registered
        type: Bool
        default: false
    commands:
      - name: Enroll
        produces: [Enrolled]
        parameters:
          - name: accountId
            type: String
    events:
      - name: Enrolled
        fields:
          - name: accountId
            type: String
`, 'utf8');
    writeFileSync(join(work, 'exam/behaviors/domain/reg-enroll.ears'), `
slice Registration.Enroll
rules:
  [ENROLL_EMPTY] IF accountId == "" THEN SHALL reject request with ENROLL_EMPTY
  [ENROLL_OK]    WHILE accountId != ""
                 WHEN Enroll
                 SHALL emit Enrolled
                 post:
                   reg.accountId' = accountId
                   reg.registered' = true
`, 'utf8');

    writeFileSync(join(work, 'domain-map.yaml'), `
system: exam-sys
boundedContexts:
  - name: identity-bc
    subdomains: [identity]
  - name: exam-bc
    subdomains: [exam]
integrations:
  - id: id-to-exam
    upstreamSubdomain: identity
    upstreamEvent: Account.AccountRegistered
    downstreamSubdomain: exam
    downstreamTarget: Registration.Enroll
    fieldMappings:
      - from: accountId
        to: accountId
`, 'utf8');

    const c1 = join(work, 'identity.canonical.json');
    const c2 = join(work, 'exam.canonical.json');
    assert.equal(compileCanonicalV2({ structuresDir: join(work, 'identity/structures'), specsPath: join(work, 'identity/behaviors'), outFile: c1 }).passed, true);
    assert.equal(compileCanonicalV2({ structuresDir: join(work, 'exam/structures'), specsPath: join(work, 'exam/behaviors'), outFile: c2 }).passed, true);

    const outHtml = join(work, 'signoff/atlas.html');
    const atlasRes = exportAtlasV2({
      canonicalFiles: [c1, c2],
      domainMapFile: join(work, 'domain-map.yaml'),
      outFile: outHtml,
    });
    assert.ok(atlasRes.diagrams.length >= 21, `expected 3 system + 2*9 subdomain diagrams, got ${atlasRes.diagrams.length}`);
    assert.ok(atlasRes.diagrams.some(d => d.id === 'identity-event-matrix'));
    assert.ok(atlasRes.diagrams.some(d => d.id === 'exam-event-matrix'));
    const html = readFileSync(outHtml, 'utf8');
    assert.doesNotMatch(html, /SD_undefined/, 'Multi-domain Mermaid must never contain SD_undefined');
    assert.match(html, /Account\.AccountRegistered/);
    assert.match(html, /Registration\.Enroll/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('scala-cqrs-play-service-v2 (Full Blocks A+B+C+D): generates complete 1.0+2.0 layout with headers, passes live ScalaTest (domain+app+HTTP/Authz) + Mutation Gate + Explorer view-v2', () => {
  assert.equal(GENERATOR_MANIFEST.schemaVersion, 'truthsrc.product-generator/v2');
  assert.equal(GENERATOR_MANIFEST.name, 'scala-cqrs-play-service');
  assert.equal(GENERATOR_MANIFEST.version, '2');

  const work = makeTempDir('truthsrc-v2-full-abcd-');
  try {
    mkdirSync(join(work, 'truth/exam/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/exam/behaviors/domain'), { recursive: true });
    mkdirSync(join(work, 'truth/exam/behaviors/application'), { recursive: true });

    writeFileSync(join(work, 'truth/exam/structures/exam.yaml'), `
system: drama-exam
subdomain: exam
context: exam
roles:
  - name: candidate
exactTypes:
  - name: ExamFee
    form: unit-decimal
    amountField: amount
    unitField: currency
    units: [CNY]
    scale: 2
    precision: 18
valueObjects:
  - name: AnswerSummary
    fields:
      - name: questionCount
        type: Int
externContracts:
  - name: paperExists
    ownerPort: ExamHttpPort
    params:
      - paperId: String
aggregates:
  - name: CandidatePaper
    aliases: [paper, state]
    stateFields:
      - name: paperId
        type: String
        default: ""
      - name: status
        type: String
        enum: [DRAFT, SUBMITTED]
        default: DRAFT
      - name: answeredCount
        type: Int
        default: 0
    commands:
      - name: Submit
        produces: [Submitted]
        parameters:
          - name: paperId
            type: String
          - name: minAnswers
            type: Int
    events:
      - name: Submitted
        fields:
          - name: paperId
            type: String
          - name: minAnswers
            type: Int
            waiveLineage: audit-only
ports:
  - name: ExamHttpPort
    direction: inbound
    operations:
      - name: submitPaper
        callerKind: human
        authz:
          mode: static-roles
          allowedRoles: [candidate]
        parameters:
          - name: paperId
            type: String
stories:
  - name: SubmitPaperStory
    entryPort: ExamHttpPort
    entryOperation: submitPaper
    dispatches: [CandidatePaper.Submit]
    responses: [SubmitAccepted]
`, 'utf8');

    writeFileSync(join(work, 'truth/exam/behaviors/domain/candidate-paper-submit.ears'), `
slice CandidatePaper.Submit

axioms:
  [AX-PAPER-1] ALWAYS paper.answeredCount >= 0

rules:
  [PAPER_ALREADY_SUBMITTED] IF paper.status != "DRAFT" THEN SHALL reject request with PAPER_ALREADY_SUBMITTED
  [PAPER_TOO_FEW_ANSWERS]   IF paper.status == "DRAFT" and paper.answeredCount < minAnswers THEN SHALL reject request with PAPER_TOO_FEW_ANSWERS
  [PAPER_SUBMITTED]         WHILE paper.status == "DRAFT" and paper.answeredCount >= minAnswers
                            WHEN Submit
                            SHALL emit Submitted
                            post:
                              paper.status' = "SUBMITTED"
`, 'utf8');

    writeFileSync(join(work, 'truth/exam/behaviors/application/submit-paper.story.ears'), `
story SubmitPaperStory layer application

where:
  extern paperExists(paperId) as "paper record exists"

rules:
  [STORY_PAPER_NOT_FOUND] IF not paperExists(paperId)
                          WHEN ExamHttpPort.submitPaper
                          THEN SHALL reject request with PAPER_NOT_FOUND
  [STORY_PAPER_SUBMITTED] WHILE paperExists(paperId)
                          WHEN ExamHttpPort.submitPaper
                          SHALL dispatch CandidatePaper.Submit
                          AND SHALL respond SubmitAccepted
`, 'utf8');

    const canonicalPath = join(work, '.truthsrc/canonical-v2.json');
    const dbPath = join(work, '.truthsrc/knowledge.sqlite');
    const compiled = compileCanonicalV2({
      structuresDir: join(work, 'truth/exam/structures'),
      specsPath: join(work, 'truth/exam/behaviors'),
      outFile: canonicalPath,
      dbFile: dbPath,
    });
    assert.equal(compiled.passed, true, `compile failed: ${JSON.stringify(compiled.diagnostics)}`);

    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    assert.ok(plugin, 'scala-cqrs-play-service-v2 plugin must be registered');
    const genRes = plugin.generate(compiled.canonical, {
      outDir: work,
      packageName: 'exam.platform.exam',
    });
    assert.equal(genRes.generator, 'scala-cqrs-play-service:2');
    assert.equal(genRes.generatorSchemaVersion, 'truthsrc.product-generator/v2');
    assert.equal(genRes.generatedHeader, GENERATED_HEADER_SCALA);

    // Check EVERY generated-scaffold file carries the exact scala-cqrs-play-service:2 header!
    const scaffoldFiles = genRes.files.filter(f => f.path.startsWith('generated-scaffold/'));
    assert.ok(scaffoldFiles.length >= 30, `expected >= 30 full Block A-D files, got ${scaffoldFiles.length}`);
    for (const f of scaffoldFiles) {
      const content = readFileSync(f.absPath, 'utf8');
      if (f.path.endsWith('.scala') || f.path.endsWith('.proto') || f.path.endsWith('.sbt')) {
        assert.ok(content.startsWith(GENERATED_HEADER_SCALA), `missing Scala/Proto/SBT header on ${f.path}`);
      } else if (f.path.endsWith('.conf') || f.path.endsWith('.properties')) {
        assert.ok(content.startsWith(GENERATED_HEADER_CONF), `missing conf header on ${f.path}`);
      }
    }

    // Verify full 1.0 + 2.0 directory tree across Blocks A, C, D
    const pkgBase = 'generated-scaffold/scala/exam/platform/exam';
    const expectedPaths = [
      // Block A (Domain Core + Ports + Handwritten @cloze)
      `${pkgBase}/domain/values/ExamFee.scala`,
      `${pkgBase}/domain/values/AnswerSummary.scala`,
      `${pkgBase}/domain/entities/CandidatePaperEntity.scala`,
      `${pkgBase}/domain/entities/CandidatePaperAxioms.scala`,
      `${pkgBase}/domain/entities/behaviors/CandidatePaperEventHandler.scala`,
      `${pkgBase}/domain/invariants/CandidatePaperRules.scala`,
      `${pkgBase}/domain/invariants/params/CandidatePaperRuleParams.scala`,
      `${pkgBase}/domain/services/CandidatePaperComputations.scala`,
      `${pkgBase}/application/services/SubmitPaperStoryPort.scala`,
      'handwritten/scala/exam/platform/exam/application/services/SubmitPaperStoryImpl.scala',
      // Block C (7 curated 1.0 Aggregate/Protocol/Repository/Bootstrap/Protobuf/Converter/Serializer families)
      `${pkgBase}/application/aggregates/CandidatePaperProtocol.scala`,
      `${pkgBase}/application/aggregates/CandidatePaperAggregate.scala`,
      `${pkgBase}/application/aggregates/factories/CandidatePaperAggregateFactory.scala`,
      `${pkgBase}/application/aggregates/behaviors/CandidatePaperBehaviors.scala`,
      `${pkgBase}/application/aggregates/behaviors/CandidatePaperCommandHelpers.scala`,
      `${pkgBase}/application/aggregates/repository/CandidatePaperRepository.scala`,
      `${pkgBase}/infrastructure/bootstrap/CandidatePaperBootstrap.scala`,
      'generated-scaffold/protobuf/shared_value_objects.proto',
      'generated-scaffold/protobuf/candidate_paper.proto',
      `${pkgBase}/infrastructure/persistence/converters/SharedValueProtoConverters.scala`,
      `${pkgBase}/infrastructure/persistence/converters/CandidatePaperProtoConverters.scala`,
      `${pkgBase}/infrastructure/persistence/converters/DomainConverters.scala`,
      `${pkgBase}/infrastructure/persistence/DomainProtoSerializer.scala`,
      `${pkgBase}/infrastructure/persistence/CandidatePaperEventAdapter.scala`,
      `${pkgBase}/infrastructure/persistence/CandidatePaperSnapshotAdapter.scala`,
      // Block D (Play service-runtime + project-scaffold + 5-layer Authz PEP/PDP + OnionBootstrap)
      `${pkgBase}/infrastructure/bootstrap/ExamServiceContract.scala`,
      `${pkgBase}/infrastructure/bootstrap/ExamServiceLoader.scala`,
      `${pkgBase}/infrastructure/bootstrap/ExamServiceConfiguration.scala`,
      `${pkgBase}/infrastructure/bootstrap/ApplicationBootstrap.scala`,
      `${pkgBase}/modules/BootstrapModule.scala`,
      `${pkgBase}/modules/OnionBootstrap.scala`,
      `${pkgBase}/application/connectors/OutboundConnectors.scala`,
      `${pkgBase}/interfaces/api/ApiDto.scala`,
      `${pkgBase}/interfaces/http/SubmitPaperStoryController.scala`,
      `${pkgBase}/interfaces/http/HttpRouter.scala`,
      `${pkgBase}/interfaces/web/PlayHttpBridge.scala`,
      `${pkgBase}/infrastructure/persistence/InMemoryStore.scala`,
      `${pkgBase}/infrastructure/connectors/DefaultOutboundConnectors.scala`,
      'generated-scaffold/conf/application.conf',
      'generated-scaffold/conf/serialization.conf',
      'generated-scaffold/build.sbt',
      'generated-scaffold/project/build.properties',
      'generated-scaffold/project/plugins.sbt',
    ];
    for (const rel of expectedPaths) {
      assert.equal(existsSync(join(work, rel)), true, `missing expected full A-D file: ${rel}`);
    }

    // Emit locked BDD/TDD oracles (Domain + Application + Interfaces HTTP/Authz)
    const testRes = emitV2ExecutableTests(compiled.canonical, {
      outDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      packageName: 'exam.platform.exam',
    });
    assert.equal(
      existsSync(join(work, 'generated-tests/scala/exam/platform/exam/interfaces/http/InterfacesHttpSpec.scala')),
      true,
    );
    assert.ok(testRes.manifestCount >= 5);

    // Fill L3 @cloze slot
    const clozeFile = join(work, 'handwritten/scala/exam/platform/exam/application/services/SubmitPaperStoryImpl.scala');
    writeFileSync(
      clozeFile,
      readFileSync(clozeFile, 'utf8').replace(
        'throw new UnsupportedOperationException("CLOZE_NOT_IMPLEMENTED: submit-paper-story")',
        [
          'val paperId = req.payload.getOrElse("paperId", "")',
          '    if (!externs.paperExists(paperId)) Left(iMadzError("PAPER_NOT_FOUND", "PAPER_NOT_FOUND"))',
          '    else {',
          '      effects.dispatch("CandidatePaper.Submit", req.payload)',
          '      Right(SubmitPaperStorySuccessResponse(ruleId = "STORY_PAPER_SUBMITTED", responseType = Some("SubmitAccepted")))',
          '    }',
        ].join('\n'),
      ),
      'utf8',
    );

    // Run live scalac + ScalaTest (domain + application + interfaces HTTP/Authz) + Onion DIP + Mutation Gate!
    const tc = detectScalaToolchain();
    const cp = resolveScalaTestClasspath({ scalaBinaryVersion: tc.binaryVersion });
    if (tc.available && cp.jars.length > 0) {
      const verify = runV2VerifyGate({
        rootDir: work,
        targets: ['scala-cqrs-play-service-v2'],
        canonicalFile: canonicalPath,
        dbFile: dbPath,
        strict: true,
        mutationGate: true,
      });
      assert.equal(verify.passed, true, `full A-D verify-v2 failed: ${JSON.stringify(verify, null, 2)}`);
      assert.equal(verify.scalaCheck.passed, true);
      assert.equal(verify.scalaCheck.suiteClasses.length, 3, 'must execute Domain + Application + InterfacesHttp ScalaTest suites');
      assert.ok(verify.scalaCheck.sbtRuntimeFilesCount >= 10, 'must partition sbt Akka/Play/ScalaPB runtime files cleanly');
      assert.equal(verify.onionCheck.passed, true);
      assert.equal(verify.testabilityCheck.passed, true);
      assert.equal(verify.mutationCheck.passed, true);
      assert.equal(verify.mutationCheck.scala.killRate, 100);
    }

    // Export Explorer offline workshop HTML (view-v2) and confirm 1.0 layout + header visibility!
    const workshopOut = join(work, 'signoff/workshop.html');
    const viewRes = exportV2WorkshopHtml({
      rootDir: work,
      dbFile: dbPath,
      outFile: workshopOut,
    });
    assert.ok(viewRes.mappedNodes >= 8, `expected >= 8 mapped knowledge nodes in Explorer, got ${viewRes.mappedNodes}`);
    assert.ok(viewRes.totalLocations >= 15, `expected >= 15 code locations across 1.0 layout, got ${viewRes.totalLocations}`);
    const html = readFileSync(workshopOut, 'utf8');
    assert.match(html, /scala-cqrs-play-service:2/);
    assert.match(html, /domain\/values\/ExamFee\.scala/);
    assert.match(html, /domain\/invariants\/CandidatePaperRules\.scala/);
    assert.match(html, /protobuf\/candidate_paper\.proto/);
    assert.match(html, /interfaces\/http\/SubmitPaperStoryController\.scala/);
    assert.match(html, /SubmitPaperStoryImpl\.scala/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('scala-cqrs-play-service-v2 (Full Blocks A+B+C+D): generates bank-wealth-demo v2-pilot with 0 Onion DIP violations and clean scalac compile', () => {
  if (!existsSync(BANK_V2_CANONICAL)) return;
  const work = makeTempDir('truthsrc-v2-full-bank-');
  try {
    const canonicalV2 = JSON.parse(readFileSync(BANK_V2_CANONICAL, 'utf8'));
    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    const genRes = plugin.generate(canonicalV2, { outDir: work, packageName: 'example.bankwealth' });
    emitV2ExecutableTests(canonicalV2, {
      outDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      packageName: 'example.bankwealth',
    });

    assert.ok(genRes.familiesUsed.includes('value-object'));
    assert.ok(genRes.familiesUsed.includes('aggregate-invariant-rules'));
    assert.ok(genRes.familiesUsed.includes('protocol-layer'));
    assert.ok(genRes.familiesUsed.includes('aggregate-layer'));
    assert.ok(genRes.familiesUsed.includes('proto-schema'));
    assert.ok(genRes.familiesUsed.includes('serialization-adapter'));
    assert.ok(genRes.familiesUsed.includes('service-runtime'));
    assert.ok(genRes.familiesUsed.includes('project-scaffold'));
    assert.ok(genRes.familiesUsed.includes('authz-pep-dsl'));
    assert.ok(genRes.familiesUsed.includes('query-service'));
    assert.ok(genRes.familiesUsed.includes('projection-repository-port'));
    assert.ok(genRes.familiesUsed.includes('projection-repository-implementation'));
    assert.ok(genRes.familiesUsed.includes('projection'));
    assert.ok(genRes.familiesUsed.includes('projection-handler'));
    assert.ok(genRes.familiesUsed.includes('readside-bootstrap'));
    assert.ok(genRes.familiesUsed.includes('command-endpoint-dsl'));
    assert.ok(genRes.familiesUsed.includes('aggregate-state-controller'));
    assert.ok(genRes.familiesUsed.includes('http-controller'));
    assert.ok(genRes.familiesUsed.includes('routes'));
    assert.ok(genRes.familiesUsed.includes('strict-saga-module'));
    assert.ok(genRes.familiesUsed.includes('saga-coordinator-bootstrap'));

    // 1. Semantic stable @knowledge anchors (zero array-index pointers like /aggregates/2/commands/0/guards/2)
    const cbRules = readFileSync(
      join(work, 'generated-scaffold/scala/example/bankwealth/domain/invariants/CreditBalanceRules.scala'),
      'utf8',
    );
    assert.doesNotMatch(cbRules, /\/aggregates\/\d+\//, 'must never emit unstable numeric array indices in @knowledge anchors');
    assert.match(cbRules, /#\/behaviors\/CreditBalance\.ReserveFunds\/rules\/BAL_INSUFFICIENT_FUNDS/);
    // 2. Real checkEventPostconditions (never `= None`)
    assert.doesNotMatch(cbRules, /def checkEventPostconditions\(events: List\[Event\]\): Option\[iMadzError\] = None/);
    assert.match(cbRules, /private def checkEventPostcondition\(event: Event\): Option\[iMadzError\]/);

    // 3. Strongly-typed CallerContractSpec (zero escaped `contractJson`)
    const cashPort = readFileSync(
      join(work, 'generated-scaffold/scala/example/bankwealth/application/services/CashFundPurchasePort.scala'),
      'utf8',
    );
    assert.doesNotMatch(cashPort, /contractJson/, 'must replace escaped JSON string with typed CallerContractSpec');
    assert.match(cashPort, /val spec: CallerContractSpec = CallerContractSpec\(/);
    assert.equal(existsSync(join(work, 'generated-scaffold/scala/example/bankwealth/application/services/CallerContractSpec.scala')), true);

    // 4. Full ReadSide Projection Suite wired into ApplicationBootstrap + idiomatic triple-quoted SQL DDL
    const appBoot = readFileSync(
      join(work, 'generated-scaffold/scala/example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala'),
      'utf8',
    );
    assert.match(appBoot, /with BankOrderReadsideBootstrap/);
    assert.match(appBoot, /initBankOrderReadsideProjection\(/);
    const schemaDdl = readFileSync(
      join(work, 'generated-scaffold/scala/example/bankwealth/infrastructure/repositories/projection/BankOrderReadsideSchema.scala'),
      'utf8',
    );
    assert.match(schemaDdl, /"""\|CREATE TABLE IF NOT EXISTS/);
    assert.match(schemaDdl, /\.stripMargin/);

    // 5. auth-core Play Controllers + AggregateStateApiController + CommandDsl + conf/routes
    const playCtrl = readFileSync(join(work, 'generated-scaffold/scala/controllers/CashFundPurchasePlayController.scala'), 'utf8');
    assert.match(playCtrl, /Endpoint/);
    assert.match(playCtrl, /api\.(?:global|tenant|anonymous)\./);
    assert.equal(existsSync(join(work, 'generated-scaffold/scala/controllers/AggregateStateApiController.scala')), true);
    assert.equal(existsSync(join(work, 'generated-scaffold/scala/example/bankwealth/infrastructure/api/CommandDsl.scala')), true);
    const routesConf = readFileSync(join(work, 'generated-scaffold/conf/routes'), 'utf8');
    assert.match(routesConf, /controllers\.CashFundPurchasePlayController\./);
    assert.match(routesConf, /controllers\.AggregateStateApiController\./);

    // 6. Saga / Effect Orchestration + SagaCoordinatorBootstrap + serialization.conf host/effect registrations
    assert.equal(existsSync(join(work, 'generated-scaffold/scala/example/bankwealth/infrastructure/bootstrap/SagaCoordinatorBootstrap.scala')), true);
    const serConf = readFileSync(join(work, 'generated-scaffold/conf/serialization.conf'), 'utf8');
    assert.match(serConf, /cash-fund-purchase-host/);
    assert.match(serConf, /cash-fund-purchase-effect/);

    const tc = detectScalaToolchain();
    const cp = resolveScalaTestClasspath({ scalaBinaryVersion: tc.binaryVersion });
    if (tc.available && cp.jars.length > 0) {
      const verify = runV2VerifyGate({
        rootDir: work,
        targets: ['scala-cqrs-play-service-v2'],
        canonicalFile: BANK_V2_CANONICAL,
        strict: true,
      });
      assert.equal(verify.scalaCheck.stage, 'scalatest', `scalac failed on full A-D bank v2-pilot: ${JSON.stringify(verify.scalaCheck)}`);
      assert.equal(verify.onionCheck.passed, true, `Onion DIP failed: ${JSON.stringify(verify.onionCheck.violations)}`);
      assert.equal(verify.testabilityCheck.passed, true);
      assert.equal(verify.expectedClozeRed.isExpectedTddRed, true);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('scala-cqrs-play-service-v2: Multi-Subdomain -> Single Bounded Context packaging + Cross-BC ExternalEventBridge (#46)', () => {
  const work = makeTempDir('truthsrc-v2-bc-packaging-');
  try {
    mkdirSync(join(work, 'truth/identity/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/identity/behaviors/domain'), { recursive: true });
    mkdirSync(join(work, 'truth/exam/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/exam/behaviors/domain'), { recursive: true });
    mkdirSync(join(work, 'truth/cert/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/cert/behaviors/domain'), { recursive: true });

    writeFileSync(join(work, 'truth/identity/structures/identity.yaml'), `
system: edu-platform
subdomain: identity
context: identity
aggregates:
  - name: CandidateAccount
    aliases: [acc, state]
    stateFields:
      - name: accountId
        type: String
        default: ""
    commands:
      - name: Register
        produces: [Registered]
        parameters:
          - name: accountId
            type: String
    events:
      - name: Registered
        fields:
          - name: accountId
            type: String
`, 'utf8');
    writeFileSync(join(work, 'truth/identity/behaviors/domain/acc.ears'), `
slice CandidateAccount.Register
rules:
  [ACC_EMPTY] IF accountId == "" THEN SHALL reject request with ACC_EMPTY
  [ACC_OK]    WHILE accountId != ""
              WHEN Register
              SHALL emit Registered
              post:
                acc.accountId' = accountId
`, 'utf8');

    writeFileSync(join(work, 'truth/exam/structures/exam.yaml'), `
system: edu-platform
subdomain: exam
context: exam
aggregates:
  - name: ExamSession
    aliases: [session, state]
    stateFields:
      - name: sessionId
        type: String
        default: ""
    commands:
      - name: Start
        produces: [SessionStarted]
        parameters:
          - name: sessionId
            type: String
    events:
      - name: SessionStarted
        fields:
          - name: sessionId
            type: String
`, 'utf8');
    writeFileSync(join(work, 'truth/exam/behaviors/domain/exam.ears'), `
slice ExamSession.Start
rules:
  [SES_EMPTY] IF sessionId == "" THEN SHALL reject request with SES_EMPTY
  [SES_OK]    WHILE sessionId != ""
              WHEN Start
              SHALL emit SessionStarted
              post:
                session.sessionId' = sessionId
`, 'utf8');

    writeFileSync(join(work, 'truth/cert/structures/cert.yaml'), `
system: edu-platform
subdomain: cert
context: cert
aggregates:
  - name: Certificate
    aliases: [cert, state]
    stateFields:
      - name: certId
        type: String
        default: ""
    commands:
      - name: Issue
        produces: [CertIssued]
        parameters:
          - name: certId
            type: String
    events:
      - name: CertIssued
        fields:
          - name: certId
            type: String
`, 'utf8');
    writeFileSync(join(work, 'truth/cert/behaviors/domain/cert.ears'), `
slice Certificate.Issue
rules:
  [CERT_EMPTY] IF certId == "" THEN SHALL reject request with CERT_EMPTY
  [CERT_OK]    WHILE certId != ""
               WHEN Issue
               SHALL emit CertIssued
               post:
                 cert.certId' = certId
`, 'utf8');

    const cIdentity = compileCanonicalV2({ structuresDir: join(work, 'truth/identity/structures'), specsPath: join(work, 'truth/identity/behaviors') }).canonical;
    const cExam = compileCanonicalV2({ structuresDir: join(work, 'truth/exam/structures'), specsPath: join(work, 'truth/exam/behaviors') }).canonical;
    const cCert = compileCanonicalV2({ structuresDir: join(work, 'truth/cert/structures'), specsPath: join(work, 'truth/cert/behaviors') }).canonical;

    // Context Mapping: identity + exam packaged into ONE BC (`core-bc`), while `cert` is upstream/separate BC with ACL integration into ExamSession!
    const domainMap = {
      system: 'edu-platform',
      boundedContexts: [
        { name: 'core-bc', subdomains: ['identity', 'exam'], package: 'edu.platform.core' },
        { name: 'cert-bc', subdomains: ['cert'], package: 'edu.platform.cert' },
      ],
      integrations: [
        {
          id: 'cert-to-exam',
          upstreamSubdomain: 'cert',
          upstreamEvent: 'Certificate.CertIssued',
          downstreamSubdomain: 'exam',
          downstreamTarget: 'ExamSession.Start',
          pattern: 'ACL',
        },
      ],
    };

    const bcOut = join(work, 'services/core-bc');
    const bcRes = generateScalaCqrsPlayServiceV2ForBc({
      domainMap,
      bcName: 'core-bc',
      canonicals: [cIdentity, cExam, cCert],
      outDir: bcOut,
    });

    assert.equal(bcRes.boundedContext, 'core-bc');
    assert.deepEqual(bcRes.packagedSubdomains.sort(), ['exam', 'identity']);
    assert.equal(bcRes.externalIntegrationsCount, 1);
    assert.ok(bcRes.familiesUsed.includes('external-event-bridge'), 'must emit #46 external-event-bridge for cross-BC integration');

    // Both subdomains' aggregates live inside ONE unified Play/sbt BC service!
    assert.equal(existsSync(join(bcOut, 'generated-scaffold/scala/edu/platform/core/domain/entities/CandidateAccountEntity.scala')), true);
    assert.equal(existsSync(join(bcOut, 'generated-scaffold/scala/edu/platform/core/domain/entities/ExamSessionEntity.scala')), true);
    // Excluded subdomain (`cert`) must NOT leak into core-bc!
    assert.equal(existsSync(join(bcOut, 'generated-scaffold/scala/edu/platform/core/domain/entities/CertificateEntity.scala')), false);

    // #46 ExternalEventBridge + ExternalAuthority wired cleanly into ExamSession + ApplicationBootstrap!
    assert.equal(existsSync(join(bcOut, 'generated-scaffold/scala/edu/platform/core/application/aggregates/behaviors/ExamSessionExternalEvents.scala')), true);
    const appBoot = readFileSync(join(bcOut, 'generated-scaffold/scala/edu/platform/core/infrastructure/bootstrap/ApplicationBootstrap.scala'), 'utf8');
    assert.match(appBoot, /initCandidateAccountAggregate\(sharding, candidateAccountComputations\)/);
    assert.match(appBoot, /initExamSessionAggregate\(sharding, examSessionComputations, examSessionAuthority\)/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
