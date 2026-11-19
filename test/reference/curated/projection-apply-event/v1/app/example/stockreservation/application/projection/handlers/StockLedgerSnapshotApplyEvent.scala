package example.stockreservation.application.projection.handlers

import javax.inject.{Inject, Singleton}

import example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView
import example.stockreservation.domain.entities.ReservationEntity.SnapshotRecorded
import example.stockreservation.domain.entities.ReservationEntity.SnapshotAmended

/** StockLedgerSnapshotView 投影纯函数族（referenceCode 直译·方言判定已定）。
  * 业务语义（默认行/时间戳）经构造注入的语义面委托——kernel 侧零机制。 */
@Singleton
final class StockLedgerSnapshotApplyEvent @Inject()(sem: StockLedgerSnapshotApplyEventSemantics) {

  /** SnapshotRecorded → StockLedgerSnapshotView（referenceCode 直译·方言 persistenceIdCreate） */
  def onSnapshotRecorded(e: SnapshotRecorded, entityId: String): StockLedgerSnapshotView =
    sem.emptyRow(entityId, e.tenantId).copy(
      totalAmount = e.totalAmount,
      occurredAt = sem.stamped(e.occurredAt)
    )

  /** SnapshotAmended → StockLedgerSnapshotView（referenceCode 直译·方言 updateOnly） */
  def onSnapshotAmended(row: StockLedgerSnapshotView, e: SnapshotAmended): StockLedgerSnapshotView =
    row.copy(
      totalAmount = row.totalAmount + e.delta
    )
}
