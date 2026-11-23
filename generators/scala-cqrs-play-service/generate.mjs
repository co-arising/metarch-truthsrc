import { createEffectRegistry } from '../scala-cqrs-application/produce-effect.mjs';
import { planProductSet } from '../../src/core/product-plan.mjs';
import { requireApplicationArtifact } from '../scala-cqrs-application/generate.mjs';
import { fail } from '../../lib/products/request.mjs';
import { renderService, serviceSelection } from './render-service.mjs';
import { renderTestSupport } from './render-test-support.mjs';
import { renderConfiguration } from './render-configuration.mjs';
import { packageFor } from '../scala-cqrs-domain/naming.mjs';
import { renderInvariant } from '../scala-cqrs-domain/render-domain.mjs';
import { renderAggregateLayers } from './render-aggregate-layers.mjs';
import { renderJournalReadside } from './render-journal-readside.mjs';
import { withFlippedInvocationHosts, withFlippedExecutionPipelines, withFlippedEffectHosts, withFlippedEffectPipelines } from '../../lib/derivation/pipeline-invocation-emission.mjs';
import { PIPELINE_INVOCATION_FLIPS, flipHostBase } from '../../lib/derivation/pipeline-invocation-face.mjs';
import { EFFECT_FACE_FLIPS, effectFlipHostClass } from '../../lib/derivation/effect-face.mjs';

// The akka serializer registry binds the flipped face event journal by class name,
// so the two conf lines per flipped host must spell the golden names. Each
// replacement is exact-match and must occur exactly once (fail-closed). The
// golden names come from the flip manifest via flipHostBase — the derivation
// cross-checks that spelling against the technical artifact at the host producer.
function flippedSerializerConfContent(content, context) {
  const hosts = context.products['saga-host-contract'].hosts;
  let next = content;
  for (const flip of PIPELINE_INVOCATION_FLIPS) {
    if (!hosts.some(h => h.id === flip.host)) continue;
    const stem = flip.host.replaceAll('-', '_');
    const base = flipHostBase(flip.host);
    next = replaceExactlyOnce(next, stem + 'HostSerializer"', base + 'HostSerializer"', 'conf serializer binding for ' + flip.host);
    next = replaceExactlyOnce(next, stem + 'Host$Event"', base + 'Host$Event"', 'conf event binding for ' + flip.host);
  }
  const effectHosts = context.products['effect-host-contract'].hosts;
  for (const flip of EFFECT_FACE_FLIPS) {
    if (!effectHosts.some(h => h.id === flip.host)) continue;
    const stem = flip.host.replaceAll('-', '_');
    const base = effectFlipHostClass(flip.host);
    next = replaceExactlyOnce(next, stem + 'EffectHostSerializer"', base + 'Serializer"', 'conf serializer binding for ' + flip.host);
    next = replaceExactlyOnce(next, stem + 'EffectHost$Event"', base + '$Event"', 'conf event binding for ' + flip.host);
  }
  return next;
}
function replaceExactlyOnce(content, from, to, what) {
  const parts = content.split(from);
  if (parts.length !== 2) fail(what + ' must occur exactly once in the configuration, found ' + (parts.length - 1));
  return parts[0] + to + parts[1];
}

