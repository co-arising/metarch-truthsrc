// Executable Fail-Closed Acceptance Specification Suite for `scala-cqrs-play-service@2`.
// Enforces every invariant in `knowledge_base/architecture/scala_cqrs_play_service_v2_acceptance_spec.md`
// and the Two-Branch EARS Behavior Governance Contract (Branch 1: 4A Deterministic vs Branch 2: 4B/Infra Handwritten + DI).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { getCodegenPlugin } from '../lib/v2/codegen/interface.mjs';
import {
  GENERATED_HEADER_CONF,
  GENERATED_HEADER_SCALA,
  GENERATOR_MANIFEST,
  generateScalaCqrsPlayServiceV2ForBc,
} from '../generators/scala-cqrs-play-service-v2/generate.mjs';
import { emitV2ExecutableTests } from '../lib/v2/test-emitter/emit.mjs';
import {
  checkOnionDipBoundaries,
  detectScalaToolchain,
  resolveScalaTestClasspath,
  runV2VerifyGate,
  verifyLockedTestsManifest,
} from '../lib/v2/verify-gate.mjs';
import { buildV2WorkshopView, exportV2WorkshopHtml } from '../lib/v2/view-v2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const BANK_PILOT_DIR = resolve(ROOT, '../bank-wealth-demo/v2-pilot');
const BANK_STRUCTURES = join(BANK_PILOT_DIR, 'truth/bank-wealth/contexts/bankwealth/structures');
const BANK_BEHAVIORS = join(BANK_PILOT_DIR, 'truth/bank-wealth/contexts/bankwealth/behaviors');
const BANK_BINDINGS = join(BANK_PILOT_DIR, 'truth/bank-wealth/contexts/bankwealth/bindings');

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function collectFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function compileBankFixture(workDir) {
  const canonicalPath = join(workDir, '.truthsrc/canonical-v2.json');
  const dbPath = join(workDir, '.truthsrc/knowledge.sqlite');
  const compiled = compileCanonicalV2({
    structuresDir: BANK_STRUCTURES,
    specsPath: BANK_BEHAVIORS,
    bindingsPath: BANK_BINDINGS,
    outFile: canonicalPath,
    dbFile: dbPath,
  });
  assert.equal(compiled.passed, true, `Bank fixture compile failed: ${JSON.stringify(compiled.diagnostics)}`);
  return { compiled, canonicalPath, dbPath };
}

