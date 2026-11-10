import { q } from './syntax.mjs';
export function buildTemplate(m, roots, out) {
  const runtime = m.composition.runtime;
  out.append(`ThisBuild / scalaVersion := ${q(runtime.scala)}
ThisBuild / organization := ${q(m.persistence.context.package)}
ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / PB.protocVersion := "3.21.9"
ThisBuild / dependencyOverrides ++= Seq(
  "com.google.guava" % "guava" % ${q(runtime.guava)},
  "commons-codec" % "commons-codec" % ${q(runtime.commonsCodec)}
)
ThisBuild / scalacOptions += "-release:11"
ThisBuild / javacOptions ++= Seq("--release", "11")
ThisBuild / Test / parallelExecution := false

lazy val kernel = (project in file("modules/kernel"))
lazy val glue = (project in file("modules/glue")).dependsOn(kernel).settings(
  Compile / PB.targets := Seq(scalapb.gen() -> (Compile / sourceManaged).value),
  libraryDependencies ++= Seq(
    "com.thesamet.scalapb" %% "scalapb-runtime" % ${q(runtime.scalaPB)} % "protobuf",
    "com.typesafe.akka" %% "akka-actor-typed" % ${q(runtime.akka)},
    "com.typesafe.akka" %% "akka-persistence-typed" % ${q(runtime.akka)},
    "com.typesafe.akka" %% "akka-persistence-query" % ${q(runtime.akka)},
    "com.typesafe.play" %% "play" % ${q(runtime.play)},
    "com.h2database" % "h2" % ${q(runtime.h2)},
    "org.iq80.leveldb" % "leveldb" % ${q(runtime.leveldb)},
    "com.typesafe.akka" %% "akka-actor-testkit-typed" % ${q(runtime.akka)} % Test,
    "com.typesafe.akka" %% "akka-persistence-testkit" % ${q(runtime.akka)} % Test,
    "org.scalatest" %% "scalatest" % "3.2.15" % Test
  )
)
lazy val ext = (project in file("modules/ext")).dependsOn(kernel, glue).settings(
  Compile / unmanagedSourceDirectories ++= Seq(${roots.filter(r => r.module === 'ext').map(r => 'file(' + q(r.absolutePath) + ')').join(', ')})
)
lazy val root = (project in file(".")).enablePlugins(PlayScala).dependsOn(kernel, glue, ext).aggregate(kernel, glue, ext).settings(
  Compile / unmanagedSourceDirectories := Seq(baseDirectory.value / "src/main/scala"),
  Test / unmanagedSourceDirectories := Seq(baseDirectory.value / "src/test/scala"),
  libraryDependencies ++= Seq(
    "com.typesafe.play" %% "play-test" % ${q(runtime.play)} % Test,
    "org.scalatest" %% "scalatest" % "3.2.15" % Test
  ),
  Test / fork := false,
  publish / skip := true
)
`, [m.composition.source]);
}
export function pluginsTemplate(m, out) {
  out.append(`addSbtPlugin("com.typesafe.play" % "sbt-plugin" % ${q(m.composition.runtime.play)})
addSbtPlugin("com.thesamet" % "sbt-protoc" % ${q(m.composition.runtime.sbtProtoc)})
libraryDependencies += "com.thesamet.scalapb" %% "compilerplugin" % ${q(m.composition.runtime.scalaPB)}
`, [m.composition.source]);
}
export function versionTemplate(m, out) {
  out.append('sbt.version=' + m.composition.runtime.sbt + '\n', [m.composition.source]);
}
export function smokeTemplate(m, out) {
  out.append(`package ${m.names.codec.package}

import org.scalatest.funsuite.AnyFunSuite

final class HttpWireSpec extends AnyFunSuite {
  test("duplicate object fields are rejected by the HTTP parser") {
    assert(${m.names.codec.identifier}.decodeBody("{\\\"id\\\":1,\\\"id\\\":2}").isLeft)
  }
  test("single object input is accepted by the raw parser") {
    assert(${m.names.codec.identifier}.decodeBody("{}").isRight)
  }
}
`, [m.api.source]);
}