const version = id => id === 'artifact-contract' ? '3' : ['saga-host-contract', 'effect-host-contract'].includes(id) ? '2' : null;
const serviceProducts = ['reference-layout', 'artifact-contract', 'exact-value-types', 'exact-value-codecs'];
const serviceFootprint = serviceProducts.map(id => ({ id, version: version(id) ?? '1' }));
const inherited = Object.fromEntries(Object.entries(createEffectRegistry('2')).map(([id, implementation]) => [id, {
  version: 'service-1',
  produce(context) {
    const produced = id === 'aggregate-dsl'
      ? renderAggregateLayers(context, ['reference-layout','domain-folds','exact-value-types','domain-dependencies'].map(id=>({id,version:['domain-folds','domain-dependencies'].includes(id)?'6':'1'})))
      : id === 'invariant-dsl'
        ? renderInvariant(context, ['reference-layout','domain-decision','domain-folds','exact-value-types'].map(id=>({id,version:id==='domain-decision'?'4':id==='domain-folds'?'6':'1'})), true)
        : id === 'finite-host-dsl'
          ? withFlippedInvocationHosts(implementation.produce.bind(implementation), context)
          : id === 'finite-execution-dsl'
            ? withFlippedEffectPipelines(effectContext => withFlippedExecutionPipelines(inner => implementation.produce(inner), effectContext), context)
            : id === 'durable-effect-host-dsl'
              ? withFlippedEffectHosts(implementation.produce.bind(implementation), context)
              : implementation.produce(context);
    return produced.map(entry => {
      const pins = entry.productFootprint.map(p => ({ ...p, version: version(p.id) ?? p.version }));
      if (['proto-dsl', 'finite-execution-dsl', 'finite-host-dsl'].includes(id) && !pins.some(p => p.id === 'effect-host-contract')) pins.push({ id: 'effect-host-contract', version: '2' });
      if (['proto-dsl', 'finite-execution-dsl', 'durable-effect-host-dsl'].includes(id)) pins.push({ id: 'artifact-contract', version: '3' });
      const next = { ...entry, productFootprint: pins };
      if (entry.path.startsWith('src/test/scala/') && entry.content.includes('extends AnyFunSuite {')) {
        const artifact = serviceSelection(context.products, context.options);
        const check = packageFor(artifact.artifact.context, context.options) + '.service.UnitConfigurationCheck.main(Array.empty)';
        next.content = entry.content.replaceAll('extends AnyFunSuite {', 'extends AnyFunSuite {\n  ' + check);
      }
      if (entry.path === 'build.sbt') {
        const artifact = serviceSelection(context.products, context.options);
        const testMain = packageFor(artifact.artifact.context, context.options) + '.service.UnitTestMain';
        next.content += '\nlazy val root = (project in file(".")).enablePlugins(PlayScala)\n' +
          'Compile / unmanagedSourceDirectories := Seq(baseDirectory.value / "app") ++ Seq(' + context.options.service.externalSourceRoots.map(x => 'file(' + JSON.stringify(x) + ')').join(', ') + ')\n' +
          'Test / unmanagedSourceDirectories += baseDirectory.value / "src" / "test" / "scala"\n' +
          'Test / unmanagedResourceDirectories += baseDirectory.value / "src" / "test" / "resources"\n' +
          'Test / fork := true\nTest / javaOptions += "-Dconfig.resource=service-unit.conf"\n' +
          'Test / javaOptions += "-Dservice.test.suites=" + (Test / definedTests).value.map(_.name).sorted.mkString(",")\n' +
          'Test / test := (Test / runMain).toTask(' + JSON.stringify(' ' + testMain) + ').value\n' +
          'Test / testOnly := { val ignored = complete.DefaultParsers.spaceDelimited("suite").parsed; sys.error("Use test for isolated unit suites; integration tests require their explicit runner") }\n' +
          'libraryDependencies ++= Seq(guice, jdbc, "com.github.scullxbones" %% "akka-persistence-mongo-rxmongo" % "3.0.8", "com.lightbend.akka" %% "akka-projection-jdbc" % "1.2.5", "com.mysql" % "mysql-connector-j" % "8.0.33")\n' +
          'libraryDependencies ~= (_.map { case d if d.organization == "net.imadz" && d.name == "saga-core" => d.exclude("com.github.scullxbones", "akka-persistence-mongo-scala_2.13").exclude("org.reactivemongo", "reactivemongo_2.13"); case d => d })\n' +
          'dependencyOverrides ++= Seq("akka-actor", "akka-actor-typed", "akka-stream", "akka-stream-typed", "akka-persistence", "akka-persistence-typed", "akka-persistence-query", "akka-protobuf-v3", "akka-slf4j", "akka-testkit", "akka-serialization-jackson", "akka-remote", "akka-cluster", "akka-cluster-typed", "akka-cluster-tools", "akka-coordination", "akka-distributed-data", "akka-cluster-sharding", "akka-cluster-sharding-typed").map("com.typesafe.akka" %% _ % "2.6.20")\n';
      }
      if (entry.path === 'project/build.properties') next.content = 'sbt.version=1.4.9\n';
      if (entry.path === 'project/plugins.sbt') next.content += '\naddSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.18")\n';
      if (entry.path === 'src/main/resources/application.conf') {
        next.path = 'conf/serialization.conf';
        // The serializer registry lines are emitted by the build producer, whose
        // view declares the host contract — patch only when this project carries
        // a flipped host (fixture services without it stay byte-identical).
        if (id === 'proto-dsl') next.content = flippedSerializerConfContent(next.content, context);
      }
      return next;
    });
  }
}]));
export const registry = Object.freeze({ ...inherited,
  'play-service-dsl': { version: '1', produce: context => [
    ...renderService(context, serviceFootprint),
    ...renderJournalReadside(context, serviceFootprint),
    ...renderTestSupport(serviceSelection(context.products, context.options), context.options, serviceFootprint),
    ...renderConfiguration(serviceSelection(context.products, context.options), context.options, serviceFootprint)
  ] }
});
export function generate(input) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-play-service@1') fail('SERVICE_PROFILE', 'explicit service generation profile required');
  requireApplicationArtifact(input);
  return planProductSet(input, registry);
}
