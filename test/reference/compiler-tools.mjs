// Test-only offline compiler mechanics; deliberately not a packaged runner.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runVerifiedProcess } from '../../lib/verification/process.mjs';
import {
  accessSync, constants, lstatSync, mkdirSync, readFileSync, readdirSync,
  realpathSync, writeFileSync,
} from 'node:fs';
import { basename, delimiter, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';

export function present(path) {
  try { lstatSync(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function regular(path) {
  const stat = lstatSync(path);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, `Not a private regular file: ${path}`);
  assert.equal(realpathSync(path), path, `Symlink in file path: ${path}`);
  return path;
}

export function within(path, parent) {
  return path === parent || path.startsWith(parent + sep);
}

export function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap(entry => {
      const path = join(directory, entry.name);
      assert(!entry.isSymbolicLink(), `Symlink in input tree: ${path}`);
      if (entry.isDirectory()) return files(path);
      return [regular(path)];
    });
}

export const hash = path => createHash('sha256').update(readFileSync(regular(path))).digest('hex');
export const snapshot = paths => paths.map(path => ({ path, sha256: hash(path) }));

// Extracted unchanged from the Parcel verifier, including its manifest policy.
export function manifestClassPath(path) {
  const zip = readFileSync(path);
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) {
      end = i;
      break;
    }
  }
  assert(end >= 0, `Missing ZIP directory: ${path}`);
  assert.equal(zip.readUInt16LE(end + 4), 0, 'Multi-disk ZIP is unsupported');
  assert.equal(zip.readUInt16LE(end + 6), 0, 'Multi-disk ZIP is unsupported');
  const count = zip.readUInt16LE(end + 10);
  assert(count !== 0xffff && count === zip.readUInt16LE(end + 8), 'ZIP64 is unsupported');
  let cursor = zip.readUInt32LE(end + 16);
  let manifest;
  for (let index = 0; index < count; index++) {
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50, `Invalid ZIP entry: ${path}`);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (name.toUpperCase() === 'META-INF/MANIFEST.MF') {
      assert.equal(manifest, undefined, `Duplicate manifest: ${path}`);
      assert.equal(zip.readUInt16LE(cursor + 8) & 1, 0, 'Encrypted ZIP is unsupported');
      const method = zip.readUInt16LE(cursor + 10);
      const size = zip.readUInt32LE(cursor + 20);
      const expanded = zip.readUInt32LE(cursor + 24);
      const local = zip.readUInt32LE(cursor + 42);
      assert.equal(zip.readUInt32LE(local), 0x04034b50, 'Invalid local ZIP header');
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      assert(start + size <= zip.length && expanded <= 1024 * 1024, 'Invalid manifest size');
      const packed = zip.subarray(start, start + size);
      assert(method === 0 || method === 8, 'Unsupported ZIP compression');
      const bytes = method === 0 ? Buffer.from(packed) : inflateRawSync(packed, { maxOutputLength: 1024 * 1024 });
      assert.equal(bytes.length, expanded, 'Manifest length mismatch');
      manifest = bytes.toString('utf8').replaceAll('\r\n', '\n').replace(/\n /g, '');
    }
    cursor += 46 + nameLength + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
  }
  return (manifest ?? '').split('\n\n')[0].split('\n')
    .filter(line => /^class-path:/i.test(line))
    .flatMap(line => line.slice(line.indexOf(':') + 1).trim().split(/\s+/).filter(Boolean));
}

// Only the finite bundled include set is extracted, never arbitrary archive paths.
export const googleIncludes = Object.freeze([
  'any', 'api', 'compiler/plugin', 'descriptor', 'duration', 'empty', 'field_mask',
  'source_context', 'struct', 'timestamp', 'type', 'wrappers',
].map(name => `google/protobuf/${name}.proto`));

