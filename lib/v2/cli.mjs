// CLI entrypoints for co-arising 2.0:
// compile-v2, generate-v2, emit-tests-v2, context-pack-v2, verify-v2,
// audit-coverage-v2, run-tck-v2, guard-write, init-hooks, init-v2, check-v2.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileCanonicalV2 } from './compiler.mjs';
import { getCodegenPlugin } from './codegen/interface.mjs';
import './codegen/typescript.mjs';
import './codegen/scala.mjs';
import './bridge/v1-strict-scala.mjs';
import { generateScalaCqrsPlayServiceV2ForBc } from '../../generators/scala-cqrs-play-service-v2/generate.mjs';
import { parseStructuredDoc } from './yaml-parser.mjs';
import { emitV2ExecutableTests } from './test-emitter/emit.mjs';
import { buildSandwichContextPack } from './context-pack.mjs';
import { runV2VerifyGate } from './verify-gate.mjs';
import { auditFullCoverageV2 } from './coverage-audit.mjs';
import { auditSystemLineageV2 } from './system-lineage.mjs';
import {
  buildEventMatrixFromCanonical,
  extractEventMatrixFromIngestJson,
  extractEventMatrixFromV1Tree,
  renderEventFlowYamlSnippet,
  renderEventMatrixMarkdown,
} from './event-matrix.mjs';
import { exportAtlasV2 } from './atlas-viewer.mjs';
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
  '--require-scoverage',
  '--sbt-coverage',
  '--mutation-gate',
  '--no-mutation-gate',
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
    bindingsPath: flags['--bindings'] ?? flags['--readside-binding'] ?? flags['--testing-binding'] ?? null,
    outFile: flags['--out'] ?? null,
    dbFile: flags['--db'] ?? null,
    solver: flags['--solver'] ?? 'z3',
    bmcSteps: flags['--bmc-steps'] !== undefined ? Number(flags['--bmc-steps']) : 4,
    checkGaps: !flags['--no-gap-check'],
    includeZh: Boolean(flags['--include-zh']),
    checkBilingual: !flags['--no-bilingual-check'],
    outAcDir: flags['--out-ac'] ?? null,
    outTablesDir: flags['--out-tables'] ?? null,
    outSignoffDir: flags['--out-signoff'] ?? null,
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
  if (!flags['--out']) throw new Error('generate-v2 requires --out <dir>');
  const rawTarget = flags['--generator'] ?? flags['--target'] ?? 'typescript';
  const targets = rawTarget.split(',').map(s => s.trim()).filter(Boolean);

  // Multi-Subdomain -> Single Bounded Context packaging mode (`--bc` / `--canonicals` / `--packaging monolith`)
  if (flags['--bc'] || flags['--canonicals'] || flags['--packaging'] === 'monolith') {
    if (!flags['--canonicals']) throw new Error('generate-v2 BC packaging requires --canonicals <a.json,b.json,...>');
    const canonicalPaths = flags['--canonicals'].split(',').map(s => s.trim()).filter(Boolean);
    const canonicals = canonicalPaths.map(p => JSON.parse(readFileSync(resolve(p), 'utf8')));
    const domainMapPath = flags['--domain-map'] ?? flags['--context-map'] ?? null;
    const domainMap = domainMapPath ? parseStructuredDoc(readFileSync(resolve(domainMapPath), 'utf8'), domainMapPath) : null;
    const bcName = flags['--bc'] ?? domainMap?.boundedContexts?.[0]?.name ?? canonicals[0]?.system ?? canonicals[0]?.context ?? 'monolith';
    const res = generateScalaCqrsPlayServiceV2ForBc({
      domainMap,
      bcName,
      canonicals,
      outDir: flags['--out'],
      packageName: flags['--package'] ?? null,
      packaging: flags['--packaging'] ?? (domainMap ? 'context-map' : 'monolith'),
      overwriteCloze: Boolean(flags['--overwrite-cloze']),
    });
    return {
      schemaVersion: 'co-arising.generate-v2-batch/v1',
      canonicalSha256: res.canonicalSha256,
      packaging: res.packaging,
      boundedContext: res.boundedContext,
      mergedCanonicalPath: res.mergedCanonicalPath,
      targets: ['scala-cqrs-play-service-v2'],
      results: [res],
    };
  }

  if (!flags['--in']) throw new Error('generate-v2 requires --in <canonical-v2.json> (or --canonicals <a.json,b.json> --bc <bcName>)');
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
  const rawTarget = flags['--generator'] ?? flags['--target'] ?? 'typescript';
  const targets = rawTarget.split(',').map(s => s.trim()).filter(Boolean);
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

function resolveTriStateBoolFlag(flags, posFlag, negFlag) {
  if (flags[posFlag]) return true;
  if (flags[negFlag]) return false;
  return null;
}

