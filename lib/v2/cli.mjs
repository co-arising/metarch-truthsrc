// CLI entrypoints for co-arising 2.0:
// compile-v2, generate-v2, emit-tests-v2, context-pack-v2, verify-v2,
// audit-coverage-v2, run-tck-v2, guard-write, init-hooks, init-v2, check-v2.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileCanonicalV2 } from './compiler.mjs';
import { getCodegenPlugin } from './codegen/interface.mjs';
import './codegen/typescript.mjs';
import './codegen/scala.mjs';
import { emitV2ExecutableTests } from './test-emitter/emit.mjs';
import { buildSandwichContextPack } from './context-pack.mjs';
import { runV2VerifyGate } from './verify-gate.mjs';
import { auditFullCoverageV2 } from './coverage-audit.mjs';
import { runEffectTckByProtocol, runJvmEffectTck } from './effect-tck.mjs';
import { evaluateWriteGuard, initHooksV2 } from './guard-write.mjs';
import { initV2Project } from './init-v2.mjs';
import { renderCheckV2Human, runCheckV2 } from './check-v2.mjs';
import {
  deriveClozeTasksV2,
  getNextTaskWithContextPack,
  recordTaskBlindReviewV2,
  renderTasksV2Human,
} from './tasks-v2.mjs';
import { exportV2WorkshopHtml } from './view-v2.mjs';

const BOOL_FLAGS = new Set([
  '--no-gap-check',
  '--no-bilingual-check',
  '--strict-lineage',
  '--include-zh',
  '--overwrite-cloze',
  '--with-scaffold',
  '--force-scaffold',
  '--strict',
  '--no-strict',
  '--force',
  '--sync',
  '--skip-coverage',
  '--skip-compile',
  '--no-hooks',
  '--next',
  '--include-done',
  '--record-review',
]);

function parseFlags(argv, { allowPositional = false } = {}) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith('--')) {
      if (allowPositional) {
        positionals.push(tok);
        continue;
      }
      throw new Error(`unexpected positional argument: ${tok}`);
    }
    if (BOOL_FLAGS.has(tok)) {
      flags[tok] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`missing value for flag ${tok}`);
    flags[tok] = next;
    i += 1;
  }
  return allowPositional ? { flags, positionals } : flags;
}

function resolveStrictFlag(flags) {
  if (flags['--strict']) return true;
  if (flags['--no-strict']) return false;
  return Boolean(process.env.CI);
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
    checkBilingual: !flags['--no-bilingual-check'],
    outAcDir: flags['--out-ac'] ?? null,
    outTablesDir: flags['--out-tables'] ?? null,
    projectionLang: flags['--lang'] ?? 'zh',
    strictLineage: Boolean(flags['--strict-lineage']),
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
    if ((res.projections ?? []).length > 0) lines.push(`  projections -> ${res.projections.length} file(s) emitted`);
    if ((res.bilingualChecks ?? []).length > 0) lines.push(`  bilingual -> ${res.bilingualChecks.length} EN/ZH pair(s) verified equivalent`);
  } else {
    lines.push('[BLOCKED] Canonical Model v2 emission refused by compiler/SMT gate');
    for (const d of res.diagnostics) {
      const loc = d.location ? ` (${d.location})` : '';
      lines.push(`  - [${d.severity.toUpperCase()}] ${d.code}${loc}: ${d.message}`);
      if (d.snippet) lines.push(d.snippet);
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
      withScaffold: Boolean(flags['--with-scaffold']),
      forceScaffold: Boolean(flags['--force-scaffold']),
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
    strict: resolveStrictFlag(flags),
    scalaClasspath: flags['--scala-classpath'] ?? null,
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
  const protocol = flags['--protocol'] ?? 'three-phase-reconcile';
  if (flags['--scala-src']) {
    if (!flags['--jvm-class']) throw new Error('run-tck-v2 with --scala-src requires --jvm-class <MainClass>');
    return runJvmEffectTck({
      scalaSource: flags['--scala-src'],
      mainClass: flags['--jvm-class'],
      protocol,
      classpath: flags['--scala-classpath'] ?? null,
    });
  }
  if (!flags['--adapter']) throw new Error('run-tck-v2 requires --adapter <module-path> (or --scala-src <dir> --jvm-class <MainClass>)');
  const exportName = flags['--export'] ?? 'createEffectAdapter';
  const mod = await import(pathToFileURL(resolve(flags['--adapter'])).href);
  const factory = mod[exportName];
  if (typeof factory !== 'function') {
    throw new Error(`V2_TCK_INVALID_ADAPTER: module "${flags['--adapter']}" does not export function "${exportName}"`);
  }
  return runEffectTckByProtocol(protocol, factory);
}

export function guardWriteCli(argv) {
  const flags = parseFlags(argv);
  const rootDir = flags['--root'] ? resolve(flags['--root']) : process.cwd();
  const activeCloze = flags['--active-cloze'] ?? process.env.COARISING_ACTIVE_CLOZE ?? '';
  let raw;
  if (flags['--payload']) {
    raw = flags['--payload'];
  } else {
    try {
      raw = readFileSync(0, 'utf8').trim();
    } catch {
      return { allowed: true };
    }
  }
  if (!raw) return { allowed: true };
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    return { allowed: false, code: 'INVALID_HOOK_JSON', reason: `invalid hook JSON: ${err.message}` };
  }
  return evaluateWriteGuard(payload, { rootDir, activeCloze });
}

