// Explicit finite reference lane. Never imported by default Node test discovery.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { absolutePath, within, privateOutput, files, snapshot, hash, compilerSession } from '../compiler-tools.mjs';
import { actorToolchain, warehouseClasspaths } from '../aggregate-core/toolchain.mjs';
import { acquireFileLease } from '../../../lib/verification/lease.mjs';
import { inspectProcessEvidence } from '../../../lib/verification/process.mjs';
import { captureEvidenceFile } from '../../../lib/verification/files.mjs';
import { runtimeMutationAcceptance } from '../compiler-results.mjs';
import { runPersistenceControls } from './controls.mjs';
import { assertOracleLock } from './oracle-lock.mjs';
import { runGeneratedShapes, runFrameNamingControl } from './generated-cases.mjs';

if (!process.env.NODE_TEST_CONTEXT) {
assert(!process.env.NODE_TEST_CONTEXT, 'explicit opt-in verification only');
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../..');
const positional = [], flags = new Map(), args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith('--')) { positional.push(arg); continue; }
  assert(['--oracle-lock', '--oracle-lock-sha256'].includes(arg) && !flags.has(arg), 'Unknown or duplicate flag: ' + arg);
  const value = args[++i];
  assert(value && !value.startsWith('--'), 'Missing value for ' + arg);
  flags.set(arg, value);
}
const [round, out, runId, generationReceipt] = positional;
assert([3, 4].includes(positional.length) && round && out && /^[a-z0-9-]+$/.test(runId),
  'round, exclusive output and unique run ID required; optional generation receipt, mandatory --oracle-lock and --oracle-lock-sha256');
absolutePath(round, 'round'); absolutePath(out, 'exclusive output');
if (generationReceipt) absolutePath(generationReceipt, 'generation receipt');
// Fail before output creation, lease acquisition or compiler execution. No default
// lock, no live auto-capture and no silently refreshed pin are permitted.
const oracleLock = assertOracleLock(flags.get('--oracle-lock'), flags.get('--oracle-lock-sha256'));
const original = join(root, 'test/reference/aggregate-core');
const baseline = JSON.parse(readFileSync(join(round, 'offline-supply02.json')));
const javaHome = dirname(dirname(baseline.java.path));
// The earlier receipt also inventories tool source. Only immutable JVM/cache
// supply uses its old pins; current tool source is captured separately below.
const admitted = baseline.finiteSupplyFiles.filter(f => f.path.startsWith(javaHome + '/') ||
  f.path.startsWith(baseline.cache + '/') || f.path === '/usr/bin/sandbox-exec');
