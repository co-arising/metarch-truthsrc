// CLI entrypoints for co-arising 2.0: compile-v2, generate-v2, emit-tests-v2, context-pack-v2, verify-v2.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCanonicalV2 } from './compiler.mjs';
import { getCodegenPlugin } from './codegen/interface.mjs';
import './codegen/typescript.mjs';
import './codegen/scala.mjs';
import { emitV2ExecutableTests } from './test-emitter/emit.mjs';
import { buildSandwichContextPack } from './context-pack.mjs';
import { runV2VerifyGate } from './verify-gate.mjs';
import { auditFullCoverageV2 } from './coverage-audit.mjs';
import { runThreePhaseEffectTck } from './effect-tck.mjs';
import { pathToFileURL } from 'node:url';

function parseFlags(argv) {
  const flags = {};
  const boolFlags = new Set(['--no-gap-check', '--include-zh', '--overwrite-cloze']);
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith('--')) throw new Error(`unexpected positional argument: ${tok}`);
    if (boolFlags.has(tok)) {
      flags[tok] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`missing value for flag ${tok}`);
    flags[tok] = next;
    i += 1;
  }
  return flags;
}

export function compileV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--structures']) throw new Error('compile-v2 requires --structures <dir>');
  const behaviorsPath = flags['--behaviors'] ?? flags['--specs'];
  if (!behaviorsPath) throw new Error('compile-v2 requires --behaviors <file-or-dir> (or legacy alias --specs)');
  const format = flags['--format'] ?? 'json';
  if (format !== 'json' && format !== 'human') throw new Error('--format must be human or json');

  const result = compileCanonicalV2({
    structuresDir: flags['--structures'],
    specsPath: behaviorsPath,
    outFile: flags['--out'] ?? null,
    dbFile: flags['--db'] ?? null,
    solver: flags['--solver'] ?? 'z3',
    bmcSteps: flags['--bmc-steps'] !== undefined ? Number(flags['--bmc-steps']) : 4,
    checkGaps: !flags['--no-gap-check'],
    includeZh: Boolean(flags['--include-zh']),
  });
  return { ...result, format };
}

export function renderCompileV2Human(res) {
  const lines = [];
  if (res.passed) {
    const s = res.canonical.verificationSummary;
    lines.push(`[PASS] Canonical Model v2 compiled (${res.canonical.system}/${res.canonical.context}, sha256=${res.canonical.canonicalSha256.slice(0, 12)})`);
    lines.push(`  behaviors: ${s.behaviorCount} (Channel 4A deterministic: ${s.deterministicCount}, Channel 4B @cloze TDD: ${s.clozeCount})`);
    if (res.outFile) lines.push(`  canonical -> ${res.outFile}`);
    if (res.dbInfo) lines.push(`  sqlite    -> ${res.dbInfo.file} (${res.dbInfo.nodeCount} nodes, ${res.dbInfo.edgeCount} edges)`);
  } else {
    lines.push('[BLOCKED] Canonical Model v2 emission refused by compiler/SMT gate');
    for (const d of res.diagnostics) {
      lines.push(`  - [${d.severity.toUpperCase()}] ${d.code}: ${d.message}`);
    }
    for (const card of res.clarificationCards ?? []) {
      lines.push('');
      lines.push(card.markdown);
    }
  }
  return lines.join('\n');
}

export function generateV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--in']) throw new Error('generate-v2 requires --in <canonical-v2.json>');
  if (!flags['--out']) throw new Error('generate-v2 requires --out <dir>');
  const targets = (flags['--target'] ?? 'typescript').split(',').map(s => s.trim()).filter(Boolean);
  const canonicalV2 = JSON.parse(readFileSync(resolve(flags['--in']), 'utf8'));
  const results = [];
  for (const target of targets) {
    const plugin = getCodegenPlugin(target);
    if (!plugin) throw new Error(`unknown v2 codegen target: ${target}`);
    results.push(plugin.generate(canonicalV2, {
      outDir: flags['--out'],
      packageName: flags['--package'] ?? 'example.v2',
      overwriteCloze: Boolean(flags['--overwrite-cloze']),
    }));
  }
  return {
    schemaVersion: 'co-arising.generate-v2-batch/v1',
    canonicalSha256: canonicalV2.canonicalSha256,
    targets,
    results,
  };
}

export function emitTestsV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--in']) throw new Error('emit-tests-v2 requires --in <canonical-v2.json>');
  if (!flags['--out']) throw new Error('emit-tests-v2 requires --out <dir>');
  const targets = (flags['--target'] ?? 'typescript').split(',').map(s => s.trim()).filter(Boolean);
  const canonicalV2 = JSON.parse(readFileSync(resolve(flags['--in']), 'utf8'));
  return emitV2ExecutableTests(canonicalV2, {
    outDir: flags['--out'],
    targets,
    packageName: flags['--package'] ?? 'example.v2',
  });
}

export function contextPackV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--in']) throw new Error('context-pack-v2 requires --in <canonical-v2.json>');
  if (!flags['--slot']) throw new Error('context-pack-v2 requires --slot <slot-id>');
  const canonicalV2 = JSON.parse(readFileSync(resolve(flags['--in']), 'utf8'));
  const res = buildSandwichContextPack({
    canonicalV2,
    dbFile: flags['--db'] ? resolve(flags['--db']) : null,
    slotId: flags['--slot'],
    workspaceDir: flags['--workspace'] ?? null,
    outMd: flags['--out-md'] ?? null,
    outJson: flags['--out-json'] ?? null,
  });
  return {
    schemaVersion: 'co-arising.context-pack-cli/v1',
    slotId: flags['--slot'],
    outMd: res.outMd,
    outJson: res.outJson,
    lockedOracleCount: res.pack.bottomBread.lockedOracles.length,
  };
}

export function verifyV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--root']) throw new Error('verify-v2 requires --root <dir>');
  const targets = (flags['--target'] ?? 'typescript').split(',').map(s => s.trim()).filter(Boolean);
  return runV2VerifyGate({
    rootDir: flags['--root'],
    targets,
    canonicalFile: flags['--canonical'] ?? null,
    dbFile: flags['--db'] ?? null,
    provenanceOut: flags['--provenance-out'] ?? null,
  });
}

export function auditCoverageV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--root']) throw new Error('audit-coverage-v2 requires --root <dir>');
  if (!flags['--manifest']) throw new Error('audit-coverage-v2 requires --manifest <coverage-manifest.json>');
  return auditFullCoverageV2({
    rootDir: flags['--root'],
    manifestFile: flags['--manifest'],
    effectBindingFile: flags['--binding'] ?? null,
    dbFile: flags['--db'] ?? null,
  });
}

export async function runTckV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--adapter']) throw new Error('run-tck-v2 requires --adapter <module-path>');
  const exportName = flags['--export'] ?? 'createEffectAdapter';
  const mod = await import(pathToFileURL(resolve(flags['--adapter'])).href);
  const factory = mod[exportName];
  if (typeof factory !== 'function') {
    throw new Error(`V2_TCK_INVALID_ADAPTER: module "${flags['--adapter']}" does not export function "${exportName}"`);
  }
  return runThreePhaseEffectTck(factory);
}
