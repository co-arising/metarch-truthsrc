ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "example.playreference"
ThisBuild / version := "0.1.0"
ThisBuild / PB.protocVersion := "3.21.9"
ThisBuild / dependencyOverrides ++= Seq(
  "com.google.guava" % "guava" % "30.1.1-jre",
  "commons-codec" % "commons-codec" % "1.15"
)
ThisBuild / scalacOptions += "-target:jvm-11"
ThisBuild / javacOptions ++= Seq("--release", "11")
ThisBuild / Test / parallelExecution := false

lazy val kernel = (project in file("modules/kernel"))
lazy val glue = (project in file("modules/glue")).dependsOn(kernel).settings(
  Compile / PB.targets := Seq(scalapb.gen() -> (Compile / sourceManaged).value),
  libraryDependencies ++= Seq(
    "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14" % "protobuf",
    "com.typesafe.akka" %% "akka-actor-typed" % "2.6.20",
    "com.typesafe.akka" %% "akka-persistence-typed" % "2.6.20",
    "com.typesafe.akka" %% "akka-persistence-query" % "2.6.20",
    "com.typesafe.play" %% "play" % "2.8.18",
    "com.h2database" % "h2" % "2.2.224",
    "org.iq80.leveldb" % "leveldb" % "0.12"
  )
)
lazy val ext = (project in file("modules/ext")).dependsOn(kernel, glue)
lazy val root = (project in file(".")).enablePlugins(PlayScala).dependsOn(kernel, glue, ext).aggregate(kernel, glue, ext).settings(
  Compile / unmanagedSourceDirectories := Seq(baseDirectory.value / "src/main/scala"),
  Test / unmanagedSourceDirectories := Seq(baseDirectory.value / "src/test/scala"),
  libraryDependencies ++= Seq(
    "com.typesafe.play" %% "play-test" % "2.8.18" % Test,
    "org.scalatest" %% "scalatest" % "3.2.15" % Test
  ),
  Test / fork := false,
  publish / skip := true
)
