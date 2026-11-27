// Stop Hook Triple Verification Gate & Provenance Reconciler for co-arising 2.0:
//   1. SHA-256 tamper check on generated-tests/manifest.sha256.json
//   2. Real executable BDD test execution (Node 22 TS node:test and/or scalac+ScalaTest)
//   3. Provenance anchor & @cloze slot boundary reconciliation + SQLite provenance recording
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join, relative, resolve, sep } from 'node:path';
import { checkSolverAvailable } from '../ears/smt-solver.mjs';
import { recordClozeProvenance } from './knowledge-db.mjs';
import { prepareStandaloneKernelFiles, runDomainMutationGate } from './mutation-gate.mjs';
import { resolveEffectiveTargets } from './target-resolution.mjs';

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function collectFiles(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, ext, out);
    else if (entry.isFile() && entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

export function verifyLockedTestsManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    return { passed: false, errors: [`locked manifest missing: ${manifestPath}`], verifiedFiles: 0 };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const baseDir = dirname(manifestPath);
  const errors = [];
  for (const entry of manifest.files ?? []) {
    const abs = resolve(baseDir, entry.path);
    if (!existsSync(abs)) {
      errors.push(`locked test file missing: ${entry.path}`);
      continue;
    }
    const actual = sha256File(abs);
    if (actual !== entry.sha256) {
      errors.push(`tamper detected in locked test "${entry.path}" (expected ${entry.sha256.slice(0, 12)}, got ${actual.slice(0, 12)})`);
    }
  }
  return {
    passed: errors.length === 0,
    errors,
    verifiedFiles: (manifest.files ?? []).length,
    manifestSha256: sha256File(manifestPath),
  };
}

