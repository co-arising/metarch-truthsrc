import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { delimiter, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { absolutePath, regular, within, present, files, snapshot, hash, offlineToolchain,
  privateOutput, compilerSession } from '../compiler-tools.mjs';

// One declared Counter family, not arbitrary source discovery / a build framework.
const domain = 'modules/kernel/src/main/scala/example/counter/domain/';
const serialization = 'modules/glue/src/main/scala/example/counter/infrastructure/serialization/';
export const sourceInventory = Object.freeze({
  kernel: Object.freeze([
    'CounterProtocol.scala', 'CounterState.scala', 'ports/CounterComputations.scala',
    'invariant/params/CounterRuleParams.scala', ...[
      'Distance', 'PoDistance', 'PoRatio', 'Ratio', 'Reading', 'WireDistance', 'WireRatio',
    ].map(name => `values/${name}.scala`),
  ].map(name => domain + name)),
  glue: Object.freeze(['DomainConverters.scala', 'ExactValueCodecs.scala'].map(name => serialization + name)),
  proto: Object.freeze(['modules/glue/src/main/protobuf/counter_domain.proto']),
  build: Object.freeze(['build.sbt', 'project/build.properties', 'project/plugins.sbt']),
  generatedTest: Object.freeze(['modules/glue/src/test/scala/example/counter/infrastructure/serialization/CounterStateRoundTripSpec.scala']),
});
export const oracleInventory = Object.freeze([
  'DomainKernelSpec.scala', 'positive/ValidHost.scala', 'negative/MissingMethod.scala', 'negative/WrongOutputType.scala',
]);
export const suites = Object.freeze({ oracle: 'example.counter.oracle.DomainKernelSpec', generated: 'example.counter.infrastructure.serialization.CounterStateRoundTripSpec' });
export const oracleTests = Object.freeze([
  'every nominal value root survives actual protobuf bytes without field swaps',
  'state and event bytes preserve independent same-type sentinels and Long extrema',
  'nested optional states including Some(None) and Some(Some(empty)) have distinct bytes',
  'optional sequence elements distinguish absent values from zero and preserve Long extrema',
  'map encoding sorts String keys and is independent of insertion order',
  'decoders require every message-valued Reading child including empty-container wrappers',
  'state and event decoders require reading and accepted messages at their own paths',
  'optional presence rejects missing required inner nodes and carried absent payloads',
  'required sequence and map wrappers reject false presence even with no entries',
  'map entries require nested values and reject duplicate keys before map collapse',
  'Ratio codecs use canonical p38 minor coefficients for wire and PO',
  'Distance codecs use canonical p38 scale-zero fixed text and preserve declared units',
  'minor parsing rejects noncanonical text and coefficients outside p38 on every input boundary',
  'fixed parsing rejects noncanonical scale-zero text and p38 overflow on every input boundary',
  'unit admission is exact for constructors, copy, codecs and protobuf decoding',
  'constructors and copy validate both p38 endpoints without rounding',
  'positivity is strict and same-unit comparison uses exact values at p38 extrema',
  'plus and minus are exact and reject result overflow at both p38 scale extrema',
  'arithmetic ignores low precision operand MathContext and never rounds intermediate results',
  'comparison and arithmetic reject unequal admitted units instead of converting them',
  'state constructor defaults and empty preserve authored nonzero values and nested presence',
  'RuleParams retain state command and host without evaluating the host',
]);
const metadata = Object.freeze(['.truthsrc/canonical.json', '.truthsrc/request.json', '.truthsrc/compiled.json', '.truthsrc/inputs.json', 'truthsrc.ledger.json', 'anchors.json']);
const pathFlags = new Set(['--java', '--maven-cache', '--protoc', '--source', '--oracle', '--out', '--source-receipt']);
const required = ['--java', '--maven-cache', '--protoc', '--source', '--oracle', '--out', '--mode'];

export function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    assert(pathFlags.has(flag) || flag === '--mode', `Unknown flag: ${flag}`);
    assert(!Object.hasOwn(result, flag), `Repeated flag: ${flag}`);
    const value = args[i + 1];
    assert(value && !value.startsWith('--'), `Missing value: ${flag}`);
    if (flag === '--mode') assert(['reference', 'generated'].includes(value), '--mode must be reference or generated');
    else absolutePath(value, flag);
    result[flag] = value;
  }
  for (const flag of required) assert(Object.hasOwn(result, flag), `Missing flag: ${flag}`);
  assert(result['--mode'] === 'generated' ? Object.hasOwn(result, '--source-receipt') : !Object.hasOwn(result, '--source-receipt'),
    '--source-receipt is required only in generated mode');
  return result;
}

