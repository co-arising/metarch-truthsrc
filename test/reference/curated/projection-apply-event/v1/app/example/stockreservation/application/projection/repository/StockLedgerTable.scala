package example.stockreservation.application.projection.repository

import net.imadz.common.CommonTypes.Id

/** 手写名义读表供给（传统合同）：视图列集与列型由壳的 repository 契约持有，
  * kernel 纯函数族只按 viewColumns 消费该列面；columns 清单即列账。 */
object StockLedgerTable {

  final case class StockLedgerView(
    skuId: Id,
    label: String,
    quantity: Int,
    reserved: Boolean,
    totalAmount: Long,
    tags: List[String],
    lastEventAt: Option[java.time.Instant],
    settledAt: Option[java.time.Instant],
    `type`: String,
    tenantId: String
  )

  /** 列账（原名列——`type` 的反引号补缀是发射面规则，账面存原状）。 */
  val columns: Vector[String] = Vector(
    "skuId", "label", "quantity", "reserved", "totalAmount",
    "tags", "lastEventAt", "settledAt", "type", "tenantId"
  )
}
