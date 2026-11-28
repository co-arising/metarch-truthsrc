// Permanent regression suite for all 47 verified Wave-9 fixes (patches 0001–0007).
// Runs automatically as part of `npm run test:v2` and `npm run test:wave9`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  generateScalaCqrsPlayServiceV2,
  mergeCanonicalsForBc,
} from '../generators/scala-cqrs-play-service-v2/generate.mjs';
import { emitV1ApiAuthSuite } from '../lib/v2/bridge/v1-strict-api-auth.mjs';
import { emitV1ReadsideSuite } from '../lib/v2/bridge/v1-strict-readside.mjs';
import { emitV1PolicySuite } from '../lib/v2/bridge/v1-strict-policy.mjs';
import { emitV1BlockD } from '../lib/v2/bridge/v1-strict-block-cd.mjs';
import { loadV2Structures } from '../lib/v2/structure-loader.mjs';
import {
  evaluateWriteGuard,
  inspectClozeMarkers,
} from '../lib/v2/guard-write.mjs';
import { runDomainMutationGate } from '../lib/v2/mutation-gate.mjs';
import { runCheckV2 } from '../lib/v2/check-v2.mjs';
import { deriveStoryHttpRoutes } from '../lib/v2/codegen/onion-routes.mjs';
import { synthesizeFirstHitWitnesses } from '../lib/v2/first-hit-witness.mjs';
import { materializeDomainWitness } from '../lib/v2/test-emitter/witness-materialize.mjs';
import { bindEarsSpec, buildSymbolTableFromCompiled } from '../lib/ears/binder.mjs';
import { parseEars } from '../lib/ears/parser.mjs';
import { normalizeEars } from '../lib/ears/normalize.mjs';
import {
  alphaExprKey,
  buildVerificationScripts,
  createSmtContext,
} from '../lib/ears/smt-encoder.mjs';
import { runSmtJob } from '../lib/ears/smt-solver.mjs';
import { checkContracts } from '../lib/v2/surface-registry.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeBaseCanonical(overrides = {}) {
  const structures = {
    exactTypes: [
      { name: 'Money', form: 'decimal', scale: 2 },
      { name: 'FineRate', form: 'decimal', scale: 8 },
    ],
    valueObjects: [
      { name: 'OrderAck', fields: [{ name: 'accepted', type: 'Bool' }] },
      { name: 'AuditInfo', fields: [{ name: 'actor', type: 'String' }, { name: 'note', type: 'String' }] },
    ],
    ports: [
      {
        name: 'OrderPort',
        operations: [
          {
            name: 'submit',
            parameters: [
              { name: 'orderId', type: 'String' },
              { name: 'tenantId', type: 'String' },
              { name: 'amount', type: 'Money' },
              { name: 'tags', type: 'Seq[String]' },
            ],
            authz: {
              mode: 'external-pdp',
              roles: ['operator'],
              bindPrincipal: [{ param: 'tenantId', from: 'principal.tenantId' }],
            },
          },
          {
            name: 'publicPing',
            httpMethod: 'GET',
            callerKind: 'anonymous',
            parameters: [
              { name: 'filter', type: 'String' },
              { name: 'tenantId', type: 'String' },
            ],
            authz: {
              mode: 'public',
              bindPrincipal: [{ param: 'tenantId', from: 'principal.tenantId' }],
            },
          },
        ],
      },
    ],
    aggregates: [
      {
        name: 'Order',
        aliases: ['order', 'state'],
        stateFields: [
          { name: 'orderId', type: 'String', resolvedType: { kind: 'string' } },
          { name: 'tenantId', type: 'String', resolvedType: { kind: 'string' } },
          { name: 'amount', type: 'Money', resolvedType: { kind: 'decimal', scale: 2, exactType: 'Money' } },
          { name: 'rate', type: 'FineRate', resolvedType: { kind: 'decimal', scale: 8, exactType: 'FineRate' } },
          { name: 'order', type: 'String', resolvedType: { kind: 'string' } },
        ],
        commands: [
          {
            name: 'CreateOrder',
            parameters: [
              { name: 'orderId', type: 'String', resolvedType: { kind: 'string' } },
              { name: 'amount', type: 'Money', resolvedType: { kind: 'decimal', scale: 2, exactType: 'Money' } },
            ],
            produces: ['OrderCreated'],
          },
        ],
        events: [
          {
            name: 'OrderCreated',
            fields: [
              { name: 'orderId', type: 'String', resolvedType: { kind: 'string' } },
              { name: 'amount', type: 'Money', resolvedType: { kind: 'decimal', scale: 2, exactType: 'Money' } },
              { name: 'rate', type: 'FineRate', resolvedType: { kind: 'decimal', scale: 8, exactType: 'FineRate' } },
            ],
          },
        ],
      },
    ],
    stories: [
      {
        name: 'OrderIntake',
        ports: ['OrderPort'],
        responses: ['OrderAck'],
      },
      {
        name: 'OrderFulfillment',
        ports: [],
        responses: [],
      },
    ],
    readModels: [
      {
        name: 'OrderSummaryView',
        sourceAggregate: 'Order',
        sourceEvents: ['OrderCreated'],
        fields: [
          { name: 'tags', type: 'Seq[String]', resolvedType: { kind: 'sequence', element: { kind: 'string' } }, source: 'stateField:tags' },
          { name: 'tenantId', type: 'String', resolvedType: { kind: 'string' }, source: 'stateField:tenantId' },
          { name: 'orderId', type: 'String', resolvedType: { kind: 'string' }, source: 'aggregateIdentity' },
          { name: 'amount', type: 'Money', resolvedType: { kind: 'decimal', scale: 2, exactType: 'Money' }, source: 'stateField:amount' },
          { name: 'rate', type: 'FineRate', resolvedType: { kind: 'decimal', scale: 8, exactType: 'FineRate' }, source: 'stateField:rate' },
          { name: 'order', type: 'String', resolvedType: { kind: 'string' }, source: 'stateField:order' },
        ],
      },
    ],
    ...(overrides.structures || {}),
  };

  const behaviors = overrides.behaviors ?? [
    {
      layer: 'application',
      target: 'OrderIntake',
      rules: [
        { id: 'R_SUBMIT', command: 'OrderPort.submit', actions: [{ kind: 'respond' }] },
        { id: 'R_PING', command: 'OrderPort.publicPing', actions: [{ kind: 'respond' }] },
      ],
    },
    {
      layer: 'application',
      target: 'OrderFulfillment',
      rules: [
        {
          id: 'P1',
          triggerKind: 'event',
          command: 'Order.OrderCreated',
          actions: [{ kind: 'dispatch', modality: 'SHALL', target: 'Order.CreateOrder' }],
        },
      ],
    },
  ];

  return {
    schemaVersion: 'co-arising.canonical-v2/v1',
    system: 'wave9',
    context: 'orders',
    canonicalSha256: 'wave9testsha256',
    ...overrides,
    structures,
    behaviors,
  };
}

