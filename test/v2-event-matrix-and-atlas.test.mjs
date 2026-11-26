import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import {
  buildEventMatrixFromCanonical,
  extractEventMatrixFromIngestJson,
  extractEventMatrixFromV1Tree,
  renderEventFlowYamlSnippet,
} from '../lib/v2/event-matrix.mjs';
import { exportAtlasV2 } from '../lib/v2/atlas-viewer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const BIN = join(ROOT, 'bin', 'truthsrc.js');
const CANARY_DIR = join(ROOT, 'test', 'fixtures', 'canary', 'wealth_exam_canary');

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('EventFlow + Multi-Diagram Exporters + Unified Offline Atlas HTML on Canary (Problem + Solution Space)', () => {
  const work = makeTempDir('truthsrc-atlas-canary-');
  try {
    const signoffDir = join(work, 'signoff');
    const canonicalFile = join(work, 'canonical-v2.json');
    const res = compileCanonicalV2({
      structuresDir: join(CANARY_DIR, 'structures'),
      specsPath: join(CANARY_DIR, 'behaviors'),
      bindingsPath: join(CANARY_DIR, 'bindings'),
      outFile: canonicalFile,
      outSignoffDir: signoffDir,
    });
    assert.equal(res.passed, true, `Canary compile should pass: ${JSON.stringify(res.diagnostics)}`);
    assert.equal(res.canonical.structures.eventFlow.timelines.length, 2);
    assert.equal(res.canonical.structures.eventFlow.hotspots.length, 1);
    assert.equal(res.canonical.structures.aggregates[0].relations.length, 1);
    const dmMmd = readFileSync(join(signoffDir, 'diagrams', 'domain-model.mmd'), 'utf8');
    assert.match(dmMmd, /ExamBatch "1" --> "N" certification_Certificate/);

    // Check emitted signoff artifacts: event-matrix.md, story-map.csv, domain-map.cml, diagrams/*.mmd, atlas.html
    assert.equal(existsSync(join(signoffDir, 'event-matrix.md')), true);
    assert.equal(existsSync(join(signoffDir, 'story-map.csv')), true);
    assert.equal(existsSync(join(signoffDir, 'domain-map.cml')), true);
    assert.equal(existsSync(join(signoffDir, 'atlas.html')), true);
    assert.equal(existsSync(join(signoffDir, 'diagrams', 'event-matrix.mmd')), true);
    assert.equal(existsSync(join(signoffDir, 'diagrams', 'onion-architecture.mmd')), true);
    assert.equal(existsSync(join(signoffDir, 'diagrams', 'readside-topology.mmd')), true);
    assert.equal(existsSync(join(signoffDir, 'diagrams', 'authz-matrix.mmd')), true);
    assert.equal(existsSync(join(signoffDir, 'diagrams', 'testing-strategy.mmd')), true);

    const emMd = readFileSync(join(signoffDir, 'event-matrix.md'), 'utf8');
    assert.match(emMd, /BatchPublished/);
    assert.match(emMd, /BatchWithdrawn/);
    assert.match(emMd, /HS-withdraw-authority/);
    assert.match(emMd, /batch-summary-view/);

    const csv = readFileSync(join(signoffDir, 'story-map.csv'), 'utf8');
    assert.match(csv, /^Journey,Stage,Release,Persona,Story,/u);
    assert.match(csv, /ExamBatchJourney,PublishAndGovern,R1,Instructor,BatchLifecycle/);

    const cml = readFileSync(join(signoffDir, 'domain-map.cml'), 'utf8');
    assert.match(cml, /Domain /);
    assert.match(cml, /Subdomain /);
    assert.match(cml, /BoundedContext /);

    const atlasHtml = readFileSync(join(signoffDir, 'atlas.html'), 'utf8');
    assert.match(atlasHtml, /Content-Security-Policy/);
    assert.match(atlasHtml, /data-theme="light"/);
    assert.match(atlasHtml, /density-bar/);
    assert.match(atlasHtml, /buildSequenceSvg/);
    assert.match(atlasHtml, /fitToScreen/);
    assert.doesNotMatch(atlasHtml, /\/Users\//u, 'Atlas HTML must never leak local home paths');
    assert.doesNotMatch(atlasHtml, /https?:\/\/cdn\./u, 'Atlas HTML must be 100% offline with zero CDN links');
    assert.match(atlasHtml, /"space":"problem"/);
    assert.match(atlasHtml, /"space":"solution"/);
    assert.match(atlasHtml, /"id":"event-matrix"/);
    assert.match(atlasHtml, /"id":"story-map"/);
    assert.match(atlasHtml, /"id":"onion-architecture"/);
    assert.match(atlasHtml, /"id":"readside-topology"/);
    assert.match(atlasHtml, /"id":"testing-strategy"/);

    // Enriched EventMatrix model carries producer commands & read models
    const matrix = buildEventMatrixFromCanonical(res.canonical);
    const pubCell = matrix.cells.find(c => c.event === 'BatchPublished');
    assert.ok(pubCell);
    assert.equal(pubCell.pivotal, true);
    assert.ok(pubCell.producerCommands.includes('ExamBatch.PublishBatch'));
    assert.ok(pubCell.consumerReadModels.includes('batch-summary-view'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('EventFlow Fail-Closed Gates: unknown event, coordinate collision, blocking open hotspot, bad emotionScore, unplaced warning', () => {
  const work = makeTempDir('truthsrc-ef-neg-');
  try {
    mkdirSync(join(work, 'structures'), { recursive: true });
    mkdirSync(join(work, 'behaviors', 'domain'), { recursive: true });
    writeFileSync(join(work, 'structures', 'bad.yaml'), `
system: bad-ef
subdomain: exam
aggregates:
  - name: Ticket
    idField: id
    stateFields:
      - name: status
        type: String
        enum: [OPEN, CLOSED]
        default: OPEN
    commands:
      - name: Close
        produces: [TicketClosed]
        parameters: []
    events:
      - name: TicketClosed
        fields: []
      - name: TicketReopened
        fields: []
    relations:
      - target: GhostAggregate
        cardinality: "1:MANY"
        viaField: missingField
        meaning: "invalid relation"
journeys:
  - id: j1
    name: BadJourney
    stages:
      - name: S1
        emotionScore: 9
eventFlow:
  timelines:
    - id: t1
      name: Main
      events:
        - event: TicketClosed
          sequence: 0
          step: 0
        - event: GhostEvent
          sequence: 0
          step: 0
  hotspots:
    - id: HS-1
      question: Blocking open question
      linkedEvents: [GhostEvent]
      status: open
      blocking: true
    - id: HS-2
      question: Invalid status question
      status: weird-state
`, 'utf8');
    writeFileSync(join(work, 'behaviors', 'domain', 'close.ears'), `
slice Ticket.Close

rules:
  [ALREADY_CLOSED] IF ticket.status != "OPEN" THEN SHALL reject request with ALREADY_CLOSED
  [CLOSED]         WHILE ticket.status == "OPEN"
                   WHEN Close
                   SHALL transition ticket.status -> "CLOSED"
                     AND emit TicketClosed
`, 'utf8');

    const res = compileCanonicalV2({
      structuresDir: join(work, 'structures'),
      specsPath: join(work, 'behaviors'),
    });
    assert.equal(res.passed, false);
    const codes = new Set(res.diagnostics.map(d => d.code));
    assert.ok(codes.has('V2_EVENTFLOW_UNKNOWN_EVENT'), `missing V2_EVENTFLOW_UNKNOWN_EVENT in ${[...codes]}`);
    assert.ok(codes.has('V2_EVENTFLOW_COORDINATE_COLLISION'), `missing V2_EVENTFLOW_COORDINATE_COLLISION in ${[...codes]}`);
    assert.ok(codes.has('V2_EVENTFLOW_BLOCKING_HOTSPOT'), `missing V2_EVENTFLOW_BLOCKING_HOTSPOT in ${[...codes]}`);
    assert.ok(codes.has('V2_EVENTFLOW_INVALID_HOTSPOT'), `missing V2_EVENTFLOW_INVALID_HOTSPOT in ${[...codes]}`);
    assert.ok(codes.has('V2_JOURNEY_INVALID_EMOTION_SCORE'), `missing V2_JOURNEY_INVALID_EMOTION_SCORE in ${[...codes]}`);
    assert.ok(codes.has('V2_EVENTFLOW_UNPLACED_EVENT'), `missing V2_EVENTFLOW_UNPLACED_EVENT in ${[...codes]}`);
    assert.ok(codes.has('V2_AGGREGATE_RELATION_UNKNOWN_TARGET'), `missing V2_AGGREGATE_RELATION_UNKNOWN_TARGET in ${[...codes]}`);
    assert.ok(codes.has('V2_AGGREGATE_RELATION_INVALID_CARDINALITY'), `missing V2_AGGREGATE_RELATION_INVALID_CARDINALITY in ${[...codes]}`);
    assert.ok(codes.has('V2_AGGREGATE_RELATION_UNKNOWN_FIELD'), `missing V2_AGGREGATE_RELATION_UNKNOWN_FIELD in ${[...codes]}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('v1 Tree & .ingest JSON Recovery + Multi-Subdomain Atlas + CLI event-matrix-v2 & atlas-v2 E2E', () => {
  const work = makeTempDir('truthsrc-v1-recovery-');
  try {
    // 1. Synthetic v1 tree where decompose moved event-es-* into aggregates/*/notes/ leaving only question-es-* in inbox/eventStorming/
    const v1Tree = join(work, 'v1-tree');
    mkdirSync(join(v1Tree, 'inbox', 'eventStorming'), { recursive: true });
    mkdirSync(join(v1Tree, 'contexts', 'main', 'aggregates', 'tenant', 'notes'), { recursive: true });
    mkdirSync(join(v1Tree, 'contexts', 'main', 'aggregates', 'project', 'notes'), { recursive: true });

    writeFileSync(join(v1Tree, 'inbox', 'eventStorming', 'question-es-1.yaml'), `
kind: note
type: question
name: 观察者能否参与裁决？
origin:
  stage: eventStorming
  board: board1
  seq: 34
payload:
  type: question
  name: 观察者能否参与裁决？
  stage: eventStorming
  description: 领域裁决：观察者仅 ViewOnly，不参与裁决。
  links: [event:ProjectInitiated]
`, 'utf8');

    writeFileSync(join(v1Tree, 'contexts', 'main', 'aggregates', 'tenant', 'notes', 'event-es-tenant-onboarded-1.yaml'), `
kind: note
type: event
name: TenantOnboarded
origin:
  stage: eventStorming
  board: board1
  seq: 1
payload:
  type: event
  name: TenantOnboarded
  stage: eventStorming
  description: 组织完成入驻
  info:
    timeline: 组织入驻
    sequence: 0
    step: 0
    pivotal: true
  links: [aggregate:Tenant]
`, 'utf8');

    writeFileSync(join(v1Tree, 'contexts', 'main', 'aggregates', 'project', 'notes', 'event-es-project-initiated-2.yaml'), `
kind: note
type: event
name: ProjectInitiated
origin:
  stage: eventStorming
  board: board1
  seq: 2
payload:
  type: event
  name: ProjectInitiated
  stage: eventStorming
  description: 发起领域建模专项
  info:
    timeline: 专项立项
    sequence: 1
    step: 0
    pivotal: true
  links: [aggregate:Project]
`, 'utf8');

    const recovered = extractEventMatrixFromV1Tree(v1Tree);
    assert.equal(recovered.stats.eventCount, 2);
    assert.equal(recovered.stats.recoveredFromAggregates, 2);
    assert.equal(recovered.stats.timelineCount, 2);
    assert.equal(recovered.stats.pivotalCount, 2);
    assert.equal(recovered.stats.hotspotCount, 1);
    assert.equal(recovered.hotspots[0].status, 'resolved');

    const snippet = renderEventFlowYamlSnippet(recovered);
    assert.match(snippet, /eventFlow:/);
    assert.match(snippet, /Tenant\.TenantOnboarded/);
    assert.match(snippet, /pivotal: true/);

    // 2. Also test .ingest/*.json extraction
    const ingestFile = join(work, 'sample-ingest.json');
    writeFileSync(ingestFile, JSON.stringify({
      workshop: 'sample-metarch',
      sessions: [{
        session: 'eventStorming',
        scopes: [{
          scope: 'board1',
          notes: [
            { type: 'event', name: 'TenantOnboarded', description: '入驻', links: ['aggregate:Tenant'], info: { timeline: '组织入驻', sequence: 0, step: 0, pivotal: true } },
            { type: 'question', name: '是否支持多租户？', description: '待定', links: ['event:TenantOnboarded'], info: {} },
          ],
        }],
      }],
    }), 'utf8');
    const fromIngest = extractEventMatrixFromIngestJson(ingestFile);
    assert.equal(fromIngest.stats.eventCount, 1);
    assert.equal(fromIngest.stats.hotspotCount, 1);
    assert.equal(fromIngest.stats.openHotspotCount, 1);

    // 3. CLI E2E: truthsrc event-matrix-v2 + truthsrc atlas-v2
    const emOutMd = join(work, 'out', 'event-matrix.md');
    const emOutYaml = join(work, 'out', 'event-flow.yaml');
    const emRun = spawnSync(process.execPath, [
      BIN, 'event-matrix-v2', '--v1-tree', v1Tree, '--out-md', emOutMd, '--out-yaml', emOutYaml,
    ], { encoding: 'utf8' });
    assert.equal(emRun.status, 0, `event-matrix-v2 failed: ${emRun.stderr}`);
    assert.equal(existsSync(emOutMd), true);
    assert.equal(existsSync(emOutYaml), true);

    const atlasHtmlOut = join(work, 'out', 'v1-atlas.html');
    const atlasDirOut = join(work, 'out', 'bundle');
    const atlasRun = spawnSync(process.execPath, [
      BIN, 'atlas-v2', '--v1-tree', v1Tree, '--out', atlasHtmlOut, '--out-dir', atlasDirOut,
    ], { encoding: 'utf8' });
    assert.equal(atlasRun.status, 0, `atlas-v2 failed: ${atlasRun.stderr}`);
    assert.equal(existsSync(atlasHtmlOut), true);
    assert.equal(existsSync(join(atlasDirOut, 'atlas-manifest.json')), true);

    // 4. Multi-subdomain Atlas export (DomainMap + BoundedContexts Deployment Topology + ContextMapper .cml)
    const canaryOut = join(work, 'canary.canonical.json');
    const cRes = compileCanonicalV2({
      structuresDir: join(CANARY_DIR, 'structures'),
      specsPath: join(CANARY_DIR, 'behaviors'),
      bindingsPath: join(CANARY_DIR, 'bindings'),
      outFile: canaryOut,
    });
    assert.equal(cRes.passed, true);

    const multiHtml = join(work, 'out', 'multi-atlas.html');
    const multiDir = join(work, 'out', 'multi-bundle');
    const multiRes = exportAtlasV2({
      canonicalFile: canaryOut,
      outFile: multiHtml,
      outDir: multiDir,
    });
    assert.equal(multiRes.meta.problemDiagramCount, 6);
    assert.equal(multiRes.meta.solutionDiagramCount, 5);
    assert.equal(multiRes.meta.totalDiagramCount, 11);
    assert.equal(existsSync(join(multiDir, 'domain-map.cml')), true);
    assert.equal(existsSync(join(multiDir, 'story-map.csv')), true);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
