import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  accessSync, constants, lstatSync, mkdirSync, readFileSync,
  realpathSync, writeFileSync,
} from 'node:fs';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { regular, within, files, hash, snapshot, manifestClassPath } from '../compiler-tools.mjs';

const reference = realpathSync(dirname(fileURLToPath(import.meta.url)));
const compilerHelper = regular(fileURLToPath(new URL('../compiler-tools.mjs', import.meta.url)));
const flags = new Set(['--java', '--maven-cache', '--out']);

function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    assert(flags.has(flag), `Unknown flag: ${flag}`);
    assert(!Object.hasOwn(result, flag), `Repeated flag: ${flag}`);
    const value = args[i + 1];
    assert(value && !value.startsWith('--'), `Missing value: ${flag}`);
    assert(isAbsolute(value), `${flag} requires an absolute path`);
    assert(!/[\x00-\x1f\x7f:]/u.test(value), `${flag} contains a control character or classpath separator`);
    result[flag] = resolve(value);
  }
  for (const flag of flags) assert(Object.hasOwn(result, flag), `Missing flag: ${flag}`);
  return result;
}

function present(path) {
  try { lstatSync(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function main() {
  const args = options(process.argv.slice(2));
  assert.equal(process.platform, 'darwin', 'Darwin sandbox-exec is required; no unsandboxed fallback');
  const sandbox = '/usr/bin/sandbox-exec';
  accessSync(sandbox, constants.X_OK);
  const java = regular(args['--java']);
  accessSync(java, constants.X_OK);
  const javaHome = dirname(dirname(java));
  const release = regular(join(javaHome, 'release'));
  const javaRelease = readFileSync(release, 'utf8');
  assert(/^JAVA_VERSION="11\./m.test(javaRelease), 'An explicit JDK 11 is required');
  const cache = realpathSync(args['--maven-cache']);
  assert(lstatSync(cache).isDirectory(), 'Maven cache must be a directory');
  const parent = realpathSync(dirname(args['--out']));
  const out = join(parent, basename(args['--out']));
  assert(!present(out), `Output must be absent (including symlinks): ${out}`);
  for (const input of [reference, cache, javaHome]) {
    assert(!within(out, input), `Output must be outside input trees: ${input}`);
  }
  for (let ancestor = parent; ; ancestor = dirname(ancestor)) {
    assert(!present(join(ancestor, '.git')), `Output must not be inside a Git worktree: ${ancestor}`);
    if (dirname(ancestor) === ancestor) break;
  }

  const jar = (group, artifact, version) => regular(join(
    cache, ...group.split('.'), artifact, version, `${artifact}-${version}.jar`,
  ));
  const compiler = ['scala-compiler', 'scala-library', 'scala-reflect']
    .map(artifact => jar('org.scala-lang', artifact, '2.13.14'));
  const library = compiler[1];
  const testLibraries = [
    library, compiler[2],
    jar('org.scalatest', 'scalatest-core_2.13', '3.2.15'),
    jar('org.scalatest', 'scalatest-funsuite_2.13', '3.2.15'),
    jar('org.scalatest', 'scalatest-compatible', '3.2.15'),
    jar('org.scalactic', 'scalactic_2.13', '3.2.15'),
    jar('org.scala-lang.modules', 'scala-xml_2.13', '2.1.0'),
  ];
  const jars = [...new Set([...compiler, ...testLibraries])];
  const inputFiles = files(reference);
  const before = { inputs: snapshot(inputFiles), toolchain: snapshot([java, release, ...jars, compilerHelper]) };
  const manifests = jars.map(path => ({ path, classPath: manifestClassPath(path) }));
  for (const row of manifests) {
    for (const token of row.classPath) {
      assert(/^[A-Za-z0-9_.-]+\.jar$/.test(token), `Unsafe manifest classpath: ${token}`);
      const dependency = join(dirname(row.path), token);
      if (present(dependency)) {
        assert(jars.includes(regular(dependency)), `Unrecorded manifest dependency: ${dependency}`);
      } else {
        assert(row.path === compiler[0] && ['scala-library.jar', 'scala-reflect.jar'].includes(token),
          `Missing manifest dependency: ${dependency}`);
      }
    }
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
  const write = (name, bytes) => {
    const path = destination(name);
    if (dirname(path) !== out) directory(relative(out, dirname(path)));
    assert.equal(realpathSync(dirname(path)), dirname(path));
    writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
    return path;
  };
  const json = (name, value) => write(name, JSON.stringify(value, null, 2) + '\n');
  const runs = [];
  let stagedBefore;
  let failure;
  let after;
  let stagedAfter;
  let hashesUnchanged = false;
  const compilerPairs = [];

  try {
    json('hashes-before.json', before);
    json('classpath.json', { java, release, compiler, library, testLibraries, manifests });
    const copied = new Map(inputFiles.map(path => [path, write(join('inputs', relative(reference, path)), readFileSync(path))]));
    const sourcePaths = prefix => inputFiles.filter(path =>
      within(path, join(reference, prefix)) && path.endsWith('.scala')).map(path => copied.get(path));
    const sourceSets = {
      kernel: sourcePaths('modules/kernel/src/main/scala'),
      glue: sourcePaths('modules/glue/src/main/scala'),
      ext: sourcePaths('modules/ext/src/main/scala'),
      root: sourcePaths('src/main/scala'),
      kernelTest: sourcePaths('modules/kernel/src/test/scala'),
      rootTest: sourcePaths('src/test/scala'),
    };
    for (const [name, paths] of Object.entries(sourceSets)) assert(paths.length > 0, `No ${name} sources`);
    const classes = Object.fromEntries(Object.keys(sourceSets).map(name => [name, directory(`classes/${name}`)]));
    const kernelCP = [library, classes.kernel];
    const glueCP = [...kernelCP, classes.glue];
    const allCP = [...glueCP, classes.ext];
    const rootCP = [...allCP, classes.root];
    const testControl = write('fixtures/red-reference/control/TestDependencyControl.scala', `package example.parcel.reference
import org.scalatest.funsuite.AnyFunSuite
final class TestDependencyControl extends AnyFunSuite {
  test("ScalaTest is available without production") { assert(Vector(1, 2).sum == 3) }
}
`);
    const redSources = sourceSets.kernelTest.map(path => write(
      join('fixtures/red-reference/negative', basename(path)), readFileSync(path),
    ));

    function pair(name, filename, controlSource, negativeSource, controlCP, negativeCP, diagnostics) {
      const control = write(`fixtures/${name}/control/${filename}`, controlSource);
      const negative = write(`fixtures/${name}/negative/${filename}`, negativeSource);
      compilerPairs.push({ name, filename, control, negative, controlCP, negativeCP, diagnostics });
    }
    const importedExt = `package example.parcel.domain
import example.parcel.application.DefaultQuoteFlow
object KernelImportsExt { def implementation: Class[DefaultQuoteFlow] = classOf[DefaultQuoteFlow] }
`;
    const missingExt = /(?:object|type) DefaultQuoteFlow is not a member/;
    pair('kernel-imports-ext', 'KernelImportsExt.scala', importedExt, importedExt,
      allCP, kernelCP, [missingExt]);
    const nested = `package example.parcel.domain.ports
import scala.concurrent.Future
trait OuterSignaturePort {
  def candidates: Future[Option[Vector[example.parcel.application.DefaultQuoteFlow]]]
}
`;
    pair('nested-signature-closure', 'OuterSignaturePort.scala', nested, nested,
      allCP, kernelCP, [/type DefaultQuoteFlow is not a member/]);
    const glueImport = `package example.parcel.infrastructure
import example.parcel.application.DefaultQuoteFlow
object GlueImportsExt { def implementation: Class[DefaultQuoteFlow] = classOf[DefaultQuoteFlow] }
`;
    pair('glue-imports-ext', 'GlueImportsExt.scala', glueImport, glueImport,
      allCP, glueCP, [missingExt]);
    const extBridge = `package example.parcel.domain.ports
import example.parcel.application.DefaultQuoteFlow
import example.parcel.domain.QuoteError
import example.parcel.domain.values._
import scala.concurrent.Await
import scala.concurrent.duration.Duration
final class ExtDelegatingCapacityBridge(flow: DefaultQuoteFlow) extends CapacityPolicy {
  override def assess(route: Route, parcels: Vector[Parcel]): Either[QuoteError, Load] =
    Await.result(flow.quote(QuoteRequest(route.id, parcels)), Duration.Zero).map(_.load)
}
`;
    pair('kernel-bridge-delegates-ext', 'ExtDelegatingCapacityBridge.scala', extBridge, extBridge,
      allCP, kernelCP, [missingExt]);
    const moduleSource = readFileSync(sourceSets.root.find(path => basename(path) === 'ParcelModule.scala'), 'utf8');
    pair('root-omits-implementations', 'ParcelModule.scala', moduleSource, moduleSource,
      allCP, kernelCP, [missingExt, /not found: type InMemoryRouteRepository/]);
    const binding = capacity => `package example.parcel.composition
import example.parcel.application.DefaultQuoteFlow
import example.parcel.application.ports.{QuoteFlow, RouteRepository}
import example.parcel.domain.ports.CapacityPolicy
import scala.concurrent.ExecutionContext
object MissingConstructorParameter {
  def create(repository: RouteRepository, capacity: CapacityPolicy)(implicit ec: ExecutionContext): QuoteFlow =
    new DefaultQuoteFlow(repository${capacity ? ', capacity' : ''})
}
`;
    pair('root-omits-constructor-parameter', 'MissingConstructorParameter.scala', binding(true), binding(false),
      allCP, allCP, [/not enough arguments for constructor DefaultQuoteFlow/, /Unspecified value parameter capacity/]);
    const implementation = correct => `package example.parcel.application
import example.parcel.application.ports.QuoteFlow
import example.parcel.domain.QuoteError
import example.parcel.domain.values._
import scala.concurrent.Future
final class WrongResultType extends QuoteFlow {
  override def quote(request: QuoteRequest): Future[Either[QuoteError, ${correct ? 'Quote' : 'Load'}]] =
    Future.successful(Right(${correct ? 'Quote(request.routeId, Load(1))' : 'Load(1)'}))
}
`;
    pair('wrong-implementation-result', 'WrongResultType.scala', implementation(true), implementation(false),
      kernelCP, kernelCP, [/(?:incompatible type in overriding|method quote has incompatible type)/, /(?:def|method) quote/]);
    assert.equal(compilerPairs.length, 7);
    json('negative-cases.json', compilerPairs.map(({ diagnostics, ...entry }) => ({
      ...entry, expectedDiagnostics: diagnostics.map(pattern => pattern.source),
    })));

    const home = directory('home');
    const tmp = directory('tmp');
    const profile = write('sandbox.sb', `(version 1)
(allow default)
(deny network*)
(deny file-write* (require-not (subpath ${JSON.stringify(out)})))
(allow file-write* (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom"))
`);
    stagedBefore = snapshot([...files(join(out, 'inputs')), ...files(join(out, 'fixtures'))]);
    json('staged-hashes-before.json', stagedBefore);
    const environmentFailure = /sandbox-exec:|Operation not permitted|Permission denied|Could not (?:find|create)|Unable to (?:access jarfile|initialize main class)|NoClassDefFoundError|ClassNotFoundException|MissingRequirementError|NoSuchMethodError|NoSuchFieldError|UnsupportedClassVersionError|LinkageError|OutOfMemoryError|StackOverflowError|Exception in thread|Error occurred during initialization|error while loading|bad symbolic reference|error accessing|object scalatest is not a member|object scalactic is not a member|object xml is not a member|not found: type AnyFunSuite|not found: value (?:test|assert)|object scala in compiler mirror not found|zip END header not found|ZipException|IOError|IOException|FatalError/i;

    function launch(label, args, expectation = { kind: 'success' }, details = {}) {
      const stem = `logs/${String(runs.length + 1).padStart(2, '0')}-${label}`;
      const command = [
        '-f', profile, java, '-Xmx512m', '-XX:ActiveProcessorCount=2', '-XX:-UsePerfData',
        '-Dfile.encoding=UTF-8', '-Dsun.jnu.encoding=UTF-8', '-Dscala.usejavacp=false',
        `-Duser.home=${home}`, `-Djava.io.tmpdir=${tmp}`, `-XX:ErrorFile=${tmp}/hs_err_pid%p.log`,
        `-XX:HeapDumpPath=${tmp}`, ...args,
      ];
      const result = spawnSync(sandbox, command, {
        cwd: out,
        env: {
          HOME: home, TMPDIR: tmp, TMP: tmp, TEMP: tmp, JAVA_HOME: javaHome,
          PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8',
        },
        encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024,
      });
      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';
      write(`${stem}.stdout.log`, stdout);
      write(`${stem}.stderr.log`, stderr);
      const output = stdout + '\n' + stderr;
      const errors = output.match(/^.*\.scala:\d+: error:[\s\S]*?(?=^.*\.scala:\d+: error:|(?![\s\S]))/gm) ?? [];
      const cleanProcess = !result.error && result.signal === null && !environmentFailure.test(output);
      const diagnosticMatch = expectation.kind !== 'compiler-rejection' || (
        errors.length > 0 && errors.every(error => error.split('\n')[0].includes(`${expectation.file}:`)) &&
        expectation.diagnostics.every(pattern => errors.some(error => pattern.test(error)))
      );
      const expectedExit = expectation.kind === 'compiler-rejection' ? 1 : 0;
      const suiteMatch = expectation.kind !== 'suites' || (
        /All tests passed\./.test(stdout) &&
        new RegExp(`Total number of tests run: ${expectation.tests}(?:\\s|$)`).test(stdout)
      );
      const accepted = cleanProcess && result.status === expectedExit && diagnosticMatch && suiteMatch;
      const phase = {
        label, command: [sandbox, ...command], ...details,
        expected: { ...expectation, diagnostics: expectation.diagnostics?.map(pattern => pattern.source) },
        exitCode: result.status, signal: result.signal,
        processError: result.error ? { code: result.error.code, message: result.error.message } : null,
        environmentError: environmentFailure.test(output), diagnosticMatch, accepted,
        stdout: `${stem}.stdout.log`, stderr: `${stem}.stderr.log`,
      };
      runs.push(phase);
      json(`${stem}.json`, phase);
      console.log(`${label}: ${accepted ? (expectedExit === 1 ? 'expected compiler rejection' : 'passed') : 'FAILED'}`);
      assert(accepted, `${label} did not meet its acceptance condition; inspect ${out}/${stem}.*`);
    }

    function compile(label, sources, targetClasspath, output, expectation) {
      const target = output ?? directory(`compilations/${label}`);
      launch(label, [
        '-cp', compiler.join(delimiter), 'scala.tools.nsc.Main',
        '-encoding', 'UTF-8', '-deprecation', '-feature', '-unchecked',
        '-classpath', targetClasspath.join(delimiter), '-d', target, ...sources,
      ], expectation, { sources, targetClasspath, classOutput: target });
    }

    compile('kernel-production', sourceSets.kernel, [library], classes.kernel);
    compile('glue-production', sourceSets.glue, kernelCP, classes.glue);
    compile('ext-production', sourceSets.ext, glueCP, classes.ext);
    compile('root-production', sourceSets.root, allCP, classes.root);
    compile('red-reference-dependency-control', [testControl], testLibraries);
    compile('red-reference-no-implementation', redSources, testLibraries, undefined, {
      kind: 'compiler-rejection', file: 'CapacityRuleSpec.scala',
      diagnostics: [/not found: type Route\b/, /not found: value CapacityRule\b/],
    });
    for (const entry of compilerPairs) {
      compile(`${entry.name}-control`, [entry.control], entry.controlCP);
      compile(`${entry.name}-negative`, [entry.negative], entry.negativeCP, undefined, {
        kind: 'compiler-rejection', file: entry.filename, diagnostics: entry.diagnostics,
      });
    }
    compile('kernel-tests', sourceSets.kernelTest, [...testLibraries, classes.kernel], classes.kernelTest);
    compile('root-tests', sourceSets.rootTest, [...testLibraries, ...rootCP.slice(1)], classes.rootTest);
    launch('kernel-suites', [
      '-cp', [...testLibraries, classes.kernel, classes.kernelTest].join(delimiter),
      'org.scalatest.tools.Runner', '-R', classes.kernelTest, '-oW',
      '-s', 'example.parcel.domain.CapacityRuleSpec',
    ], { kind: 'suites', tests: 20 });
    launch('root-suites', [
      '-cp', [...testLibraries, ...rootCP.slice(1), classes.rootTest].join(delimiter),
      'org.scalatest.tools.Runner', '-R', classes.rootTest, '-oW',
      '-s', 'example.parcel.application.QuoteFlowSpec', '-s', 'example.parcel.composition.ParcelModuleSpec',
    ], { kind: 'suites', tests: 14 });
    assert.equal(runs.length, 24);
  } catch (error) {
    failure = error.stack ?? String(error);
  } finally {
    try {
      after = { inputs: snapshot(files(reference)), toolchain: snapshot([java, release, ...jars, compilerHelper]) };
      json('hashes-after.json', after);
      assert.deepEqual(after, before, 'Reference inputs or toolchain bytes changed');
      if (stagedBefore) {
        stagedAfter = snapshot([...files(join(out, 'inputs')), ...files(join(out, 'fixtures'))]);
        json('staged-hashes-after.json', stagedAfter);
        assert.deepEqual(stagedAfter, stagedBefore, 'Staged compiler inputs changed');
      }
      hashesUnchanged = true;
    } catch (error) {
      failure = [failure, error.stack ?? String(error)].filter(Boolean).join('\n');
    }
    const passed = !failure && hashesUnchanged && runs.length === 24 && runs.every(run => run.accepted);
    json('execution.json', {
      candidate: 'module-seams', passed, failure: failure ?? null, hashesUnchanged,
      writeRoot: out, network: 'denied', timeoutMsPerPhase: 120000,
      java, javaRelease,
      negativePairsDefined: compilerPairs.length,
      negativePairsPassed: compilerPairs.filter(entry =>
        runs.some(run => run.label === `${entry.name}-control` && run.accepted) &&
        runs.some(run => run.label === `${entry.name}-negative` && run.accepted)).length,
      noImplementationRed: runs.some(run => run.label === 'red-reference-no-implementation' && run.accepted),
      runs, approval: 'not conferred by mechanical verification',
    });
    if (!passed) process.exitCode = 1;
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${join(out, 'execution.json')}`);
  }
}

if (!process.env.NODE_TEST_CONTEXT) {
  try {
    main();
  } catch (error) {
    console.error(error.stack ?? String(error));
    process.exitCode = 1;
  }
}
