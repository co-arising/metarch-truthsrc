package example.inventory.domain.ports

import example.inventory.domain.values._

trait WarehouseComputations {
  def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId
}