export function zipMembers(path, names) {
  const zip = readFileSync(regular(path));
  const wanted = new Set(names);
  assert.equal(wanted.size, names.length, 'Repeated ZIP member');
  for (const name of names) assert(/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/.test(name), `Unsafe ZIP member: ${name}`);
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) { end = i; break; }
  }
  assert(end >= 0, `Missing ZIP directory: ${path}`);
  assert.equal(zip.readUInt16LE(end + 4), 0, 'Multi-disk ZIP is unsupported');
  assert.equal(zip.readUInt16LE(end + 6), 0, 'Multi-disk ZIP is unsupported');
  const count = zip.readUInt16LE(end + 10);
  assert(count !== 0xffff && count === zip.readUInt16LE(end + 8), 'ZIP64 is unsupported');
  let cursor = zip.readUInt32LE(end + 16);
  const result = new Map();
  for (let index = 0; index < count; index++) {
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50, 'Invalid ZIP entry');
    const size = zip.readUInt32LE(cursor + 20);
    const expanded = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (wanted.has(name)) {
      assert(!result.has(name), `Duplicate ZIP member: ${name}`);
      assert.equal(zip.readUInt16LE(cursor + 8) & 1, 0, 'Encrypted ZIP is unsupported');
      const method = zip.readUInt16LE(cursor + 10);
      const local = zip.readUInt32LE(cursor + 42);
      assert.equal(zip.readUInt32LE(local), 0x04034b50, 'Invalid local ZIP header');
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      assert(start + size <= zip.length && expanded <= 1024 * 1024, 'Invalid include size');
      assert(method === 0 || method === 8, 'Unsupported ZIP compression');
      const packed = zip.subarray(start, start + size);
      const bytes = method === 0 ? Buffer.from(packed) : inflateRawSync(packed, { maxOutputLength: 1024 * 1024 });
      assert.equal(bytes.length, expanded, 'Include length mismatch');
      result.set(name, bytes);
    }
    cursor += 46 + nameLength + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
  }
  for (const name of names) assert(result.has(name), `Missing ZIP member: ${name} in ${path}`);
  return result;
}

export function absolutePath(value, label) {
  assert(typeof value === 'string' && isAbsolute(value), `${label} requires an absolute path`);
  assert(!/[\x00-\x1f\x7f:]/u.test(value), `${label} contains a control character or classpath separator`);
  assert.equal(resolve(value), value, `${label} must be a normalized absolute path`);
  return value;
}

export function privateOutput(out, inputs) {
  absolutePath(out, '--out');
  const parent = dirname(out);
  assert(lstatSync(parent).isDirectory(), 'Output parent must be an existing directory');
  assert.equal(realpathSync(parent), parent, 'Symlink in output parent');
  assert(!present(out), `Output must be absent (including symlinks): ${out}`);
  for (const input of inputs) {
    assert(!within(out, input) && !within(input, out), `Output must be outside input trees: ${input}`);
  }
  for (let ancestor = parent; ; ancestor = dirname(ancestor)) {
    assert(!present(join(ancestor, '.git')), `Output must not be inside a Git worktree: ${ancestor}`);
    if (dirname(ancestor) === ancestor) break;
  }
  mkdirSync(out, { mode: 0o700 });
  assert.equal(realpathSync(out), out);
  const destination = name => {
    const path = resolve(out, name);
    assert(path !== out && within(path, out), `Write escaped output: ${name}`);
    return path;
  };
  const directory = name => {
    const path = destination(name);
    mkdirSync(path, { recursive: true, mode: 0o700 });
    assert.equal(realpathSync(path), path, `Output symlink: ${path}`);
    return path;
  };
  const write = (name, bytes, mode = 0o600) => {
    const path = destination(name);
    if (dirname(path) !== out) directory(dirname(path).slice(out.length + 1));
    assert.equal(realpathSync(dirname(path)), dirname(path));
    writeFileSync(path, bytes, { flag: 'wx', mode });
    return path;
  };
  return { out, directory, write, json: (name, value) => write(name, JSON.stringify(value, null, 2) + '\n') };
}

