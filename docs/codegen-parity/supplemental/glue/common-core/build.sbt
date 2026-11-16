ThisBuild / organization := "net.imadz"
ThisBuild / organizationName := "MadPolaris"
ThisBuild / organizationHomepage := Some(url("https://github.com/MadPolaris"))
ThisBuild / scalaVersion := "2.13.14"
ThisBuild / versionScheme := Some("early-semver")

licenses := List("Apache-2.0" -> url("http://www.apache.org/licenses/LICENSE-2.0"))

ThisBuild / homepage := Some(url("https://github.com/MadPolaris/common-core"))
ThisBuild / scmInfo := Some(
  ScmInfo(
    url("https://github.com/MadPolaris/common-core"),
    "git@github.com:MadPolaris/common-core.git"
  ))
ThisBuild / developers := List(
  Developer(
    "MadPolaris",
    "MadPolaris Team",
    "zhongdj@gmail.com",
    url("https://github.com/MadPolaris")
  ))
ThisBuild / sonatypeCredentialHost := "central.sonatype.com"
// Version is derived from git tags by sbt-dynver (via sbt-ci-release):
// push a tag like v0.2 to release that version.

val akkaVersion = "2.6.20"
val AkkaProjectionVersion = "1.2.5"
val ScalikeJdbcVersion = "3.5.0"
val MongoPluginVersion = "3.0.8"

resolvers ++= Seq(
  "Aliyun" at "https://maven.aliyun.com/repository/public/"
)

Compile / scalacOptions ++= Seq("-target:11", "-deprecation", "-feature", "-unchecked", "-Xlint")
Compile / javacOptions ++= Seq("--release", "11")

dependencyOverrides ++= Seq(
  "com.typesafe.akka" %% "akka-actor-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-tools" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-sharding" % akkaVersion,
  "com.typesafe.akka" %% "akka-distributed-data" % akkaVersion,
  "com.typesafe.akka" %% "akka-coordination" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence" % akkaVersion,
  "com.typesafe.akka" %% "akka-pki" % akkaVersion,
  "com.typesafe.akka" %% "akka-slf4j" % akkaVersion,
  "com.typesafe.akka" %% "akka-serialization-jackson" % akkaVersion,
  "org.mongodb.scala" %% "mongo-scala-driver" % "4.3.4",
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-actor" % akkaVersion,
  "org.reactivemongo" %% "reactivemongo" % "1.1.0-noshaded-RC11",
  "com.typesafe.play" %% "play-json" % "2.9.3",
  "com.google.guava" % "guava" % "30.1.1-jre",
  "com.typesafe.akka" %% "akka-http-core" % "10.2.7",
  "org.slf4j" % "slf4j-api" % "2.0.4",
  "org.scalatest" %% "scalatest" % "3.2.15" % Test,
  "ch.qos.logback" % "logback-classic" % "1.4.5" % Test
)

// Common — shared infrastructure: serialization, projection helpers,
// command-handler behaviors, common types.
name := "common-core"

libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-actor-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-serialization-jackson" % akkaVersion,
  "com.typesafe.akka" %% "akka-remote" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
  "com.lightbend.akka" %% "akka-projection-jdbc" % AkkaProjectionVersion,
  "org.scalikejdbc" %% "scalikejdbc" % ScalikeJdbcVersion,
  "org.scalikejdbc" %% "scalikejdbc-config" % ScalikeJdbcVersion,
  "com.zaxxer" % "HikariCP" % "3.4.5",
  "org.reactivemongo" %% "reactivemongo" % "1.1.0-noshaded-RC11",
  "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14" % "protobuf",
  "com.github.scullxbones" %% "akka-persistence-mongo-scala" % MongoPluginVersion
)
