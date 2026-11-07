ThisBuild / scalaVersion := "2.13.14"

Compile / unmanagedSourceDirectories := Seq(baseDirectory.value / "app")
Test / fork := true
Test / parallelExecution := false

libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-actor-typed" % "2.6.20",
  "com.typesafe.akka" %% "akka-persistence-typed" % "2.6.20",
  "com.typesafe.akka" %% "akka-actor-testkit-typed" % "2.6.20" % Test,
  "com.typesafe.akka" %% "akka-persistence-testkit" % "2.6.20" % Test,
  "org.scalatest" %% "scalatest" % "3.2.15" % Test
)
