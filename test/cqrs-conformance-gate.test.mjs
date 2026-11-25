// Automated four-gate classic CQRS conformance test suite.
// Validates that playAkkaCQRS matches the canonical contract and tracks
// bank-wealth-demo convergence across Phases B -> C -> D.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  extractReferenceFingerprint,
  loadContract,
  runThreeWayAudit,
} from '../lib/conformance/audit.mjs';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..');
const PLAY_AKKA_ROOT = path.join(WORKSPACE_ROOT, 'playAkkaCQRS');
const GOLDEN_MASTER_ROOT = path.join(WORKSPACE_ROOT, 'backkend-codegen/golden_master');
const BANK_GENERATED = path.join(WORKSPACE_ROOT, 'bank-wealth-demo/generated/current');

test('conformance contract: playAkkaCQRS golden sample satisfies all classic fingerprint capabilities', () => {
  const fp = extractReferenceFingerprint(PLAY_AKKA_ROOT, 'app/net/imadz');
  assert.equal(fp['command-helper']?.usesCommandHelper, true, 'golden command-helper must use common-core CommandHelper');
  assert.equal(fp['aggregate-behavior']?.usesRunReplyingPolicy, true, 'golden behavior must use runReplyingPolicy');
  assert.equal(fp['invariant-rule']?.usesInvariantRule, true, 'golden invariant must use InvariantRule');
  assert.equal(fp['aggregate-protocol']?.usesCborSerializable, true, 'golden protocol must use CborSerializable');
  assert.equal(fp['aggregate-root']?.usesClusterSharding, true, 'golden aggregate root must declare EntityTypeKey');
  assert.equal(fp['projection']?.usesAkkaProjection, true, 'golden projection must use JdbcProjection.exactlyOnce');
  assert.equal(fp['projection-handler']?.usesAkkaProjection, true, 'golden projection handler must extend JdbcHandler');
  assert.equal(fp['proto-converter']?.usesPrimitiveConverter, true, 'golden proto converter must extend PrimitiveConverter');
});

test('conformance contract: backkend-codegen golden_master matches playAkkaCQRS on core classic capabilities', () => {
  const fp = extractReferenceFingerprint(GOLDEN_MASTER_ROOT, 'net/imadz');
  assert.equal(fp['command-helper']?.usesCommandHelper, true);
  assert.equal(fp['aggregate-behavior']?.usesRunReplyingPolicy, true);
  assert.equal(fp['invariant-rule']?.usesInvariantRule, true);
  assert.equal(fp['aggregate-protocol']?.usesCborSerializable, true);
  assert.equal(fp['aggregate-root']?.usesClusterSharding, true);
  assert.equal(fp['projection']?.usesAkkaProjection, true);
  assert.equal(fp['proto-converter']?.usesPrimitiveConverter, true);
});

test('conformance audit: bank-wealth-demo/generated/current passes all 4 classic CQRS hard gates with 0 violations', () => {
  const contract = loadContract();
  assert.equal(contract.commonCore.version, '0.2.1');
  const report = runThreeWayAudit({
    targetRoot: BANK_GENERATED,
    targetBaseRel: 'app/example/bankwealth',
    playAkkaRoot: PLAY_AKKA_ROOT,
    goldenMasterRoot: GOLDEN_MASTER_ROOT,
  });
  assert.ok(report.fingerprints.playAkkaCQRS, 'playAkkaCQRS fingerprint must be captured');
  assert.ok(report.fingerprints.backkendCodegenGoldenMaster, 'golden_master fingerprint must be captured');
  assert.ok(report.fingerprints.target, 'target fingerprint must be captured');
  const detail = report.violations.map(v => `[${v.gate}][${v.severity}] ${v.rule} :: ${v.file} — ${v.message}`).join('\n');
  assert.equal(report.summary.byGate.G1, 0, `Gate 1 (topology/DIP/cohesion) failed:\n${detail}`);
  assert.equal(report.summary.byGate.G2, 0, `Gate 2 (common-core/anti-reinventing) failed:\n${detail}`);
  assert.equal(report.summary.byGate.G3, 0, `Gate 3 (artifactType contract) failed:\n${detail}`);
  assert.equal(report.summary.byGate.G4, 0, `Gate 4 (three-way fingerprint) failed:\n${detail}`);
  assert.equal(report.summary.totalViolations, 0, `Expected 0 conformance violations:\n${detail}`);
});
