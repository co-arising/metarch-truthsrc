// Generic end-to-end tests for co-arising 2.0 (EARS-Native Canonical Model v2, TS+Scala codegen,
// executable BDD oracles, SQLite Context Pack, and Stop Hook verify-v2 gate).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileCanonicalV2 } from '../lib/v2/compiler.mjs';
import { typescriptCodegenPlugin } from '../lib/v2/codegen/typescript.mjs';
import { scalaCodegenPlugin } from '../lib/v2/codegen/scala.mjs';
import { emitV2ExecutableTests } from '../lib/v2/test-emitter/emit.mjs';
import { buildSandwichContextPack } from '../lib/v2/context-pack.mjs';
import { runV2VerifyGate } from '../lib/v2/verify-gate.mjs';

const BIN = new URL('../bin/truthsrc.js', import.meta.url).pathname;

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

const VAULT_STRUCT_YAML = `
system: warehouse-lab
context: inventory

exactTypes:
  - name: QtyDecimal
    form: decimal
    scale: 2
  - name: RateDecimal
    form: decimal
    scale: 4

aggregates:
  - name: StorageBin
    aliases: [bin, state, storagebin]
    stateFields:
      - minBatch: QtyDecimal = "1.00"
      - maxBatch: QtyDecimal = "100.00"
      - totalUsed: QtyDecimal = "0.00"
      - totalCap: QtyDecimal = "500.00"
      - perOwnerCap: QtyDecimal = "200.00"
      - ownerUsed: Map[OwnerId, QtyDecimal] = []
    commands:
      - name: AllocateBatch
        parameters:
          - ownerId: OwnerId
          - qty: QtyDecimal
        produces: [BatchAllocated]
    events:
      - name: BatchAllocated
        fields:
          - ownerId: OwnerId
          - qty: QtyDecimal
    ruleRefs:
      BIN_BATCH_RANGE: "batch qty within min..max"
      BIN_TOTAL_CAP: "within total bin capacity"
      BIN_OWNER_CAP: "within per-owner capacity"

  - name: LotSettlement
    aliases: [lot, state, lotsettlement]
    stateFields:
      - netBudget: QtyDecimal = "0.00"
      - settleStatus: String = "pending"
    commands:
      - name: ConfirmUnits
        parameters:
          - units: Int
          - unitPrice: RateDecimal
        produces: [UnitsConfirmed]
    events:
      - name: UnitsConfirmed
        waiveLineage: audit-only
        fields:
          - units: Int
          - unitPrice: RateDecimal
`;

const VAULT_L1_EARS = `
slice StorageBin.AllocateBatch

where:
  validQty     = qty in [bin.minBatch..bin.maxBatch]             as "batch within allowed range"
  withinBinCap = bin.totalUsed + qty <= bin.totalCap             as "within bin total capacity"
  withinOwnCap = bin.ownerUsed[ownerId] + qty <= bin.perOwnerCap as "within per-owner capacity"

axioms:
  [AX-BIN-1] ALWAYS bin.totalUsed <= bin.totalCap
  [AX-BIN-2] ALWAYS bin.ownerUsed[ownerId] <= bin.perOwnerCap

rules:
  [BIN_BATCH_RANGE] IF not validQty     THEN SHALL reject request with BIN_BATCH_RANGE
  [BIN_TOTAL_CAP]   IF not withinBinCap THEN SHALL reject request with BIN_TOTAL_CAP
  [BIN_OWNER_CAP]   IF not withinOwnCap THEN SHALL reject request with BIN_OWNER_CAP

  [BIN_ALLOCATED]   WHILE validQty and withinBinCap and withinOwnCap
                    WHEN AllocateBatch
                    SHALL emit BatchAllocated
                    post:
                      bin.totalUsed'          = bin.totalUsed + qty
                      bin.ownerUsed'[ownerId] = bin.ownerUsed[ownerId] + qty
`;

const LOT_L2_EARS = `
slice LotSettlement.ConfirmUnits

where:
  positivePrice = unitPrice > 0.0000 as "unit price must be positive"
  exactFloor    = units >= 0
                  and units * unitPrice <= lot.netBudget
                  and (units + 1) * unitPrice > lot.netBudget as "units equal floor(netBudget / unitPrice)"

rules:
  [LOT_BAD_PRICE] IF not positivePrice THEN SHALL reject request with LOT_BAD_PRICE
  [LOT_BAD_UNITS] IF not exactFloor    THEN SHALL reject request with LOT_BAD_UNITS

  [LOT_CONFIRMED] WHILE lot.settleStatus != "confirmed"
                  WHEN ConfirmUnits AND positivePrice AND exactFloor
                  SHALL transition lot.settleStatus -> "confirmed"
                    AND emit UnitsConfirmed

  [LOT_ALREADY_CONFIRMED] IF lot.settleStatus == "confirmed"
                          WHEN ConfirmUnits AND positivePrice AND exactFloor
                          THEN SHALL reject request with LOT_ALREADY_CONFIRMED
`;

