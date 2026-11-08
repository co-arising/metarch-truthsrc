package example.inventory.domain

import example.inventory.domain.values._

object WarehouseProtocol {
  sealed trait Command
  sealed trait Event

  final case class ReserveSkuQuantity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long) extends Command

  final case class CommitSkuReservation(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, reservationId: ReservationId) extends Command

  final case class SkuQuantityReserved(reservationId: ReservationId) extends Event

  final case class SkuReservationCommitted(txid: TxId) extends Event
}
