ThisBuild / organization := "net.imadz"
ThisBuild / scalaVersion := "2.13.14"
ThisBuild / version := "0.1.0-SNAPSHOT"
resolvers ++= Seq("Aliyun" at "https://maven.aliyun.com/repository/public/")
lazy val root = (project in file(".")).settings(
  name := "golden-aggregate-dsl",
  libraryDependencies ++= Seq(
    "net.imadz" %% "common-core" % "0.2",
    "com.typesafe.akka" %% "akka-actor-typed" % "2.6.20",
    "com.typesafe.akka" %% "akka-persistence-typed" % "2.6.20"
  )
)