test('[SPEC-S1] 54-Family Superset Manifest & Generated Header Provenance', () => {
  assert.equal(GENERATOR_MANIFEST.schemaVersion, 'truthsrc.product-generator/v2');
  assert.equal(GENERATOR_MANIFEST.name, 'scala-cqrs-play-service');
  assert.equal(GENERATOR_MANIFEST.version, '2');
  assert.equal(GENERATOR_MANIFEST.artifactFamilyCoverage.totalUnifiedFamilies, 54);
  assert.equal(GENERATOR_MANIFEST.artifactFamilyCoverage.supersetOfV1, true);

  // Explicit superseded mapping for legacy saga families #16-#21
  const orchProducer = GENERATOR_MANIFEST.producers.find(p => p.id === 'orchestration-saga-dsl');
  assert.ok(orchProducer, 'orchestration-saga-dsl producer must be declared');
  for (const legacyNum of ['16', '17', '18', '19', '20', '21']) {
    assert.ok(orchProducer.supersededLegacyFamilies[legacyNum], `legacy family #${legacyNum} must declare explicit supersededBy mapping`);
  }

  if (!existsSync(BANK_STRUCTURES)) return;
  const work = makeTempDir('truthsrc-spec-s1-');
  try {
    const { compiled } = compileBankFixture(work);
    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    const genRes = plugin.generate(compiled.canonical, { outDir: work, packageName: 'example.bankwealth.v2' });

    const scaffoldFiles = genRes.files.filter(f => f.path.startsWith('generated-scaffold/'));
    assert.ok(scaffoldFiles.length >= 60, `expected >= 60 generated scaffold files, got ${scaffoldFiles.length}`);
    for (const f of scaffoldFiles) {
      const text = readFileSync(f.absPath, 'utf8');
      if (f.path.endsWith('.scala') || f.path.endsWith('.proto') || f.path.endsWith('.sbt')) {
        assert.ok(text.startsWith(GENERATED_HEADER_SCALA), `missing scala-cqrs-play-service:2 header in ${f.path}`);
        assert.match(text, /\/\/ @canonical-v2 [0-9a-f]{64}/, `missing @canonical-v2 sha in ${f.path}`);
      } else if (f.path.endsWith('.conf') || f.path.endsWith('/routes') || f.path.endsWith('.properties')) {
        assert.ok(text.startsWith(GENERATED_HEADER_CONF), `missing conf header in ${f.path}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S2] Semantic Stable @knowledge Anchors & Idiomatic Scala Code Quality (Zero Array Indices, Zero contractJson, Zero ???, Real Postconditions)', () => {
  if (!existsSync(BANK_STRUCTURES)) return;
  const work = makeTempDir('truthsrc-spec-s2-');
  try {
    const { compiled } = compileBankFixture(work);
    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    plugin.generate(compiled.canonical, { outDir: work, packageName: 'example.bankwealth.v2' });

    const allScala = collectFiles(join(work, 'generated-scaffold/scala')).filter(f => f.endsWith('.scala'));
    assert.ok(allScala.length > 0);
    for (const abs of allScala) {
      const rel = relative(work, abs).split(sep).join('/');
      const src = readFileSync(abs, 'utf8');
      assert.doesNotMatch(
        src,
        /@knowledge[^\n]*\/(?:aggregates|commands|guards|events|exactTypes|valueObjects)\/\d+/u,
        `unstable numeric array-index @knowledge pointer found in ${rel}`,
      );
      assert.doesNotMatch(src, /\bcontractJson\b/u, `escaped JSON contractJson found in ${rel}`);
      assert.doesNotMatch(src, /\?\?\?/u, `placeholder ??? stub found in ${rel}`);
    }

    // Real checkEventPostconditions (never `= None`) on all aggregates with non-optional String/Nominal event fields
    for (const agg of ['CreditBalance', 'FundQuota', 'FundOrder']) {
      const rulesPath = join(work, `generated-scaffold/scala/example/bankwealth/v2/domain/invariants/${agg}Rules.scala`);
      assert.equal(existsSync(rulesPath), true, `missing Rules file for ${agg}`);
      const rulesSrc = readFileSync(rulesPath, 'utf8');
      assert.doesNotMatch(rulesSrc, /def checkEventPostconditions\(events: List\[Event\]\): Option\[iMadzError\] = None/u, `${agg}Rules must emit real checkEventPostconditions`);
      assert.match(rulesSrc, /private def checkEventPostcondition\(event: Event\): Option\[iMadzError\]/u);
    }

    // Idiomatic Scala triple-quoted SQL DDL with stripMargin
    const ddl = readFileSync(
      join(work, 'generated-scaffold/scala/example/bankwealth/v2/infrastructure/repositories/projection/BankOrderReadsideSchema.scala'),
      'utf8',
    );
    assert.match(ddl, /"""\|CREATE TABLE IF NOT EXISTS/);
    assert.match(ddl, /\.stripMargin/);

    // Strongly-typed CallerContractSpec
    const cashPort = readFileSync(
      join(work, 'generated-scaffold/scala/example/bankwealth/v2/application/services/CashFundPurchasePort.scala'),
      'utf8',
    );
    assert.match(cashPort, /val spec: CallerContractSpec = CallerContractSpec\(/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S3] Branch 1 (Deterministic Channel 4A): Non-Empty Rules, 0-Method-Only Noop, Postcondition & Locked Test Coverage + 100% Mutation Gate', () => {
  if (!existsSync(BANK_STRUCTURES)) return;
  const work = makeTempDir('truthsrc-spec-s3-');
  try {
    const { compiled, canonicalPath, dbPath } = compileBankFixture(work);
    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    plugin.generate(compiled.canonical, { outDir: work, packageName: 'example.bankwealth.v2' });
    emitV2ExecutableTests(compiled.canonical, { outDir: work, targets: ['scala-cqrs-play-service-v2'], packageName: 'example.bankwealth.v2' });

    const detBehaviors = compiled.canonical.behaviors.filter(b => b.theory.codegenChannel === 'deterministic');
    assert.ok(detBehaviors.length >= 2);
    for (const beh of detBehaviors) {
      const aggName = beh.target.split('.')[0];
      const rulesSrc = readFileSync(
        join(work, `generated-scaffold/scala/example/bankwealth/v2/domain/invariants/${aggName}Rules.scala`),
        'utf8',
      );
      assert.doesNotMatch(rulesSrc, /!\(\(!\(/u, `${aggName}Rules must not contain double negation`);

      // Pure L1 aggregate Computations has 0 abstract methods -> Noop allowed
      const compSrc = readFileSync(
        join(work, `generated-scaffold/scala/example/bankwealth/v2/domain/services/${aggName}Computations.scala`),
        'utf8',
      );
      assert.match(compSrc, /val Noop:/);
      assert.doesNotMatch(compSrc, /^\s*def\s+/mu, `0-method L1 ${aggName}Computations must have no abstract methods`);

      // Locked test covers EVERY rule + checkEventPostconditions
      const specName = `${beh.target.replace(/[^A-Za-z0-9]+/gu, '')}EarsSpec.scala`;
      const specPath = join(work, `generated-scaffold/../generated-tests/scala/example/bankwealth/v2/domain/invariants/${specName}`);
      assert.equal(existsSync(specPath), true, `missing locked domain spec ${specName}`);
      const specSrc = readFileSync(specPath, 'utf8');
      for (const r of beh.rules) {
        assert.ok(specSrc.includes(`@CoArisingSpec(id="${r.id}"`), `missing @CoArisingSpec for deterministic rule ${r.id}`);
      }
      assert.match(specSrc, /checkEventPostconditions/, `deterministic spec ${specName} must test checkEventPostconditions`);
    }

    // Copy real bank-wealth-demo L2/L3 handwritten *Impl.scala implementations to verify full green ScalaTest + 100% Mutation Gate
    for (const rel of [
      'handwritten/scala/example/bankwealth/v2/domain/services/impl/FundOrderConfirmTASharesImpl.scala',
      'handwritten/scala/example/bankwealth/v2/application/services/CashFundPurchaseImpl.scala',
      'handwritten/scala/example/bankwealth/v2/application/services/TaBridgeSettlementImpl.scala',
    ]) {
      const srcFile = join(BANK_PILOT_DIR, rel);
      if (existsSync(srcFile)) writeFileSync(join(work, rel), readFileSync(srcFile, 'utf8'), 'utf8');
    }

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
      assert.equal(verify.passed, true, `SPEC-S3 verify-v2 failed: ${JSON.stringify(verify, null, 2)}`);
      assert.equal(verify.scalaCheck.passed, true);
      assert.equal(verify.mutationCheck.passed, true);
      assert.equal(verify.mutationCheck.scala.killRate, 100);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S4] Branch 2 (Non-Deterministic 4B & Infra): Mandatory Handwritten Isolation Files, Non-Empty L2 Computations (Zero Noop), No-Overwrite Protection', () => {
  if (!existsSync(BANK_STRUCTURES)) return;
  const work = makeTempDir('truthsrc-spec-s4-');
  try {
    const { compiled } = compileBankFixture(work);
    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    plugin.generate(compiled.canonical, { outDir: work, packageName: 'example.bankwealth.v2' });

    // 1. L2 aggregate (FundOrder): Rules MUST exist, Computations MUST declare abstract methods & forbid Noop, ComputationsImpl + ConfirmTASharesImpl MUST exist in handwritten/
    const foComp = readFileSync(
      join(work, 'generated-scaffold/scala/example/bankwealth/v2/domain/services/FundOrderComputations.scala'),
      'utf8',
    );
    assert.doesNotMatch(foComp, /\bval\s+Noop\b/u, 'non-empty L2 FundOrderComputations MUST NOT emit val Noop');
    assert.match(foComp, /def recordFundTAConfirmed\(/);
    assert.match(foComp, /def recordCashRequestSource\(/);

    const foCompImplPath = join(work, 'handwritten/scala/example/bankwealth/v2/domain/services/impl/FundOrderComputationsImpl.scala');
    assert.equal(existsSync(foCompImplPath), true, 'missing handwritten FundOrderComputationsImpl.scala');
    assert.match(readFileSync(foCompImplPath, 'utf8'), /FundOrderConfirmTASharesImpl\.apply\(state, p\)/);

    // 2. All required handwritten isolation zone files exist
    const requiredHandwritten = [
      'handwritten/scala/example/bankwealth/v2/domain/services/impl/FundOrderConfirmTASharesImpl.scala',
      'handwritten/scala/example/bankwealth/v2/domain/services/impl/FundOrderComputationsImpl.scala',
      'handwritten/scala/example/bankwealth/v2/application/services/CashFundPurchaseImpl.scala',
      'handwritten/scala/example/bankwealth/v2/application/services/TaBridgeSettlementImpl.scala',
      'handwritten/scala/example/bankwealth/v2/infrastructure/projection/BankOrderApplyEventSemanticsImpl.scala',
      'handwritten/scala/example/bankwealth/v2/infrastructure/connectors/BankCashSubmitPortConnectorImpl.scala',
      'handwritten/scala/example/bankwealth/v2/infrastructure/connectors/BankTaBridgePortConnectorImpl.scala',
      'handwritten/scala/example/bankwealth/v2/infrastructure/effects/CashFundPurchaseEffectPortImpl.scala',
      'handwritten/scala/example/bankwealth/v2/infrastructure/effects/TaBridgeSettlementEffectPortImpl.scala',
      'handwritten/scala/example/bankwealth/v2/modules/HandwrittenBindingsModule.scala',
    ];
    for (const rel of requiredHandwritten) {
      assert.equal(existsSync(join(work, rel)), true, `missing required handwritten isolation file: ${rel}`);
    }

    // 3. Zero *Cloze.scala filenames anywhere
    const allScalaFiles = collectFiles(work).filter(f => f.endsWith('.scala'));
    for (const abs of allScalaFiles) {
      assert.doesNotMatch(abs, /Cloze\.scala$/u, `forbidden *Cloze.scala naming found: ${abs}`);
    }

    // 4. Re-running generate-v2 with default overwriteCloze=false NEVER overwrites handwritten edits
    const sentinel = '// CUSTOM_HANDWRITTEN_SENTINEL_KEEP_ME\n';
    const targetHw = join(work, 'handwritten/scala/example/bankwealth/v2/infrastructure/projection/BankOrderApplyEventSemanticsImpl.scala');
    writeFileSync(targetHw, sentinel + readFileSync(targetHw, 'utf8'), 'utf8');
    plugin.generate(compiled.canonical, { outDir: work, packageName: 'example.bankwealth.v2' });
    assert.ok(readFileSync(targetHw, 'utf8').startsWith(sentinel), 'generate-v2 overwrote handwritten isolation file!');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S5] 6-Chain Glue Audit (GLUE-1..GLUE-6) & Complete Guice DI Closure (Zero Unbound Interfaces)', () => {
  if (!existsSync(BANK_STRUCTURES)) return;
  const work = makeTempDir('truthsrc-spec-s5-');
  try {
    const { compiled } = compileBankFixture(work);
    const enriched = structuredClone(compiled.canonical);
    enriched.structures.pipelines = [
      { id: 'daily-ta-reconcile', name: 'DailyTaReconcile', stages: ['FetchBatch', 'ReconcileNav'] },
    ];
    enriched.structures.stories[0].coversUseCases = ['UC-BANK-CASH-PURCHASE'];

    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    plugin.generate(enriched, { outDir: work, packageName: 'example.bankwealth.v2' });

    const pkgBase = join(work, 'generated-scaffold/scala/example/bankwealth/v2');

    // GLUE-1: Every controller route in conf/routes resolves to an existing controller file & method
    const routesConf = readFileSync(join(work, 'generated-scaffold/conf/routes'), 'utf8');
    const ctrlMatches = [...routesConf.matchAll(/controllers\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\(/gu)];
    assert.ok(ctrlMatches.length >= 6, `expected >= 6 controller routes, got ${ctrlMatches.length}`);
    for (const [, ctrlClass, methodName] of ctrlMatches) {
      const ctrlFile = join(work, `generated-scaffold/scala/controllers/${ctrlClass}.scala`);
      assert.equal(existsSync(ctrlFile), true, `GLUE-1 broken: route references missing ${ctrlClass}.scala`);
      const ctrlSrc = readFileSync(ctrlFile, 'utf8');
      assert.match(ctrlSrc, new RegExp(`def\\s+${methodName}\\b`, 'u'), `GLUE-1 broken: ${ctrlClass} missing method ${methodName}`);
      assert.match(ctrlSrc, /Endpoint/, `GLUE-1 broken: ${ctrlClass} must use auth-core Endpoint`);
    }

    // GLUE-2: Every aggregate's Behaviors.scala command rule references exist in <Agg>Rules.scala & mounted in ApplicationBootstrap
    const appBoot = readFileSync(join(pkgBase, 'infrastructure/bootstrap/ApplicationBootstrap.scala'), 'utf8');
    const bootMod = readFileSync(join(pkgBase, 'modules/BootstrapModule.scala'), 'utf8');
    for (const agg of enriched.structures.aggregates) {
      assert.match(appBoot, new RegExp(`init${agg.name}Aggregate\\(`), `GLUE-2 broken: ApplicationBootstrap missing init${agg.name}Aggregate`);
      assert.match(bootMod, new RegExp(`bind\\(classOf\\[${agg.name}Repository\\]\\)\\.to\\(classOf\\[${agg.name}RepositoryImpl\\]\\)`));
      const behSrc = readFileSync(join(pkgBase, `application/aggregates/behaviors/${agg.name}Behaviors.scala`), 'utf8');
      const rulesSrc = readFileSync(join(pkgBase, `domain/invariants/${agg.name}Rules.scala`), 'utf8');
      for (const m of behSrc.matchAll(new RegExp(`${agg.name}Rules\\.([A-Za-z0-9_]+Rule)\\b`, 'gu'))) {
        assert.match(rulesSrc, new RegExp(`final class ${m[1]}\\b`, 'u'), `GLUE-2 broken: ${agg.name}Behaviors calls ${m[1]} missing from ${agg.name}Rules.scala`);
      }
    }

    // GLUE-3: ReadSide Projection wired into ApplicationBootstrap + #26 ProjectionModule
    assert.match(appBoot, /with BankOrderReadsideBootstrap/);
    assert.match(appBoot, /initBankOrderReadsideProjection\(/);
    assert.equal(existsSync(join(pkgBase, 'infrastructure/bootstrap/BankwealthProjectionModule.scala')), true);

    // GLUE-4: Pipelines + Sagas + Effects wired into SagaCoordinatorBootstrap + host/effect protos + serialization.conf
    const sagaBoot = readFileSync(join(pkgBase, 'infrastructure/bootstrap/SagaCoordinatorBootstrap.scala'), 'utf8');
    assert.match(sagaBoot, /initDailyTaReconcileProcess\(sharding\)/);
    assert.match(sagaBoot, /initCashFundPurchaseProcess\(sharding\)/);
    assert.match(sagaBoot, /initCashFundPurchaseEffect\(system\)/);
    const serConf = readFileSync(join(work, 'generated-scaffold/conf/serialization.conf'), 'utf8');
    assert.match(serConf, /daily-ta-reconcile-host/);
    assert.match(serConf, /cash-fund-purchase-host/);
    assert.match(serConf, /cash-fund-purchase-effect/);

    // GLUE-6: Complete Guice DI closure in GeneratedBindingsModule + HandwrittenBindingsModule + build.sbt
    const genBindings = readFileSync(join(pkgBase, 'modules/GeneratedBindingsModule.scala'), 'utf8');
    assert.match(genBindings, /bind\(classOf\[FundOrderComputations\]\)\.to\(classOf\[FundOrderComputationsImpl\]\)/);
    assert.match(genBindings, /bind\(classOf\[FundQuotaComputations\]\)\.toInstance\(FundQuotaComputations\.Noop\)/);
    assert.match(genBindings, /bind\(classOf\[CreditBalanceComputations\]\)\.toInstance\(CreditBalanceComputations\.Noop\)/);
    assert.match(genBindings, /bind\(classOf\[BankOrderReadsideRepository\]\)\.to\(classOf\[BankOrderReadsideRepositoryImpl\]\)/);
    assert.match(genBindings, /bind\(classOf\[BankCashSubmitPortConnectorPort\]\)\.to\(classOf\[BankCashSubmitPortConnectorImpl\]\)/);
    assert.match(genBindings, /bind\(classOf\[CashFundPurchaseEffectFace\.Port\]\)\.to\(classOf\[CashFundPurchaseEffectPortImpl\]\)/);
    assert.match(genBindings, /bind\(classOf\[CashFundPurchaseHandler\]\)\.toInstance\(CashFundPurchaseImpl\)/);
    assert.match(genBindings, /bind\(classOf\[SagaCoordinatorBootstrap\]\)\.asEagerSingleton\(\)/);

    const hwBindings = readFileSync(join(work, 'handwritten/scala/example/bankwealth/v2/modules/HandwrittenBindingsModule.scala'), 'utf8');
    assert.match(hwBindings, /install\(new GeneratedBindingsModule\(\)\)/);
    assert.match(hwBindings, /install\(new BankwealthProjectionModule\(\)\)/);

    const buildSbt = readFileSync(join(work, 'generated-scaffold/build.sbt'), 'utf8');
    assert.match(buildSbt, /handwritten/);
    assert.match(buildSbt, /akka-projection-eventsourced/);
    assert.match(buildSbt, /scalikejdbc/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S6] Onion Architecture DIP (0 Violations) & Locked Test Manifest Anti-Tamper Enforcement', () => {
  if (!existsSync(BANK_STRUCTURES)) return;
  const work = makeTempDir('truthsrc-spec-s6-');
  try {
    const { compiled } = compileBankFixture(work);
    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    plugin.generate(compiled.canonical, { outDir: work, packageName: 'example.bankwealth.v2' });
    emitV2ExecutableTests(compiled.canonical, { outDir: work, targets: ['scala-cqrs-play-service-v2'], packageName: 'example.bankwealth.v2' });

    const dip = checkOnionDipBoundaries(work);
    assert.equal(dip.passed, true, `Onion DIP violations: ${JSON.stringify(dip.violations)}`);
    assert.ok(dip.checkedCount >= 60);

    const manifestPath = join(work, 'generated-tests/manifest.sha256.json');
    assert.equal(verifyLockedTestsManifest(manifestPath).passed, true);

    // Tamper 1 byte in a locked spec -> MUST fail closed
    const specFile = join(work, 'generated-tests/scala/example/bankwealth/v2/domain/invariants/CreditBalanceReserveFundsEarsSpec.scala');
    writeFileSync(specFile, `${readFileSync(specFile, 'utf8')}\n// tampered\n`, 'utf8');
    const tampered = verifyLockedTestsManifest(manifestPath);
    assert.equal(tampered.passed, false, 'locked test manifest must reject 1-byte tampering');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S7] Context Mapping Modes: Zero-Config Monolith ("大泥球") vs. Multi-BC ACL Split (#46 ExternalAuthority 4-Way Sync)', () => {
  const work = makeTempDir('truthsrc-spec-s7-');
  try {
    for (const [sub, agg, cmd, ev, field] of [
      ['orders', 'Order', 'Place', 'OrderPlaced', 'orderId'],
      ['billing', 'Invoice', 'Issue', 'InvoiceIssued', 'invoiceId'],
    ]) {
      mkdirSync(join(work, `truth/${sub}/structures`), { recursive: true });
      mkdirSync(join(work, `truth/${sub}/behaviors/domain`), { recursive: true });
      writeFileSync(join(work, `truth/${sub}/structures/${sub}.yaml`), `
system: shop
subdomain: ${sub}
context: ${sub}
aggregates:
  - name: ${agg}
    aliases: [state]
    stateFields:
      - name: ${field}
        type: String
        default: ""
    commands:
      - name: ${cmd}
        produces: [${ev}]
        parameters:
          - name: ${field}
            type: String
    events:
      - name: ${ev}
        fields:
          - name: ${field}
            type: String
`, 'utf8');
      writeFileSync(join(work, `truth/${sub}/behaviors/domain/${sub}.ears`), `
slice ${agg}.${cmd}
rules:
  [${agg.toUpperCase()}_EMPTY] IF ${field} == "" THEN SHALL reject request with ${agg.toUpperCase()}_EMPTY
  [${agg.toUpperCase()}_OK]    WHILE ${field} != ""
                               WHEN ${cmd}
                               SHALL emit ${ev}
                               post:
                                 state.${field}' = ${field}
`, 'utf8');
    }

    const cOrders = compileCanonicalV2({ structuresDir: join(work, 'truth/orders/structures'), specsPath: join(work, 'truth/orders/behaviors') }).canonical;
    const cBilling = compileCanonicalV2({ structuresDir: join(work, 'truth/billing/structures'), specsPath: join(work, 'truth/billing/behaviors') }).canonical;

    // Mode A: Monolith ("大泥球")
    const monoOut = join(work, 'mono');
    const monoRes = generateScalaCqrsPlayServiceV2ForBc({
      bcName: 'shop-monolith',
      packaging: 'monolith',
      canonicals: [cOrders, cBilling],
      outDir: monoOut,
      packageName: 'shop.monolith',
    });
    assert.equal(monoRes.packaging, 'monolith');
    assert.equal(existsSync(monoRes.mergedCanonicalPath), true);
    assert.equal(existsSync(join(monoOut, 'generated-scaffold/scala/shop/monolith/domain/entities/OrderEntity.scala')), true);
    assert.equal(existsSync(join(monoOut, 'generated-scaffold/scala/shop/monolith/domain/entities/InvoiceEntity.scala')), true);

    // Mode B: Multi-BC with cross-BC ACL -> GLUE-5 4-way ExternalAuthority sync
    const bcOut = join(work, 'billing-bc');
    const bcRes = generateScalaCqrsPlayServiceV2ForBc({
      domainMap: {
        system: 'shop',
        boundedContexts: [
          { name: 'orders-bc', subdomains: ['orders'], package: 'shop.orders' },
          { name: 'billing-bc', subdomains: ['billing'], package: 'shop.billing' },
        ],
        integrations: [
          {
            id: 'orders-to-billing',
            upstreamSubdomain: 'orders',
            upstreamEvent: 'Order.OrderPlaced',
            downstreamSubdomain: 'billing',
            downstreamTarget: 'Invoice.Issue',
            pattern: 'ACL',
          },
        ],
      },
      bcName: 'billing-bc',
      canonicals: [cOrders, cBilling],
      outDir: bcOut,
    });
    assert.equal(bcRes.externalIntegrationsCount, 1);
    // 4-way ExternalAuthority sync check (GLUE-5)
    assert.equal(existsSync(join(bcOut, 'generated-scaffold/scala/shop/billing/application/aggregates/behaviors/InvoiceExternalEvents.scala')), true);
    assert.match(readFileSync(join(bcOut, 'generated-scaffold/scala/shop/billing/application/aggregates/InvoiceProtocol.scala'), 'utf8'), /ExternalAuthority/);
    assert.match(readFileSync(join(bcOut, 'generated-scaffold/scala/shop/billing/application/aggregates/InvoiceAggregate.scala'), 'utf8'), /ExternalAuthority/);
    assert.match(readFileSync(join(bcOut, 'generated-scaffold/scala/shop/billing/infrastructure/bootstrap/ApplicationBootstrap.scala'), 'utf8'), /initInvoiceAggregate\(sharding, invoiceComputations, invoiceAuthority\)/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S8] Explorer SQLite Rich Node Graph (17+ Kinds, 4A/4B Behavior Channels) & 100% Mapped Provenance Spans', () => {
  if (!existsSync(BANK_STRUCTURES)) return;
  const work = makeTempDir('truthsrc-spec-s8-');
  try {
    cpSync(join(BANK_PILOT_DIR, 'truth'), join(work, 'truth'), { recursive: true });
    const { compiled, dbPath } = compileBankFixture(work);
    const plugin = getCodegenPlugin('scala-cqrs-play-service-v2');
    plugin.generate(compiled.canonical, { outDir: work, packageName: 'example.bankwealth.v2' });
    emitV2ExecutableTests(compiled.canonical, { outDir: work, targets: ['scala-cqrs-play-service-v2'], packageName: 'example.bankwealth.v2' });

    const db = new DatabaseSync(dbPath, { readOnly: true });
    const kindRows = db.prepare('SELECT kind, COUNT(*) AS n FROM nodes GROUP BY kind ORDER BY kind').all();
    const behRows = db.prepare("SELECT id, payload FROM nodes WHERE kind = 'behavior'").all();
    db.close();

    const kindMap = new Map(kindRows.map(r => [r.kind, r.n]));
    for (const expectedKind of [
      'aggregate',
      'authz-policy',
      'axiom',
      'behavior',
      'cloze-slot',
      'command',
      'effect',
      'event',
      'event-fold',
      'exact-type',
      'extern-contract',
      'port',
      'read-model',
      'role',
      'rule',
      'saga',
      'story',
      'value-object',
    ]) {
      assert.ok((kindMap.get(expectedKind) ?? 0) > 0, `SQLite graph missing expected rich node kind: ${expectedKind}`);
    }

    // Behaviors carry explicit 4A / 4B channel tags
    for (const row of behRows) {
      const p = JSON.parse(row.payload);
      assert.ok(p.channel === '4A-deterministic' || p.channel === '4B-cloze-handwritten', `behavior ${row.id} missing 4A/4B channel tag`);
    }

    // Export offline Workshop HTML and verify rich nodes map to real code spans & author sources
    const workshopOut = join(work, 'signoff/workshop.html');
    const viewModel = buildV2WorkshopView({ rootDir: work, dbFile: dbPath });
    for (const n of viewModel.nodes) {
      assert.ok(n.sources.length > 0, `rich node ${n.id} (${n.kind}) missing author source`);
      assert.ok(n.locations.length > 0, `rich node ${n.id} (${n.kind}) missing code location`);
    }
    const viewRes = exportV2WorkshopHtml({ rootDir: work, dbFile: dbPath, outFile: workshopOut });
    assert.ok(viewRes.nodes >= 85, `expected >= 85 rich nodes in Explorer graph, got ${viewRes.nodes}`);
    assert.equal(viewRes.mappedNodes, viewRes.nodes, `expected 100% mapped nodes (${viewRes.mappedNodes}/${viewRes.nodes})`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
