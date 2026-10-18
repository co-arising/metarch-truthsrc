// ═══ truthsrc scaffold — seed project for generated code ═══
// New baseline (truthsrc v0.5). The generator fills kernel/glue from the
// truth tree; ext is the handwritten zone; root is the Play shell.
// Engine libs come from Maven Central (net.imadz 0.2, lockstep).

ThisBuild / organization := "net.imadz"
ThisBuild / scalaVersion := "2.13.14"
ThisBuild / version := "0.1.0-SNAPSHOT"

val akkaVersion = "2.6.20"
val imadzVersion = "0.2"

resolvers ++= Seq(
  "Aliyun" at "https://maven.aliyun.com/repository/public/"
)

lazy val commonSettings = Seq(
  Compile / scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked")
)

// ── kernel: domain knowledge (generated) ─────────────────────────────
// Aggregates, events, commands — pure problem-space, no framework.
lazy val kernel = (project in file("modules/kernel"))
  .settings(
    commonSettings,
    name := "scaffold-kernel",
    libraryDependencies ++= Seq(
      "net.imadz" %% "common-core" % imadzVersion,
      "net.imadz" %% "monarch-core" % imadzVersion,
      "com.typesafe.akka" %% "akka-actor-typed" % akkaVersion
    )
  )

// ── glue: framework adapters (generated) ─────────────────────────────
// Akka Persistence wiring, saga wiring, projections. Test-exempt zone.
lazy val glue = (project in file("modules/glue"))
  .dependsOn(kernel)
  .settings(
    commonSettings,
    name := "scaffold-glue",
    libraryDependencies ++= Seq(
      "net.imadz" %% "monarch-persistence" % imadzVersion,
      "net.imadz" %% "saga-core" % imadzVersion,
      "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
      "com.typesafe.akka" %% "akka-cluster-sharding-typed" % akkaVersion,
      "com.typesafe.akka" %% "akka-stream" % akkaVersion
    )
  )

// ── ext: handwritten domain code ──────────────────────────────────────
// Module-level physical isolation. The generator never touches this.
lazy val ext = (project in file("modules/ext"))
  .dependsOn(kernel)
  .settings(
    commonSettings,
    name := "scaffold-ext",
    libraryDependencies ++= Seq(
      "net.imadz" %% "common-core" % imadzVersion
    )
  )

// ── root: Play shell ──────────────────────────────────────────────────
lazy val root = (project in file("modules/root"))
  .enablePlugins(PlayScala)
  .dependsOn(kernel, glue, ext)
  .settings(
    commonSettings,
    name := "scaffold-root",
    libraryDependencies ++= Seq(
      guice,
      "net.imadz" %% "auth-core" % imadzVersion,
      "org.scalatestplus.play" %% "scalatestplus-play" % "5.0.0" % Test
    )
  )
