ThisBuild / organization := "net.imadz"
ThisBuild / scalaVersion := "2.13.14"
ThisBuild / version := "0.1.0-SNAPSHOT"

val akkaVersion = "2.6.20"
val imadzVersion = "0.2"

resolvers ++= Seq(
  "Aliyun" at "https://maven.aliyun.com/repository/public/"
)

lazy val root = (project in file("."))
  .settings(
    name := "golden-monarch-dsl",
    libraryDependencies ++= Seq(
      "net.imadz" %% "monarch-persistence" % imadzVersion,
      "net.imadz" %% "monarch-core" % imadzVersion,
      "net.imadz" %% "common-core" % imadzVersion,
      "com.typesafe.akka" %% "akka-actor-typed" % akkaVersion,
      "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
      "com.typesafe.play" %% "play-json" % "2.9.3"
    )
  )
