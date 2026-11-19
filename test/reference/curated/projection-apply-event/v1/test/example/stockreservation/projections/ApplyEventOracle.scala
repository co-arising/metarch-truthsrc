package example.stockreservation.projections

import example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView
import example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView
import example.stockreservation.domain.entities.ReservationEntity.QuantityAdjusted
import example.stockreservation.domain.entities.ReservationEntity.Reserved
import example.stockreservation.domain.entities.ReservationEntity.SnapshotAmended
import example.stockreservation.domain.entities.ReservationEntity.SnapshotRecorded
import example.stockreservation.domain.entities.ReservationEntity.TagUpserted

/** 独立 oracle：期望行以数据形式直陈（零调用生产函数），供性质逐字段比对。
  * 时间列按「normal 时间戳直译」口径构建——epoch0 归一由 negative 单独钉住。 */
object ApplyEventOracle {

  def expectedReserved(existing: Option[StockLedgerView], e: Reserved): StockLedgerView = {
    val base = existing.getOrElse(StockLedgerView(net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000"), "", 0, false, 0L, Nil, None, "", ""))
    base.copy(skuId = e.skuId, label = orEmpty(e.label), quantity = e.quantity, reserved = true,
      lastEventAt = Some(e.occurredAt), `type` = "reserved", tenantId = e.tenantId)
  }

  def expectedAdjusted(row: StockLedgerView, e: QuantityAdjusted): StockLedgerView =
    row.copy(quantity = row.quantity + e.delta, lastEventAt = Some(e.occurredAt))

  def expectedUpsert(row: StockLedgerView, e: TagUpserted): StockLedgerView = {
    val index = row.tags.indexOf(e.tag)
    val next = if (index >= 0) row.tags.updated(index, e.tag) else row.tags :+ e.tag
    row.copy(tags = next)
  }

  def expectedSnapshotRecorded(e: SnapshotRecorded, entityId: String): StockLedgerSnapshotView =
    StockLedgerSnapshotView(net.imadz.common.Id.of(entityId), e.tenantId, e.totalAmount, 0, false, Some(e.occurredAt))

  def expectedSnapshotAmended(row: StockLedgerSnapshotView, e: SnapshotAmended): StockLedgerSnapshotView =
    row.copy(totalAmount = row.totalAmount + e.delta)

  private def orEmpty(label: String): String = if (label == null) "" else label
}
