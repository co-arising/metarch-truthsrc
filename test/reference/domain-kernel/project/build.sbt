ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "example.counter"
ThisBuild / version := "0.1.0-SNAPSHOT"

lazy val kernel = (project in file("modules/kernel"))
  .settings(name := "counter-domain-kernel")

lazy val glue = (project in file("modules/glue"))
  .dependsOn(kernel)
  .settings(
    name := "counter-domain-glue",
    Compile / PB.targets := Seq(scalapb.gen() -> (Compile / sourceManaged).value),
    libraryDependencies ++= Seq(
      "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14" % "protobuf",
      "org.scalatest" %% "scalatest" % "3.2.15" % Test
    )
  )

lazy val root = (project in file("."))
  .aggregate(kernel, glue)
  .settings(
    name := "counter-domain",
    publish / skip := true
  )