export function extractFailedTsSpecIds(output) {
  // Strip ANSI SGR sequences so colored spec-reporter output parses cleanly too.
  // eslint-disable-next-line no-control-regex
  const plain = String(output ?? '').replace(/\u001b\[[0-9;]*m/gu, '');
  const ids = new Set();
  for (const m of plain.matchAll(/(?:not ok \d+ -|[✖×])\s+\[([A-Z0-9_-]+)\]/gu)) {
    ids.add(m[1]);
  }
  return [...ids];
}

export function extractNodeCoverageMetrics(output) {
  const files = [];
  const lines = String(output ?? '').split('\n');
  for (const raw of lines) {
    // Match Node --experimental-test-coverage table rows:
    // "# foo.behavior.ts | 95.00 | 88.89 | 100.00 | ..." or "ℹ  foo.behavior.ts | 95.00 | ..."
    const m = raw.match(/^(?:#|ℹ)\s+([^\s|][^|]*?)\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)\s+\|/u);
    if (!m) continue;
    const name = m[1].trim();
    if (name === 'all files' || name === 'file') continue;
    files.push({
      file: name,
      linePct: Number(m[2]),
      branchPct: Number(m[3]),
      funcPct: Number(m[4]),
    });
  }
  const behaviorFiles = files.filter(f => /\.(?:behavior|cloze)\.ts$/u.test(f.file) || f.file.includes('handwritten/'));
  const targetSet = behaviorFiles.length > 0 ? behaviorFiles : files;
  const avgLinePct = targetSet.length > 0
    ? Number((targetSet.reduce((acc, f) => acc + f.linePct, 0) / targetSet.length).toFixed(2))
    : null;
  const avgBranchPct = targetSet.length > 0
    ? Number((targetSet.reduce((acc, f) => acc + f.branchPct, 0) / targetSet.length).toFixed(2))
    : null;
  return { files, behaviorFiles, avgLinePct, avgBranchPct };
}

export function parseScoverageXml(xmlText) {
  const text = String(xmlText ?? '');
  const stmtMatch = text.match(/statement-rate="(\d+(?:\.\d+)?)"/u);
  const branchMatch = text.match(/branch-rate="(\d+(?:\.\d+)?)"/u);
  if (!stmtMatch && !branchMatch) return null;
  return {
    statementPct: stmtMatch ? Number(stmtMatch[1]) : null,
    branchPct: branchMatch ? Number(branchMatch[1]) : null,
  };
}

function findScoverageReport(rootDir, explicitPath = null) {
  if (explicitPath && existsSync(resolve(explicitPath))) return resolve(explicitPath);
  const candidateRoots = [rootDir, join(rootDir, 'play-scaffold')];
  for (const base of candidateRoots) {
    const targetDir = join(base, 'target');
    if (!existsSync(targetDir)) continue;
    for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('scala-')) continue;
      const candidate = join(targetDir, entry.name, 'scoverage-report/scoverage.xml');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function runSbtScoverage(rootDir) {
  let sbtDir = null;
  if (existsSync(join(rootDir, 'build.sbt'))) sbtDir = rootDir;
  else if (existsSync(join(rootDir, 'play-scaffold/build.sbt'))) sbtDir = join(rootDir, 'play-scaffold');
  if (!sbtDir) {
    return { ran: false, passed: false, error: 'sbt coverage requested but no build.sbt found in rootDir or play-scaffold/' };
  }
  const proc = spawnSync('sbt', ['coverage', 'test', 'coverageReport'], {
    cwd: sbtDir,
    encoding: 'utf8',
    timeout: 300_000,
  });
  if (proc.error || proc.status !== 0) {
    return {
      ran: true,
      passed: false,
      exitCode: proc.status ?? null,
      error: (proc.error?.message || proc.stderr || proc.stdout || 'sbt coverage failed').trim(),
    };
  }
  return { ran: true, passed: true, exitCode: 0, sbtDir };
}

export function checkBehavioralTestability(rootDir) {
  const absRoot = resolve(rootDir);
  const violations = [];
  const checkedFiles = [];

  const scalaForbidden = [
    { id: 'TESTABILITY_WALL_CLOCK_SCALA', re: /\b(?:System\.currentTimeMillis|System\.nanoTime|Instant\.now|LocalDateTime\.now|ZonedDateTime\.now)\s*\(/u, reason: 'inject clock/timestamp via command parameter or port for deterministic testing' },
    { id: 'TESTABILITY_RANDOM_SCALA', re: /\b(?:UUID\.randomUUID|scala\.util\.Random|java\.util\.Random|Math\.random)\b/u, reason: 'inject deterministic ID/randomness via port or parameter' },
    { id: 'TESTABILITY_BLOCKING_AWAIT_SCALA', re: /\bAwait\.result\s*\(/u, reason: 'pure behavioral code must never block threads with Await.result' },
  ];
  const tsForbidden = [
    { id: 'TESTABILITY_WALL_CLOCK_TS', re: /\b(?:Date\.now\s*\(|new\s+Date\s*\(\s*\))/u, reason: 'inject clock/timestamp via command parameter or port for deterministic testing' },
    { id: 'TESTABILITY_RANDOM_TS', re: /\b(?:Math\.random\s*\(|crypto\.randomUUID\s*\()/u, reason: 'inject deterministic ID/randomness via port or parameter' },
  ];

  const scanFile = (absFile, rules) => {
    const rel = relative(absRoot, absFile).split(sep).join('/');
    checkedFiles.push(rel);
    const lines = readFileSync(absFile, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      for (const r of rules) {
        if (r.re.test(trimmed)) {
          violations.push({
            file: rel,
            line: i + 1,
            rule: r.id,
            message: `${r.id}: behavioral file "${rel}:${i + 1}" uses non-deterministic API (${r.reason})`,
          });
        }
      }
    }
  };

  for (const f of collectFiles(join(absRoot, 'generated-scaffold/scala'), '.scala')) {
    if (/(?:Behavior|Rules|EventHandler|Axioms)\.scala$/u.test(f)) scanFile(f, scalaForbidden);
  }
  for (const f of collectFiles(join(absRoot, 'handwritten/scala'), '.scala')) {
    scanFile(f, scalaForbidden);
  }
  for (const f of collectFiles(join(absRoot, 'generated-scaffold/ts'), '.ts')) {
    if (/\.behavior\.ts$/u.test(f)) scanFile(f, tsForbidden);
  }
  for (const f of collectFiles(join(absRoot, 'handwritten/ts'), '.ts')) {
    scanFile(f, tsForbidden);
  }

  return {
    passed: violations.length === 0,
    checkedCount: checkedFiles.length,
    violations,
  };
}

function runTypeScriptOracleSuite(rootDir, { collectCoverage = false } = {}) {
  const testDir = join(rootDir, 'generated-tests/ts');
  const specFiles = collectFiles(testDir, '.ears.spec.ts');
  if (specFiles.length === 0) {
    return { skipped: true, passed: true, specFiles: [], failedSpecIds: [], coverage: null, stdout: '', stderr: '' };
  }
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const nodeArgs = ['--test', '--test-reporter=tap', '--test-concurrency=1'];
  if (collectCoverage) nodeArgs.push('--experimental-test-coverage');
  nodeArgs.push(...specFiles);
  const proc = spawnSync(process.execPath, nodeArgs, {
    cwd: rootDir,
    env: childEnv,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const combined = `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`;
  const failedSpecIds = extractFailedTsSpecIds(combined);
  const coverage = collectCoverage ? extractNodeCoverageMetrics(combined) : null;
  return {
    skipped: false,
    passed: proc.status === 0,
    exitCode: proc.status,
    specFiles: specFiles.map(f => relative(rootDir, f).split(sep).join('/')),
    failedSpecIds,
    coverage,
    stdout: proc.stdout ?? '',
    stderr: proc.stderr ?? '',
  };
}

export function detectScalaToolchain() {
  const scalacProc = spawnSync('scalac', ['-version'], { encoding: 'utf8', timeout: 10_000 });
  const scalaProc = spawnSync('scala', ['-version'], { encoding: 'utf8', timeout: 10_000 });
  const available = !scalacProc.error && scalacProc.status === 0 && !scalaProc.error && scalaProc.status === 0;
  const versionText = `${scalacProc.stderr ?? ''}\n${scalacProc.stdout ?? ''}`.trim();
  const verMatch = versionText.match(/version\s+(\d+\.\d+)\.\d+/u);
  return {
    available,
    binaryVersion: verMatch ? verMatch[1] : null,
    versionText: versionText.split('\n')[0] || null,
  };
}

function candidateMavenRoots(env = process.env, homeDir = homedir()) {
  const roots = [];
  const push = p => {
    if (p && !roots.includes(p)) roots.push(p);
  };
  const home = homeDir || env.HOME || env.USERPROFILE || '';
  if (env.COURSIER_CACHE) {
    push(join(env.COURSIER_CACHE, 'https/repo1.maven.org/maven2'));
    push(env.COURSIER_CACHE);
  }
  if (home) {
    // macOS Coursier
    push(join(home, 'Library/Caches/Coursier/v1/https/repo1.maven.org/maven2'));
    // Linux XDG Coursier
    const xdgCache = env.XDG_CACHE_HOME || join(home, '.cache');
    push(join(xdgCache, 'coursier/v1/https/repo1.maven.org/maven2'));
    // Maven local repository
    push(join(home, '.m2/repository'));
    // Ivy2 cache
    push(join(home, '.ivy2/cache'));
  }
  if (env.LOCALAPPDATA) {
    // Windows Coursier
    push(join(env.LOCALAPPDATA, 'Coursier/cache/v1/https/repo1.maven.org/maven2'));
  }
  return roots;
}

function findScalaTestJarsInRoot(baseDir, scalaBinaryVersion) {
  if (!existsSync(baseDir)) return [];
  const v = scalaBinaryVersion || '2.12';
  const mavenDirs = [
    `org/scalatest/scalatest-funsuite_${v}`,
    `org/scalatest/scalatest-core_${v}`,
    'org/scalatest/scalatest-compatible',
    `org/scalactic/scalactic_${v}`,
    `org/scala-lang/modules/scala-xml_${v}`,
  ];
  const ivyDirs = [
    `org.scalatest/scalatest-funsuite_${v}/jars`,
    `org.scalatest/scalatest-core_${v}/jars`,
    'org.scalatest/scalatest-compatible/jars',
    `org.scalactic/scalactic_${v}/jars`,
    `org.scala-lang.modules/scala-xml_${v}/jars`,
  ];

  const jars = [];
  for (let idx = 0; idx < mavenDirs.length; idx += 1) {
    const dir = join(baseDir, mavenDirs[idx]);
    if (existsSync(dir)) {
      const versions = readdirSync(dir).sort();
      for (let i = versions.length - 1; i >= 0; i -= 1) {
        const vDir = join(dir, versions[i]);
        if (!statSync(vDir).isDirectory()) continue;
        const found = collectFiles(vDir, '.jar').filter(j => !j.endsWith('-sources.jar') && !j.endsWith('-javadoc.jar'));
        if (found.length > 0) {
          jars.push(found[0]);
          break;
        }
      }
      continue;
    }
    const ivyDir = join(baseDir, ivyDirs[idx]);
    if (existsSync(ivyDir)) {
      const found = collectFiles(ivyDir, '.jar').filter(j => !j.endsWith('-sources.jar') && !j.endsWith('-javadoc.jar'));
      if (found.length > 0) jars.push(found[found.length - 1]);
    }
  }
  return jars;
}

export function resolveScalaTestClasspath({
  scalaClasspath = null,
  scalaBinaryVersion = null,
  env = process.env,
  homeDir = homedir(),
} = {}) {
  const explicit = scalaClasspath || env.COARISING_SCALA_CP || '';
  if (explicit) {
    const entries = explicit
      .split(delimiter)
      .flatMap(part => (delimiter === ':' ? [part] : part.split(':')))
      .map(s => s.trim())
      .filter(Boolean)
      .filter(p => existsSync(p));
    if (entries.length > 0) {
      return { jars: entries, source: scalaClasspath ? 'flag' : 'env', searchedRoots: [] };
    }
    return { jars: [], source: 'explicit-missing', searchedRoots: [explicit] };
  }

  const roots = candidateMavenRoots(env, homeDir);
  const versionsToTry = scalaBinaryVersion
    ? [scalaBinaryVersion, scalaBinaryVersion === '2.13' ? '2.12' : '2.13']
    : ['2.12', '2.13'];

  for (const binVer of versionsToTry) {
    for (const root of roots) {
      const jars = findScalaTestJarsInRoot(root, binVer);
      if (jars.length >= 3) {
        return { jars, source: `cache:${root}`, binaryVersion: binVer, searchedRoots: roots };
      }
    }
  }
  return { jars: [], source: 'not-found', searchedRoots: roots };
}

function scalaPreflightGuidance(binVer) {
  const v = binVer || '2.12';
  return `Ensure scalac/scala are on PATH and ScalaTest ${v} jars are cached (e.g., cs fetch org.scalatest:scalatest-funsuite_${v}:3.2.19) or pass --scala-classpath / COARISING_SCALA_CP.`;
}

function isScalaTarget(t) {
  return t === 'scala' || t === 'scala-strict' || t === 'scala-cqrs-play-service-v2';
}

const SBT_FRAMEWORK_IMPORT_RE = /^\s*import\s+(?:akka\.|play\.|javax\.inject\.|com\.google\.inject\.|com\.google\.protobuf\.|scalapb\.|scalikejdbc\.|[^\s]+\.(?:application\.aggregates|application\.process\.[^\s]+SagaModule|infrastructure\.\{?proto|infrastructure\.persistence\.converters|infrastructure\.bootstrap|infrastructure\.readside|infrastructure\.api)\b|[^\s]+\.(?:common\.(?:application|serialization|auth)|infra\.saga)\.)/mu;

function partitionStandaloneScalaFiles(files) {
  const standalone = [];
  const sbtFramework = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (SBT_FRAMEWORK_IMPORT_RE.test(src)) sbtFramework.push(f);
    else standalone.push(f);
  }
  return { standalone, sbtFramework };
}

function runScalaOracleSuite(rootDir, { strict = false, scalaClasspath = null } = {}) {
  const allScaffoldFiles = collectFiles(join(rootDir, 'generated-scaffold/scala'), '.scala');
  const { standalone: scaffoldFiles, sbtFramework: sbtScaffoldFiles } = partitionStandaloneScalaFiles(allScaffoldFiles);
  const allHandwrittenFiles = collectFiles(join(rootDir, 'handwritten/scala'), '.scala');
  const { standalone: clozeFiles, sbtFramework: sbtHandwrittenFiles } = partitionStandaloneScalaFiles(allHandwrittenFiles);
  const sbtRuntimeFiles = [...sbtScaffoldFiles, ...sbtHandwrittenFiles];
  const specFiles = collectFiles(join(rootDir, 'generated-tests/scala'), '.scala');
  if (specFiles.length === 0) {
    return { skipped: true, passed: true, specFiles: [], failedSpecIds: [], sbtRuntimeFilesCount: sbtRuntimeFiles.length };
  }

  const toolchain = detectScalaToolchain();
  if (!toolchain.available) {
    const reason = 'scalac/scala binaries not found on PATH';
    const guidance = scalaPreflightGuidance(null);
    return {
      skipped: !strict,
      passed: !strict,
      stage: 'preflight',
      reason,
      guidance,
      specFiles: specFiles.map(f => relative(rootDir, f).split(sep).join('/')),
      failedSpecIds: [],
    };
  }

  const resolvedCp = resolveScalaTestClasspath({
    scalaClasspath,
    scalaBinaryVersion: toolchain.binaryVersion,
  });
  if (resolvedCp.jars.length === 0) {
    const reason = `ScalaTest jars not found (source=${resolvedCp.source})`;
    const guidance = scalaPreflightGuidance(toolchain.binaryVersion);
    return {
      skipped: !strict,
      passed: !strict,
      stage: 'preflight',
      reason,
      guidance,
      specFiles: specFiles.map(f => relative(rootDir, f).split(sep).join('/')),
      failedSpecIds: [],
    };
  }

  const outClasses = join(rootDir, '.truthsrc/scala-classes');
  mkdirSync(outClasses, { recursive: true });
  const kernelStubTmp = mkdtempSync(join(tmpdir(), 'coarising-scalac-kernel-'));
  const kernelStubs = prepareStandaloneKernelFiles(kernelStubTmp, scaffoldFiles);
  const cp = resolvedCp.jars.join(delimiter);
  let compile;
  try {
    compile = spawnSync('scalac', ['-cp', cp, '-d', outClasses, ...kernelStubs, ...scaffoldFiles, ...clozeFiles, ...specFiles], {
      cwd: rootDir,
      encoding: 'utf8',
      timeout: 90_000,
    });
  } finally {
    rmSync(kernelStubTmp, { recursive: true, force: true });
  }
  if (compile.status !== 0) {
    return {
      skipped: false,
      passed: false,
      stage: 'scalac',
      exitCode: compile.status,
      failedSpecIds: [],
      sbtRuntimeFilesCount: sbtRuntimeFiles.length,
      stderr: compile.stderr ?? compile.stdout ?? '',
    };
  }
  const suiteClasses = specFiles.map(f => {
    const text = readFileSync(f, 'utf8');
    const pkg = text.match(/^package\s+([A-Za-z0-9_.]+)/mu)?.[1] ?? '';
    const cls = text.match(/final class\s+([A-Za-z0-9_]+)\s+extends\s+AnyFunSuite/u)?.[1] ?? '';
    return pkg ? `${pkg}.${cls}` : cls;
  }).filter(Boolean);

  const runArgs = ['-cp', `${outClasses}${delimiter}${cp}`, 'org.scalatest.tools.Runner', '-oD', ...suiteClasses.flatMap(c => ['-s', c])];
  const run = spawnSync('scala', runArgs, { cwd: rootDir, encoding: 'utf8', timeout: 60_000 });
  const combined = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const failedSpecIds = [...new Set([...combined.matchAll(/\[([A-Z0-9_-]+)\].*\*\*\* FAILED \*\*\*/gu)].map(m => m[1]))];
  return {
    skipped: false,
    passed: run.status === 0,
    stage: 'scalatest',
    exitCode: run.status,
    classpathSource: resolvedCp.source,
    suiteClasses,
    failedSpecIds,
    sbtRuntimeFilesCount: sbtRuntimeFiles.length,
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? '',
  };
}

export function runV2Preflight({
  solver = 'z3',
  targets = ['typescript'],
  scalaClasspath = null,
} = {}) {
  const smt = checkSolverAvailable(solver);
  const scalaNeeded = targets.some(isScalaTarget);
  const scalaToolchain = scalaNeeded ? detectScalaToolchain() : null;
  const scalaCp = scalaNeeded
    ? resolveScalaTestClasspath({ scalaClasspath, scalaBinaryVersion: scalaToolchain?.binaryVersion })
    : null;
  const scalaReady = !scalaNeeded || (Boolean(scalaToolchain?.available) && (scalaCp?.jars.length ?? 0) > 0);
  return {
    ready: smt.available && scalaReady,
    nodeVersion: process.version,
    smt,
    scala: scalaNeeded ? {
      ready: scalaReady,
      available: scalaToolchain.available,
      binaryVersion: scalaToolchain.binaryVersion,
      classpathSource: scalaCp.source,
      jarCount: scalaCp.jars.length,
      guidance: scalaReady ? null : scalaPreflightGuidance(scalaToolchain.binaryVersion),
    } : null,
  };
}

export function reconcileV2Provenance(rootDir, canonicalV2 = null) {
  const scaffoldTs = collectFiles(join(rootDir, 'generated-scaffold/ts'), '.ts');
  const scaffoldScala = collectFiles(join(rootDir, 'generated-scaffold/scala'), '.scala');
  const testTs = collectFiles(join(rootDir, 'generated-tests/ts'), '.ts');
  const testScala = collectFiles(join(rootDir, 'generated-tests/scala'), '.scala');
  const handwrittenFiles = [
    ...collectFiles(join(rootDir, 'handwritten'), '.ts'),
    ...collectFiles(join(rootDir, 'handwritten'), '.scala'),
  ];

  const provenanceIds = new Set();
  for (const f of [...scaffoldTs, ...scaffoldScala]) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/@ProvenanceId\(([^)]+)\)/gu)) provenanceIds.add(m[1]);
  }

  const specAnchors = new Set();
  for (const f of [...testTs, ...testScala]) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/@CoArisingSpec\(id="([^"]+)"/gu)) specAnchors.add(m[1]);
  }

  const errors = [];
  const clozeSlots = [];
  for (const f of handwrittenFiles) {
    const text = readFileSync(f, 'utf8');
    const starts = [...text.matchAll(/^\s*\/\/\s*@cloze:start\(([^)]+)\)\s*$/gmu)].map(m => m[1].trim());
    const ends = [...text.matchAll(/^\s*\/\/\s*@cloze:end\(([^)]+)\)\s*$/gmu)].map(m => m[1].trim());
    if (starts.length !== ends.length) {
      errors.push(`unbalanced @cloze markers in ${relative(rootDir, f)}`);
    }
    for (let i = 0; i < starts.length; i += 1) {
      if (starts[i] !== ends[i]) {
        errors.push(`mismatched @cloze marker pair "${starts[i]}" vs "${ends[i]}" in ${relative(rootDir, f)}`);
      } else {
        clozeSlots.push({
          slotId: starts[i],
          file: relative(rootDir, f).split(sep).join('/'),
          unimplemented: text.includes('CLOZE_NOT_IMPLEMENTED'),
        });
      }
    }
  }

  if (canonicalV2) {
    for (const beh of canonicalV2.behaviors) {
      for (const rule of beh.rules) {
        if (!specAnchors.has(rule.id)) {
          errors.push(`missing locked @CoArisingSpec anchor for rule [${rule.id}] on ${beh.target}`);
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    provenanceIdCount: provenanceIds.size,
    specAnchorCount: specAnchors.size,
    clozeSlots,
  };
}

export function checkOnionDipBoundaries(rootDir) {
  const absRoot = resolve(rootDir);
  const violations = [];
  const checkedFiles = [];

  const checkFile = (absFile, layer, rules) => {
    const rel = relative(absRoot, absFile).split(sep).join('/');
    checkedFiles.push({ file: rel, layer });
    const lines = readFileSync(absFile, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      for (const r of rules) {
        if (r.re.test(trimmed)) {
          violations.push({
            file: rel,
            line: i + 1,
            layer,
            rule: r.id,
            message: `${r.id}: ${layer} file "${rel}:${i + 1}" violates Onion DIP (${r.reason})`,
          });
        }
      }
    }
  };

  const tsDomainRules = [
    { id: 'ONION_DOMAIN_NO_OUTER_TS', re: /\bfrom\s+["'][^"']*(?:\/(?:application|interfaces|infrastructure|modules|handwritten)\/|node:http)/u, reason: 'domain must never depend on application/interfaces/infrastructure/modules/http' },
  ];
  const tsAppRules = [
    { id: 'ONION_APP_NO_OUTER_TS', re: /\bfrom\s+["'][^"']*(?:\/(?:interfaces|infrastructure|modules|handwritten)\/|node:http)/u, reason: 'application must never depend on interfaces/infrastructure/modules/http' },
  ];
  const tsIfRules = [
    { id: 'ONION_INTERFACES_NO_INFRA_TS', re: /\bfrom\s+["'][^"']*\/(?:infrastructure|modules|handwritten)\//u, reason: 'interfaces must never depend on infrastructure/modules' },
  ];
  const tsInfraRules = [
    { id: 'ONION_INFRA_NO_INTERFACES_TS', re: /\bfrom\s+["'][^"']*\/(?:interfaces|modules|handwritten)\//u, reason: 'infrastructure must never depend on interfaces/modules' },
  ];

  for (const absFile of collectFiles(join(absRoot, 'generated-scaffold/ts'), '.ts')) {
    const rel = relative(absRoot, absFile).split(sep).join('/');
    if (rel.startsWith('generated-scaffold/ts/domain/') || /^generated-scaffold\/ts\/(?:exact|types|[^/]+\.behavior)\.ts$/u.test(rel)) {
      checkFile(absFile, 'domain', tsDomainRules);
    } else if (rel.startsWith('generated-scaffold/ts/application/') || /^generated-scaffold\/ts\/[^/]+\.port\.ts$/u.test(rel)) {
      checkFile(absFile, 'application', tsAppRules);
    } else if (rel.startsWith('generated-scaffold/ts/interfaces/')) {
      checkFile(absFile, 'interfaces', tsIfRules);
    } else if (rel.startsWith('generated-scaffold/ts/infrastructure/')) {
      checkFile(absFile, 'infrastructure', tsInfraRules);
    }
  }

  const scDomainRules = [
    { id: 'ONION_DOMAIN_NO_OUTER_SCALA', re: /^import\s+(?:play\.|akka\.|[^\s]+\.(?:application|interfaces|infrastructure|modules)\.)/u, reason: 'Scala domain must remain 100% pure with zero framework or outer-layer imports' },
  ];
  const scAppRules = [
    { id: 'ONION_APP_NO_OUTER_SCALA', re: /^import\s+(?:play\.|[^\s]+\.(?:interfaces|infrastructure|modules)\.)/u, reason: 'Scala application layer must never import interfaces/infrastructure/modules/play' },
  ];
  const scIfRules = [
    { id: 'ONION_INTERFACES_NO_INFRA_SCALA', re: /^import\s+[^\s]+\.(?:infrastructure|modules)\./u, reason: 'Scala interfaces layer must never import infrastructure/modules' },
  ];
  const scInfraRules = [
    { id: 'ONION_INFRA_NO_INTERFACES_SCALA', re: /^import\s+[^\s]+\.(?:interfaces(?!\.api\.ApiAcknowledgements\b)|modules)\./u, reason: 'Scala infrastructure layer must never import interfaces/modules' },
  ];

  for (const absFile of collectFiles(join(absRoot, 'generated-scaffold/scala'), '.scala')) {
    const rel = relative(absRoot, absFile).split(sep).join('/');
    if (rel.includes('/domain/') || /(?:DomainTypes|Behavior)\.scala$/u.test(rel)) {
      checkFile(absFile, 'domain', scDomainRules);
    } else if (rel.includes('/application/') || /Port\.scala$/u.test(rel)) {
      checkFile(absFile, 'application', scAppRules);
    } else if (rel.includes('/interfaces/')) {
      checkFile(absFile, 'interfaces', scIfRules);
    } else if (rel.includes('/infrastructure/')) {
      checkFile(absFile, 'infrastructure', scInfraRules);
    }
  }

  return {
    passed: violations.length === 0,
    checkedCount: checkedFiles.length,
    violations,
  };
}

export function runV2VerifyGate({
  rootDir,
  targets = null,
  canonicalFile = null,
  dbFile = null,
  provenanceOut = null,
  strict = Boolean(process.env.CI),
  scalaClasspath = null,
  minCoverage = null,
  minBranchCoverage = null,
  scoverageFile = null,
  requireScoverage = null,
  sbtCoverage = false,
  mutationGate = null,
  maxMutants = 12,
} = {}) {
  const absRoot = resolve(rootDir);
  const effTargets = resolveEffectiveTargets({ explicitTargets: targets, rootDir: absRoot });
  const canonicalV2 = canonicalFile && existsSync(resolve(canonicalFile))
    ? JSON.parse(readFileSync(resolve(canonicalFile), 'utf8'))
    : null;

  const effectiveMinCoverage = minCoverage !== null && minCoverage !== undefined
    ? Number(minCoverage)
    : (canonicalV2?.testing?.layers?.domain?.minLineCoverage ?? null);
  const effectiveMinBranchCoverage = minBranchCoverage !== null && minBranchCoverage !== undefined
    ? Number(minBranchCoverage)
    : (canonicalV2?.testing?.layers?.domain?.minBranchCoverage ?? null);
  const collectTsCoverage = (effectiveMinCoverage !== null && Number.isFinite(effectiveMinCoverage))
    || (effectiveMinBranchCoverage !== null && Number.isFinite(effectiveMinBranchCoverage));
  const effectiveMutationGate = mutationGate !== null && mutationGate !== undefined
    ? Boolean(mutationGate)
    : Boolean(canonicalV2?.testing?.layers?.domain?.mutationGate);

  const hasScalaTarget = effTargets.some(isScalaTarget);
  const manifestCheck = verifyLockedTestsManifest(join(absRoot, 'generated-tests/manifest.sha256.json'));
  const tsCheck = effTargets.includes('typescript')
    ? runTypeScriptOracleSuite(absRoot, { collectCoverage: collectTsCoverage })
    : { skipped: true, passed: true, failedSpecIds: [], coverage: null };
  const scalaCheck = hasScalaTarget
    ? runScalaOracleSuite(absRoot, { strict, scalaClasspath })
    : { skipped: true, passed: true, failedSpecIds: [] };
  const provenanceCheck = reconcileV2Provenance(absRoot, canonicalV2);
  const onionCheck = checkOnionDipBoundaries(absRoot);
  const testabilityCheck = checkBehavioralTestability(absRoot);

  // Behavioral coverage threshold enforcement (TS native line+branch + Scala scoverage.xml statement+branch)
  const coverageErrors = [];
  let sbtCoverageRun = null;
  if (sbtCoverage && hasScalaTarget) {
    sbtCoverageRun = runSbtScoverage(absRoot);
    if (!sbtCoverageRun.passed) {
      coverageErrors.push(`Scala sbt scoverage failed: ${sbtCoverageRun.error}`);
    }
  }
  const scoveragePath = findScoverageReport(absRoot, scoverageFile);
  const scalaCoverage = scoveragePath ? parseScoverageXml(readFileSync(scoveragePath, 'utf8')) : null;
  if (collectTsCoverage && !tsCheck.skipped && tsCheck.passed) {
    const actualLine = tsCheck.coverage?.avgLinePct ?? null;
    if (effectiveMinCoverage !== null && actualLine !== null && actualLine < effectiveMinCoverage) {
      coverageErrors.push(`TypeScript behavioral line coverage ${actualLine}% is below required threshold ${effectiveMinCoverage}%`);
    }
    const actualBranch = tsCheck.coverage?.avgBranchPct ?? null;
    if (effectiveMinBranchCoverage !== null && actualBranch !== null && actualBranch < effectiveMinBranchCoverage) {
      coverageErrors.push(`TypeScript behavioral branch coverage ${actualBranch}% is below required threshold ${effectiveMinBranchCoverage}%`);
    }
  }
  const hasScalaThreshold = effectiveMinCoverage !== null || effectiveMinBranchCoverage !== null;
  const mustHaveScoverage = hasScalaTarget
    && (requireScoverage === true || (strict && requireScoverage !== false && hasScalaThreshold));
  if (mustHaveScoverage && !scalaCoverage) {
    coverageErrors.push(
      'Scala scoverage.xml report is missing while coverage threshold is enforced (run "sbt coverage test coverageReport", pass --scoverage <path>, or pass --sbt-coverage)',
    );
  }
  if (effectiveMinCoverage !== null && scalaCoverage?.statementPct !== null && scalaCoverage?.statementPct !== undefined) {
    if (scalaCoverage.statementPct < effectiveMinCoverage) {
      coverageErrors.push(`Scala scoverage statement coverage ${scalaCoverage.statementPct}% is below required threshold ${effectiveMinCoverage}%`);
    }
  }
  if (effectiveMinBranchCoverage !== null && scalaCoverage?.branchPct !== null && scalaCoverage?.branchPct !== undefined) {
    if (scalaCoverage.branchPct < effectiveMinBranchCoverage) {
      coverageErrors.push(`Scala scoverage branch coverage ${scalaCoverage.branchPct}% is below required threshold ${effectiveMinBranchCoverage}%`);
    }
  }
  const coverageCheck = {
    passed: coverageErrors.length === 0,
    minLineCoverage: effectiveMinCoverage,
    minBranchCoverage: effectiveMinBranchCoverage,
    tsLinePct: tsCheck.coverage?.avgLinePct ?? null,
    tsBranchPct: tsCheck.coverage?.avgBranchPct ?? null,
    scalaStatementPct: scalaCoverage?.statementPct ?? null,
    scalaBranchPct: scalaCoverage?.branchPct ?? null,
    scoveragePath: scoveragePath ? relative(absRoot, scoveragePath).split(sep).join('/') : null,
    sbtCoverageRun,
    errors: coverageErrors,
  };

  let mutationCheck = { enabled: false, passed: true, minKillRate: 100, ts: null, scala: null, errors: [] };
  if (effectiveMutationGate && manifestCheck.passed && tsCheck.passed && scalaCheck.passed) {
    let scalaJars = [];
    if (hasScalaTarget && !scalaCheck.skipped) {
      const tc = detectScalaToolchain();
      scalaJars = resolveScalaTestClasspath({ scalaClasspath, scalaBinaryVersion: tc.binaryVersion }).jars;
    }
    mutationCheck = runDomainMutationGate({
      rootDir: absRoot,
      targets: effTargets,
      scalaJars,
      maxMutants,
    });
  }

  const unimplementedSlots = (provenanceCheck.clozeSlots ?? []).filter(s => s.unimplemented);
  let expectedClozeRed;
  if (!scalaCheck.passed || !tsCheck.passed) {
    expectedClozeRed = unimplementedSlots.length > 0
      ? {
          isExpectedTddRed: true,
          unimplementedCount: unimplementedSlots.length,
          slots: unimplementedSlots.map(s => ({ slotId: s.slotId, file: s.file })),
          nextCommand: 'truthsrc tasks-v2 --root . --next --format human',
        }
      : { isExpectedTddRed: false, unimplementedCount: 0, slots: [] };
  } else {
    expectedClozeRed = {
      isExpectedTddRed: false,
      unimplementedCount: unimplementedSlots.length,
      slots: unimplementedSlots.map(s => ({ slotId: s.slotId, file: s.file })),
    };
  }

  const passed = manifestCheck.passed
    && tsCheck.passed
    && scalaCheck.passed
    && provenanceCheck.passed
    && onionCheck.passed
    && testabilityCheck.passed
    && coverageCheck.passed
    && mutationCheck.passed;
  const record = {
    schemaVersion: 'co-arising.verify-v2/v1',
    passed,
    strict,
    canonicalSha256: canonicalV2?.canonicalSha256 ?? null,
    expectedClozeRed,
    manifestCheck,
    tsCheck: {
      skipped: tsCheck.skipped,
      passed: tsCheck.passed,
      exitCode: tsCheck.exitCode ?? null,
      specFiles: tsCheck.specFiles ?? [],
      failedSpecIds: tsCheck.failedSpecIds ?? [],
    },
    scalaCheck: {
      skipped: scalaCheck.skipped,
      passed: scalaCheck.passed,
      stage: scalaCheck.stage ?? null,
      reason: scalaCheck.reason ?? null,
      guidance: scalaCheck.guidance ?? null,
      classpathSource: scalaCheck.classpathSource ?? null,
      exitCode: scalaCheck.exitCode ?? null,
      suiteClasses: scalaCheck.suiteClasses ?? [],
      failedSpecIds: scalaCheck.failedSpecIds ?? [],
      sbtRuntimeFilesCount: scalaCheck.sbtRuntimeFilesCount ?? 0,
      ...(scalaCheck.passed ? {} : { stderr: scalaCheck.stderr ?? null }),
    },
    provenanceCheck,
    onionCheck,
    testabilityCheck,
    coverageCheck,
    mutationCheck,
    verifiedAt: new Date().toISOString(),
  };

  if (passed) {
    const outPath = provenanceOut ? resolve(provenanceOut) : join(absRoot, '.truthsrc/v2-provenance.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
    if (dbFile && existsSync(resolve(dbFile))) {
      const slotBehaviorSha = new Map();
      if (canonicalV2) {
        const behByTarget = new Map((canonicalV2.behaviors ?? []).map(b => [b.target, b]));
        for (const cs of canonicalV2.clozeSlots ?? []) {
          const beh = behByTarget.get(cs.target);
          slotBehaviorSha.set(cs.slotId, beh?.verification?.canonicalSha256 ?? canonicalV2.canonicalSha256 ?? null);
        }
      }
      for (const slot of provenanceCheck.clozeSlots) {
        recordClozeProvenance(resolve(dbFile), slot.slotId, {
          passed: true,
          file: slot.file,
          behaviorSha256: slotBehaviorSha.get(slot.slotId) ?? canonicalV2?.canonicalSha256 ?? null,
          manifestSha256: manifestCheck.manifestSha256,
          verifiedAt: record.verifiedAt,
        });
      }
    }
  }

  return record;
}