function realDirectory(path) {
  assert(lstatSync(path).isDirectory() && realpathSync(path) === path, `Not a real input directory: ${path}`);
  return path;
}

export function collectInputs(source, oracle, mode) {
  realDirectory(source); realDirectory(oracle);
  assert(!within(source, oracle) && !within(oracle, source), 'Production and independent oracle must be disjoint');
  const sourcePaths = files(source);
  const expected = [...sourceInventory.kernel, ...sourceInventory.glue, ...sourceInventory.proto, ...sourceInventory.build,
    ...(mode === 'generated' ? [...sourceInventory.generatedTest, ...metadata] : [])];
  assert.deepEqual(sourcePaths.map(path => relative(source, path)).sort(), expected.slice().sort(),
    'Incomplete or extra finite source inventory (managed/PB stand-ins and copied oracle are forbidden)');
  const oraclePaths = files(oracle);
  assert.deepEqual(oraclePaths.map(path => relative(oracle, path)).sort(), [...oracleInventory].sort(), 'Independent oracle inventory must be complete');
  const text = readFileSync(join(oracle, 'DomainKernelSpec.scala'), 'utf8');
  assert.match(text, /package example\.counter\.oracle\b/);
  assert.match(text, /final class DomainKernelSpec extends AnyFunSuite/);
  assert.deepEqual([...text.matchAll(/^  test\("([^"\n]+)"\) \{/gm)].map(match => match[1]), [...oracleTests], 'Oracle test names/count drifted');
  return { sourcePaths, oraclePaths };
}

function inventoryPaths(root) {
  function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      assert(entry.isFile() && !entry.isSymbolicLink(), `Non-regular writer input: ${path}`);
      return [path];
    });
  }
  return walk(root).sort();
}

