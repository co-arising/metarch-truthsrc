// CLI orchestrators for co-arising EARS 1.0: check-spec, project-spec, emit-tests.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseEars } from './parser.mjs';
import { normalizeEars } from './normalize.mjs';
import { bindEarsSpec, loadStandaloneSymbolTable, loadSymbolTableFromProject } from './binder.mjs';
import { projectStyleE } from './project-ac.mjs';
import { projectStyleB } from './project-table.mjs';
import { verifyEarsWithSmt } from './clarification-card.mjs';
import { buildTestIr } from './test-ir.mjs';
import { emitGherkinFeature } from './emit-gherkin.mjs';
import { buildLockedManifest, scalaScalaTestEmitter } from './emitters/scala-scalatest.mjs';

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`unexpected positional argument: ${token}`);
    if (['--no-gap-check', '--strict-rules', '--include-zh'].includes(token)) {
      flags[token] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`missing value for flag ${token}`);
    flags[token] = next;
    i += 1;
  }
  return flags;
}

function collectEarsFiles(inputPath, { includeZh = false } = {}) {
  const abs = resolve(inputPath);
  const st = statSync(abs);
  if (st.isFile()) return [abs];
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.ears')) {
        if (!includeZh && entry.name.endsWith('.zh.ears')) continue;
        files.push(full);
      }
    }
  };
  walk(abs);
  return files;
}

function loadCombinedSymbolTable(flags) {
  let sym = null;
  if (flags['--project']) {
    sym = loadSymbolTableFromProject(resolve(flags['--project']));
  }
  if (flags['--types']) {
    const extra = loadStandaloneSymbolTable(resolve(flags['--types']));
    if (!sym) {
      sym = extra;
    } else {
      for (const [k, v] of extra.aggregates) sym.aggregates.set(k, v);
      for (const [k, v] of extra.stories) sym.stories.set(k, v);
      for (const rm of extra.readModels) sym.readModels.add(rm);
    }
  }
  return sym;
}

function baseSlug(filePath) {
  return basename(filePath).replace(/\.zh\.ears$/u, '').replace(/\.ears$/u, '');
}

function loadSpecFile(filePath, symbolTable, { strictRuleRefs = false } = {}) {
  const text = readFileSync(filePath, 'utf8');
  const ast = parseEars(text, { file: filePath });
  const normalized = normalizeEars(ast);
  const bound = bindEarsSpec(normalized, symbolTable, { strictRuleRefs });
  return { filePath, text, spec: bound };
}

export function checkSpecCli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--in']) throw new Error('check-spec requires --in <file-or-dir>');
  const format = flags['--format'] ?? 'json';
  if (format !== 'json' && format !== 'human') throw new Error('--format must be human or json');

  const solver = flags['--solver'] ?? 'z3';
  const bmcSteps = flags['--bmc-steps'] !== undefined ? Number(flags['--bmc-steps']) : 4;
  const checkGaps = !flags['--no-gap-check'];
  const strictRuleRefs = Boolean(flags['--strict-rules']);
  const symbolTable = loadCombinedSymbolTable(flags);
  const files = collectEarsFiles(flags['--in'], { includeZh: Boolean(flags['--include-zh']) });

  const results = files.map(filePath => {
    const { spec } = loadSpecFile(filePath, symbolTable, { strictRuleRefs });
    const hardDiagnostics = spec.diagnostics.filter(d => d.severity === 'error');
    const smt = hardDiagnostics.length === 0
      ? verifyEarsWithSmt(spec, { solver, bmcSteps, checkGaps })
      : null;
    const passed = hardDiagnostics.length === 0 && Boolean(smt?.passed);
    return {
      file: filePath,
      target: spec.target,
      kind: spec.kind,
      layer: spec.layer,
      canonicalSha256: spec.canonicalSha256,
      theory: spec.theory,
      bound: spec.bound,
      diagnostics: spec.diagnostics,
      smt,
      passed,
    };
  });

  const passed = results.every(r => r.passed);
  return {
    schemaVersion: 'co-arising.check-spec-batch/v1',
    format,
    solver,
    passed,
    count: results.length,
    results,
  };
}

export function renderCheckSpecHuman(batch) {
  const lines = [];
  for (const r of batch.results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    lines.push(`[${icon}] ${r.target} (${r.theory.logic}, sha256=${r.canonicalSha256.slice(0, 12)})`);
    for (const d of r.diagnostics) {
      lines.push(`  - [${d.severity.toUpperCase()}] ${d.code}: ${d.message}`);
    }
    for (const card of r.smt?.clarificationCards ?? []) {
      lines.push('');
      lines.push(card.markdown);
    }
  }
  return lines.join('\n');
}

