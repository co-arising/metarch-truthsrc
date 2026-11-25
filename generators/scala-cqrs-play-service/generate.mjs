import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { withFlippedInvariantRules } from '../../lib/derivation/aggregate-invariant-rules-emission.mjs';
import { withFlippedEventHandlers } from '../../lib/derivation/event-handler-emission.mjs';
import { withFlippedValueObjects } from '../../lib/derivation/value-object-emission.mjs';
import { withFlippedDomainEntities } from '../../lib/derivation/domain-entity-emission.mjs';
import { withFlippedAggregateLayers } from '../../lib/derivation/aggregate-layer-emission.mjs';
import { withFlippedCommandProtocols, withFlippedApplicationProtocols } from '../../lib/derivation/protocol-layer-emission.mjs';
import { withFlippedExternalEventBridges } from '../../lib/derivation/external-event-bridge-emission.mjs';
import { withFlippedAggregateRepositories } from '../../lib/derivation/aggregate-repository-emission.mjs';
import { withFlippedAggregateBootstraps } from '../../lib/derivation/aggregate-bootstrap-emission.mjs';
import { withFlippedProtoSchemas } from '../../lib/derivation/proto-schema-emission.mjs';
import { withFlippedProtoConverters } from '../../lib/derivation/proto-converter-emission.mjs';
import { withFlippedSerializationAdapters } from '../../lib/derivation/serialization-adapter-emission.mjs';
import { withFlippedServiceRuntime } from '../../lib/derivation/service-runtime-emission.mjs';
import { withFlippedProjectScaffold } from '../../lib/derivation/project-scaffold-emission.mjs';
import { withPlayServiceEmission } from '../../lib/derivation/emission-policy.mjs';
import { resolveRuntimeProfile } from '../../lib/runtime-profile.mjs';
import { remapPlanEntries } from '../../lib/layout/layout-strategy.mjs';

