// Scaffolds a ready-to-run co-arising 2.0 bounded-context project with orthogonal layout:
//   truth/<context>/{structures, behaviors/{domain,application}, bindings}
//   governance/coverage-manifest.json + truthsrc.v2.json + PreToolUse/Stop hooks
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { compileCanonicalV2 } from './compiler.mjs';
import { getCodegenPlugin } from './codegen/interface.mjs';
import './codegen/typescript.mjs';
import './codegen/scala.mjs';
import { emitV2ExecutableTests } from './test-emitter/emit.mjs';
import { initHooksV2 } from './guard-write.mjs';

function sanitizeSlug(raw, fallback) {
  const cleaned = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-|-$/gu, '');
  return cleaned || fallback;
}

function buildStarterStructureYaml(system, context) {
  return `system: ${system}
context: ${context}

exactTypes:
  - name: QtyDecimal
    form: decimal
    scale: 2

ports:
  - name: QuotaPort
    operations:
      - name: submit
        parameters:
          - actor: ActorId
          - reqId: RequestId
          - qty: QtyDecimal

valueObjects:
  - name: QuotaAck
    fields:
      - replayed: Bool
      - accepted: Bool

externContracts:
  - name: actorAuthorized
    params:
      - actor: ActorId
  - name: requestRecorded
    params:
      - actor: ActorId
      - reqId: RequestId

aggregates:
  - name: QuotaBucket
    aliases: [bucket, state, quotabucket]
    stateFields:
      - minQty: QtyDecimal = "1.00"
      - maxQty: QtyDecimal = "100.00"
      - usedQty: QtyDecimal = "0.00"
      - totalCap: QtyDecimal = "500.00"
    commands:
      - name: Reserve
        parameters:
          - qty: QtyDecimal
        produces: [QuotaReserved]
    events:
      - name: QuotaReserved
        fields:
          - qty: QtyDecimal
    ruleRefs:
      QTY_RANGE: "requested quantity within min..max"
      CAP_EXCEEDED: "requested quantity within remaining capacity"

stories:
  - name: QuotaIntake
    pins: [QuotaRequestOriginal]
    responses: [QuotaAck]
    callerContract:
      idempotencyKey: "(actor, reqId)"
`;
}

const STARTER_DOMAIN_EARS = `slice QuotaBucket.Reserve

where:
  validQty  = qty in [bucket.minQty..bucket.maxQty] as "quantity within allowed range"
  withinCap = bucket.usedQty + qty <= bucket.totalCap as "within bucket capacity"

axioms:
  [AX-QB-1] ALWAYS bucket.usedQty <= bucket.totalCap

rules:
  [QTY_RANGE]    IF not validQty  THEN SHALL reject request with QTY_RANGE
  [CAP_EXCEEDED] IF not withinCap THEN SHALL reject request with CAP_EXCEEDED

  [QUOTA_RESERVED] WHILE validQty and withinCap
                   WHEN Reserve
                   SHALL emit QuotaReserved
                   post:
                     bucket.usedQty' = bucket.usedQty + qty
`;

const STARTER_APP_EARS = `story QuotaIntake layer application

where:
  extern actorAuthorized(actor)
  extern requestRecorded(actor, reqId)

rules:
  [QI-01] IF not actorAuthorized(actor)
          WHEN QuotaPort.submit
          THEN SHALL reject request with UNAUTHORIZED

  [QI-02] WHILE not requestRecorded(actor, reqId)
          WHEN QuotaPort.submit AND actorAuthorized(actor)
          SHALL pin QuotaRequestOriginal from (actor, reqId)
            AND dispatch QuotaBucket.Reserve
            AND respond QuotaAck with ack.replayed == false and ack.accepted == true

  [QI-03] WHILE requestRecorded(actor, reqId)
          WHEN QuotaPort.submit AND actorAuthorized(actor)
          SHALL respond QuotaAck with ack.replayed == true and ack.accepted == true
            AND SHALL NOT dispatch QuotaBucket.Reserve
`;