export function projectSpecCli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--in']) throw new Error('project-spec requires --in <file-or-dir>');
  const outAc = flags['--out-ac'] ? resolve(flags['--out-ac']) : null;
  const outTables = flags['--out-tables'] ? resolve(flags['--out-tables']) : null;
  if (!outAc && !outTables) throw new Error('project-spec requires --out-ac <dir> and/or --out-tables <dir>');
  const lang = flags['--lang'] ?? 'zh';
  const symbolTable = loadCombinedSymbolTable(flags);
  const files = collectEarsFiles(flags['--in'], { includeZh: Boolean(flags['--include-zh']) });

  if (outAc) mkdirSync(outAc, { recursive: true });
  if (outTables) mkdirSync(outTables, { recursive: true });

  const written = [];
  for (const filePath of files) {
    const { text, spec } = loadSpecFile(filePath, symbolTable);
    const slug = baseSlug(filePath);
    if (outAc) {
      const ac = projectStyleE(spec, { sourceFile: basename(filePath), sourceText: text, lang });
      const dest = join(outAc, `${slug}.md`);
      writeFileSync(dest, ac.content, 'utf8');
      written.push({ kind: 'style-e-ac', source: filePath, file: dest, sourceSha256: ac.sourceSha256 });
    }
    if (outTables) {
      const tbl = projectStyleB(spec, { sourceFile: basename(filePath), sourceText: text });
      const dest = join(outTables, `${slug}.md`);
      writeFileSync(dest, tbl.content, 'utf8');
      written.push({ kind: 'style-b-dmn-table', source: filePath, file: dest, sourceSha256: tbl.sourceSha256 });
    }
  }

  return {
    schemaVersion: 'co-arising.project-spec/v1',
    count: files.length,
    written,
  };
}

export function emitTestsCli(argv) {
  const flags = parseFlags(argv);
  if (!flags['--in']) throw new Error('emit-tests requires --in <file-or-dir>');
  const outFeatures = flags['--out-features'] ? resolve(flags['--out-features']) : null;
  const outScala = flags['--out-scala'] ? resolve(flags['--out-scala']) : null;
  const packageName = flags['--package'] ?? 'example.ears';
  const manifestPath = flags['--manifest'] ? resolve(flags['--manifest']) : null;
  const solver = flags['--solver'] ?? 'z3';
  const bmcSteps = flags['--bmc-steps'] !== undefined ? Number(flags['--bmc-steps']) : 4;
  const checkGaps = !flags['--no-gap-check'];

  if (!outFeatures && !outScala) throw new Error('emit-tests requires --out-features <dir> and/or --out-scala <dir>');

  const symbolTable = loadCombinedSymbolTable(flags);
  const files = collectEarsFiles(flags['--in'], { includeZh: Boolean(flags['--include-zh']) });
  const manifestRoot = manifestPath ? dirname(manifestPath) : process.cwd();
  const manifestEntries = [];
  const emitted = [];

  for (const filePath of files) {
    const { text, spec } = loadSpecFile(filePath, symbolTable);
    const smt = verifyEarsWithSmt(spec, { solver, bmcSteps, checkGaps });
    const testIr = buildTestIr(spec, smt, { sourceFile: basename(filePath), sourceText: text });

    if (outFeatures) {
      const feature = emitGherkinFeature(testIr);
      const dest = join(outFeatures, feature.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, feature.content, 'utf8');
      manifestEntries.push({
        relativePath: relative(manifestRoot, dest),
        sha256: feature.sha256,
        sourceFile: basename(filePath),
        sourceSha256: testIr.meta.sourceSha256,
      });
      emitted.push({ kind: 'gherkin', file: dest, sha256: feature.sha256 });
    }

    if (outScala) {
      const suite = spec.layer === 'application'
        ? scalaScalaTestEmitter.emitApplicationSpec(testIr, { packageName })
        : scalaScalaTestEmitter.emitDomainSpec(testIr, { packageName });
      const dest = join(outScala, suite.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, suite.content, 'utf8');
      manifestEntries.push({
        relativePath: relative(manifestRoot, dest),
        sha256: suite.sha256,
        sourceFile: basename(filePath),
        sourceSha256: testIr.meta.sourceSha256,
      });
      emitted.push({ kind: 'scalatest', file: dest, sha256: suite.sha256 });
    }
  }

  if (manifestPath) {
    const manifest = buildLockedManifest(manifestEntries);
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }

  return {
    schemaVersion: 'co-arising.emit-tests/v1',
    count: files.length,
    emitted,
    manifestFile: manifestPath,
    manifestCount: manifestEntries.length,
  };
}
