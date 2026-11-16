import { q } from './syntax.mjs';
import { at, array, detach, fail, object, text, unique } from '../../../lib/products/request.mjs';

/** Only accept canonical absolute paths returned by implementationBuildInputs. */
export function buildRoots(model, raw) {
  const roots = detach(raw), source = at('saga-monarch-build');
  array(roots, source); unique(roots.map(r => r.id), 'SAGA_MONARCH_BUILD_ROOTS', source);
  if (roots.length !== model.sourceRoots.length) fail('SAGA_MONARCH_BUILD_ROOTS', 'complete captured build root set required', source);
  for (const root of roots) {
    object(root, ['id', 'module', 'absolutePath'], source); text(root.absolutePath, source);
    if (root.module !== 'ext' || !model.sourceRoots.some(r => r.id === root.id && r.module === root.module) ||
        !root.absolutePath.startsWith('/') || root.absolutePath.split('/').slice(1).some(p => !p || p === '.' || p === '..') ||
        /[\\\p{Cc}\p{Cf}]/u.test(root.absolutePath) || !root.absolutePath.isWellFormed())
      fail('SAGA_MONARCH_BUILD_ROOTS', 'canonical captured absolute external root required', source);
  }
  return roots;
}

export function buildArtifacts(m) {
  return [
    { role: 'build', kind: 'build', path: 'project/build.properties', sources: m.sources, directDeps: [] },
    { role: 'build', kind: 'build', path: 'build.sbt', sources: [...m.sources, ...m.implementations.map(i => i.source)], directDeps: ['project/build.properties', ...m.artifacts.map(a => a.path)] },
    { role: 'serialization-config', kind: 'serialization-config', path: 'src/main/resources/reference.conf', sources: m.sources, directDeps: [] },
  ];
}

export function buildTemplate(m, artifact, roots, out) {
  if (artifact.path.endsWith('.properties')) { out.append('sbt.version=1.4.9\n', artifact.sources); return; }
  const runtime = [m.technical.runtime.saga, ...m.technical.runtime.monarch];
  const coordinate = artifact => { const [org, name, version] = artifact.split(':'); return q(org) + ' % ' + q(name) + ' % ' + q(version); };
  out.append(`ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "generated"
ThisBuild / version := "0.1.0"
ThisBuild / resolvers ++= sys.props.get("truthsrc.repositories").toSeq.flatMap(_.split(",").toSeq)
  .filter(_.nonEmpty).zipWithIndex.map { case (repository, index) => ("truthsrc-" + index) at repository }

lazy val commonSettings = Seq(
  Compile / scalacOptions ++= Seq("-target:11", "-deprecation", "-feature", "-unchecked"),
  Compile / javacOptions ++= Seq("--release", "11")
)
// Fixed supply pins; callers separately verify admitted artifact bytes. No repository paths are inferred.
${runtime.map(r => '// ' + r.artifact + ' sha256=' + (r.artifactSha256 ?? r.sha256)).join('\n')}
lazy val kernel = (project in file("modules/kernel")).settings(commonSettings)
  .settings(name := ${q(m.technical.id + '-kernel')})
lazy val glue = (project in file("modules/glue")).dependsOn(kernel).settings(commonSettings)
  .settings(name := ${q(m.technical.id + '-glue')}, libraryDependencies ++= Seq(
${runtime.map(r => '    ' + coordinate(r.artifact)).join(',\n')}
  ))
lazy val ext = (project in file("modules/ext")).dependsOn(kernel).settings(commonSettings)
  .settings(name := ${q(m.technical.id + '-ext')}, Compile / unmanagedSourceDirectories ++= Seq(
${roots.map(r => '    file(' + q(r.absolutePath) + ')').join(',\n')}
  ))
lazy val root = (project in file(".")).dependsOn(kernel, glue, ext).aggregate(kernel, glue, ext)
  .settings(commonSettings).settings(name := ${q(m.technical.root.id)})
`, artifact.sources);
}

/** Actual fixed-runtime serializers, not JSON/Java catch-all application bindings. */
export function serializationConfigTemplate(m, out) {
  out.append(`# The caller supplies the journal and optional snapshot store before ActorSystem startup.
# Do not change a namespace to evade an existing durable identity.
akka.actor.allow-java-serialization = off
akka.actor.serializers {
  strict-saga = "net.imadz.infra.saga.strict.StrictSagaSerializer"
  monarch-proto = "net.imadz.monarch.persistence.MonarchSerializer"
  monarch-run-wire = "net.imadz.monarch.persistence.RunProtocolSerializer"
  monarch-operation-protobuf = "net.imadz.monarch.persistence.operation.OperationSerializer"
  monarch-operation-wire-protobuf = "net.imadz.monarch.persistence.operation.OperationWireSerializer"
  monarch-resource-protobuf = "net.imadz.monarch.persistence.resource.ResourceSerializer"
  monarch-resource-wire-protobuf = "net.imadz.monarch.persistence.resource.ResourceWireSerializer"
  monarch-delivery-protobuf = "net.imadz.monarch.persistence.delivery.DeliverySerializer"
  monarch-delivery-wire-protobuf = "net.imadz.monarch.persistence.delivery.DeliveryWireSerializer"
  monarch-batch-protobuf = "net.imadz.monarch.persistence.batch.BatchSerializer"
  monarch-batch-wire-protobuf = "net.imadz.monarch.persistence.batch.BatchWireSerializer"
}
akka.actor.serialization-bindings {
  "net.imadz.infra.saga.strict.StrictDurable" = strict-saga
  "net.imadz.common.CborSerializable" = jackson-cbor
  "net.imadz.monarch.persistence.PersistentMonarch$Event" = monarch-proto
  "net.imadz.monarch.persistence.PersistentMonarch$DurableState" = monarch-proto
  "net.imadz.monarch.persistence.PersistentMonarch$RunState" = monarch-proto
  "net.imadz.monarch.persistence.RunProtocol$Wire" = monarch-run-wire
  "net.imadz.monarch.persistence.operation.OperationEvent" = monarch-operation-protobuf
  "net.imadz.monarch.persistence.operation.OperationState" = monarch-operation-protobuf
  "net.imadz.monarch.persistence.operation.OperationProtocol$Wire" = monarch-operation-wire-protobuf
  "net.imadz.monarch.persistence.resource.ResourceEvent" = monarch-resource-protobuf
  "net.imadz.monarch.persistence.resource.ResourceState" = monarch-resource-protobuf
  "net.imadz.monarch.persistence.resource.ResourceProtocol$Wire" = monarch-resource-wire-protobuf
  "net.imadz.monarch.persistence.delivery.DeliveryEvent" = monarch-delivery-protobuf
  "net.imadz.monarch.persistence.delivery.DeliveryState" = monarch-delivery-protobuf
  "net.imadz.monarch.persistence.delivery.DeliveryProtocol$Wire" = monarch-delivery-wire-protobuf
  "net.imadz.monarch.persistence.batch.BatchEvent" = monarch-batch-protobuf
  "net.imadz.monarch.persistence.batch.BatchState" = monarch-batch-protobuf
  "net.imadz.monarch.persistence.batch.BatchProtocol$Wire" = monarch-batch-wire-protobuf
}
akka.serialization.jackson.jackson-modules += "net.imadz.infra.saga.strict.StrictJacksonModule"
`, m.sources);
}
