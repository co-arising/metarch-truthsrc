package example.stockreservation.infrastructure.bootstrap

import com.google.inject.AbstractModule

import example.stockreservation.application.projection.handlers.StockLedgerApplyEventSemantics
import example.stockreservation.application.projection.handlers.StockLedgerSnapshotApplyEventSemantics
import example.stockreservation.infrastructure.projection.StockLedgerApplyEventSemanticsImpl
import example.stockreservation.infrastructure.projection.StockLedgerSnapshotApplyEventSemanticsImpl

/** Infrastructure owns assembly: the kernel-facing semantics faces carry no
  * implementation reference, so the face-to-implementation bindings live here,
  * in the layer that can see both sides. */
final class StockLedgerProjectionModule extends AbstractModule {
  override def configure(): Unit = {
    bind(classOf[StockLedgerApplyEventSemantics])
      .to(classOf[StockLedgerApplyEventSemanticsImpl])
    bind(classOf[StockLedgerSnapshotApplyEventSemantics])
      .to(classOf[StockLedgerSnapshotApplyEventSemanticsImpl])
  }
}
