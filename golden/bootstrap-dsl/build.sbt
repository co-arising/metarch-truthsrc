name := "bootstrap-dsl-golden"

ThisBuild / organization := "net.imadz"
ThisBuild / scalaVersion := "2.13.14"
ThisBuild / version := "0.1.0-SNAPSHOT"

val akkaVersion = "2.6.20"
val imadzVersion = "0.2"

resolvers ++= Seq(
  "Aliyun" at "https://maven.aliyun.com/repository/public/"
)

Compile / scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked")

libraryDependencies ++= Seq(
  "com.google.inject" % "guice" % "4.2.3"
)
