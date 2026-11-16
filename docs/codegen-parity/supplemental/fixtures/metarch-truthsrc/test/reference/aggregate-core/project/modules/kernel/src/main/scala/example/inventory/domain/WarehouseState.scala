package example.inventory.domain

import example.inventory.domain.values._

final case class WarehouseState(
  receipts: Map[TxId, String] = Map()
)

object WarehouseState {
  val empty: WarehouseState = WarehouseState()
}
