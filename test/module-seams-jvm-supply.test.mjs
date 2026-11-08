import test from 'node:test';
import assert from 'node:assert/strict';
import { admitJvmPoms, jvmCoordinates, jvmParents, jvmClasspaths } from './reference/jvm-toolchain.mjs';
import { artifactStem, declaredPom } from './reference/compiler-pom.mjs';
import * as actor from './reference/aggregate-core/toolchain.mjs';

const dependency = (group, artifact, version, scope = 'compile') => ({ group, artifact, version, scope, optional: false, type: 'jar' });
function poms() {
  return { poms: jvmCoordinates.map((coordinate, i) => ({ coordinate,
    parent: i === 3 ? jvmParents[0] : i === 4 ? jvmParents[1] : null, dependencies: [] })),
  parents: jvmParents.map(coordinate => ({ coordinate, parent: null, dependencies: [] })) };
}
const admit = fixture => admitJvmPoms(fixture.poms, fixture.parents);

test('POM parser extraction preserves the Actor exports by identity', () => {
  assert.equal(actor.artifactStem, artifactStem);
  assert.equal(actor.declaredPom, declaredPom);
  assert.equal(artifactStem('/cache', jvmCoordinates[0]), '/cache/org/scala-lang/scala-compiler/2.13.14/scala-compiler-2.13.14');
});

test('finite JVM supply has eleven non-PB artifacts and two exact parents', () => {
  assert.equal(jvmCoordinates.length, 11); assert.equal(jvmParents.length, 2);
  assert.doesNotMatch(jvmCoordinates.join('\n'), /akka|scalapb|protobuf|protoc/);
  assert.deepEqual(admit(poms()), { edges: [], excluded: [] });
});

test('provided compiler and selected Scala versions are explicit dependency edges', () => {
  const f = poms();
  f.poms[6].dependencies.push(dependency('org.scala-lang', 'scala-compiler', '2.13.10', 'provided'),
    dependency('org.scala-lang', 'scala-reflect', '2.13.10'));
  f.poms[10].dependencies.push(dependency('org.scala-lang', 'scala-library', '2.13.8'));
  const result = admit(f);
  assert.deepEqual(result.edges.map(e => [e.requested, e.selected, e.scope]), [
    ['org.scala-lang:scala-compiler:2.13.10', 'org.scala-lang:scala-compiler:2.13.14', 'provided'],
    ['org.scala-lang:scala-reflect:2.13.10', 'org.scala-lang:scala-reflect:2.13.14', 'compile'],
    ['org.scala-lang:scala-library:2.13.8', 'org.scala-lang:scala-library:2.13.14', 'compile'],
  ]);
});

test('upstream tests and optional integrations are recorded but never resolved', () => {
  const f = poms();
  f.poms[3].dependencies.push(dependency('org.junit', 'junit', undefined, 'test'));
  f.poms[4].dependencies.push({ ...dependency('org.optional', 'library', undefined), optional: true });
  const result = admit(f);
  assert.deepEqual(result.edges, []);
  assert.deepEqual(result.excluded.map(e => e.reason), ['upstream-test', 'optional']);
});

for (const [name, change] of [
  ['missing jar POM', f => f.poms.pop()],
  ['duplicate POM', f => f.poms.push(f.poms[0])],
  ['extra POM', f => f.poms.push({ coordinate: 'unknown:extra:1', parent: null, dependencies: [] })],
  ['missing parent', f => f.parents.pop()],
  ['unknown parent', f => { f.poms[0].parent = 'unknown:parent:1'; }],
  ['removed required parent', f => { f.poms[3].parent = null; }],
  ['transitive parent', f => { f.parents[0].parent = 'unknown:parent:1'; }],
  ['parent dependency', f => f.parents[0].dependencies.push(dependency('org.scala-lang', 'scala-library', '2.13.14'))],
  ['unknown required dependency', f => f.poms[0].dependencies.push(dependency('unknown', 'required', '1'))],
  ['unresolved property', f => f.poms[0].dependencies.push(dependency('org.scala-lang', 'scala-library', '${scala.version}'))],
  ['arbitrary Scala override', f => f.poms[0].dependencies.push(dependency('org.scala-lang', 'scala-library', '2.13.9'))],
  ['unapproved provided dependency', f => f.poms[0].dependencies.push(dependency('org.scala-lang', 'scala-library', '2.13.14', 'provided'))],
  ['system scope', f => f.poms[0].dependencies.push(dependency('org.scala-lang', 'scala-library', '2.13.14', 'system'))],
  ['classifier', f => f.poms[0].dependencies.push({ ...dependency('org.scala-lang', 'scala-library', '2.13.14'), classifier: 'tests' })],
]) test('JVM supply rejects ' + name, () => {
  const f = poms(); assert.doesNotThrow(() => admit(f)); change(f); assert.throws(() => admit(f));
});

test('compiler support is launcher-only and ScalaTest excludes the provided compiler', () => {
  const artifacts = jvmCoordinates.map((coordinate, i) => ({ coordinate, jar: '/cache/' + i + '.jar' }));
  const cp = jvmClasspaths(artifacts);
  assert.equal(cp.compiler.length, 6); assert.equal(cp.testLibraries.length, 7);
  assert.equal(cp.library, '/cache/1.jar');
  for (const path of ['/cache/0.jar', '/cache/3.jar', '/cache/4.jar', '/cache/5.jar']) assert(!cp.testLibraries.includes(path));
  assert.throws(() => jvmClasspaths([...artifacts].reverse()), /Fixed JVM artifact order/);
  const alias = structuredClone(artifacts); alias[1].jar = alias[0].jar;
  assert.throws(() => jvmClasspaths(alias), /distinct JARs/);
});
