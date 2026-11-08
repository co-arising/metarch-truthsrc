const q = JSON.stringify;

export function buildArtifacts(m) {
  const sources = m.sources;
  return [
    { path: 'build.sbt', kind: 'build', sources, directDeps: ['project/build.properties', 'project/plugins.sbt'], role: 'persistence-build' },
    { path: 'project/build.properties', kind: 'build', sources, directDeps: [], role: 'sbt-version' },
    { path: 'project/plugins.sbt', kind: 'build', sources, directDeps: [], role: 'sbt-plugins' },
  ];
}

export function buildTemplate(m, artifact, out) {
  if (artifact.role === 'sbt-version') {
    out.append('sbt.version=1.4.9\n', artifact.sources); return;
  }
  if (artifact.role === 'sbt-plugins') {
    out.append('addSbtPlugin("com.thesamet" % "sbt-protoc" % "1.0.6")\n' +
      'libraryDependencies += "com.thesamet.scalapb" %% "compilerplugin" % "0.11.14"\n', artifact.sources); return;
  }
  const stem = m.context.package.split('.').at(-1);
  out.append(`ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := ${q(m.context.package)}
ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / PB.protocVersion := "3.21.9"

lazy val kernel = (project in file("modules/kernel"))
  .settings(name := ${q(stem + '-persistence-kernel')})

lazy val glue = (project in file("modules/glue"))
  .dependsOn(kernel)
  .settings(
    name := ${q(stem + '-persistence-glue')},
    Compile / PB.targets := Seq(scalapb.gen() -> (Compile / sourceManaged).value),
    Test / parallelExecution := false,
    libraryDependencies ++= Seq(
      "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14" % "protobuf",
      "com.typesafe.akka" %% "akka-actor-typed" % "2.6.20",
      "com.typesafe.akka" %% "akka-persistence-typed" % "2.6.20",
      "com.h2database" % "h2" % "2.2.224",
      "com.typesafe.akka" %% "akka-actor-testkit-typed" % "2.6.20" % Test,
      "com.typesafe.akka" %% "akka-persistence-testkit" % "2.6.20" % Test,
      "org.scalatest" %% "scalatest" % "3.2.15" % Test
    )
  )

lazy val root = (project in file("."))
  .aggregate(kernel, glue)
  .settings(name := ${q(stem + '-persistence-readside')}, publish / skip := true)
`, artifact.sources);
}

export function generatedPersistenceTest(m, out) {
  const n = m.names;
  out.append(`package ${n.persistence.package}

import org.scalatest.funsuite.AnyFunSuite

/** Generated empty-state smoke test; independent nonempty/JDBC oracle is separate. */
final class ${n.persistence.name}RoundTripSpec extends AnyFunSuite {
  test("declared empty state traverses the versioned persistence frame") {
    val state = ${m.aggregate.base.state.fqn}.empty
    val frame = ${n.persistence.identifier}.encodeState(state)
    val bytes = frame.toByteArray
    val parsed = ${n.frame.fqn}.parseFrom(bytes)
    assert(${n.persistence.identifier}.manifest(parsed) == ${n.persistence.identifier}.manifest(frame))
    assert(${n.persistence.identifier}.decodeState(parsed) == state)
  }
  test("unknown envelope version is rejected rather than treated as compatible") {
    val frame = ${n.persistence.identifier}.encodeState(${m.aggregate.base.state.fqn}.empty)
    intercept[IllegalArgumentException] {
      ${n.persistence.identifier}.decodeState(frame.copy(envelopeVersion = 0))
    }
  }
}
`, [m.product.wire.source, ...m.registrations.filter(r => r.role === 'state').flatMap(r => r.sources)]);
}
