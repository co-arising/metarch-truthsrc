import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as tools from './reference/compiler-tools.mjs';

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'module-seams-jvm-tools-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return tools.privateOutput(join(root, 'session'), []);
}
const jvmOnly = () => ({ java: '/not/java', javaHome: '/not', sandbox: '/not/sandbox', compiler: ['/not/compiler.jar'] });

test('pure JVM toolchain and session are explicit test-only exports', () => {
  assert.equal(typeof tools.offlineJvmToolchain, 'function');
  assert.equal(typeof tools.jvmCompilerSession, 'function');
  assert.equal(typeof tools.offlineToolchain, 'function');
  assert.equal(typeof tools.compilerSession, 'function');
});

test('JVM-only session needs no protoc, plugin or includes and writes no PB artifacts', t => {
  const io = fixture(t), session = tools.jvmCompilerSession(io, jvmOnly());
  assert.deepEqual(Object.keys(session).sort(), ['compile', 'jvm', 'runs']);
  assert.deepEqual(session.runs, []);
  assert.deepEqual(readdirSync(io.out).sort(), ['home', 'logs', 'sandbox.sb', 'tmp']);
  assert.equal(existsSync(join(io.out, 'tools')), false);
  assert.equal(existsSync(join(io.out, 'includes')), false);
});

test('JVM-only session does not consult an incidental PB field', t => {
  const input = jvmOnly();
  for (const key of ['protoc', 'plugin', 'includes']) Object.defineProperty(input, key, {
    get() { throw new Error('JVM session read PB field ' + key); },
  });
  const session = tools.jvmCompilerSession(fixture(t), input);
  assert.equal(typeof session.compile, 'function');
  assert.deepEqual(session.runs, []);
});

test('JVM-only launch and compiler remain blocked in default Node discovery', t => {
  assert(process.env.NODE_TEST_CONTEXT);
  const session = tools.jvmCompilerSession(fixture(t), jvmOnly());
  assert.throws(() => session.jvm('blocked-jvm', ['-version']), /NODE_TEST_CONTEXT/);
  assert.throws(() => session.compile('blocked-compile', ['/not/Source.scala'], ['/not/scala-library.jar'], '/not/classes'), /NODE_TEST_CONTEXT/);
  assert.deepEqual(session.runs, []);
});

test('JVM-only suite rejection is opt-in and fail-closed before execution', t => {
  const session = tools.jvmCompilerSession(fixture(t), jvmOnly());
  assert.throws(() => session.jvm('no-handler', [], { kind: 'suite-rejection' }), /Missing suite rejection handler/);
  assert.deepEqual(session.runs, []);
});

test('invalid JVM-only suite predicate rejects before creating a session', t => {
  const io = fixture(t);
  assert.throws(() => tools.jvmCompilerSession(io, jvmOnly(), { suiteRejectionAcceptance: true }), /Invalid suite rejection handler/);
  assert.deepEqual(readdirSync(io.out), []);
});

test('legacy PB session still provisions its launcher and include root', t => {
  const io = fixture(t), session = tools.compilerSession(io, {
    ...jvmOnly(), protoc: '/not/protoc', plugin: [], includes: new Map(),
  });
  assert.deepEqual(Object.keys(session).sort(), ['compile', 'generate', 'jvm', 'protocVersion', 'runs']);
  assert(existsSync(join(io.out, 'tools/protoc-gen-scala')));
  assert(existsSync(join(io.out, 'includes')));
  assert.throws(() => session.protocVersion(), /NODE_TEST_CONTEXT/);
  assert.deepEqual(session.runs, []);
});

test('suite predicate cannot override lifecycle failure or a termination signal', () => {
  const expected = { kind: 'suite-rejection' }, permissive = () => ({ accepted: true });
  const clean = { status: 1, signal: null, stdout: '', stderr: '', error: null };
  assert.equal(tools.acceptCompilerResult(clean, expected, permissive).accepted, true);
  for (const changed of [
    { ...clean, error: { code: 'PROCESS_LIFECYCLE_FAILED' } },
    { ...clean, signal: 'SIGKILL' },
    { ...clean, error: { code: 'PROCESS_LIFECYCLE_FAILED' }, signal: 'SIGTERM' },
  ]) {
    assert.equal(permissive(changed).accepted, true, 'counterexample to callback-only acceptance');
    assert.equal(tools.acceptCompilerResult(changed, expected, permissive).accepted, false);
  }
  assert.equal(tools.acceptCompilerResult(clean, expected, () => ({ accepted: 'yes' })).accepted, false);
});

test('compiler rejection retains exact source diagnostics and environment rejection', () => {
  const expected = { kind: 'compiler-rejection', file: 'Bridge.scala', symbol: 'assess', diagnostics: [/type mismatch/, /assess/] };
  const result = { status: 1, signal: null, stdout: '', stderr: '/tmp/Bridge.scala:4: error: type mismatch at assess\n' };
  assert(tools.acceptance(result, expected).accepted);
  for (const changed of [
    { ...result, status: 0 }, { ...result, status: 2 }, { ...result, signal: 'SIGTERM' },
    { ...result, error: { code: 'PROCESS_LIFECYCLE_FAILED' } },
    { ...result, stderr: result.stderr.replace('Bridge.scala', 'Other.scala') },
    { ...result, stderr: result.stderr + 'NoClassDefFoundError: missing\n' },
  ]) assert.equal(tools.acceptance(changed, expected).accepted, false);
});