// A genuine generate-project receipt is an explicit read input outside generated/build output.
// Correlates final writer hashes; does not promote generator/catalog qualifications.
export function generatedEvidence(source, receiptPath) {
  regular(receiptPath);
  assert(!within(receiptPath, source), 'Generated source receipt must be outside the generated source tree');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.schemaVersion, 'truthsrc.project-result/v1', 'Expected real generate-project receipt');
  assert.equal(receipt.applied, true, 'Plan-only receipt cannot certify final writer bytes');
  assert.equal(receipt.result?.name, 'scala-cqrs-domain-kernel', 'Wrong final writer generator');
  assert.equal(receipt.result?.ledger, join(source, 'truthsrc.ledger.json'), 'Receipt points to a different output');
  assert.equal(receipt.result?.anchors, join(source, 'anchors.json'), 'Receipt points to a different anchor output');
  const ledger = JSON.parse(readFileSync(join(source, 'truthsrc.ledger.json'), 'utf8'));
  assert.equal(ledger.generator, 'scala-cqrs-domain-kernel');
  const inputs = JSON.parse(readFileSync(join(source, '.truthsrc/inputs.json'), 'utf8'));
  assert.deepEqual(inputs.sources, receipt.sources, 'Generated metadata and execution receipt have different inputs');
  const paths = [...sourceInventory.kernel, ...sourceInventory.glue, ...sourceInventory.proto, ...sourceInventory.build, ...sourceInventory.generatedTest,
    ...metadata.filter(path => path.startsWith('.truthsrc/'))];
  assert.deepEqual(inputs.generatedFiles.slice().sort(), paths.filter(path => !path.startsWith('.truthsrc/')).sort(), 'Final writer must describe the entire finite source set');
  assert.equal(receipt.result.total, paths.length);
  assert.equal(ledger.entries.length, paths.length);
  assert.equal(receipt.result.actions.length, paths.length);
  const hashes = paths.map(path => ({ path, sha256: hash(join(source, path)) }));
  const projectSource = inputs.sources.filter(row => row.role === 'project');
  assert.equal(projectSource.length, 1, 'Writer must identify one project owner');
  const owner = projectSource[0].file;
  const kindFor = path => path.startsWith('.truthsrc/') ? 'project-evidence' : sourceInventory.kernel.includes(path) ?
    path.includes('/values/') ? 'value-object' : path.includes('/ports/') ? 'computation-port' : path.includes('/params/') ? 'rule-parameters' :
      path.endsWith('/CounterState.scala') ? 'state' : 'protocol' : sourceInventory.build.includes(path) ? 'build' :
    sourceInventory.proto.includes(path) ? 'proto' : sourceInventory.generatedTest.includes(path) ? 'generated-test' :
      path.endsWith('/ExactValueCodecs.scala') ? 'exact-value-codec' : 'converter';
  for (const row of hashes) {
    const entry = ledger.entries.filter(item => item.path === row.path);
    const action = receipt.result.actions.filter(item => item.path === row.path);
    assert.equal(entry.length, 1, `Missing/duplicate writer ledger entry: ${row.path}`);
    assert.equal(action.length, 1, `Missing/duplicate writer receipt action: ${row.path}`);
    assert.equal(entry[0].ownership?.generator, ledger.generator);
    assert.equal(entry[0].ownership?.id, owner, 'Writer ownership does not match its project');
    assert.equal(entry[0].kind, kindFor(row.path), 'Writer ledger kind differs from the finite artifact');
    assert.equal(action[0].kind, entry[0].kind, 'Writer action and ledger kinds differ');
    assert.equal(entry[0].ownership?.fingerprint, `sha256:${row.sha256}`, `Writer ledger does not match actual bytes: ${row.path}`);
    assert(['ADD', 'COVER', 'MERGE', 'IDENTICAL'].includes(action[0].outcome), `Unaccepted writer action: ${row.path}`);
    assert.equal(action[0].fingerprint, `sha256:${row.sha256}`, `Writer receipt does not match actual bytes: ${row.path}`);
  }
  const inputFiles = [];
  for (const row of inputs.sources) {
    if (row.file) {
      absolutePath(row.file, 'writer input'); regular(row.file);
      assert.equal(hash(row.file), row.sha256, `Writer source input has changed: ${row.file}`);
      inputFiles.push(row.file);
    }
  }
  const trees = inputs.sources.filter(row => row.role === 'tree').map(row => row.file).sort();
  assert(trees.length > 0, 'Writer receipt must include the real author tree');
  const projectRows = inputs.sources.filter(row => row.role === 'project');
  assert.equal(projectRows.length, 1, 'Writer must declare one real project file');
  const project = JSON.parse(readFileSync(regular(projectRows[0].file), 'utf8'));
  assert(typeof project.tree === 'string' && !project.tree.includes('\0'), 'Writer project must declare its author tree');
  const treeRoot = absolutePath(resolve(dirname(projectRows[0].file), project.tree), 'author tree');
  realDirectory(treeRoot);
  assert.deepEqual(inventoryPaths(treeRoot), trees, 'Writer author tree inventory has changed (extra/missing inputs)');
  const toolRows = inputs.sources.filter(row => row.role === 'tool');
  assert.equal(toolRows.length, 1, 'Writer must pin one real producer tool fingerprint');
  const recordedRoot = toolRows[0].root;
  assert(typeof recordedRoot === 'string', 'Writer producer root is missing');
  const producerRoot = absolutePath(recordedRoot.endsWith('/') ? recordedRoot.slice(0, -1) : recordedRoot, 'producer root');
  realDirectory(producerRoot);
  const producerPaths = ['lib', 'src', 'generators', 'schema', 'scaffold'].flatMap(dir => files(join(producerRoot, dir)))
    .concat([regular(join(producerRoot, 'bin/truthsrc.js')), regular(join(producerRoot, 'package.json'))]).sort();
  const producerFingerprint = createHash('sha256').update(JSON.stringify(producerPaths.map(file => [file.slice(recordedRoot.length), hash(file)])) + '\n').digest('hex');
  assert.equal(producerFingerprint, toolRows[0].sha256, 'Producer has changed since final writer receipt');
  inputFiles.push(...producerPaths);
  assert(inputFiles.length > 0, 'Writer receipt has no real source inputs');
  return { receipt: receiptPath, sha256: hash(receiptPath), generator: ledger.generator, treeRoot, producerRoot, producerFingerprint,
    inputs: inputs.sources, finalBytes: hashes, inputFiles };
}