export function verifyV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--root']) throw new Error('verify-v2 requires --root <dir>');
  const rawTarget = flags['--generator'] ?? flags['--target'] ?? 'typescript';
  const targets = rawTarget.split(',').map(s => s.trim()).filter(Boolean);
  return runV2VerifyGate({
    rootDir: flags['--root'],
    targets,
    canonicalFile: flags['--canonical'] ?? null,
    dbFile: flags['--db'] ?? null,
    provenanceOut: flags['--provenance-out'] ?? null,
    strict: resolveStrictFlag(flags),
    scalaClasspath: flags['--scala-classpath'] ?? null,
    minCoverage: flags['--min-coverage'] !== undefined ? Number(flags['--min-coverage']) : null,
    minBranchCoverage: flags['--min-branch-coverage'] !== undefined ? Number(flags['--min-branch-coverage']) : null,
    scoverageFile: flags['--scoverage'] ?? null,
    requireScoverage: Boolean(flags['--require-scoverage']),
    sbtCoverage: Boolean(flags['--sbt-coverage']),
    mutationGate: resolveTriStateBoolFlag(flags, '--mutation-gate', '--no-mutation-gate'),
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

export function auditSystemLineageV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--canonicals']) throw new Error('audit-system-lineage-v2 requires --canonicals <a.json,b.json,...>');
  const canonicals = flags['--canonicals'].split(',').map(s => s.trim()).filter(Boolean);
  return auditSystemLineageV2({
    canonicals,
    domainMapPath: flags['--domain-map'] ?? flags['--context-map'] ?? null,
    dbFile: flags['--db'] ?? ':memory:',
    outJson: flags['--out'] ?? null,
    outMd: flags['--out-md'] ?? null,
    strictLineage: Boolean(flags['--strict-lineage']),
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
  const rawTarget = flags['--generator'] ?? flags['--target'] ?? 'typescript';
  const targets = rawTarget.split(',').map(s => s.trim()).filter(Boolean);
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
  const rawTarget = flags['--generator'] ?? flags['--target'] ?? 'typescript';
  const targets = rawTarget.split(',').map(s => s.trim()).filter(Boolean);
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
    bindingsPath: flags['--bindings'] ?? null,
    coverageManifest: flags['--manifest'] ?? null,
    effectBindingFile: flags['--binding'] ?? null,
    targets,
    packageName: flags['--package'] ?? null,
    solver: flags['--solver'] ?? 'z3',
    bmcSteps: flags['--bmc-steps'] !== undefined ? Number(flags['--bmc-steps']) : 4,
    checkGaps: !flags['--no-gap-check'],
    strict: resolveStrictFlag(flags),
    scalaClasspath: flags['--scala-classpath'] ?? null,
    minCoverage: flags['--min-coverage'] !== undefined ? Number(flags['--min-coverage']) : null,
    minBranchCoverage: flags['--min-branch-coverage'] !== undefined ? Number(flags['--min-branch-coverage']) : null,
    scoverageFile: flags['--scoverage'] ?? null,
    requireScoverage: Boolean(flags['--require-scoverage']),
    sbtCoverage: Boolean(flags['--sbt-coverage']),
    mutationGate: resolveTriStateBoolFlag(flags, '--mutation-gate', '--no-mutation-gate'),
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

export function eventMatrixV2Cli(argv) {
  const flags = parseFlags(argv);
  let matrix;
  if (flags['--canonical']) {
    const canonical = JSON.parse(readFileSync(resolve(flags['--canonical']), 'utf8'));
    matrix = buildEventMatrixFromCanonical(canonical);
  } else if (flags['--v1-tree'] || flags['--tree']) {
    matrix = extractEventMatrixFromV1Tree(flags['--v1-tree'] ?? flags['--tree']);
  } else if (flags['--ingest']) {
    matrix = extractEventMatrixFromIngestJson(flags['--ingest']);
  } else {
    throw new Error('event-matrix-v2 requires --canonical <file> | --v1-tree <dir> | --ingest <.ingest/file.json>');
  }

  let outMd = null;
  if (flags['--out-md']) {
    outMd = resolve(flags['--out-md']);
    mkdirSync(dirname(outMd), { recursive: true });
    writeFileSync(outMd, renderEventMatrixMarkdown(matrix), 'utf8');
  }
  let outYaml = null;
  if (flags['--out-yaml']) {
    outYaml = resolve(flags['--out-yaml']);
    mkdirSync(dirname(outYaml), { recursive: true });
    writeFileSync(outYaml, renderEventFlowYamlSnippet(matrix), 'utf8');
  }
  let outJson = null;
  if (flags['--out-json'] || flags['--out']) {
    outJson = resolve(flags['--out-json'] ?? flags['--out']);
    mkdirSync(dirname(outJson), { recursive: true });
    writeFileSync(outJson, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  }
  return {
    ...matrix,
    ...(outMd ? { outMd } : {}),
    ...(outYaml ? { outYaml } : {}),
    ...(outJson ? { outJson } : {}),
  };
}

export function atlasV2Cli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--out']) throw new Error('atlas-v2 requires --out <atlas.html>');
  const canonicalFiles = flags['--canonicals']
    ? flags['--canonicals'].split(',').map(s => s.trim()).filter(Boolean)
    : null;
  if (!flags['--canonical'] && !canonicalFiles && !flags['--v1-tree'] && !flags['--tree'] && !flags['--ingest']) {
    throw new Error('atlas-v2 requires --canonical <file> | --canonicals <a,b> | --v1-tree <dir> | --ingest <file.json>');
  }
  return exportAtlasV2({
    canonicalFile: flags['--canonical'] ?? null,
    canonicalFiles,
    domainMapFile: flags['--domain-map'] ?? flags['--context-map'] ?? null,
    v1TreeDir: flags['--v1-tree'] ?? flags['--tree'] ?? null,
    ingestJsonPath: flags['--ingest'] ?? null,
    outFile: flags['--out'],
    outDir: flags['--out-dir'] ?? null,
    title: flags['--title'] ?? null,
  });
}

export { renderCheckV2Human, renderTasksV2Human };