// Direct, fixed versions from the actual offline POM closure; no resolver/server.
export function offlineToolchain(java, cache, protoc) {
  assert.equal(process.platform, 'darwin', 'Darwin sandbox-exec is required; no unsandboxed fallback');
  for (const [label, path] of [['--java', java], ['--maven-cache', cache], ['--protoc', protoc]]) absolutePath(path, label);
  const sandbox = regular('/usr/bin/sandbox-exec');
  for (const executable of [sandbox, regular(java), regular(protoc)]) accessSync(executable, constants.X_OK);
  const javaHome = dirname(dirname(java));
  const release = regular(join(javaHome, 'release'));
  assert(/^JAVA_VERSION="11\./m.test(readFileSync(release, 'utf8')), 'An explicit JDK 11 is required');
  assert(lstatSync(cache).isDirectory() && realpathSync(cache) === cache, 'Cache must be a real directory without symlinks');
  const artifacts = [
    ['org.scala-lang', 'scala-compiler', '2.13.14'],
    ['org.scala-lang', 'scala-library', '2.13.14'],
    ['org.scala-lang', 'scala-reflect', '2.13.14'],
    ['io.github.java-diff-utils', 'java-diff-utils', '4.12'],
    ['org.jline', 'jline', '3.25.1'],
    ['net.java.dev.jna', 'jna', '5.14.0'],
    ['com.thesamet.scalapb', 'compilerplugin_2.13', '0.11.14'],
    ['com.thesamet.scalapb', 'protoc-gen_2.13', '0.9.6'],
    ['com.thesamet.scalapb', 'protoc-bridge_2.13', '0.9.6'],
    ['dev.dirs', 'directories', '26'],
    ['com.google.protobuf', 'protobuf-java', '3.19.6'],
    ['org.scala-lang.modules', 'scala-collection-compat_2.13', '2.11.0'],
    ['com.thesamet.scalapb', 'scalapb-runtime_2.13', '0.11.14'],
    ['com.thesamet.scalapb', 'lenses_2.13', '0.11.14'],
    ['org.scalatest', 'scalatest-core_2.13', '3.2.15'],
    ['org.scalatest', 'scalatest-funsuite_2.13', '3.2.15'],
    ['org.scalatest', 'scalatest-compatible', '3.2.15'],
    ['org.scalactic', 'scalactic_2.13', '3.2.15'],
    ['org.scala-lang.modules', 'scala-xml_2.13', '2.1.0'],
    ['org.scalatest', 'scalatest-wordspec_2.13', '3.2.15'],
  ].map(([group, artifact, version]) => {
    const stem = join(cache, ...group.split('.'), artifact, version, `${artifact}-${version}`);
    return { coordinate: `${group}:${artifact}:${version}`, jar: regular(stem + '.jar'), pom: regular(stem + '.pom') };
  });
  const jars = artifacts.map(row => row.jar);
  const compiler = jars.slice(0, 6);
  const library = jars[1];
  const plugin = [library, ...jars.slice(6, 12)];
  const runtime = [library, jars[10], jars[11], ...jars.slice(12, 14)];
  const testLibraries = [library, jars[2], ...jars.slice(14)];
  const manifests = jars.map(path => ({ path, classPath: manifestClassPath(path) }));
  for (const row of manifests) for (const token of row.classPath) {
    assert(/^[A-Za-z0-9_.-]+\.jar$/.test(token), `Unsafe manifest classpath: ${token}`);
    const dependency = join(dirname(row.path), token);
    if (present(dependency)) assert(jars.includes(regular(dependency)), `Unrecorded manifest dependency: ${dependency}`);
    else assert(row.path === compiler[0] && ['scala-library.jar', 'scala-reflect.jar'].includes(token), `Missing manifest dependency: ${dependency}`);
  }
  const includeArtifacts = [jars[6], jars[10], jars[12]];
  const includeHashes = snapshot(includeArtifacts);
  const includes = new Map([
    ...zipMembers(jars[6], ['scalapb/scalapb.proto']),
    ...zipMembers(jars[10], googleIncludes),
  ]);
  assert(zipMembers(jars[12], ['scalapb/scalapb.proto']).get('scalapb/scalapb.proto').equals(includes.get('scalapb/scalapb.proto')), 'ScalaPB include versions disagree');
  assert.deepEqual(snapshot(includeArtifacts), includeHashes, 'Include artifacts changed during extraction');
  const pomOnly = [
    ['com.google.protobuf', 'protobuf-parent', '3.19.6'], ['com.google.protobuf', 'protobuf-bom', '3.19.6'],
    ['io.github.java-diff-utils', 'java-diff-utils-parent', '4.12'], ['org.jline', 'jline-parent', '3.25.1'],
    ['com.google', 'google', '1'], ['com.google.protobuf', 'protoc', '3.21.9'],
  ].map(([group, artifact, version]) => regular(join(cache, ...group.split('.'), artifact, version, `${artifact}-${version}.pom`)));
  return { java, javaHome, release, cache, protoc, sandbox, artifacts, compiler, library, plugin, runtime,
    testLibraries, manifests, includes, includeHashes, paths: [java, release, protoc, sandbox, ...artifacts.flatMap(row => [row.jar, row.pom]), ...pomOnly] };
}

const environmentFailure = /sandbox-exec:|Operation not permitted|Permission denied|Could not (?:find|create)|Unable to (?:access jarfile|initialize main class)|NoClassDefFoundError|ClassNotFoundException|MissingRequirementError|NoSuchMethodError|NoSuchFieldError|UnsupportedClassVersionError|LinkageError|OutOfMemoryError|StackOverflowError|Exception in thread|Error occurred during initialization|error while loading|bad symbolic reference|error accessing|object scalatest is not a member|object scalactic is not a member|object xml is not a member|not found: type AnyFunSuite|not found: value (?:test|assert)|object scala in compiler mirror not found|zip END header not found|ZipException|IOError|IOException|FatalError|program not found or is not executable|Plugin failed|protoc-gen-scala:.*not found/i;

export function acceptance(result, expected = { kind: 'success' }) {
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const output = stdout + '\n' + stderr;
  const environmentError = environmentFailure.test(output);
  const errors = output.match(/^.*\.scala:\d+: error:[\s\S]*?(?=^.*\.scala:\d+: error:|(?![\s\S]))/gm) ?? [];
  const diagnosticMatch = expected.kind !== 'compiler-rejection' || (
    errors.length > 0 && errors.every(error => error.split('\n')[0].includes(`${expected.file}:`)) &&
    expected.diagnostics.length > 0 && expected.diagnostics.every(pattern => errors.some(error => pattern.test(error))) &&
    errors.some(error => error.includes(expected.symbol))
  );
  const lines = expected.kind === 'suites' ? new Set(stdout.split('\n')) : null;
  const suiteMatch = expected.kind !== 'suites' || (
    /All tests passed\./.test(stdout) &&
    new RegExp(`Total number of tests run: ${expected.tests}(?:\\s|$)`).test(stdout) &&
    new RegExp(`Expected test count is: ${expected.tests}(?:\\s|$)`).test(stdout) &&
    new RegExp(`Suites: completed ${expected.suites.length}, aborted 0(?:\\s|$)`).test(stdout) &&
    new RegExp(`Tests: succeeded ${expected.tests}, failed 0, canceled 0, ignored 0, pending 0(?:\\s|$)`).test(stdout) &&
    expected.suites.every(suite => lines.has(basename(suite.replaceAll('.', '/')) + ':')) &&
    (!expected.testNames || expected.testNames.every(name => lines.has('- ' + name)))
  );
  const textMatch = !expected.pattern || expected.pattern.test(output);
  const accepted = !result.error && result.signal === null && !environmentError &&
    result.status === (expected.kind === 'compiler-rejection' ? 1 : 0) && diagnosticMatch && suiteMatch && textMatch;
  return { accepted, environmentError, diagnosticMatch, suiteMatch, textMatch };
}

export function compilerSession(io, tools, { suiteRejectionAcceptance } = {}) {
  assert(suiteRejectionAcceptance === undefined || typeof suiteRejectionAcceptance === 'function', 'Invalid suite rejection handler');
  // Test-only finite seam; all existing/default kinds retain the original predicate.
  const accept = (result, expected) => expected.kind === 'suite-rejection'
    ? (assert(typeof suiteRejectionAcceptance === 'function', 'Missing suite rejection handler; fail closed'), suiteRejectionAcceptance(result, expected))
    : acceptance(result, expected);
  const home = io.directory('home');
  const tmp = io.directory('tmp');
  const profile = io.write('sandbox.sb', `(version 1)
(allow default)
(deny network*)
(deny file-write* (require-not (subpath ${JSON.stringify(io.out)})))
(allow file-write* (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom"))
`);
  const runs = [];
  io.directory('logs');
  const javaArgs = [
    '-Xmx512m', '-XX:ActiveProcessorCount=2', '-XX:-UsePerfData',
    '-Dfile.encoding=UTF-8', '-Dsun.jnu.encoding=UTF-8', '-Dscala.usejavacp=false',
    `-Duser.home=${home}`, `-Djava.io.tmpdir=${tmp}`, `-XX:ErrorFile=${tmp}/hs_err_pid%p.log`, `-XX:HeapDumpPath=${tmp}`,
  ];
  function launch(label, executable, args, expected = { kind: 'success' }, details = {}) {
    if (expected.kind === 'suite-rejection') assert(typeof suiteRejectionAcceptance === 'function', 'Missing suite rejection handler; fail closed');
    assert(!process.env.NODE_TEST_CONTEXT, 'NODE_TEST_CONTEXT forbids compiler/native execution');
    assert(/^[a-z0-9-]+$/.test(label) && !runs.some(run => run.label === label), 'Invalid or repeated phase label');
    assert([tools.java, tools.protoc].includes(executable), 'Only explicit java/protoc are permitted');
    return execute(label, executable, args, expected, details);
  }
  async function execute(label, executable, args, expected, details) {
    const stem = `logs/${String(runs.length + 1).padStart(2, '0')}-${label}`;
    const lifecycle = await runVerifiedProcess({ executable, args, cwd: io.out,
      env: { HOME: home, TMPDIR: tmp, TMP: tmp, TEMP: tmp, JAVA_HOME: tools.javaHome,
        PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
      base: join(io.out, stem + '-process'), timeoutMs: 120000,
      sandbox: { executable: tools.sandbox, profile, profileSha256: hash(profile) },
    });
    const result = { stdout: readFileSync(lifecycle.paths.stdout, 'utf8'), stderr: readFileSync(lifecycle.paths.stderr, 'utf8'),
      status: lifecycle.code, signal: lifecycle.signal,
      error: lifecycle.timedOut || lifecycle.cancelled || lifecycle.launchError || lifecycle.outputError || lifecycle.outputLimitExceeded ||
        lifecycle.leftoverGroup || lifecycle.groupAliveAfter || !lifecycle.directChildReaped || !lifecycle.sandboxProfileUnchanged || lifecycle.terminationErrors.length ?
        { code: 'PROCESS_LIFECYCLE_FAILED' } : null };
    io.write(`${stem}.stdout.log`, result.stdout);
    io.write(`${stem}.stderr.log`, result.stderr);
    const phase = { label, command: lifecycle.command, lifecycle: lifecycle.paths.receipt, ...details,
      expected: { ...expected, diagnostics: expected.diagnostics?.map(pattern => pattern.source), pattern: expected.pattern?.source,
        ...(expected.kind === 'suite-rejection' ? { diagnostic: expected.diagnostic?.source } : {}) },
      exitCode: result.status, signal: result.signal, processError: result.error,
      ...accept(result, expected), stdout: `${stem}.stdout.log`, stderr: `${stem}.stderr.log` };
    runs.push(phase);
    io.json(`${stem}.json`, phase);
    console.log(`${label}: ${phase.accepted ? 'passed' : 'FAILED'}`);
    assert(phase.accepted, `${label} failed; inspect ${io.out}/${stem}.*`);
    return phase;
  }
  const jvm = (label, args, expected, details) => launch(label, tools.java, [...javaArgs, ...args], expected, details);
  const compile = (label, sources, targetClasspath, target, expected) => jvm(label, [
    '-cp', tools.compiler.join(delimiter), 'scala.tools.nsc.Main', '-encoding', 'UTF-8', '-deprecation', '-feature', '-unchecked',
    '-classpath', targetClasspath.join(delimiter), '-d', target, ...sources,
  ], expected, { sources, targetClasspath, classOutput: target });
  // Fixed shell launcher only for protoc's native plugin protocol. No user command interpolation.
  const shellToken = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const pluginArgs = [tools.java, ...javaArgs, '-cp', tools.plugin.join(delimiter), 'scalapb.ScalaPbCodeGenerator'];
  const plugin = io.write('tools/protoc-gen-scala', '#!/bin/sh\nexec ' + pluginArgs.map(shellToken).join(' ') + '\n', 0o700);
  const includeRoot = io.directory('includes');
  for (const [name, bytes] of tools.includes) io.write(`includes/${name}`, bytes);
  const generate = (label, protoRoot, protos, managed) => launch(label, tools.protoc, [
    `--plugin=protoc-gen-scala=${plugin}`, `--proto_path=${protoRoot}`, `--proto_path=${includeRoot}`,
    `--scala_out=${managed}`, ...protos,
  ], undefined, { protos, includeRoot, plugin, pluginCommand: pluginArgs, managedSources: managed });
  const protocVersion = () => launch('protoc-version', tools.protoc, ['--version'], { kind: 'success', pattern: /^libprotoc 3\.21\.9\s*$/m });
  return { runs, jvm, compile, generate, protocVersion };
}