function buildStarterBindingYaml(system, context) {
  return `schemaVersion: co-arising.effect-binding/v2
system: ${system}
context: ${context}
architectureStyle: cqrs-es-three-phase-effect
forbiddenImports:
  - id: ARCH_DOMAIN_NO_HANDWRITTEN
    scopePrefix: generated-scaffold/ts/
    forbidPattern: "from\\\\s+[\\"']\\\\.\\\\./\\\\.\\\\./handwritten/"
    reason: generated domain scaffold must not import handwritten infrastructure adapters
effects:
  - name: QuotaIntakeEffect
    protocol: idempotent-consumer
    idempotencyKey: "(actor, reqId)"
    timeoutMs: 3000
    maxRetries: 3
    compensationRequiresAbsenceProof: true
    crashRecoveryZeroNewAuth: true
`;
}

function fillStarterTsCloze(filePath) {
  if (!existsSync(filePath)) return;
  const src = readFileSync(filePath, 'utf8');
  const filled = src.replace(
    /\/\/ @cloze:start\(quota-intake\)[\s\S]*?\/\/ @cloze:end\(quota-intake\)/u,
    [
      '// @cloze:start(quota-intake)',
      '    if (!externs.actorAuthorized(req.payload.actor)) {',
      '      return { ok: false, code: "UNAUTHORIZED", ruleId: "QI-01" };',
      '    }',
      '    if (!externs.requestRecorded(req.payload.actor, req.payload.reqId)) {',
      '      effects.pin("QuotaRequestOriginal", { actor: req.payload.actor, reqId: req.payload.reqId });',
      '      effects.dispatch("QuotaBucket.Reserve", req.payload);',
      '      return { ok: true, ruleId: "QI-02", responseType: "QuotaAck", response: { replayed: false, accepted: true } };',
      '    }',
      '    return { ok: true, ruleId: "QI-03", responseType: "QuotaAck", response: { replayed: true, accepted: true } };',
      '    // @cloze:end(quota-intake)',
    ].join('\n'),
  );
  writeFileSync(filePath, filled, 'utf8');
}

function fillStarterScalaCloze(filePath) {
  if (!existsSync(filePath)) return;
  const src = readFileSync(filePath, 'utf8');
  const filled = src.replace(
    /\/\/ @cloze:start\(quota-intake\)[\s\S]*?\/\/ @cloze:end\(quota-intake\)/u,
    [
      '// @cloze:start(quota-intake)',
      '    val actor = req.payload.getOrElse("actor", "")',
      '    val reqId = req.payload.getOrElse("reqId", "")',
      '    if (!externs.actorAuthorized(actor)) {',
      '      Left(DomainRejection("UNAUTHORIZED", "QI-01"))',
      '    } else if (!externs.requestRecorded(actor, reqId)) {',
      '      effects.pin("QuotaRequestOriginal", Map("actor" -> actor, "reqId" -> reqId))',
      '      effects.dispatch("QuotaBucket.Reserve", req.payload)',
      '      Right(QuotaIntakeSuccessResponse("QI-02", Some("QuotaAck"), Map("replayed" -> false, "accepted" -> true)))',
      '    } else {',
      '      Right(QuotaIntakeSuccessResponse("QI-03", Some("QuotaAck"), Map("replayed" -> true, "accepted" -> true)))',
      '    }',
      '    // @cloze:end(quota-intake)',
    ].join('\n'),
  );
  writeFileSync(filePath, filled, 'utf8');
}

