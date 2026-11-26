// Stop Hook Triple Verification Gate & Provenance Reconciler for co-arising 2.0:
//   1. SHA-256 tamper check on generated-tests/manifest.sha256.json
//   2. Real executable BDD test execution (Node 22 TS node:test and/or scalac+ScalaTest)
//   3. Provenance anchor & @cloze slot boundary reconciliation + SQLite provenance recording
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, dirname, join, relative, resolve, sep } from 'node:path';
import { checkSolverAvailable } from '../ears/smt-solver.mjs';
import { recordClozeProvenance } from './knowledge-db.mjs';

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

function runTypeScriptOracleSuite(rootDir) {
  const testDir = join(rootDir, 'generated-tests/ts');
  const specFiles = collectFiles(testDir, '.ears.spec.ts');
  if (specFiles.length === 0) {
    return { skipped: true, passed: true, specFiles: [], failedSpecIds: [], stdout: '', stderr: '' };
  }
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const proc = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...specFiles], {
    cwd: rootDir,
    env: childEnv,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const combined = `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`;
  const failedSpecIds = [...new Set([...combined.matchAll(/not ok \d+ - \[([A-Z0-9_-]+)\]/gu)].map(m => m[1]))];
  return {
    skipped: false,
    passed: proc.status === 0,
    exitCode: proc.status,
    specFiles: specFiles.map(f => relative(rootDir, f).split(sep).join('/')),
    failedSpecIds,
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

function runScalaOracleSuite(rootDir, { strict = false, scalaClasspath = null } = {}) {
  const scaffoldFiles = collectFiles(join(rootDir, 'generated-scaffold/scala'), '.scala');
  const clozeFiles = collectFiles(join(rootDir, 'handwritten/scala'), '.scala');
  const specFiles = collectFiles(join(rootDir, 'generated-tests/scala'), '.scala');
  if (specFiles.length === 0) {
    return { skipped: true, passed: true, specFiles: [], failedSpecIds: [] };
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
  const cp = resolvedCp.jars.join(delimiter);
  const compile = spawnSync('scalac', ['-cp', cp, '-d', outClasses, ...scaffoldFiles, ...clozeFiles, ...specFiles], {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: 90_000,
  });
  if (compile.status !== 0) {
    return {
      skipped: false,
      passed: false,
      stage: 'scalac',
      exitCode: compile.status,
      failedSpecIds: [],
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
  const scalaNeeded = targets.includes('scala');
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
    { id: 'ONION_INFRA_NO_INTERFACES_SCALA', re: /^import\s+[^\s]+\.(?:interfaces|modules)\./u, reason: 'Scala infrastructure layer must never import interfaces/modules' },
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
  targets = ['typescript'],
  canonicalFile = null,
  dbFile = null,
  provenanceOut = null,
  strict = Boolean(process.env.CI),
  scalaClasspath = null,
} = {}) {
  const absRoot = resolve(rootDir);
  const canonicalV2 = canonicalFile && existsSync(resolve(canonicalFile))
    ? JSON.parse(readFileSync(resolve(canonicalFile), 'utf8'))
    : null;

  const manifestCheck = verifyLockedTestsManifest(join(absRoot, 'generated-tests/manifest.sha256.json'));
  const tsCheck = targets.includes('typescript')
    ? runTypeScriptOracleSuite(absRoot)
    : { skipped: true, passed: true, failedSpecIds: [] };
  const scalaCheck = targets.includes('scala')
    ? runScalaOracleSuite(absRoot, { strict, scalaClasspath })
    : { skipped: true, passed: true, failedSpecIds: [] };
  const provenanceCheck = reconcileV2Provenance(absRoot, canonicalV2);
  const onionCheck = checkOnionDipBoundaries(absRoot);

  const passed = manifestCheck.passed && tsCheck.passed && scalaCheck.passed && provenanceCheck.passed && onionCheck.passed;
  const record = {
    schemaVersion: 'co-arising.verify-v2/v1',
    passed,
    strict,
    canonicalSha256: canonicalV2?.canonicalSha256 ?? null,
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
    },
    provenanceCheck,
    onionCheck,
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
