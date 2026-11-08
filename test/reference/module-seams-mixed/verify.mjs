import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { absolutePath, privateOutput, offlineJvmToolchain, jvmCompilerSession, files, snapshot, hash } from '../compiler-tools.mjs';
import { acquireFileLease, abandonFileLease } from '../../../lib/verification/lease.mjs';
import { modules, generatedInventory, supportInventory, oraclePaths, readOracle, parcelClasspaths, compilerControls } from './contract.mjs';
import { admitMixedInputs, admitReferenceInputs, stageInputs } from './inputs.mjs';
import { runtimeMutationAcceptance } from '../compiler-results.mjs';
import { runSeamControls } from './controls.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const oracleLockPath = join(here, 'oracle.lock.json');
const oracleLockSha256 = '63d07dbb62f03b928f1f5e7cc5229976341be2f8078c6942be02ff6050b2c845';
const required = ['--java', '--maven-cache', '--reference', '--out', '--mode', '--lease-registry', '--run-id'];
const mixed = ['--source', '--source-receipt', '--project', '--producer-root'];
const flags = new Set([...required, ...mixed, '--controls']);
export function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    assert(flags.has(flag) && !Object.hasOwn(result, flag), 'Unknown or repeated flag: ' + flag);
    assert(value && !value.startsWith('--'), 'Missing value: ' + flag);
    if (flag === '--mode') assert(['reference', 'generated-mixed'].includes(value), 'Expected reference or generated-mixed');
    else if (flag === '--controls') assert(value === 'extended', 'Only explicit extended controls are supported');
    else if (flag === '--run-id') assert(/^[a-z0-9][a-z0-9-]{0,79}$/.test(value), 'Portable unique run ID required');
    else absolutePath(value, flag);
    result[flag] = value;
  }
  for (const flag of required) assert(Object.hasOwn(result, flag), 'Missing flag: ' + flag);
  for (const flag of mixed) assert(Object.hasOwn(result, flag) === (result['--mode'] === 'generated-mixed'), 'Mixed flags required only for generated-mixed');
  assert(!result['--controls'] || result['--mode'] === 'generated-mixed', 'Extended controls require actual mixed writer input');
  return result;
}
export function classShadow(directories) {
  const seen = new Map();
  for (const [module, dir] of Object.entries(directories)) for (const file of files(dir).filter(path => path.endsWith('.class'))) {
    const path = file.slice(dir.length + 1);
    assert(!seen.has(path), `CLASS_SHADOW: ${path} in ${seen.get(path)} and ${module}`);
    seen.set(path, module);
  }
}
const suitesExpected = suites => ({ kind: 'suites', suites: suites.map(s => s.suite), tests: suites.reduce((n, s) => n + s.tests, 0), testNames: suites.flatMap(s => s.testNames) });
const lifecycleSafe = runs => runs.every(run => {
  const r = JSON.parse(readFileSync(run.lifecycle));
  return r.directChildReaped && !r.groupAliveAfter && !r.leftoverGroup && !r.timedOut && !r.cancelled &&
    !r.launchError && !r.outputError && !r.outputLimitExceeded && !r.terminationErrors.length && r.signal === null;
});

