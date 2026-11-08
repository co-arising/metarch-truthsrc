ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "example.inventory"
ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / PB.protocVersion := "3.21.9"

lazy val kernel = (project in file("modules/kernel"))
  .settings(name := "inventory-aggregate-kernel")

lazy val glue = (project in file("modules/glue"))
  .dependsOn(kernel)
  .settings(
    name := "inventory-aggregate-glue",
    Compile / PB.targets := Seq(scalapb.gen() -> (Compile / sourceManaged).value),
    Test / parallelExecution := false,
    libraryDependencies ++= Seq(
      "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14" % "protobuf",
      "com.typesafe.akka" %% "akka-actor-typed" % "2.6.20",
      "com.typesafe.akka" %% "akka-persistence-typed" % "2.6.20",
      "com.typesafe.akka" %% "akka-actor-testkit-typed" % "2.6.20" % Test,
      "com.typesafe.akka" %% "akka-persistence-testkit" % "2.6.20" % Test,
      "org.scalatest" %% "scalatest" % "3.2.15" % Test
    )
  )

lazy val root = (project in file("."))
  .aggregate(kernel, glue)
  .settings(
    name := "inventory-aggregate-core",
    publish / skip := true
  )
