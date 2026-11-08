// Test-only finite Scala/ScalaTest supply. No resolver, protoc, Actor or network.
import assert from 'node:assert/strict';
import { accessSync, constants, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { absolutePath, regular, files, snapshot, present, manifestClassPath } from './compiler-tools.mjs';
import { artifactStem, declaredPom } from './compiler-pom.mjs';

export const jvmCoordinates = Object.freeze([
  'org.scala-lang:scala-compiler:2.13.14', 'org.scala-lang:scala-library:2.13.14', 'org.scala-lang:scala-reflect:2.13.14',
  'io.github.java-diff-utils:java-diff-utils:4.12', 'org.jline:jline:3.25.1', 'net.java.dev.jna:jna:5.14.0',
  'org.scalatest:scalatest-core_2.13:3.2.15', 'org.scalatest:scalatest-funsuite_2.13:3.2.15',
  'org.scalatest:scalatest-compatible:3.2.15', 'org.scalactic:scalactic_2.13:3.2.15',
  'org.scala-lang.modules:scala-xml_2.13:2.1.0',
]);
export const jvmParents = Object.freeze([
  'io.github.java-diff-utils:java-diff-utils-parent:4.12', 'org.jline:jline-parent:3.25.1',
]);
const selectedVersions = new Map([
  ...['scala-compiler', 'scala-library', 'scala-reflect'].map(name =>
    [`org.scala-lang:${name}:2.13.10`, `org.scala-lang:${name}:2.13.14`]),
  ['org.scala-lang:scala-library:2.13.8', 'org.scala-lang:scala-library:2.13.14'],
]);
const literalCoordinate = /^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/;

export function admitJvmPoms(poms, parents) {
  const exact = (actual, expected, label) => {
    assert.equal(new Set(actual).size, actual.length, `Duplicate ${label}`);
    assert.deepEqual([...actual].sort(), [...expected].sort(), `Incomplete or extra ${label}`);
  };
  exact(poms.map(p => p.coordinate), jvmCoordinates, 'JVM POM inventory');
  exact(parents.map(p => p.coordinate), jvmParents, 'JVM parent inventory');
  for (const parent of parents) {
    assert.equal(parent.parent, null, 'Unadmitted transitive JVM parent');
    assert.deepEqual(parent.dependencies, [], 'Parent dependencies cannot extend finite JVM supply');
  }
  const edges = [], excluded = [];
  for (const pom of poms) {
    const requiredParent = pom.coordinate === jvmCoordinates[3] ? jvmParents[0] : pom.coordinate === jvmCoordinates[4] ? jvmParents[1] : null;
    assert.equal(pom.parent, requiredParent, 'Unexpected JVM POM parent');
    for (const row of pom.dependencies) {
      assert(['compile', 'runtime', 'provided', 'test'].includes(row.scope), 'Unsupported JVM POM scope');
      const requested = `${row.group}:${row.artifact}:${row.version ?? '(managed)'}`;
      if (row.scope === 'test' || row.optional) {
        excluded.push({ from: pom.coordinate, requested, scope: row.scope, reason: row.scope === 'test' ? 'upstream-test' : 'optional' });
        continue;
      }
      assert(row.type === 'jar' && !row.classifier && literalCoordinate.test(requested), 'Unresolved or classified JVM dependency');
      const selected = selectedVersions.get(requested) ?? requested;
      assert(jvmCoordinates.includes(selected), `Missing finite JVM dependency: ${requested}`);
      if (row.scope === 'provided') assert.equal(selected, jvmCoordinates[0], 'Only provided Scala compiler is admitted');
      edges.push({ from: pom.coordinate, requested, selected, scope: row.scope });
    }
  }
  return { edges, excluded };
}

export function jvmClasspaths(artifacts) {
  assert.deepEqual(artifacts.map(row => row.coordinate), jvmCoordinates, 'Fixed JVM artifact order required');
  const jars = artifacts.map(row => absolutePath(row.jar, 'JVM JAR'));
  assert.equal(new Set(jars).size, jars.length, 'JVM artifacts must have distinct JARs');
  return { compiler: jars.slice(0, 6), library: jars[1], testLibraries: [jars[1], jars[2], ...jars.slice(6)] };
}

export function offlineJvmToolchain(java, cache) {
  assert.equal(process.platform, 'darwin', 'Darwin sandbox-exec is required; no unsandboxed fallback');
  absolutePath(java, '--java'); absolutePath(cache, '--maven-cache');
  const sandbox = regular('/usr/bin/sandbox-exec');
  for (const executable of [sandbox, regular(java)]) accessSync(executable, constants.X_OK);
  const javaHome = dirname(dirname(java)), release = regular(join(javaHome, 'release'));
  assert(/^JAVA_VERSION="11\./m.test(readFileSync(release, 'utf8')), 'An explicit JDK 11 is required');
  assert(lstatSync(cache).isDirectory() && realpathSync(cache) === cache, 'Cache must be a real directory without symlinks');
  const artifacts = jvmCoordinates.map(coordinate => {
    const stem = artifactStem(cache, coordinate);
    return { coordinate, jar: regular(stem + '.jar'), pom: regular(stem + '.pom') };
  });
  const parents = jvmParents.map(coordinate => ({ coordinate, pom: regular(artifactStem(cache, coordinate) + '.pom') }));
  const jvmFiles = [...files(join(javaHome, 'lib')), ...files(join(javaHome, 'conf'))].filter(path => !path.endsWith('/src.zip'));
  assert(jvmFiles.includes(join(javaHome, 'lib/modules')) && jvmFiles.includes(join(javaHome, 'lib/server/libjvm.dylib')), 'Actual JDK runtime files are missing');
  const paths = [java, release, sandbox, ...artifacts.flatMap(row => [row.jar, row.pom]), ...parents.map(row => row.pom), ...jvmFiles];
  assert.equal(new Set(paths).size, paths.length, 'Repeated JVM supply file');
  const supplyHashes = snapshot(paths);
  const readPom = row => {
    const pom = declaredPom(readFileSync(row.pom, 'utf8'));
    assert.equal(pom.coordinate, row.coordinate, 'JVM POM identity differs from supplied artifact');
    return pom;
  };
  const pomClosure = admitJvmPoms(artifacts.map(readPom), parents.map(readPom));
  const { compiler, library, testLibraries } = jvmClasspaths(artifacts), jars = artifacts.map(row => row.jar);
  const manifests = jars.map(path => ({ path, classPath: manifestClassPath(path) }));
  for (const row of manifests) for (const token of row.classPath) {
    assert(/^[A-Za-z0-9_.-]+\.jar$/.test(token), `Unsafe manifest classpath: ${token}`);
    const dependency = join(dirname(row.path), token);
    if (present(dependency)) assert(jars.includes(regular(dependency)), `Unrecorded manifest dependency: ${dependency}`);
    else assert(row.path === compiler[0] && ['scala-library.jar', 'scala-reflect.jar'].includes(token), `Missing manifest dependency: ${dependency}`);
  }
  assert.deepEqual(snapshot(paths), supplyHashes, 'Offline JVM supply changed during static inspection');
  return { java, javaHome, release, cache, sandbox, artifacts, compiler, library, testLibraries,
    paths, jvmFiles, parents, pomClosure, manifests, supplyHashes,
    omittedFeatures: ['upstream test suites', 'optional ScalaTest/JLine integrations', 'protoc/ScalaPB', 'Akka', 'JDK src.zip'] };
}
