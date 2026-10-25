// P14 批B 首动作：monarch-core/monarch-persistence 0.2.1 候选 jar 兼容探针
// go 判据：①akka 解析面全 2.6.20（dependencyOverrides 钉 P5 模式，混版=ManifestInfo 启动即拒）
// ②scalapb-runtime 0.11.14 与 monarch-persistence POM 同版 ③inmem journal 下
// StartRun→Accepted、同 runId 重发→Rejected(reason)、journal 事件序列 RunStarted/StageDone×2/RunCompleted
name := "monarch-probe"
organization := "net.imadz"
version := "0.1"
scalaVersion := "2.13.14"

val akkaVersion = "2.6.20"

libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-actor-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-query" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-serialization-jackson" % akkaVersion,
  "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14"
)

dependencyOverrides ++= Seq(
  "com.typesafe.akka" %% "akka-actor" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence" % akkaVersion,
  "com.typesafe.akka" %% "akka-actor-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion
)

unmanagedBase := baseDirectory.value / "lib"

Compile / run / fork := true
Compile / run / connectInput := true
run / javaOptions ++= Seq("-Xms256m", "-Xmx512m")
