package example.inventory.aggregatecore.reference.negative

import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._

// Expected compile failure: Long does not implement the ReservationId result.
final class WrongOutputType extends WarehouseComputations {
  def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): Long = quantity
}
