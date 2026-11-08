package example.inventory.persistencereadside.reference

import org.scalatest.funsuite.AnyFunSuite
import org.h2.jdbcx.JdbcDataSource
import java.sql.Connection
import java.lang.reflect.{InvocationHandler, InvocationTargetException, Method, Proxy}
import javax.sql.DataSource
import scala.util.Try
import example.inventory.infrastructure.readside.WarehouseReadsideRepository

final class ReadsideBoundarySpec extends AnyFunSuite {
  import ReadsideSupport._

  test("case insensitive H2 comparison is refused before namespaces can alias") {
    for (option <- Vector("", ";IGNORECASE=FALSE")) {
      val ds = fresh()
      ds.setURL(ds.getURL + option)
      new WarehouseReadsideRepository(ds, "Accounts").initialize()
      new WarehouseReadsideRepository(ds, "accounts").initialize()
      assert(sql(ds, "SELECT namespace_id FROM warehouse_rs_namespace ORDER BY namespace_id")(_.getString(1)) == Vector("Accounts", "accounts"), "ORACLE_CASE_SENSITIVE_NAMESPACE_DISTINCT")
    }
    val ds = fresh()
    ds.setURL(ds.getURL + ";IGNORECASE=TRUE")
    assert(Try(new WarehouseReadsideRepository(ds, "Accounts").initialize()).isFailure, "ORACLE_CASE_SENSITIVE_NAMESPACE")
    // Disabling the setting does not convert existing VARCHAR_IGNORECASE columns.
    val existing = fresh()
    val repository = new WarehouseReadsideRepository(existing, "Accounts")
    repository.initialize()
    ReadsideSupport.execute(existing, "ALTER TABLE warehouse_rs_namespace ALTER COLUMN namespace_id VARCHAR_IGNORECASE(256) NOT NULL")
    existing.setURL(existing.getURL + ";IGNORECASE=FALSE")
    assert(Try(repository.initialize()).isFailure, "ORACLE_CASE_INSENSITIVE_EXISTING_COLUMN")
  }

  test("metadata patterns do not confuse unrelated underscore matching tables") {
    val ds = fresh()
    ReadsideSupport.execute(ds, "CREATE TABLE warehousexrs_event (unrelated INT)")
    val repository = new WarehouseReadsideRepository(ds, "n")
    repository.initialize()
    assert(repository.lastSequenceNr("p") == 0, "ORACLE_METADATA_EXACT_TABLE")
    repository.initialize()
  }

  test("retained session is invalid before driver commit hook runs") {
    val delegate = fresh()
    var retained: WarehouseReadsideRepository.Session = null
    var checked = false
    val wrapper = new DataSource {
      def getConnection(): Connection = {
        val connection = delegate.getConnection()
        Proxy.newProxyInstance(getClass.getClassLoader, Array(classOf[Connection]), new InvocationHandler {
          def invoke(proxy: Any, method: Method, args: Array[AnyRef]): AnyRef = {
            if (method.getName == "commit" && retained != null) {
              checked = true
              assert(Try(retained.lastSequenceNr("p")).isFailure, "ORACLE_CALLBACK_SESSION_BOUNDARY")
            }
            try method.invoke(connection, Option(args).getOrElse(Array.empty[AnyRef]): _*)
            catch { case error: InvocationTargetException => throw error.getCause }
          }
        }).asInstanceOf[Connection]
      }
      def getConnection(user: String, password: String): Connection = getConnection()
      def getLogWriter(): java.io.PrintWriter = delegate.getLogWriter
      def setLogWriter(writer: java.io.PrintWriter): Unit = delegate.setLogWriter(writer)
      def getLoginTimeout(): Int = delegate.getLoginTimeout
      def setLoginTimeout(seconds: Int): Unit = delegate.setLoginTimeout(seconds)
      def getParentLogger(): java.util.logging.Logger = delegate.getParentLogger
      def unwrap[T](clazz: Class[T]): T = throw new java.sql.SQLException("not wrapper")
      def isWrapperFor(clazz: Class[_]): Boolean = false
    }
    val repository = new WarehouseReadsideRepository(wrapper, "n")
    repository.initialize()
    repository.transaction { session => retained = session }
    assert(checked, "ORACLE_COMMIT_HOOK_REACHED")
  }
}
