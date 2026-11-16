import scala.collection.immutable.Seq

name := """minimal-cqrs"""
organization := "net.imadz"
logLevel := Level.Info
version := "1.0-SNAPSHOT"
semanticdbEnabled := true
semanticdbVersion := "4.9.7"

val akkaVersion = "2.6.20"
// Play 2.8.18 transitively bumps some akka modules to 2.6.21; mixed akka
// versions are rejected at ActorSystem start (ManifestInfo). Pin every akka
// module back to the declared baseline.
dependencyOverrides ++= Seq(
  "com.typesafe.akka" %% "akka-actor" % akkaVersion,
  "com.typesafe.akka" %% "akka-actor-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-slf4j" % akkaVersion,
  "com.typesafe.akka" %% "akka-serialization-jackson" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-sharding" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-sharding-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-tools" % akkaVersion,
  "com.typesafe.akka" %% "akka-coordination" % akkaVersion,
  "com.typesafe.akka" %% "akka-discovery" % akkaVersion,
  "com.typesafe.akka" %% "akka-distributed-data" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-query" % akkaVersion,
  "com.typesafe.akka" %% "akka-pki" % akkaVersion,
  "com.typesafe.akka" %% "akka-protobuf-v3" % akkaVersion,
  "com.typesafe.akka" %% "akka-remote" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-actor-testkit-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream-testkit" % akkaVersion,
  "com.typesafe.akka" %% "akka-testkit" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-testkit" % akkaVersion
)
val AkkaManagementVersion = "1.1.4"
val AkkaPersistenceJdbcVersion = "5.1.0"
val AkkaProjectionVersion = "1.2.5"
val ScalikeJdbcVersion = "3.5.0"
//val AlpakkaKafkaVersion = "4.0.0"
val SlickVersion = "3.3.3"
val MongoPluginVersion = "3.0.8"

lazy val root = (project in file(".")).enablePlugins(PlayScala)

scalaVersion := "2.13.14"

Compile / scalacOptions ++= Seq(
  "-target:11",
  "-deprecation",
  "-feature",
  "-unchecked",
  "-Xlog-reflective-calls",
  "-Xlint")
Compile / javacOptions ++= Seq("-Xlint:unchecked", "-Xlint:deprecation")

resolvers ++= Seq(
  "Aliyun" at "https://maven.aliyun.com/repository/public/"
)

//resolvers += "softprops-maven" at "http://dl.bintray.com/content/softprops/maven"
enablePlugins(JavaAppPackaging, DockerPlugin)
dockerBaseImage := "docker.io/library/adoptopenjdk:11-jre-hotspot"
dockerUsername := sys.props.get("docker.username")
dockerRepository := sys.props.get("docker.registry")
ThisBuild / dynverSeparator := "-"

libraryDependencies += guice
libraryDependencies += jdbc
libraryDependencies += clusterSharding
libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-cluster-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-sharding-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-actor-testkit-typed" % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-stream-testkit" % akkaVersion % Test,

  // Akka Management powers Health Checks and Akka Cluster Bootstrapping
  "com.lightbend.akka.management" %% "akka-management" % AkkaManagementVersion,
  "com.lightbend.akka.management" %% "akka-management-cluster-http" % AkkaManagementVersion,
  "com.lightbend.akka.management" %% "akka-management-cluster-bootstrap" % AkkaManagementVersion,
  "com.lightbend.akka.discovery" %% "akka-discovery-kubernetes-api" % AkkaManagementVersion,
  "com.typesafe.akka" %% "akka-discovery" % akkaVersion,

  // Common Dependencies
  "com.typesafe.akka" %% "akka-slf4j" % akkaVersion,
  "ch.qos.logback" % "logback-classic" % "1.4.5",
  "org.scalatest" %% "scalatest" % "3.2.15" % Test,

  // Akka Persistence
  "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
  // RxMongo driver extension only: the scala-driver plugin jar redefines the same
  // query classes (CurrentAllEvents$ etc.) with incompatible signatures — carrying
  // both is a classpath coin flip (NoSuchMethodError on the read journal).
  "com.github.scullxbones" %% "akka-persistence-mongo-rxmongo" % MongoPluginVersion,
  "com.typesafe.akka" %% "akka-serialization-jackson" % akkaVersion,
  //  "com.lightbend.akka" %% "akka-persistence-jdbc" % AkkaPersistenceJdbcVersion,
  //  "com.typesafe.slick" %% "slick" % SlickVersion,
  //  "com.typesafe.slick" %% "slick-hikaricp" % SlickVersion,
  "com.typesafe.akka" %% "akka-persistence-testkit" % akkaVersion % Test,

  // 4. Querying or projecting data from Akka Persistence
  "com.typesafe.akka" %% "akka-persistence-query" % akkaVersion,
  "com.lightbend.akka" %% "akka-projection-eventsourced" % AkkaProjectionVersion,
  "com.lightbend.akka" %% "akka-projection-jdbc" % AkkaProjectionVersion,
  "org.scalikejdbc" %% "scalikejdbc" % ScalikeJdbcVersion,
  "org.scalikejdbc" %% "scalikejdbc-config" % ScalikeJdbcVersion,
  "org.scalikejdbc" %% "scalikejdbc-play-initializer" % "2.8.0-scalikejdbc-3.5",

  // 5. Excel Loaders
  "org.apache.poi" % "poi" % "5.2.4",
  "org.apache.poi" % "poi-ooxml" % "5.2.4",

  "mysql" % "mysql-connector-java" % "8.0.33",
