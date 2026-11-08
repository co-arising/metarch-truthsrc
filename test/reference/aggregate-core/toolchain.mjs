// Finite, test-only Akka supplement to the existing offline compiler supply.
// Static file/JAR/POM inspection only. No resolver, wildcard cache or process runner.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { absolutePath, regular, present, files, snapshot, offlineToolchain, manifestClassPath, zipMembers } from '../compiler-tools.mjs';
import { artifactStem, declaredPom } from '../compiler-pom.mjs';

const akka = (name, lane = 'production') => Object.freeze({
  coordinate: `com.typesafe.akka:akka-${name}_2.13:2.6.20`, lane,
});
const dependency = (coordinate, lane = 'production') => Object.freeze({ coordinate, lane });
export const actorArtifacts = Object.freeze([
  akka('actor'), akka('actor-typed'), akka('persistence'), akka('persistence-typed'),
  akka('persistence-query'), akka('stream'), akka('stream-typed'), akka('protobuf-v3'),
  akka('slf4j'), akka('remote'), akka('pki'),
  akka('actor-testkit-typed', 'test'), akka('testkit', 'test'), akka('persistence-testkit', 'test'),
  dependency('com.typesafe:config:1.4.2'),
  dependency('org.scala-lang.modules:scala-java8-compat_2.13:1.0.0'),
  dependency('org.reactivestreams:reactive-streams:1.0.3'),
  dependency('com.typesafe:ssl-config-core_2.13:0.4.3'),
  dependency('org.scala-lang.modules:scala-parser-combinators_2.13:1.1.2'),
  dependency('org.slf4j:slf4j-api:1.7.36'), dependency('org.agrona:agrona:1.15.1'),
  dependency('com.hierynomus:asn-one:0.5.0'),
  dependency('ch.qos.logback:logback-classic:1.2.11', 'test'),
  dependency('ch.qos.logback:logback-core:1.2.11', 'test'),
]);
export const actorParents = Object.freeze([
  'org.slf4j:slf4j-parent:1.7.36', 'ch.qos.logback:logback-parent:1.2.11',
]);
// These are the actual config-bearing jars, not all jars and not loose overrides.
export const actorResources = Object.freeze([
  ...['actor', 'actor-typed', 'persistence', 'persistence-typed', 'persistence-query',
    'stream', 'remote', 'actor-testkit-typed', 'testkit', 'persistence-testkit'].map(name =>
    Object.freeze({ coordinate: `com.typesafe.akka:akka-${name}_2.13:2.6.20`, member: 'reference.conf' })),
  Object.freeze({ coordinate: 'com.typesafe:ssl-config-core_2.13:0.4.3', member: 'reference.conf' }),
  Object.freeze({ coordinate: 'com.typesafe.akka:akka-remote_2.13:2.6.20', member: 'akka/remote/serialization/WrappedPayloadSupport.class' }),
]);
export const omittedFeatures = Object.freeze([
  'remote provider / Netty / Aeron', 'LevelDB / JNI', 'cluster / Jackson',
  'dependency upstream test suites', 'optional mail / Janino / servlet / Jansi logging integrations',
]);

export { artifactStem, declaredPom } from '../compiler-pom.mjs';

// Explicit historical requests reconciled with family1's selected public versions.
const overrides = new Map([
  ...['2.13.0', '2.13.1', '2.13.5', '2.13.8'].map(version => [`org.scala-lang:scala-library:${version}`, 'org.scala-lang:scala-library:2.13.14']),
  ['com.typesafe:config:1.4.0', 'com.typesafe:config:1.4.2'],
  ['org.slf4j:slf4j-api:1.7.13', 'org.slf4j:slf4j-api:1.7.36'],
  ['org.slf4j:slf4j-api:1.7.32', 'org.slf4j:slf4j-api:1.7.36'],
]);
export function admitPomClosure(poms, suppliedCoordinates) {
  const supplied = new Set(suppliedCoordinates), closure = [];
  for (const pom of poms) {
    assert(supplied.has(pom.coordinate), `Unadmitted POM: ${pom.coordinate}`);
    if (pom.parent) assert(actorParents.includes(pom.parent), `Unadmitted POM parent: ${pom.parent}`);
    for (const row of pom.dependencies) {
      assert(['compile', 'runtime', 'provided', 'test'].includes(row.scope), `Unsupported POM scope: ${row.scope}`);
      if (row.scope === 'test' || row.optional) continue;
      assert(row.type === 'jar' && !row.classifier, 'Classified production dependency is outside finite supply');
      let version = row.version;
      if (pom.coordinate === 'ch.qos.logback:logback-classic:1.2.11') {
        if (row.group === 'ch.qos.logback' && row.artifact === 'logback-core' && version === undefined) version = '1.2.11';
        if (row.group === 'org.slf4j' && row.artifact === 'slf4j-api' && version === '${slf4j.version}') version = '1.7.32';
      }
      const requested = `${row.group}:${row.artifact}:${version}`;
      assert(/^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/.test(requested), `Unresolved POM dependency: ${requested}`);
      const selected = overrides.get(requested) ?? requested;
      assert(supplied.has(selected), `Missing finite POM dependency: ${pom.coordinate} -> ${selected}`);
      closure.push({ from: pom.coordinate, requested, selected, scope: row.scope });
    }
  }
  return closure;
}

