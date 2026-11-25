#!/usr/bin/env node
// Three-way classic CQRS conformance audit CLI.
// Usage:
//   node tools/three-way-conformance-audit.mjs [--strict] [--json]
import path from 'node:path';
import { runThreeWayAudit } from '../lib/conformance/audit.mjs';

const args = new Set(process.argv.slice(2));
const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const report = runThreeWayAudit({
  targetRoot: path.join(workspaceRoot, 'bank-wealth-demo/generated/current'),
  targetBaseRel: 'app/example/bankwealth',
  playAkkaRoot: path.join(workspaceRoot, 'playAkkaCQRS'),
  goldenMasterRoot: path.join(workspaceRoot, 'backkend-codegen/golden_master'),
});

if (args.has('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  const { summary, violations } = report;
  process.stdout.write(
    `Three-Way Classic CQRS Conformance Audit\n` +
    `  Violations: ${summary.totalViolations} (P0=${summary.p0Count}, P1=${summary.p1Count})\n` +
    `  By Gate:    G1=${summary.byGate.G1}, G2=${summary.byGate.G2}, G3=${summary.byGate.G3}, G4=${summary.byGate.G4}\n`,
  );
  for (const v of violations) {
    process.stdout.write(`  [${v.gate}][${v.severity}] ${v.rule} :: ${v.file} — ${v.message}\n`);
  }
}

if (args.has('--strict') && report.summary.totalViolations > 0) {
  process.exitCode = 1;
}
