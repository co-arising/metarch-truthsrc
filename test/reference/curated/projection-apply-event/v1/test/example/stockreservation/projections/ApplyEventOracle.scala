package example.stockreservation.projections

import example.stockreservation.application.projection.handlers.StockLedgerApplyEventSemantics
import example.stockreservation.application.projection.handlers.StockLedgerSnapshotApplyEventSemantics
import example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView
import example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView
import example.stockreservation.domain.entities.ReservationEntity.LedgerReopened
import example.stockreservation.domain.entities.ReservationEntity.LedgerSettled
import example.stockreservation.domain.entities.ReservationEntity.QuantityAdjusted
import example.stockreservation.domain.entities.ReservationEntity.Reserved
import example.stockreservation.domain.entities.ReservationEntity.SnapshotAmended
import example.stockreservation.domain.entities.ReservationEntity.SnapshotRecorded
import example.stockreservation.domain.entities.ReservationEntity.TagUpserted

/** 独立 oracle：期望行以数据形式直陈（零调用生产函数），按桩语义口径构建——
  * 桩：emptyRow＝零 UUID 白纸·stamped＝原样入账·text＝原样；时钟语义归 impl 专测。 */
object ApplyEventOracle {

  val zeroUuid: String = "00000000-0000-0000-0000-000000000000"

  /** 桩语义（确定性双打，命名类）：kernel 性质全走它——同输入恒同输出。 */
  private final class LedgerStubSemantics extends StockLedgerApplyEventSemantics {
    override def emptyRow: StockLedgerView =
      StockLedgerView(net.imadz.common.Id.of(zeroUuid), "", 0, false, 0L, Nil, None, None, "", "")
    override def stamped(raw: java.time.Instant): Option[java.time.Instant] = Option(raw)
    override def text(raw: String): String = raw
  }

  private final class SnapshotStubSemantics extends StockLedgerSnapshotApplyEventSemantics {
    override def emptyRow(entityId: String, tenantId: String): StockLedgerSnapshotView =
      StockLedgerSnapshotView(net.imadz.common.Id.of(entityId), tenantId, 0, 0, false, None)
    override def stamped(raw: java.time.Instant): Option[java.time.Instant] = Option(raw)
  }

  val ledgerStub: StockLedgerApplyEventSemantics = new LedgerStubSemantics

  val snapshotStub: StockLedgerSnapshotApplyEventSemantics = new SnapshotStubSemantics

  def expectedReserved(existing: Option[StockLedgerView], e: Reserved): StockLedgerView = {
    val base = existing.getOrElse(
      StockLedgerView(net.imadz.common.Id.of(zeroUuid), "", 0, false, 0L, Nil, None, None, "", ""))
    base.copy(skuId = e.skuId, label = e.label, quantity = e.quantity, reserved = true,
      lastEventAt = Option(e.occurredAt), `type` = "reserved", tenantId = e.tenantId)
  }

  def expectedAdjusted(row: StockLedgerView, e: QuantityAdjusted): StockLedgerView =
    row.copy(quantity = row.quantity + e.delta, lastEventAt = Option(e.occurredAt))

  def expectedSettled(row: StockLedgerView, e: LedgerSettled): StockLedgerView =
    row.copy(reserved = false, settledAt = Some(e.occurredAt), lastEventAt = Option(e.occurredAt))

  /** None patch＝清列：reopen 抹去 settled 戳、其余列原样保留（D-P09 判例）。 */
  def expectedReopened(row: StockLedgerView, e: LedgerReopened): StockLedgerView =
    row.copy(reserved = true, settledAt = None, lastEventAt = Option(e.occurredAt))

  def expectedSnapshotRecorded(e: SnapshotRecorded, entityId: String): StockLedgerSnapshotView =
    StockLedgerSnapshotView(net.imadz.common.Id.of(entityId), e.tenantId, e.totalAmount, 0, false,
      Option(e.occurredAt))

  def expectedSnapshotAmended(row: StockLedgerSnapshotView, e: SnapshotAmended): StockLedgerSnapshotView =
    row.copy(totalAmount = row.totalAmount + e.delta)
}
