import { createEffectRegistry } from '../scala-cqrs-application/produce-effect.mjs';
import { planProductSet } from '../../src/core/product-plan.mjs';
import { requireApplicationArtifact } from '../scala-cqrs-application/generate.mjs';
import { fail } from '../../lib/products/request.mjs';
import { renderService, serviceSelection } from './render-service.mjs';
import { renderTestSupport } from './render-test-support.mjs';
import { renderConfiguration } from './render-configuration.mjs';
import { packageFor } from '../scala-cqrs-domain/naming.mjs';

const version = id => id === 'artifact-contract' ? '3' : ['saga-host-contract', 'effect-host-contract'].includes(id) ? '2' : null;
const serviceProducts = ['reference-layout', 'artifact-contract', 'exact-value-types', 'exact-value-codecs'];
const serviceFootprint = serviceProducts.map(id => ({ id, version: version(id) ?? '1' }));
const inherited = Object.fromEntries(Object.entries(createEffectRegistry('2')).map(([id, implementation]) => [id, {
  version: 'service-1',
  produce(context) {
    return implementation.produce(context).map(entry => {
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

      }
      return next;
    });
  }
}]));
export const registry = Object.freeze({ ...inherited,
  'play-service-dsl': { version: '1', produce: context => [
    ...renderService(context, serviceFootprint),
    ...renderTestSupport(serviceSelection(context.products, context.options), context.options, serviceFootprint),
    ...renderConfiguration(serviceSelection(context.products, context.options), context.options, serviceFootprint)
  ] }
});
export function generate(input) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-play-service@1') fail('SERVICE_PROFILE', 'explicit service generation profile required');
  requireApplicationArtifact(input);
  return planProductSet(input, registry);
}
