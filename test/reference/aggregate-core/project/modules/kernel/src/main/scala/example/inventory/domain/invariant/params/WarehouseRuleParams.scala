package example.inventory.domain.invariant.params

import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseState
import example.inventory.domain.ports.WarehouseComputations

object WarehouseRuleParams {
  final case class ReserveSkuQuantityParams(
    state: WarehouseState,
    command: WarehouseProtocol.ReserveSkuQuantity,
    hosts: WarehouseComputations
  )

  final case class CommitSkuReservationParams(
    state: WarehouseState,
    command: WarehouseProtocol.CommitSkuReservation,
    hosts: WarehouseComputations
  )
}
