import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, linkSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { options, collectInputs, generatedEvidence, sourceInventory, oracleInventory, oracleTests } from './reference/domain-kernel/verify.mjs';
import { acceptance, regular, files, privateOutput, snapshot, hash, compilerSession, zipMembers, manifestClassPath } from './reference/compiler-tools.mjs';

const verifier = fileURLToPath(new URL('./reference/domain-kernel/verify.mjs', import.meta.url));
const parcel = fileURLToPath(new URL('./reference/module-seams/verify.mjs', import.meta.url));
const scratch = new Set();
const temp = () => {
  const path = mkdtempSync(join(realpathSync(tmpdir()), 'domain-kernel-verifier-unit-'));
  scratch.add(path); return path;
};
test.after(() => { for (const path of scratch) rmSync(path, { recursive: true, force: true }); });
const write = (root, name, text = '') => {
  const path = join(root, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { flag: 'wx' });
  return path;
};
const explicit = ['--java', '/missing/java', '--maven-cache', '/missing/cache', '--protoc', '/missing/protoc',
  '--source', '/missing/source', '--oracle', '/missing/oracle', '--out', '/private/tmp/domain-kernel-must-not-be-created', '--mode', 'reference'];
const child = (args, context = false, entry = verifier) => spawnSync(process.execPath, [entry, ...args], {
  encoding: 'utf8', timeout: 10000, env: { PATH: '/usr/bin:/bin', ...(context ? { NODE_TEST_CONTEXT: 'child-v8' } : {}) },
});

function syntheticInputs(mode = 'reference') {
  const root = temp(), source = join(root, 'source'), oracle = join(root, 'oracle');
  const paths = [...sourceInventory.kernel, ...sourceInventory.glue, ...sourceInventory.proto, ...sourceInventory.build,
    ...(mode === 'generated' ? sourceInventory.generatedTest : [])];
  for (const path of paths) write(source, path, '// Unit input; never submitted to a compiler.\n');
  const text = 'package example.counter.oracle\nfinal class DomainKernelSpec extends AnyFunSuite {\n' +
    oracleTests.map(name => '  test("' + name + '") {\n  }').join('\n') + '\n}\n';
  for (const path of oracleInventory) write(oracle, path, path === 'DomainKernelSpec.scala' ? text : '// Unit negative/control fixture.\n');
  return { root, source, oracle, paths };
}

function syntheticWriter(trailingRoot = false) {
  const fixture = syntheticInputs('generated');
  const tree = write(fixture.root, 'author/system.yaml', 'id: counter\n');
  const input = write(fixture.root, 'project.json', '{"tree":"author"}\n');
  const producerRoot = join(fixture.root, 'producer');
  const producerPaths = ['lib', 'src', 'generators', 'schema', 'scaffold'].map(dir => write(producerRoot, `${dir}/stub`, ''))
    .concat([write(producerRoot, 'bin/truthsrc.js', ''), write(producerRoot, 'package.json', '{}')]).sort();
  const recordedRoot = producerRoot + (trailingRoot ? '/' : '');
  const producerHash = createHash('sha256').update(JSON.stringify(producerPaths.map(file => [file.slice(recordedRoot.length), hash(file)])) + '\n').digest('hex');
  const sources = [{ role: 'project', file: input, sha256: hash(input) }, { role: 'tree', file: tree, sha256: hash(tree) },
    { role: 'tool', root: recordedRoot, sha256: producerHash }];
  const meta = ['.truthsrc/canonical.json', '.truthsrc/request.json', '.truthsrc/compiled.json', '.truthsrc/inputs.json'];
  for (const path of meta) write(fixture.source, path, JSON.stringify(path.endsWith('inputs.json') ? { sources, generatedFiles: fixture.paths } : {}) + '\n');
  const paths = [...fixture.paths, ...meta];
  const kindFor = path => path.startsWith('.truthsrc/') ? 'project-evidence' : sourceInventory.kernel.includes(path) ?
    path.includes('/values/') ? 'value-object' : path.includes('/ports/') ? 'computation-port' : path.includes('/params/') ? 'rule-parameters' :
      path.endsWith('/CounterState.scala') ? 'state' : 'protocol' : sourceInventory.build.includes(path) ? 'build' :
    sourceInventory.proto.includes(path) ? 'proto' : sourceInventory.generatedTest.includes(path) ? 'generated-test' :
      path.endsWith('/ExactValueCodecs.scala') ? 'exact-value-codec' : 'converter';
  const entries = paths.map(path => ({ path, kind: kindFor(path), ownership: { id: input, generator: 'scala-cqrs-domain-kernel', fingerprint: 'sha256:' + hash(join(fixture.source, path)) } }));
  write(fixture.source, 'truthsrc.ledger.json', JSON.stringify({ generator: 'scala-cqrs-domain-kernel', entries }));
  write(fixture.source, 'anchors.json', '{}');
  const receipt = write(fixture.root, 'writer-receipt.json', JSON.stringify({ schemaVersion: 'truthsrc.project-result/v1', applied: true, sources,
    result: { name: 'scala-cqrs-domain-kernel', ledger: join(fixture.source, 'truthsrc.ledger.json'), anchors: join(fixture.source, 'anchors.json'), total: paths.length,
      actions: entries.map(row => ({ path: row.path, kind: row.kind, fingerprint: row.ownership.fingerprint, outcome: 'ADD' })) } }));
  return { ...fixture, receipt, input, producerRoot };
}