// This baseline lane proves main Parcel compilation/oracle/original controls.
// Additional ABI/direct/mutation and installed lanes are distinct pending gates.
export async function main(args) {
  assert(!process.env.NODE_TEST_CONTEXT, 'NODE_TEST_CONTEXT forbids JVM execution');
  const o = options(args), mode = o['--mode'];
  assert.equal(hash(oracleLockPath), oracleLockSha256, 'Independent oracle lock drifted');
  const lock = JSON.parse(readFileSync(oracleLockPath));
  const oracle = readOracle(o['--reference'], lock);
  const input = mode === 'reference' ? admitReferenceInputs(o['--reference']) : await admitMixedInputs({
    source: o['--source'], sourceReceipt: o['--source-receipt'], project: o['--project'], producerRoot: o['--producer-root'],
  });
  const tools = offlineJvmToolchain(o['--java'], o['--maven-cache']);
  const io = privateOutput(o['--out'], [o['--reference'], tools.cache, tools.javaHome, here,
    ...(mode === 'generated-mixed' ? [o['--source'], dirname(o['--project']), o['--producer-root']] : [])]);
  const verifierSources = [fileURLToPath(import.meta.url), join(here, 'contract.mjs'), join(here, 'inputs.mjs'), join(here, 'controls.mjs'), oracleLockPath,
    ...['compiler-tools.mjs', 'compiler-pom.mjs', 'jvm-toolchain.mjs', 'compiler-results.mjs'].map(path => join(here, '..', path)),
    ...files(resolve(here, '../../../lib/verification'))];
  const verifierPins = snapshot(verifierSources), oraclePins = snapshot(oracle.map(s => s.absolutePath));
  const session = jvmCompilerSession(io, tools, { suiteRejectionAcceptance: runtimeMutationAcceptance });
  let lease, failure = null, leaseReleased = false, safe = true, unrecordedLaunch = false, extended = [];
  const pairsPassed = [];
  const copied = stageInputs(io, input.sets, input.sourcePins);
  const stagePinned = (path, destination, expectedSha256) => {
    const bytes = readFileSync(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedSha256, 'Staging must use the admitted bytes');
    return io.write(destination, bytes);
  };
  const stagedOracle = oracle.map(s => ({ ...s, staged: stagePinned(s.absolutePath, 'inputs/oracle/' + s.path, s.sha256) }));
  const classes = Object.fromEntries(modules.map(m => [m, io.directory('classes/' + m)]));
  const cp = parcelClasspaths(tools, classes);
  const rootSource = readFileSync(copied.root.find(s => s.path.endsWith('/ParcelModule.scala')).staged, 'utf8');
  const controls = compilerControls(rootSource).map(c => ({ ...c,
    controlFile: io.write('controls/' + c.name + '/positive/' + c.file, c.control),
    negativeFile: io.write('controls/' + c.name + '/negative/' + c.file, c.negative),
  }));
  const dependencyControl = io.write('controls/dependency/TestDependencyControl.scala', `package example.parcel.reference
import org.scalatest.funsuite.AnyFunSuite
final class TestDependencyControl extends AnyFunSuite {
  test("ScalaTest is available without production") { assert(Vector(1, 2).sum == 3) }
}
`);
  const support = mode === 'generated-mixed' ? supportInventory.map(p => ({ path: p,
    staged: stagePinned(join(o['--source'], p), 'inputs/support/' + p,
      input.outputPins.find(row => row.path === join(o['--source'], p)).sha256) })) : [];
  const stagedPins = snapshot([...files(join(io.out, 'inputs')), ...files(join(io.out, 'controls'))]);
  const extendedPins = [];
  const extendedIo = { ...io, write: (name, bytes) => {
    const path = io.write(name, bytes); extendedPins.push(...snapshot([path])); return path;
  } };
  const check = () => {
    lease?.assertHeld(); input.close();
    assert.deepEqual(snapshot(verifierSources), verifierPins, 'Verifier source drift');
    assert.deepEqual(snapshot(oracle.map(s => s.absolutePath)), oraclePins, 'Oracle drift');
    assert.deepEqual(snapshot([...files(join(io.out, 'inputs')), ...files(join(io.out, 'controls'))]), stagedPins, 'Staged bytes drift');
    assert.deepEqual(snapshot(extendedPins.map(row => row.path)), extendedPins, 'Extended control bytes drift');
  };
  const execute = async action => {
    check();
    const count = session.runs.length;
    unrecordedLaunch = true;
    try { return await action(); }
    finally {
      if (session.runs.length === count + 1) unrecordedLaunch = false;
      if (!unrecordedLaunch) check();
    }
  };
  const jvm = (...args) => execute(() => session.jvm(...args));
  const compile = (...args) => execute(() => session.compile(...args));
  io.json('inputs.json', { mode, sources: input.sourcePins, oracle: oraclePins, verifier: verifierPins,
    ...(input.implementationEvidence ? { implementations: input.implementationEvidence } : {}), staged: stagedPins });
  io.json('supply.json', tools);
  io.json('classpaths.json', cp);
  try {
    lease = await acquireFileLease({ registry: o['--lease-registry'], lockNames: ['jvm-slot'], usedName: o['--run-id'] + '-used',
      record: { owner: 'module-seams-20261108', runId: o['--run-id'], mode, output: io.out }, preflight: () => { input.close(); return true; } });
    check();
    await jvm('java-version', ['-version'], { kind: 'success', pattern: /version "11\./ });
    for (const module of modules) {
      await compile(module + '-production', copied[module].map(s => s.staged), cp[module], classes[module]);
      classShadow(Object.fromEntries(modules.slice(0, modules.indexOf(module) + 1).map(m => [m, classes[m]])));
    }
    await compile('test-dependency-positive', [dependencyControl], tools.testLibraries, io.directory('classes/test-dependency'));
    await compile('no-production-negative', [stagedOracle[0].staged], tools.testLibraries, io.directory('classes/no-production'), {
      kind: 'compiler-rejection', file: 'CapacityRuleSpec.scala', symbol: 'CapacityRule', diagnostics: [/not found: type Route\b/, /not found: value CapacityRule\b/],
    });
    for (const control of controls) {
      await compile(control.name + '-positive', [control.controlFile], cp[control.controlCP], io.directory('classes/control/' + control.name));
      await compile(control.name + '-negative', [control.negativeFile], cp[control.negativeCP], io.directory('classes/negative/' + control.name), {
        kind: 'compiler-rejection', file: control.file, symbol: control.symbol, diagnostics: control.diagnostics,
      });
      pairsPassed.push(control.name);
    }
    for (const [group, groupCP] of [['kernel', cp.kernelTests], ['root', cp.rootTests]]) {
      const suites = stagedOracle.filter(s => s.module === group), target = io.directory('classes/' + group + '-oracle');
      await compile(group + '-oracle-compile', suites.map(s => s.staged), groupCP, target);
      check(); await jvm(group + '-oracle-suites', ['-cp', [...groupCP, target].join(delimiter), 'org.scalatest.tools.Runner',
        '-R', target, '-oW', ...suites.flatMap(s => ['-s', s.suite])], suitesExpected(suites)); check();
    }
    if (support.length) {
      const target = io.directory('classes/generated-tests');
      await compile('generated-support-compile', support.map(s => s.staged), cp.rootTests, target);
      const names = ['ModuleSeamsValueShapeSpec', 'ModuleSeamsRootShapeSpec'].map(name => 'example.parcel.verification.' + name);
      check(); await jvm('generated-support-suites', ['-cp', [...cp.rootTests, target].join(delimiter), 'org.scalatest.tools.Runner',
        '-R', target, '-oW', ...names.flatMap(name => ['-s', name])], { kind: 'suites', suites: names, tests: 2 }); check();
    }
    assert.equal(pairsPassed.length, 7);
    assert.equal(session.runs.length, mode === 'reference' ? 25 : 27);
    if (o['--controls'] === 'extended') {
      extended = await runSeamControls({ io: extendedIo, tools, copied, classes, cp, stagedOracle, compile, jvm, check, classShadow });
      assert.equal(session.runs.length, 60);
    }
  } catch (error) { failure = error.stack; }
  finally {
    try {
      check(); assert.deepEqual(snapshot(tools.paths), tools.supplyHashes, 'Supply changed during execution');
      safe = !unrecordedLaunch && lifecycleSafe(session.runs);
      assert(safe, 'Lifecycle incomplete; retain owned lease');
    } catch (error) { failure = [failure, error.stack].filter(Boolean).join('\n'); safe = false; }
    if (lease) {
      if (safe) { try { lease.release(); leaseReleased = true; } catch (error) { failure = [failure, error.stack].filter(Boolean).join('\n'); } }
      else abandonFileLease(lease);
    }
    const passed = !failure && leaseReleased && pairsPassed.length === 7 && session.runs.every(r => r.accepted);
    const result = { schemaVersion: 'truthsrc.module-seams-baseline-execution/v1', mode, passed, failure, leaseReleased,
      tests: passed ? 34 : null, generatedSupportTests: passed && mode === 'generated-mixed' ? 2 : 0,
      originalCompilerPairsPassed: pairsPassed, extendedControlsPassed: extended, runs: session.runs, network: 'denied', timeoutMsPerProcess: 120000,
      CComplete: false, additionalAbiMutationControlsComplete: extended.length === 12, directAndLayoutVariantsComplete: false,
      installedLaneComplete: false, approval: null };
    io.json('execution.json', result); console.log(JSON.stringify({ passed, output: io.out, failure }));
    if (!passed) process.exitCode = 1;
    return result;
  }
}

if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
