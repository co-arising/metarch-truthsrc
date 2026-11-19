package example.stockreservation.domain.entities

import net.imadz.common.CommonTypes.Id

/** 手写名义事件供给（传统合同）：PO 事件经 adapter 后的域事件形态——
  * 本样消费面的最小事件族，承载四形函数与 helper 触发所需的字段。
  * 构造 require＝本 curated 域纪律（与 aggregate-rules-formal 值类型同律）。 */
object ReservationEntity {

  final case class Reserved(skuId: Id, label: String, quantity: Int, tenantId: String, occurredAt: java.time.Instant) {
    require(quantity >= 0 && tenantId != null, "Reserved quantity must be nonnegative and tenantId non-null")
  }

  final case class QuantityAdjusted(delta: Int, occurredAt: java.time.Instant)

  final case class TagUpserted(tag: String) {
    require(tag != null, "TagUpserted tag must be non-null")
  }

  final case class ReservationCancelled(cancelledId: Id)

  final case class SnapshotRecorded(tenantId: String, totalAmount: Long, occurredAt: java.time.Instant) {
    require(tenantId != null, "SnapshotRecorded tenantId must be non-null")
  }

  final case class SnapshotAmended(delta: Long)
}