test('finite explicit CLI rejects unknown, duplicate, missing, relative and unsafe flags', () => {
  for (const [args, pattern] of [
    [[], /Missing flag/], [['--help'], /Unknown flag/], [['--source'], /Missing value/],
    [['--java', 'relative'], /absolute path/], [['--java', '/one', '--java', '/two'], /Repeated flag/],
    [['--protoc', '/tmp/a:b'], /classpath separator/], [['--java', '/tmp/a\njava'], /control character/],
    [['--source', '/tmp/a/../b'], /normalized/], [['--mode', 'probe'], /reference or generated/],
    [[...explicit, '--cmd', '/bin/sh'], /Unknown flag/], [[...explicit, '--timeout', '999999'], /Unknown flag/],
    [[...explicit, '--source-receipt', '/receipt'], /only in generated/],
    [[...explicit.slice(0, -1), 'generated'], /required only in generated/],
  ]) {
    const result = child(args);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.signal, null);
    assert.match(result.stderr, pattern);
    assert.equal(result.stdout, '');
  }
  assert.equal(options(explicit)['--mode'], 'reference');
});

test('NODE_TEST_CONTEXT disables execution even with a fully explicit CLI', () => {
  for (const args of [[], explicit, ['--unexpected']]) {
    const result = child(args, true);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  }
  assert.throws(() => compilerSession(privateOutput(join(temp(), 'out'), []), {
    java: '/not/java', protoc: '/not/protoc', javaHome: '/not', sandbox: '/not/sandbox', plugin: [], includes: new Map(),
  }).jvm('blocked', ['-version']), /NODE_TEST_CONTEXT/);
});

test('existing output and missing real source reject before any tool execution or output mutation', () => {
  const root = temp();
  const marker = write(root, 'sentinel', 'keep');
  const args = [...explicit]; args[args.indexOf('--out') + 1] = root;
  const result = child(args);
  assert.equal(result.status, 1); assert.match(result.stderr, /Output must be absent/);
  assert.equal(readFileSync(marker, 'utf8'), 'keep');
  assert.deepEqual(files(root), [marker]);
  const absent = join(root, 'absent'); args[args.indexOf('--out') + 1] = absent;
  const missing = child(args);
  assert.equal(missing.status, 1); assert.equal(missing.signal, null);
  assert.match(missing.stderr, /ENOENT|Not a real input directory/);
  assert(!existsSync(absent)); assert.equal(missing.stdout, '');
});

test('finite production inventory is complete and cannot accept fake PB or a copied oracle', () => {
  const fixture = syntheticInputs();
  const collected = collectInputs(fixture.source, fixture.oracle, 'reference');
  assert.equal(collected.sourcePaths.length, 17);
  assert.equal(collected.oraclePaths.length, 4);
  write(fixture.source, 'modules/glue/src/main/scala/example/counter/protobuf/Fake.scala');
  assert.throws(() => collectInputs(fixture.source, fixture.oracle, 'reference'), /Incomplete or extra finite source inventory/);
  const copied = syntheticInputs(); write(copied.source, 'oracle/DomainKernelSpec.scala');
  assert.throws(() => collectInputs(copied.source, copied.oracle, 'reference'), /Incomplete or extra/);
  const incomplete = syntheticInputs();
  const emptyOracle = join(incomplete.root, 'empty-oracle'); mkdirSync(emptyOracle);
  assert.throws(() => collectInputs(incomplete.source, emptyOracle, 'reference'), /oracle inventory must be complete/);
  assert.throws(() => collectInputs(incomplete.source, incomplete.source, 'reference'), /must be disjoint/);
});

