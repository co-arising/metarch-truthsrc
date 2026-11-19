import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { captureEvidenceFile, fingerprintEvidenceFile } from '../../lib/verification/files.mjs';
import { runVerifiedProcess, processFailureState } from '../../lib/verification/process.mjs';
import { artifactStem, declaredPom } from './compiler-pom.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CANDIDATE = process.env.QUALITY_CANDIDATE
  ? path.resolve(process.env.QUALITY_CANDIDATE)
  : path.join(ROOT, 'test/reference/curated/connector-implementation/v1');
const DEFAULT_ROUND = path.join(ROOT, '.rounds/connector-implementation-quality-20261119-03');
const CACHE = '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2';
const JAVA_HOME = '/Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk/Contents/Home';
const JAVA = path.join(JAVA_HOME, 'bin/java');
const SCALA = '2.13.14';
const COORDINATES = [
  `org.scala-lang:scala-compiler:${SCALA}`, `org.scala-lang:scala-library:${SCALA}`,
  `org.scala-lang:scala-reflect:${SCALA}`, 'io.github.java-diff-utils:java-diff-utils:4.12',
  'org.jline:jline:3.25.1', 'net.java.dev.jna:jna:5.14.0',
  'com.google.inject:guice:4.2.1', 'javax.inject:javax.inject:1',
  'com.google.guava:guava:25.1-android', 'com.google.code.findbugs:jsr305:3.0.2',
  'org.checkerframework:checker-compat-qual:2.0.0', 'com.google.errorprone:error_prone_annotations:2.1.3',
  'com.google.j2objc:j2objc-annotations:1.1', 'org.codehaus.mojo:animal-sniffer-annotations:1.14',
  'org.scalacheck:scalacheck_2.13:1.16.0', 'org.scala-sbt:test-interface:1.0',
  'org.scalameta:parsers_2.13:4.7.7', 'org.scalameta:trees_2.13:4.7.7',
  'org.scalameta:common_2.13:4.7.7', 'org.scalameta:fastparse-v2_2.13:2.3.1',
  'com.lihaoyi:sourcecode_2.13:0.3.0', 'com.lihaoyi:geny_2.13:0.6.5',
  'org.scala-lang.modules:scala-collection-compat_2.13:2.7.0',
  'com.thesamet.scalapb:scalapb-runtime_2.13:0.11.11', 'com.thesamet.scalapb:lenses_2.13:0.11.11',
  'com.google.protobuf:protobuf-java:3.19.2',
];
const PARENTS = [
  'io.github.java-diff-utils:java-diff-utils-parent:4.12', 'org.jline:jline-parent:3.25.1',
  'com.google.inject:guice-parent:4.2.1', 'com.google.guava:guava-parent:25.1-android',
  'com.google.protobuf:protobuf-parent:3.19.2',
  'com.google.protobuf:protobuf-bom:3.19.2',
];
// guice declares aopalliance for AOP method interception only; the sample never
// binds interceptors, so that library stays off the loaded path and out of the
// pinned supply. Every other declared compile dependency is selected above.
const unconsumedLibraryDeps = new Map([
  ['aopalliance:aopalliance', 'Declared for AOP method interception only; the sample never binds interceptors'],
]);
// The pinned guice artifact is the published no_aop variant: identical core
// binding and Injector machinery, without the AOP interception machinery the
// sample never uses. Its declared POM is the base guice POM.
const CLASSIFIERS = new Map([
  ['com.google.inject:guice:4.2.1', 'no_aop'],
]);
const SOURCES = [
  'app/example/stockreservation/application/toolgates/StockCatalogToolGate.scala',
  'app/example/stockreservation/application/toolgates/AvailabilityOutcome.scala',
  'app/example/stockreservation/application/toolgates/ConnectorProtocol.scala',
  'app/example/stockreservation/application/toolgates/LocationDirectory.scala',
  'app/example/stockreservation/domain/values/ReservationValues.scala',
  'app/example/stockreservation/infrastructure/bootstrap/StockCatalogModule.scala',
  'app/example/stockreservation/infrastructure/process/LocalProcessRunner.scala',
  'app/example/stockreservation/infrastructure/toolgates/StockCatalogToolGateImpl.scala',
  'test/example/stockreservation/connectors/CatalogCases.scala',
  'test/example/stockreservation/connectors/CatalogOracle.scala',
  'test/example/stockreservation/connectors/CatalogProperties.scala',
  'test/example/stockreservation/connectors/CatalogQualityProperties.scala',
  'quality/ScalaSourceMetrics.scala', 'quality/QualityInputs.scala', 'quality/JsonOutput.scala', 'quality/QualityMain.scala',
];
const EXPECTED_NEGATIVES = 8;
const monotonic = () => Number(process.hrtime.bigint() / 1000000n);
const document = p => captureEvidenceFile(p, { parse: bytes => JSON.parse(bytes.toString('utf8')) });
const write = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
};
const pin = p => ({ file: p, ...fingerprintEvidenceFile(p) });
const treeFiles = dir => fs.readdirSync(dir).flatMap(name => {
  const p = path.join(dir, name), s = fs.lstatSync(p);
  assert(!s.isSymbolicLink(), 'Symlink in declared runtime directory');
  return s.isDirectory() ? treeFiles(p) : s.isFile() && !p.endsWith('/src.zip') ? [p] : [];
});
const sourceLayer = relative =>
  relative.startsWith('app/') ? (relative.includes('/domain/') ? 'domain' : 'boundary') : 'support';