export function initV2Project({
  targetDir,
  system = null,
  context = 'core',
  targets = ['typescript'],
  packageName = 'example.v2',
  solver = 'z3',
  force = false,
  skipCompile = false,
  initHooks = true,
} = {}) {
  const absRoot = resolve(targetDir);
  if (existsSync(absRoot) && !force) {
    const entries = readdirSync(absRoot).filter(n => !n.startsWith('.'));
    if (entries.length > 0) {
      throw new Error(`V2_INIT_DIR_NOT_EMPTY: directory "${absRoot}" already exists and is not empty (pass --force to overwrite)`);
    }
  }

  const sysName = sanitizeSlug(system ?? basename(absRoot), 'starter-lab');
  const ctxName = sanitizeSlug(context, 'core');
  const pkgDir = packageName.split('.').join('/');

  const structuresRel = `truth/${ctxName}/structures`;
  const behaviorsRel = `truth/${ctxName}/behaviors`;
  const bindingsRel = `truth/${ctxName}/bindings/${ctxName}-effects.yaml`;

  mkdirSync(join(absRoot, structuresRel), { recursive: true });
  mkdirSync(join(absRoot, `${behaviorsRel}/domain`), { recursive: true });
  mkdirSync(join(absRoot, `${behaviorsRel}/application`), { recursive: true });
  mkdirSync(join(absRoot, `truth/${ctxName}/bindings`), { recursive: true });
  mkdirSync(join(absRoot, 'governance'), { recursive: true });

  writeFileSync(join(absRoot, `${structuresRel}/${ctxName}.yaml`), buildStarterStructureYaml(sysName, ctxName), 'utf8');
  writeFileSync(join(absRoot, `${behaviorsRel}/domain/quota-bucket-reserve.ears`), STARTER_DOMAIN_EARS, 'utf8');
  writeFileSync(join(absRoot, `${behaviorsRel}/application/quota-intake.story.ears`), STARTER_APP_EARS, 'utf8');
  writeFileSync(join(absRoot, bindingsRel), buildStarterBindingYaml(sysName, ctxName), 'utf8');

  const projectConfig = {
    schemaVersion: 'co-arising.project/v2',
    system: sysName,
    context: ctxName,
    structures: structuresRel,
    behaviors: behaviorsRel,
    effectBinding: bindingsRel,
    coverageManifest: 'governance/coverage-manifest.json',
    canonicalOut: '.truthsrc/canonical-v2.json',
    dbOut: '.truthsrc/knowledge.sqlite',
    targets,
    packageName,
  };
  writeFileSync(join(absRoot, 'truthsrc.v2.json'), JSON.stringify(projectConfig, null, 2) + '\n', 'utf8');

  const coverageFiles = [];
  if (targets.includes('typescript')) {
    coverageFiles.push(
      {
        path: 'generated-scaffold/ts/exact.ts',
        branch: 'problem',
        tier: 'D1',
        stage: 'stage-3-generated',
        evidenceTier: 'E1',
        contractRef: 'co-arising.exact-runtime',
        shadowMode: 'none',
        rationale: 'Generated exact fixed-point decimal runtime',
      },
      {
        path: 'generated-scaffold/ts/types.ts',
        branch: 'problem',
        tier: 'D1',
        stage: 'stage-3-generated',
        evidenceTier: 'E1',
        contractRef: `${ctxName}.structures`,
        shadowMode: 'none',
        rationale: 'Generated domain value types',
      },
      {
        path: 'generated-scaffold/ts/quota-bucket.behavior.ts',
        branch: 'problem',
        tier: 'D1',
        stage: 'stage-3-generated',
        evidenceTier: 'E1',
        contractRef: 'QuotaBucket.Reserve',
        shadowMode: 'none',
        rationale: 'Generated L1 deterministic aggregate behavior',
      },
      {
        path: 'generated-scaffold/ts/quota-intake.port.ts',
        branch: 'problem',
        tier: 'D2',
        stage: 'stage-3-generated',
        evidenceTier: 'E1',
        contractRef: 'QuotaIntake',
        shadowMode: 'none',
        rationale: 'Generated application port contract',
      },
      {
        path: 'handwritten/quota-intake.cloze.ts',
        branch: 'problem',
        tier: 'D2',
        stage: 'stage-2-cloze',
        evidenceTier: 'E1',
        contractRef: 'QuotaIntake',
        shadowMode: 'none',
        rationale: 'Bounded @cloze application story handler verified by locked BDD oracle',
      },
    );
  }
  if (targets.includes('scala')) {
    coverageFiles.push(
      {
        path: `generated-scaffold/scala/${pkgDir}/DomainTypes.scala`,
        branch: 'problem',
        tier: 'D1',
        stage: 'stage-3-generated',
        evidenceTier: 'E1',
        contractRef: `${ctxName}.structures`,
        shadowMode: 'none',
        rationale: 'Generated Scala domain value types',
      },
      {
        path: `generated-scaffold/scala/${pkgDir}/QuotaBucketBehavior.scala`,
        branch: 'problem',
        tier: 'D1',
        stage: 'stage-3-generated',
        evidenceTier: 'E1',
        contractRef: 'QuotaBucket.Reserve',
        shadowMode: 'none',
        rationale: 'Generated Scala L1 aggregate behavior',
      },
      {
        path: `generated-scaffold/scala/${pkgDir}/QuotaIntakePort.scala`,
        branch: 'problem',
        tier: 'D2',
        stage: 'stage-3-generated',
        evidenceTier: 'E1',
        contractRef: 'QuotaIntake',
        shadowMode: 'none',
        rationale: 'Generated Scala application port contract',
      },
      {
        path: `handwritten/scala/${pkgDir}/QuotaIntakeCloze.scala`,
        branch: 'problem',
        tier: 'D2',
        stage: 'stage-2-cloze',
        evidenceTier: 'E1',
        contractRef: 'QuotaIntake',
        shadowMode: 'none',
        rationale: 'Bounded Scala @cloze application handler verified by locked ScalaTest oracle',
      },
    );
  }

  const governedRoots = [];
  if (targets.includes('typescript')) {
    governedRoots.push({ root: 'generated-scaffold/ts', extensions: ['.ts'] });
    governedRoots.push({ root: 'handwritten', extensions: ['.ts'] });
  }
  if (targets.includes('scala')) {
    governedRoots.push({ root: 'generated-scaffold/scala', extensions: ['.scala'] });
    governedRoots.push({ root: 'handwritten/scala', extensions: ['.scala'] });
  }

  writeFileSync(join(absRoot, 'governance/coverage-manifest.json'), JSON.stringify({
    schemaVersion: 'co-arising.coverage-manifest/v2',
    system: sysName,
    context: ctxName,
    effectBindingFile: bindingsRel,
    governedRoots,
    files: coverageFiles,
  }, null, 2) + '\n', 'utf8');

  let compiled = null;
  let emitted = null;
  if (!skipCompile) {
    compiled = compileCanonicalV2({
      structuresDir: join(absRoot, structuresRel),
      specsPath: join(absRoot, behaviorsRel),
      outFile: join(absRoot, projectConfig.canonicalOut),
      dbFile: join(absRoot, projectConfig.dbOut),
      solver,
    });
    if (compiled.passed) {
      for (const target of targets) {
        const plugin = getCodegenPlugin(target);
        if (plugin) plugin.generate(compiled.canonical, { outDir: absRoot, packageName, overwriteCloze: true });
      }
      if (targets.includes('typescript')) {
        fillStarterTsCloze(join(absRoot, 'handwritten/quota-intake.cloze.ts'));
      }
      if (targets.includes('scala')) {
        fillStarterScalaCloze(join(absRoot, `handwritten/scala/${pkgDir}/QuotaIntakeCloze.scala`));
      }
      emitted = emitV2ExecutableTests(compiled.canonical, { outDir: absRoot, targets, packageName });
    }
  }

  const hooks = initHooks ? initHooksV2({ rootDir: absRoot, targets }) : null;

  return {
    schemaVersion: 'co-arising.init-v2/v1',
    rootDir: absRoot,
    system: sysName,
    context: ctxName,
    targets,
    packageName,
    projectFile: join(absRoot, 'truthsrc.v2.json'),
    compiled: compiled ? { passed: compiled.passed, canonicalSha256: compiled.canonical?.canonicalSha256 ?? null } : null,
    emittedTests: emitted ? emitted.manifestCount : 0,
    hooks: hooks?.files ?? [],
    nextCommand: `truthsrc check-v2 --root ${absRoot} --format human`,
  };
}