//  "mysql" % "mysql-connector-java" % "5.1.34",

  // 6. fix jna runtime issue
  "net.java.dev.jna" % "jna" % "5.13.0",
  "net.java.dev.jna" % "jna-platform" % "5.13.0",
  "io.methvin" % "directory-watcher" % "0.17.1",
  "com.lightbend.akka" %% "akka-projection-testkit" % AkkaProjectionVersion % Test
)
// ── net.imadz 0.2 engine lib stack (Maven Central) ──
// Extracted from playAkkaCQRS; see MadPolaris org repos. The scaffold
// builds on these instead of hand-rolling Akka patterns.
libraryDependencies ++= Seq(
  "net.imadz" %% "common-core" % "0.2",
  "net.imadz" %% "monarch-core" % "0.2",
  "net.imadz" %% "monarch-persistence" % "0.2",
  "net.imadz" %% "saga-core" % "0.2",
  "net.imadz" %% "auth-core" % "0.2"
)

// ── Gate-2 candidate runtime switch (default OFF) ──
// -Dcodegen.candidate.sagaCore=<absolute jar> replaces the published saga-core
// 0.2 module with the isolated strict candidate jar on the unmanaged classpath.
// No publishLocal, no shared Ivy write; the jar and its SHA256 live in the
// generation evidence directory. Unset -> published 0.2, behavior unchanged.
libraryDependencies := sys.props.get("codegen.candidate.sagaCore")
  .fold(libraryDependencies.value)(_ => libraryDependencies.value
    .filterNot(m => m.organization == "net.imadz" && m.name == "saga-core"))
Compile / unmanagedJars ++= sys.props.get("codegen.candidate.sagaCore").toVector
  .map(j => Attributed.blank(file(j)))

// P15 optional Monarch candidate pair (default OFF). Never mix one candidate
// with the other's published 0.2 module; unmanaged jars do not supply POM deps.
val monarchCandidateCore = sys.props.get("codegen.candidate.monarchCore")
val monarchCandidatePersistence = {
  val candidate = sys.props.get("codegen.candidate.monarchPersistence")
  require(monarchCandidateCore.isDefined == candidate.isDefined,
    "Monarch candidate core/persistence jars must be supplied together")
  candidate
}
libraryDependencies := {
  if (monarchCandidateCore.isDefined) libraryDependencies.value
    .filterNot(m => m.organization == "net.imadz" && Set("monarch-core", "monarch-persistence").contains(m.name))
  else libraryDependencies.value
}
Compile / unmanagedJars ++= (monarchCandidateCore.toVector ++ monarchCandidatePersistence.toVector).map { path =>
  val jar = file(path)
  require(jar.isAbsolute && jar.isFile, "Monarch candidate must be an existing absolute jar")
  Attributed.blank(jar)
}
libraryDependencies += "org.scalatestplus.play" %% "scalatestplus-play" % "5.0.0" % Test
libraryDependencies += "nl.gn0s1s" %% "base64" % "0.2.2"
libraryDependencies += "com.github.jwt-scala" %% "jwt-play" % "9.1.2"
libraryDependencies += "com.github.ben-manes.caffeine" % "caffeine" % "3.1.8"
libraryDependencies += "org.mongodb.scala" %% "mongo-scala-driver" % "4.11.0"
libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-remote" % akkaVersion,
  "com.typesafe.akka" %% "akka-protobuf-v3" % akkaVersion,
//  "org.mongodb.scala" %% "mongo-scala-driver" % "4.11.1",
  "com.google.protobuf" % "protobuf-java" % "3.15.6",
  "org.reactivemongo" %% "reactivemongo" % "1.1.0-noshaded-RC11",
  "com.thesamet.scalapb" %% "scalapb-runtime" % scalapb.compiler.Version.scalapbVersion % "protobuf"
)

dependencyOverrides ++= Seq(
  "org.mongodb.scala" %% "mongo-scala-driver" % "4.3.4",
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-actor" % akkaVersion,
  "org.reactivemongo" %% "reactivemongo" % "1.1.0-noshaded-RC11",
  "com.typesafe.play" %% "play-json" % "2.9.3",
  "com.google.guava" % "guava" % "30.1.1-jre",
  "com.typesafe.akka" %% "akka-http-core" % "10.2.7",
  "org.slf4j" % "slf4j-api" % "2.0.4"
)

PB.targets in Compile := Seq(
  scalapb.gen() -> (sourceManaged in Compile).value / "protobuf"
)

addCompilerPlugin("org.scalameta" % "semanticdb-scalac" % "4.9.7" cross CrossVersion.full)
scalacOptions += "-Yrangepos"

testOptions in Test += Tests.Argument("-oDF")
logBuffered in Test := false

// Deployment-face (FixtureSafetySpec D3) forks two child JVMs via
// java.class.path — only a forked test JVM carries the application test classpath.
Test / fork := true

