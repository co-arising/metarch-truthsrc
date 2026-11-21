// Phase-1 acceptance harness of the unified emitter (emitter-unification plan
// §4 Phase 1 step 3): for every registered family, the same fixture input must
// produce byte-identical output from the emitter module and from the tools/
// gen-*.mjs byte-parity reference — plus golden parity against the curated
// tree (金样即规格, F3), double-run determinism (纪律 3), and, where the family
// carries one, a clean negatives battery. Families without a battery are
// reported as a registered debt (battery: "none") — never silently green.
//
// Usage:
//   node emitter/parity.mjs            # all families
//   node emitter/parity.mjs <familyId> # one family
// Exit 0 only when every checked property is green; the JSON report is the
// evidence.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import './families/index.mjs';
import { getFamily, listFamilyIds, renderFamily } from './registry.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const readTreeBytes = root => {
  const files = new Map();
  const visit = (absolute, relative) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const childAbsolute = path.join(absolute, entry.name);
      const childRelative = relative === '' ? entry.name : relative + '/' + entry.name;
      if (entry.isDirectory()) visit(childAbsolute, childRelative);
      else if (entry.isFile()) files.set(childRelative.split(path.sep).join('/'), fs.readFileSync(childAbsolute));
    }
  };
  visit(root, '');
  return files;
};

// Tools reference output. Families with a pure-function export are compared
// in-process (their CLI guards stay inert on import); the subcommand-CLI
// families are run as subprocesses and compared through the files they write
// (a single-file writer via toolsSingleFile, else a whole tree). Byte parity
// is decided on utf8 buffers, never on string equality alone.
const runToolsReference = async (family, fixtureAbsolute, input, workDir, emitterRun) => {
  if (family.toolsMode === 'generate') {
    const outDir = fs.mkdtempSync(path.join(workDir, `${family.id}-tools-`));
    const target = family.toolsSingleFile === true
      ? (() => {
          const keys = Object.keys(emitterRun);
          if (keys.length !== 1)
            fail('EMITTER_PARITY', `family ${family.id}: toolsSingleFile requires exactly one emitter artifact, got ${keys.length}`);
          return path.join(outDir, keys[0]);
        })()
      : outDir;
    if (family.toolsSingleFile === true) fs.mkdirSync(path.dirname(target), { recursive: true });
    const run = spawnSync(process.execPath, [path.join(ROOT, family.toolsRef), 'generate', fixtureAbsolute, target], { cwd: ROOT, encoding: 'utf8' });
    if (run.status !== 0)
      fail('EMITTER_PARITY', `family ${family.id}: reference generator ${family.toolsRef} exited ${run.status}: ${(run.stderr || run.stdout || '').slice(0, 400)}`);
    if (family.toolsSingleFile === true) {
      const relative = path.relative(outDir, target).split(path.sep).join('/');
      return new Map([[relative, fs.readFileSync(target)]]);
    }
    return readTreeBytes(outDir);
  }
  if (typeof family.toolsExport !== 'string')
    fail('EMITTER_PARITY', `family ${family.id}: neither toolsMode 'generate' nor a toolsExport reference export is declared`);
  const reference = await import(path.join(ROOT, family.toolsRef));
  const generate = reference[family.toolsExport];
  if (typeof generate !== 'function')
    fail('EMITTER_PARITY', `family ${family.id}: reference export ${family.toolsExport} not found in ${family.toolsRef}`);
  const outputs = generate(JSON.parse(JSON.stringify(input)));
  const files = new Map();
  for (const [relative, content] of Object.entries(outputs)) files.set(relative, Buffer.from(content, 'utf8'));
  return files;
};

