export function buildArtifacts(model) {
  const context = model.kernel.contexts[0];
  if (!context) throw new TypeError('aggregate build requires a semantic context');
  const stem = context.package.split('.').at(-1);
  const sources = model.artifacts.flatMap(artifact => artifact.sources);
  return [
    { path: 'build.sbt', kind: 'build', sources, directDeps: ['project/build.properties', 'project/plugins.sbt'], body:
      'ThisBuild / scalaVersion := "2.13.14"\n' +
      'ThisBuild / organization := ' + JSON.stringify(context.package) + '\n' +
      'ThisBuild / version := "0.1.0-SNAPSHOT"\n' +
      'ThisBuild / PB.protocVersion := "3.21.9"\n\n' +
      'lazy val kernel = (project in file("modules/kernel"))\n  .settings(name := ' + JSON.stringify(stem + '-aggregate-kernel') + ')\n\n' +
      'lazy val glue = (project in file("modules/glue"))\n  .dependsOn(kernel)\n  .settings(\n' +
      '    name := ' + JSON.stringify(stem + '-aggregate-glue') + ',\n' +
      '    Compile / PB.targets := Seq(scalapb.gen() -> (Compile / sourceManaged).value),\n' +
      '    Test / parallelExecution := false,\n' +
      '    libraryDependencies ++= Seq(\n' +
      '      "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14" % "protobuf",\n' +
      '      "com.typesafe.akka" %% "akka-actor-typed" % "2.6.20",\n' +
      '      "com.typesafe.akka" %% "akka-persistence-typed" % "2.6.20",\n' +
      '      "com.typesafe.akka" %% "akka-actor-testkit-typed" % "2.6.20" % Test,\n' +
      '      "com.typesafe.akka" %% "akka-persistence-testkit" % "2.6.20" % Test,\n' +
      '      "org.scalatest" %% "scalatest" % "3.2.15" % Test\n    )\n  )\n\n' +
      'lazy val root = (project in file("."))\n  .aggregate(kernel, glue)\n  .settings(\n' +
      '    name := ' + JSON.stringify(stem + '-aggregate-core') + ',\n    publish / skip := true\n  )\n' },
    { path: 'project/build.properties', kind: 'build', sources, directDeps: [], body: 'sbt.version=1.4.9\n' },
    { path: 'project/plugins.sbt', kind: 'build', sources, directDeps: [], body:
      'addSbtPlugin("com.thesamet" % "sbt-protoc" % "1.0.6")\n' +
      'libraryDependencies += "com.thesamet.scalapb" %% "compilerplugin" % "0.11.14"\n' },
  ];
}

export function buildTemplate(artifact, out) { out.append(artifact.body, artifact.sources); }
