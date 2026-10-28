import { entry, packageFor, symbol, typeName } from './naming.mjs';
import { serializationModel } from './serialization.mjs';
import { verificationTests } from './render-verification.mjs';

/** Build/test support for the domain-source profile, not a runnable application host. */
export function renderScaffold({ products, options }, footprint, externalIngress = false) {
  const aggregates = products['reference-layout'].declarations.filter(d => d.ref.kind === 'aggregate');
  const sources = aggregates.map(a => a.source);
  const build = 'scalaVersion := "2.13.14"\n\nCompile / unmanagedSourceDirectories += baseDirectory.value / "app"\nCompile / PB.protoSources := Seq(baseDirectory.value / "app" / "protobuf")\nCompile / PB.targets := Seq(scalapb.gen() -> (Compile / sourceManaged).value)\nlibraryDependencies ++= Seq(\n  "com.typesafe.akka" %% "akka-persistence-typed" % "2.6.20",\n  "com.typesafe.akka" %% "akka-persistence-testkit" % "2.6.20" % Test,\n  "com.typesafe.akka" %% "akka-actor-testkit-typed" % "2.6.20" % Test,\n  "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14" % "protobuf",\n  "org.scalatest" %% "scalatest" % "3.2.15" % Test\n)\nTest / parallelExecution := false\n';
  const plugins = 'addSbtPlugin("com.thesamet" % "sbt-protoc" % "1.0.6")\nlibraryDependencies += "com.thesamet.scalapb" %% "compilerplugin" % "0.11.14"\n';
  let spec = 'import org.scalatest.funsuite.AnyFunSuite\n\nfinal class GeneratedDomainRoundtripSpec extends AnyFunSuite {\n';
  for (const a of aggregates) {
    const pkg = packageFor(a.ref.context, options), name = symbol(a.ref.id);
    spec += '  test(' + JSON.stringify(a.ref.context + '/' + a.ref.id + ' state survives actual protobuf bytes') + ') {\n' +
      '    val state = ' + pkg + '.domain.' + name + 'State.empty\n' +
      '    val encoded = ' + pkg + '.infrastructure.serialization.DomainConverters.encode' + a.ref.id + 'StatePB(state)\n' +
      '    val parsed = ' + pkg + '.infrastructure.proto.' + a.ref.id + 'StatePB.parseFrom(encoded.toByteArray)\n' +
      '    assert(' + pkg + '.infrastructure.serialization.DomainConverters.decode' + a.ref.id + 'StatePB(parsed) == state)\n  }\n';
  }
  for (const d of products['exact-value-types']) {
    const pkg = packageFor(d.domain.context, options), name = typeName({ form: 'nominal', ref: d.domain }, options);
    const amount = d.scale ? '0.' + '0'.repeat(d.scale - 1) + '1' : '1';
    const value = name + '(BigDecimal(' + JSON.stringify(amount) + ')' + (d.unitMember ? ', ' + JSON.stringify(d.units[0]) : '') + ')';
    spec += '  test(' + JSON.stringify(d.domain.context + '/' + d.domain.id + ' exact domain wire PO and protobuf roundtrip') + ') {\n' +
      '    val value = ' + value + '\n    val c = ' + pkg + '.infrastructure.serialization.DomainConverters\n' +
      '    assert(c.' + symbol(d.domain.id + 'FromWire') + '(c.' + symbol(d.domain.id + 'ToWire') + '(value)) == value)\n' +
      '    assert(c.' + symbol(d.domain.id + 'FromPO') + '(c.' + symbol(d.domain.id + 'ToPO') + '(value)) == value)\n' +
      '    val encoded = c.encode' + d.domain.id + 'PB(value)\n' +
      '    assert(c.decode' + d.domain.id + 'PB(' + pkg + '.infrastructure.proto.' + d.domain.id + 'PB.parseFrom(encoded.toByteArray)) == value)\n' +
      '    intercept[IllegalArgumentException](c.decode' + d.domain.id + 'PB(encoded.copy(f0 = "1e2")))\n  }\n';
  }
  spec += '}\n';
  const actorSpec = 'import akka.actor.testkit.typed.scaladsl.ActorTestKit\nimport akka.persistence.testkit.PersistenceTestKitPlugin\nimport com.typesafe.config.ConfigFactory\nimport org.scalatest.funsuite.AnyFunSuite\n\nfinal class GeneratedActorStateSpec extends AnyFunSuite {\n' +
    aggregates.map(a => {
      const pkg = packageFor(a.ref.context, options), name = symbol(a.ref.id);
      const hosts = products['domain-dependencies'].hosts.filter(h => h.command.context === a.ref.context && h.command.owner[0] === a.ref.id);
      const methods = hosts.map(h => '        def ' + symbol(h.id.id) + '(state: ' + pkg + '.domain.' + name + 'State, p: ' + pkg + '.domain.' + name + 'Protocol.' + symbol(h.command.id) + '): ' + typeName(h.outputType, options) + ' = throw new UnsupportedOperationException("query-only test port")\n').join('');
      const external = externalIngress && products['domain-dependencies'].externalProducers.some(p => p.event.context === a.ref.context && p.event.owner[0] === a.ref.id);
      const authority = external ? ', new ' + pkg + '.domain.' + name + 'Aggregate.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = false }' : '';
      return '  test(' + JSON.stringify(a.ref.context + '/' + a.ref.id + ' real actor serves typed state') + ') {\n' +
        '    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))\n' +
        '    try {\n      val hosts = new ' + pkg + '.domain.' + name + 'Computations {\n' + methods + '      }\n' +
        '      val ref = kit.spawn(' + pkg + '.domain.' + name + 'AggregateFactory.create("generated-' + a.ref.id + '", ' + pkg + '.domain.' + name + 'State.empty, hosts' + authority + '))\n' +
        '      val probe = kit.createTestProbe[' + pkg + '.domain.' + name + 'State]()\n      ref ! ' + pkg + '.domain.' + name + 'Aggregate.GetState(probe.ref)\n' +
        '      probe.expectMessage(' + pkg + '.domain.' + name + 'State.empty)\n    } finally kit.shutdownTestKit()\n  }\n';
    }).join('') + verificationTests({ products, options }) + '}\n';
  const application = 'akka.actor.allow-java-serialization = off\nakka.actor.warn-about-java-serializer-usage = on\n' +
    'akka.actor.serializers {\n' + products['reference-layout'].contexts.map((context, i) => '  domainProto' + i + ' = ' + JSON.stringify(packageFor(context, options) + '.infrastructure.serialization.DomainProtoSerializer') + '\n').join('') +
    '}\nakka.actor.serialization-bindings {\n' + serializationModel(products, options).map(n => '  ' + JSON.stringify(n.pkg + '.infrastructure.proto.' + n.name) + ' = domainProto' + products['reference-layout'].contexts.findIndex(c => packageFor(c, options) === n.pkg) + '\n').join('') + '}\n';
  // Non-Scala support files carry their own legal comment syntax.
  const support = (path, text, kind) => ({ ...entry(path, text, kind, sources, footprint), content: text });
  return [entry('build.sbt', build, 'build', sources, footprint), entry('project/plugins.sbt', plugins, 'build', sources, footprint),
    support('src/main/resources/application.conf', application, 'build'),
    support('project/build.properties', 'sbt.version=1.11.7\n', 'build'),
    entry('src/test/scala/GeneratedDomainRoundtripSpec.scala', spec, 'generated-test', sources, footprint),
    entry('src/test/scala/GeneratedActorStateSpec.scala', actorSpec, 'generated-test', sources, footprint)];
}