test('oracle test drift is rejected rather than changing an expected runtime count', () => {
  const fixture = syntheticInputs();
  const path = join(fixture.oracle, 'DomainKernelSpec.scala');
  writeFileSync(path, readFileSync(path, 'utf8').replace(oracleTests[0], 'substituted assertion'));
  assert.throws(() => collectInputs(fixture.source, fixture.oracle, 'reference'), /names\/count drifted/);
});

test('source filesystem gates reject symlinks, hardlinks and input changes', () => {
  const root = temp(); const input = write(root, 'input', 'before');
  const alias = join(root, 'alias'); symlinkSync(input, alias);
  assert.throws(() => regular(alias), /Not a private regular file/);
  assert.throws(() => files(root), /Symlink in input tree/);
  const hardRoot = temp(), original = write(hardRoot, 'original', 'shared');
  linkSync(original, join(hardRoot, 'hardlink'));
  assert.throws(() => regular(original), /Not a private regular file/);
  const before = snapshot([input]); writeFileSync(input, 'after');
  assert.notDeepEqual(snapshot([input]), before);
});

test('write root must be absent, canonical, non-Git and outside every input', () => {
  const root = temp(), source = join(root, 'source'); mkdirSync(source);
  assert.throws(() => privateOutput(source, []), /Output must be absent/);
  assert.throws(() => privateOutput(join(source, 'out'), [source]), /outside input trees/);
  write(root, '.git', 'gitdir: elsewhere');
  assert.throws(() => privateOutput(join(root, 'out'), []), /Git worktree/);
  const second = temp(), link = join(second, 'alias'); symlinkSync(source, link);
  assert.throws(() => privateOutput(join(link, 'out'), []), /Output parent must be an existing directory|Symlink in output parent/);
  const io = privateOutput(join(temp(), 'exclusive'), []);
  io.write('exclusive.json', '{}');
  assert.throws(() => io.write('exclusive.json', '{}'), /EEXIST/);
  assert.throws(() => io.write('../escape', ''), /Write escaped output/);
});

test('generated writer evidence binds actual final bytes and real input hashes outside source output', () => {
  const trailing = syntheticWriter(true);
  assert.equal(generatedEvidence(trailing.source, trailing.receipt).producerRoot, trailing.producerRoot);
  const fixture = syntheticWriter();
  assert.equal(collectInputs(fixture.source, fixture.oracle, 'generated').sourcePaths.length, 24);
  const evidence = generatedEvidence(fixture.source, fixture.receipt);
  assert.equal(evidence.finalBytes.length, 22);
  assert.equal(evidence.generator, 'scala-cqrs-domain-kernel');
  writeFileSync(join(fixture.source, sourceInventory.kernel[0]), '// tampered final bytes');
  assert.throws(() => generatedEvidence(fixture.source, fixture.receipt), /does not match actual bytes/);
  const other = syntheticWriter(); writeFileSync(other.input, '{"changed":true}');
  assert.throws(() => generatedEvidence(other.source, other.receipt), /source input has changed/);
  const changedTool = syntheticWriter(); writeFileSync(join(changedTool.producerRoot, 'generators/stub'), 'new producer');
  assert.throws(() => generatedEvidence(changedTool.source, changedTool.receipt), /Producer has changed/);
});

test('plan-only, wrong generator, wrong target and receipt inside source cannot certify generated bytes', () => {
  for (const change of [
    value => { value.applied = false; },
    value => { value.result.name = 'scala-cqrs-domain'; },
    value => { value.result.ledger = '/other/truthsrc.ledger.json'; },
    value => { value.result.actions[0].outcome = 'KEEP'; },
    value => { value.sources = []; },
  ]) {
    const fixture = syntheticWriter(); const receipt = JSON.parse(readFileSync(fixture.receipt, 'utf8'));
    change(receipt); writeFileSync(fixture.receipt, JSON.stringify(receipt));
    assert.throws(() => generatedEvidence(fixture.source, fixture.receipt));
  }
  const fixture = syntheticWriter(); const inside = write(fixture.source, 'receipt.json', readFileSync(fixture.receipt));
  assert.throws(() => generatedEvidence(fixture.source, inside), /outside the generated source tree/);
});