const checkFamily = async (family, workDir) => {
  const fixtureAbsolute = path.join(ROOT, family.fixtureDir, 'input.json');
  if (!fs.existsSync(fixtureAbsolute))
    fail('EMITTER_PARITY', `family ${family.id}: fixture input.json missing at ${family.fixtureDir}/input.json`);
  const input = parseStrictJson(fs.readFileSync(fixtureAbsolute));

  // Emitter render, twice (double-run determinism, 纪律 3).
  const emitterRun1 = renderFamily(family, input);
  const emitterRun2 = renderFamily(family, input);
  const deterministic = JSON.stringify(emitterRun1) === JSON.stringify(emitterRun2);

  // Tools reference render, twice (same-input-same-bytes on both sides).
  const toolsRun1 = await runToolsReference(family, fixtureAbsolute, input, workDir, emitterRun1);
  const toolsRun2 = await runToolsReference(family, fixtureAbsolute, input, workDir, emitterRun1);
  const toolsDeterministic = toolsRun1.size === toolsRun2.size &&
    [...toolsRun1].every(([relative, bytes]) => toolsRun2.get(relative)?.equals(bytes));

  // Byte parity: same input, same relative paths, same bytes (同输入同字节).
  const emitterKeys = Object.keys(emitterRun1).sort();
  const toolsKeys = [...toolsRun1.keys()].sort();
  const sameKeySet = JSON.stringify(emitterKeys) === JSON.stringify(toolsKeys);
  const files = emitterKeys.map(relative => {
    const emitterBytes = Buffer.from(emitterRun1[relative], 'utf8');
    const toolsBytes = toolsRun1.get(relative);
    const goldenAbsolute = path.join(ROOT, family.goldenRoot, relative);
    const goldenBytes = fs.existsSync(goldenAbsolute) ? fs.readFileSync(goldenAbsolute) : null;
    return {
      file: relative,
      bytes: emitterBytes.length,
      emitterSha256: sha256(emitterBytes),
      toolsSha256: toolsBytes ? sha256(toolsBytes) : null,
      goldenSha256: goldenBytes ? sha256(goldenBytes) : null,
      toolsParity: Boolean(toolsBytes) && emitterBytes.equals(toolsBytes),
      goldenParity: Boolean(goldenBytes) && emitterBytes.equals(goldenBytes),
    };
  });
  const toolsParity = sameKeySet && files.every(file => file.toolsParity);
  const goldenParity = files.length > 0 && files.every(file => file.goldenParity);

  // Negatives battery where the family carries one; otherwise a declared debt.
  let battery;
  if (typeof family.runNegatives === 'function') {
    const result = family.runNegatives(JSON.parse(JSON.stringify(input)));
    if (typeof result !== 'object' || result === null || !Array.isArray(result.failures))
      fail('EMITTER_PARITY', `family ${family.id}: runNegatives must return {expected, rejected, failures}`);
    battery = {
      kind: 'embedded',
      expected: result.expected,
      rejected: result.rejected,
      failures: result.failures,
      clean: result.rejected === result.expected && result.failures.length === 0,
    };
  } else {
    battery = { kind: 'none', expected: 0, rejected: 0, failures: [], clean: null };
  }

  const allGreen = deterministic && toolsDeterministic && toolsParity && goldenParity &&
    (battery.clean === true || battery.kind === 'none');
  return {
    family: family.id,
    familyNumber: family.familyNumber,
    inputSchema: family.inputSchema,
    files: files.length,
    deterministic,
    toolsDeterministic,
    toolsParity,
    goldenParity,
    battery,
    allGreen,
  };
};

export async function runParity(requestedFamilyId) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emitter-parity-'));
  try {
    const familyIds = requestedFamilyId === undefined ? listFamilyIds() : [getFamily(requestedFamilyId).id];
    const families = familyIds.map(getFamily);
    const report = {
      schemaVersion: 'emitter-parity-report/v1',
      scope: requestedFamilyId === undefined ? 'all-families' : requestedFamilyId,
      familiesChecked: families.length,
      batteriesDebt: 0,
      allGreen: true,
      families: [],
    };
    for (const family of families) {
      const result = await checkFamily(family, workDir);
      report.families.push(result);
      if (result.battery.kind === 'none') report.batteriesDebt += 1;
      if (!result.allGreen) report.allGreen = false;
    }
    return report;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export async function runParityCli(argv) {
  if (argv.length > 1) fail('EMITTER_USAGE', 'usage: parity.mjs [familyId]');
  const requested = argv[0];
  const report = await runParity(requested);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.allGreen) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    runParityCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(String(error.message) + '\n');
    process.exitCode = 1;
  }
}
