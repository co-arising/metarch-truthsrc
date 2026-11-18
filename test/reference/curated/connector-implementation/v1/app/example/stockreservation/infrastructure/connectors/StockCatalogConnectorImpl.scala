package example.stockreservation.infrastructure.connectors

import javax.inject.{Inject, Singleton}
import example.stockreservation.application.connectors.{AvailabilityOutcome, LocationDirectory, StockCatalogConnector}
import example.stockreservation.infrastructure.process.NodeSubprocessRunner
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** StockCatalogConnectorImpl: Connector Implementation
  * 机械委托给注入的手写基建——子进程机械坐在 infrastructure.process 手写外域，本文件不承载进程机制。
  * 每个方法体是一个 MANUAL 块：块内委托体可由手写演化，重生成字节级保留；BEGIN/END 标记必须成对。 */
@Singleton
class StockCatalogConnectorImpl @Inject()(runner: NodeSubprocessRunner, ec: ExecutionContext)
    extends StockCatalogConnector {

  private val locationDirectoryScript = "stockreservation/location-directory.v1"

  override def probeAvailability(script: String): Future[AvailabilityOutcome] = {
    // ==== BEGIN MANUAL ====
    lift(runner.run(script))(AvailabilityOutcome.decode)
    // ==== END MANUAL ====
  }

  override def locationDirectory(): Future[LocationDirectory] = {
    // ==== BEGIN MANUAL ====
    lift(runner.run(locationDirectoryScript))(LocationDirectory.decode)
    // ==== END MANUAL ====
  }

  private def lift[T](pending: Future[String])(decode: String => Try[T]): Future[T] =
    pending.flatMap(raw => Future.fromTry(decode(raw)))(ec)
}
