package example.stockreservation.domain.entities

import example.stockreservation.domain.values._

object StockReservationEntity {
  final case class StoredReservation(
      reservationId: ReservationId,
      sku: SkuId,
      quantity: Long,
      locations: Vector[LocationId],
      locationNotes: Option[Map[LocationId, Vector[ReservationNote]]]
  ) {
    require(quantity > 0L, "Stored reservations must have a positive quantity")
  }

  final case class StockReservationState(
      warehouseId: WarehouseId,
      available: Map[SkuId, Long],
      registeredLocations: Set[LocationId],
      reservations: Map[RequestId, StoredReservation],
      confirmedRequests: Set[RequestId]
  ) {
    require(available.values.forall(_ >= 0L), "Available quantities must be nonnegative")
    require(confirmedRequests.subsetOf(reservations.keySet), "Confirmed requests must have reservations")
  }

  sealed trait StockReservationEvents

  final case class UnitsReserved(
      requestId: RequestId,
      reservationId: ReservationId,
      sku: SkuId,
      quantity: Long,
      locations: Vector[LocationId],
      locationNotes: Option[Map[LocationId, Vector[ReservationNote]]]
  ) extends StockReservationEvents

  final case class ReservationReceiptIssued(
      requestId: RequestId,
      reservationId: ReservationId
  ) extends StockReservationEvents

  final case class ReservationConfirmed(
      requestId: RequestId,
      reservationId: ReservationId
  ) extends StockReservationEvents
}
