package example.stockreservation.domain.invariant

import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

import example.stockreservation.domain.entities.StockReservationEntity
import example.stockreservation.domain.entities.StockReservationEntity.{StockReservationEvents, StockReservationState}
import example.stockreservation.domain.services.ReservationIdentity
import example.stockreservation.domain.values._

object StockReservationRules {
  sealed abstract class ReservationRejection(val code: String, val message: String) {
    final def toError: iMadzError = iMadzError(code, message)
  }

  object ReservationRejection {
    case object QuantityNotPositive extends ReservationRejection(
      "STOCK_QUANTITY_NONPOSITIVE", "Requested quantity must be greater than zero."
    )
    case object RequestAlreadyReserved extends ReservationRejection(
      "STOCK_REQUEST_ALREADY_RESERVED", "The request already has a reservation."
    )
    case object UnknownLocation extends ReservationRejection(
      "STOCK_LOCATION_UNKNOWN", "Every requested location must be registered."
    )
    case object StockUnavailable extends ReservationRejection(
      "STOCK_UNAVAILABLE", "The SKU must exist with sufficient available quantity."
    )
    case object ReservationMissing extends ReservationRejection(
      "STOCK_RESERVATION_MISSING", "The request has no reservation."
    )
    case object ReservationIdentityMismatch extends ReservationRejection(
      "STOCK_RESERVATION_ID_MISMATCH", "The reservation identity does not match the request."
    )
  }

  final case class ReserveUnitsParams(
      requestId: RequestId,
      sku: SkuId,
      quantity: Long,
      locations: Vector[LocationId],
      locationNotes: Option[Map[LocationId, Vector[ReservationNote]]]
  )

  final case class ConfirmReservationParams(
      requestId: RequestId,
      reservationId: ReservationId
  )

  final class ReserveUnitsRule(identity: ReservationIdentity)
      extends InvariantRule[StockReservationEvents, StockReservationState, ReserveUnitsParams] {
    import ReservationRejection._

    override def apply(
        state: StockReservationState,
        p: ReserveUnitsParams
    ): Either[iMadzError, List[StockReservationEvents]] =
      if (p.quantity <= 0L) Left(QuantityNotPositive.toError)
      else if (state.reservations.contains(p.requestId)) Left(RequestAlreadyReserved.toError)
      else if (!p.locations.forall(state.registeredLocations.contains)) Left(UnknownLocation.toError)
      else if (!state.available.get(p.sku).exists(_ >= p.quantity)) Left(StockUnavailable.toError)
      else {
        val reservationId = identity.reservationId(state.warehouseId, p.requestId, p.sku, p.quantity)
        Right(List(
          StockReservationEntity.UnitsReserved(
            p.requestId, reservationId, p.sku, p.quantity, p.locations, p.locationNotes
          ),
          StockReservationEntity.ReservationReceiptIssued(p.requestId, reservationId)
        ))
      }
  }

  object ConfirmReservationRule
      extends InvariantRule[StockReservationEvents, StockReservationState, ConfirmReservationParams] {
    import ReservationRejection._

    override def apply(
        state: StockReservationState,
        p: ConfirmReservationParams
    ): Either[iMadzError, List[StockReservationEvents]] =
      state.reservations.get(p.requestId) match {
        case None => Left(ReservationMissing.toError)
        case Some(reservation) =>
          if (reservation.reservationId != p.reservationId) Left(ReservationIdentityMismatch.toError)
          else if (state.confirmedRequests.contains(p.requestId)) Right(Nil)
          else Right(List(StockReservationEntity.ReservationConfirmed(p.requestId, p.reservationId)))
      }
  }
}
