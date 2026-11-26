// Generic tests for co-arising 2.0 full-coverage governance audit (D1/D2/S1/S2/S3, E1-E4,
// stale human signoff detection, arch forbidden imports) and S1 8-scenario fault-injection TCK.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { auditFullCoverageV2 } from '../lib/v2/coverage-audit.mjs';
import { runThreePhaseEffectTck } from '../lib/v2/effect-tck.mjs';

function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

function createConformantAdapter({ store, external, downstream }) {
  return {
    submit(key, payload) {
      const existing = store.get(key);
      if (existing) {
        if (JSON.stringify(existing.payload) !== JSON.stringify(payload)) {
          return { ok: false, code: 'PAYLOAD_CONFLICT' };
        }
        return { ok: true, replayed: true, status: existing.status };
      }
      store.put(key, { payload, status: 'PINNED' });
      const res = external.execute(key, payload);
      if (res.outcome === 'CONFIRMED') {
        store.put(key, { payload, status: 'CONFIRMED', receiptId: res.receiptId });
        downstream.recordConfirmed(key, res);
        return { ok: true, replayed: false, status: 'CONFIRMED' };
      }
      if (res.outcome === 'REJECTED') {
        store.put(key, { payload, status: 'COMPENSATED', reason: res.reason });
        downstream.triggerCompensation(key, res.reason);
        return { ok: true, replayed: false, status: 'COMPENSATED' };
      }
      store.put(key, { payload, status: 'PENDING_RECONCILE' });
      return { ok: true, replayed: false, status: 'PENDING_RECONCILE' };
    },
    reconcile(key) {
      const existing = store.get(key);
      if (!existing) return { ok: false, code: 'UNKNOWN_ORIGINAL' };
      if (existing.status === 'CONFIRMED' || existing.status === 'COMPENSATED') {
        return { ok: true, status: existing.status };
      }
      const q = external.queryStatus(key);
      if (q.status === 'CONFIRMED') {
        store.put(key, { ...existing, status: 'CONFIRMED', receiptId: q.receiptId });
        downstream.recordConfirmed(key, q);
        return { ok: true, status: 'CONFIRMED' };
      }
      if (q.status === 'ABSENT' && q.absenceProof) {
        store.put(key, { ...existing, status: 'COMPENSATED', absenceProof: q.absenceProof });
        downstream.triggerCompensation(key, q.absenceProof);
        return { ok: true, status: 'COMPENSATED' };
      }
      return { ok: true, status: 'PENDING_RECONCILE' };
    },
    recoverAll() {
      const pending = store.listPending();
      let recoveredCount = 0;
      for (const item of pending) {
        const res = this.reconcile(item.key);
        if (res.ok && res.status !== 'PENDING_RECONCILE') recoveredCount += 1;
      }
      return { ok: true, recoveredCount };
    },
    ingestReceipt(key, receipt) {
      const existing = store.get(key);
      if (!existing) return { ok: false, code: 'UNKNOWN_ORIGINAL' };
      if (existing.status === 'CONFIRMED' || existing.status === 'COMPENSATED') {
        return { ok: true, status: existing.status };
      }
      if (receipt.outcome === 'CONFIRMED') {
        store.put(key, { ...existing, status: 'CONFIRMED', receiptId: receipt.receiptId });
        downstream.recordConfirmed(key, receipt);
        return { ok: true, status: 'CONFIRMED' };
      }
      return { ok: true, status: existing.status };
    },
  };
}

