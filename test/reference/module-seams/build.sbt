ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "example.parcel"
ThisBuild / version := "0.1.0-candidate"
ThisBuild / Test / parallelExecution := false
Global / concurrentRestrictions += Tags.limit(Tags.Test, 1)

lazy val referenceSettings = Seq(
  scalacOptions ++= Seq("-encoding", "UTF-8", "-deprecation", "-feature", "-unchecked"),
  libraryDependencies += "org.scalatest" %% "scalatest-funsuite" % "3.2.15" % Test
)

lazy val kernel = (project in file("modules/kernel"))
  .settings(referenceSettings)

lazy val glue = (project in file("modules/glue"))
  .dependsOn(kernel)
  .settings(referenceSettings)

lazy val ext = (project in file("modules/ext"))
  .dependsOn(kernel, glue)
  .settings(referenceSettings)

lazy val root = (project in file("."))
  .dependsOn(kernel, glue, ext)
  .aggregate(kernel, glue, ext)
  .settings(referenceSettings)