export function initHooksV2Cli(argv) {
  const flags = parseFlags(argv);
  const rootDir = flags['--root'] ?? process.cwd();
  const targets = (flags['--target'] ?? 'typescript').split(',').map(s => s.trim()).filter(Boolean);
  return initHooksV2({
    rootDir,
    bin: flags['--bin'] ?? 'truthsrc',
    targets,
    force: Boolean(flags['--force']),
  });
}

export function initV2Cli(argv) {
  const { flags, positionals } = parseFlags(argv, { allowPositional: true });
  const targetDir = positionals[0] ?? flags['--dir'];
  if (!targetDir) throw new Error('init-v2 requires <dir> (or --dir <dir>)');
  const targets = (flags['--target'] ?? 'typescript').split(',').map(s => s.trim()).filter(Boolean);
  return initV2Project({
    targetDir,
    system: flags['--system'] ?? null,
    context: flags['--context'] ?? 'core',
    targets,
    packageName: flags['--package'] ?? 'example.v2',
    solver: flags['--solver'] ?? 'z3',
    force: Boolean(flags['--force']),
    skipCompile: Boolean(flags['--skip-compile']),
    initHooks: !flags['--no-hooks'],
  });
}

export function checkV2Cli(argv) {
  const flags = parseFlags(argv);
  const format = flags['--format'] ?? 'json';
  if (format !== 'json' && format !== 'human') throw new Error('--format must be human or json');
  const targets = flags['--target']
    ? flags['--target'].split(',').map(s => s.trim()).filter(Boolean)
    : null;
  const res = runCheckV2({
    rootDir: flags['--root'] ?? process.cwd(),
    projectFile: flags['--project'] ?? null,
    structuresDir: flags['--structures'] ?? null,
    behaviorsPath: flags['--behaviors'] ?? flags['--specs'] ?? null,
    coverageManifest: flags['--manifest'] ?? null,
    effectBindingFile: flags['--binding'] ?? null,
    targets,
    packageName: flags['--package'] ?? null,
    solver: flags['--solver'] ?? 'z3',
    bmcSteps: flags['--bmc-steps'] !== undefined ? Number(flags['--bmc-steps']) : 4,
    checkGaps: !flags['--no-gap-check'],
    strict: resolveStrictFlag(flags),
    scalaClasspath: flags['--scala-classpath'] ?? null,
    sync: Boolean(flags['--sync']),
    skipCoverage: Boolean(flags['--skip-coverage']),
  });
  return { ...res, format };
}

export function tasksV2Cli(argv) {
  const flags = parseFlags(argv);
  const format = flags['--format'] ?? 'json';
  if (format !== 'json' && format !== 'human') throw new Error('--format must be human or json');
  const targets = flags['--target']
    ? flags['--target'].split(',').map(s => s.trim()).filter(Boolean)
    : null;
  const common = {
    rootDir: flags['--root'] ?? process.cwd(),
    projectFile: flags['--project'] ?? null,
    canonicalFile: flags['--canonical'] ?? null,
    dbFile: flags['--db'] ?? null,
    effectBindingFile: flags['--binding'] ?? null,
    targets,
    packageName: flags['--package'] ?? null,
  };
  if (flags['--record-review']) {
    return {
      ...recordTaskBlindReviewV2({
        ...common,
        slotId: flags['--slot'] ?? null,
        verdict: flags['--verdict'] ?? null,
        reviewer: flags['--reviewer'] ?? 'blind-reviewer',
        notes: flags['--notes'] ?? '',
      }),
      format,
    };
  }
  if (flags['--next']) {
    return { ...getNextTaskWithContextPack(common), format };
  }
  return {
    ...deriveClozeTasksV2({ ...common, includeDone: Boolean(flags['--include-done']) }),
    format,
  };
}

export function viewV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--out']) throw new Error('view-v2 requires --out <workshop.html>');
  return exportV2WorkshopHtml({
    rootDir: flags['--root'] ?? process.cwd(),
    outFile: flags['--out'],
    projectFile: flags['--project'] ?? null,
    dbFile: flags['--db'] ?? null,
    pathPrefix: flags['--path-prefix'] ?? '',
    title: flags['--title'] ?? null,
    subtitle: flags['--subtitle'] ?? null,
    chaptersFile: flags['--chapters'] ?? null,
  });
}

export { renderCheckV2Human, renderTasksV2Human };
