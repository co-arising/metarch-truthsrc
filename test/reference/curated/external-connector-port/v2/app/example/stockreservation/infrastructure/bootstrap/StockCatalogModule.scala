package example.stockreservation.infrastructure.bootstrap

import com.google.inject.AbstractModule
import example.stockreservation.application.toolgates.StockCatalogToolGate
import example.stockreservation.infrastructure.toolgates.StockCatalogToolGateImpl

/** Infrastructure owns assembly: the kernel-facing gate face carries no
  * implementation reference, so the gate-to-implementation binding lives here,
  * in the layer that can see both sides. */
final class StockCatalogModule extends AbstractModule {
  override def configure(): Unit =
    bind(classOf[StockCatalogToolGate]).to(classOf[StockCatalogToolGateImpl])
}
