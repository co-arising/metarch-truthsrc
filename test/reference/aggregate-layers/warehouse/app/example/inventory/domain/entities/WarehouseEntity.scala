package example.inventory.domain.entities

object WarehouseEntity {
  type State = example.inventory.domain.WarehouseState
  val State: example.inventory.domain.WarehouseState.type = example.inventory.domain.WarehouseState

  type Event = example.inventory.domain.WarehouseProtocol.Event

  object Events {
    type SkuQuantityReserved = example.inventory.domain.WarehouseProtocol.SkuQuantityReserved
    val SkuQuantityReserved: example.inventory.domain.WarehouseProtocol.SkuQuantityReserved.type =
      example.inventory.domain.WarehouseProtocol.SkuQuantityReserved

    type SkuReservationCommitted = example.inventory.domain.WarehouseProtocol.SkuReservationCommitted
    val SkuReservationCommitted: example.inventory.domain.WarehouseProtocol.SkuReservationCommitted.type =
      example.inventory.domain.WarehouseProtocol.SkuReservationCommitted

    type SkuReservationReleased = example.inventory.domain.WarehouseProtocol.SkuReservationReleased
    val SkuReservationReleased: example.inventory.domain.WarehouseProtocol.SkuReservationReleased.type =
      example.inventory.domain.WarehouseProtocol.SkuReservationReleased

    type SkuReservationRequested = example.inventory.domain.WarehouseProtocol.SkuReservationRequested
    val SkuReservationRequested: example.inventory.domain.WarehouseProtocol.SkuReservationRequested.type =
      example.inventory.domain.WarehouseProtocol.SkuReservationRequested
  }

  def empty: State = State(Map())
}