test('auditFullCoverageV2 enforces 100% file coverage, stale E4 signoff detection, inline markers, and forbidden imports', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coarising-cov-'));
  try {
    mkdirSync(join(dir, 'domain'), { recursive: true });
    mkdirSync(join(dir, 'infra'), { recursive: true });
    mkdirSync(join(dir, 'ui'), { recursive: true });

    const domainCode = '// domain pure module\nexport const x = 1;\n';
    const adapterCode = '// @coarising:contract(gateway-effect, stage=stage-1-shadow)\nexport const y = 2;\n';
    const uiCode = 'export const renderPage = () => "<main>ok</main>";\n';
    writeFileSync(join(dir, 'domain/core.ts'), domainCode, 'utf8');
    writeFileSync(join(dir, 'infra/gateway.ts'), adapterCode, 'utf8');
    writeFileSync(join(dir, 'ui/page.ts'), uiCode, 'utf8');

    const bindingFile = join(dir, 'effect-binding.yaml');
    writeFileSync(bindingFile, `
schemaVersion: co-arising.effect-binding/v2
system: lab
context: core
architectureStyle: cqrs-es-three-phase-effect
forbiddenImports:
  - id: ARCH_DOMAIN_NO_INFRA
    scopePrefix: domain/
    forbidPattern: "from\\\\s+[\\"']\\\\.\\\\./infra/"
    reason: domain layer must never import infrastructure layer
effects:
  - name: GatewayEffect
    protocol: three-phase-reconcile
    idempotencyKey: "(actor, reqId)"
    timeoutMs: 3000
    maxRetries: 3
    compensationRequiresAbsenceProof: true
    crashRecoveryZeroNewAuth: true
`, 'utf8');

    const manifestFile = join(dir, 'coverage-manifest.json');
    const writeManifest = (files) => writeFileSync(manifestFile, JSON.stringify({
      schemaVersion: 'co-arising.coverage-manifest/v2',
      system: 'lab',
      context: 'core',
      effectBindingFile: 'effect-binding.yaml',
      governedRoots: [
        { root: 'domain', extensions: ['.ts'] },
        { root: 'infra', extensions: ['.ts'] },
        { root: 'ui', extensions: ['.ts'] },
      ],
      files,
    }, null, 2), 'utf8');

    // 1. Clean 100% coverage passes and writes SQLite ledger
    writeManifest([
      { path: 'domain/core.ts', branch: 'problem', tier: 'D1', stage: 'stage-3-generated', evidenceTier: 'E1', contractRef: 'Core.Step', shadowMode: 'none', rationale: 'Pure domain logic' },
      { path: 'infra/gateway.ts', branch: 'solution', tier: 'S1', stage: 'stage-1-shadow', evidenceTier: 'E2', contractRef: 'GatewayEffect', shadowMode: 'inline-marker', rationale: 'Shadow-verified effect adapter' },
      {
        path: 'ui/page.ts',
        branch: 'solution',
        tier: 'S3',
        stage: 'stage-0-raw',
        evidenceTier: 'E4',
        contractRef: 'page-view',
        shadowMode: 'none',
        rationale: 'Browser view',
        humanSignoff: { reviewer: 'alice', fileSha256: sha256Text(uiCode), signedAt: '2026-11-26T00:00:00Z', checklist: ['xss-escaped', 'ux-approved'] },
      },
    ]);

    const dbFile = join(dir, 'knowledge.sqlite');
    const clean = auditFullCoverageV2({ rootDir: dir, manifestFile, dbFile });
    assert.equal(clean.passed, true, JSON.stringify(clean.diagnostics));
    assert.equal(clean.coverageRatio, 1);
    assert.equal(clean.dbRecord.count, 3);

    const db = new DatabaseSync(dbFile, { readOnly: true });
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM file_coverage').get().n, 3);
    } finally {
      db.close();
    }

    // 2. Uncovered gray-zone file triggers V2_UNCOVERED_FILE
    writeFileSync(join(dir, 'infra/rogue.ts'), 'export const z = 3;\n', 'utf8');
    const withGray = auditFullCoverageV2({ rootDir: dir, manifestFile });
    assert.equal(withGray.passed, false);
    assert.ok(withGray.diagnostics.some(d => d.code === 'V2_UNCOVERED_FILE' && d.file === 'infra/rogue.ts'));
    rmSync(join(dir, 'infra/rogue.ts'));

    // 3. Modifying E4 UI file without re-signing triggers V2_STALE_HUMAN_SIGNOFF
    writeFileSync(join(dir, 'ui/page.ts'), uiCode + '// changed copy\n', 'utf8');
    const staleSign = auditFullCoverageV2({ rootDir: dir, manifestFile });
    assert.equal(staleSign.passed, false);
    assert.ok(staleSign.diagnostics.some(d => d.code === 'V2_STALE_HUMAN_SIGNOFF'));
    writeFileSync(join(dir, 'ui/page.ts'), uiCode, 'utf8');

    // 4. Forbidden cross-layer import in domain/ triggers V2_ARCH_FORBIDDEN_IMPORT
    writeFileSync(join(dir, 'domain/core.ts'), 'import { y } from "../infra/gateway.ts";\nexport const x = y;\n', 'utf8');
    const badArch = auditFullCoverageV2({ rootDir: dir, manifestFile });
    assert.equal(badArch.passed, false);
    assert.ok(badArch.diagnostics.some(d => d.code === 'V2_ARCH_FORBIDDEN_IMPORT' && d.ruleId === 'ARCH_DOMAIN_NO_INFRA'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runThreePhaseEffectTck passes 8/8 on conformant adapter and catches blind timeout compensation bug', () => {
  const green = runThreePhaseEffectTck(createConformantAdapter);
  assert.equal(green.passed, true, JSON.stringify(green.results.filter(r => !r.passed), null, 2));
  assert.equal(green.passedCount, 8);

  // Buggy adapter: blindly triggers compensation immediately on UNKNOWN_TIMEOUT without absence proof
  const buggyFactory = deps => {
    const base = createConformantAdapter(deps);
    return {
      ...base,
      submit(key, payload) {
        const res = base.submit(key, payload);
        if (res.status === 'PENDING_RECONCILE') {
          deps.downstream.triggerCompensation(key, 'BLIND_TIMEOUT_REFUND');
        }
        return res;
      },
    };
  };
  const red = runThreePhaseEffectTck(buggyFactory);
  assert.equal(red.passed, false);
  assert.ok(red.failedIds.includes('TCK-04-TIMEOUT-NO-BLIND-COMPENSATION'));
});