for (const f of admitted) assert.equal(hash(f.path), f.sha256, 'offline supply changed: ' + f.path);
const protoc = admitted.find(f => f.path.endsWith('/protoc-3.21.9-osx-x86_64.exe')).path;
const tools = actorToolchain(baseline.java.path, baseline.cache, protoc);
for (const path of tools.paths) assert(admitted.some(f => f.path === path), 'unadmitted compiler input ' + path);
const h2 = join(baseline.cache, 'com/h2database/h2/2.2.224/h2-2.2.224.jar');
assert.equal(hash(h2), 'b9d8f19358ada82a4f6eb5b174c6cfe320a375b5a9cb5a4fe456d623e6e55497');
const originals = [...files(join(original, 'project')), ...files(join(original, 'oracle')), join(original, 'oracle.lock.json')];
const oldPins = JSON.parse(readFileSync(join(round, 'baseline-files02.json'))).records;
for (const path of originals) { const pin = oldPins.find(f => f.path === path); assert(pin, path); assert.equal(hash(path), pin.sha256, path); }
let generated, verifyProject, productionToolRoot;
let mode = 'reference-core';
const boundary = {
  production: { kind: 'handwritten-reference', family2Root: join(original, 'project'), persistenceRoot: here },
  externalHarness: { root, reference: here, compiler: join(root, 'test/reference/compiler-tools.mjs'),
    compilerResults: join(root, 'test/reference/compiler-results.mjs'), toolchain: join(root, 'test/reference/aggregate-core/toolchain.mjs'),
    leaseAndProcess: join(root, 'lib/verification'), checkoutHarnessPermitted: true },
  checkoutProductionFallback: false,
};
if (generationReceipt) {
  generated = JSON.parse(readFileSync(generationReceipt));
  assert.equal(generated.schemaVersion, 'truthsrc.persistence-readside-generated-capture/v1');
  assert.equal(generated.passed, true); assert.equal(generated.targetProfile, 'scala-cqrs-persistence-readside@1');
  absolutePath(generated.out, 'captured output'); absolutePath(generated.project, 'captured project');
  assert.equal(realpathSync(generated.out), generated.out); assert.equal(realpathSync(generated.project), generated.project);
  assert(generated.installed === undefined || typeof generated.installed === 'boolean', 'Invalid installed receipt marker');
  if (generated.installed === true) {
    // A malformed/missing installed root is fatal. In particular, never import
    // checkout lib/project/verify.mjs to "help" an installed capture pass.
    absolutePath(generated.toolRoot, 'installed toolRoot');
    assert.equal(realpathSync(generated.toolRoot), generated.toolRoot);
    assert(!within(generated.toolRoot, root) && !within(root, generated.toolRoot), 'Installed package must be disjoint from checkout');
    assert(!within(generated.project, root) && !within(generated.out, root), 'Installed consumer must be outside checkout');
    productionToolRoot = generated.toolRoot;
    mode = 'installed-core';
  } else {
    assert(!generated.toolRoot || generated.toolRoot === root, 'An external toolRoot requires installed:true; no ambiguous checkout fallback');
    productionToolRoot = root;
    mode = 'generated-core';
  }
  assert(Array.isArray(generated.entries) && generated.entries.length > 0 && Array.isArray(generated.sourceInputs) && generated.sourceInputs.length > 0);
  assert.equal(new Set(generated.sourceInputs.map(f => f.path)).size, generated.sourceInputs.length, 'Repeated source input');
  assert.deepEqual(snapshot(generated.sourceInputs.map(f => f.path)), generated.sourceInputs, 'generated input drift');
  if (generated.installed) for (const input of generated.sourceInputs)
    assert(!within(input.path, root), 'Checkout production input leaked into installed receipt: ' + input.path);
  for (const entry of generated.entries) assert.equal(readFileSync(join(generated.out, entry.path), 'utf8'), entry.content);
  assert.deepEqual(snapshot(files(generated.out)), generated.generatedFiles, 'complete final writer membership differs');
  const verifierPath = join(productionToolRoot, 'lib/project/verify.mjs');
  const cliPath = join(productionToolRoot, 'lib/project/cli.mjs');
  for (const path of [verifierPath, cliPath])
    assert(generated.sourceInputs.some(input => input.path === path && input.sha256 === hash(path)), 'Production API is not pinned by capture: ' + path);
  ({ verifyProject } = await import(pathToFileURL(verifierPath).href));
  assert.equal(typeof verifyProject, 'function');
  const verification = verifyProject({ project: generated.project, out: generated.out });
  assert.equal(verification.passed, true, JSON.stringify(verification.diagnostics));
  boundary.production = { kind: generated.installed ? 'installed-package' : 'checkout-generator', toolRoot: productionToolRoot,
    verifier: verifierPath, verifierSha256: hash(verifierPath), generationEntry: cliPath,
    project: generated.project, generatedRoot: generated.out, verification };
}
const harnessInputs = ['compiler-tools.mjs', 'compiler-results.mjs', 'compiler-pom.mjs', 'jvm-toolchain.mjs']
  .map(file => join(root, 'test/reference', file));
const inputs = [...new Set([...tools.paths, h2, ...originals, ...files(here), oracleLock.path,
  ...(generated ? [generationReceipt, ...files(generated.out), ...generated.sourceInputs.map(f => f.path)] : []),
  ...files(join(root, 'lib/verification')), ...harnessInputs,
  join(root, 'test/reference/aggregate-core/toolchain.mjs')])];
const before = snapshot(inputs), index = join(root, '.git/index'), indexBefore = hash(index);
assert.equal(indexBefore, '96524d6b0877a1768a383c0c9e9a25118e16f85185918e11cc45a6a557d50d8e');
const capacity = statfsSync('/private/tmp');
assert(capacity.bavail * capacity.bsize >= 30 * 1024 ** 3, 'retain 20GiB work budget plus 10GiB reserve');
const raw = privateOutput(out, [root, baseline.cache, javaHome, oracleLock.path,
  ...(generated ? [productionToolRoot, generated.out, dirname(generated.project), generationReceipt] : [])]);
