// Deterministic Domain Guard Mutation Gate for co-arising 2.0 (TypeScript & Scala).
// Operates in an isolated temporary workspace copy (never mutates the caller's repo).
// Generates guard-polarity & boundary off-by-one mutants on @ProvenanceId-tagged domain rules
// and verifies that locked BDD oracle suites kill 100% of mutants (or >= minKillRate).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeProfile } from '../runtime-profile.mjs';

function collectFiles(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, ext, out);
    else if (entry.isFile() && entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function findConditionSpan(line) {
  const m = line.match(/\b(?:else\s+)?if\s*\(/u);
  if (!m || m.index === undefined) return null;
  const openIdx = m.index + m[0].length - 1;
  let depth = 0;
  let inString = false;
  let quote = '';
  for (let i = openIdx; i < line.length; i += 1) {
    const ch = line[i];
    if (inString) {
      if (ch === '\\') {
        i += 1;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === '\'') {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { openIdx, closeIdx: i };
    }
  }
  return null;
}

function mutateBoundaryOperator(cond, lang) {
  const pairs = lang === 'ts'
    ? [
        { re: /<=/u, rep: '<', label: '<= -> <' },
        { re: />=/u, rep: '>', label: '>= -> >' },
        { re: /===/u, rep: '!==', label: '=== -> !==' },
        { re: /!==/u, rep: '===', label: '!== -> ===' },
      ]
    : [
        { re: /<=/u, rep: '<', label: '<= -> <' },
        { re: />=/u, rep: '>', label: '>= -> >' },
        { re: /==/u, rep: '!=', label: '== -> !=' },
        { re: /!=/u, rep: '==', label: '!= -> ==' },
      ];
  for (const p of pairs) {
    if (p.re.test(cond)) {
      return { mutatedCond: cond.replace(p.re, p.rep), operator: p.label };
    }
  }
  return null;
}

export function generateDomainMutants(sourceText, lang = 'ts', { maxMutants = 12 } = {}) {
  const lines = String(sourceText ?? '').split('\n');
  const perRule = [];

  for (let i = 0; i < lines.length - 1; i += 1) {
    const provMatch = lines[i].match(/\/\/\s*(?:@ProvenanceId\(([^)]+)\)|@knowledge\s+([^\s]+))/u);
    if (!provMatch) continue;
    const provId = (provMatch[1] ?? provMatch[2] ?? '').trim();
    if (provId.startsWith('axiom:') || provId.startsWith('agg:') || provId.startsWith('layer:')) continue;

    const guardLineIdx = i + 1;
    const guardLine = lines[guardLineIdx];
    const span = findConditionSpan(guardLine);
    if (!span) continue;

    const ruleId = provId.includes('#') ? provId.split('#')[1] : provId;
    const cond = guardLine.slice(span.openIdx + 1, span.closeIdx);
    const prefix = guardLine.slice(0, span.openIdx + 1);
    const suffix = guardLine.slice(span.closeIdx);

    const ruleMutants = [];
    // Mutant 1 (always): guard polarity negation !(cond) — guaranteed to test rule hit/miss
    const negatedLine = `${prefix}!(${cond})${suffix}`;
    ruleMutants.push({
      ruleId,
      provId,
      line: guardLineIdx + 1,
      kind: 'guard-negation',
      operator: 'cond -> !(cond)',
      originalLine: guardLine,
      mutatedLine: negatedLine,
    });

    // Mutant 2 (when relational/equality operator present): boundary/equality mutation
    const opMut = mutateBoundaryOperator(cond, lang);
    if (opMut) {
      const opLine = `${prefix}${opMut.mutatedCond}${suffix}`;
      if (opLine !== guardLine && opLine !== negatedLine) {
        ruleMutants.push({
          ruleId,
          provId,
          line: guardLineIdx + 1,
          kind: 'operator-flip',
          operator: opMut.operator,
          originalLine: guardLine,
          mutatedLine: opLine,
        });
      }
    }
    perRule.push(ruleMutants);
  }

  // Round-robin pick so every rule gets its primary guard-negation mutant before secondary mutants
  const selected = [];
  for (let pass = 0; pass < 2 && selected.length < maxMutants; pass += 1) {
    for (const bucket of perRule) {
      if (selected.length >= maxMutants) break;
      if (bucket[pass]) selected.push(bucket[pass]);
    }
  }
  return selected;
}

function applyLineMutation(sourceText, lineNumber, mutatedLine) {
  const lines = sourceText.split('\n');
  lines[lineNumber - 1] = mutatedLine;
  return lines.join('\n');
}

function copyIfExists(src, dst) {
  if (existsSync(src)) cpSync(src, dst, { recursive: true });
}

function pickTargetedTsSpecs(behaviorFile, allSpecFiles) {
  const stem = behaviorFile.split(/[\\/]/u).pop().replace(/\.behavior\.ts$/u, '').toLowerCase();
  const matched = allSpecFiles.filter(f => f.split(/[\\/]/u).pop().toLowerCase().includes(stem));
  return matched.length > 0 ? matched : allSpecFiles;
}

function pickTargetedScalaSuites(behaviorFile, domainSpecFiles, allSuiteClasses) {
  const stem = behaviorFile.split(/[\\/]/u).pop().replace(/(?:Behavior|Rules)\.scala$/u, '').toLowerCase();
  const matchedFiles = domainSpecFiles.filter(f => f.split(/[\\/]/u).pop().toLowerCase().startsWith(stem));
  if (matchedFiles.length === 0) return allSuiteClasses;
  const matched = extractScalaSuiteClasses(matchedFiles);
  return matched.length > 0 ? matched : allSuiteClasses;
}

function runTsDomainMutations(workDir, { maxMutants = 12, progress = false } = {}) {
  const behaviorFiles = collectFiles(join(workDir, 'generated-scaffold/ts'), '.behavior.ts');
  const specFiles = collectFiles(join(workDir, 'generated-tests/ts'), '.ears.spec.ts')
    .filter(f => !f.endsWith('interfaces-http.ears.spec.ts'));
  if (behaviorFiles.length === 0 || specFiles.length === 0) {
    return { skipped: true, passed: true, total: 0, killed: 0, survived: [], killRate: 100 };
  }

  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;

  let total = 0;
  let killed = 0;
  const survived = [];

  for (const file of behaviorFiles) {
    if (total >= maxMutants) break;
    const rel = relative(workDir, file).split(sep).join('/');
    const original = readFileSync(file, 'utf8');
    const mutants = generateDomainMutants(original, 'ts', { maxMutants: maxMutants - total });
    const targetSpecs = pickTargetedTsSpecs(file, specFiles);

    for (const mut of mutants) {
      total += 1;
      writeFileSync(file, applyLineMutation(original, mut.line, mut.mutatedLine), 'utf8');
      try {
        const proc = spawnSync(
          process.execPath,
          ['--test', '--test-concurrency=1', ...targetSpecs],
          { cwd: workDir, env: childEnv, encoding: 'utf8', timeout: 30_000 },
        );
        if (proc.status !== 0) {
          killed += 1;
          if (progress) process.stderr.write(`[mutation-gate] ts ${total} killed ${rel}:${mut.line} [${mut.ruleId}]\n`);
        } else {
          if (progress) process.stderr.write(`[mutation-gate] ts ${total} SURVIVED ${rel}:${mut.line} [${mut.ruleId}]\n`);
          survived.push({
            target: 'typescript',
            file: rel,
            line: mut.line,
            ruleId: mut.ruleId,
            kind: mut.kind,
            operator: mut.operator,
          });
        }
      } finally {
        writeFileSync(file, original, 'utf8');
      }
    }
  }

  const vacuous = total === 0;
  const killRate = vacuous ? 0 : Number(((killed / total) * 100).toFixed(2));
  return { skipped: false, vacuous, passed: !vacuous && survived.length === 0, total, killed, survived, killRate };
}

function extractScalaSuiteClasses(specFiles) {
  return specFiles
    .map(f => {
      const text = readFileSync(f, 'utf8');
      const pkg = text.match(/^package\s+([A-Za-z0-9_.]+)/mu)?.[1] ?? '';
      const cls = text.match(/final class\s+([A-Za-z0-9_]+)\s+extends\s+AnyFunSuite/u)?.[1] ?? '';
      return pkg ? `${pkg}.${cls}` : cls;
    })
    .filter(Boolean);
}

const SBT_FRAMEWORK_IMPORT_RE = /^\s*import\s+(?:akka\.|play\.|javax\.inject\.|com\.google\.inject\.|com\.google\.protobuf\.|scalapb\.|scalikejdbc\.|[^\s]+\.(?:application\.aggregates|application\.process\.[^\s]+SagaModule|infrastructure\.\{?proto|infrastructure\.persistence\.converters|infrastructure\.bootstrap|infrastructure\.readside|infrastructure\.api)\b|[^\s]+\.(?:common\.(?:application|serialization|auth)|infra\.saga)\.)/mu;

/**
 * When Play/sbt projects omit CommonTypes.scala from generated-scaffold/ (relying on common-core JAR),
 * synthesize a temporary standalone CommonKernel stub in workDir so offline scalac + ScalaTest work cleanly.
 */
export function prepareStandaloneKernelFiles(workDir, scaffoldFiles, runtimeProfile = null) {
  const hasCommonTypes = scaffoldFiles.some(f => f.endsWith('/CommonTypes.scala') || f.endsWith('\\CommonTypes.scala'));
  if (hasCommonTypes) return [];
  const commonPackage = resolveRuntimeProfile({ runtimeProfile }).commonPackage;
  const stubDir = join(workDir, '.truthsrc-standalone-kernel');
  mkdirSync(stubDir, { recursive: true });
  const stubFile = join(stubDir, '_CommonKernelStub.scala');
  writeFileSync(stubFile, [
    `package ${commonPackage}`,
    '',
    'trait CborSerializable',
    'object Id {',
    '  def gen(): java.util.UUID = java.util.UUID.randomUUID()',
    '  def of(s: String): java.util.UUID = java.util.UUID.fromString(s)',
    '}',
    'object CommonTypes {',
    '  final case class iMadzError(code: String, message: String) extends Throwable with CborSerializable',
    '  trait ReadModel',
    '  trait InvariantRule[Event, State, Param] {',
    '    def apply(state: State, param: Param): Either[iMadzError, List[Event]]',
    '  }',
    '  trait DomainService',
    '  trait ApplicationService',
    '}',
    '',
  ].join('\n'), 'utf8');
  return [stubFile];
}

function isScalaTarget(t) {
  return t === 'scala' || t === 'scala-strict' || t === 'scala-cqrs-play-service-v2';
}

const SCALA_MUTATION_WORKER = join(dirname(fileURLToPath(import.meta.url)), 'mutation-pool-worker.mjs');

function runScalaDomainMutations(workDir, {
  scalaJars = [],
  maxMutants = 12,
  precompiledBaseClasses = null,
  concurrency = null,
  progress = false,
} = {}) {
  const scaffoldFiles = collectFiles(join(workDir, 'generated-scaffold/scala'), '.scala')
    .filter(f => !SBT_FRAMEWORK_IMPORT_RE.test(readFileSync(f, 'utf8')));
  const kernelStubs = prepareStandaloneKernelFiles(workDir, scaffoldFiles);
  const clozeFiles = collectFiles(join(workDir, 'handwritten/scala'), '.scala')
    .filter(f => !SBT_FRAMEWORK_IMPORT_RE.test(readFileSync(f, 'utf8')));
  const allSpecFiles = collectFiles(join(workDir, 'generated-tests/scala'), '.scala');
  const domainSpecFiles = allSpecFiles.filter(f => !f.endsWith('InterfacesHttpSpec.scala'));
  const behaviorFiles = scaffoldFiles.filter(f => /(?:Behavior|Rules)\.scala$/u.test(f));

  if (behaviorFiles.length === 0 || domainSpecFiles.length === 0 || scalaJars.length === 0) {
    return { skipped: true, passed: true, total: 0, killed: 0, survived: [], killRate: 100 };
  }

  const cp = scalaJars.join(delimiter);
  let baseClasses = null;
  if (precompiledBaseClasses && existsSync(precompiledBaseClasses)) {
    const existingClasses = collectFiles(precompiledBaseClasses, '.class');
    if (existingClasses.length > 0) {
      baseClasses = precompiledBaseClasses;
      if (progress) {
        process.stderr.write(`[mutation-gate] scala reusing precompiled baseline classes (${existingClasses.length} .class files)\n`);
      }
    }
  }
  if (!baseClasses) {
    baseClasses = join(workDir, '.mut-base-classes');
    mkdirSync(baseClasses, { recursive: true });
    const baseStart = Date.now();
    if (progress) process.stderr.write('[mutation-gate] scala compiling baseline with scalac...\n');
    const baseCompile = spawnSync(
      'scalac',
      ['-cp', cp, '-d', baseClasses, ...kernelStubs, ...scaffoldFiles, ...clozeFiles, ...domainSpecFiles],
      { cwd: workDir, encoding: 'utf8', timeout: 180_000 },
    );
    if (baseCompile.status !== 0) {
      return {
        skipped: true,
        passed: false,
        total: 0,
        killed: 0,
        survived: [],
        killRate: 0,
        error: `baseline scalac failed during mutation setup: ${(baseCompile.stderr || '').trim()}`,
      };
    }
    if (progress) {
      process.stderr.write(`[mutation-gate] scala baseline compiled (${((Date.now() - baseStart) / 1000).toFixed(1)}s)\n`);
    }
  }

  const suiteClasses = extractScalaSuiteClasses(domainSpecFiles);
  const tasks = [];
  for (const file of behaviorFiles) {
    if (tasks.length >= maxMutants) break;
    const rel = relative(workDir, file).split(sep).join('/');
    const original = readFileSync(file, 'utf8');
    const mutants = generateDomainMutants(original, 'scala', { maxMutants: maxMutants - tasks.length });
    const targetSuites = pickTargetedScalaSuites(file, domainSpecFiles, suiteClasses);
    for (const mut of mutants) {
      tasks.push({
        index: tasks.length + 1,
        rel,
        line: mut.line,
        ruleId: mut.ruleId,
        kind: mut.kind,
        operator: mut.operator,
        targetSuites,
        mutatedSource: applyLineMutation(original, mut.line, mut.mutatedLine),
      });
    }
  }

  const total = tasks.length;
  if (total === 0) {
    return { skipped: false, vacuous: true, passed: false, total: 0, killed: 0, survived: [], killRate: 0 };
  }

  if (progress) {
    process.stderr.write(`[mutation-gate] scala running ${total} mutant(s) in parallel (concurrency=${concurrency ?? 'auto'})...\n`);
  }
  const workerProc = spawnSync(
    process.execPath,
    [SCALA_MUTATION_WORKER],
    {
      cwd: workDir,
      input: JSON.stringify({ workDir, baseClasses, cp, tasks, concurrency, progress }),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', progress ? 'inherit' : 'pipe'],
      timeout: Math.max(120_000, total * 45_000),
    },
  );
  if (workerProc.status !== 0) {
    return {
      skipped: false,
      vacuous: false,
      passed: false,
      total,
      killed: 0,
      survived: [],
      killRate: 0,
      error: `scala mutation worker failed (exit ${workerProc.status}): ${(workerProc.stderr || '').trim()}`,
    };
  }
  const parsed = JSON.parse((workerProc.stdout || '{}').trim() || '{}');
  const killed = Number(parsed.killed ?? 0);
  const survived = Array.isArray(parsed.survived) ? parsed.survived : [];
  const killRate = Number(((killed / total) * 100).toFixed(2));
  return { skipped: false, vacuous: false, passed: survived.length === 0, total, killed, survived, killRate, concurrency: parsed.concurrency ?? null };
}

export function runDomainMutationGate({
  rootDir,
  targets = ['typescript'],
  scalaJars = [],
  maxMutants = 12,
  minKillRate = 100,
  precompiledBaseClasses = null,
  concurrency = null,
  progress = false,
} = {}) {
  const absRoot = resolve(rootDir);
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-mut-gate-'));
  try {
    copyIfExists(join(absRoot, 'generated-scaffold'), join(workDir, 'generated-scaffold'));
    copyIfExists(join(absRoot, 'handwritten'), join(workDir, 'handwritten'));
    copyIfExists(join(absRoot, 'generated-tests'), join(workDir, 'generated-tests'));

    const ts = targets.includes('typescript')
      ? runTsDomainMutations(workDir, { maxMutants, progress })
      : { skipped: true, passed: true, total: 0, killed: 0, survived: [], killRate: 100 };

    const scala = targets.some(isScalaTarget)
      ? runScalaDomainMutations(workDir, { scalaJars, maxMutants, precompiledBaseClasses, concurrency, progress })
      : { skipped: true, passed: true, total: 0, killed: 0, survived: [], killRate: 100 };

    const errors = [];
    for (const [label, res] of [['TypeScript', ts], ['Scala', scala]]) {
      if (res.error) errors.push(res.error);
      if (!res.skipped && res.killRate < minKillRate) {
        errors.push(`${label} domain mutation kill rate ${res.killRate}% is below required ${minKillRate}% (${res.survived.length} survived)`);
      }
      for (const s of res.survived ?? []) {
        errors.push(`Mutant survived in ${s.file}:${s.line} [${s.ruleId}] (${s.kind}: ${s.operator})`);
      }
    }

    return {
      enabled: true,
      passed: errors.length === 0,
      minKillRate,
      ts,
      scala,
      errors,
    };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
