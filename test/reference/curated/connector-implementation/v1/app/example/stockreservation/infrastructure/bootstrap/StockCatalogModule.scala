package example.stockreservation.infrastructure.bootstrap

import com.google.inject.AbstractModule
import example.stockreservation.application.connectors.StockCatalogConnector
import example.stockreservation.infrastructure.connectors.StockCatalogConnectorImpl

/** Infrastructure owns assembly: the kernel-facing capability face carries no
  * implementation reference, so the port-to-implementation binding lives here,
  * in the layer that can see both sides. */
final class StockCatalogModule extends AbstractModule {
  override def configure(): Unit =
    bind(classOf[StockCatalogConnector]).to(classOf[StockCatalogConnectorImpl])
}
