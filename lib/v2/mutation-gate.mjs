// Deterministic Domain Guard Mutation Gate for co-arising 2.0 (TypeScript & Scala).
// Operates in an isolated temporary workspace copy (never mutates the caller's repo).
// Generates guard-polarity & boundary off-by-one mutants on @ProvenanceId-tagged domain rules
// and verifies that locked BDD oracle suites kill 100% of mutants (or >= minKillRate).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, join, relative, resolve, sep } from 'node:path';

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

function runTsDomainMutations(workDir, { maxMutants = 12 } = {}) {
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

    for (const mut of mutants) {
      total += 1;
      writeFileSync(file, applyLineMutation(original, mut.line, mut.mutatedLine), 'utf8');
      try {
        const proc = spawnSync(
          process.execPath,
          ['--test', '--test-concurrency=1', ...specFiles],
          { cwd: workDir, env: childEnv, encoding: 'utf8', timeout: 20_000 },
        );
        if (proc.status !== 0) {
          killed += 1;
        } else {
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

  const killRate = total === 0 ? 100 : Number(((killed / total) * 100).toFixed(2));
  return { skipped: false, passed: survived.length === 0, total, killed, survived, killRate };
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

const SBT_FRAMEWORK_IMPORT_RE = /^\s*import\s+(?:akka\.|play\.|javax\.inject\.|com\.google\.inject\.|com\.google\.protobuf\.|scalapb\.|scalikejdbc\.|[^\s]+\.(?:application\.aggregates|infrastructure\.\{?proto|infrastructure\.persistence\.converters|infrastructure\.bootstrap|infrastructure\.readside)\b|[^\s]+\.common\.(?:application|serialization)\.)/mu;

function isScalaTarget(t) {
  return t === 'scala' || t === 'scala-strict' || t === 'scala-cqrs-play-service-v2';
}

function runScalaDomainMutations(workDir, { scalaJars = [], maxMutants = 12 } = {}) {
  const scaffoldFiles = collectFiles(join(workDir, 'generated-scaffold/scala'), '.scala')
    .filter(f => !SBT_FRAMEWORK_IMPORT_RE.test(readFileSync(f, 'utf8')));
  const clozeFiles = collectFiles(join(workDir, 'handwritten/scala'), '.scala');
  const allSpecFiles = collectFiles(join(workDir, 'generated-tests/scala'), '.scala');
  const domainSpecFiles = allSpecFiles.filter(f => !f.endsWith('InterfacesHttpSpec.scala'));
  const behaviorFiles = scaffoldFiles.filter(f => /(?:Behavior|Rules)\.scala$/u.test(f));

  if (behaviorFiles.length === 0 || domainSpecFiles.length === 0 || scalaJars.length === 0) {
    return { skipped: true, passed: true, total: 0, killed: 0, survived: [], killRate: 100 };
  }

  const cp = scalaJars.join(delimiter);
  const baseClasses = join(workDir, '.mut-base-classes');
  mkdirSync(baseClasses, { recursive: true });
  const baseCompile = spawnSync(
    'scalac',
    ['-cp', cp, '-d', baseClasses, ...scaffoldFiles, ...clozeFiles, ...domainSpecFiles],
    { cwd: workDir, encoding: 'utf8', timeout: 90_000 },
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

  const suiteClasses = extractScalaSuiteClasses(domainSpecFiles);
  let total = 0;
  let killed = 0;
  const survived = [];

  for (const file of behaviorFiles) {
    if (total >= maxMutants) break;
    const rel = relative(workDir, file).split(sep).join('/');
    const original = readFileSync(file, 'utf8');
    const mutants = generateDomainMutants(original, 'scala', { maxMutants: maxMutants - total });

    for (const mut of mutants) {
      total += 1;
      const mutClasses = join(workDir, `.mut-classes-${total}`);
      mkdirSync(mutClasses, { recursive: true });
      writeFileSync(file, applyLineMutation(original, mut.line, mut.mutatedLine), 'utf8');
      try {
        const comp = spawnSync(
          'scalac',
          ['-cp', `${baseClasses}${delimiter}${cp}`, '-d', mutClasses, file],
          { cwd: workDir, encoding: 'utf8', timeout: 30_000 },
        );
        if (comp.status !== 0) {
          killed += 1;
          continue;
        }
        const run = spawnSync(
          'scala',
          ['-cp', `${mutClasses}${delimiter}${baseClasses}${delimiter}${cp}`, 'org.scalatest.tools.Runner', '-oD', ...suiteClasses.flatMap(c => ['-s', c])],
          { cwd: workDir, encoding: 'utf8', timeout: 30_000 },
        );
        if (run.status !== 0) {
          killed += 1;
        } else {
          survived.push({
            target: 'scala',
            file: rel,
            line: mut.line,
            ruleId: mut.ruleId,
            kind: mut.kind,
            operator: mut.operator,
          });
        }
      } finally {
        writeFileSync(file, original, 'utf8');
        rmSync(mutClasses, { recursive: true, force: true });
      }
    }
  }

  const killRate = total === 0 ? 100 : Number(((killed / total) * 100).toFixed(2));
  return { skipped: false, passed: survived.length === 0, total, killed, survived, killRate };
}

export function runDomainMutationGate({
  rootDir,
  targets = ['typescript'],
  scalaJars = [],
  maxMutants = 12,
  minKillRate = 100,
} = {}) {
  const absRoot = resolve(rootDir);
  const workDir = mkdtempSync(join(tmpdir(), 'coarising-mut-gate-'));
  try {
    copyIfExists(join(absRoot, 'generated-scaffold'), join(workDir, 'generated-scaffold'));
    copyIfExists(join(absRoot, 'handwritten'), join(workDir, 'handwritten'));
    copyIfExists(join(absRoot, 'generated-tests'), join(workDir, 'generated-tests'));

    const ts = targets.includes('typescript')
      ? runTsDomainMutations(workDir, { maxMutants })
      : { skipped: true, passed: true, total: 0, killed: 0, survived: [], killRate: 100 };

    const scala = targets.some(isScalaTarget)
      ? runScalaDomainMutations(workDir, { scalaJars, maxMutants })
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