const ok = stdout => ({ status: 0, signal: null, stdout, stderr: '' });
const rejection = { kind: 'compiler-rejection', file: 'MissingMethod.scala', symbol: 'acceptedRatio', diagnostics: [/needs to be abstract/, /acceptedRatio/] };
const red = { status: 1, signal: null, stdout: '', stderr: '/tmp/MissingMethod.scala:6: error: class MissingMethod needs to be abstract\nMissing implementation: def acceptedRatio(): Ratio\n1 error\n' };

test('compiler negative acceptance requires exit 1, source diagnostic, expected symbol and no environment failure', () => {
  assert(acceptance(red, rejection).accepted);
  for (const result of [
    { ...red, status: 2 }, { ...red, status: 0 }, { ...red, status: null, signal: 'SIGKILL' },
    { ...red, error: { code: 'ETIMEDOUT' } }, { ...red, error: { code: 'ENOBUFS' } },
    { ...red, stderr: red.stderr + '\nNoClassDefFoundError: scalapb.Runtime' },
    { ...red, stderr: red.stderr + '\nOperation not permitted' },
    { ...red, stderr: red.stderr.replaceAll('acceptedRatio', 'wrongMember') },
    { ...red, stderr: red.stderr.replaceAll('MissingMethod.scala', 'Other.scala') },
    { ...red, stderr: 'process exited without a Scala diagnostic' },
  ]) assert(!acceptance(result, rejection).accepted);
});

test('runtime acceptance requires enumerated suites, exact counts and no aborted/ignored/canceled tests', () => {
  const expected = { kind: 'suites', suites: ['example.counter.oracle.DomainKernelSpec'], tests: 22 };
  const stdout = 'Run starting. Expected test count is: 22\nDomainKernelSpec:\nTotal number of tests run: 22\n' +
    'Suites: completed 1, aborted 0\nTests: succeeded 22, failed 0, canceled 0, ignored 0, pending 0\nAll tests passed.\n';
  assert(acceptance(ok(stdout), expected).accepted);
  for (const bad of [stdout.replaceAll('22', '21'), stdout.replace('DomainKernelSpec:', 'CopiedSpec:'),
    stdout.replace('aborted 0', 'aborted 1'), stdout.replace('ignored 0', 'ignored 1'),
    stdout.replace('canceled 0', 'canceled 1'), stdout.replace('All tests passed.', '*** TESTS FAILED ***')]) {
    assert(!acceptance(ok(bad), expected).accepted);
  }
  assert(!acceptance({ ...ok(stdout), error: { code: 'ETIMEDOUT' } }, expected).accepted);
  assert(!acceptance(ok(stdout), { ...expected, testNames: ['missing independent case'] }).accepted);
  assert(acceptance(ok(stdout + '- known independent case\n'), { ...expected, testNames: ['known independent case'] }).accepted);
});

// A tiny stored ZIP assembled only in a unit test (no real compiler/native processes).
function zip(root, name, content) {
  const bytes = Buffer.from(content), filename = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt32LE(bytes.length, 18);
  local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt32LE(bytes.length, 20);
  central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12); end.writeUInt32LE(local.length + filename.length + bytes.length, 16);
  return write(root, 'fixture.jar', Buffer.concat([local, filename, bytes, central, filename, end]));
}

test('bundled include extraction is finite and manifest classpaths are read without shell tools', () => {
  const archive = zip(temp(), 'scalapb/scalapb.proto', 'syntax = "proto2";\n');
  assert.equal(zipMembers(archive, ['scalapb/scalapb.proto']).get('scalapb/scalapb.proto').toString(), 'syntax = "proto2";\n');
  assert.throws(() => zipMembers(archive, ['../escape']), /Unsafe ZIP member/);
  assert.throws(() => zipMembers(archive, ['missing.proto']), /Missing ZIP member/);
  const manifest = zip(temp(), 'META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\r\nClass-Path: scala-library.jar\r\n scala-reflect.jar\r\n\r\n');
  assert.deepEqual(manifestClassPath(manifest), ['scala-library.jarscala-reflect.jar']);
});

test('Parcel verifier keeps safe CLI and NODE_TEST_CONTEXT behavior after mechanical helper extraction', () => {
  for (const args of [[], ['--help'], ['--java', 'relative']]) {
    const result = child(args, false, parcel);
    assert.equal(result.status, 1); assert.equal(result.signal, null);
    assert.match(result.stderr, /Missing flag|Unknown flag|absolute path/);
  }
  const result = child([], true, parcel);
  assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});