// The class directory roles are explicit; test/fixture outputs never enter production.
export function warehouseClasspaths(tools, classes) {
  for (const name of ['kernel', 'pb', 'glue', 'oracle']) absolutePath(classes[name], name + ' class output');
  assert.equal(new Set(Object.values(classes)).size, Object.values(classes).length, 'Class directories must be exclusive');
  const testOnly = new Set([...tools.testLibraries, ...tools.actorTestLibraries].filter(path => path !== tools.library));
  const forbidden = new Set([...tools.compiler.filter(path => path !== tools.library), ...tools.plugin.filter(path => !tools.runtime.includes(path)),
    ...testOnly, classes.oracle, classes['generated-test']].filter(Boolean));
  const unique = paths => [...new Set(paths)];
  const pb = unique(tools.runtime), glue = unique([...pb, ...tools.actorLibraries, classes.kernel, classes.pb]);
  const production = [...glue, classes.glue];
  for (const path of production) assert(!forbidden.has(path), 'Compiler/plugin/test/oracle supply entered production classpath: ' + path);
  return { kernel: [tools.library], pb, glue, production,
    tests: unique([...production, ...tools.testLibraries, ...tools.actorTestLibraries]) };
}

export function actorToolchain(java, cache, protoc) {
  const base = offlineToolchain(java, cache, protoc);
  const additions = actorArtifacts.map(row => {
    const stem = artifactStem(cache, row.coordinate);
    return { ...row, jar: regular(stem + '.jar'), pom: regular(stem + '.pom') };
  });
  const parents = actorParents.map(coordinate => ({ coordinate, pom: regular(artifactStem(cache, coordinate) + '.pom') }));
  const jvmFiles = [...files(join(base.javaHome, 'lib')), ...files(join(base.javaHome, 'conf'))].filter(path => !path.endsWith('/src.zip'));
  assert(jvmFiles.includes(join(base.javaHome, 'lib/modules')) && jvmFiles.includes(join(base.javaHome, 'lib/server/libjvm.dylib')), 'Actual JDK runtime files are missing');
  const paths = [...new Set([...base.paths, ...jvmFiles, ...additions.flatMap(row => [row.jar, row.pom]), ...parents.map(row => row.pom)])];
  const supplyHashes = snapshot(paths);
  const poms = additions.map(row => {
    const pom = declaredPom(readFileSync(row.pom, 'utf8'));
    assert.equal(pom.coordinate, row.coordinate, 'POM identity differs from supplied JAR');
    return pom;
  });
  for (const row of parents) assert.equal(declaredPom(readFileSync(row.pom, 'utf8')).coordinate, row.coordinate);
  assert.match(readFileSync(parents[1].pom, 'utf8'), /<slf4j\.version>1\.7\.32<\/slf4j\.version>/, 'Logging parent property drifted');
  const artifacts = [...base.artifacts, ...additions];
  const pomClosure = admitPomClosure(poms, artifacts.map(row => row.coordinate));
  const jars = artifacts.map(row => row.jar);
  const manifests = [...base.manifests, ...additions.map(row => ({ path: row.jar, classPath: manifestClassPath(row.jar) }))];
  for (const row of manifests) for (const token of row.classPath) {
    assert(/^[A-Za-z0-9_.-]+\.jar$/.test(token), `Unsafe manifest classpath: ${token}`);
    const file = join(dirname(row.path), token);
    if (present(file)) assert(jars.includes(regular(file)), `Unrecorded manifest dependency: ${file}`);
    else assert(row.path === base.compiler[0] && ['scala-library.jar', 'scala-reflect.jar'].includes(token), `Missing manifest dependency: ${file}`);
  }
  const resources = actorResources.map(row => {
    const artifact = additions.find(item => item.coordinate === row.coordinate);
    const bytes = zipMembers(artifact.jar, [row.member]).get(row.member);
    assert(bytes.length > 0, `Empty required Akka resource: ${row.member}`);
    return { ...row, jar: artifact.jar, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  assert.deepEqual(snapshot(paths), supplyHashes, 'Offline supply changed during static inspection');
  const actorLibraries = additions.filter(row => row.lane === 'production').map(row => row.jar);
  const actorTestLibraries = additions.filter(row => row.lane === 'test').map(row => row.jar);
  return { ...base, artifacts, manifests, paths, jvmFiles, parents, pomClosure, resources, supplyHashes, omittedFeatures,
    actorLibraries, actorTestLibraries, kernelTargetClasspath: [base.library] };
}