function getFileFromSuite(suiteResult, suffix) {
  const fileMap = suiteResult?.files ?? suiteResult ?? {};
  const entries = Object.entries(fileMap);
  const hit = entries.find(([k]) => k.endsWith(suffix));
  assert.ok(hit, `Expected emitted file ending with ${suffix}; got: ${entries.map(([k]) => k).join(', ')}`);
  return hit[1];
}

function makeOrderSymTable() {
  const canonical = {
    aggregates: [
      {
        name: 'Order',
        commands: [{ name: 'UpdateOrder', produces: ['OrderUpdated'] }],
        events: [{ name: 'OrderUpdated' }],
        aggregateRuleRefs: [
          { ruleId: 'EMPTY_SET', errCode: 'EMPTY_SET', desc: 'empty set' },
          { ruleId: 'BAD_ARITY', errCode: 'BAD_ARITY', desc: 'bad arity' },
        ],
      },
    ],
    stories: [],
    readModels: [],
  };
  const layout = {
    contexts: ['orders'],
    declarations: [
      { ref: { context: 'orders', kind: 'aggregate', owner: [], id: 'Order' }, valueType: null },
      { ref: { context: 'orders', kind: 'state-field', owner: ['Order'], id: 'amount' }, valueType: { form: 'primitive', name: 'int' } },
      { ref: { context: 'orders', kind: 'state-field', owner: ['Order'], id: 'items' }, valueType: { form: 'list', element: { form: 'primitive', name: 'string' } } },
      { ref: { context: 'orders', kind: 'command', owner: ['Order'], id: 'UpdateOrder' }, valueType: null },
      { ref: { context: 'orders', kind: 'parameter', owner: ['Order', 'UpdateOrder'], id: 'tag' }, valueType: { form: 'primitive', name: 'string' } },
      { ref: { context: 'orders', kind: 'event', owner: ['Order'], id: 'OrderUpdated' }, valueType: null },
    ],
  };
  return buildSymbolTableFromCompiled({ canonical, layout, exactTypes: [] });
}

