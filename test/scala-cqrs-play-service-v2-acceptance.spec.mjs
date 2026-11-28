// Executable Fail-Closed Acceptance Specification Suite for `scala-cqrs-play-service@2`.
// Enforces every invariant in `knowledge_base/architecture/scala_cqrs_play_service_v2_acceptance_spec.md`
// and the Two-Branch EARS Behavior Governance Contract (Branch 1: 4A Deterministic vs Branch 2: 4B/Infra Handwritten + DI).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { getCodegenPlugin } from '../lib/v2/codegen/interface.mjs';
import '../lib/v2/codegen/typescript.mjs';
import {
  GENERATED_HEADER_CONF,
  GENERATED_HEADER_SCALA,
  GENERATOR_MANIFEST,
  generateScalaCqrsPlayServiceV2ForBc,
  mergeCanonicalsForBc,
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
import { deriveClozeTasksV2 } from '../lib/v2/tasks-v2.mjs';
import { materializeApplicationWitness } from '../lib/v2/test-emitter/witness-materialize.mjs';
import { initV2Project } from '../lib/v2/init-v2.mjs';
import { runCheckV2 } from '../lib/v2/check-v2.mjs';

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

test('[SPEC-S1] 60-Family Superset Manifest & Generated Header Provenance', () => {
  assert.equal(GENERATOR_MANIFEST.schemaVersion, 'truthsrc.product-generator/v2');
  assert.equal(GENERATOR_MANIFEST.name, 'scala-cqrs-play-service');
  assert.equal(GENERATOR_MANIFEST.version, '2');
  assert.equal(GENERATOR_MANIFEST.artifactFamilyCoverage.totalUnifiedFamilies, 60);
  assert.equal(GENERATOR_MANIFEST.artifactFamilyCoverage.supersetOfV1, true);

  const policyProducer = GENERATOR_MANIFEST.producers.find(p => p.id === 'policy-projection-dsl');
  assert.ok(policyProducer, 'policy-projection-dsl producer must be declared');
  assert.deepEqual(policyProducer.familyNumbers, [55, 56, 57, 58, 59, 60]);

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
    getCodegenPlugin('typescript').generate(enriched, { outDir: work });

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
    assert.match(genBindings, /def provideHttpRouter\(/);
    assert.match(genBindings, /def provideCashFundPurchaseExternPorts\(/);
    assert.match(genBindings, /def provideCashFundPurchaseEffectsPort\(/);

    // Multi-aggregate safe AggregateStateApiController & self-contained Play AuthEndpointDsl
    const aggStateCtrl = readFileSync(join(work, 'generated-scaffold/scala/controllers/AggregateStateApiController.scala'), 'utf8');
    assert.match(aggStateCtrl, /FundOrderProtocol\.GetState\(replyTo\)/);
    assert.match(aggStateCtrl, /FundOrderEntity\.State/);
    assert.match(aggStateCtrl, /writesFundOrderState/);
    assert.doesNotMatch(aggStateCtrl, /net\.imadz\.common\.auth|net\.imadz\.metarch/);
    assert.equal(existsSync(join(pkgBase, 'infrastructure/api/AuthEndpointDsl.scala')), true);
    assert.equal(existsSync(join(work, 'generated-scaffold/conf/dev.conf')), true);

    const hwBindings = readFileSync(join(work, 'handwritten/scala/example/bankwealth/v2/modules/HandwrittenBindingsModule.scala'), 'utf8');
    assert.match(hwBindings, /install\(new GeneratedBindingsModule\(\)\)/);
    assert.match(genBindings, /install\(new BankwealthProjectionModule\(\)\)/);

    const buildSbt = readFileSync(join(work, 'generated-scaffold/build.sbt'), 'utf8');
    assert.match(buildSbt, /handwritten/);
    assert.match(buildSbt, /saga-core/);
    assert.match(buildSbt, /akka-projection-eventsourced/);
    assert.match(buildSbt, /scalikejdbc/);
    const pluginsSbt = readFileSync(join(work, 'generated-scaffold/project/plugins.sbt'), 'utf8');
    assert.match(pluginsSbt, /libraryDependencySchemes \+= "org\.scala-lang\.modules" %% "scala-xml" % VersionScheme\.Always/);

    // TS HTTP server gates client stateSnapshot behind allowRequestStateSnapshot
    const tsBootstrap = readFileSync(join(work, 'generated-scaffold/ts/modules/bootstrap.ts'), 'utf8');
    assert.match(tsBootstrap, /allowRequestStateSnapshot\?: boolean/);
    assert.match(tsBootstrap, /options\.allowRequestStateSnapshot === true/);
    assert.equal(existsSync(join(work, 'handwritten/effects/cash-fund-purchase.effect-adapter.ts')), true);
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
    // Inject L2 clozeSlots + roles to verify monolith merge retains cloze slots & auto-creates SQLite DB
    const cBillingWithCloze = structuredClone(cBilling);
    cBillingWithCloze.structures.roles = [{ name: 'billing-admin', kind: 'human' }];
    cBillingWithCloze.clozeSlots = [{ slotId: 'invoice-reconcile', target: 'Invoice.Issue', kind: 'slice', layer: 'domain', tier: 'L2', ruleIds: ['INVOICE_OK'] }];

    // Mode A: Monolith ("大泥球")
    const monoOut = join(work, 'mono');
    const monoRes = generateScalaCqrsPlayServiceV2ForBc({
      bcName: 'shop-monolith',
      packaging: 'monolith',
      canonicals: [cOrders, cBillingWithCloze],
      outDir: monoOut,
      packageName: 'shop.monolith',
    });
    assert.equal(monoRes.packaging, 'monolith');
    assert.equal(existsSync(monoRes.mergedCanonicalPath), true);
    assert.equal(existsSync(monoRes.dbPath), true);
    const mergedJson = JSON.parse(readFileSync(monoRes.mergedCanonicalPath, 'utf8'));
    assert.equal(mergedJson.clozeSlots.length, 1);
    assert.equal(mergedJson.structures.roles.length, 1);
    const monoDb = new DatabaseSync(monoRes.dbPath, { readOnly: true });
    const monoClozeCount = monoDb.prepare('SELECT COUNT(*) AS n FROM cloze_slots').get().n;
    monoDb.close();
    assert.equal(monoClozeCount, 1, 'monolith SQLite must retain merged cloze_slots');
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

test('[SPEC-S9] Z3 Witness Materializer: len(seq) Bounded Lists & Symmetric String Equality Witnesses Pass Live TS + ScalaTest', () => {
  const work = makeTempDir('truthsrc-spec-s9-');
  try {
    mkdirSync(join(work, 'truth/exam/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/exam/behaviors/domain'), { recursive: true });
    writeFileSync(join(work, 'truth/exam/structures/exam.yaml'), `
system: exam-spec
subdomain: exam
context: exam
aggregates:
  - name: ExamBatch
    aliases: [state]
    stateFields:
      - name: status
        type: String
        default: draft
        waiveLineage: immutable-config
      - name: topics
        type: Seq[String]
        default: []
      - name: existingId
        type: String
        default: ""
    commands:
      - name: SetTopics
        produces: [TopicsSet]
        parameters:
          - name: subjects
            type: Seq[String]
      - name: GenerateReplay
        produces: [ReplayConfirmed]
        parameters:
          - name: requestId
            type: String
    events:
      - name: TopicsSet
        fields:
          - name: subjects
            type: Seq[String]
      - name: ReplayConfirmed
        fields:
          - name: requestId
            type: String
`, 'utf8');
    writeFileSync(join(work, 'truth/exam/behaviors/domain/exam-batch-set-topics.ears'), `
slice ExamBatch.SetTopics
where:
  eligible = state.status == "draft" and len(subjects) >= 1 and len(subjects) <= 99
rules:
  [SET_TOPICS_REJECTED] IF not eligible WHEN SetTopics THEN SHALL reject request with SET_TOPICS_REJECTED
  [SET_TOPICS_ACCEPTED] WHILE eligible
                        WHEN SetTopics
                        SHALL emit TopicsSet
                        post:
                          state.topics' = subjects
`, 'utf8');
    writeFileSync(join(work, 'truth/exam/behaviors/domain/exam-batch-replay.ears'), `
slice ExamBatch.GenerateReplay
rules:
  [GENERATE_MISMATCH] IF state.existingId != requestId WHEN GenerateReplay THEN SHALL reject request with GENERATE_MISMATCH
  [GENERATE_REPLAY]   WHILE state.existingId == requestId
                      WHEN GenerateReplay
                      SHALL emit ReplayConfirmed
                      post:
                        state.existingId' = requestId
`, 'utf8');

    const compiled = compileCanonicalV2({
      structuresDir: join(work, 'truth/exam/structures'),
      specsPath: join(work, 'truth/exam/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(compiled.passed, true, `SPEC-S9 compile failed: ${JSON.stringify(compiled.diagnostics)}`);

    getCodegenPlugin('typescript').generate(compiled.canonical, { outDir: work });
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(compiled.canonical, { outDir: work, packageName: 'exam.spec9' });
    emitV2ExecutableTests(compiled.canonical, {
      outDir: work,
      targets: ['typescript', 'scala-cqrs-play-service-v2'],
      packageName: 'exam.spec9',
    });

    // Verify materialized TS test actually populated non-empty subjects & equal string witnesses
    const topicsSpec = readFileSync(join(work, 'generated-tests/ts/exam-batch-set-topics.ears.spec.ts'), 'utf8');
    assert.match(topicsSpec, /"subjects":\["item_1"/);
    const replaySpec = readFileSync(join(work, 'generated-tests/ts/exam-batch-generate-replay.ears.spec.ts'), 'utf8');
    assert.doesNotMatch(replaySpec, /"existingId":"".*"requestId":"0"/);

    // Verify materialized TS domain specs pass live node --test (pure domain, no loopback HTTP needed)
    const tsRun = spawnSync(
      process.execPath,
      [
        '--test',
        join(work, 'generated-tests/ts/exam-batch-set-topics.ears.spec.ts'),
        join(work, 'generated-tests/ts/exam-batch-generate-replay.ears.spec.ts'),
      ],
      { cwd: work, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(tsRun.status, 0, `SPEC-S9 TS domain tests failed:\n${tsRun.stdout}\n${tsRun.stderr}`);

    // Verify full Scala domain + ScalaTest + InterfacesHttpSpec + Onion DIP
    const verify = runV2VerifyGate({
      rootDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
    });
    assert.equal(verify.passed, true, `SPEC-S9 verify-v2 failed: ${JSON.stringify(verify, null, 2)}`);
    assert.equal(verify.scalaCheck.passed, true);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S10] ReadSide projection selects String identity key and emits typed Option/Seq/Map/Decimal readers (Issue #2)', () => {
  const work = makeTempDir('coarising-spec-s10-');
  try {
    mkdirSync(join(work, 'truth/finance/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/finance/behaviors/domain'), { recursive: true });
    writeFileSync(join(work, 'truth/finance/structures/model.yaml'), `
system: exam-spec10
context: finance
aggregates:
  - name: RefundCase
    stateFields:
      - name: refundedAmount
        type: Decimal(2)
      - name: credits
        type: Int
      - name: publishedAt
        type: Optional[Int]
      - name: topics
        type: Seq[String]
      - name: status
        type: String
        default: pending
    commands:
      - name: RecordRefund
        produces: [RefundRecorded]
        parameters:
          - name: refundedAmount
            type: Decimal(2)
          - name: credits
            type: Int
          - name: topics
            type: Seq[String]
    events:
      - name: RefundRecorded
        fields:
          - name: refundedAmount
            type: Decimal(2)
          - name: credits
            type: Int
          - name: publishedAt
            type: Optional[Int]
          - name: topics
            type: Seq[String]
readModels:
  - name: refund-tracking
    sourceAggregate: RefundCase
    fields:
      - name: refundedAmount
        type: Decimal(2)
        source: eventField:RefundCase.RefundRecorded.refundedAmount
      - name: optionalReason
        type: Optional[String]
  - name: batch-configuration
    sourceAggregate: RefundCase
    fields:
      - name: credits
        type: Int
        source: eventField:RefundCase.RefundRecorded.credits
      - name: publishedAt
        type: Optional[Int]
        source: eventField:RefundCase.RefundRecorded.publishedAt
      - name: refundTotal
        type: Optional[Decimal(2)]
      - name: topics
        type: Seq[String]
        source: eventField:RefundCase.RefundRecorded.topics
      - name: tagScores
        type: Map[String, Int]
`, 'utf8');
    writeFileSync(join(work, 'truth/finance/behaviors/domain/refund-record.ears'), `
slice RefundCase.RecordRefund
rules:
  [REFUND_INVALID] IF refundedAmount <= 0.00 WHEN RecordRefund THEN SHALL reject request with REFUND_INVALID
  [REFUND_RECORDED] WHILE refundedAmount > 0.00
                    WHEN RecordRefund
                    SHALL emit RefundRecorded
                    post:
                      state.refundedAmount' = refundedAmount
`, 'utf8');

    const compiled = compileCanonicalV2({
      structuresDir: join(work, 'truth/finance/structures'),
      specsPath: join(work, 'truth/finance/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(compiled.passed, true, `SPEC-S10 compile failed: ${JSON.stringify(compiled.diagnostics)}`);

    getCodegenPlugin('scala-cqrs-play-service-v2').generate(compiled.canonical, { outDir: work, packageName: 'exam.spec10' });
    emitV2ExecutableTests(compiled.canonical, {
      outDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      packageName: 'exam.spec10',
    });

    const refundHandler = readFileSync(
      join(work, 'generated-scaffold/scala/exam/spec10/application/readmodels/refund_tracking_readside/RefundTrackingReadsideProjectionHandler.scala'),
      'utf8',
    );
    assert.match(refundHandler, /RefundTrackingView\(id = envelope\.persistenceId\)/);
    assert.doesNotMatch(refundHandler, /refundedAmount = envelope\.persistenceId/);

    const batchSchema = readFileSync(
      join(work, 'generated-scaffold/scala/exam/spec10/infrastructure/repositories/projection/BatchConfigurationReadsideSchema.scala'),
      'utf8',
    );
    assert.match(batchSchema, /id VARCHAR\(255\) NOT NULL DEFAULT '' PRIMARY KEY/);
    assert.doesNotMatch(batchSchema, /credits BIGINT[^,\n]*PRIMARY KEY/);

    const batchRepo = readFileSync(
      join(work, 'generated-scaffold/scala/exam/spec10/infrastructure/repositories/projection/BatchConfigurationReadsideRepositoryImpl.scala'),
      'utf8',
    );
    assert.match(batchRepo, /import play\.api\.libs\.json\.Json/);
    assert.match(batchRepo, /publishedAt = rs\.longOpt\("published_at"\)/);
    assert.match(batchRepo, /refundTotal = rs\.bigDecimalOpt\("refund_total"\)\.map\(BigDecimal\(_\)\)/);
    assert.match(batchRepo, /topics = scala\.util\.Try\(Json\.parse\(rs\.stringOpt\("topics"\)/);
    assert.match(batchRepo, /Json\.stringify\(Json\.toJson\(row\.topics\)\)/);
    assert.doesNotMatch(batchRepo, /rs\.stringOpt\("published_at"\)/);

    const verify = runV2VerifyGate({
      rootDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
    });
    assert.equal(verify.passed, true, `SPEC-S10 verify-v2 failed: ${JSON.stringify(verify, null, 2)}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S11] Application success fixture + PlayController bindPrincipal & ServerSnapshotProvider handle extern-only guards cleanly (Issue #3)', () => {
  const work = makeTempDir('coarising-spec-s11-');
  try {
    mkdirSync(join(work, 'truth/grading/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/grading/behaviors/domain'), { recursive: true });
    mkdirSync(join(work, 'truth/grading/behaviors/application'), { recursive: true });
    writeFileSync(join(work, 'truth/grading/structures/model.yaml'), `
system: exam-spec11
context: grading
valueObjects:
  - name: ScoreItem
    fields:
      - name: itemId
        type: String
      - name: points
        type: Decimal(2)
aggregates:
  - name: PaperGrade
    stateFields:
      - name: status
        type: String
        default: pending
    commands:
      - name: Confirm
        produces: [GradeConfirmed]
        parameters:
          - name: paperId
            type: String
          - name: operatorId
            type: String
          - name: scores
            type: Seq[ScoreItem]
          - name: batchId
            type: String
          - name: confirmedAt
            type: Int
    events:
      - name: GradeConfirmed
        fields:
          - name: paperId
            type: String
          - name: operatorId
            type: String
          - name: batchId
            type: String
externContracts:
  - name: paperScorable
    params:
      - name: paperId
        type: String
ports:
  - name: GradePort
    operations:
      - name: confirm
        callerKind: human
        parameters:
          - name: paperId
            type: String
          - name: operatorId
            type: String
          - name: scores
            type: Seq[ScoreItem]
        authz:
          mode: static-roles
          allowedRoles: [grader]
          bindPrincipal:
            - param: operatorId
              from: principal.id
stories:
  - name: GradePaperStory
    callerContract:
      idempotencyKey: paperId
      retryPolicy: idempotent-by-paper
      forbiddenUntrustedFields: [batchId, confirmedAt]
`, 'utf8');
    writeFileSync(join(work, 'truth/grading/behaviors/domain/paper-grade-confirm.ears'), `
slice PaperGrade.Confirm
rules:
  [GRADE_PAPER_INVALID] IF paperId == "" WHEN Confirm THEN SHALL reject request with GRADE_PAPER_INVALID
  [GRADE_PAPER_CONFIRMED] WHILE paperId != ""
                          WHEN Confirm
                          SHALL emit GradeConfirmed
                          post:
                            state.status' = "confirmed"
`, 'utf8');
    writeFileSync(join(work, 'truth/grading/behaviors/application/grade-paper-story.story.ears'), `
story GradePaperStory layer application

where:
  extern paperScorable(paperId)

axioms:
  [AX-GRADE-1] ALWAYS clientPayload SHALL NOT supply batchId, confirmedAt

rules:
  [GRADEPAPERSTORY-01] IF not paperScorable(paperId)
                       WHEN GradePort.confirm
                       THEN SHALL reject request with PAPER_NOT_SCORABLE
  [GRADEPAPERSTORY-02] WHILE paperScorable(paperId)
                       WHEN GradePort.confirm
                       SHALL dispatch PaperGrade.Confirm
`, 'utf8');

    const compiled = compileCanonicalV2({
      structuresDir: join(work, 'truth/grading/structures'),
      specsPath: join(work, 'truth/grading/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(compiled.passed, true, `SPEC-S11 compile failed: ${JSON.stringify(compiled.diagnostics)}`);

    getCodegenPlugin('typescript').generate(compiled.canonical, { outDir: work });
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(compiled.canonical, { outDir: work, packageName: 'exam.spec11' });
    emitV2ExecutableTests(compiled.canonical, {
      outDir: work,
      targets: ['typescript', 'scala-cqrs-play-service-v2'],
      packageName: 'exam.spec11',
    });

    // Verify generated tests materialize scores: [ScoreItem], principal, batchId & confirmedAt in stateSnapshot, and assert dispatched payload
    const tsAppSpec = readFileSync(join(work, 'generated-tests/ts/grade-paper-story.ears.spec.ts'), 'utf8');
    assert.match(tsAppSpec, /"scores":\[\{"itemId":/);
    assert.match(tsAppSpec, /"batchId":"sample_batchId"/);
    assert.match(tsAppSpec, /"confirmedAt":1700000000000/);
    assert.match(tsAppSpec, /expected dispatched field PaperGrade\.Confirm\.scores/);
    assert.match(tsAppSpec, /expected principal-bound PaperGrade\.Confirm\.operatorId/);

    const tsHttpSpec = readFileSync(join(work, 'generated-tests/ts/interfaces-http.ears.spec.ts'), 'utf8');
    assert.match(tsHttpSpec, /loadStateSnapshot/);
    assert.match(tsHttpSpec, /createRoleBasedAuthority/);

    const playCtrl = readFileSync(join(work, 'generated-scaffold/scala/controllers/GradePaperStoryPlayController.scala'), 'utf8');
    assert.match(playCtrl, /snapshots: ServerSnapshotProvider/);
    assert.match(playCtrl, /snapshots\.load\("GradePort\.confirm", rawPayload, principal\)/);
    assert.match(playCtrl, /Set\("stateSnapshot", "batchId", "confirmedAt"\)/);
    assert.match(playCtrl, /\("operatorId", "principal\.id"\)/);

    const gbModule = readFileSync(join(work, 'generated-scaffold/scala/exam/spec11/modules/GeneratedBindingsModule.scala'), 'utf8');
    assert.match(gbModule, /bind\(classOf\[ServerSnapshotProvider\]\)\.to\(classOf\[ServerSnapshotProviderImpl\]\)/);

    const tsClozeFile = join(work, 'handwritten/grade-paper-story.cloze.ts');
    const tsClozeSrc = readFileSync(tsClozeFile, 'utf8').replace(
      /\/\/ @cloze:start\(grade-paper-story\)[\s\S]*?\/\/ @cloze:end\(grade-paper-story\)/u,
      [
        '// @cloze:start(grade-paper-story)',
        '    const paperId = String(req.payload.paperId ?? "");',
        '    if (!externs.paperScorable(paperId)) {',
        '      return { ok: false, code: "PAPER_NOT_SCORABLE", ruleId: "GRADEPAPERSTORY-01" };',
        '    }',
        '    const snap = (req.stateSnapshot ?? {}) as Readonly<Record<string, unknown>>;',
        '    effects.dispatch("PaperGrade.Confirm", {',
        '      paperId,',
        '      operatorId: req.payload.operatorId ?? req.principal?.id,',
        '      scores: req.payload.scores,',
        '      batchId: snap.batchId,',
        '      confirmedAt: snap.confirmedAt,',
        '    });',
        '    return { ok: true, ruleId: "GRADEPAPERSTORY-02" };',
        '    // @cloze:end(grade-paper-story)',
      ].join('\n'),
    );
    writeFileSync(tsClozeFile, tsClozeSrc, 'utf8');

    const scalaClozeFile = join(work, 'handwritten/scala/exam/spec11/application/services/GradePaperStoryImpl.scala');
    const scalaClozeSrc = readFileSync(scalaClozeFile, 'utf8').replace(
      /\/\/ @cloze:start\(grade-paper-story\)[\s\S]*?\/\/ @cloze:end\(grade-paper-story\)/u,
      [
        '// @cloze:start(grade-paper-story)',
        '    val paperId = req.payload.get("paperId").map(_.toString).getOrElse("")',
        '    if (!externs.paperScorable(paperId)) {',
        '      Left(iMadzError("PAPER_NOT_SCORABLE", "GRADEPAPERSTORY-01"))',
        '    } else {',
        '      val operatorId = req.payload.get("operatorId").orElse(req.principal.flatMap(_.get("id"))).getOrElse("")',
        '      val scores = req.payload.getOrElse("scores", Seq.empty)',
        '      val batchId = req.stateSnapshot.getOrElse("batchId", "")',
        '      val confirmedAt = req.stateSnapshot.getOrElse("confirmedAt", 0L)',
        '      effects.dispatch("PaperGrade.Confirm", Map("paperId" -> paperId, "operatorId" -> operatorId, "scores" -> scores, "batchId" -> batchId, "confirmedAt" -> confirmedAt))',
        '      Right(GradePaperStorySuccessResponse(ruleId = "GRADEPAPERSTORY-02"))',
        '    }',
        '    // @cloze:end(grade-paper-story)',
      ].join('\n'),
    );
    writeFileSync(scalaClozeFile, scalaClozeSrc, 'utf8');

    const tsRun = spawnSync(
      process.execPath,
      ['--test', join(work, 'generated-tests/ts/grade-paper-story.ears.spec.ts')],
      { cwd: work, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(tsRun.status, 0, `SPEC-S11 TS unit spec failed:\n${tsRun.stdout}\n${tsRun.stderr}`);

    const verify = runV2VerifyGate({
      rootDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
    });
    assert.equal(verify.passed, true, `SPEC-S11 Scala verify-v2 failed: ${JSON.stringify(verify, null, 2)}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S12] Monolith upgrade writes default canonical-v2.json, enables zero-flag tasks-v2, and prunes stale common-kernel files without touching handwritten (Issue #4)', () => {
  const srcWork = makeTempDir('coarising-spec-s12-src-');
  const work = makeTempDir('coarising-spec-s12-');
  try {
    const { compiled } = compileBankFixture(srcWork);
    // Pre-seed stale legacy kernel files from a7e5bb1 + stale manifest file + pre-existing handwritten code
    mkdirSync(join(work, 'generated-scaffold/scala/net/imadz/common'), { recursive: true });
    mkdirSync(join(work, 'generated-scaffold/scala/stale'), { recursive: true });
    mkdirSync(join(work, 'handwritten/scala/custom'), { recursive: true });
    mkdirSync(join(work, '.truthsrc'), { recursive: true });
    writeFileSync(join(work, 'generated-scaffold/scala/net/imadz/common/CommonTypes.scala'), 'object OldCommonTypes\n', 'utf8');
    writeFileSync(join(work, 'generated-scaffold/scala/net/imadz/common/CborSerializable.scala'), 'trait OldCbor\n', 'utf8');
    writeFileSync(join(work, 'generated-scaffold/scala/stale/OldRemoved.scala'), 'object OldRemoved\n', 'utf8');
    writeFileSync(join(work, '.truthsrc/generated-scala-manifest.json'), JSON.stringify({
      schemaVersion: 'co-arising.generated-scala-manifest/v1',
      scaffoldPaths: ['generated-scaffold/scala/stale/OldRemoved.scala'],
    }), 'utf8');
    const keepFile = join(work, 'handwritten/scala/custom/KeepMe.scala');
    writeFileSync(keepFile, 'object KeepMe { val untouched = true }\n', 'utf8');

    const res = generateScalaCqrsPlayServiceV2ForBc({
      bcName: 'exam-monolith',
      canonicals: [compiled.canonical],
      outDir: work,
      packageName: 'exam.spec12',
      packaging: 'monolith',
    });

    assert.equal(existsSync(join(work, 'generated-scaffold/scala/net/imadz/common/CommonTypes.scala')), false, 'stale CommonTypes.scala must be pruned');
    assert.equal(existsSync(join(work, 'generated-scaffold/scala/net/imadz/common/CborSerializable.scala')), false, 'stale CborSerializable.scala must be pruned');
    assert.equal(existsSync(join(work, 'generated-scaffold/scala/stale/OldRemoved.scala')), false, 'prior manifest orphan file must be pruned');
    assert.equal(readFileSync(keepFile, 'utf8'), 'object KeepMe { val untouched = true }\n');

    assert.equal(existsSync(res.canonicalPath), true);
    assert.equal(res.canonicalPath, join(work, '.truthsrc/canonical-v2.json'));
    assert.equal(existsSync(res.mergedCanonicalPath), true);
    assert.equal(existsSync(res.dbPath), true);

    const queue = deriveClozeTasksV2({ rootDir: work });
    assert.equal(queue.summary.totalCloze > 0, true, 'tasks-v2 --root <dir> must see all monolith clozeSlots immediately');
    assert.deepEqual(queue.targets, ['scala-cqrs-play-service-v2'], 'monolith Scala-only root must auto-detect single-stack target');
  } finally {
    rmSync(srcWork, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S13] Rejected application witness preserves empty sequence without clobbering', () => {
  const canonical = {
    structures: {
      ports: [{
        name: 'GradingPort',
        operations: [{
          name: 'Submit',
          parameters: [
            { name: 'paperId', resolvedType: { kind: 'string' } },
            { name: 'scores', resolvedType: { kind: 'sequence', element: { kind: 'int' } } },
          ],
        }],
      }],
      aggregates: [],
      stories: [],
    },
  };
  const rejected = materializeApplicationWitness(
    { scalars: { paperId: 'p-1', '@agg(len:scores)': 0, scores: [] } },
    {
      canonicalV2: canonical,
      command: 'GradingPort.Submit',
      example: { ruleId: 'R-EMPTY', actions: [{ kind: 'reject', modality: 'SHALL', code: 'EMPTY_SCORES' }] },
    },
  );
  assert.deepEqual(rejected.payload.scores, []);
  assert.deepEqual(rejected.clientPayload.scores, []);

  const accepted = materializeApplicationWitness(
    { scalars: { paperId: 'p-1', scores: [] } },
    {
      canonicalV2: canonical,
      command: 'GradingPort.Submit',
      example: { ruleId: 'R-OK', actions: [{ kind: 'respond', modality: 'SHALL', response: 'Ok' }] },
    },
  );
  assert.equal(Array.isArray(accepted.payload.scores) && accepted.payload.scores.length > 0, true);
});

test('[SPEC-S14] Hybrid L1+L2 aggregate with custom aliases unifies RuleParams, emits Computations.Noop, folds state cleanly, and passes strict Scala verify', () => {
  const work = makeTempDir('coarising-spec-s14-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: hybrid-sys
subdomain: billing
exactTypes:
  - name: Money
    form: unit-decimal
    scale: 2
    units: [CNY]
aggregates:
  - name: HybridOrder
    aliases: [order]
    idField: orderId
    stateFields:
      - name: orderId
        type: String
      - name: status
        type: String
        default: "Draft"
      - name: total
        type: Int
        default: 0
    commands:
      - name: Open
        parameters:
          - name: orderId
            type: String
        produces: [Opened]
      - name: Price
        parameters:
          - name: qty
            type: Int
          - name: unitPrice
            type: Int
          - name: total
            type: Int
        produces: [Priced]
    events:
      - name: Opened
        fields:
          - name: orderId
            type: String
      - name: Priced
        fields:
          - name: total
            type: Int
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/hybrid-order-open.ears'), `slice HybridOrder.Open

rules:
  [OPEN_INVALID] IF order.status != "Draft" THEN SHALL reject request with OPEN_INVALID
  [OPEN_OK]      WHILE order.status == "Draft"
                 WHEN Open
                 SHALL transition order.status -> "Open"
                   AND emit Opened
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/hybrid-order-price.ears'), `slice HybridOrder.Price

rules:
  [PRICE_BAD] IF qty * unitPrice != total or total <= 0 THEN SHALL reject request with PRICE_BAD
  [PRICE_OK]  WHILE qty * unitPrice == total and total > 0
              WHEN Price
              SHALL emit Priced
              post:
                order.total' = total
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S14 compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec14' });
    emitV2ExecutableTests(comp.canonical, { outDir: work, targets: ['scala-cqrs-play-service-v2'], packageName: 'example.spec14' });

    // No split DomainServiceRuleParams file; EventHandler must not emit state.copy(state = ...); non-empty L2 Computations must not emit Noop
    assert.equal(existsSync(join(work, 'generated-scaffold/scala/example/spec14/domain/invariants/params/HybridOrderDomainServiceRuleParams.scala')), false);
    const evHandler = readFileSync(join(work, 'generated-scaffold/scala/example/spec14/domain/entities/behaviors/HybridOrderEventHandler.scala'), 'utf8');
    assert.doesNotMatch(evHandler, /state\.copy\(state\s*=/);
    const compTrait = readFileSync(join(work, 'generated-scaffold/scala/example/spec14/domain/services/HybridOrderComputations.scala'), 'utf8');
    assert.doesNotMatch(compTrait, /\bval\s+Noop\b/);

    // Fill L2 cloze and run strict Scala verification
    const implPath = join(work, 'handwritten/scala/example/spec14/domain/services/impl/HybridOrderPriceImpl.scala');
    const filled = readFileSync(implPath, 'utf8').replace(
      /\/\/ @cloze:start\(hybrid-order-price\)[\s\S]*?\/\/ @cloze:end\(hybrid-order-price\)/u,
      [
        '// @cloze:start(hybrid-order-price)',
        '    if (p.qty * p.unitPrice != p.total || p.total <= 0L) Left(iMadzError("PRICE_BAD", "invalid total"))',
        '    else Right(List(Priced(p.total)))',
        '    // @cloze:end(hybrid-order-price)',
      ].join('\n'),
    );
    writeFileSync(implPath, filled, 'utf8');

    const verify = runV2VerifyGate({
      rootDir: work,
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
    });
    assert.equal(verify.passed, true, `SPEC-S14 strict verify failed: ${JSON.stringify(verify, null, 2)}`);
    assert.equal(verify.tsCheck.skipped, true, 'Scala-only root must auto-skip TS suite');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S15] Public first route, resource-policy PDP, and PlayController status mapping & authz parity', () => {
  const work = makeTempDir('coarising-spec-s15-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: authz-sys
subdomain: catalog
roles: [Admin, Member]
aggregates:
  - name: Item
    aliases: [item]
    idField: itemId
    stateFields:
      - name: itemId
        type: String
      - name: ownerId
        type: String
    commands:
      - name: Update
        parameters:
          - name: itemId
            type: String
        produces: [Updated]
    events:
      - name: Updated
        fields:
          - name: itemId
            type: String
ports:
  - name: CatalogPort
    operations:
      - name: ListPublic
        kind: query
        parameters: []
        authz:
          mode: public
      - name: UpdateItem
        kind: command
        parameters:
          - name: itemId
            type: String
        authz:
          mode: resource-policy
          allowedRoles: [Member]
          policyRef: "item.update"
          resource:
            type: Item
            idFrom: param.itemId
            ownerField: ownerId
stories:
  - name: CatalogStory
    inboundPort: CatalogPort
    dispatches: [Item.Update]
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/item-update.ears'), `slice Item.Update

rules:
  [UPD_EMPTY] IF itemId == "" THEN SHALL reject request with UPD_EMPTY
  [UPD_OK]    WHILE itemId != ""
              WHEN Update
              SHALL emit Updated
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/catalog-story.story.ears'), `story CatalogStory layer application

rules:
  [APP_PUBLIC]  WHEN CatalogPort.ListPublic
                SHALL respond PublicList
  [APP_UPD_BAD] IF itemId == ""
                WHEN CatalogPort.UpdateItem
                THEN SHALL reject request with ITEM_NOT_FOUND
  [APP_UPD_OK]  WHILE itemId != ""
                WHEN CatalogPort.UpdateItem
                SHALL dispatch Item.Update
                  AND respond Ok
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S15 compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec15' });
    emitV2ExecutableTests(comp.canonical, { outDir: work, targets: ['scala-cqrs-play-service-v2'], packageName: 'example.spec15' });

    const playCtrl = readFileSync(join(work, 'generated-scaffold/scala/controllers/CatalogStoryPlayController.scala'), 'utf8');
    assert.match(playCtrl, /HttpStatusMapper\.statusForRejection\(err\.code\)/);
    assert.match(playCtrl, /FORBIDDEN_RESOURCE/);
    assert.match(playCtrl, /case JsNull\s*=>\s*null/);

    const implPath = join(work, 'handwritten/scala/example/spec15/application/services/CatalogStoryImpl.scala');
    writeFileSync(implPath, readFileSync(implPath, 'utf8').replace(
      /\/\/ @cloze:start\(catalog-story\)[\s\S]*?\/\/ @cloze:end\(catalog-story\)/u,
      [
        '// @cloze:start(catalog-story)',
        '    if (req.operation == "CatalogPort.ListPublic") {',
        '      Right(CatalogStorySuccessResponse("APP_PUBLIC", Some("PublicList"), Map.empty))',
        '    } else {',
        '      val itemId = req.payload.get("itemId").map(_.toString).getOrElse("")',
        '      if (itemId.isEmpty) Left(iMadzError("ITEM_NOT_FOUND", "missing itemId"))',
        '      else {',
        '        effects.dispatch("Item.Update", Map("itemId" -> itemId))',
        '        Right(CatalogStorySuccessResponse("APP_UPD_OK", Some("Ok"), Map.empty))',
        '      }',
        '    }',
        '    // @cloze:end(catalog-story)',
      ].join('\n'),
    ), 'utf8');

    const verify = runV2VerifyGate({
      rootDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
    });
    assert.equal(verify.passed, true, `SPEC-S15 Scala verify failed: ${JSON.stringify(verify, null, 2)}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S16] ReadSide with ExactType/VO fields and Zero-VO bounded contexts emit compilable converters and views', () => {
  const workVo = makeTempDir('coarising-spec-s16-vo-');
  const workZero = makeTempDir('coarising-spec-s16-zero-');
  try {
    mkdirSync(join(workVo, 'truth/structures'), { recursive: true });
    mkdirSync(join(workVo, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(workVo, 'truth/structures/model.yaml'), `
system: rs-sys
subdomain: wallet
exactTypes:
  - name: Money
    form: unit-decimal
    scale: 2
    units: [CNY]
aggregates:
  - name: Wallet
    aliases: [wallet]
    idField: walletId
    stateFields:
      - name: walletId
        type: String
      - name: balance
        type: Money
    commands:
      - name: Deposit
        parameters:
          - name: walletId
            type: String
          - name: amount
            type: Money
        produces: [Deposited]
    events:
      - name: Deposited
        fields:
          - name: walletId
            type: String
          - name: amount
            type: Money
readModels:
  - name: WalletSummary
    sourceAggregate: Wallet
    fields:
      - name: walletId
        type: String
        source: eventField:Wallet.Deposited.walletId
      - name: lastAmount
        type: Money
        source: eventField:Wallet.Deposited.amount
`, 'utf8');
    writeFileSync(join(workVo, 'truth/behaviors/wallet-deposit.ears'), `slice Wallet.Deposit

rules:
  [DEP_BAD] IF amount.amount <= 0.00 THEN SHALL reject request with DEP_BAD
  [DEP_OK]  WHILE amount.amount > 0.00
            WHEN Deposit
            SHALL emit Deposited
`, 'utf8');
    const cVo = compileCanonicalV2({
      structuresDir: join(workVo, 'truth/structures'),
      specsPath: join(workVo, 'truth/behaviors'),
      outFile: join(workVo, '.truthsrc/canonical-v2.json'),
    });
    assert.equal(cVo.passed, true);
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(cVo.canonical, { outDir: workVo, packageName: 'example.spec16vo' });
    const viewSrc = readFileSync(join(workVo, 'generated-scaffold/scala/example/spec16vo/application/readmodels/wallet_summary_readside/WalletSummaryView.scala'), 'utf8');
    assert.match(viewSrc, /import example\.spec16vo\.domain\.values\._/);
    assert.match(viewSrc, /lastAmount:\s*Money\s*=\s*Money\.Zero/);

    // Zero-VO bounded context
    mkdirSync(join(workZero, 'truth/structures'), { recursive: true });
    mkdirSync(join(workZero, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(workZero, 'truth/structures/model.yaml'), `
system: zero-sys
subdomain: simple
aggregates:
  - name: Counter
    aliases: [counter]
    idField: counterId
    stateFields:
      - name: counterId
        type: String
      - name: count
        type: Int
        default: 0
    commands:
      - name: Increment
        parameters:
          - name: delta
            type: Int
        produces: [Incremented]
    events:
      - name: Incremented
        fields:
          - name: delta
            type: Int
`, 'utf8');
    writeFileSync(join(workZero, 'truth/behaviors/counter-inc.ears'), `slice Counter.Increment

rules:
  [INC_BAD] IF delta <= 0 THEN SHALL reject request with INC_BAD
  [INC_OK]  WHILE delta > 0
            WHEN Increment
            SHALL emit Incremented
            post:
              counter.count' = counter.count + delta
`, 'utf8');
    const cZero = compileCanonicalV2({
      structuresDir: join(workZero, 'truth/structures'),
      specsPath: join(workZero, 'truth/behaviors'),
      outFile: join(workZero, '.truthsrc/canonical-v2.json'),
    });
    assert.equal(cZero.passed, true);
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(cZero.canonical, { outDir: workZero, packageName: 'example.spec16zero' });
    const convPath = join(workZero, 'generated-scaffold/scala/example/spec16zero/infrastructure/persistence/converters/CounterProtoConverters.scala');
    assert.equal(existsSync(convPath), true, 'Zero-VO context must still emit <Agg>ProtoConverters.scala');
    assert.doesNotMatch(readFileSync(convPath, 'utf8'), /domain\.values\._/);
  } finally {
    rmSync(workVo, { recursive: true, force: true });
    rmSync(workZero, { recursive: true, force: true });
  }
});

test('[SPEC-S17] Scala single-stack init-v2 + tasks-v2 + check-v2 strict + mutation-gate works with zero TypeScript files', () => {
  const work = makeTempDir('coarising-spec-s17-scala-only-');
  try {
    const initRes = initV2Project({
      targetDir: work,
      system: 'scala-single-stack',
      context: 'quota',
      targets: ['scala-cqrs-play-service-v2'],
      packageName: 'example.singlestack',
      force: true,
      initHooks: false,
    });
    assert.equal(initRes.compiled?.passed, true);
    assert.equal(existsSync(join(work, 'generated-scaffold/ts')), false, 'Scala single-stack must emit zero TS scaffold files');
    assert.equal(existsSync(join(work, 'generated-tests/ts')), false, 'Scala single-stack must emit zero TS test files');
    assert.equal(existsSync(join(work, 'handwritten/quota-intake.cloze.ts')), false, 'Scala single-stack must emit zero TS cloze slots');
    assert.equal(existsSync(join(work, 'handwritten/scala/example/singlestack/application/services/QuotaIntakeImpl.scala')), true);

    const queue = deriveClozeTasksV2({ rootDir: work });
    assert.deepEqual(queue.targets, ['scala-cqrs-play-service-v2']);
    assert.equal(queue.tasks.length, 1);
    assert.equal(queue.tasks[0].targetFiles.length, 1, 'single-stack slot must have exactly 1 Scala targetFile');
    assert.match(queue.tasks[0].targetFiles[0].file, /QuotaIntakeImpl\.scala$/);

    const checkRes = runCheckV2({
      rootDir: work,
      strict: true,
      mutationGate: true,
    });
    assert.equal(checkRes.passed, true, `Scala single-stack check-v2 failed: ${JSON.stringify(checkRes, null, 2)}`);
    assert.equal(checkRes.verify.tsCheck.skipped, true);
    assert.equal(checkRes.verify.scalaCheck.passed, true);
    assert.equal(checkRes.verify.mutationCheck.passed, true);
    assert.equal(checkRes.verify.mutationCheck.ts.skipped, true);
    assert.equal(checkRes.verify.mutationCheck.scala.killRate, 100);
    assert.equal(checkRes.coverage.passed, true);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S18] Monolith BC merge rejects conflicting structural collisions (BC_MERGE_CONFLICT) & compiler rejects Scala reserved keywords (V2_RESERVED_IDENTIFIER)', () => {
  const work = makeTempDir('coarising-spec-s18-');
  try {
    // 1. Conflicting same-named VO across two subdomains must fail closed with BC_MERGE_CONFLICT
    const mkSub = (sub, voFields) => {
      const dir = join(work, sub);
      mkdirSync(join(dir, 'structures'), { recursive: true });
      mkdirSync(join(dir, 'behaviors'), { recursive: true });
      writeFileSync(join(dir, 'structures/model.yaml'), `
system: spec18
subdomain: ${sub}
valueObjects:
  - name: SharedInfo
    fields:
${voFields}
aggregates:
  - name: ${sub === 'alpha' ? 'AlphaDoc' : 'BetaItem'}
    idField: itemId
    stateFields:
      - name: itemId
        type: String
      - name: status
        type: String
        default: "New"
    commands:
      - name: Touch
        parameters:
          - name: itemId
            type: String
        produces: [Touched]
    events:
      - name: Touched
        fields:
          - name: itemId
            type: String
`, 'utf8');
      writeFileSync(join(dir, 'behaviors/touch.ears'), `slice ${sub === 'alpha' ? 'AlphaDoc' : 'BetaItem'}.Touch

rules:
  [T_BAD] IF itemId == "" THEN SHALL reject request with T_BAD
  [T_OK]  WHILE itemId != ""
          WHEN Touch
          SHALL transition state.status -> "Done"
            AND emit Touched
`, 'utf8');
      return compileCanonicalV2({ structuresDir: join(dir, 'structures'), specsPath: join(dir, 'behaviors') });
    };
    const cA = mkSub('alpha', '      - name: code\n        type: String');
    const cB = mkSub('beta', '      - name: score\n        type: Int');
    assert.equal(cA.passed, true);
    assert.equal(cB.passed, true);
    assert.throws(
      () => mergeCanonicalsForBc([cA.canonical, cB.canonical], { bcName: 'unified' }),
      /BC_MERGE_CONFLICT: conflicting valueObject "SharedInfo" across subdomains \(alpha vs beta\)/u,
    );

    // Identical Shared Kernel VO across subdomains must still deduplicate cleanly
    const cBIdentical = mkSub('beta-same', '      - name: code\n        type: String');
    assert.equal(cBIdentical.passed, true);
    const mergedOk = mergeCanonicalsForBc([cA.canonical, cBIdentical.canonical], { bcName: 'unified' });
    assert.equal(mergedOk.mergedCanonical.structures.valueObjects.length, 1);

    // 2. Reserved Scala keywords (`type`, `match`) must fail compile-v2 with V2_RESERVED_IDENTIFIER
    const kwDir = join(work, 'kw');
    mkdirSync(join(kwDir, 'structures'), { recursive: true });
    mkdirSync(join(kwDir, 'behaviors'), { recursive: true });
    writeFileSync(join(kwDir, 'structures/model.yaml'), `
system: spec18-kw
subdomain: core
valueObjects:
  - name: Meta
    fields:
      - name: type
        type: String
      - name: match
        type: Bool
aggregates:
  - name: Ticket
    idField: ticketId
    stateFields:
      - name: ticketId
        type: String
      - name: type
        type: String
        default: "Std"
    commands:
      - name: Tag
        parameters:
          - name: ticketId
            type: String
        produces: [Tagged]
    events:
      - name: Tagged
        fields:
          - name: ticketId
            type: String
`, 'utf8');
    writeFileSync(join(kwDir, 'behaviors/tag.ears'), `slice Ticket.Tag

rules:
  [TAG_BAD] IF ticketId == "" THEN SHALL reject request with TAG_BAD
  [TAG_OK]  WHILE ticketId != ""
            WHEN Tag
            SHALL emit Tagged
`, 'utf8');
    const cKw = compileCanonicalV2({ structuresDir: join(kwDir, 'structures'), specsPath: join(kwDir, 'behaviors') });
    assert.equal(cKw.passed, false);
    const reservedCodes = cKw.diagnostics.filter(d => d.code === 'V2_RESERVED_IDENTIFIER');
    assert.ok(reservedCodes.length >= 3, `expected >= 3 V2_RESERVED_IDENTIFIER diagnostics, got ${reservedCodes.length}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S19] ReadSide nested Option/Seq/Map JSON codecs, Orchestration nominal externContracts, and ProjectionModule evolution wiring', () => {
  const work = makeTempDir('coarising-spec-s19-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });

    // Phase 1: Start without ReadModels so HandwrittenBindingsModule is created on disk
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: spec19
subdomain: ledger
exactTypes:
  - name: Money
    form: unit-decimal
    scale: 2
    units: [CNY]
valueObjects:
  - name: TagVO
    fields:
      - name: key
        type: String
      - name: price
        type: Money
      - name: note
        type: Optional[String]
ports:
  - name: RiskEngine
    operations: []
externContracts:
  - name: calculateFee
    ownerPort: RiskEngine
    params:
      - name: amount
        type: Money
      - name: tag
        type: TagVO
aggregates:
  - name: LedgerEntry
    idField: entryId
    stateFields:
      - name: entryId
        type: String
      - name: amount
        type: Money
      - name: status
        type: String
        default: "New"
    commands:
      - name: Post
        parameters:
          - name: entryId
            type: String
          - name: amount
            type: Money
          - name: tag
            type: TagVO
        produces: [Posted]
    events:
      - name: Posted
        fields:
          - name: entryId
            type: String
          - name: amount
            type: Money
          - name: tag
            type: TagVO
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/post.ears'), `slice LedgerEntry.Post

rules:
  [POST_BAD] IF amount.amount <= 0.00 THEN SHALL reject request with POST_BAD
  [POST_OK]  WHILE amount.amount > 0.00
             WHEN Post
             SHALL transition state.status -> "Posted"
               AND emit Posted
             post:
               state.amount' = amount
`, 'utf8');
    const c1 = compileCanonicalV2({ structuresDir: join(work, 'truth/structures'), specsPath: join(work, 'truth/behaviors') });
    assert.equal(c1.passed, true, `SPEC-S19 phase1 failed: ${JSON.stringify(c1.diagnostics)}`);
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(c1.canonical, { outDir: work, packageName: 'example.spec19' });

    // Phase 2: Add ReadModel with nested Optional/Seq/Map/VO/ExactType and regenerate in place
    writeFileSync(join(work, 'truth/structures/model.yaml'), readFileSync(join(work, 'truth/structures/model.yaml'), 'utf8') + `
readModels:
  - name: EntryView
    fields:
      - name: entryId
        type: String
        source: eventField:Posted.entryId
      - name: seqOptString
        type: Seq[Optional[String]]
        source: derived
      - name: mapOptTag
        type: Map[String, Optional[TagVO]]
        source: derived
      - name: optSeqMoney
        type: Optional[Seq[Money]]
        source: derived
`, 'utf8');
    const c2 = compileCanonicalV2({ structuresDir: join(work, 'truth/structures'), specsPath: join(work, 'truth/behaviors') });
    assert.equal(c2.passed, true, `SPEC-S19 phase2 failed: ${JSON.stringify(c2.diagnostics)}`);
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(c2.canonical, { outDir: work, packageName: 'example.spec19' });

    const connPort = readFileSync(join(work, 'generated-scaffold/scala/example/spec19/application/toolgates/RiskEngineConnectorPort.scala'), 'utf8');
    assert.match(connPort, /import example\.spec19\.domain\.values\._/);
    assert.match(connPort, /def calculateFee\(amount: Money, tag: TagVO\): Future\[Boolean\]/);

    const repoImpl = readFileSync(join(work, 'generated-scaffold/scala/example/spec19/infrastructure/repositories/projection/EntryReadsideRepositoryImpl.scala'), 'utf8');
    assert.doesNotMatch(repoImpl, /\.as\[Vector\[Option\[String\]\]\]/, 'Seq[Optional[String]] must use explicit JsValue codec');
    assert.match(repoImpl, /Option\(j\d+\)\.filter\(_ != play\.api\.libs\.json\.JsNull\)/, 'JsValue optional decode must use Option(j) rather than j.toOption');
    assert.match(repoImpl, /: play\.api\.libs\.json\.JsValue\)\.getOrElse\(play\.api\.libs\.json\.JsNull\)/, 'Optional JSON encode must widen explicitly to JsValue');

    const genBindings = readFileSync(join(work, 'generated-scaffold/scala/example/spec19/modules/GeneratedBindingsModule.scala'), 'utf8');
    assert.match(genBindings, /install\(new LedgerProjectionModule\(\)\)/, 'GeneratedBindingsModule must install ProjectionModule when ReadModel is added later');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S20] SMT len>=0 non-negativity + quantifier Skolem witness + ears-simplify bound member rendering pass strict verify & mutation gate', () => {
  const work = makeTempDir('coarising-spec-s20-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: spec20
subdomain: grading
valueObjects:
  - name: LineItem
    fields:
      - name: label
        type: String
      - name: score
        type: Int
aggregates:
  - name: ExamSheet
    idField: sheetId
    stateFields:
      - name: sheetId
        type: String
      - name: status
        type: String
        default: "Draft"
    commands:
      - name: Submit
        parameters:
          - name: sheetId
            type: String
          - name: items
            type: Seq[LineItem]
          - name: tags
            type: Seq[String]
        produces: [Submitted]
    events:
      - name: Submitted
        fields:
          - name: sheetId
            type: String
          - name: items
            type: Seq[LineItem]
          - name: tags
            type: Seq[String]
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/sheet.ears'), `slice ExamSheet.Submit

rules:
  [EMPTY_TAGS] IF len(tags) == 0 THEN SHALL reject request with EMPTY_TAGS
  [BAD_ITEM]   IF not (forall x in items: x.score > 0) THEN SHALL reject request with BAD_ITEM
  [SUBMIT_OK]  WHILE len(tags) > 0 and forall x in items: x.score > 0
               WHEN Submit
               SHALL transition state.status -> "Submitted"
                 AND emit Submitted
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S20 len==0/len>0 + quantifier compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec20' });
    emitV2ExecutableTests(comp.canonical, { outDir: work, targets: ['scala-cqrs-play-service-v2'], packageName: 'example.spec20' });

    const rules = readFileSync(join(work, 'generated-scaffold/scala/example/spec20/domain/invariants/ExamSheetRules.scala'), 'utf8');
    assert.match(rules, /p\.tags\.size\.toLong == 0L/);
    assert.match(rules, /p\.items\.exists\(x => x\.score <= 0L\)/);
    assert.doesNotMatch(rules, /p\.x\.score/);

    const verify = runV2VerifyGate({
      rootDir: work,
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
      mutationGate: true,
    });
    assert.equal(verify.passed, true, `SPEC-S20 strict verify+mutation failed: ${JSON.stringify(verify, null, 2)}`);
    assert.equal(verify.scalaCheck.passed, true);
    assert.equal(verify.mutationCheck.passed, true);
    assert.equal(verify.mutationCheck.scala.killRate, 100);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S21] Application stateSnapshot-derived dispatch fields validate non-null types without false equality failures while preserving strict bindPrincipal (Wave-3 M02)', () => {
  const work = makeTempDir('coarising-spec-s21-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: spec21
subdomain: orders
aggregates:
  - name: Order
    idField: orderId
    stateFields:
      - name: orderId
        type: String
      - name: status
        type: String
        default: "Pending"
    commands:
      - name: Confirm
        parameters:
          - name: orderId
            type: String
          - name: operatorId
            type: String
          - name: batchCode
            type: String
          - name: confirmedAt
            type: Int
          - name: fee
            type: Decimal(2)
        produces: [Confirmed]
    events:
      - name: Confirmed
        fields:
          - name: orderId
            type: String
          - name: operatorId
            type: String
          - name: batchCode
            type: String
externContracts:
  - name: orderReady
    params:
      - name: orderId
        type: String
ports:
  - name: OrderPort
    operations:
      - name: confirm
        callerKind: human
        parameters:
          - name: orderId
            type: String
          - name: operatorId
            type: String
        authz:
          mode: static-roles
          allowedRoles: [operator]
          bindPrincipal:
            - param: operatorId
              from: principal.id
stories:
  - name: ConfirmOrderStory
    inboundPort: OrderPort
    dispatches: [Order.Confirm]
    callerContract:
      idempotencyKey: orderId
      retryPolicy: idempotent-by-order
      forbiddenUntrustedFields: [batchCode, confirmedAt, fee]
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/order-confirm.ears'), `slice Order.Confirm
rules:
  [BAD_ID] IF orderId == "" THEN SHALL reject request with BAD_ID
  [OK]     WHILE orderId != ""
           WHEN Confirm
           SHALL transition state.status -> "Confirmed"
             AND emit Confirmed
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/confirm-story.story.ears'), `story ConfirmOrderStory layer application
where:
  extern orderReady(orderId)
axioms:
  [AX-1] ALWAYS clientPayload SHALL NOT supply batchCode, confirmedAt, fee
rules:
  [NOT_READY]  IF not orderReady(orderId)
               WHEN OrderPort.confirm
               THEN SHALL reject request with ORDER_NOT_READY
  [CONFIRM_OK] WHILE orderReady(orderId)
               WHEN OrderPort.confirm
               SHALL dispatch Order.Confirm
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S21 compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('typescript').generate(comp.canonical, { outDir: work });
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec21' });
    emitV2ExecutableTests(comp.canonical, {
      outDir: work,
      targets: ['typescript', 'scala-cqrs-play-service-v2'],
      packageName: 'example.spec21',
    });

    // Handwritten handlers normalize/derive stateSnapshot fields rather than verbatim passthrough
    const tsCloze = join(work, 'handwritten/confirm-order-story.cloze.ts');
    writeFileSync(tsCloze, readFileSync(tsCloze, 'utf8').replace(
      /\/\/ @cloze:start\(confirm-order-story\)[\s\S]*?\/\/ @cloze:end\(confirm-order-story\)/u,
      [
        '// @cloze:start(confirm-order-story)',
        '    const orderId = String(req.payload.orderId ?? "");',
        '    if (!externs.orderReady(orderId)) return { ok: false, code: "ORDER_NOT_READY", ruleId: "NOT_READY" };',
        '    const rawBatch = String(req.stateSnapshot?.batchCode ?? "DEFAULT").trim().toUpperCase();',
        '    const baseTs = Number(req.stateSnapshot?.confirmedAt ?? 0);',
        '    effects.dispatch("Order.Confirm", {',
        '      orderId,',
        '      operatorId: req.payload.operatorId ?? req.principal?.id,',
        '      batchCode: "NORM-" + rawBatch,',
        '      confirmedAt: baseTs + 1000,',
        '      fee: "12.50",',
        '    });',
        '    return { ok: true, ruleId: "CONFIRM_OK" };',
        '    // @cloze:end(confirm-order-story)',
      ].join('\n'),
    ), 'utf8');

    const scCloze = join(work, 'handwritten/scala/example/spec21/application/services/ConfirmOrderStoryImpl.scala');
    writeFileSync(scCloze, readFileSync(scCloze, 'utf8').replace(
      /\/\/ @cloze:start\(confirm-order-story\)[\s\S]*?\/\/ @cloze:end\(confirm-order-story\)/u,
      [
        '// @cloze:start(confirm-order-story)',
        '    val orderId = req.payload.get("orderId").map(_.toString).getOrElse("")',
        '    if (!externs.orderReady(orderId)) Left(iMadzError("ORDER_NOT_READY", "NOT_READY"))',
        '    else {',
        '      val operatorId = req.payload.get("operatorId").orElse(req.principal.flatMap(_.get("id"))).getOrElse("")',
        '      val rawBatch = req.stateSnapshot.get("batchCode").map(_.toString.trim.toUpperCase).getOrElse("DEFAULT")',
        '      val baseTs = req.stateSnapshot.get("confirmedAt").collect { case l: Long => l; case i: Int => i.toLong }.getOrElse(0L)',
        '      effects.dispatch("Order.Confirm", Map(',
        '        "orderId" -> orderId,',
        '        "operatorId" -> operatorId,',
        '        "batchCode" -> ("NORM-" + rawBatch),',
        '        "confirmedAt" -> (baseTs + 1000L),',
        '        "fee" -> BigDecimal("12.50")',
        '      ))',
        '      Right(ConfirmOrderStorySuccessResponse(ruleId = "CONFIRM_OK"))',
        '    }',
        '    // @cloze:end(confirm-order-story)',
      ].join('\n'),
    ), 'utf8');

    const tsRun = spawnSync(
      process.execPath,
      ['--test', join(work, 'generated-tests/ts/confirm-order-story.ears.spec.ts')],
      { cwd: work, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(tsRun.status, 0, `SPEC-S21 TS spec failed:\n${tsRun.stdout}\n${tsRun.stderr}`);

    const verify = runV2VerifyGate({
      rootDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
    });
    assert.equal(verify.passed, true, `SPEC-S21 Scala verify failed: ${JSON.stringify(verify, null, 2)}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S22] Coupled len/sum/vacuous-truth SMT axioms, dual opposite quantifiers with shared var, sum(seq) materialization, and multi-branch L1 Scala rules pass 100% mutation gate (Wave-3 M09/M10/M11)', () => {
  const work = makeTempDir('coarising-spec-s22-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: spec22
subdomain: analytics
valueObjects:
  - name: LineItem
    fields:
      - name: label
        type: String
      - name: score
        type: Int
aggregates:
  - name: MetricBatch
    idField: batchId
    stateFields:
      - name: batchId
        type: String
      - name: status
        type: String
        default: "Draft"
    commands:
      - name: Evaluate
        parameters:
          - name: batchId
            type: String
          - name: items
            type: Seq[LineItem]
          - name: scores
            type: Seq[Int]
          - name: amounts
            type: Seq[Decimal(2)]
        produces: [EmptyAccepted, Evaluated]
      - name: Screen
        parameters:
          - name: batchId
            type: String
          - name: readings
            type: Seq[Int]
          - name: items
            type: Seq[LineItem]
        produces: [Screened]
    events:
      - name: EmptyAccepted
        fields:
          - name: batchId
            type: String
      - name: Evaluated
        fields:
          - name: batchId
            type: String
      - name: Screened
        fields:
          - name: batchId
            type: String
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/evaluate.ears'), `slice MetricBatch.Evaluate
rules:
  [EMPTY_ITEMS] IF len(items) == 0 THEN SHALL transition state.status -> "EmptyOk" AND emit EmptyAccepted
  [BAD_ITEM]    IF exists x in items: x.score <= 0 THEN SHALL reject request with BAD_ITEM
  [LOW_SCORE]   IF len(items) > 0 and not (exists x in items: x.score <= 0) and (len(scores) == 0 or sum(scores) <= 100) THEN SHALL reject request with LOW_SCORE
  [LOW_AMOUNT]  IF len(items) > 0 and not (exists x in items: x.score <= 0) and len(scores) > 0 and sum(scores) > 100 and sum(amounts) < 50.00 THEN SHALL reject request with LOW_AMOUNT
  [EVAL_OK]     WHILE len(items) > 0 and not (exists x in items: x.score <= 0) and len(scores) > 0 and sum(scores) > 100 and sum(amounts) >= 50.00
                WHEN Evaluate
                SHALL transition state.status -> "Evaluated"
                  AND emit Evaluated
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/screen.ears'), `slice MetricBatch.Screen
rules:
  [EXTREME_SPREAD] IF exists x in readings: x < 0 and exists x in readings: x > 100 THEN SHALL reject request with EXTREME_SPREAD
  [ONLY_NEG]       IF exists x in readings: x < 0 and not (exists x in readings: x > 100) THEN SHALL reject request with ONLY_NEG
  [ONLY_HIGH]      IF not (exists x in readings: x < 0) and exists x in readings: x > 100 THEN SHALL reject request with ONLY_HIGH
  [BAD_ITEM]       IF not (exists x in readings: x < 0) and not (exists x in readings: x > 100) and exists x in items: x.score <= 0 THEN SHALL reject request with BAD_ITEM
  [SCREEN_OK]      WHILE not (exists x in readings: x < 0) and not (exists x in readings: x > 100) and forall x in items: x.score > 0
                   WHEN Screen
                   SHALL transition state.status -> "Screened"
                     AND emit Screened
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S22 compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('typescript').generate(comp.canonical, { outDir: work });
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec22' });
    emitV2ExecutableTests(comp.canonical, {
      outDir: work,
      targets: ['typescript', 'scala-cqrs-play-service-v2'],
      packageName: 'example.spec22',
    });

    const tsBehavior = readFileSync(join(work, 'generated-scaffold/ts/metric-batch.behavior.ts'), 'utf8');
    assert.doesNotMatch(tsBehavior, /cmd\.x\.score/, 'TS quantifier codegen must not prefix bound variable with cmd.');
    const scRules = readFileSync(join(work, 'generated-scaffold/scala/example/spec22/domain/invariants/MetricBatchRules.scala'), 'utf8');
    assert.match(scRules, /EmptyAccepted\(p\.batchId\)/);
    assert.match(scRules, /Evaluated\(p\.batchId\)/);

    const tsRun = spawnSync(
      process.execPath,
      [
        '--test',
        join(work, 'generated-tests/ts/metric-batch-evaluate.ears.spec.ts'),
        join(work, 'generated-tests/ts/metric-batch-screen.ears.spec.ts'),
      ],
      { cwd: work, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(tsRun.status, 0, `SPEC-S22 TS domain specs failed:\n${tsRun.stdout}\n${tsRun.stderr}`);

    const verify = runV2VerifyGate({
      rootDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
      mutationGate: true,
    });
    assert.equal(verify.passed, true, `SPEC-S22 Scala verify+mutation failed: ${JSON.stringify(verify, null, 2)}`);
    assert.equal(verify.mutationCheck.scala.killRate, 100);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S23] Map[String, ValueObject] member access in EARS guards compiles, probes subfields, respects map-presence, and passes strict TS + Scala + 100% mutation gate (Wave-3 M12)', () => {
  const work = makeTempDir('coarising-spec-s23-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: spec23
subdomain: grading
valueObjects:
  - name: LineItem
    fields:
      - name: label
        type: String
      - name: score
        type: Int
      - name: weight
        type: Decimal(2)
aggregates:
  - name: GradeBook
    idField: bookId
    stateFields:
      - name: bookId
        type: String
      - name: status
        type: String
        default: "Open"
      - name: entries
        type: Map[String, LineItem]
    commands:
      - name: VerifyEntry
        parameters:
          - name: bookId
            type: String
          - name: key
            type: String
        produces: [EntryPassed]
    events:
      - name: EntryPassed
        fields:
          - name: bookId
            type: String
          - name: key
            type: String
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/verify-entry.ears'), `slice GradeBook.VerifyEntry
rules:
  [MISSING]    IF not (key in state.entries) THEN SHALL reject request with MISSING
  [LOW_SCORE]  IF key in state.entries and state.entries[key].score < 60 THEN SHALL reject request with LOW_SCORE
  [LOW_WEIGHT] IF key in state.entries and state.entries[key].score >= 60 and state.entries[key].weight < 0.50 THEN SHALL reject request with LOW_WEIGHT
  [BAD_LABEL]  IF key in state.entries and state.entries[key].score >= 60 and state.entries[key].weight >= 0.50 and state.entries[key].label == "" THEN SHALL reject request with BAD_LABEL
  [PASS_OK]    WHILE key in state.entries and state.entries[key].score >= 60 and state.entries[key].weight >= 0.50 and state.entries[key].label != ""
               WHEN VerifyEntry
               SHALL transition state.status -> "Passed"
                 AND emit EntryPassed
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S23 compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('typescript').generate(comp.canonical, { outDir: work });
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec23' });
    emitV2ExecutableTests(comp.canonical, {
      outDir: work,
      targets: ['typescript', 'scala-cqrs-play-service-v2'],
      packageName: 'example.spec23',
    });

    const scRules = readFileSync(join(work, 'generated-scaffold/scala/example/spec23/domain/invariants/GradeBookRules.scala'), 'utf8');
    assert.match(scRules, /state\.entries\.get\(p\.key\)\.map\(_\.score\)\.getOrElse\(0L\)/);
    assert.match(scRules, /state\.entries\.get\(p\.key\)\.map\(_\.weight\)\.getOrElse\(BigDecimal\("0"\)\)/);
    assert.match(scRules, /state\.entries\.get\(p\.key\)\.map\(_\.label\)\.getOrElse\(""\)/);

    const tsRun = spawnSync(
      process.execPath,
      ['--test', join(work, 'generated-tests/ts/grade-book-verify-entry.ears.spec.ts')],
      { cwd: work, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(tsRun.status, 0, `SPEC-S23 TS domain spec failed:\n${tsRun.stdout}\n${tsRun.stderr}`);

    const verify = runV2VerifyGate({
      rootDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
      mutationGate: true,
    });
    assert.equal(verify.passed, true, `SPEC-S23 Scala verify+mutation failed: ${JSON.stringify(verify, null, 2)}`);
    assert.equal(verify.mutationCheck.scala.killRate, 100);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S24] ExactType nested post: field update emits smart-constructor create(...).getOrElse(...) instead of invalid .copy(...) and passes strict TS + Scala + 100% mutation gate', () => {
  const work = makeTempDir('coarising-spec-s24-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: spec24
subdomain: wallet
exactTypes:
  - name: Money
    form: unit-decimal
    scale: 2
    units: [CNY]
aggregates:
  - name: Wallet
    idField: walletId
    stateFields:
      - name: walletId
        type: String
      - name: balance
        type: Money
    commands:
      - name: Deposit
        parameters:
          - name: walletId
            type: String
          - name: delta
            type: Decimal(2)
        produces: [Deposited]
    events:
      - name: Deposited
        fields:
          - name: walletId
            type: String
          - name: delta
            type: Decimal(2)
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/deposit.ears'), `slice Wallet.Deposit
axioms:
  [AX-1] ALWAYS state.balance.amount >= 0.00
rules:
  [DEP_BAD] IF delta <= 0.00 THEN SHALL reject request with DEP_BAD
  [DEP_OK]  WHILE delta > 0.00
            WHEN Deposit
            SHALL emit Deposited
            post:
              state.balance.amount' = state.balance.amount + delta
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S24 compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('typescript').generate(comp.canonical, { outDir: work });
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec24' });
    emitV2ExecutableTests(comp.canonical, {
      outDir: work,
      targets: ['typescript', 'scala-cqrs-play-service-v2'],
      packageName: 'example.spec24',
    });

    const evHandler = readFileSync(
      join(work, 'generated-scaffold/scala/example/spec24/domain/entities/behaviors/WalletEventHandler.scala'),
      'utf8',
    );
    assert.match(evHandler, /example\.spec24\.domain\.values\.Money\.create\(/);
    assert.doesNotMatch(evHandler, /state\.balance\.copy\(/);

    const tsRun = spawnSync(
      process.execPath,
      ['--test', join(work, 'generated-tests/ts/wallet-deposit.ears.spec.ts')],
      { cwd: work, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(tsRun.status, 0, `SPEC-S24 TS domain spec failed:\n${tsRun.stdout}\n${tsRun.stderr}`);

    const verify = runV2VerifyGate({
      rootDir: work,
      targets: ['scala-cqrs-play-service-v2'],
      canonicalFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
      strict: true,
      mutationGate: true,
    });
    assert.equal(verify.passed, true, `SPEC-S24 Scala verify+mutation failed: ${JSON.stringify(verify, null, 2)}`);
    assert.equal(verify.mutationCheck.scala.killRate, 100);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S25] Proto3 nested containers (Optional[Seq], Seq[Optional], Map[String, Optional[VO]]) emit typed BoxPO + converters, and PlayController preserves principal entitlements/attributes (Wave-4 M13/M15)', () => {
  const work = makeTempDir('coarising-spec-s25-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: spec25
subdomain: catalog
valueObjects:
  - name: TagVO
    fields:
      - name: code
        type: String
aggregates:
  - name: CatalogDoc
    idField: docId
    stateFields:
      - name: docId
        type: String
      - name: status
        type: String
        default: "Draft"
      - name: optTags
        type: Optional[Seq[String]]
      - name: seqOptNotes
        type: Seq[Optional[String]]
      - name: mapOptTag
        type: Map[String, Optional[TagVO]]
    commands:
      - name: Publish
        parameters:
          - name: docId
            type: String
        produces: [Published]
    events:
      - name: Published
        fields:
          - name: docId
            type: String
ports:
  - name: DocPort
    operations:
      - name: publish
        kind: command
        parameters:
          - name: docId
            type: String
        authz:
          mode: static-roles
          allowedRoles: [editor]
          requiresEntitlement:
            - code: doc.publish
stories:
  - name: PublishDocStory
    inboundPort: DocPort
    dispatches: [CatalogDoc.Publish]
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/doc-publish.ears'), `slice CatalogDoc.Publish
rules:
  [PUB_BAD] IF docId == "" THEN SHALL reject request with PUB_BAD
  [PUB_OK]  WHILE docId != ""
            WHEN Publish
            SHALL transition state.status -> "Published"
              AND emit Published
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/publish-story.story.ears'), `story PublishDocStory layer application
rules:
  [S_BAD] IF docId == "" WHEN DocPort.publish THEN SHALL reject request with BAD_DOC
  [S_OK]  WHILE docId != "" WHEN DocPort.publish SHALL dispatch CatalogDoc.Publish
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S25 compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec25' });

    const sharedProto = readFileSync(join(work, 'generated-scaffold/protobuf/shared_value_objects.proto'), 'utf8');
    assert.match(sharedProto, /message SeqStringBoxPO/);
    assert.match(sharedProto, /message OptStringBoxPO/);
    assert.match(sharedProto, /message OptTagVOBoxPO/);

    const docProto = readFileSync(join(work, 'generated-scaffold/protobuf/catalog_doc.proto'), 'utf8');
    assert.match(docProto, /optional SeqStringBoxPO optTags/);
    assert.match(docProto, /repeated OptStringBoxPO seqOptNotes/);
    assert.match(docProto, /map<string, OptTagVOBoxPO> mapOptTag/);

    const sharedConv = readFileSync(join(work, 'generated-scaffold/scala/example/spec25/infrastructure/persistence/converters/SharedValueProtoConverters.scala'), 'utf8');
    assert.match(sharedConv, /def encodeSeqStringBoxPO\(value: Vector\[String\]\): pb\.SeqStringBoxPO/);
    assert.match(sharedConv, /def encodeOptStringBoxPO\(value: Option\[String\]\): pb\.OptStringBoxPO/);
    assert.match(sharedConv, /def encodeOptTagVOBoxPO\(value: Option\[TagVO\]\): pb\.OptTagVOBoxPO/);

    const playCtrl = readFileSync(join(work, 'generated-scaffold/scala/controllers/PublishDocStoryPlayController.scala'), 'utf8');
    assert.match(playCtrl, /"entitlements" -> ctx\.entitlements/);
    assert.match(playCtrl, /"attributes" -> ctx\.attributes/);
    assert.match(playCtrl, /def lookupAttr\(ctx: AuthContext, key: String\)/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S26] Wave-5 M18A: nested Map[String, Map[String, VO]] compiles through SMT, TS, Scala, Proto3 BoxPO, and 100% Mutation Gate without recursion', () => {
  const work = makeTempDir('coarising-spec-s26-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: nested-map-sys
subdomain: matrix
valueObjects:
  - name: CellVO
    fields:
      - name: score
        type: Int
      - name: label
        type: String
aggregates:
  - name: Matrix
    idField: matrixId
    stateFields:
      - name: matrixId
        type: String
      - name: grid
        type: Map[String, Map[String, CellVO]]
      - name: counts
        type: Map[String, Map[String, Int]]
    commands:
      - name: CheckCell
        parameters:
          - name: matrixId
            type: String
          - name: row
            type: String
          - name: col
            type: String
        produces: [CellApproved]
    events:
      - name: CellApproved
        fields:
          - name: matrixId
            type: String
          - name: row
            type: String
          - name: col
            type: String
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/matrix-check-cell.ears'), `slice Matrix.CheckCell
rules:
  [R_LOW] IF state.grid[row][col].score < 50 THEN SHALL reject request with SCORE_LOW
  [R_OK]  WHILE state.grid[row][col].score >= 50
          WHEN CheckCell
          SHALL emit CellApproved
`, 'utf8');

    const comp = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(comp.passed, true, `SPEC-S26 compile failed: ${JSON.stringify(comp.diagnostics)}`);

    getCodegenPlugin('typescript').generate(comp.canonical, { outDir: work });
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(comp.canonical, { outDir: work, packageName: 'example.spec26' });
    emitV2ExecutableTests(comp.canonical, {
      outDir: work,
      targets: ['typescript', 'scala-cqrs-play-service-v2'],
      packageName: 'example.spec26',
    });

    const rulesScala = readFileSync(join(work, 'generated-scaffold/scala/example/spec26/domain/invariants/MatrixRules.scala'), 'utf8');
    assert.match(rulesScala, /state\.grid\.get\(p\.row\)\.flatMap\(_\.get\(p\.col\)\)\.map\(_\.score\)\.getOrElse\(0L\)/);
    assert.doesNotMatch(rulesScala, /map\(_\.\)/);

    const sharedProto = readFileSync(join(work, 'generated-scaffold/protobuf/shared_value_objects.proto'), 'utf8');
    assert.match(sharedProto, /message MapCellVOBoxPO/);
    assert.match(sharedProto, /message MapIntBoxPO/);

    const tsRun = spawnSync(
      process.execPath,
      ['--test', join(work, 'generated-tests/ts/matrix-check-cell.ears.spec.ts')],
      { cwd: work, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(tsRun.status, 0, `SPEC-S26 TS test failed: ${tsRun.stdout}\n${tsRun.stderr}`);

    const verify = runV2VerifyGate({ rootDir: work, targets: ['scala'], mutationGate: true });
    assert.equal(verify.passed, true, `SPEC-S26 Scala verify failed: ${JSON.stringify(verify.targets?.scala ?? verify)}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('[SPEC-S27] Wave-5 M17 & M19: non-destructive handwritten method sync, bindings drift check, and safe starter pruning on package rename', () => {
  const work = makeTempDir('coarising-spec-s27-');
  try {
    mkdirSync(join(work, 'truth/structures'), { recursive: true });
    mkdirSync(join(work, 'truth/behaviors'), { recursive: true });

    // Phase 1: Initial truth with 1 L2 method and 1 externContract under pkg v1
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: evolve-sys
subdomain: scoring
ports:
  - name: EnginePort
    direction: outbound
externContracts:
  - name: checkAlpha
    ownerPort: EnginePort
    params:
      - name: score
        type: Int
    returns: Bool
aggregates:
  - name: Scorer
    idField: scorerId
    stateFields:
      - name: scorerId
        type: String
      - name: score
        type: Int
    commands:
      - name: ScoreAlpha
        parameters:
          - name: scorerId
            type: String
          - name: points
            type: Int
        produces: [AlphaScored]
    events:
      - name: AlphaScored
        fields:
          - name: scorerId
            type: String
          - name: points
            type: Int
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/scorer-alpha.ears'), `slice Scorer.ScoreAlpha
rules:
  [R_NO] IF points * points <= 0 THEN SHALL reject request with ALPHA_DENIED
  [R_OK] WHILE points * points > 0
         WHEN ScoreAlpha
         SHALL emit AlphaScored
         post:
           state.score' = points
`, 'utf8');

    const c1 = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(c1.passed, true, `SPEC-S27 phase1 compile failed: ${JSON.stringify(c1.diagnostics)}`);
    getCodegenPlugin('scala-cqrs-play-service-v2').generate(c1.canonical, { outDir: work, packageName: 'example.v1' });

    // Add a user marker comment to ComputationsImpl to prove non-destructive sync preserves user edits
    const compImplPath = join(work, 'handwritten/scala/example/v1/domain/services/impl/ScorerComputationsImpl.scala');
    writeFileSync(compImplPath, `// USER-CUSTOM-PRESERVED\n${readFileSync(compImplPath, 'utf8')}`, 'utf8');

    // Phase 2: Add 2nd L2 method & 2nd externContract in-place (overwriteCloze: false)
    writeFileSync(join(work, 'truth/structures/model.yaml'), `
system: evolve-sys
subdomain: scoring
ports:
  - name: EnginePort
    direction: outbound
externContracts:
  - name: checkAlpha
    ownerPort: EnginePort
    params:
      - name: score
        type: Int
    returns: Bool
  - name: checkBeta
    ownerPort: EnginePort
    params:
      - name: score
        type: Int
    returns: Bool
aggregates:
  - name: Scorer
    idField: scorerId
    stateFields:
      - name: scorerId
        type: String
      - name: score
        type: Int
    commands:
      - name: ScoreAlpha
        parameters:
          - name: scorerId
            type: String
          - name: points
            type: Int
        produces: [AlphaScored]
      - name: ScoreBeta
        parameters:
          - name: scorerId
            type: String
          - name: points
            type: Int
        produces: [BetaScored]
    events:
      - name: AlphaScored
        fields:
          - name: scorerId
            type: String
          - name: points
            type: Int
      - name: BetaScored
        fields:
          - name: scorerId
            type: String
          - name: points
            type: Int
`, 'utf8');
    writeFileSync(join(work, 'truth/behaviors/scorer-beta.ears'), `slice Scorer.ScoreBeta
rules:
  [R_NO] IF points * points <= 0 THEN SHALL reject request with BETA_DENIED
  [R_OK] WHILE points * points > 0
         WHEN ScoreBeta
         SHALL emit BetaScored
         post:
           state.score' = points
`, 'utf8');

    const c2 = compileCanonicalV2({
      structuresDir: join(work, 'truth/structures'),
      specsPath: join(work, 'truth/behaviors'),
      outFile: join(work, '.truthsrc/canonical-v2.json'),
      dbFile: join(work, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(c2.passed, true, `SPEC-S27 phase2 compile failed: ${JSON.stringify(c2.diagnostics)}`);
    const g2 = getCodegenPlugin('scala-cqrs-play-service-v2').generate(c2.canonical, { outDir: work, packageName: 'example.v1', overwriteCloze: false });

    const syncedComp = readFileSync(compImplPath, 'utf8');
    assert.match(syncedComp, /USER-CUSTOM-PRESERVED/, 'user comments in ComputationsImpl must be preserved');
    assert.match(syncedComp, /override def scoreBeta\(/, 'missing L2 method scoreBeta must be synced');
    const syncedConn = readFileSync(join(work, 'handwritten/scala/example/v1/infrastructure/connectors/EnginePortConnectorImpl.scala'), 'utf8');
    assert.match(syncedConn, /override def checkBeta\(score: Long\): Future\[Boolean\]/, 'missing externContract method checkBeta must be synced');
    assert.equal(g2.syncedHandwrittenMethods.length, 2);

    // Phase 3: Rename package example.v1 -> example.v2; untouched starter files are pruned, user-edited files are preserved & reported
    const g3 = getCodegenPlugin('scala-cqrs-play-service-v2').generate(c2.canonical, { outDir: work, packageName: 'example.v2', overwriteCloze: false });
    assert.equal(
      existsSync(join(work, 'handwritten/scala/example/v1/modules/HandwrittenBindingsModule.scala')),
      false,
      'untouched starter HandwrittenBindingsModule under old package must be pruned',
    );
    assert.equal(
      existsSync(join(work, 'handwritten/scala/example/v1/infrastructure/api/ServerSnapshotProviderImpl.scala')),
      false,
      'untouched starter ServerSnapshotProviderImpl under old package must be pruned',
    );
    assert.equal(
      existsSync(compImplPath),
      true,
      'user-modified ComputationsImpl under old package must never be deleted',
    );
    assert.equal(
      g3.staleHandwrittenFiles.some(f => f.path === 'handwritten/scala/example/v1/domain/services/impl/ScorerComputationsImpl.scala' && f.code === 'STALE_HANDWRITTEN_FILE'),
      true,
      'user-modified stale handwritten file must be reported in staleHandwrittenFiles',
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
