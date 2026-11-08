import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { options, disjoint, expectedSourcePaths, validateInventory, sourceInventory, metadataInventory,
  managedInventory, managedMessages, validateManagedSource, writerInventory, writer, kindFor, checkWriterRecords, producerProof, pinBytes,
  stagePinned, validateSuiteSource, validateOracleBytes, runtimeMutationAcceptance, extendLogPins, preflight, collectProductionInputs,
  oracleContract, repositoryLoops, fixedPhasePlan, validatePhaseResults, mutationBytes, compilerControlClasspath,
  executionGates, assertExecutionReady, main } from './reference/aggregate-core/verify.mjs';
import { actorArtifacts, actorParents, actorResources, artifactStem, declaredPom, admitPomClosure,
  actorToolchain, warehouseClasspaths } from './reference/aggregate-core/toolchain.mjs';
import { acceptance, compilerSession, files, hash, snapshot } from './reference/compiler-tools.mjs';
import { captureProject, projectPlan } from '../lib/project/cli.mjs';
import { buildModels } from '../generators/scala-cqrs-aggregate-core-v1/build-models.mjs';
import { generatedTestArtifacts } from '../generators/scala-cqrs-domain-kernel-v1/templates/generated-tests.mjs';
import { emittedKinds } from '../lib/artifact-docs/vocabulary.mjs';

