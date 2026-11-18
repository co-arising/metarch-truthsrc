package example.stockreservation.domain.services

import example.stockreservation.domain.values.{RequestId, ReservationId, SkuId, WarehouseId}

/** A pure computation. Implementations must not read clocks, randomness, I/O or mutable registries. */
trait ReservationIdentity {
  def reservationId(
      warehouseId: WarehouseId,
      requestId: RequestId,
      sku: SkuId,
      quantity: Long
  ): ReservationId
}

object LengthPrefixedReservationIdentity extends ReservationIdentity {
  override def reservationId(
      warehouseId: WarehouseId,
      requestId: RequestId,
      sku: SkuId,
      quantity: Long
  ): ReservationId = {
    val parts = Vector(warehouseId.value, requestId.value, sku.value, quantity.toString)
    ReservationId(parts.map(part => s"${part.length}:$part").mkString("stock-reservation:v1|", "|", ""))
  }
}
