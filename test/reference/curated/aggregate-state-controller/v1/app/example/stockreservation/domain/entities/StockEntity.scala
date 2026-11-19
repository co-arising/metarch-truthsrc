package example.stockreservation.domain.entities

import net.imadz.common.CommonTypes.Id

/** 库存聚合写侧状态（S1 强一致查询的序列化源；字段形状与预订面互异，逐聚合独立 writer）。 */
final case class StockState(
    stockId: Id,
    skuId: Id,
    available: Int,
    updatedAt: java.time.Instant) {
  require(available >= 0, "available must be non-negative")
}
