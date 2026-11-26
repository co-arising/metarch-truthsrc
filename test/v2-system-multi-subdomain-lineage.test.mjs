// Multi-Subdomain Field Lineage, Recursive SQLite PII Taint Tracking,
// Subdomain-vs-BoundedContext Topology Evolution, and CLI `audit-system-lineage-v2` Tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { auditSystemLineageV2, traceFieldLineage } from '../lib/v2/system-lineage.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = resolve(__dirname, '../bin/truthsrc.js');

function compileSubdomain(baseDir, name, structuresYaml, domainEars) {
  const dir = join(baseDir, name);
  mkdirSync(join(dir, 'structures'), { recursive: true });
  mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });
  writeFileSync(join(dir, 'structures/sub.yaml'), structuresYaml, 'utf8');
  writeFileSync(join(dir, 'behaviors/domain/main.ears'), domainEars, 'utf8');
  const outFile = join(dir, 'canonical.json');
  const res = compileCanonicalV2({
    structuresDir: join(dir, 'structures'),
    specsPath: join(dir, 'behaviors'),
    outFile,
  });
  assert.equal(res.passed, true, `subdomain ${name} failed compile: ${JSON.stringify(res.diagnostics, null, 2)}`);
  return { canonical: res.canonical, outFile };
}

function buildThreeSubdomainSystem(workDir, { includePiiOnExam = false, certErasureRequired = false } = {}) {
  const exam = compileSubdomain(
    workDir,
    'exam',
    `
system: short-drama-exam
subdomain: exam
subdomainType: core
exactTypes:
  - name: ScoreDecimal
    form: decimal
    scale: 2
aggregates:
  - name: ExamAttempt
    aliases: [attempt, state]
    stateFields:
      - name: status
        type: String
        default: "in_progress"
        enum: ["in_progress", "passed"]
      - name: finalScore
        type: ScoreDecimal
        default: "0.00"
      - name: holderRef
        type: String
        default: ""
        ${includePiiOnExam ? 'sensitivity: pii' : 'sensitivity: tokenized-pii'}
    commands:
      - name: PassExam
        parameters:
          - score: ScoreDecimal
          - holderRef: String
        produces: [ExamPassed]
    events:
      - name: ExamPassed
        fields:
          - name: score
            type: ScoreDecimal
          - name: holderRef
            type: String
            ${includePiiOnExam ? 'sensitivity: pii' : 'sensitivity: tokenized-pii'}
`,
    `
slice ExamAttempt.PassExam
rules:
  [BAD] IF attempt.status != "in_progress" or score < 60.00 or holderRef is empty
        THEN SHALL reject request with CANNOT_PASS
  [OK]  WHILE attempt.status == "in_progress" and score >= 60.00 and holderRef is non-empty
        WHEN PassExam
        SHALL transition attempt.status -> "passed"
          AND emit ExamPassed
        post:
          attempt.finalScore' = score
          attempt.holderRef' = holderRef
`,
  );

  const cert = compileSubdomain(
    workDir,
    'certification',
    `
system: short-drama-exam
subdomain: certification
subdomainType: supporting
${certErasureRequired ? `compliance:
  industry: media-certification
  jurisdictions: [CN-PIPL]
  dataResidency: cn-mainland
  erasureRequired: true
  piiStrategy: pii-vault` : ''}
exactTypes:
  - name: ScoreDecimal
    form: decimal
    scale: 2
aggregates:
  - name: Certificate
    aliases: [cert, state]
    stateFields:
      - name: status
        type: String
        default: "pending"
        enum: ["pending", "issued"]
      - name: examScore
        type: ScoreDecimal
        default: "0.00"
      - name: holderToken
        type: String
        default: ""
    commands:
      - name: Issue
        parameters:
          - examScore: ScoreDecimal
          - holderToken: String
        produces: [CertificateIssued]
    events:
      - name: CertificateIssued
        fields:
          - name: examScore
            type: ScoreDecimal
          - name: holderToken
            type: String
`,
    `
slice Certificate.Issue
rules:
  [BAD] IF cert.status != "pending" or examScore < 60.00 or holderToken is empty
        THEN SHALL reject request with CANNOT_ISSUE
  [OK]  WHILE cert.status == "pending" and examScore >= 60.00 and holderToken is non-empty
        WHEN Issue
        SHALL transition cert.status -> "issued"
          AND emit CertificateIssued
        post:
          cert.examScore' = examScore
          cert.holderToken' = holderToken
`,
  );

  const filing = compileSubdomain(
    workDir,
    'filing',
    `
system: short-drama-exam
subdomain: filing
subdomainType: supporting
exactTypes:
  - name: ScoreDecimal
    form: decimal
    scale: 2
aggregates:
  - name: DramaFiling
    aliases: [df, state]
    stateFields:
      - name: status
        type: String
        default: "locked"
        enum: ["locked", "eligible"]
      - name: verifiedHolder
        type: String
        default: ""
      - name: verifiedScore
        type: ScoreDecimal
        default: "0.00"
    commands:
      - name: GrantEligibility
        parameters:
          - verifiedHolder: String
          - verifiedScore: ScoreDecimal
        produces: [EligibilityGranted]
    events:
      - name: EligibilityGranted
        fields:
          - verifiedHolder: String
          - verifiedScore: ScoreDecimal
readModels:
  - name: public-filing-view
    sourceAggregate: DramaFiling
    sourceEvents: [EligibilityGranted]
    fields:
      - name: status
        type: String
        source: stateField:status
        sensitivity: public
      - name: verifiedHolder
        type: String
        source: stateField:verifiedHolder
        sensitivity: public
      - name: verifiedScore
        type: ScoreDecimal
        source: stateField:verifiedScore
        sensitivity: public
ports:
  - name: FilingQueryPort
    operations:
      - name: checkPublic
        callerKind: anonymous
        authz:
          mode: public
          action: "filing:check"
        parameters: []
        returns: public-filing-view
`,
    `
slice DramaFiling.GrantEligibility
rules:
  [BAD] IF df.status != "locked" or verifiedHolder is empty or verifiedScore < 60.00
        THEN SHALL reject request with CANNOT_GRANT
  [OK]  WHILE df.status == "locked" and verifiedHolder is non-empty and verifiedScore >= 60.00
        WHEN GrantEligibility
        SHALL transition df.status -> "eligible"
          AND emit EligibilityGranted
        post:
          df.verifiedHolder' = verifiedHolder
          df.verifiedScore' = verifiedScore
`,
  );

  return { exam, cert, filing };
}

