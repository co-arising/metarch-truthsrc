// Unified emitter CLI (emitter-unification plan F1: one generator, one entry;
// the `generate-project` public command line is frozen and lives in the
// knowledge machine — this CLI is the emitter-side surface beneath it).
//
// Commands:
//   families                       list the registered families
//   generate <familyId> <input.json> <outDir>
//                                  fail-closed check → byte-deterministic emit
//   verify <familyId> <input.json>  golden parity + double-run determinism +
//                                  negatives battery (where carried)
//   negatives <familyId> <input.json>
//   parity [familyId]              Phase-1 acceptance vs tools/gen-*.mjs
//   diff <oldDir> <newDir> [--json] [--fail-on-diff]
//                                  per-file new-vs-old comparison (F5 呈报件)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import './families/index.mjs';
import { getFamily, listFamilies, renderFamily, requireFamilySpecPaths } from './registry.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';
import { runDiffCli } from './diff-report.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sha256 = text => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

const loadInput = inputPath => {
  if (!inputPath) fail('EMITTER_USAGE', 'an input.json path is required');
  if (!fs.existsSync(inputPath)) fail('EMITTER_USAGE', `input file ${JSON.stringify(inputPath)} does not exist`);
  return parseStrictJson(fs.readFileSync(inputPath));
};

const writeOutputs = (familyId, outputs, outDir) => {
  if (!outDir) fail('EMITTER_USAGE', 'an output directory is required');
  fs.mkdirSync(outDir, { recursive: true });
  const produced = [];
  for (const [relative, content] of Object.entries(outputs)) {
    const target = path.join(outDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    produced.push({ path: relative, bytes: Buffer.byteLength(content), sha256: sha256(content) });
  }
  process.stdout.write(JSON.stringify({ family: familyId, produced }) + '\n');
};

const commandFamilies = () => {
  for (const family of listFamilies()) {
    process.stdout.write(`${family.id} (#${family.familyNumber})  ${family.inputSchema}  battery=${family.runNegatives ? 'embedded' : 'none'}  ${family.toolsRef}\n`);
  }
};

const commandGenerate = (familyId, inputPath, outDir) => {
  const family = getFamily(familyId);
  requireFamilySpecPaths(family);
  const input = loadInput(inputPath);
  const outputs = renderFamily(family, input);
  writeOutputs(family.id, outputs, outDir);
};

const commandVerify = (familyId, inputPath) => {
  const family = getFamily(familyId);
  requireFamilySpecPaths(family);
  const input = loadInput(inputPath);
  const run1 = renderFamily(family, input);
  const run2 = renderFamily(family, input);
  const deterministic = JSON.stringify(run1) === JSON.stringify(run2);
  const files = Object.keys(run1).sort().map(relative => {
    const goldenAbsolute = path.join(ROOT, family.goldenRoot, relative);
    const goldenBytes = fs.existsSync(goldenAbsolute) ? fs.readFileSync(goldenAbsolute) : null;
    const produced = Buffer.from(run1[relative], 'utf8');
    return {
      file: relative,
      bytes: produced.length,
      producedSha256: sha256(run1[relative]),
      goldenSha256: goldenBytes ? sha256(goldenBytes.toString('utf8')) : null,
      byteParity: Boolean(goldenBytes) && produced.equals(goldenBytes),
    };
  });
  let battery = { kind: 'none', expected: 0, rejected: 0, failures: [], clean: null };
  if (typeof family.runNegatives === 'function') {
    const result = family.runNegatives(JSON.parse(JSON.stringify(input)));
    battery = { kind: 'embedded', expected: result.expected, rejected: result.rejected, failures: result.failures,
      clean: result.rejected === result.expected && result.failures.length === 0 };
  }
  const byteParity = files.length > 0 && files.every(file => file.byteParity);
  const passed = byteParity && deterministic && (battery.clean === true || battery.kind === 'none');
  process.stdout.write(JSON.stringify({ family: family.id, byteParity, deterministic, files, battery, passed }, null, 2) + '\n');
  if (!passed) process.exitCode = 1;
};

const commandNegatives = (familyId, inputPath) => {
  const family = getFamily(familyId);
  if (typeof family.runNegatives !== 'function')
    {fail('EMITTER_NEGATIVES', `family ${family.id} carries no embedded negatives battery (registered debt — backfill through the family gate)`);}
  const input = loadInput(inputPath);
  const result = family.runNegatives(JSON.parse(JSON.stringify(input)));
  process.stdout.write(JSON.stringify({ family: family.id, negatives: result }, null, 2) + '\n');
  if (result.rejected !== result.expected || result.failures.length > 0) process.exitCode = 1;
};

const USAGE = `usage: emitter/cli.mjs <command> [args]
commands:
  families
  generate <familyId> <input.json> <outDir>
  verify <familyId> <input.json>
  negatives <familyId> <input.json>
  parity [familyId]
  diff <oldDir> <newDir> [--json] [--fail-on-diff]`;

export async function runCli(argv) {
  const [command, ...args] = argv;
  switch (command) {
    case 'families': return commandFamilies();
    case 'generate': return commandGenerate(...args);
    case 'verify': return commandVerify(...args);
    case 'negatives': return commandNegatives(...args);
    case 'parity': {
      const { runParityCli } = await import('./parity.mjs');
      return runParityCli(args);
    }
    case 'diff': return runDiffCli(args);
    case undefined:
    default:
      fail('EMITTER_USAGE', USAGE);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(String(error.message) + '\n');
    process.exitCode = 1;
  }
}