const PRODUCT_VERSIONS = Object.freeze({
  'artifact-contract': '3',
  'domain-dependencies': '6',
  'saga-host-contract': '2',
  'effect-host-contract': '2',
});
const version = id => PRODUCT_VERSIONS[id] ?? null;
const serviceProducts = ['reference-layout', 'artifact-contract', 'domain-dependencies', 'exact-value-types', 'exact-value-codecs'];
const serviceFootprint = serviceProducts.map(id => ({ id, version: version(id) ?? '1' }));
const inherited = Object.fromEntries(Object.entries(createEffectRegistry('2')).map(([id, implementation]) => [id, {
  version: 'service-1',
  produce(rawContext) {
    const context = withPlayServiceEmission(rawContext);
    const produced = id === 'aggregate-dsl'
      ? withFlippedAggregateBootstraps(bootCtx => withFlippedAggregateRepositories(repoCtx => withFlippedApplicationProtocols(protoCtx => withFlippedAggregateLayers(aggCtx => withFlippedDomainEntities(inner => renderAggregateLayers(inner, ['reference-layout','domain-folds','exact-value-types','domain-dependencies'].map(id=>({id,version:['domain-folds','domain-dependencies'].includes(id)?'6':'1'}))), aggCtx), protoCtx), repoCtx), bootCtx), context)
        : id === 'command-dsl'
          ? withFlippedExternalEventBridges(eebCtx => withFlippedCommandProtocols(implementation.produce.bind(implementation), eebCtx), context)
        : id === 'invariant-dsl'
          ? withFlippedEventHandlers(ehCtx => withFlippedInvariantRules(inner => renderInvariant(inner, ['reference-layout','domain-decision','domain-folds','exact-value-types','domain-dependencies'].map(id=>({id,version:id==='domain-decision'?'4':(id==='domain-folds'||id==='domain-dependencies')?'6':'1'})), true), ehCtx), context)
        : id === 'valueobject-dsl'
          ? withFlippedValueObjects(implementation.produce.bind(implementation), context)
        : id === 'proto-dsl'
          ? withFlippedProtoSchemas(implementation.produce.bind(implementation), context, 'domain')
        : id === 'converter-dsl'
          ? withFlippedSerializationAdapters(saCtx => withFlippedProtoConverters(implementation.produce.bind(implementation), saCtx), context)
        : id === 'finite-host-dsl'
          ? withFlippedProtoSchemas(psCtx => withFlippedInvocationHosts(implementation.produce.bind(implementation), psCtx), context, 'host')
          : id === 'finite-execution-dsl'
            ? withFlippedProtoSchemas(psCtx => withFlippedEffectPipelines(effectContext => withFlippedExecutionPipelines(inner => implementation.produce(inner), effectContext), psCtx), context, 'execution')
            : id === 'durable-effect-host-dsl'
              ? withFlippedProtoSchemas(psCtx => withFlippedEffectHosts(implementation.produce.bind(implementation), psCtx), context, 'effect')
              : implementation.produce(context);
    return withFlippedProjectScaffold(produced.map(entry => {
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
        const rp = resolveRuntimeProfile(context.options);
        next.content += '\nlazy val root = (project in file(".")).enablePlugins(PlayScala)\n' +
          'Compile / unmanagedSourceDirectories := Seq(baseDirectory.value / "app") ++ Seq(' + context.options.service.externalSourceRoots.map(x => 'file(' + JSON.stringify(x) + ')').join(', ') + ')\n' +
          'Test / unmanagedSourceDirectories += baseDirectory.value / "src" / "test" / "scala"\n' +
          'Test / unmanagedResourceDirectories += baseDirectory.value / "src" / "test" / "resources"\n' +
          'Test / fork := true\nTest / javaOptions += "-Dconfig.resource=service-unit.conf"\n' +
          'Test / javaOptions += "-Dservice.test.suites=" + (Test / definedTests).value.map(_.name).sorted.mkString(",")\n' +
          'Test / test := (Test / runMain).toTask(' + JSON.stringify(' ' + testMain) + ').value\n' +
          'Test / testOnly := { val ignored = complete.DefaultParsers.spaceDelimited("suite").parsed; sys.error("Use test for isolated unit suites; integration tests require their explicit runner") }\n' +
          `libraryDependencies ++= Seq(guice, jdbc, ${JSON.stringify(rp.organization)} %% ${JSON.stringify(rp.commonCoreArtifact)} % ${JSON.stringify(rp.commonCoreVersion)}, "com.typesafe.akka" %% "akka-cluster-sharding-typed" % "2.6.20", "com.github.scullxbones" %% "akka-persistence-mongo-rxmongo" % "3.0.8", "com.lightbend.akka" %% "akka-projection-jdbc" % "1.2.5", "com.lightbend.akka" %% "akka-projection-eventsourced" % "1.2.5", "com.mysql" % "mysql-connector-j" % "8.0.33")\n` +
          `libraryDependencies ~= (_.map { case d if d.organization == ${JSON.stringify(rp.organization)} && (d.name == ${JSON.stringify(rp.sagaArtifact)} || d.name == ${JSON.stringify(rp.commonCoreArtifact)}) => d.exclude("com.github.scullxbones", "akka-persistence-mongo-scala_2.13").exclude("org.reactivemongo", "reactivemongo_2.13"); case d => d })\n` +
          'dependencyOverrides ++= Seq("akka-actor", "akka-actor-typed", "akka-stream", "akka-stream-typed", "akka-persistence", "akka-persistence-typed", "akka-persistence-query", "akka-protobuf-v3", "akka-slf4j", "akka-testkit", "akka-serialization-jackson", "akka-remote", "akka-cluster", "akka-cluster-typed", "akka-cluster-tools", "akka-coordination", "akka-distributed-data", "akka-cluster-sharding", "akka-cluster-sharding-typed").map("com.typesafe.akka" %% _ % "2.6.20")\n';
      }
      if (entry.path === 'project/build.properties') next.content = 'sbt.version=1.4.9\n';
      if (entry.path === 'project/plugins.sbt') next.content += '\naddSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.18")\n';
      if (entry.path === 'src/main/resources/application.conf') {
        next.path = 'conf/serialization.conf';
      }
      return next;
    }), context);
  }
}]));
export const registry = Object.freeze({ ...inherited,
  'play-service-dsl': { version: '1', produce: rawContext => {
    const context = withPlayServiceEmission(rawContext);
    return withFlippedProjectScaffold(withFlippedServiceRuntime(ctx => [
      ...renderService(ctx, serviceFootprint),
      ...renderJournalReadside(ctx, serviceFootprint),
      ...renderTestSupport(serviceSelection(ctx.products, ctx.options), ctx.options, serviceFootprint),
      ...renderConfiguration(serviceSelection(ctx.products, ctx.options), ctx.options, serviceFootprint)
    ], context), context);
  } }
});
function sbtRelativeFileExpr(outDir, absPath) {
  if (!outDir || typeof absPath !== 'string' || !isAbsolute(absPath)) {
    return 'file(' + JSON.stringify(absPath) + ')';
  }
  const rel = relative(outDir, absPath);
  if (!rel || isAbsolute(rel)) return 'file(' + JSON.stringify(absPath) + ')';
  const segments = rel.split(sep).filter(Boolean).map(p => JSON.stringify(p));
  return '(baseDirectory.value / ' + segments.join(' / ') + ').getCanonicalFile';
}

function portableBuildSbt(content, outDir, options) {
  let out = content;
  const repo = options?.runtimeArtifact?.repository;
  if (outDir && typeof repo === 'string' && repo.startsWith('file:///')) {
    const repoExpr = '(' + sbtRelativeFileExpr(outDir, fileURLToPath(repo)) + '.toURI.toString)';
    out = out.replace(
      'resolvers += "explicit-frozen-runtime" at ' + JSON.stringify(repo),
      'resolvers += "explicit-frozen-runtime" at ' + repoExpr
    );
  }
  const roots = options?.service?.externalSourceRoots ?? [];
  for (const root of roots) {
    if (outDir && typeof root === 'string' && isAbsolute(root)) {
      out = out.replaceAll('file(' + JSON.stringify(root) + ')', sbtRelativeFileExpr(outDir, root));
    }
  }
  return out;
}

export function generate(input, extra = {}) {
  if (input.manifest?.targetProfile !== 'scala-cqrs-play-service@1') fail('SERVICE_PROFILE', 'explicit service generation profile required');
  requireApplicationArtifact(input);
  const plan = planProductSet(input, registry);
  const remapped = input.options?.fileLayout ? remapPlanEntries(plan, input.options.fileLayout) : plan;
  if (!extra?.outDir || !remapped?.plan?.entries) return remapped;
  return {
    ...remapped,
    plan: {
      ...remapped.plan,
      entries: remapped.plan.entries.map(e =>
        e.path === 'build.sbt' ? { ...e, content: portableBuildSbt(e.content, extra.outDir, input.options) } : e),
    },
  };
}
