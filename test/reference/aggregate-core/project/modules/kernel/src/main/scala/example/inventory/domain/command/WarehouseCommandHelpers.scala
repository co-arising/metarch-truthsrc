package example.inventory.domain.command

import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.ports.WarehouseComputations

object WarehouseCommandHelpers {
  def emitReserveSkuQuantity(
    state: WarehouseState,
    command: ReserveSkuQuantity,
    hosts: WarehouseComputations
  ): Vector[WarehouseProtocol.Event] = Vector(
    SkuQuantityReserved(hosts.reservationIdentity(command.txid, command.warehouseId, command.skuId, command.quantity))
  )

  def emitCommitSkuReservation(
    state: WarehouseState,
    command: CommitSkuReservation,
    hosts: WarehouseComputations
  ): Vector[WarehouseProtocol.Event] = Vector(SkuReservationCommitted(command.txid))
}
