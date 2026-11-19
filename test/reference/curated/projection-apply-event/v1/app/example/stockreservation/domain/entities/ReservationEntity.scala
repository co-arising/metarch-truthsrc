package example.stockreservation.domain.entities

import net.imadz.common.CommonTypes.Id

/** 手写名义事件供给（传统合同）：PO 事件经 adapter 后的域事件形态——
  * 真源惯例（CreditBalanceEntity 判例）：实体事件是 sealed 家族；本族只按
  * eventFqn import 消费，事件类型的发射归实体侧族，不在本族范围。
  * 构造 require＝本 curated 域纪律（与 aggregate-rules-formal 值类型同律）。 */
object ReservationEntity {

  sealed trait ReservationEvent

  final case class Reserved(
      skuId: Id,
      label: String,
      quantity: Int,
      tenantId: String,
      occurredAt: java.time.Instant
  ) extends ReservationEvent {
    require(quantity >= 0 && tenantId != null,
      "Reserved quantity must be nonnegative and tenantId non-null")
  }

  final case class QuantityAdjusted(
      delta: Int,
      occurredAt: java.time.Instant
  ) extends ReservationEvent

  final case class TagUpserted(tag: String) extends ReservationEvent {
    require(tag != null, "TagUpserted tag must be non-null")
  }

  final case class LedgerSettled(occurredAt: java.time.Instant) extends ReservationEvent

  final case class LedgerReopened(occurredAt: java.time.Instant) extends ReservationEvent

  final case class ReservationCancelled(cancelledId: Id) extends ReservationEvent

  final case class SnapshotRecorded(
      tenantId: String,
      totalAmount: Long,
      occurredAt: java.time.Instant
  ) extends ReservationEvent {
    require(tenantId != null, "SnapshotRecorded tenantId must be non-null")
  }

  final case class SnapshotAmended(delta: Long) extends ReservationEvent
}
