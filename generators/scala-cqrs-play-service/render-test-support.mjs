import { entry, packageFor } from '../scala-cqrs-domain/naming.mjs';

export function renderTestSupport(artifact, options, footprint) {
  const pkg = packageFor(artifact.artifact.context, options) + '.service';
  const source = [artifact.source];
  const config = `include "serialization.conf"
service.test-tier = unit
play.application.loader = ""
akka.actor.provider = local
akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
akka.persistence.testkit.journal.class = "akka.persistence.testkit.PersistenceTestKitPlugin"
akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshotstore.pluginid"
akka.persistence.testkit.snapshotstore.pluginid {
  class = "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin"
  snapshot-is-optional = false
}
akka.persistence.journal.auto-start-journals = []
akka.persistence.snapshot-store.auto-start-snapshot-stores = []
akka.persistence.testkit.events.serialize = true
akka.persistence.testkit.snapshots.serialize = true
`;
  const support = `package ${pkg}

import com.typesafe.config.{Config, ConfigFactory}
import java.security.Permission
import scala.jdk.CollectionConverters._

final class UnitNoNetwork extends SecurityManager {
  override def checkPermission(permission: Permission): Unit = ()
  override def checkPermission(permission: Permission, context: Any): Unit = ()
  override def checkConnect(host: String, port: Int): Unit = throw new SecurityException("unit tests cannot connect to network services")
  override def checkConnect(host: String, port: Int, context: Any): Unit = checkConnect(host, port)
  override def checkListen(port: Int): Unit = throw new SecurityException("unit tests cannot bind network listeners")
  override def checkAccept(host: String, port: Int): Unit = throw new SecurityException("unit tests cannot accept network connections")
}
object UnitConfigurationCheck {
  def install(): Unit = {
    if (System.getSecurityManager == null) System.setSecurityManager(new UnitNoNetwork)
    require(System.getSecurityManager.isInstanceOf[UnitNoNetwork], "unit network boundary is unavailable")
  }
  def validate(config: Config): Unit = {
    require(config.getString("service.test-tier") == "unit", "explicit unit tier required")
    require(config.getString("akka.actor.provider") == "local", "unit actor provider must be local")
    require(config.getString("akka.persistence.journal.plugin") == "akka.persistence.testkit.journal", "unit journal must be testkit")
    require(config.getString("akka.persistence.snapshot-store.plugin") == "akka.persistence.testkit.snapshotstore.pluginid", "unit snapshot store must be testkit")
    require(config.getString("akka.persistence.testkit.journal.class") == "akka.persistence.testkit.PersistenceTestKitPlugin", "unit journal implementation must be testkit")
    require(config.getString("akka.persistence.testkit.snapshotstore.pluginid.class") == "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin", "unit snapshot implementation must be testkit")
    require(config.getStringList("akka.persistence.journal.auto-start-journals").isEmpty, "unit journal auto-start must be empty")
    require(config.getStringList("akka.persistence.snapshot-store.auto-start-snapshot-stores").isEmpty, "unit snapshot auto-start must be empty")
    require(config.getString("play.application.loader").isEmpty && !config.hasPath("service.connections"), "unit configuration must not include production service wiring")
    require(!config.hasPath("db") || config.getConfig("db").root().isEmpty, "unit configuration must not enable JDBC pools")
    require(System.getSecurityManager.isInstanceOf[UnitNoNetwork], "unit JVM must enforce no-network execution")
  }
  def main(args: Array[String]): Unit = {
    install()
    validate(ConfigFactory.load())
    println("UNIT-CONFIGURATION-OK journal=testkit snapshot=testkit network=denied")
  }
}
object UnitTestMain {
  def main(args: Array[String]): Unit = {
    UnitConfigurationCheck.main(Array.empty)
    println("UNIT-JVM-PID=" + ProcessHandle.current().pid())
    val suites = System.getProperty("service.test.suites", "").split(",").filter(_.nonEmpty)
    require(suites.nonEmpty && suites.exists(_.endsWith("GeneratedUnitStorageSpec")), "nonempty discovered unit suites required")
    val passed = org.scalatest.tools.Runner.run(Array("-o") ++ suites.flatMap(name => Array("-s", name)))
    require(passed, "unit suite failure")
  }
}
`;
  const spec = `package ${pkg}

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior, RetentionCriteria}
import akka.actor.typed.ActorRef
import com.typesafe.config.{ConfigFactory, ConfigResolveOptions}
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.duration._

final class GeneratedUnitStorageSpec extends AnyFunSuite {
  UnitConfigurationCheck.main(Array.empty)
  test("service errors and strict JSON preserve client conflicts and reject ambiguous input") {
    import ${artifact.artifact.id}Service._
    assert(RequestConflict.status == 409 && NotAuthenticated.status == 401 && NotAuthorized.status == 403)
    assert(decodeBody("{\\\"amount\\\":\\\"10000\\\"}").isRight)
    for (text <- Vector("", "{} {}", "{\\\"a\\\":1,\\\"a\\\":2}", "{\\\"a\\\":{\\\"b\\\":1,\\\"b\\\":2}}", "[1,", "[" * 65 + "0" + "]" * 65)) {
      assert(decodeBody(text) == Left(InvalidRequest))
    }
  }
  test("production configuration rejects missing connections without creating actors or drivers") {
    val production = ConfigFactory.parseResources("service.conf")
    val references = ConfigFactory.parseString("""PLAY_SECRET = "test-only-not-a-secret"
MONGO_URI = "mongodb://127.0.0.1:1/never-connected"
MYSQL_JDBC_URL = "jdbc:mysql://127.0.0.1:1/never_connected"
MYSQL_USER = "test-only"
MYSQL_PASSWORD = "test-only-not-a-secret"
""")
    val isolated = ConfigResolveOptions.noSystem().setUseSystemEnvironment(false)
    for (missing <- Vector("MONGO_URI", "MYSQL_JDBC_URL", "MYSQL_USER", "MYSQL_PASSWORD", "PLAY_SECRET")) {
      intercept[com.typesafe.config.ConfigException.UnresolvedSubstitution] {
        production.withFallback(references.withoutPath(missing)).resolve(isolated)
      }
    }
    val resolved = production.withFallback(references).resolve(isolated)
    assert(resolved.getString("akka.contrib.persistence.mongodb.mongo.mongouri") == resolved.getString("service.connections." + ${JSON.stringify(artifact.deployment.service.journal.connectionRef)}))
    assert(resolved.getString("db.default.url") == resolved.getString("service.connections." + ${JSON.stringify(artifact.deployment.service.readSide.connectionRef)}))
  }
  test("unit configuration denies production stores and socket access before actors start") {
    val config = ConfigFactory.load()
    UnitConfigurationCheck.validate(config)
    for (overrideText <- Vector(
      "akka.persistence.journal.plugin = akka-contrib-mongodb-persistence-journal",
      "akka.persistence.snapshot-store.plugin = akka-contrib-mongodb-persistence-snapshot",
      "akka.persistence.snapshot-store.auto-start-snapshot-stores = [akka-contrib-mongodb-persistence-snapshot]",
      "akka.actor.provider = cluster",
      "db.default.url = \\\"jdbc:mysql://localhost/unit-forbidden\\\""
    )) intercept[IllegalArgumentException](UnitConfigurationCheck.validate(ConfigFactory.parseString(overrideText).withFallback(config)))
    intercept[SecurityException](new java.net.Socket("127.0.0.1", 27017))
    intercept[SecurityException](new java.net.ServerSocket(0))
  }
  test("testkit persists a real snapshot and restores the event-sourced actor without Docker") {
    val config = ConfigFactory.load()
    UnitConfigurationCheck.validate(config)
    val kit = ActorTestKit(config)
    sealed trait Command
    final case class Append(value: String, reply: ActorRef[String]) extends Command
    final case class Get(reply: ActorRef[String]) extends Command
    def behavior = EventSourcedBehavior[Command, String, String](PersistenceId.ofUniqueId("generated-unit-snapshot"), "",
      (state, command) => command match {
        case Append(value, reply) => Effect.persist(value).thenReply(reply)(identity)
        case Get(reply) => Effect.reply(reply)(state)
      }, (_, event) => event).withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 1, keepNSnapshots = 1))
    try {
      val snapshots = akka.persistence.testkit.scaladsl.SnapshotTestKit(kit.system)
      val probe = kit.createTestProbe[String]()
      val first = kit.spawn(behavior)
      first ! Append("persisted", probe.ref)
      probe.expectMessage("persisted")
      snapshots.expectNextPersisted("generated-unit-snapshot", "persisted")
      kit.stop(first)
      val recovered = kit.spawn(EventSourcedBehavior[Command, String, String](PersistenceId.ofUniqueId("generated-unit-snapshot"), "",
        (state, command) => command match {
          case Get(reply) => Effect.reply(reply)(state)
          case Append(value, reply) => Effect.persist(value).thenReply(reply)(identity)
        }, (_, event) => event))
      recovered ! Get(probe.ref)
      probe.expectMessage("persisted")
    } finally kit.shutdownTestKit()
  }
}
`;
  return [
    { ...entry('src/test/resources/service-unit.conf', config, 'service-test', source, footprint), content: config },
    entry('src/test/scala/UnitConfigurationCheck.scala', support, 'service-test', source, footprint),
    entry('src/test/scala/GeneratedUnitStorageSpec.scala', spec, 'service-test', source, footprint)
  ];
}
