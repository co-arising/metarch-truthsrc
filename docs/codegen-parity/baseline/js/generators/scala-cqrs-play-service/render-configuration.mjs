import { entry, packageFor, pathFor, symbol } from '../scala-cqrs-domain/naming.mjs';

export function renderConfiguration(artifact, options, footprint) {
  const pkg = packageFor(artifact.artifact.context, options), name = symbol(artifact.artifact.id);
  const service = artifact.deployment.service;
  const q = JSON.stringify;
  const credentialsShape = "(?:[A-Za-z0-9._~!$&'()*+,;=-]|%[0-9A-Fa-f]{2})+(?::(?:[A-Za-z0-9._~!$&'()*+,;=:-]|%[0-9A-Fa-f]{2})*)?";
  const queryValueShape = "(?:[A-Za-z0-9._~!$'()*+,;:@/?=-]|%[0-9A-Fa-f]{2})*";
  const configuration = `package ${pkg}.service

import com.typesafe.config.{Config, ConfigUtil}
import scala.util.control.NonFatal

object ${name}Configuration {
  private val mongoRoot = "akka.contrib.persistence.mongodb.mongo"
  private val journalPlugin = "akka-contrib-mongodb-persistence-journal"
  private val snapshotPlugin = "akka-contrib-mongodb-persistence-snapshot"
  private val credentialsShape = ${q(credentialsShape)}
  private val queryValueShape = ${q(queryValueShape)}

  private def hostShape(host: String): Boolean = {
    val parts = host.split(":", -1)
    parts.length <= 2 && parts(0).matches("[A-Za-z0-9][A-Za-z0-9.-]{0,252}") &&
      (parts.length == 1 || (parts(1).matches("[0-9]{1,5}") && parts(1).toInt > 0 && parts(1).toInt < 65536))
  }
  private def queryShape(query: String): Boolean = {
    if (query.isEmpty) true
    else {
      val options = query.split("&", -1)
      options.length <= 64 && options.forall { option =>
        val at = option.indexOf('=')
        at > 0 && option.take(at).matches("[A-Za-z][A-Za-z0-9_.-]{0,63}") &&
          option.drop(at + 1).matches(queryValueShape)
      }
    }
  }
  // Bounded shapes for this pinned profile, not a general URI parser. No DNS, driver, or actor initialization.
  // ReactiveMongo 1.0.10 consumes the raw database path; authSource is not the destination database.
  private def mongoDestinationShape(value: String): Boolean = {
    if (value.length > 8192 || !value.startsWith("mongodb://")) false
    else {
      val uri = value.drop(10)
      val queryAt = uri.indexOf('?')
      val address = if (queryAt < 0) uri else uri.take(queryAt)
      val query = if (queryAt < 0) "" else uri.drop(queryAt + 1)
      val pathAt = address.indexOf('/')
      if (pathAt <= 0 || !address.drop(pathAt + 1).matches("[A-Za-z0-9_-]{1,63}")) false
      else {
        val authority = address.take(pathAt)
        val at = authority.indexOf('@')
        val hosts = (if (at < 0) authority else authority.drop(at + 1)).split(",", -1)
        val credentials = at < 0 || (at > 0 && at <= 2048 && authority.take(at).matches(credentialsShape))
        credentials && hosts.length <= 64 && hosts.forall(hostShape) && queryShape(query)
      }
    }
  }
  private def mysqlDestinationShape(value: String): Boolean = {
    if (value.length > 8192 || !value.startsWith("jdbc:mysql://")) false
    else {
      val uri = value.drop(13)
      val queryAt = uri.indexOf('?')
      val address = if (queryAt < 0) uri else uri.take(queryAt)
      val query = if (queryAt < 0) "" else uri.drop(queryAt + 1)
      val pathAt = address.indexOf('/')
      pathAt > 0 && hostShape(address.take(pathAt)) &&
        address.drop(pathAt + 1).matches("[A-Za-z0-9_-]{1,64}") && queryShape(query)
    }
  }
  private def rejectDestinationOverrides(config: Config, plugin: String): Unit = {
    val path = ConfigUtil.joinPath(plugin, "overrides")
    if (config.hasPathOrNull(path)) {
      // MongoSettings.withOverride merges these keys directly into the root mongo settings, not under mongo.*.
      val overrides = config.getConfig(path)
      val destinationKeys = Vector("mongouri", "database", "urls", "db", "username", "password", "driver")
      require(!destinationKeys.exists(key => overrides.hasPathOrNull(ConfigUtil.joinPath(key))))
    }
  }

  // The application loader must call this before reflecting the factory or creating an ActorSystem.
  def validate(config: play.api.Configuration): Unit = {
    try {
      val underlying = config.underlying
      val secret = underlying.getString("play.http.secret.key").trim
      require(secret.nonEmpty && !secret.equalsIgnoreCase("changeme"))
      val namespace = underlying.getString(${q(service.namespaceConfig)})
      require(namespace.matches("[A-Za-z][A-Za-z0-9_-]{0,63}"))
      val mongo = underlying.getString(ConfigUtil.joinPath("service", "connections", ${q(service.journal.connectionRef)}))
      val jdbc = underlying.getString(ConfigUtil.joinPath("service", "connections", ${q(service.readSide.connectionRef)}))
      require(mongoDestinationShape(mongo) && mysqlDestinationShape(jdbc))
      require(underlying.getString("akka.persistence.journal.plugin") == journalPlugin)
      require(underlying.getString("akka.persistence.snapshot-store.plugin") == snapshotPlugin)
      require(underlying.getString(ConfigUtil.joinPath(journalPlugin, "class")) == "akka.contrib.persistence.mongodb.MongoJournal")
      require(underlying.getString(ConfigUtil.joinPath(snapshotPlugin, "class")) == "akka.contrib.persistence.mongodb.MongoSnapshots")
      require(underlying.getString(mongoRoot + ".driver") == "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension")
      require(underlying.getString(mongoRoot + ".mongouri") == mongo)
      // RxMongoDriver.dbName gives mongo.database precedence over the URI. Forbid that alternate destination.
      // The reference.conf legacy mongo.db default is unused with an explicit mongouri and remains harmless.
      require(!underlying.hasPathOrNull(mongoRoot + ".database"))
      rejectDestinationOverrides(underlying, journalPlugin)
      rejectDestinationOverrides(underlying, snapshotPlugin)
      require(underlying.getString("db.default.driver") == "com.mysql.cj.jdbc.Driver")
      require(underlying.getString("db.default.url") == jdbc)
    } catch {
      // Config/URI errors may contain credentials. Deliberately retain neither their message nor their cause.
      case NonFatal(_) => throw new IllegalArgumentException("invalid service configuration")
    }
  }
}
`;
  const spec = `package ${pkg}.service

import com.typesafe.config.{Config, ConfigFactory, ConfigUtil, ConfigValueFactory}
import org.scalatest.funsuite.AnyFunSuite

final class GeneratedServiceConfigurationSpec extends AnyFunSuite {
  UnitConfigurationCheck.main(Array.empty)

  private val mongoRoot = "akka.contrib.persistence.mongodb.mongo"
  private val journalPlugin = "akka-contrib-mongodb-persistence-journal"
  private val snapshotPlugin = "akka-contrib-mongodb-persistence-snapshot"
  private val namespacePath = ${q(service.namespaceConfig)}
  private val journalRef = ${q(service.journal.connectionRef)}
  private val readSideRef = ${q(service.readSide.connectionRef)}
  private val mongoPath = ConfigUtil.joinPath("service", "connections", journalRef)
  private val jdbcPath = ConfigUtil.joinPath("service", "connections", readSideRef)
  private val mongo = "mongodb://127.0.0.1:1/configuration_check"
  private val jdbc = "jdbc:mysql://127.0.0.1:1/configuration_check"
  private def text(value: String) = ConfigValueFactory.fromAnyRef(value)
  // Construct only synthetic values. Do not load production configuration, factories, actors, or drivers.
  private val good = Vector(
    namespacePath -> "isolated_configuration_check",
    "play.http.secret.key" -> "configuration-test-only-not-a-secret",
    mongoPath -> mongo,
    jdbcPath -> jdbc,
    "akka.persistence.journal.plugin" -> journalPlugin,
    "akka.persistence.snapshot-store.plugin" -> snapshotPlugin,
    ConfigUtil.joinPath(journalPlugin, "class") -> "akka.contrib.persistence.mongodb.MongoJournal",
    ConfigUtil.joinPath(snapshotPlugin, "class") -> "akka.contrib.persistence.mongodb.MongoSnapshots",
    (mongoRoot + ".driver") -> "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension",
    (mongoRoot + ".mongouri") -> mongo,
    (mongoRoot + ".db") -> "akka-persistence",
    "db.default.driver" -> "com.mysql.cj.jdbc.Driver",
    "db.default.url" -> jdbc
  ).foldLeft(ConfigFactory.empty()) { case (config, (path, value)) => config.withValue(path, text(value)) }
  private def checked(config: Config): Unit = ${name}Configuration.validate(play.api.Configuration(config))
  private def rejected(config: Config): Unit = {
    val error = intercept[IllegalArgumentException](checked(config))
    assert(error.getMessage == "invalid service configuration")
    assert(error.getCause == null)
  }
  private def withMongo(value: String): Config = good.withValue(mongoPath, text(value)).withValue(mongoRoot + ".mongouri", text(value))
  private def withJdbc(value: String): Config = good.withValue(jdbcPath, text(value)).withValue("db.default.url", text(value))

  test("explicit isolated namespace and destinations validate without driver initialization") {
    checked(good)
    // Namespace need not equal either database. The legacy mongo.db default must never supply a missing URI database.
    checked(good.withValue(namespacePath, text("another_isolated_namespace")))
  }
  test("Mongo credentials multi-host addresses and options preserve the explicit raw database") {
    for (value <- Vector(
      "mongodb://mongo-a.invalid/configuration_check?authSource=admin",
      "mongodb://mongo-a.invalid:1,mongo-b.invalid:2/configuration_check?replicaSet=test&ssl=true",
      "mongodb://fake-user:fake-pass@mongo-a.invalid:1,mongo-b.invalid:2/configuration_check?authSource=admin",
      "mongodb://fake%40user:fake%3Apass@mongo-a.invalid:1/configuration_check?authSource=admin"
    )) checked(withMongo(value))
    checked(withJdbc("jdbc:mysql://mysql.invalid:1/configuration_check?useSSL=false&serverTimezone=UTC"))
  }
  test("Mongo rejects absent invalid or encoded databases rather than selecting akka-persistence") {
    for (value <- Vector(
      "mongodb://127.0.0.1:1", "mongodb://127.0.0.1:1/", "mongodb://127.0.0.1:1?authSource=admin",
      "mongodb://127.0.0.1:1/?authSource=admin", "mongodb://127.0.0.1:1/bad.name",
      "mongodb://127.0.0.1:1/bad%2Fname", "mongodb://127.0.0.1:1/bad/name",
      "mongodb://127.0.0.1:1/bad name", "mongodb://127.0.0.1:1/" + "a" * 64,
      "mongodb+srv://mongo.invalid/configuration_check", "mongodb://127.0.0.1:0/configuration_check",
      "mongodb://127.0.0.1:65536/configuration_check", "mongodb:///configuration_check",
      "mongodb://mongo.invalid,/configuration_check", "mongodb://fake%ZZ:fake-pass@mongo.invalid/configuration_check",
      "mongodb://mongo.invalid/configuration_check?authSource", "mongodb://mongo.invalid/configuration_check#fragment"
    )) rejected(withMongo(value))
  }
  test("MySQL requires its pinned scheme explicit database and driver") {
    for (value <- Vector(
      "jdbc:mysql://127.0.0.1:1", "jdbc:mysql://127.0.0.1:1/", "jdbc:mysql://127.0.0.1:1/?useSSL=false",
      "jdbc:mysql://127.0.0.1:1/bad/name", "jdbc:mysql://127.0.0.1:1/bad%2Fname",
      "jdbc:mysql:///configuration_check", "jdbc:mysql://mysql.invalid:0/configuration_check",
      "jdbc:postgresql://127.0.0.1:1/configuration_check"
    )) rejected(withJdbc(value))
    rejected(good.withValue("db.default.driver", text("org.postgresql.Driver")))
  }
  test("all required configuration fails closed when absent before factory creation") {
    for (path <- Vector(namespacePath, "play.http.secret.key", mongoPath, jdbcPath,
      "akka.persistence.journal.plugin", "akka.persistence.snapshot-store.plugin",
      ConfigUtil.joinPath(journalPlugin, "class"), ConfigUtil.joinPath(snapshotPlugin, "class"),
      mongoRoot + ".driver", mongoRoot + ".mongouri", "db.default.driver", "db.default.url")) {
      rejected(good.withoutPath(path))
    }
  }
  test("empty default or malformed secrets yield only a generic error without a cause") {
    for (secret <- Vector("", "   ", "changeme", " CHANGEME ")) rejected(good.withValue("play.http.secret.key", text(secret)))
    rejected(good.withValue("play.http.secret.key", ConfigValueFactory.fromAnyRef(null)))
    rejected(good.withValue("play.http.secret.key", ConfigFactory.parseString("value = [test-only]").getValue("value")))
    for (namespace <- Vector("", "bad.namespace", "bad namespace", "a" * 65)) rejected(good.withValue(namespacePath, text(namespace)))
  }
  test("root database must not override the validated URI even with the same database name") {
    for (database <- Vector("configuration_check", "other_database", "")) rejected(good.withValue(mongoRoot + ".database", text(database)))
    rejected(good.withValue(mongoRoot + ".database", ConfigValueFactory.fromAnyRef(null)))
  }
  test("journal and snapshot destination overrides are rejected but tuning remains permitted") {
    for (plugin <- Vector(journalPlugin, snapshotPlugin)) {
      val overrides = ConfigUtil.joinPath(plugin, "overrides")
      for (key <- Vector("mongouri", "database", "urls", "db", "username", "password", "driver")) {
        val path = ConfigUtil.joinPath(plugin, "overrides", key)
        rejected(good.withValue(path, text(if (key == "mongouri") mongo else "test-only")))
        rejected(good.withValue(path, ConfigValueFactory.fromAnyRef(null)))
      }
      rejected(good.withValue(overrides, text("not-an-object")))
      rejected(good.withValue(overrides, ConfigValueFactory.fromAnyRef(null)))
      checked(good.withValue(overrides, ConfigFactory.parseString("journal-wtimeout = 5s").root()))
    }
  }
  test("active journal snapshot classes and RxMongo extension must match their production pins") {
    for ((path, value) <- Vector(
      "akka.persistence.journal.plugin" -> "akka.persistence.testkit.journal",
      "akka.persistence.snapshot-store.plugin" -> "akka.persistence.testkit.snapshotstore.pluginid",
      ConfigUtil.joinPath(journalPlugin, "class") -> "other.Journal",
      ConfigUtil.joinPath(snapshotPlugin, "class") -> "other.Snapshot",
      (mongoRoot + ".driver") -> "akka.contrib.persistence.mongodb.ScalaMongoPersistenceExtension"
    )) rejected(good.withValue(path, text(value)))
  }
  test("driver destinations cannot differ from the symbolic references") {
    rejected(good.withValue(mongoRoot + ".mongouri", text("mongodb://127.0.0.1:1/other_database")))
    rejected(good.withValue("db.default.url", text("jdbc:mysql://127.0.0.1:1/other_database")))
  }
  test("symbolic references containing dots remain literal connection keys rather than nested paths") {
    val literal = ConfigUtil.joinPath("service", "connections", "journal.primary")
    val example = ConfigFactory.empty().withValue(literal, text(mongo))
    assert(example.getString(literal) == mongo)
    assert(!example.hasPath("service.connections.journal.primary"))
    for ((id, path, value) <- Vector((journalRef, mongoPath, mongo), (readSideRef, jdbcPath, jdbc))) {
      assert(good.getString(ConfigUtil.joinPath("service", "connections", id)) == value)
      if (id.contains(".")) rejected(good.withoutPath(path).withValue("service.connections." + id, text(value)))
    }
  }
}
`;
  return [
    entry(pathFor(pkg, 'service/' + artifact.artifact.id + 'Configuration.scala'), configuration, 'service-runtime', [artifact.source], footprint),
    entry('src/test/scala/GeneratedServiceConfigurationSpec.scala', spec, 'service-test', [artifact.source], footprint)
  ];
}
