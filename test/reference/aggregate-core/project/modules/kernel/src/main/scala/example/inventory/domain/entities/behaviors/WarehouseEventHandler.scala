package example.inventory.domain.entities.behaviors

import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState

object WarehouseEventHandler {
  def apply(state: WarehouseState, event: WarehouseProtocol.Event): WarehouseState = event match {
    case _: SkuQuantityReserved => state
    case value: SkuReservationCommitted =>
      state.copy(receipts = state.receipts.updated(value.txid, "SkuReservationCommitted"))
  }
}
