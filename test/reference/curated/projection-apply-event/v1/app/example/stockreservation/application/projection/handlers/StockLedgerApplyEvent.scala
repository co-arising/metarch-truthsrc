package example.stockreservation.application.projection.handlers

import example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView
import example.stockreservation.domain.entities.ReservationEntity.Reserved
import example.stockreservation.domain.entities.ReservationEntity.QuantityAdjusted
import example.stockreservation.domain.entities.ReservationEntity.TagUpserted
import example.stockreservation.domain.entities.ReservationEntity.ReservationCancelled

/** StockLedgerView 投影纯函数族（referenceCode 直译·方言判定已定）。
  * kernel 侧零机制依赖（PO 解包/IO 全在 glue 壳 ViewMachine.run）。 */
object StockLedgerApplyEvent {

  /** 族共享空行：全列字面默认——Id 列＝零 UUID 惯例·copy 覆写即时补真实键。 */
  private def emptyRow: StockLedgerView = StockLedgerView(skuId = net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000"), label = "", quantity = 0, reserved = false, totalAmount = 0, tags = Nil, lastEventAt = None, `type` = "", tenantId = "")

  /** epoch0/null → now（「无时间戳」语义·本族唯一许可的时钟读取）。 */
  private def ts(i: java.time.Instant): Option[java.time.Instant] =
    Some(Option(i).filterNot(_.toEpochMilli == 0L).getOrElse(java.time.Instant.now()))

  /** PO String 缺省 null 守卫。 */
  private def strOr(s: String): String = Option(s).getOrElse("")

  /** keyed upsert：命中原位替换（slot 保留）·否则追加。 */
  private def upsertBy[A](list: List[A], item: A)(key: A => String): List[A] = {
    val k = key(item)
    val idx = list.indexWhere(a => key(a) == k)
    if (idx >= 0) list.updated(idx, item) else list :+ item
  }

  /** Reserved → StockLedgerView（referenceCode 直译·方言 create） */
  def onReserved(existing: Option[StockLedgerView], e: Reserved): StockLedgerView =
    existing.getOrElse(emptyRow).copy(skuId = e.skuId, label = strOr(e.label), quantity = e.quantity, reserved = true, lastEventAt = ts(e.occurredAt), `type` = "reserved", tenantId = e.tenantId)

  /** QuantityAdjusted → StockLedgerView（referenceCode 直译·方言 updateOnly） */
  def onQuantityAdjusted(row: StockLedgerView, e: QuantityAdjusted): StockLedgerView =
    row.copy(quantity = row.quantity + e.delta, lastEventAt = ts(e.occurredAt))

  /** TagUpserted → StockLedgerView（referenceCode 直译·方言 updateOnly） */
  def onTagUpserted(row: StockLedgerView, e: TagUpserted): StockLedgerView =
    row.copy(tags = upsertBy(row.tags, e.tag)(t => t))

  /** ReservationCancelled → StockLedgerView（referenceCode 直译·方言 delete） */
  def onReservationCancelled(e: ReservationCancelled): (String, String) =
    ("ledger-root", e.cancelledId.toString)
}
