name := "metarch-truth-generated"
organization := "net.imadz"
version := "1.0-SNAPSHOT"

scalaVersion := "2.13.14"

val akkaVersion = "2.6.20"
val imadzVersion = "0.2"

lazy val root = (project in file(".")).enablePlugins(PlayScala)

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

libraryDependencies += guice
libraryDependencies += jdbc
libraryDependencies += clusterSharding
libraryDependencies ++= Seq(
  // net.imadz 0.2 engine libraries (lockstep)
  "net.imadz" %% "common-core" % imadzVersion,
  "net.imadz" %% "monarch-core" % imadzVersion,
  "net.imadz" %% "saga-core" % imadzVersion,
  "net.imadz" %% "auth-core" % imadzVersion,
  "net.imadz" %% "monarch-persistence" % imadzVersion,

  // Akka
  "com.typesafe.akka" %% "akka-cluster-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-sharding-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-query" % akkaVersion,
  "com.typesafe.akka" %% "akka-serialization-jackson" % akkaVersion,
  "com.typesafe.akka" %% "akka-slf4j" % akkaVersion,

  // Projections
  "com.lightbend.akka" %% "akka-projection-eventsourced" % "1.2.5",
  "com.lightbend.akka" %% "akka-projection-jdbc" % "1.2.5",
  "org.scalikejdbc" %% "scalikejdbc" % "3.5.0",
  "org.scalikejdbc" %% "scalikejdbc-config" % "3.5.0",
  "org.scalikejdbc" %% "scalikejdbc-play-initializer" % "2.8.0-scalikejdbc-3.5",

  // Logging / test
  "ch.qos.logback" % "logback-classic" % "1.4.5",
  "org.scalatest" %% "scalatest" % "3.2.15" % Test,
  "org.scalatestplus.play" %% "scalatestplus-play" % "5.0.0" % Test,
  "com.typesafe.akka" %% "akka-actor-testkit-typed" % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-stream-testkit" % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-persistence-testkit" % akkaVersion % Test
)