raw.json('inputs-before.json', before);
raw.json('oracle-lock-admitted.json', oracleLock);
raw.json('verification-boundary.json', boundary);
const io = { ...raw, write(name, bytes, mode) {
  if (name === 'sandbox.sb') bytes += `(deny file-write* (subpath ${JSON.stringify(join(out, 'logs'))}) (literal ${JSON.stringify(join(out, 'sandbox.sb'))}))\n`;
  return raw.write(name, bytes, mode);
} };
const processReferences = run => {
  assert.equal(run.accepted, true, 'Unaccepted compiler/oracle phase');
  if (run.exitCode === 0) return inspectProcessEvidence(run.lifecycle.slice(0, -5)).references;
  // Deliberate compiler/oracle rejection exits 1: the public success-only inspector
  // must reject it. Preserve that failed process receipt, validate its lifecycle
  // and bytes here, and keep the separately accepted exact negative-test outcome.
  assert.equal(run.exitCode, 1);
  assert(['compiler-rejection', 'suite-rejection'].includes(run.expected.kind));
  const captured = captureEvidenceFile(run.lifecycle), p = JSON.parse(Buffer.from(captured.value).toString('utf8'));
  assert.equal(p.schemaVersion, 'truthsrc.verified-process/v1');
  assert.equal(p.paths.receipt, run.lifecycle);
  assert.deepEqual([p.passed, p.status, p.code, p.signal, p.expectedSignal, p.expectedTermination], [false, 'failed', 1, null, null, false]);
  assert.deepEqual([p.timedOut, p.cancelled, p.launchError, p.outputError, p.outputLimitExceeded, p.leftoverGroup, p.groupAliveAfter,
    p.directChildClosed, p.directChildReaped, p.sandboxProfileUnchanged, p.terminationErrors, p.mainSignals, p.groupSignals],
    [false, null, null, false, false, false, false, true, true, true, [], [], []]);
  assert.deepEqual(p.barrier, { status: 'not-requested', settled: true, error: null });
  assert.deepEqual(p.command, run.command);
  const refs = [{ file: run.lifecycle, bytes: captured.bytes, sha256: captured.sha256 }];
  for (const [file, sha256] of [[p.sandboxProfile, p.sandboxProfileSha256], [p.paths.stdout, p.stdoutSha256], [p.paths.stderr, p.stderrSha256]]) {
    const evidence = captureEvidenceFile(file);
    assert.equal(evidence.sha256, sha256, 'Negative process evidence drift: ' + file);
    refs.push({ file, bytes: evidence.bytes, sha256 });
  }
  return refs;
};
let lease, session, result;
try {
  lease = await acquireFileLease({ registry: join(root, '.rounds/shared-jvm-leases'), lockNames: ['jvm-slot'], usedName: runId + '-used',
    record: { owner: 'persistence-readside-reference', pid: process.pid, runId, out } });
  io.json('lease-acquired.json', lease.record);
  session = compilerSession(io, tools, { suiteRejectionAcceptance: runtimeMutationAcceptance });
  const classes = Object.fromEntries(['kernel', 'pb', 'glue', 'oracle'].map(k => [k, io.directory('classes/' + k)]));
  const cp = warehouseClasspaths(tools, classes);
  const proto = io.directory('proto'), managed = io.directory('managed'), resources = io.directory('resources');
  const productionRoot = generated ? generated.out : join(original, 'project');
  const domainProto = join(productionRoot, 'modules/glue/src/main/protobuf/inventory_domain.proto');
  const frameProto = generated ? join(generated.out, 'modules/glue/src/main/protobuf/warehouse_persistence_frame.proto') : join(here, 'protobuf/warehouse_persistence_frame.proto');
  io.write('proto/inventory_domain.proto', readFileSync(domainProto));
  io.write('proto/warehouse_persistence_frame.proto', readFileSync(frameProto));
  io.write('resources/reference.conf', readFileSync(generated ? join(generated.out, 'modules/glue/src/main/resources/reference.conf') : join(here, 'resources/reference.conf')));
  await session.generate('proto', proto, files(proto), managed);
  await session.compile('kernel', files(join(productionRoot, 'modules/kernel/src/main/scala')), cp.kernel, classes.kernel);
  await session.compile('protobuf', files(managed).filter(p => p.endsWith('.scala')), cp.pb, classes.pb);
  await session.compile('glue', [...files(join(productionRoot, 'modules/glue/src/main/scala')), ...(generated ? [] : files(join(here, 'scala')))], [...cp.glue, h2], classes.glue);
  const generatedShapes = generated ? await runGeneratedShapes({ io, session, source: generated.out, entries: generated.entries, cp, h2, resources }) : null;
  const testsCp = [...cp.tests, h2, resources];
  await session.compile('oracle', files(join(here, 'oracle')).filter(p => p.endsWith('.scala')), testsCp, classes.oracle);
  const packageName = 'example.inventory.persistencereadside.reference';
  // Fixed independent test names, not extracted from runtime output to fit a count.
  const names = [
    'real SerializationExtension selects the finite registry and rejects versions roles manifests and malformed frames',
    'real Factory persists Frames and recovers snapshot and ordered events without rerunning hosts',
    'direct SQL proves event state receipt checkpoint atomicity and reserve progress',
    'precommit failure rolls back all four tables and postcommit lost acknowledgement retries without writes',
    'exact duplicate conflict gap and resource reassociation reject without advancing',
    'two PID two namespace isolation and full keyset pagination preserve equal map keys',
    'sessions are callback and thread confined and every connection closes on failure',
    'existing schema and compatibility identity drift refuse instead of migrating',
    'coalesced catchup drains already accepted later pages and preserves caller resources',
    'source poison failure is observable and never skips checkpoint',
    'runner admission is bounded and shutdown timeout cannot report drained',
  ];
  const suite = packageName + '.PersistenceReadsideSpec';
  const runtime = [...testsCp, classes.oracle].join(delimiter);
  await session.jvm('independent-oracle', ['-cp', runtime, 'org.scalatest.tools.Runner', '-R', classes.oracle, '-oW', '-s', suite],
    { kind: 'suites', suites: [suite], tests: names.length, testNames: names });
  const boundarySuite = packageName + '.ReadsideBoundarySpec';
  const boundaryNames = ['case insensitive H2 comparison is refused before namespaces can alias',
    'metadata patterns do not confuse unrelated underscore matching tables',
    'retained session is invalid before driver commit hook runs'];
  await session.jvm('review-boundaries', ['-cp', runtime, 'org.scalatest.tools.Runner', '-R', classes.oracle, '-oW', '-s', boundarySuite],
    { kind: 'suites', suites: [boundarySuite], tests: boundaryNames.length, testNames: boundaryNames });
  const database = io.directory('databases');
  await session.jvm('file-write-a', ['-cp', runtime, packageName + '.FileReplay', 'a', database],
    { kind: 'success', pattern: /JVM_A_PERSISTED_SOURCE_AND_PREFIX/ });
  const afterA = snapshot(files(database)); io.json('database-after-a.json', afterA);
  assert(afterA.some(f => f.path.endsWith('source.mv.db')) && afterA.some(f => f.path.endsWith('old.mv.db')));
  await session.jvm('file-reopen-b', ['-cp', runtime, packageName + '.FileReplay', 'b', database],
    { kind: 'success', pattern: /JVM_B_REOPEN_RESUME_AND_NEW_TARGET_VERIFIED/ });
  const afterB = snapshot(files(database)); io.json('database-after-b.json', afterB);
  assert(afterB.some(f => f.path.endsWith('new.mv.db')));
  const controls = generated ? await runPersistenceControls({ io, session, generated, cp, h2, resources, classes }) : null;
  const frameNamingControl = generated ? await runFrameNamingControl({ io, session, tools, h2, toolRoot: productionToolRoot, verifyProject }) : null;
  assert.deepEqual(assertOracleLock(oracleLock.path, oracleLock.sha256), oracleLock, 'Reviewed oracle lock changed during execution');
  assert.deepEqual(snapshot(inputs), before, 'reference/toolchain changed during verification');
  if (generated) assert.deepEqual(snapshot(files(generated.out)), generated.generatedFiles, 'Final writer membership changed during verification');
  assert.equal(hash(index), indexBefore, 'JS index drift');
  result = { passed: true, mode, tests: names.length + boundaryNames.length, dualJvmFileReplay: true,
    independentOracle: { tests: names.length + boundaryNames.length,
      suites: [{ suite, testNames: names }, { suite: boundarySuite, testNames: boundaryNames }] },
    testCounts: { independentOracle: names.length + boundaryNames.length, generatedShapes: generatedShapes?.tests ?? 0,
      renamedShapes: frameNamingControl?.generatedShapes.tests ?? 0, runtimeControlPositives: controls?.positiveRuntimeTests ?? 0,
      expectedRuntimeRejections: controls?.expectedRuntimeRejections ?? 0, compilerPositiveControls: controls?.compilerPositiveControls.length ?? 0,
      compilerNegativeControls: controls?.compilerControls.length ?? 0, renamedAbiCompilerPositive: frameNamingControl ? 1 : 0 },
    runs: session.runs, controls, generatedShapes, frameNamingControl, boundary, oracleLock, inputUnchanged: true, indexUnchanged: true,
    evidence: session.runs.flatMap(processReferences),
    pending: [generated ? 'other source-mode receipts are not certified by this run' : 'generated/installed shape, naming and control lanes',
      'full regression/current observations'], productionJournalQualified: false };
} catch (error) {
  result = { passed: false, mode, boundary, oracleLock,
    error: { name: error.name, message: error.message, stack: error.stack }, runs: session?.runs ?? [] };
  process.exitCode = 1;
} finally {
  if (lease) { lease.release(); io.json('lease-released.json', { runId, released: true }); }
}
io.json('inputs-after.json', snapshot(inputs));
io.json('result.json', result);
writeFileSync(join(round, runId + '-result.json'), JSON.stringify({ ...result, out }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ passed: result.passed, tests: result.tests, testCounts: result.testCounts, out, error: result.error }));
}