// Pure/readonly Node tests only: no spawn, native/JVM, temp fixtures or cleanup.
const cache = '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2';
const java = '/Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk/Contents/Home/bin/java';
const protoc = join(cache, 'com/google/protobuf/protoc/3.21.9/protoc-3.21.9-osx-x86_64.exe');
const verifier = fileURLToPath(new URL('./reference/aggregate-core/verify.mjs', import.meta.url));
const explicit = ['--java', java, '--maven-cache', cache, '--protoc', protoc,
  '--source', '/finite/source', '--oracle', '/finite/oracle', '--out', '/private/tmp/finite-aggregate-out', '--mode', 'reference'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readonlySources = [verifier, fileURLToPath(import.meta.url),
  fileURLToPath(new URL('./reference/aggregate-core/toolchain.mjs', import.meta.url)),
  fileURLToPath(new URL('./reference/compiler-tools.mjs', import.meta.url)),
  fileURLToPath(new URL('./reference/aggregate-core/oracle.lock.json', import.meta.url)),
];
const reference = fileURLToPath(new URL('./reference/aggregate-core/project', import.meta.url));
const oracle = fileURLToPath(new URL('./reference/aggregate-core/oracle', import.meta.url));
const project = fileURLToPath(new URL('../scaffold/aggregate-core-project/truthsrc.project.json', import.meta.url));
const pbRacePath = join(oracle, 'PbRoundtripSpec.scala');
const independentInputPaths = [...files(reference), ...files(oracle)];
validateInventory(files(oracle).map(path => relative(oracle, path)), oracleContract.files, 'oracle');
const pbBefore = snapshot([pbRacePath]);
const sourcePins = snapshot([...readonlySources, ...independentInputPaths.filter(path => path !== pbRacePath)]);
test.after(() => {
  validateInventory(files(oracle).map(path => relative(oracle, path)), oracleContract.files, 'oracle');
  validateInventory(files(reference).map(path => relative(reference, path)), expectedSourcePaths('reference'), 'source');
  const after = snapshot([...readonlySources, ...independentInputPaths.filter(path => path !== pbRacePath)]);
  assert.deepEqual(after, sourcePins, 'Node contract tests mutated verifier/shared helper/historical/independent stable inputs');
  console.log('STATIC-SOURCE-HASHES ' + JSON.stringify({ before: sourcePins, after }));
  const pbAfter = snapshot([pbRacePath]);
  assert.deepEqual(pbAfter, pbBefore, 'Independent PB oracle changed during this test run');
  console.log('STATIC-PB-ORACLE ' + JSON.stringify({ before: pbBefore, after: pbAfter, expectedFromLogs: false }));
});

test('runtime acceptance descriptors are separate from final-writer artifact vocabulary', () => {
  assert.deepEqual(emittedKinds('test/reference/aggregate-core/verify.mjs', readFileSync(verifier, 'utf8')), { kinds: [], dynamic: [] });
  for (const mode of ['reference', 'generated']) {
    const plan = fixedPhasePlan(mode);
    assert.deepEqual(plan[0], { label: 'java-version', kind: 'success', pattern: 'version "11\\.' });
    assert.deepEqual(plan[1], { label: 'protoc-version', kind: 'success', pattern: '^libprotoc 3\\.21\\.9\\s*$' });
    const suites = plan.find(row => row.label === 'independent-oracle-suites');
    assert.equal(suites.kind, 'suites');
    assert.equal(suites.tests, 35);
    assert.deepEqual(suites.suites, oracleContract.suites.map(row => row.suite));
    assert.deepEqual(suites.testNames, oracleContract.suites.flatMap(row => row.testNames));
  }
});

test('CLI admits only the fixed path flags and two modes', () => {
  assert.equal(options(explicit)['--mode'], 'reference');
  assert.equal(options([...explicit.slice(0, -1), 'generated', '--source-receipt', '/finite/receipt.json'])['--mode'], 'generated');
  for (const args of [[], ['--help'], ['--java'], ['--java', 'relative'], ['--mode', 'other'],
    ['--java', '/one', '--java', '/two'], ['--java', '/tmp/../other'], ['--protoc', '/tmp/a:b'], ['--java', '/tmp/line\nbreak'],
    [...explicit, '--source-receipt', '/receipt'], [...explicit.slice(0, -1), 'generated'], [...explicit, '--source-glob', '*.scala'],
    [...explicit, '--command', '/bin/sh'], [...explicit, '--timeout', '999999'], [...explicit, '--mode', 'reference']]) assert.throws(() => options(args));
});

test('source/oracle/output boundary uses ancestry, not mere path prefixes', () => {
  assert.throws(() => disjoint('/a/source', '/a/source', 'Source and oracle'), /disjoint/);
  assert.throws(() => disjoint('/a/source', '/a/source/oracle', 'Source and oracle'), /disjoint/);
  assert.throws(() => disjoint('/a/source/out', '/a/source', 'Output and source'), /disjoint/);
  disjoint('/a/source', '/a/source-copy', 'Source and oracle');
  assert.throws(() => disjoint('/a/../source', '/a/oracle', 'Source and oracle'), /normalized/);
});

test('finite Warehouse inventory covers every kernel/glue/proto/build artifact and no whole-test wildcard', () => {
  assert.equal(sourceInventory.kernel.length, 11);
  assert.equal(sourceInventory.glue.length, 7);
  assert.equal(expectedSourcePaths('reference').length, 22);
  assert.equal(expectedSourcePaths('generated').length, 30);
  assert.equal(writerInventory.length, 28);
  assert.equal(new Set(expectedSourcePaths('generated')).size, expectedSourcePaths('generated').length);
  for (const path of [...sourceInventory.kernel, ...sourceInventory.glue]) assert(path.endsWith('.scala') && path.includes('/src/main/scala/'));
  assert(!expectedSourcePaths('reference').some(path => /oracle|adapter|src\/test|ExactValueCodecs/.test(path)));
  validateInventory(expectedSourcePaths('reference'), expectedSourcePaths('reference'), 'source');
  for (const actual of [expectedSourcePaths('reference').slice(1),
    [...expectedSourcePaths('reference'), 'modules/glue/src/main/scala/example/inventory/protobuf/Fake.scala'],
    [...expectedSourcePaths('reference'), 'oracle/PureDecisionSpec.scala'],
    [...expectedSourcePaths('reference'), sourceInventory.kernel[0]]]) assert.throws(() => validateInventory(actual, expectedSourcePaths('reference'), 'source'), /finite source inventory/);
  assert.deepEqual(metadataInventory.slice(-2), ['truthsrc.ledger.json', 'anchors.json']);
  assert.equal(managedInventory.length, 1);
  assert.equal(managedMessages.length, 9);
  assert.match(readFileSync(join(reference, sourceInventory.proto[0]), 'utf8'), /single_file: true/);
  const managed = 'package example.inventory.protobuf\n' + managedMessages.map(name => 'final case class ' + name + '(\n)\n').join('') +
    'object InventoryDomainProto extends _root_.scalapb.GeneratedFileObject\n';
  validateManagedSource(managed);
  assert.throws(() => validateManagedSource(managed.replace('final case class TxIdValue(', 'final case class Other(')));
  assert.throws(() => validateManagedSource(managed + 'final case class Unlisted(\n)\n'));
});

test('every finite writer entry has its own exact Warehouse artifact kind', () => {
  const kinds = writerInventory.map(kindFor);
  for (const kind of ['value-object', 'state', 'protocol', 'computation-port', 'rule-parameters', 'rules', 'command-helpers', 'event-handler',
    'actor-protocol', 'aggregate', 'aggregate-factory', 'aggregate-bootstrap', 'actor-repository', 'actor-repository-implementation',
    'converter', 'proto', 'build', 'generated-test', 'project-evidence']) assert(kinds.includes(kind), kind);
  assert.throws(() => kindFor('modules/kernel/src/main/scala/example/counter/domain/CounterState.scala'), /Unknown finite artifact/);
  assert.throws(() => kindFor('truthsrc.ledger.json'), /no final-writer kind/);
});

function writerData() {
  // Detached mechanical boundary only; these are NOT execution/source receipts.
  const source = '/finite/generated', owner = '/finite/author/truthsrc.project.json';
  const pins = writerInventory.map(path => ({ path, sha256: sha(Buffer.from(path)) }));
  const sources = [{ role: 'project', file: owner, bytes: 2, sha256: sha('{}') },
    { role: 'tree', file: '/finite/author/system.yaml', bytes: 6, sha256: sha('id: x\n') },
    { role: 'tool', root: '/finite/tool/', sha256: sha('detached unit input') }];
  const inputs = { sources, generatedFiles: writerInventory.filter(path => !path.startsWith('.truthsrc/')) };
  const ledger = { generator: writer, entries: pins.map(row => ({ path: row.path, kind: kindFor(row.path),
    ownership: { id: owner, generator: writer, fingerprint: `sha256:${row.sha256}` } })) };
  const receipt = { schemaVersion: 'truthsrc.project-result/v1', applied: true, sources,
    result: { name: writer, total: pins.length, ledger: join(source, 'truthsrc.ledger.json'), anchors: join(source, 'anchors.json'),
      actions: pins.map(row => ({ path: row.path, kind: kindFor(row.path), outcome: 'ADD', fingerprint: `sha256:${row.sha256}` })) } };
  return { source, owner, receipt, ledger, inputs, pins };
}
const check = f => checkWriterRecords(f.source, f.receipt, f.ledger, f.inputs, f.pins);

test('generated byte records bind the whole-file set, fixed producer, owner, kind and exact hashes', () => {
  const fixture = writerData(); assert.equal(check(fixture), fixture.owner);
  for (const mutate of [
    f => { f.receipt.applied = false; }, f => { f.receipt.schemaVersion = 'invented'; },
    f => { f.receipt.result.name = 'scala-cqrs-domain-kernel'; }, f => { f.ledger.generator = 'scala-cqrs-domain-kernel'; },
    f => { f.receipt.result.ledger = '/other/truthsrc.ledger.json'; }, f => { f.receipt.result.anchors = '/other/anchors.json'; },
    f => { f.receipt.result.total--; }, f => { f.ledger.entries.pop(); }, f => { f.receipt.result.actions.pop(); },
    f => { f.ledger.entries.push(structuredClone(f.ledger.entries[0])); }, f => { f.inputs.generatedFiles.pop(); },
    f => { f.inputs.generatedFiles.push('oracle/Copied.scala'); }, f => { f.receipt.sources = []; },
    f => { f.inputs.sources.push(structuredClone(f.inputs.sources[0])); },
    f => { f.ledger.entries[0].ownership.id = '/other/project.json'; }, f => { f.ledger.entries[0].ownership.generator = 'other'; },
    f => { f.ledger.entries[0].kind = 'state'; }, f => { f.receipt.result.actions[0].kind = 'state'; },
    f => { f.ledger.entries[0].ownership.fingerprint = 'sha256:' + '0'.repeat(64); },
    f => { f.receipt.result.actions[0].fingerprint = 'sha256:' + '0'.repeat(64); },
    f => { f.receipt.result.actions[0].outcome = 'KEEP'; }, f => { f.pins[0].sha256 = '1'.repeat(64); },
    f => { f.pins.push(structuredClone(f.pins[0])); },
  ]) { const f = writerData(); mutate(f); assert.throws(() => check(f)); }
});

test('producer proof preserves real writer ordering and both recorded-root conventions', () => {
  const pins = [{ path: '/producer/src/a', sha256: sha('a') }, { path: '/producer/lib/z', sha256: sha('z') }];
  const ordered = [...pins].reverse();
  for (const root of ['/producer', '/producer/']) {
    assert.equal(producerProof(root, pins), sha(JSON.stringify(ordered.map(row => [row.path.slice(root.length), row.sha256])) + '\n'));
    assert.notEqual(producerProof(root, [...pins, { path: '/producer/schema/extra', sha256: sha('extra') }]), producerProof(root, pins));
    assert.notEqual(producerProof(root, [{ ...pins[0], sha256: sha('changed') }, pins[1]]), producerProof(root, pins));
  }
  assert.throws(() => producerProof('/producer/', [pins[0], pins[0]]), /unique/);
  assert.throws(() => producerProof('/producer/', [{ path: '/other/a', sha256: sha('a') }]), /Invalid producer/);
  assert.throws(() => producerProof('/producer/', [{ path: '/producer/a', sha256: 'not-a-hash' }]), /Invalid producer/);
});

test('staging checks a single Buffer against its admission pin before writing that same Buffer', () => {
  const bytes = Buffer.from('warehouse\n');
  assert.equal(pinBytes(bytes, sha(bytes), 'warehouse'), bytes);
  assert.throws(() => pinBytes(bytes, sha('changed'), 'warehouse'), /Staged bytes differ/);
  assert.throws(() => pinBytes('warehouse', sha(bytes), 'warehouse'), /Buffer/);
  let captured;
  const io = { write: (name, buffer) => { captured = { name, buffer }; return name; } };
  assert.equal(stagePinned(io, verifier, 'inputs/verifier', new Map([[verifier, hash(verifier)]])), 'inputs/verifier');
  assert.equal(sha(captured.buffer), hash(verifier));
  captured = undefined;
  assert.throws(() => stagePinned(io, verifier, 'inputs/verifier', new Map([[verifier, sha('wrong')]])), /Staged bytes differ/);
  assert.equal(captured, undefined);
});

test('independent suite names are fixed before logs and nonliteral extra tests reject', () => {
  const expected = { suite: 'example.inventory.oracle.UnitSpec', testNames: ['first case', 'second case'] };
  const text = 'package example.inventory.oracle\nfinal class UnitSpec extends AnyFunSuite {\n  test("first case") {\n  }\n  test("second case") {\n  }\n}\n';
  validateSuiteSource(text, expected);
  for (const changed of [text.replace('first case', 'drift'), text.replace('oracle', 'copied'), text.replace('UnitSpec', 'OtherSpec'),
    text + '\n  test(dynamic) { }\n', text.replace('  test("second case")', '   test("second case")')]) assert.throws(() => validateSuiteSource(changed, expected));
  assert.throws(() => validateSuiteSource(text, { ...expected, testNames: [] }), /Fixed unique/);
});

test('read-only preflight rejects existing output, source-oracle nesting and non-Warehouse input inventory', () => {
  const opts = options(explicit);
  assert.throws(() => preflight({ ...opts, '--out': verifier }), /Output must be absent/);
  assert.throws(() => preflight({ ...opts, '--oracle': '/finite/source/oracle' }), /disjoint/);
  assert.throws(() => preflight({ ...opts, '--mode': 'generated', '--source-receipt': '/finite/oracle/receipt.json' }), /outside independent oracle/);
  // The immutable old family1 source tree is only read; it cannot fit this inventory.
  const counter = fileURLToPath(new URL('./reference/domain-kernel/project', import.meta.url));
  assert.throws(() => collectProductionInputs(counter, 'reference'), /finite source inventory/);
});

test('log byte pins reject deletion, mutation and duplicate paths while admitting only new phase logs', () => {
  const first = [{ path: '/exclusive/logs/01.stdout.log', sha256: sha('first') }];
  const added = [...first, { path: '/exclusive/logs/02.stdout.log', sha256: sha('next') }];
  assert.deepEqual(extendLogPins(first, added), added);
  assert.notEqual(extendLogPins(first, added)[0], first[0]);
  assert.throws(() => extendLogPins(first, []), /changed or disappeared/);
  assert.throws(() => extendLogPins(first, [{ ...first[0], sha256: sha('mutated') }]), /changed or disappeared/);
  assert.throws(() => extendLogPins(first, [...first, first[0]]), /Duplicate log/);
});

test('finite independent and generated inventories are frozen before any execution', () => {
  assert.equal(oracleContract.status, 'ready');
  assert.equal(oracleContract.mechanics, 'ready');
  assert.equal(oracleContract.files.length, 17);
  assert.equal(oracleContract.suites.length, 5);
  assert.deepEqual(oracleContract.suites.map(suite => suite.testNames.length), [6, 5, 3, 15, 6]);
  assert.equal(oracleContract.suites.flatMap(suite => suite.testNames).length, 35);
  assert.equal(oracleContract.generatedSuites.length, 2);
  assert.equal(oracleContract.positiveControls.length, 2);
  assert.equal(oracleContract.compilerControls.length, 8);
  assert.equal(oracleContract.runtimeControls.length, 3);
  assert.match(oracleContract.deferredControl, /CounterOps[\s\S]*NOT that control/);
  assert.deepEqual(executionGates, []);
  assertExecutionReady();
});

test('default Node discovery and shared compilerSession guard forbid native/JVM execution', async () => {
  await assert.rejects(main(explicit), /NODE_TEST_CONTEXT/);
  const text = readFileSync(verifier, 'utf8');
  assert.match(text, /if \(process\.argv\[1\] === fileURLToPath\(import\.meta\.url\) && !process\.env\.NODE_TEST_CONTEXT\)/);
  // compilerSession may stage in the real lane; here the IO is entirely in memory.
  const io = { out: '/virtual/only', directory: name => '/virtual/only/' + name, write: name => '/virtual/only/' + name };
  const session = compilerSession(io, { java, protoc, javaHome: '/virtual/java', sandbox: '/usr/bin/sandbox-exec', compiler: [], plugin: [], includes: new Map() });
  assert.throws(() => session.jvm('blocked', ['-version']), /NODE_TEST_CONTEXT/);
  assert.throws(() => session.compile('blocked-compile', [], [], '/virtual/classes'), /NODE_TEST_CONTEXT/);
  assert.equal(session.runs.length, 0);
});

test('Akka supply is finite public Maven coordinates with actual transitive dependencies', () => {
  assert.equal(actorArtifacts.length, 24);
  assert.equal(actorArtifacts.filter(row => row.coordinate.startsWith('com.typesafe.akka:')).length, 14);
  assert.equal(actorArtifacts.filter(row => row.lane === 'test').length, 5);
  const coords = actorArtifacts.map(row => row.coordinate);
  for (const coordinate of ['com.typesafe.akka:akka-remote_2.13:2.6.20', 'com.typesafe.akka:akka-stream-typed_2.13:2.6.20',
    'com.typesafe.akka:akka-pki_2.13:2.6.20', 'org.agrona:agrona:1.15.1', 'com.hierynomus:asn-one:0.5.0']) assert(coords.includes(coordinate));
  assert(!coords.some(coordinate => /net\.imadz|bank|aeron|netty|leveldb|jackson|cluster/.test(coordinate)));
  assert.equal(new Set(coords).size, coords.length);
  assert.equal(actorParents.length, 2);
  assert.equal(actorResources.length, 12);
  assert(actorResources.some(row => row.member === 'akka/remote/serialization/WrappedPayloadSupport.class'));
  assert.equal(artifactStem(cache, coords[0]), join(cache, 'com/typesafe/akka/akka-actor_2.13/2.6.20/akka-actor_2.13-2.6.20'));
  for (const coordinate of ['net:../escape:1', 'g:a:*', 'g:a:1:classifier', 'g:a:${version}']) assert.throws(() => artifactStem(cache, coordinate));
});

const pom = dependencies => '<project><groupId>com.typesafe.akka</groupId><artifactId>akka-actor_2.13</artifactId><version>2.6.20</version>' + dependencies + '</project>';
const dep = (group, artifact, version, extra = '') => `<dependency><groupId>${group}</groupId><artifactId>${artifact}</artifactId><version>${version}</version>${extra}</dependency>`;

test('limited POM reader excludes build/test/optional surfaces and rejects entities/unclosed supply', () => {
  const parsed = declaredPom(pom('<dependencies>' + dep('org.scala-lang', 'scala-library', '2.13.8') +
    dep('unprovided', 'upstream-test', '1', '<scope>test</scope>') + dep('unprovided', 'optional', '1', '<optional>true</optional>') + '</dependencies>' +
    '<build><plugins><plugin><dependencies>' + dep('unprovided', 'build-plugin', '1') + '</dependencies></plugin></plugins></build>'));
  assert.equal(parsed.dependencies.length, 3);
  assert.deepEqual(admitPomClosure([parsed], [parsed.coordinate, 'org.scala-lang:scala-library:2.13.14']), [
    { from: parsed.coordinate, requested: 'org.scala-lang:scala-library:2.13.8', selected: 'org.scala-lang:scala-library:2.13.14', scope: 'compile' },
  ]);
  assert.throws(() => declaredPom('<!DOCTYPE project>' + pom('')), /entity\/DTD/);
  assert.throws(() => declaredPom(pom('<dependencies></dependencies><dependencies></dependencies>')), /Multiple/);
  assert.throws(() => admitPomClosure([parsed], [parsed.coordinate]), /Missing finite POM/);
  const unknown = declaredPom(pom('<dependencies>' + dep('unprovided', 'runtime', '1') + '</dependencies>'));
  assert.throws(() => admitPomClosure([unknown], [unknown.coordinate]), /Missing finite POM/);
  const unresolved = declaredPom(pom('<dependencies>' + dep('org.scala-lang', 'scala-library', '${unknown}') + '</dependencies>'));
  assert.throws(() => admitPomClosure([unresolved], [unresolved.coordinate]), /Unresolved POM/);
});

test('POM exclusion nodes do not turn the remote PKI dependency into a second identity', () => {
  const xml = pom('<dependencies>' + dep('com.hierynomus', 'asn-one', '0.5.0',
    '<exclusions><exclusion><groupId>org.slf4j</groupId><artifactId>slf4j-api</artifactId></exclusion></exclusions>') + '</dependencies>');
  const parsed = declaredPom(xml);
  assert.equal(parsed.dependencies[0].group, 'com.hierynomus');
  assert.equal(parsed.dependencies[0].artifact, 'asn-one');
  assert.equal(admitPomClosure([parsed], [parsed.coordinate, 'com.hierynomus:asn-one:0.5.0']).length, 1);
});

test('real local JDK/ScalaPB/ScalaTest/Akka JAR-POM-resource supply is read-only and standard-library kernel only', { skip: ![java, cache, protoc, '/usr/bin/sandbox-exec'].every(existsSync) }, () => {
  const tools = actorToolchain(java, cache, protoc);
  assert.equal(tools.artifacts.length, 44);
  assert(tools.jvmFiles.includes(join(tools.javaHome, 'lib/modules')));
  assert(tools.jvmFiles.includes(join(tools.javaHome, 'lib/server/libjvm.dylib')));
  assert(tools.jvmFiles.some(path => path.includes('/conf/')));
  assert.equal(tools.parents.length, 2);
  assert.deepEqual(tools.kernelTargetClasspath, [tools.library]);
  assert.equal(tools.actorLibraries.length, 19);
  assert.equal(tools.actorTestLibraries.length, 5);
  assert(tools.runtime.some(path => path.endsWith('scalapb-runtime_2.13-0.11.14.jar')));
  assert(tools.testLibraries.some(path => path.endsWith('scalatest-core_2.13-3.2.15.jar')));
  assert(!tools.actorLibraries.some(path => /scalatest|scalactic|testkit|logback|compiler|scala-reflect/.test(path)));
  assert.equal(tools.resources.length, 12);
  assert(tools.resources.every(row => /^[a-f0-9]{64}$/.test(row.sha256) && row.bytes > 0));
  assert.deepEqual(snapshot(tools.paths), tools.supplyHashes);
  assert.deepEqual(snapshot(tools.includeHashes.map(row => row.path)), tools.includeHashes);
  assert(tools.pomClosure.some(row => row.from.includes('persistence-typed') && row.selected.includes('akka-remote')));
  assert(tools.pomClosure.some(row => row.from.includes('akka-pki') && row.selected.includes('asn-one')));
  assert(tools.pomClosure.some(row => row.from.includes('akka-remote') && row.selected.includes('agrona')));
  // Evidence printed into the caller-owned verifier log, never into another file.
  console.log('STATIC-SUPPLY ' + JSON.stringify({ artifacts: tools.artifacts.map(row => row.coordinate), parents: tools.parents,
    resources: tools.resources, hashes: tools.supplyHashes, pomClosure: tools.pomClosure, jvmExecuted: false }));
});

const compilerExpected = { kind: 'compiler-rejection', file: 'MissingHost.scala', symbol: 'reservationIdentity', diagnostics: [/needs to be abstract/, /reservationIdentity/] };
const compilerRed = { status: 1, signal: null, stdout: '', stderr: '/finite/MissingHost.scala:7: error: class MissingHost needs to be abstract\nMissing implementation: reservationIdentity\n1 error\n' };

test('compiler negative control needs clean exit one and its specific source/member diagnostics', () => {
  assert(acceptance(compilerRed, compilerExpected).accepted);
  for (const changed of [{ ...compilerRed, status: 2 }, { ...compilerRed, status: 0 }, { ...compilerRed, status: null, signal: 'SIGKILL' },
    { ...compilerRed, error: { code: 'ETIMEDOUT' } }, { ...compilerRed, stderr: compilerRed.stderr + 'NoClassDefFoundError: akka/remote/X' },
    { ...compilerRed, stderr: compilerRed.stderr.replaceAll('MissingHost.scala', 'Other.scala') },
    { ...compilerRed, stderr: compilerRed.stderr.replaceAll('reservationIdentity', 'other') }, { ...compilerRed, stderr: 'arbitrary exit one' }]) assert(!acceptance(changed, compilerExpected).accepted);
});

const mutationExpected = { kind: 'suite-rejection', suite: 'example.inventory.oracle.UnitSpec',
  testNames: ['before ACK no Accepted', 'successful ACK matches state'], failedTestName: 'before ACK no Accepted', diagnostic: /unexpected Accepted before journal ACK \(ReplyOrderingSpec\.scala:44\)/ };
const mutationRed = { status: 1, signal: null, stdout: 'Run starting. Expected test count is: 2\nUnitSpec:\n' +
  '- before ACK no Accepted *** FAILED ***\n  unexpected Accepted before journal ACK (ReplyOrderingSpec.scala:44)\n' +
  '- successful ACK matches state\nRun completed in 1 second.\nTotal number of tests run: 2\nSuites: completed 1, aborted 0\n' +
  'Tests: succeeded 1, failed 1, canceled 0, ignored 0, pending 0\n*** 1 TEST FAILED ***\n', stderr: '' };

test('runtime mutation proposal requires the named assertion failure and all exact suite/case/count barriers', () => {
  assert(runtimeMutationAcceptance(mutationRed, mutationExpected).accepted);
  for (const changed of [{ ...mutationRed, status: 0 }, { ...mutationRed, status: 2 }, { ...mutationRed, status: null, signal: 'SIGKILL' },
    { ...mutationRed, error: { code: 'ETIMEDOUT' } }, { ...mutationRed, stderr: 'Operation not permitted' },
    { ...mutationRed, stderr: 'NoClassDefFoundError: akka/remote/WrappedPayloadSupport' },
    ...['UnitSpec:', 'unexpected Accepted before journal ACK', 'before ACK no Accepted *** FAILED ***', 'Expected test count is: 2',
      'Total number of tests run: 2', 'Suites: completed 1, aborted 0', 'canceled 0', 'ignored 0', 'pending 0', '*** 1 TEST FAILED ***']
      .map(token => ({ ...mutationRed, stdout: mutationRed.stdout.replace(token, 'wrong') })),
    { ...mutationRed, stdout: mutationRed.stdout + '- extra test\n' },
    { ...mutationRed, stdout: mutationRed.stdout + 'OtherSpec:\n' },
    { ...mutationRed, stdout: mutationRed.stdout.replace('ReplyOrderingSpec.scala:44', 'OtherSpec.scala:44') },
    { ...mutationRed, stdout: mutationRed.stdout + 'Total number of tests run: 2\n' },
    { ...mutationRed, stdout: mutationRed.stdout.replace('- successful ACK matches state', '- successful ACK matches state *** FAILED ***') },
  ]) assert(!runtimeMutationAcceptance(changed, mutationExpected).accepted);
  assert.throws(() => runtimeMutationAcceptance(mutationRed, { ...mutationExpected, diagnostic: /ACK/g }), /Fixed mutation/);
});

test('actual independent suites admit exactly the fixed registration shapes, not arbitrary Scala loops', () => {
  for (const file of oracleContract.files) {
    const bytes = readFileSync(join(oracle, file));
    validateOracleBytes(file, bytes);
    assert.throws(() => validateOracleBytes(file, Buffer.concat([bytes, Buffer.from('\n// changed body')])));
  }
  for (const expected of oracleContract.suites)
    validateSuiteSource(readFileSync(join(oracle, expected.file), 'utf8'), expected);
  const expected = oracleContract.suites.find(row => row.file === 'RepositorySpec.scala');
  const text = readFileSync(join(oracle, expected.file), 'utf8');
  for (const changed of [
    text.replace(repositoryLoops.failure.header, repositoryLoops.failure.header.replace('"spawn"', '"extra"')),
    text.replace(repositoryLoops.failure.header, repositoryLoops.failure.header.replace('Vector', 'dynamic')),
    text.replace(repositoryLoops.reentry.header, repositoryLoops.reentry.header.replace('"get", "close"', '"close", "get"')),
    text.replace(repositoryLoops.reentry.header, repositoryLoops.reentry.header.replace(')) {', ') if operation != "close") {')),
    text.replace(repositoryLoops.failure.expression, 'phase + "guessed case"'),
    text.replace(repositoryLoops.failure.header + '\n', repositoryLoops.failure.header + '\n    if (false) {\n') + '\n}',
    text + '\n  test("extra") { }\n',
  ]) assert.throws(() => validateSuiteSource(changed, expected));
  assert.throws(() => validateSuiteSource(text, { ...expected, suite: 'example.inventory.aggregatecore.reference.OtherSpec' }));
  const pb = oracleContract.suites.find(row => row.file === 'PbRoundtripSpec.scala');
  assert.equal(pb.testNames.length, 6);
  validateSuiteSource(readFileSync(pbRacePath, 'utf8'), pb);
  assert.equal(oracleContract.suites.flatMap(suite => suite.testNames).length, 35);
});

let preparedEntries;
test('actual pure prepare matches the fixed complete inventory and both generated suite contracts', () => {
  const c = captureProject(project, { roundtripCheck: false }); // deliberately no stock roundtrip cleanup
  const first = projectPlan(c, '/private/tmp/aggregate-core-pure-plan-not-written');
  const second = projectPlan(c, '/private/tmp/aggregate-core-pure-plan-not-written');
  assert.deepEqual(second, first, 'Whole plan changed for the same prepared inputs');
  preparedEntries = first.entries;
  const production = first.entries.filter(entry => entry.kind !== 'project-evidence');
  validateInventory(production.map(entry => entry.path), [...expectedSourcePaths('reference'), ...sourceInventory.generatedTest], 'prepared source');
  assert.equal(production.length, 24);
  assert.equal(first.entries.length, writerInventory.length);
  const products = Object.fromEntries(c.compilation.result.products.map(row => [row.id, row.payload]));
  const model = buildModels({ products, options: c.config.options });
  const pbTests = generatedTestArtifacts(model.kernel, model.serialization);
  assert.equal(pbTests.length, 1);
  assert.equal(pbTests[0].path, oracleContract.generatedSuites[0].file);
  validateSuiteSource(pbTests[0].body, oracleContract.generatedSuites[0]);
  const pbEntry = production.find(entry => entry.path === pbTests[0].path);
  assert(pbEntry.content.endsWith(pbTests[0].body), 'Prepared PB test differs from family1 metadata');
  validateSuiteSource(pbEntry.content, oracleContract.generatedSuites[0]);
  const smokeContract = oracleContract.generatedSuites[1];
  const smoke = production.find(entry => entry.path === smokeContract.file);
  assert.equal(smoke.kind, 'generated-test');
  validateSuiteSource(smoke.content, smokeContract);
  assert(expectedSourcePaths('generated').includes(smoke.path));
  assert(writerInventory.includes(smoke.path));
  assert.equal(oracleContract.status, 'ready');
  const factory = production.find(entry => entry.path.endsWith('/application/factories/WarehouseAggregateFactory.scala'));
  assert.match(factory.content, /persistenceId: PersistenceId/);
  console.log('PURE-PREPARE-INVENTORY ' + JSON.stringify({ sourceEntries: production.length, writerEntries: first.entries.length,
    projectedDiskFiles: first.entries.length + 2, sourceFiles: 24, frozenWriterEntries: writerInventory.length,
    frozenDiskFiles: expectedSourcePaths('generated').length, tests: production.filter(entry => entry.kind === 'generated-test').map(entry =>
      ({ path: entry.path, sha256: sha(entry.content), kind: entry.kind })), sameWholePlan: true, writerCalled: false, jvmExecuted: false,
    phasePlans: { reference: fixedPhasePlan('reference'), generated: fixedPhasePlan('generated') } }));
  for (const changed of [pbTests[0].body.replaceAll('AnyWordSpec', 'AnyFunSuite'), pbTests[0].body.replace('round-trip', 'fake-trip'),
    pbTests[0].body.replace(' in {', ' in {\n      "extra" in { }'), pbTests[0].body + '\n  test(dynamic) { }'])
    assert.throws(() => validateSuiteSource(changed, oracleContract.generatedSuites[0]));
});

test('all three finite mutation recipes apply once to reference and actual prepared source bytes without touching originals', () => {
  assert(preparedEntries, 'Pure prepare must precede mutation mechanism test');
  for (const control of oracleContract.runtimeControls) {
    assert(control.expected.testNames.length === 1 && control.expected.failedTestName === control.expected.testNames[0]);
    assert(control.suite.testNames.includes(control.expected.failedTestName));
    for (const original of [readFileSync(join(reference, control.file)), Buffer.from(preparedEntries.find(entry => entry.path === control.file).content)]) {
      const before = Buffer.from(original), changed = mutationBytes(original, control);
      assert.deepEqual(original, before);
      assert.notEqual(sha(changed), sha(original));
      assert.equal(changed.toString(), original.toString().replace(control.from, control.to));
      assert.throws(() => mutationBytes(changed, control), /anchor missing or ambiguous/);
      assert.throws(() => mutationBytes(Buffer.concat([original, original]), control), /anchor missing or ambiguous/);
      assert.throws(() => mutationBytes(original, { ...control }), /Finite owned mutation/);
    }
    const name = control.suite.suite.split('.').at(-1), target = control.expected.failedTestName;
    const diagnostic = control.label === 'early-reply' ? 'Received unexpected message Accepted(Vector())\n  at ref (ReplyOrderingSpec.scala:49)' :
      control.label === 'rejected-calls-host' ? 'host must not be evaluated on this path\n  at ref (PureDecisionSpec.scala:23)' :
        'WarehouseState(Map()) did not equal WarehouseState(Map()) (PureDecisionSpec.scala:95)';
    const output = `Run starting. Expected test count is: 1\n${name}:\n- ${target} *** FAILED ***\n  ${diagnostic}\nRun completed in 1 second.\n` +
      'Total number of tests run: 1\nSuites: completed 1, aborted 0\nTests: succeeded 0, failed 1, canceled 0, ignored 0, pending 0\n*** 1 TEST FAILED ***\n';
    const red = { status: 1, signal: null, stdout: output, stderr: '' };
    assert(runtimeMutationAcceptance(red, control.expected).accepted); // detached acceptance specimen, NOT JVM evidence
    for (const changed of [{ ...red, stdout: output.replace(target, 'unrelated case') }, { ...red, stderr: 'NoSuchMethodError' },
      { ...red, stdout: output.replace(diagnostic, 'unrelated assertion (OtherSpec.scala:1)') },
      { ...red, stdout: output + 'Run starting. Expected test count is: 9\n' },
      { ...red, stdout: output + 'Total number of tests run: 9\n' }, { ...red, stdout: output + '- arbitrary case\n' },
      { ...red, stdout: 'arbitrary exit 1' }]) assert(!runtimeMutationAcceptance(changed, control.expected).accepted);
  }
});

test('shared compiler optional rejection seam dispatches only suite-rejection and missing handler fails closed', () => {
  const text = readFileSync(fileURLToPath(new URL('./reference/compiler-tools.mjs', import.meta.url)), 'utf8');
  // Evaluate only the actual pure dispatch expression, never a copied process runner.
  const expression = text.match(/const accept = ([\s\S]*?);\n  const home/)[1];
  let calls = 0;
  const predicate = (result, expected) => { calls++; return runtimeMutationAcceptance(result, expected); };
  const dispatch = runInNewContext('(' + expression + ')', { assert, acceptance, suiteRejectionAcceptance: predicate });
  assert(dispatch(mutationRed, mutationExpected).accepted);
  assert.equal(calls, 1);
  for (const expected of [{ kind: 'success' }, compilerExpected, { kind: 'suites', suites: ['example.UnitSpec'], tests: 1 }, { kind: 'unknown' }]) {
    const result = expected.kind === 'compiler-rejection' ? compilerRed : { status: 0, signal: null, stdout: '', stderr: '' };
    assert.deepEqual(dispatch(result, expected), acceptance(result, expected));
  }
  assert.equal(calls, 1);
  const absent = runInNewContext('(' + expression + ')', { assert, acceptance, suiteRejectionAcceptance: undefined });
  assert.throws(() => absent(mutationRed, mutationExpected), /Missing suite rejection handler/);
  assert(!acceptance(mutationRed, mutationExpected).accepted, 'Default shared acceptance semantics must not start accepting rejection');
  assert.match(text, /\.\.\.accept\(result, expected\)/);
  const io = { out: '/virtual/only', directory: name => '/virtual/only/' + name, write: name => '/virtual/only/' + name };
  const tools = { java, protoc, javaHome: '/virtual/java', sandbox: '/usr/bin/sandbox-exec', compiler: [], plugin: [], includes: new Map() };
  assert.throws(() => compilerSession(io, tools, { suiteRejectionAcceptance: false }), /Invalid suite rejection handler/);
  assert.throws(() => compilerSession(io, tools).jvm('no-handler', [], mutationExpected), /Missing suite rejection handler/);
  assert.throws(() => compilerSession(io, tools, { suiteRejectionAcceptance: predicate }).jvm('guarded', [], mutationExpected), /NODE_TEST_CONTEXT/);
  assert.equal(calls, 1, 'No process executed in Node contract tests');
});

test('all eight compiler controls have actual fixtures, passed-positive dependencies and source/member-specific rejection gates', () => {
  assert.deepEqual(oracleContract.positiveControls.map(control => control.label), ['valid-host', 'valid-adapters']);
  assert.deepEqual(oracleContract.positiveControls[1].dependencies, ['valid-host']);
  const diagnosticBodies = [
    'class MissingMethod needs to be abstract\nMissing implementation: reservationIdentity',
    'incompatible type in overriding def reservationIdentity: ReservationId',
    'not enough arguments for method create: eventAdapter, snapshotAdapter',
    'not enough arguments for method create: snapshotAdapter',
    'type mismatch; found: EventAdapter[WarehouseProtocol.Command, String] required: EventAdapter[WarehouseProtocol.Event, String]',
    'type mismatch; found: SnapshotAdapter[String] required: SnapshotAdapter[WarehouseState]',
    'value Execute is not a member of object example.inventory.domain.WarehouseProtocol',
    'object application is not a member of package example.inventory',
  ];
  oracleContract.compilerControls.forEach((control, i) => {
    const source = readFileSync(join(oracle, control.negative), 'utf8');
    assert(source.includes(control.symbol), 'Control source must target its fixed symbol');
    assert.deepEqual(control.dependencies, control.kernelOnly ? ['valid-host'] : ['valid-host', 'valid-adapters']);
    const expected = { kind: 'compiler-rejection', file: control.negative.split('/').at(-1), symbol: control.symbol, diagnostics: control.diagnostics };
    const red = { status: 1, signal: null, stdout: '', stderr: `/finite/${expected.file}:7: error: ${diagnosticBodies[i]}\n1 error\n` };
    assert(acceptance(red, expected).accepted); // detached expected diagnostics, not observed compiler output
    for (const changed of [{ ...red, status: 2 }, { ...red, status: 0 }, { ...red, error: { code: 'PROCESS_LIFECYCLE_FAILED' } },
      { ...red, stderr: 'arbitrary exit 1' }, { ...red, stderr: red.stderr.replace(expected.file, 'Unrelated.scala') },
      { ...red, stderr: red.stderr + 'NoClassDefFoundError: akka/remote/X' }]) assert(!acceptance(changed, expected).accepted);
  });
  const host = readFileSync(join(oracle, oracleContract.positiveControls[0].file), 'utf8');
  const adapters = readFileSync(join(oracle, oracleContract.positiveControls[1].file), 'utf8');
  assert.match(host, /reservationIdentity\(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long\): ReservationId/);
  assert.match(adapters, /application\.factories\.WarehouseAggregateFactory/);
  assert.match(adapters, /EventAdapter\[WarehouseProtocol\.Event, String\]/);
  assert.match(adapters, /SnapshotAdapter\[WarehouseState\]/);
  assert.match(adapters, /factory\.create\[String\]\(pid, WarehouseState\(\), ValidHost, events, snapshots\)/);
});

test('kernel, host, adapters, oracle and mutated production have strictly separated classpaths', () => {
  const tools = { library: '/supply/scala-library.jar', compiler: ['/supply/scala-compiler.jar', '/supply/scala-library.jar'],
    plugin: ['/supply/scala-library.jar', '/supply/scalapb-plugin.jar'], runtime: ['/supply/scala-library.jar', '/supply/protobuf.jar'],
    actorLibraries: ['/supply/akka.jar'], testLibraries: ['/supply/scala-library.jar', '/supply/scalatest.jar'], actorTestLibraries: ['/supply/akka-testkit.jar'] };
  const classes = Object.fromEntries(['kernel', 'pb', 'glue', 'oracle', 'generated-test'].map(role => [role, '/virtual/classes/reference/' + role]));
  const cp = warehouseClasspaths(tools, classes);
  assert.deepEqual(cp.kernel, [tools.library]);
  assert.deepEqual(cp.pb, tools.runtime);
  assert(!cp.glue.includes(classes.glue));
  assert(cp.production.includes(classes.glue));
  for (const path of [...tools.actorTestLibraries, ...tools.testLibraries.filter(path => path !== tools.library), classes.oracle, classes['generated-test']])
    assert(!cp.production.includes(path));
  assert(!cp.production.some(path => /ValidHost|ValidAdapters/.test(path)));
  for (const control of oracleContract.compilerControls.filter(control => control.kernelOnly))
    assert.deepEqual(control.dependencies, ['valid-host']); // no glue/PB/Akka dependency admitted in that lane
  const positives = { 'valid-host': '/virtual/classes/controls/valid-host', 'valid-adapters': '/virtual/classes/controls/valid-adapters' };
  assert.deepEqual(compilerControlClasspath(oracleContract.positiveControls[0], tools, classes, {}), [tools.library, classes.kernel]);
  assert.throws(() => compilerControlClasspath(oracleContract.positiveControls[1], tools, classes, {}), /passed positive/);
  assert.deepEqual(compilerControlClasspath(oracleContract.positiveControls[1], tools, classes, positives), [...cp.production, positives['valid-host']]);
  for (const control of oracleContract.compilerControls) {
    assert.throws(() => compilerControlClasspath(control, tools, classes, {}), /passed positive/);
    const actual = compilerControlClasspath(control, tools, classes, positives);
    assert.deepEqual(actual, control.kernelOnly ? [tools.library, classes.kernel, positives['valid-host']] :
      [...cp.production, positives['valid-host'], positives['valid-adapters']]);
    for (const path of [...tools.actorTestLibraries, classes.oracle, classes['generated-test']]) assert(!actual.includes(path));
  }
  assert.throws(() => compilerControlClasspath({ ...oracleContract.compilerControls[0] }, tools, classes, positives), /Finite compiler fixture/);
  assert.throws(() => compilerControlClasspath(oracleContract.compilerControls[0], tools, classes,
    { 'valid-host': classes.kernel }), /exclusive/);
  const mutant = { kernel: '/virtual/classes/mutation/kernel', pb: classes.pb, glue: '/virtual/classes/mutation/glue', oracle: '/virtual/classes/mutation/oracle' };
  const mutantCP = warehouseClasspaths(tools, mutant);
  assert(mutantCP.production.includes(mutant.kernel) && mutantCP.production.includes(mutant.glue));
  assert(!mutantCP.production.includes(classes.kernel) && !mutantCP.production.includes(classes.glue));
  assert(!mutantCP.tests.includes(classes.oracle));
  for (const extra of [tools.compiler[0], tools.actorTestLibraries[0], tools.testLibraries.find(path => path.includes('scalatest')), classes.oracle, classes['generated-test']])
    assert.throws(() => warehouseClasspaths({ ...tools, actorLibraries: [...tools.actorLibraries, extra] }, classes), /entered production/);
  assert.throws(() => warehouseClasspaths(tools, { ...classes, glue: classes.kernel }), /exclusive/);
});

test('fixed complete phase plans reject missing controls, extra phases, wrong kinds, reordering and arbitrary exit one', () => {
  assert.equal(fixedPhasePlan('reference').length, 32);
  assert.equal(fixedPhasePlan('generated').length, 35);
  for (const mode of ['reference', 'generated']) {
    const runs = fixedPhasePlan(mode).map(({ label, ...expected }) => ({ label, expected, accepted: true,
      exitCode: ['compiler-rejection', 'suite-rejection'].includes(expected.kind) ? 1 : 0, signal: null, processError: null }));
    validatePhaseResults(runs, mode);
    for (const changed of [[], runs.slice(0, -1), [...runs, runs[0]], [...runs.slice(1), runs[0]],
      runs.map((run, i) => i === 0 ? { ...run, exitCode: 1 } : run),
      runs.map((run, i) => i === 0 ? { ...run, accepted: false } : run),
      runs.map((run, i) => i === 0 ? { ...run, signal: 'SIGKILL' } : run),
      runs.map((run, i) => i === 0 ? { ...run, processError: { code: 'ETIMEDOUT' } } : run),
      runs.map((run, i) => i === 0 ? { ...run, expected: { kind: 'suite-rejection' } } : run)])
      assert.throws(() => validatePhaseResults(changed, mode));
    assert.throws(() => validatePhaseResults(runs.map(run => run.expected.kind === 'suites' ?
      { ...run, expected: { ...run.expected, tests: 999 } } : run), mode), /drifted/);
    assert.throws(() => validatePhaseResults(runs.map(run => run.expected.kind === 'compiler-rejection' ?
      { ...run, expected: { ...run.expected, symbol: 'unrelated' } } : run), mode), /drifted/);
    assert.throws(() => validatePhaseResults(runs.map(run => run.expected.kind === 'suite-rejection' ?
      { ...run, expected: { ...run.expected, failedTestName: 'unrelated case' } } : run), mode), /drifted/);
    assert.equal(runs.filter(run => run.expected.kind === 'compiler-rejection').length, 8);
    assert.equal(runs.filter(run => run.expected.kind === 'suite-rejection').length, 3);
  }
});