function supply() {
  const artifacts = COORDINATES.map(coordinate => {
    const stem = artifactStem(CACHE, coordinate);
    const classifier = CLASSIFIERS.get(coordinate);
    const jar = classifier ? `${stem}-${classifier}.jar` : `${stem}.jar`;
    let pom;
    try {
      const original = captureEvidenceFile(stem + '.pom').value.toString();
      // The existing finite reader stops its identity header at <name> and
      // <licenses>. Some pinned POMs (jna lineage; checker-compat-qual) put
      // those descriptive elements before their coordinates, so omit them
      // from the parsing view only, while retaining the original POM bytes
      // in pins.
      pom = declaredPom(original
        .replace(/<name>[\s\S]*?<\/name>/g, '')
        .replace(/<licenses>[\s\S]*?<\/licenses>/g, ''));
    }
    catch (error) { throw new Error(`${coordinate}: ${error.message}`); }
    assert.equal(pom.coordinate, coordinate);
    return { coordinate, jar, pom: stem + '.pom', declared: pom };
  });
  const selected = new Map(artifacts.map(row => [row.coordinate.split(':').slice(0, 2).join(':'), row.coordinate]));
  const edges = [], omitted = [];
  for (const artifact of artifacts) for (const dependency of artifact.declared.dependencies) {
    const requested = [dependency.group, dependency.artifact, dependency.version ?? 'managed-by-parent'].join(':');
    const key = `${dependency.group}:${dependency.artifact}`;
    if (unconsumedLibraryDeps.has(key)) {
      omitted.push({ from: artifact.coordinate, requested, reason: unconsumedLibraryDeps.get(key) });
    } else if (dependency.scope === 'test' || dependency.optional || dependency.scope === 'provided') {
      omitted.push({ from: artifact.coordinate, requested, reason: dependency.scope });
    } else {
      const coordinate = selected.get(key);
      assert(coordinate, 'Missing finite dependency: ' + requested);
      edges.push({ from: artifact.coordinate, requested, selected: coordinate });
    }
  }
  const release = captureEvidenceFile(path.join(JAVA_HOME, 'release')).value.toString();
  assert(/^JAVA_VERSION="11\./m.test(release));
  const jdk = [...treeFiles(path.join(JAVA_HOME, 'lib')), ...treeFiles(path.join(JAVA_HOME, 'conf'))];
  const parentFiles = PARENTS.map(coordinate => artifactStem(CACHE, coordinate) + '.pom');
  const paths = [JAVA, path.join(JAVA_HOME, 'release'), ...jdk,
    ...artifacts.flatMap(row => [row.jar, row.pom]), ...parentFiles];
  const pins = [...new Set(paths)].map(pin);
  return { artifacts, edges, omitted, pins, jdk };
}

function unchanged(pins) {
  for (const row of pins) {
    const actual = fingerprintEvidenceFile(row.file, { limit: row.bytes });
    assert.equal(actual.bytes, row.bytes, 'Evidence length changed');
    assert.equal(actual.sha256, row.sha256, 'Evidence bytes changed: ' + row.file);
  }
}

function profile(reads, writes) {
  const ancestors = new Set(['/']);
  for (const p of reads) for (let d = path.dirname(p); d !== '/'; d = path.dirname(d)) ancestors.add(d);
  return `(version 1)
(allow default)
(deny network*)
(deny file-read*)
(allow file-read* ${[...ancestors].map(p => `(literal ${JSON.stringify(p)})`).join(' ')}
 ${reads.map(p => `(literal ${JSON.stringify(p)})`).join(' ')}
 (subpath "/System/Library") (subpath "/usr/lib") (subpath "/private/var/db/dyld")
 (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom"))
(allow file-read* ${writes.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})
(deny file-write*)
(allow file-write* ${writes.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')} (literal "/dev/null"))
(deny process-exec)
(allow process-exec (literal ${JSON.stringify(JAVA)}))
`;
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'prepare') {
    const round = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_ROUND;
    const resources = supply();
    const sources = SOURCES.map(relative => ({ relative, ...pin(path.join(CANDIDATE, relative)) }));
    const metadata = ['quality-policy.json', 'scope-exceptions.tsv', 'expected-properties.txt']
      .map(relative => pin(path.join(CANDIDATE, relative)));
    const controls = ['lib/verification/process.mjs', 'lib/verification/files.mjs', 'lib/immutable-data.mjs',
      'lib/strict-json.mjs', 'lib/verification/callbacks.mjs',
      'test/reference/compiler-pom.mjs', 'test/reference/compiler-tools.mjs'].map(relative => pin(path.join(ROOT, relative)));
    controls.push(pin(fileURLToPath(import.meta.url)));
    const prepared = { resources, sources, metadata, controls, expectedSeeds: [740001, 740002, 740003],
      statement: 'Prepared finite source/supply only, no JVM execution, no quality verdict' };
    write(path.join(round, 'prepared.json'), prepared);
    console.log(JSON.stringify({ prepared: pin(path.join(round, 'prepared.json')), sources: sources.length, artifacts: resources.artifacts.length }));
    return;
  }
  assert.equal(mode, 'run');
  const round = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_ROUND;
  const prepared = document(path.join(round, 'prepared.json')).value;
  const attemptId = process.argv[4];
  assert(/^attempt-0[1-3]$/.test(attemptId), 'Fixed attempt ID required');
  const budgetFile = path.join(round, 'budget.json');
  if (!fs.existsSync(budgetFile)) {
    assert.equal(attemptId, 'attempt-01');
    write(budgetFile, { started: Date.now(), monotonicStarted: monotonic(), wallMs: 900000, extended: false });
  }
  const budget = document(budgetFile).value;
  const attempt = path.join(round, attemptId);
  fs.mkdirSync(attempt);
  const home = path.join(attempt, 'home'), tmp = path.join(attempt, 'tmp');
  const domainClasses = path.join(attempt, 'domain-classes'), testClasses = path.join(attempt, 'test-classes');
  for (const dir of [home, tmp, domainClasses, testClasses, path.join(attempt, 'logs'), path.join(attempt, 'results')]) fs.mkdirSync(dir);
  const listing = path.join(attempt, 'sources.tsv');
  write(listing, prepared.sources.map(row => `${row.relative}\t${row.file}\t${sourceLayer(row.relative)}`).join('\n') + '\n');
  const exceptions = path.join(CANDIDATE, 'scope-exceptions.tsv');
  const fixedPins = [...prepared.resources.pins, ...prepared.sources, ...prepared.metadata, ...prepared.controls, pin(listing)];
  const sandboxFile = path.join(attempt, 'sandbox.sb');
  write(sandboxFile, profile([...fixedPins.map(row => row.file)], [home, tmp, domainClasses, testClasses, path.join(attempt, 'results')]));
  const jvmArgs = ['-Xmx512m', '-XX:ActiveProcessorCount=2', '-XX:-UsePerfData', '-Dfile.encoding=UTF-8',
    '-Dscala.usejavacp=false', `-Duser.home=${home}`, `-Djava.io.tmpdir=${tmp}`,
    `-XX:ErrorFile=${tmp}/hs_err_pid%p.log`, `-XX:HeapDumpPath=${tmp}`, `-Dquality.sources=${listing}`,
    `-Dquality.exceptions=${exceptions}`, `-Dquality.expected=${path.join(CANDIDATE, 'expected-properties.txt')}`];
  const artifacts = prepared.resources.artifacts;
  const compilerCp = artifacts.slice(0, 6).map(row => row.jar).join(':');
  const domainCp = [artifacts[1].jar, artifacts[6].jar, artifacts[7].jar];
  const testCp = [...domainCp, ...artifacts.slice(8).map(row => row.jar), domainClasses];
  const runtimeCp = [...testCp, testClasses];
  const localStart = performance.now();
  const initialRemaining = Math.min(budget.wallMs - (Date.now() - budget.started),
    budget.wallMs - (monotonic() - budget.monotonicStarted));
  const remaining = () => Math.min(budget.wallMs - (Date.now() - budget.started),
    budget.wallMs - (monotonic() - budget.monotonicStarted),
    initialRemaining - (performance.now() - localStart));
  const records = [];
  const launch = async (label, args, cap) => {
    assert(remaining() >= cap + 120000 + 20000, 'New quality budget cannot fit next phase');
    unchanged(fixedPins);
    assert(remaining() >= cap + 120000 + 20000, 'Quality admission exhausted phase budget');
    const receipt = await runVerifiedProcess({ executable: JAVA, args: [...jvmArgs, ...args], cwd: attempt,
      env: { HOME: home, TMPDIR: tmp, JAVA_HOME, PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
      base: path.join(attempt, 'logs', label), timeoutMs: cap,
      sandbox: { executable: '/usr/bin/sandbox-exec', profile: sandboxFile, profileSha256: pin(sandboxFile).sha256 } });
    records.push({ label, receipt });
    unchanged(fixedPins);
    assert(remaining() > 0, 'New quality wall budget expired');
    assert(receipt.passed, `${label} failed: ${receipt.paths.stderr}`);
    console.log(`${label}: exit=${receipt.code}`);
  };
  try {
    await launch('compile-domain', ['-cp', compilerCp, 'scala.tools.nsc.Main', '-encoding', 'UTF-8',
      '-deprecation', '-feature', '-unchecked', '-classpath', domainCp.join(':'), '-d', domainClasses,
      ...prepared.sources.filter(row => row.relative.startsWith('app/')).map(row => row.file)], 120000);
    await launch('compile-properties', ['-cp', compilerCp, 'scala.tools.nsc.Main', '-encoding', 'UTF-8',
      '-deprecation', '-feature', '-unchecked', '-classpath', testCp.join(':'), '-d', testClasses,
      ...prepared.sources.filter(row => !row.relative.startsWith('app/')).map(row => row.file)], 120000);
    const metricResult = path.join(attempt, 'results', 'metrics.json');
    await launch('source-metrics', [`-Dquality.result=${metricResult}`, '-cp', runtimeCp.join(':'),
      'example.stockreservation.connectors.quality.QualityMain', 'metrics'], 60000);
    assert.equal(document(metricResult).value.passed, true);
    for (const seed of prepared.expectedSeeds) {
      const resultFile = path.join(attempt, 'results', `properties-${seed}.json`);
      await launch(`properties-${seed}`, [`-Dquality.result=${resultFile}`, '-cp', runtimeCp.join(':'),
        'example.stockreservation.connectors.quality.QualityMain', 'properties', String(seed)], 100000);
      const result = document(resultFile).value;
      assert.equal(result.passed, true);
      assert(result.results.length > 0 && result.results.every(row => row.passed));
      assert.equal(result.results.filter(row => row.name.includes('negative:')).length, EXPECTED_NEGATIVES);
      const expected = captureEvidenceFile(path.join(CANDIDATE, 'expected-properties.txt')).value.toString().trim().split('\n').sort();
      assert.deepEqual(result.results.map(row => row.name).sort(), expected);
    }
    write(path.join(attempt, 'completion.json'), { status: 'QUALITY_EXECUTION_COMPLETE', records,
      sourcePins: prepared.sources, seeds: prepared.expectedSeeds, rawAcceptanceChanged: false, all31Closed: false });
  } catch (error) {
    write(path.join(attempt, 'failure.json'), { status: 'BLOCKED', message: error.message, records,
      processFailureState: processFailureState(error), rawAcceptanceChanged: false, all31Closed: false });
    throw error;
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 2; });
