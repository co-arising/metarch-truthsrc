package example.bankwealth.service

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior, RetentionCriteria}
import akka.actor.typed.ActorRef
import com.typesafe.config.{ConfigFactory, ConfigResolveOptions, ConfigUtil}
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.duration._

final class GeneratedUnitStorageSpec extends AnyFunSuite {
  UnitConfigurationCheck.main(Array.empty)
  test("service errors and strict JSON preserve client conflicts and reject ambiguous input") {
    import BankServiceService._
    assert(RequestConflict.status == 409 && NotAuthenticated.status == 401 && NotAuthorized.status == 403)
    assert(decodeBody("{\"amount\":\"10000\"}").isRight)
    for (text <- Vector("", "{} {}", "{\"a\":1,\"a\":2}", "{\"a\":{\"b\":1,\"b\":2}}", "[1,", "[" * 65 + "0" + "]" * 65)) {
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
    assert(resolved.getString("akka.contrib.persistence.mongodb.mongo.mongouri") == resolved.getString(ConfigUtil.joinPath("service", "connections", "bank-mongo-connection")))
    assert(resolved.getString("db.default.url") == resolved.getString(ConfigUtil.joinPath("service", "connections", "bank-mysql-connection")))
  }
  test("unit configuration denies production stores and socket access before actors start") {
    val config = ConfigFactory.load()
    UnitConfigurationCheck.validate(config)
    for (overrideText <- Vector(
      "akka.persistence.journal.plugin = akka-contrib-mongodb-persistence-journal",
      "akka.persistence.snapshot-store.plugin = akka-contrib-mongodb-persistence-snapshot",
      "akka.persistence.snapshot-store.auto-start-snapshot-stores = [akka-contrib-mongodb-persistence-snapshot]",
      "akka.actor.provider = cluster",
      "db.default.url = \"jdbc:mysql://localhost/unit-forbidden\""
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