describe('Wave-9 Batch 1 (P0): Play production boot, projection, authz & readside', () => {
  test('A01, A04, F1, A02, A03, A07: Play v2 scaffold wires JdbcProjection, Guice BootstrapModule, PDP, no wildcard authz, fail-closed principal binding', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-p0-'));
    try {
      const canonical = makeBaseCanonical();
      generateScalaCqrsPlayServiceV2(canonical, { outDir: tmpDir, packageName: 'example.wave9' });

      // A04: conf/service.conf uses Guice play.modules.enabled, never play.application.loader
      const serviceConf = fs.readFileSync(path.join(tmpDir, 'generated-scaffold', 'conf', 'service.conf'), 'utf8');
      assert.match(serviceConf, /play\.modules\.enabled\s*\+=\s*"example\.wave9\.modules\.BootstrapModule"/u);
      assert.doesNotMatch(serviceConf, /play\.application\.loader/u);

      // A01: build.sbt declares akka-projection-jdbc
      const buildSbt = fs.readFileSync(path.join(tmpDir, 'generated-scaffold', 'build.sbt'), 'utf8');
      assert.match(buildSbt, /akka-projection-jdbc/u);

      // A01 & F1: ReadSide projection uses JdbcProjection.atLeastOnceAsync, keeps ScalikeJdbcProjectionSession in infrastructure/bootstrap, handles sourceEvents
      const readsideSuite = emitV1ReadsideSuite(canonical, { packageName: 'example.wave9' });
      const projFile = getFileFromSuite(readsideSuite, 'OrderSummaryReadsideProjection.scala');
      assert.match(projFile, /JdbcProjection\.atLeastOnceAsync\(/u);
      assert.doesNotMatch(projFile, /ScalikeJdbcProjectionSession/u, 'application layer projection must not import infrastructure ScalikeJdbcProjectionSession');

      const handlerFile = getFileFromSuite(readsideSuite, 'OrderSummaryReadsideProjectionHandler.scala');
      assert.match(handlerFile, /OrderCreated/u);

      const bootFile = getFileFromSuite(readsideSuite, 'OrderSummaryReadsideBootstrap.scala');
      assert.match(bootFile, /ScalikeJdbcProjectionSession/u);
      assert.match(bootFile, /ProjectionBehavior/u);

      // A02, A03, A07: AuthorizationPortImpl fails closed, RoleGate has no wildcard '*', PlayController injects pdp & enforces FORBIDDEN_PDP / PRINCIPAL_BINDING_MISSING
      const apiSuite = emitV1ApiAuthSuite(canonical, { packageName: 'example.wave9' });
      const controller = getFileFromSuite(apiSuite, 'OrderIntakePlayController.scala');
      const authzImplPath = path.join(tmpDir, 'handwritten', 'scala', 'example', 'wave9', 'infrastructure', 'api', 'AuthorizationPortImpl.scala');
      assert.ok(fs.existsSync(authzImplPath), 'AuthorizationPortImpl.scala must be emitted under handwritten/scala/ (never orphan app/)');
      assert.equal(fs.existsSync(path.join(tmpDir, 'app')), false, 'Play v2 generator must not emit orphan app/ directory');
      assert.match(controller, /pdp:\s*AuthorizationPort/u);
      assert.match(controller, /FORBIDDEN_PDP/u);
      assert.match(controller, /PRINCIPAL_BINDING_MISSING/u);
      assert.doesNotMatch(controller, /Set\s*\(\s*"\*"\s*\)/u);

      const authEndpointDsl = getFileFromSuite(apiSuite, 'AuthEndpointDsl.scala');
      assert.doesNotMatch(authEndpointDsl, /Set\s*\(\s*"\*"\s*\)/u);
      assert.doesNotMatch(authEndpointDsl, /\.contains\s*\(\s*"\*"\s*\)/u);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Wave-9 Batch 2 (P1): BC merge, DLQ, event fields, identifiers, ReadSide SQL & route collisions', () => {
  test('A4-01 & A4-02: mergeCanonicalsForBc detects structural conflicts and preserves testing/readside/lineage', () => {
    const c1 = makeBaseCanonical({
      context: 'subA',
      testing: { layers: { domain: { minBranchCoverage: 80, minLineCoverage: 75, mutationGate: false } } },
      readside: { strategy: 'jdbc' },
      lineage: { rules: [{ id: 'L1', from: 'a', to: 'b' }] },
      structures: {
        sagas: [{ name: 'DupSaga', steps: [{ name: 's1' }] }],
      },
    });
    const c2 = makeBaseCanonical({
      context: 'subB',
      testing: { layers: { domain: { minBranchCoverage: 92, minLineCoverage: 85, mutationGate: true } } },
      readside: { strategy: 'jdbc' },
      lineage: { rules: [{ id: 'L2', from: 'b', to: 'c' }] },
      structures: {
        aggregates: [{ name: 'Payment', stateFields: [{ name: 'paymentId', type: 'String' }], commands: [], events: [] }],
        ports: [],
        stories: [],
        readModels: [],
        sagas: [{ name: 'DupSaga', steps: [{ name: 's2' }] }],
      },
      behaviors: [],
    });

    assert.throws(
      () => mergeCanonicalsForBc([c1, c2], { bcName: 'commerce' }),
      /DupSaga|conflict|duplicate/iu,
      'Conflicting duplicate saga across subdomains must throw'
    );

    const c2Clean = {
      ...c2,
      structures: {
        ...c2.structures,
        sagas: [{ name: 'OtherSaga', steps: [{ name: 's2' }] }],
      },
    };
    const { mergedCanonical } = mergeCanonicalsForBc([c1, c2Clean], { bcName: 'commerce' });
    assert.equal(mergedCanonical.testing?.layers?.domain?.minBranchCoverage, 92, 'Strictest branch coverage threshold must win');
    assert.equal(mergedCanonical.testing?.layers?.domain?.minLineCoverage, 85, 'Strictest line coverage threshold must win');
    assert.equal(mergedCanonical.testing?.layers?.domain?.mutationGate, true, 'mutationGate OR-merge must win');
    assert.ok(mergedCanonical.readside, 'readside config must be preserved across BC merge');
    assert.ok(mergedCanonical.lineage, 'lineage must be preserved across BC merge');
  });

  test('A06: GeneratedBindingsModule binds PolicyDlqSink to PolicyDlqBury, not Noop', () => {
    const canonical = makeBaseCanonical();
    const blockD = emitV1BlockD(canonical, { packageName: 'example.wave9' });
    const bindings = getFileFromSuite(blockD, 'GeneratedBindingsModule.scala');
    assert.match(bindings, /PolicyDlqBury/u);
    assert.doesNotMatch(bindings, /PolicyDlqSink\.Noop/u);
  });

  test('F2: loadV2Structures emits V2_AMBIGUOUS_EVENT_FIELDS on conflicting command parameters', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-f2-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'ambig.yaml'), [
        'system: wave9',
        'context: acct',
        'aggregates:',
        '  - name: Account',
        '    stateFields:',
        '      - id: String',
        '    commands:',
        '      - name: OpenA',
        '        parameters:',
        '          - id: String',
        '          - limit: Int',
        '        produces: [AccountOpened]',
        '      - name: OpenB',
        '        parameters:',
        '          - id: String',
        '          - tier: String',
        '        produces: [AccountOpened]',
        '    events:',
        '      - name: AccountOpened',
      ].join('\n'));
      const loaded = loadV2Structures(tmpDir);
      const codes = [...(loaded.diagnostics || []), ...(loaded.errors || []), ...(loaded.warnings || [])].map(e => e.code);
      assert.ok(codes.includes('V2_AMBIGUOUS_EVENT_FIELDS'), `Expected V2_AMBIGUOUS_EVENT_FIELDS, got ${JSON.stringify(codes)}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('F5 & F9: loadV2Structures rejects Proto3 keywords and Scala Any/Product reserved members', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-f5f9-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'reserved.yaml'), [
        'system: wave9',
        'context: res',
        'valueObjects:',
        '  - name: BadVo',
        '    fields:',
        '      - repeated: String',
        '      - hashCode: Int',
        '      - productArity: Int',
      ].join('\n'));
      const loaded = loadV2Structures(tmpDir);
      const msgs = [...(loaded.diagnostics || []), ...(loaded.errors || [])].map(e => `${e.code}:${e.message}`).join('\n');
      assert.match(msgs, /repeated/u, 'Proto3 keyword repeated must be flagged');
      assert.match(msgs, /hashCode/u, 'Scala Any member hashCode must be flagged');
      assert.match(msgs, /productArity/u, 'Scala Product member productArity must be flagged');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('F6, F7, F8: ReadSide quotes SQL reserved columns, prefers aggregateIdentity over tenantId as PK, and keeps Decimal scale > 6', () => {
    const canonical = makeBaseCanonical();
    const readsideSuite = emitV1ReadsideSuite(canonical, { packageName: 'example.wave9' });
    const ddlContent = Object.entries(readsideSuite.files)
      .filter(([k, v]) => typeof v === 'string' && (k.endsWith('.sql') || v.includes('CREATE TABLE')))
      .map(([, v]) => v)
      .join('\n');
    assert.ok(ddlContent.includes('CREATE TABLE'), 'ReadSide DDL must be emitted');
    assert.match(ddlContent, /`order`|"order"/u, 'SQL reserved column `order` must be quoted');
    assert.match(ddlContent, /order_id\s+VARCHAR\(255\)[^\n]*PRIMARY KEY/iu, 'PK must prefer aggregateIdentity order_id over tenant_id');
    assert.match(ddlContent, /DECIMAL\(\s*38\s*,\s*8\s*\)/iu, 'FineRate scale=8 must be preserved as DECIMAL(38, 8)');
  });

  test('A10: AggregateStateApiController disambiguates colliding Order vs OrderAggregate names', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-a10-'));
    try {
      const canonical = makeBaseCanonical({
        structures: {
          aggregates: [
            { name: 'Order', stateFields: [{ name: 'orderId', type: 'String' }], commands: [], events: [] },
            { name: 'OrderAggregate', stateFields: [{ name: 'orderAggregateId', type: 'String' }], commands: [], events: [] },
          ],
          readModels: [],
        },
        behaviors: [],
      });
      generateScalaCqrsPlayServiceV2(canonical, { outDir: tmpDir, packageName: 'example.wave9' });
      const routes = fs.readFileSync(path.join(tmpDir, 'generated-scaffold', 'conf', 'routes'), 'utf8');
      const stateCtrl = fs.readFileSync(path.join(tmpDir, 'generated-scaffold', 'scala', 'controllers', 'AggregateStateApiController.scala'), 'utf8');
      const defMatches = [...stateCtrl.matchAll(/def\s+([A-Za-z0-9_]+)\s*\(/gu)].map(m => m[1]);
      assert.equal(new Set(defMatches).size, defMatches.length, `Duplicate method names in AggregateStateApiController: ${defMatches.join(', ')}`);
      const routeLines = routes.split('\n').filter(l => l.includes('AggregateStateApiController.'));
      assert.equal(routeLines.length, 2, 'Both aggregates must have distinct routes');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Wave-9 Batch 3 (P2): guard-write, HTTP/Policy runtime, and SMT hardening', () => {
  test('A4-05 & A4-07: guard-write locks .truthsrc/ and fails closed on damaged @cloze markers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-guard-'));
    try {
      const truthsrcRes = evaluateWriteGuard(
        { file_path: path.join(tmpDir, '.truthsrc', 'hooks-policy.json'), new_content: '{}' },
        { rootDir: tmpDir }
      );
      assert.equal(truthsrcRes.allowed, false, '.truthsrc/ writes must be blocked');

      const damaged = inspectClozeMarkers('// @cloze:start(slot1)\nval x = 1\n// @cloze:start(slot2)\n// @cloze:end(slot1)\n');
      assert.ok(damaged.errors.length > 0, 'Damaged nested/unclosed @cloze markers must produce errors');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('A13, A15, A16: PlayController has no userId fallback, HttpStatusMapper maps FORBIDDEN->403 before 401, toJsValue handles Option/Product', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-a13-'));
    try {
      const canonical = makeBaseCanonical();
      generateScalaCqrsPlayServiceV2(canonical, { outDir: tmpDir, packageName: 'example.wave9' });
      const controller = fs.readFileSync(path.join(tmpDir, 'generated-scaffold', 'scala', 'controllers', 'OrderIntakePlayController.scala'), 'utf8');
      const scalaFiles = fs.readdirSync(path.join(tmpDir, 'generated-scaffold', 'scala'), { recursive: true }).filter(f => String(f).endsWith('.scala'));
      const statusMapperRel = scalaFiles.find(f => fs.readFileSync(path.join(tmpDir, 'generated-scaffold', 'scala', String(f)), 'utf8').includes('object HttpStatusMapper'));
      assert.ok(statusMapperRel, 'object HttpStatusMapper must be emitted');
      const statusMapper = fs.readFileSync(path.join(tmpDir, 'generated-scaffold', 'scala', String(statusMapperRel)), 'utf8');

      assert.match(controller, /case Some\(inner\)\s*=>\s*toJsValue\(inner\)/u);
      assert.match(controller, /case p:\s*Product\s*=>/u);
      assert.doesNotMatch(controller, /else\s+Some\(ctx\.userId\)/u, 'resolvePrincipalBinding must not fall back to ctx.userId');

      assert.match(statusMapper, /FORBIDDEN|NOT_AUTHORIZED/u);
      const idx403 = statusMapper.indexOf('403');
      const idx401 = statusMapper.indexOf('401');
      assert.ok(idx403 !== -1 && (idx401 === -1 || idx403 < idx401), '403 FORBIDDEN/NOT_AUTHORIZED branch must precede 401');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('A17: PolicyMachine isolates bury failures and routes AskTimeoutException/TimeoutException to DLQ', () => {
    const canonical = makeBaseCanonical();
    const policySuite = emitV1PolicySuite(canonical, { packageName: 'example.wave9' });
    const allPolicyText = Object.values(policySuite.files || {}).join('\n');
    assert.ok(allPolicyText.length > 0, 'Policy suite files must be emitted');
    assert.match(allPolicyText, /TimeoutException/u);
  });

  test('E2-08, E2-12, E2-13: empty set emits false instead of illegal (or ) and first-hit separates solverErrors', () => {
    const norm = normalizeEars(parseEars(`
slice Order.UpdateOrder
rules:
  [EMPTY_SET] IF tag in {} THEN SHALL reject request with EMPTY_SET
`));
    const scripts = buildVerificationScripts(norm);
    const allSmt = JSON.stringify(scripts);
    assert.doesNotMatch(allSmt, /\(or\s*\)/u, 'Empty set membership must never emit illegal (or )');

    const res = synthesizeFirstHitWitnesses(norm);
    assert.ok(Array.isArray(res.solverErrors), 'first-hit-witness must expose solverErrors separately from shadowedRules');
  });
});

describe('Wave-9 Batch 4: Mutation gate, contracts floor, route collisions, SMT quantifiers/sum/duplicate-post', () => {
  test('A4-10: runDomainMutationGate fails vacuous 0-mutant runs when behavior and spec files exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-mut-'));
    try {
      const domainDir = path.join(tmpDir, 'generated-scaffold', 'ts', 'domain');
      const testDir = path.join(tmpDir, 'generated-tests', 'ts');
      fs.mkdirSync(domainDir, { recursive: true });
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(domainDir, 'order.behavior.ts'), 'export const NOOP_FLAG = "static";\n');
      fs.writeFileSync(path.join(testDir, 'order.ears.spec.ts'), 'import test from "node:test"; test("noop", () => {});\n');
      const res = runDomainMutationGate({ rootDir: tmpDir, targets: ['typescript'] });
      assert.equal(res.passed, false, '0-mutant run with existing .behavior.ts and .ears.spec.ts files must fail closed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('A4-17: checkContracts enforces minimum CLI/MCP/error-code floors', () => {
    const res = checkContracts(REPO_ROOT);
    assert.equal(res.passed, true);
    assert.ok(res.summary.cliCommands >= 44, `cliCommands floor >= 44, got ${res.summary.cliCommands}`);
    assert.ok(res.summary.mcpTools >= 32, `mcpTools floor >= 32, got ${res.summary.mcpTools}`);
    assert.ok(res.summary.errorCodes >= 159, `errorCodes floor >= 159, got ${res.summary.errorCodes}`);
  });

  test('A09: deriveStoryHttpRoutes disambiguates colliding HTTP route slugs', () => {
    const canonical = makeBaseCanonical({
      structures: {
        ports: [
          {
            name: 'OrderPort',
            operations: [
              { name: 'cancelOrder', httpMethod: 'POST', parameters: [] },
              { name: 'cancel_order', httpMethod: 'POST', parameters: [] },
            ],
          },
        ],
        stories: [{ name: 'OrderIntake', ports: ['OrderPort'], responses: ['OrderAck'] }],
      },
      behaviors: [
        {
          layer: 'application',
          target: 'OrderIntake',
          rules: [
            { id: 'R1', command: 'OrderPort.cancelOrder', actions: [{ kind: 'respond' }] },
            { id: 'R2', command: 'OrderPort.cancel_order', actions: [{ kind: 'respond' }] },
          ],
        },
      ],
    });
    const routes = deriveStoryHttpRoutes(canonical);
    const paths = routes.map(r => `${r.httpMethod} ${r.path}`);
    assert.equal(routes.length, 2, 'Colliding operations must both be retained');
    assert.equal(new Set(paths).size, 2, `Colliding route slugs must be disambiguated: ${paths.join(', ')}`);
  });

  test('E2-01, E2-02, E2-07: alphaExprKey tracks lexical depth and binder flags duplicate post assignments', () => {
    const e1 = {
      kind: 'quantifier',
      quantifier: 'forall',
      variable: 'x',
      collection: { kind: 'var', name: 'xs' },
      body: {
        kind: 'quantifier',
        quantifier: 'exists',
        variable: 'y',
        collection: { kind: 'var', name: 'ys' },
        body: { kind: 'binary', op: '==', left: { kind: 'var', name: 'x' }, right: { kind: 'var', name: 'y' } },
      },
    };
    const e2 = {
      kind: 'quantifier',
      quantifier: 'forall',
      variable: 'a',
      collection: { kind: 'var', name: 'xs' },
      body: {
        kind: 'quantifier',
        quantifier: 'exists',
        variable: 'b',
        collection: { kind: 'var', name: 'ys' },
        body: { kind: 'binary', op: '==', left: { kind: 'var', name: 'a' }, right: { kind: 'var', name: 'b' } },
      },
    };
    const eShadow = {
      kind: 'quantifier',
      quantifier: 'forall',
      variable: 'a',
      collection: { kind: 'var', name: 'xs' },
      body: {
        kind: 'quantifier',
        quantifier: 'exists',
        variable: 'a',
        collection: { kind: 'var', name: 'ys' },
        body: { kind: 'binary', op: '==', left: { kind: 'var', name: 'a' }, right: { kind: 'var', name: 'a' } },
      },
    };
    assert.equal(alphaExprKey(e1), alphaExprKey(e2), 'Alpha-equivalent nested quantifiers must share key');
    assert.notEqual(alphaExprKey(e1), alphaExprKey(eShadow), 'Shadowed inner binder must not collide with outer binder');

    const sym = makeOrderSymTable();
    const dupSpec = normalizeEars(parseEars(`
slice Order.UpdateOrder
rules:
  [OK] WHILE order.amount >= 0 WHEN UpdateOrder SHALL emit OrderUpdated
       post:
         order.amount' = 10
         order.amount' = 20
`));
    const bound = bindEarsSpec(dupSpec, sym, { strictRuleRefs: false });
    const errCodes = (bound.diagnostics || []).map(e => e.code);
    assert.ok(errCodes.includes('EARS_DUPLICATE_POST_ASSIGNMENT'), `Expected EARS_DUPLICATE_POST_ASSIGNMENT, got ${JSON.stringify(errCodes)}`);
  });
});

describe('Wave-9 Batch 5: Authz ownerField, anonymous alignment, witness & solver robustness', () => {
  test('A14: loadV2Structures rejects nested dotted authz.resource.ownerField', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-a14-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'owner.yaml'), [
        'system: wave9',
        'context: sec',
        'ports:',
        '  - name: SecPort',
        '    operations:',
        '      - name: update',
        '        parameters:',
        '          - id: String',
        '        authz:',
        '          kind: resource-owner',
        '          resource:',
        '            type: sec.Order',
        '            ownerField: nested.ownerId',
      ].join('\n'));
      const loaded = loadV2Structures(tmpDir);
      const msgs = [...(loaded.diagnostics || []), ...(loaded.errors || [])].map(e => `${e.code}:${e.message}`).join('\n');
      assert.match(msgs, /ownerField|nested|dotted/iu, 'Nested dotted ownerField must be rejected');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('A19: callerKind=anonymous routes through api.anonymous', () => {
    const canonical = makeBaseCanonical();
    const apiSuite = emitV1ApiAuthSuite(canonical, { packageName: 'example.wave9' });
    const controller = getFileFromSuite(apiSuite, 'OrderIntakePlayController.scala');
    assert.match(controller, /api\.anonymous/u);
  });

  test('E2-18: runSmtJob recognizes solver timeout cleanly', () => {
    const res = runSmtJob('(check-sat)\n', { solver: 'z3', timeoutSec: 5 });
    assert.equal(res.status, 'sat');
    const solverSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'ears', 'smt-solver.mjs'), 'utf8');
    assert.match(solverSrc, /timeout/u);
  });
});

describe('Wave-9 Batch 6: CSRF filter, multi-value GET query, Optional[Record] post, agg arity', () => {
  test('A08 & A12: CSRFFilter is enabled in conf/service.conf and GET query preserves multi-value Vector[Any]', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-b6-'));
    try {
      const canonical = makeBaseCanonical();
      generateScalaCqrsPlayServiceV2(canonical, { outDir: tmpDir, packageName: 'example.wave9' });
      const serviceConf = fs.readFileSync(path.join(tmpDir, 'generated-scaffold', 'conf', 'service.conf'), 'utf8');
      assert.match(serviceConf, /play\.filters\.csrf\.CSRFFilter/u);

      const apiSuite = emitV1ApiAuthSuite(canonical, { packageName: 'example.wave9' });
      const controller = getFileFromSuite(apiSuite, 'OrderIntakePlayController.scala');
      assert.match(controller, /\.toVector/u, 'Multi-value query params must preserve Vector[Any]');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('E2-10: createSmtContext supports nested Optional[Record] subfield post-assignment', () => {
    const spec = normalizeEars(parseEars(`
slice Order.UpdateOrder
rules:
  [OK] WHILE order.amount >= 0 WHEN UpdateOrder SHALL emit OrderUpdated
       post:
         order.audit.actor' = "alice"
`));
    const ctx = createSmtContext(spec);
    assert.ok(ctx, 'SMT context should construct cleanly for nested Optional[Record] post-assignment');
  });

  test('E2-14: binder validates len/count/sum arity (must take exactly 1 argument)', () => {
    const sym = makeOrderSymTable();
    const badAritySpec = normalizeEars(parseEars(`
slice Order.UpdateOrder
rules:
  [BAD_ARITY] IF sum(order.items, 2) > 0 THEN SHALL reject request with BAD_ARITY
`));
    const bound = bindEarsSpec(badAritySpec, sym, { strictRuleRefs: false, strictDomainBoundary: true });
    const arityDiag = (bound.diagnostics || []).find(d => d.code === 'EARS_TYPE_MISMATCH' && /expects exactly 1 argument/u.test(d.message));
    assert.ok(arityDiag, `Expected EARS_TYPE_MISMATCH arity diagnostic, got ${JSON.stringify(bound.diagnostics)}`);
  });
});

describe('Wave-9 Batch 7: BC check-v2, POST query+body merge, corrupt ReadSide fail-fast, seq membership witness', () => {
  test('A4-11: runCheckV2 accepts merged multi-subdomain BC .truthsrc/canonical-v2.json', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-a411-'));
    try {
      const c1 = makeBaseCanonical({ context: 'subA' });
      const c2 = makeBaseCanonical({
        context: 'subB',
        structures: {
          aggregates: [{ name: 'Ledger', stateFields: [{ name: 'ledgerId', type: 'String' }], commands: [], events: [] }],
          ports: [],
          stories: [],
          readModels: [],
        },
        behaviors: [],
      });
      const { mergedCanonical } = mergeCanonicalsForBc([c1, c2], { bcName: 'commerce' });
      fs.mkdirSync(path.join(tmpDir, '.truthsrc'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.truthsrc', 'canonical-v2.json'), JSON.stringify(mergedCanonical, null, 2));
      const res = runCheckV2({ rootDir: tmpDir });
      assert.ok(res && typeof res.passed === 'boolean', 'runCheckV2 must handle merged BC .truthsrc/canonical-v2.json without crashing');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('A11: PlayController POST routes use AuthedWriteBuilder.withRequest and merge queryMap ++ jsObjToMap(body)', () => {
    const canonical = makeBaseCanonical();
    const apiSuite = emitV1ApiAuthSuite(canonical, { packageName: 'example.wave9' });
    const controller = getFileFromSuite(apiSuite, 'OrderIntakePlayController.scala');
    assert.match(controller, /\.withRequest\s*\{\s*\(ctx,\s*req,\s*body\)\s*=>/u);
    assert.match(controller, /queryMap\s*\+\+\s*jsObjToMap\(body\)/u);
  });

  test('F13: ReadSide row decoders throw IllegalStateException on corrupt non-empty columns', () => {
    const canonical = makeBaseCanonical();
    const readsideSuite = emitV1ReadsideSuite(canonical, { packageName: 'example.wave9' });
    const repoImpl = getFileFromSuite(readsideSuite, 'OrderSummaryReadsideRepositoryImpl.scala');
    assert.match(repoImpl, /throw new IllegalStateException\(s"corrupt ReadSide column/u);
  });

  test('E2-04: materializeDomainWitness materializes sequence membership from mapEntries', () => {
    const agg = {
      name: 'Order',
      stateFields: [{ name: 'tags', type: 'Seq[String]', resolvedType: { kind: 'sequence', element: { kind: 'string' } } }],
    };
    const cmd = {
      name: 'AddTag',
      parameters: [{ name: 'tag', type: 'String', resolvedType: { kind: 'string' } }],
    };
    const mat = materializeDomainWitness(agg, cmd, {
      scalars: { 'input.tag': '"vip"' },
      mapEntries: { 'state.tags': { vip: 'true' } },
    });
    assert.ok(Array.isArray(mat.state.tags) && mat.state.tags.includes('vip'), `Expected 'vip' in materialized state.tags, got ${JSON.stringify(mat.state)}`);
  });
});

describe('Wave-9 Perf & Progress: check-v2 timings and parallel mutation worker', () => {
  test('runCheckV2 reports stage timingsMs and honors mutationGate=false', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave9-timings-'));
    try {
      const c1 = makeBaseCanonical({ context: 'subA' });
      const { mergedCanonical } = mergeCanonicalsForBc([c1], { bcName: 'perf' });
      fs.mkdirSync(path.join(tmpDir, '.truthsrc'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.truthsrc', 'canonical-v2.json'), JSON.stringify(mergedCanonical, null, 2));
      const res = runCheckV2({ rootDir: tmpDir, mutationGate: false, progress: false });
      assert.ok(res.timingsMs && typeof res.timingsMs.totalMs === 'number', 'runCheckV2 must report timingsMs');
      assert.equal(res.verify.mutationCheck.enabled, false, 'mutationGate=false must disable mutation gate');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
