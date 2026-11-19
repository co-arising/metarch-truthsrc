package example.stockreservation.application.projection.handlers

import example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView
import example.stockreservation.domain.entities.ReservationEntity.SnapshotRecorded
import example.stockreservation.domain.entities.ReservationEntity.SnapshotAmended

/** StockLedgerSnapshotView 投影纯函数族（referenceCode 直译·方言判定已定）。
  * kernel 侧零机制依赖（PO 解包/IO 全在 glue 壳 ViewMachine.run）。 */
object StockLedgerSnapshotApplyEvent {

  /** 族共享空行（persistenceId 族）：identity 列＝entityId 约定（复合键列全取 entityId·tenantId 参数）＋copy 覆写即时补真实键。 */
  private def emptyRow(entityId: String, tenantId: String): StockLedgerSnapshotView = StockLedgerSnapshotView(snapshotId = net.imadz.common.Id.of(entityId), tenantId = tenantId, totalAmount = 0, eventCount = 0, open = false, occurredAt = None)

  /** epoch0/null → now（「无时间戳」语义·本族唯一许可的时钟读取）。 */
  private def ts(i: java.time.Instant): Option[java.time.Instant] =
    Some(Option(i).filterNot(_.toEpochMilli == 0L).getOrElse(java.time.Instant.now()))

  /** SnapshotRecorded → StockLedgerSnapshotView（referenceCode 直译·方言 persistenceIdCreate） */
  def onSnapshotRecorded(e: SnapshotRecorded, entityId: String): StockLedgerSnapshotView =
    emptyRow(entityId, e.tenantId).copy(totalAmount = e.totalAmount, occurredAt = ts(e.occurredAt))

  /** SnapshotAmended → StockLedgerSnapshotView（referenceCode 直译·方言 updateOnly） */
  def onSnapshotAmended(row: StockLedgerSnapshotView, e: SnapshotAmended): StockLedgerSnapshotView =
    row.copy(totalAmount = row.totalAmount + e.delta)
}
