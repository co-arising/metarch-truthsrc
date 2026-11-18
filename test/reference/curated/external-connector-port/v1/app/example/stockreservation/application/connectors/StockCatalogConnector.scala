package example.stockreservation.application.connectors

import scala.concurrent.Future

/**
 * StockCatalogConnector: Application Layer Connector Interface
 * 调外部工具（Node 子进程）的能力面——子进程机械在 infrastructure impl 里（注入手写基建）。
 * 内核隔离：本能力面不引用任何实现类；装配由 infrastructure.bootstrap 显式绑定完成。
 */
trait StockCatalogConnector {

  def probeAvailability(script: String): Future[AvailabilityOutcome]
  // Logic: Run the availability probe script against the external catalog and return the typed outcome.

  def locationDirectory(): Future[LocationDirectory]
  // Logic: Fetch the registered location directory snapshot of the warehouse from the external catalog.

}