test('v2 structure loader physically forbids legacy @guard and domain-decision@4', () => {
  const dir = makeTempDir('coarising-v2-legacy-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'specs'), { recursive: true });
    writeFileSync(join(dir, 'structures/bad.yaml'), `
system: bad-sys
context: bad
aggregates:
  - name: Box
    commands:
      - name: Open
        "@guard": "state.closed == true"
`, 'utf8');
    writeFileSync(join(dir, 'specs/box.ears'), 'slice Box.Open\nrules:\n  [R1] WHEN Open SHALL emit Opened\n', 'utf8');

    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'specs'),
      outFile: join(dir, 'canonical-v2.json'),
    });
    assert.equal(res.passed, false);
    assert.equal(res.blocked, true);
    assert.equal(existsSync(join(dir, 'canonical-v2.json')), false);
    assert.ok(res.diagnostics.some(d => d.code === 'V2_LEGACY_GUARD_FORBIDDEN'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('v2 compiler SMT hard gate blocks specs with logic gaps and refuses canonical-v2.json output', () => {
  const dir = makeTempDir('coarising-v2-gap-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'specs'), { recursive: true });
    writeFileSync(join(dir, 'structures/vault.yaml'), VAULT_STRUCT_YAML, 'utf8');
    // Omit BIN_OWNER_CAP reject rule to create a real SMT logic gap
    writeFileSync(join(dir, 'specs/broken.ears'), `
slice StorageBin.AllocateBatch
where:
  validQty     = qty in [bin.minBatch..bin.maxBatch]
  withinBinCap = bin.totalUsed + qty <= bin.totalCap
  withinOwnCap = bin.ownerUsed[ownerId] + qty <= bin.perOwnerCap
rules:
  [BIN_BATCH_RANGE] IF not validQty THEN SHALL reject request with BIN_BATCH_RANGE
  [BIN_TOTAL_CAP]   IF not withinBinCap THEN SHALL reject request with BIN_TOTAL_CAP
  [BIN_ALLOCATED]   WHILE validQty and withinBinCap and withinOwnCap
                    WHEN AllocateBatch
                    SHALL emit BatchAllocated
`, 'utf8');

    const outCanonical = join(dir, 'canonical-v2.json');
    const cli = spawnSync(process.execPath, [
      BIN, 'compile-v2',
      '--structures', join(dir, 'structures'),
      '--specs', join(dir, 'specs'),
      '--out', outCanonical,
      '--format', 'json',
    ], { encoding: 'utf8' });

    assert.equal(cli.status, 2);
    assert.equal(existsSync(outCanonical), false);
    const parsed = JSON.parse(cli.stdout);
    assert.equal(parsed.passed, false);
    assert.ok(parsed.clarificationCards.length >= 1);
    assert.equal(parsed.clarificationCards[0].type, 'gap');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('v2 Contract 3 blocks conflicting post: folds across commands emitting the same event', () => {
  const dir = makeTempDir('coarising-v2-fold-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'specs'), { recursive: true });
    writeFileSync(join(dir, 'structures/counter.yaml'), `
system: counter-lab
context: counter
aggregates:
  - name: Meter
    stateFields:
      - count: Int = 0
    commands:
      - name: StepOne
        parameters: []
        produces: [MeterMoved]
      - name: StepTwo
        parameters: []
        produces: [MeterMoved]
    events:
      - name: MeterMoved
        fields: []
`, 'utf8');
    writeFileSync(join(dir, 'specs/meter.ears'), `
slice Meter
rules:
  [M1] WHEN StepOne SHALL emit MeterMoved
       post:
         meter.count' = meter.count + 1
  [M2] WHEN StepTwo SHALL emit MeterMoved
       post:
         meter.count' = meter.count + 2
`, 'utf8');

    const res = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'specs'),
      outFile: join(dir, 'canonical-v2.json'),
    });
    assert.equal(res.passed, false);
    assert.ok(res.diagnostics.some(d => d.code === 'V2_INCONSISTENT_EVENT_FOLD'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('v2 full E2E: compile -> SQLite -> TS+Scala codegen -> executable BDD oracles -> @cloze TDD red/green -> tamper exit 2', () => {
  const dir = makeTempDir('coarising-v2-e2e-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'specs'), { recursive: true });
    writeFileSync(join(dir, 'structures/vault.yaml'), VAULT_STRUCT_YAML, 'utf8');
    writeFileSync(join(dir, 'specs/storage-bin.ears'), VAULT_L1_EARS, 'utf8');
    writeFileSync(join(dir, 'specs/lot-settlement.ears'), LOT_L2_EARS, 'utf8');

    const canonicalFile = join(dir, '.truthsrc/canonical-v2.json');
    const dbFile = join(dir, '.truthsrc/knowledge.sqlite');

    // Phase 1: Compile Canonical Model v2 + SQLite graph
    const compiled = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'specs'),
      outFile: canonicalFile,
      dbFile,
    });
    assert.equal(compiled.passed, true, JSON.stringify(compiled.diagnostics));
    assert.equal(compiled.canonical.schemaVersion, 'co-arising.canonical/v2');
    assert.equal(compiled.canonical.verificationSummary.deterministicCount, 1);
    assert.equal(compiled.canonical.verificationSummary.clozeCount, 1);
    assert.ok(compiled.dbInfo.nodeCount >= 8);

    // Phase 2: Generate TypeScript + Scala directly from EARS IR
    const tsGen = typescriptCodegenPlugin.generate(compiled.canonical, { outDir: dir });
    const scalaGen = scalaCodegenPlugin.generate(compiled.canonical, { outDir: dir, packageName: 'example.lab' });
    assert.ok(tsGen.files.some(f => f.path === 'generated-scaffold/ts/storage-bin.behavior.ts'));
    assert.ok(tsGen.files.some(f => f.path === 'handwritten/lot-settlement-confirm-units.cloze.ts'));
    assert.ok(scalaGen.files.some(f => f.path === 'generated-scaffold/scala/example/lab/StorageBinBehavior.scala'));

    // Phase 3: Emit real executable BDD oracles (TS + Scala + Gherkin + SHA-256 manifest)
    const emitted = emitV2ExecutableTests(compiled.canonical, {
      outDir: dir,
      targets: ['typescript', 'scala'],
      packageName: 'example.lab',
    });
    assert.ok(emitted.manifestCount >= 6);

    // Verify L1 StorageBin executable TS oracle passes IMMEDIATELY with zero hand-coding
    const l1Run = spawnSync(process.execPath, ['--test', join(dir, 'generated-tests/ts/storage-bin-allocate-batch.ears.spec.ts')], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(l1Run.status, 0, l1Run.stdout + l1Run.stderr);

    // Verify full suite starts RED because L2 LotSettlement @cloze is unimplemented
    const redGate = runV2VerifyGate({
      rootDir: dir,
      targets: ['typescript'],
      canonicalFile,
      dbFile,
    });
    assert.equal(redGate.passed, false, `expected redGate to fail: ${JSON.stringify(redGate, null, 2)}`);
    assert.equal(redGate.tsCheck.passed, false);
    assert.ok(redGate.tsCheck.failedSpecIds.length >= 1);

    // Export Sandwich Context Pack from SQLite + Canonical v2
    const pack = buildSandwichContextPack({
      canonicalV2: compiled.canonical,
      dbFile,
      slotId: 'lot-settlement-confirm-units',
      workspaceDir: dir,
      outMd: join(dir, '.truthsrc/context-pack.md'),
    });
    assert.ok(pack.markdown.includes('Sandwich Context Pack'));
    assert.ok(pack.pack.bottomBread.lockedOracles.length >= 4);

    // Phase 4: Fill ONLY inside @cloze slots (both TS and Scala) cleanly
    const tsClozePath = join(dir, 'handwritten/lot-settlement-confirm-units.cloze.ts');
    const tsClozeSrc = readFileSync(tsClozePath, 'utf8');
    const tsFilled = tsClozeSrc.replace(
      /\/\/ @cloze:start\(lot-settlement-confirm-units\)[\s\S]*?\/\/ @cloze:end\(lot-settlement-confirm-units\)/u,
      [
        '// @cloze:start(lot-settlement-confirm-units)',
        '    const nav = dec(cmd.unitPrice, 4);',
        '    if (decCmp(nav, dec("0.0000", 4)) <= 0) {',
        '      return { ok: false, code: "LOT_BAD_PRICE", ruleId: "LOT_BAD_PRICE" };',
        '    }',
        '    const budget = dec(state.netBudget, 2);',
        '    const u = dec(cmd.units, 0);',
        '    const uPlusOne = dec(cmd.units + 1, 0);',
        '    const exactFloor = cmd.units >= 0 && decCmp(decMul(u, nav), budget) <= 0 && decCmp(decMul(uPlusOne, nav), budget) > 0;',
        '    if (!exactFloor) {',
        '      return { ok: false, code: "LOT_BAD_UNITS", ruleId: "LOT_BAD_UNITS" };',
        '    }',
        '    if (state.settleStatus === "confirmed") {',
        '      return { ok: false, code: "LOT_ALREADY_CONFIRMED", ruleId: "LOT_ALREADY_CONFIRMED" };',
        '    }',
        '    return { ok: true, events: [{ type: "UnitsConfirmed", units: cmd.units, unitPrice: cmd.unitPrice }], ruleId: "LOT_CONFIRMED" };',
        '    // @cloze:end(lot-settlement-confirm-units)',
      ].join('\n'),
    );
    writeFileSync(tsClozePath, tsFilled, 'utf8');

    const scalaClozePath = join(dir, 'handwritten/scala/example/lab/LotSettlementConfirmUnitsCloze.scala');
    const scalaClozeSrc = readFileSync(scalaClozePath, 'utf8');
    const scalaFilled = scalaClozeSrc.replace(
      /\/\/ @cloze:start\(lot-settlement-confirm-units\)[\s\S]*?\/\/ @cloze:end\(lot-settlement-confirm-units\)/u,
      [
        '// @cloze:start(lot-settlement-confirm-units)',
        '    if (cmd.unitPrice <= BigDecimal("0.0000")) Left(DomainRejection("LOT_BAD_PRICE", "LOT_BAD_PRICE"))',
        '    else {',
        '      val exactFloor = cmd.units >= 0L && (BigDecimal(cmd.units) * cmd.unitPrice <= state.netBudget) && (BigDecimal(cmd.units + 1L) * cmd.unitPrice > state.netBudget)',
        '      if (!exactFloor) Left(DomainRejection("LOT_BAD_UNITS", "LOT_BAD_UNITS"))',
        '      else if (state.settleStatus == "confirmed") Left(DomainRejection("LOT_ALREADY_CONFIRMED", "LOT_ALREADY_CONFIRMED"))',
        '      else Right(CommandAccepted(Seq(UnitsConfirmed(cmd.units, cmd.unitPrice)), "LOT_CONFIRMED"))',
        '    }',
        '    // @cloze:end(lot-settlement-confirm-units)',
      ].join('\n'),
    );
    writeFileSync(scalaClozePath, scalaFilled, 'utf8');

    // Run full Stop Hook triple verification gate (TS + Scala!)
    const greenGate = runV2VerifyGate({
      rootDir: dir,
      targets: ['typescript', 'scala'],
      canonicalFile,
      dbFile,
    });
    assert.equal(greenGate.passed, true, JSON.stringify(greenGate, null, 2));
    assert.equal(greenGate.manifestCheck.passed, true);
    assert.equal(greenGate.tsCheck.passed, true);
    assert.equal(greenGate.scalaCheck.passed, true);
    assert.equal(greenGate.provenanceCheck.passed, true);

    // Tamper test: mutating a locked test file MUST be caught by verify-v2 CLI with exit 2
    const lockedSpec = join(dir, 'generated-tests/ts/storage-bin-allocate-batch.ears.spec.ts');
    writeFileSync(lockedSpec, readFileSync(lockedSpec, 'utf8') + '\n// tampered\n', 'utf8');
    const tamperCli = spawnSync(process.execPath, [
      BIN, 'verify-v2', '--root', dir, '--target', 'typescript',
    ], { encoding: 'utf8' });
    assert.equal(tamperCli.status, 2);
    const tamperJson = JSON.parse(tamperCli.stdout);
    assert.equal(tamperJson.manifestCheck.passed, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('v2 First-Hit compiler detects shadowed unreachable rule and supports application stories', () => {
  const dir = makeTempDir('coarising-v2-shadow-app-');
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'specs-shadow'), { recursive: true });
    mkdirSync(join(dir, 'specs-app'), { recursive: true });

    writeFileSync(join(dir, 'structures/app.yaml'), `
system: intake-lab
context: intake

aggregates:
  - name: Ticket
    stateFields:
      - level: Int = 0
    commands:
      - name: Classify
        parameters:
          - score: Int
        produces: [Classified]
    events:
      - name: Classified
        fields:
          - score: Int

stories:
  - name: TicketIntake
    pins: [TicketOriginal]
    responses: [IntakeAck]
    callerContract:
      idempotencyKey: "(actor, reqId)"

ports:
  - name: IntakePort
    operations:
      - name: submit
        parameters:
          - actor: ActorId
          - reqId: RequestId

valueObjects:
  - name: IntakeAck
    fields:
      - replayed: Bool

externContracts:
  - name: authOk
    params:
      - actor: ActorId
  - name: seenBefore
    params:
      - actor: ActorId
      - reqId: RequestId
`, 'utf8');

    // Shadowed rule: [S2] is strictly subsumed by [S1] in First-Hit order
    writeFileSync(join(dir, 'specs-shadow/ticket.ears'), `
slice Ticket.Classify
rules:
  [S1] IF score < 10 THEN SHALL reject request with LOW
  [S2] IF score < 5  THEN SHALL reject request with VERY_LOW
  [S3] WHILE score >= 10 WHEN Classify SHALL emit Classified
`, 'utf8');

    const shadowRes = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'specs-shadow'),
    });
    assert.equal(shadowRes.passed, false);
    assert.ok(shadowRes.diagnostics.some(d => d.code === 'V2_FIRST_HIT_SHADOWED_RULE'));

    // Application story with extern + pin + dispatch + SHALL NOT dispatch + respond
    writeFileSync(join(dir, 'specs-app/intake.story.ears'), `
story TicketIntake layer application
where:
  extern authOk(actor)
  extern seenBefore(actor, reqId)
rules:
  [APP_1] IF not authOk(actor) WHEN IntakePort.submit THEN SHALL reject request with DENY
  [APP_2] WHILE not seenBefore(actor, reqId)
          WHEN IntakePort.submit AND authOk(actor)
          SHALL pin TicketOriginal from (actor, reqId)
            AND dispatch Ticket.Classify
            AND respond IntakeAck with ack.replayed == false
  [APP_3] WHILE seenBefore(actor, reqId)
          WHEN IntakePort.submit AND authOk(actor)
          SHALL respond IntakeAck with ack.replayed == true
            AND SHALL NOT dispatch Ticket.Classify
`, 'utf8');

    const appRes = compileCanonicalV2({
      structuresDir: join(dir, 'structures'),
      specsPath: join(dir, 'specs-app'),
      outFile: join(dir, '.truthsrc/canonical-v2.json'),
      dbFile: join(dir, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(appRes.passed, true, JSON.stringify(appRes.diagnostics));
    assert.equal(appRes.canonical.behaviors[0].layer, 'application');
    assert.equal(appRes.canonical.behaviors[0].theory.codegenChannel, 'cloze-tdd');

    typescriptCodegenPlugin.generate(appRes.canonical, { outDir: dir });
    emitV2ExecutableTests(appRes.canonical, { outDir: dir, targets: ['typescript'] });
    const clozeFile = join(dir, 'handwritten/ticket-intake.cloze.ts');
    const filled = readFileSync(clozeFile, 'utf8').replace(
      /\/\/ @cloze:start\(ticket-intake\)[\s\S]*?\/\/ @cloze:end\(ticket-intake\)/u,
      [
        '// @cloze:start(ticket-intake)',
        '    if (!externs.authOk(req.payload.actor)) return { ok: false, code: "DENY", ruleId: "APP_1" };',
        '    if (!externs.seenBefore(req.payload.actor, req.payload.reqId)) {',
        '      effects.pin("TicketOriginal", { actor: req.payload.actor, reqId: req.payload.reqId });',
        '      effects.dispatch("Ticket.Classify", req.payload);',
        '      return { ok: true, ruleId: "APP_2", responseType: "IntakeAck", response: { replayed: false } };',
        '    }',
        '    return { ok: true, ruleId: "APP_3", responseType: "IntakeAck", response: { replayed: true } };',
        '    // @cloze:end(ticket-intake)',
      ].join('\n'),
    );
    writeFileSync(clozeFile, filled, 'utf8');

    const gate = runV2VerifyGate({
      rootDir: dir,
      targets: ['typescript'],
      canonicalFile: join(dir, '.truthsrc/canonical-v2.json'),
      dbFile: join(dir, '.truthsrc/knowledge.sqlite'),
    });
    assert.equal(gate.passed, true, JSON.stringify(gate, null, 2));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
