package example.stockreservation.application.connectors

import com.google.inject.ImplementedBy
import example.stockreservation.infrastructure.connectors.StockCatalogConnectorImpl
import scala.concurrent.Future

/**
 * StockCatalogConnector: Application Layer Connector Interface
 * 调外部工具（Node 子进程）的能力面——子进程机械在 infrastructure impl 里（注入手写基建）。
 */
@ImplementedBy(classOf[StockCatalogConnectorImpl])
trait StockCatalogConnector {

  def probeAvailability(script: String): Future[AvailabilityOutcome]
  // Logic: Run the availability probe script against the external catalog and return the typed outcome.

  def locationDirectory(): Future[LocationDirectory]
  // Logic: Fetch the registered location directory snapshot of the warehouse from the external catalog.

}
