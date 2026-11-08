package example.inventory.aggregatecore.reference.positive

import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._

object ValidHost extends WarehouseComputations {
  def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId =
    ReservationId(txid.value + "/" + warehouseId.value + "/" + skuId.value + "/" + quantity.toString)
}
