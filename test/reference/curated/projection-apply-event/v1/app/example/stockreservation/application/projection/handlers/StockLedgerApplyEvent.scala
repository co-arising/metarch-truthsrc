package example.stockreservation.application.projection.handlers

import javax.inject.{Inject, Singleton}

import example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView
import example.stockreservation.domain.entities.ReservationEntity.Reserved
import example.stockreservation.domain.entities.ReservationEntity.QuantityAdjusted
import example.stockreservation.domain.entities.ReservationEntity.TagUpserted
import example.stockreservation.domain.entities.ReservationEntity.LedgerSettled
import example.stockreservation.domain.entities.ReservationEntity.LedgerReopened
import example.stockreservation.domain.entities.ReservationEntity.ReservationCancelled

/** StockLedgerView 投影纯函数族（referenceCode 直译·方言判定已定）。
  * 业务语义（默认行/时间戳/文本）经构造注入的语义面委托——kernel 侧零机制。 */
@Singleton
final class StockLedgerApplyEvent @Inject()(sem: StockLedgerApplyEventSemantics) {

  /** keyed upsert：命中原位替换（slot 保留）·否则追加。 */
  private def upsertBy[A](list: List[A], item: A)(key: A => String): List[A] = {
    val k = key(item)
    val idx = list.indexWhere(a => key(a) == k)
    if (idx >= 0) list.updated(idx, item) else list :+ item
  }

  /** Reserved → StockLedgerView（referenceCode 直译·方言 create） */
  def onReserved(existing: Option[StockLedgerView], e: Reserved): StockLedgerView =
    existing.getOrElse(sem.emptyRow).copy(
      skuId = e.skuId,
      label = sem.text(e.label),
      quantity = e.quantity,
      reserved = true,
      lastEventAt = sem.stamped(e.occurredAt),
      `type` = "reserved",
      tenantId = e.tenantId
    )

  /** QuantityAdjusted → StockLedgerView（referenceCode 直译·方言 updateOnly） */
  def onQuantityAdjusted(row: StockLedgerView, e: QuantityAdjusted): StockLedgerView =
    row.copy(
      quantity = row.quantity + e.delta,
      lastEventAt = sem.stamped(e.occurredAt)
    )

  /** TagUpserted → StockLedgerView（referenceCode 直译·方言 updateOnly） */
  def onTagUpserted(row: StockLedgerView, e: TagUpserted): StockLedgerView =
    row.copy(
      tags = upsertBy(row.tags, e.tag)(t => t)
    )

  /** LedgerSettled → StockLedgerView（referenceCode 直译·方言 updateOnly） */
  def onLedgerSettled(row: StockLedgerView, e: LedgerSettled): StockLedgerView =
    row.copy(
      reserved = false,
      settledAt = Some(e.occurredAt),
      lastEventAt = sem.stamped(e.occurredAt)
    )

  /** LedgerReopened → StockLedgerView（referenceCode 直译·方言 updateOnly·None patch＝清列判例） */
  def onLedgerReopened(row: StockLedgerView, e: LedgerReopened): StockLedgerView =
    row.copy(
      reserved = true,
      settledAt = None,
      lastEventAt = sem.stamped(e.occurredAt)
    )

  /** ReservationCancelled → StockLedgerView（referenceCode 直译·方言 delete） */
  def onReservationCancelled(e: ReservationCancelled): (String, String) =
    ("ledger-root", e.cancelledId.toString)
}
