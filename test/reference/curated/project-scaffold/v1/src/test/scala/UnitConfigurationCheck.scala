package example.bankwealth.service

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
