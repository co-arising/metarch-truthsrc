package example.stockreservation.domain.entities

import net.imadz.common.CommonTypes.Id

/** 预订聚合写侧状态（S1 强一致查询的序列化源）。nature 字段排除（credential 等）由
  * 生成期排除集执行，本面只见排除后字段。settledAt 空＝未结算，中性值 null——
  * 控制器 s1InstantWrites 的 null-safe 判例。 */
final case class ReservationState(
    reservationId: Id,
    skuId: Id,
    quantity: Int,
    reserved: Boolean,
    label: String,
    tenantId: String,
    occurredAt: java.time.Instant,
    settledAt: java.time.Instant) {
  require(quantity >= 0, "quantity must be non-negative")
}
