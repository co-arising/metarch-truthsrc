package example.inventory.domain.invariant

import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.command.WarehouseCommandHelpers
import example.inventory.domain.invariant.params.WarehouseRuleParams._
import example.inventory.domain.ports.WarehouseComputations

object WarehouseRules {
  def decide(
    state: WarehouseState,
    command: WarehouseProtocol.Command,
    hosts: WarehouseComputations
  ): Either[String, Vector[WarehouseProtocol.Event]] = command match {
    case value: ReserveSkuQuantity => reserveSkuQuantity(ReserveSkuQuantityParams(state, value, hosts))
    case value: CommitSkuReservation => commitSkuReservation(CommitSkuReservationParams(state, value, hosts))
  }

  def reserveSkuQuantity(params: ReserveSkuQuantityParams): Either[String, Vector[WarehouseProtocol.Event]] = {
    if (!(params.command.quantity > 0L)) Left("quantity-positive")
    else if (params.state.receipts.contains(params.command.txid)) Right(Vector.empty)
    else Right(WarehouseCommandHelpers.emitReserveSkuQuantity(params.state, params.command, params.hosts))
  }

  def commitSkuReservation(params: CommitSkuReservationParams): Either[String, Vector[WarehouseProtocol.Event]] = {
    if (params.state.receipts.contains(params.command.txid)) Right(Vector.empty)
    else Right(WarehouseCommandHelpers.emitCommitSkuReservation(params.state, params.command, params.hosts))
  }
}
