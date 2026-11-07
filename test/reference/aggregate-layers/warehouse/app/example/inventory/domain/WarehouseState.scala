package example.inventory.domain

final case class WarehouseState(receipts: Map[example.inventory.domain.values.TxId, String])

object WarehouseState {
  def empty: WarehouseState = example.inventory.domain.entities.WarehouseEntity.empty
}