test('Multi-Subdomain Positive: 3-subdomain lineage passes, monolith->microservice BC split requires zero subdomain truth edits, and traceFieldLineage traces full 6-hop chain', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-multisub-ok-'));
  try {
    const { exam, cert, filing } = buildThreeSubdomainSystem(workDir, { includePiiOnExam: false });
    assert.equal(exam.canonical.subdomain, 'exam');
    assert.equal(exam.canonical.subdomainType, 'core');

    const baseIntegrations = [
      {
        id: 'exam-to-cert',
        upstreamSubdomain: 'exam',
        upstreamEvent: 'ExamAttempt.ExamPassed',
        downstreamSubdomain: 'certification',
        downstreamTarget: 'Certificate.Issue',
        fieldMappings: [
          { from: 'score', to: 'examScore' },
          { from: 'holderRef', to: 'holderToken' },
        ],
      },
      {
        id: 'cert-to-filing',
        upstreamSubdomain: 'certification',
        upstreamEvent: 'Certificate.CertificateIssued',
        downstreamSubdomain: 'filing',
        downstreamTarget: 'DramaFiling.GrantEligibility',
        fieldMappings: [
          { from: 'holderToken', to: 'verifiedHolder' },
          { from: 'examScore', to: 'verifiedScore' },
        ],
      },
    ];

    // Topology 1: Modular Monolith (exam + certification share 1 Bounded Context; filing is separate BC)
    const dbPath = join(workDir, 'system-lineage.sqlite');
    const mdPath = join(workDir, 'signoff/system-lineage.md');
    const monoReport = auditSystemLineageV2({
      canonicals: [exam.outFile, cert.outFile, filing.outFile],
      domainMap: {
        schemaVersion: 'co-arising.domain-map/v2',
        system: 'short-drama-exam',
        boundedContexts: [
          { name: 'exam-monolith-bc', subdomains: ['exam', 'certification'] },
          { name: 'filing-service-bc', subdomains: ['filing'] },
        ],
        integrations: baseIntegrations,
      },
      dbFile: dbPath,
      outMd: mdPath,
      strictLineage: true,
    });
    assert.equal(monoReport.passed, true, JSON.stringify(monoReport.diagnostics, null, 2));
    assert.equal(monoReport.integrations.find(i => i.id === 'exam-to-cert').boundaryKind, 'same-bc');
    assert.equal(monoReport.integrations.find(i => i.id === 'cert-to-filing').boundaryKind, 'cross-bc');
    const md = readFileSync(mdPath, 'utf8');
    assert.ok(md.includes('subgraph exam_monolith_bc') && md.includes('flowchart LR'));

    // Verify 6-hop recursive SQLite traceFieldLineage from filing public-port all the way back to exam command param!
    const db = new DatabaseSync(dbPath);
    try {
      const trace = traceFieldLineage(db, 'filing:readmodel:public-filing-view.verifiedScore');
      assert.ok(
        trace.upstream.some(r => r.nodeId === 'exam:cmd:ExamAttempt.PassExam.score'),
        `expected full upstream trace to exam:cmd:ExamAttempt.PassExam.score, got ${JSON.stringify(trace.upstream)}`,
      );
      assert.ok(
        trace.downstream.some(r => r.nodeId === 'filing:public-port:FilingQueryPort.checkPublic'),
        `expected downstream trace to public port, got ${JSON.stringify(trace.downstream)}`,
      );
    } finally {
      db.close();
    }

    // Topology 2: Split certification into its own Microservice BC -> ZERO edits to any subdomain truth!
    const microReport = auditSystemLineageV2({
      canonicals: [exam.outFile, cert.outFile, filing.outFile],
      domainMap: {
        schemaVersion: 'co-arising.domain-map/v2',
        system: 'short-drama-exam',
        boundedContexts: [
          { name: 'exam-bc', subdomains: ['exam'] },
          { name: 'cert-service-bc', subdomains: ['certification'] },
          { name: 'filing-service-bc', subdomains: ['filing'] },
        ],
        integrations: baseIntegrations,
      },
      strictLineage: true,
    });
    assert.equal(microReport.passed, true);
    assert.equal(microReport.integrations.find(i => i.id === 'exam-to-cert').boundaryKind, 'cross-bc');
    assert.equal(microReport.integrations.find(i => i.id === 'cert-to-filing').boundaryKind, 'cross-bc');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('Multi-Subdomain Fail-Closed: recursive SQLite catches 6-hop cross-subdomain PII leak to public port & erasable immutable event, type mismatch, cycle, and CLI exit 2', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-multisub-neg-'));
  try {
    // Enable raw sensitivity: pii on exam.ExamPassed.holderRef AND erasureRequired on certification!
    const { exam, cert, filing } = buildThreeSubdomainSystem(workDir, {
      includePiiOnExam: true,
      certErasureRequired: true,
    });

    const badDomainMapPath = join(workDir, 'domain-map.yaml');
    writeFileSync(badDomainMapPath, `
schemaVersion: co-arising.domain-map/v2
system: short-drama-exam
boundedContexts:
  - name: bc-1
    subdomains: [exam, certification]
  - name: bc-2
    subdomains: [certification, ghost-sub]
integrations:
  - id: exam-to-cert
    upstreamSubdomain: exam
    upstreamEvent: ExamAttempt.ExamPassed
    downstreamSubdomain: certification
    downstreamTarget: Certificate.Issue
    fieldMappings:
      - from: score
        to: examScore
      - from: holderRef
        to: holderToken
  - id: cert-to-filing
    upstreamSubdomain: certification
    upstreamEvent: Certificate.CertificateIssued
    downstreamSubdomain: filing
    downstreamTarget: DramaFiling.GrantEligibility
    fieldMappings:
      - from: holderToken
        to: verifiedHolder
      - from: examScore
        to: verifiedScore
  - id: bad-cycle-and-mismatch
    upstreamSubdomain: filing
    upstreamEvent: DramaFiling.EligibilityGranted
    downstreamSubdomain: exam
    downstreamTarget: ExamAttempt.PassExam
    fieldMappings:
      - from: verifiedHolder
        to: score
      - from: missingField
        to: holderRef
`, 'utf8');

    const report = auditSystemLineageV2({
      canonicals: [exam.outFile, cert.outFile, filing.outFile],
      domainMapPath: badDomainMapPath,
      strictLineage: true,
    });
    assert.equal(report.passed, false);
    const errCodes = report.diagnostics.filter(d => d.severity === 'error').map(d => d.code);
    for (const expected of [
      'V2_SYSTEM_UNKNOWN_SUBDOMAIN',
      'V2_SYSTEM_DUPLICATE_SUBDOMAIN_HOSTING',
      'V2_SYSTEM_FIELD_TYPE_MISMATCH',
      'V2_SYSTEM_UNKNOWN_FIELD',
      'V2_SYSTEM_UNBOUND_DOWNSTREAM_PARAM',
      'V2_SYSTEM_CROSS_SUBDOMAIN_PII_LEAK',
      'V2_SYSTEM_SUBDOMAIN_CYCLE',
    ]) {
      assert.ok(errCodes.includes(expected), `expected ${expected} in ${JSON.stringify(errCodes)}`);
    }

    // Verify BOTH multi-hop PII leak reasons were caught!
    const leakReasons = report.piiLeaks.map(l => l.reason);
    assert.ok(leakReasons.includes('tainted-pii-reaches-public-surface'), `missing public surface leak: ${JSON.stringify(report.piiLeaks)}`);
    assert.ok(leakReasons.includes('cross-subdomain-pii-reaches-erasable-immutable-event'), `missing erasable event leak: ${JSON.stringify(report.piiLeaks)}`);

    // Verify CLI entrypoint returns exit 2 on failure
    let cliExit = 0;
    try {
      execFileSync(process.execPath, [
        CLI_BIN,
        'audit-system-lineage-v2',
        '--canonicals', `${exam.outFile},${cert.outFile},${filing.outFile}`,
        '--domain-map', badDomainMapPath,
        '--strict-lineage',
      ], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      cliExit = err.status;
    }
    assert.equal(cliExit, 2, 'audit-system-lineage-v2 CLI must exit 2 on hard failures');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