export async function main(args = process.argv.slice(2)) {
  assert(!process.env.NODE_TEST_CONTEXT, 'NODE_TEST_CONTEXT forbids JVM execution');
  const opts = options(args);
  const source = opts['--source'];
  const oracle = opts['--oracle'];
  const mode = opts['--mode'];
  absolutePath(opts['--out'], '--out');
  assert(!present(opts['--out']), `Output must be absent (including symlinks): ${opts['--out']}`);
  const collected = collectInputs(source, oracle, mode);
  const evidence = mode === 'generated' ? generatedEvidence(source, opts['--source-receipt']) : null;
  const tools = offlineToolchain(opts['--java'], opts['--maven-cache'], opts['--protoc']);
  assert.deepEqual(snapshot(tools.includeHashes.map(row => row.path)), tools.includeHashes, 'Includes are not bound to current JAR bytes');
  const inputPaths = [...collected.sourcePaths, ...collected.oraclePaths, ...(evidence ? [evidence.receipt, ...evidence.inputFiles] : [])];
  const verifier = fileURLToPath(import.meta.url);
  const helper = fileURLToPath(new URL('../compiler-tools.mjs', import.meta.url));
  const processSources = ['process.mjs', 'files.mjs', 'callbacks.mjs'].map(name => fileURLToPath(new URL('../../../lib/verification/' + name, import.meta.url)))
    .concat(['immutable-data.mjs', 'strict-json.mjs'].map(name => fileURLToPath(new URL('../../../lib/' + name, import.meta.url))));
  const toolPaths = [...tools.paths, verifier, helper, ...processSources];
  const before = { inputs: snapshot([...new Set(inputPaths)]), toolchain: snapshot(toolPaths) };
  const io = privateOutput(opts['--out'], [source, oracle, tools.cache, tools.javaHome, dirname(verifier),
    ...(evidence ? [evidence.producerRoot, evidence.treeRoot] : []), ...inputPaths, ...toolPaths]);
  const session = compilerSession(io, tools);
  let failure;
  let stagedBefore;
  let managedBefore;
  let hashesUnchanged = false;
  let pairsPassed = 0;
  try {
    io.json('hashes-before.json', before);
    io.json('source-evidence.json', { mode, source, oracle, evidence, suites, oracleTests, sourceInventory, oracleInventory });
    io.json('toolchain.json', { java: tools.java, release: tools.release, protoc: tools.protoc, artifacts: tools.artifacts,
      compiler: tools.compiler, kernelTargetClasspath: [tools.library], plugin: tools.plugin, runtime: tools.runtime,
      testLibraries: tools.testLibraries, manifests: tools.manifests });
    const admitted = new Map(before.inputs.map(row => [row.path, row.sha256]));
    const stage = (path, target) => {
      const bytes = readFileSync(regular(path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), admitted.get(path), 'Staged bytes differ from admitted input: ' + path);
      return io.write(target, bytes);
    };
    const copied = new Map(collected.sourcePaths.map(path => [path, stage(path, join('inputs/source', relative(source, path)))]));
    const oracleCopied = new Map(collected.oraclePaths.map(path => [path, stage(path, join('inputs/oracle', relative(oracle, path)))]));
    const sourceSet = name => sourceInventory[name].map(path => copied.get(join(source, path)));
    const oraclePath = name => oracleCopied.get(join(oracle, name));
    stagedBefore = snapshot([...files(join(io.out, 'inputs')), ...files(join(io.out, 'includes')), ...files(join(io.out, 'tools'))]);
    io.json('staged-hashes-before.json', stagedBefore);
    await session.jvm('java-version', ['-version'], undefined);
    await session.protocVersion();
    const classes = Object.fromEntries(['kernel', 'pb', 'glue', 'oracle', ...(mode === 'generated' ? ['generated-test'] : [])]
      .map(name => [name, io.directory(`classes/${mode}/${name}`)]));
    await session.compile('kernel-production', sourceSet('kernel'), [tools.library], classes.kernel);
    const managed = io.directory(`managed/${mode}`);
    await session.generate('protoc-scalapb', join(io.out, 'inputs/source/modules/glue/src/main/protobuf'), sourceSet('proto'), managed);
    const managedSources = files(managed);
    assert(managedSources.length > 0 && managedSources.every(path => path.endsWith('.scala')), 'ScalaPB did not produce real managed Scala');
    assert(managedSources.every(path => within(path, join(managed, 'example/counter/protobuf'))), 'Unexpected ScalaPB package output');
    managedBefore = snapshot(managedSources);
    io.json('managed-hashes-before.json', managedBefore);
    await session.compile('pb-production', managedSources, tools.runtime, classes.pb);
    await session.compile('glue-production', sourceSet('glue'), [...tools.runtime, classes.kernel, classes.pb], classes.glue);
    const kernelCP = [tools.library, classes.kernel];
    for (const [name, file, symbol, diagnostics] of [
      ['host-missing-method', 'MissingMethod.scala', 'acceptedRatio', [/class MissingMethod needs to be abstract/, /acceptedRatio/]],
      ['host-wrong-output', 'WrongOutputType.scala', 'acceptedRatio', [/incompatible type in overriding|method acceptedRatio has incompatible type/, /acceptedRatio/]],
    ]) {
      await session.compile(`${name}-control`, [oraclePath('positive/ValidHost.scala')], kernelCP, io.directory(`classes/${mode}/${name}-control`));
      await session.compile(`${name}-negative`, [oraclePath(`negative/${file}`)], kernelCP, io.directory(`classes/${mode}/${name}-negative`),
        { kind: 'compiler-rejection', file, symbol, diagnostics });
      pairsPassed++;
    }
    const productionCP = [...new Set([...tools.testLibraries, ...tools.runtime, classes.kernel, classes.pb, classes.glue])];
    await session.compile('independent-oracle', [oraclePath('DomainKernelSpec.scala')], productionCP, classes.oracle);
    await session.jvm('independent-oracle-suites', ['-cp', [...productionCP, classes.oracle].join(delimiter), 'org.scalatest.tools.Runner',
      '-R', classes.oracle, '-oW', '-s', suites.oracle], { kind: 'suites', suites: [suites.oracle], tests: oracleTests.length, testNames: [...oracleTests] });
    if (mode === 'generated') {
      // Generated support tests are recorded/run separately, never used as the independent oracle.
      await session.compile('generated-tests', sourceSet('generatedTest'), productionCP, classes['generated-test']);
      await session.jvm('generated-test-suites', ['-cp', [...productionCP, classes['generated-test']].join(delimiter), 'org.scalatest.tools.Runner',
        '-R', classes['generated-test'], '-oW', '-s', suites.generated], { kind: 'suites', suites: [suites.generated], tests: 1 });
    }
  } catch (error) {
    failure = error.stack ?? String(error);
  } finally {
    try {
      const after = { inputs: snapshot([...new Set(inputPaths)]), toolchain: snapshot(toolPaths) };
      assert.deepEqual(files(source), collected.sourcePaths, 'Production input inventory changed');
      assert.deepEqual(files(oracle), collected.oraclePaths, 'Oracle inventory changed');
      io.json('hashes-after.json', after);
      assert.deepEqual(after, before, 'Inputs/toolchain changed during execution');
      if (stagedBefore) {
        const stagedAfter = snapshot([...files(join(io.out, 'inputs')), ...files(join(io.out, 'includes')), ...files(join(io.out, 'tools'))]);
        io.json('staged-hashes-after.json', stagedAfter);
        assert.deepEqual(stagedAfter, stagedBefore, 'Staged compiler sources/includes/launcher changed');
      }
      if (managedBefore) {
        const managedAfter = snapshot(files(join(io.out, 'managed', mode)));
        io.json('managed-hashes-after.json', managedAfter);
        assert.deepEqual(managedAfter, managedBefore, 'Real ScalaPB managed sources changed during compile');
      }
      if (evidence) assert.deepEqual(generatedEvidence(source, evidence.receipt), evidence, 'Writer source evidence changed');
      hashesUnchanged = true;
    } catch (error) {
      failure = [failure, error.stack ?? String(error)].filter(Boolean).join('\n');
    }
    const expectedPhases = mode === 'reference' ? 12 : 14;
    const passed = !failure && hashesUnchanged && pairsPassed === 2 && session.runs.length === expectedPhases && session.runs.every(run => run.accepted);
    const logs = present(join(io.out, 'logs')) ? snapshot(files(join(io.out, 'logs'))) : [];
    io.json('execution.json', { candidate: 'scala-cqrs-domain-kernel@1', mode, source, oracle, sourceEvidence: evidence,
      passed, failure: failure ?? null, hashesUnchanged, writeRoot: io.out, network: 'denied', timeoutMsPerPhase: 120000,
      expectedPhases, negativePairsDefined: 2, negativePairsPassed: pairsPassed,
      independentSuites: [suites.oracle], independentTests: oracleTests.length, generatedTests: mode === 'generated' ? 1 : 0,
      inputs: before.inputs, toolchain: before.toolchain, managedSources: managedBefore ?? [], logs, runs: session.runs,
      sbtExecuted: false, approval: null });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${join(io.out, 'execution.json')}`);
    if (!passed) process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url) && !process.env.NODE_TEST_CONTEXT) {
  try { await main(); } catch (error) { console.error(error.stack ?? String(error)); process.exitCode = 1; }
}
